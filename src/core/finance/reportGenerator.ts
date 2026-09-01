export interface AccountSummary {
  id: string
  code: string
  name: string
  type: string
  debit: number
  credit: number
  balance: number
}

export interface FinancialStatementResult {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  isBalanced: boolean
}

/**
 * Calculates Trial Balance, Balance Sheet, and Income Statement metrics.
 */
export function generateFinancialReportSummary(accounts: any[], lines: any[]): FinancialStatementResult {
  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquity = 0
  let totalRevenue = 0
  let totalExpenses = 0

  const accountMap = new Map<string, { debit: number; credit: number; type: string }>()

  accounts.forEach((acc) => {
    accountMap.set(acc.id, { debit: 0, credit: 0, type: acc.type || acc.account_type || "Asset" })
  })

  lines.forEach((line) => {
    const acc = accountMap.get(line.account_id)
    if (acc) {
      acc.debit += Number(line.debit_amount || line.debit || 0)
      acc.credit += Number(line.credit_amount || line.credit || 0)
    }
  })

  accountMap.forEach((data) => {
    const netBalance = data.debit - data.credit
    const category = (data.type || "").toUpperCase()

    if (category.includes("ASSET")) {
      totalAssets += netBalance
    } else if (category.includes("LIABILITY")) {
      totalLiabilities += -netBalance
    } else if (category.includes("EQUITY")) {
      totalEquity += -netBalance
    } else if (category.includes("REVENUE") || category.includes("INCOME")) {
      totalRevenue += -netBalance
    } else if (category.includes("EXPENSE") || category.includes("COST")) {
      totalExpenses += netBalance
    }
  })

  const netIncome = totalRevenue - totalExpenses
  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 1.0

  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalRevenue,
    totalExpenses,
    netIncome,
    isBalanced,
  }
}
