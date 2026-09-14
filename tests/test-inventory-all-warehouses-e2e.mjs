import assert from "node:assert/strict"
import { pool } from "../server/db/client.js"
import { invalidateWarehouseCache, resolveWarehouseType, isExportWarehouse, isPharmaWarehouse } from "../server/utils/warehouseUtils.js"

const BASE_URL = process.env.API_BASE_URL || "http://localhost:1000"

console.log("=================================================================")
console.log("🚀 STARTING E2E INVENTORY TEST SUITE: ALL WAREHOUSE TYPES & CRUD")
console.log("=================================================================\n")

let passed = 0
let total = 0
let authToken = ""

async function test(name, fn) {
  total++
  try {
    await fn()
    console.log(`  ✅ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message)
    if (err.stack) console.error(err.stack)
  }
}

async function apiRequest(endpoint, { method = "GET", body, token = authToken } = {}) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${endpoint}`, options)
  const contentType = res.headers.get("content-type") || ""
  let data = null
  if (contentType.includes("application/json")) {
    data = await res.json()
  } else {
    data = await res.text()
  }
  return { status: res.status, ok: res.ok, data }
}

async function run() {
  // ── STEP 0: Authentication Setup ──
  console.log("--- STEP 0: Authentication Setup ---")
  await test("Authenticate as Superadmin and obtain JWT Bearer Token", async () => {
    const res = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { username: "admin", password: "SuperadminPassword1!" },
    })
    assert.equal(res.status, 200, `Login failed: ${JSON.stringify(res.data)}`)
    assert.ok(res.data.token, "Token must be present in login response")
    authToken = res.data.token
  })

  // ── STEP 1: Dynamic Warehouse Scalability Setup ──
  console.log("\n--- STEP 1: Dynamic Warehouse Scalability & Type Resolution ---")
  const TEST_EXPORT_WH_ID = "WH-TEST-AGRI-EXP"
  const TEST_PHARMA_WH_ID = "WH-TEST-VET-PHM"

  await test("Seed temporary dynamic warehouses directly in MySQL", async () => {
    await pool.query(
      `INSERT INTO warehouses (id, code, name, warehouse_type, type, location, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE warehouse_type = VALUES(warehouse_type), name = VALUES(name)`,
      [TEST_EXPORT_WH_ID, "WH-TEST-AGRI", "Dire Dawa Dynamic Export Terminal", "EXPORT_WH", "Export Hub", "Dire Dawa, Ethiopia"]
    )

    await pool.query(
      `INSERT INTO warehouses (id, code, name, warehouse_type, type, location, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE warehouse_type = VALUES(warehouse_type), name = VALUES(name)`,
      [TEST_PHARMA_WH_ID, "WH-TEST-PHM", "Hawassa Dynamic Veterinary Hub", "PHARMA_WH", "Regional Depot", "Hawassa, Ethiopia"]
    )

    // Invalidate in-memory cache to force re-fetch from database
    invalidateWarehouseCache()

    const exportType = await resolveWarehouseType(TEST_EXPORT_WH_ID)
    assert.equal(exportType, "EXPORT_WH", "Dynamic export warehouse should resolve to EXPORT_WH")
    const isExport = await isExportWarehouse(TEST_EXPORT_WH_ID)
    assert.equal(isExport, true, "isExportWarehouse should return true for dynamic export warehouse")

    const pharmaType = await resolveWarehouseType(TEST_PHARMA_WH_ID)
    assert.equal(pharmaType, "PHARMA_WH", "Dynamic pharma warehouse should resolve to PHARMA_WH")
    const isPharma = await isPharmaWarehouse(TEST_PHARMA_WH_ID)
    assert.equal(isPharma, true, "isPharmaWarehouse should return true for dynamic pharma warehouse")
  })

  // ── STEP 2: Product CRUD & Error Handling ──
  console.log("\n--- STEP 2: Product Endpoints (POST, GET, PATCH, DELETE) & Error Validation ---")
  let createdPharmaProdId = ""
  let createdExportProdId = ""

  await test("POST /api/inventory/products: Validation Rejections (Missing Name)", async () => {
    const res = await apiRequest("/api/inventory/products", {
      method: "POST",
      body: { warehouse_id: TEST_PHARMA_WH_ID, quantity: 100, unit_cost: 50 },
    })
    assert.equal(res.status, 400, "Should reject missing product name with 400")
  })

  await test("POST /api/inventory/products: Validation Rejections (Missing Warehouse ID)", async () => {
    const res = await apiRequest("/api/inventory/products", {
      method: "POST",
      body: { name: "Test Drug Without WH", quantity: 100, unit_cost: 50 },
    })
    assert.equal(res.status, 400, "Should reject missing warehouse_id with 400")
  })

  await test("POST /api/inventory/products: Validation Rejections (Negative Quantity)", async () => {
    const res = await apiRequest("/api/inventory/products", {
      method: "POST",
      body: { name: "Negative Qty Drug", warehouse_id: TEST_PHARMA_WH_ID, quantity: -50, unit_cost: 50 },
    })
    assert.equal(res.status, 400, "Should reject negative quantity with 400")
  })

  await test("POST /api/inventory/products: Validation Rejections (Negative Unit Cost)", async () => {
    const res = await apiRequest("/api/inventory/products", {
      method: "POST",
      body: { name: "Negative Cost Drug", warehouse_id: TEST_PHARMA_WH_ID, quantity: 50, unit_cost: -10 },
    })
    assert.equal(res.status, 400, "Should reject negative unit cost with 400")
  })

  await test("POST /api/inventory/products: Create Pharma Product in Dynamic Pharma Warehouse", async () => {
    const res = await apiRequest("/api/inventory/products", {
      method: "POST",
      body: {
        name: "Amoxicillin Dynamic 500mg",
        generic_name: "Amoxicillin",
        category: "Veterinary Medicine",
        warehouse_id: TEST_PHARMA_WH_ID,
        batch_no: "AMX-DYNAMIC-01",
        mfg_date: "2026-01-10",
        expiry_date: "2028-01-10",
        unit: "Vial",
        quantity: 500,
        unit_cost: 120,
        selling_price: 150,
      },
    })
    assert.equal(res.status, 201, `Failed creating pharma product: ${JSON.stringify(res.data)}`)
    assert.ok(res.data.id, "Created product must have an ID")
    assert.equal(res.data.warehouse_id, TEST_PHARMA_WH_ID)
    assert.equal(res.data.isExport, false)
    assert.equal(res.data.batch_no, "AMX-DYNAMIC-01")
    assert.equal(res.data.total_stock_value, 500 * 120)
    createdPharmaProdId = res.data.id

    // Verify written to pharma_products in MySQL and NOT in export_products
    const [pharmaCheck] = await pool.query("SELECT * FROM pharma_products WHERE id = ?", [createdPharmaProdId])
    assert.equal(pharmaCheck.length, 1, "Must be recorded in pharma_products")
    const [exportCheck] = await pool.query("SELECT * FROM export_products WHERE id = ?", [createdPharmaProdId])
    assert.equal(exportCheck.length, 0, "Must NOT be in export_products")

    // Verify initial batch created in pharma_product_batches
    const [batchCheck] = await pool.query("SELECT * FROM pharma_product_batches WHERE product_id = ?", [createdPharmaProdId])
    assert.equal(batchCheck.length, 1, "Initial batch must be created in pharma_product_batches")
    assert.equal(batchCheck[0].batch_no || batchCheck[0].batch_number, "AMX-DYNAMIC-01")

    // Verify initial receipt movement logged in stock_movements
    const [moveCheck] = await pool.query("SELECT * FROM stock_movements WHERE product_id = ? AND movement_type = 'RECEIPT'", [createdPharmaProdId])
    assert.equal(moveCheck.length, 1, "Initial receipt movement must be logged")
    assert.equal(Number(moveCheck[0].quantity), 500)
    assert.equal(Number(moveCheck[0].unit_price), 120)
  })

  await test("POST /api/inventory/products: Create Export Commodity in Dynamic Export Warehouse", async () => {
    const res = await apiRequest("/api/inventory/products", {
      method: "POST",
      body: {
        name: "Grade 1 Washed Sidama Coffee",
        category: "Export Commodity",
        commodity_type: "Coffee",
        warehouse_id: TEST_EXPORT_WH_ID,
        grade: "Grade 1",
        bag_type: "Jute Bag (60kg)",
        unit: "Quintal",
        quantity: 200,
        unit_cost: 8500,
        selling_price: 9200,
        voucher_no: "GRV-EXP-9901",
        truck_plate: "3-ET-12345",
        driver_name: "Tadesse Bekele",
      },
    })
    assert.equal(res.status, 201, `Failed creating export commodity: ${JSON.stringify(res.data)}`)
    assert.ok(res.data.id, "Created commodity must have an ID")
    assert.equal(res.data.warehouse_id, TEST_EXPORT_WH_ID)
    assert.equal(res.data.isExport, true)
    createdExportProdId = res.data.id

    // Verify written to export_products in MySQL and NOT in pharma_products
    const [exportCheck] = await pool.query("SELECT * FROM export_products WHERE id = ?", [createdExportProdId])
    assert.equal(exportCheck.length, 1, "Must be recorded in export_products")
    const [pharmaCheck] = await pool.query("SELECT * FROM pharma_products WHERE id = ?", [createdExportProdId])
    assert.equal(pharmaCheck.length, 0, "Must NOT be in pharma_products")

    // Verify initial GRV movement created in export_warehouse_movements
    const [expMoveCheck] = await pool.query("SELECT * FROM export_warehouse_movements WHERE product_id = ? AND movement_type = 'GRV_ENTRY'", [createdExportProdId])
    assert.equal(expMoveCheck.length, 1, "Initial GRV entry must be recorded in export_warehouse_movements")
    assert.equal(Number(expMoveCheck[0].net_quantity), 200)
    assert.equal(expMoveCheck[0].plate_number, "3-ET-12345")
  })

  await test("GET /api/inventory/products: Filter by Warehouse dynamically", async () => {
    // 1. Filter by dynamic export warehouse
    const expRes = await apiRequest(`/api/inventory/products?warehouse=${TEST_EXPORT_WH_ID}`)
    assert.equal(expRes.status, 200)
    assert.ok(Array.isArray(expRes.data), "Result must be array")
    assert.ok(expRes.data.some(p => p.id === createdExportProdId), "Export product must be in results")
    assert.ok(!expRes.data.some(p => p.id === createdPharmaProdId), "Pharma product must NOT be in export results")

    // 2. Filter by dynamic pharma warehouse
    const phmRes = await apiRequest(`/api/inventory/products?warehouse=${TEST_PHARMA_WH_ID}`)
    assert.equal(phmRes.status, 200)
    assert.ok(Array.isArray(phmRes.data), "Result must be array")
    assert.ok(phmRes.data.some(p => p.id === createdPharmaProdId), "Pharma product must be in results")
    assert.ok(!phmRes.data.some(p => p.id === createdExportProdId), "Export product must NOT be in pharma results")
  })

  await test("GET /api/inventory/products/:id: Retrieve product details with nested relations", async () => {
    // 1. Pharma product
    const pharmaRes = await apiRequest(`/api/inventory/products/${createdPharmaProdId}`)
    assert.equal(pharmaRes.status, 200)
    assert.equal(pharmaRes.data.id, createdPharmaProdId)
    assert.ok(Array.isArray(pharmaRes.data.batches), "Pharma product must include batches array")
    assert.ok(pharmaRes.data.batches.length >= 1, "Must have at least 1 batch")
    assert.ok(Array.isArray(pharmaRes.data.binCardEntries), "Pharma product must include binCardEntries array")

    // 2. Export commodity
    const exportRes = await apiRequest(`/api/inventory/products/${createdExportProdId}`)
    assert.equal(exportRes.status, 200)
    assert.equal(exportRes.data.id, createdExportProdId)
    assert.ok(Array.isArray(exportRes.data.wh1Entries), "Export product must include wh1Entries array")
    assert.ok(exportRes.data.wh1Entries.length >= 1, "Must have at least 1 export movement entry")

    // 3. Non-existent ID returns 404
    const notFoundRes = await apiRequest("/api/inventory/products/NON_EXISTENT_ID_99999")
    assert.equal(notFoundRes.status, 404, "Non-existent product ID must return 404")
  })

  await test("PATCH /api/inventory/products/:id: Update unit_cost and verify cascade to batches & movements", async () => {
    // Update unit cost to 250 ETB
    const patchRes = await apiRequest(`/api/inventory/products/${createdPharmaProdId}`, {
      method: "PATCH",
      body: { unit_cost: 250, selling_price: 300, batch_no: "AMX-DYNAMIC-01-UPD", mfg_date: "2026-02-01", expiry_date: "2028-02-01" },
    })
    assert.equal(patchRes.status, 200, `PATCH failed: ${JSON.stringify(patchRes.data)}`)
    assert.equal(patchRes.data.unit_cost, 250)
    assert.equal(patchRes.data.total_stock_value, 500 * 250)

    // Verify batch unit_cost cascaded
    const [batchCheck] = await pool.query("SELECT * FROM pharma_product_batches WHERE product_id = ?", [createdPharmaProdId])
    assert.equal(Number(batchCheck[0].unit_cost), 250, "Batch unit_cost must cascade to 250")

    // Verify initial receipt movement unit_price cascaded
    const [moveCheck] = await pool.query("SELECT * FROM stock_movements WHERE product_id = ? AND movement_type = 'RECEIPT'", [createdPharmaProdId])
    assert.equal(Number(moveCheck[0].unit_price), 250, "Receipt movement unit_price must cascade to 250")
  })

  await test("PATCH /api/inventory/products/:id: Validation Rejection (Negative Price)", async () => {
    const res = await apiRequest(`/api/inventory/products/${createdPharmaProdId}`, {
      method: "PATCH",
      body: { unit_cost: -50 },
    })
    assert.equal(res.status, 400, "Should reject negative unit cost with 400")
  })

  // ── STEP 3: Batch Management & QA Transitions ──
  console.log("\n--- STEP 3: Batch Endpoints (POST, GET, PATCH, TRANSITION, DELETE) ---")
  let newBatchId = ""

  await test("POST /api/inventory/batches: Validation Rejections (Missing product_id)", async () => {
    const res = await apiRequest("/api/inventory/batches", {
      method: "POST",
      body: { batch_number: "BATCH-FAIL-01", quantity: 100 },
    })
    assert.equal(res.status, 400, "Should reject missing product_id with 400")
  })

  await test("POST /api/inventory/batches: Create Secondary Batch", async () => {
    const res = await apiRequest("/api/inventory/batches", {
      method: "POST",
      body: {
        product_id: createdPharmaProdId,
        batch_number: "AMX-DYNAMIC-02",
        manufacturing_date: "2026-03-01",
        expiry_date: "2029-03-01",
        quantity: 300,
        unit_cost: 250,
        location: "Shelf B-12",
        qa_status: "Released",
      },
    })
    assert.equal(res.status, 201, `Failed creating batch: ${JSON.stringify(res.data)}`)
    assert.ok(res.data.id, "Batch must have an ID")
    assert.equal(res.data.batch_number, "AMX-DYNAMIC-02")
    newBatchId = res.data.id
  })

  await test("GET /api/inventory/batches: List batches filtered by product_id and qa_status", async () => {
    const res = await apiRequest(`/api/inventory/batches?product_id=${createdPharmaProdId}`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data))
    assert.ok(res.data.some(b => b.id === newBatchId), "Created batch must be in results")
  })

  await test("POST /api/inventory/batches/:id/transition: Released -> Quarantined (Auto Movement)", async () => {
    const res = await apiRequest(`/api/inventory/batches/${newBatchId}/transition`, {
      method: "POST",
      body: {
        to_status: "Quarantined",
        reason: "Suspected temperature excursion during transit",
      },
    })
    assert.equal(res.status, 200, `Transition failed: ${JSON.stringify(res.data)}`)
    assert.equal(res.data.qa_status, "Quarantined")

    // Verify auto-logged quarantine movement in stock_movements
    const [qMoves] = await pool.query(
      "SELECT * FROM stock_movements WHERE reference_id = ? AND movement_type = 'QUARANTINE'",
      [newBatchId]
    )
    assert.equal(qMoves.length, 1, "Transition must automatically log QUARANTINE movement in stock_movements")
    assert.equal(qMoves[0].notes, "Suspected temperature excursion during transit")
  })

  await test("POST /api/inventory/batches/:id/transition: Quarantined -> Released (Auto Release Movement)", async () => {
    const res = await apiRequest(`/api/inventory/batches/${newBatchId}/transition`, {
      method: "POST",
      body: {
        to_status: "Released",
        reason: "Lab inspection passed — released back to available stock",
      },
    })
    assert.equal(res.status, 200)
    assert.equal(res.data.qa_status, "Released")

    // Verify auto-logged release movement
    const [relMoves] = await pool.query(
      "SELECT * FROM stock_movements WHERE reference_id = ? AND movement_type = 'RELEASE'",
      [newBatchId]
    )
    assert.equal(relMoves.length, 1, "Transition back to Released must log RELEASE movement")
  })

  await test("POST /api/inventory/batches/:id/transition: Validation Rejection (Invalid Status)", async () => {
    const res = await apiRequest(`/api/inventory/batches/${newBatchId}/transition`, {
      method: "POST",
      body: { to_status: "INVALID_STATUS_ABC" },
    })
    assert.equal(res.status, 400, "Should reject invalid qa_status with 400")
  })

  await test("DELETE /api/inventory/batches/:id: Delete secondary batch", async () => {
    const res = await apiRequest(`/api/inventory/batches/${newBatchId}`, { method: "DELETE" })
    assert.equal(res.status, 200)
    const [check] = await pool.query("SELECT * FROM pharma_product_batches WHERE id = ?", [newBatchId])
    assert.equal(check.length, 0, "Batch must be deleted from database")
  })

  // ── STEP 4: Pharma Movements CRUD ──
  console.log("\n--- STEP 4: Pharma Movement Endpoints (POST, GET, PATCH, DELETE) ---")
  let createdMoveId = ""

  await test("POST /api/inventory/movements: Record Quarantine Movement", async () => {
    const res = await apiRequest("/api/inventory/movements", {
      method: "POST",
      body: {
        product_id: createdPharmaProdId,
        movement_type: "QUARANTINE",
        quantity: 15,
        unit_price: 250,
        batch_number: "AMX-DYNAMIC-01-UPD",
        reference_type: "QUARANTINE_LOG",
        notes: "Initial quarantine: packaging compromised",
        reason: "Damaged vial seals",
      },
    })
    assert.equal(res.status, 201, `Failed logging movement: ${JSON.stringify(res.data)}`)
    assert.ok(res.data.id, "Movement must have ID")
    assert.equal(res.data.movement_type, "QUARANTINE")
    createdMoveId = res.data.id
  })

  await test("GET /api/inventory/movements: Query movements by product and type", async () => {
    const res = await apiRequest(`/api/inventory/movements?product_id=${createdPharmaProdId}&movement_type=QUARANTINE`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data))
    assert.ok(res.data.some(m => m.id === createdMoveId))
  })

  await test("PATCH /api/inventory/movements/:id: Update movement notes for multi-device sync", async () => {
    const res = await apiRequest(`/api/inventory/movements/${createdMoveId}`, {
      method: "PATCH",
      body: { notes: "Verified in Lab: Damaged bottle in Transit", reason: "Transport collision" },
    })
    assert.equal(res.status, 200)
    assert.equal(res.data.notes, "Verified in Lab: Damaged bottle in Transit")

    // Verify directly in MySQL
    const [check] = await pool.query("SELECT * FROM stock_movements WHERE id = ?", [createdMoveId])
    assert.equal(check[0].notes, "Verified in Lab: Damaged bottle in Transit")
  })

  await test("DELETE /api/inventory/movements/:id: Delete movement", async () => {
    const res = await apiRequest(`/api/inventory/movements/${createdMoveId}`, { method: "DELETE" })
    assert.equal(res.status, 200)
    const [check] = await pool.query("SELECT * FROM stock_movements WHERE id = ?", [createdMoveId])
    assert.equal(check.length, 0, "Movement must be deleted from database")
  })

  // ── STEP 5: Export Movements CRUD ──
  console.log("\n--- STEP 5: Export Movement Endpoints (POST, GET, PATCH, DELETE) ---")
  let createdExpMoveId = ""

  await test("POST /api/inventory/export-movements: Record Reject Deduction", async () => {
    const res = await apiRequest("/api/inventory/export-movements", {
      method: "POST",
      body: {
        commodity_id: createdExportProdId,
        movement_type: "REJECT_DEDUCTION",
        movement_direction: "OUTBOUND",
        quantity_bags: 10,
        net_weight_kg: 600,
        truck_plate: "3-ET-9988",
        driver_name: "Kebede Alemu",
        notes: "Moisture content exceeded threshold (14.2%)",
      },
    })
    assert.equal(res.status, 201, `Failed logging export movement: ${JSON.stringify(res.data)}`)
    assert.ok(res.data.id)
    assert.equal(res.data.movement_type, "REJECT_DEDUCTION")
    createdExpMoveId = res.data.id

    // Verify commodity net quantity updated (200 - 10 = 190)
    const [prodCheck] = await pool.query("SELECT quantity FROM export_products WHERE id = ?", [createdExportProdId])
    assert.equal(Number(prodCheck[0].quantity), 190, "Net quantity must be decremented by 10 bags")
  })

  await test("GET /api/inventory/export-movements: Retrieve export movements", async () => {
    const res = await apiRequest(`/api/inventory/export-movements?commodity_id=${createdExportProdId}`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data))
    assert.ok(res.data.some(m => m.id === createdExpMoveId))
  })

  await test("PATCH /api/inventory/export-movements/:id: Update export movement details", async () => {
    const res = await apiRequest(`/api/inventory/export-movements/${createdExpMoveId}`, {
      method: "PATCH",
      body: { notes: "Moisture re-test: 14.8% — rejected by Quality Inspector #4" },
    })
    assert.equal(res.status, 200)
    assert.equal(res.data.notes, "Moisture re-test: 14.8% — rejected by Quality Inspector #4")
  })

  await test("DELETE /api/inventory/export-movements/:id: Delete export movement and restore quantity", async () => {
    const res = await apiRequest(`/api/inventory/export-movements/${createdExpMoveId}`, { method: "DELETE" })
    assert.equal(res.status, 200)

    // Verify quantity restored from 190 back to 200
    const [prodCheck] = await pool.query("SELECT quantity FROM export_products WHERE id = ?", [createdExportProdId])
    assert.equal(Number(prodCheck[0].quantity), 200, "Commodity quantity must be restored to 200 bags")
  })

  // ── STEP 6: Store Transfers CRUD & Validation ──
  console.log("\n--- STEP 6: Store Transfers (POST, GET, PATCH, DELETE) & Error Validation ---")
  let createdTransferId = ""

  await test("POST /api/inventory/transfers: Validation Rejection (Same Source and Destination)", async () => {
    const res = await apiRequest("/api/inventory/transfers", {
      method: "POST",
      body: {
        from_warehouse: TEST_PHARMA_WH_ID,
        to_warehouse: TEST_PHARMA_WH_ID,
        items: [{ product_id: createdPharmaProdId, quantity: 10 }],
      },
    })
    assert.equal(res.status, 400, "Should reject same origin and destination with 400")
  })

  await test("POST /api/inventory/transfers: Validation Rejection (Empty Items)", async () => {
    const res = await apiRequest("/api/inventory/transfers", {
      method: "POST",
      body: {
        from_warehouse: "WH2",
        to_warehouse: TEST_PHARMA_WH_ID,
        items: [],
      },
    })
    assert.equal(res.status, 400, "Should reject empty items list with 400")
  })

  await test("POST /api/inventory/transfers: Create Transfer from WH2 to Dynamic Pharma Warehouse", async () => {
    const res = await apiRequest("/api/inventory/transfers", {
      method: "POST",
      body: {
        from_warehouse: "WH2",
        to_warehouse: TEST_PHARMA_WH_ID,
        transfer_date: "2026-09-14",
        status: "Draft",
        notes: "Inter-store transfer to Hawassa regional hub",
        items: [
          {
            product_id: createdPharmaProdId,
            item_name: "Amoxicillin Dynamic 500mg",
            batch_no: "AMX-DYNAMIC-01-UPD",
            quantity: 50,
            unit_price: 250,
          },
        ],
      },
    })
    assert.equal(res.status, 201, `Transfer creation failed: ${JSON.stringify(res.data)}`)
    assert.ok(res.data.id, "Transfer must have an ID")
    assert.equal(res.data.from_warehouse, "WH2")
    assert.equal(res.data.to_warehouse, TEST_PHARMA_WH_ID)
    createdTransferId = res.data.id

    // Verify nested items in store_transfer_items
    const [itemCheck] = await pool.query("SELECT * FROM store_transfer_items WHERE transfer_id = ?", [createdTransferId])
    assert.equal(itemCheck.length, 1, "Transfer item must be saved in store_transfer_items")
    assert.equal(Number(itemCheck[0].quantity), 50)
  })

  await test("GET /api/inventory/transfers: List transfers with line items", async () => {
    const res = await apiRequest("/api/inventory/transfers")
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data))
    const matched = res.data.find(t => t.id === createdTransferId)
    assert.ok(matched, "Created transfer must exist in transfers list")
    assert.ok(Array.isArray(matched.line_items || matched.items), "Must have line_items array")
  })

  await test("PATCH /api/inventory/transfers/:id: Lifecycle Draft -> In Transit -> Received", async () => {
    // 1. In Transit
    const transitRes = await apiRequest(`/api/inventory/transfers/${createdTransferId}`, {
      method: "PATCH",
      body: { status: "In Transit" },
    })
    assert.equal(transitRes.status, 200)
    assert.equal(transitRes.data.status, "In Transit")

    // 2. Received
    const receivedRes = await apiRequest(`/api/inventory/transfers/${createdTransferId}`, {
      method: "PATCH",
      body: { status: "Received", received_by: "Store Manager Hawassa" },
    })
    assert.equal(receivedRes.status, 200)
    assert.equal(receivedRes.data.status, "Received")
  })

  await test("DELETE /api/inventory/transfers/:id: Delete transfer and cascade items", async () => {
    const res = await apiRequest(`/api/inventory/transfers/${createdTransferId}`, { method: "DELETE" })
    assert.equal(res.status, 200)

    const [trCheck] = await pool.query("SELECT * FROM store_transfers WHERE id = ?", [createdTransferId])
    assert.equal(trCheck.length, 0, "Transfer record must be deleted")

    const [itemCheck] = await pool.query("SELECT * FROM store_transfer_items WHERE transfer_id = ?", [createdTransferId])
    assert.equal(itemCheck.length, 0, "Transfer items must be cascade deleted")
  })

  // ── STEP 7: Multi-Device Persistence & Refresh Simulation ──
  console.log("\n--- STEP 7: Multi-Device Persistence & Refresh Simulation (No LocalStorage) ---")

  await test("Device A creates quarantine record -> Device B reads without LocalStorage -> 100% Match", async () => {
    // 1. Device A records quarantine in MySQL
    const devARes = await apiRequest("/api/inventory/movements", {
      method: "POST",
      body: {
        product_id: createdPharmaProdId,
        movement_type: "QUARANTINE",
        quantity: 25,
        unit_price: 250,
        batch_number: "AMX-DYNAMIC-01-UPD",
        reference_type: "QUARANTINE_LOG",
        notes: "Device A: Cracked glass bottle in crate",
        reason: "Transit damage",
      },
    })
    assert.equal(devARes.status, 201)
    const quarantineMoveId = devARes.data.id

    // 2. Device A updates note
    const devAUpdate = await apiRequest(`/api/inventory/movements/${quarantineMoveId}`, {
      method: "PATCH",
      body: { notes: "Device A: Verified - 25 units broken glass, quarantine isolated" },
    })
    assert.equal(devAUpdate.status, 200)

    // 3. Device B simulation: fresh request with fresh headers (no local storage cache)
    const devBRes = await apiRequest(`/api/inventory/movements?movement_type=QUARANTINE&product_id=${createdPharmaProdId}`)
    assert.equal(devBRes.status, 200)
    const devBRecord = devBRes.data.find(m => m.id === quarantineMoveId)
    assert.ok(devBRecord, "Device B must retrieve the quarantine record directly from MySQL")
    assert.equal(
      devBRecord.notes,
      "Device A: Verified - 25 units broken glass, quarantine isolated",
      "Device B must see Device A's updated notes immediately without local storage"
    )

    // 4. Clean up the test movement
    await apiRequest(`/api/inventory/movements/${quarantineMoveId}`, { method: "DELETE" })
  })

  // ── STEP 8: Cleanup and Teardown ──
  console.log("\n--- STEP 8: Cleanup & Database State Restoration ---")

  await test("DELETE /api/inventory/products/:id: Delete Pharma Product and cascade clean", async () => {
    const res = await apiRequest(`/api/inventory/products/${createdPharmaProdId}`, { method: "DELETE" })
    assert.equal(res.status, 200)

    const [pCheck] = await pool.query("SELECT * FROM pharma_products WHERE id = ?", [createdPharmaProdId])
    assert.equal(pCheck.length, 0, "Product must be deleted")

    const [bCheck] = await pool.query("SELECT * FROM pharma_product_batches WHERE product_id = ?", [createdPharmaProdId])
    assert.equal(bCheck.length, 0, "All product batches must be cleaned up")

    const [mCheck] = await pool.query("SELECT * FROM stock_movements WHERE product_id = ?", [createdPharmaProdId])
    assert.equal(mCheck.length, 0, "All product movements must be cleaned up")
  })

  await test("DELETE /api/inventory/products/:id: Delete Export Product and cascade clean", async () => {
    const res = await apiRequest(`/api/inventory/products/${createdExportProdId}`, { method: "DELETE" })
    assert.equal(res.status, 200)

    const [expCheck] = await pool.query("SELECT * FROM export_products WHERE id = ?", [createdExportProdId])
    assert.equal(expCheck.length, 0, "Export commodity must be deleted")

    const [mCheck] = await pool.query("SELECT * FROM export_warehouse_movements WHERE product_id = ?", [createdExportProdId])
    assert.equal(mCheck.length, 0, "All export movements must be cleaned up")
  })

  await test("Clean up temporary dynamic warehouses from MySQL", async () => {
    await pool.query("DELETE FROM warehouses WHERE id IN (?, ?)", [TEST_EXPORT_WH_ID, TEST_PHARMA_WH_ID])
    invalidateWarehouseCache()

    const [check] = await pool.query("SELECT * FROM warehouses WHERE id IN (?, ?)", [TEST_EXPORT_WH_ID, TEST_PHARMA_WH_ID])
    assert.equal(check.length, 0, "Temporary dynamic warehouses must be removed")
  })

  // ── Summary ──
  console.log("\n=================================================================")
  console.log(`📊 TEST RESULTS: ${passed}/${total} TESTS PASSED`)
  console.log("=================================================================\n")

  if (passed === total) {
    console.log("🎉 ALL INVENTORY ENDPOINTS, CRUD OPERATIONS, & ARCHITECTURAL GATES VERIFIED!")
    process.exit(0)
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED!`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error("Fatal test runner error:", err)
  process.exit(1)
})
