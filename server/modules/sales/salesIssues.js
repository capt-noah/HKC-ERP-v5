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
    const itemsRes = await drizzleListRows({
      resource: getResource("sales_issue_items"),
    })

    const allItems = Array.isArray(itemsRes.body) ? itemsRes.body : []
    const itemsByIssueId = new Map()

    for (const rawItem of allItems) {
      const item = rawItem?.payload ? { ...rawItem.payload, ...rawItem } : rawItem
      const issueId = item.sales_issue_id || item.salesIssueId || item.sales_order_id
      if (issueId) {
        const existing = itemsByIssueId.get(issueId) || []
        existing.push({
          id: item.id,
          sales_issue_id: issueId,
          item_id: item.item_id || item.productId || item.product_id || item.id,
          item_name: item.item_name || item.name || "Item",
          batch_id: item.batch_id || item.batch_no || item.batchNumber || item.batch || "BATCH-MAIN",
          batch_no: item.batch_no || item.batch_id || item.batchNumber || item.batch || "BATCH-MAIN",
          packaging_unit: item.packaging_unit || item.packagingUnit || item.unit || "Box",
          available_quantity: Number(item.available_quantity || item.availableQuantity || 1000),
          quantity: Number(item.quantity || item.qty || 0),
          unit_price: Number(item.unit_price || item.unitPrice || item.price || 0),
          amount: Number(item.amount || item.total_price || item.totalPrice || (Number(item.quantity || 0) * Number(item.unit_price || 0))),
        })
        itemsByIssueId.set(issueId, existing)
      }
    }

    let fullIssues = issues.map((rawIssue) => {
      const issue = rawIssue?.payload ? { ...rawIssue.payload, ...rawIssue } : rawIssue
      const issueItems = itemsByIssueId.get(issue.id) || issue.items || []
      const fs_no = issue.fs_no || issue.fsNo || issue.issue_number || issue.issueNumber || issue.id
      const reference_no = issue.reference_no || issue.referenceNo || issue.sales_order_id || issue.salesOrderId || ""
      const sale_date = issue.sale_date || issue.issueDate || issue.issue_date || (issue.created_at ? issue.created_at.split("T")[0] : new Date().toISOString().split("T")[0])
      const customer_name = issue.customer_name || issue.customer || issue.customerName || "Customer"
      const customer_id = issue.customer_id || issue.customerId || customer_name
      const warehouse_id = issue.warehouse_id || issue.warehouseId || issue.warehouse || "WH1"
      const payment_type = issue.payment_type || issue.paymentType || issue.payment_method || issue.paymentMethod || "Cash"
      const status = issue.status || "Draft"
      const total_amount = Number(issue.total_amount || issue.totalAmount || issueItems.reduce((s, i) => s + (i.amount || 0), 0) || 0)
      const total_quantity = Number(issue.total_quantity || issue.totalQuantity || issueItems.reduce((s, i) => s + (i.quantity || 0), 0) || 0)
      const amount_paid = Number(issue.amount_paid || issue.amountPaid || 0)
      const balance_due = Number(issue.balance_due || issue.balanceDue || Math.max(0, total_amount - amount_paid))

      return {
        ...issue,
        id: issue.id,
        fs_no,
        fsNo: fs_no,
        reference_no,
        referenceNo: reference_no,
        sale_date,
        issueDate: sale_date,
        customer_name,
        customer: customer_name,
        customer_id,
        customerId: customer_id,
        warehouse_id,
        warehouse: warehouse_id,
        payment_type,
        paymentType: payment_type,
        status,
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

    return { status: 200, body: fullIssues }
  } catch (err) {
    console.warn("[sales_issues list exception]:", err?.message || err)
    return { status: 200, body: [] }
  }
}

export async function getSalesIssue(id) {
  try {
    const issueRes = await drizzleGetRow({
      resource: getResource("sales_issues"),
      id,
    })

    if (issueRes.status >= 400 || !issueRes.body) {
      return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
    }

    const rawIssue = issueRes.body
    const issue = rawIssue?.payload ? { ...rawIssue.payload, ...rawIssue } : rawIssue
    const itemsRes = await drizzleListRows({
      resource: getResource("sales_issue_items"),
    })

    const allItems = Array.isArray(itemsRes.body) ? itemsRes.body : []
    const items = allItems
      .filter((i) => {
        const item = i?.payload ? { ...i.payload, ...i } : i
        return (item.sales_issue_id || item.salesIssueId) === id
      })
      .map((rawItem) => {
        const item = rawItem?.payload ? { ...rawItem.payload, ...rawItem } : rawItem
        return {
          id: item.id,
          sales_issue_id: id,
          item_id: item.item_id || item.productId || item.product_id || item.id,
          item_name: item.item_name || item.name || "Item",
          batch_id: item.batch_id || item.batch_no || item.batchNumber || item.batch || "BATCH-MAIN",
          batch_no: item.batch_no || item.batch_id || item.batchNumber || item.batch || "BATCH-MAIN",
          packaging_unit: item.packaging_unit || item.packagingUnit || item.unit || "Box",
          available_quantity: Number(item.available_quantity || item.availableQuantity || 1000),
          quantity: Number(item.quantity || item.qty || 0),
          unit_price: Number(item.unit_price || item.unitPrice || item.price || 0),
          amount: Number(item.amount || item.total_price || item.totalPrice || (Number(item.quantity || 0) * Number(item.unit_price || 0))),
        }
      })

    const fs_no = issue.fs_no || issue.fsNo || issue.issue_number || issue.issueNumber || issue.id
    const reference_no = issue.reference_no || issue.referenceNo || issue.sales_order_id || issue.salesOrderId || ""
    const sale_date = issue.sale_date || issue.issueDate || issue.issue_date || (issue.created_at ? issue.created_at.split("T")[0] : new Date().toISOString().split("T")[0])
    const customer_name = issue.customer_name || issue.customer || issue.customerName || "Customer"
    const customer_id = issue.customer_id || issue.customerId || customer_name
    const warehouse_id = issue.warehouse_id || issue.warehouseId || issue.warehouse || "WH1"
    const payment_type = issue.payment_type || issue.paymentType || issue.payment_method || issue.paymentMethod || "Cash"
    const status = issue.status || "Draft"
    const total_amount = Number(issue.total_amount || issue.totalAmount || items.reduce((s, i) => s + (i.amount || 0), 0) || 0)
    const total_quantity = Number(issue.total_quantity || issue.totalQuantity || items.reduce((s, i) => s + (i.quantity || 0), 0) || 0)
    const amount_paid = Number(issue.amount_paid || issue.amountPaid || 0)
    const balance_due = Number(issue.balance_due || issue.balanceDue || Math.max(0, total_amount - amount_paid))

    return {
      status: 200,
      body: {
        ...issue,
        id: issue.id,
        fs_no,
        fsNo: fs_no,
        reference_no,
        referenceNo: reference_no,
        sale_date,
        issueDate: sale_date,
        customer_name,
        customer: customer_name,
        customer_id,
        customerId: customer_id,
        warehouse_id,
        warehouse: warehouse_id,
        payment_type,
        paymentType: payment_type,
        status,
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
  const id = existingId || input?.id || `SI-${Date.now().toString().slice(-5)}`
  const fs_no = input?.fs_no || input?.fsNo || id
  const reference_no = input?.reference_no || input?.referenceNo || `REF-${fs_no}`
  const sale_date = input?.sale_date || input?.issueDate || new Date().toISOString().split("T")[0]
  const customer_name = input?.customer_name || input?.customer || input?.customer_id || "Walk-in Customer"
  const customer_id = input?.customer_id || input?.customerId || customer_name
  const warehouse_id = input?.warehouse_id || input?.warehouse || "WH-MAIN"
  const payment_type = input?.payment_type || input?.paymentType || "Cash"
  const items = Array.isArray(input?.items) ? input.items : []

  const total_quantity = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0)
  const total_amount = items.reduce((sum, item) => sum + Number(item.amount || (item.quantity * item.unit_price) || 0), 0)

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

  // 1. Save Header
  const headerRow = {
    id,
    fs_no,
    reference_no,
    sale_date,
    customer_id,
    customer_name,
    warehouse_id,
    payment_type,
    status: doc.status,
    total_quantity,
    subtotal,
    vat_rate,
    vat_amount,
    total_amount: finalTotalAmount,
    created_by: "Current User",
  }

  await drizzleCreateRow({
    resource: getResource("sales_issues"),
    body: headerRow,
  })

  // 2. Save Items
  if (items.length > 0) {
    const itemRows = items.map((item, idx) => ({
      id: String(item.id || `${id}-ITEM-${idx + 1}`),
      sales_issue_id: id,
      item_id: String(item.item_id || item.productId || `ITEM-${idx + 1}`),
      item_name: String(item.item_name || item.name || "Item"),
      batch_id: String(item.batch_id || item.batch_no || "BATCH-MAIN"),
      batch_no: String(item.batch_no || item.batch_id || "BATCH-MAIN"),
      quantity: Number(item.quantity || item.qty || 0),
      unit_price: Number(item.unit_price || item.price || 0),
      amount: Number(item.amount || (item.quantity * item.unit_price) || 0),
    }))

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
  const getRes = await getSalesIssue(id)
  if (getRes.status >= 400 || !getRes.body) {
    return { status: 404, body: { error: `Sales issue '${id}' not found.` } }
  }

  const existing = getRes.body
  const items = Array.isArray(input?.items) ? input.items : existing.items || []
  const total_quantity = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0)
  const itemTotal = items.reduce((sum, item) => sum + Number(item.amount || (item.quantity * item.unit_price) || 0), 0)

  const warehouse_id = input?.warehouse_id || existing.warehouse_id
  const isWh1 = (warehouse_id || "").toUpperCase().startsWith("WH1")
  const subtotal = input?.subtotal !== undefined ? Number(input.subtotal) : itemTotal
  const vat_rate = input?.vat_rate !== undefined ? Number(input.vat_rate) : (isWh1 ? 0 : 15)
  const vat_amount = input?.vat_amount !== undefined ? Number(input.vat_amount) : (vat_rate > 0 ? Math.round(subtotal * (vat_rate / 100)) : 0)
  const finalTotalAmount = input?.total_amount !== undefined ? Number(input.total_amount) : (subtotal + vat_amount)

  const updateHeader = {
    fs_no: input?.fs_no || existing.fs_no,
    reference_no: input?.reference_no || existing.reference_no,
    sale_date: input?.sale_date || existing.sale_date,
    customer_id: input?.customer_id || existing.customer_id,
    customer_name: input?.customer_name || existing.customer_name,
    warehouse_id,
    payment_type: input?.payment_type || existing.payment_type,
    status: input?.status || existing.status,
    total_quantity,
    subtotal,
    vat_rate,
    vat_amount,
    total_amount: finalTotalAmount,
  }

  await drizzleUpdateRow({
    resource: getResource("sales_issues"),
    id,
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
      const itemRow = {
        id: String(item.id || `${id}-ITEM-${idx + 1}`),
        sales_issue_id: id,
        item_id: String(item.item_id || item.productId || `ITEM-${idx + 1}`),
        item_name: String(item.item_name || item.name || "Item"),
        batch_id: String(item.batch_id || item.batch_no || "BATCH-MAIN"),
        batch_no: String(item.batch_no || item.batch_id || "BATCH-MAIN"),
        quantity: Number(item.quantity || item.qty || 0),
        unit_price: Number(item.unit_price || item.price || 0),
        amount: Number(item.amount || (item.quantity * item.unit_price) || 0),
      }
      await drizzleCreateRow({
        resource: getResource("sales_issue_items"),
        body: itemRow,
      })
    }
  } catch (err) {
    console.warn("Update items warning:", err.message)
  }

  return { status: 200, body: { ...existing, ...input, total_quantity, total_amount, items, savedToDb: true } }
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

  // 1. Deduct Stock from inventory_products
  try {
    for (const item of (existing.items || [])) {
      const prodId = item.item_id || item.productId
      if (!prodId) continue

      const prodRes = await drizzleGetRow({ resource: getResource("inventory_products"), id: prodId })
      if (prodRes.status === 200 && prodRes.body) {
        const prod = prodRes.body
        const issueQty = Number(item.quantity || item.qty || 0)
        const unitPrice = Number(item.unit_price || item.unitPrice || 0)
        const unitCost = Number(prod.unitCost || 0)

        totalQty += issueQty
        totalAmount += issueQty * unitPrice
        totalCost += issueQty * unitCost

        const isWH1 = prod.warehouse === "WH1" || prod.warehouse === "WH1-AGRI-EXP"
        let newQty = Math.max(0, Number(prod.quantity || 0) - issueQty)
        let updatedWH1Entries = prod.wh1Entries || []

        if (isWH1 && Array.isArray(prod.wh1Entries) && prod.wh1Entries.length > 0) {
          let remaining = issueQty
          const sorted = [...prod.wh1Entries].sort((a, b) =>
            new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
          )
          updatedWH1Entries = sorted.map((entry) => {
            if (remaining <= 0) return entry
            const deduct = Math.min(entry.quantityRemaining, remaining)
            remaining -= deduct
            return {
              ...entry,
              quantityRemaining: Math.max(0, entry.quantityRemaining - deduct),
            }
          })
          newQty = updatedWH1Entries.reduce((sum, e) => sum + Number(e.quantityRemaining || 0), 0)
        }

        const newSold = Number(prod.quantitySold || 0) + issueQty
        const targetWh = existing.warehouse_id || existing.warehouse || prod.warehouse
        const targetWhBase = (targetWh || "").split("-")[0]

        const updatedBreakdown = (prod.stockBreakdown || []).map((sb) =>
          sb.warehouse === targetWh || (sb.warehouse || "").split("-")[0] === targetWhBase
            ? { ...sb, qty: Math.max(0, Number(sb.qty || 0) - issueQty) }
            : sb
        )
        const targetBatch = item.batch_no || item.batch_id || prod.batch
        const updatedBatches = (prod.batches || []).map((b) =>
          b.batchNo === targetBatch || b.batch_no === targetBatch
            ? { ...b, qty: Math.max(0, Number(b.qty || 0) - issueQty) }
            : b
        )
        const packSize = Number(prod.quantityPerPack || 1)
        const newCartons = packSize > 0 ? Math.max(0, Math.floor(newQty / packSize)) : Math.max(0, (prod.numberOfCartons || 0) - issueQty)
        const updatedStatus = newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock"

        let finalUnitCost = unitCost
        let finalStockValue = newQty * unitCost
        if (isWH1 && updatedWH1Entries.length > 0) {
          finalStockValue = updatedWH1Entries.reduce((sum, e) => sum + (Number(e.quantityRemaining || 0) * Number(e.unitPrice || 0)), 0)
          finalUnitCost = newQty > 0 ? Math.round((finalStockValue / newQty) * 100) / 100 : unitCost
        }

        let updatedBinCardEntries = prod.binCardEntries || []
        if (!isWH1) {
          const autoIssueBinEntry = {
            id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: existing.sale_date || new Date().toISOString().slice(0, 10),
            batchNo: targetBatch || "BATCH-ISSUE",
            qtyReceived: 0,
            qtyIssued: issueQty,
            balance: newQty,
            expiryDate: item.expiryDate || item.expiry || "",
            mfgDate: item.mfgDate || item.manufacturingDate || "",
            party: existing.customer_name || "Customer Dispatch",
            unitPrice: unitPrice > 0 ? unitPrice : unitCost,
            remark: `Sales Issue FS-${existing.fs_no} (Ref: ${existing.reference_no || 'Direct Dispatch'})`,
            createdAt: new Date().toISOString(),
          }
          updatedBinCardEntries = [...updatedBinCardEntries, autoIssueBinEntry]
        }

        const updatedProd = {
          ...prod,
          quantity: newQty,
          quantitySold: newSold,
          numberOfCartons: newCartons,
          stockBreakdown: updatedBreakdown,
          batches: updatedBatches,
          wh1Entries: updatedWH1Entries,
          binCardEntries: updatedBinCardEntries,
          status: updatedStatus,
          unitCost: finalUnitCost,
          sellingPrice: finalUnitCost,
          totalStockValue: finalStockValue,
          updatedAt: new Date().toISOString(),
        }

        await drizzleUpdateRow({
          resource: getResource("inventory_products"),
          id: prodId,
          body: updatedProd,
        })
      }
    }
  } catch (err) {
    console.warn("Stock deduction warning during post:", err.message)
  }

  // 2. Update status in sales_issues
  const isWh1 = (existing.warehouse_id || "").toUpperCase().startsWith("WH1")
  const issueSubtotal = totalAmount || Number(existing.subtotal || existing.total_amount || 0)
  const issueVatRate = isWh1 ? 0 : Number(existing.vat_rate !== undefined ? existing.vat_rate : 15)
  const issueVatAmount = issueVatRate > 0 ? Number(existing.vat_amount || Math.round(issueSubtotal * (issueVatRate / 100))) : 0
  const grandTotal = issueSubtotal + issueVatAmount

  await drizzleUpdateRow({
    resource: getResource("sales_issues"),
    id,
    body: {
      status: "Posted",
      posted_at: new Date().toISOString(),
      posted_by: "Sales Officer",
      total_quantity: totalQty || existing.total_quantity,
      subtotal: issueSubtotal,
      vat_rate: issueVatRate,
      vat_amount: issueVatAmount,
      total_amount: grandTotal,
    },
  })

  // 3. Post Double-Entry Journal Entries
  try {
    const isCredit = existing.payment_type === "Credit"
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
    // 1. Debit Cash (ACC-1000) or Accounts Receivable (ACC-1200) for Grand Total
    await drizzleCreateRow({
      resource: getResource("journal_entry_lines"),
      body: {
        id: `${saleJeId}-DR`,
        journal_entry_id: saleJeId,
        account_id: isCredit ? "ACC-1200" : "ACC-1000",
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

    // 2. Credit Sales Revenue (ACC-4000) for Net Subtotal
    await drizzleCreateRow({
      resource: getResource("journal_entry_lines"),
      body: {
        id: `${saleJeId}-CR`,
        journal_entry_id: saleJeId,
        account_id: "ACC-4000",
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

    // 3. Credit Output VAT Payable (ACC-2200) if VAT is charged
    if (issueVatAmount > 0) {
      await drizzleCreateRow({
        resource: getResource("journal_entry_lines"),
        body: {
          id: `${saleJeId}-VAT`,
          journal_entry_id: saleJeId,
          account_id: "ACC-2200",
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
          account_id: "ACC-5000",
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
          account_id: "ACC-1010",
          debit_amount: 0,
          credit_amount: totalCost,
          currency: "ETB",
          exchange_rate_at_time: 1.0,
          warehouse_id: existing.warehouse_id || null,
        },
      })
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
    const res = await drizzleListRows({ resource: getResource("inventory_products") })
    const products = Array.isArray(res.body) ? res.body : []
    const available = []

    for (const prod of products) {
      if (itemId && prod.id !== itemId) continue
      const prodBatches = Array.isArray(prod.batches) && prod.batches.length > 0
        ? prod.batches
        : [{ batchNo: prod.batch || "BATCH-MAIN", qty: prod.quantity || 1000, expiry: prod.expiry }]

      for (const b of prodBatches) {
        const batchNo = b.batchNo || b.batch_no || prod.batch || "BATCH-MAIN"
        available.push({
          batch_id: batchNo,
          batch_no: batchNo,
          item_id: prod.id,
          item_name: prod.name,
          warehouse_id: warehouseId || prod.warehouse,
          available_quantity: Number(b.qty ?? prod.quantity ?? 1000),
          manufacturing_date: b.manufacturingDate || prod.manufacturingDate || "",
          expiry: b.expiry || prod.expiry || "",
          expiry_date: b.expiry || prod.expiry || "",
          packaging_unit: prod.unit || "Box",
          unit_price: Number(prod.sellingPrice || prod.unitCost || 0),
          unit_cost: Number(prod.unitCost || 0),
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
