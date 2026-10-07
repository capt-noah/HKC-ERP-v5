import { pool } from "./client.js"

const columnCache = new Map()

export async function getTableColumns(tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName)
  }
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``)
    const set = new Set(cols.map((c) => c.Field))
    columnCache.set(tableName, set)
    return set
  } catch (err) {
    console.warn(`[TABLE COLS INTROSPECTION WARNING] ${tableName}:`, err.message)
    return null
  }
}

export function parseJsonField(val) {
  if (typeof val === "string") {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}

export function sanitizeSqlValue(val) {
  if (val === undefined) return null
  if (val === null) return null
  if (typeof val === "boolean") return val ? 1 : 0
  if (typeof val === "number") return isNaN(val) ? 0 : val
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().slice(0, 19).replace("T", " ")
    }
    return null
  }
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (trimmed === "" || trimmed === "—" || trimmed === "N/A") return null
    // Detect ISO-8601 strings (e.g. 2026-09-14T21:09:53.085Z) and format as MySQL DATETIME/TIMESTAMP "YYYY-MM-DD HH:MM:SS"
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.test(trimmed)) {
      const d = new Date(trimmed)
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 19).replace("T", " ")
      }
    }
    return trimmed
  }
  if (typeof val === "object") {
    return JSON.stringify(val)
  }
  return val
}

export function normalizeBodyToDbColumns(body, validCols) {
  if (!body || typeof body !== "object") return body
  const normalized = {}

  const aliases = {
    targetMarkets: "target_markets",
    target_markets: "target_markets",
    warehouseType: "warehouse_type",
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
    batch: "batch_no",
    batchNo: "batch_no",
    batch_no: "batch_no",
    qty: "quantity",
    quantity: "quantity",
    remarks: "notes",
    reason: "notes",
    mfgDate: "mfg_date",
    manufacturingDate: "mfg_date",
    expiry: "expiry_date",
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
    recordDate: "record_date",
    record_date: "record_date",
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
    quantityPerPack: "quantity_per_pack",
    numberOfCartons: "number_of_cartons",
    shelfLifeMonths: "shelf_life_months",
    qaStatus: "qa_status",
    paymentType: "payment_type",
    paymentTerms: "payment_terms",
    amountPaid: "amount_paid",
    balanceDue: "balance_due",
    settlementStatus: "settlement_status",
    dueDate: "due_date",
    invoiceType: "invoice_type",
    partyType: "party_type",
    purchaseOrderId: "purchase_order_id",
    poNumber: "po_number",
    paidTo: "paid_to",
    reasonForPayment: "reason_for_payment",
    bankName: "bank_name",
    paymentMethod: "payment_method",
    chequeNo: "cheque_no",
    amountInWords: "amount_in_words",
    paymentAdviceAttachment: "payment_advice_attachment",
    installmentPayments: "installment_payments",
    accountEntries: "account_entries",
    preparedBy: "prepared_by",
    paidBy: "paid_by",
    subtotalAmount: "subtotal_amount",
    taxAmount: "tax_amount",
    vatAmount: "tax_amount",
    vatRate: "vat_rate",
    totalAmount: "total_amount",
    fsNo: "fs_no",
    issueNumber: "fs_no",
    customerName: "customer_name",
    paymentStatus: "payment_status",
    approvalStatus: "approval_status",
    documentReference: "document_reference",
    salesOrderId: "sales_order_id",
    orderNumber: "order_number",
    orderId: "order_id",
    saleDate: "sale_date",
    orderDate: "order_date",
    bankPermitNo: "bank_permit_no",
    commercialInvoiceNo: "commercial_invoice_no",
    packingListNo: "packing_list_no",
    billOfLadingNo: "bill_of_lading_no",
    customsDeclarationNo: "customs_declaration_no",
    certificateOfOriginNo: "certificate_of_origin_no",
    phytosanitaryCertificateNo: "phytosanitary_certificate_no",
    bankPermitAttachment: "bank_permit_attachment",
    contractReference: "contract_reference",
    serviceType: "service_type",
    cleaningLossQuantity: "cleaning_loss_quantity",
    processingFee: "processing_fee",
    storageFee: "storage_fee",
    otherCharges: "other_charges",
    advancePayment: "advance_payment",
    balancePayment: "balance_payment",
    entryNumber: "entry_number",
    entryDate: "entry_date",
    sourceType: "source_type",
    sourceId: "source_id",
    postingStatus: "posting_status",
    totalAmount: "total_amount",
    isReversalOf: "is_reversal_of",
    autoReverse: "auto_reverse",
    reversalDate: "reversal_date",
    reversedById: "reversed_by_id",
    journalEntryId: "journal_entry_id",
    accountId: "account_id",
    accountCode: "account_code",
    accountName: "account_name",
    debitAmount: "debit_amount",
    creditAmount: "credit_amount",
    exchangeRateAtTime: "exchange_rate_at_time",
    isCleared: "is_cleared",
    clearedDate: "cleared_date",
    accountType: "account_type",
    peachtreeType: "peachtree_type",
    parentAccountId: "parent_account_id",
    isGroup: "is_group",
    isActive: "is_active",
  }

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue
    let dbCol = aliases[key] || key
    if (validCols && !validCols.has(dbCol)) {
      // 1. Try automatic snake_case conversion for any camelCase property
      const snakeKey = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
      if (validCols.has(snakeKey)) {
        dbCol = snakeKey
      } else if (key === "notes" && validCols.has("reason")) {
        dbCol = "reason"
      } else if (key === "reason" && validCols.has("notes")) {
        dbCol = "notes"
      } else if (key === "notes" && validCols.has("disposal_notes")) {
        dbCol = "disposal_notes"
      } else if ((key === "customer" || key === "party" || key === "supplierName") && validCols.has("party_name")) {
        dbCol = "party_name"
      } else if ((key === "customer" || key === "party") && validCols.has("customer_name")) {
        dbCol = "customer_name"
      } else if (key === "date" && validCols.has("order_date")) {
        dbCol = "order_date"
      } else if (key === "date" && validCols.has("record_date")) {
        dbCol = "record_date"
      } else if (key === "date" && validCols.has("issue_date")) {
        dbCol = "issue_date"
      } else if (key === "desc" && validCols.has("description")) {
        dbCol = "description"
      } else if (key === "rate" && validCols.has("rate_percent")) {
        dbCol = "rate_percent"
      }
    }
    // If the explicit direct column was already provided in body, do not let an alias override it
    if (key !== dbCol && body[dbCol] !== undefined && normalized[dbCol] !== undefined) {
      continue
    }
    if (!validCols || validCols.has(dbCol)) {
      normalized[dbCol] = value
    } else {
      normalized[key] = value
    }
  }

  return normalized
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
    while (payload && typeof payload === "object" && payload.payload && typeof payload.payload === "object" && !Array.isArray(payload.payload)) {
      payload = { ...payload, ...payload.payload }
      delete payload.payload
    }
    const rowCopy = { ...row }
    delete rowCopy.payload
    const merged = { ...rowCopy, ...(payload || {}), id: row.id || payload?.id }
    for (const [k, v] of Object.entries(rowCopy)) {
      if (merged[k] === undefined || merged[k] === null || merged[k] === "") {
        if (v !== undefined && v !== null && v !== "") {
          merged[k] = v
        }
      }
    }
    if (row.created_at && !merged.created_at) merged.created_at = row.created_at
    if (row.updated_at && !merged.updated_at) merged.updated_at = row.updated_at
    return merged
  }

  const out = { ...row }

  for (const k of [
    "batches",
    "wh1_entries",
    "bin_card_entries",
    "items",
    "payload",
    "lines",
    "details",
    "attachments",
    "payment_advice_attachment",
    "installment_payments",
    "account_entries",
    "line_items",
    "gl_distribution",
    "multi_accounts",
  ]) {
    if (out[k] !== undefined) {
      out[k] = parseJsonField(out[k])
    }
  }

  // Normalization for inventory_products and warehouses
  if (out.warehouse_type !== undefined && out.warehouseType === undefined) out.warehouseType = out.warehouse_type
  if (out.warehouseType !== undefined && out.warehouse_type === undefined) out.warehouse_type = out.warehouseType
  if (out.target_markets !== undefined && out.targetMarkets === undefined) out.targetMarkets = out.target_markets
  if (out.targetMarkets !== undefined && out.target_markets === undefined) out.target_markets = out.targetMarkets
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
  if (out.unit_price !== undefined) {
    out.unitPrice = Number(out.unit_price)
    out.unit_price = Number(out.unit_price)
  }
  if (out.unitPrice !== undefined && out.unit_price === undefined) {
    out.unit_price = Number(out.unitPrice)
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

  // Normalization for parent pharma products (Batch, Mfg, Expiry)
  if (out.batch_no !== undefined) {
    if (out.batch === undefined) out.batch = out.batch_no
    if (out.batchNo === undefined) out.batchNo = out.batch_no
    if (out.batch_number === undefined) out.batch_number = out.batch_no
  }
  if (out.batch_number !== undefined && out.batch_no === undefined) {
    out.batch_no = out.batch_number
    if (out.batch === undefined) out.batch = out.batch_number
    if (out.batchNo === undefined) out.batchNo = out.batch_number
  }
  if (out.mfg_date !== undefined) {
    if (out.mfgDate === undefined) out.mfgDate = out.mfg_date
    if (out.manufacturingDate === undefined) out.manufacturingDate = out.mfg_date
  }
  if (out.expiry_date !== undefined) {
    if (out.expiry === undefined) out.expiry = out.expiry_date
    if (out.expiryDate === undefined) out.expiryDate = out.expiry_date
  }

  // Normalization for stock_movements & export_warehouse_movements
  if (out.product_id !== undefined && out.productId === undefined) out.productId = out.product_id
  if (out.party_name !== undefined) {
    if (out.party === undefined) out.party = out.party_name
    if (out.customer === undefined) out.customer = out.party_name
  }
  if (out.party !== undefined) {
    if (out.party_name === undefined) out.party_name = out.party
    if (out.customer === undefined) out.customer = out.party
  }
  if (out.plate_number !== undefined && out.plateNumber === undefined) out.plateNumber = out.plate_number
  if (out.plateNumber !== undefined && out.plate_number === undefined) out.plate_number = out.plateNumber
  if (out.voucher_no !== undefined && out.voucherNo === undefined) out.voucherNo = out.voucher_no
  if (out.voucherNo !== undefined && out.voucher_no === undefined) out.voucher_no = out.voucherNo

  if (out.movement_type !== undefined) {
    if (out.movementType === undefined) out.movementType = out.movement_type
  }
  if (out.movementType !== undefined && out.movement_type === undefined) {
    out.movement_type = out.movementType
  }

  const rawMType = String(out.movement_type || out.movementType || out.type || "").toUpperCase()
  const isReceipt = rawMType === "RECEIPT" || rawMType === "INBOUND" || rawMType === "ADJUSTMENT_IN" || rawMType === "ENTRY" || rawMType === "GRV_ENTRY"
  const isQuarantine = rawMType === "QUARANTINE"
  const isReject = rawMType === "REJECT_DEDUCTION" || rawMType === "REJECT"
  const isIssue = rawMType === "ISSUE" || rawMType === "OUTBOUND" || rawMType === "DISPATCH" || rawMType === "ADJUSTMENT_OUT" || rawMType === "LEAVE" || rawMType === "OUTBOUND_DISPATCH"

  const rawQty = Number(out.quantity ?? out.qty ?? out.gross_quantity ?? out.net_quantity ?? 0)
  if (out.qtyReceived === undefined) {
    out.qtyReceived = isReceipt ? rawQty : 0
  }
  if (out.qtyIssued === undefined) {
    out.qtyIssued = (isIssue || isQuarantine || isReject) ? Math.abs(rawQty) : 0
  }
  if (out.type === undefined || out.type === "RECEIPT" || out.type === "ISSUE" || out.type === "GRV_ENTRY" || out.type === "OUTBOUND_DISPATCH" || out.type === "REJECT_DEDUCTION") {
    out.type = isQuarantine ? "quarantine" : isReject ? "reject" : isReceipt ? "entry" : "leave"
  }

  if (out.movement_date !== undefined && out.date === undefined) out.date = out.movement_date
  if (out.movementDate !== undefined && out.date === undefined) out.date = out.movementDate
  if (out.selling_price !== undefined && out.selling_price !== null) {
    out.selling_price = Number(out.selling_price)
    if (out.sellingPrice === undefined) out.sellingPrice = Number(out.selling_price)
  }
  if (out.sellingPrice !== undefined && out.sellingPrice !== null && out.selling_price === undefined) {
    out.sellingPrice = Number(out.sellingPrice)
    out.selling_price = Number(out.sellingPrice)
  }
  if (out.warehouse_id !== undefined) {
    if (out.warehouseId === undefined) out.warehouseId = out.warehouse_id
    if (out.fromWarehouse === undefined) out.fromWarehouse = out.warehouse_id
    if (out.warehouse === undefined) out.warehouse = out.warehouse_id
  }
  if (out.batch_no !== undefined && out.batchNo === undefined) out.batchNo = out.batch_no
  if (out.expiry_date !== undefined && out.expiryDate === undefined) out.expiryDate = out.expiry_date
  if (out.mfg_date !== undefined && out.mfgDate === undefined) out.mfgDate = out.mfg_date
  if (out.mfgDate !== undefined && out.mfg_date === undefined) out.mfg_date = out.mfgDate
  if (out.quantity !== undefined) {
    out.quantity = Number(out.quantity)
    if (out.qty === undefined) out.qty = Number(out.quantity)
  }
  if (out.unit_price !== undefined) {
    out.unit_price = Number(out.unit_price)
    if (out.unitPrice === undefined) out.unitPrice = Number(out.unit_price)
  }
  if (out.unitPrice !== undefined && out.unit_price === undefined) {
    out.unitPrice = Number(out.unitPrice)
    out.unit_price = Number(out.unitPrice)
  }
  if (out.unit_cost !== undefined) {
    out.unit_cost = Number(out.unit_cost)
    if (out.unitCost === undefined) out.unitCost = Number(out.unit_cost)
    if (out.unitPrice === undefined && out.unit_price === undefined) out.unitPrice = Number(out.unit_cost)
  }
  if (out.notes !== undefined) {
    if (out.remarks === undefined) out.remarks = out.notes
    if (out.reason === undefined) out.reason = out.notes
  }
  if (out.reason !== undefined && out.notes === undefined) {
    out.notes = out.reason
    if (out.remarks === undefined) out.remarks = out.reason
  }
  if (out.party === undefined) {
    out.party = out.party_name || out.notes || (isReceipt ? "Stock Receipt" : isIssue ? "Stock Issue" : "Stock Movement")
  }
  if (out.balance_after !== undefined) {
    out.balanceAfter = Number(out.balance_after)
    out.balance_after = Number(out.balance_after)
    if (out.balance === undefined) out.balance = Number(out.balance_after)
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
  if (Array.isArray(out.accountEntries) && out.accountEntries.length > 0) {
    const firstDebit = out.accountEntries.find((e) => Number(e.debit) > 0)
    const firstCredit = out.accountEntries.find((e) => Number(e.credit) > 0)
    if (firstDebit) {
      if (!out.targetAccountId) out.targetAccountId = firstDebit.accountId || firstDebit.account_id
      if (!out.targetAccountCode) out.targetAccountCode = firstDebit.accountCode || firstDebit.account_code
      if (!out.targetAccountName) out.targetAccountName = firstDebit.accountName || firstDebit.account_name
    }
    if (firstCredit) {
      if (!out.creditAccountId) out.creditAccountId = firstCredit.accountId || firstCredit.account_id
      if (!out.creditAccountCode) out.creditAccountCode = firstCredit.accountCode || firstCredit.account_code
      if (!out.creditAccountName) out.creditAccountName = firstCredit.accountName || firstCredit.account_name
    }
  }
  if (out.prepared_by !== undefined && out.preparedBy === undefined) out.preparedBy = out.prepared_by
  if (out.approved_by !== undefined && out.approvedBy === undefined) out.approvedBy = out.approved_by
  if (out.paid_by !== undefined && out.paidBy === undefined) out.paidBy = out.paid_by

  // Normalization for sales_issues and invoices
  if (out.subtotal_amount !== undefined) {
    out.subtotal_amount = Number(out.subtotal_amount)
    if (out.subtotalAmount === undefined) out.subtotalAmount = out.subtotal_amount
    if (out.subtotal === undefined) out.subtotal = out.subtotal_amount
  }
  if (out.subtotal !== undefined && out.subtotal_amount === undefined) {
    out.subtotal = Number(out.subtotal)
    out.subtotal_amount = out.subtotal
    out.subtotalAmount = out.subtotal
  }
  if (out.tax_amount !== undefined) {
    out.tax_amount = Number(out.tax_amount)
    if (out.taxAmount === undefined) out.taxAmount = out.tax_amount
    if (out.vat_amount === undefined) out.vat_amount = out.tax_amount
    if (out.vatAmount === undefined) out.vatAmount = out.tax_amount
  }
  if (out.vat_amount !== undefined && out.tax_amount === undefined) {
    out.vat_amount = Number(out.vat_amount)
    out.tax_amount = out.vat_amount
    out.taxAmount = out.vat_amount
    out.vatAmount = out.vat_amount
  }
  if (out.vat_rate !== undefined) {
    out.vat_rate = Number(out.vat_rate)
    if (out.vatRate === undefined) out.vatRate = out.vat_rate
  }
  if (out.vatRate !== undefined && out.vat_rate === undefined) {
    out.vatRate = Number(out.vatRate)
    out.vat_rate = out.vatRate
  }
  if (out.total_amount !== undefined) {
    out.total_amount = Number(out.total_amount)
    if (out.totalAmount === undefined) out.totalAmount = out.total_amount
  }
  if (out.totalAmount !== undefined && out.total_amount === undefined) {
    out.totalAmount = Number(out.totalAmount)
    out.total_amount = out.totalAmount
  }
  if (out.fs_no !== undefined) {
    if (out.fsNo === undefined) out.fsNo = out.fs_no
    if (out.issue_number === undefined) out.issue_number = out.fs_no
    if (out.issueNumber === undefined) out.issueNumber = out.fs_no
  }
  if (out.reference_no !== undefined) {
    if (out.referenceNo === undefined) out.referenceNo = out.reference_no
    if (out.sales_order_id === undefined) out.sales_order_id = out.reference_no
    if (out.salesOrderId === undefined) out.salesOrderId = out.reference_no
  }
  if (out.sale_date !== undefined) {
    if (out.saleDate === undefined) out.saleDate = out.sale_date
    if (out.issue_date === undefined) out.issue_date = out.sale_date
    if (out.issueDate === undefined) out.issueDate = out.sale_date
  }
  if (out.customer_name !== undefined) {
    if (out.customerName === undefined) out.customerName = out.customer_name
    if (out.customer === undefined) out.customer = out.customer_name
  }
  if (out.customer_id !== undefined && out.customerId === undefined) {
    out.customerId = out.customer_id
  }
  if (out.account_entries !== undefined || out.accountEntries !== undefined) {
    let entries = out.account_entries !== undefined ? out.account_entries : out.accountEntries
    if (typeof entries === "string") {
      try { entries = JSON.parse(entries) } catch { entries = [] }
    }
    out.account_entries = entries
    out.accountEntries = entries
  }

  // Normalization for chart_of_accounts
  if (out.account_type !== undefined && out.accountType === undefined) out.accountType = out.account_type
  if (out.accountType !== undefined && out.account_type === undefined) out.account_type = out.accountType
  if (out.peachtree_type !== undefined && out.peachtreeType === undefined) out.peachtreeType = out.peachtree_type
  if (out.peachtreeType !== undefined && out.peachtree_type === undefined) out.peachtree_type = out.peachtreeType
  if (out.parent_account_id !== undefined && out.parentAccountId === undefined) out.parentAccountId = out.parent_account_id
  if (out.parentAccountId !== undefined && out.parent_account_id === undefined) out.parent_account_id = out.parentAccountId
  if (out.is_group !== undefined) {
    out.is_group = Boolean(out.is_group)
    out.isGroup = Boolean(out.is_group)
  }
  if (out.is_active !== undefined) {
    out.is_active = Boolean(out.is_active)
    out.isActive = Boolean(out.is_active)
  }

  // Normalization for gl_account_mappings
  if (out.account_id !== undefined && out.accountId === undefined) out.accountId = out.account_id
  if (out.accountId !== undefined && out.account_id === undefined) out.account_id = out.accountId
  if (out.account_code !== undefined && out.accountCode === undefined) out.accountCode = out.account_code
  if (out.accountCode !== undefined && out.account_code === undefined) out.account_code = out.accountCode
  if (out.account_name !== undefined && out.accountName === undefined) out.accountName = out.account_name
  if (out.accountName !== undefined && out.account_name === undefined) out.account_name = out.accountName
  if (out.normal_posting !== undefined && out.normalPosting === undefined) out.normalPosting = out.normal_posting
  if (out.normalPosting !== undefined && out.normal_posting === undefined) out.normal_posting = out.normalPosting
  if (out.is_system_default !== undefined) {
    out.is_system_default = Boolean(out.is_system_default)
    out.isSystemDefault = Boolean(out.is_system_default)
  }
  if (out.updated_by !== undefined && out.updatedBy === undefined) out.updatedBy = out.updated_by
  if (out.updatedBy !== undefined && out.updated_by === undefined) out.updated_by = out.updatedBy
  if (out.multi_accounts !== undefined && out.multiAccounts === undefined) out.multiAccounts = out.multi_accounts
  if (out.multiAccounts !== undefined && out.multi_accounts === undefined) out.multi_accounts = out.multiAccounts

  // Normalization for quarantine_records
  if (out.quarantine_date !== undefined && out.quarantineDate === undefined) out.quarantineDate = out.quarantine_date
  if (out.quarantineDate !== undefined && out.quarantine_date === undefined) out.quarantine_date = out.quarantineDate
  if (out.proposed_release_date !== undefined && out.proposedReleaseDate === undefined) out.proposedReleaseDate = out.proposed_release_date
  if (out.proposedReleaseDate !== undefined && out.proposed_release_date === undefined) out.proposed_release_date = out.proposedReleaseDate
  if (out.name_entered !== undefined && out.nameEntered === undefined) out.nameEntered = out.name_entered
  if (out.nameEntered !== undefined && out.name_entered === undefined) out.name_entered = out.nameEntered
  if (out.bin_card_entry_id !== undefined && out.binCardEntryId === undefined) out.binCardEntryId = out.bin_card_entry_id
  if (out.binCardEntryId !== undefined && out.bin_card_entry_id === undefined) out.bin_card_entry_id = out.binCardEntryId
  if (out.disposal_notes !== undefined && out.disposalNotes === undefined) out.disposalNotes = out.disposal_notes
  if (out.disposalNotes !== undefined && out.disposal_notes === undefined) out.disposal_notes = out.disposalNotes

  // Normalization for journal_entries
  if (out.entry_number !== undefined && out.entryNumber === undefined) out.entryNumber = out.entry_number
  if (out.entryNumber !== undefined && out.entry_number === undefined) out.entry_number = out.entryNumber
  if (out.entry_date !== undefined) {
    if (out.entry_date instanceof Date) {
      out.entry_date = out.entry_date.toISOString().slice(0, 10)
    }
    if (out.entryDate === undefined) out.entryDate = out.entry_date
  }
  if (out.source_type !== undefined && out.sourceType === undefined) out.sourceType = out.source_type
  if (out.source_id !== undefined && out.sourceId === undefined) out.sourceId = out.source_id
  if (out.posting_status !== undefined && out.postingStatus === undefined) out.postingStatus = out.posting_status
  if (out.total_amount !== undefined) {
    out.total_amount = Number(out.total_amount)
    if (out.totalAmount === undefined) out.totalAmount = Number(out.total_amount)
  }
  if (out.exchange_rate !== undefined) {
    out.exchange_rate = Number(out.exchange_rate)
    if (out.exchangeRate === undefined) out.exchangeRate = Number(out.exchange_rate)
  }

  // Normalization for journal_entry_lines
  if (out.journal_entry_id !== undefined && out.journalEntryId === undefined) out.journalEntryId = out.journal_entry_id
  if (out.account_id !== undefined && out.accountId === undefined) out.accountId = out.account_id
  if (out.account_code !== undefined && out.accountCode === undefined) out.accountCode = out.account_code
  if (out.account_name !== undefined && out.accountName === undefined) out.accountName = out.account_name
  if (out.debit_amount !== undefined) {
    out.debit_amount = Number(out.debit_amount)
    if (out.debitAmount === undefined) out.debitAmount = Number(out.debit_amount)
    if (out.debit === undefined) out.debit = Number(out.debit_amount)
  }
  if (out.credit_amount !== undefined) {
    out.credit_amount = Number(out.credit_amount)
    if (out.creditAmount === undefined) out.creditAmount = Number(out.credit_amount)
    if (out.credit === undefined) out.credit = Number(out.credit_amount)
  }
  if (out.exchange_rate_at_time !== undefined) {
    out.exchange_rate_at_time = Number(out.exchange_rate_at_time)
    if (out.exchangeRateAtTime === undefined) out.exchangeRateAtTime = Number(out.exchange_rate_at_time)
  }
  if (out.is_cleared !== undefined) {
    out.is_cleared = Boolean(out.is_cleared)
    out.isCleared = Boolean(out.is_cleared)
  }
  if (out.cleared_date !== undefined) {
    if (out.cleared_date instanceof Date) {
      out.cleared_date = out.cleared_date.toISOString().slice(0, 10)
    }
    if (out.clearedDate === undefined) out.clearedDate = out.cleared_date
  }

  // Normalization for customers
  if (out.contact_person !== undefined && out.contactPerson === undefined) out.contactPerson = out.contact_person
  if (out.trade_paper_url !== undefined && out.tradePaperUrl === undefined) out.tradePaperUrl = out.trade_paper_url
  if (out.trade_paper_file_name !== undefined && out.tradePaperFileName === undefined) out.tradePaperFileName = out.trade_paper_file_name
  if (out.trade_paper_uploaded_at !== undefined && out.tradePaperUploadedAt === undefined) out.tradePaperUploadedAt = out.trade_paper_uploaded_at
  if (out.default_tax_schedule_id !== undefined && out.defaultTaxScheduleId === undefined) out.defaultTaxScheduleId = out.default_tax_schedule_id
  if (out.warehouse_target !== undefined && out.warehouseTarget === undefined) out.warehouseTarget = out.warehouse_target
  if (out.credit_limit !== undefined) {
    out.credit_limit = Number(out.credit_limit)
    if (out.creditLimit === undefined) out.creditLimit = Number(out.credit_limit)
  }
  if (out.is_gov_agent !== undefined) {
    out.is_gov_agent = Boolean(out.is_gov_agent)
    if (out.isGovAgent === undefined) out.isGovAgent = Boolean(out.is_gov_agent)
  }

  // Normalization for suppliers
  if (out.tax_id !== undefined && out.taxId === undefined) out.taxId = out.tax_id

  // Normalization for sales_orders
  if (out.order_number !== undefined && out.orderNumber === undefined) out.orderNumber = out.order_number
  if (out.order_date !== undefined) {
    if (out.order_date instanceof Date) {
      out.order_date = out.order_date.toISOString().slice(0, 10)
    }
    if (out.orderDate === undefined) out.orderDate = out.order_date
    if (out.date === undefined) out.date = out.order_date
  }
  if (out.customer_phone !== undefined && out.customerPhone === undefined) out.customerPhone = out.customer_phone
  if (out.customer_group !== undefined && out.customerGroup === undefined) out.customerGroup = out.customer_group
  if (out.warehouse_name !== undefined && out.warehouseName === undefined) out.warehouseName = out.warehouse_name
  if (out.billed_amount !== undefined) {
    out.billed_amount = Number(out.billed_amount)
    if (out.billedAmount === undefined) out.billedAmount = Number(out.billed_amount)
  }
  if (out.delivered_amount !== undefined) {
    out.delivered_amount = Number(out.delivered_amount)
    if (out.deliveredAmount === undefined) out.deliveredAmount = Number(out.delivered_amount)
  }
  if (out.billing_status !== undefined && out.billingStatus === undefined) out.billingStatus = out.billing_status
  if (out.delivery_status !== undefined && out.deliveryStatus === undefined) out.deliveryStatus = out.delivery_status
  if (out.approval_status !== undefined && out.approvalStatus === undefined) out.approvalStatus = out.approval_status
  if (out.urgent !== undefined) {
    out.urgent = Boolean(out.urgent)
  }
  if (out.description !== undefined && out.desc === undefined) out.desc = out.description

  // Normalization for hkc_doc_records
  if (out.shipment_id !== undefined && out.shipmentId === undefined) out.shipmentId = out.shipment_id
  if (out.items_description !== undefined && out.itemsDescription === undefined) out.itemsDescription = out.items_description
  if (out.record_date !== undefined) {
    if (out.record_date instanceof Date) {
      out.record_date = out.record_date.toISOString().slice(0, 10)
    }
    if (out.recordDate === undefined) out.recordDate = out.record_date
    if (out.date === undefined) out.date = out.record_date
  }

  // Normalization for invoices
  if (out.invoice_number !== undefined && out.invoiceNumber === undefined) out.invoiceNumber = out.invoice_number
  if (out.line_items !== undefined) {
    if (out.lineItems === undefined) out.lineItems = out.line_items
    if (out.items === undefined) out.items = out.line_items
  }
  if (out.gl_distribution !== undefined && out.glDistribution === undefined) out.glDistribution = out.gl_distribution
  if (out.discount_amount !== undefined) {
    out.discount_amount = Number(out.discount_amount)
    if (out.discountAmount === undefined) out.discountAmount = Number(out.discount_amount)
  }
  if (out.tax_rate !== undefined) {
    out.tax_rate = Number(out.tax_rate)
    if (out.taxRate === undefined) out.taxRate = Number(out.tax_rate)
  }

  // Normalization for tax_rules
  if (out.rate_percent !== undefined) {
    out.rate_percent = Number(out.rate_percent)
    if (out.ratePercent === undefined) out.ratePercent = Number(out.rate_percent)
    if (out.rate === undefined) out.rate = Number(out.rate_percent)
  }
  if (out.applies_to !== undefined && out.appliesTo === undefined) out.appliesTo = out.applies_to
  if (out.gl_account_code !== undefined && out.glAccountCode === undefined) out.glAccountCode = out.gl_account_code
  if (out.is_deduction !== undefined) {
    out.is_deduction = Boolean(out.is_deduction)
    if (out.isDeduction === undefined) out.isDeduction = Boolean(out.is_deduction)
  }
  if (out.is_inclusive !== undefined) {
    out.is_inclusive = Boolean(out.is_inclusive)
    if (out.isInclusive === undefined) out.isInclusive = Boolean(out.is_inclusive)
  }

  // Normalization for employees and HR
  if (out.employee_number !== undefined && out.employeeNumber === undefined) out.employeeNumber = out.employee_number
  if (out.full_name !== undefined) {
    if (out.fullName === undefined) out.fullName = out.full_name
    if (out.name === undefined) out.name = out.full_name
  }
  if (out.employment_type !== undefined && out.employmentType === undefined) out.employmentType = out.employment_type
  if (out.basic_salary !== undefined) {
    out.basic_salary = Number(out.basic_salary)
    if (out.basicSalary === undefined) out.basicSalary = Number(out.basic_salary)
  }
  if (out.gross_pay !== undefined) {
    out.gross_pay = Number(out.gross_pay)
    if (out.grossPay === undefined) out.grossPay = Number(out.gross_pay)
  }
  if (out.net_pay !== undefined) {
    out.net_pay = Number(out.net_pay)
    if (out.netPay === undefined) out.netPay = Number(out.net_pay)
  }

  return out
}
