import { pool } from "../db/client.js"
import {
  createSalesIssue,
  postSalesIssue,
  listSalesIssues,
  getAvailableBatches,
} from "../modules/sales/salesIssues.js"

import {
  drizzleCreateRow,
  drizzleGetRow,
  drizzleUpdateRow,
  drizzleDeleteRow,
} from "../db/drizzleCrud.js"

import { getResource } from "../db/resourceRegistry.js"

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`  ✓ ${message}`)
}

async function runTests() {
  console.log("=== STARTING SALES ISSUE & WAREHOUSE LIFECYCLE TESTS (v5) ===\n")

  // Ensure test customer exists
  const testCustId = "CUST-TEST-001"
  await drizzleCreateRow({
    resource: getResource("customers"),
    body: {
      id: testCustId,
      name: "Test Customer Ltd",
      phone: "+251911000000",
      email: "test@customer.com",
      is_active: 1,
      status: "Active",
    },
  }).catch(() => {})

  // =========================================================================
  // TEST 1: PHARMA WAREHOUSE MULTI-BATCH ID-FIRST DEDUCTION & STOCK VALUE
  // =========================================================================
  console.log("--- TEST 1: Pharma Warehouse Multi-Batch (Identical batch_no, distinct internal IDs & costs) ---")
  const pharmaProdId = `PROD-PH-TEST-${Date.now()}`
  const batch1Id = `PB-TEST-1-${Date.now()}`
  const batch2Id = `PB-TEST-2-${Date.now()}`
  const sharedBatchNo = "BATCH-LOT-2026"

  // Create parent pharma product (Initial Stock: 150 qty, 2,000 ETB stock value, 13.33 ETB unit cost)
  await drizzleCreateRow({
    resource: getResource("pharma_products"),
    body: {
      id: pharmaProdId,
      name: "Amoxicillin 500mg Capsules",
      category: "Antibiotics",
      warehouse_id: "WH2",
      quantity: 150,
      total_quantity: 150,
      unit_cost: 13.33,
      total_stock_value: 2000,
      selling_price: 25.0,
      unit: "Box",
      status: "In Stock",
    },
  })

  // Create Batch 1: 100 qty @ 10 ETB (Stock value = 1,000 ETB)
  await drizzleCreateRow({
    resource: getResource("pharma_product_batches"),
    body: {
      id: batch1Id,
      product_id: pharmaProdId,
      warehouse_id: "WH2",
      batch_no: sharedBatchNo,
      quantity: 100,
      unit_cost: 10.0,
      qa_status: "Released",
      expiry_date: "2027-12-31",
      mfg_date: "2026-01-01",
    },
  })

  // Create Batch 2: 50 qty @ 20 ETB (Stock value = 1,000 ETB)
  await drizzleCreateRow({
    resource: getResource("pharma_product_batches"),
    body: {
      id: batch2Id,
      product_id: pharmaProdId,
      warehouse_id: "WH2",
      batch_no: sharedBatchNo,
      quantity: 50,
      unit_cost: 20.0,
      qa_status: "Released",
      expiry_date: "2028-06-30",
      mfg_date: "2026-02-01",
    },
  })

  console.log("  Parent product & child batches initialized.")

  // Available batches lookup test
  const availRes = await getAvailableBatches({ item_id: pharmaProdId })
  assert(availRes.status === 200, "getAvailableBatches returned 200")
  assert(availRes.body.length === 2, "getAvailableBatches returned 2 batches")
  const foundB1 = availRes.body.find((b) => b.batch_id === batch1Id)
  const foundB2 = availRes.body.find((b) => b.batch_id === batch2Id)
  assert(foundB1 && foundB1.available_quantity === 100 && foundB1.unit_cost === 10, "Batch 1 correctly listed with ID, qty 100, cost 10")
  assert(foundB2 && foundB2.available_quantity === 50 && foundB2.unit_cost === 20, "Batch 2 correctly listed with ID, qty 50, cost 20")

  // Create Sales Issue for 40 units from Batch 1 specifically using batch_id
  const siCreateRes = await createSalesIssue({
    warehouse_id: "WH2",
    customer_id: testCustId,
    customer_name: "Test Customer Ltd",
    payment_type: "Cash",
    items: [
      {
        item_id: pharmaProdId,
        item_name: "Amoxicillin 500mg Capsules",
        batch_id: batch1Id,
        batch_no: sharedBatchNo,
        quantity: 40,
        unit_price: 30.0, // Selling price
      },
    ],
  })

  assert(siCreateRes.status === 200 || siCreateRes.status === 201, "Sales issue created successfully")
  const issue1 = siCreateRes.body
  const issue1Id = issue1.id
  assert(issue1.vat_rate === 15, "Pharma warehouse correctly assigned 15% VAT rate")
  assert(issue1.subtotal === 1200, "Subtotal is 40 * 30 = 1,200 ETB")
  assert(issue1.vat_amount === 180, "VAT amount is 15% of 1,200 = 180 ETB")
  assert(issue1.total_amount === 1380, "Grand total is 1,380 ETB")

  // Post Sales Issue
  const postRes1 = await postSalesIssue(issue1Id)
  assert(postRes1.status === 200, "Sales issue posted successfully")

  // Verify child batch deduction in DB
  const [bRows] = await pool.query("SELECT * FROM pharma_product_batches WHERE product_id = ? ORDER BY id", [pharmaProdId])
  const b1Db = bRows.find((b) => b.id === batch1Id)
  const b2Db = bRows.find((b) => b.id === batch2Id)
  assert(Number(b1Db.quantity) === 60, `Batch 1 deducted by 40: expected 60, got ${b1Db.quantity}`)
  assert(Number(b2Db.quantity) === 50, `Batch 2 untouched: expected 50, got ${b2Db.quantity}`)

  // Verify parent product stock value & weighted unit cost in DB
  const [pRows] = await pool.query("SELECT * FROM pharma_products WHERE id = ?", [pharmaProdId])
  const pDb = pRows[0]
  assert(Number(pDb.quantity) === 110, `Parent quantity: expected 110, got ${pDb.quantity}`)
  // Expected stock value: 60 * 10 + 50 * 20 = 1,600 ETB
  assert(Number(pDb.total_stock_value) === 1600, `Parent stock value: expected 1,600 ETB, got ${pDb.total_stock_value}`)
  // Expected weighted unit cost: 1600 / 110 = 14.55 ETB
  assert(Math.abs(Number(pDb.unit_cost) - 14.55) < 0.02, `Parent weighted unit cost: expected ~14.55 ETB, got ${pDb.unit_cost}`)
  assert(Number(pDb.selling_price) === 25.0, `Parent selling price preserved at 25 ETB (got ${pDb.selling_price})`)

  // Verify stock movement log entry
  const [smRows] = await pool.query("SELECT * FROM stock_movements WHERE reference_id = ?", [issue1Id])
  assert(smRows.length === 1, "Stock movement logged for sales issue")
  assert(smRows[0].movement_type === "ISSUE", "Movement type is ISSUE")
  assert(Number(smRows[0].quantity) === 40, "Movement quantity is 40")
  assert(Number(smRows[0].balance_after) === 110, "Balance after is 110")

  // Verify double-entry GL journal entries
  const [jeRows] = await pool.query("SELECT * FROM journal_entries WHERE id IN (?, ?)", [`JE-SALE-${issue1Id}`, `JE-COGS-${issue1Id}`])
  assert(jeRows.length === 2, "2 GL Journal Entries created (Sale JE + COGS JE)")
  const saleJe = jeRows.find((j) => j.id === `JE-SALE-${issue1Id}`)
  const cogsJe = jeRows.find((j) => j.id === `JE-COGS-${issue1Id}`)
  assert(saleJe && cogsJe, "Both JE-SALE and JE-COGS created")

  const [saleLines] = await pool.query("SELECT payload FROM journal_entry_lines WHERE id LIKE ?", [`JE-SALE-${issue1Id}%`])
  const [cogsLines] = await pool.query("SELECT payload FROM journal_entry_lines WHERE id LIKE ?", [`JE-COGS-${issue1Id}%`])
  
  const parsedSaleLines = saleLines.map(r => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload)
  const parsedCogsLines = cogsLines.map(r => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload)

  const saleDebit = parsedSaleLines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)
  const saleCredit = parsedSaleLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
  assert(saleDebit === 1380 && saleCredit === 1380, `Sales JE is balanced at 1,380 ETB (Dr: ${saleDebit}, Cr: ${saleCredit})`)

  const cogsDebit = parsedCogsLines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)
  const cogsCredit = parsedCogsLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
  // COGS = 40 * 10 = 400 ETB (cost of Batch 1)
  assert(cogsDebit === 400 && cogsCredit === 400, `COGS JE is balanced at 400 ETB (Dr: ${cogsDebit}, Cr: ${cogsCredit})`)

  console.log("  ✓ Test 1 passed successfully.\n")

  // =========================================================================
  // TEST 2: EXPORT WAREHOUSE MULTI-PARCEL DEDUCTION & STOCK VALUE
  // =========================================================================
  console.log("--- TEST 2: Export Warehouse Multi-Parcel (0% VAT, exact parcel cost deduction) ---")
  const exportProdId = `PROD-EXP-TEST-${Date.now()}`
  const grv1Id = `EWM-TEST-1-${Date.now()}`
  const grv2Id = `EWM-TEST-2-${Date.now()}`

  // Create parent export product (Initial: 150 quintals, 800,000 ETB value, 5,333.33 ETB unit cost)
  await drizzleCreateRow({
    resource: getResource("export_products"),
    body: {
      id: exportProdId,
      name: "Sesame Seeds Grade 1",
      category: "Oilseeds",
      warehouse: "WH1",
      warehouse_id: "WH1",
      quantity: 150,
      total_quantity: 150,
      unit_cost: 5333.33,
      total_stock_value: 800000,
      selling_price: 6500.0,
      unit: "Quintal",
      status: "In Stock",
    },
  })

  // Create GRV Parcel 1: 100 quintals @ 5,000 ETB (Value = 500,000 ETB)
  await drizzleCreateRow({
    resource: getResource("export_warehouse_movements"),
    body: {
      id: grv1Id,
      product_id: exportProdId,
      movement_type: "entry",
      voucher_no: "GRV-EXP-001",
      gross_quantity: 100,
      net_quantity: 100,
      unit_price: 5000.0,
      party_name: "Gondar Supplier Union",
      reason: "Goods Receipt Voucher GRV-EXP-001",
      created_at: new Date("2026-02-01T10:00:00Z"),
    },
  })

  // Create GRV Parcel 2: 50 quintals @ 6,000 ETB (Value = 300,000 ETB)
  await drizzleCreateRow({
    resource: getResource("export_warehouse_movements"),
    body: {
      id: grv2Id,
      product_id: exportProdId,
      movement_type: "entry",
      voucher_no: "GRV-EXP-002",
      gross_quantity: 50,
      net_quantity: 50,
      unit_price: 6000.0,
      party_name: "Humera Farmers Coop",
      reason: "Goods Receipt Voucher GRV-EXP-002",
      created_at: new Date("2026-02-05T10:00:00Z"),
    },
  })

  // Create Sales Issue for 40 quintals from Parcel 1 (GRV-EXP-001 / grv1Id)
  const expSiRes = await createSalesIssue({
    warehouse_id: "WH1",
    customer_id: testCustId,
    customer_name: "Test Customer Ltd",
    payment_type: "Credit",
    items: [
      {
        item_id: exportProdId,
        item_name: "Sesame Seeds Grade 1",
        batch_id: grv1Id,
        batch_no: "GRV-EXP-001",
        quantity: 40,
        unit_price: 7000.0,
      },
    ],
  })

  assert(expSiRes.status === 200 || expSiRes.status === 201, "Export Sales issue created successfully")
  const issue2 = expSiRes.body
  const issue2Id = issue2.id
  assert(issue2.vat_rate === 0, "Export warehouse correctly assigned 0% VAT rate")
  assert(issue2.subtotal === 280000, "Subtotal is 40 * 7,000 = 280,000 ETB")
  assert(issue2.vat_amount === 0, "VAT amount is 0 ETB for Export")
  assert(issue2.total_amount === 280000, "Grand total is 280,000 ETB")

  // Post Export Sales Issue
  const postExpRes = await postSalesIssue(issue2Id)
  assert(postExpRes.status === 200, "Export sales issue posted successfully")

  // Verify export movements created in DB
  const [ewmRows] = await pool.query(
    "SELECT * FROM export_warehouse_movements WHERE product_id = ? ORDER BY created_at ASC",
    [exportProdId]
  )
  assert(ewmRows.length === 3, "3 Export warehouse movements (2 GRVs + 1 Outbound Sale)")
  const saleMovement = ewmRows.find((m) => m.movement_type === "OUTBOUND_DISPATCH" || m.movement_type === "SALE_OUTBOUND")
  assert(saleMovement, "Outbound sales movement recorded in export_warehouse_movements")
  assert(Number(saleMovement.gross_quantity) === 40, "Outbound quantity is 40")

  // Verify parent export product stock value & weighted cost in DB
  const [expDbRows] = await pool.query("SELECT * FROM export_products WHERE id = ?", [exportProdId])
  const expDb = expDbRows[0]
  assert(Number(expDb.quantity) === 110, `Parent export quantity: expected 110, got ${expDb.quantity}`)
  // Expected stock value: (100 - 40) * 5000 + 50 * 6000 = 300,000 + 300,000 = 600,000 ETB
  assert(Number(expDb.total_stock_value) === 600000, `Parent stock value: expected 600,000 ETB, got ${expDb.total_stock_value}`)
  // Expected weighted unit cost: 600000 / 110 = 5,454.55 ETB
  assert(Math.abs(Number(expDb.unit_cost) - 5454.55) < 0.05, `Parent weighted cost: expected ~5,454.55 ETB, got ${expDb.unit_cost}`)
  assert(Number(expDb.selling_price) === 6500.0, `Parent export selling price preserved at 6500 ETB (got ${expDb.selling_price})`)

  // Verify GL entries for Export
  const [expJeRows] = await pool.query("SELECT * FROM journal_entries WHERE id IN (?, ?)", [`JE-SALE-${issue2Id}`, `JE-COGS-${issue2Id}`])
  assert(expJeRows.length === 2, "2 GL Journal Entries created for export sale")
  const expSaleJe = expJeRows.find((j) => j.id === `JE-SALE-${issue2Id}`)
  const expCogsJe = expJeRows.find((j) => j.id === `JE-COGS-${issue2Id}`)

  const [expSaleLines] = await pool.query("SELECT payload FROM journal_entry_lines WHERE id LIKE ?", [`JE-SALE-${issue2Id}%`])
  const [expCogsLines] = await pool.query("SELECT payload FROM journal_entry_lines WHERE id LIKE ?", [`JE-COGS-${issue2Id}%`])
  const parsedExpSaleLines = expSaleLines.map(r => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload)
  const parsedExpCogsLines = expCogsLines.map(r => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload)

  const expSaleDebit = parsedExpSaleLines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)
  const expSaleCredit = parsedExpSaleLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
  assert(expSaleDebit === 280000 && expSaleCredit === 280000, "Export Sale JE balanced at 280,000 ETB with 0 VAT")

  const expCogsDebit = parsedExpCogsLines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)
  const expCogsCredit = parsedExpCogsLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
  // COGS = 40 * 5,000 = 200,000 ETB
  assert(expCogsDebit === 200000 && expCogsCredit === 200000, `Export COGS JE balanced at 200,000 ETB (Dr: ${expCogsDebit}, Cr: ${expCogsCredit})`)

  console.log("  ✓ Test 2 passed successfully.\n")

  // =========================================================================
  // TEST 3: DYNAMIC CUSTOM WAREHOUSE RESOLUTION (e.g. WH4-DIRE-EXP, WH5-HAW-VET)
  // =========================================================================
  console.log("--- TEST 3: Dynamic Custom Warehouse Types ---")
  const customWhExp = "WH4-DIRE-EXP"
  const customWhPharma = "WH5-HAW-VET"

  // Ensure custom warehouses are registered in warehouses table
  await drizzleCreateRow({
    resource: getResource("warehouses"),
    body: {
      id: customWhExp,
      code: customWhExp,
      name: "Dire Dawa Export Terminal",
      warehouse_type: "EXPORT_WH",
      is_active: 1,
    },
  }).catch(() => {})

  await drizzleCreateRow({
    resource: getResource("warehouses"),
    body: {
      id: customWhPharma,
      code: customWhPharma,
      name: "Hawassa Regional Pharma Depot",
      warehouse_type: "PHARMA_WH",
      is_active: 1,
    },
  }).catch(() => {})

  const customExpSi = await createSalesIssue({
    warehouse_id: customWhExp,
    customer_id: testCustId,
    customer_name: "Test Customer Ltd",
    payment_type: "Cash",
    items: [{ item_id: exportProdId, item_name: "Sesame", batch_id: grv1Id, batch_no: "GRV-EXP-001", quantity: 10, unit_price: 5000 }],
  })
  assert((customExpSi.status === 200 || customExpSi.status === 201) && customExpSi.body.vat_rate === 0, `Custom export warehouse '${customWhExp}' dynamically resolved 0% VAT`)

  const customPharmaSi = await createSalesIssue({
    warehouse_id: customWhPharma,
    customer_id: testCustId,
    customer_name: "Test Customer Ltd",
    payment_type: "Cash",
    items: [{ item_id: pharmaProdId, item_name: "Capsules", batch_id: batch1Id, batch_no: sharedBatchNo, quantity: 10, unit_price: 100 }],
  })
  assert((customPharmaSi.status === 200 || customPharmaSi.status === 201) && customPharmaSi.body.vat_rate === 15, `Custom pharma warehouse '${customWhPharma}' dynamically resolved 15% VAT`)

  console.log("  ✓ Test 3 passed successfully.\n")

  // Cleanup test data
  console.log("--- Cleanup Test Records ---")
  await pool.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [pharmaProdId])
  await pool.query("DELETE FROM stock_movements WHERE product_id = ?", [pharmaProdId])
  await pool.query("DELETE FROM pharma_products WHERE id = ?", [pharmaProdId])
  await pool.query("DELETE FROM export_warehouse_movements WHERE product_id = ?", [exportProdId])
  await pool.query("DELETE FROM export_products WHERE id = ?", [exportProdId])
  await pool.query("DELETE FROM sales_issue_items WHERE sales_issue_id IN (?, ?, ?, ?)", [issue1Id, issue2Id, customExpSi.body.id, customPharmaSi.body.id])
  await pool.query("DELETE FROM sales_issues WHERE id IN (?, ?, ?, ?)", [issue1Id, issue2Id, customExpSi.body.id, customPharmaSi.body.id])
  await pool.query("DELETE FROM journal_entry_lines WHERE id LIKE 'JE-%'")
  await pool.query("DELETE FROM journal_entries WHERE id IN (?, ?, ?, ?)", [`JE-SALE-${issue1Id}`, `JE-COGS-${issue1Id}`, `JE-SALE-${issue2Id}`, `JE-COGS-${issue2Id}`])
  await pool.query("DELETE FROM customers WHERE id = ?", [testCustId])
  await pool.query("DELETE FROM warehouses WHERE id IN (?, ?)", [customWhExp, customWhPharma])

  console.log("=== ALL SALES ISSUE & WAREHOUSE LIFECYCLE TESTS PASSED! ===")
  await pool.end()
}

runTests().catch((err) => {
  console.error("Test execution failed:", err)
  process.exit(1)
})
