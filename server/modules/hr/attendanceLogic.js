import { pool } from "../../db/client.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"

export async function listAttendance(query = {}) {
  const [rows] = await pool.query("SELECT * FROM `attendance_records` ORDER BY created_at DESC")
  let list = rows.map((r) => unwrapRow(r, "relational"))

  if (query.date || query.attendance_date) {
    const d = query.date || query.attendance_date
    list = list.filter((a) => a.attendance_date === d)
  }
  if (query.employee_id) {
    list = list.filter((a) => a.employee_id === query.employee_id)
  }
  if (query.warehouse_id) {
    list = list.filter((a) => a.warehouse_id === query.warehouse_id)
  }

  return { status: 200, body: list }
}

export async function recordAttendance(body = {}) {
  const attId = body.id || `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const validCols = await getTableColumns("attendance_records")
  const rawData = {
    ...body,
    id: attId,
    attendance_date: body.attendance_date || body.attendanceDate || body.date || getLocalDateString(),
    status: body.status || "Present",
    hours_worked: Number(body.hours_worked ?? body.hoursWorked ?? 8),
    overtime_hours: Number(body.overtime_hours ?? body.overtimeHours ?? 0),
    locked_by_payroll: body.locked_by_payroll ? 1 : 0,
  }
  const normalized = normalizeBodyToDbColumns(rawData, validCols)
  const fields = Object.keys(normalized).filter(
    (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
  )
  const placeholders = fields.map(() => "?").join(", ")
  const values = fields.map((k) => sanitizeSqlValue(normalized[k]))

  await pool.query(
    `INSERT INTO \`attendance_records\` (\`${fields.join("`, `")}\`) VALUES (${placeholders})`,
    values
  )

  const [rows] = await pool.query("SELECT * FROM `attendance_records` WHERE id = ?", [attId])
  return { status: 201, body: unwrapRow(rows[0], "relational") }
}

export async function bulkRecordAttendance(body = {}) {
  const records = Array.isArray(body.records) ? body.records : []
  const saved = []

  for (const item of records) {
    const res = await recordAttendance(item)
    if (res.status === 201) saved.push(res.body)
  }

  return { status: 201, body: saved }
}

export async function updateAttendance(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `attendance_records` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Attendance record '${cleanId}' not found.` } }

  const validCols = await getTableColumns("attendance_records")
  const normalized = normalizeBodyToDbColumns(updates, validCols)
  const updateCols = Object.keys(normalized).filter(
    (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
  )

  if (updateCols.length > 0) {
    const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
    const setValues = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
    setValues.push(cleanId)
    await pool.query(`UPDATE \`attendance_records\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, setValues)
  }

  const [updatedRows] = await pool.query("SELECT * FROM `attendance_records` WHERE id = ?", [cleanId])
  return { status: 200, body: unwrapRow(updatedRows[0], "relational") }
}

export async function deleteAttendance(id) {
  const cleanId = String(id).trim()
  await pool.query("DELETE FROM `attendance_records` WHERE id = ?", [cleanId])
  return { status: 200, body: { success: true, message: `Attendance '${cleanId}' deleted.` } }
}
