import { getMysqlPool } from "../../db/mysqlClient.js"

const pool = getMysqlPool()

export async function checkProductDeletable(productId) {
  const cleanId = String(productId).trim()

  // 1. Check pharma sales issue items
  const [pharmaSales] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `sales_issue_items` WHERE product_id = ? OR item_id = ?",
    [cleanId, cleanId]
  )
  if (pharmaSales[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      salesCount: pharmaSales[0].cnt,
      reason: `Product has ${pharmaSales[0].cnt} sales transaction(s). Deleting it is prohibited to preserve historical invoices, COGS, and General Ledger integrity.`,
    }
  }

  // 2. Check stock movements for outbound sales / dispatch
  const [movements] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `stock_movements` WHERE product_id = ? AND movement_type IN ('OUTBOUND_SALE', 'DISPATCH', 'SALES_ISSUE')",
    [cleanId]
  )
  if (movements[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      salesCount: movements[0].cnt,
      reason: `Product has ${movements[0].cnt} outbound sale/dispatch movement(s). Deletion is prohibited.`,
    }
  }

  // 3. Check export movements for dispatch / sales
  const [expMov] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `export_warehouse_movements` WHERE product_id = ? AND movement_type IN ('DISPATCH', 'SALE', 'OUTBOUND')",
    [cleanId]
  )
  if (expMov[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      salesCount: expMov[0].cnt,
      reason: `Export product has ${expMov[0].cnt} outbound dispatch movement(s). Deletion is prohibited.`,
    }
  }

  return {
    canDelete: true,
    isPermanentlyBlocked: false,
    salesCount: 0,
    reason: "Product has zero sales transactions. Eligible for deletion.",
  }
}

export async function checkBatchDeletable(batchId) {
  const cleanId = String(batchId).trim()

  const [bRows] = await pool.query(
    "SELECT id, product_id, batch_no FROM `pharma_product_batches` WHERE id = ? OR batch_no = ? LIMIT 1",
    [cleanId, cleanId]
  )
  if (bRows.length === 0) {
    return { canDelete: true, isPermanentlyBlocked: false, reason: "Batch not found." }
  }

  const batch = bRows[0]
  const batchNo = batch.batch_no

  // 1. Check sales_issue_items
  const [salesItems] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `sales_issue_items` WHERE batch_id = ? OR batch_no = ? OR batch_number = ?",
    [cleanId, batchNo, batchNo]
  )
  if (salesItems[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      salesCount: salesItems[0].cnt,
      reason: `Batch '${batchNo}' has been issued in ${salesItems[0].cnt} sales transaction(s). Deleting it is prohibited to preserve sales orders and COGS history.`,
    }
  }

  // 2. Check outbound stock movements
  const [movements] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `stock_movements` WHERE batch_no = ? AND movement_type IN ('OUTBOUND_SALE', 'DISPATCH', 'SALES_ISSUE')",
    [batchNo]
  )
  if (movements[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      salesCount: movements[0].cnt,
      reason: `Batch '${batchNo}' has ${movements[0].cnt} outbound sale movement(s). Deletion is prohibited.`,
    }
  }

  return {
    canDelete: true,
    isPermanentlyBlocked: false,
    salesCount: 0,
    reason: `Batch '${batchNo}' has zero sales. Eligible for deletion.`,
  }
}

export async function checkSalesOrderDeletable(soId) {
  const cleanId = String(soId).trim()

  // 1. Check if sales order is linked to any sales issue
  const [issues] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `sales_issues` WHERE sales_order_id = ? OR reference_no = ?",
    [cleanId, cleanId]
  )
  if (issues[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      reason: `Sales Order '${cleanId}' has already been issued to the warehouse (${issues[0].cnt} linked sales issue). Deleting it is prohibited.`,
    }
  }

  // 2. Check order status / stage
  const [soRows] = await pool.query(
    "SELECT id, status, stage FROM `sales_orders` WHERE id = ? LIMIT 1",
    [cleanId]
  )
  if (soRows.length > 0) {
    const so = soRows[0]
    const st = String(so.status || "").toLowerCase()
    const stage = String(so.stage || "").toLowerCase()
    if (["issued", "delivered", "fulfilled", "completed"].includes(st) || ["issued", "delivered", "fulfilled"].includes(stage)) {
      return {
        canDelete: false,
        isPermanentlyBlocked: true,
        reason: `Sales Order '${cleanId}' has status '${so.status || so.stage}'. Orders that have been issued or delivered cannot be deleted.`,
      }
    }
  }

  return {
    canDelete: true,
    isPermanentlyBlocked: false,
    reason: `Sales Order '${cleanId}' has not been issued. Eligible for deletion.`,
  }
}

export async function checkPurchaseOrderDeletable(poId) {
  const cleanId = String(poId).trim()

  // 1. Check if PO has received stock movements
  const [movements] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `stock_movements` WHERE reference_type = 'purchase_order' AND reference_id = ?",
    [cleanId]
  )
  if (movements[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      reason: `Purchase Order '${cleanId}' has already received inventory into the warehouse (${movements[0].cnt} stock movement). Deletion is prohibited.`,
    }
  }

  // 2. Check if PO has vendor invoices
  const [invoices] = await pool.query(
    "SELECT COUNT(*) as cnt FROM `invoices` WHERE purchase_order_id = ?",
    [cleanId]
  )
  if (invoices[0].cnt > 0) {
    return {
      canDelete: false,
      isPermanentlyBlocked: true,
      reason: `Purchase Order '${cleanId}' has linked invoice(s). Deletion is prohibited.`,
    }
  }

  // 3. Check PO status
  const [poRows] = await pool.query(
    "SELECT id, status FROM `purchase_orders` WHERE id = ? LIMIT 1",
    [cleanId]
  )
  if (poRows.length > 0) {
    const po = poRows[0]
    const st = String(po.status || "").toLowerCase()
    if (["received", "fulfilled", "partially received"].includes(st)) {
      return {
        canDelete: false,
        isPermanentlyBlocked: true,
        reason: `Purchase Order '${cleanId}' has status '${po.status}'. Orders with received goods cannot be deleted.`,
      }
    }
  }

  return {
    canDelete: true,
    isPermanentlyBlocked: false,
    reason: `Purchase Order '${cleanId}' has zero received goods. Eligible for deletion.`,
  }
}

export async function validateRecordDeletable(resource, id) {
  const normResource = String(resource).trim().toLowerCase()
  if (normResource === "pharma_products" || normResource === "export_products") {
    return await checkProductDeletable(id)
  }
  if (normResource === "pharma_product_batches") {
    return await checkBatchDeletable(id)
  }
  if (normResource === "sales_orders") {
    return await checkSalesOrderDeletable(id)
  }
  if (normResource === "purchase_orders") {
    return await checkPurchaseOrderDeletable(id)
  }
  // All other records default to eligible
  return { canDelete: true, isPermanentlyBlocked: false, reason: "Eligible" }
}
