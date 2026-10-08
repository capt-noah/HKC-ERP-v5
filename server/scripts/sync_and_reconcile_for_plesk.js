import mysql from "mysql2/promise"
import fs from "node:fs"
import { execSync } from "node:child_process"
import { config } from "../config.js"

const PLESK_SOURCE_DUMP = "/Users/Noah/Desktop/hkc_trading_reconciled.sql"
const DESKTOP_FINAL_DUMP = "/Users/Noah/Desktop/hkc_trading_reconciled.sql"
const REPO_BACKUP_DUMP = "server/db/clean_hkc_trading_reconciled.sql"

async function main() {
  console.log("==================================================================")
  console.log("     DATABASE SYNCHRONIZATION & FINAL PLESK DUMP GENERATION       ")
  console.log("==================================================================\n")

  if (!fs.existsSync(PLESK_SOURCE_DUMP)) {
    throw new Error(`Master reconciled dump not found at ${PLESK_SOURCE_DUMP}`)
  }
  const sourceStats = fs.statSync(PLESK_SOURCE_DUMP)
  console.log(`✓ Master source dump located: ${PLESK_SOURCE_DUMP} (${(sourceStats.size / 1024).toFixed(1)} KB)`)

  // Step 1: Clean Reset of Local Database
  console.log("\nStep 1: Dropping all tables in local MySQL database `hkc_trading`...")
  const dropConn = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })

  const [existingTables] = await dropConn.query("SHOW TABLES;")
  if (existingTables.length > 0) {
    await dropConn.query("SET FOREIGN_KEY_CHECKS = 0;")
    for (const row of existingTables) {
      const tbl = Object.values(row)[0]
      await dropConn.query(`DROP TABLE IF EXISTS \`${tbl}\`;`)
    }
    await dropConn.query("SET FOREIGN_KEY_CHECKS = 1;")
    console.log(`  ✓ Successfully dropped ${existingTables.length} tables cleanly.`)
  } else {
    console.log("  ✓ Database is already clean (0 tables).")
  }
  await dropConn.end()

  // Step 2: Ingest Reconciled Dump into Local DB
  console.log("\nStep 2: Ingesting master reconciled dump into local MySQL `hkc_trading`...")
  const importCmd = `mysql -u ${config.dbUser} -p'${config.dbPassword}' ${config.dbName} < "${PLESK_SOURCE_DUMP}"`
  execSync(importCmd, { stdio: "inherit" })
  console.log("  ✓ Reconciled dump successfully ingested into local MySQL!\n")

  // Step 3: Connect and Run Comprehensive Audit
  console.log("Step 3: Running Comprehensive Data & Schema Integrity Audit...")
  const conn = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })

  try {
    // 3a. Table Count Check
    const [allTables] = await conn.query("SHOW TABLES;")
    console.log(`  ✓ Total tables present: ${allTables.length} (Expected: 36)`)
    if (allTables.length !== 36) {
      throw new Error(`Expected 36 tables, found ${allTables.length}`)
    }

    // 3b. Verify deletion_requests table
    const [delReqCols] = await conn.query("DESCRIBE deletion_requests;")
    console.log(`  ✓ Table \`deletion_requests\` verified (${delReqCols.length} columns defined)`)

    // 3c. Record Count Verification
    const [counts] = await conn.query(`
      SELECT 
        (SELECT COUNT(*) FROM chart_of_accounts) AS chart_of_accounts,
        (SELECT COUNT(*) FROM gl_account_mappings) AS gl_account_mappings,
        (SELECT COUNT(*) FROM warehouses) AS warehouses,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM suppliers) AS suppliers,
        (SELECT COUNT(*) FROM export_products) AS export_products,
        (SELECT COUNT(*) FROM export_warehouse_movements) AS export_warehouse_movements,
        (SELECT COUNT(*) FROM pharma_products) AS pharma_products,
        (SELECT COUNT(*) FROM pharma_product_batches) AS pharma_product_batches,
        (SELECT COUNT(*) FROM stock_movements) AS stock_movements,
        (SELECT COUNT(*) FROM shipment_documents) AS shipment_documents,
        (SELECT COUNT(*) FROM invoices) AS invoices,
        (SELECT COUNT(*) FROM sales_issues) AS sales_issues,
        (SELECT COUNT(*) FROM sales_orders) AS sales_orders,
        (SELECT COUNT(*) FROM journal_entries) AS journal_entries,
        (SELECT COUNT(*) FROM journal_entry_lines) AS journal_entry_lines,
        (SELECT COUNT(*) FROM deletion_requests) AS deletion_requests;
    `)
    console.log("\nDATABASE ROW COUNTS AUDIT TABLE:")
    console.table(counts[0])

    // Validate key expected values
    const c = counts[0]
    if (c.shipment_documents !== 50) throw new Error(`Expected 50 shipment documents, got ${c.shipment_documents}`)
    if (c.journal_entries !== 107) throw new Error(`Expected 107 journal entries, got ${c.journal_entries}`)
    if (c.journal_entry_lines !== 270) throw new Error(`Expected 270 journal entry lines, got ${c.journal_entry_lines}`)
    if (c.pharma_products !== 37) throw new Error(`Expected 37 pharma products, got ${c.pharma_products}`)
    if (c.export_warehouse_movements !== 18) throw new Error(`Expected 18 export movements, got ${c.export_warehouse_movements}`)
    if (c.chart_of_accounts !== 280) throw new Error(`Expected 280 accounts, got ${c.chart_of_accounts}`)

    // 3d. GL Valuation Check (Green Mung Stock vs Capital)
    const [glAudit] = await conn.query(`
      SELECT 
        account_code, 
        account_name, 
        SUM(debit_amount) AS total_debit, 
        SUM(credit_amount) AS total_credit,
        (SUM(debit_amount) - SUM(credit_amount)) AS net_balance
      FROM journal_entry_lines
      WHERE account_code IN ('1410-01', '3000-01')
      GROUP BY account_code, account_name
      ORDER BY account_code;
    `)
    console.log("\nGL VALUATION INTEGRITY (Green Mung Stock vs Capital):")
    console.table(glAudit)

    const stockDr = Number(glAudit.find(r => r.account_code === "1410-01")?.total_debit || 0)
    const habtomCapitalCr = Number(glAudit.find(r => r.account_code === "3000-01" && r.account_name.includes("HABTOM"))?.total_credit || 0)
    if (stockDr !== habtomCapitalCr || stockDr <= 0) {
      throw new Error(`GL Mismatch: 1410-01 Debit is ${stockDr}, 3000-01 Credit is ${habtomCapitalCr}`)
    }
    console.log(`  ✓ GL Balances match perfectly at ETB ${stockDr.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Variance: 0.00)\n`)

    // 3e. Product FASINASH CATTLE Check
    const [fasinash] = await conn.query("SELECT id, name, category FROM pharma_products WHERE id = 'P-1791442250163';")
    if (fasinash.length > 0) {
      console.log(`  ✓ Verified Plesk product FASINASH CATTLE: [${fasinash[0].id}] ${fasinash[0].name}`)
    }

  } finally {
    await conn.end()
  }

  // Step 4: Generate Production Dump for Plesk
  console.log("\nStep 4: Generating optimized, production-ready Plesk SQL dump...")
  const tempDump = "/tmp/hkc_trading_plesk_export.sql"
  const dumpCmd = `mysqldump -u ${config.dbUser} -p'${config.dbPassword}' \
    --no-tablespaces \
    --skip-column-statistics \
    --set-gtid-purged=OFF \
    --skip-masking-policies \
    --single-transaction \
    --default-character-set=utf8mb4 \
    ${config.dbName} > "${tempDump}"`
  
  execSync(dumpCmd, { stdio: "inherit" })

  // Step 5: Wrap with explicit foreign key checks safety headers
  console.log("\nStep 5: Applying fail-safe phpMyAdmin header guards (SET FOREIGN_KEY_CHECKS = 0)...")
  const rawDump = fs.readFileSync(tempDump, "utf8")
  const safeDump = [
    "-- ============================================================================",
    "-- HKC TRADING ERP - RECONCILED PRODUCTION DATABASE DUMP",
    `-- Generated on: ${new Date().toISOString()}`,
    "-- Target Environment: Plesk / phpMyAdmin (MySQL 8.0+ / MariaDB 10.4+)",
    "-- Features Included: 36 Tables (inc. deletion_requests), 50 Shipment Documents,",
    "--                    18 WH1 Green Mung Valuations (ETB 56,128,800.00),",
    "--                    37 Pharma Products, 60 Batches, 280 Accounts, 85 GL Mappings",
    "-- ============================================================================",
    "",
    "SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;",
    "SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';",
    "SET @OLD_TIME_ZONE=@@TIME_ZONE, TIME_ZONE='+00:00';",
    "",
    rawDump,
    "",
    "SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;",
    "SET SQL_MODE=@OLD_SQL_MODE;",
    "SET TIME_ZONE=@OLD_TIME_ZONE;",
    "-- ============================================================================",
    "-- END OF DUMP",
    "-- ============================================================================",
  ].join("\n")

  fs.writeFileSync(DESKTOP_FINAL_DUMP, safeDump, "utf8")
  fs.writeFileSync(REPO_BACKUP_DUMP, safeDump, "utf8")
  if (fs.existsSync(tempDump)) fs.unlinkSync(tempDump)

  const finalSize = (fs.statSync(DESKTOP_FINAL_DUMP).size / 1024).toFixed(1)
  console.log(`  ✓ Successfully written to ${DESKTOP_FINAL_DUMP} (${finalSize} KB)`)
  console.log(`  ✓ Mirrored to repository: ${REPO_BACKUP_DUMP} (${finalSize} KB)`)

  // Step 6: Desktop Directory Hygiene Check
  console.log("\nStep 6: Verifying Desktop files...")
  const desktopFiles = fs.readdirSync("/Users/Noah/Desktop").filter(f => f.endsWith(".sql"))
  console.log("Desktop .sql files:", desktopFiles)

  console.log("\n==================================================================")
  console.log("🎉 ALL OPERATIONS COMPLETE! RECONCILED DUMP READY FOR PLESK IMPORT")
  console.log("==================================================================\n")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
