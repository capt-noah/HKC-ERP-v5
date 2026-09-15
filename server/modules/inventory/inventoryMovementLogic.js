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
