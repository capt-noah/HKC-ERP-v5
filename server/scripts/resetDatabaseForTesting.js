import { pool } from "../db/client.js"

async function resetDatabaseForTesting() {
  console.log("================================================================================")
  console.log("        RESETTING DATABASE DATA FOR TESTING (FINANCE, INVENTORY, SALES)         ")
  console.log("================================================================================\n")

  const conn = await pool.getConnection()
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    // 1. Truncate Sales Data
    console.log("1. Truncating Sales transactions...")
    await conn.query("TRUNCATE TABLE sales_issues")
    await conn.query("TRUNCATE TABLE sales_issue_items")
    await conn.query("TRUNCATE TABLE sales_orders")
    await conn.query("TRUNCATE TABLE shipment_documents")

    // 2. Truncate Finance Data
    console.log("2. Truncating Finance ledgers and vouchers...")
    await conn.query("TRUNCATE TABLE invoices")
    await conn.query("TRUNCATE TABLE journal_entries")
    await conn.query("TRUNCATE TABLE journal_entry_lines")
    await conn.query("TRUNCATE TABLE payments")
    await conn.query("TRUNCATE TABLE purchase_orders")
    await conn.query("TRUNCATE TABLE expenses")
    await conn.query("TRUNCATE TABLE recurring_expense_schedules")

    // 3. Truncate Inventory Movements, Batches & Quarantine
    console.log("3. Truncating Inventory movements and stock batches...")
    await conn.query("TRUNCATE TABLE stock_movements")
    await conn.query("TRUNCATE TABLE export_warehouse_movements")
    await conn.query("TRUNCATE TABLE pharma_product_batches")
    await conn.query("TRUNCATE TABLE store_transfers")
    await conn.query("TRUNCATE TABLE store_transfer_items")
    await conn.query("TRUNCATE TABLE quarantine_records")
    await conn.query("TRUNCATE TABLE hkc_doc_records")
    await conn.query("TRUNCATE TABLE processing_services")

    // 4. Truncate Customers & Suppliers
    console.log("4. Truncating Customers and Suppliers (for fresh party testing)...")
    await conn.query("TRUNCATE TABLE customers")
    await conn.query("TRUNCATE TABLE suppliers")

    // 5. Truncate Activity Logs
    console.log("5. Truncating old activity logs...")
    await conn.query("TRUNCATE TABLE user_activity_logs")

    // 6. Reset Product Catalog to Zero Stock (Preserving SKUs, names, units, pricing)
    console.log("6. Resetting Product Catalog quantities to 0...")
    await conn.query(`
      UPDATE export_products SET
        quantity = '0.00',
        quantity_sold = '0.00',
        total_quantity = '0.00',
        total_stock_value = '0.00',
        status = 'Out of Stock'
    `)

    await conn.query(`
      UPDATE pharma_products SET
        quantity = '0.00',
        quantity_sold = '0.00',
        total_quantity = '0.00',
        number_of_cartons = 0,
        total_stock_value = '0.00',
        batch_no = NULL,
        mfg_date = NULL,
        expiry_date = NULL,
        status = 'Out of Stock'
    `)

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")

    console.log("\n================================================================================")
    console.log("                             POST-RESET TABLE AUDIT                             ")
    console.log("================================================================================\n")

    const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
    const auditResults = []
    for (const t of tables) {
      const name = Object.values(t)[0]
      const [cnt] = await conn.query(`SELECT count(*) as c FROM \`${name}\``)
      auditResults.push({ table: name, count: cnt[0].c })
    }
    console.table(auditResults)

    console.log("\n✅ Database reset successfully completed for fresh testing!")
  } catch (err) {
    console.error("❌ Error resetting database:", err)
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

resetDatabaseForTesting().catch((err) => {
  console.error(err)
  process.exit(1)
})
