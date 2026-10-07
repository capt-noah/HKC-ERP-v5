/**
 * HKC ERP v5 - Sync Pharma Products Parent Cache to Physical Batch Truth
 * 
 * Synchronizes the 9 stale parent rows in `pharma_products` (quantity, total_quantity, total_stock_value, unit_cost)
 * to match `pharma_product_batches` and GL Account 1400-01 down to 0.00 ETB.
 * 
 * Usage:
 *   Dry-run: node scripts/sync_pharma_products_to_batch_truth.mjs --dry-run
 *   Live:    node scripts/sync_pharma_products_to_batch_truth.mjs --live
 */

import mysql from "mysql2/promise"

async function run() {
  const args = process.argv.slice(2)
  const isLive = args.includes("--live")
  const isDryRun = !isLive

  console.log("================================================================================")
  console.log("   HKC ERP v5 - PHARMA PARENT CACHE SYNCHRONIZATION ENGINE")
  console.log("================================================================================")
  console.log(`Mode: ${isLive ? ">>> LIVE EXECUTION (PERSISTING TO MYSQL) <<<" : "DRY RUN (Simulation Only)"}\n`)

  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading",
  })

  try {
    const [prods] = await conn.query(
      "SELECT id, name, sku, quantity, total_quantity, unit_cost, total_stock_value FROM pharma_products"
    )
    const [batches] = await conn.query(
      "SELECT product_id, batch_no, quantity, unit_cost, qa_status FROM pharma_product_batches WHERE qa_status = 'Released'"
    )

    const batchMap = new Map()
    for (const b of batches) {
      if (!batchMap.has(b.product_id)) {
        batchMap.set(b.product_id, { qty: 0, val: 0, count: 0 })
      }
      const item = batchMap.get(b.product_id)
      const q = Number(b.quantity || 0)
      const c = Number(b.unit_cost || 0)
      item.qty += q
      item.val += Math.round(q * c * 100) / 100
      item.count++
    }

    const updates = []
    let totalTargetVal = 0

    for (const p of prods) {
      const b = batchMap.get(p.id) || { qty: 0, val: 0, count: 0 }
      const newQty = b.qty
      const newVal = Math.round(b.val * 100) / 100
      const newUnitCost = newQty > 0 ? Math.round((newVal / newQty) * 100) / 100 : Number(p.unit_cost || 0)

      totalTargetVal += newVal

      const curQty = Number(p.quantity || 0)
      const curVal = Number(p.total_stock_value || 0)

      if (Math.abs(curQty - newQty) > 0.01 || Math.abs(curVal - newVal) > 0.05) {
        updates.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          batches: b.count,
          old_qty: curQty,
          new_qty: newQty,
          old_val: curVal,
          new_val: newVal,
          new_unit_cost: newUnitCost,
        })
      }
    }

    console.log(`Found ${updates.length} products requiring parent cache update:`)
    console.table(updates)

    // GL Verification
    const [[gl]] = await conn.query(
      "SELECT (SUM(debit_amount) - SUM(credit_amount)) as net_balance FROM journal_entry_lines WHERE account_code = '1400-01'"
    )
    const glBal = Number(gl.net_balance)
    console.log(`\nAuthoritative Batch Total Valuation:  ETB ${totalTargetVal.toFixed(2)}`)
    console.log(`General Ledger 1400-01 Net Balance:   ETB ${glBal.toFixed(2)}`)
    console.log(`Variance between Batches and GL:      ETB ${Math.abs(totalTargetVal - glBal).toFixed(2)}`)

    if (Math.abs(totalTargetVal - glBal) > 0.01) {
      throw new Error(`Variance between batches and GL detected: ${Math.abs(totalTargetVal - glBal)}! Aborting.`)
    }

    if (isDryRun) {
      console.log("\n[DRY RUN] No changes were made to MySQL. Run with --live to execute sync.")
      return
    }

    // Live Execution
    console.log("\nExecuting live updates in MySQL transaction...")
    await conn.beginTransaction()

    for (const u of updates) {
      await conn.query(
        `UPDATE pharma_products 
         SET quantity = ?, total_quantity = ?, unit_cost = ?, total_stock_value = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [u.new_qty, u.new_qty, u.new_unit_cost, u.new_val, u.id]
      )
    }

    const [[finalSum]] = await conn.query("SELECT SUM(total_stock_value) as total_val FROM pharma_products")
    console.log(`Verified new pharma_products total valuation: ETB ${Number(finalSum.total_val).toFixed(2)}`)

    if (Math.abs(Number(finalSum.total_val) - glBal) > 0.01) {
      throw new Error("Final verification failed: pharma_products does not match GL!")
    }

    await conn.commit()
    console.log("\n[SUCCESS] Transaction committed. All 36 pharma products are now 100% in sync with physical batches and GL!")
  } catch (err) {
    if (isLive) {
      await conn.rollback().catch(() => {})
    }
    console.error("[ERROR]", err.message)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

run().catch(console.error)
