import { pool } from "../db/client.js"
import { inventoryService } from "../modules/inventory/inventoryService.js"

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`  ✓ ${message}`)
}

async function testPharmaLifecycle() {
  console.log("==================================================================")
  console.log("=== RUNNING PHARMA WAREHOUSE LIFECYCLE & SORTING TEST ===")
  console.log("==================================================================\n")

  const testProdId = `PHM-TEST-${Date.now()}`

  try {
    // 1. Create a Pharma Product
    console.log("--- 1. CREATE PHARMA PRODUCT ---")
    const createRes = await inventoryService.createProduct({
      id: testProdId,
      name: "Amoxicillin 500mg Test",
      sku: `AMX-TEST-${Date.now().toString().slice(-4)}`,
      warehouse_id: "WH2",
      warehouse_type: "PHARMA_WH",
      quantity: 500,
      unit_cost: 15.00,
      selling_price: 25.00,
      batch_no: "AMX-BATCH-001",
      mfg_date: "2026-01-10",
      expiry_date: "2028-01-10",
      unit: "Box",
      supplier_name: "Addis Pharma Supply",
    })

    assert(createRes.status === 201, `Product created with status 201 (got ${createRes.status})`)
    const prod = createRes.body
    assert(prod.id === testProdId, `Product ID is ${testProdId}`)
    assert(Number(prod.quantity) === 500, `Product quantity is 500 (got ${prod.quantity})`)
    assert(Number(prod.unit_cost || prod.unitCost) === 15.00, `Unit cost is 15.00`)
    assert(Number(prod.selling_price || prod.sellingPrice) === 25.00, `Selling price is 25.00`)
    assert(Array.isArray(prod.batches) && prod.batches.length === 1, `1 initial batch returned`)
    assert(Array.isArray(prod.binCardEntries) && prod.binCardEntries.length === 1, `1 initial binCardEntry returned`)

    const initBin = prod.binCardEntries[0]
    assert(initBin.type === "entry", `Initial bin entry type is 'entry' (got ${initBin.type})`)
    assert(Number(initBin.qtyReceived) === 500, `Initial bin entry qtyReceived is 500 (got ${initBin.qtyReceived})`)
    assert(Number(initBin.qtyIssued) === 0, `Initial bin entry qtyIssued is 0 (got ${initBin.qtyIssued})`)
    assert(initBin.mfgDate === "2026-01-10" || initBin.mfg_date === "2026-01-10", `Initial bin entry mfgDate preserved (got ${initBin.mfgDate})`)

    // 2. Add Stock Movement (+Received: 300 boxes)
    console.log("\n--- 2. ADD STOCK RECEIPT (+RECEIVED) ---")
    const receiptMovId = `MOV-REC-${Date.now()}`
    const recRes = await inventoryService.recordMovement({
      id: receiptMovId,
      product_id: testProdId,
      warehouse_id: "WH2",
      movement_type: "RECEIPT",
      quantity: 300,
      unit_cost: 16.00,
      unit_price: 16.00,
      selling_price: 26.00,
      batch_no: "AMX-BATCH-002",
      mfg_date: "2026-02-15",
      expiry_date: "2028-02-15",
      reference_type: "STOCK_RECEIPT",
      reference_id: "GRN-2026-09",
      notes: "Additional Batch Arrival",
      party: "MedTech Imports",
      movement_date: "2026-02-20",
    }, "stock_movements")

    assert(recRes.status === 201, `Stock receipt recorded with status 201`)
    const recMov = recRes.body
    assert(recMov.type === "entry", `Receipt movement unwrapped type is 'entry' (got ${recMov.type})`)
    assert(Number(recMov.qtyReceived) === 300, `Receipt movement qtyReceived is 300 (got ${recMov.qtyReceived})`)
    assert(Number(recMov.qtyIssued) === 0, `Receipt movement qtyIssued is 0 (got ${recMov.qtyIssued})`)
    assert(recMov.party === "MedTech Imports", `Receipt party preserved (got ${recMov.party})`)
    assert(recMov.mfgDate === "2026-02-15", `Receipt mfgDate preserved (got ${recMov.mfgDate})`)

    // 3. Add Stock Movement (-Issued: 150 boxes)
    console.log("\n--- 3. ADD STOCK DISPATCH (-ISSUED) WITH SELLING PRICE ---")
    const issueMovId = `MOV-ISS-${Date.now()}`
    const issueRes = await inventoryService.recordMovement({
      id: issueMovId,
      product_id: testProdId,
      warehouse_id: "WH2",
      movement_type: "ISSUE",
      quantity: 150,
      unit_cost: 15.00,
      unit_price: 30.00,
      selling_price: 30.00,
      batch_no: "AMX-BATCH-001",
      mfg_date: "2026-01-10",
      expiry_date: "2028-01-10",
      reference_type: "STOCK_ISSUE",
      reference_id: "DISP-2026-04",
      notes: "Hospital Outbound Dispatch",
      party: "St. Paul Hospital",
      movement_date: "2026-03-01",
    }, "stock_movements")

    assert(issueRes.status === 201, `Stock issue recorded with status 201`)
    const issMov = issueRes.body
    assert(issMov.type === "leave", `Issue movement unwrapped type is 'leave' (got ${issMov.type})`)
    assert(Number(issMov.qtyIssued) === 150, `Issue movement qtyIssued is 150 (got ${issMov.qtyIssued})`)
    assert(Number(issMov.qtyReceived) === 0, `Issue movement qtyReceived is 0 (got ${issMov.qtyReceived})`)
    assert(Number(issMov.sellingPrice || issMov.selling_price) === 30.00, `Selling price recorded as 30.00 (got ${issMov.sellingPrice})`)
    assert(issMov.party === "St. Paul Hospital", `Issue customer party preserved (got ${issMov.party})`)

    // 4. Fetch Product and Verify Hydrated Child Movements & Chronology
    console.log("\n--- 4. VERIFY HYDRATED MOVEMENTS & CHRONOLOGY ---")
    const getRes = await inventoryService.getProduct(testProdId)
    assert(getRes.status === 200, `Get product returned status 200`)
    const hydratedProd = getRes.body
    const entries = hydratedProd.binCardEntries || []
    assert(entries.length === 3, `Product has 3 bin card movements (got ${entries.length})`)

    // Sort chronologically ascending
    const sorted = [...entries].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime()
      const timeB = new Date(b.createdAt || b.date).getTime()
      return timeA - timeB
    })

    assert(sorted[0].type === "entry", `1st transaction is entry (Initial)`)
    assert(sorted[1].type === "entry", `2nd transaction is entry (Additional arrival)`)
    assert(sorted[2].type === "leave", `3rd transaction is leave (Hospital dispatch)`)

    // Verify running balances: 500 + 300 - 150 = 650
    let running = 0
    const withBal = sorted.map((e) => {
      running += Number(e.qtyReceived || 0) - Number(e.qtyIssued || 0)
      return { ...e, calculatedBalance: running }
    })
    assert(withBal[0].calculatedBalance === 500, `Balance after 1st: 500`)
    assert(withBal[1].calculatedBalance === 800, `Balance after 2nd: 800`)
    assert(withBal[2].calculatedBalance === 650, `Balance after 3rd: 650`)

    // 5. Verify Total Invoiced Sales Calculation
    const totalInvoicedSales = sorted
      .filter((e) => e.type === "leave" && e.sellingPrice && Number(e.sellingPrice) > 0)
      .reduce((sum, e) => sum + (Number(e.qtyIssued || 0) * Number(e.sellingPrice || 0)), 0)
    assert(totalInvoicedSales === 150 * 30.00, `Total invoiced sales = 150 * 30.00 = 4,500.00 (got ${totalInvoicedSales})`)

    console.log("\n==================================================================")
    console.log("=== ALL PHARMA LIFECYCLE TESTS PASSED SUCCESSFULLY! ===")
    console.log("==================================================================")
  } finally {
    // Clean up test data
    await pool.query("DELETE FROM stock_movements WHERE product_id = ?", [testProdId])
    await pool.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [testProdId])
    await pool.query("DELETE FROM pharma_products WHERE id = ?", [testProdId])
    console.log("\nCleaned up test records.")
  }
}

testPharmaLifecycle()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err)
    process.exit(1)
  })
