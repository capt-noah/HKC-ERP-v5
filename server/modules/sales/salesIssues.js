import { availableBatchesForProduct, calculateAmount, validateSalesIssueDraft } from "./salesIssueLogic.js"
import { getResource } from "../../db/resourceRegistry.js"
import {
  drizzleListRows,
  drizzleGetRow,
  drizzleCreateRow,
  drizzleUpdateRow,
  drizzleDeleteRow,
  drizzleReplaceRows,
} from "../../db/drizzleCrud.js"
import { pool } from "../../db/client.js"
import crypto from "node:crypto"
import { getLocalDateString } from "../../utils/dateUtils.js"
import { getDefaultWarehouseForType } from "../../utils/warehouseUtils.js"

// ── Service Logic ─────────────────────────────────────────────────────────────

function matchPaymentsForIssue(allPayments, issueId, fsNo, refNo) {
  if (!Array.isArray(allPayments) || allPayments.length === 0) return []
  const cleanId = String(issueId || "").trim()
  const cleanFs = String(fsNo || "").trim()
  const cleanRef = String(refNo || "").trim()

  return allPayments.filter((raw) => {
    const p = raw?.payload ? { ...raw.payload, ...raw } : raw
    const pIssueId = String(p.sales_issue_id || p.salesIssueId || "").trim()
    const pInvId = String(p.linked_invoice_id || p.linkedInvoiceId || "").trim()
    const pRef = String(p.reference || "").trim()
    const pOrderId = String(p.sales_order_id || p.salesOrderId || "").trim()

    // 1. Match on sales_issue_id
    if (cleanId && pIssueId && (pIssueId === cleanId || pIssueId.toLowerCase() === cleanId.toLowerCase())) return true
    if (cleanFs && pIssueId && (pIssueId === cleanFs || pIssueId.toLowerCase() === cleanFs.toLowerCase())) return true

    // 2. Match on linked_invoice_id (e.g. INV-SI-FS-2026-9560 or INV-SI-4122)
    if (cleanId && pInvId && (pInvId === cleanId || pInvId === `INV-SI-${cleanId}` || pInvId === `INV-${cleanId}` || pInvId.toLowerCase().includes(cleanId.toLowerCase()))) return true
    if (cleanFs && pInvId && (pInvId === `INV-SI-${cleanFs}` || pInvId === `INV-${cleanFs}` || pInvId.toLowerCase().includes(cleanFs.toLowerCase()))) return true

    // 3. Match on reference string if it contains cleanId or cleanFs
    if (cleanId && pRef && pRef.toLowerCase().includes(cleanId.toLowerCase())) return true
    if (cleanFs && pRef && pRef.toLowerCase().includes(cleanFs.toLowerCase())) return true

    // 4. Fallback for unlinked payments having order ID
    if (!pIssueId && (!pInvId || pInvId === "INV-GENERAL")) {
      if (cleanRef && pOrderId && (pOrderId === cleanRef || pOrderId.toLowerCase() === cleanRef.toLowerCase())) return true
    }

    return false
  })
}

async function getAllWarehouses() {
  const whRes = await drizzleListRows({ resource: getResource("warehouses") }).catch(() => ({ body: [] }))
  return Array.isArray(whRes?.body) ? whRes.body.map(w => w?.payload ? { ...w.payload, ...w } : w) : []
}

function isExportWarehouseType(warehouseIdOrObj, allWarehouses = []) {
  if (!warehouseIdOrObj) return false
  const targetId = typeof warehouseIdOrObj === "object" ? (warehouseIdOrObj.id || warehouseIdOrObj.warehouse_id || "") : String(warehouseIdOrObj)
  const cleanId = String(targetId).trim().toUpperCase()

  const matched = allWarehouses.find(w => 
    String(w.id || "").toUpperCase() === cleanId || 
    String(w.code || "").toUpperCase() === cleanId ||
    String(w.name || "").toUpperCase() === cleanId
  )

  if (matched) {
    const whType = String(matched.warehouse_type || matched.warehouseType || matched.type || "").toUpperCase()
    if (whType === "EXPORT_WH" || whType.includes("EXPORT") || whType.includes("AGRI") || whType.includes("COMMODITY")) {
      return true
    }
    if (whType === "PHARMA_WH" || whType.includes("PHARMA") || whType.includes("VET") || whType.includes("CENTRAL") || whType.includes("DEPOT")) {
      return false
    }
  }

  // Heuristic fallback
  return cleanId.includes("EXP") || cleanId.includes("AGRI") || cleanId.startsWith("WH1") || cleanId.includes("WH-01")
}

async function getAllProductsForSales() {
  const [expRes, pharmaRes] = await Promise.all([
    drizzleListRows({ resource: getResource("export_products") }).catch(() => ({ body: [] })),
    drizzleListRows({ resource: getResource("pharma_products") }).catch(() => ({ body: [] })),
  ])
  const exp = Array.isArray(expRes?.body) ? expRes.body : []
  const pharma = Array.isArray(pharmaRes?.body) ? pharmaRes.body : []
  return [...exp, ...pharma]
}

export async function listSalesIssues(query = {}) {
  try {
    const sanitizedQuery = {}
    if (query.id) sanitizedQuery.id = query.id
    if (query.status && query.status !== "ALL") sanitizedQuery.status = query.status

    const issuesRes = await drizzleListRows({
      resource: getResource("sales_issues"),
      query: sanitizedQuery,
    })

    const issues = Array.isArray(issuesRes.body) ? issuesRes.body : []
    const [itemsRes, customersRes, ordersRes, allProducts, paymentsRes, allWarehouses] = await Promise.all([
      drizzleListRows({ resource: getResource("sales_issue_items") }),
      drizzleListRows({ resource: getResource("customers") }).catch(() => ({ body: [] })),
      drizzleListRows({ resource: getResource("sales_orders") }).catch(() => ({ body: [] })),
      getAllProductsForSales(),
      drizzleListRows({ resource: getResource("payments") }).catch(() => ({ body: [] })),
      getAllWarehouses(),
    ])

    const allCustomers = Array.isArray(customersRes.body) ? customersRes.body : []
    const customerMap = new Map(allCustomers.map((c) => [c.id, c.payload ? { ...c.payload, ...c } : c]))

    const allOrders = Array.isArray(ordersRes.body) ? ordersRes.body : []
    const orderMap = new Map(allOrders.map((o) => [o.id, o.payload ? { ...o.payload, ...o } : o]))

    const productMap = new Map(allProducts.map((p) => [p.id, p.payload ? { ...p.payload, ...p } : p]))

    const allPayments = Array.isArray(paymentsRes.body) ? paymentsRes.body : []

    const allItems = Array.isArray(itemsRes.body) ? itemsRes.body : []
    const itemsByIssueId = new Map()

    for (const rawItem of allItems) {
      const item = rawItem?.payload ? { ...rawItem.payload, ...rawItem } : rawItem
      const issueId = item.sales_issue_id || item.salesIssueId || item.sales_order_id
      if (issueId) {
        const existing = itemsByIssueId.get(issueId) || []
        const matchedProd = productMap.get(item.product_id) || productMap.get(item.item_id)
        existing.push({
          id: item.id,
          sales_issue_id: issueId,
          item_id: item.item_id || item.product_id || item.id,
          product_id: item.product_id || item.item_id || item.id,
          item_name: item.item_name || item.product_name || matchedProd?.name || item.name || "Item",
          batch_id: item.batch_id || item.batch_no || item.batch_number || item.batch || "BATCH-MAIN",
          batch_no: item.batch_no || item.batch_id || item.batch_number || item.batch || "BATCH-MAIN",
          packaging_unit: item.packaging_unit || item.packagingUnit || item.unit || matchedProd?.unit || "Box",
          available_quantity: Number(item.available_quantity || item.availableQuantity || matchedProd?.quantity || 1000),
          quantity: Number(item.quantity || item.qty || 0),
          unit_price: Number(item.unit_price || item.unitPrice || item.price || 0),
          amount: Number(item.amount || item.total_price || item.totalPrice || (Number(item.quantity || 0) * Number(item.unit_price || 0))),
        })
        itemsByIssueId.set(issueId, existing)
      }
    }

    let fullIssues = issues.map((rawIssue) => {
      const issue = rawIssue?.payload ? { ...rawIssue.payload, ...rawIssue } : rawIssue
      const issueItems = itemsByIssueId.get(issue.id) || itemsByIssueId.get(issue.issue_number) || itemsByIssueId.get(issue.fs_no) || issue.items || []
      const fs_no = issue.fs_no || issue.fsNo || issue.issue_number || issue.issueNumber || String(issue.id)
      const primaryId = fs_no || String(issue.id)
      const reference_no = issue.reference_no || issue.referenceNo || issue.sales_order_id || issue.salesOrderId || ""
      let rawDate = issue.sale_date || issue.issueDate || issue.issue_date || issue.created_at || new Date()
      let sale_date = typeof rawDate === "string" 
        ? (rawDate.includes("T") ? rawDate.split("T")[0] : rawDate)
        : getLocalDateString(rawDate)

      const matchedCust = customerMap.get(issue.customer_id)
      const matchedOrder = orderMap.get(issue.sales_order_id) || orderMap.get(reference_no)
      const firstItem = issueItems[0]
      const matchedProd = firstItem ? (productMap.get(firstItem.product_id) || productMap.get(firstItem.item_id)) : null

      const customer_name = issue.customer_name || matchedCust?.name || matchedOrder?.customer || issue.customer || issue.customerName || issue.customer_id || "Customer"
      const customer_id = issue.customer_id || matchedCust?.id || matchedOrder?.customerId || customer_name
      const defaultExpWh = allWarehouses.find(w => isExportWarehouseType(w, allWarehouses))?.id || allWarehouses[0]?.id || "WH1"
      const warehouse_id = issue.warehouse_id || matchedOrder?.warehouse || matchedProd?.warehouse || issue.warehouseId || issue.warehouse || defaultExpWh
      const isExport = isExportWarehouseType(warehouse_id, allWarehouses)

      const payment_type = issue.payment_type || issue.paymentType || issue.payment_method || issue.paymentMethod || "Cash"
      const status = issue.status || "Draft"

      const subtotal = Number(issue.subtotal_amount || issue.subtotal || issueItems.reduce((s, i) => s + (i.amount || 0), 0) || 0)
      const vat_amount = Number(issue.tax_amount || issue.vat_amount || 0)
      const vat_rate = Number(issue.vat_rate !== undefined ? issue.vat_rate : (vat_amount > 0 && subtotal > 0 ? Math.round((vat_amount / subtotal) * 100) : (isExport ? 0 : 15)))
      const total_amount = Number(issue.total_amount || issue.totalAmount || (subtotal + vat_amount) || 0)
      const total_quantity = Number(issue.total_quantity || issue.totalQuantity || issueItems.reduce((s, i) => s + (i.quantity || 0), 0) || 0)

      // Aggregate payments recorded for this sales issue
      const matchedPayments = matchPaymentsForIssue(allPayments, primaryId, fs_no, reference_no)
      const paidFromPayments = matchedPayments.reduce((sum, p) => {
        const pObj = p?.payload ? { ...p.payload, ...p } : p
        return sum + Number(pObj.amount || 0)
      }, 0)

      const isCredit = (payment_type || "").toLowerCase().includes("credit")
      const isCash = !isCredit

      const amount_paid = isCash
        ? total_amount
        : Math.max(paidFromPayments, Number(issue.amount_paid || issue.amountPaid || 0))

      const balance_due = isCash
        ? 0
        : Number(Math.max(0, total_amount - amount_paid).toFixed(2))

      const settlement_status = isCash || (total_amount > 0 && balance_due <= 0.01 && amount_paid > 0)
        ? "Fully Settled"
        : (amount_paid > 0 ? "Ongoing" : "Unpaid")

      const payment_status = settlement_status === "Fully Settled"
        ? "Paid"
        : (amount_paid > 0 ? "Ongoing" : (issue.payment_status || "Unpaid"))

      return {
        ...issue,
        id: primaryId,
        fs_no,
        fsNo: fs_no,
        issue_number: fs_no,
        issueNumber: fs_no,
        reference_no,
        referenceNo: reference_no,
        sales_order_id: reference_no,
        salesOrderId: reference_no,
        sale_date,
        issue_date: sale_date,
        issueDate: sale_date,
        customer_name,
        customer: customer_name,
        customer_id,
        customerId: customer_id,
        warehouse_id,
        warehouseId: warehouse_id,
        warehouse: warehouse_id,
        payment_type,
        paymentType: payment_type,
        status,
        subtotal,
        subtotal_amount: subtotal,
        vat_rate,
        vat_amount,
        tax_amount: vat_amount,
        total_amount,
        totalAmount: total_amount,
        total_quantity,
        totalQuantity: total_quantity,
        amount_paid,
        amountPaid: amount_paid,
        balance_due,
        balanceDue: balance_due,
        settlement_status,
        settlementStatus: settlement_status,
        payment_status,
        paymentStatus: payment_status,
        created_by: issue.created_by || issue.createdBy || "System",
        items: issueItems,
        savedToDb: true,
      }
    })

    if (query.search && String(query.search).trim()) {
      const q = String(query.search).trim().toLowerCase()
      fullIssues = fullIssues.filter((i) =>
        (i.fs_no && i.fs_no.toLowerCase().includes(q)) ||
        (i.reference_no && i.reference_no.toLowerCase().includes(q)) ||
        (i.customer_name && i.customer_name.toLowerCase().includes(q)) ||
        (i.items && i.items.some((it) => it.item_name && it.item_name.toLowerCase().includes(q)))
      )
    }

    if (query.batch && query.batch !== "ALL") {
      const b = String(query.batch).trim().toLowerCase()
      fullIssues = fullIssues.filter((i) =>
        i.items && i.items.some((it) => it.batch_no && it.batch_no.toLowerCase() === b)
      )
    }

    return {
      status: 200,
      body: {
        rows: fullIssues,
        total: fullIssues.length,
        page: 1,
        pageSize: fullIssues.length,
      },
    }
  } catch (err) {
    console.error("[listSalesIssues exception]:", err)
    return { status: 500, body: { error: "Failed to list sales issues", message: err.message } }
  }
}

export async function getSalesIssue(id) {
  try {
    const cleanId = String(id).trim()
    let issueRes = await drizzleGetRow({
      resource: getResource("sales_issues"),
      id: cleanId,
    })

    if (issueRes.status >= 400 || !issueRes.body) {
      // Robust Fallback: Search all rows by id, fs_no, issue_number, reference_no, or sales_order_id
      const listRes = await drizzleListRows({
        resource: getResource("sales_issues"),
      })
      const all = Array.isArray(listRes.body) ? listRes.body : []
      const found = all.find((r) => {
        const item = r?.payload ? { ...r.payload, ...r } : r
        return (
          String(item.id) === cleanId ||
          String(item.fs_no || "").toLowerCase() === cleanId.toLowerCase() ||
          String(item.fsNo || "").toLowerCase() === cleanId.toLowerCase() ||
          String(item.issue_number || "").toLowerCase() === cleanId.toLowerCase() ||
          String(item.issueNumber || "").toLowerCase() === cleanId.toLowerCase() ||
          String(item.reference_no || "").toLowerCase() === cleanId.toLowerCase() ||
          String(item.referenceNo || "").toLowerCase() === cleanId.toLowerCase() ||
          String(item.sales_order_id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(item.salesOrderId || "").toLowerCase() === cleanId.toLowerCase()
        )
      })

      if (found) {
        issueRes = { status: 200, body: found }
      } else {
        return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
      }
    }

    const rawIssue = issueRes.body
    const [itemsRes, customersRes, ordersRes, allProducts, paymentsRes, allWarehouses] = await Promise.all([
      drizzleListRows({ resource: getResource("sales_issue_items") }),
      drizzleListRows({ resource: getResource("customers") }).catch(() => ({ body: [] })),
      drizzleListRows({ resource: getResource("sales_orders") }).catch(() => ({ body: [] })),
      getAllProductsForSales(),
      drizzleListRows({ resource: getResource("payments") }).catch(() => ({ body: [] })),
      getAllWarehouses(),
    ])

    const allCustomers = Array.isArray(customersRes.body) ? customersRes.body : []
    const customerMap = new Map(allCustomers.map((c) => [c.id, c.payload ? { ...c.payload, ...c } : c]))

    const allOrders = Array.isArray(ordersRes.body) ? ordersRes.body : []
    const orderMap = new Map(allOrders.map((o) => [o.id, o.payload ? { ...o.payload, ...o } : o]))

    const productMap = new Map(allProducts.map((p) => [p.id, p.payload ? { ...p.payload, ...p } : p]))

    const allPayments = Array.isArray(paymentsRes.body) ? paymentsRes.body : []

    const issue = rawIssue?.payload ? { ...rawIssue.payload, ...rawIssue } : rawIssue
    const fs_no = issue.fs_no || issue.fsNo || issue.issue_number || issue.issueNumber || String(issue.id)
    const primaryId = fs_no || String(issue.id)

    const reference_no = issue.reference_no || issue.referenceNo || issue.sales_order_id || issue.salesOrderId || ""
    const matchedCust = customerMap.get(issue.customer_id)
    const matchedOrder = orderMap.get(issue.sales_order_id) || orderMap.get(reference_no)

    const allItems = Array.isArray(itemsRes.body) ? itemsRes.body : []
    let matchedRawItems = allItems.filter((i) => {
      const item = i?.payload ? { ...i.payload, ...i } : i
      const parentId = item.sales_issue_id || item.salesIssueId || item.sales_order_id
      return (
        parentId === id ||
        parentId === cleanId ||
        parentId === issue.id ||
        parentId === issue.fs_no ||
        parentId === issue.fsNo ||
        parentId === issue.issue_number ||
        parentId === issue.issueNumber ||
        (issue.reference_no && parentId === issue.reference_no) ||
        (issue.sales_order_id && parentId === issue.sales_order_id)
      )
    })

    if (matchedRawItems.length === 0 && Array.isArray(issue.items) && issue.items.length > 0) {
      matchedRawItems = issue.items
    }

    const items = matchedRawItems.map((rawItem) => {
      const item = rawItem?.payload ? { ...rawItem.payload, ...rawItem } : rawItem
      const prodId = item.item_id || item.product_id || item.productId || item.id
      const matchedProd = productMap.get(prodId) || productMap.get(item.product_id) || productMap.get(item.item_id)
      
      let uPrice = Number(item.unit_price || item.unitPrice || item.price || 0)
      if (uPrice <= 0 && matchedOrder && Array.isArray(matchedOrder.items)) {
        const soItem = matchedOrder.items.find((si) => (si.productId === prodId || si.product_id === prodId || si.item_id === prodId || si.id === prodId))
        if (soItem && Number(soItem.unitPrice || soItem.unit_price || 0) > 0) {
          uPrice = Number(soItem.unitPrice || soItem.unit_price)
        }
      }
      if (uPrice <= 0 && matchedProd) {
        uPrice = Number(matchedProd.selling_price || matchedProd.sellingPrice || 0)
      }

      const q = Number(item.quantity || item.qty || 0)
      return {
        id: item.id,
        sales_issue_id: primaryId,
        item_id: prodId,
        product_id: prodId,
        item_name: item.item_name || item.product_name || matchedProd?.name || item.name || "Item",
        batch_id: item.batch_id || item.batch_no || item.batch_number || item.batch || "BATCH-MAIN",
        batch_no: item.batch_no || item.batch_id || item.batch_number || item.batch || "BATCH-MAIN",
        packaging_unit: item.packaging_unit || item.packagingUnit || item.unit || matchedProd?.unit || "Box",
        available_quantity: Number(item.available_quantity || item.availableQuantity || matchedProd?.quantity || 1000),
        quantity: q,
        unit_price: uPrice,
        unitPrice: uPrice,
        amount: Number(item.amount || item.total_price || item.totalPrice || (q * uPrice)),
      }
    })
    let rawDate = issue.sale_date || issue.issueDate || issue.issue_date || issue.created_at || new Date()
    let sale_date = typeof rawDate === "string" 
      ? (rawDate.includes("T") ? rawDate.split("T")[0] : rawDate)
      : getLocalDateString(rawDate)

    const firstItem = items[0]
    const matchedProd = firstItem ? (productMap.get(firstItem.product_id) || productMap.get(firstItem.item_id)) : null

    const customer_name = issue.customer_name || matchedCust?.name || matchedOrder?.customer || issue.customer || issue.customerName || issue.customer_id || "Customer"
    const customer_id = issue.customer_id || matchedCust?.id || matchedOrder?.customerId || customer_name
    const defaultExpWh = allWarehouses.find(w => isExportWarehouseType(w, allWarehouses))?.id || allWarehouses[0]?.id || "WH1"
    const warehouse_id = issue.warehouse_id || matchedOrder?.warehouse || matchedProd?.warehouse || issue.warehouseId || issue.warehouse || defaultExpWh
    const isExport = isExportWarehouseType(warehouse_id, allWarehouses)

    const payment_type = issue.payment_type || issue.paymentType || issue.payment_method || issue.paymentMethod || "Cash"
    const status = issue.status || "Draft"

    const subtotal = Number(issue.subtotal_amount || issue.subtotal || items.reduce((s, i) => s + (i.amount || 0), 0) || 0)
    const vat_amount = Number(issue.tax_amount || issue.vat_amount || 0)
    const vat_rate = Number(issue.vat_rate !== undefined ? issue.vat_rate : (vat_amount > 0 && subtotal > 0 ? Math.round((vat_amount / subtotal) * 100) : (isExport ? 0 : 15)))
    const total_amount = Number(issue.total_amount || issue.totalAmount || (subtotal + vat_amount) || 0)
    const total_quantity = Number(issue.total_quantity || issue.totalQuantity || items.reduce((s, i) => s + (i.quantity || 0), 0) || 0)

    // Aggregate payments recorded for this sales issue
    const matchedPayments = matchPaymentsForIssue(allPayments, primaryId, fs_no, reference_no)
    const paidFromPayments = matchedPayments.reduce((sum, p) => {
      const pObj = p?.payload ? { ...p.payload, ...p } : p
      return sum + Number(pObj.amount || 0)
    }, 0)

    const isCredit = (payment_type || "").toLowerCase().includes("credit")
    const isCash = !isCredit

    const amount_paid = isCash
      ? total_amount
      : Math.max(paidFromPayments, Number(issue.amount_paid || issue.amountPaid || 0))

    const balance_due = isCash
      ? 0
      : Number(Math.max(0, total_amount - amount_paid).toFixed(2))

    const settlement_status = isCash || (total_amount > 0 && balance_due <= 0.01 && amount_paid > 0)
      ? "Fully Settled"
      : (amount_paid > 0 ? "Ongoing" : "Unpaid")

    const payment_status = settlement_status === "Fully Settled"
      ? "Paid"
      : (amount_paid > 0 ? "Ongoing" : (issue.payment_status || "Unpaid"))

    return {
      status: 200,
      body: {
        ...issue,
        id: primaryId,
        fs_no,
        fsNo: fs_no,
        issue_number: fs_no,
        issueNumber: fs_no,
        reference_no,
        referenceNo: reference_no,
        sales_order_id: reference_no,
        salesOrderId: reference_no,
        sale_date,
        issue_date: sale_date,
        issueDate: sale_date,
        customer_name,
        customer: customer_name,
        customer_id,
        customerId: customer_id,
        warehouse_id,
        warehouseId: warehouse_id,
        warehouse: warehouse_id,
        payment_type,
        paymentType: payment_type,
        status,
        subtotal,
        subtotal_amount: subtotal,
        vat_rate,
        vat_amount,
        tax_amount: vat_amount,
        total_amount,
        totalAmount: total_amount,
        total_quantity,
        totalQuantity: total_quantity,
        amount_paid,
        amountPaid: amount_paid,
        balance_due,
        balanceDue: balance_due,
        settlement_status,
        settlementStatus: settlement_status,
        payment_status,
        paymentStatus: payment_status,
        created_by: issue.created_by || issue.createdBy || "System",
        items,
        savedToDb: true,
      },
    }
  } catch (err) {
    console.warn("[sales_issues get exception]:", err?.message || err)
    return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
  }
}

export async function createSalesIssue(input, existingId = null) {
  const allWarehouses = await getAllWarehouses()
  const fs_no = input?.fs_no || input?.fsNo || input?.issue_number || input?.issueNumber || `FS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  const id = existingId || input?.id || fs_no
  const reference_no = input?.reference_no || input?.referenceNo || `REF-${fs_no}`
  const sale_date = input?.sale_date || input?.issueDate || getLocalDateString()
  const customer_name = input?.customer_name || input?.customer || input?.customer_id || "Walk-in Customer"
  const customer_id = input?.customer_id || input?.customerId || customer_name
  const warehouse_id = input?.warehouse_id || input?.warehouse || allWarehouses[0]?.id || "WH-MAIN"
  const payment_type = input?.payment_type || input?.paymentType || "Cash"
  const isExport = isExportWarehouseType(warehouse_id, allWarehouses)
  const rawItems = Array.isArray(input?.items) ? input.items : []
  const items = rawItems.map((it) => {
    if (!it.batch_id && !it.batch_no) {
      const fallbackBatch = isExport ? "COMMODITY-MAIN" : "BATCH-MAIN"
      return { ...it, batch_id: fallbackBatch, batch_no: fallbackBatch }
    }
    return it
  })

  const total_quantity = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0)
  const itemTotal = items.reduce((sum, item) => sum + Number(item.amount || (item.quantity * item.unit_price) || 0), 0)

  const subtotal = input?.subtotal !== undefined ? Number(input.subtotal) : itemTotal
  const vat_rate = input?.vat_rate !== undefined ? Number(input.vat_rate) : (isExport ? 0 : 15)
  const vat_amount = input?.vat_amount !== undefined ? Number(input.vat_amount) : (vat_rate > 0 ? Math.round(subtotal * (vat_rate / 100)) : 0)
  const finalTotalAmount = input?.total_amount !== undefined ? Number(input.total_amount) : (subtotal + vat_amount)

  const doc = {
    ...input,
    id,
    fs_no,
    fsNo: fs_no,
    reference_no,
    referenceNo: reference_no,
    sale_date,
    issueDate: sale_date,
    customer_id,
    customer_name,
    customer: customer_name,
    warehouse_id,
    warehouse: warehouse_id,
    payment_type,
    paymentType: payment_type,
    status: (input?.status || "Draft").toString().charAt(0).toUpperCase() + (input?.status || "Draft").toString().slice(1).toLowerCase(),
    items,
    total_quantity,
    subtotal,
    vat_rate,
    vat_amount,
    total_amount: finalTotalAmount,
    totalAmount: finalTotalAmount,
    createdAt: input?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const errors = validateSalesIssueDraft(doc, items)
  if (errors.length > 0) {
    return { status: 400, body: { error: "Validation failed", details: errors } }
  }

  // Enforce business rule: Referenced Sales Order must be Approved by Superadmin before issuing stock
  const linkedSoId = String(input?.sales_order_id || input?.salesOrderId || input?.reference_no || input?.referenceNo || input?.order_id || "").trim()
  if (linkedSoId && !linkedSoId.startsWith("REF-FS-") && linkedSoId !== "Walk-in") {
    try {
      const soRes = await drizzleGetRow({ resource: getResource("sales_orders"), id: linkedSoId }).catch(() => null)
      const soData = soRes?.body?.payload ? { ...soRes.body.payload, ...soRes.body } : soRes?.body
      if (soData && soData.id) {
        const approval = String(soData.approvalStatus || soData.approval_status || "Pending")
        if (approval !== "Approved") {
          return {
            status: 400,
            body: {
              error: `Sales Order '${linkedSoId}' has approval status '${approval}'. It must be approved by a Superadmin before a Sales Issue can be created.`
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not check sales order approval status:", e)
    }
  }

  // 1. Save Header
  const headerRow = {
    id,
    fs_no: fs_no,
    fsNo: fs_no,
    issue_number: fs_no,
    issueNumber: fs_no,
    reference_no: reference_no || null,
    referenceNo: reference_no || null,
    sales_order_id: reference_no || null,
    salesOrderId: reference_no || null,
    customer_id: customer_id || null,
    customerId: customer_id || null,
    customer_name: customer_name || null,
    customer: customer_name || null,
    warehouse_id: warehouse_id || null,
    warehouseId: warehouse_id || null,
    warehouse: warehouse_id || null,
    sale_date: sale_date,
    issue_date: sale_date,
    issueDate: sale_date,
    status: doc.status || "Draft",
    total_quantity: total_quantity,
    totalQuantity: total_quantity,
    subtotal: subtotal,
    subtotal_amount: subtotal,
    subtotalAmount: subtotal,
    vat_rate: vat_rate,
    vatRate: vat_rate,
    vat_amount: vat_amount,
    vatAmount: vat_amount,
    tax_amount: vat_amount,
    taxAmount: vat_amount,
    total_amount: finalTotalAmount,
    totalAmount: finalTotalAmount,
    payment_type: payment_type,
    paymentType: payment_type,
    payment_status: payment_type === "Cash" ? "Paid" : "Unpaid",
    paymentStatus: payment_type === "Cash" ? "Paid" : "Unpaid",
    payment_method: payment_type,
    paymentMethod: payment_type,
    created_by: doc.created_by || "Sales Officer",
    createdBy: doc.created_by || "Sales Officer",
  }

  await drizzleCreateRow({
    resource: getResource("sales_issues"),
    body: headerRow,
  })

  // 2. Save Items
  if (items.length > 0) {
    const itemRows = items.map((item, idx) => {
      const prodId = String(item.item_id || item.productId || item.product_id || `ITEM-${idx + 1}`)
      const prodName = String(item.item_name || item.product_name || item.name || "Item")
      const batchCode = String(item.batch_no || item.batch_number || item.batch || "BATCH-MAIN")
      const batchId = String(item.batch_id || batchCode)
      const packUnit = String(item.packaging_unit || item.unit || "Box")
      const q = Number(item.quantity || item.qty || 0)
      const p = Number(item.unit_price || item.unitPrice || item.price || 0)
      const tot = Number(item.amount || item.total_price || (q * p) || 0)

      return {
        id: String(item.id || `${id}-ITEM-${idx + 1}`),
        sales_issue_id: id,
        salesIssueId: id,
        item_id: prodId,
        itemId: prodId,
        product_id: prodId,
        productId: prodId,
        product_name: prodName,
        productName: prodName,
        item_name: prodName,
        itemName: prodName,
        batch_id: batchId,
        batchId: batchId,
        batch_number: batchCode,
        batchNumber: batchCode,
        batch_no: batchCode,
        batchNo: batchCode,
        quantity: q,
        qty: q,
        unit_price: p,
        unitPrice: p,
        total_price: tot,
        totalPrice: tot,
        amount: tot,
        unit: packUnit,
        packaging_unit: packUnit,
        packagingUnit: packUnit,
      }
    })

    for (const itemRow of itemRows) {
      await drizzleCreateRow({
        resource: getResource("sales_issue_items"),
        body: itemRow,
      })
    }
  }

  return { status: 200, body: { ...doc, savedToDb: true } }
}

export async function updateSalesIssue(input, id) {
  const allWarehouses = await getAllWarehouses()
  const cleanId = String(id).trim()
  const getRes = await getSalesIssue(cleanId)
  if (getRes.status >= 400 || !getRes.body) {
    return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
  }

  const existing = getRes.body
  const items = Array.isArray(input?.items) ? input.items : existing.items || []
  const total_quantity = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0)
  const itemTotal = items.reduce((sum, item) => sum + Number(item.amount || (item.quantity * item.unit_price) || 0), 0)

  const warehouse_id = input?.warehouse_id || existing.warehouse_id
  const isExport = isExportWarehouseType(warehouse_id, allWarehouses)
  const subtotal = input?.subtotal !== undefined ? Number(input.subtotal) : itemTotal
  const vat_rate = input?.vat_rate !== undefined ? Number(input.vat_rate) : (isExport ? 0 : 15)
  const vat_amount = input?.vat_amount !== undefined ? Number(input.vat_amount) : (vat_rate > 0 ? Math.round(subtotal * (vat_rate / 100)) : 0)
  const finalTotalAmount = input?.total_amount !== undefined ? Number(input.total_amount) : (subtotal + vat_amount)

  const updateHeader = {
    fs_no: input?.fs_no || existing.fs_no || cleanId,
    fsNo: input?.fs_no || existing.fs_no || cleanId,
    issue_number: input?.fs_no || existing.fs_no || cleanId,
    issueNumber: input?.fs_no || existing.fs_no || cleanId,
    reference_no: (input?.reference_no || existing.reference_no) || null,
    referenceNo: (input?.reference_no || existing.reference_no) || null,
    sales_order_id: (input?.reference_no || existing.reference_no) || null,
    salesOrderId: (input?.reference_no || existing.reference_no) || null,
    customer_id: (input?.customer_id || existing.customer_id) || null,
    customerId: (input?.customer_id || existing.customer_id) || null,
    customer_name: (input?.customer_name || existing.customer_name) || null,
    customer: (input?.customer_name || existing.customer_name) || null,
    warehouse_id: warehouse_id || null,
    warehouseId: warehouse_id || null,
    warehouse: warehouse_id || null,
    sale_date: input?.sale_date || existing.sale_date || getLocalDateString(),
    issue_date: input?.sale_date || existing.sale_date || getLocalDateString(),
    issueDate: input?.sale_date || existing.sale_date || getLocalDateString(),
    status: input?.status || existing.status || "Draft",
    total_quantity: total_quantity,
    totalQuantity: total_quantity,
    subtotal: subtotal,
    subtotal_amount: subtotal,
    subtotalAmount: subtotal,
    vat_rate: vat_rate,
    vatRate: vat_rate,
    vat_amount: vat_amount,
    vatAmount: vat_amount,
    tax_amount: vat_amount,
    taxAmount: vat_amount,
    total_amount: finalTotalAmount,
    totalAmount: finalTotalAmount,
    amount_paid: input?.amount_paid !== undefined ? Number(input.amount_paid) : (existing.amount_paid !== undefined ? Number(existing.amount_paid) : ((input?.payment_type || existing.payment_type) === "Cash" ? finalTotalAmount : 0)),
    amountPaid: input?.amount_paid !== undefined ? Number(input.amount_paid) : (existing.amount_paid !== undefined ? Number(existing.amount_paid) : ((input?.payment_type || existing.payment_type) === "Cash" ? finalTotalAmount : 0)),
    balance_due: input?.balance_due !== undefined ? Number(input.balance_due) : (existing.balance_due !== undefined ? Number(existing.balance_due) : ((input?.payment_type || existing.payment_type) === "Cash" ? 0 : finalTotalAmount)),
    balanceDue: input?.balance_due !== undefined ? Number(input.balance_due) : (existing.balance_due !== undefined ? Number(existing.balance_due) : ((input?.payment_type || existing.payment_type) === "Cash" ? 0 : finalTotalAmount)),
    settlement_status: input?.settlement_status || existing.settlement_status || ((input?.payment_type || existing.payment_type) === "Cash" ? "Fully Settled" : "Unpaid"),
    settlementStatus: input?.settlement_status || existing.settlement_status || ((input?.payment_type || existing.payment_type) === "Cash" ? "Fully Settled" : "Unpaid"),
    payment_type: input?.payment_type || existing.payment_type || "Cash",
    paymentType: input?.payment_type || existing.payment_type || "Cash",
    payment_status: input?.payment_status || (input?.settlement_status === "Fully Settled" || (input?.payment_type || existing.payment_type) === "Cash" ? "Paid" : (existing.payment_status || "Unpaid")),
    paymentStatus: input?.payment_status || (input?.settlement_status === "Fully Settled" || (input?.payment_type || existing.payment_type) === "Cash" ? "Paid" : (existing.payment_status || "Unpaid")),
    payment_method: input?.payment_type || existing.payment_type || "Cash",
    paymentMethod: input?.payment_type || existing.payment_type || "Cash",
  }

  await drizzleUpdateRow({
    resource: getResource("sales_issues"),
    id: cleanId,
    body: updateHeader,
  })

  // Delete existing items and re-insert
  try {
    const existingItems = existing.items || []
    for (const item of existingItems) {
      if (item.id) {
        await drizzleDeleteRow({ resource: getResource("sales_issue_items"), id: item.id })
      }
    }
    for (const [idx, item] of items.entries()) {
      const prodId = String(item.item_id || item.productId || item.product_id || `ITEM-${idx + 1}`)
      const prodName = String(item.item_name || item.product_name || item.name || "Item")
      const batchCode = String(item.batch_no || item.batch_number || item.batch || "BATCH-MAIN")
      const batchId = String(item.batch_id || batchCode)
      const packUnit = String(item.packaging_unit || item.unit || "Box")
      const q = Number(item.quantity || item.qty || 0)
      const p = Number(item.unit_price || item.unitPrice || item.price || 0)
      const tot = Number(item.amount || item.total_price || (q * p) || 0)

      const itemRow = {
        id: String(item.id || `${cleanId}-ITEM-${idx + 1}`),
        sales_issue_id: cleanId,
        salesIssueId: cleanId,
        item_id: prodId,
        itemId: prodId,
        product_id: prodId,
        productId: prodId,
        product_name: prodName,
        productName: prodName,
        item_name: prodName,
        itemName: prodName,
        batch_id: batchId,
        batchId: batchId,
        batch_number: batchCode,
        batchNumber: batchCode,
        batch_no: batchCode,
        batchNo: batchCode,
        quantity: q,
        qty: q,
        unit_price: p,
        unitPrice: p,
        total_price: tot,
        totalPrice: tot,
        amount: tot,
        unit: packUnit,
        packaging_unit: packUnit,
        packagingUnit: packUnit,
      }
      await drizzleCreateRow({
        resource: getResource("sales_issue_items"),
        body: itemRow,
      })
    }
  } catch (itemErr) {
    console.warn("Item update warning:", itemErr.message)
  }

  return { status: 200, body: { ...existing, ...input, total_quantity, total_amount: finalTotalAmount, items, savedToDb: true } }
}

export async function deleteSalesIssue(id) {
  try {
    const getRes = await getSalesIssue(id)
    if (getRes.body?.items) {
      for (const item of getRes.body.items) {
        if (item.id) {
          await drizzleDeleteRow({ resource: getResource("sales_issue_items"), id: item.id })
        }
      }
    }
    await drizzleDeleteRow({ resource: getResource("sales_issues"), id })
  } catch (err) {
    console.warn("Delete sales issue warning:", err.message)
  }

  return { status: 200, body: { ok: true, deletedId: id } }
}

export async function postSalesIssue(arg1, arg2) {
  const id = typeof arg1 === "string" ? arg1 : typeof arg2 === "string" ? arg2 : arg1?.id || arg2?.id
  const getRes = await getSalesIssue(id)
  if (getRes.status >= 400 || !getRes.body) {
    return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
  }

  const existing = getRes.body
  const statusUpper = (existing.status || "").toUpperCase()
  if (statusUpper === "POSTED") {
    return { status: 400, body: { error: `Sales issue '${id}' is already posted.` } }
  }

  let totalCost = 0
  let totalAmount = 0
  let totalQty = 0

  const allWarehouses = await getAllWarehouses()

  // 1. Deduct Stock from dedicated export_products / pharma_products
  try {
    const rawAllProducts = await getAllProductsForSales()
    const allProducts = Array.isArray(rawAllProducts) ? rawAllProducts.map(p => p?.payload ? { ...p.payload, ...p } : p) : []

    for (const item of (existing.items || [])) {
      const prodId = item.item_id || item.productId || item.product_id
      const itemName = (item.item_name || item.product_name || "").toLowerCase().trim()
      
      let matchedProd = allProducts.find(p => p.id === prodId || p.product_id === prodId)
      if (!matchedProd && itemName) {
        matchedProd = allProducts.find(p => (p.name || p.product_name || "").toLowerCase().trim() === itemName)
      }

      if (matchedProd) {
        const prod = matchedProd
        const realProdId = prod.id || prodId
        const issueQty = Number(item.quantity || item.qty || 0)
        
        let sellingUnitPrice = Number(item.unit_price || item.unitPrice || item.price || 0)
        if (sellingUnitPrice <= 0 && existing.reference_no) {
          const soRes = await drizzleListRows({ resource: getResource("sales_orders"), query: { id: existing.reference_no } }).catch(() => ({ body: [] }))
          const soList = Array.isArray(soRes.body) ? soRes.body : [soRes.body]
          const so = soList[0]?.payload ? { ...soList[0].payload, ...soList[0] } : soList[0]
          if (so && Array.isArray(so.items)) {
            const soItem = so.items.find((si) => (si.productId === realProdId || si.product_id === realProdId || si.item_id === realProdId || si.id === realProdId))
            if (soItem && Number(soItem.unitPrice || soItem.unit_price || 0) > 0) {
              sellingUnitPrice = Number(soItem.unitPrice || soItem.unit_price)
            }
          }
        }
        if (sellingUnitPrice <= 0) {
          sellingUnitPrice = Number(prod.selling_price || prod.sellingPrice || 0)
        }
        const unitPrice = sellingUnitPrice
        const unitCost = Number(prod.unitCost || prod.unit_cost || 0)

        totalQty += issueQty
        totalAmount += issueQty * unitPrice

        const targetWh = existing.warehouse_id || existing.warehouse || prod.warehouse_id || prod.warehouse
        const isExportWh = isExportWarehouseType(prod.warehouse_id || prod.warehouse, allWarehouses) || isExportWarehouseType(targetWh, allWarehouses)

        let itemActualCost = 0
        let newQty = Math.max(0, Number(prod.quantity || 0) - issueQty)
        let finalUnitCost = unitCost
        let finalStockValue = 0

        const childId = item.batch_id || item.batchId
        const childBatchNo = item.batch_no || item.batchNo || item.batch_number || item.batch || "BATCH-MAIN"

        if (isExportWh) {
          // 1. Fetch export inbound parcels from relational table export_warehouse_movements
          const [dbMovements] = await pool.query(
            `SELECT * FROM export_warehouse_movements WHERE product_id = ? ORDER BY created_at ASC`,
            [realProdId]
          ).catch(() => [[]])

          const allEwMovements = Array.isArray(dbMovements) ? dbMovements : []
          const inboundMovements = allEwMovements.filter((m) => m.movement_type === "entry" || m.movement_type === "GRV_ENTRY")
          const priorDeductions = allEwMovements.filter((m) =>
            ["reject", "REJECT_DEDUCTION", "leave", "OUTBOUND_DISPATCH", "issue", "SALE_OUTBOUND", "sale", "dispatch"].includes(m.movement_type)
          )

          let parcels = inboundMovements.map((m) => ({
            id: m.id,
            voucherNo: m.voucher_no,
            grossQuantity: Number(m.gross_quantity || m.net_quantity || 0),
            quantityReceived: Number(m.gross_quantity || m.net_quantity || 0),
            quantityRemaining: Number(m.gross_quantity || m.net_quantity || 0),
            unitPrice: Number(m.unit_price || unitCost || 0),
            createdAt: m.created_at,
          }))

          // Apply prior deductions with safe numeric conversion
          for (const ded of priorDeductions) {
            const rej = Number(ded.reject_quantity || 0)
            const gross = Number(ded.gross_quantity || 0)
            const net = Math.abs(Number(ded.net_quantity || 0))
            let dRem = rej > 0 ? rej : gross > 0 ? gross : net
            const target = (ded.batch_no || ded.voucher_no || ded.id || "").trim()
            let matched = false
            for (const p of parcels) {
              if (target && (p.id === target || p.voucherNo === target || (p.voucherNo && target.includes(p.voucherNo)))) {
                matched = true
                const d = Math.min(p.quantityRemaining, dRem)
                p.quantityRemaining -= d
                dRem -= d
              }
            }
            if (!matched && dRem > 0) {
              for (const p of parcels) {
                if (dRem <= 0) break
                const d = Math.min(p.quantityRemaining, dRem)
                p.quantityRemaining -= d
                dRem -= d
              }
            }
          }

          if (parcels.length > 0) {
            let remaining = issueQty
            // Deduct from matched target parcel first
            if (childId || childBatchNo) {
              for (const p of parcels) {
                if (remaining <= 0) break
                if (
                  (childId && (p.id === childId || p.voucherNo === childId)) ||
                  (childBatchNo && childBatchNo !== "N/A" && childBatchNo !== "COMMODITY-WH1" && p.voucherNo === childBatchNo)
                ) {
                  const deduct = Math.min(p.quantityRemaining, remaining)
                  if (deduct > 0) {
                    p.quantityRemaining -= deduct
                    remaining -= deduct
                    itemActualCost += deduct * p.unitPrice
                  }
                }
              }
            }

            // FIFO fallback
            if (remaining > 0) {
              for (const p of parcels) {
                if (remaining <= 0) break
                if (p.quantityRemaining > 0) {
                  const deduct = Math.min(p.quantityRemaining, remaining)
                  p.quantityRemaining -= deduct
                  remaining -= deduct
                  itemActualCost += deduct * p.unitPrice
                }
              }
            }

            if (remaining > 0) {
              itemActualCost += remaining * unitCost
            }

            newQty = parcels.reduce((sum, p) => sum + Math.max(0, p.quantityRemaining), 0)
          } else {
            itemActualCost = issueQty * unitCost
          }

          totalCost += itemActualCost
          const effectiveOutboundCostRate = itemActualCost > 0 && issueQty > 0 ? Math.round((itemActualCost / issueQty) * 100) / 100 : (parcels[0]?.unitPrice || unitCost)
          const thisDispatchPrice = unitPrice > 0 ? unitPrice : effectiveOutboundCostRate

          // Calculate finalStockValue reflecting all child movements including this dispatch
          let ewmVal = 0
          for (const m of allEwMovements) {
            const mType = (m.movement_type || "").toUpperCase()
            const isEntry = ["ENTRY", "GRV_ENTRY"].includes(mType)
            const isRej = ["REJECT", "REJECT_DEDUCTION"].includes(mType)
            const q = isRej
              ? Number(m.reject_quantity || m.gross_quantity || Math.abs(Number(m.net_quantity || 0)))
              : isEntry
              ? Number(m.gross_quantity || m.net_quantity || 0)
              : Number(m.gross_quantity || Math.abs(Number(m.net_quantity || 0)))
            const p = Number(m.unit_price || unitCost || 0)
            if (isEntry) {
              ewmVal += q * p
            } else {
              ewmVal -= q * p
            }
          }
          if (parcels.length > 0) {
            finalStockValue = newQty <= 0 ? 0 : Math.max(0, Math.round(parcels.reduce((sum, p) => sum + (Math.max(0, p.quantityRemaining) * p.unitPrice), 0) * 100) / 100)
          } else {
            const initialVal = Number(prod.total_stock_value || (Number(prod.quantity || 0) * unitCost))
            finalStockValue = newQty <= 0 ? 0 : Math.max(0, Math.round((initialVal - itemActualCost) * 100) / 100)
          }
          finalUnitCost = newQty > 0 ? Math.round((finalStockValue / newQty) * 100) / 100 : unitCost

          // Export warehouse movement row
          const defaultExpWh = targetWh || (await getDefaultWarehouseForType("EXPORT_WH"))
          const ewmId = `EWM-ISS-${id}-${Math.random().toString(36).slice(2, 7)}`
          await drizzleCreateRow({
            resource: getResource("export_warehouse_movements"),
            body: {
              id: ewmId,
              warehouse_id: defaultExpWh,
              product_id: realProdId,
              movement_type: "OUTBOUND_DISPATCH",
              voucher_no: existing.fs_no || id,
              batch_no: childBatchNo || `COMMODITY-${defaultExpWh}`,
              party_name: existing.customer_name || existing.customer || "Customer Dispatch",
              plate_number: existing.plate_number || existing.plateNumber || item.plate_number || "—",
              gross_quantity: issueQty,
              reject_quantity: 0,
              net_quantity: -issueQty,
              uom: prod.unit || "Quintal",
              unit_price: unitPrice > 0 ? unitPrice : effectiveOutboundCostRate,
              movement_date: existing.sale_date || getLocalDateString(),
              reason: `Sales Issue Dispatch (${existing.fs_no || id})`,
              created_by: existing.created_by || "Sales Officer",
            },
          }).catch((ewmErr) => console.warn("Export movement creation error:", ewmErr.message))

          // Update export_products (strictly preserving total inbound received Y and updating remaining stock value)
          const newSold = Number(prod.quantitySold || prod.quantity_sold || 0) + issueQty
          const currentExpSellingPrice = Number(prod.selling_price || prod.sellingPrice || finalUnitCost)
          const finalTotalInboundQty = parcels.reduce((sum, p) => sum + Math.max(0, p.grossQuantity || p.quantityReceived || 0), 0) || Number(prod.total_quantity || prod.totalQuantity || (newQty + newSold))

          await pool.query(
            `UPDATE export_products 
             SET quantity = ?, total_quantity = ?, total_stock_value = ?, unit_cost = ?, selling_price = ?, quantity_sold = ?, updated_at = NOW() 
             WHERE id = ?`,
            [newQty, finalTotalInboundQty, finalStockValue, finalUnitCost, currentExpSellingPrice, newSold, realProdId]
          ).catch((upErr) => console.warn("Export product update error:", upErr.message))

        } else {
          // Pharma warehouse lot deduction
          // 1. Fetch current batches from relational table
          const [dbBatches] = await pool.query(
            `SELECT * FROM pharma_product_batches WHERE product_id = ?`,
            [realProdId]
          ).catch(() => [[]])

          const batchesList = Array.isArray(dbBatches) ? dbBatches : []
          let remaining = issueQty

          // Match by internal unique ID first, then by batch_no
          let matchedBatch = null
          if (childId && childId !== "N/A" && childId !== "BATCH-MAIN") {
            matchedBatch = batchesList.find((b) => b.id === childId)
          }
          if (!matchedBatch && childBatchNo && childBatchNo !== "N/A") {
            matchedBatch = batchesList.find((b) => b.batch_no === childBatchNo && Number(b.quantity || 0) > 0)
          }

          if (matchedBatch && Number(matchedBatch.quantity || 0) > 0) {
            const deduct = Math.min(Number(matchedBatch.quantity || 0), remaining)
            remaining -= deduct
            const bCost = Number(matchedBatch.unit_cost || unitCost || 0)
            itemActualCost += deduct * bCost
            await pool.query(
              `UPDATE pharma_product_batches 
               SET quantity = GREATEST(0, quantity - ?), updated_at = NOW() 
               WHERE id = ?`,
              [deduct, matchedBatch.id]
            ).catch(() => {})
          }

          // Fallback FIFO across remaining batches if needed
          if (remaining > 0) {
            const sortedBatches = [...batchesList].sort((a, b) =>
              new Date(a.expiry_date || a.mfg_date || 0).getTime() - new Date(b.expiry_date || b.mfg_date || 0).getTime()
            )
            for (const b of sortedBatches) {
              if (remaining <= 0) break
              if (matchedBatch && b.id === matchedBatch.id) continue
              const bQty = Number(b.quantity || 0)
              if (bQty > 0) {
                const deduct = Math.min(bQty, remaining)
                remaining -= deduct
                const bCost = Number(b.unit_cost || unitCost || 0)
                itemActualCost += deduct * bCost
                await pool.query(
                  `UPDATE pharma_product_batches 
                   SET quantity = GREATEST(0, quantity - ?), updated_at = NOW() 
                   WHERE id = ?`,
                  [deduct, b.id]
                ).catch(() => {})
              }
            }
          }

          if (remaining > 0) {
            itemActualCost += remaining * unitCost
          }

          totalCost += itemActualCost

          // Re-query updated batches from DB to calculate exact remaining quantity
          const [updatedDbBatches] = await pool.query(
            `SELECT * FROM pharma_product_batches WHERE product_id = ?`,
            [realProdId]
          ).catch(() => [[]])

          const activeBatches = Array.isArray(updatedDbBatches) ? updatedDbBatches : []
          newQty = activeBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0)

          const thisIssuePrice = unitPrice > 0 ? unitPrice : Number(prod.selling_price || prod.sellingPrice || 0)

          // Calculate finalStockValue reflecting all stock movements including this issue
          const [existingSmRows] = await pool.query(
            `SELECT movement_type, quantity, unit_cost, unit_price FROM stock_movements WHERE product_id = ?`,
            [realProdId]
          ).catch(() => [[]])

          let smVal = 0
          for (const sm of (existingSmRows || [])) {
            const q = Number(sm.quantity || 0)
            const isReceipt = ["RECEIPT", "ENTRY", "PURCHASE", "INBOUND", "ADJUSTMENT_IN"].includes((sm.movement_type || "").toUpperCase())
            const p = isReceipt
              ? Number(sm.unit_cost || sm.unit_price || unitCost || 0)
              : Number(sm.unit_price || sm.unit_cost || prod.selling_price || prod.sellingPrice || unitCost || 0)
            if (isReceipt) {
              smVal += q * p
            } else {
              smVal -= q * p
            }
          }
          if (activeBatches.length > 0) {
            finalStockValue = newQty <= 0 ? 0 : Math.max(0, Math.round(activeBatches.reduce((sum, b) => sum + (Math.max(0, Number(b.quantity || 0)) * Number(b.unit_cost || 0)), 0) * 100) / 100)
          } else {
            const initialVal = Number(prod.total_stock_value || (Number(prod.quantity || 0) * unitCost))
            finalStockValue = newQty <= 0 ? 0 : Math.max(0, Math.round((initialVal - itemActualCost) * 100) / 100)
          }
          finalUnitCost = newQty > 0 ? Math.round((finalStockValue / newQty) * 100) / 100 : unitCost

          // Write stock movement
          const defaultPharmaWh = targetWh || (await getDefaultWarehouseForType("PHARMA_WH"))
          const smId = `SM-ISS-${id}-${Math.random().toString(36).slice(2, 7)}`
          await drizzleCreateRow({
            resource: getResource("stock_movements"),
            body: {
              id: smId,
              product_id: realProdId,
              warehouse_id: defaultPharmaWh,
              movement_type: "ISSUE",
              quantity: issueQty,
              unit_cost: itemActualCost > 0 && issueQty > 0 ? Math.round((itemActualCost / issueQty) * 100) / 100 : unitCost,
              unit_price: unitPrice > 0 ? unitPrice : Number(prod.selling_price || prod.sellingPrice || 0),
              balance_after: newQty,
              batch_no: childBatchNo || "BATCH-MAIN",
              expiry_date: item.expiryDate || item.expiry || null,
              reference_type: "SALES_ISSUE",
              reference_id: id,
              notes: `Sales Issue ${existing.fs_no || id} - Customer: ${existing.customer_name || existing.customer || "Customer Dispatch"}`,
              performed_by: existing.created_by || "Sales Officer",
              movement_date: existing.sale_date || getLocalDateString(),
            },
          }).catch((smErr) => console.warn("Stock movement creation error:", smErr.message))

          // Update pharma_products
          const newSold = Number(prod.quantitySold || prod.quantity_sold || 0) + issueQty
          const packSize = Number(prod.quantityPerPack || prod.quantity_per_pack || 1)
          const newCartons = packSize > 0 ? Math.max(0, Math.floor(newQty / packSize)) : 0
          const updatedStatus = newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock"
          const currentPharmaSellingPrice = Number(prod.selling_price || prod.sellingPrice || finalUnitCost)

          await pool.query(
            `UPDATE pharma_products 
             SET quantity = ?, total_stock_value = ?, unit_cost = ?, selling_price = ?, quantity_sold = ?, number_of_cartons = ?, status = ?, updated_at = NOW() 
             WHERE id = ?`,
            [newQty, finalStockValue, finalUnitCost, currentPharmaSellingPrice, newSold, newCartons, updatedStatus, realProdId]
          ).catch((upErr) => console.warn("Pharma product update error:", upErr.message))
        }
      }
    }
  } catch (err) {
    console.warn("Stock deduction warning during post:", err.message)
  }

  // 2. Update status in sales_issues while strictly preserving payment integrity
  const isWhExport = isExportWarehouseType(existing.warehouse_id, allWarehouses)
  const issueSubtotal = totalAmount || Number(existing.subtotal || existing.total_amount || 0)
  const issueVatRate = isWhExport ? 0 : Number(existing.vat_rate !== undefined ? existing.vat_rate : 15)
  const issueVatAmount = issueVatRate > 0 ? Number(existing.vat_amount || Math.round(issueSubtotal * (issueVatRate / 100))) : 0
  const grandTotal = issueSubtotal + issueVatAmount

  const isCash = (existing.payment_type || "").toString().toLowerCase() === "cash"
  const existingPaid = Number(existing.amount_paid || existing.amountPaid || (isCash ? grandTotal : 0))
  const existingBal = isCash ? 0 : Number(existing.balance_due !== undefined ? existing.balance_due : Math.max(0, grandTotal - existingPaid))
  const isFullySettled = isCash || (grandTotal > 0 && existingPaid >= grandTotal) || existing.settlement_status === "Fully Settled"

  const paymentStatus = isFullySettled ? "Paid" : (existingPaid > 0 ? "Partially Paid" : "Unpaid")
  const settlementStatus = isFullySettled ? "Fully Settled" : (existingPaid > 0 ? "Ongoing" : "Unpaid")

  const updateIssueRes = await drizzleUpdateRow({
    resource: getResource("sales_issues"),
    id,
    body: {
      status: "Posted",
      posted_at: new Date(),
      posted_by: "Sales Officer",
      total_quantity: totalQty || existing.total_quantity,
      totalQuantity: totalQty || existing.total_quantity,
      subtotal: issueSubtotal,
      subtotal_amount: issueSubtotal,
      subtotalAmount: issueSubtotal,
      vat_rate: issueVatRate,
      vatRate: issueVatRate,
      vat_amount: issueVatAmount,
      vatAmount: issueVatAmount,
      tax_amount: issueVatAmount,
      taxAmount: issueVatAmount,
      total_amount: grandTotal,
      totalAmount: grandTotal,
      amount_paid: existingPaid,
      amountPaid: existingPaid,
      balance_due: existingBal,
      balanceDue: existingBal,
      payment_status: paymentStatus,
      paymentStatus: paymentStatus,
      settlement_status: settlementStatus,
    },
  })

  if (updateIssueRes.status >= 400) {
    console.error(`[postSalesIssue] Failed to update sales_issues status:`, updateIssueRes.body)
    return { status: updateIssueRes.status || 500, body: { error: updateIssueRes.body?.error || "Failed to update sales issue status." } }
  }

  // 3. Post Double-Entry Journal Entries
  try {
    const coaRes = await drizzleListRows({ resource: getResource("chart_of_accounts") }).catch(() => ({ body: [] }))
    const allAccounts = Array.isArray(coaRes.body) ? coaRes.body.map(a => a?.payload ? { ...a.payload, ...a } : a) : []
    const findAcc = (code) => allAccounts.find(a => (a.code || a.account_code) === code)?.id || null

    const isCredit = existing.payment_type === "Credit"
    const debitAccId = isCredit
      ? (isWhExport ? (findAcc("1200") || findAcc("1200-03") || "ACC-1200") : (findAcc("1300-03") || findAcc("1200") || "ACC-1200"))
      : (findAcc("1000-02-26") || findAcc("1000-01-01") || findAcc("1000") || "ACC-1000")

    const revenueAccId = isWhExport
      ? (findAcc("4010") || findAcc("4000") || "ACC-4010")
      : (findAcc("4000-01-01") || findAcc("4000") || "ACC-4000")

    const vatAccId = findAcc("2000-05") || "ACC-2200"
    const cogsAccId = findAcc("5001") || findAcc("6000") || "ACC-5001"

    // Map inventory account to specific commodity stock account if available
    let inventoryAccId = null
    const firstItemName = ((existing.items?.[0]?.item_name || existing.items?.[0]?.product_name || "")).toLowerCase()
    if (firstItemName.includes("sesame")) {
      inventoryAccId = findAcc("1410-03") || findAcc("1410") || "ACC-1410"
    } else if (firstItemName.includes("mung")) {
      inventoryAccId = findAcc("1410-01") || findAcc("1410") || "ACC-1410"
    } else {
      inventoryAccId = isWhExport ? (findAcc("1410-03") || findAcc("1410") || "ACC-1410") : (findAcc("1410") || "ACC-1410")
    }

    const saleJeId = `JE-SALE-${id}`
    const cogsJeId = `JE-COGS-${id}`

    // Idempotently clean up prior journal entries for this issue before inserting
    try {
      await pool.query("DELETE FROM `journal_entries` WHERE `id` IN (?, ?)", [saleJeId, cogsJeId]).catch(() => {})
      await pool.query("DELETE FROM `journal_entry_lines` WHERE `id` LIKE CONCAT(?, '%') OR `id` LIKE CONCAT(?, '%')", [saleJeId, cogsJeId]).catch(() => {})
    } catch {}

    // A. Sales Journal Entry
    await drizzleCreateRow({
      resource: getResource("journal_entries"),
      body: {
        id: saleJeId,
        entry_date: existing.sale_date || getLocalDateString(),
        description: `Sales issue ${existing.fs_no || id}`,
        source_type: "Sales Issue",
        source_id: id,
        created_by: "Sales Officer",
        currency: "ETB",
        exchange_rate: 1.0,
        posting_status: "POSTED",
      },
    })

    // B. Sales Journal Entry Lines
    // 1. Debit Cash (1000) or Accounts Receivable (1300) for Grand Total
    await drizzleCreateRow({
      resource: getResource("journal_entry_lines"),
      body: {
        id: `${saleJeId}-DR`,
        journal_entry_id: saleJeId,
        account_id: debitAccId,
        debit_amount: grandTotal,
        credit_amount: 0,
        currency: "ETB",
        exchange_rate_at_time: 1.0,
        warehouse_id: existing.warehouse_id || null,
        party_type: "Customer",
        party_id: existing.customer_id || null,
        party_name: existing.customer_name || existing.customer || null,
      },
    })

    // 2. Credit Sales Revenue (4000) for Net Subtotal
    await drizzleCreateRow({
      resource: getResource("journal_entry_lines"),
      body: {
        id: `${saleJeId}-CR`,
        journal_entry_id: saleJeId,
        account_id: revenueAccId,
        debit_amount: 0,
        credit_amount: issueSubtotal,
        currency: "ETB",
        exchange_rate_at_time: 1.0,
        warehouse_id: existing.warehouse_id || null,
        party_type: "Customer",
        party_id: existing.customer_id || null,
        party_name: existing.customer_name || existing.customer || null,
      },
    })

    // 3. Credit Output VAT Payable (2000-05) if VAT is charged
    if (issueVatAmount > 0) {
      await drizzleCreateRow({
        resource: getResource("journal_entry_lines"),
        body: {
          id: `${saleJeId}-VAT`,
          journal_entry_id: saleJeId,
          account_id: vatAccId,
          debit_amount: 0,
          credit_amount: issueVatAmount,
          currency: "ETB",
          exchange_rate_at_time: 1.0,
          warehouse_id: existing.warehouse_id || null,
          party_type: "Customer",
          party_id: existing.customer_id || null,
          party_name: existing.customer_name || existing.customer || null,
        },
      })
    }

    // C. COGS Journal Entry
    if (totalCost > 0) {
      await drizzleCreateRow({
        resource: getResource("journal_entries"),
        body: {
          id: cogsJeId,
          entry_date: existing.sale_date || getLocalDateString(),
          description: `Inventory cost for sales issue ${existing.fs_no || id}`,
          source_type: "Sales Issue",
          source_id: id,
          created_by: "Sales Officer",
          currency: "ETB",
          exchange_rate: 1.0,
          posting_status: "POSTED",
        },
      })

      await drizzleCreateRow({
        resource: getResource("journal_entry_lines"),
        body: {
          id: `${cogsJeId}-DR`,
          journal_entry_id: cogsJeId,
          account_id: cogsAccId,
          debit_amount: totalCost,
          credit_amount: 0,
          currency: "ETB",
          exchange_rate_at_time: 1.0,
          warehouse_id: existing.warehouse_id || null,
        },
      })

      await drizzleCreateRow({
        resource: getResource("journal_entry_lines"),
        body: {
          id: `${cogsJeId}-CR`,
          journal_entry_id: cogsJeId,
          account_id: inventoryAccId,
          debit_amount: 0,
          credit_amount: totalCost,
          currency: "ETB",
          exchange_rate_at_time: 1.0,
          warehouse_id: existing.warehouse_id || null,
        },
      })
    }

    // 4. Update Sales Order if referenced
    if (existing.sales_order_id || existing.reference_no) {
      const soId = existing.sales_order_id || existing.reference_no
      try {
        const soRes = await drizzleGetRow({ resource: getResource("sales_orders"), id: soId })
        if (soRes.status === 200 && soRes.body) {
          const soData = soRes.body
          const updatedSo = {
            ...soData,
            stage: "Shipped",
            deliveryStatus: "Fully Delivered",
            deliveredAmount: grandTotal,
            billingStatus: existing.payment_type === "Cash" ? "Fully Billed" : (soData.billingStatus || "Fully Billed"),
            updatedAt: new Date().toISOString(),
          }
          await drizzleUpdateRow({ resource: getResource("sales_orders"), id: soId, body: updatedSo })
        }
      } catch (soErr) {
        console.warn("SO sync warning:", soErr.message)
      }
    }
  } catch (err) {
    console.warn("GL Journal posting warning:", err.message)
  }

  return { status: 200, body: { ...existing, status: "Posted", ok: true } }
}

export async function cancelSalesIssue(id) {
  const getRes = await getSalesIssue(id)
  if (getRes.status >= 400 || !getRes.body) {
    return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
  }

  const existing = getRes.body
  await drizzleUpdateRow({
    resource: getResource("sales_issues"),
    id,
    body: { status: "Cancelled" },
  })

  return { status: 200, body: { ...existing, status: "Cancelled", ok: true } }
}

export async function getAvailableBatches(query = {}) {
  const itemId = query.item_id || query.itemId || query.productId || null
  const warehouseId = query.warehouse_id || query.warehouseId || query.warehouse || null
  const defaultPharmaWh = await getDefaultWarehouseForType("PHARMA_WH")

  try {
    const [batchesRes, pharmaRes] = await Promise.all([
      drizzleListRows({ resource: getResource("pharma_product_batches") }).catch(() => ({ body: [] })),
      drizzleListRows({ resource: getResource("pharma_products") }).catch(() => ({ body: [] })),
    ])
    const batches = Array.isArray(batchesRes.body) ? batchesRes.body : []
    const pharmaProducts = Array.isArray(pharmaRes.body) ? pharmaRes.body : []
    const available = []

    for (const b of batches) {
      if (itemId && (b.product_id !== itemId && b.productId !== itemId)) continue
      const parentProd = pharmaProducts.find((p) => p.id === (b.product_id || b.productId))
      const batchNo = b.batch_no || b.batchNo || "BATCH"
      available.push({
        batch_id: b.id || batchNo,
        batch_no: batchNo,
        item_id: b.product_id || b.productId || itemId,
        item_name: parentProd?.name || "Product",
        warehouse_id: b.warehouse_id || b.warehouseId || warehouseId || parentProd?.warehouse_id || defaultPharmaWh,
        available_quantity: Number(b.quantity || b.qty || 0),
        manufacturing_date: b.mfg_date || b.mfgDate || "",
        expiry: b.expiry_date || b.expiryDate || "",
        expiry_date: b.expiry_date || b.expiryDate || "",
        packaging_unit: parentProd?.unit || "Box",
        unit_price: Number(parentProd?.selling_price || parentProd?.sellingPrice || b.unit_cost || b.unitCost || 0),
        unit_cost: Number(b.unit_cost || b.unitCost || parentProd?.unit_cost || 0),
      })
    }

    if (available.length > 0) {
      return { status: 200, body: available }
    }
  } catch (err) {
    console.warn("getAvailableBatches exception:", err.message)
  }

  const fallbackBatch = [
    {
      batch_id: "BATCH-MAIN",
      batch_no: "BATCH-MAIN",
      item_id: itemId || "ITEM-1",
      item_name: "Product",
      warehouse_id: warehouseId || defaultPharmaWh,
      available_quantity: 1000,
      packaging_unit: "Box",
      unit_price: 1000,
      unit_cost: 800,
    },
  ]
  return { status: 200, body: fallbackBatch }
}
