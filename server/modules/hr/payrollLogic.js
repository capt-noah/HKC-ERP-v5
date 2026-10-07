import { pool } from "../../db/client.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { withTransaction } from "../../db/transactionHelper.js"

// Ethiopian Income Tax Calculation Helper
export function calculateEthiopianIncomeTax(taxableSalary) {
  const s = Number(taxableSalary || 0)
  if (s <= 600) return 0
  if (s <= 1650) return s * 0.1 - 60
  if (s <= 3200) return s * 0.15 - 142.5
  if (s <= 5250) return s * 0.2 - 302.5
  if (s <= 7800) return s * 0.25 - 565
  if (s <= 10900) return s * 0.3 - 955
  return s * 0.35 - 1500
}

export async function listPayrollPeriods() {
  const [rows] = await pool.query("SELECT * FROM `payroll_periods` ORDER BY created_at DESC")
  return { status: 200, body: rows.map((r) => unwrapRow(r, "relational")) }
}

export async function getPayrollPeriod(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll period '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "relational") }
}

export async function createPayrollPeriod(body = {}) {
  const periodId = body.id || `PP-${Date.now()}`
  const validCols = await getTableColumns("payroll_periods")
  const rawData = {
    ...body,
    id: periodId,
    name: body.name || `Payroll - ${body.month || new Date().getMonth() + 1}/${body.year || new Date().getFullYear()}`,
    month: Number(body.month || new Date().getMonth() + 1),
    year: Number(body.year || new Date().getFullYear()),
    start_date: body.start_date || body.startDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
    end_date: body.end_date || body.endDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-28`,
    status: body.status || "Draft",
  }
  const normalized = normalizeBodyToDbColumns(rawData, validCols)
  const fields = Object.keys(normalized).filter(
    (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
  )
  const placeholders = fields.map(() => "?").join(", ")
  const values = fields.map((k) => sanitizeSqlValue(normalized[k]))

  await pool.query(
    `INSERT INTO \`payroll_periods\` (\`${fields.join("`, `")}\`) VALUES (${placeholders})`,
    values
  )

  const [rows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [periodId])
  return { status: 201, body: unwrapRow(rows[0], "relational") }
}

export async function calculatePayrollForPeriod(periodId) {
  const cleanId = String(periodId).trim()

  return await withTransaction(async (conn) => {
    // 1. Get period
    const [pRows] = await conn.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
    if (pRows.length === 0) return { status: 404, body: { error: `Period '${cleanId}' not found.` } }
    const period = unwrapRow(pRows[0], "relational")

    // 2. Get active employees
    const [empRows] = await conn.query("SELECT * FROM `employees`")
    const employees = empRows
      .map((r) => unwrapRow(r, "relational"))
      .filter((e) => e.status === "Active")

    // 3. Delete old records for this period directly by relational column
    await conn.query("DELETE FROM `payroll_records` WHERE payroll_period_id = ?", [cleanId])

    // 4. Generate records for each employee
    let totalGross = 0
    let totalTax = 0
    let totalPension = 0
    let totalNet = 0
    const records = []
    const recCols = await getTableColumns("payroll_records")

    for (const emp of employees) {
      const basicSalary = Number(emp.basic_salary || 0)
      const taxableSalary = basicSalary
      const incomeTax = Math.max(0, Math.round(calculateEthiopianIncomeTax(taxableSalary) * 100) / 100)
      const pensionEmployee = Math.round(basicSalary * 0.07 * 100) / 100
      const pensionEmployer = Math.round(basicSalary * 0.11 * 100) / 100
      const totalPensionContribution = pensionEmployee + pensionEmployer
      const netSalary = Math.max(0, Math.round((basicSalary - incomeTax - pensionEmployee) * 100) / 100)

      totalGross += basicSalary
      totalTax += incomeTax
      totalPension += totalPensionContribution
      totalNet += netSalary

      const recordId = `PR-${cleanId}-${emp.id}`
      const payrollRecord = {
        id: recordId,
        payroll_period_id: cleanId,
        employee_id: emp.id,
        basic_salary: basicSalary,
        taxable_allowances: 0,
        non_taxable_allowances: 0,
        allowances: 0,
        overtime_pay: 0,
        bonus: 0,
        other_earnings: 0,
        tax: incomeTax,
        pension: totalPensionContribution,
        absence_deduction: 0,
        loan_deduction: 0,
        other_deductions: 0,
        gross_pay: basicSalary,
        total_deductions: incomeTax + pensionEmployee,
        net_pay: netSalary,
        payment_status: "Pending",
        notes: `Auto-calculated payroll for ${emp.full_name || emp.employee_number}`,
      }

      const normalizedRec = normalizeBodyToDbColumns(payrollRecord, recCols)
      const rFields = Object.keys(normalizedRec).filter(
        (k) => k !== "created_at" && k !== "updated_at" && (!recCols || recCols.has(k))
      )
      const rPlaceholders = rFields.map(() => "?").join(", ")
      const rValues = rFields.map((k) => sanitizeSqlValue(normalizedRec[k]))

      await conn.query(
        `INSERT INTO \`payroll_records\` (\`${rFields.join("`, `")}\`) VALUES (${rPlaceholders})`,
        rValues
      )
      records.push(unwrapRow({ ...payrollRecord, employee_number: emp.employee_number, full_name: emp.full_name }, "relational"))
    }

    // 5. Update period with status 'Prepared'
    await conn.query(
      "UPDATE `payroll_periods` SET status = 'Prepared', updated_at = NOW(3) WHERE id = ?",
      [cleanId]
    )

    const [updatedPeriodRows] = await conn.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
    const updatedPeriod = unwrapRow(updatedPeriodRows[0], "relational")
    updatedPeriod.total_gross = totalGross
    updatedPeriod.total_tax = totalTax
    updatedPeriod.total_pension = totalPension
    updatedPeriod.total_net = totalNet
    updatedPeriod.employee_count = employees.length

    return { status: 200, body: { period: updatedPeriod, records } }
  })
}

export async function approvePayrollPeriod(periodId, approvedBy = "Finance / General Manager") {
  const cleanId = String(periodId).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Period '${cleanId}' not found.` } }

  await pool.query(
    "UPDATE `payroll_periods` SET status = 'Approved', updated_at = NOW(3) WHERE id = ?",
    [cleanId]
  )

  const [updated] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  return { status: 200, body: unwrapRow(updated[0], "relational") }
}

export async function listPayrollRecords(query = {}) {
  let sql = "SELECT * FROM `payroll_records`"
  const params = []
  const conditions = []

  if (query.payroll_period_id) {
    conditions.push("payroll_period_id = ?")
    params.push(query.payroll_period_id)
  }
  if (query.employee_id) {
    conditions.push("employee_id = ?")
    params.push(query.employee_id)
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ")
  }
  sql += " ORDER BY created_at DESC"

  const [rows] = await pool.query(sql, params)
  return { status: 200, body: rows.map((r) => unwrapRow(r, "relational")) }
}

export async function getPayrollRecord(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_records` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll record '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "relational") }
}

export async function updatePayrollRecord(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_records` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll record '${cleanId}' not found.` } }

  const validCols = await getTableColumns("payroll_records")
  const normalized = normalizeBodyToDbColumns(updates, validCols)
  const updateCols = Object.keys(normalized).filter(
    (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
  )

  if (updateCols.length > 0) {
    const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
    const setValues = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
    setValues.push(cleanId)
    await pool.query(`UPDATE \`payroll_records\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, setValues)
  }

  const [updatedRows] = await pool.query("SELECT * FROM `payroll_records` WHERE id = ?", [cleanId])
  return { status: 200, body: unwrapRow(updatedRows[0], "relational") }
}

export async function updatePayrollPeriod(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll period '${cleanId}' not found.` } }

  const validCols = await getTableColumns("payroll_periods")
  const normalized = normalizeBodyToDbColumns(updates, validCols)
  const updateCols = Object.keys(normalized).filter(
    (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
  )

  if (updateCols.length > 0) {
    const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
    const setValues = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
    setValues.push(cleanId)
    await pool.query(`UPDATE \`payroll_periods\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, setValues)
  }

  const [updatedRows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  return { status: 200, body: unwrapRow(updatedRows[0], "relational") }
}

export async function deletePayrollPeriod(id) {
  const cleanId = String(id).trim()
  await pool.query("DELETE FROM `payroll_records` WHERE payroll_period_id = ? OR id LIKE ?", [cleanId, `%${cleanId}%`])
  const [res] = await pool.query("DELETE FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (res.affectedRows === 0) {
    return { status: 404, body: { error: `Payroll period '${cleanId}' not found.` } }
  }
  return { status: 200, body: { message: `Payroll period '${cleanId}' deleted successfully.` } }
}

export async function createPayrollRecord(body = {}) {
  const recordId = body.id || `PAY-${Date.now()}`
  const validCols = await getTableColumns("payroll_records")
  const rawData = {
    ...body,
    id: recordId,
    payment_status: body.payment_status || "Pending",
  }
  const normalized = normalizeBodyToDbColumns(rawData, validCols)
  const fields = Object.keys(normalized).filter(
    (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
  )
  const placeholders = fields.map(() => "?").join(", ")
  const values = fields.map((k) => sanitizeSqlValue(normalized[k]))

  await pool.query(
    `INSERT INTO \`payroll_records\` (\`${fields.join("`, `")}\`) VALUES (${placeholders})`,
    values
  )

  const [rows] = await pool.query("SELECT * FROM `payroll_records` WHERE id = ?", [recordId])
  return { status: 201, body: unwrapRow(rows[0], "relational") }
}

export async function deletePayrollRecord(id) {
  const cleanId = String(id).trim()
  const [res] = await pool.query("DELETE FROM `payroll_records` WHERE id = ?", [cleanId])
  if (res.affectedRows === 0) {
    return { status: 404, body: { error: `Payroll record '${cleanId}' not found.` } }
  }
  return { status: 200, body: { message: `Payroll record '${cleanId}' deleted successfully.` } }
}

