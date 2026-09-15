/**
 * Complete 3-Warehouse End-to-End Automated Verification Test
 * Tests WH1 (Export), WH2 (Pharma), WH3 (Pharma)
 * Verifies relational insertions, batch tracking, stock movements, and zero legacy table presence.
 */

import { pool } from "../db/client.js"
import { drizzleCreateRow, drizzleListRows } from "../db/drizzleCrud.js"
import { getResource } from "../db/resourceRegistry.js"

async function runThreeWarehouseTests() {
  console.log("\n==========================================================================")
  console.log("🚀 STARTING 3-WAREHOUSE END-TO-END AUTOMATED VERIFICATION TEST")
  console.log("==========================================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`)
      passed++
    } else {
      console.error(`❌ [FAIL] ${message}`)
      failed++
    }
  }

  try {
    // 0. NEGATIVE CHECK: Verify legacy inventory_products is gone
    console.log("--- 0. Database Cleanliness Check ---")
    const [tables] = await pool.query("SHOW TABLES")
    const tableNames = tables.map((t) => Object.values(t)[0])
    const legacyExists = tableNames.includes("inventory_products")
    assert(!legacyExists, "Legacy 'inventory_products' table DOES NOT exist in MySQL database")

    // 1. TEST WH1 (Export Warehouse)
    console.log("\n--- 1. WH1 (Export Warehouse: Commodities & Direct Movements) ---")
    const wh1ProdId = `PROD-WH1-TEST-${Date.now()}`
    const wh1Payload = {
      id: wh1ProdId,
      name: "Sidamo Grade 2 Washed Coffee",
      sku: `SID-${Date.now().toString().slice(-4)}`,
      commodity_type: "Coffee",
      category: "Coffee",
      warehouse_id: "WH1",
      warehouse: "WH1",
      crop_year: "2026",
      grade: "Grade 2",
      origin: "Sidama",
      moisture_content: 11.5,
      clean_yield_pct: 98.2,
      unit: "Quintal",
      quantity: 250,
      quantity_sold: 0,
      total_quantity: 250,
      unit_cost: 14200,
      selling_price: 15500,
      total_stock_value: 3550000,
      reorder_level: 50,
      min_stock_level: 20,
      status: "In Stock",
      description: "Premium washed Sidamo export coffee",
      supplier_name: "Yirgalem Farmers Union",
      voucher_no: "GRV-SID-001",
      plate_number: "ET-3-48821",
      driver_name: "Abebe Bikila",
    }

    const createWh1Res = await drizzleCreateRow({
      resource: getResource("export_products"),
      body: wh1Payload,
    })
    assert(createWh1Res.status === 201 || createWh1Res.status === 200, `WH1 Export product created (${wh1ProdId})`)

    // Add Inbound GRV Movement
    const wh1GrvId = `EWM-GRV-${Date.now()}`
    const grvPayload = {
      id: wh1GrvId,
      warehouse_id: "WH1",
      product_id: wh1ProdId,
      movement_type: "GRV_ENTRY",
      voucher_no: "GRV-SID-001",
      batch_no: "GRV-SID-001",
      party_name: "Yirgalem Farmers Union",
      plate_number: "ET-3-48821",
      gross_quantity: 250,
      reject_quantity: 0,
      net_quantity: 250,
      uom: "Quintal",
      unit_price: 14200,
      movement_date: new Date().toISOString().slice(0, 10),
      reason: "Direct farmgate delivery",
      created_by: "WH1 Inbound Manager",
    }
    const createGrvRes = await drizzleCreateRow({
      resource: getResource("export_warehouse_movements"),
      body: grvPayload,
    })
    assert(createGrvRes.status === 201 || createGrvRes.status === 200, `WH1 GRV Movement recorded in export_warehouse_movements (${wh1GrvId})`)

    // Add Quality Rejection Deduction
    const wh1RejId = `EWM-REJ-${Date.now()}`
    const rejPayload = {
      id: wh1RejId,
      warehouse_id: "WH1",
      product_id: wh1ProdId,
      movement_type: "REJECT_DEDUCTION",
      voucher_no: "REJ-SID-001",
      batch_no: "GRV-SID-001",
      party_name: "Cleaning & Gravity Line 1",
      plate_number: "ET-3-48821",
      gross_quantity: 0,
      reject_quantity: 15,
      net_quantity: -15,
      uom: "Quintal",
      unit_price: 14200,
      movement_date: new Date().toISOString().slice(0, 10),
      reason: "Husk & foreign matter removal during destoning",
      created_by: "Quality Inspector",
    }
    const createRejRes = await drizzleCreateRow({
      resource: getResource("export_warehouse_movements"),
      body: rejPayload,
    })
    assert(createRejRes.status === 201 || createRejRes.status === 200, `WH1 Rejection Movement recorded in export_warehouse_movements (${wh1RejId})`)

    // Query back WH1 product and its movements
    const [dbWh1Movements] = await pool.query("SELECT * FROM export_warehouse_movements WHERE product_id = ?", [wh1ProdId])
    assert(dbWh1Movements.length >= 2, `WH1 product has at least 2 relational movement records in export_warehouse_movements (found ${dbWh1Movements.length})`)


    // 2. TEST WH2 (Pharma Central Warehouse: Veterinary Medicine)
    console.log("\n--- 2. WH2 (Pharma Central Warehouse: Veterinary Medicine) ---")
    const wh2ProdId = `PROD-WH2-TEST-${Date.now()}`
    const wh2Payload = {
      id: wh2ProdId,
      name: "Amoxicillin Trihydrate 20% Suspension",
      generic_name: "Amoxicillin Trihydrate",
      sku: `AMX-${Date.now().toString().slice(-4)}`,
      category: "Antibiotics",
      sub_category: "Veterinary Injectables",
      warehouse_id: "WH2",
      warehouse: "WH2",
      dosage_form: "Injectable Suspension",
      strength: "200mg/ml",
      shelf_number: "WH2-RACK-04-B",
      storage_condition: "Store below 25°C",
      unit: "Vial",
      quantity_per_pack: 10,
      number_of_cartons: 50,
      quantity: 500,
      quantity_sold: 0,
      total_quantity: 500,
      unit_cost: 380,
      selling_price: 495,
      total_stock_value: 190000,
      reorder_level: 100,
      min_stock_level: 50,
      shelf_life_months: 36,
      status: "In Stock",
      description: "Broad-spectrum bactericidal veterinary antibiotic",
      supplier_name: "Veterinary Pharma Int.",
    }

    const createWh2Res = await drizzleCreateRow({
      resource: getResource("pharma_products"),
      body: wh2Payload,
    })
    assert(createWh2Res.status === 201 || createWh2Res.status === 200, `WH2 Pharma product created (${wh2ProdId})`)

    // Add Batch Lot in pharma_product_batches
    const wh2BatchId = `BAT-WH2-${Date.now()}`
    const batch2Payload = {
      id: wh2BatchId,
      product_id: wh2ProdId,
      warehouse_id: "WH2",
      batch_no: "AMX-2026-LOT1",
      mfg_date: "2026-01-15",
      expiry_date: "2029-01-14",
      quantity: 500,
      unit_cost: 380,
      qa_status: "Released",
      location: "WH2-RACK-04-B",
      notes: "COA verified and released by QA Department",
    }
    const createBatch2Res = await drizzleCreateRow({
      resource: getResource("pharma_product_batches"),
      body: batch2Payload,
    })
    assert(createBatch2Res.status === 201 || createBatch2Res.status === 200, `WH2 Batch lot recorded in pharma_product_batches (${wh2BatchId})`)

    // Add Stock Movement in stock_movements
    const wh2SmId = `SM-WH2-${Date.now()}`
    const sm2Payload = {
      id: wh2SmId,
      product_id: wh2ProdId,
      warehouse_id: "WH2",
      movement_type: "RECEIPT",
      quantity: 500,
      unit_cost: 380,
      balance_after: 500,
      batch_no: "AMX-2026-LOT1",
      expiry_date: "2029-01-14",
      reference_type: "STOCK_RECEIPT",
      reference_id: "GRV-PH-8801",
      notes: "Central inventory intake from Veterinary Pharma Int.",
      performed_by: "Central Pharma Receiver",
      movement_date: new Date().toISOString().slice(0, 10),
    }
    const createSm2Res = await drizzleCreateRow({
      resource: getResource("stock_movements"),
      body: sm2Payload,
    })
    assert(createSm2Res.status === 201 || createSm2Res.status === 200, `WH2 Stock Movement recorded in stock_movements (${wh2SmId})`)


    // 3. TEST WH3 (Pharma Regional Depot: Veterinary Anti-Parasitic)
    console.log("\n--- 3. WH3 (Pharma Regional Depot: Veterinary Anti-Parasitic) ---")
    const wh3ProdId = `PROD-WH3-TEST-${Date.now()}`
    const wh3Payload = {
      id: wh3ProdId,
      name: "Albendazole 2500mg Bolus",
      generic_name: "Albendazole",
      sku: `ALB-${Date.now().toString().slice(-4)}`,
      category: "Anti-Parasitics",
      sub_category: "Dewormer Boluses",
      warehouse_id: "WH3",
      warehouse: "WH3",
      dosage_form: "Bolus",
      strength: "2500mg",
      shelf_number: "WH3-BAY-02",
      storage_condition: "Store in cool dry place",
      unit: "Box",
      quantity_per_pack: 50,
      number_of_cartons: 20,
      quantity: 1000,
      quantity_sold: 0,
      total_quantity: 1000,
      unit_cost: 150,
      selling_price: 210,
      total_stock_value: 150000,
      reorder_level: 200,
      min_stock_level: 100,
      shelf_life_months: 48,
      status: "In Stock",
      description: "Broad-spectrum anthelmintic for livestock",
      supplier_name: "Ethio-Pharma Distributors",
    }

    const createWh3Res = await drizzleCreateRow({
      resource: getResource("pharma_products"),
      body: wh3Payload,
    })
    assert(createWh3Res.status === 201 || createWh3Res.status === 200, `WH3 Pharma product created (${wh3ProdId})`)

    // Add Batch Lot in pharma_product_batches
    const wh3BatchId = `BAT-WH3-${Date.now()}`
    const batch3Payload = {
      id: wh3BatchId,
      product_id: wh3ProdId,
      warehouse_id: "WH3",
      batch_no: "ALB-2026-REG1",
      mfg_date: "2026-02-01",
      expiry_date: "2030-01-31",
      quantity: 1000,
      unit_cost: 150,
      qa_status: "Released",
      location: "WH3-BAY-02",
      notes: "Regional shipment received in good order",
    }
    const createBatch3Res = await drizzleCreateRow({
      resource: getResource("pharma_product_batches"),
      body: batch3Payload,
    })
    assert(createBatch3Res.status === 201 || createBatch3Res.status === 200, `WH3 Batch lot recorded in pharma_product_batches (${wh3BatchId})`)

    // Add Stock Movement in stock_movements
    const wh3SmId = `SM-WH3-${Date.now()}`
    const sm3Payload = {
      id: wh3SmId,
      product_id: wh3ProdId,
      warehouse_id: "WH3",
      movement_type: "RECEIPT",
      quantity: 1000,
      unit_cost: 150,
      balance_after: 1000,
      batch_no: "ALB-2026-REG1",
      expiry_date: "2030-01-31",
      reference_type: "STOCK_RECEIPT",
      reference_id: "GRV-REG-902",
      notes: "Regional depot arrival receipt",
      performed_by: "Regional Warehouse Supervisor",
      movement_date: new Date().toISOString().slice(0, 10),
    }
    const createSm3Res = await drizzleCreateRow({
      resource: getResource("stock_movements"),
      body: sm3Payload,
    })
    assert(createSm3Res.status === 201 || createSm3Res.status === 200, `WH3 Stock Movement recorded in stock_movements (${wh3SmId})`)

    // 4. VERIFY STORE HYDRATION SIMULATION
    console.log("\n--- 4. Store Hydration & Relational Integrity ---")
    const epList = await drizzleListRows({ resource: getResource("export_products") })
    const ppList = await drizzleListRows({ resource: getResource("pharma_products") })
    const pbList = await drizzleListRows({ resource: getResource("pharma_product_batches") })
    const smList = await drizzleListRows({ resource: getResource("stock_movements") })
    const emList = await drizzleListRows({ resource: getResource("export_warehouse_movements") })

    assert(epList.body.some((p) => p.id === wh1ProdId), "Export products listing includes newly added WH1 item")
    assert(ppList.body.some((p) => p.id === wh2ProdId), "Pharma products listing includes newly added WH2 item")
    assert(ppList.body.some((p) => p.id === wh3ProdId), "Pharma products listing includes newly added WH3 item")

    assert(emList.body.some((m) => m.product_id === wh1ProdId && m.movement_type === "GRV_ENTRY"), "WH1 GRV entry exists in export_warehouse_movements")
    assert(emList.body.some((m) => m.product_id === wh1ProdId && m.movement_type === "REJECT_DEDUCTION"), "WH1 Reject entry exists in export_warehouse_movements")

    assert(pbList.body.some((b) => b.product_id === wh2ProdId && b.batch_no === "AMX-2026-LOT1"), "WH2 batch exists in pharma_product_batches")
    assert(smList.body.some((m) => m.product_id === wh2ProdId && m.movement_type === "RECEIPT"), "WH2 movement exists in stock_movements")

    assert(pbList.body.some((b) => b.product_id === wh3ProdId && b.batch_no === "ALB-2026-REG1"), "WH3 batch exists in pharma_product_batches")
    assert(smList.body.some((m) => m.product_id === wh3ProdId && m.movement_type === "RECEIPT"), "WH3 movement exists in stock_movements")

    console.log("🧹 Cleaning up automated test records...")
    await pool.query("DELETE FROM export_warehouse_movements WHERE product_id = ?", [wh1ProdId])
    await pool.query("DELETE FROM export_products WHERE id = ?", [wh1ProdId])

    await pool.query("DELETE FROM stock_movements WHERE product_id = ?", [wh2ProdId])
    await pool.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [wh2ProdId])
    await pool.query("DELETE FROM pharma_products WHERE id = ?", [wh2ProdId])

    await pool.query("DELETE FROM stock_movements WHERE product_id = ?", [wh3ProdId])
    await pool.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [wh3ProdId])
    await pool.query("DELETE FROM pharma_products WHERE id = ?", [wh3ProdId])
    console.log("✅ Automated test records cleaned up cleanly.")

    console.log("\n==========================================================================")
    console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (${failed === 0 ? "100% SUCCESS" : "FAILURES"})`)
    console.log("==========================================================================\n")

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("Test execution error:", err)
    process.exit(1)
  }
}

runThreeWarehouseTests()
