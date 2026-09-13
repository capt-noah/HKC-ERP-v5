import { isExportWarehouse } from "./warehouses"
import type { Product } from "./erpStore"

export interface SupplierQualityMetric {
  supplierName: string
  totalReceived: number // in Quintals
  totalRejected: number // in Quintals
  netYield: number // in Quintals
  rejectRate: number // % e.g. 5.2
  cleanYieldRate: number // % e.g. 94.8
  batchesCount: number
  products: string[]
  grade: "Grade A" | "Grade B" | "Grade C"
  gradeLabel: string
  gradeColor: "emerald" | "amber" | "rose"
}

export interface WH1QualitySummary {
  supplierMetrics: SupplierQualityMetric[]
  overallTotalReceived: number
  overallTotalRejected: number
  overallNetYield: number
  overallRejectRate: number
  topSupplier: SupplierQualityMetric | null
  highestRejectSupplier: SupplierQualityMetric | null
  totalSuppliersCount: number
  availableProducts: { id: string; name: string }[]
  isSampleData?: boolean
}

/**
 * Normalizes supplier name string to clean standard representation.
 */
function cleanSupplierName(rawName?: string): string {
  if (!rawName) return "Direct Supplier"
  const trimmed = rawName.trim()
  if (!trimmed || trimmed === "—" || trimmed === "-") return "Direct Supplier"
  return trimmed
}

/**
 * Strictly compute supplier quality metrics from all EXPORT_WH stock records.
 * Evaluates raw commodity arrivals and cleaning rejects.
 * NEVER includes processing_services records.
 */
export function computeWH1SupplierQuality(
  products: Product[],
  filterProductId: string = "all",
  filterWarehouseId: string = "all"
): WH1QualitySummary {
  // 1. Filter strictly for all export warehouse products (optionally scoped by warehouseId)
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

  const supplierMap: Record<
    string,
    {
      name: string
      totalReceived: number
      totalRejected: number
      batchesCount: number
      productNames: Set<string>
    }
  > = {}

  for (const product of targetProducts) {
    const wh1Entries = product.wh1Entries || []
    const binEntries = product.binCardEntries || []
    const fallbackSupplier = cleanSupplierName(product.supplierName || product.customer)

    // A. Process wh1Entries (Inbound truckload receipts and reject movements)
    for (const entry of wh1Entries) {
      const eAny = entry as any
      const isReject =
        eAny.type === "reject" ||
        Boolean(eAny.isReject) ||
        (eAny.notes && /reject|loss|cleaning|chaff|impurity/i.test(eAny.notes))

      const isLeave = eAny.type === "leave" || (Number(eAny.quantityIssued || 0) > 0 && Number(entry.quantityReceived || 0) === 0)

      const supplier = cleanSupplierName(entry.customer || eAny.supplier || eAny.party || fallbackSupplier)
      const key = supplier.toLowerCase()

      if (!supplierMap[key]) {
        supplierMap[key] = {
          name: supplier,
          totalReceived: 0,
          totalRejected: 0,
          batchesCount: 0,
          productNames: new Set(),
        }
      }

      supplierMap[key].productNames.add(product.name)

      if (isReject) {
        const rejectQty = Number(eAny.rejectQuantity || eAny.quantityIssued || entry.quantityReceived || 0)
        supplierMap[key].totalRejected += rejectQty
        supplierMap[key].batchesCount += 1
      } else if (!isLeave) {
        const receivedQty = Number(entry.quantityReceived || 0)
        supplierMap[key].totalReceived += receivedQty
        if (receivedQty > 0) supplierMap[key].batchesCount += 1

        // If the entry itself contains an inline reject loss field
        if (Number(eAny.rejectQuantity || 0) > 0) {
          supplierMap[key].totalRejected += Number(eAny.rejectQuantity)
        }
      }
    }

    // B. Process binCardEntries (Stock movements, reject losses, quarantine)
    for (const bin of binEntries) {
      const bAny = bin as any
      const isReject =
        (bin.type as string) === "reject" ||
        bin.type === "quarantine" ||
        Boolean(bAny.isReject) ||
        (bin.remark && /reject|loss|cleaning|chaff|impurity|quarantine/i.test(bin.remark))

      const isEntry = Number(bin.qtyReceived || 0) > 0 || bin.type === "entry"
      const supplier = cleanSupplierName(bin.party || fallbackSupplier)
      const key = supplier.toLowerCase()

      // Avoid double counting if this entry corresponds to an already counted wh1Entry
      if (isEntry) {
        const alreadyInWH1 = wh1Entries.some(
          (w) =>
            (w.voucherNo && bin.voucherNo && w.voucherNo === bin.voucherNo) ||
            w.entryId === bin.id
        )
        if (alreadyInWH1) {
          // If the matching wh1Entry didn't record reject, but binEntry does
          if (isReject && !wh1Entries.some((w: any) => w.type === "reject" && w.voucherNo === bin.voucherNo)) {
            if (!supplierMap[key]) {
              supplierMap[key] = {
                name: supplier,
                totalReceived: 0,
                totalRejected: 0,
                batchesCount: 0,
                productNames: new Set(),
              }
            }
            supplierMap[key].totalRejected += Number(bin.qtyIssued || bin.qtyReceived || 0)
          }
          continue
        }
      }

      if (!supplierMap[key]) {
        supplierMap[key] = {
          name: supplier,
          totalReceived: 0,
          totalRejected: 0,
          batchesCount: 0,
          productNames: new Set(),
        }
      }

      supplierMap[key].productNames.add(product.name)

      if (isReject) {
        const rejectQty = Number(bin.qtyIssued || (bin as any).rejectQuantity || bin.qtyReceived || 0)
        supplierMap[key].totalRejected += rejectQty
        supplierMap[key].batchesCount += 1
      } else if (isEntry) {
        const receivedQty = Number(bin.qtyReceived || 0)
        supplierMap[key].totalReceived += receivedQty
        if (receivedQty > 0) supplierMap[key].batchesCount += 1
      }
    }

    // Fallback: If product has baseline quantity and supplierName, but 0 movements recorded yet
    if (wh1Entries.length === 0 && binEntries.length === 0 && Number(product.quantity || 0) > 0) {
      const supplier = fallbackSupplier
      const key = supplier.toLowerCase()
      if (!supplierMap[key]) {
        supplierMap[key] = {
          name: supplier,
          totalReceived: 0,
          totalRejected: 0,
          batchesCount: 1,
          productNames: new Set([product.name]),
        }
      }
      supplierMap[key].totalReceived += Number(product.quantity || 0)
    }
  }

  // 2. Build array of Supplier Quality Metrics with calculated rates & grades
  const supplierMetrics: SupplierQualityMetric[] = Object.values(supplierMap)
    .filter((s) => s.totalReceived > 0 || s.totalRejected > 0)
    .map((s) => {
      // If received is 0 but rejects exist, clamp received to rejects for sensible %
      const effectiveReceived = Math.max(s.totalReceived, s.totalRejected)
      const rejectRate = effectiveReceived > 0 ? (s.totalRejected / effectiveReceived) * 100 : 0
      const cleanYieldRate = Math.max(0, 100 - rejectRate)
      const netYield = Math.max(0, s.totalReceived - s.totalRejected)

      let grade: "Grade A" | "Grade B" | "Grade C" = "Grade A"
      let gradeLabel = "Grade A (Excellent ≤5% Loss)"
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

      return {
        supplierName: s.name,
        totalReceived: Number(s.totalReceived.toFixed(2)),
        totalRejected: Number(s.totalRejected.toFixed(2)),
        netYield: Number(netYield.toFixed(2)),
        rejectRate: Number(rejectRate.toFixed(1)),
        cleanYieldRate: Number(cleanYieldRate.toFixed(1)),
        batchesCount: s.batchesCount,
        products: Array.from(s.productNames),
        grade,
        gradeLabel,
        gradeColor,
      }
    })
    // Sort suppliers by lowest reject rate (highest quality first)
    .sort((a, b) => a.rejectRate - b.rejectRate || b.totalReceived - a.totalReceived)

  // 3. Compute overall WH1 enterprise aggregates
  const hasRealData = supplierMetrics.length > 0
  const finalMetrics = hasRealData ? supplierMetrics : DEFAULT_BENCHMARK_SUPPLIERS

  const overallTotalReceived = finalMetrics.reduce((sum, s) => sum + s.totalReceived, 0)
  const overallTotalRejected = finalMetrics.reduce((sum, s) => sum + s.totalRejected, 0)
  const overallNetYield = Math.max(0, overallTotalReceived - overallTotalRejected)
  const overallRejectRate =
    overallTotalReceived > 0 ? Number(((overallTotalRejected / overallTotalReceived) * 100).toFixed(1)) : 0

  const topSupplier = finalMetrics.length > 0 ? finalMetrics[0] : null
  const highestRejectSupplier =
    finalMetrics.length > 0
      ? [...finalMetrics].sort((a, b) => b.rejectRate - a.rejectRate)[0]
      : null

  return {
    supplierMetrics: finalMetrics,
    overallTotalReceived: Number(overallTotalReceived.toFixed(2)),
    overallTotalRejected: Number(overallTotalRejected.toFixed(2)),
    overallNetYield: Number(overallNetYield.toFixed(2)),
    overallRejectRate,
    topSupplier,
    highestRejectSupplier,
    totalSuppliersCount: finalMetrics.length,
    availableProducts,
    isSampleData: !hasRealData,
  }
}

const DEFAULT_BENCHMARK_SUPPLIERS: SupplierQualityMetric[] = [
  {
    supplierName: "Abyssinia Agri Union",
    totalReceived: 450,
    totalRejected: 18,
    netYield: 432,
    rejectRate: 4.0,
    cleanYieldRate: 96.0,
    batchesCount: 4,
    products: ["Sesame Grade 1"],
    grade: "Grade A",
    gradeLabel: "Grade A (Excellent ≤5% Loss)",
    gradeColor: "emerald",
  },
  {
    supplierName: "Nile Valley Produce",
    totalReceived: 620,
    totalRejected: 43.4,
    netYield: 576.6,
    rejectRate: 7.0,
    cleanYieldRate: 93.0,
    batchesCount: 5,
    products: ["Soya Beans Export"],
    grade: "Grade B",
    gradeLabel: "Grade B (Moderate 5–10% Loss)",
    gradeColor: "amber",
  },
  {
    supplierName: "Rift Valley Farmers",
    totalReceived: 320,
    totalRejected: 38.4,
    netYield: 281.6,
    rejectRate: 12.0,
    cleanYieldRate: 88.0,
    batchesCount: 3,
    products: ["Red Kidney Beans"],
    grade: "Grade C",
    gradeLabel: "Grade C (High Loss >10%)",
    gradeColor: "rose",
  },
]
