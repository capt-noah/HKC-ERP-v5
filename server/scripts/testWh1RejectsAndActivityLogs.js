import assert from "assert"
import express from "express"
import http from "http"
import jwt from "jsonwebtoken"
import { pool } from "../db/client.js"
import { config } from "../config.js"
import { masterRouter } from "../router/index.js"
import { createSession } from "../modules/auth/sessionService.js"

async function runTests() {
  console.log("=== Starting Full HTTP & Lifecycle Verification Tests ===")

  // Set up ephemeral Express server with masterRouter
  const app = express()
  app.use(express.json())
  app.use("/", masterRouter)

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`Ephemeral test server running at ${baseUrl}`)

  // Create real DB sessions for selam (sales_manager) and capt (inventory_admin)
  const selamSession = await createSession({
    userId: "USR-6b974442",
    req: { headers: { "user-agent": "Node-Test" }, socket: { remoteAddress: "127.0.0.1" } },
  })

  const captSession = await createSession({
    userId: "USR-7526ff79",
    req: { headers: { "user-agent": "Node-Test" }, socket: { remoteAddress: "127.0.0.1" } },
  })

  const selamToken = jwt.sign(
    {
      id: "USR-6b974442",
      username: "selam",
      fullname: "selam shikur",
      role: "sales_manager",
      roles: ["sales_manager"],
      sessionId: selamSession.id,
    },
    config.jwtSecret,
    { expiresIn: "1h" }
  )

  const captToken = jwt.sign(
    {
      id: "USR-7526ff79",
      username: "capt",
      fullname: "Noah Tesfaye",
      role: "inventory_admin",
      roles: ["inventory_admin"],
      sessionId: captSession.id,
    },
    config.jwtSecret,
    { expiresIn: "1h" }
  )

  try {
    // -------------------------------------------------------------
    // Test 1: sales_manager POST to /api/user_activity_logs
    // -------------------------------------------------------------
    console.log("\n[Test 1] HTTP POST /api/user_activity_logs as sales_manager (selam)...")
    const testLogId1 = `LOG-SELAM-${Date.now()}`
    const postLogRes1 = await fetch(`${baseUrl}/api/user_activity_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${selamToken}`,
      },
      body: JSON.stringify({
        id: testLogId1,
        action: "Create",
        resource: "sales_orders",
        details: { orderId: "SO-101", customer: "Addis Exporters", amount: 85000 },
      }),
    })

    console.log(`Response status: ${postLogRes1.status}`)
    const postLogData1 = await postLogRes1.json()
    assert(postLogRes1.status === 200 || postLogRes1.status === 201, `Expected 200/201, got ${postLogRes1.status}`)
    assert.strictEqual(postLogData1.id, testLogId1, "Log ID should match")
    assert.strictEqual(postLogData1.username, "selam", "Log username must be auto-populated as selam")
    assert.strictEqual(postLogData1.user_id, "USR-6b974442", "Log user_id must be auto-populated as USR-6b974442")
    console.log("✅ sales_manager successfully POSTed audit log to /api/user_activity_logs without 403!")

    // -------------------------------------------------------------
    // Test 2: sales_manager GET /api/user_activity_logs (Should be 403 Forbidden)
    // -------------------------------------------------------------
    console.log("\n[Test 2] HTTP GET /api/user_activity_logs as sales_manager (selam)...")
    const getLogRes1 = await fetch(`${baseUrl}/api/user_activity_logs`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${selamToken}`,
      },
    })
    console.log(`Response status: ${getLogRes1.status}`)
    assert.strictEqual(getLogRes1.status, 403, `Expected 403 Forbidden for reading audit logs, got ${getLogRes1.status}`)
    console.log("✅ sales_manager GET /api/user_activity_logs correctly forbidden (403)!")

    // -------------------------------------------------------------
    // Test 3: inventory_admin POST to /api/user_activity_logs
    // -------------------------------------------------------------
    console.log("\n[Test 3] HTTP POST /api/user_activity_logs as inventory_admin (capt)...")
    const testLogId2 = `LOG-CAPT-${Date.now()}`
    const postLogRes2 = await fetch(`${baseUrl}/api/user_activity_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${captToken}`,
      },
      body: JSON.stringify({
        id: testLogId2,
        action: "Reject Loss Deduction",
        resource: "export_warehouse_movements",
        details: { rejectQty: 5, warehouse: "WH1" },
      }),
    })
    assert(postLogRes2.status === 200 || postLogRes2.status === 201, `Expected 200/201, got ${postLogRes2.status}`)
    const postLogData2 = await postLogRes2.json()
    assert.strictEqual(postLogData2.username, "capt", "Log username must be capt")
    console.log("✅ inventory_admin successfully POSTed audit log to /api/user_activity_logs!")

    // -------------------------------------------------------------
    // Test 4: WH1 Export Product + Initial Entry + Reject Movement via HTTP
    // -------------------------------------------------------------
    console.log("\n[Test 4] WH1 Export Product Initial Entry & Reject Movement Lifecycle...")
    const testProdId = `PROD-HTTP-${Date.now()}`
    const initialEntryId = `WH1E-HTTP-${Date.now()}`
    const testWhId = "WH1"

    // Step A: Create export product
    const createProdRes = await fetch(`${baseUrl}/api/export_products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${captToken}`,
      },
      body: JSON.stringify({
        id: testProdId,
        warehouse_id: testWhId,
        name: "Test Arabica Coffee Grade 1",
        sku: "ARA-WH1-HTTP",
        unit: "Quintal",
        quantity: 100,
        total_quantity: 100,
        unit_cost: 4000.0,
        selling_price: 5000.0,
        total_stock_value: 400000.0,
        voucher_no: "GRV-5501",
        plate_number: "ET-4-99881",
        supplier_name: "Sidama Union",
        status: "In Stock",
      }),
    })
    assert(createProdRes.status === 200 || createProdRes.status === 201, `Failed to create export product, got ${createProdRes.status}`)
    console.log("✅ Export product created via HTTP:", testProdId)

    // Step B: Persist initial entry in export_warehouse_movements (as addProduct now does)
    const createMoveRes = await fetch(`${baseUrl}/api/export_warehouse_movements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${captToken}`,
      },
      body: JSON.stringify({
        id: initialEntryId,
        warehouse_id: testWhId,
        product_id: testProdId,
        movement_type: "GRV_ENTRY",
        voucher_no: "GRV-5501",
        batch_no: "GRV-5501",
        party_name: "Sidama Union",
        plate_number: "ET-4-99881",
        gross_quantity: 100,
        reject_quantity: 0,
        net_quantity: 100,
        uom: "Quintal",
        unit_price: 4000.0,
        movement_date: new Date().toISOString().slice(0, 10),
        reason: "Initial GRV Truckload Receipt",
        created_by: "Noah Tesfaye",
      }),
    })
    assert(createMoveRes.status === 200 || createMoveRes.status === 201, `Initial movement creation status: ${createMoveRes.status}`)
    console.log("✅ Initial WH1 GRV entry persisted to export_warehouse_movements:", initialEntryId)

    // Step C: Update GRV entry when recording reject (PATCH /api/export_warehouse_movements/:id)
    const patchMoveRes = await fetch(`${baseUrl}/api/export_warehouse_movements/${initialEntryId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${captToken}`,
      },
      body: JSON.stringify({
        net_quantity: 92,
        reject_quantity: 8,
      }),
    })
    assert.strictEqual(patchMoveRes.status, 200, `PATCH should return 200 OK without 404, got ${patchMoveRes.status}`)
    const patchMoveData = await patchMoveRes.json()
    assert.strictEqual(Number(patchMoveData.net_quantity), 92, "net_quantity should be updated to 92")
    assert.strictEqual(Number(patchMoveData.reject_quantity), 8, "reject_quantity should be updated to 8")
    console.log("✅ PATCH /api/export_warehouse_movements/:id succeeded with 200 OK (No 404)!")

    // Step D: Record the reject deduction movement
    const rejectMoveId = `EWM-REJ-HTTP-${Date.now()}`
    const postRejRes = await fetch(`${baseUrl}/api/export_warehouse_movements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${captToken}`,
      },
      body: JSON.stringify({
        id: rejectMoveId,
        warehouse_id: testWhId,
        product_id: testProdId,
        movement_type: "REJECT_DEDUCTION",
        voucher_no: "GRV-5501",
        batch_no: "GRV-5501",
        party_name: "WH1 Cleaning / Processing Line",
        plate_number: "ET-4-99881",
        gross_quantity: 0,
        reject_quantity: 8,
        net_quantity: -8,
        uom: "Quintal",
        unit_price: 4000.0,
        movement_date: new Date().toISOString().slice(0, 10),
        reason: "Defective Beans & Stones",
        created_by: "Noah Tesfaye",
      }),
    })
    assert(postRejRes.status === 200 || postRejRes.status === 201, `Reject movement status: ${postRejRes.status}`)
    console.log("✅ Reject deduction movement recorded in export_warehouse_movements:", rejectMoveId)

    // Step E: Update product with new stock quantity & accurately deducted stock value
    const nextVal = 92 * 4000.0 // 368,000.00
    const patchProdRes = await fetch(`${baseUrl}/api/export_products/${testProdId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${captToken}`,
      },
      body: JSON.stringify({
        quantity: 92,
        total_stock_value: nextVal,
        unit_cost: 4000.0,
      }),
    })
    assert.strictEqual(patchProdRes.status, 200, `Product PATCH status: ${patchProdRes.status}`)
    const patchProdData = await patchProdRes.json()
    assert.strictEqual(Number(patchProdData.quantity), 92, "Product quantity must be 92")
    assert.strictEqual(Number(patchProdData.total_stock_value), 368000, "Stock value must accurately deduct 8 * 4000 = 32,000")
    console.log("✅ Product stock value accurately updated: ETB 368,000.00 (Deducted ETB 32,000.00)!")

    // Cleanup
    await pool.query("DELETE FROM user_activity_logs WHERE id IN (?, ?)", [testLogId1, testLogId2])
    await pool.query("DELETE FROM user_sessions WHERE id IN (?, ?)", [selamSession.id, captSession.id])
    await pool.query("DELETE FROM export_warehouse_movements WHERE product_id = ?", [testProdId])
    await pool.query("DELETE FROM export_products WHERE id = ?", [testProdId])
    console.log("✅ Test database cleaned up successfully.")

    console.log("\n=== ALL HTTP & DATABASE TESTS PASSED WITH 100% SUCCESS ===")
  } finally {
    server.close()
  }
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err)
  process.exit(1)
})
