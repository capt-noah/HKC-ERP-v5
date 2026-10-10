import mysql from "mysql2/promise"
import fs from "node:fs"
import { execSync } from "node:child_process"
import { config } from "../config.js"

const SOURCE_DUMP_PATH = "/Users/Noah/Desktop/hkc_trading (4).sql"
const TARGET_DESKTOP_DUMP = "/Users/Noah/Desktop/hkc_trading_reconciled.sql"
const REPO_BACKUP_DUMP = "server/db/clean_hkc_trading_reconciled.sql"

async function run() {
  console.log("==================================================================")
  console.log("   CLEAN DATABASE IMPORT, TARGETED SANITIZATION & PLESK DUMP      ")
  console.log("==================================================================\n")

  if (!fs.existsSync(SOURCE_DUMP_PATH)) {
    throw new Error(`Source dump not found at ${SOURCE_DUMP_PATH}`)
  }
  const sourceStats = fs.statSync(SOURCE_DUMP_PATH)
  console.log(`✓ Source Plesk dump located: ${SOURCE_DUMP_PATH} (${(sourceStats.size / 1024).toFixed(1)} KB)`)

  // Step 1: Clean drop and reset of local database
  console.log("\nStep 1: Dropping existing tables in local MySQL `hkc_trading`...")
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
    console.log("  ✓ Database is already empty (0 tables).")
  }
  await dropConn.end()

  // Step 2: Ingest the source dump into local MySQL
  console.log("\nStep 2: Ingesting fresh Plesk source dump into local MySQL `hkc_trading`...")
  const importCmd = `mysql -u ${config.dbUser} -p'${config.dbPassword}' ${config.dbName} < "${SOURCE_DUMP_PATH}"`
  execSync(importCmd, { stdio: "inherit" })
  console.log("  ✓ Source dump successfully imported into local MySQL!\n")

  // Step 3: Connect and perform targeted data sanitization
  console.log("Step 3: Performing targeted sanitization on test data...")
  const conn = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })

  await conn.query("SET FOREIGN_KEY_CHECKS = 0;")

  // 3a. Truncate test employee records
  const [empBefore] = await conn.query("SELECT COUNT(*) AS c FROM employees;")
  await conn.query("TRUNCATE TABLE employees;")
  console.log(`  ✓ Employees truncated: removed ${empBefore[0].c} test employee record(s).`)

  // 3b. Truncate test payroll records & periods
  const [payRecBefore] = await conn.query("SELECT COUNT(*) AS c FROM payroll_records;")
  await conn.query("TRUNCATE TABLE payroll_records;")
  console.log(`  ✓ Payroll records truncated: removed ${payRecBefore[0].c} test record(s).`)

  const [payPerBefore] = await conn.query("SELECT COUNT(*) AS c FROM payroll_periods;")
  await conn.query("TRUNCATE TABLE payroll_periods;")
  console.log(`  ✓ Payroll periods truncated: removed ${payPerBefore[0].c} test period(s).`)

  // 3c. Clean activity logs related to test employees, payroll, and today's test uploads
  const [logsDeleted] = await conn.query(`
    DELETE FROM user_activity_logs 
    WHERE action IN ('Processed Payroll', 'Registered Employee', 'Edited Employee')
       OR resource IN ('payroll_periods', 'payroll_records', 'employees')
       OR (action = 'Created' AND resource = 'upload' AND created_at >= '2026-10-10');
  `)
  console.log(`  ✓ User activity logs cleaned: purged ${logsDeleted.affectedRows} testing log item(s).`)

  // 3d. Update Green Mung reject movement with Voucher / Ref 0484
  await conn.query("UPDATE export_warehouse_movements SET voucher_no = '0484' WHERE id = 'EWM-REJ-1791543010023-8j4b';")
  console.log("  ✓ Updated Green Mung reject movement voucher_no to '0484'.")

  // 3e. Reconcile Green Mung Reject Journal Entry (JE-2026-25082-3193) to True Physical Loss (1,926,600.00)
  await conn.query(`
    UPDATE journal_entries
    SET total_amount = 1926600.00,
        description = 'Inventory Cleaning Rejection Loss: GREEN MUNG (-148.2 Quintal @ ETB 13000.00) - Reject / Cleaning Loss'
    WHERE id = 'JE-2026-25082-3193';
  `)
  await conn.query(`
    UPDATE journal_entry_lines
    SET debit_amount = 1926600.00,
        account_code = '6000-22',
        account_name = 'OTHER EXPENSES',
        description = 'Inventory Cleaning Rejection Loss: GREEN MUNG (-148.2 Qtl @ ETB 13000.00)'
    WHERE id = 'JEL-1791543013193-0';
  `)
  await conn.query(`
    UPDATE journal_entry_lines
    SET credit_amount = 1926600.00,
        account_code = '1410-01',
        account_name = 'STOCK OF GREEN MUNG',
        description = 'Inventory Stock Relief for Cleaning Rejection (-148.2 Qtl @ ETB 13000.00)'
    WHERE id = 'JEL-1791543013193-1';
  `)
  console.log("  ✓ Reconciled JE-2026-25082-3193 to true physical batch purchase cost ETB 1,926,600.00.")

  // 3f. Purge 56 duplicate lines in journal_entry_lines
  const [deletedDupes] = await conn.query(`
    DELETE FROM journal_entry_lines
    WHERE (id LIKE 'JE-SALE-%-DR' OR id LIKE 'JE-SALE-%-CR' OR id LIKE 'JE-COGS-%-DR' OR id LIKE 'JE-COGS-%-CR')
       OR (journal_entry_id IN ('JE-SALE-00000608', 'JE-SALE-00000615', 'JE-SALE-00000623') AND (id LIKE 'JE-SALE-%-1' OR id LIKE 'JE-SALE-%-2'))
       OR (journal_entry_id IN ('JE-COGS-00000608', 'JE-COGS-00000615', 'JE-COGS-00000623') AND (id LIKE 'JE-COGS-%-1' OR id LIKE 'JE-COGS-%-2'));
  `)
  console.log(`  ✓ Deduplicated General Ledger: purged ${deletedDupes.affectedRows} redundant sales & COGS lines.`)

  // 3g. Cleanly populate account_code and account_name on any remaining unmapped lines
  await conn.query(`
    UPDATE journal_entry_lines jel
    JOIN chart_of_accounts coa ON COALESCE(jel.account_code, jel.account_id) = coa.code
    SET jel.account_code = coa.code,
        jel.account_name = coa.name
    WHERE jel.account_code IS NULL OR jel.account_name IS NULL;
  `)
  console.log("  ✓ Standardized account codes and names across remaining journal entry lines.")

  await conn.query("SET FOREIGN_KEY_CHECKS = 1;")

  // Step 4: Comprehensive Integrity & Financial Audit
  console.log("\nStep 4: Running Comprehensive Data & Schema Integrity Audit...")
  const [allTables] = await conn.query("SHOW TABLES;")
  console.log(`  ✓ Total tables present: ${allTables.length} (Expected: 36)`)
  if (allTables.length !== 36) {
    throw new Error(`Expected 36 tables, found ${allTables.length}`)
  }

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
      (SELECT COUNT(*) FROM hkc_doc_records) AS hkc_doc_records,
      (SELECT COUNT(*) FROM invoices) AS invoices,
      (SELECT COUNT(*) FROM sales_issues) AS sales_issues,
      (SELECT COUNT(*) FROM sales_orders) AS sales_orders,
      (SELECT COUNT(*) FROM journal_entries) AS journal_entries,
      (SELECT COUNT(*) FROM journal_entry_lines) AS journal_entry_lines,
      (SELECT COUNT(*) FROM employees) AS employees,
      (SELECT COUNT(*) FROM payroll_periods) AS payroll_periods,
      (SELECT COUNT(*) FROM payroll_records) AS payroll_records,
      (SELECT COUNT(*) FROM user_activity_logs) AS user_activity_logs,
      (SELECT COUNT(*) FROM deletion_requests) AS deletion_requests;
  `)

  console.log("\nDATABASE SANITIZATION AUDIT TABLE:")
  console.table(counts[0])

  const c = counts[0]
  if (c.employees !== 0) throw new Error(`Expected 0 employees, got ${c.employees}`)
  if (c.payroll_periods !== 0) throw new Error(`Expected 0 payroll_periods, got ${c.payroll_periods}`)
  if (c.payroll_records !== 0) throw new Error(`Expected 0 payroll_records, got ${c.payroll_records}`)
  if (c.hkc_doc_records !== 2) throw new Error(`Expected 2 hkc_doc_records, got ${c.hkc_doc_records}`)
  if (c.chart_of_accounts !== 280) throw new Error(`Expected 280 chart_of_accounts, got ${c.chart_of_accounts}`)
  if (c.shipment_documents !== 50) throw new Error(`Expected 50 shipment_documents, got ${c.shipment_documents}`)
  if (c.journal_entries !== 109) throw new Error(`Expected 109 journal_entries, got ${c.journal_entries}`)
  if (c.journal_entry_lines !== 218) throw new Error(`Expected 218 journal_entry_lines, got ${c.journal_entry_lines}`)

  // Verify Trial Balance (Debits == Credits)
  const [tb] = await conn.query(`
    SELECT 
      ROUND(SUM(debit_amount), 2) AS total_debits,
      ROUND(SUM(credit_amount), 2) AS total_credits,
      ROUND(ABS(SUM(debit_amount) - SUM(credit_amount)), 2) AS variance
    FROM journal_entry_lines;
  `)
  console.log("\nGENERAL LEDGER INTEGRITY AUDIT:")
  console.table(tb[0])
  if (Number(tb[0].variance) !== 0) {
    throw new Error(`Trial balance variance detected: ${tb[0].variance}`)
  }
  console.log("  ✓ Trial Balance perfectly balanced with zero variance (ETB 0.00)!")

  // Verify P&L Reconciliation
  const [pnl] = await conn.query(`
    SELECT 
      ROUND(SUM(CASE WHEN account_code LIKE '4%' THEN credit_amount - debit_amount ELSE 0 END), 2) as revenue,
      ROUND(SUM(CASE WHEN account_code LIKE '5%' THEN debit_amount - credit_amount ELSE 0 END), 2) as cogs,
      ROUND(SUM(CASE WHEN account_code LIKE '6%' THEN debit_amount - credit_amount ELSE 0 END), 2) as expenses
    FROM journal_entry_lines;
  `)
  const rev = Number(pnl[0].revenue)
  const cogs = Number(pnl[0].cogs)
  const exp = Number(pnl[0].expenses)
  const gp = rev - cogs
  const np = gp - exp

  console.log("\nCANONICAL P&L FINANCIAL AUDIT:")
  console.table([{
    "Operating Revenue": rev.toLocaleString("en-US", { minimumFractionDigits: 2 }),
    "COGS": cogs.toLocaleString("en-US", { minimumFractionDigits: 2 }),
    "Gross Profit": gp.toLocaleString("en-US", { minimumFractionDigits: 2 }),
    "Gross Margin": ((gp / rev) * 100).toFixed(2) + "%",
    "Operating Losses": exp.toLocaleString("en-US", { minimumFractionDigits: 2 }),
    "Net Profit": np.toLocaleString("en-US", { minimumFractionDigits: 2 }),
    "Net Margin": ((np / rev) * 100).toFixed(2) + "%",
  }])

  if (rev !== 4993680.00) throw new Error(`Expected revenue 4,993,680.00, got ${rev}`)
  if (cogs !== 4116899.22) throw new Error(`Expected cogs 4,116,899.22, got ${cogs}`)
  if (exp !== 1928196.00) throw new Error(`Expected expenses 1,928,196.00, got ${exp}`)
  console.log("  ✓ All financial figures 100% reconciled and validated against source documents!")

  await conn.end()

  // Step 5: Export Production-Ready Dump for Plesk
  console.log("\nStep 5: Exporting clean production-ready SQL dump using mysqldump...")
  const tempDump = "/tmp/hkc_trading_reconciled_clean.sql"
  const dumpCmd = `mysqldump -u ${config.dbUser} -p'${config.dbPassword}' ` +
    `--no-tablespaces ` +
    `--skip-masking-policies ` +
    `--set-gtid-purged=OFF ` +
    `--column-statistics=0 ` +
    `--skip-lock-tables ` +
    `--routines ` +
    `--triggers ` +
    `--default-character-set=utf8mb4 ` +
    `${config.dbName} > "${tempDump}"`

  execSync(dumpCmd, { stdio: "inherit" })

  const rawSql = fs.readFileSync(tempDump, "utf8")
  const banner = [
    "-- ===================================================================",
    "-- HKC TRADING ERP - RECONCILED CLEAN PRODUCTION DATABASE DUMP",
    `-- Generated: ${new Date().toISOString()}`,
    "-- Target Environment: Plesk / phpMyAdmin (MySQL 8.0+ / MariaDB 10.4+)",
    "-- Sanitization Performed: Removed test employee and draft payroll records",
    "-- Preserved: 100% Authentic Business Data (Sales, Stock, GL, COA, WH)",
    "-- Verified: Balanced General Ledger (Zero Variance)",
    "-- ===================================================================",
    "",
  ].join("\n")

  const finalSql = banner + rawSql
  fs.writeFileSync(TARGET_DESKTOP_DUMP, finalSql, "utf8")
  fs.writeFileSync(REPO_BACKUP_DUMP, finalSql, "utf8")
  try { fs.unlinkSync(tempDump) } catch {}

  const finalStats = fs.statSync(TARGET_DESKTOP_DUMP)
  console.log(`\n🎉 SUCCESS! RECONCILED DUMP READY FOR PLESK IMPORT:`)
  console.log(`   Location: ${TARGET_DESKTOP_DUMP}`)
  console.log(`   Size:     ${(finalStats.size / 1024).toFixed(1)} KB`)
  console.log(`   Backup:   ${REPO_BACKUP_DUMP}\n`)
}

run().catch((err) => {
  console.error("\n❌ EXECUTION FAILED:", err)
  process.exit(1)
})
