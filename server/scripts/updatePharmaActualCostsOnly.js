import { pool } from "../db/client.js"

async function runCostOnlyUpdate() {
  console.log("================================================================================")
  console.log("       UPDATING PHARMA ACTUAL COST PRICES ONLY (PRESERVING ALL OTHER DATA)      ")
  console.log("================================================================================\n")

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Map of product ID -> verified actual cost price
    const costUpdates = [
      // WH2 (Ashish Warehouse)
      { id: "P-1788860002713", name: "ASHIALBIN 2500", newCost: 806.51 },
      { id: "P-1788860199689", name: "ASHIENRO BH", newCost: 383.09 },
      { id: "P-1788919771878", name: "ASHINERO 10% ORAL", newCost: 211.71 },
      { id: "P-1788859302545", name: "ASHITETRA 2000", newCost: 630.92 },
      { id: "P-1788859087961", name: "ASHITRAZ 12.5%", newCost: 1166.74 },
      { id: "P-1788859513561", name: "ASHIVER 1% INJECTION", newCost: 84.00 },
      { id: "P-1788854908608", name: "ASHIVER 5", newCost: 185.33 },
      { id: "P-1788861003705", name: "ASHOXY 20% 100GM", newCost: 1713.83 },
      { id: "P-1788860444633", name: "ASHOXY 20% 5GM", newCost: 201.63 },
      { id: "P-1788920432213", name: "ASHTYL 20% INJ", newCost: 383.09 },
      { id: "P-1788860782033", name: "FASINASH SHEEP", newCost: 362.93 },

      // WH3 (Tongda Warehouse)
      { id: "P-1788858054417", name: "ALBENTONG 2500", newCost: 707.92 },
      { id: "P-1788858377681", name: "ALBENTONG SUS 10", newCost: 401.79 },
      { id: "P-1788921387242", name: "HIVITA TONG", newCost: 123.52 },
      { id: "P-1788857345432", name: "INFLAMGO (Old Batch 251032)", newCost: 189.02 },
      { id: "P-1788857446192", name: "INFLAMGO (New Batch 260512)", newCost: 188.42 },
      { id: "P-1788920639771", name: "IVERTONG GLASS", newCost: 56.53 },
      { id: "P-1788921168285", name: "IVERTONG PLASTIC", newCost: 56.53 },
      { id: "P-1788858567873", name: "LIVERFLUKE 1", newCost: 382.66 },
      { id: "P-1788920860228", name: "OXYTONG 20", newCost: 181.59 },
      { id: "P-1788921559264", name: "TRYPATONG", newCost: 26.17 },
      { id: "P-1788859675153", name: "TY-VITAMINS", newCost: 128.20 },
    ]

    console.log(`[1/3] Updating unit_cost and total_stock_value for ${costUpdates.length} pharma products...`)
    for (const item of costUpdates) {
      // Get current quantity and selling price to preserve them exactly
      const [rows] = await conn.query("SELECT quantity, selling_price, unit_cost FROM pharma_products WHERE id = ?", [item.id])
      if (rows.length === 0) {
        console.warn(`⚠️ Product not found: ${item.id} (${item.name})`)
        continue
      }

      const currentQty = Number(rows[0].quantity || 0)
      const currentSell = Number(rows[0].selling_price || 0)
      const newTotalValue = currentQty * item.newCost

      await conn.query(`
        UPDATE pharma_products 
        SET unit_cost = ?, total_stock_value = ?
        WHERE id = ?
      `, [item.newCost, newTotalValue, item.id])

      // Also update unit_cost in pharma_product_batches
      await conn.query(`
        UPDATE pharma_product_batches
        SET unit_cost = ?
        WHERE product_id = ?
      `, [item.newCost, item.id])

      // Also update unit_cost in stock_movements for initial movements of this product
      await conn.query(`
        UPDATE stock_movements
        SET unit_cost = ?
        WHERE product_id = ? AND (movement_type = 'IN' OR movement_type = 'RECEIPT' OR id LIKE 'SM-INIT-%')
      `, [item.newCost, item.id])
    }

    await conn.commit()
    console.log("✅ Database transaction successfully committed.\n")

    // Verify all 22 products after update
    const [updatedRows] = await conn.query(`
      SELECT id, name, warehouse_id, batch_no, quantity, unit_cost, selling_price, total_stock_value
      FROM pharma_products
      ORDER BY warehouse_id, name
    `)

    console.log("=== FINAL VERIFIED PHARMA PRODUCTS AFTER COST-ONLY UPDATE ===")
    console.table(updatedRows.map(r => ({
      id: r.id,
      name: r.name,
      wh: r.warehouse_id,
      batch: r.batch_no,
      stockQty: Number(r.quantity),
      unitCost: Number(r.unit_cost),
      sellingPrice: Number(r.selling_price),
      totalValueAtCost: Number(r.total_stock_value),
      profitMarginPerUnit: (Number(r.selling_price) - Number(r.unit_cost)).toFixed(2)
    })))

  } catch (err) {
    await conn.rollback()
    console.error("❌ Error updating costs:", err)
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

runCostOnlyUpdate().catch((err) => {
  console.error(err)
  process.exit(1)
})
