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
import { inventoryService } from "../inventory/inventoryService.js"
import { pool } from "../../db/client.js"
import { unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"
import crypto from "node:crypto"

// ── Service Logic ─────────────────────────────────────────────────────────────

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
    const [itemsRes, customersRes, ordersRes, productsRes] = await Promise.all([
      drizzleListRows({ resource: getResource("sales_issue_items") }),
      drizzleListRows({ resource: getResource("customers") }).catch(() => ({ body: [] })),
      drizzleListRows({ resource: getResource("sales_orders") }).catch(() => ({ body: [] })),
      inventoryService.listProducts().catch(() => ({ body: [] })),
    ])

    const allCustomers = Array.isArray(customersRes.body) ? customersRes.body : []
    const customerMap = new Map(allCustomers.map((c) => [c.id, c.payload ? { ...c.payload, ...c } : c]))

    const allOrders = Array.isArray(ordersRes.body) ? ordersRes.body : []
    const orderMap = new Map(allOrders.map((o) => [o.id, o.payload ? { ...o.payload, ...o } : o]))

    const allProducts = Array.isArray(productsRes.body) ? productsRes.body : []
    const productMap = new Map(allProducts.map((p) => [p.id, p.payload ? { ...p.payload, ...p } : p]))

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
      const rawSalesOrderId = rawIssue.sales_order_id || rawIssue.salesOrderId || rawIssue.salesOrder || null
      const rawReferenceNo = rawIssue.reference_no || rawIssue.referenceNo || ""
      const sales_order_id = rawSalesOrderId || (rawReferenceNo && String(rawReferenceNo).startsWith("SO-") ? rawReferenceNo : null)
      const reference_no = rawReferenceNo
      let rawDate = issue.sale_date || issue.issueDate || issue.issue_date || issue.created_at || new Date()
      let sale_date = typeof rawDate === "string" 
        ? (rawDate.includes("T") ? rawDate.split("T")[0] : rawDate)
        : (rawDate instanceof Date ? rawDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0])

      const matchedCust = customerMap.get(issue.customer_id)
      const matchedOrder = (sales_order_id && orderMap.get(sales_order_id)) || (reference_no && orderMap.get(reference_no))
      const firstItem = issueItems[0]
      const matchedProd = firstItem ? (productMap.get(firstItem.product_id) || productMap.get(firstItem.item_id)) : null

      const customer_name = issue.customer_name || matchedCust?.name || matchedOrder?.customer || issue.customer || issue.customerName || issue.customer_id || "Customer"
      const customer_id = issue.customer_id || matchedCust?.id || matchedOrder?.customerId || customer_name
      const warehouse_id = issue.warehouse_id || matchedOrder?.warehouse || matchedProd?.warehouse || issue.warehouseId || issue.warehouse || "WH1"
      const isWh1 = (warehouse_id || "").toUpperCase().startsWith("WH1") || (warehouse_id || "").toUpperCase().includes("EXP")

      const payment_type = issue.payment_type || issue.paymentType || issue.payment_method || issue.paymentMethod || "Cash"
      const status = issue.status || "Draft"

      const subtotal = Number(issue.subtotal_amount || issue.subtotal || issueItems.reduce((s, i) => s + (i.amount || 0), 0) || 0)
      const vat_amount = Number(issue.tax_amount !== undefined ? issue.tax_amount : (issue.vat_amount !== undefined ? issue.vat_amount : 0))
      const vat_rate = Number(issue.vat_rate !== undefined ? issue.vat_rate : (issue.tax_rate !== undefined ? issue.tax_rate : (vat_amount > 0 && subtotal > 0 ? Math.round((vat_amount / subtotal) * 100) : 0)))
      const total_amount = Number(issue.total_amount || issue.totalAmount || (subtotal + vat_amount) || 0)
      const total_quantity = Number(issue.total_quantity || issue.totalQuantity || issueItems.reduce((s, i) => s + (i.quantity || 0), 0) || 0)
      const amount_paid = Number(issue.amount_paid || issue.amountPaid || 0)
      const balance_due = Number(issue.balance_due || issue.balanceDue || Math.max(0, total_amount - amount_paid))

      return {
        ...issue,
        id: primaryId,
        fs_no,
        fsNo: fs_no,
        issue_number: fs_no,
        issueNumber: fs_no,
        reference_no: reference_no || null,
        referenceNo: reference_no || null,
        sales_order_id: sales_order_id || null,
        salesOrderId: sales_order_id || null,
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
        balance_due,
        settlement_status: issue.settlement_status || (payment_type === "Cash" ? "Fully Settled" : (total_amount > 0 && amount_paid >= total_amount ? "Fully Settled" : amount_paid > 0 ? "Ongoing" : "Unpaid")),
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

export async function normalizeId(id) {
  return typeof id === "object" && id !== null ? id.id || id.fs_no || String(id) : String(id)
}

function isExportWarehouse(wh) {
  const s = String(wh || "").toUpperCase()
  return s.startsWith("WH1") || s.includes("EXP") || s.includes("EXPORT")
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
    const [itemsRes, customersRes, ordersRes, productsRes] = await Promise.all([
      drizzleListRows({ resource: getResource("sales_issue_items") }),
      drizzleListRows({ resource: getResource("customers") }).catch(() => ({ body: [] })),
      drizzleListRows({ resource: getResource("sales_orders") }).catch(() => ({ body: [] })),
      inventoryService.listProducts().catch(() => ({ body: [] })),
    ])

    const allCustomers = Array.isArray(customersRes.body) ? customersRes.body : []
    const customerMap = new Map(allCustomers.map((c) => [c.id, c.payload ? { ...c.payload, ...c } : c]))

    const allOrders = Array.isArray(ordersRes.body) ? ordersRes.body : []
    const orderMap = new Map(allOrders.map((o) => [o.id, o.payload ? { ...o.payload, ...o } : o]))

    const allProducts = Array.isArray(productsRes.body) ? productsRes.body : []
    const productMap = new Map(allProducts.map((p) => [p.id, p.payload ? { ...p.payload, ...p } : p]))

    const issue = rawIssue?.payload ? { ...rawIssue.payload, ...rawIssue } : rawIssue
    const fs_no = issue.fs_no || issue.fsNo || issue.issue_number || issue.issueNumber || String(issue.id)
    const primaryId = fs_no || String(issue.id)

    const allItems = Array.isArray(itemsRes.body) ? itemsRes.body : []
    const items = allItems
      .filter((i) => {
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
      .map((rawItem) => {
        const item = rawItem?.payload ? { ...rawItem.payload, ...rawItem } : rawItem
        const matchedProd = productMap.get(item.product_id) || productMap.get(item.item_id)
        return {
          id: item.id,
          sales_issue_id: primaryId,
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
        }
      })

    const rawSalesOrderId = issue.sales_order_id || issue.salesOrderId || issue.salesOrder || null
    const rawReferenceNo = issue.reference_no || issue.referenceNo || ""
    const sales_order_id = rawSalesOrderId || (rawReferenceNo && String(rawReferenceNo).startsWith("SO-") ? rawReferenceNo : null)
    const reference_no = rawReferenceNo
    let rawDate = issue.sale_date || issue.issueDate || issue.issue_date || issue.created_at || new Date()
    let sale_date = typeof rawDate === "string" 
      ? (rawDate.includes("T") ? rawDate.split("T")[0] : rawDate)
      : (rawDate instanceof Date ? rawDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0])

    const matchedCust = customerMap.get(issue.customer_id)
    const matchedOrder = (sales_order_id && orderMap.get(sales_order_id)) || (reference_no && orderMap.get(reference_no))
    const firstItem = items[0]
    const matchedProd = firstItem ? (productMap.get(firstItem.product_id) || productMap.get(firstItem.item_id)) : null

    const customer_name = issue.customer_name || matchedCust?.name || matchedOrder?.customer || issue.customer || issue.customerName || issue.customer_id || "Customer"
    const customer_id = issue.customer_id || matchedCust?.id || matchedOrder?.customerId || customer_name
    const warehouse_id = issue.warehouse_id || matchedOrder?.warehouse || matchedProd?.warehouse || issue.warehouseId || issue.warehouse || "WH1"
    const isWh1 = isExportWarehouse(warehouse_id)

    const payment_type = issue.payment_type || issue.paymentType || issue.payment_method || issue.paymentMethod || "Cash"
    const status = issue.status || "Draft"

    const subtotal = Number(issue.subtotal_amount || issue.subtotal || items.reduce((s, i) => s + (i.amount || 0), 0) || 0)
    const vat_amount = Number(issue.tax_amount !== undefined ? issue.tax_amount : (issue.vat_amount !== undefined ? issue.vat_amount : 0))
    const vat_rate = Number(issue.vat_rate !== undefined ? issue.vat_rate : (issue.tax_rate !== undefined ? issue.tax_rate : (vat_amount > 0 && subtotal > 0 ? Math.round((vat_amount / subtotal) * 100) : 0)))
    const total_amount = Number(issue.total_amount || issue.totalAmount || (subtotal + vat_amount) || 0)
    const total_quantity = Number(issue.total_quantity || issue.totalQuantity || items.reduce((s, i) => s + (i.quantity || 0), 0) || 0)
    const amount_paid = Number(issue.amount_paid || issue.amountPaid || 0)
    const balance_due = Number(issue.balance_due || issue.balanceDue || Math.max(0, total_amount - amount_paid))

    return {
      status: 200,
      body: {
        ...issue,
        id: primaryId,
        fs_no,
        fsNo: fs_no,
        issue_number: fs_no,
        issueNumber: fs_no,
        reference_no: reference_no || null,
        referenceNo: reference_no || null,
        sales_order_id: sales_order_id || null,
        salesOrderId: sales_order_id || null,
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
        balance_due,
        settlement_status: issue.settlement_status || (payment_type === "Cash" ? "Fully Settled" : (total_amount > 0 && amount_paid >= total_amount ? "Fully Settled" : amount_paid > 0 ? "Ongoing" : "Unpaid")),
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
  const fs_no = input?.fs_no || input?.fsNo || input?.issue_number || input?.issueNumber || `FS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  const id = existingId || input?.id || fs_no
  const rawSalesOrderId = input?.sales_order_id || input?.salesOrderId || input?.salesOrder || null
  const rawReferenceNo = input?.reference_no || input?.referenceNo || ""
  const sales_order_id = rawSalesOrderId || (rawReferenceNo && String(rawReferenceNo).startsWith("SO-") ? rawReferenceNo : null)
  const reference_no = rawReferenceNo || null
  const sale_date = input?.sale_date || input?.issueDate || new Date().toISOString().split("T")[0]
  const customer_name = input?.customer_name || input?.customer || input?.customer_id || "Walk-in Customer"
  const customer_id = input?.customer_id || input?.customerId || customer_name
  const warehouse_id = input?.warehouse_id || input?.warehouse || "WH-MAIN"
  const payment_type = input?.payment_type || input?.paymentType || "Cash"
  const items = Array.isArray(input?.items) ? input.items : []

  const total_quantity = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0)
  const itemTotal = items.reduce((sum, item) => sum + Number(item.amount || (item.quantity * item.unit_price) || 0), 0)

  const isWh1 = isExportWarehouse(warehouse_id)
  const subtotal = input?.subtotal !== undefined ? Number(input.subtotal) : itemTotal
  const vat_rate = input?.vat_rate !== undefined ? Number(input.vat_rate) : (input?.tax_rate !== undefined ? Number(input.tax_rate) : 0)
  const vat_amount = input?.vat_amount !== undefined ? Number(input.vat_amount) : (input?.tax_amount !== undefined ? Number(input.tax_amount) : (vat_rate > 0 ? Math.round(subtotal * (vat_rate / 100)) : 0))
  const finalTotalAmount = input?.total_amount !== undefined ? Number(input.total_amount) : (subtotal + vat_amount)

  const doc = {
    ...input,
    id,
    fs_no,
    fsNo: fs_no,
    reference_no,
    referenceNo: reference_no,
    sales_order_id,
    salesOrderId: sales_order_id,
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

  // 1. Save Header with exact MySQL relational schema columns (including all possible naming variants)
  const headerRow = {
    id,
    fs_no: fs_no,
    fsNo: fs_no,
    issue_number: fs_no,
    issueNumber: fs_no,
    reference_no: reference_no || null,
    referenceNo: reference_no || null,
    sales_order_id: sales_order_id || null,
    salesOrderId: sales_order_id || null,
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

  // 2. Save Items with exact MySQL relational schema columns
  if (items.length > 0) {
    const itemRows = items.map((item, idx) => {
      const prodId = String(item.item_id || item.productId || item.product_id || `ITEM-${idx + 1}`)
      const prodName = String(item.item_name || item.product_name || item.name || "Item")
      const batchCode = String(item.batch_no || item.batch_id || item.batch_number || "BATCH-MAIN")
      const packUnit = String(item.packaging_unit || item.unit || "Box")
      const q = Number(item.quantity || item.qty || 0)
      const p = Number(item.unit_price || item.price || 0)
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
        batch_id: batchCode,
        batchId: batchCode,
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
  const isWh1 = isExportWarehouse(warehouse_id)
  const subtotal = input?.subtotal !== undefined ? Number(input.subtotal) : itemTotal
  const vat_rate = input?.vat_rate !== undefined ? Number(input.vat_rate) : (input?.tax_rate !== undefined ? Number(input.tax_rate) : Number(existing.vat_rate || 0))
  const vat_amount = input?.vat_amount !== undefined ? Number(input.vat_amount) : (input?.tax_amount !== undefined ? Number(input.tax_amount) : (vat_rate > 0 ? Math.round(subtotal * (vat_rate / 100)) : 0))
  const finalTotalAmount = input?.total_amount !== undefined ? Number(input.total_amount) : (subtotal + vat_amount)

    const incomingSoId = input?.sales_order_id !== undefined ? input.sales_order_id : (input?.salesOrderId !== undefined ? input.salesOrderId : existing.sales_order_id)
    const incomingRef = input?.reference_no !== undefined ? input.reference_no : (input?.referenceNo !== undefined ? input.referenceNo : existing.reference_no)
    const resolvedSoId = incomingSoId || (incomingRef && String(incomingRef).startsWith("SO-") ? incomingRef : null)

    const updateHeader = {
      fs_no: input?.fs_no || existing.fs_no || cleanId,
      fsNo: input?.fs_no || existing.fs_no || cleanId,
      issue_number: input?.fs_no || existing.fs_no || cleanId,
      issueNumber: input?.fs_no || existing.fs_no || cleanId,
      reference_no: incomingRef || null,
      referenceNo: incomingRef || null,
      sales_order_id: resolvedSoId || null,
      salesOrderId: resolvedSoId || null,
      customer_id: (input?.customer_id || existing.customer_id) || null,
      customerId: (input?.customer_id || existing.customer_id) || null,
      customer_name: (input?.customer_name || existing.customer_name) || null,
      customer: (input?.customer_name || existing.customer_name) || null,
      warehouse_id: warehouse_id || null,
      warehouseId: warehouse_id || null,
      warehouse: warehouse_id || null,
    sale_date: input?.sale_date || existing.sale_date || new Date().toISOString().split("T")[0],
    issue_date: input?.sale_date || existing.sale_date || new Date().toISOString().split("T")[0],
    issueDate: input?.sale_date || existing.sale_date || new Date().toISOString().split("T")[0],
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
      const batchCode = String(item.batch_no || item.batch_id || item.batch_number || "BATCH-MAIN")
      const packUnit = String(item.packaging_unit || item.unit || "Box")
      const q = Number(item.quantity || item.qty || 0)
      const p = Number(item.unit_price || item.price || 0)
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
        batch_id: batchCode,
        batchId: batchCode,
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

  // 1. Deduct Stock from inventory
  try {
    const allProdRes = await inventoryService.listProducts().catch(() => ({ body: [] }))
    const allProducts = Array.isArray(allProdRes.body) ? allProdRes.body : []

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
        const itemSellingPrice = Number(item.unit_price || item.unitPrice || 0)
        const unitCost = Number(prod.unitCost || prod.unit_cost || 0)

        totalQty += issueQty
        totalAmount += issueQty * itemSellingPrice

        const isWH1 =
          prod.isExport ||
          prod.warehouseType === "EXPORT_WH" ||
          (prod.warehouse_id || prod.warehouse || existing.warehouse_id || "").toUpperCase().startsWith("WH1")

        if (isWH1) {
          // ── WH1 EXPORT COMMODITY PRODUCT LIFECYCLE ──────────────────────
          let remainingToDeduct = issueQty
          let totalDeductedCost = 0

          // If a specific inbound batch/parcel is selected (e.g. item.batch_id), prioritize it
          let grvRows = []
          if (item.batch_id) {
            const [selectedRows] = await pool.query(
              "SELECT * FROM `export_warehouse_movements` WHERE id = ? AND net_quantity > 0",
              [item.batch_id]
            )
            grvRows = selectedRows
          }
          if (grvRows.length === 0) {
            const [allActiveGrvs] = await pool.query(
              "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') AND net_quantity > 0 ORDER BY movement_date ASC, created_at ASC",
              [realProdId]
            )
            grvRows = allActiveGrvs
          }

          for (const grv of grvRows) {
            if (remainingToDeduct <= 0) break
            const currentNet = Number(grv.net_quantity || 0)
            const deduct = Math.min(currentNet, remainingToDeduct)
            remainingToDeduct -= deduct
            const newNet = Math.max(0, currentNet - deduct)
            const unitAcqCost = Number(grv.unit_price || 0)
            totalDeductedCost += deduct * unitAcqCost

            await pool.query(
              "UPDATE `export_warehouse_movements` SET net_quantity = ?, updated_at = NOW(3) WHERE id = ?",
              [newNet, grv.id]
            )
          }

          if (remainingToDeduct > 0) {
            const [moreGrvs] = await pool.query(
              "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') AND net_quantity > 0 ORDER BY movement_date ASC, created_at ASC",
              [realProdId]
            )
            for (const grv of moreGrvs) {
              if (remainingToDeduct <= 0) break
              const currentNet = Number(grv.net_quantity || 0)
              const deduct = Math.min(currentNet, remainingToDeduct)
              remainingToDeduct -= deduct
              const newNet = Math.max(0, currentNet - deduct)
              const unitAcqCost = Number(grv.unit_price || 0)
              totalDeductedCost += deduct * unitAcqCost

              await pool.query(
                "UPDATE `export_warehouse_movements` SET net_quantity = ?, updated_at = NOW(3) WHERE id = ?",
                [newNet, grv.id]
              )
            }
          }

          const leaveCOGSUnitCost = issueQty > 0 && totalDeductedCost > 0 ? Math.round((totalDeductedCost / issueQty) * 100) / 100 : unitCost
          totalCost += totalDeductedCost > 0 ? totalDeductedCost : issueQty * unitCost

          const commercialSellingPrice = itemSellingPrice > 0 ? itemSellingPrice : Number(prod.sellingPrice || prod.selling_price || 0)
          const dispatchMovId = `EWM-DISP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

          // 2. Insert the OUTBOUND_DISPATCH movement into export_warehouse_movements
          await pool.query(
            `INSERT INTO \`export_warehouse_movements\` (
              id, warehouse_id, product_id, movement_type, voucher_no, batch_no,
              party_name, plate_number, gross_quantity, reject_quantity, net_quantity,
              uom, unit_price, selling_price, movement_date, reason, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              dispatchMovId,
              prod.warehouse_id || prod.warehouse || "WH1",
              realProdId,
              "OUTBOUND_DISPATCH",
              existing.fs_no || id,
              item.batch_no || item.batch || "COMMODITY-WH1",
              existing.customer_name || existing.customer || "Customer Dispatch",
              existing.plate_number || existing.plateNumber || item.plate_number || item.plateNumber || "—",
              issueQty,
              0,
              -issueQty,
              prod.unit || "Quintal",
              leaveCOGSUnitCost,
              commercialSellingPrice > 0 ? commercialSellingPrice : null,
              existing.sale_date || getLocalDateString(),
              `Sales Issue FS-${existing.fs_no || id} (Customer Dispatch)`,
              "Sales Officer",
            ]
          )

          // 3. Compute new total inventory and asset valuation
          const [allGrvs] = await pool.query(
            "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry')",
            [realProdId]
          )
          const newQty = allGrvs.reduce((sum, g) => sum + Number(g.net_quantity || 0), 0)
          const finalStockValue = allGrvs.reduce((sum, g) => sum + (Number(g.net_quantity || 0) * Number(g.unit_price || 0)), 0)
          const weightedCost = newQty > 0 ? Math.round((finalStockValue / newQty) * 100) / 100 : unitCost

          // 4. Update export_products in MySQL
          await pool.query(
            `UPDATE \`export_products\` SET
              quantity = ?,
              quantity_sold = quantity_sold + ?,
              total_quantity = ?,
              unit_cost = ?,
              total_stock_value = ?,
              status = ?,
              updated_at = NOW(3)
             WHERE id = ?`,
            [
              newQty,
              issueQty,
              newQty + (Number(prod.quantitySold || prod.quantity_sold || 0) + issueQty),
              weightedCost,
              finalStockValue,
              newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock",
              realProdId,
            ]
          )
        } else {
          // ── PHARMA PRODUCT LIFECYCLE (WH2 / WH3) ───────────────────────
          let targetBatchId = item.batch_id
          let targetBatchNo = item.batch_no || item.batch || item.batch_number
          let remainingPharmaDeduct = issueQty
          let totalDeductedPharmaCost = 0
          const deductedBatchNos = []

          // 1. Deduct from specific batch in pharma_product_batches if specified
          if (targetBatchId) {
            const [bRows] = await pool.query(
              "SELECT * FROM `pharma_product_batches` WHERE id = ?",
              [targetBatchId]
            )
            if (bRows.length > 0) {
              const b = bRows[0]
              const curQty = Number(b.quantity || 0)
              const deduct = Math.min(curQty, remainingPharmaDeduct)
              remainingPharmaDeduct -= deduct
              const bCost = Number(b.unit_cost || unitCost)
              totalDeductedPharmaCost += deduct * bCost
              if (b.batch_no && !deductedBatchNos.includes(b.batch_no)) {
                deductedBatchNos.push(b.batch_no)
              }
              await pool.query(
                "UPDATE `pharma_product_batches` SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
                [deduct, b.id]
              )
            }
          }

          // 2. If not found by batch_id or if remaining qty > 0, match by batch_no
          if (remainingPharmaDeduct > 0 && targetBatchNo) {
            const [bRows] = await pool.query(
              "SELECT * FROM `pharma_product_batches` WHERE product_id = ? AND batch_no = ? AND quantity > 0 AND (qa_status != 'Quarantined' OR qa_status IS NULL) ORDER BY expiry_date ASC, created_at ASC",
              [realProdId, targetBatchNo]
            )
            for (const b of bRows) {
              if (remainingPharmaDeduct <= 0) break
              const curQty = Number(b.quantity || 0)
              const deduct = Math.min(curQty, remainingPharmaDeduct)
              remainingPharmaDeduct -= deduct
              const bCost = Number(b.unit_cost || unitCost)
              totalDeductedPharmaCost += deduct * bCost
              if (b.batch_no && !deductedBatchNos.includes(b.batch_no)) {
                deductedBatchNos.push(b.batch_no)
              }
              await pool.query(
                "UPDATE `pharma_product_batches` SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
                [deduct, b.id]
              )
            }
          }

          // 3. If still remaining (or no batch was specified), deduct in FIFO order
          if (remainingPharmaDeduct > 0) {
            const [bRows] = await pool.query(
              "SELECT * FROM `pharma_product_batches` WHERE product_id = ? AND quantity > 0 AND (qa_status != 'Quarantined' OR qa_status IS NULL) ORDER BY expiry_date ASC, created_at ASC",
              [realProdId]
            )
            for (const b of bRows) {
              if (remainingPharmaDeduct <= 0) break
              const curQty = Number(b.quantity || 0)
              const deduct = Math.min(curQty, remainingPharmaDeduct)
              remainingPharmaDeduct -= deduct
              const bCost = Number(b.unit_cost || unitCost)
              totalDeductedPharmaCost += deduct * bCost
              if (b.batch_no && !deductedBatchNos.includes(b.batch_no)) {
                deductedBatchNos.push(b.batch_no)
              }
              await pool.query(
                "UPDATE `pharma_product_batches` SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
                [deduct, b.id]
              )
            }
          }

          // If still remaining qty couldn't be deducted from batches, fallback to product unitCost
          if (remainingPharmaDeduct > 0) {
            totalDeductedPharmaCost += remainingPharmaDeduct * unitCost
          }

          const leavePharmaCOGSUnitCost = issueQty > 0
            ? Math.round((totalDeductedPharmaCost / issueQty) * 100) / 100
            : unitCost
          totalCost += totalDeductedPharmaCost

          // 4. Compute aggregate stock across all non-quarantined batches
          const [allBatches] = await pool.query(
            "SELECT * FROM `pharma_product_batches` WHERE product_id = ? AND (qa_status != 'Quarantined' OR qa_status IS NULL)",
            [realProdId]
          )
          const newQty = allBatches.reduce((s, b) => s + Number(b.quantity || 0), 0)
          const totalStockVal = allBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.unit_cost || 0)), 0)
          const newWeightedCost = newQty > 0 ? Math.round((totalStockVal / newQty) * 100) / 100 : unitCost

          // 5. Insert stock_movements record in MySQL
          const smId = `SM-ISSUE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          const recordedBatchNo = deductedBatchNos.length > 0 ? deductedBatchNos.join(", ") : targetBatchNo || "BATCH-ISSUE"
          await pool.query(
            `INSERT INTO stock_movements (
              id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price, selling_price,
              balance_after, batch_no, expiry_date, reference_type, reference_id, notes, party, performed_by, movement_date
            ) VALUES (?, ?, ?, 'ISSUE', ?, ?, ?, ?, ?, ?, ?, 'SALES_ISSUE', ?, ?, ?, ?, ?)`,
            [
              smId,
              realProdId,
              prod.warehouse_id || prod.warehouse || existing.warehouse_id || "WH2",
              issueQty,
              leavePharmaCOGSUnitCost,
              leavePharmaCOGSUnitCost,
              itemSellingPrice > 0 ? itemSellingPrice : null,
              newQty,
              recordedBatchNo,
              item.expiry_date || item.expiryDate || null,
              existing.fs_no || id,
              `Sales Issue FS-${existing.fs_no || id} (${existing.customer_name || 'Customer Dispatch'})`,
              existing.customer_name || existing.customer || "Customer Dispatch",
              "Sales Officer",
              existing.sale_date || getLocalDateString(),
            ]
          )

          // 6. Update parent pharma_products in MySQL
          await pool.query(
            `UPDATE pharma_products SET
              quantity = ?,
              total_quantity = ?,
              quantity_sold = quantity_sold + ?,
              unit_cost = ?,
              total_stock_value = ?,
              status = ?,
              updated_at = NOW(3)
             WHERE id = ?`,
            [
              newQty,
              newQty + (Number(prod.quantity_sold || prod.quantitySold || 0) + issueQty),
              issueQty,
              newWeightedCost,
              totalStockVal,
              newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock",
              realProdId,
            ]
          )
        }
      }
    }
  } catch (err) {
    console.warn("Stock deduction warning during post:", err.message)
  }

  // 2. Update status in sales_issues while strictly preserving payment integrity
  const isWh1 = isExportWarehouse(existing.warehouse_id)
  const issueSubtotal = totalAmount || Number(existing.subtotal || existing.subtotal_amount || existing.total_amount || 0)
  const issueVatRate = Number(existing.vat_rate !== undefined ? existing.vat_rate : (existing.tax_rate !== undefined ? existing.tax_rate : 0))
  const issueVatAmount = issueVatRate > 0 ? Number(existing.vat_amount !== undefined ? existing.vat_amount : (existing.tax_amount !== undefined ? existing.tax_amount : Math.round(issueSubtotal * (issueVatRate / 100)))) : 0
  const grandTotal = issueSubtotal + issueVatAmount

  const isCash = (existing.payment_type || "").toString().toLowerCase() === "cash"
  const existingPaid = Number(existing.amount_paid || existing.amountPaid || (isCash ? grandTotal : 0))
  const existingBal = isCash ? 0 : Number(existing.balance_due !== undefined ? existing.balance_due : Math.max(0, grandTotal - existingPaid))
  const isFullySettled = isCash || (grandTotal > 0 && existingPaid >= grandTotal) || existing.settlement_status === "Fully Settled"

  const paymentStatus = isFullySettled ? "Paid" : (existingPaid > 0 ? "Partially Paid" : "Unpaid")
  const settlementStatus = isFullySettled ? "Fully Settled" : (existingPaid > 0 ? "Ongoing" : "Unpaid")

  await drizzleUpdateRow({
    resource: getResource("sales_issues"),
    id,
    body: {
      status: "Posted",
      posted_at: new Date().toISOString(),
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

  // 3. Post Double-Entry Journal Entries
  try {
    const coaRes = await drizzleListRows({ resource: getResource("chart_of_accounts") }).catch(() => ({ body: [] }))
    const allAccounts = Array.isArray(coaRes.body) ? coaRes.body.map(a => a?.payload ? { ...a.payload, ...a } : a) : []
    const findAcc = (code) => allAccounts.find(a => (a.code || a.account_code) === code)?.id || null

    const isCredit = existing.payment_type === "Credit"
    const debitAccId = isCredit
      ? (findAcc("1300-03") || findAcc("1200-03") || findAcc("1100-03") || "ACC-1200")
      : (findAcc("1000-02-26") || findAcc("1000-01-01") || findAcc("1000") || "ACC-1000")
    const revenueAccId = findAcc("4000-01-01") || findAcc("4000-03-02") || findAcc("4000") || "ACC-4000"
    const vatAccId = findAcc("2000-05") || "ACC-2200"
    const cogsAccId = findAcc("6000-04") || findAcc("6000") || "ACC-5000"
    const inventoryAccId = findAcc("1410-01") || findAcc("1410-03") || findAcc("1410") || "ACC-1010"

    const saleJeId = `JE-SALE-${id}`
    const cogsJeId = `JE-COGS-${id}`

    // A. Sales Journal Entry
    await drizzleCreateRow({
      resource: getResource("journal_entries"),
      body: {
        id: saleJeId,
        entry_date: new Date().toISOString().split("T")[0],
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
          entry_date: new Date().toISOString().split("T")[0],
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
    const targetSoId = existing.sales_order_id || (existing.reference_no && String(existing.reference_no).startsWith("SO-") ? existing.reference_no : null)
    if (targetSoId) {
      try {
        const soRes = await drizzleGetRow({ resource: getResource("sales_orders"), id: targetSoId })
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
          await drizzleUpdateRow({ resource: getResource("sales_orders"), id: targetSoId, body: updatedSo })
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

  try {
    const available = []

    if (itemId) {
      // 1. Try relational pharma_product_batches
      const [batchRows] = await pool.query(
        "SELECT b.*, p.name as product_name, p.unit, p.selling_price as prod_selling_price, p.unit_cost as prod_unit_cost, p.warehouse_id as prod_wh FROM `pharma_product_batches` b JOIN `pharma_products` p ON b.product_id = p.id WHERE b.product_id = ? AND (b.qa_status != 'Quarantined' OR b.qa_status IS NULL) AND b.quantity > 0 ORDER BY b.expiry_date ASC, b.created_at ASC",
        [itemId]
      )
      if (batchRows.length > 0) {
        for (const b of batchRows) {
          const r = unwrapRow(b, "relational")
          available.push({
            id: r.id,
            batch_id: r.id,
            batch_no: r.batchNo || r.batch_no || "BATCH-MAIN",
            item_id: r.productId || itemId,
            item_name: r.productName || r.product_name,
            warehouse_id: warehouseId || r.warehouseId || r.warehouse_id || r.prodWh,
            available_quantity: Number(r.quantity ?? 0),
            manufacturing_date: r.mfgDate || r.mfg_date || "",
            expiry: r.expiryDate || r.expiry_date || "",
            expiry_date: r.expiryDate || r.expiry_date || "",
            packaging_unit: r.unit || "Box",
            unit_price: Number(r.prodSellingPrice || r.sellingPrice || r.unitCost || r.unit_cost || 0),
            unit_cost: Number(r.unitCost || r.unit_cost || r.prodUnitCost || 0),
          })
        }
        return { status: 200, body: available }
      }

      // 2. Try export commodity child entries (wh1 entries)
      const [grvRows] = await pool.query(
        "SELECT m.*, p.name as product_name, p.unit, p.selling_price as prod_selling_price, p.unit_cost as prod_unit_cost, p.warehouse_id as prod_wh FROM `export_warehouse_movements` m JOIN `export_products` p ON m.product_id = p.id WHERE m.product_id = ? AND (m.movement_type = 'GRV_ENTRY' OR m.movement_type = 'entry') AND m.net_quantity > 0 ORDER BY m.movement_date ASC, m.created_at ASC",
        [itemId]
      )
      if (grvRows.length > 0) {
        for (const g of grvRows) {
          const r = unwrapRow(g, "relational")
          available.push({
            id: r.id,
            batch_id: r.id,
            batch_no: r.voucherNo || r.voucher_no || r.batchNo || r.batch_no || "GRV-ENTRY",
            item_id: r.productId || itemId,
            item_name: r.productName || r.product_name,
            warehouse_id: warehouseId || r.warehouseId || r.warehouse_id || r.prodWh,
            available_quantity: Number(r.netQuantity ?? r.net_quantity ?? 0),
            manufacturing_date: r.movementDate || r.movement_date || "",
            expiry: "",
            expiry_date: "",
            packaging_unit: r.unit || "Quintal",
            unit_price: Number(r.prodSellingPrice || r.sellingPrice || r.unitCost || r.unit_cost || 0),
            unit_cost: Number(r.unitPrice || r.unit_price || r.prodUnitCost || 0),
          })
        }
        return { status: 200, body: available }
      }
    }

    const res = await inventoryService.listProducts()
    const products = Array.isArray(res.body) ? res.body : []

    for (const prod of products) {
      if (itemId && prod.id !== itemId) continue
      const prodBatches = Array.isArray(prod.batches) && prod.batches.length > 0
        ? prod.batches
        : [{ batchNo: prod.batch || prod.batch_no || "BATCH-MAIN", qty: prod.quantity || 1000, expiry: prod.expiry || prod.expiry_date }]

      for (const b of prodBatches) {
        const batchNo = b.batchNo || b.batch_no || prod.batch || prod.batch_no || "BATCH-MAIN"
        available.push({
          batch_id: b.id || b.batchId || batchNo,
          batch_no: batchNo,
          item_id: prod.id,
          item_name: prod.name,
          warehouse_id: warehouseId || prod.warehouse_id || prod.warehouse,
          available_quantity: Number(b.qty ?? b.quantity ?? prod.quantity ?? 1000),
          manufacturing_date: b.manufacturingDate || b.mfg_date || prod.manufacturingDate || prod.mfg_date || "",
          expiry: b.expiry || b.expiry_date || prod.expiry || prod.expiry_date || "",
          expiry_date: b.expiry || b.expiry_date || prod.expiry || prod.expiry_date || "",
          packaging_unit: prod.unit || "Box",
          unit_price: Number(prod.sellingPrice || prod.selling_price || prod.unitCost || prod.unit_cost || 0),
          unit_cost: Number(b.unit_cost || prod.unitCost || prod.unit_cost || 0),
        })
      }
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
      warehouse_id: warehouseId || "WH1",
      available_quantity: 1000,
      packaging_unit: "Box",
      unit_price: 1000,
      unit_cost: 800,
    },
  ]
  return { status: 200, body: fallbackBatch }
}
