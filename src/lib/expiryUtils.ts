import { isExportWarehouse } from "./warehouses"
import type { Product } from "./erpStore"

export type ExpiryTier = "EXPIRED" | "CRITICAL" | "WARNING" | "GOOD" | "UNKNOWN"

export const WATCH_THRESHOLD_DAYS = 270 // 9 Months
export const CRITICAL_THRESHOLD_DAYS = 180 // 6 Months

export interface ExpiryStatusResult {
  tier: ExpiryTier
  days: number | null
  months: number | null
  label: string
  sublabel: string
  badgeClass: string
  dotClass: string
  isAlert: boolean
}

/**
 * Calculates real-time expiry tier, days/months remaining, and visual styling.
 * Rule for WH2 & WH3:
 * - 9 Months left (<= 270 days) = Watch (Warning)
 * - 6 Months left (<= 180 days) = Critical
 * - Expired (< 0 days) = Expired
 */
export function getExpiryStatus(
  expiryDateStr?: string | null,
  alertThresholdDays = WATCH_THRESHOLD_DAYS
): ExpiryStatusResult {
  if (!expiryDateStr || expiryDateStr.trim() === "" || expiryDateStr === "—") {
    return {
      tier: "UNKNOWN",
      days: null,
      months: null,
      label: "No Expiry Date",
      sublabel: "Non-perishable",
      badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200",
      dotClass: "bg-zinc-400",
      isAlert: false,
    }
  }

  const expDate = new Date(expiryDateStr)
  if (isNaN(expDate.getTime())) {
    return {
      tier: "UNKNOWN",
      days: null,
      months: null,
      label: "Invalid Date",
      sublabel: expiryDateStr,
      badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200",
      dotClass: "bg-zinc-400",
      isAlert: false,
    }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate())

  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const approxMonths = Number((diffDays / 30).toFixed(1))

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays)
    return {
      tier: "EXPIRED",
      days: diffDays,
      months: approxMonths,
      label: "Expired",
      sublabel: `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`,
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300 font-black",
      dotClass: "bg-rose-600",
      isAlert: true,
    }
  }

  if (diffDays === 0) {
    return {
      tier: "CRITICAL",
      days: 0,
      months: 0,
      label: "Expires Today",
      sublabel: "Immediate action required",
      badgeClass: "bg-rose-100 text-rose-900 border-rose-300 font-black animate-pulse",
      dotClass: "bg-rose-600",
      isAlert: true,
    }
  }

  // Critical: 6 Months (<= 180 days)
  if (diffDays <= CRITICAL_THRESHOLD_DAYS) {
    return {
      tier: "CRITICAL",
      days: diffDays,
      months: approxMonths,
      label: diffDays <= 30 ? `${diffDays}d (Critical)` : `${approxMonths} mo (Critical)`,
      sublabel: `Critical (≤ 6 months left)`,
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80 font-black",
      dotClass: "bg-rose-500",
      isAlert: true,
    }
  }

  // Watch: 9 Months (<= 270 days)
  if (diffDays <= alertThresholdDays) {
    return {
      tier: "WARNING",
      days: diffDays,
      months: approxMonths,
      label: `${approxMonths} mo (Watch)`,
      sublabel: `Watch (≤ 9 months left)`,
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80 font-bold",
      dotClass: "bg-amber-500",
      isAlert: true,
    }
  }

  return {
    tier: "GOOD",
    days: diffDays,
    months: approxMonths,
    label: `${approxMonths} mo left`,
    sublabel: "Healthy shelf life (> 9 months)",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/60 font-semibold",
    dotClass: "bg-emerald-500",
    isAlert: false,
  }
}

export interface ExpiringItem {
  id: string
  productId: string
  productName: string
  sku: string
  batchNo: string
  warehouseId: string
  warehouseName: string
  expiryDate: string
  daysRemaining: number
  monthsRemaining: number
  tier: ExpiryTier
  quantity: number
  unit: string
  unitCost: number
  totalAtRiskValue: number
}

/**
 * Aggregates all expiring batches and products for WH2 & WH3.
 * WH1 raw commodities are excluded from expiration monitoring.
 */
export function getExpiringItemsSummary(
  products: Product[],
  options?: {
    thresholdDays?: number
    warehouseId?: string
    tierFilter?: "ALL" | "EXPIRED" | "CRITICAL" | "WARNING"
  }
): {
  items: ExpiringItem[]
  totalExpiredCount: number
  totalCriticalCount: number
  totalWarningCount: number
  totalAtRiskValue: number
} {
  const threshold = options?.thresholdDays ?? WATCH_THRESHOLD_DAYS
  const warehouseFilter = options?.warehouseId && options.warehouseId !== "ALL" ? options.warehouseId : null
  const tierFilter = options?.tierFilter && options.tierFilter !== "ALL" ? options.tierFilter : null

  const allItems: ExpiringItem[] = []
  let totalExpiredCount = 0
  let totalCriticalCount = 0
  let totalWarningCount = 0
  let totalAtRiskValue = 0

  for (const product of products) {
    // Exclude export warehouse products (raw commodity grain/coffee warehouses)
    if (isExportWarehouse(product.warehouse)) continue

    if (
      warehouseFilter &&
      product.warehouse !== warehouseFilter &&
      !product.stockBreakdown?.some((sb) => sb.warehouse === warehouseFilter)
    ) {
      continue
    }

    const batchesToProcess: Array<{ batchNo: string; expiry: string; qty: number }> = []

    if (Array.isArray(product.batches) && product.batches.length > 0) {
      product.batches.forEach((b) => {
        if (b.expiry) {
          batchesToProcess.push({
            batchNo: b.batchNo || product.batch || "BATCH-01",
            expiry: b.expiry,
            qty: Number(b.qty) || Number(product.quantity) || 0,
          })
        }
      })
    }

    // If no batches array but product has an expiry date
    if (batchesToProcess.length === 0 && product.expiry) {
      batchesToProcess.push({
        batchNo: product.batch || "PRIMARY",
        expiry: product.expiry,
        qty: Number(product.quantity) || 0,
      })
    }

    for (const b of batchesToProcess) {
      const status = getExpiryStatus(b.expiry, threshold)
      if (status.tier === "EXPIRED") totalExpiredCount++
      if (status.tier === "CRITICAL") totalCriticalCount++
      if (status.tier === "WARNING") totalWarningCount++

      if (status.isAlert) {
        const itemVal = (b.qty || 0) * (product.unitCost || product.sellingPrice || 0)
        totalAtRiskValue += itemVal

        if (!tierFilter || status.tier === tierFilter) {
          allItems.push({
            id: `${product.id}-${b.batchNo}`,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            batchNo: b.batchNo,
            warehouseId: product.warehouse,
            warehouseName: product.warehouseName || product.warehouse,
            expiryDate: b.expiry,
            daysRemaining: status.days ?? 0,
            monthsRemaining: status.months ?? 0,
            tier: status.tier,
            quantity: b.qty,
            unit: product.unit || "Unit",
            unitCost: product.unitCost || product.sellingPrice || 0,
            totalAtRiskValue: itemVal,
          })
        }
      }
    }
  }

  // Sort by urgency: most expired / fewest days remaining first
  allItems.sort((a, b) => a.daysRemaining - b.daysRemaining)

  return {
    items: allItems,
    totalExpiredCount,
    totalCriticalCount,
    totalWarningCount,
    totalAtRiskValue,
  }
}
