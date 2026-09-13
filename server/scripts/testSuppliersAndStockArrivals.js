import { pool } from "../db/client.js"

async function runSupplierAndStockArrivalTests() {
  console.log("================================================================")
  console.log("   HKC-ERP v5: SUPPLIERS & STOCK ARRIVALS VERIFICATION TESTS   ")
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
    // --- 1. Verify Suppliers Table Schema & Baseline Records ---
    console.log("\n--- TEST SUITE 1: Suppliers Registry Table & Schema ---")
    const [tables] = await conn.query("SHOW TABLES LIKE 'suppliers'")
    assert(tables.length === 1, "Dedicated 'suppliers' table exists in MySQL database")

    const testSuppId = `SUP-TEST-${Date.now()}`
    const testSupplierPayload = {
      id: testSuppId,
      name: "Oromia High-Grade Coffee Farmers Cooperative",
      city: "Jimma / Oromia",
      contactPerson: "Ato Dawit Mengistu",
      phone: "+251 91 145 6789",
      email: "dawit@oromiacoffee.et",
      address: "Gomma Woreda, Agaro Union Depot 3",
      taxId: "0098765432",
      country: "Ethiopia",
      category: "Agricultural Producer / Union",
      warehouseTarget: "WH1",
      status: "Active"
    }

    // Insert new supplier record
    await conn.query(
      "INSERT INTO suppliers (id, payload, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()",
      [testSuppId, JSON.stringify(testSupplierPayload)]
    )

    const [suppRows] = await conn.query("SELECT id, payload FROM suppliers WHERE id = ?", [testSuppId])
    assert(suppRows.length === 1, "Supplier persisted successfully into MySQL database")

    const savedSupp = typeof suppRows[0].payload === "string" ? JSON.parse(suppRows[0].payload) : suppRows[0].payload
    assert(savedSupp.name === testSupplierPayload.name, "Supplier name matches exactly")
    assert(savedSupp.phone.startsWith("+251"), "Supplier phone conforms to domestic +251 format", savedSupp.phone)
    assert(savedSupp.tradePaperUrl === undefined, "Supplier does not have mandatory trade license attachment")
    assert(savedSupp.taxId === "0098765432", "Tax ID / TIN stored properly")

    // --- 2. Update Supplier Details ---
    console.log("\n--- TEST SUITE 2: Supplier Profile Update & Mutation ---")
    const updatedPayload = {
      ...savedSupp,
      contactPerson: "W/ro Tigist Abera",
      phone: "+251 92 345 6789",
      city: "Sidama Regional Depot",
    }
    await conn.query("UPDATE suppliers SET payload = ?, updated_at = NOW() WHERE id = ?", [
      JSON.stringify(updatedPayload),
      testSuppId
    ])

    const [updatedRows] = await conn.query("SELECT id, payload FROM suppliers WHERE id = ?", [testSuppId])
    const updatedSupp = typeof updatedRows[0].payload === "string" ? JSON.parse(updatedRows[0].payload) : updatedRows[0].payload
    assert(updatedSupp.contactPerson === "W/ro Tigist Abera", "Supplier contact person updated successfully")
    assert(updatedSupp.phone === "+251 92 345 6789", "Supplier phone updated successfully")

    // --- 3. Stock Arrival Integration & Auto-Save Simulation ---
    console.log("\n--- TEST SUITE 3: Stock Arrival Integration & Auto-Save ---")
    const autoSavedSuppId = `SUPP-${Date.now().toString().slice(-4)}`
    const autoSavedSupplier = {
      id: autoSavedSuppId,
      name: "Abyssinia Premium Sesame Exporters",
      country: "Ethiopia",
      city: "Gondar / Amhara",
      contactPerson: "Ato Melaku Tessema",
      phone: "+251 93 555 1234",
      status: "Active"
    }

    // Auto-save supplier to registry
    await conn.query(
      "INSERT INTO suppliers (id, payload, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      [autoSavedSuppId, JSON.stringify(autoSavedSupplier)]
    )

    // Verify stock product entry can reference this supplier
    const stockProductId = `P-TEST-SESAME-${Date.now()}`
    const stockProductPayload = {
      id: stockProductId,
      name: "Sesame Seeds Humera Grade 1",
      sku: "SES-WH1-TEST",
      customer: autoSavedSupplier.name,
      voucherNo: "GRV-9871",
      plateNumber: "ET-3-88741",
      warehouse: "WH1",
      quantity: 500,
      totalQuantity: 500,
      unit: "Quintal",
      unitCost: 14500,
      totalStockValue: 7250000,
      wh1Entries: [
        {
          entryId: `WH1E-${Date.now()}`,
          voucherNo: "GRV-9871",
          customer: autoSavedSupplier.name,
          plateNumber: "ET-3-88741",
          entryDate: new Date().toISOString().slice(0, 10),
          quantityReceived: 500,
          quantityRemaining: 500,
          unitPrice: 14500,
          notes: "Initial harvest delivery from Humera union"
        }
      ]
    }

    await conn.query(
      `INSERT INTO inventory_products 
       (id, sku, name, product_type, warehouse_id, unit, quantity, total_quantity, unit_cost, total_stock_value, supplier_id, supplier_name, wh1_entries, created_at, updated_at) 
       VALUES (?, ?, ?, 'EXPORT_COMMODITY', 'WH1', 'Quintal', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        stockProductId,
        stockProductPayload.sku,
        stockProductPayload.name,
        stockProductPayload.quantity,
        stockProductPayload.totalQuantity,
        stockProductPayload.unitCost,
        stockProductPayload.totalStockValue,
        autoSavedSupplier.id,
        autoSavedSupplier.name,
        JSON.stringify(stockProductPayload.wh1Entries)
      ]
    )

    const [prodRows] = await conn.query("SELECT id, name, supplier_name, wh1_entries FROM inventory_products WHERE id = ?", [stockProductId])
    assert(prodRows.length === 1, "Stock product with supplier linkage persisted successfully")

    const savedWh1Entries = typeof prodRows[0].wh1_entries === "string" ? JSON.parse(prodRows[0].wh1_entries) : prodRows[0].wh1_entries
    assert(prodRows[0].supplier_name === "Abyssinia Premium Sesame Exporters", "Product supplier correctly referenced")
    assert(savedWh1Entries[0].customer === "Abyssinia Premium Sesame Exporters", "Sub-entry supplier correctly referenced")

    // --- 4. Cleanup Test Artifacts ---
    console.log("\n--- Cleanup ---")
    await conn.query("DELETE FROM suppliers WHERE id IN (?, ?)", [testSuppId, autoSavedSuppId])
    await conn.query("DELETE FROM inventory_products WHERE id = ?", [stockProductId])
    console.log("🧹 Cleaned up temporary test supplier and stock product records.")

  } catch (err) {
    console.error("Test execution encountered error:", err)
    failedTests++
  } finally {
    conn.release()
  }

  console.log("\n================================================================")
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
  console.log("================================================================")

  if (failedTests > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runSupplierAndStockArrivalTests()
