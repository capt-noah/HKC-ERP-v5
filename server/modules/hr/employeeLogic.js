import { pool } from "../../db/client.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"

export async function listEmployees(query = {}) {
  const [rows] = await pool.query("SELECT * FROM `employees` ORDER BY created_at DESC")
  let list = rows.map((r) => unwrapRow(r, "relational"))

  if (query.warehouse_id || query.warehouse) {
    const wh = String(query.warehouse_id || query.warehouse).trim()
    list = list.filter((e) => e.warehouse_id === wh || e.warehouse === wh)
  }
  if (query.status) {
    list = list.filter((e) => String(e.status).toLowerCase() === String(query.status).toLowerCase())
  }
  if (query.search) {
    const s = String(query.search).toLowerCase()
    list = list.filter((e) =>
      (e.full_name && e.full_name.toLowerCase().includes(s)) ||
      (e.employee_number && e.employee_number.toLowerCase().includes(s)) ||
      (e.email && e.email.toLowerCase().includes(s))
    )
  }

  return { status: 200, body: list }
}

export async function getEmployee(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Employee '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "relational") }
}

export async function createEmployee(body = {}) {
  const empId = body.id || `EMP-${Date.now()}`
  const employeeNumber = body.employee_number || `HKC-${String(Date.now()).slice(-4)}`
  const validCols = await getTableColumns("employees")
  const rawData = {
    ...body,
    id: empId,
    employee_number: employeeNumber,
    status: body.status || "Active",
    basic_salary: Number(body.basic_salary ?? body.salary ?? 0),
    employment_type: body.employment_type || body.employmentType || "Permanent",
  }
  const normalized = normalizeBodyToDbColumns(rawData, validCols)
  const fields = Object.keys(normalized).filter(
    (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
  )
  const placeholders = fields.map(() => "?").join(", ")
  const values = fields.map((k) => sanitizeSqlValue(normalized[k]))

  await pool.query(
    `INSERT INTO \`employees\` (\`${fields.join("`, `")}\`) VALUES (${placeholders})`,
    values
  )

  const [rows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [empId])
  return { status: 201, body: unwrapRow(rows[0], "relational") }
}

export async function updateEmployee(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Employee '${cleanId}' not found.` } }

  const validCols = await getTableColumns("employees")
  const normalized = normalizeBodyToDbColumns(updates, validCols)
  const updateCols = Object.keys(normalized).filter(
    (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
  )

  if (updateCols.length > 0) {
    const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
    const setValues = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
    setValues.push(cleanId)
    await pool.query(`UPDATE \`employees\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, setValues)
  }

  const [updatedRows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [cleanId])
  return { status: 200, body: unwrapRow(updatedRows[0], "relational") }
}

export async function deleteEmployee(id) {
  const cleanId = String(id).trim()
  await pool.query("DELETE FROM `employees` WHERE id = ?", [cleanId])
  return { status: 200, body: { success: true, message: `Employee '${cleanId}' deleted.` } }
}
