import { pool } from "../../db/client.js"
import { withTransaction } from "../../db/transactionHelper.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"

export async function listBatches(query = {}) {
  let sql = "SELECT * FROM `pharma_product_batches`"
  const params = []
  const conditions = []

  if (query.product_id || query.productId) {
    conditions.push("product_id = ?")
    params.push(query.product_id || query.productId)
  }
  if (query.warehouse_id || query.warehouseId) {
    conditions.push("warehouse_id = ?")
    params.push(query.warehouse_id || query.warehouseId)
  }
  if (query.qa_status || query.qaStatus) {
    conditions.push("qa_status = ?")
    params.push(query.qa_status || query.qaStatus)
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ")
  }
  sql += " ORDER BY created_at DESC"

  const [rows] = await pool.query(sql, params)
  return { status: 200, body: rows.map((r) => unwrapRow(r, "relational")) }
}

export async function getBatch(id) {
  const [rows] = await pool.query("SELECT * FROM `pharma_product_batches` WHERE id = ?", [String(id).trim()])
  if (rows.length === 0) return { status: 404, body: { error: `Batch '${id}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "relational") }
}

export async function createBatch(body = {}) {
  const prodId = body.product_id || body.productId
  if (!prodId) {
    return { status: 400, body: { error: "Product ID (product_id) is required." } }
  }

  const batchId = body.id || `PB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const validCols = await getTableColumns("pharma_product_batches")

  const payload = { ...body, id: batchId, product_id: prodId }
  if (payload.batch_number && !payload.batch_no) {
    payload.batch_no = payload.batch_number
  }
  if (payload.manufacturing_date && !payload.mfg_date) {
    payload.mfg_date = payload.manufacturing_date
  }
  if (!payload.warehouse_id) {
    const [pRows] = await pool.query("SELECT warehouse_id FROM pharma_products WHERE id = ?", [prodId])
    if (pRows.length > 0 && pRows[0].warehouse_id) {
      payload.warehouse_id = pRows[0].warehouse_id
    } else {
      payload.warehouse_id = "WH2"
    }
  }

  const normalized = normalizeBodyToDbColumns(payload, validCols)

  if (normalized.quantity !== undefined && Number(normalized.quantity) < 0) {
    return { status: 400, body: { error: "Batch quantity cannot be negative." } }
  }
  if (normalized.unit_cost !== undefined && Number(normalized.unit_cost) < 0) {
    return { status: 400, body: { error: "Batch unit cost cannot be negative." } }
  }

  return await withTransaction(async (conn) => {
    const insertCols = Object.keys(normalized).filter((k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k)))
    const placeholders = insertCols.map(() => "?").join(", ")
    const values = insertCols.map((k) => sanitizeSqlValue(normalized[k]))

    await conn.query(
      `INSERT INTO \`pharma_product_batches\` (\`${insertCols.join("`, `")}\`) VALUES (${placeholders})`,
      values
    )

    const [rows] = await conn.query("SELECT * FROM `pharma_product_batches` WHERE id = ?", [batchId])
    const out = unwrapRow(rows[0], "relational")
    out.batch_number = out.batch_no
    return { status: 201, body: out }
  })
}

export async function updateBatch(id, updates = {}) {
  const cleanId = String(id).trim()
  const validCols = await getTableColumns("pharma_product_batches")
  const normalized = normalizeBodyToDbColumns(updates, validCols)

  return await withTransaction(async (conn) => {
    const updateCols = Object.keys(normalized).filter(
      (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
    )

    if (updateCols.length > 0) {
      const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
      const values = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
      values.push(cleanId)
      await conn.query(`UPDATE \`pharma_product_batches\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, values)
    }

    const [rows] = await conn.query("SELECT * FROM `pharma_product_batches` WHERE id = ?", [cleanId])
    if (rows.length === 0) return { status: 404, body: { error: `Batch '${cleanId}' not found.` } }
    const out = unwrapRow(rows[0], "relational")
    out.batch_number = out.batch_no
    return { status: 200, body: out }
  })
}

export async function deleteBatch(id) {
  const cleanId = String(id).trim()
  await pool.query("DELETE FROM `pharma_product_batches` WHERE id = ?", [cleanId])
  return { status: 200, body: { success: true, message: `Batch '${cleanId}' deleted.` } }
}

export async function transitionBatchStatus(id, newStatus, details = {}) {
  const cleanId = String(id).trim()
  const targetStatus = newStatus || details?.to_status || details?.status || details?.qa_status
  const validStatuses = ["Released", "Quarantined", "Rejected", "Expired"]
  if (!targetStatus || !validStatuses.includes(targetStatus)) {
    return { status: 400, body: { error: `Invalid batch QA status '${targetStatus}'.` } }
  }

  return await withTransaction(async (conn) => {
    const [bRows] = await conn.query("SELECT * FROM `pharma_product_batches` WHERE id = ?", [cleanId])
    if (bRows.length === 0) return { status: 404, body: { error: `Batch '${cleanId}' not found.` } }
    const batch = bRows[0]

    await conn.query(
      "UPDATE `pharma_product_batches` SET qa_status = ?, notes = ?, updated_at = NOW(3) WHERE id = ?",
      [targetStatus, details.notes || details.reason || null, cleanId]
    )

    // Automatically log movement if quarantined or released
    if (targetStatus === "Quarantined" || targetStatus === "Released") {
      const movementType = targetStatus === "Quarantined" ? "QUARANTINE" : "RELEASE"
      const movementId = `SM-${movementType}-${cleanId}-${Date.now()}`
      await conn.query(
        `INSERT INTO stock_movements (
          id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price,
          balance_after, batch_no, expiry_date, reference_type, reference_id, notes, performed_by, movement_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementId,
          batch.product_id,
          batch.warehouse_id,
          movementType,
          Number(details.quantity || batch.quantity),
          Number(batch.unit_cost || 0),
          Number(batch.unit_cost || 0),
          0,
          batch.batch_no,
          batch.expiry_date,
          "QA_STATUS_TRANSITION",
          cleanId,
          details.reason || `Batch ${batch.batch_no} QA status transitioned to ${targetStatus}`,
          details.performedBy || "QA Officer",
          getLocalDateString(),
        ]
      )
    }

    const [updatedRows] = await conn.query("SELECT * FROM `pharma_product_batches` WHERE id = ?", [cleanId])
    const out = unwrapRow(updatedRows[0], "relational")
    out.batch_number = out.batch_no
    return { status: 200, body: out }
  })
}
