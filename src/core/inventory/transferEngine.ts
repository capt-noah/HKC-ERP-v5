export interface StockTransferInput {
  transferId: string
  sourceWarehouseId: string
  targetWarehouseId: string
  items: { productId: string; qty: number }[]
}

export interface TransferValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Validates a Store Transfer (Material Transfer Note) between warehouses.
 */
export function validateTransferNote(input: StockTransferInput): TransferValidationResult {
  const errors: string[] = []

  if (!input.sourceWarehouseId || !input.targetWarehouseId) {
    errors.push("Both source and target warehouses must be specified.")
  }
  if (input.sourceWarehouseId === input.targetWarehouseId) {
    errors.push("Source warehouse and target warehouse cannot be the same.")
  }
  if (!input.items || input.items.length === 0) {
    errors.push("Stock transfer must contain at least one product item.")
  }

  input.items.forEach((item, index) => {
    if (!item.productId) {
      errors.push(`Item ${index + 1}: Missing product identifier.`)
    }
    if (!item.qty || item.qty <= 0) {
      errors.push(`Item ${index + 1}: Transfer quantity must be greater than zero.`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}
