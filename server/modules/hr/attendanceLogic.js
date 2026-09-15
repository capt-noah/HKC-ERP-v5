import { pool } from "../../db/client.js"
import { unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"

export async function listAttendance(query = {}) {
  const [rows] = await pool.query("SELECT * FROM `attendance_records` ORDER BY created_at DESC")
  let list = rows.map((r) => unwrapRow(r, "jsonb_document"))

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
  const record = {
    ...body,
    id: attId,
    attendance_date: body.attendance_date || getLocalDateString(),
    status: body.status || "Present",
    hours_worked: Number(body.hours_worked || 8),
    overtime_hours: Number(body.overtime_hours || 0),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "INSERT INTO `attendance_records` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))",
    [attId, JSON.stringify(record)]
  )

  return { status: 201, body: record }
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

  const current = unwrapRow(rows[0], "jsonb_document")
  const merged = {
    ...current,
    ...updates,
    id: cleanId,
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "UPDATE `attendance_records` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
    [JSON.stringify(merged), cleanId]
  )

  return { status: 200, body: merged }
}

export async function deleteAttendance(id) {
  const cleanId = String(id).trim()
  await pool.query("DELETE FROM `attendance_records` WHERE id = ?", [cleanId])
  return { status: 200, body: { success: true, message: `Attendance '${cleanId}' deleted.` } }
}
