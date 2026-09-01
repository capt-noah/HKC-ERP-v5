import type { Product } from "./erpStore"

export type ExpiryTier = "EXPIRED" | "CRITICAL" | "WARNING" | "GOOD" | "UNKNOWN"

export interface ExpiryStatusResult {
  tier: ExpiryTier
  days: number | null
  label: string
  sublabel: string
  badgeClass: string
  dotClass: string
  isAlert: boolean
}

/**
 * Calculates real-time expiry tier, days remaining, and visual styling for a given date.
 */
export function getExpiryStatus(expiryDateStr?: string | null, alertThresholdDays = 90): ExpiryStatusResult {
  if (!expiryDateStr || expiryDateStr.trim() === "" || expiryDateStr === "—") {
    return {
      tier: "UNKNOWN",
      days: null,
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

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays)
    return {
      tier: "EXPIRED",
      days: diffDays,
      label: "Expired",
      sublabel: `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`,
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80 font-black",
      dotClass: "bg-rose-500",
      isAlert: true,
    }
  }

  if (diffDays === 0) {
    return {
      tier: "CRITICAL",
      days: 0,
      label: "Expires Today",
      sublabel: "Immediate action required",
      badgeClass: "bg-rose-100 text-rose-900 border-rose-300 font-black animate-pulse",
      dotClass: "bg-rose-600",
      isAlert: true,
    }
  }

  if (diffDays <= 30) {
    return {
      tier: "CRITICAL",
      days: diffDays,
      label: `Expires in ${diffDays}d`,
      sublabel: "Critical (<= 30 days)",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300 font-black",
      dotClass: "bg-amber-500",
      isAlert: true,
    }
  }

  if (diffDays <= alertThresholdDays) {
    return {
      tier: "WARNING",
      days: diffDays,
      label: `Expires in ${diffDays}d`,
      sublabel: `Warning (<= ${alertThresholdDays} days)`,
      badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200 font-bold",
      dotClass: "bg-yellow-500",
      isAlert: true,
    }
  }

  return {
    tier: "GOOD",
    days: diffDays,
    label: `${diffDays} days left`,
    sublabel: "Good condition",
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
  tier: ExpiryTier
  quantity: number
  unit: string
  unitCost: number
  totalAtRiskValue: number
}

/**
 * Aggregates all expiring batches and products, computing at-risk quantities and financial value.
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
  const threshold = options?.thresholdDays ?? 90
  const warehouseFilter = options?.warehouseId && options.warehouseId !== "ALL" ? options.warehouseId : null
  const tierFilter = options?.tierFilter && options.tierFilter !== "ALL" ? options.tierFilter : null

  const allItems: ExpiringItem[] = []
  let totalExpiredCount = 0
  let totalCriticalCount = 0
  let totalWarningCount = 0
  let totalAtRiskValue = 0

  for (const product of products) {
    if (warehouseFilter && product.warehouse !== warehouseFilter && !product.stockBreakdown?.some(sb => sb.warehouse === warehouseFilter)) {
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
