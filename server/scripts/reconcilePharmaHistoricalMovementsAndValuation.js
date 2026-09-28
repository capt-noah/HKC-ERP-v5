import { pool } from "../db/client.js"

async function reconcilePharmaMovementsAndValuation() {
  console.log("================================================================================")
  console.log("   RECONCILING PHARMA HISTORICAL STOCK MOVEMENTS & INVENTORY VALUATION        ")
  console.log("================================================================================\n")

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Audit and update the 14 historical ISSUE movements in stock_movements
    console.log("[1/4] Reconciling 14 historical ISSUE stock movements with actual product unit_cost...")
    const [issueRowsBefore] = await conn.query(`
      SELECT sm.id, sm.product_id, p.name, sm.quantity, sm.unit_cost, sm.unit_price, sm.selling_price, p.unit_cost AS true_unit_cost
      FROM stock_movements sm
      JOIN pharma_products p ON sm.product_id = p.id
      WHERE sm.movement_type = 'ISSUE'
      ORDER BY sm.id ASC
    `)
    console.log(`Found ${issueRowsBefore.length} ISSUE movements to reconcile.`)

    const updateIssueResult = await conn.query(`
      UPDATE stock_movements sm
      JOIN pharma_products p ON sm.product_id = p.id
      SET 
        sm.unit_cost = p.unit_cost,
        sm.unit_price = p.unit_cost
      WHERE sm.movement_type = 'ISSUE'
    `)
    console.log(`✅ Updated ${updateIssueResult[0].affectedRows} ISSUE movements: unit_cost and unit_price now match product acquisition cost.\n`)

    // 2. Harmonize RECEIPT movements in stock_movements
    console.log("[2/4] Harmonizing RECEIPT movements (aligning unit_price = unit_cost)...")
    const updateReceiptResult = await conn.query(`
      UPDATE stock_movements sm
      JOIN pharma_products p ON sm.product_id = p.id
      SET 
        sm.unit_cost = p.unit_cost,
        sm.unit_price = p.unit_cost
      WHERE sm.movement_type = 'RECEIPT' OR sm.id LIKE 'SM-INIT-%'
    `)
    console.log(`✅ Harmonized ${updateReceiptResult[0].affectedRows} RECEIPT movements.\n`)

    // 3. Ensure all active batches in pharma_product_batches match product unit_cost
    console.log("[3/4] Verifying pharma_product_batches unit_cost...")
    const updateBatchResult = await conn.query(`
      UPDATE pharma_product_batches b
      JOIN pharma_products p ON b.product_id = p.id
      SET b.unit_cost = p.unit_cost
    `)
    console.log(`✅ Verified/Updated ${updateBatchResult[0].affectedRows} batches in pharma_product_batches.\n`)

    // 4. Guarantee exact stock valuation across all 22 pharma_products
    console.log("[4/4] Recalculating total_stock_value = ROUND(quantity * unit_cost, 2) on all pharma_products...")
    const updateProdResult = await conn.query(`
      UPDATE pharma_products
      SET total_stock_value = ROUND(quantity * unit_cost, 2)
    `)
    console.log(`✅ Verified ${updateProdResult[0].affectedRows} pharma products valuation.\n`)

    // Verify after update
    const [issueRowsAfter] = await conn.query(`
      SELECT sm.id, sm.product_id, p.name, sm.quantity, sm.unit_cost, sm.unit_price, sm.selling_price, sm.reference_id
      FROM stock_movements sm
      JOIN pharma_products p ON sm.product_id = p.id
      WHERE sm.movement_type = 'ISSUE'
      ORDER BY sm.id ASC
    `)
    console.log("=== VERIFIED ISSUE MOVEMENTS AFTER RECONCILIATION ===")
    console.table(issueRowsAfter.map(r => ({
      id: r.id,
      product: r.name,
      qty: Number(r.quantity),
      unitCost: Number(r.unit_cost),
      unitPrice: Number(r.unit_price),
      sellingPrice: Number(r.selling_price),
      reference: r.reference_id
    })))

    const [allPharma] = await conn.query(`
      SELECT id, name, warehouse_id, quantity, unit_cost, selling_price, total_stock_value
      FROM pharma_products
      ORDER BY warehouse_id, name
    `)
    console.log("\n=== ALL 22 PHARMA PRODUCTS AFTER RECONCILIATION ===")
    console.table(allPharma.map(r => ({
      name: r.name,
      wh: r.warehouse_id,
      stockQty: Number(r.quantity),
      unitCost: Number(r.unit_cost),
      sellingPrice: Number(r.selling_price),
      totalStockValue: Number(r.total_stock_value),
      expectedValue: Number((Number(r.quantity) * Number(r.unit_cost)).toFixed(2))
    })))

    await conn.commit()
    console.log("✅ All database updates successfully committed!\n")
  } catch (err) {
    await conn.rollback()
    console.error("❌ Transaction failed, rolled back:", err)
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

reconcilePharmaMovementsAndValuation().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
