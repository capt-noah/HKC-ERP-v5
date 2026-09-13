import { pool } from "../db/client.js"
import assert from "node:assert"

async function runEndToEndTests() {
  console.log("==================================================================")
  console.log("   HKC-ERP v5: DUAL INVENTORY ARCHITECTURE END-TO-END TEST      ")
  console.log("==================================================================")

  const conn = await pool.getConnection()
  let testExportProdId = `EXP-TEST-${Date.now()}`
  let testPharmaProdId = `PHM-TEST-${Date.now()}`
  let testMovementId1 = `EWM-TEST-1-${Date.now()}`
  let testMovementId2 = `EWM-TEST-2-${Date.now()}`
  let testBatchId = `BAT-TEST-1-${Date.now()}`

  try {
    // ── SUITE 1: Verify Initial Clean State ──────────────────────────────────
    console.log("\n--- SUITE 1: Clean State Verification ---")
    const [orphanedForeignKeys] = await conn.query("SELECT COUNT(*) as count FROM export_warehouse_movements WHERE product_id NOT IN (SELECT id FROM export_products)")
    assert.strictEqual(Number(orphanedForeignKeys[0].count), 0, "export_warehouse_movements should have 0 orphaned records without a valid product")
    console.log("✅ [PASS] `export_warehouse_movements` is cleanly initialized with 0 orphaned records.")

    // ── SUITE 2: Add New Export Commodity Product in WH1 ───────────────────
    console.log("\n--- SUITE 2: Add New Commodity Product to Export Warehouse (WH1) ---")
    const exportProductPayload = {
      id: testExportProdId,
      sku: "EXP-COFF-HAR-01",
      name: "Harar Longberry Grade 1 Coffee",
      commodity_type: "Coffee",
      category: "Export Commodity",
      warehouse_id: "WH1",
      crop_year: "2025/2026",
      grade: "Grade 1",
      origin: "Harar, Ethiopia",
      moisture_content: 10.5,
      clean_yield_pct: 95.0,
      unit: "Quintal",
      quantity: 100.0,
      quantity_sold: 0.0,
      total_quantity: 100.0,
      unit_cost: 12500.0,
      selling_price: 15000.0,
      total_stock_value: 1250000.0,
      status: "In Stock",
      supplier_id: "SUPP-COFF-OROMIA",
      supplier_name: "Oromia Coffee Farmers Cooperative Union",
    }

    await conn.query(
      `
      INSERT INTO export_products (
        id, sku, name, commodity_type, category, warehouse_id, crop_year, grade, origin,
        moisture_content, clean_yield_pct, unit, quantity, quantity_sold, total_quantity,
        unit_cost, selling_price, total_stock_value, status, supplier_id, supplier_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        exportProductPayload.id,
        exportProductPayload.sku,
        exportProductPayload.name,
        exportProductPayload.commodity_type,
        exportProductPayload.category,
        exportProductPayload.warehouse_id,
        exportProductPayload.crop_year,
        exportProductPayload.grade,
        exportProductPayload.origin,
        exportProductPayload.moisture_content,
        exportProductPayload.clean_yield_pct,
        exportProductPayload.unit,
        exportProductPayload.quantity,
        exportProductPayload.quantity_sold,
        exportProductPayload.total_quantity,
        exportProductPayload.unit_cost,
        exportProductPayload.selling_price,
        exportProductPayload.total_stock_value,
        exportProductPayload.status,
        exportProductPayload.supplier_id,
        exportProductPayload.supplier_name,
      ]
    )

    // Verify insertion into export_products
    const [expCheck] = await conn.query("SELECT * FROM export_products WHERE id = ?", [testExportProdId])
    assert.strictEqual(expCheck.length, 1, "Product must exist in export_products")
    assert.strictEqual(expCheck[0].name, "Harar Longberry Grade 1 Coffee")
    assert.strictEqual(expCheck[0].warehouse_id, "WH1")
    assert.strictEqual(Number(expCheck[0].quantity), 100.0)
    assert.strictEqual(Number(expCheck[0].total_stock_value), 1250000.0)
    console.log("✅ [PASS] New export commodity saved to `export_products` table.")

    // Verify isolation: product does NOT exist in pharma_products
    const [pharmaIsolationCheck] = await conn.query("SELECT * FROM pharma_products WHERE id = ?", [testExportProdId])
    assert.strictEqual(pharmaIsolationCheck.length, 0, "Export product must NOT exist in pharma_products")
    console.log("✅ [PASS] Verified table isolation: commodity does NOT pollute `pharma_products`.")

    // ── SUITE 3: Record Inbound Truckload GRV Movement ──────────────────────
    console.log("\n--- SUITE 3: Record Inbound GRV Movement in `export_warehouse_movements` ---")
    const inboundMovement = {
      id: testMovementId1,
      warehouse_id: "WH1",
      product_id: testExportProdId,
      movement_type: "GRV_ENTRY",
      voucher_no: "GRV-2026-9901",
      batch_no: "GRV-9901-HAR",
      party_name: "Oromia Coffee Farmers Cooperative Union",
      plate_number: "ET-3-45678-AA",
      gross_quantity: 150.0,
      reject_quantity: 0.0,
      net_quantity: 150.0,
      uom: "Quintal",
      unit_price: 12500.0,
      movement_date: "2026-09-10",
      reason: "Direct farm arrival - 150 Qtl Harar Grade 1",
      created_by: "WH1 Logistics Officer",
    }

    await conn.query(
      `
      INSERT INTO export_warehouse_movements (
        id, warehouse_id, product_id, movement_type, voucher_no, batch_no, party_name,
        plate_number, gross_quantity, reject_quantity, net_quantity, uom, unit_price,
        movement_date, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        inboundMovement.id,
        inboundMovement.warehouse_id,
        inboundMovement.product_id,
        inboundMovement.movement_type,
        inboundMovement.voucher_no,
        inboundMovement.batch_no,
        inboundMovement.party_name,
        inboundMovement.plate_number,
        inboundMovement.gross_quantity,
        inboundMovement.reject_quantity,
        inboundMovement.net_quantity,
        inboundMovement.uom,
        inboundMovement.unit_price,
        inboundMovement.movement_date,
        inboundMovement.reason,
        inboundMovement.created_by,
      ]
    )

    // Update parent export_products stock balance (100 + 150 = 250 Qtl)
    const newExportQty = 250.0
    const newStockVal = newExportQty * 12500.0
    await conn.query(
      `
      UPDATE export_products
      SET quantity = ?, total_quantity = ?, total_stock_value = ?
      WHERE id = ?
    `,
      [newExportQty, newExportQty, newStockVal, testExportProdId]
    )

    // Verify movement persistence
    const [inboundCheck] = await conn.query("SELECT * FROM export_warehouse_movements WHERE id = ?", [testMovementId1])
    assert.strictEqual(inboundCheck.length, 1, "Inbound movement must exist in export_warehouse_movements")
    assert.strictEqual(inboundCheck[0].voucher_no, "GRV-2026-9901")
    assert.strictEqual(Number(inboundCheck[0].gross_quantity), 150.0)
    assert.strictEqual(inboundCheck[0].plate_number, "ET-3-45678-AA")
    console.log("✅ [PASS] Inbound GRV movement correctly persisted to `export_warehouse_movements`.")

    // Verify parent updated
    const [expUpdatedCheck] = await conn.query("SELECT quantity, total_stock_value FROM export_products WHERE id = ?", [testExportProdId])
    assert.strictEqual(Number(expUpdatedCheck[0].quantity), 250.0)
    assert.strictEqual(Number(expUpdatedCheck[0].total_stock_value), 3125000.0)
    console.log("✅ [PASS] `export_products` parent stock correctly updated to 250.00 Qtl (ETB 3,125,000.00).")

    // ── SUITE 4: Record Cleaning Reject Loss Movement ───────────────────────
    console.log("\n--- SUITE 4: Record Cleaning Loss Reject in `export_warehouse_movements` ---")
    const rejectMovement = {
      id: testMovementId2,
      warehouse_id: "WH1",
      product_id: testExportProdId,
      movement_type: "REJECT_DEDUCTION",
      voucher_no: "REJ-2026-0042",
      batch_no: "GRV-9901-HAR",
      party_name: "WH1 QC Line A",
      plate_number: null,
      gross_quantity: 7.5,
      reject_quantity: 7.5,
      net_quantity: 0.0,
      uom: "Quintal",
      unit_price: 12500.0,
      movement_date: "2026-09-10",
      reason: "Hulls, chaff, and impurity removal (5% standard loss)",
      created_by: "WH1 Quality Inspector",
    }

    await conn.query(
      `
      INSERT INTO export_warehouse_movements (
        id, warehouse_id, product_id, movement_type, voucher_no, batch_no, party_name,
        plate_number, gross_quantity, reject_quantity, net_quantity, uom, unit_price,
        movement_date, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        rejectMovement.id,
        rejectMovement.warehouse_id,
        rejectMovement.product_id,
        rejectMovement.movement_type,
        rejectMovement.voucher_no,
        rejectMovement.batch_no,
        rejectMovement.party_name,
        rejectMovement.plate_number,
        rejectMovement.gross_quantity,
        rejectMovement.reject_quantity,
        rejectMovement.net_quantity,
        rejectMovement.uom,
        rejectMovement.unit_price,
        rejectMovement.movement_date,
        rejectMovement.reason,
        rejectMovement.created_by,
      ]
    )

    // Update parent export_products stock balance (250 - 7.5 = 242.5 Qtl)
    const postRejectQty = 242.5
    const postRejectVal = postRejectQty * 12500.0
    await conn.query(
      `
      UPDATE export_products
      SET quantity = ?, total_quantity = ?, total_stock_value = ?
      WHERE id = ?
    `,
      [postRejectQty, postRejectQty, postRejectVal, testExportProdId]
    )

    const [rejectCheck] = await conn.query("SELECT * FROM export_warehouse_movements WHERE id = ?", [testMovementId2])
    assert.strictEqual(rejectCheck.length, 1)
    assert.strictEqual(rejectCheck[0].movement_type, "REJECT_DEDUCTION")
    assert.strictEqual(Number(rejectCheck[0].reject_quantity), 7.5)
    console.log("✅ [PASS] Reject loss movement correctly persisted to `export_warehouse_movements`.")

    const [expPostRejectCheck] = await conn.query("SELECT quantity, total_stock_value FROM export_products WHERE id = ?", [testExportProdId])
    assert.strictEqual(Number(expPostRejectCheck[0].quantity), 242.5)
    assert.strictEqual(Number(expPostRejectCheck[0].total_stock_value), 3031250.0)
    console.log("✅ [PASS] `export_products` parent stock correctly reduced to 242.50 Qtl (ETB 3,031,250.00).")

    // ── SUITE 5: Add New Pharma Product & Multi-Batch in WH2 ────────────────
    console.log("\n--- SUITE 5: Add New Pharma Medicine & Relational Batches in WH2 ---")
    const pharmaProductPayload = {
      id: testPharmaProdId,
      sku: "PHM-AMX-500",
      name: "Amoxicillin Trihydrate 500mg",
      generic_name: "Amoxicillin",
      category: "Antibiotics",
      sub_category: "Penicillins",
      warehouse_id: "WH2",
      dosage_form: "Bolus",
      strength: "500mg",
      shelf_number: "SH-B2-14",
      storage_condition: "Dry Storage (<25°C)",
      unit: "Box",
      quantity_per_pack: 10,
      number_of_cartons: 50,
      quantity: 500.0,
      quantity_sold: 0.0,
      total_quantity: 500.0,
      unit_cost: 380.0,
      selling_price: 490.0,
      total_stock_value: 190000.0,
      status: "In Stock",
    }

    await conn.query(
      `
      INSERT INTO pharma_products (
        id, sku, name, generic_name, category, sub_category, warehouse_id, dosage_form,
        strength, shelf_number, storage_condition, unit, quantity_per_pack, number_of_cartons,
        quantity, quantity_sold, total_quantity, unit_cost, selling_price, total_stock_value, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        pharmaProductPayload.id,
        pharmaProductPayload.sku,
        pharmaProductPayload.name,
        pharmaProductPayload.generic_name,
        pharmaProductPayload.category,
        pharmaProductPayload.sub_category,
        pharmaProductPayload.warehouse_id,
        pharmaProductPayload.dosage_form,
        pharmaProductPayload.strength,
        pharmaProductPayload.shelf_number,
        pharmaProductPayload.storage_condition,
        pharmaProductPayload.unit,
        pharmaProductPayload.quantity_per_pack,
        pharmaProductPayload.number_of_cartons,
        pharmaProductPayload.quantity,
        pharmaProductPayload.quantity_sold,
        pharmaProductPayload.total_quantity,
        pharmaProductPayload.unit_cost,
        pharmaProductPayload.selling_price,
        pharmaProductPayload.total_stock_value,
        pharmaProductPayload.status,
      ]
    )

    // Insert child batch into pharma_product_batches
    await conn.query(
      `
      INSERT INTO pharma_product_batches (
        id, product_id, warehouse_id, batch_no, mfg_date, expiry_date, quantity, unit_cost, qa_status, location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        testBatchId,
        testPharmaProdId,
        "WH2",
        "AMX-2026-LOT1",
        "2026-03-01",
        "2028-11-30",
        500.0,
        380.0,
        "Released",
        "Shelf B2 Row 14",
      ]
    )

    const [pharmaCheck] = await conn.query("SELECT * FROM pharma_products WHERE id = ?", [testPharmaProdId])
    assert.strictEqual(pharmaCheck.length, 1)
    assert.strictEqual(pharmaCheck[0].name, "Amoxicillin Trihydrate 500mg")
    assert.strictEqual(pharmaCheck[0].warehouse_id, "WH2")
    console.log("✅ [PASS] New pharma medicine saved to `pharma_products` table.")

    const [batchCheck] = await conn.query("SELECT * FROM pharma_product_batches WHERE id = ?", [testBatchId])
    assert.strictEqual(batchCheck.length, 1)
    assert.strictEqual(batchCheck[0].batch_no, "AMX-2026-LOT1")
    assert.strictEqual(batchCheck[0].expiry_date, "2028-11-30")
    console.log("✅ [PASS] Batch saved to relational `pharma_product_batches` table.")

    // ── SUITE 6: Join Query & Aggregations ──────────────────────────────────
    console.log("\n--- SUITE 6: Relational JOIN Queries & Verification ---")
    const [joinedExp] = await conn.query(
      `
      SELECT p.name, p.warehouse_id, m.movement_type, m.voucher_no, m.gross_quantity, m.reject_quantity
      FROM export_products p
      JOIN export_warehouse_movements m ON p.id = m.product_id
      WHERE p.id = ?
      ORDER BY m.created_at ASC
    `,
      [testExportProdId]
    )
    assert.strictEqual(joinedExp.length, 2, "Should return both inbound and reject movements")
    console.log(`✅ [PASS] Relational JOIN between \`export_products\` and \`export_warehouse_movements\` returned ${joinedExp.length} movements.`)

    const [joinedPharma] = await conn.query(
      `
      SELECT p.name, p.warehouse_id, b.batch_no, b.expiry_date, b.quantity
      FROM pharma_products p
      JOIN pharma_product_batches b ON p.id = b.product_id
      WHERE p.id = ?
    `,
      [testPharmaProdId]
    )
    assert.strictEqual(joinedPharma.length, 1, "Should return child batch")
    console.log(`✅ [PASS] Relational JOIN between \`pharma_products\` and \`pharma_product_batches\` returned batch ${joinedPharma[0].batch_no}.`)

    console.log("\n==================================================================")
    console.log("   ALL END-TO-END SUITES PASSED WITH 100% SUCCESS RATE!          ")
    console.log("==================================================================")
  } finally {
    // Clean up test records
    console.log("\n🧹 Cleaning up test records from database...")
    await conn.query("DELETE FROM export_warehouse_movements WHERE id IN (?, ?)", [testMovementId1, testMovementId2])
    await conn.query("DELETE FROM export_products WHERE id = ?", [testExportProdId])
    await conn.query("DELETE FROM pharma_product_batches WHERE id = ?", [testBatchId])
    await conn.query("DELETE FROM pharma_products WHERE id = ?", [testPharmaProdId])
    conn.release()
    console.log("✅ Database cleaned up cleanly.")
  }
}

runEndToEndTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err)
    process.exit(1)
  })
