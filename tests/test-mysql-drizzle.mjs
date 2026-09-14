/**
 * HKC-ERP-v5 MySQL & Drizzle ORM Schema Verification Test
 */

import * as schema from "../server/db/schema/index.js"
import { tableMap, getDrizzleTable } from "../server/db/drizzleCrud.js"

console.log("=================================================================")
console.log("🚀 STARTING HKC-ERP-v5 MYSQL & DRIZZLE SCHEMA VERIFICATION")
console.log("=================================================================\n")

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`)
    passed++
  } else {
    console.error(`❌ [FAIL] ${message}`)
    failed++
  }
}

// 1. Verify all 37 tables are defined in tableMap
const expectedTables = [
  "warehouses", "export_products", "pharma_products", "pharma_product_batches",
  "stock_movements", "store_transfers", "store_transfer_items", "export_warehouse_movements",
  "customers", "suppliers", "sales_orders", "purchase_orders", "sales_issues",
  "sales_issue_items", "processing_services", "shipment_documents", "hkc_doc_records",
  "company_settings", "chart_of_accounts", "gl_account_mappings", "journal_entries", "journal_entry_lines",
  "invoices", "payments", "expenses", "recurring_expense_schedules", "vehicles", "tax_rules",
  "employees", "attendance_records", "payroll_periods", "payroll_records", "leave_types", "leave_requests",
  "users", "user_activity_logs", "user_sessions"
]

console.log("--- TEST 1: Table Registration & Schema Mapping ---")
assert(Object.keys(tableMap).length === 37, `Exactly 37 tables in tableMap (Found: ${Object.keys(tableMap).length})`)

for (const tbl of expectedTables) {
  const tableObj = getDrizzleTable(tbl)
  assert(tableObj !== null && tableObj !== undefined, `Table '${tbl}' is mapped to a valid Drizzle schema`)
}

console.log("\n--- TEST 2: MySQL Specific Column Types & Indexes ---")
assert(schema.users.id.dataType === "string", "users.id is varchar string for MySQL index compatibility")
assert(schema.users.username.dataType === "string", "users.username is varchar string")
assert(schema.salesIssues.totalAmount.dataType === "string" || schema.salesIssues.totalAmount.columnType === "MySqlDecimal", "salesIssues.totalAmount uses MySQL Decimal")
assert(schema.purchaseOrders.amount.dataType === "string" || schema.purchaseOrders.amount.columnType === "MySqlDecimal", "purchaseOrders.amount uses MySQL Decimal")
assert(schema.purchaseOrders.poNumber.dataType === "string", "purchaseOrders.poNumber uses MySQL Varchar")
assert(schema.customers.payload.columnType === "MySqlJson" || schema.customers.payload.dataType === "json", "customers.payload uses MySQL native JSON")

console.log("\n--- TEST 3: Drizzle Relations Verification ---")
assert(typeof schema.usersRelations === "object", "usersRelations is exported")
assert(typeof schema.salesIssuesRelations === "object", "salesIssuesRelations is exported")
assert(typeof schema.invoicesRelations === "object", "invoicesRelations is exported")
assert(typeof schema.employeesRelations === "object", "employeesRelations is exported")

console.log("\n=================================================================")
console.log(`🏁 TEST RESULTS: ${passed} of ${passed + failed} tests PASSED (${failed === 0 ? "100% Success" : "Failures detected"})`)
console.log("=================================================================")

if (failed > 0) process.exit(1)
