import { pool, db } from "./client.js"
import * as schema from "./schema/index.js"
import crypto from "node:crypto"

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

function parseJsonField(val) {
  if (typeof val === "string") {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
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
    // Safeguard against nested payload wrapper
    while (payload && typeof payload === "object" && payload.payload && typeof payload.payload === "object" && !Array.isArray(payload.payload)) {
      payload = { ...payload, ...payload.payload }
      delete payload.payload
    }
    const merged = { ...(payload || {}), id: row.id || payload?.id }
    if (row.created_at && !merged.created_at) merged.created_at = row.created_at
    if (row.updated_at && !merged.updated_at) merged.updated_at = row.updated_at
    return merged
  }

  // Relational Row Unwrapping & Bidirectional CamelCase Normalization
  const out = { ...row }

  // Auto-parse any JSON fields
  for (const k of [
    "batches",
    "wh1_entries",
    "bin_card_entries",
    "items",
    "payload",
    "lines",
    "attachments",
    "payment_advice_attachment",
    "installment_payments",
    "account_entries"
  ]) {
    if (out[k] !== undefined) {
      out[k] = parseJsonField(out[k])
    }
  }

  // Normalization for inventory_products
  if (out.warehouse_id !== undefined && out.warehouse === undefined) out.warehouse = out.warehouse_id
  if (out.warehouse !== undefined && out.warehouse_id === undefined) out.warehouse_id = out.warehouse
  if (out.shelf_number !== undefined && out.shelfNo === undefined) out.shelfNo = out.shelf_number
  if (out.shelf_number !== undefined && out.shelf_no === undefined) out.shelf_no = out.shelf_number
  if (out.strength !== undefined && out.dosage === undefined) out.dosage = out.strength
  if (out.dosage_form !== undefined && out.dosageForm === undefined) out.dosageForm = out.dosage_form
  if (out.quantity_per_pack !== undefined && out.quantityPerPack === undefined) out.quantityPerPack = Number(out.quantity_per_pack)
  if (out.number_of_cartons !== undefined && out.numberOfCartons === undefined) out.numberOfCartons = Number(out.number_of_cartons)
  if (out.unit_cost !== undefined) {
    out.unitCost = Number(out.unit_cost)
    out.unit_cost = Number(out.unit_cost)
  }
  if (out.selling_price !== undefined) {
    out.sellingPrice = Number(out.selling_price)
    out.selling_price = Number(out.selling_price)
  }
  if (out.quantity !== undefined) out.quantity = Number(out.quantity)
  if (out.quantity_sold !== undefined) {
    out.quantitySold = Number(out.quantity_sold)
    out.quantity_sold = Number(out.quantity_sold)
  }
  if (out.total_quantity !== undefined) {
    out.totalQuantity = Number(out.total_quantity)
    out.total_quantity = Number(out.total_quantity)
  }
  if (out.total_stock_value !== undefined) {
    out.totalStockValue = Number(out.total_stock_value)
    out.total_stock_value = Number(out.total_stock_value)
  }
  if (out.reorder_level !== undefined) {
    out.reorderLevel = Number(out.reorder_level)
    out.reorder_level = Number(out.reorder_level)
  }
  if (out.min_stock_level !== undefined) {
    out.minStockLevel = Number(out.min_stock_level)
    out.min_stock_level = Number(out.min_stock_level)
  }
  if (out.sub_category !== undefined && out.subCategory === undefined) out.subCategory = out.sub_category
  if (out.storage_condition !== undefined && out.storageCondition === undefined) out.storageCondition = out.storage_condition
  if (out.supplier_id !== undefined && out.supplier === undefined) out.supplier = out.supplier_id
  if (out.supplier_name !== undefined && out.supplierName === undefined) out.supplierName = out.supplier_name
  if (out.wh1_entries !== undefined && out.wh1Entries === undefined) out.wh1Entries = out.wh1_entries
  if (out.bin_card_entries !== undefined && out.binCardEntries === undefined) out.binCardEntries = out.bin_card_entries

  // Normalization for stock_movements
  if (out.product_id !== undefined && out.productId === undefined) out.productId = out.product_id
  if (out.movement_type !== undefined && out.type === undefined) out.type = out.movement_type
  if (out.movement_date !== undefined && out.date === undefined) out.date = out.movement_date
  if (out.warehouse_id !== undefined) {
    if (out.warehouseId === undefined) out.warehouseId = out.warehouse_id
    if (out.fromWarehouse === undefined) out.fromWarehouse = out.warehouse_id
    if (out.warehouse === undefined) out.warehouse = out.warehouse_id
  }
  if (out.batch_no !== undefined && out.batchNo === undefined) out.batchNo = out.batch_no
  if (out.expiry_date !== undefined && out.expiryDate === undefined) out.expiryDate = out.expiry_date
  if (out.quantity !== undefined) {
    out.quantity = Number(out.quantity)
    if (out.qty === undefined) out.qty = Number(out.quantity)
  }
  if (out.notes !== undefined) {
    if (out.remarks === undefined) out.remarks = out.notes
    if (out.reason === undefined) out.reason = out.notes
  }
  if (out.balance_after !== undefined) {
    out.balanceAfter = Number(out.balance_after)
    out.balance_after = Number(out.balance_after)
  }
  if (out.performed_by !== undefined) {
    if (out.performedBy === undefined) out.performedBy = out.performed_by
    if (out.nameEntered === undefined) out.nameEntered = out.performed_by
  }
  if (out.reference_type !== undefined && out.referenceType === undefined) out.referenceType = out.reference_type
  if (out.reference_id !== undefined && out.reference === undefined) out.reference = out.reference_id

  // Normalization for store_transfers
  if (out.transfer_no !== undefined && out.transferNo === undefined) out.transferNo = out.transfer_no
  if (out.from_warehouse_id !== undefined) {
    if (out.fromWarehouse === undefined) out.fromWarehouse = out.from_warehouse_id
    if (out.from_warehouse === undefined) out.from_warehouse = out.from_warehouse_id
  }
  if (out.to_warehouse_id !== undefined) {
    if (out.toWarehouse === undefined) out.toWarehouse = out.to_warehouse_id
    if (out.to_warehouse === undefined) out.to_warehouse = out.to_warehouse_id
  }
  if (out.request_date !== undefined) {
    if (out.requestDate === undefined) out.requestDate = out.request_date
    if (out.date === undefined) out.date = out.request_date
  }
  if (out.requested_by !== undefined && out.requestedBy === undefined) out.requestedBy = out.requested_by
  if (out.approved_by !== undefined && out.approvedBy === undefined) out.approvedBy = out.approved_by
  if (out.completed_date !== undefined && out.completedDate === undefined) out.completedDate = out.completed_date

  // Normalization for purchase_orders
  if (out.po_number !== undefined && out.poNumber === undefined) out.poNumber = out.po_number
  if (out.poNumber !== undefined && out.po_number === undefined) out.po_number = out.poNumber
  if (out.voucher_no !== undefined && out.voucherNo === undefined) out.voucherNo = out.voucher_no
  if (out.voucherNo !== undefined && out.voucher_no === undefined) out.voucher_no = out.voucherNo
  if (out.paid_to !== undefined && out.paidTo === undefined) out.paidTo = out.paid_to
  if (out.paidTo !== undefined && out.paid_to === undefined) out.paid_to = out.paidTo
  if (out.supplier_id !== undefined && out.supplierId === undefined) out.supplierId = out.supplier_id
  if (out.supplierId !== undefined && out.supplier_id === undefined) out.supplier_id = out.supplierId
  if (out.reason_for_payment !== undefined && out.reasonForPayment === undefined) out.reasonForPayment = out.reason_for_payment
  if (out.reasonForPayment !== undefined && out.reason_for_payment === undefined) out.reason_for_payment = out.reasonForPayment
  if (out.bank_name !== undefined && out.bankName === undefined) out.bankName = out.bank_name
  if (out.bankName !== undefined && out.bank_name === undefined) out.bank_name = out.bankName
  if (out.payment_method !== undefined && out.paymentMethod === undefined) out.paymentMethod = out.payment_method
  if (out.paymentMethod !== undefined && out.payment_method === undefined) out.payment_method = out.paymentMethod
  if (out.cheque_no !== undefined && out.chequeNo === undefined) out.chequeNo = out.cheque_no
  if (out.chequeNo !== undefined && out.cheque_no === undefined) out.cheque_no = out.chequeNo
  if (out.amount !== undefined) out.amount = Number(out.amount)
  if (out.amount_paid !== undefined) {
    out.amountPaid = Number(out.amount_paid)
    out.amount_paid = Number(out.amount_paid)
  }
  if (out.amountPaid !== undefined && out.amount_paid === undefined) out.amount_paid = Number(out.amountPaid)
  if (out.balance_due !== undefined) {
    out.balanceDue = Number(out.balance_due)
    out.balance_due = Number(out.balance_due)
  }
  if (out.balanceDue !== undefined && out.balance_due === undefined) out.balance_due = Number(out.balanceDue)
  if (out.payment_type !== undefined && out.paymentType === undefined) out.paymentType = out.payment_type
  if (out.paymentType !== undefined && out.payment_type === undefined) out.payment_type = out.paymentType
  if (out.payment_terms !== undefined && out.paymentTerms === undefined) out.paymentTerms = out.payment_terms
  if (out.paymentTerms !== undefined && out.payment_terms === undefined) out.payment_terms = out.paymentTerms
  if (out.due_date !== undefined && out.dueDate === undefined) out.dueDate = out.due_date
  if (out.dueDate !== undefined && out.due_date === undefined) out.due_date = out.dueDate
  if (out.settlement_status !== undefined && out.settlementStatus === undefined) out.settlementStatus = out.settlement_status
  if (out.settlementStatus !== undefined && out.settlement_status === undefined) out.settlement_status = out.settlementStatus
  if (out.amount_in_words !== undefined && out.amountInWords === undefined) out.amountInWords = out.amount_in_words
  if (out.amountInWords !== undefined && out.amount_in_words === undefined) out.amount_in_words = out.amountInWords
  if (out.payment_advice_attachment !== undefined && out.paymentAdviceAttachment === undefined) out.paymentAdviceAttachment = out.payment_advice_attachment
  if (out.paymentAdviceAttachment !== undefined && out.payment_advice_attachment === undefined) out.payment_advice_attachment = out.paymentAdviceAttachment
  if (out.installment_payments !== undefined && out.installmentPayments === undefined) out.installmentPayments = out.installment_payments
  if (out.installmentPayments !== undefined && out.installment_payments === undefined) out.installment_payments = out.installmentPayments
  if (out.account_entries !== undefined && out.accountEntries === undefined) out.accountEntries = out.account_entries
  if (out.accountEntries !== undefined && out.account_entries === undefined) out.account_entries = out.accountEntries
  if (out.prepared_by !== undefined && out.preparedBy === undefined) out.preparedBy = out.prepared_by
  if (out.approved_by !== undefined && out.approvedBy === undefined) out.approvedBy = out.approved_by
  if (out.paid_by !== undefined && out.paidBy === undefined) out.paidBy = out.paid_by

  return out
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

function sanitizeSqlValue(val) {
  if (val === undefined) return null
  if (val instanceof Date) return val
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  if (typeof val === "object" && val !== null) {
    return JSON.stringify(val)
  }
  return val
}

function normalizeBodyToDbColumns(body, validCols) {
  if (!body || typeof body !== "object") return body
  const normalized = {}

  const aliases = {
    warehouse: "warehouse_id",
    warehouseId: "warehouse_id",
    unitCost: "unit_cost",
    sellingPrice: "selling_price",
    quantitySold: "quantity_sold",
    totalQuantity: "total_quantity",
    totalStockValue: "total_stock_value",
    reorderLevel: "reorder_level",
    minStockLevel: "min_stock_level",
    subCategory: "sub_category",
    productType: "product_type",
    storageCondition: "storage_condition",
    supplier: "supplier_id",
    supplierId: "supplier_id",
    supplierName: "supplier_name",
    wh1Entries: "wh1_entries",
    binCardEntries: "bin_card_entries",
    productId: "product_id",
    productName: "product_name",
    movementType: "movement_type",
    balanceAfter: "balance_after",
    batchNo: "batch_no",
    batch_no: "batch_no",
    qty: "quantity",
    quantity: "quantity",
    remarks: "notes",
    reason: "notes",
    expiryDate: "expiry_date",
    referenceType: "reference_type",
    referenceId: "reference_id",
    reference: "reference_id",
    performedBy: "performed_by",
    nameEntered: "performed_by",
    movementDate: "movement_date",
    transferNo: "transfer_no",
    fromWarehouse: "from_warehouse_id",
    fromWarehouseId: "from_warehouse_id",
    from_warehouse: "from_warehouse_id",
    toWarehouse: "to_warehouse_id",
    toWarehouseId: "to_warehouse_id",
    to_warehouse: "to_warehouse_id",
    requestDate: "request_date",
    completedDate: "completed_date",
    requestedBy: "requested_by",
    approvedBy: "approved_by",
    voucherNo: "voucher_no",
    plateNumber: "plate_number",
    grossQuantity: "gross_quantity",
    rejectQuantity: "reject_quantity",
    netQuantity: "net_quantity",
    unitPrice: "unit_price",
    createdBy: "created_by",
    issuedBy: "requested_by",
    receivedBy: "approved_by",
    commodityType: "commodity_type",
    cropYear: "crop_year",
    cleanYieldPct: "clean_yield_pct",
    moistureContent: "moisture_content",
    driverName: "driver_name",
    genericName: "generic_name",
    dosageForm: "dosage_form",
    dosage: "strength",
    strength: "strength",
    shelfNo: "shelf_number",
    shelf_no: "shelf_number",
    shelfNumber: "shelf_number",
    warehouse: "warehouse_id",
    warehouseId: "warehouse_id",
    quantityPerPack: "quantity_per_pack",
    numberOfCartons: "number_of_cartons",
    shelfLifeMonths: "shelf_life_months",
    mfgDate: "mfg_date",
    qaStatus: "qa_status",
    paymentType: "payment_type",
    payment_type: "payment_type",
    paymentTerms: "payment_terms",
    payment_terms: "payment_terms",
    amountPaid: "amount_paid",
    amount_paid: "amount_paid",
    balanceDue: "balance_due",
    balance_due: "balance_due",
    settlementStatus: "settlement_status",
    settlement_status: "settlement_status",
    dueDate: "due_date",
    due_date: "due_date",
    invoiceType: "invoice_type",
    invoice_type: "invoice_type",
    partyType: "party_type",
    party_type: "party_type",
    purchaseOrderId: "purchase_order_id",
    purchase_order_id: "purchase_order_id",
    poNumber: "po_number",
    po_number: "po_number",
    paidTo: "paid_to",
    paid_to: "paid_to",
    reasonForPayment: "reason_for_payment",
    reason_for_payment: "reason_for_payment",
    bankName: "bank_name",
    bank_name: "bank_name",
    paymentMethod: "payment_method",
    payment_method: "payment_method",
    chequeNo: "cheque_no",
    cheque_no: "cheque_no",
    amountInWords: "amount_in_words",
    amount_in_words: "amount_in_words",
    paymentAdviceAttachment: "payment_advice_attachment",
    payment_advice_attachment: "payment_advice_attachment",
    installmentPayments: "installment_payments",
    installment_payments: "installment_payments",
    accountEntries: "account_entries",
    account_entries: "account_entries",
    preparedBy: "prepared_by",
    prepared_by: "prepared_by",
    approvedBy: "approved_by",
    approved_by: "approved_by",
    paidBy: "paid_by",
    paid_by: "paid_by",
  }

  for (const [key, val] of Object.entries(body)) {
    if (validCols && validCols.has(key)) {
      normalized[key] = val
    } else if (aliases[key] && (!validCols || validCols.has(aliases[key]))) {
      normalized[aliases[key]] = val
    } else {
      const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      if (validCols && validCols.has(snake)) {
        normalized[snake] = val
      }
    }
  }

  if (body.id && !normalized.id) {
    normalized.id = body.id
  }

  return normalized
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
        }
      }

      const payloadString = JSON.stringify({ id, ...payloadData })
      await pool.query(
        `INSERT INTO \`${tableName}\` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))`,
        [id, payloadString]
      )
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
      const values = fields.map((k) => sanitizeSqlValue(normalizedBody[k]))
      const placeholders = fields.map(() => "?").join(", ")
      const colNames = fields.map((f) => `\`${f}\``).join(", ")

      await pool.query(
        `INSERT INTO \`${tableName}\` (${colNames}) VALUES (${placeholders})`,
        values
      )
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
  const isDoc = resource.storage === "jsonb_document" || resource.storage === "json_document"
  const cleanId = String(id).trim()

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
      const mergedPayload = { ...existingPayload, ...rawUpdate, id: targetId }
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

      await pool.query(`UPDATE \`${tableName}\` SET ${setClauses} WHERE id = ?`, values)
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
