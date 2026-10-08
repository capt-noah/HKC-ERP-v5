import { getMysqlPool } from "../../db/mysqlClient.js"
import { validateRecordDeletable } from "./deletionGuardrails.js"
import { drizzleDeleteRow } from "../../db/drizzleCrud.js"
import { getResource } from "../../db/resourceRegistry.js"

const pool = getMysqlPool()

export async function createDeletionRequest({ resource_type, record_id, record_name, warehouse_id, reason, user }) {
  const normResource = String(resource_type).trim().toLowerCase()
  const cleanId = String(record_id).trim()

  // 1. Guardrail Check: Block if sales or issuance exist
  const eligibility = await validateRecordDeletable(normResource, cleanId)
  if (!eligibility.canDelete) {
    const err = new Error(eligibility.reason || "This record cannot be deleted due to policy restrictions.")
    err.status = 403
    throw err
  }

  // 2. Check if a pending request already exists
  const [existing] = await pool.query(
    "SELECT id FROM `deletion_requests` WHERE resource_type = ? AND record_id = ? AND status = 'Pending' LIMIT 1",
    [normResource, cleanId]
  )
  if (existing.length > 0) {
    const err = new Error("A deletion request is already pending for this record.")
    err.status = 400
    throw err
  }

  // 3. Capture record snapshot for audit compliance
  let snapshot = null
  try {
    const resDef = getResource(normResource)
    if (resDef) {
      const [rows] = await pool.query(`SELECT * FROM \`${resDef.table}\` WHERE id = ? LIMIT 1`, [cleanId])
      if (rows.length > 0) snapshot = rows[0]
    }
  } catch (e) {
    console.warn("[SNAPSHOT CAPTURE WARNING]:", e.message)
  }

  const reqId = `DEL-REQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const requesterName = user?.fullname || user?.username || "Employee"
  const requesterId = user?.id || null

  await pool.query(
    `INSERT INTO \`deletion_requests\` (
      id, resource_type, record_id, record_name, warehouse_id, reason,
      requested_by_id, requested_by_name, status, record_snapshot, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, NOW(3), NOW(3))`,
    [
      reqId,
      normResource,
      cleanId,
      record_name || cleanId,
      warehouse_id || null,
      reason || "Requested by operator",
      requesterId,
      requesterName,
      snapshot ? JSON.stringify(snapshot) : null,
    ]
  )

  // 4. Log to user_activity_logs
  await pool.query(
    `INSERT INTO \`user_activity_logs\` (
      id, user_id, username, fullname, action, resource, target_id, details, created_at
    ) VALUES (?, ?, ?, ?, 'Deletion Requested', 'deletion_requests', ?, ?, NOW(3))`,
    [
      `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requesterId,
      user?.username || requesterName,
      requesterName,
      reqId,
      JSON.stringify({ resource_type: normResource, record_id: cleanId, reason }),
    ]
  ).catch((e) => console.warn("[ACTIVITY LOG WARNING]:", e.message))

  return {
    id: reqId,
    status: "Pending",
    message: "Deletion request submitted successfully for Superadmin approval.",
  }
}

export async function getDeletionRequests({ status } = {}) {
  let query = "SELECT * FROM `deletion_requests`"
  const params = []
  if (status) {
    query += " WHERE status = ?"
    params.push(status)
  }
  query += " ORDER BY created_at DESC LIMIT 200"

  const [rows] = await pool.query(query, params)
  return rows.map((r) => ({
    ...r,
    record_snapshot: typeof r.record_snapshot === "string" ? JSON.parse(r.record_snapshot) : r.record_snapshot,
  }))
}

export async function approveDeletionRequest(requestId, adminUser) {
  const [rows] = await pool.query(
    "SELECT * FROM `deletion_requests` WHERE id = ? FOR UPDATE",
    [requestId]
  )
  if (rows.length === 0) {
    const err = new Error(`Deletion request '${requestId}' not found.`)
    err.status = 404
    throw err
  }

  const req = rows[0]
  if (req.status !== "Pending") {
    const err = new Error(`Deletion request is already '${req.status}'.`)
    err.status = 400
    throw err
  }

  // Double-check guardrails before final execution
  const eligibility = await validateRecordDeletable(req.resource_type, req.record_id)
  if (!eligibility.canDelete) {
    const err = new Error(eligibility.reason || "Record is blocked from deletion by policy.")
    err.status = 403
    throw err
  }

  const resDef = getResource(req.resource_type)
  if (!resDef) {
    const err = new Error(`Resource '${req.resource_type}' unknown.`)
    err.status = 400
    throw err
  }

  // Execute the safe cascading deletion
  await drizzleDeleteRow({ resource: resDef, id: req.record_id })

  const reviewerName = adminUser?.fullname || adminUser?.username || "Super Admin"

  // Mark request as executed
  await pool.query(
    "UPDATE `deletion_requests` SET status = 'Executed', reviewed_by = ?, reviewed_at = NOW(3), updated_at = NOW(3) WHERE id = ?",
    [reviewerName, requestId]
  )

  // Log to user_activity_logs
  await pool.query(
    `INSERT INTO \`user_activity_logs\` (
      id, user_id, username, fullname, action, resource, target_id, details, created_at
    ) VALUES (?, ?, ?, ?, 'Approved Deletion', 'deletion_requests', ?, ?, NOW(3))`,
    [
      `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      adminUser?.id || null,
      adminUser?.username || reviewerName,
      reviewerName,
      requestId,
      JSON.stringify({ resource_type: req.resource_type, record_id: req.record_id, deleted: true }),
    ]
  ).catch((e) => console.warn("[ACTIVITY LOG WARNING]:", e.message))

  return { success: true, message: `Record '${req.record_name}' deleted successfully.` }
}

export async function rejectDeletionRequest(requestId, adminUser, rejectionReason) {
  const [rows] = await pool.query(
    "SELECT * FROM `deletion_requests` WHERE id = ? FOR UPDATE",
    [requestId]
  )
  if (rows.length === 0) {
    const err = new Error(`Deletion request '${requestId}' not found.`)
    err.status = 404
    throw err
  }

  const req = rows[0]
  if (req.status !== "Pending") {
    const err = new Error(`Deletion request is already '${req.status}'.`)
    err.status = 400
    throw err
  }

  const reviewerName = adminUser?.fullname || adminUser?.username || "Super Admin"
  const rejText = rejectionReason || "Rejected by Super Admin"

  await pool.query(
    "UPDATE `deletion_requests` SET status = 'Rejected', reviewed_by = ?, reviewed_at = NOW(3), rejection_reason = ?, updated_at = NOW(3) WHERE id = ?",
    [reviewerName, rejText, requestId]
  )

  // Log to activity logs
  await pool.query(
    `INSERT INTO \`user_activity_logs\` (
      id, user_id, username, fullname, action, resource, target_id, details, created_at
    ) VALUES (?, ?, ?, ?, 'Rejected Deletion', 'deletion_requests', ?, ?, NOW(3))`,
    [
      `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      adminUser?.id || null,
      adminUser?.username || reviewerName,
      reviewerName,
      requestId,
      JSON.stringify({ resource_type: req.resource_type, record_id: req.record_id, rejected: true, reason: rejText }),
    ]
  ).catch((e) => console.warn("[ACTIVITY LOG WARNING]:", e.message))

  return { success: true, message: `Deletion request for '${req.record_name}' was rejected.` }
}
