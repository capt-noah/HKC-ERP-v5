import { db } from "./client.js"
import * as schema from "./schema/index.js"
import { eq, desc, sql } from "drizzle-orm"
import crypto from "node:crypto"

// Master mapping from resource table name to Drizzle schema table object
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

function unwrapRow(row, storage) {
  if (!row) return null
  if (storage === "jsonb_document" || storage === "json_document") {
    let payload = row.payload
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload)
      } catch {
        payload = {}
      }
    }
    return { id: row.id, ...(payload || {}) }
  }
  return row
}

// ── Native MySQL Drizzle CRUD Methods ──

export async function drizzleListRows({ resource, query = {} }) {
  const table = getDrizzleTable(resource.table)
  if (!table) {
    return { status: 404, body: { error: `Table '${resource.table}' not found in Drizzle schema.` } }
  }

  try {
    let q = db.select().from(table)
    if (table.createdAt) q = q.orderBy(desc(table.createdAt))
    if (query.limit) q = q.limit(parseInt(query.limit, 10))
    if (query.offset) q = q.offset(parseInt(query.offset, 10))

    const rows = await q
    return { status: 200, body: rows.map((r) => unwrapRow(r, resource.storage)) }
  } catch (err) {
    console.error(`[DRIZZLE MYSQL LIST ERROR] ${resource.table}:`, err)
    return { status: 500, body: { error: `Failed to list ${resource.table}`, message: err.message } }
  }
}

export async function drizzleGetRow({ resource, id }) {
  const table = getDrizzleTable(resource.table)
  if (!table) {
    return { status: 404, body: { error: `Table '${resource.table}' not found in Drizzle schema.` } }
  }

  try {
    const rows = await db.select().from(table).where(eq(table.id, id)).limit(1)
    if (rows.length > 0) {
      return { status: 200, body: unwrapRow(rows[0], resource.storage) }
    }
    return { status: 404, body: { error: `Row '${id}' not found in ${resource.table}.` } }
  } catch (err) {
    console.error(`[DRIZZLE MYSQL GET ERROR] ${resource.table}:${id}:`, err)
    return { status: 500, body: { error: `Failed to get ${resource.table}:${id}`, message: err.message } }
  }
}

export async function drizzleCreateRow({ resource, body }) {
  const table = getDrizzleTable(resource.table)
  if (!table) {
    return { status: 404, body: { error: `Table '${resource.table}' not found in Drizzle schema.` } }
  }

  const id = body?.id ? String(body.id) : crypto.randomUUID()
  const payloadData = (resource.storage === "jsonb_document" || resource.storage === "json_document")
    ? (body?.payload || body)
    : body

  try {
    const isDoc = (resource.storage === "jsonb_document" || resource.storage === "json_document")
    const insertValues = isDoc
      ? { id, payload: payloadData, createdAt: new Date(), updatedAt: new Date() }
      : { ...body, id, createdAt: new Date(), updatedAt: new Date() }

    await db.insert(table).values(insertValues)
    const created = await db.select().from(table).where(eq(table.id, id)).limit(1)
    return { status: 200, body: unwrapRow(created[0] || insertValues, resource.storage) }
  } catch (err) {
    console.error(`[DRIZZLE MYSQL CREATE ERROR] ${resource.table}:`, err)
    return { status: 500, body: { error: `Failed to create in ${resource.table}`, message: err.message } }
  }
}

export async function drizzleUpdateRow({ resource, id, body }) {
  const table = getDrizzleTable(resource.table)
  if (!table) {
    return { status: 404, body: { error: `Table '${resource.table}' not found in Drizzle schema.` } }
  }

  try {
    const isDoc = (resource.storage === "jsonb_document" || resource.storage === "json_document")
    let updateValues
    if (isDoc) {
      const existing = await db.select().from(table).where(eq(table.id, id)).limit(1)
      const existingPayload = existing.length > 0
        ? (typeof existing[0].payload === "string" ? JSON.parse(existing[0].payload) : (existing[0].payload || {}))
        : {}
      updateValues = { payload: { ...existingPayload, ...body }, updatedAt: new Date() }
    } else {
      updateValues = { ...body, updatedAt: new Date() }
    }

    await db.update(table).set(updateValues).where(eq(table.id, id))
    const updated = await db.select().from(table).where(eq(table.id, id)).limit(1)
    return { status: 200, body: unwrapRow(updated[0] || { id, ...updateValues }, resource.storage) }
  } catch (err) {
    console.error(`[DRIZZLE MYSQL UPDATE ERROR] ${resource.table}:${id}:`, err)
    return { status: 500, body: { error: `Failed to update ${resource.table}:${id}`, message: err.message } }
  }
}

export async function drizzleDeleteRow({ resource, id }) {
  const table = getDrizzleTable(resource.table)
  if (!table) {
    return { status: 404, body: { error: `Table '${resource.table}' not found in Drizzle schema.` } }
  }

  try {
    await db.delete(table).where(eq(table.id, id))
    return { status: 200, body: { ok: true, deletedId: id } }
  } catch (err) {
    console.error(`[DRIZZLE MYSQL DELETE ERROR] ${resource.table}:${id}:`, err)
    return { status: 500, body: { error: `Failed to delete ${resource.table}:${id}`, message: err.message } }
  }
}

export async function drizzleReplaceRows({ resource, body }) {
  const table = getDrizzleTable(resource.table)
  if (!table) {
    return { status: 404, body: { error: `Table '${resource.table}' not found in Drizzle schema.` } }
  }

  const items = Array.isArray(body) ? body : [body]
  if (items.length === 0) {
    return { status: 200, body: { ok: true, count: 0 } }
  }

  const isDoc = (resource.storage === "jsonb_document" || resource.storage === "json_document")

  try {
    const rows = items.map((item) => {
      const id = item?.id ? String(item.id) : crypto.randomUUID()
      if (isDoc) {
        const { id: _ignoredId, ...payloadData } = item || {}
        return { id, payload: payloadData, updatedAt: new Date() }
      }
      return { ...item, id, updatedAt: new Date() }
    })

    for (const row of rows) {
      await db.insert(table).values(row).onDuplicateKeyUpdate({
        set: isDoc
          ? { payload: row.payload, updatedAt: new Date() }
          : { ...row, updatedAt: new Date() }
      })
    }

    return { status: 200, body: { ok: true, count: rows.length } }
  } catch (err) {
    console.error(`[DRIZZLE MYSQL REPLACE ERROR] ${resource.table}:`, err)
    return { status: 500, body: { error: `Failed to replace rows in ${resource.table}`, message: err.message } }
  }
}
