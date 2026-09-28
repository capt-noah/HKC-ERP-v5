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
    const isProcessed = String(payload.movement_type || "").toUpperCase() === "PROCESSED"
    if (isProcessed) {
      payload.movement_type = "PROCESSED"
      payload.net_quantity = 0
      payload.reject_quantity = 0
      if (!payload.party_name) {
        payload.party_name = "Internal Processing Line"
      }
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
    if (tableName === "export_warehouse_movements" && normalized.product_id) {
      const isReject = normalized.movement_type === "REJECT_DEDUCTION" || String(normalized.movement_type).toUpperCase().includes("REJECT")
      if (isReject) {
        const absRejectQty = Math.abs(Number(normalized.reject_quantity || normalized.net_quantity || 0))
        if (absRejectQty > 0) {
          await conn.query(
            "UPDATE export_products SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
            [absRejectQty, normalized.product_id]
          )
        }
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
    if (tableName === "export_warehouse_movements" && row.product_id) {
      const isReject = row.movement_type === "REJECT_DEDUCTION" || String(row.movement_type).toUpperCase().includes("REJECT")
      if (isReject) {
        const absRestoreQty = Math.abs(Number(row.reject_quantity || row.net_quantity || 0))
        if (absRestoreQty > 0) {
          await conn.query(
            "UPDATE export_products SET quantity = quantity + ?, updated_at = NOW(3) WHERE id = ?",
            [absRestoreQty, row.product_id]
          )
        }
      }
    }

    await conn.query(`DELETE FROM \`${tableName}\` WHERE id = ?`, [cleanId])
    return { status: 200, body: { success: true, message: `Movement '${cleanId}' deleted.` } }
  })
}

export async function recordExportDispatchDifference(movementId, differenceQty, reason = "") {
  const cleanId = String(movementId).trim()
  const newDiff = Math.max(0, Number(differenceQty || 0))

  return await withTransaction(async (conn) => {
    // 1. Fetch dispatch movement
    const [movRows] = await conn.query(
      "SELECT * FROM `export_warehouse_movements` WHERE id = ?",
      [cleanId]
    )
    if (movRows.length === 0) {
      return { status: 404, body: { error: `Movement '${cleanId}' not found.` } }
    }
    const mov = movRows[0]
    const prodId = mov.product_id
    const oldDiff = Math.max(0, Number(mov.reject_quantity || 0))
    const delta = newDiff - oldDiff
    const grossQty = Math.abs(Number(mov.gross_quantity || 0))

    let diffCostImpact = 0

    // 2. Adjust active FIFO GRVs if delta != 0
    if (delta > 0) {
      let remainingToDeduct = delta
      const [activeGrvs] = await conn.query(
        "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') AND net_quantity > 0 ORDER BY movement_date ASC, created_at ASC",
        [prodId]
      )
      for (const grv of activeGrvs) {
        if (remainingToDeduct <= 0) break
        const curNet = Number(grv.net_quantity || 0)
        const deduct = Math.min(curNet, remainingToDeduct)
        remainingToDeduct -= deduct
        diffCostImpact += deduct * Number(grv.unit_price || 0)
        await conn.query(
          "UPDATE `export_warehouse_movements` SET net_quantity = net_quantity - ?, updated_at = NOW(3) WHERE id = ?",
          [deduct, grv.id]
        )
      }
    } else if (delta < 0) {
      let remainingToRestore = Math.abs(delta)
      const [grvs] = await conn.query(
        "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') ORDER BY movement_date DESC, created_at DESC",
        [prodId]
      )
      for (const grv of grvs) {
        if (remainingToRestore <= 0) break
        const gross = Number(grv.gross_quantity || 0)
        const net = Number(grv.net_quantity || 0)
        const capacity = gross - net
        if (capacity > 0) {
          const addBack = Math.min(capacity, remainingToRestore)
          remainingToRestore -= addBack
          diffCostImpact -= addBack * Number(grv.unit_price || 0)
          await conn.query(
            "UPDATE `export_warehouse_movements` SET net_quantity = net_quantity + ?, updated_at = NOW(3) WHERE id = ?",
            [addBack, grv.id]
          )
        }
      }
    }

    // 3. Update dispatch row
    const newNet = -(grossQty + newDiff)
    let updatedReason = mov.reason || `Sales Issue Dispatch (FS-${mov.voucher_no || cleanId})`
    if (reason && String(reason).trim()) {
      updatedReason = `${updatedReason.split(" [Diff:")[0]} [Diff: ${newDiff} Qtl - ${String(reason).trim()}]`
    } else if (newDiff > 0) {
      updatedReason = `${updatedReason.split(" [Diff:")[0]} [Diff: ${newDiff} Qtl]`
    } else {
      updatedReason = updatedReason.split(" [Diff:")[0]
    }

    await conn.query(
      "UPDATE `export_warehouse_movements` SET reject_quantity = ?, net_quantity = ?, reason = ?, updated_at = NOW(3) WHERE id = ?",
      [newDiff, newNet, updatedReason, cleanId]
    )

    // 4. Update parent export_products
    const [allGrvs] = await conn.query(
      "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry')",
      [prodId]
    )
    const newProdQty = allGrvs.reduce((sum, g) => sum + Number(g.net_quantity || 0), 0)
    const newStockVal = allGrvs.reduce((sum, g) => sum + (Number(g.net_quantity || 0) * Number(g.unit_price || 0)), 0)
    const newUnitCost = newProdQty > 0 ? Math.round((newStockVal / newProdQty) * 100) / 100 : Number(mov.unit_price || 0)

    await conn.query(
      `UPDATE \`export_products\` SET
        quantity = ?,
        unit_cost = ?,
        total_stock_value = ?,
        status = ?,
        updated_at = NOW(3)
       WHERE id = ?`,
      [
        newProdQty,
        newUnitCost,
        newStockVal,
        newProdQty === 0 ? "Out of Stock" : newProdQty < 20 ? "Low Stock" : "In Stock",
        prodId,
      ]
    )

    // 5. Update linked Sales Issue COGS GL entry lines if sales issue exists
    const voucherNo = mov.voucher_no
    if (voucherNo && diffCostImpact !== 0) {
      const [siRows] = await conn.query(
        "SELECT id FROM `sales_issues` WHERE fs_no = ? OR id = ? OR issue_number = ?",
        [voucherNo, voucherNo, voucherNo]
      )
      if (siRows.length > 0) {
        const siId = siRows[0].id
        const cogsJeId = `JE-COGS-${siId}`
        // Update Debit Line in JSON payload
        const [drRows] = await conn.query("SELECT * FROM `journal_entry_lines` WHERE id = ?", [`${cogsJeId}-DR`])
        if (drRows.length > 0) {
          const drPayload = typeof drRows[0].payload === "string" ? JSON.parse(drRows[0].payload) : (drRows[0].payload || {})
          drPayload.debit_amount = Math.max(0, Number(drPayload.debit_amount || 0) + diffCostImpact)
          drPayload.updated_at = new Date().toISOString()
          await conn.query(
            "UPDATE `journal_entry_lines` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
            [JSON.stringify(drPayload), `${cogsJeId}-DR`]
          )
        }

        // Update Credit Line in JSON payload
        const [crRows] = await conn.query("SELECT * FROM `journal_entry_lines` WHERE id = ?", [`${cogsJeId}-CR`])
        if (crRows.length > 0) {
          const crPayload = typeof crRows[0].payload === "string" ? JSON.parse(crRows[0].payload) : (crRows[0].payload || {})
          crPayload.credit_amount = Math.max(0, Number(crPayload.credit_amount || 0) + diffCostImpact)
          crPayload.updated_at = new Date().toISOString()
          await conn.query(
            "UPDATE `journal_entry_lines` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
            [JSON.stringify(crPayload), `${cogsJeId}-CR`]
          )
        }
      }
    }

    const [updatedRow] = await conn.query(
      "SELECT * FROM `export_warehouse_movements` WHERE id = ?",
      [cleanId]
    )
    return {
      status: 200,
      body: {
        success: true,
        movement: unwrapRow(updatedRow[0], "relational"),
        differenceQty: newDiff,
        netQuantity: newNet,
        productQuantity: newProdQty,
        totalStockValue: newStockVal,
      },
    }
  })
}

