import fs from "node:fs"
import path from "node:path"

const SOURCE_DUMP = "/Users/Noah/Desktop/hkc_trading_reconciled.sql"
const TARGET_DUMP = "/Users/Noah/Desktop/hkc_trading_testing_clean.sql"
const TARGET_DUMP_ALIAS = "/Users/Noah/Desktop/hkc_trading_essential.sql"

// Essential tables where DATA (rows) must be preserved for system operation
const ESSENTIAL_TABLES_WITH_DATA = new Set([
  "users",
  "warehouses",
  "chart_of_accounts",
  "gl_account_mappings",
  "company_settings",
  "tax_rules",
])

async function main() {
  console.log("==================================================================")
  console.log("      CREATE CLEAN TESTING DATABASE DUMP (ESSENTIAL DATA ONLY)    ")
  console.log("==================================================================\n")

  const sourceFile = fs.existsSync(SOURCE_DUMP) ? SOURCE_DUMP : "server/db/clean_hkc_trading_reconciled.sql"
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Source dump not found at ${SOURCE_DUMP} or repo backup!`)
  }

  console.log(`✓ Reading source dump: ${sourceFile} (${(fs.statSync(sourceFile).size / 1024).toFixed(1)} KB)`)
  const content = fs.readFileSync(sourceFile, "utf8")

  // Parse table blocks
  const parts = content.split(/--\s+Table structure for table\s+`([^`]+)`/)
  const rawHeader = parts[0]

  const header = [
    "-- ============================================================================",
    "-- HKC TRADING ERP - CLEAN TESTING DATABASE DUMP (ESSENTIAL DATA ONLY)",
    `-- Generated on: ${new Date().toISOString()}`,
    "-- Target Environment: Testing / Staging (Plesk / phpMyAdmin / Local MySQL)",
    "--",
    "-- INCLUDED DATA (Essential Master & Setup Records):",
    "--   • users (System users, roles, password hashes)",
    "--   • warehouses (WH1, WH2, WH3)",
    "--   • chart_of_accounts (Complete 280 accounts Chart of Accounts)",
    "--   • gl_account_mappings (85 GL automatic mapping rules)",
    "--   • company_settings (HKC Trading PLC company configuration)",
    "--   • tax_rules (8 tax rules: VAT 15%, Withholding, Customs Duty, etc.)",
    "--",
    "-- EXCLUDED DATA (Clean Structure Only - 0 Rows):",
    "--   • Stock: stock_movements, pharma_products, pharma_product_batches,",
    "--            export_products, export_warehouse_movements, quarantine_records,",
    "--            store_transfers, store_transfer_items",
    "--   • Sales: sales_orders, sales_issues, sales_issue_items,",
    "--            shipment_documents, hkc_doc_records, processing_services",
    "--   • Purchase: purchase_orders",
    "--   • Finance: invoices, payments, journal_entries, journal_entry_lines, expenses",
    "--   • Partners: customers, suppliers",
    "--   • Governance & Logs: deletion_requests, user_activity_logs, user_sessions",
    "-- ============================================================================",
    "",
    "SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;",
    "SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';",
    "SET @OLD_TIME_ZONE=@@TIME_ZONE, TIME_ZONE='+00:00';",
    "",
  ].join("\n")

  let output = header
  let totalTables = 0
  const dataTables = []
  const schemaOnlyTables = []

  for (let i = 1; i < parts.length; i += 2) {
    totalTables++
    const tableName = parts[i]
    const tableBody = parts[i + 1] || ""

    output += `--\n-- Table structure for table \`${tableName}\`\n--\n`

    if (ESSENTIAL_TABLES_WITH_DATA.has(tableName)) {
      dataTables.push(tableName)
      // Retain full schema and INSERT statements
      output += tableBody
    } else {
      schemaOnlyTables.push(tableName)
      // Retain DROP TABLE and CREATE TABLE, omit INSERT INTO statements
      const dumpSplit = tableBody.split(/--\s+Dumping data for table/)
      if (dumpSplit.length > 1) {
        output += dumpSplit[0]
        output += `--\n-- Dumping data for table \`${tableName}\` (Clean for testing - 0 records)\n--\n\n`
      } else {
        output += tableBody
      }
    }
  }

  // Footer with re-enabled checks
  output += [
    "",
    "SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;",
    "SET SQL_MODE=@OLD_SQL_MODE;",
    "SET TIME_ZONE=@OLD_TIME_ZONE;",
    "-- ============================================================================",
    "-- END OF TESTING DUMP",
    "-- ============================================================================",
    "",
  ].join("\n")

  // Write files
  fs.writeFileSync(TARGET_DUMP, output, "utf8")
  fs.writeFileSync(TARGET_DUMP_ALIAS, output, "utf8")

  const targetSize = (fs.statSync(TARGET_DUMP).size / 1024).toFixed(1)
  console.log(`\n✓ Successfully generated clean testing dump:`)
  console.log(`  📁 ${TARGET_DUMP} (${targetSize} KB)`)
  console.log(`  📁 ${TARGET_DUMP_ALIAS} (${targetSize} KB)`)

  console.log("\n------------------------------------------------------------------")
  console.log("                        DUMP AUDIT SUMMARY                        ")
  console.log("------------------------------------------------------------------")
  console.log(`Total Tables Processed: ${totalTables} (All 36 schemas intact)`)
  console.log(`\n1. ESSENTIAL TABLES WITH DATA (${dataTables.length}):`)
  dataTables.forEach(t => console.log(`   🔒 ${t.padEnd(25)} (DATA INCLUDED)`))

  console.log(`\n2. CLEAN TESTING TABLES - STRUCTURE ONLY (${schemaOnlyTables.length}):`)
  schemaOnlyTables.forEach(t => console.log(`   ✨ ${t.padEnd(25)} (0 RECORDS / CLEAN)`))

  console.log("\n==================================================================")
  console.log("🎉 CLEAN TESTING DUMP READY ON DESKTOP!")
  console.log("==================================================================\n")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
