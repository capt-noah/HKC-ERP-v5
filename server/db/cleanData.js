import { pool } from "./client.js"

export async function runDatabaseCleanup() {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query("SET FOREIGN_KEY_CHECKS = 0")

    console.log("--- 1. Resetting Pharma Products & Stock Movements ---")
    const [pharmaProds] = await connection.query("SELECT id, name, total_quantity FROM pharma_products")
    
    for (const prod of pharmaProds) {
      // Find the earliest initial movement
      const [movements] = await connection.query(
        "SELECT id, quantity, balance_after FROM stock_movements WHERE product_id = ? ORDER BY created_at ASC",
        [prod.id]
      )
      
      let initQty = Number(prod.total_quantity)
      let firstMovId = null
      
      if (movements.length > 0) {
        firstMovId = movements[0].id
        initQty = Number(movements[0].quantity) || initQty
        
        // Delete all movements except first
        await connection.query(
          "DELETE FROM stock_movements WHERE product_id = ? AND id != ?",
          [prod.id, firstMovId]
        )
        // Ensure first movement has balance_after = initQty
        await connection.query(
          "UPDATE stock_movements SET balance_after = quantity WHERE id = ?",
          [firstMovId]
        )
      }
      
      // Update product quantity and reset quantity_sold
      await connection.query(
        "UPDATE pharma_products SET quantity = ?, total_quantity = ?, quantity_sold = 0, status = ? WHERE id = ?",
        [initQty, initQty, "In Stock", prod.id]
      )

      // Update batches for this product
      await connection.query(
        "UPDATE pharma_product_batches SET quantity = ? WHERE product_id = ?",
        [initQty, prod.id]
      )
      
      console.log(`✓ Pharma Product [${prod.name}]: Reset to Initial Qty = ${initQty}, Kept 1st movement [${firstMovId}]`)
    }

    console.log("\n--- 2. Resetting Export Products & Export Movements ---")
    const [exportProds] = await connection.query("SELECT id, name FROM export_products")
    
    for (const prod of exportProds) {
      const [movements] = await connection.query(
        "SELECT id, net_quantity, gross_quantity FROM export_warehouse_movements WHERE product_id = ? ORDER BY created_at ASC",
        [prod.id]
      )
      
      let initQty = 0
      let firstMovId = null
      
      if (movements.length > 0) {
        firstMovId = movements[0].id
        initQty = Number(movements[0].net_quantity) || Number(movements[0].gross_quantity) || 0
        
        // Delete all movements except first
        await connection.query(
          "DELETE FROM export_warehouse_movements WHERE product_id = ? AND id != ?",
          [prod.id, firstMovId]
        )
      }
      
      // Update product quantity and reset quantity_sold
      await connection.query(
        "UPDATE export_products SET quantity = ?, total_quantity = ?, quantity_sold = 0, status = ? WHERE id = ?",
        [initQty, initQty, "In Stock", prod.id]
      )
      
      console.log(`✓ Export Product [${prod.name}]: Reset to Initial Qty = ${initQty}, Kept 1st movement [${firstMovId}]`)
    }

    console.log("\n--- 3. Clearing Transaction & Temporary Tables ---")
    const tablesToClear = [
      "sales_issue_items",
      "sales_issues",
      "sales_orders",
      "purchase_orders",
      "invoices",
      "payments",
      "shipment_documents",
      "hkc_doc_records",
      "quarantine_records",
      "store_transfer_items",
      "store_transfers",
      "processing_services",
      "expenses",
      "recurring_expense_schedules",
      "vehicles",
      "user_activity_logs",
      "user_sessions",
      "attendance_records",
      "payroll_periods",
      "payroll_records",
      "leave_types",
      "leave_requests",
      "employees"
    ]

    for (const tbl of tablesToClear) {
      const [{ affectedRows }] = await connection.query(`DELETE FROM \`${tbl}\``)
      console.log(`✓ Cleared table: ${tbl} (${affectedRows} rows deleted)`)
    }

    console.log("\n--- 4. Cleaning Journal Entries (Preserving Opening Balances) ---")
    const [jeResult] = await connection.query(
      "DELETE FROM journal_entries WHERE id != ?",
      ["JE-OPENING-BALANCES"]
    )
    console.log(`✓ Deleted ${jeResult.affectedRows} non-opening journal entries`)

    const [jelResult] = await connection.query(
      "DELETE FROM journal_entry_lines WHERE payload NOT LIKE ? AND id NOT LIKE ?",
      ["%JE-OPENING-BALANCES%", "%OPENING%"]
    )
    console.log(`✓ Deleted ${jelResult.affectedRows} non-opening journal entry lines`)

    await connection.query("SET FOREIGN_KEY_CHECKS = 1")
    await connection.commit()
    console.log("\n==========================================")
    console.log("🎉 DATABASE CLEANUP COMPLETED SUCCESSFULLY!")
    console.log("==========================================")
  } catch (err) {
    await connection.rollback()
    console.error("❌ Cleanup failed, rolled back:", err)
    throw err
  } finally {
    connection.release()
  }
}

if (process.argv[1]?.endsWith("cleanData.js")) {
  runDatabaseCleanup()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
