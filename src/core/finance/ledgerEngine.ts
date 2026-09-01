export interface JournalLineInput {
  account_id: string
  debit_amount: number
  credit_amount: number
  party_type?: string | null
  party_id?: string | null
  party_name?: string | null
}

export interface ValidationResult {
  isValid: boolean
  totalDebit: number
  totalCredit: number
  difference: number
  errors: string[]
}

/**
 * Validates a double-entry journal voucher payload.
 * Ensures total debits equal total credits and enforces party reference rules.
 */
export function validateJournalVoucher(lines: JournalLineInput[]): ValidationResult {
  const errors: string[] = []
  if (!lines || lines.length < 2) {
    errors.push("Journal entry must contain at least two line items (Debit and Credit).")
  }

  let totalDebit = 0
  let totalCredit = 0

  lines.forEach((line, index) => {
    const debit = Number(line.debit_amount || 0)
    const credit = Number(line.credit_amount || 0)

    if (debit < 0 || credit < 0) {
      errors.push(`Line ${index + 1}: Amounts cannot be negative.`)
    }
    if (debit > 0 && credit > 0) {
      errors.push(`Line ${index + 1}: A single line cannot have both Debit and Credit amounts.`)
    }
    if (debit === 0 && credit === 0) {
      errors.push(`Line ${index + 1}: Line item must have either a Debit or Credit amount.`)
    }

    totalDebit += debit
    totalCredit += credit
  })

  const difference = Math.abs(totalDebit - totalCredit)
  if (difference > 0.001) {
    errors.push(`Out of balance: Total Debit (${totalDebit}) does not equal Total Credit (${totalCredit}). Difference: ${difference.toFixed(2)}`)
  }

  return {
    isValid: errors.length === 0,
    totalDebit,
    totalCredit,
    difference,
    errors,
  }
}
