import mysql from "mysql2/promise"
import fs from "node:fs"
import { execSync } from "node:child_process"
import { config } from "../config.js"

const VOUCHER_DATA = [
  { voucher_no: "1320", movement_id: "WH1E-1789991499832", date: "2026-06-11", party: "HUSSEN", qty: 111.00, price: 14000.00 },
  { voucher_no: "1323", movement_id: "EWM-1789991611561-ovtp", date: "2026-06-12", party: "ZEYNU", qty: 213.40, price: 16000.00 },
  { voucher_no: "1324", movement_id: "EWM-1789991938545-ptcs", date: "2026-06-16", party: "GIRMA", qty: 218.80, price: 15500.00 },
  { voucher_no: "1331", movement_id: "EWM-1789992147528-kq89", date: "2026-06-22", party: "ZEYNU", qty: 277.60, price: 15500.00 },
  { voucher_no: "1332", movement_id: "EWM-1789992237624-tcce", date: "2026-06-22", party: "GIRMA", qty: 176.60, price: 14500.00 },
  { voucher_no: "1345", movement_id: "EWM-1789992315544-hqoo", date: "2026-06-24", party: "HUSSEN", qty: 101.20, price: 15000.00 },
  { voucher_no: "1346", movement_id: "EWM-1789992404240-r55n", date: "2026-06-24", party: "ZEYNU", qty: 100.80, price: 16000.00 },
  { voucher_no: "1357", movement_id: "EWM-1789992482512-k4bi", date: "2026-06-30", party: "HUSSEN", qty: 138.80, price: 15000.00 },
  { voucher_no: "1363", movement_id: "EWM-1789992562088-n7m6", date: "2026-07-02", party: "HUSSEN", qty: 252.40, price: 14500.00 },
  { voucher_no: "1364", movement_id: "EWM-1789992635424-k9an", date: "2026-07-02", party: "HUSSEN", qty: 273.00, price: 15000.00 },
  { voucher_no: "1365", movement_id: "EWM-1789992720520-zh5z", date: "2026-07-02", party: "SAMUEL", qty: 116.20, price: 15000.00 },
  { voucher_no: "1366", movement_id: "EWM-1789992821088-5q4m", date: "2026-07-03", party: "HUSSEN", qty: 254.20, price: 13000.00 },
  { voucher_no: "1367", movement_id: "EWM-1789992920248-czx8", date: "2026-07-03", party: "HUSSEN", qty: 232.00, price: 13000.00 },
  { voucher_no: "1372", movement_id: "EWM-1789992988072-zfxk", date: "2026-07-08", party: "HUSSEN", qty: 102.00, price: 15000.00 },
  { voucher_no: "1373", movement_id: "EWM-1789993062944-65f5", date: "2026-07-09", party: "HUSSEN", qty: 291.80, price: 15000.00 },
  { voucher_no: "1374", movement_id: "EWM-1789993226784-9zeh", date: "2026-07-10", party: "HUSSEN", qty: 505.80, price: 13000.00 },
  { voucher_no: "1375", movement_id: "EWM-1789993346320-3qvw", date: "2026-07-13", party: "HUSSEN", qty: 470.20, price: 13000.00 },
  { voucher_no: "1376", movement_id: "EWM-1789993406799-88d3", date: "2026-07-14", party: "HUSSEN", qty: 242.00, price: 13000.00 },
]

async function main() {
  console.log("==================================================================")
  console.log("MASTER PLESK MIGRATION & EXPORT WH RECONCILIATION")
  console.log("==================================================================\n")

  const pleskDumpPath = "/Users/Noah/Desktop/hkc_trading.sql"
  if (!fs.existsSync(pleskDumpPath)) {
    throw new Error(`Plesk dump not found at ${pleskDumpPath}`)
  }

  // 1. Drop existing tables first to allow clean import from phpMyAdmin dump
  console.log("Step 1: Dropping existing tables in hkc_trading to prepare for clean phpMyAdmin import...")
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
    console.log(`✅ Dropped ${existingTables.length} tables cleanly.`)
  }
  await dropConn.end()

  console.log("Step 1b: Ingesting fresh Plesk dump into local MySQL hkc_trading...")
  const importCmd = `mysql -u ${config.dbUser} -p'${config.dbPassword}' ${config.dbName} < "${pleskDumpPath}"`
  execSync(importCmd, { stdio: "inherit" })
  console.log("✅ Plesk dump successfully imported into local MySQL!\n")

  // 2. Connect to MySQL to apply additions
  const conn = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })

  try {
    await conn.beginTransaction()

    // Step 2: Restore 50 Shipment Documents
    console.log("Step 2: Restoring all 50 shipment document attachments...")
    const docsBackup = JSON.parse(fs.readFileSync("server/db/shipment_documents_50.json", "utf8"))
    await conn.query("DELETE FROM shipment_documents;")
    for (const d of docsBackup) {
      await conn.query(
        `INSERT INTO shipment_documents 
         (id, record_id, record_type, document_type, file_name, file_size, file_url, uploaded_at, uploaded_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.id,
          d.record_id,
          d.record_type,
          d.document_type,
          d.file_name,
          d.file_size,
          d.file_url,
          d.uploaded_at ? new Date(d.uploaded_at) : new Date(),
          d.uploaded_by,
          d.created_at ? new Date(d.created_at) : new Date(),
          d.updated_at ? new Date(d.updated_at) : new Date(),
        ]
      )
    }
    const [docCheck] = await conn.query("SELECT COUNT(*) as cnt FROM shipment_documents;")
    console.log(`✅ Restored ${docCheck[0].cnt} shipment documents.\n`)

    // Step 3: Re-apply authentic unit prices in export_warehouse_movements
    console.log("Step 3: Populating authentic unit costs for WH1 movements...")
    let totalQty = 0
    let totalVal = 0

    for (const item of VOUCHER_DATA) {
      const lineVal = Math.round(item.qty * item.price * 100) / 100
      totalQty += item.qty
      totalVal += lineVal

      await conn.query(
        "UPDATE export_warehouse_movements SET unit_price = ? WHERE voucher_no = ?",
        [item.price, item.voucher_no]
      )
    }
    const weightedAvgCost = Math.round((totalVal / totalQty) * 100) / 100
    console.log(`✅ Updated 18 movements. Total Qty: ${totalQty.toFixed(2)} Q, Total Val: ETB ${totalVal.toLocaleString()}, Weighted Avg Cost: ETB ${weightedAvgCost.toFixed(2)}\n`)

    // Step 4: Update export_products master record
    console.log("Step 4: Updating export_products master record...")
    await conn.query(
      `UPDATE export_products 
       SET quantity = ?, 
           total_quantity = ?, 
           unit_cost = ?, 
           total_stock_value = ?, 
           status = 'In Stock',
           updated_at = NOW() 
       WHERE id = 'P-1789991499832'`,
      [totalQty, totalQty, weightedAvgCost, totalVal]
    )
    console.log("✅ export_products updated.\n")

    // Step 5: Clean and Inject 18 WH1 Export Intake Journal Entries & 36 GL Lines
    console.log("Step 5: Injecting 18 WH1 Journal Entries and 36 GL Lines...")
    await conn.query("DELETE FROM journal_entry_lines WHERE journal_entry_id LIKE 'JE-INTAKE-EXP-GRV-%'")
    await conn.query("DELETE FROM journal_entries WHERE id LIKE 'JE-INTAKE-EXP-GRV-%'")

    for (const item of VOUCHER_DATA) {
      const jeId = `JE-INTAKE-EXP-GRV-${item.voucher_no}`
      const entryNo = `JE-EXP-${item.voucher_no}`
      const lineVal = Math.round(item.qty * item.price * 100) / 100
      const desc = `Stock Intake Valuation – Green Mung Bean [Voucher: ${item.voucher_no}, Supplier: ${item.party}] (+${item.qty.toFixed(2)} Q @ ETB ${item.price.toFixed(2)})`

      // Header
      await conn.query(
        `INSERT INTO journal_entries 
         (id, entry_number, entry_date, description, source_type, source_id, created_by, currency, exchange_rate, posting_status, total_amount, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'INVENTORY_INTAKE', ?, 'admin', 'ETB', 1.000000, 'POSTED', ?, NOW(), NOW())`,
        [jeId, entryNo, item.date, desc, item.movement_id, lineVal]
      )

      // DR Line (1410-01 STOCK OF GREEN MUNG)
      const drLineId = `${jeId}-DR`
      await conn.query(
        `INSERT INTO journal_entry_lines
         (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, warehouse_id, party_name, currency, exchange_rate_at_time, is_cleared, created_at, updated_at)
         VALUES (?, ?, '1410-01', '1410-01', 'STOCK OF GREEN MUNG', ?, ?, 0.00, 'WH1-AGRI-EXP', ?, 'ETB', 1.000000, 0, NOW(), NOW())`,
        [drLineId, jeId, desc, lineVal, item.party]
      )

      // CR Line (3000-01 HABTOM KEBEDE'S CAPITAL)
      const crLineId = `${jeId}-CR`
      await conn.query(
        `INSERT INTO journal_entry_lines
         (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, warehouse_id, party_name, currency, exchange_rate_at_time, is_cleared, created_at, updated_at)
         VALUES (?, ?, '3000-01', '3000-01', ?, ?, 0.00, ?, 'WH1-AGRI-EXP', ?, 'ETB', 1.000000, 0, NOW(), NOW())`,
        [crLineId, jeId, "HABTOM KEBEDE'S CAPITAL", desc, lineVal, item.party]
      )
    }
    console.log("✅ Injected 18 Journal Entries and 36 Journal Lines.\n")

    await conn.commit()
    console.log("✅ ALL LOCAL DB CHANGES COMMITTED!\n")

    // Step 6: Audit & Verification
    console.log("Step 6: Running Audit & Verification...")
    const [counts] = await conn.query(`
      SELECT 
        (SELECT COUNT(*) FROM pharma_products) as pharma_products,
        (SELECT COUNT(*) FROM pharma_product_batches) as pharma_product_batches,
        (SELECT COUNT(*) FROM stock_movements) as stock_movements,
        (SELECT COUNT(*) FROM suppliers) as suppliers,
        (SELECT COUNT(*) FROM shipment_documents) as shipment_documents,
        (SELECT COUNT(*) FROM export_products) as export_products,
        (SELECT COUNT(*) FROM export_warehouse_movements) as export_warehouse_movements,
        (SELECT COUNT(*) FROM journal_entries) as journal_entries,
        (SELECT COUNT(*) FROM journal_entry_lines) as journal_entry_lines;
    `)
    console.table(counts)

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
    console.table(glAudit)

    const [fasinashCheck] = await conn.query(`
      SELECT id, name, category, total_quantity, total_stock_value 
      FROM pharma_products 
      WHERE id = 'P-1791442250163';
    `)
    console.log("Verified new Plesk product FASINASH CATTLE:", fasinashCheck)

  } catch (err) {
    await conn.rollback()
    console.error("❌ Error during reconciliation:", err)
    process.exit(1)
  } finally {
    await conn.end()
  }

  // Step 7: Re-export the finalized master dump to Desktop
  console.log("\nStep 7: Re-exporting finalized master dump to /Users/Noah/Desktop/hkc_trading_reconciled.sql...")
  const dumpCmd = `mysqldump -u ${config.dbUser} -p'${config.dbPassword}' --no-tablespaces --skip-column-statistics --set-gtid-purged=OFF --skip-masking-policies ${config.dbName} > /Users/Noah/Desktop/hkc_trading_reconciled.sql`
  execSync(dumpCmd, { stdio: "inherit" })
  console.log("✅ Finalized master dump successfully written to Desktop!\n")

  // Also copy to repo backup
  execSync("cp /Users/Noah/Desktop/hkc_trading_reconciled.sql server/db/clean_hkc_trading_reconciled.sql")
  console.log("✅ Synced to server/db/clean_hkc_trading_reconciled.sql\n")
}

main().catch(console.error)
