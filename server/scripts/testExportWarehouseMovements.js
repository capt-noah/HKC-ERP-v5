import { pool } from "../db/client.js"

async function runExportWarehouseMovementsTests() {
  console.log("================================================================")
  console.log("   HKC-ERP v5: EXPORT WAREHOUSE MOVEMENTS RELATIONAL TESTS      ")
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
    // 1. Verify table columns
    console.log("\n--- TEST SUITE 1: Table Structure & Index Verification ---")
    const [cols] = await conn.query("SHOW COLUMNS FROM export_warehouse_movements")
    const colNames = cols.map(c => c.Field)
    
    assert(colNames.includes("warehouse_id"), "Table has 'warehouse_id' column for facility scaling")
    assert(colNames.includes("product_id"), "Table has 'product_id' column")
    assert(colNames.includes("movement_type"), "Table has 'movement_type' column")
    assert(colNames.includes("gross_quantity"), "Table has 'gross_quantity' column")
    assert(colNames.includes("reject_quantity"), "Table has 'reject_quantity' column")
    assert(colNames.includes("net_quantity"), "Table has 'net_quantity' column")

    // 2. Insert test movements across different export warehouses
    console.log("\n--- TEST SUITE 2: Multi-Warehouse Movement Flow ---")
    const testWh1Movement = {
      id: "MOV-TEST-WH1-INBOUND",
      warehouse_id: "WH1",
      product_id: "prod-test-coffee-01",
      movement_type: "INBOUND_GRV",
      voucher_no: "GRV-2026-001",
      batch_no: "BATCH-SOY-01",
      party_name: "Yirgacheffe Coffee Union",
      plate_number: "ET-3-45892",
      gross_quantity: 120,
      reject_quantity: 5,
      net_quantity: 115,
      uom: "Quintal",
      unit_price: 6500,
      movement_date: "2026-09-08",
      reason: "Initial Harvest Inflow",
      created_by: "Test Officer"
    }

    const testWh4Movement = {
      id: "MOV-TEST-WH4-INBOUND",
      warehouse_id: "WH4-DIRE-EXP",
      product_id: "prod-test-harar-01",
      movement_type: "INBOUND_GRV",
      voucher_no: "GRV-DD-001",
      batch_no: "BATCH-HARAR-01",
      party_name: "Eastern Hararghe Union",
      plate_number: "ET-4-99120",
      gross_quantity: 200,
      reject_quantity: 8,
      net_quantity: 192,
      uom: "Quintal",
      unit_price: 7200,
      movement_date: "2026-09-08",
      reason: "Harar Hub Direct Intake",
      created_by: "Dire Dawa Officer"
    }

    await conn.query(
      `INSERT INTO export_warehouse_movements 
       (id, warehouse_id, product_id, movement_type, voucher_no, batch_no, party_name, plate_number, gross_quantity, reject_quantity, net_quantity, uom, unit_price, movement_date, reason, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [
        testWh1Movement.id, testWh1Movement.warehouse_id, testWh1Movement.product_id, testWh1Movement.movement_type,
        testWh1Movement.voucher_no, testWh1Movement.batch_no, testWh1Movement.party_name, testWh1Movement.plate_number,
        testWh1Movement.gross_quantity, testWh1Movement.reject_quantity, testWh1Movement.net_quantity,
        testWh1Movement.uom, testWh1Movement.unit_price, testWh1Movement.movement_date, testWh1Movement.reason, testWh1Movement.created_by
      ]
    )

    await conn.query(
      `INSERT INTO export_warehouse_movements 
       (id, warehouse_id, product_id, movement_type, voucher_no, batch_no, party_name, plate_number, gross_quantity, reject_quantity, net_quantity, uom, unit_price, movement_date, reason, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [
        testWh4Movement.id, testWh4Movement.warehouse_id, testWh4Movement.product_id, testWh4Movement.movement_type,
        testWh4Movement.voucher_no, testWh4Movement.batch_no, testWh4Movement.party_name, testWh4Movement.plate_number,
        testWh4Movement.gross_quantity, testWh4Movement.reject_quantity, testWh4Movement.net_quantity,
        testWh4Movement.uom, testWh4Movement.unit_price, testWh4Movement.movement_date, testWh4Movement.reason, testWh4Movement.created_by
      ]
    )

    // 3. Query movements isolated by warehouse_id
    const [wh1Rows] = await conn.query("SELECT * FROM export_warehouse_movements WHERE warehouse_id = 'WH1' AND id = ?", [testWh1Movement.id])
    assert(wh1Rows.length === 1, "WH1 movement retrieved by warehouse_id")
    assert(Number(wh1Rows[0].net_quantity) === 115, "WH1 net quantity matches exactly")
    assert(wh1Rows[0].party_name === "Yirgacheffe Coffee Union", "WH1 supplier party matches")

    const [wh4Rows] = await conn.query("SELECT * FROM export_warehouse_movements WHERE warehouse_id = 'WH4-DIRE-EXP' AND id = ?", [testWh4Movement.id])
    assert(wh4Rows.length === 1, "Custom export warehouse WH4-DIRE-EXP movement retrieved by warehouse_id")
    assert(Number(wh4Rows[0].net_quantity) === 192, "WH4 net quantity matches exactly")
    assert(wh4Rows[0].party_name === "Eastern Hararghe Union", "WH4 supplier party matches")

    // Clean up test records
    await conn.query("DELETE FROM export_warehouse_movements WHERE id IN (?, ?)", [testWh1Movement.id, testWh4Movement.id])
    console.log("\n🧹 Cleaned up test export warehouse movements.")

  } catch (e) {
    console.error("Test failure:", e)
    failedTests++
  } finally {
    conn.release()
  }

  console.log("\n================================================================")
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
  console.log("================================================================\n")

  if (failedTests > 0) process.exit(1)
}

runExportWarehouseMovementsTests().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
