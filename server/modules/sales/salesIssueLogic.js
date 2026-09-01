export function calculateAmount(quantity, unitPrice) {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0
  return Math.round(qty * price * 100) / 100
}

export function parseExpiryDate(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number)
    return new Date(Date.UTC(year, month, 0))
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`)
  }
  return null
}

export function isExpiredBatch(expiry, today = new Date()) {
  const expiryDate = parseExpiryDate(expiry)
  if (!expiryDate) return false
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  return expiryDate < current
}

export function availableBatchesForProduct(product, warehouseId, today = new Date()) {
  const warehouseQty = new Map((product.stockBreakdown || []).map((row) => [row.warehouse, Number(row.qty || 0)]))
  if (!warehouseQty.has(warehouseId)) return []
  const warehouseAvailable = Number(warehouseQty.get(warehouseId) || 0)

  return (product.batches || [])
    .map((batch) => ({
      batch_id: batch.batchNo,
      batch_no: batch.batchNo,
      item_id: product.id,
      item_name: product.name,
      warehouse_id: warehouseId,
      available_quantity: Math.min(Number(batch.qty || 0), warehouseAvailable),
      manufacturing_date: batch.manufacturingDate || batch.manufacturing_date || product.manufacturingDate || "",
      expiry: batch.expiry,
      expiry_date: batch.expiry,
      status: batch.status,
      packaging_unit: product.unit,
      unit_price: Number(product.sellingPrice || product.unitCost || 0),
      unit_cost: Number(product.unitCost || 0),
    }))
    .filter((batch) => batch.available_quantity > 0 && batch.status !== "Pending QA" && batch.status !== "Quarantined" && !isExpiredBatch(batch.expiry, today))
    .sort((a, b) => {
      const aDate = parseExpiryDate(a.expiry)?.getTime() ?? Number.MAX_SAFE_INTEGER
      const bDate = parseExpiryDate(b.expiry)?.getTime() ?? Number.MAX_SAFE_INTEGER
      return aDate - bDate
    })
}

export function validateSalesIssueDraft(issue, inputItems) {
  const items = Array.isArray(inputItems) ? inputItems : Array.isArray(issue?.items) ? issue.items : []
  const errors = []
  const fsNo = issue?.fs_no || issue?.fsNo || issue?.id
  const customer = issue?.customer_id || issue?.customer_name || issue?.customer || issue?.customerId
  const warehouse = issue?.warehouse_id || issue?.warehouse
  const date = issue?.sale_date || issue?.issueDate || issue?.date

  if (!fsNo) errors.push("FS No is required.")
  if (!date) errors.push("Date is required.")
  if (!customer) errors.push("Customer is required.")
  if (!warehouse) errors.push("Warehouse is required.")
  if (!Array.isArray(items) || items.length === 0) errors.push("At least one item row is required.")

  for (const [index, item] of items.entries()) {
    const label = `Row ${index + 1}`
    if (!item.item_id && !item.productId && !item.item_name) errors.push(`${label}: Item is required.`)
    if (!item.batch_id && !item.batch_no) errors.push(`${label}: Batch is required.`)
    if (Number(item.quantity ?? item.qty) <= 0) errors.push(`${label}: Quantity must be greater than zero.`)
    if (Number(item.unit_price ?? item.price ?? item.unitPrice) < 0) errors.push(`${label}: Unit price must be greater than or equal to zero.`)
  }

  return errors
}

export function assertBalancedJournal(lines) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0)
  const credit = lines.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0)
  return Math.round((debit - credit) * 100) === 0
}
