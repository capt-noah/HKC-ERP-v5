export interface StockItemSummary {
  productId: string
  name: string
  totalQty: number
  reorderLevel: number
  isLowStock: boolean
  stockValuation: number
}

/**
 * Calculates stock balance and identifies items below reorder threshold.
 */
export function evaluateStockStatus(
  products: any[],
  movements: any[]
): Map<string, StockItemSummary> {
  const stockMap = new Map<string, StockItemSummary>()

  products.forEach((p) => {
    stockMap.set(p.id, {
      productId: p.id,
      name: p.name || p.title || "Item",
      totalQty: Number(p.quantity || p.stock || 0),
      reorderLevel: Number(p.reorderLevel || p.reorder_point || 10),
      isLowStock: false,
      stockValuation: Number(p.valuationRate || p.price || 0) * Number(p.quantity || p.stock || 0),
    })
  })

  movements.forEach((m) => {
    const item = stockMap.get(m.productId || m.product_id)
    if (item) {
      const qty = Number(m.quantity || m.qty || 0)
      if (m.type === "IN" || m.movement_type === "RECEIPT") {
        item.totalQty += qty
      } else if (m.type === "OUT" || m.movement_type === "DISPATCH") {
        item.totalQty -= qty
      }
    }
  })

  stockMap.forEach((item) => {
    item.isLowStock = item.totalQty <= item.reorderLevel
  })

  return stockMap
}
