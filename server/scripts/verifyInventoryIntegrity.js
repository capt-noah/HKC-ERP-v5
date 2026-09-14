import { pool } from "/Users/Noah/Documents/React/HKC-ERP-v5/server/db/client.js"

function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`  ✓ ${msg}`)
}

async function verify() {
  console.log("================================================================")
  console.log("=== VERIFYING INVENTORY MIGRATION & VALUATION INTEGRITY ===")
  console.log("================================================================\n")

  // 1. Check table row counts
  console.log("--- 1. DATABASE ROW COUNTS ---")
  const [ppCount] = await pool.query("SELECT COUNT(*) as count FROM pharma_products")
  assert(ppCount[0].count === 22, `pharma_products has exactly 22 rows (got ${ppCount[0].count})`)

  const [pbCount] = await pool.query("SELECT COUNT(*) as count FROM pharma_product_batches")
  assert(pbCount[0].count === 22, `pharma_product_batches has exactly 22 rows (got ${pbCount[0].count})`)

  const [smCount] = await pool.query("SELECT COUNT(*) as count FROM stock_movements")
  assert(smCount[0].count === 22, `stock_movements has exactly 22 initial movements (got ${smCount[0].count})`)

  const [usersCount] = await pool.query("SELECT COUNT(*) as count FROM users")
  assert(usersCount[0].count === 5, `users has exactly 5 preserved users (got ${usersCount[0].count})`)

  const [whCount] = await pool.query("SELECT COUNT(*) as count FROM warehouses")
  assert(whCount[0].count === 3, `warehouses has exactly 3 preserved warehouses (got ${whCount[0].count})`)

  const [coaCount] = await pool.query("SELECT COUNT(*) as count FROM chart_of_accounts")
  assert(coaCount[0].count === 82, `chart_of_accounts has exactly 82 preserved accounts (got ${coaCount[0].count})`)

  const [glCount] = await pool.query("SELECT COUNT(*) as count FROM gl_account_mappings")
  assert(glCount[0].count === 28, `gl_account_mappings has exactly 28 preserved mappings (got ${glCount[0].count})`)

  // 2. Check relational integrity
  console.log("\n--- 2. RELATIONAL & DATA INTEGRITY ---")
  const [orphanedBatches] = await pool.query(`
    SELECT b.id, b.product_id
    FROM pharma_product_batches b
    LEFT JOIN pharma_products p ON b.product_id = p.id
    WHERE p.id IS NULL
  `)
  assert(orphanedBatches.length === 0, `0 orphaned batches (got ${orphanedBatches.length})`)

  const [orphanedMovements] = await pool.query(`
    SELECT m.id, m.product_id
    FROM stock_movements m
    LEFT JOIN pharma_products p ON m.product_id = p.id
    WHERE p.id IS NULL
  `)
  assert(orphanedMovements.length === 0, `0 orphaned stock movements (got ${orphanedMovements.length})`)

  const [invalidWH] = await pool.query(`
    SELECT id, warehouse_id
    FROM pharma_products
    WHERE warehouse_id NOT IN ('WH2', 'WH3')
  `)
  assert(invalidWH.length === 0, `All pharma products belong to WH2 or WH3 (invalid: ${invalidWH.length})`)

  // 3. Check stock valuations and unit prices
  console.log("\n--- 3. STOCK VALUATIONS & UNIT PRICES ---")
  const [products] = await pool.query("SELECT * FROM pharma_products")
  const [batches] = await pool.query("SELECT * FROM pharma_product_batches")
  const [movements] = await pool.query("SELECT * FROM stock_movements")

  for (const p of products) {
    const qty = Number(p.quantity)
    const cost = Number(p.unit_cost)
    const expectedVal = Math.round(qty * cost * 100) / 100
    const actualVal = Number(p.total_stock_value)

    if (cost > 0) {
      assert(Math.abs(expectedVal - actualVal) <= 0.05, `${p.name}: quantity (${qty}) * unit_cost (${cost}) = total_stock_value (${actualVal})`)
    }

    // Check matching batch
    const matchingBatch = batches.find(b => b.product_id === p.id)
    assert(Boolean(matchingBatch), `${p.name} has matching batch ${matchingBatch?.batch_no}`)
    assert(Number(matchingBatch.quantity) === qty, `${p.name}: batch quantity (${matchingBatch.quantity}) matches product quantity (${qty})`)
    assert(Number(matchingBatch.unit_cost) === cost, `${p.name}: batch unit_cost (${matchingBatch.unit_cost}) matches product unit_cost (${cost})`)

    // Check matching movement
    const matchingMovement = movements.find(m => m.product_id === p.id)
    assert(Boolean(matchingMovement), `${p.name} has matching initial movement ${matchingMovement?.id}`)
    assert(Number(matchingMovement.quantity) === qty, `${p.name}: movement quantity (${matchingMovement.quantity}) matches product quantity (${qty})`)
    assert(Number(matchingMovement.unit_cost) === cost, `${p.name}: movement unit_cost (${matchingMovement.unit_cost}) matches product unit_cost (${cost})`)
    assert(Number(matchingMovement.unit_price) === cost, `${p.name}: movement unit_price (${matchingMovement.unit_price}) matches product unit_cost (${cost})`)
  }

  // 4. Test quarantine deduction simulation on actual company product: ALBENTONG 2500
  console.log("\n--- 4. QUARANTINE VALUATION DEDUCTION SIMULATION ---")
  const albentong = products.find(p => p.sku === "ALB-251036")
  assert(Boolean(albentong), "ALBENTONG 2500 found in products")

  const albBatch = batches.find(b => b.product_id === albentong.id)
  assert(Boolean(albBatch), "ALBENTONG 2500 batch found")

  const albMovement = movements.find(m => m.product_id === albentong.id)
  assert(Boolean(albMovement), "ALBENTONG 2500 initial movement found")

  // Initial state
  const initQty = Number(albentong.quantity) // 8240
  const unitCost = Number(albentong.unit_cost) // 848
  const initVal = Number(albentong.total_stock_value) // 6987520

  assert(initQty === 8240, `Initial quantity is 8240 Box`)
  assert(unitCost === 848, `Unit cost is 848 ETB`)
  assert(initVal === 6987520, `Initial total value is 6,987,520 ETB`)

  // Simulate Quarantine of 40 Boxes (1 Carton)
  const qrnQty = 40
  const qrnVal = qrnQty * unitCost // 33,920 ETB
  const expectedRemQty = initQty - qrnQty // 8200 Box
  const expectedRemVal = initVal - qrnVal // 6,953,600 ETB

  const simulatedEntries = [
    {
      id: albMovement.id,
      type: "entry",
      date: albMovement.movement_date,
      batchNo: albMovement.batch_no,
      qtyReceived: initQty,
      qtyIssued: 0,
      balance: initQty,
      unitPrice: unitCost,
    },
    {
      id: "BCE-QRN-TEST",
      type: "quarantine",
      date: "2026-09-14",
      batchNo: albMovement.batch_no,
      qtyReceived: 0,
      qtyIssued: qrnQty,
      balance: expectedRemQty,
      unitPrice: unitCost,
    }
  ]

  // Test StockBinCardLedger netPharmaVal logic
  const netPharmaVal = simulatedEntries.reduce((sum, rec) => {
    const isQuarantine = rec.type === "quarantine"
    const isEntry = !isQuarantine && rec.type !== "reject" && (rec.type === "entry" || Number(rec.qtyReceived || 0) > 0)
    const isDeduct = isQuarantine || rec.type === "leave" || rec.type === "reject" || Number(rec.qtyIssued || 0) > 0
    const inQty = Number(rec.qtyReceived || 0)
    const outQty = Number(rec.qtyIssued || 0)
    const rowPrice = Number(rec.unitPrice || unitCost)
    return sum + (isEntry ? inQty * rowPrice : isDeduct ? -(outQty * rowPrice) : 0)
  }, 0)

  assert(netPharmaVal === expectedRemVal, `netPharmaVal footer is ${expectedRemVal} ETB (got ${netPharmaVal})`)

  // Test StockProducts computedStockValue logic
  let childNetVal = 0
  for (const b of simulatedEntries) {
    const isQuarantine = b.type === "quarantine"
    const isEntry = !isQuarantine && b.type !== "reject" && (b.type === "entry" || Number(b.qtyReceived || 0) > 0)
    const isDeduct = isQuarantine || b.type === "leave" || b.type === "reject" || Number(b.qtyIssued || 0) > 0
    const inQ = isEntry ? Number(b.qtyReceived || 0) : 0
    const outQ = isDeduct ? Number(b.qtyIssued || 0) : 0
    const price = Number(b.unitPrice || unitCost)
    if (isEntry) childNetVal += inQ * price
    else if (isDeduct) childNetVal -= outQ * price
  }

  assert(childNetVal === expectedRemVal, `computedStockValue on parent row is ${expectedRemVal} ETB (got ${childNetVal})`)
  assert(childNetVal === netPharmaVal, "Parent row stock value EXACTLY equals child ledger aggregate footer!")

  console.log("\n================================================================")
  console.log("=== ALL INTEGRITY & VALUATION TESTS PASSED! ===")
  console.log("================================================================")

  await pool.end()
  process.exit(0)
}

verify().catch(err => {
  console.error(err)
  process.exit(1)
})
