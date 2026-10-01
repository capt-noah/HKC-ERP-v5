import { pool } from "../../db/client.js"
import { withTransaction } from "../../db/transactionHelper.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"
import { getDefaultWarehouseForType } from "../../utils/warehouseUtils.js"

export async function listMovements(query = {}, tableName = "stock_movements") {
  let sql = `SELECT * FROM \`${tableName}\``
  const params = []
  const conditions = []

  const prodId = query.product_id || query.productId || query.commodity_id || query.commodityId
  if (prodId) {
    conditions.push("product_id = ?")
    params.push(prodId)
  }
  if (query.warehouse_id || query.warehouseId) {
    conditions.push("warehouse_id = ?")
    params.push(query.warehouse_id || query.warehouseId)
  }
  if (query.movement_type || query.type) {
    conditions.push("movement_type = ?")
    params.push(query.movement_type || query.type)
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ")
  }
  sql += " ORDER BY created_at DESC"

  const [rows] = await pool.query(sql, params)
  return { status: 200, body: rows.map((r) => unwrapRow(r, "relational")) }
}

export async function getMovement(id, tableName = "stock_movements") {
  const cleanId = String(id).trim()
  const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Movement '${cleanId}' not found in ${tableName}.` } }
  return { status: 200, body: unwrapRow(rows[0], "relational") }
}

export async function recordMovement(body = {}, tableName = "stock_movements") {
  const movementId = body.id || `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const payload = { ...body, id: movementId }

  if (tableName === "export_warehouse_movements") {
    if (!payload.product_id && payload.commodity_id) {
      payload.product_id = payload.commodity_id
    }
    if (payload.quantity_bags !== undefined && payload.net_quantity === undefined) {
      payload.net_quantity = payload.quantity_bags
    }
    if (payload.driver_name && !payload.party_name) {
      payload.party_name = payload.driver_name
    }
    if (payload.truck_plate && !payload.plate_number) {
      payload.plate_number = payload.truck_plate
    }
    if (!payload.warehouse_id && payload.product_id) {
      const [prodRows] = await pool.query("SELECT warehouse_id FROM export_products WHERE id = ?", [payload.product_id])
      if (prodRows.length > 0 && prodRows[0].warehouse_id) {
        payload.warehouse_id = prodRows[0].warehouse_id
      } else {
        payload.warehouse_id = await getDefaultWarehouseForType("EXPORT_WH")
      }
    }
  }

  if (tableName === "stock_movements") {
    if (!payload.warehouse_id && payload.product_id) {
      const [prodRows] = await pool.query("SELECT warehouse_id FROM pharma_products WHERE id = ?", [payload.product_id])
      if (prodRows.length > 0 && prodRows[0].warehouse_id) {
        payload.warehouse_id = prodRows[0].warehouse_id
      } else {
        payload.warehouse_id = await getDefaultWarehouseForType("PHARMA_WH")
      }
    }
    if (payload.batch_number && !payload.batch_no) {
      payload.batch_no = payload.batch_number
    }
    if (payload.reason && !payload.notes) {
      payload.notes = payload.reason
    } else if (payload.reason && payload.notes && !payload.notes.includes(payload.reason)) {
      payload.notes = `${payload.notes} (${payload.reason})`
    }
  }

  const validCols = await getTableColumns(tableName)
  const normalized = normalizeBodyToDbColumns(payload, validCols)

  if (!normalized.movement_date) {
    normalized.movement_date = getLocalDateString()
  }

  return await withTransaction(async (conn) => {
    const insertCols = Object.keys(normalized).filter((k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k)))
    const placeholders = insertCols.map(() => "?").join(", ")
    const values = insertCols.map((k) => sanitizeSqlValue(normalized[k]))

    await conn.query(
      `INSERT INTO \`${tableName}\` (\`${insertCols.join("`, `")}\`) VALUES (${placeholders})`,
      values
    )

    // Decrement export product net stock on reject deduction
    if (tableName === "export_warehouse_movements" && normalized.product_id && normalized.net_quantity) {
      if (normalized.movement_type === "REJECT_DEDUCTION" || String(normalized.movement_type).toUpperCase().includes("REJECT")) {
        await conn.query(
          "UPDATE export_products SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
          [Number(normalized.net_quantity), normalized.product_id]
        )
      }
    }

    const [rows] = await conn.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [movementId])
    return { status: 201, body: unwrapRow(rows[0], "relational") }
  })
}

export async function updateMovement(id, updates = {}, tableName = "stock_movements") {
  const cleanId = String(id).trim()
  const payload = { ...updates }
  if (tableName === "export_warehouse_movements") {
    if (!payload.reason && payload.notes) {
      payload.reason = payload.notes
    }
    if (payload.quantity_bags !== undefined && payload.net_quantity === undefined) {
      payload.net_quantity = payload.quantity_bags
    }
    if (payload.driver_name && !payload.party_name) {
      payload.party_name = payload.driver_name
    }
    if (payload.truck_plate && !payload.plate_number) {
      payload.plate_number = payload.truck_plate
    }
  }
  const validCols = await getTableColumns(tableName)
  const normalized = normalizeBodyToDbColumns(payload, validCols)

  return await withTransaction(async (conn) => {
    const updateCols = Object.keys(normalized).filter(
      (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
    )

    if (updateCols.length > 0) {
      const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
      const values = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
      values.push(cleanId)
      await conn.query(`UPDATE \`${tableName}\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, values)
    }

    const [rows] = await conn.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [cleanId])
    if (rows.length === 0) return { status: 404, body: { error: `Movement '${cleanId}' not found in ${tableName}.` } }
    return { status: 200, body: unwrapRow(rows[0], "relational") }
  })
}

export async function deleteMovement(id, tableName = "stock_movements") {
  const cleanId = String(id).trim()
  return await withTransaction(async (conn) => {
    const [existing] = await conn.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [cleanId])
    if (existing.length === 0) {
      return { status: 404, body: { error: `Movement '${cleanId}' not found in ${tableName}.` } }
    }

    const row = existing[0]
    // Restore quantity if an export reject deduction is deleted
    if (tableName === "export_warehouse_movements" && row.product_id && row.net_quantity) {
      if (row.movement_type === "REJECT_DEDUCTION" || String(row.movement_type).toUpperCase().includes("REJECT")) {
        await conn.query(
          "UPDATE export_products SET quantity = quantity + ?, updated_at = NOW(3) WHERE id = ?",
          [Number(row.net_quantity), row.product_id]
        )
      }
    }

    await conn.query(`DELETE FROM \`${tableName}\` WHERE id = ?`, [cleanId])
    return { status: 200, body: { success: true, message: `Movement '${cleanId}' deleted.` } }
  })
}

export async function updateMovementDifference(id, body = {}, tableName = "export_warehouse_movements") {
  const cleanId = String(id).trim()
  const diffQty = Number(
    body.differenceQty !== undefined
      ? body.differenceQty
      : body.rejectQuantity !== undefined
      ? body.rejectQuantity
      : body.reject_quantity !== undefined
      ? body.reject_quantity
      : 0
  )
  const notes = body.notes || body.reason || null

  return await withTransaction(async (conn) => {
    const [existing] = await conn.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [cleanId])
    if (existing.length === 0) {
      return { status: 404, body: { error: `Movement '${cleanId}' not found in ${tableName}.` } }
    }

    const row = existing[0]
    const oldDiff = Number(row.reject_quantity || 0)
    const deltaDiff = diffQty - oldDiff

    let newReason = row.reason
    if (notes) {
      if (!newReason) {
        newReason = `[Diff: ${diffQty} Qtl - ${notes}]`
      } else if (newReason.includes("[Diff:")) {
        newReason = newReason.replace(/\[Diff:[^\]]+\]/, `[Diff: ${diffQty} Qtl - ${notes}]`)
      } else {
        newReason = `${newReason} [Diff: ${diffQty} Qtl - ${notes}]`
      }
    } else if (diffQty === 0 && newReason && newReason.includes("[Diff:")) {
      newReason = newReason.replace(/\[Diff:[^\]]+\]/, "").trim()
    }

    await conn.query(
      `UPDATE \`${tableName}\` SET reject_quantity = ?, reason = ?, updated_at = NOW(3) WHERE id = ?`,
      [diffQty, newReason, cleanId]
    )

    // Adjust export product quantity and underlying GRV inbound batches if difference changed
    if (tableName === "export_warehouse_movements" && row.product_id && deltaDiff !== 0) {
      if (deltaDiff > 0) {
        // Deduct extra difference quantity from active GRV entries (FIFO)
        let remainingToDeduct = deltaDiff
        const [grvs] = await conn.query(
          "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') AND net_quantity > 0 ORDER BY movement_date ASC, created_at ASC",
          [row.product_id]
        )
        for (const grv of grvs) {
          if (remainingToDeduct <= 0) break
          const currentNet = Number(grv.net_quantity || 0)
          const deduct = Math.min(currentNet, remainingToDeduct)
          remainingToDeduct -= deduct
          const newNet = Math.max(0, currentNet - deduct)
          await conn.query(
            "UPDATE `export_warehouse_movements` SET net_quantity = ?, updated_at = NOW(3) WHERE id = ?",
            [newNet, grv.id]
          )
        }
      } else {
        // Restore difference quantity back to GRV entries (LIFO restore up to gross_quantity)
        let remainingToRestore = Math.abs(deltaDiff)
        const [grvs] = await conn.query(
          "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') AND net_quantity < gross_quantity ORDER BY movement_date DESC, created_at DESC",
          [row.product_id]
        )
        for (const grv of grvs) {
          if (remainingToRestore <= 0) break
          const currentNet = Number(grv.net_quantity || 0)
          const gross = Number(grv.gross_quantity || 0)
          const availableRoom = Math.max(0, gross - currentNet)
          const restore = Math.min(availableRoom, remainingToRestore)
          remainingToRestore -= restore
          const newNet = currentNet + restore
          await conn.query(
            "UPDATE `export_warehouse_movements` SET net_quantity = ?, updated_at = NOW(3) WHERE id = ?",
            [newNet, grv.id]
          )
        }
      }

      // Recompute physical quantity and inventory stock valuation from active GRVs
      const [activeGrvs] = await conn.query(
        "SELECT COALESCE(SUM(net_quantity), 0) as total_qty, COALESCE(SUM(net_quantity * unit_price), 0) as total_val FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry')",
        [row.product_id]
      )
      const activeQty = Number(activeGrvs[0]?.total_qty || 0)
      const activeVal = Number(activeGrvs[0]?.total_val || 0)
      const weightedCost = activeQty > 0 ? Math.round((activeVal / activeQty) * 100) / 100 : Number(row.unit_price || 0)

      await conn.query(
        "UPDATE export_products SET quantity = ?, total_stock_value = ?, unit_cost = ?, status = ?, updated_at = NOW(3) WHERE id = ?",
        [
          activeQty,
          activeVal,
          weightedCost,
          activeQty === 0 ? "Out of Stock" : activeQty < 20 ? "Low Stock" : "In Stock",
          row.product_id,
        ]
      )
    }

    const [rows] = await conn.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [cleanId])
    return { status: 200, body: unwrapRow(rows[0], "relational") }
  })
}
