import { pool, db } from "./client.js"
import * as schema from "./schema/index.js"
import crypto from "node:crypto"
import {
  unwrapRow,
  getTableColumns,
  sanitizeSqlValue,
  normalizeBodyToDbColumns,
  parseJsonField,
} from "./dbUtils.js"
import { inventoryService } from "../modules/inventory/inventoryService.js"
import { salesService } from "../modules/sales/salesService.js"
import { withTransaction } from "./transactionHelper.js"
import { getDefaultWarehouseForType, invalidateWarehouseCache } from "../utils/warehouseUtils.js"

export {
  unwrapRow,
  getTableColumns,
  sanitizeSqlValue,
  normalizeBodyToDbColumns,
  parseJsonField,
}

// Master mapping from resource table name to Drizzle schema table object (for type-safe schema checks/migrations)
export const tableMap = {
  // Inventory (8 Dedicated Relational Tables)
  warehouses: schema.warehouses,
  export_products: schema.exportProducts,
  pharma_products: schema.pharmaProducts,
  pharma_product_batches: schema.pharmaProductBatches,
  stock_movements: schema.stockMovements,
  store_transfers: schema.storeTransfers,
  store_transfer_items: schema.storeTransferItems,
  export_warehouse_movements: schema.exportWarehouseMovements,

  // Sales & Purchasing (9)
  customers: schema.customers,
  suppliers: schema.suppliers,
  sales_orders: schema.salesOrders,
  purchase_orders: schema.purchaseOrders,
  sales_issues: schema.salesIssues,
  sales_issue_items: schema.salesIssueItems,
  processing_services: schema.processingServices,
  shipment_documents: schema.shipmentDocuments,
  hkc_doc_records: schema.hkcDocRecords,

  // Finance & GL (9 Relational Tables + 1 Config Singleton)
  company_settings: schema.companySettings,
  chart_of_accounts: schema.chartOfAccounts,
  gl_account_mappings: schema.glAccountMappings,
  journal_entries: schema.journalEntries,
  journal_entry_lines: schema.journalEntryLines,
  invoices: schema.invoices,
  payments: schema.payments,
  expenses: schema.expenses,
  tax_rules: schema.taxRules,

  // HR & Payroll (5 Relational Tables)
  employees: schema.employees,
  attendance_records: schema.attendanceRecords,
  payroll_periods: schema.payrollPeriods,
  payroll_records: schema.payrollRecords,
  leave_requests: schema.leaveRequests,

  // Admin (3)
  users: schema.users,
  user_activity_logs: schema.userActivityLogs,
  user_sessions: schema.userSessions,
}

export function getDrizzleTable(tableName) {
  return tableMap[tableName] || null
}


// ── Native Resilient MySQL CRUD Methods (Direct Pool Connection for Maximum Compatibility) ──

export async function drizzleListRows({ resource, query = {} }) {
  if (!resource || !resource.table) {
    return { status: 404, body: { error: `Invalid resource specification.` } }
  }

  const tableName = resource.table
  const isDoc = resource.storage === "jsonb_document" || resource.storage === "json_document"

  try {
    const conditions = []
    const params = []
    const validCols = await getTableColumns(tableName)

    for (const [key, rawVal] of Object.entries(query)) {
      if (
        key === "limit" ||
        key === "offset" ||
        key === "order" ||
        key === "sort" ||
        key === "direction" ||
        key === "select" ||
        key === "fields" ||
        key === "page" ||
        key === "pageSize" ||
        key === "per_page" ||
        key === "search" ||
        key === "batch" ||
        key === "q" ||
        key === "query" ||
        key === "apikey" ||
        key === "_t" ||
        key === "_" ||
        key === "t" ||
        key === "timestamp" ||
        key === "cacheBust" ||
        key.startsWith("_")
      ) {
        continue
      }
      if (rawVal === undefined || rawVal === null || rawVal === "") continue

      const cleanVal = typeof rawVal === "string" && rawVal.startsWith("eq.") ? rawVal.slice(3) : rawVal

      if (key === "id") {
        conditions.push(`id = ?`)
        params.push(cleanVal)
      } else if (isDoc) {
        if (validCols && validCols.has(key)) {
          conditions.push(`\`${key}\` = ?`)
          params.push(cleanVal)
        } else {
          conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(payload, '$.${key}')) = ?`)
          params.push(String(cleanVal))
        }
      } else {
        let dbCol = key
        if (validCols && !validCols.has(dbCol)) {
          const aliases = {
            warehouse: "warehouse_id",
            warehouseId: "warehouse_id",
            productId: "product_id",
            customerId: "customer_id",
            supplierId: "supplier_id",
            orderId: "order_id",
            salesOrderId: "sales_order_id",
            salesIssueId: "sales_issue_id",
            batchNo: "batch_no",
            batchNumber: "batch_no",
          }
          if (aliases[key] && validCols.has(aliases[key])) {
            dbCol = aliases[key]
          } else {
            // Unknown column on this table: ignore to prevent ER_BAD_FIELD_ERROR
            continue
          }
        }
        conditions.push(`\`${dbCol}\` = ?`)
        params.push(cleanVal)
      }
    }

    let sql = `SELECT * FROM \`${tableName}\``
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`
    }

    let defaultOrder = "ORDER BY created_at DESC"
    if (tableName === "journal_entries") {
      defaultOrder = "ORDER BY entry_date DESC, created_at DESC"
    } else if (tableName === "chart_of_accounts") {
      defaultOrder = "ORDER BY code ASC"
    } else if (tableName === "sales_orders") {
      defaultOrder = "ORDER BY order_date DESC, created_at DESC"
    } else if (tableName === "invoices") {
      defaultOrder = "ORDER BY issue_date DESC, created_at DESC"
    } else if (tableName === "hkc_doc_records") {
      defaultOrder = "ORDER BY record_date DESC, created_at DESC"
    } else if (tableName === "customers" || tableName === "suppliers") {
      defaultOrder = "ORDER BY name ASC"
    }

    // Try default ORDER BY; if column doesn't exist, execute without it
    let rows
    try {
      let fullSql = `${sql} ${defaultOrder}`
      const fullParams = [...params]
      if (query.limit) {
        fullSql += ` LIMIT ?`
        fullParams.push(parseInt(query.limit, 10))
      }
      if (query.offset) {
        fullSql += ` OFFSET ?`
        fullParams.push(parseInt(query.offset, 10))
      }
      const [res] = await pool.query(fullSql, fullParams)
      rows = res
    } catch (orderErr) {
      let fallbackSql = sql
      const fallbackParams = [...params]
      if (query.limit) {
        fallbackSql += ` LIMIT ?`
        fallbackParams.push(parseInt(query.limit, 10))
      }
      if (query.offset) {
        fallbackSql += ` OFFSET ?`
        fallbackParams.push(parseInt(query.offset, 10))
      }
      const [res] = await pool.query(fallbackSql, fallbackParams)
      rows = res
    }

    return { status: 200, body: rows.map((r) => unwrapRow(r, resource.storage)) }
  } catch (err) {
    console.error(`[MYSQL LIST ERROR] ${tableName}:`, err)
    return { status: 500, body: { error: `Failed to list ${tableName}`, message: err.message } }
  }
}

export async function drizzleGetRow({ resource, id }) {
  if (!resource || !resource.table) {
    return { status: 404, body: { error: `Invalid resource specification.` } }
  }

  const tableName = resource.table
  const cleanId = String(id).trim()
  try {
    // 1. Direct primary key query
    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1`, [cleanId])
    if (Array.isArray(rows) && rows.length > 0) {
      return { status: 200, body: unwrapRow(rows[0], resource.storage) }
    }

    // 2. Dynamic multi-identifier column fallback
    const validCols = await getTableColumns(tableName)
    const possibleCols = [
      "code",
      "issue_number",
      "issueNumber",
      "fs_no",
      "fsNo",
      "sales_order_id",
      "salesOrderId",
      "reference_no",
      "referenceNo",
      "invoice_number",
      "voucher_number",
      "order_number",
      "customer_id",
    ]
    const matchedCols = validCols
      ? possibleCols.filter((c) => validCols.has(c))
      : ["code", "issue_number", "fs_no", "sales_order_id", "reference_no"]

    for (const col of matchedCols) {
      try {
        const [altRows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE \`${col}\` = ? LIMIT 1`, [cleanId])
        if (Array.isArray(altRows) && altRows.length > 0) {
          return { status: 200, body: unwrapRow(altRows[0], resource.storage) }
        }
      } catch {}
    }

    // 3. Fallback: list rows and fuzzy match
    const [allRows] = await pool.query(`SELECT * FROM \`${tableName}\` LIMIT 200`)
    if (Array.isArray(allRows)) {
      for (const raw of allRows) {
        const r = unwrapRow(raw, resource.storage)
        if (
          String(r.id) === cleanId ||
          String(r.issue_number || "").toLowerCase() === cleanId.toLowerCase() ||
          String(r.fs_no || "").toLowerCase() === cleanId.toLowerCase() ||
          String(r.reference_no || "").toLowerCase() === cleanId.toLowerCase() ||
          String(r.sales_order_id || "").toLowerCase() === cleanId.toLowerCase()
        ) {
          return { status: 200, body: r }
        }
      }
    }

    return { status: 404, body: { error: `Row '${id}' not found in ${tableName}.` } }
  } catch (err) {
    console.error(`[MYSQL GET ERROR] ${tableName}:${id}:`, err)
    return { status: 500, body: { error: `Failed to get ${tableName}:${id}`, message: err.message } }
  }
}


export async function drizzleCreateRow({ resource, body }) {
  if (!resource || !resource.table) {
    return { status: 404, body: { error: `Invalid resource specification.` } }
  }

  const tableName = resource.table
  if (tableName === "pharma_products" || tableName === "export_products") {
    return await inventoryService.createProduct({
      ...body,
      warehouse_id: body.warehouse_id || body.warehouse || (await getDefaultWarehouseForType(tableName === "export_products" ? "EXPORT_WH" : "PHARMA_WH")),
    })
  }
  if (tableName === "pharma_product_batches") {
    return await inventoryService.createBatch(body)
  }
  if (tableName === "stock_movements" || tableName === "export_warehouse_movements") {
    return await inventoryService.recordMovement(body, tableName)
  }
  if (tableName === "store_transfers") {
    return await inventoryService.createTransfer(body)
  }

  const isDoc = resource.storage === "jsonb_document" || resource.storage === "json_document"
  const id = body?.id ? String(body.id) : crypto.randomUUID()

  try {
    if (isDoc) {
      let rawData = { ...(body || {}) }
      if (rawData.payload && typeof rawData.payload === "object" && !Array.isArray(rawData.payload)) {
        rawData = { ...rawData, ...rawData.payload }
        delete rawData.payload
      }
      const { id: _ignoredId, ...payloadData } = rawData

      // Server-side de-duplication for directory tables (suppliers & customers)
      if (tableName === "suppliers" || tableName === "customers") {
        const candidateName = (payloadData.name || payloadData.client_company_name || "").toLowerCase().trim()
        if (candidateName) {
          const [existingRows] = await pool.query(`SELECT id, payload FROM \`${tableName}\``)
          for (const row of existingRows) {
            let rowPayload = row.payload
            if (typeof rowPayload === "string") {
              try { rowPayload = JSON.parse(rowPayload) } catch {}
            }
            const existingName = (rowPayload?.name || rowPayload?.client_company_name || "").toLowerCase().trim()
            if (existingName === candidateName || String(row.id) === String(id)) {
              // Merge and update existing record rather than creating duplicate
              const merged = { ...(rowPayload || {}), ...payloadData, id: row.id }
              await pool.query(
                `UPDATE \`${tableName}\` SET payload = ?, updated_at = NOW(3) WHERE id = ?`,
                [JSON.stringify(merged), row.id]
              )
              return { status: 200, body: merged }
            }
          }
        } else if (id) {
          // If candidate name is empty but an ID is provided, merge with existing record by ID
          const [idRows] = await pool.query(`SELECT id, payload FROM \`${tableName}\` WHERE id = ?`, [id])
          if (idRows.length > 0) {
            let rowPayload = idRows[0].payload
            if (typeof rowPayload === "string") {
              try { rowPayload = JSON.parse(rowPayload) } catch {}
            }
            const merged = { ...(rowPayload || {}), ...payloadData, id }
            await pool.query(
              `UPDATE \`${tableName}\` SET payload = ?, updated_at = NOW(3) WHERE id = ?`,
              [JSON.stringify(merged), id]
            )
            return { status: 200, body: merged }
          }
        }
      }

      const payloadString = JSON.stringify({ id, ...payloadData })
      const validCols = await getTableColumns(tableName)
      const explicitCols = []
      const explicitVals = []
      const updateClauses = [`payload = VALUES(payload)`, `updated_at = NOW(3)`]

      if (validCols) {
        for (const col of validCols) {
          if (col !== "id" && col !== "payload" && col !== "created_at" && col !== "updated_at") {
            if (payloadData[col] !== undefined) {
              explicitCols.push(`\`${col}\``)
              explicitVals.push(sanitizeSqlValue(payloadData[col]))
              updateClauses.push(`\`${col}\` = VALUES(\`${col}\`)`)
            }
          }
        }
      }

      if (explicitCols.length > 0) {
        const colList = ["id", "payload", ...explicitCols, "created_at", "updated_at"].join(", ")
        const placeholders = ["?", "?", ...explicitCols.map(() => "?"), "NOW(3)", "NOW(3)"].join(", ")
        await pool.query(
          `INSERT INTO \`${tableName}\` (${colList}) VALUES (${placeholders})
           ON DUPLICATE KEY UPDATE ${updateClauses.join(", ")}`,
          [id, payloadString, ...explicitVals]
        )
      } else {
        await pool.query(
          `INSERT INTO \`${tableName}\` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))
           ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
          [id, payloadString]
        )
      }
      return { status: 200, body: { id, ...payloadData } }
    } else {
      const validCols = await getTableColumns(tableName)
      const normalizedBody = normalizeBodyToDbColumns(body, validCols)
      if (!normalizedBody.id) normalizedBody.id = id

      const fields = Object.keys(normalizedBody).filter(
        (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
      )
      if (fields.length === 0) {
        return { status: 200, body: unwrapRow({ id, ...body }, "relational") }
      }
      const colNames = fields.map((f) => `\`${f}\``).join(", ")
      const values = fields.map((k) => sanitizeSqlValue(normalizedBody[k]))
      const placeholders = fields.map(() => "?").join(", ")
      const updateSet = fields
        .filter((k) => k !== "id")
        .map((f) => `\`${f}\` = VALUES(\`${f}\`)`)
        .join(", ")

      await pool.query(
        `INSERT INTO \`${tableName}\` (${colNames}) VALUES (${placeholders})
         ${updateSet ? `ON DUPLICATE KEY UPDATE ${updateSet}` : ""}`,
        values
      )
      if (tableName === "warehouses") {
        invalidateWarehouseCache()
      }
      return { status: 200, body: unwrapRow({ ...normalizedBody, id }, "relational") }
    }
  } catch (err) {
    console.error(`[MYSQL CREATE ERROR] ${tableName}:`, err)
    return { status: 500, body: { error: `Failed to create in ${tableName}`, message: err.message } }
  }
}

export async function drizzleUpdateRow({ resource, id, body }) {
  if (!resource || !resource.table) {
    return { status: 404, body: { error: `Invalid resource specification.` } }
  }

  const tableName = resource.table
  const cleanId = String(id).trim()

  if (tableName === "pharma_products" || tableName === "export_products") {
    return await inventoryService.updateProduct(cleanId, body)
  }
  if (tableName === "pharma_product_batches") {
    return await inventoryService.updateBatch(cleanId, body)
  }
  if (tableName === "stock_movements" || tableName === "export_warehouse_movements") {
    return await inventoryService.updateMovement(cleanId, body, tableName)
  }
  if (tableName === "store_transfers") {
    return await inventoryService.updateTransfer(cleanId, body)
  }

  const isDoc = resource.storage === "jsonb_document" || resource.storage === "json_document"

  try {
    if (isDoc) {
      const getRes = await drizzleGetRow({ resource, id: cleanId })
      const existingPayload = (getRes.status === 200 && getRes.body) ? getRes.body : {}
      const targetId = existingPayload.id || cleanId

      let rawUpdate = { ...(body || {}) }
      if (rawUpdate.payload && typeof rawUpdate.payload === "object" && !Array.isArray(rawUpdate.payload)) {
        rawUpdate = { ...rawUpdate, ...rawUpdate.payload }
        delete rawUpdate.payload
      }

      // Safeguard: Never allow partial updates (such as trade paper sync) to wipe customer or supplier fields
      if (tableName === "customers" || tableName === "suppliers") {
        const fieldsToPreserve = [
          "name", "phone", "tin", "warehouseTarget", "warehouse_target",
          "category", "email", "address", "contactPerson", "contact_person",
          "country", "region", "creditLimit", "status"
        ]
        for (const field of fieldsToPreserve) {
          if (existingPayload[field] !== undefined && (rawUpdate[field] === undefined || rawUpdate[field] === "")) {
            rawUpdate[field] = existingPayload[field]
          }
        }
      }

      const mergedPayload = { ...existingPayload, ...rawUpdate, id: targetId }
      const payloadString = JSON.stringify(mergedPayload)

      const validCols = await getTableColumns(tableName)
      const explicitSetClauses = []
      const explicitVals = []
      const explicitInsertCols = []
      const explicitInsertVals = []
      const explicitUpdateClauses = [`payload = VALUES(payload)`, `updated_at = NOW(3)`]

      if (validCols) {
        for (const col of validCols) {
          if (col !== "id" && col !== "payload" && col !== "created_at" && col !== "updated_at") {
            if (mergedPayload[col] !== undefined) {
              explicitSetClauses.push(`\`${col}\` = ?`)
              explicitVals.push(sanitizeSqlValue(mergedPayload[col]))
              explicitInsertCols.push(`\`${col}\``)
              explicitInsertVals.push(sanitizeSqlValue(mergedPayload[col]))
              explicitUpdateClauses.push(`\`${col}\` = VALUES(\`${col}\`)`)
            }
          }
        }
      }

      const setList = [`payload = ?`, ...explicitSetClauses, `updated_at = NOW(3)`].join(", ")
      const [updateResult] = await pool.query(
        `UPDATE \`${tableName}\` SET ${setList} WHERE id = ?`,
        [payloadString, ...explicitVals, String(targetId)]
      )

      if (updateResult.affectedRows === 0) {
        if (explicitInsertCols.length > 0) {
          const colList = ["id", "payload", ...explicitInsertCols, "created_at", "updated_at"].join(", ")
          const placeholders = ["?", "?", ...explicitInsertCols.map(() => "?"), "NOW(3)", "NOW(3)"].join(", ")
          await pool.query(
            `INSERT INTO \`${tableName}\` (${colList}) VALUES (${placeholders})
             ON DUPLICATE KEY UPDATE ${explicitUpdateClauses.join(", ")}`,
            [String(targetId), payloadString, ...explicitInsertVals]
          )
        } else {
          await pool.query(
            `INSERT INTO \`${tableName}\` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))
             ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
            [String(targetId), payloadString]
          )
        }
      }

      return { status: 200, body: mergedPayload }
    } else {
      // Find actual existing row in DB to get real primary key
      const getRes = await drizzleGetRow({ resource, id: cleanId })
      const existingRow = (getRes.status === 200 && getRes.body) ? getRes.body : null
      const targetDbId = existingRow?.id || cleanId

      const validCols = await getTableColumns(tableName)
      const normalizedBody = normalizeBodyToDbColumns(body, validCols)

      const fields = Object.keys(normalizedBody).filter(
        (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
      )
      if (fields.length === 0) {
        return { status: 200, body: unwrapRow({ id: targetDbId, ...existingRow, ...body }, "relational") }
      }

      const setClauses = fields.map((f) => `\`${f}\` = ?`).join(", ")
      const values = fields.map((k) => sanitizeSqlValue(normalizedBody[k]))
      values.push(String(targetDbId))

      const [updateResult] = await pool.query(`UPDATE \`${tableName}\` SET ${setClauses} WHERE id = ?`, values)

      if (updateResult && updateResult.affectedRows === 0) {
        let codeUpdated = false
        if (validCols && validCols.has("code") && (existingRow?.code || normalizedBody.code)) {
          const codeVal = existingRow?.code || normalizedBody.code
          const [codeRes] = await pool.query(
            `UPDATE \`${tableName}\` SET ${setClauses} WHERE \`code\` = ?`,
            [...values.slice(0, -1), String(codeVal)]
          )
          if (codeRes && codeRes.affectedRows > 0) {
            codeUpdated = true
          }
        }

        if (!codeUpdated) {
          const insertObj = { id: targetDbId, ...existingRow, ...normalizedBody }
          const insertFields = Object.keys(insertObj).filter(
            (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
          )
          const insertValues = insertFields.map((k) => sanitizeSqlValue(insertObj[k]))
          const insertPlaceholders = insertFields.map(() => "?").join(", ")
          const insertColNames = insertFields.map((f) => `\`${f}\``).join(", ")
          const updateSet = insertFields
            .filter((k) => k !== "id")
            .map((f) => `\`${f}\` = VALUES(\`${f}\`)`)
            .join(", ")

          await pool.query(
            `INSERT INTO \`${tableName}\` (${insertColNames}) VALUES (${insertPlaceholders})
             ${updateSet ? `ON DUPLICATE KEY UPDATE ${updateSet}` : ""}`,
            insertValues
          )
        }
      }

      if (tableName === "warehouses") {
        invalidateWarehouseCache()
      }

      return { status: 200, body: unwrapRow({ id: targetDbId, ...existingRow, ...normalizedBody }, "relational") }
    }
  } catch (err) {
    console.error(`[MYSQL UPDATE ERROR] ${tableName}:${id}:`, err)
    return { status: 500, body: { error: `Failed to update ${tableName}:${id}`, message: err.message } }
  }
}

export async function drizzleDeleteRow({ resource, id }) {
  if (!resource || !resource.table) {
    return { status: 404, body: { error: `Invalid resource specification.` } }
  }

  const tableName = resource.table
  const cleanId = String(id).trim()

  if (tableName === "pharma_products" || tableName === "export_products") {
    return await inventoryService.deleteProduct(cleanId)
  }
  if (tableName === "pharma_product_batches") {
    return await inventoryService.deleteBatch(cleanId)
  }
  if (tableName === "stock_movements" || tableName === "export_warehouse_movements") {
    return await inventoryService.deleteMovement(cleanId, tableName)
  }
  if (tableName === "store_transfers") {
    return await inventoryService.deleteTransfer(cleanId)
  }
  if (tableName === "sales_issues") {
    return await salesService.delete(cleanId)
  }
  if (tableName === "invoices") {
    return await withTransaction(async (conn) => {
      const [invRows] = await conn.query(
        "SELECT * FROM invoices WHERE id = ? OR invoice_number = ? LIMIT 1",
        [cleanId, cleanId]
      )
      const inv = invRows[0]
      if (!inv) {
        return { status: 404, body: { error: `Invoice ${cleanId} not found` } }
      }
      const linkedJeIds = [
        `JE-SALE-${inv.id}`,
        `JE-SALE-${inv.invoice_number}`,
        `JE-COGS-${inv.id}`,
        `JE-COGS-${inv.invoice_number}`,
        `JE-PO-${inv.id}`,
        `JE-PO-${inv.invoice_number}`,
      ]
      if (inv.sales_issue_id) {
        linkedJeIds.push(`JE-SALE-${inv.sales_issue_id}`)
        linkedJeIds.push(`JE-COGS-${inv.sales_issue_id}`)
      }
      if (inv.purchase_order_id) {
        linkedJeIds.push(`JE-PO-${inv.purchase_order_id}`)
      }

      await conn.query("DELETE FROM journal_entry_lines WHERE journal_entry_id IN (?)", [linkedJeIds])
      await conn.query(
        "DELETE FROM journal_entries WHERE id IN (?) OR source_id = ? OR source_id = ?",
        [linkedJeIds, inv.id, inv.invoice_number]
      )

      if (inv.sales_issue_id) {
        await conn.query("UPDATE sales_issues SET invoice_id = NULL, payment_status = 'Unpaid' WHERE id = ?", [inv.sales_issue_id])
      }

      await conn.query("DELETE FROM invoices WHERE id = ?", [inv.id])
      return { status: 200, body: { ok: true, deletedId: id } }
    })
  }

  try {
    if (tableName === "users") {
      // 1. Decouple/nullify foreign keys in user_activity_logs
      await pool.query(
        "UPDATE user_activity_logs SET user_id = NULL WHERE user_id = ? OR LOWER(TRIM(username)) = LOWER(?)",
        [cleanId, cleanId]
      ).catch((e) => console.warn("[CLEANUP FK WARNING]:", e.message))

      // 2. Perform direct deletion by ID or username
      const [delRes] = await pool.query(
        "DELETE FROM `users` WHERE id = ? OR LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(id)) = LOWER(?)",
        [cleanId, cleanId, cleanId]
      )

      console.log(`[USER DELETED FROM DB] User ID/Username: ${cleanId}, affectedRows: ${delRes.affectedRows}`)
      return { status: 200, body: { ok: true, deletedId: id, affectedRows: delRes.affectedRows } }
    }

    const getRes = await drizzleGetRow({ resource, id: cleanId })
    const targetDbId = getRes.body?.id || cleanId

    // Clean up dependent relational movements and batches before deleting the product
    if (tableName === "export_products") {
      await pool.query("DELETE FROM export_warehouse_movements WHERE product_id = ?", [String(targetDbId)]).catch(() => {})
    }
    if (tableName === "pharma_products") {
      await pool.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [String(targetDbId)]).catch(() => {})
    }

    await pool.query(`DELETE FROM \`${tableName}\` WHERE id = ?`, [String(targetDbId)])
    if (tableName === "warehouses") {
      invalidateWarehouseCache()
    }
    return { status: 200, body: { ok: true, deletedId: id } }
  } catch (err) {
    console.error(`[MYSQL DELETE ERROR] ${tableName}:${id}:`, err)
    return { status: 500, body: { error: `Failed to delete ${tableName}:${id}`, message: err.message } }
  }
}

export async function drizzleReplaceRows({ resource, body }) {
  if (!resource || !resource.table) {
    return { status: 404, body: { error: `Invalid resource specification.` } }
  }

  const tableName = resource.table
  const items = Array.isArray(body) ? body : [body]
  if (items.length === 0) {
    return { status: 200, body: { ok: true, count: 0 } }
  }

  const isDoc = resource.storage === "jsonb_document" || resource.storage === "json_document"

  try {
    for (const item of items) {
      const id = item?.id ? String(item.id) : crypto.randomUUID()
      if (isDoc) {
        const { id: _ignoredId, ...payloadData } = item || {}
        const payloadString = JSON.stringify({ id, ...payloadData })
        await pool.query(
          `INSERT INTO \`${tableName}\` (id, payload, created_at, updated_at)
           VALUES (?, ?, NOW(3), NOW(3))
           ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
          [id, payloadString]
        )
      } else {
        const validCols = await getTableColumns(tableName)
        const normalizedItem = normalizeBodyToDbColumns(item, validCols)
        if (!normalizedItem.id) normalizedItem.id = id

        const fields = Object.keys(normalizedItem).filter(
          (k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k))
        )
        const colNames = fields.map((f) => `\`${f}\``).join(", ")
        const placeholders = fields.map(() => "?").join(", ")
        const updates = fields.filter((f) => f !== "id").map((f) => `\`${f}\` = VALUES(\`${f}\`)`).join(", ")
        const values = fields.map((k) => sanitizeSqlValue(normalizedItem[k]))

        const sql = `INSERT INTO \`${tableName}\` (${colNames}) VALUES (${placeholders}) ${
          updates.length > 0 ? `ON DUPLICATE KEY UPDATE ${updates}` : ""
        }`
        await pool.query(sql, values)
      }
    }

    return { status: 200, body: { ok: true, count: items.length } }
  } catch (err) {
    console.error(`[MYSQL REPLACE ERROR] ${tableName}:`, err)
    return { status: 500, body: { error: `Failed to replace rows in ${tableName}`, message: err.message } }
  }
}
