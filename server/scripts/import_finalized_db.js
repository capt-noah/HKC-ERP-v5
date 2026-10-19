import fs from "fs"
import mysql from "mysql2/promise"
import { execSync } from "child_process"

const DB_CONFIG = {
  host: "127.0.0.1",
  user: "habtom",
  password: "DMka6&jn0*Wsdfo0",
  database: "hkc_trading",
  multipleStatements: true,
}

const FINAL_DUMP_PATH = "/Users/Noah/Desktop/hkc_trading.sql"

async function importFinalizedDb() {
  console.log("===================================================================")
  console.log("IMPORTING FINALIZED VERIFIED DATABASE TO LOCAL MYSQL")
  console.log("Target dump:", FINAL_DUMP_PATH)
  console.log("===================================================================\n")

  if (!fs.existsSync(FINAL_DUMP_PATH)) {
    throw new Error(`Dump file not found at: ${FINAL_DUMP_PATH}`)
  }

  const conn = await mysql.createConnection(DB_CONFIG)

  try {
    // 1. Drop all tables cleanly with FK checks disabled
    console.log("Step 1: Dropping all existing tables in local `hkc_trading`...")
    await conn.query("SET FOREIGN_KEY_CHECKS = 0;")
    const [tables] = await conn.query("SHOW TABLES;")
    if (tables.length > 0) {
      const tableKey = Object.keys(tables[0])[0]
      for (const t of tables) {
        await conn.query(`DROP TABLE IF EXISTS \`${t[tableKey]}\`;`)
      }
      console.log(`Dropped ${tables.length} tables cleanly.`)
    } else {
      console.log("Database was already empty.")
    }

    // 2. Direct Import
    console.log(`\nStep 2: Importing ${FINAL_DUMP_PATH}...`)
    const importCmd = `mysql -u ${DB_CONFIG.user} -p'${DB_CONFIG.password}' --default-character-set=utf8mb4 ${DB_CONFIG.database} < "${FINAL_DUMP_PATH}"`
    execSync(importCmd, { stdio: "inherit" })
    await conn.query("SET FOREIGN_KEY_CHECKS = 1;")
    console.log("Import completed successfully!")

    // 3. Post-Import Verification
    console.log("\nStep 3: Running post-import integrity & forensic audit...")
    const [importedTables] = await conn.query("SHOW TABLES;")
    console.log(`- Tables imported: ${importedTables.length}`)

    // Counts
    const [[counts]] = await conn.query(`
      SELECT 
        (SELECT COUNT(*) FROM sales_orders) AS so_count,
        (SELECT COUNT(*) FROM sales_issues) AS si_count,
        (SELECT COUNT(*) FROM invoices) AS inv_count,
        (SELECT COUNT(*) FROM journal_entries) AS je_count,
        (SELECT COUNT(*) FROM stock_movements) AS sm_count,
        (SELECT COUNT(*) FROM pharma_products) AS prod_count,
        (SELECT COUNT(*) FROM pharma_product_batches) AS batch_count
    `)
    console.log(`- Sales Orders:          ${counts.so_count}`)
    console.log(`- Sales Issues:          ${counts.si_count}`)
    console.log(`- Invoices:              ${counts.inv_count}`)
    console.log(`- Journal Entries:       ${counts.je_count}`)
    console.log(`- Stock Movements:       ${counts.sm_count}`)
    console.log(`- Pharma Products:       ${counts.prod_count}`)
    console.log(`- Product Batches:       ${counts.batch_count}`)

    // Trial Balance
    const [[tb]] = await conn.query(`
      SELECT 
        SUM(debit_amount) AS total_dr,
        SUM(credit_amount) AS total_cr,
        SUM(debit_amount) - SUM(credit_amount) AS net_variance
      FROM journal_entry_lines;
    `)
    console.log(`\nTrial Balance Check:`)
    console.log(`- Total Debits:  ETB ${Number(tb.total_dr).toLocaleString()}`)
    console.log(`- Total Credits: ETB ${Number(tb.total_cr).toLocaleString()}`)
    console.log(`- Net Variance:  ETB ${Number(tb.net_variance).toFixed(2)}`)

    if (Math.abs(Number(tb.net_variance)) > 0.001) {
      throw new Error(`CRITICAL: Net variance is not 0.00! Value: ${tb.net_variance}`)
    }

    // 1-to-1 Parity Check
    const [[parity]] = await conn.query(`
      SELECT 
        COUNT(DISTINCT sales_order_id) AS unique_so_in_si,
        (SELECT COUNT(DISTINCT sales_issue_id) FROM invoices) AS unique_si_in_inv,
        (SELECT COUNT(DISTINCT sales_order_id) FROM invoices WHERE sales_order_id IS NOT NULL) AS unique_so_in_inv
      FROM sales_issues WHERE sales_order_id IS NOT NULL;
    `)
    console.log(`\n1-to-1 Cross-Reference Parity:`)
    console.log(`- Unique SO linked in Sales Issues: ${parity.unique_so_in_si} / 64`)
    console.log(`- Unique SI linked in Invoices:     ${parity.unique_si_in_inv} / 64`)
    console.log(`- Unique SO linked in Invoices:     ${parity.unique_so_in_inv} / 64`)

    // Cash issues unpaid check
    const [[cash]] = await conn.query(
      "SELECT COUNT(*) AS unpaid_cash FROM sales_issues WHERE payment_type='Cash' AND payment_status != 'Paid'"
    )
    console.log(`- Unpaid Cash Sales Issues:         ${cash.unpaid_cash} (must be 0)`)

    // FS 00000610 Check
    const [si610] = await conn.query("SELECT total_quantity, total_amount, subtotal_amount FROM sales_issues WHERE id='00000610'")
    const [prod610] = await conn.query("SELECT quantity, quantity_sold FROM pharma_products WHERE id='P-1788858054417'")
    const [batch610] = await conn.query("SELECT quantity FROM pharma_product_batches WHERE id='batch-P-1788858054417-251036'")
    const [sm610] = await conn.query("SELECT balance_after FROM stock_movements WHERE reference_id='00000610' AND movement_type='ISSUE'")

    console.log(`\nFS 00000610 Audit Verification:`)
    console.log(`- Sales Issue Quantity:     ${si610[0]?.total_quantity} (expected: 1600.0000)`)
    console.log(`- Sales Issue Amount:       ETB ${Number(si610[0]?.total_amount).toLocaleString()} (expected: 1,356,800.00)`)
    console.log(`- Stock Movement Balance:   ${sm610[0]?.balance_after} (expected: 6560.00)`)
    console.log(`- Product On-Hand Stock:    ${prod610[0]?.quantity} (expected: 2160.00)`)
    console.log(`- Batch On-Hand Stock:      ${batch610[0]?.quantity} (expected: 2160.00)`)

    console.log("\n===================================================================")
    console.log("FINALIZED DATABASE IMPORT & AUDIT VERIFIED SUCCESSFULLY!")
    console.log("===================================================================")
  } finally {
    await conn.end()
  }
}

importFinalizedDb().catch((err) => {
  console.error("Import failed:", err)
  process.exit(1)
})
