import { pool, db } from "./client.js"
import * as schema from "./schema/index.js"
import crypto from "node:crypto"

// Master mapping from resource table name to Drizzle schema table object (for type-safe schema checks/migrations)
export const tableMap = {
  // Inventory (4)
  warehouses: schema.warehouses,
  inventory_products: schema.inventoryProducts,
  stock_movements: schema.stockMovements,
  store_transfers: schema.storeTransfers,

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

  // Finance & GL (10)
  company_settings: schema.companySettings,
  chart_of_accounts: schema.chartOfAccounts,
  journal_entries: schema.journalEntries,
  journal_entry_lines: schema.journalEntryLines,
  invoices: schema.invoices,
  payments: schema.payments,
  expenses: schema.expenses,
  recurring_expense_schedules: schema.recurringExpenseSchedules,
  vehicles: schema.vehicles,
  tax_rules: schema.taxRules,

  // HR & Payroll (6)
  employees: schema.employees,
  attendance_records: schema.attendanceRecords,
  payroll_periods: schema.payrollPeriods,
  payroll_records: schema.payrollRecords,
  leave_types: schema.leaveTypes,
  leave_requests: schema.leaveRequests,

  // Admin (2)
  users: schema.users,
  user_activity_logs: schema.userActivityLogs,
}

export function getDrizzleTable(tableName) {
  return tableMap[tableName] || null
}

export function unwrapRow(row, storage) {
  if (!row) return null
  const isDoc = storage === "jsonb_document" || storage === "json_document"
  if (isDoc) {
    let payload = row.payload
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload)
      } catch {
        payload = {}
      }
    }
    const merged = { ...(payload || {}), id: row.id || payload?.id }
    if (row.created_at && !merged.created_at) merged.created_at = row.created_at
    if (row.updated_at && !merged.updated_at) merged.updated_at = row.updated_at
    return merged
  }
  return row
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

    for (const [key, rawVal] of Object.entries(query)) {
      if (
        key === "limit" ||
        key === "offset" ||
        key === "order" ||
        key === "select" ||
        key === "page" ||
        key === "pageSize" ||
        key === "search" ||
        key === "batch" ||
        key === "q" ||
        key === "apikey"
      )
        continue
      if (rawVal === undefined || rawVal === null || rawVal === "") continue

      const cleanVal = typeof rawVal === "string" && rawVal.startsWith("eq.") ? rawVal.slice(3) : rawVal

      if (key === "id") {
        conditions.push(`id = ?`)
        params.push(cleanVal)
      } else if (isDoc) {
        conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(payload, '$.${key}')) = ?`)
        params.push(String(cleanVal))
      } else {
        conditions.push(`\`${key}\` = ?`)
        params.push(cleanVal)
      }
    }

    let sql = `SELECT * FROM \`${tableName}\``
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`
    }

    // Try ORDER BY created_at DESC; if column doesn't exist, execute without it
    let rows
    try {
      let fullSql = `${sql} ORDER BY created_at DESC`
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
      : ["issue_number", "fs_no", "sales_order_id", "reference_no"]

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

const tableColumnsCache = new Map()

async function getTableColumns(tableName) {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName)
  }
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``)
    const colNames = new Set(cols.map((c) => c.Field))
    tableColumnsCache.set(tableName, colNames)
    return colNames
  } catch (err) {
    console.warn(`[TABLE COLUMNS CHECK WARNING] \`${tableName}\`:`, err.message)
    return null
  }
}

export async function drizzleCreateRow({ resource, body }) {
  if (!resource || !resource.table) {
    return { status: 404, body: { error: `Invalid resource specification.` } }
  }

  const tableName = resource.table
  const isDoc = resource.storage === "jsonb_document" || resource.storage === "json_document"
  const id = body?.id ? String(body.id) : crypto.randomUUID()

  try {
    if (isDoc) {
      const { id: _ignoredId, ...payloadData } = body || {}
      const payloadString = JSON.stringify({ id, ...payloadData })
      await pool.query(
        `INSERT INTO \`${tableName}\` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))`,
        [id, payloadString]
      )
      return { status: 200, body: { id, ...payloadData } }
    } else {
      const validCols = await getTableColumns(tableName)
      const fields = Object.keys(body).filter((k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k)))
      if (fields.length === 0) {
        return { status: 200, body: { id, ...body } }
      }
      const values = fields.map((k) => {
        const val = body[k]
        if (typeof val === "object" && val !== null) return JSON.stringify(val)
        return val
      })
      const placeholders = fields.map(() => "?").join(", ")
      const colNames = fields.map((f) => `\`${f}\``).join(", ")

      await pool.query(
        `INSERT INTO \`${tableName}\` (${colNames}) VALUES (${placeholders})`,
        values
      )
      return { status: 200, body: { id, ...body } }
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
  const isDoc = resource.storage === "jsonb_document" || resource.storage === "json_document"
  const cleanId = String(id).trim()

  try {
    if (isDoc) {
      const getRes = await drizzleGetRow({ resource, id: cleanId })
      const existingPayload = (getRes.status === 200 && getRes.body) ? getRes.body : {}
      const targetId = existingPayload.id || cleanId

      const mergedPayload = { ...existingPayload, ...body, id: targetId }
      await pool.query(
        `UPDATE \`${tableName}\` SET payload = ?, updated_at = NOW(3) WHERE id = ?`,
        [JSON.stringify(mergedPayload), String(targetId)]
      )
      return { status: 200, body: mergedPayload }
    } else {
      // Find actual existing row in DB to get real primary key
      const getRes = await drizzleGetRow({ resource, id: cleanId })
      const existingRow = (getRes.status === 200 && getRes.body) ? getRes.body : null
      const targetDbId = existingRow?.id || cleanId

      const validCols = await getTableColumns(tableName)
      const fields = Object.keys(body).filter((k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k)))
      if (fields.length === 0) {
        return { status: 200, body: { id: targetDbId, ...body } }
      }

      const setClauses = fields.map((f) => `\`${f}\` = ?`).join(", ")
      const values = fields.map((k) => {
        const val = body[k]
        if (typeof val === "object" && val !== null) return JSON.stringify(val)
        return val
      })
      values.push(String(targetDbId))

      await pool.query(`UPDATE \`${tableName}\` SET ${setClauses} WHERE id = ?`, values)
      return { status: 200, body: { id: targetDbId, ...body } }
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
  try {
    const getRes = await drizzleGetRow({ resource, id: cleanId })
    const targetDbId = getRes.body?.id || cleanId
    await pool.query(`DELETE FROM \`${tableName}\` WHERE id = ?`, [String(targetDbId)])
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
        const fields = Object.keys(item)
        const colNames = fields.map((f) => `\`${f}\``).join(", ")
        const placeholders = fields.map(() => "?").join(", ")
        const updates = fields.filter((f) => f !== "id").map((f) => `\`${f}\` = VALUES(\`${f}\`)`).join(", ")
        const values = fields.map((k) => {
          const val = item[k]
          if (typeof val === "object" && val !== null) return JSON.stringify(val)
          return val
        })

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
