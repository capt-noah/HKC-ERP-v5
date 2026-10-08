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
import { withTransaction } from "../../db/transactionHelper.js"
import crypto from "node:crypto"

async function runInTransaction(existingConn, callback) {
  if (existingConn) {
    return await callback(existingConn)
  }
  return await withTransaction(callback)
}

function serializeJsonColumn(val) {
  if (val === undefined || val === null) return null
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") return null
    try {
      JSON.parse(trimmed)
      return trimmed
    } catch {
      return JSON.stringify(val)
    }
  }
  try {
    return JSON.stringify(val)
  } catch (err) {
    console.warn("[serializeJsonColumn] JSON stringify error:", err)
    return null
  }
}

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
          unit_cost: Number(item.unit_cost || item.cost_price || matchedProd?.unitCost || matchedProd?.unit_cost || 0),
          cost_price: Number(item.cost_price || item.unit_cost || matchedProd?.unitCost || matchedProd?.unit_cost || 0),
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
        account_entries: issue.account_entries || issue.accountEntries || null,
        accountEntries: issue.account_entries || issue.accountEntries || null,
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

    const total = fullIssues.length
    const hasPagination = query.page !== undefined || query.pageSize !== undefined
    const page = Math.max(1, parseInt(query.page, 10) || 1)
    const pageSize = Math.max(1, parseInt(query.pageSize, 10) || 10)
    const pagedRows = hasPagination ? fullIssues.slice((page - 1) * pageSize, page * pageSize) : fullIssues

    return {
      status: 200,
      body: {
        rows: pagedRows,
        total,
        page: hasPagination ? page : 1,
        pageSize: hasPagination ? pageSize : total,
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

export function resolveCommodityAccounts(itemName = "") {
  const norm = String(itemName || "").toUpperCase().trim()

  if (norm.includes("SOYA") || norm.includes("SOY")) {
    return {
      inventoryCode: "1410-02",
      cogsCode: "5010-02",
      revenueCode: "4000-02-02",
    }
  }
  if ((norm.includes("REDISH") || norm.includes("REDDISH") || norm.includes("RED")) && (norm.includes("SESAME") || norm.includes("SESSAME") || norm.includes("SESEAM"))) {
    return {
      inventoryCode: "1410-03",
      cogsCode: "5010-03",
      revenueCode: "4000-02-03",
    }
  }
  if (norm.includes("SESAME") || norm.includes("SESSAME") || norm.includes("SESEAM")) {
    return {
      inventoryCode: "1410-04",
      cogsCode: "5010-04",
      revenueCode: "4000-02-04",
    }
  }
  if (norm.includes("BLACK") && (norm.includes("BEAN") || norm.includes("BEANS"))) {
    return {
      inventoryCode: "1410-05",
      cogsCode: "5010-01",
      revenueCode: "4000-02-01",
    }
  }
  // Default export commodity (Green Mung)
  return {
    inventoryCode: "1410-01",
    cogsCode: "5010-01",
    revenueCode: "4000-02-01",
  }
}

export function resolveSalesGLAccounts({ warehouseId, items = [], isCredit = false, allAccounts = [], mappingMap = new Map() }) {
  const findAcc = (code) => allAccounts.find(a => (a.code || a.account_code) === code)?.id || code
  const getMappedCode = (ruleId, fallbackCode) => mappingMap.get(ruleId) || fallbackCode
  const isWh1 = isExportWarehouse(warehouseId)

  // 1. Receivables / Cash (Debit for Sales Voucher)
  const debitCode = isCredit
    ? (isWh1 ? getMappedCode("sales_credit_ar_export", "1300-01") : getMappedCode("sales_credit_ar", "1300-03"))
    : getMappedCode("sales_cash_clearing", "1000-02-26")
  const debitAccId = findAcc(debitCode)

  let revenueAccId, inventoryAccId, cogsAccId

  if (isWh1) {
    const firstItemName = items[0]?.item_name || items[0]?.name || ""
    const commodity = resolveCommodityAccounts(firstItemName)

    // Use commodity-specific account when recognized, falling back to mapping matrix rule
    const exportRevCode = commodity.revenueCode || mappingMap.get("sales_revenue_export") || "4000-02-01"
    const exportInvCode = commodity.inventoryCode || mappingMap.get("inventory_stock_in_hand") || "1410-01"
    const exportCogsCode = commodity.cogsCode || mappingMap.get("cogs_export_fulfillment") || "5010-01"

    revenueAccId = findAcc(exportRevCode)
    inventoryAccId = findAcc(exportInvCode)
    cogsAccId = findAcc(exportCogsCode)
  } else {
    // Domestic / Pharma / Veterinary Import: dynamically resolved from COA mappings
    const pharmaRevCode = getMappedCode("sales_revenue_domestic", "4000-01-01")
    const pharmaInvCode = getMappedCode("inventory_pharma_stock", "1400-01")
    const pharmaCogsCode = getMappedCode("cogs_stock_fulfillment", "5000-01")

    revenueAccId = findAcc(pharmaRevCode)
    inventoryAccId = findAcc(pharmaInvCode)
    cogsAccId = findAcc(pharmaCogsCode)
  }

  const vatAccId = findAcc(getMappedCode("sales_vat_output", "2000-05"))
  return { debitAccId, revenueAccId, inventoryAccId, cogsAccId, vatAccId }
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
        account_entries: issue.account_entries || issue.accountEntries || null,
        accountEntries: issue.account_entries || issue.accountEntries || null,
        savedToDb: true,
      },
    }
  } catch (err) {
    console.warn("[sales_issues get exception]:", err?.message || err)
    return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
  }
}

async function reverseSalesIssuePosting(conn, issue) {
  const issueId = String(issue.id || "").trim()
  const fsNo = String(issue.fs_no || issue.issue_number || issueId).trim()
  const isWh1 = isExportWarehouse(issue.warehouse_id)

  // 1. Fetch items linked to this sales issue
  const [items] = await conn.query(
    "SELECT * FROM `sales_issue_items` WHERE sales_issue_id = ? OR sales_issue_id = ?",
    [issueId, fsNo]
  )

  if (isWh1) {
    // A. Remove OUTBOUND_DISPATCH movements
    await conn.query(
      "DELETE FROM `export_warehouse_movements` WHERE (voucher_no = ? OR voucher_no = ?) AND movement_type = 'OUTBOUND_DISPATCH'",
      [issueId, fsNo]
    )

    // B. Restore stock on export_products and GRVs
    for (const item of items) {
      const prodId = item.product_id || item.item_id
      const qty = Number(item.quantity || 0)
      if (!prodId || qty <= 0) continue

      await conn.query(
        `UPDATE \`export_products\` SET
          quantity = quantity + ?,
          quantity_sold = GREATEST(0, quantity_sold - ?),
          status = CASE WHEN (quantity + ?) > 0 THEN 'In Stock' ELSE status END,
          updated_at = NOW(3)
        WHERE id = ?`,
        [qty, qty, qty, prodId]
      )

      if (item.batch_id) {
        await conn.query(
          "UPDATE `export_warehouse_movements` SET net_quantity = net_quantity + ?, updated_at = NOW(3) WHERE id = ?",
          [qty, item.batch_id]
        )
      } else {
        await conn.query(
          "UPDATE `export_warehouse_movements` SET net_quantity = net_quantity + ?, updated_at = NOW(3) WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') ORDER BY movement_date DESC, created_at DESC LIMIT 1",
          [qty, prodId]
        )
      }
    }
  } else {
    // Pharma Products (WH2 / WH3)
    // A. Check for recorded stock_movements for this issue
    const [movements] = await conn.query(
      "SELECT * FROM `stock_movements` WHERE reference_type = 'SALES_ISSUE' AND (reference_id = ? OR reference_id = ?)",
      [issueId, fsNo]
    )

    const affectedProductIds = new Set()

    if (movements.length > 0) {
      for (const m of movements) {
        const prodId = m.product_id
        const moveQty = Number(m.quantity || 0)
        const batchNo = m.batch_no
        if (prodId) affectedProductIds.add(prodId)

        if (batchNo && !batchNo.includes(",")) {
          await conn.query(
            "UPDATE `pharma_product_batches` SET quantity = quantity + ?, updated_at = NOW(3) WHERE product_id = ? AND batch_no = ? LIMIT 1",
            [moveQty, prodId, batchNo]
          )
        } else if (batchNo && batchNo.includes(",")) {
          // If split across multiple batches, restore to product's earliest expiring batch
          await conn.query(
            "UPDATE `pharma_product_batches` SET quantity = quantity + ?, updated_at = NOW(3) WHERE product_id = ? ORDER BY expiry_date ASC LIMIT 1",
            [moveQty, prodId]
          )
        } else {
          await conn.query(
            "UPDATE `pharma_product_batches` SET quantity = quantity + ?, updated_at = NOW(3) WHERE product_id = ? ORDER BY expiry_date DESC LIMIT 1",
            [moveQty, prodId]
          )
        }
      }

      await conn.query(
        "DELETE FROM `stock_movements` WHERE reference_type = 'SALES_ISSUE' AND (reference_id = ? OR reference_id = ?)",
        [issueId, fsNo]
      )
    } else {
      // Fallback: restore from sales_issue_items directly
      for (const item of items) {
        const prodId = item.product_id || item.item_id
        const qty = Number(item.quantity || 0)
        const batchId = item.batch_id
        const batchNo = item.batch_no || item.batch_number
        if (!prodId || qty <= 0) continue
        affectedProductIds.add(prodId)

        if (batchId) {
          const [res] = await conn.query(
            "UPDATE `pharma_product_batches` SET quantity = quantity + ?, updated_at = NOW(3) WHERE id = ?",
            [qty, batchId]
          )
          if (res.affectedRows === 0 && batchNo) {
            await conn.query(
              "UPDATE `pharma_product_batches` SET quantity = quantity + ?, updated_at = NOW(3) WHERE product_id = ? AND batch_no = ? LIMIT 1",
              [qty, prodId, batchNo]
            )
          }
        } else if (batchNo) {
          await conn.query(
            "UPDATE `pharma_product_batches` SET quantity = quantity + ?, updated_at = NOW(3) WHERE product_id = ? AND batch_no = ? LIMIT 1",
            [qty, prodId, batchNo]
          )
        } else {
          await conn.query(
            "UPDATE `pharma_product_batches` SET quantity = quantity + ?, updated_at = NOW(3) WHERE product_id = ? ORDER BY expiry_date DESC LIMIT 1",
            [qty, prodId]
          )
        }
      }
    }

    // B. Recalculate parent pharma_products
    for (const prodId of affectedProductIds) {
      const [allBatches] = await conn.query(
        "SELECT * FROM `pharma_product_batches` WHERE product_id = ? AND (qa_status != 'Quarantined' OR qa_status IS NULL)",
        [prodId]
      )
      const newQty = allBatches.reduce((s, b) => s + Number(b.quantity || 0), 0)
      const totalStockVal = allBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.unit_cost || 0)), 0)

      const [pRows] = await conn.query("SELECT * FROM `pharma_products` WHERE id = ?", [prodId])
      if (pRows.length > 0) {
        const prod = pRows[0]
        const packSize = Number(prod.quantity_per_pack || 1)
        const updatedCartons = packSize > 0 ? Math.floor(newQty / packSize) : Number(prod.number_of_cartons || 0)
        const unitCost = Number(prod.unit_cost || 0)
        const newWeightedCost = newQty > 0 ? Math.round((totalStockVal / newQty) * 100) / 100 : unitCost
        const totalItemsQty = items.filter(it => (it.product_id || it.item_id) === prodId).reduce((s, it) => s + Number(it.quantity || 0), 0)

        await conn.query(
          `UPDATE \`pharma_products\` SET
            quantity = ?,
            quantity_sold = GREATEST(0, quantity_sold - ?),
            unit_cost = ?,
            number_of_cartons = ?,
            status = CASE WHEN ? = 0 THEN 'Out of Stock' WHEN ? < 20 THEN 'Low Stock' ELSE 'In Stock' END,
            updated_at = NOW(3)
          WHERE id = ?`,
          [newQty, totalItemsQty, newWeightedCost, updatedCartons, newQty, newQty, prodId]
        )
      }
    }
  }

  // 2. Delete Journal Entries and Lines
  const jeIds = [
    `JE-SALE-${issueId}`,
    `JE-SALE-${fsNo}`,
    `JE-COGS-${issueId}`,
    `JE-COGS-${fsNo}`,
  ]
  const [matchingJes] = await conn.query(
    "SELECT id FROM `journal_entries` WHERE source_id IN (?, ?) OR id IN (?, ?, ?, ?)",
    [issueId, fsNo, ...jeIds]
  )
  const allJeIdsToDelete = Array.from(new Set([...jeIds, ...matchingJes.map(j => j.id)]))
  for (const jId of allJeIdsToDelete) {
    await conn.query("DELETE FROM `journal_entries` WHERE id = ?", [jId])
  }

  // 3. Mark linked invoice as Cancelled
  await conn.query(
    "UPDATE `invoices` SET status = 'Cancelled', balance_due = 0, updated_at = NOW(3) WHERE id IN (?, ?) OR sales_issue_id IN (?, ?) OR fs_no IN (?, ?)",
    [`INV-SI-${issueId}`, `INV-SI-${fsNo}`, issueId, fsNo, issueId, fsNo]
  )

  // 4. Revert linked sales order if applicable
  const soId = issue.sales_order_id || (issue.reference_no && String(issue.reference_no).startsWith("SO-") ? issue.reference_no : null)
  if (soId) {
    await conn.query(
      "UPDATE `sales_orders` SET stage = 'Confirmed', delivery_status = 'Pending', delivered_amount = 0, updated_at = NOW(3) WHERE id = ?",
      [soId]
    )
  }
}

export async function createSalesIssue(input, existingId = null, existingConn = null) {
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

  try {
    return await runInTransaction(existingConn, async (conn) => {
      // 1. Save Header
      await conn.query(
        `INSERT INTO \`sales_issues\` (
          id, fs_no, reference_no, sales_order_id, issue_number, sale_date,
          customer_id, customer_name, warehouse_id, payment_type, status,
          total_quantity, total_amount, subtotal_amount, tax_amount,
          payment_status, payment_method, account_entries, created_by, posted_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          fs_no = VALUES(fs_no),
          reference_no = VALUES(reference_no),
          sales_order_id = VALUES(sales_order_id),
          issue_number = VALUES(issue_number),
          sale_date = VALUES(sale_date),
          customer_id = VALUES(customer_id),
          customer_name = VALUES(customer_name),
          warehouse_id = VALUES(warehouse_id),
          payment_type = VALUES(payment_type),
          status = VALUES(status),
          total_quantity = VALUES(total_quantity),
          total_amount = VALUES(total_amount),
          subtotal_amount = VALUES(subtotal_amount),
          tax_amount = VALUES(tax_amount),
          payment_status = VALUES(payment_status),
          payment_method = VALUES(payment_method),
          account_entries = VALUES(account_entries),
          updated_at = NOW(3)`,
        [
          id,
          fs_no,
          reference_no,
          sales_order_id,
          fs_no,
          sale_date,
          customer_id,
          customer_name,
          warehouse_id,
          payment_type,
          String(doc.status).toLowerCase() === "posted" ? "Draft" : doc.status,
          total_quantity,
          finalTotalAmount,
          subtotal,
          vat_amount,
          payment_type === "Cash" ? "Paid" : "Unpaid",
          payment_type,
          serializeJsonColumn(doc.account_entries !== undefined ? doc.account_entries : doc.accountEntries),
          doc.created_by || "Sales Officer",
          doc.status === "Posted" ? (doc.posted_by || "Sales Officer") : null,
        ]
      )

      // 2. Save Items
      await conn.query("DELETE FROM `sales_issue_items` WHERE sales_issue_id = ?", [id])

      for (const [idx, item] of items.entries()) {
        const prodId = String(item.item_id || item.productId || item.product_id || `ITEM-${idx + 1}`)
        const prodName = String(item.item_name || item.product_name || item.name || "Item")
        const batchCode = String(item.batch_no || item.batch_id || item.batch_number || "BATCH-MAIN")
        const q = Number(item.quantity || item.qty || 0)
        const p = Number(item.unit_price || item.price || 0)
        const tot = Number(item.amount || item.total_price || (q * p) || 0)

        await conn.query(
          `INSERT INTO \`sales_issue_items\` (
            id, sales_issue_id, product_id, item_id, item_name,
            batch_id, batch_no, batch_number, quantity, unit_price,
            total_price, amount, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            String(item.id || `${id}-ITEM-${idx + 1}`),
            id,
            prodId,
            prodId,
            prodName,
            batchCode,
            batchCode,
            batchCode,
            q,
            p,
            tot,
            tot,
          ]
        )
      }

      // 3. Auto-post if marked Posted
      if (String(doc.status).toLowerCase() === "posted") {
        await postSalesIssue(id, null, conn)
      }

      return { status: 200, body: { ...doc, savedToDb: true } }
    })
  } catch (err) {
    console.error("[createSalesIssue error]:", err)
    return { status: 500, body: { error: "Failed to create sales issue", message: err.message } }
  }
}

export async function updateSalesIssue(input, id, existingConn = null) {
  const cleanId = String(id).trim()

  try {
    return await runInTransaction(existingConn, async (conn) => {
      const [existingRows] = await conn.query(
        "SELECT * FROM `sales_issues` WHERE id = ? OR fs_no = ? OR issue_number = ? FOR UPDATE",
        [cleanId, cleanId, cleanId]
      )
      if (existingRows.length === 0) {
        return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
      }

      const existing = existingRows[0]
      const items = Array.isArray(input?.items) ? input.items : []
      const total_quantity = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0)
      const itemTotal = items.reduce((sum, item) => sum + Number(item.amount || (item.quantity * item.unit_price) || 0), 0)

      const warehouse_id = input?.warehouse_id || existing.warehouse_id
      const subtotal = input?.subtotal !== undefined ? Number(input.subtotal) : (itemTotal || Number(existing.subtotal_amount || 0))
      const vat_rate = input?.vat_rate !== undefined ? Number(input.vat_rate) : (input?.tax_rate !== undefined ? Number(input.tax_rate) : Number(existing.vat_rate || 0))
      const vat_amount = input?.vat_amount !== undefined ? Number(input.vat_amount) : (input?.tax_amount !== undefined ? Number(input.tax_amount) : (vat_rate > 0 ? Math.round(subtotal * (vat_rate / 100)) : 0))
      const finalTotalAmount = input?.total_amount !== undefined ? Number(input.total_amount) : (subtotal + vat_amount)

      const incomingSoId = input?.sales_order_id !== undefined ? input.sales_order_id : (input?.salesOrderId !== undefined ? input.salesOrderId : existing.sales_order_id)
      const incomingRef = input?.reference_no !== undefined ? input.reference_no : (input?.referenceNo !== undefined ? input.referenceNo : existing.reference_no)
      const resolvedSoId = incomingSoId || (incomingRef && String(incomingRef).startsWith("SO-") ? incomingRef : null)

      const payment_type = input?.payment_type || existing.payment_type || "Cash"
      const isCash = payment_type.toLowerCase() === "cash"
      const amount_paid = input?.amount_paid !== undefined ? Number(input.amount_paid) : (existing.amount_paid !== undefined ? Number(existing.amount_paid) : (isCash ? finalTotalAmount : 0))
      const balance_due = input?.balance_due !== undefined ? Number(input.balance_due) : (existing.balance_due !== undefined ? Number(existing.balance_due) : (isCash ? 0 : finalTotalAmount))
      const payment_status = input?.payment_status || (balance_due <= 0 || isCash ? "Paid" : (amount_paid > 0 ? "Partially Paid" : "Unpaid"))

      await conn.query(
        `UPDATE \`sales_issues\` SET
          fs_no = ?,
          reference_no = ?,
          sales_order_id = ?,
          issue_number = ?,
          sale_date = ?,
          customer_id = ?,
          customer_name = ?,
          warehouse_id = ?,
          payment_type = ?,
          status = ?,
          total_quantity = ?,
          total_amount = ?,
          subtotal_amount = ?,
          tax_amount = ?,
          payment_status = ?,
          payment_method = ?,
          account_entries = ?,
          updated_at = NOW(3)
        WHERE id = ?`,
        [
          input?.fs_no || existing.fs_no || cleanId,
          incomingRef || null,
          resolvedSoId || null,
          input?.fs_no || existing.fs_no || cleanId,
          input?.sale_date || existing.sale_date || new Date().toISOString().split("T")[0],
          input?.customer_id || existing.customer_id || null,
          input?.customer_name || existing.customer_name || null,
          warehouse_id || null,
          payment_type,
          input?.status || existing.status || "Draft",
          total_quantity || existing.total_quantity,
          finalTotalAmount,
          subtotal,
          vat_amount,
          payment_status,
          payment_type,
          serializeJsonColumn(
            input?.account_entries !== undefined
              ? input.account_entries
              : (input?.accountEntries !== undefined ? input.accountEntries : existing.account_entries)
          ),
          existing.id,
        ]
      )

      if (items.length > 0) {
        await conn.query("DELETE FROM `sales_issue_items` WHERE sales_issue_id = ?", [existing.id])
        for (const [idx, item] of items.entries()) {
          const prodId = String(item.item_id || item.productId || item.product_id || `ITEM-${idx + 1}`)
          const prodName = String(item.item_name || item.product_name || item.name || "Item")
          const batchCode = String(item.batch_no || item.batch_id || item.batch_number || "BATCH-MAIN")
          const q = Number(item.quantity || item.qty || 0)
          const p = Number(item.unit_price || item.price || 0)
          const tot = Number(item.amount || item.total_price || (q * p) || 0)

          await conn.query(
            `INSERT INTO \`sales_issue_items\` (
              id, sales_issue_id, product_id, item_id, item_name,
              batch_id, batch_no, batch_number, quantity, unit_price,
              total_price, amount, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
            [
              String(item.id || `${existing.id}-ITEM-${idx + 1}`),
              existing.id,
              prodId,
              prodId,
              prodName,
              batchCode,
              batchCode,
              batchCode,
              q,
              p,
              tot,
              tot,
            ]
          )
        }
      }

      return { status: 200, body: { ...existing, ...input, total_quantity, total_amount: finalTotalAmount, items, savedToDb: true } }
    })
  } catch (err) {
    console.error("[updateSalesIssue error]:", err)
    return { status: 500, body: { error: "Failed to update sales issue", message: err.message } }
  }
}

export async function deleteSalesIssue(id, existingConn = null) {
  try {
    return await runInTransaction(existingConn, async (conn) => {
      const cleanId = String(id).trim()
      const [issueRows] = await conn.query(
        "SELECT * FROM `sales_issues` WHERE id = ? OR fs_no = ? OR issue_number = ? FOR UPDATE",
        [cleanId, cleanId, cleanId]
      )
      if (issueRows.length === 0) {
        return { status: 200, body: { ok: true, deletedId: id } }
      }

      const issue = issueRows[0]
      if ((issue.status || "").toUpperCase() === "POSTED") {
        await reverseSalesIssuePosting(conn, issue)
      }

      // Delete linked invoices
      await conn.query(
        "DELETE FROM `invoices` WHERE id IN (?, ?) OR sales_issue_id IN (?, ?) OR fs_no IN (?, ?)",
        [`INV-SI-${issue.id}`, `INV-SI-${issue.fs_no}`, issue.id, issue.fs_no, issue.id, issue.fs_no]
      )

      // Delete items
      await conn.query(
        "DELETE FROM `sales_issue_items` WHERE sales_issue_id = ? OR sales_issue_id = ?",
        [issue.id, issue.fs_no]
      )

      // Delete header
      await conn.query(
        "DELETE FROM `sales_issues` WHERE id = ?",
        [issue.id]
      )

      return { status: 200, body: { ok: true, deletedId: id } }
    })
  } catch (err) {
    console.error("[deleteSalesIssue error]:", err)
    return { status: 500, body: { error: "Failed to delete sales issue", message: err.message } }
  }
}

export async function postSalesIssue(arg1, arg2 = null, existingConn = null) {
  let connArg = existingConn
  let id = typeof arg1 === "string" ? arg1 : arg1?.id
  if (!id && typeof arg2 === "string") {
    id = arg2
  }
  if (!connArg && arg2 && typeof arg2.query === "function") {
    connArg = arg2
  }
  if (!id) {
    return { status: 400, body: { error: "Sales issue ID is required to post." } }
  }

  try {
    return await runInTransaction(connArg, async (conn) => {
      const cleanId = String(id).trim()
      const [issueRows] = await conn.query(
        "SELECT * FROM `sales_issues` WHERE id = ? OR fs_no = ? OR issue_number = ? FOR UPDATE",
        [cleanId, cleanId, cleanId]
      )
      if (issueRows.length === 0) {
        return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
      }

      const existing = issueRows[0]
      const statusUpper = (existing.status || "").toUpperCase()
      if (statusUpper === "POSTED") {
        return { status: 400, body: { error: `Sales issue '${id}' is already posted.` } }
      }

      // 1. Fetch items
      const [itemRows] = await conn.query(
        "SELECT * FROM `sales_issue_items` WHERE sales_issue_id = ? OR sales_issue_id = ?",
        [existing.id, existing.fs_no]
      )
      const itemsToProcess = itemRows.length > 0 ? itemRows : (existing.items || [])

      // 2. Fetch products for matching
      const [pharmaProds] = await conn.query("SELECT * FROM `pharma_products`")
      const [exportProds] = await conn.query("SELECT * FROM `export_products`")

      let totalCost = 0
      let totalAmount = 0
      let totalQty = 0

      for (const item of itemsToProcess) {
        const prodId = item.product_id || item.item_id
        const itemName = (item.item_name || "").toLowerCase().trim()
        const issueQty = Number(item.quantity || 0)
        const itemSellingPrice = Number(item.unit_price || 0)

        totalQty += issueQty
        totalAmount += issueQty * itemSellingPrice

        // Match export or pharma
        let matchedExport = exportProds.find(p => p.id === prodId || (p.name && p.name.toLowerCase().trim() === itemName))
        let matchedPharma = pharmaProds.find(p => p.id === prodId || (p.name && p.name.toLowerCase().trim() === itemName))

        const isWh1 =
          isExportWarehouse(existing.warehouse_id) ||
          Boolean(matchedExport) ||
          (matchedPharma && isExportWarehouse(matchedPharma.warehouse_id))

        if (isWh1) {
          const prod = matchedExport || matchedPharma
          const realProdId = prod?.id || prodId
          const unitCost = Number(prod?.unit_cost || 0)

          let remainingToDeduct = issueQty
          let totalDeductedCost = 0

          let grvRows = []
          if (item.batch_id) {
            const [selectedRows] = await conn.query(
              "SELECT * FROM `export_warehouse_movements` WHERE id = ? AND net_quantity > 0 FOR UPDATE",
              [item.batch_id]
            )
            grvRows = selectedRows
          }
          if (grvRows.length === 0) {
            const [allActiveGrvs] = await conn.query(
              "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry') AND net_quantity > 0 ORDER BY movement_date ASC, created_at ASC FOR UPDATE",
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

            await conn.query(
              "UPDATE `export_warehouse_movements` SET net_quantity = ?, updated_at = NOW(3) WHERE id = ?",
              [newNet, grv.id]
            )
          }

          const leaveCOGSUnitCost = issueQty > 0 && totalDeductedCost > 0 ? Math.round((totalDeductedCost / issueQty) * 100) / 100 : unitCost
          totalCost += totalDeductedCost > 0 ? totalDeductedCost : issueQty * unitCost

          const commercialSellingPrice = itemSellingPrice > 0 ? itemSellingPrice : Number(prod?.selling_price || 0)
          const dispatchMovId = `EWM-DISP-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`

          await conn.query(
            `INSERT INTO \`export_warehouse_movements\` (
              id, warehouse_id, product_id, movement_type, voucher_no, batch_no,
              party_name, plate_number, gross_quantity, reject_quantity, net_quantity,
              uom, unit_price, selling_price, movement_date, reason, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, 'OUTBOUND_DISPATCH', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'Sales Officer', NOW(3), NOW(3))`,
            [
              dispatchMovId,
              existing.warehouse_id || "WH1",
              realProdId,
              existing.fs_no || existing.id,
              item.batch_no || "COMMODITY-WH1",
              existing.customer_name || "Customer Dispatch",
              existing.plate_number || "—",
              issueQty,
              -issueQty,
              prod?.unit || "Quintal",
              leaveCOGSUnitCost,
              commercialSellingPrice > 0 ? commercialSellingPrice : null,
              existing.sale_date || getLocalDateString(),
              `Sales Issue FS-${existing.fs_no || existing.id} (Customer Dispatch)`,
            ]
          )

          const [allGrvs] = await conn.query(
            "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? AND (movement_type = 'GRV_ENTRY' OR movement_type = 'entry')",
            [realProdId]
          )
          const newQty = allGrvs.reduce((sum, g) => sum + Number(g.net_quantity || 0), 0)
          const remainingVal = allGrvs.reduce((sum, g) => sum + (Number(g.net_quantity || 0) * Number(g.unit_price || 0)), 0)
          const cumulativeIntakeVal = Number(prod?.total_stock_value || 0) || allGrvs.reduce((sum, g) => sum + (Number(g.gross_quantity || g.net_quantity || 0) * Number(g.unit_price || 0)), 0)
          const weightedCost = newQty > 0 ? Math.round((remainingVal / newQty) * 100) / 100 : unitCost

          await conn.query(
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
              newQty + (Number(prod?.quantity_sold || 0) + issueQty),
              weightedCost,
              cumulativeIntakeVal,
              newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock",
              realProdId,
            ]
          )
        } else {
          // Pharma (WH2 / WH3)
          const prod = matchedPharma || matchedExport
          const realProdId = prod?.id || prodId
          const unitCost = Number(prod?.unit_cost || 0)

          let targetBatchId = item.batch_id
          let targetBatchNo = item.batch_no || item.batch_number
          let remainingPharmaDeduct = issueQty
          let totalDeductedPharmaCost = 0
          const deductedBatchNos = []

          if (targetBatchId) {
            const [bRows] = await conn.query(
              "SELECT * FROM `pharma_product_batches` WHERE id = ? FOR UPDATE",
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
              await conn.query(
                "UPDATE `pharma_product_batches` SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
                [deduct, b.id]
              )
            }
          }

          if (remainingPharmaDeduct > 0 && targetBatchNo) {
            const [bRows] = await conn.query(
              "SELECT * FROM `pharma_product_batches` WHERE product_id = ? AND batch_no = ? AND quantity > 0 AND (qa_status != 'Quarantined' OR qa_status IS NULL) ORDER BY expiry_date ASC, created_at ASC FOR UPDATE",
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
              await conn.query(
                "UPDATE `pharma_product_batches` SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
                [deduct, b.id]
              )
            }
          }

          if (remainingPharmaDeduct > 0) {
            const [bRows] = await conn.query(
              "SELECT * FROM `pharma_product_batches` WHERE product_id = ? AND quantity > 0 AND (qa_status != 'Quarantined' OR qa_status IS NULL) ORDER BY expiry_date ASC, created_at ASC FOR UPDATE",
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
              await conn.query(
                "UPDATE `pharma_product_batches` SET quantity = GREATEST(0, quantity - ?), updated_at = NOW(3) WHERE id = ?",
                [deduct, b.id]
              )
            }
          }

          if (remainingPharmaDeduct > 0) {
            totalDeductedPharmaCost += remainingPharmaDeduct * unitCost
          }

          const leavePharmaCOGSUnitCost = issueQty > 0
            ? Math.round((totalDeductedPharmaCost / issueQty) * 100) / 100
            : unitCost
          totalCost += totalDeductedPharmaCost

          const [allBatches] = await conn.query(
            "SELECT * FROM `pharma_product_batches` WHERE product_id = ? AND (qa_status != 'Quarantined' OR qa_status IS NULL)",
            [realProdId]
          )
          const newQty = allBatches.reduce((s, b) => s + Number(b.quantity || 0), 0)
          const totalStockVal = allBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.unit_cost || 0)), 0)
          const newWeightedCost = newQty > 0 ? Math.round((totalStockVal / newQty) * 100) / 100 : unitCost

          const smId = `SM-ISSUE-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`
          const recordedBatchNo = deductedBatchNos.length > 0 ? deductedBatchNos.join(", ") : targetBatchNo || "BATCH-ISSUE"
          await conn.query(
            `INSERT INTO stock_movements (
              id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price, selling_price,
              balance_after, batch_no, expiry_date, reference_type, reference_id, notes, party, performed_by, movement_date,
              created_at, updated_at
            ) VALUES (?, ?, ?, 'ISSUE', ?, ?, ?, ?, ?, ?, ?, 'SALES_ISSUE', ?, ?, ?, 'Sales Officer', ?, NOW(3), NOW(3))`,
            [
              smId,
              realProdId,
              prod?.warehouse_id || existing.warehouse_id || "WH2",
              issueQty,
              leavePharmaCOGSUnitCost,
              leavePharmaCOGSUnitCost,
              itemSellingPrice > 0 ? itemSellingPrice : null,
              newQty,
              recordedBatchNo,
              item.expiry_date || null,
              existing.fs_no || existing.id,
              `Sales Issue FS-${existing.fs_no || existing.id} (${existing.customer_name || 'Customer Dispatch'})`,
              existing.customer_name || "Customer Dispatch",
              existing.sale_date || getLocalDateString(),
            ]
          )

          const packSize = Number(prod?.quantity_per_pack || 1)
          const updatedCartons = packSize > 0 ? Math.floor(newQty / packSize) : Number(prod?.number_of_cartons || 0)
          const cumulativeIntakeVal = Number(prod?.total_stock_value || 0) || totalStockVal
          await conn.query(
            `UPDATE pharma_products SET
              quantity = ?,
              total_quantity = ?,
              quantity_sold = quantity_sold + ?,
              unit_cost = ?,
              number_of_cartons = ?,
              total_stock_value = ?,
              status = ?,
              updated_at = NOW(3)
             WHERE id = ?`,
            [
              newQty,
              newQty + (Number(prod?.quantity_sold || 0) + issueQty),
              issueQty,
              newWeightedCost,
              updatedCartons,
              cumulativeIntakeVal,
              newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock",
              realProdId,
            ]
          )
        }
      }

      // 3. Update Sales Issue Header
      const issueSubtotal = totalAmount || Number(existing.subtotal_amount || existing.total_amount || 0)
      const issueVatRate = Number(existing.vat_rate !== undefined ? existing.vat_rate : 0)
      const issueVatAmount = Number(existing.tax_amount !== undefined ? existing.tax_amount : (issueVatRate > 0 ? Math.round(issueSubtotal * (issueVatRate / 100)) : 0))
      const grandTotal = issueSubtotal + issueVatAmount

      const isCash = (existing.payment_type || "").toString().toLowerCase() === "cash"
      const existingPaid = Number(existing.amount_paid !== undefined ? existing.amount_paid : (isCash ? grandTotal : 0))
      const existingBal = isCash ? 0 : Number(existing.balance_due !== undefined ? existing.balance_due : Math.max(0, grandTotal - existingPaid))
      const isFullySettled = isCash || (grandTotal > 0 && existingPaid >= grandTotal)

      const paymentStatus = isFullySettled ? "Paid" : (existingPaid > 0 ? "Partially Paid" : "Unpaid")
      const settlementStatus = isFullySettled ? "Fully Settled" : (existingPaid > 0 ? "Ongoing" : "Unpaid")

      await conn.query(
        `UPDATE \`sales_issues\` SET
          status = 'Posted',
          posted_at = NOW(3),
          posted_by = 'Sales Officer',
          total_quantity = ?,
          subtotal_amount = ?,
          tax_amount = ?,
          total_amount = ?,
          payment_status = ?,
          updated_at = NOW(3)
        WHERE id = ?`,
        [totalQty || existing.total_quantity, issueSubtotal, issueVatAmount, grandTotal, paymentStatus, existing.id]
      )

      // 4. Double-Entry Journal Entries
      const [coaRows] = await conn.query("SELECT * FROM `chart_of_accounts`")
      const [mappingRows] = await conn.query("SELECT * FROM `gl_account_mappings`")
      const allAccounts = coaRows.map(a => a?.payload ? { ...a.payload, ...a } : a)
      const allMappings = mappingRows.map(m => m?.payload ? { ...m.payload, ...m } : m)
      const mappingMap = new Map(allMappings.map(m => [m.id, m.account_code || m.account_id]))
      const accMap = new Map(allAccounts.map(a => [a.id || a.code, a]))

      const getAccInfo = (idOrCode) => {
        const a = accMap.get(idOrCode)
        return { code: a?.code || idOrCode, name: a?.name || "Account" }
      }

      const isCredit = (existing.payment_type || "").toString().toLowerCase().includes("credit")
      const { debitAccId, revenueAccId, inventoryAccId, cogsAccId, vatAccId } = resolveSalesGLAccounts({
        warehouseId: existing.warehouse_id,
        items: itemsToProcess,
        isCredit,
        allAccounts,
        mappingMap,
      })

      const saleJeId = `JE-SALE-${existing.fs_no || existing.id}`
      const cogsJeId = `JE-COGS-${existing.fs_no || existing.id}`

      // A. Sales Journal Entry Header
      const saleJePayload = {
        id: saleJeId,
        entry_number: saleJeId,
        entry_date: existing.sale_date || getLocalDateString(),
        description: `Sales issue ${existing.fs_no || existing.id}`,
        source_type: "Sales Issue",
        source_id: existing.fs_no || existing.id,
        created_by: "Sales Officer",
        currency: "ETB",
        exchange_rate: 1.0,
        total_amount: grandTotal,
        posting_status: "POSTED",
      }
      const jeInsertSql = `
        INSERT INTO \`journal_entries\` 
          (id, entry_number, entry_date, description, source_type, source_id, created_by, currency, exchange_rate, total_amount, posting_status, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3)) 
        ON DUPLICATE KEY UPDATE 
          entry_number = VALUES(entry_number),
          entry_date = VALUES(entry_date),
          description = VALUES(description),
          source_type = VALUES(source_type),
          source_id = VALUES(source_id),
          total_amount = VALUES(total_amount),
          posting_status = VALUES(posting_status),
          updated_at = NOW(3)
      `

      const jelInsertSql = `
        INSERT INTO \`journal_entry_lines\` 
          (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, currency, exchange_rate_at_time, warehouse_id, party_type, party_id, party_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE 
          journal_entry_id = VALUES(journal_entry_id),
          account_id = VALUES(account_id),
          account_code = VALUES(account_code),
          account_name = VALUES(account_name),
          description = VALUES(description),
          debit_amount = VALUES(debit_amount),
          credit_amount = VALUES(credit_amount),
          warehouse_id = VALUES(warehouse_id),
          party_type = VALUES(party_type),
          party_id = VALUES(party_id),
          party_name = VALUES(party_name),
          updated_at = NOW(3)
      `

      await conn.query(jeInsertSql, [
        saleJeId,
        saleJePayload.entry_number,
        saleJePayload.entry_date,
        saleJePayload.description,
        saleJePayload.source_type,
        saleJePayload.source_id,
        saleJePayload.created_by,
        saleJePayload.currency,
        saleJePayload.exchange_rate,
        saleJePayload.total_amount,
        saleJePayload.posting_status,
      ])

      // B. Sales Journal Entry Lines
      const debitInfo = getAccInfo(debitAccId)
      const drLine = {
        id: `${saleJeId}-DR`,
        journal_entry_id: saleJeId,
        account_id: debitAccId,
        account_code: debitInfo.code,
        account_name: debitInfo.name,
        debit_amount: grandTotal,
        credit_amount: 0,
        currency: "ETB",
        exchange_rate_at_time: 1.0,
        warehouse_id: existing.warehouse_id || null,
        party_type: "Customer",
        party_id: existing.customer_id || null,
        party_name: existing.customer_name || null,
        description: `Customer settlement for Issue ${existing.fs_no || existing.id}`,
        entry_date: existing.sale_date || getLocalDateString(),
      }
      await conn.query(jelInsertSql, [
        drLine.id,
        drLine.journal_entry_id,
        drLine.account_id,
        drLine.account_code,
        drLine.account_name,
        drLine.description,
        drLine.debit_amount,
        drLine.credit_amount,
        drLine.currency,
        drLine.exchange_rate_at_time,
        drLine.warehouse_id,
        drLine.party_type,
        drLine.party_id,
        drLine.party_name,
      ])

      const revInfo = getAccInfo(revenueAccId)
      const crLine = {
        id: `${saleJeId}-CR`,
        journal_entry_id: saleJeId,
        account_id: revenueAccId,
        account_code: revInfo.code,
        account_name: revInfo.name,
        debit_amount: 0,
        credit_amount: issueSubtotal,
        currency: "ETB",
        exchange_rate_at_time: 1.0,
        warehouse_id: existing.warehouse_id || null,
        party_type: "Customer",
        party_id: existing.customer_id || null,
        party_name: existing.customer_name || null,
        description: `Sales revenue for Issue ${existing.fs_no || existing.id}`,
        entry_date: existing.sale_date || getLocalDateString(),
      }
      await conn.query(jelInsertSql, [
        crLine.id,
        crLine.journal_entry_id,
        crLine.account_id,
        crLine.account_code,
        crLine.account_name,
        crLine.description,
        crLine.debit_amount,
        crLine.credit_amount,
        crLine.currency,
        crLine.exchange_rate_at_time,
        crLine.warehouse_id,
        crLine.party_type,
        crLine.party_id,
        crLine.party_name,
      ])

      if (issueVatAmount > 0) {
        const vatInfo = getAccInfo(vatAccId)
        const vatLine = {
          id: `${saleJeId}-VAT`,
          journal_entry_id: saleJeId,
          account_id: vatAccId,
          account_code: vatInfo.code,
          account_name: vatInfo.name,
          debit_amount: 0,
          credit_amount: issueVatAmount,
          currency: "ETB",
          exchange_rate_at_time: 1.0,
          warehouse_id: existing.warehouse_id || null,
          party_type: "Customer",
          party_id: existing.customer_id || null,
          party_name: existing.customer_name || null,
          description: `Output VAT for Issue ${existing.fs_no || existing.id}`,
          entry_date: existing.sale_date || getLocalDateString(),
        }
        await conn.query(jelInsertSql, [
          vatLine.id,
          vatLine.journal_entry_id,
          vatLine.account_id,
          vatLine.account_code,
          vatLine.account_name,
          vatLine.description,
          vatLine.debit_amount,
          vatLine.credit_amount,
          vatLine.currency,
          vatLine.exchange_rate_at_time,
          vatLine.warehouse_id,
          vatLine.party_type,
          vatLine.party_id,
          vatLine.party_name,
        ])
      }

      // C. COGS Journal Entry
      if (totalCost > 0) {
        const cogsJePayload = {
          id: cogsJeId,
          entry_number: cogsJeId,
          entry_date: existing.sale_date || getLocalDateString(),
          description: `COGS — Sales Issue ${existing.fs_no || existing.id}`,
          source_type: "Sales Issue",
          source_id: existing.fs_no || existing.id,
          created_by: "Sales Officer",
          currency: "ETB",
          exchange_rate: 1.0,
          total_amount: totalCost,
          posting_status: "POSTED",
        }
        await conn.query(jeInsertSql, [
          cogsJeId,
          cogsJePayload.entry_number,
          cogsJePayload.entry_date,
          cogsJePayload.description,
          cogsJePayload.source_type,
          cogsJePayload.source_id,
          cogsJePayload.created_by,
          cogsJePayload.currency,
          cogsJePayload.exchange_rate,
          cogsJePayload.total_amount,
          cogsJePayload.posting_status,
        ])

        const cogsInfo = getAccInfo(cogsAccId)
        const cogsDrLine = {
          id: `${cogsJeId}-DR`,
          journal_entry_id: cogsJeId,
          account_id: cogsAccId,
          account_code: cogsInfo.code,
          account_name: cogsInfo.name,
          debit_amount: totalCost,
          credit_amount: 0,
          currency: "ETB",
          exchange_rate_at_time: 1.0,
          warehouse_id: existing.warehouse_id || null,
          description: `COGS expense for Issue ${existing.fs_no || existing.id}`,
          entry_date: existing.sale_date || getLocalDateString(),
        }
        await conn.query(jelInsertSql, [
          cogsDrLine.id,
          cogsDrLine.journal_entry_id,
          cogsDrLine.account_id,
          cogsDrLine.account_code,
          cogsDrLine.account_name,
          cogsDrLine.description,
          cogsDrLine.debit_amount,
          cogsDrLine.credit_amount,
          cogsDrLine.currency,
          cogsDrLine.exchange_rate_at_time,
          cogsDrLine.warehouse_id,
          null,
          null,
          null,
        ])

        const invInfo = getAccInfo(inventoryAccId)
        const invCrLine = {
          id: `${cogsJeId}-CR`,
          journal_entry_id: cogsJeId,
          account_id: inventoryAccId,
          account_code: invInfo.code,
          account_name: invInfo.name,
          debit_amount: 0,
          credit_amount: totalCost,
          currency: "ETB",
          exchange_rate_at_time: 1.0,
          warehouse_id: existing.warehouse_id || null,
          description: `Inventory stock relief for Issue ${existing.fs_no || existing.id}`,
          entry_date: existing.sale_date || getLocalDateString(),
        }
        await conn.query(jelInsertSql, [
          invCrLine.id,
          invCrLine.journal_entry_id,
          invCrLine.account_id,
          invCrLine.account_code,
          invCrLine.account_name,
          invCrLine.description,
          invCrLine.debit_amount,
          invCrLine.credit_amount,
          invCrLine.currency,
          invCrLine.exchange_rate_at_time,
          invCrLine.warehouse_id,
          null,
          null,
          null,
        ])
      }

      // 5. Authoritative Invoice in `invoices`
      const invId = `INV-SI-${existing.fs_no || existing.id}`
      const invoiceNumber = `INV-${existing.fs_no || existing.reference_no || existing.id}`
      const lineItems = itemsToProcess.map(i => ({
        description: i.item_name || "Issued Item",
        quantity: Number(i.quantity || 1),
        unit_price: Number(i.unit_price || 0),
        line_total: Number(i.amount || (Number(i.quantity || 1) * Number(i.unit_price || 0))),
      }))
      const glDist = {
        revenue_lines: [
          { account_id: debitAccId, debit: grandTotal, credit: 0, description: "Customer Settlement" },
          { account_id: revenueAccId, debit: 0, credit: issueSubtotal, description: "Sales Revenue" },
          ...(issueVatAmount > 0 ? [{ account_id: vatAccId, debit: 0, credit: issueVatAmount, description: "VAT Output Payable" }] : [])
        ],
        cogs_lines: totalCost > 0 ? [
          { account_id: cogsAccId, debit: totalCost, credit: 0, description: "Cost of Goods Sold" },
          { account_id: inventoryAccId, debit: 0, credit: totalCost, description: "Inventory Stock In Hand" }
        ] : [],
        updated_at: new Date().toISOString(),
        updated_by: "Sales Issue System",
      }

      await conn.query(
        `INSERT INTO \`invoices\` 
          (id, invoice_number, fs_no, sales_issue_id, sales_order_id, customer_id, customer_name, issue_date, due_date, status, payment_terms, settlement_status, currency, subtotal, tax_rate, tax_amount, discount_amount, total_amount, amount_paid, balance_due, line_items, gl_distribution, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
          invoice_number = VALUES(invoice_number),
          fs_no = VALUES(fs_no),
          sales_issue_id = VALUES(sales_issue_id),
          sales_order_id = VALUES(sales_order_id),
          customer_id = VALUES(customer_id),
          customer_name = VALUES(customer_name),
          issue_date = VALUES(issue_date),
          due_date = VALUES(due_date),
          status = VALUES(status),
          payment_terms = VALUES(payment_terms),
          settlement_status = VALUES(settlement_status),
          currency = VALUES(currency),
          subtotal = VALUES(subtotal),
          tax_rate = VALUES(tax_rate),
          tax_amount = VALUES(tax_amount),
          discount_amount = VALUES(discount_amount),
          total_amount = VALUES(total_amount),
          amount_paid = VALUES(amount_paid),
          balance_due = VALUES(balance_due),
          line_items = VALUES(line_items),
          gl_distribution = VALUES(gl_distribution),
          updated_at = NOW(3)`,
        [
          invId,
          invoiceNumber,
          existing.fs_no || existing.id,
          existing.fs_no || existing.id,
          existing.sales_order_id || null,
          existing.customer_id || null,
          existing.customer_name || "Customer",
          existing.sale_date || getLocalDateString(),
          existing.sale_date || getLocalDateString(),
          paymentStatus,
          isCash ? "Cash" : "Credit (Net 30)",
          settlementStatus,
          "ETB",
          issueSubtotal,
          issueVatRate,
          issueVatAmount,
          0,
          grandTotal,
          existingPaid,
          existingBal,
          JSON.stringify(lineItems.length > 0 ? lineItems : [{ description: `Sales Issue ${existing.fs_no || existing.id}`, quantity: 1, unit_price: grandTotal, line_total: grandTotal }]),
          JSON.stringify(glDist),
        ]
      )

      // 6. Update linked Sales Order
      const targetSoId = existing.sales_order_id || (existing.reference_no && String(existing.reference_no).startsWith("SO-") ? existing.reference_no : null)
      if (targetSoId) {
        await conn.query(
          `UPDATE \`sales_orders\` SET 
            stage = 'Shipped', 
            delivery_status = 'Fully Delivered', 
            delivered_amount = ?, 
            billing_status = CASE WHEN ? = 1 THEN 'Fully Billed' ELSE billing_status END, 
            updated_at = NOW(3) 
           WHERE id = ?`,
          [grandTotal, isCash ? 1 : 0, targetSoId]
        )
      }

      return { status: 200, body: { ...existing, status: "Posted", ok: true } }
    })
  } catch (err) {
    console.error("[postSalesIssue error]:", err)
    return { status: 500, body: { error: "Failed to post sales issue", message: err.message } }
  }
}

export async function cancelSalesIssue(id, existingConn = null) {
  try {
    return await runInTransaction(existingConn, async (conn) => {
      const cleanId = String(id).trim()
      const [issueRows] = await conn.query(
        "SELECT * FROM `sales_issues` WHERE id = ? OR fs_no = ? OR issue_number = ? FOR UPDATE",
        [cleanId, cleanId, cleanId]
      )
      if (issueRows.length === 0) {
        return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
      }

      const issue = issueRows[0]
      if (issue.status === "Cancelled") {
        return { status: 200, body: { ...issue, status: "Cancelled", ok: true } }
      }

      if ((issue.status || "").toUpperCase() === "POSTED") {
        await reverseSalesIssuePosting(conn, issue)
      }

      await conn.query(
        "UPDATE `sales_issues` SET status = 'Cancelled', updated_at = NOW(3) WHERE id = ?",
        [issue.id]
      )

      return { status: 200, body: { ...issue, status: "Cancelled", ok: true } }
    })
  } catch (err) {
    console.error("[cancelSalesIssue error]:", err)
    return { status: 500, body: { error: "Failed to cancel sales issue", message: err.message } }
  }
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
