import { isExportWarehouse } from "./warehouses"
import type { Product } from "./erpStore"

export interface CommodityRejectMetric {
  productId: string
  productName: string
  sku: string
  warehouse: string
  unit: string
  totalReceived: number // in Quintals
  totalRejected: number // in Quintals
  netYield: number // in Quintals
  rejectRate: number // % e.g. 5.2
  cleanYieldRate: number // % e.g. 94.8
  rejectionsCount: number
  lossValuation: number // in ETB
  grade: "Grade A" | "Grade B" | "Grade C"
  gradeLabel: string
  gradeColor: "emerald" | "amber" | "rose"
}

export interface SupplierQualityMetric {
  supplierName: string
  totalReceived: number
  totalRejected: number
  netYield: number
  rejectRate: number
  cleanYieldRate: number
  batchesCount: number
  products: string[]
  grade: "Grade A" | "Grade B" | "Grade C"
  gradeLabel: string
  gradeColor: "emerald" | "amber" | "rose"
}

export interface WH1QualitySummary {
  commodityMetrics: CommodityRejectMetric[]
  supplierMetrics: SupplierQualityMetric[]
  overallTotalReceived: number
  overallTotalRejected: number
  overallNetYield: number
  overallRejectRate: number
  overallCleanYieldRate: number
  overallLossValuation: number
  topSupplier?: SupplierQualityMetric | null
  highestRejectSupplier?: SupplierQualityMetric | null
  highestRejectCommodity: CommodityRejectMetric | null
  lowestRejectCommodity: CommodityRejectMetric | null
  totalCommoditiesCount: number
  totalSuppliersCount: number
  availableProducts: { id: string; name: string }[]
  isSampleData?: boolean
}

/**
 * Computes commodity-level rejection and loss percentages from Export Warehouse stock records.
 * Grouped strictly by commodity for 100% data accuracy after parent-level rejection workflow.
 */
export function computeWH1RejectAnalysis(
  products: Product[],
  filterProductId: string = "all",
  filterWarehouseId: string = "all"
): WH1QualitySummary {
  // 1. Filter strictly for export warehouse products
  const exportProducts = products.filter((p) =>
    isExportWarehouse(p.warehouse) && (filterWarehouseId === "all" || p.warehouse === filterWarehouseId)
  )

  const targetProducts =
    filterProductId && filterProductId !== "all"
      ? exportProducts.filter((p) => p.id === filterProductId)
      : exportProducts

  // Extract available export products for filtering dropdown
  const availableProducts = exportProducts.map((p) => ({
    id: p.id,
    name: p.name,
  }))

  const commodityMetrics: CommodityRejectMetric[] = []
  let overallTotalReceived = 0
  let overallTotalRejected = 0
  let overallLossValuation = 0

  for (const product of targetProducts) {
    const wh1Entries = product.wh1Entries || []
    const binEntries = product.binCardEntries || []

    let productReceived = 0
    let productRejected = 0
    let productLossValue = 0
    let rejectionsCount = 0

    // A. Received Quantities (All historical inbound arrivals into WH1)
    if (wh1Entries.length > 0) {
      for (const entry of wh1Entries) {
        const isPureLeave =
          (entry as any).type === "leave" ||
          (Number((entry as any).quantityIssued || 0) > 0 && Number(entry.quantityReceived ?? entry.quantity ?? 0) === 0)
        if (!isPureLeave) {
          productReceived += Number(entry.quantityReceived ?? entry.quantity ?? 0)
        }
      }
    } else {
      const entryBins = binEntries.filter((b) => b.type === "entry" || Number(b.qtyReceived || 0) > 0)
      if (entryBins.length > 0) {
        productReceived = entryBins.reduce((sum, b) => sum + Number(b.qtyReceived || 0), 0)
      } else {
        productReceived = Number(product.quantity || 0)
      }
    }

    // B. Rejections
    const rejectBins = binEntries.filter(
      (b) =>
        b.type === "reject" ||
        (b.remark && /reject|loss|cleaning|impurity/i.test(b.remark) && Number(b.qtyIssued || 0) > 0)
    )
    if (rejectBins.length > 0) {
      for (const bin of rejectBins) {
        const q = Number(bin.qtyIssued || (bin as any).rejectQuantity || 0)
        const cost = Number(bin.unitPrice ?? product.unitCost ?? 0)
        productRejected += q
        productLossValue += q * cost
        rejectionsCount += 1
      }
    } else if (wh1Entries.length > 0) {
      for (const entry of wh1Entries) {
        const q = Number((entry as any).rejectQuantity || 0)
        if (q > 0) {
          const cost = Number(entry.unitPrice ?? product.unitCost ?? 0)
          productRejected += q
          productLossValue += q * cost
          rejectionsCount += 1
        }
      }
    }

    // Ensure intake reflects rejections if baseline received was omitted
    const effectiveIntake = Math.max(productReceived, Number(product.quantity || 0) + productRejected, productRejected)
    const rejectRate = effectiveIntake > 0 ? Number(((productRejected / effectiveIntake) * 100).toFixed(1)) : 0
    const cleanYieldRate = Number(Math.max(0, 100 - rejectRate).toFixed(1))
    const netYield = Math.max(0, effectiveIntake - productRejected)

    let grade: "Grade A" | "Grade B" | "Grade C" = "Grade A"
    let gradeLabel = "Grade A (Low Loss ≤5%)"
    let gradeColor: "emerald" | "amber" | "rose" = "emerald"

    if (rejectRate > 10) {
      grade = "Grade C"
      gradeLabel = `Grade C (High Loss >10%)`
      gradeColor = "rose"
    } else if (rejectRate > 5) {
      grade = "Grade B"
      gradeLabel = `Grade B (Moderate 5–10% Loss)`
      gradeColor = "amber"
    }

    // Only include commodities that have inventory or recorded movements
    if (effectiveIntake > 0 || productRejected > 0 || Number(product.quantity || 0) > 0) {
      commodityMetrics.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        warehouse: product.warehouse,
        unit: product.unit || "Quintal",
        totalReceived: Number(effectiveIntake.toFixed(2)),
        totalRejected: Number(productRejected.toFixed(2)),
        netYield: Number(netYield.toFixed(2)),
        rejectRate,
        cleanYieldRate,
        rejectionsCount,
        lossValuation: Number(productLossValue.toFixed(2)),
        grade,
        gradeLabel,
        gradeColor,
      })

      overallTotalReceived += effectiveIntake
      overallTotalRejected += productRejected
      overallLossValuation += productLossValue
    }
  }

  // Sort commodities by highest reject rate first (highlights areas needing attention)
  commodityMetrics.sort(
    (a, b) => b.rejectRate - a.rejectRate || b.totalRejected - a.totalRejected || b.totalReceived - a.totalReceived
  )

  const overallNetYield = Math.max(0, overallTotalReceived - overallTotalRejected)
  const overallRejectRate =
    overallTotalReceived > 0 ? Number(((overallTotalRejected / overallTotalReceived) * 100).toFixed(1)) : 0
  const overallCleanYieldRate = Number(Math.max(0, 100 - overallRejectRate).toFixed(1))

  const highestRejectCommodity = commodityMetrics.length > 0 ? commodityMetrics[0] : null
  const lowestRejectCommodity = commodityMetrics.length > 0 ? commodityMetrics[commodityMetrics.length - 1] : null

  // Backward compatibility supplierMetrics
  const supplierMetrics: SupplierQualityMetric[] = commodityMetrics.map((c) => ({
    supplierName: c.productName,
    totalReceived: c.totalReceived,
    totalRejected: c.totalRejected,
    netYield: c.netYield,
    rejectRate: c.rejectRate,
    cleanYieldRate: c.cleanYieldRate,
    batchesCount: c.rejectionsCount,
    products: [c.productName],
    grade: c.grade,
    gradeLabel: c.gradeLabel,
    gradeColor: c.gradeColor,
  }))

  return {
    commodityMetrics,
    supplierMetrics,
    overallTotalReceived: Number(overallTotalReceived.toFixed(2)),
    overallTotalRejected: Number(overallTotalRejected.toFixed(2)),
    overallNetYield: Number(overallNetYield.toFixed(2)),
    overallRejectRate,
    overallCleanYieldRate,
    overallLossValuation: Number(overallLossValuation.toFixed(2)),
    topSupplier: supplierMetrics[0] || null,
    highestRejectSupplier: supplierMetrics[0] || null,
    highestRejectCommodity,
    lowestRejectCommodity,
    totalCommoditiesCount: commodityMetrics.length,
    totalSuppliersCount: commodityMetrics.length,
    availableProducts,
    isSampleData: false,
  }
}

// Backward-compatible alias
export const computeWH1SupplierQuality = computeWH1RejectAnalysis
