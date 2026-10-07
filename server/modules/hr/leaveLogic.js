import { pool } from "../../db/client.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"

export async function listLeaves(query = {}) {
  const [rows] = await pool.query("SELECT * FROM `leave_requests` ORDER BY created_at DESC")
  let list = rows.map((r) => unwrapRow(r, "relational"))

  if (query.employee_id) list = list.filter((l) => l.employee_id === query.employee_id)
  if (query.status) list = list.filter((l) => String(l.status).toLowerCase() === String(query.status).toLowerCase())

  return { status: 200, body: list }
}

export async function getLeave(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `leave_requests` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Leave request '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "relational") }
}

export async function submitLeave(body = {}) {
  const leaveId = body.id || `LV-${Date.now()}`
  const validCols = await getTableColumns("leave_requests")
  const rawData = {
    ...body,
    id: leaveId,
    status: body.status || "Pending",
    number_of_days: Number(body.number_of_days ?? body.numberOfDays ?? 1),
    start_date: body.start_date || body.startDate || getLocalDateString(),
    end_date: body.end_date || body.endDate || getLocalDateString(),
  }
  const normalized = normalizeBodyToDbColumns(rawData, validCols)
  const fields = Object.keys(normalized).filter(
    (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
  )
  const placeholders = fields.map(() => "?").join(", ")
  const values = fields.map((k) => sanitizeSqlValue(normalized[k]))

  await pool.query(
    `INSERT INTO \`leave_requests\` (\`${fields.join("`, `")}\`) VALUES (${placeholders})`,
    values
  )

  const [rows] = await pool.query("SELECT * FROM `leave_requests` WHERE id = ?", [leaveId])
  return { status: 201, body: unwrapRow(rows[0], "relational") }
}

export async function updateLeave(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `leave_requests` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Leave request '${cleanId}' not found.` } }

  const validCols = await getTableColumns("leave_requests")
  const normalized = normalizeBodyToDbColumns(updates, validCols)
  const updateCols = Object.keys(normalized).filter(
    (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
  )

  if (updateCols.length > 0) {
    const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
    const setValues = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
    setValues.push(cleanId)
    await pool.query(`UPDATE \`leave_requests\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, setValues)
  }

  const [updatedRows] = await pool.query("SELECT * FROM `leave_requests` WHERE id = ?", [cleanId])
  return { status: 200, body: unwrapRow(updatedRows[0], "relational") }
}

export async function approveLeave(id, approvedBy = "HR Manager") {
  return await updateLeave(id, {
    status: "Approved",
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
  })
}

export async function rejectLeave(id, rejectedBy = "HR Manager", reason = "Operational requirements") {
  return await updateLeave(id, {
    status: "Rejected",
    rejected_by: rejectedBy,
    rejection_reason: reason,
    rejected_at: new Date().toISOString(),
  })
}

export async function deleteLeave(id) {
  const cleanId = String(id).trim()
  await pool.query("DELETE FROM `leave_requests` WHERE id = ?", [cleanId])
  return { status: 200, body: { success: true, message: `Leave '${cleanId}' deleted.` } }
}

export async function listLeaveTypes() {
  return {
    status: 200,
    body: [
      { id: "LT-ANNUAL", name: "Annual Leave", default_days: 16, is_paid: true },
      { id: "LT-SICK", name: "Sick Leave", default_days: 30, is_paid: true },
      { id: "LT-EMERGENCY", name: "Emergency Leave", default_days: 5, is_paid: true },
      { id: "LT-MATERNITY", name: "Maternity Leave", default_days: 120, is_paid: true },
      { id: "LT-PATERNITY", name: "Paternity Leave", default_days: 3, is_paid: true },
      { id: "LT-UNPAID", name: "Unpaid Leave", default_days: 30, is_paid: false },
      { id: "LT-OTHER", name: "Other", default_days: 0, is_paid: false },
    ],
  }
}
