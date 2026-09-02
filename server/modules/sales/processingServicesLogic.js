export const VALID_PROCESSING_STAGES = [
  "Received",
  "Processed",
  "Delivered",
]

export function validateProcessingServiceOrder(input) {
  const errors = []
  if (!input?.client_company_name && !input?.customer_name && !input?.customer_id) {
    errors.push("Client / Customer name is required.")
  }
  if (!input?.goods_description) {
    errors.push("Goods description is required.")
  }
  if (Number(input?.quantity || 0) <= 0) {
    errors.push("Quantity must be greater than zero.")
  }
  if (Number(input?.agreed_price || 0) < 0) {
    errors.push("Agreed price cannot be negative.")
  }
  return errors
}

export function calculateProcessingServiceFee(
  quantityQuintals,
  entryDateStr,
  endDateStr = null,
  isProcessed = false,
  rates = {},
  options = {}
) {
  const procRate = rates.processingRatePerQuintal ?? 150
  const baseStorage = rates.baseStorageRatePerQuintalDay ?? 1.25
  const increment = rates.storageIncrementPerMonth ?? 0.25
  const maxMonth = rates.maxStorageMonthCap ?? 4
  const freeDays = Math.max(0, rates.storageFreeDays ?? 0)

  const qty = Math.max(0, Number(quantityQuintals) || 0)

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

  let daysInStorage = 0
  if (entryDateStr) {
    const start = new Date(entryDateStr)
    const end = endDateStr ? new Date(endDateStr) : new Date()
    const startTime = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
    const endTime = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
    daysInStorage = Math.max(0, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)))
  }

  const breakdown = []
  let storageFee = 0

  const daysInGrace = Math.min(daysInStorage, freeDays)
  if (daysInGrace > 0) {
    breakdown.push({
      monthLabel: `Grace Period (Days 1–${daysInGrace})`,
      daysInMonth: daysInGrace,
      ratePerQuintalDay: 0,
      monthTotal: 0,
    })
  }

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

    currentChargeableDay += daysInThisMonth
    remainingChargeableDays -= daysInThisMonth
    monthIndex++
  }

  if (options.lockedStorageFee !== undefined && options.lockedStorageFee !== null && options.isDelivered) {
    storageFee = Number(options.lockedStorageFee)
  }

  const calculatedTotal = processingFee + storageFee
  const totalFee =
    options.lockedTotalFee !== undefined && options.lockedTotalFee !== null && options.isDelivered
      ? Number(options.lockedTotalFee)
      : calculatedTotal

  return {
    quantityQuintals: qty,
    daysInStorage,
    processingFee,
    storageFee,
    storageFeeBreakdown: breakdown,
    totalFee,
  }
}

export function generateProcessingServiceRevenueJournalEntry(order) {
  const amount = Number(order.agreed_price || order.agreedPrice || 0)
  const clientName = order.client_company_name || order.customer_name || order.clientName || "Client Company"
  const orderId = order.id || order.reference_number || "PS-0001"

  return {
    id: `JE-PS-${orderId.replace(/[^a-zA-Z0-9]/g, "")}`,
    journalNumber: `JV-PS-${Date.now().toString().slice(-4)}`,
    date: new Date().toISOString().split("T")[0],
    reference: `Processing Fee - ${orderId} (${clientName})`,
    sourceType: "Service Revenue",
    sourceId: orderId,
    description: `Service revenue recognized for toll processing of ${order.goods_description} (${order.quantity} ${order.uom})`,
    status: "POSTED",
    createdBy: "System Automator",
    lines: [
      {
        id: `LINE-1-${Date.now()}`,
        accountId: "1200",
        accountName: "Accounts Receivable",
        debitAmount: amount,
        creditAmount: 0,
        memo: `AR Receivable for processing fee - ${clientName}`,
        party_id: order.customer_id || null,
        party_name: clientName,
      },
      {
        id: `LINE-2-${Date.now()}`,
        accountId: "4002",
        accountName: "Service Processing Revenue",
        debitAmount: 0,
        creditAmount: amount,
        memo: `Service fee earned at WH1 for processing ${order.goods_description}`,
        party_id: order.customer_id || null,
        party_name: clientName,
      },
    ],
  }
}
