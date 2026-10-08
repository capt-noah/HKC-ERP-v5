import mysql from "mysql2/promise"
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
  const connection = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })

  console.log("Connected to MySQL database:", config.dbName)

  try {
    await connection.beginTransaction()

    let totalQty = 0
    let totalVal = 0

    // 1. Update export_warehouse_movements
    console.log("\n1. Updating export_warehouse_movements...")
    for (const item of VOUCHER_DATA) {
      const lineVal = Math.round(item.qty * item.price * 100) / 100
      totalQty += item.qty
      totalVal += lineVal

      const [res] = await connection.query(
        "UPDATE export_warehouse_movements SET unit_price = ? WHERE voucher_no = ?",
        [item.price, item.voucher_no]
      )
      console.log(`   - Voucher ${item.voucher_no}: Qty ${item.qty} @ ETB ${item.price} = ETB ${lineVal.toLocaleString()} (Rows affected: ${res.affectedRows})`)
    }

    const weightedAvgCost = Math.round((totalVal / totalQty) * 100) / 100
    console.log(`\nTotal Quantity: ${totalQty.toFixed(2)} Quintals`)
    console.log(`Total Value: ETB ${totalVal.toLocaleString()}`)
    console.log(`Weighted Average Unit Cost: ETB ${weightedAvgCost.toFixed(2)}`)

    // 2. Update export_products
    console.log("\n2. Updating export_products master record (P-1789991499832)...")
    const [prodRes] = await connection.query(
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
    console.log(`   - export_products updated. Rows affected: ${prodRes.affectedRows}`)

    // 3. Remove existing export intake journal entries if any
    console.log("\n3. Cleaning up previous export intake journal entries if any...")
    const [delLines] = await connection.query(
      "DELETE FROM journal_entry_lines WHERE journal_entry_id LIKE 'JE-INTAKE-EXP-GRV-%'"
    )
    const [delEntries] = await connection.query(
      "DELETE FROM journal_entries WHERE id LIKE 'JE-INTAKE-EXP-GRV-%'"
    )
    console.log(`   - Removed old lines: ${delLines.affectedRows}, old entries: ${delEntries.affectedRows}`)

    // 4. Create Journal Entries & Lines
    console.log("\n4. Inserting 18 Journal Entries and 36 Journal Entry Lines...")
    for (const item of VOUCHER_DATA) {
      const jeId = `JE-INTAKE-EXP-GRV-${item.voucher_no}`
      const entryNo = `JE-EXP-${item.voucher_no}`
      const lineVal = Math.round(item.qty * item.price * 100) / 100
      const desc = `Stock Intake Valuation – Green Mung Bean [Voucher: ${item.voucher_no}, Supplier: ${item.party}] (+${item.qty.toFixed(2)} Q @ ETB ${item.price.toFixed(2)})`

      // Header
      await connection.query(
        `INSERT INTO journal_entries 
         (id, entry_number, entry_date, description, source_type, source_id, created_by, currency, exchange_rate, posting_status, total_amount, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'INVENTORY_INTAKE', ?, 'admin', 'ETB', 1.000000, 'POSTED', ?, NOW(), NOW())`,
        [jeId, entryNo, item.date, desc, item.movement_id, lineVal]
      )

      // DR Line (1410-01 STOCK OF GREEN MUNG)
      const drLineId = `${jeId}-DR`
      await connection.query(
        `INSERT INTO journal_entry_lines
         (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, warehouse_id, party_name, currency, exchange_rate_at_time, is_cleared, created_at, updated_at)
         VALUES (?, ?, '1410-01', '1410-01', 'STOCK OF GREEN MUNG', ?, ?, 0.00, 'WH1-AGRI-EXP', ?, 'ETB', 1.000000, 0, NOW(), NOW())`,
        [drLineId, jeId, desc, lineVal, item.party]
      )

      // CR Line (3000-01 HABTOM KEBEDE'S CAPITAL)
      const crLineId = `${jeId}-CR`
      await connection.query(
        `INSERT INTO journal_entry_lines
         (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, warehouse_id, party_name, currency, exchange_rate_at_time, is_cleared, created_at, updated_at)
         VALUES (?, ?, '3000-01', '3000-01', ?, ?, 0.00, ?, 'WH1-AGRI-EXP', ?, 'ETB', 1.000000, 0, NOW(), NOW())`,
        [crLineId, jeId, "HABTOM KEBEDE'S CAPITAL", desc, lineVal, item.party]
      )
    }

    await connection.commit()
    console.log("\n✅ TRANSACTION COMMITTED SUCCESSFULLY!")

    // 5. Verification Queries
    console.log("\n5. Running verification queries...")
    const [coaCheck] = await connection.query(`
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
    console.table(coaCheck)

    const [prodCheck] = await connection.query(`
      SELECT id, sku, name, quantity, unit_cost, total_stock_value, status 
      FROM export_products 
      WHERE id = 'P-1789991499832';
    `)
    console.table(prodCheck)

    const [movCheck] = await connection.query(`
      SELECT COUNT(*) AS total_movements, 
             SUM(net_quantity) AS sum_qty, 
             MIN(unit_price) AS min_price, 
             MAX(unit_price) AS max_price,
             SUM(net_quantity * unit_price) AS sum_total_val
      FROM export_warehouse_movements;
    `)
    console.table(movCheck)

  } catch (err) {
    await connection.rollback()
    console.error("❌ Transaction rolled back due to error:", err)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

main()
