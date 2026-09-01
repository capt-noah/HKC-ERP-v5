export interface ProcessingFeeRates {
  processingRatePerQuintal: number // default 150
  baseStorageRatePerQuintalDay: number // default 1.25
  storageIncrementPerMonth: number // default 0.25
  maxStorageMonthCap: number // default 4
  storageFreeDays?: number // default from admin settings (e.g. 7 or 15 days)
}

export interface ProcessingFeeCalculation {
  quantityQuintals: number
  daysInStorage: number
  processingFee: number
  storageFee: number
  storageFeeBreakdown: {
    monthLabel: string
    daysInMonth: number
    ratePerQuintalDay: number
    monthTotal: number
  }[]
  totalFee: number
}

export interface ProcessingFeeCalculationOptions {
  lockedProcessingRate?: number | null
  lockedProcessingFee?: number | null
  lockedStorageFee?: number | null
  lockedTotalFee?: number | null
  isDelivered?: boolean
}

export function calculateProcessingServiceFee(
  quantityQuintals: number,
  entryDateStr: string,
  endDateStr?: string | null,
  isProcessed: boolean = false,
  rates: Partial<ProcessingFeeRates> = {},
  options: ProcessingFeeCalculationOptions = {}
): ProcessingFeeCalculation {
  const procRate = rates.processingRatePerQuintal ?? 150
  const baseStorage = rates.baseStorageRatePerQuintalDay ?? 1.25
  const increment = rates.storageIncrementPerMonth ?? 0.25
  const maxMonth = rates.maxStorageMonthCap ?? 4
  const freeDays = Math.max(0, rates.storageFreeDays ?? 0)

  const qty = Math.max(0, Number(quantityQuintals) || 0)

  // 1. Processing Fee (uses locked fee/rate if order was already processed, otherwise uses dynamic live rate)
  let processingFee = 0
  if (isProcessed) {
    if (options.lockedProcessingFee !== undefined && options.lockedProcessingFee !== null) {
      processingFee = Number(options.lockedProcessingFee)
    } else if (options.lockedProcessingRate !== undefined && options.lockedProcessingRate !== null) {
      processingFee = qty * Number(options.lockedProcessingRate)
    } else {
      processingFee = qty * procRate
    }
  }

  // 2. Full Calendar Days in Storage
  let daysInStorage = 0
  if (entryDateStr) {
    const start = new Date(entryDateStr)
    const end = endDateStr ? new Date(endDateStr) : new Date()
    const startTime = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
    const endTime = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
    daysInStorage = Math.max(0, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)))
  }

  // 3. Tiered Storage Fee Calculation with Free Grace Period
  const breakdown: ProcessingFeeCalculation["storageFeeBreakdown"] = []
  let storageFee = 0

  // Handle Free Grace Period
  const daysInGrace = Math.min(daysInStorage, freeDays)
  if (daysInGrace > 0) {
    breakdown.push({
      monthLabel: `Grace Period (Days 1–${daysInGrace})`,
      daysInMonth: daysInGrace,
      ratePerQuintalDay: 0,
      monthTotal: 0,
    })
  }

  // Chargeable days after grace period
  let remainingChargeableDays = Math.max(0, daysInStorage - freeDays)
  let currentChargeableDay = daysInGrace
  let monthIndex = 1

  while (remainingChargeableDays > 0) {
    const daysInThisMonth = Math.min(30, remainingChargeableDays)
    const effectiveMonth = Math.min(monthIndex, maxMonth)
    const tierIncrementCount = Math.max(0, effectiveMonth - 1)
    const rateForThisMonth = baseStorage + tierIncrementCount * increment

    const monthTotal = qty * daysInThisMonth * rateForThisMonth
    storageFee += monthTotal

    breakdown.push({
      monthLabel: `Month ${monthIndex} (Days ${currentChargeableDay + 1}–${currentChargeableDay + daysInThisMonth})`,
      daysInMonth: daysInThisMonth,
      ratePerQuintalDay: rateForThisMonth,
      monthTotal,
    })

    remainingChargeableDays -= daysInThisMonth
    currentChargeableDay += daysInThisMonth
    monthIndex++
  }

  const finalStorageFee = (options.isDelivered && options.lockedStorageFee !== undefined && options.lockedStorageFee !== null)
    ? Number(options.lockedStorageFee)
    : Math.round(storageFee * 100) / 100

  const finalTotalFee = (options.isDelivered && options.lockedTotalFee !== undefined && options.lockedTotalFee !== null)
    ? Number(options.lockedTotalFee)
    : Math.round((processingFee + finalStorageFee) * 100) / 100

  return {
    quantityQuintals: qty,
    daysInStorage,
    processingFee,
    storageFee: finalStorageFee,
    storageFeeBreakdown: breakdown,
    totalFee: finalTotalFee,
  }
}
