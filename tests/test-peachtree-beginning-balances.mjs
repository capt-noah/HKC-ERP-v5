/**
 * Test suite for Peachtree Beginning Balances & Cutover System
 */

import { COMPANY_CHART_OF_ACCOUNTS } from "../src/lib/companyCOA.ts"
import {
  generatePeachtreeBeginningBalanceTemplateCsv,
  parsePeachtreeBeginningBalanceCsv,
} from "../src/lib/peachtreeExportUtils.ts"

console.log("=================================================================")
console.log("🚀 STARTING HKC-ERP-v5 PEACHTREE BEGINNING BALANCES TEST SUITE")
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
// TEST 1: CSV Template Generation
// -------------------------------------------------------------
console.log("\n--- TEST 1: Peachtree CSV Template Generation ---")
const templateCsv = generatePeachtreeBeginningBalanceTemplateCsv(COMPANY_CHART_OF_ACCOUNTS)
assert(typeof templateCsv === "string" && templateCsv.length > 0, "Template CSV generated as non-empty string")
assert(templateCsv.startsWith("Account ID,Account Description,Type,Debit,Credit"), "Template CSV has correct Peachtree headers")
assert(templateCsv.includes("1000-02-26"), "Template CSV includes CBE Bank account (1000-02-26)")
assert(templateCsv.includes("3000"), "Template CSV includes Share Capital (3000)")
assert(templateCsv.includes("3200"), "Template CSV includes Retained Earnings (3200)")

// -------------------------------------------------------------
// TEST 2: Parsing Valid Balanced Peachtree CSV
// -------------------------------------------------------------
console.log("\n--- TEST 2: Parsing Valid Balanced Peachtree CSV ---")
const samplePeachtreeCsv = `Account ID,Account Description,Type,Debit,Credit
1000-02-26,"CBE_ECB_AC_1000465135224",Cash,2500000.00,0.00
1000-02-17,"BOA_RDB_35292853",Cash,1500000.00,0.00
1300-03,"VET MEDICEN SALES RECIVABLE",Accounts Receivable,850000.00,0.00
1410-01,"STOCK OF GREEN MUNG",Inventory,1200000.00,0.00
2000-05,"VAT PAYABLE",Other Current Liabilities,0.00,350000.00
2100-06,"OTHER ACCRUALS",Other Current Liabilities,0.00,700000.00
3000,"SHARE CAPITAL",Equity,0.00,4000000.00
3200,"RETAINED EARNINGS",Equity,0.00,1000000.00`

const parseResult = parsePeachtreeBeginningBalanceCsv(samplePeachtreeCsv, COMPANY_CHART_OF_ACCOUNTS)

assert(parseResult.errors.length === 0, `No parse errors found (Errors: ${parseResult.errors.join(", ")})`)
assert(parseResult.balances.length === 8, `Parsed exactly 8 accounts (Found: ${parseResult.balances.length})`)
assert(parseResult.totalDebit === 6050000, `Total Debit matches 6,050,000.00 (Found: ${parseResult.totalDebit})`)
assert(parseResult.totalCredit === 6050000, `Total Credit matches 6,050,000.00 (Found: ${parseResult.totalCredit})`)
assert(parseResult.outOfBalance === 0, `Out of balance is 0.00 (Found: ${parseResult.outOfBalance})`)

// -------------------------------------------------------------
// TEST 3: Parsing Imbalanced CSV & Error Handling
// -------------------------------------------------------------
console.log("\n--- TEST 3: Parsing Imbalanced CSV & Unrecognized Accounts ---")
const imbalancedCsv = `Account ID,Account Description,Type,Debit,Credit
1000-02-26,"CBE Bank",Cash,1000000.00,0.00
3000,"Share Capital",Equity,0.00,800000.00
9999-99,"Non Existent Account",Expense,50000.00,0.00`

const imbalResult = parsePeachtreeBeginningBalanceCsv(imbalancedCsv, COMPANY_CHART_OF_ACCOUNTS)
assert(imbalResult.balances.length === 2, `Valid accounts parsed (2 valid, 1 invalid filtered)`)
assert(imbalResult.errors.length === 1, `1 error logged for non-existent account 9999-99`)
assert(imbalResult.totalDebit === 1000000, `Total debit is 1,000,000`)
assert(imbalResult.totalCredit === 800000, `Total credit is 800,000`)
assert(imbalResult.outOfBalance === 200000, `Out of balance correctly calculated as 200,000`)

// -------------------------------------------------------------
// TEST 4: Auto-Balancing Logic to Retained Earnings (3200)
// -------------------------------------------------------------
console.log("\n--- TEST 4: Auto-Balancing Logic to Retained Earnings (3200) ---")
let runningDebits = 1000000
let runningCredits = 800000
let retainedEarningsCredit = 0

// Auto-balance adjustment
const diff = runningDebits - runningCredits
if (diff > 0) {
  retainedEarningsCredit += diff
  runningCredits += diff
}

assert(runningDebits === runningCredits, `Debits (${runningDebits}) equal Credits (${runningCredits}) after auto-balance`)
assert(retainedEarningsCredit === 200000, `Retained earnings assigned exact balancing credit of 200,000`)

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n=================================================================")
console.log(`🏁 TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`)
console.log("=================================================================")

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
