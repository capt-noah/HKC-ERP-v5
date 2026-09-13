import { pool } from "../db/client.js"
import { drizzleListRows, drizzleCreateRow, drizzleUpdateRow, drizzleGetRow } from "../db/drizzleCrud.js"
import { getResource } from "../db/resourceRegistry.js"

async function runRelationalInventoryTestSuite() {
  console.log("================================================================")
  console.log("   HKC-ERP v5: RELATIONAL INVENTORY SUITE VERIFICATION          ")
  console.log("================================================================")

  let passedTests = 0
  let failedTests = 0

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`)
      passedTests++
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? `(${details})` : ""}`)
      failedTests++
    }
  }

  const conn = await pool.getConnection()
  try {
    // ---------------------------------------------------------
    // TEST SUITE 1: Table Structure & No Payload Column
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 1: Relational Schema Structure Verification ---")
    const tables = ["inventory_products", "stock_movements", "store_transfers", "store_transfer_items"]
    
    for (const table of tables) {
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``)
      const colNames = cols.map(c => c.Field)
      assert(!colNames.includes("payload"), `Table '${table}' has no legacy 'payload' column`)
    }

    const [prodCols] = await conn.query("SHOW COLUMNS FROM inventory_products")
    const prodColNames = prodCols.map(c => c.Field)
    assert(prodColNames.includes("warehouse_id"), "inventory_products has 'warehouse_id' column")
    assert(prodColNames.includes("quantity"), "inventory_products has 'quantity' column")
    assert(prodColNames.includes("unit_cost"), "inventory_products has 'unit_cost' column")
    assert(prodColNames.includes("total_stock_value"), "inventory_products has 'total_stock_value' column")
    assert(prodColNames.includes("batches"), "inventory_products has 'batches' JSON column")
    assert(prodColNames.includes("wh1_entries"), "inventory_products has 'wh1_entries' JSON column")

    // ---------------------------------------------------------
    // TEST SUITE 2: High-Performance SQL Aggregations
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 2: Native SQL Inventory Aggregations ---")
    const [aggRows] = await conn.query(`
      SELECT 
        warehouse_id, 
        COUNT(*) as total_items, 
        SUM(quantity) as total_quantity, 
        SUM(total_stock_value) as total_valuation 
      FROM inventory_products 
      GROUP BY warehouse_id
    `)
    assert(aggRows.length > 0, "Native SQL GROUP BY warehouse aggregation succeeded", `Found ${aggRows.length} warehouse groupings`)
    for (const agg of aggRows) {
      console.log(`   -> Warehouse ${agg.warehouse_id}: ${agg.total_items} items, ${Number(agg.total_quantity).toFixed(2)} units, Val: ETB ${Number(agg.total_valuation).toLocaleString()}`)
    }

    // ---------------------------------------------------------
    // TEST SUITE 3: Product CRUD via Drizzle Relational Layer
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 3: Product CRUD & Normalization via Drizzle Layer ---")
    const testExportProdId = `PROD-TEST-EXP-${Date.now()}`
    const testExportProd = {
      id: testExportProdId,
      sku: "EXP-COF-001",
      name: "Organic Yirgacheffe Grade 1 Specialty Coffee",
      category: "Coffee",
      productType: "EXPORT_COMMODITY",
      warehouse: "WH1",
      unit: "Quintal",
      quantity: 150,
      quantitySold: 0,
      totalQuantity: 150,
      unitCost: 8500,
      sellingPrice: 9200,
      totalStockValue: 1275000,
      wh1Entries: [
        { entryId: "GRV-YIRG-01", supplier: "Yirgacheffe Union", quantityReceived: 150, quantityRemaining: 150, unitPrice: 8500 }
      ]
    }

    const createProdRes = await drizzleCreateRow({
      resource: getResource("inventory_products"),
      body: testExportProd
    })
    assert(createProdRes.status === 200, "Created export product via Drizzle relational layer")

    const getProdRes = await drizzleGetRow({
      resource: getResource("inventory_products"),
      id: testExportProdId
    })
    assert(getProdRes.status === 200, "Retrieved export product via Drizzle")
    assert(getProdRes.body.warehouse_id === "WH1", "warehouse_id correctly mapped to WH1")
    assert(getProdRes.body.warehouse === "WH1", "warehouse alias available on retrieved object")
    assert(Number(getProdRes.body.quantity) === 150, "quantity matches 150")
    assert(Number(getProdRes.body.unitCost) === 8500, "unitCost matches 8500")

    // Update quantity via Drizzle
    const updateProdRes = await drizzleUpdateRow({
      resource: getResource("inventory_products"),
      id: testExportProdId,
      body: {
        quantity: 120,
        quantitySold: 30,
        totalStockValue: 1020000
      }
    })
    assert(updateProdRes.status === 200, "Updated product stock quantity via Drizzle")
    assert(Number(updateProdRes.body.quantity) === 120, "Updated quantity correctly saved as 120")

    // ---------------------------------------------------------
    // TEST SUITE 4: Stock Movement Logging & Indexed Lookup
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 4: Relational Stock Movement Logging ---")
    const testMovId = `MOV-TEST-${Date.now()}`
    const testMovement = {
      id: testMovId,
      productId: testExportProdId,
      warehouseId: "WH1",
      movementType: "INBOUND_RECEIPT",
      quantity: 150,
      unitCost: 8500,
      balanceAfter: 150,
      batchNo: "BATCH-YIRG-2026",
      referenceType: "grv",
      referenceId: "GRV-YIRG-01",
      notes: "Direct farmer delivery intake",
      performedBy: "Test Receiving Officer",
      movementDate: "2026-09-10"
    }

    const createMovRes = await drizzleCreateRow({
      resource: getResource("stock_movements"),
      body: testMovement
    })
    assert(createMovRes.status === 200, "Recorded relational stock movement")

    const listMovsRes = await drizzleListRows({
      resource: getResource("stock_movements"),
      query: { product_id: testExportProdId }
    })
    assert(listMovsRes.status === 200 && listMovsRes.body.length >= 1, "Queried movements indexed by product_id")
    assert(listMovsRes.body[0].movement_type === "INBOUND_RECEIPT", "Movement type matches INBOUND_RECEIPT")

    // ---------------------------------------------------------
    // TEST SUITE 5: Store Transfers & Transfer Line Items
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 5: Store Transfers Parent-Child Relations ---")
    const testTransferId = `TR-TEST-${Date.now()}`
    const testTransfer = {
      id: testTransferId,
      transferNo: "TR-2026-9999",
      fromWarehouse: "WH2",
      toWarehouse: "WH3",
      status: "In Transit",
      requestedBy: "Dr. Sintayehu",
      approvedBy: "Tigist Haile",
      requestDate: "2026-09-10",
      notes: "Emergency vaccine redistribution"
    }

    const createTransRes = await drizzleCreateRow({
      resource: getResource("store_transfers"),
      body: testTransfer
    })
    assert(createTransRes.status === 200, "Created store transfer header")

    // Insert 2 child line items
    const item1 = {
      id: `STI-TEST-1-${Date.now()}`,
      transferId: testTransferId,
      productId: testExportProdId,
      productName: "Anthrax Spore Vaccine 100 doses",
      batchNo: "VAC-2026-09",
      quantity: 50,
      uom: "Vial",
      unitCost: 450
    }
    const item2 = {
      id: `STI-TEST-2-${Date.now()}`,
      transferId: testTransferId,
      productId: testExportProdId,
      productName: "Tylosin Tartrate Soluble 100g",
      batchNo: "TYL-2026-01",
      quantity: 100,
      uom: "Sachet",
      unitCost: 320
    }

    const createItem1Res = await drizzleCreateRow({ resource: getResource("store_transfer_items"), body: item1 })
    const createItem2Res = await drizzleCreateRow({ resource: getResource("store_transfer_items"), body: item2 })
    assert(createItem1Res.status === 200 && createItem2Res.status === 200, "Created store transfer line items in child table")

    // Relational SQL JOIN
    const [joinRows] = await conn.query(`
      SELECT 
        st.transfer_no, st.from_warehouse_id, st.to_warehouse_id, st.status,
        sti.product_name, sti.batch_no, sti.quantity, sti.uom, sti.unit_cost
      FROM store_transfers st
      JOIN store_transfer_items sti ON st.id = sti.transfer_id
      WHERE st.id = ?
    `, [testTransferId])

    assert(joinRows.length === 2, "Relational JOIN returned both transfer line items", `Found ${joinRows.length}`)
    assert(joinRows[0].from_warehouse_id === "WH2", "Transfer origin correctly identified as WH2")
    assert(joinRows[0].to_warehouse_id === "WH3", "Transfer destination correctly identified as WH3")
    assert(Number(joinRows[0].quantity) + Number(joinRows[1].quantity) === 150, "Total transfer item quantities sum to 150")

    // Cleanup test records
    await conn.query("DELETE FROM store_transfer_items WHERE transfer_id = ?", [testTransferId])
    await conn.query("DELETE FROM store_transfers WHERE id = ?", [testTransferId])
    await conn.query("DELETE FROM stock_movements WHERE id = ?", [testMovId])
    await conn.query("DELETE FROM inventory_products WHERE id = ?", [testExportProdId])
    console.log("\n🧹 Cleaned up temporary test records from database.")

  } catch (err) {
    console.error("Test Suite Failure:", err)
    failedTests++
  } finally {
    conn.release()
  }

  console.log("\n================================================================")
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
  console.log("================================================================\n")

  if (failedTests > 0) process.exit(1)
}

runRelationalInventoryTestSuite().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
