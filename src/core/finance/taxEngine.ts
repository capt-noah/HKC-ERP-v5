export interface TaxCalculationResult {
  subtotal: number
  taxAmount: number
  grandTotal: number
  withholdingTax: number
  netPayable: number
}

/**
 * Computes tax amounts, inclusive/exclusive VAT, and withholding taxes.
 */
export function calculateTaxBreakdown(
  subtotal: number,
  vatRatePercentage = 15,
  isTaxInclusive = false,
  withholdingRatePercentage = 2
): TaxCalculationResult {
  let sub = subtotal
  let tax = 0
  let total = 0

  if (isTaxInclusive) {
    total = subtotal
    sub = subtotal / (1 + vatRatePercentage / 100)
    tax = total - sub
  } else {
    sub = subtotal
    tax = subtotal * (vatRatePercentage / 100)
    total = sub + tax
  }

  const wht = sub * (withholdingRatePercentage / 100)
  const netPayable = total - wht

  return {
    subtotal: Math.round(sub * 100) / 100,
    taxAmount: Math.round(tax * 100) / 100,
    grandTotal: Math.round(total * 100) / 100,
    withholdingTax: Math.round(wht * 100) / 100,
    netPayable: Math.round(netPayable * 100) / 100,
  }
}
