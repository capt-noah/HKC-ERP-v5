import { pool } from "../../db/client.js"
import { withTransaction } from "../../db/transactionHelper.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"

export async function listQuarantineRecords(query = {}) {
  let sql = "SELECT * FROM `quarantine_records`"
  const params = []
  const conditions = []

  const prodId = query.product_id || query.productId
  if (prodId) {
    conditions.push("product_id = ?")
    params.push(prodId)
  }
  const whId = query.warehouse_id || query.warehouseId
  if (whId && whId !== "ALL") {
    conditions.push("warehouse_id = ?")
    params.push(whId)
  }
  if (query.status && query.status !== "ALL") {
    conditions.push("status = ?")
    params.push(query.status)
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ")
  }
  sql += " ORDER BY created_at DESC"

  const [rows] = await pool.query(sql, params)
  return { status: 200, body: rows.map((r) => unwrapRow(r, "relational")) }
}

export async function getQuarantineRecord(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `quarantine_records` WHERE id = ?", [cleanId])
  if (rows.length === 0) {
    return { status: 404, body: { error: `Quarantine record '${cleanId}' not found.` } }
  }
  return { status: 200, body: unwrapRow(rows[0], "relational") }
}

export async function createQuarantineRecord(body = {}) {
  const productId = body.product_id || body.productId
  const warehouseId = body.warehouse_id || body.warehouseId || body.warehouse || "WH2"
  const quantity = Number(body.quantity || 0)

  if (!productId) {
    return { status: 400, body: { error: "Product ID is required for quarantine." } }
  }
  if (quantity <= 0) {
    return { status: 400, body: { error: "Quarantine quantity must be greater than 0." } }
  }

  const qrnId = body.id || `QRN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const validCols = await getTableColumns("quarantine_records")
  const todayStr = getLocalDateString()

  const payload = {
    ...body,
    id: qrnId,
    product_id: productId,
    warehouse_id: warehouseId,
    quantity,
    quarantine_date: body.quarantine_date || body.quarantineDate || todayStr,
    proposed_release_date: body.proposed_release_date || body.proposedReleaseDate || null,
    status: body.status || "Quarantined",
    reason: body.reason || "Broken/Damaged Medicine",
    name_entered: body.name_entered || body.nameEntered || "Store Officer",
    bin_card_entry_id: body.bin_card_entry_id || body.binCardEntryId || `BCE-QRN-${Date.now()}`,
    unit: body.unit || "Box",
    batch_no: body.batch_no || body.batchNo || null,
  }

  const normalized = normalizeBodyToDbColumns(payload, validCols)

  return await withTransaction(async (conn) => {
    // 1. Fetch product to verify stock and populate product metadata
    const [prodRows] = await conn.query("SELECT * FROM pharma_products WHERE id = ?", [productId])
    let prod = null
    let unitCost = 0
    if (prodRows.length > 0) {
      prod = prodRows[0]
      unitCost = Number(prod.unit_cost || 0)
      if (!normalized.product_name) normalized.product_name = prod.name
      if (!normalized.sku) normalized.sku = prod.sku
      if (!normalized.unit && prod.unit) normalized.unit = prod.unit
    }

    // 2. Insert into quarantine_records
    const insertCols = Object.keys(normalized).filter((k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k)))
    const placeholders = insertCols.map(() => "?").join(", ")
    const values = insertCols.map((k) => sanitizeSqlValue(normalized[k]))

    await conn.query(
      `INSERT INTO quarantine_records (\`${insertCols.join("`, `")}\`) VALUES (${placeholders})`,
      values
    )

    // 3. Deduct from specific batch in pharma_product_batches if specified
    let batchUnitCost = unitCost
    if (payload.batch_no) {
      const [bRows] = await conn.query(
        "SELECT * FROM pharma_product_batches WHERE product_id = ? AND batch_no = ?",
        [productId, payload.batch_no]
      )
      if (bRows.length > 0) {
        const b = bRows[0]
        batchUnitCost = Number(b.unit_cost || unitCost)
        await conn.query(
          "UPDATE pharma_product_batches SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
          [quantity, b.id]
        )
      }
    }

    // 4. Update available quantity & total_stock_value in pharma_products
    const [remainingBatches] = await conn.query(
      "SELECT * FROM pharma_product_batches WHERE product_id = ? AND (qa_status != 'Quarantined' OR qa_status IS NULL)",
      [productId]
    )
    let newQty = 0
    let newStockVal = 0
    if (remainingBatches.length > 0) {
      newQty = remainingBatches.reduce((s, b) => s + Number(b.quantity || 0), 0)
      newStockVal = remainingBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.unit_cost || 0)), 0)
      const newWeightedCost = newQty > 0 ? Math.round((newStockVal / newQty) * 100) / 100 : unitCost
      await conn.query(
        "UPDATE pharma_products SET quantity = ?, total_stock_value = ?, unit_cost = ?, status = ?, updated_at = NOW(3) WHERE id = ?",
        [
          newQty,
          newStockVal,
          newWeightedCost,
          newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock",
          productId,
        ]
      )
    } else if (prod) {
      newQty = Math.max(0, Number(prod.quantity || 0) - quantity)
      newStockVal = Math.max(0, Number(prod.total_stock_value || 0) - (quantity * unitCost))
      await conn.query(
        "UPDATE pharma_products SET quantity = ?, total_stock_value = ?, status = ?, updated_at = NOW(3) WHERE id = ?",
        [
          newQty,
          newStockVal,
          newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock",
          productId,
        ]
      )
    }

    // 5. Ensure record in stock_movements (Idempotent upsert to avoid duplicate key conflicts)
    const smCols = await getTableColumns("stock_movements")
    const movementPayload = {
      id: qrnId,
      product_id: productId,
      warehouse_id: warehouseId,
      movement_type: "QUARANTINE",
      quantity,
      unit_cost: batchUnitCost,
      unit_price: batchUnitCost,
      balance_after: newQty,
      batch_no: payload.batch_no || null,
      expiry_date: payload.expiry_date || null,
      reference_type: "QUARANTINE",
      reference_id: qrnId,
      notes: `Quarantined by ${payload.name_entered}: ${payload.reason || "Broken/Damaged Medicine"} (Release Date: ${payload.proposed_release_date || payload.proposedReleaseDate || "N/A"})`,
      party: "Quarantine Hold - Broken/Damaged",
      performed_by: payload.name_entered || "Store Officer",
      movement_date: payload.quarantine_date || todayStr,
    }
    const normSm = normalizeBodyToDbColumns(movementPayload, smCols)
    const smInsertCols = Object.keys(normSm).filter(
      (k) => k !== "created_at" && k !== "updated_at" && (!smCols || smCols.has(k))
    )
    await conn.query(
      `INSERT INTO stock_movements (\`${smInsertCols.join("`, `")}\`) 
       VALUES (${smInsertCols.map(() => "?").join(", ")})
       ON DUPLICATE KEY UPDATE 
         quantity = VALUES(quantity),
         balance_after = VALUES(balance_after),
         notes = VALUES(notes),
         performed_by = VALUES(performed_by),
         updated_at = NOW(3)`,
      smInsertCols.map((k) => sanitizeSqlValue(normSm[k]))
    )

    // 6. Return created record
    const [createdRows] = await conn.query("SELECT * FROM quarantine_records WHERE id = ?", [qrnId])
    return { status: 201, body: unwrapRow(createdRows[0], "relational") }
  })
}

export async function updateQuarantineRecord(id, updates = {}) {
  const cleanId = String(id).trim()
  const validCols = await getTableColumns("quarantine_records")
  const normalized = normalizeBodyToDbColumns(updates, validCols)

  // Map camelCase to snake_case column aliases
  if (updates.proposedReleaseDate !== undefined && !normalized.proposed_release_date) {
    normalized.proposed_release_date = updates.proposedReleaseDate
  }
  if (updates.nameEntered !== undefined && !normalized.name_entered) {
    normalized.name_entered = updates.nameEntered
  }
  if (updates.disposalNotes !== undefined && !normalized.disposal_notes) {
    normalized.disposal_notes = updates.disposalNotes
  }
  if (updates.reason !== undefined && !normalized.reason) {
    normalized.reason = updates.reason
  }
  if (updates.quarantineDate !== undefined && !normalized.quarantine_date) {
    normalized.quarantine_date = updates.quarantineDate
  }
  if (updates.binCardEntryId !== undefined && !normalized.bin_card_entry_id) {
    normalized.bin_card_entry_id = updates.binCardEntryId
  }

  return await withTransaction(async (conn) => {
    const [existingRows] = await conn.query("SELECT * FROM quarantine_records WHERE id = ?", [cleanId])
    if (existingRows.length === 0) {
      return { status: 404, body: { error: `Quarantine record '${cleanId}' not found.` } }
    }

    const updateCols = Object.keys(normalized).filter(
      (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
    )

    if (updateCols.length > 0) {
      const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
      const setValues = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
      setValues.push(cleanId)
      await conn.query(`UPDATE quarantine_records SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, setValues)
    }

    const [updatedRows] = await conn.query("SELECT * FROM quarantine_records WHERE id = ?", [cleanId])
    return { status: 200, body: unwrapRow(updatedRows[0], "relational") }
  })
}

export async function deleteQuarantineRecord(id) {
  const cleanId = String(id).trim()
  const [existing] = await pool.query("SELECT * FROM quarantine_records WHERE id = ?", [cleanId])
  if (existing.length === 0) {
    return { status: 404, body: { error: `Quarantine record '${cleanId}' not found.` } }
  }

  await pool.query("DELETE FROM quarantine_records WHERE id = ?", [cleanId])
  return { status: 200, body: { success: true, message: `Quarantine record '${cleanId}' deleted.` } }
}
