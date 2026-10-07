import { pool } from "../server/db/client.js"
import { deleteProduct } from "../server/modules/inventory/inventoryProductLogic.js"

async function verifyAtomicity() {
  const conn = await pool.getConnection()
  try {
    console.log("--> Starting Cascade Deletion & Atomicity Verification Test...")

    const testId = `P-TEST-VERIFY-${Date.now()}`
    const testBatchId = `PB-${testId}-01`
    const testBatchNo = `BTCH-TEST-99`
    const testSmId = `SM-TEST-${Date.now()}`
    const testJeId = `JE-INTAKE-${testBatchId}`
    const testJeLineDr = `${testJeId}-DR`
    const testJeLineCr = `${testJeId}-CR`

    await conn.beginTransaction()

    // 1. Insert dummy product
    await conn.query(`
      INSERT INTO pharma_products (id, sku, name, warehouse_id, quantity, unit_cost, total_stock_value, status, unit)
      VALUES (?, 'SKU-TEST-99', 'TEST MEDICINE FOR ATOMIC PURGE', 'WH3-VET-LEBU', 100, 50, 5000, 'In Stock', 'Box')
    `, [testId])

    // 2. Insert dummy batch
    await conn.query(`
      INSERT INTO pharma_product_batches (id, product_id, warehouse_id, batch_no, quantity, unit_cost, qa_status, expiry_date)
      VALUES (?, ?, 'WH3-VET-LEBU', ?, 100, 50, 'Released', '2028-12-31')
    `, [testBatchId, testId, testBatchNo])

    // 3. Insert dummy movement
    await conn.query(`
      INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity, balance_after, batch_no, movement_date)
      VALUES (?, ?, 'WH3-VET-LEBU', 'RECEIPT', 100, 100, ?, '2026-10-07')
    `, [testSmId, testId, testBatchNo])

    // 4. Insert dummy journal entry & lines
    await conn.query(`
      INSERT INTO journal_entries (id, entry_number, entry_date, description, source_type, source_id, posting_status, total_amount)
      VALUES (?, ?, '2026-10-07', ?, 'Inventory', ?, 'Posted', 5000)
    `, [testJeId, testJeId, `Stock Intake Valuation — TEST MEDICINE FOR ATOMIC PURGE [Batch: ${testBatchNo}] (+100 @ ETB 50.00)`, `STK-IN-${testBatchNo}`])

    await conn.query(`
      INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (?, ?, '1400-01', 'Test Debit', 5000, 0)
    `, [testJeLineDr, testJeId])

    await conn.query(`
      INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (?, ?, '3200', 'Test Credit', 0, 5000)
    `, [testJeLineCr, testJeId])

    await conn.commit()
    conn.release()

    console.log(`--> Created test product ${testId} with batches, movements, and JEs.`)

    // Now call the hardened deleteProduct function!
    console.log("--> Calling deleteProduct()...")
    const delRes = await deleteProduct(testId)
    console.log("deleteProduct result:", delRes)

    // Check database to verify everything was completely purged!
    const [pCheck] = await pool.query("SELECT * FROM pharma_products WHERE id = ?", [testId])
    const [bCheck] = await pool.query("SELECT * FROM pharma_product_batches WHERE product_id = ?", [testId])
    const [smCheck] = await pool.query("SELECT * FROM stock_movements WHERE product_id = ?", [testId])
    const [jeCheck] = await pool.query("SELECT * FROM journal_entries WHERE id = ?", [testJeId])
    const [jelCheck] = await pool.query("SELECT * FROM journal_entry_lines WHERE id IN (?, ?)", [testJeLineDr, testJeLineCr])

    if (pCheck.length === 0 && bCheck.length === 0 && smCheck.length === 0 && jeCheck.length === 0 && jelCheck.length === 0) {
      console.log("SUCCESS! All child batches, movements, journal entries, and lines were atomically purged with ZERO orphans!")
    } else {
      console.error("FAILURE! Orphaned records survived:", {
        products: pCheck.length,
        batches: bCheck.length,
        movements: smCheck.length,
        jes: jeCheck.length,
        jel: jelCheck.length,
      })
      process.exit(1)
    }

    // Verify global catalog and trial balance
    const [pCount] = await pool.query("SELECT count(*) as count FROM pharma_products")
    const [expCount] = await pool.query("SELECT count(*) as count FROM export_products")
    const [tb] = await pool.query(`
      SELECT 
        ROUND(SUM(debit_amount), 2) as total_debit,
        ROUND(SUM(credit_amount), 2) as total_credit,
        ROUND(SUM(debit_amount) - SUM(credit_amount), 2) as diff
      FROM journal_entry_lines
    `)

    console.log(`Final Catalog Count: ${Number(pCount[0].count) + Number(expCount[0].count)} (Expected: 37)`)
    console.log(`Final Trial Balance Difference: ETB ${tb[0].diff} (Expected: 0.00)`)

    if (Number(pCount[0].count) + Number(expCount[0].count) === 37 && Number(tb[0].diff) === 0) {
      console.log("\nALL ATOMICITY & RECONCILIATION CHECKS PASSED!\n")
    } else {
      console.error("Reconciliation checks failed!")
      process.exit(1)
    }

  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

verifyAtomicity()
