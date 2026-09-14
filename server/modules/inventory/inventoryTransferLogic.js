import { pool } from "../../db/client.js"
import { withTransaction } from "../../db/transactionHelper.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"

export async function listTransfers(query = {}) {
  let sql = "SELECT * FROM `store_transfers` ORDER BY created_at DESC"
  const [transfers] = await pool.query(sql)
  const [items] = await pool.query("SELECT * FROM `store_transfer_items` ORDER BY created_at ASC")

  const itemsByTransfer = new Map()
  for (const it of items) {
    const tId = it.transfer_id
    if (!itemsByTransfer.has(tId)) itemsByTransfer.set(tId, [])
    itemsByTransfer.get(tId).push(unwrapRow(it, "relational"))
  }

  const result = transfers.map((t) => {
    const unwrapped = unwrapRow(t, "relational")
    unwrapped.items = itemsByTransfer.get(unwrapped.id) || []
    return unwrapped
  })

  return { status: 200, body: result }
}

export async function getTransfer(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `store_transfers` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Store transfer '${cleanId}' not found.` } }
  const transfer = unwrapRow(rows[0], "relational")

  const [items] = await pool.query("SELECT * FROM `store_transfer_items` WHERE transfer_id = ?", [cleanId])
  transfer.items = items.map((it) => unwrapRow(it, "relational"))
  return { status: 200, body: transfer }
}

export async function createTransfer(body = {}) {
  const fromWh = body.from_warehouse_id || body.fromWarehouse || body.from_warehouse
  const toWh = body.to_warehouse_id || body.toWarehouse || body.to_warehouse

  if (!fromWh || !toWh) {
    return { status: 400, body: { error: "Source (from_warehouse_id) and destination (to_warehouse_id) warehouses are required." } }
  }

  if (String(fromWh).trim().toUpperCase() === String(toWh).trim().toUpperCase()) {
    return { status: 400, body: { error: "Source and destination warehouses cannot be the same." } }
  }

  const items = Array.isArray(body.items) ? body.items : (Array.isArray(body.line_items) ? body.line_items : [])
  if (items.length === 0) {
    return { status: 400, body: { error: "Transfer must contain at least one line item." } }
  }

  const transferId = body.id || body.transfer_no || `TR-${Date.now()}`
  const validCols = await getTableColumns("store_transfers")
  const normalized = normalizeBodyToDbColumns(
    { ...body, id: transferId, transfer_no: body.transfer_no || transferId, from_warehouse_id: fromWh, to_warehouse_id: toWh },
    validCols
  )

  if (!normalized.request_date) normalized.request_date = getLocalDateString()

  return await withTransaction(async (conn) => {
    const insertCols = Object.keys(normalized).filter((k) => k !== "items" && k !== "line_items" && k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k)))
    const placeholders = insertCols.map(() => "?").join(", ")
    const values = insertCols.map((k) => sanitizeSqlValue(normalized[k]))

    await conn.query(
      `INSERT INTO \`store_transfers\` (\`${insertCols.join("`, `")}\`) VALUES (${placeholders})`,
      values
    )

    // Insert items
    const validItemCols = await getTableColumns("store_transfer_items")
    for (const item of items) {
      const itemId = item.id || `TI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const prodId = item.product_id || item.productId
      if (!prodId) {
        return { status: 400, body: { error: "Each line item must have a valid product_id." } }
      }
      const normalizedItem = normalizeBodyToDbColumns(
        {
          ...item,
          id: itemId,
          transfer_id: transferId,
          product_id: prodId,
          product_name: item.product_name || item.item_name || item.itemName || item.item || "Medicine",
          quantity: Number(item.quantity || 0),
          unit_cost: Number(item.unit_cost || item.unit_price || item.unitPrice || 0),
        },
        validItemCols
      )
      const itemCols = Object.keys(normalizedItem).filter((k) => k !== "created_at" && k !== "updated_at" && (!validItemCols || validItemCols.has(k)))
      const itemPlaceholders = itemCols.map(() => "?").join(", ")
      const itemVals = itemCols.map((k) => sanitizeSqlValue(normalizedItem[k]))
      await conn.query(
        `INSERT INTO \`store_transfer_items\` (\`${itemCols.join("`, `")}\`) VALUES (${itemPlaceholders})`,
        itemVals
      )
    }

    const [createdRows] = await conn.query("SELECT * FROM `store_transfers` WHERE id = ?", [transferId])
    const out = unwrapRow(createdRows[0], "relational")
    out.items = items
    return { status: 201, body: out }
  })
}

export async function updateTransfer(id, updates = {}) {
  const cleanId = String(id).trim()
  const validCols = await getTableColumns("store_transfers")
  const normalized = normalizeBodyToDbColumns(updates, validCols)

  return await withTransaction(async (conn) => {
    const updateCols = Object.keys(normalized).filter(
      (k) => k !== "id" && k !== "created_at" && k !== "items" && (!validCols || validCols.has(k))
    )

    if (updateCols.length > 0) {
      const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
      const values = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
      values.push(cleanId)
      await conn.query(`UPDATE \`store_transfers\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, values)
    }

    // Update items if specified
    if (Array.isArray(updates.items)) {
      await conn.query("DELETE FROM `store_transfer_items` WHERE transfer_id = ?", [cleanId])
      const validItemCols = await getTableColumns("store_transfer_items")
      for (const item of updates.items) {
        const itemId = item.id || `TI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const normalizedItem = normalizeBodyToDbColumns({ ...item, id: itemId, transfer_id: cleanId }, validItemCols)
        const itemCols = Object.keys(normalizedItem).filter((k) => !validItemCols || validItemCols.has(k))
        const itemPlaceholders = itemCols.map(() => "?").join(", ")
        const itemVals = itemCols.map((k) => sanitizeSqlValue(normalizedItem[k]))
        await conn.query(
          `INSERT INTO \`store_transfer_items\` (\`${itemCols.join("`, `")}\`) VALUES (${itemPlaceholders})`,
          itemVals
        )
      }
    }

    const [rows] = await conn.query("SELECT * FROM `store_transfers` WHERE id = ?", [cleanId])
    if (rows.length === 0) return { status: 404, body: { error: `Store transfer '${cleanId}' not found.` } }
    const out = unwrapRow(rows[0], "relational")
    const [items] = await conn.query("SELECT * FROM `store_transfer_items` WHERE transfer_id = ?", [cleanId])
    out.items = items.map((it) => unwrapRow(it, "relational"))
    return { status: 200, body: out }
  })
}

export async function deleteTransfer(id) {
  const cleanId = String(id).trim()
  return await withTransaction(async (conn) => {
    await conn.query("DELETE FROM `store_transfer_items` WHERE transfer_id = ?", [cleanId])
    await conn.query("DELETE FROM `store_transfers` WHERE id = ?", [cleanId])
    return { status: 200, body: { success: true, message: `Transfer '${cleanId}' deleted.` } }
  })
}
