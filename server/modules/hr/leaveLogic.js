import { pool } from "../../db/client.js"
import { unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"

export async function listLeaves(query = {}) {
  const [rows] = await pool.query("SELECT * FROM `leave_requests` ORDER BY created_at DESC")
  let list = rows.map((r) => unwrapRow(r, "jsonb_document"))

  if (query.employee_id) list = list.filter((l) => l.employee_id === query.employee_id)
  if (query.status) list = list.filter((l) => String(l.status).toLowerCase() === String(query.status).toLowerCase())

  return { status: 200, body: list }
}

export async function getLeave(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `leave_requests` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Leave request '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "jsonb_document") }
}

export async function submitLeave(body = {}) {
  const leaveId = body.id || `LV-${Date.now()}`
  const record = {
    ...body,
    id: leaveId,
    status: "Pending",
    submission_date: getLocalDateString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "INSERT INTO `leave_requests` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))",
    [leaveId, JSON.stringify(record)]
  )

  return { status: 201, body: record }
}

export async function updateLeave(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `leave_requests` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Leave request '${cleanId}' not found.` } }

  const current = unwrapRow(rows[0], "jsonb_document")
  const merged = {
    ...current,
    ...updates,
    id: cleanId,
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "UPDATE `leave_requests` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
    [JSON.stringify(merged), cleanId]
  )

  return { status: 200, body: merged }
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
  const [rows] = await pool.query("SELECT * FROM `leave_types` ORDER BY created_at ASC")
  return { status: 200, body: rows.map((r) => unwrapRow(r, "jsonb_document")) }
}
