import { pool } from "../../db/client.js"
import { unwrapRow } from "../../db/dbUtils.js"
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
  return { status: 200, body: rows.map((r) => unwrapRow(r, "jsonb_document")) }
}

export async function getPayrollPeriod(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll period '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "jsonb_document") }
}

export async function createPayrollPeriod(body = {}) {
  const periodId = body.id || `PP-${Date.now()}`
  const record = {
    ...body,
    id: periodId,
    status: "Draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "INSERT INTO `payroll_periods` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))",
    [periodId, JSON.stringify(record)]
  )

  return { status: 201, body: record }
}

export async function calculatePayrollForPeriod(periodId) {
  const cleanId = String(periodId).trim()

  return await withTransaction(async (conn) => {
    // 1. Get period
    const [pRows] = await conn.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
    if (pRows.length === 0) return { status: 404, body: { error: `Period '${cleanId}' not found.` } }
    const period = unwrapRow(pRows[0], "jsonb_document")

    // 2. Get active employees
    const [empRows] = await conn.query("SELECT * FROM `employees`")
    const employees = empRows
      .map((r) => unwrapRow(r, "jsonb_document"))
      .filter((e) => e.status === "Active")

    // 3. Delete old records for this period
    const [oldRecRows] = await conn.query("SELECT * FROM `payroll_records`")
    for (const r of oldRecRows) {
      const rec = unwrapRow(r, "jsonb_document")
      if (rec.payroll_period_id === cleanId) {
        await conn.query("DELETE FROM `payroll_records` WHERE id = ?", [r.id])
      }
    }

    // 4. Generate records for each employee
    let totalGross = 0
    let totalTax = 0
    let totalPension = 0
    let totalNet = 0
    const records = []

    for (const emp of employees) {
      const basicSalary = Number(emp.basic_salary || 0)
      const taxableSalary = basicSalary
      const incomeTax = Math.max(0, Math.round(calculateEthiopianIncomeTax(taxableSalary) * 100) / 100)
      const pensionEmployee = Math.round(basicSalary * 0.07 * 100) / 100
      const pensionEmployer = Math.round(basicSalary * 0.11 * 100) / 100
      const netSalary = Math.max(0, Math.round((basicSalary - incomeTax - pensionEmployee) * 100) / 100)

      totalGross += basicSalary
      totalTax += incomeTax
      totalPension += pensionEmployee + pensionEmployer
      totalNet += netSalary

      const recordId = `PR-${cleanId}-${emp.id}`
      const payrollRecord = {
        id: recordId,
        payroll_period_id: cleanId,
        employee_id: emp.id,
        employee_number: emp.employee_number,
        full_name: emp.full_name,
        warehouse_id: emp.warehouse_id,
        basic_salary: basicSalary,
        income_tax: incomeTax,
        pension_7_pct: pensionEmployee,
        pension_11_pct: pensionEmployer,
        net_pay: netSalary,
        payment_status: "Pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await conn.query(
        "INSERT INTO `payroll_records` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))",
        [recordId, JSON.stringify(payrollRecord)]
      )
      records.push(payrollRecord)
    }

    // 5. Update period with totals
    const updatedPeriod = {
      ...period,
      status: "Prepared",
      total_gross: totalGross,
      total_tax: totalTax,
      total_pension: totalPension,
      total_net: totalNet,
      employee_count: employees.length,
      updated_at: new Date().toISOString(),
    }

    await conn.query(
      "UPDATE `payroll_periods` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
      [JSON.stringify(updatedPeriod), cleanId]
    )

    return { status: 200, body: { period: updatedPeriod, records } }
  })
}

export async function approvePayrollPeriod(periodId, approvedBy = "Finance / General Manager") {
  const cleanId = String(periodId).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Period '${cleanId}' not found.` } }

  const current = unwrapRow(rows[0], "jsonb_document")
  const merged = {
    ...current,
    status: "Approved",
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "UPDATE `payroll_periods` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
    [JSON.stringify(merged), cleanId]
  )

  return { status: 200, body: merged }
}

export async function listPayrollRecords(query = {}) {
  const [rows] = await pool.query("SELECT * FROM `payroll_records` ORDER BY created_at DESC")
  let list = rows.map((r) => unwrapRow(r, "jsonb_document"))

  if (query.payroll_period_id) {
    list = list.filter((r) => r.payroll_period_id === query.payroll_period_id)
  }
  if (query.employee_id) {
    list = list.filter((r) => r.employee_id === query.employee_id)
  }

  return { status: 200, body: list }
}

export async function getPayrollRecord(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_records` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll record '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "jsonb_document") }
}

export async function updatePayrollRecord(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_records` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll record '${cleanId}' not found.` } }

  const current = unwrapRow(rows[0], "jsonb_document")
  const merged = {
    ...current,
    ...updates,
    id: cleanId,
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "UPDATE `payroll_records` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
    [JSON.stringify(merged), cleanId]
  )

  return { status: 200, body: merged }
}

export async function updatePayrollPeriod(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Payroll period '${cleanId}' not found.` } }

  const current = unwrapRow(rows[0], "jsonb_document")
  const merged = {
    ...current,
    ...updates,
    id: cleanId,
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "UPDATE `payroll_periods` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
    [JSON.stringify(merged), cleanId]
  )

  return { status: 200, body: merged }
}

export async function deletePayrollPeriod(id) {
  const cleanId = String(id).trim()
  await pool.query(
    "DELETE FROM `payroll_records` WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.payroll_period_id')) = ? OR id LIKE ?",
    [cleanId, `%${cleanId}%`]
  )
  const [res] = await pool.query("DELETE FROM `payroll_periods` WHERE id = ?", [cleanId])
  if (res.affectedRows === 0) {
    return { status: 404, body: { error: `Payroll period '${cleanId}' not found.` } }
  }
  return { status: 200, body: { message: `Payroll period '${cleanId}' deleted successfully.` } }
}

export async function createPayrollRecord(body = {}) {
  const recordId = body.id || `PAY-${Date.now()}`
  const record = {
    ...body,
    id: recordId,
    payment_status: body.payment_status || "Pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "INSERT INTO `payroll_records` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))",
    [recordId, JSON.stringify(record)]
  )

  return { status: 201, body: record }
}

export async function deletePayrollRecord(id) {
  const cleanId = String(id).trim()
  const [res] = await pool.query("DELETE FROM `payroll_records` WHERE id = ?", [cleanId])
  if (res.affectedRows === 0) {
    return { status: 404, body: { error: `Payroll record '${cleanId}' not found.` } }
  }
  return { status: 200, body: { message: `Payroll record '${cleanId}' deleted successfully.` } }
}

