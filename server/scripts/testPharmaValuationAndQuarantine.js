import { pool } from "../db/client.js"
import {
  createSalesIssue,
  postSalesIssue,
  getAvailableBatches,
} from "../modules/sales/salesIssues.js"
import { createQuarantineRecord } from "../modules/inventory/quarantineLogic.js"
import { drizzleCreateRow } from "../db/drizzleCrud.js"
import { getResource } from "../db/resourceRegistry.js"

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`  ✓ ${message}`)
}

async function runTests() {
  console.log("=== STARTING PHARMA VALUATION & QUARANTINE INTEGRATION TESTS ===\n")

  // Ensure test customer exists
  const testCustId = "CUST-TEST-PHARMA-QA"
  await drizzleCreateRow({
    resource: getResource("customers"),
    body: {
      id: testCustId,
      name: "St. Paul Hospital Pharmacy",
      phone: "+251911999888",
      email: "stpaul@pharmacy.et",
      is_active: 1,
      status: "Active",
    },
  }).catch(() => {})

  // =========================================================================
  // TEST 1: Cross-Batch FIFO Sales Issue COGS Unit Cost Calculation
  // =========================================================================
  console.log("--- TEST 1: Cross-Batch FIFO Sales Issue COGS Unit Cost ---")
  const prodId = `PROD-PH-MULTI-${Date.now()}`
  const b1Id = `BAT-A-${Date.now()}`
  const b2Id = `BAT-B-${Date.now()}`

  // Product with 2 batches:
  // Batch A: 30 qty @ ETB 10.00 = ETB 300.00
  // Batch B: 50 qty @ ETB 20.00 = ETB 1,000.00
  // Total Initial Stock: 80 qty, Total Value: ETB 1,300.00
  await drizzleCreateRow({
    resource: getResource("pharma_products"),
    body: {
      id: prodId,
      name: "Ciprofloxacin 500mg Tablets",
      category: "Antibiotics",
      warehouse_id: "WH2",
      quantity: 80,
      total_quantity: 80,
      unit_cost: 16.25,
      total_stock_value: 1300,
      selling_price: 35.0,
      unit: "Box",
      status: "In Stock",
    },
  })

  await pool.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [prodId])
  await pool.query("DELETE FROM stock_movements WHERE product_id = ?", [prodId])

  await drizzleCreateRow({
    resource: getResource("pharma_product_batches"),
    body: {
      id: b1Id,
      product_id: prodId,
      warehouse_id: "WH2",
      batch_no: "CIPRO-BATCH-001",
      quantity: 30,
      unit_cost: 10.0,
      qa_status: "Released",
      expiry_date: "2027-06-30",
      mfg_date: "2025-06-01",
    },
  })

  await drizzleCreateRow({
    resource: getResource("pharma_product_batches"),
    body: {
      id: b2Id,
      product_id: prodId,
      warehouse_id: "WH2",
      batch_no: "CIPRO-BATCH-002",
      quantity: 50,
      unit_cost: 20.0,
      qa_status: "Released",
      expiry_date: "2027-12-31",
      mfg_date: "2025-12-01",
    },
  })

  // Issue 50 qty across batches:
  // 30 from Batch A (@ 10.00 = 300) + 20 from Batch B (@ 20.00 = 400)
  // Total COGS = 700 ETB for 50 qty => leave weighted COGS unit cost = 700 / 50 = 14.00 ETB
  // Commercial selling price = 35.00 ETB
  const issueRes = await createSalesIssue({
    warehouse_id: "WH2",
    customer_id: testCustId,
    customer_name: "St. Paul Hospital Pharmacy",
    sale_date: "2026-09-15",
    payment_type: "credit",
    items: [
      {
        product_id: prodId,
        item_id: prodId,
        item_name: "Ciprofloxacin 500mg Tablets",
        batch_no: "CIPRO-BATCH-001",
        quantity: 50,
        unit_price: 35.0,
        selling_price: 35.0,
        unit_cost: 16.25,
      },
    ],
  })

  if (issueRes.status >= 400) {
    console.error("createSalesIssue failed with:", issueRes)
  }
  assert(issueRes.status === 200 || issueRes.status === 201, "Sales issue created successfully")
  const issueId = issueRes.body.id

  const postRes = await postSalesIssue(issueId)
  assert(postRes.status === 200, "Sales issue posted successfully")

  // Verify stock movements
  const [movRows] = await pool.query(
    "SELECT * FROM stock_movements WHERE product_id = ? AND movement_type = 'ISSUE'",
    [prodId]
  )
  assert(movRows.length === 1, "One ISSUE movement recorded in stock_movements")
  const mov = movRows[0]
  assert(Number(mov.quantity) === 50, "Movement quantity is 50")
  assert(Number(mov.unit_cost) === 14.0, `COGS unit cost is exactly 14.00 ETB (got ${mov.unit_cost})`)
  assert(Number(mov.selling_price) === 35.0, `Selling price recorded as 35.00 ETB (got ${mov.selling_price})`)
  assert(Number(mov.balance_after) === 30, `Balance after is 30 (got ${mov.balance_after})`)
  assert(mov.batch_no.includes("CIPRO-BATCH-001") && mov.batch_no.includes("CIPRO-BATCH-002"), "Multi-batch numbers recorded in movement")

  // Verify remaining batches
  const [remB1] = await pool.query("SELECT * FROM pharma_product_batches WHERE id = ?", [b1Id])
  const [remB2] = await pool.query("SELECT * FROM pharma_product_batches WHERE id = ?", [b2Id])
  assert(Number(remB1[0].quantity) === 0, "Batch A exhausted to 0")
  assert(Number(remB2[0].quantity) === 30, "Batch B reduced to 30")

  // Verify parent product
  const [parentRows] = await pool.query("SELECT * FROM pharma_products WHERE id = ?", [prodId])
  const parent = parentRows[0]
  assert(Number(parent.quantity) === 30, `Parent quantity is 30 (got ${parent.quantity})`)
  assert(Number(parent.total_stock_value) === 600, `Parent total_stock_value is 600 ETB (got ${parent.total_stock_value})`)
  assert(Number(parent.unit_cost) === 20.0, `Parent weighted unit_cost updated to 20.00 ETB (got ${parent.unit_cost})`)
  console.log("  ✓ Test 1 Passed!\n")

  // =========================================================================
  // TEST 2: Quarantine Record Addition & Stock Valuation Deduction
  // =========================================================================
  console.log("--- TEST 2: Quarantine Record Addition & Stock Valuation Deduction ---")
  // Quarantine 10 units from Batch B (30 available @ 20.00 ETB)
  const qrnRes = await createQuarantineRecord({
    productId: prodId,
    warehouseId: "WH2",
    batchNo: "CIPRO-BATCH-002",
    quantity: 10,
    nameEntered: "Dr. QA Inspector",
    quarantineDate: "2026-09-15",
    proposedReleaseDate: "2026-10-15",
    reason: "Moisture seal breakage test",
  })

  assert(qrnRes.status === 201, "Quarantine record created successfully")
  const qrnRecord = qrnRes.body
  assert(qrnRecord.status === "Quarantined", "Quarantine status is 'Quarantined'")

  // Verify batch B in MySQL reduced from 30 to 20
  const [b2AfterQrn] = await pool.query("SELECT * FROM pharma_product_batches WHERE id = ?", [b2Id])
  assert(Number(b2AfterQrn[0].quantity) === 20, `Batch B quantity reduced to 20 (got ${b2AfterQrn[0].quantity})`)

  // Verify parent product in MySQL reduced available quantity to 20 and valuation to 400 ETB
  const [parentAfterQrn] = await pool.query("SELECT * FROM pharma_products WHERE id = ?", [prodId])
  assert(Number(parentAfterQrn[0].quantity) === 20, `Parent quantity deducted to 20 (got ${parentAfterQrn[0].quantity})`)
  assert(Number(parentAfterQrn[0].total_stock_value) === 400, `Parent stock value deducted to 400 ETB (got ${parentAfterQrn[0].total_stock_value})`)

  // Verify stock_movements has a QUARANTINE record
  const [qrnMovs] = await pool.query("SELECT * FROM stock_movements WHERE product_id = ? AND movement_type = 'QUARANTINE'", [prodId])
  assert(qrnMovs.length === 1, "QUARANTINE movement logged in stock_movements")
  assert(Number(qrnMovs[0].quantity) === 10, "QUARANTINE movement qty is 10")
  assert(Number(qrnMovs[0].balance_after) === 20, "QUARANTINE movement balance after is 20")

  // Verify getAvailableBatches excludes quarantined items
  const availRes = await getAvailableBatches({ productId: prodId })
  assert(availRes.status === 200, "getAvailableBatches returned 200")
  const availBatches = availRes.body
  assert(availBatches.length === 1, "Only Batch B with available quantity returned")
  assert(Number(availBatches[0].available_quantity) === 20, `Available batch quantity is 20 (got ${availBatches[0].available_quantity})`)

  console.log("  ✓ Test 2 Passed!\n")

  // Cleanup test data
  await pool.query("DELETE FROM quarantine_records WHERE product_id = ?", [prodId])
  await pool.query("DELETE FROM stock_movements WHERE product_id = ?", [prodId])
  await pool.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [prodId])
  await pool.query("DELETE FROM pharma_products WHERE id = ?", [prodId])
  await pool.query("DELETE FROM sales_issues WHERE customer_id = ?", [testCustId])
  await pool.query("DELETE FROM customers WHERE id = ?", [testCustId])

  console.log("=== ALL PHARMA VALUATION & QUARANTINE TESTS PASSED PERFECTLY! ===")
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err)
    process.exit(1)
  })
