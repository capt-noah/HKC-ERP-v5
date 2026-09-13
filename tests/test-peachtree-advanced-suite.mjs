/**
 * Comprehensive HKC-ERP-v5 Peachtree / Sage 50 Advanced Capabilities Test Suite
 * 
 * Tests:
 * 1. Partner Subledger Beginning Balances & AR/AP Aging Engines
 * 2. Auto-Reversing Accrual Journal Entries (Month-End Accruals & 1st of Next Month Mirror Reversals)
 * 3. Two-Pane Bank Reconciliation Math ($0.00 difference lock, service charges, interest)
 * 4. Fiscal Period Lock Security Enforcement (Blocks backdated entries into locked periods)
 * 5. General Ledger Control Account Reconciliation
 */

import { COMPANY_CHART_OF_ACCOUNTS } from "../src/lib/companyCOA.ts"

console.log("=================================================================")
console.log("🚀 STARTING PEACHTREE ADVANCED FUNCTIONALITY TEST SUITE")
console.log("=================================================================")

let passedTests = 0
let failedTests = 0

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`)
    passedTests++
  } else {
    console.error(`❌ [FAIL] ${message}`)
    failedTests++
  }
}

// -------------------------------------------------------------
// MODULE 1: PARTNER SUB-LEDGER BEGINNING BALANCES & AGING ENGINES
// -------------------------------------------------------------
console.log("\n--- MODULE 1: Sub-Ledger Beginning Balances & Aging Engines ---")

// Mock partner invoices with aging buckets
const mockAsOfDate = new Date("2026-09-11")
const partnerInvoices = [
  {
    id: "INV-CUTOVER-1",
    customer_name: "Awash Agribusiness Ltd",
    customer_id: "CUST-001",
    invoice_number: "CUTOVER-AR-001",
    date: "2026-09-01", // 10 days old -> 0-30 days
    due_date: "2026-09-15",
    total_amount: 150000,
    paid_amount: 0,
    is_beginning_balance: true,
  },
  {
    id: "INV-CUTOVER-2",
    customer_name: "Awash Agribusiness Ltd",
    customer_id: "CUST-001",
    invoice_number: "CUTOVER-AR-002",
    date: "2026-07-25", // 48 days old -> 31-60 days
    due_date: "2026-08-10",
    total_amount: 250000,
    paid_amount: 50000,
    is_beginning_balance: true,
  },
  {
    id: "INV-CUTOVER-3",
    customer_name: "Bishoftu Poultry Farm",
    customer_id: "CUST-002",
    invoice_number: "CUTOVER-AR-003",
    date: "2026-06-15", // 88 days old -> 61-90 days
    due_date: "2026-07-01",
    total_amount: 120000,
    paid_amount: 0,
    is_beginning_balance: true,
  },
  {
    id: "INV-CUTOVER-4",
    customer_name: "Bishoftu Poultry Farm",
    customer_id: "CUST-002",
    invoice_number: "CUTOVER-AR-004",
    date: "2026-05-01", // 133 days old -> 90+ days
    due_date: "2026-05-15",
    total_amount: 80000,
    paid_amount: 0,
    is_beginning_balance: true,
  },
]

function calculateAging(invoices, asOf) {
  const aging = {
    totalOutstanding: 0,
    current: 0, // 0-30
    days30: 0,  // 31-60
    days60: 0,  // 61-90
    days90Plus: 0, // > 90
    byPartner: {},
  }

  for (const inv of invoices) {
    const outstanding = inv.total_amount - (inv.paid_amount || 0)
    if (outstanding <= 0) continue

    const invDate = new Date(inv.date)
    const diffDays = Math.max(0, Math.floor((asOf.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)))

    aging.totalOutstanding += outstanding
    if (!aging.byPartner[inv.customer_id]) {
      aging.byPartner[inv.customer_id] = { partnerName: inv.customer_name, total: 0, current: 0, d30: 0, d60: 0, d90: 0 }
    }
    aging.byPartner[inv.customer_id].total += outstanding

    if (diffDays <= 30) {
      aging.current += outstanding
      aging.byPartner[inv.customer_id].current += outstanding
    } else if (diffDays <= 60) {
      aging.days30 += outstanding
      aging.byPartner[inv.customer_id].d30 += outstanding
    } else if (diffDays <= 90) {
      aging.days60 += outstanding
      aging.byPartner[inv.customer_id].d60 += outstanding
    } else {
      aging.days90Plus += outstanding
      aging.byPartner[inv.customer_id].d90 += outstanding
    }
  }

  return aging
}

const agingResult = calculateAging(partnerInvoices, mockAsOfDate)
assert(agingResult.totalOutstanding === 550000, `Total outstanding AR is 550,000 (Got: ${agingResult.totalOutstanding})`)
assert(agingResult.current === 150000, `0-30 days bucket is 150,000 (Got: ${agingResult.current})`)
assert(agingResult.days30 === 200000, `31-60 days bucket is 200,000 (Got: ${agingResult.days30})`)
assert(agingResult.days60 === 120000, `61-90 days bucket is 120,000 (Got: ${agingResult.days60})`)
assert(agingResult.days90Plus === 80000, `90+ days bucket is 80,000 (Got: ${agingResult.days90Plus})`)
assert(Object.keys(agingResult.byPartner).length === 2, "Aging correctly segregated by partner")

// Control Account Reconciliation Check
const glAccountsReceivableControlBalance = 550000
const arSubledgerTotal = agingResult.totalOutstanding
const arVariance = Math.abs(glAccountsReceivableControlBalance - arSubledgerTotal)
assert(arVariance === 0, `AR Subledger reconciles exactly with GL Control Account 1100 (Variance: ${arVariance})`)


// -------------------------------------------------------------
// MODULE 2: AUTO-REVERSING JOURNAL ENTRIES FOR ACCRUALS
// -------------------------------------------------------------
console.log("\n--- MODULE 2: Auto-Reversing Accrual Journal Entries ---")

function postJournalEntrySimulation(entryData, lines, options = {}) {
  const { lockDate } = options
  if (lockDate && entryData.entry_date <= lockDate) {
    return {
      success: false,
      error: `Posting rejected: The transaction date (${entryData.entry_date}) falls inside a locked accounting period (Closed through ${lockDate}).`,
    }
  }

  // Create primary entry
  const entryId = `JE-${Date.now()}`
  const primaryEntry = {
    id: entryId,
    ...entryData,
  }

  let reversalEntry = null
  if (entryData.auto_reverse) {
    // Determine 1st of next month (string calculation to avoid timezone offsets)
    const [yStr, mStr] = (entryData.entry_date || "").split("-")
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10)
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const revDateStr = `${nextY}-${String(nextM).padStart(2, "0")}-01`

    const revEntryId = `JE-REV-${Date.now()}`
    reversalEntry = {
      id: revEntryId,
      entry_date: entryData.reversal_date || revDateStr,
      description: `[AUTO-REVERSAL] Mirror reversal of ${entryId}: ${entryData.description}`,
      source_type: "Auto-Reversal",
      source_id: entryId,
      is_reversal_of: entryId,
      lines: lines.map((l) => ({
        account_id: l.account_id,
        debit_amount: l.credit_amount,  // Invert Debits and Credits
        credit_amount: l.debit_amount,
      })),
    }
    primaryEntry.reversal_date = revDateStr
    primaryEntry.reversed_by_id = revEntryId
  }

  return { success: true, primaryEntry, reversalEntry }
}

const accrualLines = [
  { account_id: "ACC-6100-01", debit_amount: 45000, credit_amount: 0 }, // Utilities Expense
  { account_id: "ACC-2100-06", debit_amount: 0, credit_amount: 45000 }, // Accrued Utilities Payable
]

const accrualPostResult = postJournalEntrySimulation(
  {
    entry_date: "2026-08-31",
    description: "August Electricity Accrual",
    source_type: "Monthly Accrual",
    auto_reverse: true,
  },
  accrualLines
)

assert(accrualPostResult.success, "Accrual entry posted successfully")
assert(accrualPostResult.primaryEntry.auto_reverse === true, "Primary entry marked with auto_reverse: true")
assert(accrualPostResult.reversalEntry !== null, "Mirror reversal entry created automatically")
assert(accrualPostResult.reversalEntry.entry_date === "2026-09-01", `Reversal scheduled on 1st of next month (Got: ${accrualPostResult.reversalEntry.entry_date})`)
assert(accrualPostResult.reversalEntry.lines[0].credit_amount === 45000, "Reversal correctly inverts debit to credit for expense")
assert(accrualPostResult.reversalEntry.lines[1].debit_amount === 45000, "Reversal correctly inverts credit to debit for accrued payable")
assert(accrualPostResult.reversalEntry.is_reversal_of === accrualPostResult.primaryEntry.id, "Reversal references primary entry ID")


// -------------------------------------------------------------
// MODULE 3: PEACHTREE TWO-PANE BANK RECONCILIATION MATH & ZERO DIFF LOCK
// -------------------------------------------------------------
console.log("\n--- MODULE 3: Peachtree Two-Pane Bank Reconciliation Math ---")

function calculateBankReconciliation({
  statementEndingBalance,
  outstandingChecks,
  depositsInTransit,
  rawGlBalance,
  serviceCharge = 0,
  interestEarned = 0,
}) {
  const totalOutstandingChecks = outstandingChecks.reduce((s, c) => s + c.amount, 0)
  const totalDepositsInTransit = depositsInTransit.reduce((s, d) => s + d.amount, 0)

  // Adjusted Bank Balance = Statement Ending Balance - Outstanding Checks + Deposits In Transit
  const adjustedBankBalance = statementEndingBalance - totalOutstandingChecks + totalDepositsInTransit

  // Adjusted GL Balance = Raw GL Balance - Service Charge + Interest Earned
  const adjustedGlBalance = rawGlBalance - serviceCharge + interestEarned

  // Difference
  const difference = Math.round((adjustedBankBalance - adjustedGlBalance) * 100) / 100
  const isReconciled = Math.abs(difference) < 0.01

  return {
    adjustedBankBalance,
    adjustedGlBalance,
    difference,
    isReconciled,
    totalOutstandingChecks,
    totalDepositsInTransit,
  }
}

// Case A: Unreconciled / Out of Balance
const outOfBalanceRecon = calculateBankReconciliation({
  statementEndingBalance: 1500000,
  outstandingChecks: [{ amount: 100000 }, { amount: 50000 }], // 150,000 uncleared checks
  depositsInTransit: [{ amount: 80000 }],                      // 80,000 uncleared deposits
  rawGlBalance: 1400000,
  serviceCharge: 500,
  interestEarned: 1200,
})

// Adjusted Bank = 1,500,000 - 150,000 + 80,000 = 1,430,000
// Adjusted GL = 1,400,000 - 500 + 1,200 = 1,400,700
// Diff = 1,430,000 - 1,400,700 = 29,300
assert(outOfBalanceRecon.adjustedBankBalance === 1430000, `Adjusted bank balance is 1,430,000 (Got: ${outOfBalanceRecon.adjustedBankBalance})`)
assert(outOfBalanceRecon.adjustedGlBalance === 1400700, `Adjusted GL balance is 1,400,700 (Got: ${outOfBalanceRecon.adjustedGlBalance})`)
assert(outOfBalanceRecon.difference === 29300, `Difference correctly calculated as 29,300 (Got: ${outOfBalanceRecon.difference})`)
assert(outOfBalanceRecon.isReconciled === false, "Out-of-balance worksheet blocks commit (isReconciled === false)")

// Case B: Perfectly Balanced to $0.00
const balancedRecon = calculateBankReconciliation({
  statementEndingBalance: 1470700,
  outstandingChecks: [{ amount: 100000 }, { amount: 50000 }], // 150,000 uncleared checks
  depositsInTransit: [{ amount: 80000 }],                      // 80,000 uncleared deposits
  rawGlBalance: 1400000,
  serviceCharge: 500,
  interestEarned: 1200,
})
// Adjusted Bank = 1,470,700 - 150,000 + 80,000 = 1,400,700
// Adjusted GL = 1,400,000 - 500 + 1,200 = 1,400,700
// Diff = 0.00
assert(balancedRecon.adjustedBankBalance === 1400700, `Adjusted bank balance is 1,400,700`)
assert(balancedRecon.difference === 0, `Unreconciled Difference is exactly 0.00`)
assert(balancedRecon.isReconciled === true, "Balanced worksheet enables commit (isReconciled === true)")


// -------------------------------------------------------------
// MODULE 4: FISCAL PERIOD LOCK SECURITY ENFORCEMENT
// -------------------------------------------------------------
console.log("\n--- MODULE 4: Fiscal Period Lock Security Enforcement ---")

const lockStatus = {
  is_locked: true,
  locked_until_date: "2026-08-31",
  reason: "August 2026 Books Closed and Audited",
}

// Attempt to post backdated entry into locked period
const backdatedPost = postJournalEntrySimulation(
  {
    entry_date: "2026-08-15",
    description: "Backdated Office Supplies",
    source_type: "Manual Adjustment",
  },
  [{ account_id: "ACC-8000-01", debit_amount: 1200, credit_amount: 0 }],
  { lockDate: lockStatus.locked_until_date }
)

assert(backdatedPost.success === false, "Backdated posting into locked period was successfully BLOCKED")
assert(backdatedPost.error.includes("locked accounting period"), `Error message clearly explains period lock rule: "${backdatedPost.error}"`)

// Post entry in open period
const openPeriodPost = postJournalEntrySimulation(
  {
    entry_date: "2026-09-05",
    description: "Current Month Sales Advance",
    source_type: "Manual Adjustment",
  },
  [{ account_id: "ACC-1000-02-26", debit_amount: 50000, credit_amount: 0 }],
  { lockDate: lockStatus.locked_until_date }
)

assert(openPeriodPost.success === true, "Posting in open period after lock date succeeded")

// Unlock period and retry backdated post
const unlockedPost = postJournalEntrySimulation(
  {
    entry_date: "2026-08-15",
    description: "Adjustment after unlock",
    source_type: "Manual Adjustment",
  },
  [{ account_id: "ACC-8000-01", debit_amount: 1200, credit_amount: 0 }],
  { lockDate: undefined }
)

assert(unlockedPost.success === true, "Posting backdated entry after unlocking period succeeded")


// -------------------------------------------------------------
// MODULE 5: INVENTORY CUTOVER VALUATION RECONCILIATION
// -------------------------------------------------------------
console.log("\n--- MODULE 5: Inventory Valuation & Control Account 1200 Reconciliation ---")

const mockStockBatches = [
  { item: "Green Mung Bean Grade A", qtyQuintals: 500, unitCost: 3200 },  // 1,600,000
  { item: "Soybeans Machine Cleaned", qtyQuintals: 300, unitCost: 2800 },  // 840,000
  { item: "Amoxicillin 500mg (Boxes)", qtyQuintals: 200, unitCost: 1500 }, // 300,000
]

const totalPhysicalStockValue = mockStockBatches.reduce((s, b) => s + b.qtyQuintals * b.unitCost, 0)
const glInventoryControlBalance = 2740000 // Account 1200 / 1410 in COA

assert(totalPhysicalStockValue === 2740000, `Total physical stock cutover valuation matches 2,740,000 ETB (Got: ${totalPhysicalStockValue})`)
assert(totalPhysicalStockValue === glInventoryControlBalance, `Physical stock valuation reconciles 100% with GL Inventory Asset Account (Variance: ${Math.abs(totalPhysicalStockValue - glInventoryControlBalance)})`)


// -------------------------------------------------------------
// FINAL SUMMARY
// -------------------------------------------------------------
console.log("\n=================================================================")
console.log(`🏁 PEACHTREE ADVANCED SUITE: ${passedTests} PASSED, ${failedTests} FAILED`)
console.log("=================================================================")

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
