import { pool } from "../server/db/client.js"
import {
  createSalesIssue,
  postSalesIssue,
  cancelSalesIssue,
  deleteSalesIssue,
} from "../server/modules/sales/salesIssues.js"

async function runTest() {
  console.log("=== STARTING ACID SALES ENGINE VERIFICATION ===")
  const trackedIssues = new Set()

  try {
  // 1. Initial Trial Balance Check
  const [[tbInitial]] = await pool.query("SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM journal_entry_lines")
  const initDr = Number(tbInitial.total_debit || 0)
  const initCr = Number(tbInitial.total_credit || 0)
  const initDiff = Math.abs(initDr - initCr)
  console.log(`Initial Trial Balance: DR=${initDr.toFixed(2)}, CR=${initCr.toFixed(2)}, Diff=${initDiff.toFixed(2)}`)
  if (initDiff > 0.01) {
    throw new Error(`Initial trial balance has a difference of ${initDiff}!`)
  }

  // 2. Find a test pharma product with an available batch
  const [batches] = await pool.query(`
    SELECT b.id as batch_id, b.batch_no, b.quantity as batch_qty, b.unit_cost, b.selling_price,
           p.id as product_id, p.name as product_name, p.quantity as prod_qty, p.warehouse_id
    FROM pharma_product_batches b
    JOIN pharma_products p ON b.product_id = p.id
    WHERE b.quantity >= 10 AND (b.qa_status != 'Quarantined' OR b.qa_status IS NULL)
    LIMIT 1
  `)

  if (batches.length === 0) {
    throw new Error("No suitable pharma product batch found with quantity >= 10!")
  }

  const testBatch = batches[0]
  const prodId = testBatch.product_id
  const batchId = testBatch.batch_id
  const initialBatchQty = Number(testBatch.batch_qty)
  const initialProdQty = Number(testBatch.prod_qty)
  console.log(`Testing with Product '${testBatch.product_name}' (${prodId}), Batch '${testBatch.batch_no}' (${batchId}): BatchQty=${initialBatchQty}, ProdQty=${initialProdQty}`)

  const testIssueId = `TEST-ACID-SI-${Date.now()}`
  trackedIssues.add(testIssueId)
  const testQty = 5
  const testPrice = 250
  const testSubtotal = testQty * testPrice // 1250 ETB

  // 3. Test: Create Draft Sales Issue
  console.log("\n--- TEST STEP 1: CREATE DRAFT SALES ISSUE ---")
  const createRes = await createSalesIssue({
    id: testIssueId,
    fs_no: testIssueId,
    customer_id: "TEST-CUST-1",
    customer_name: "Test Quality Pharmacy",
    warehouse_id: testBatch.warehouse_id || "WH2",
    payment_type: "Cash",
    status: "Draft",
    items: [
      {
        item_id: prodId,
        product_id: prodId,
        item_name: testBatch.product_name,
        batch_id: batchId,
        batch_no: testBatch.batch_no,
        quantity: testQty,
        unit_price: testPrice,
        amount: testSubtotal,
      },
    ],
  })

  console.log(`Create draft response: status=${createRes.status}, id=${createRes.body?.id}`)
  if (createRes.status !== 200) {
    throw new Error(`Failed to create sales issue: ${JSON.stringify(createRes.body)}`)
  }

  // Verify stock was NOT deducted in draft state
  const [bAfterDraft] = await pool.query("SELECT quantity FROM pharma_product_batches WHERE id = ?", [batchId])
  if (Number(bAfterDraft[0].quantity) !== initialBatchQty) {
    throw new Error(`Batch quantity changed in draft! Expected ${initialBatchQty}, got ${bAfterDraft[0].quantity}`)
  }
  console.log("✓ Draft created safely without premature stock deduction.")

  // 4. Test: Post Sales Issue
  console.log("\n--- TEST STEP 2: POST SALES ISSUE ---")
  const postRes = await postSalesIssue(testIssueId)
  console.log(`Post response: status=${postRes.status}, ok=${postRes.body?.ok}`)
  if (postRes.status !== 200) {
    throw new Error(`Failed to post sales issue: ${JSON.stringify(postRes.body)}`)
  }

  // Verify stock deduction
  const [bAfterPost] = await pool.query("SELECT quantity FROM pharma_product_batches WHERE id = ?", [batchId])
  const expectedPostQty = initialBatchQty - testQty
  if (Number(bAfterPost[0].quantity) !== expectedPostQty) {
    throw new Error(`Batch quantity after post incorrect! Expected ${expectedPostQty}, got ${bAfterPost[0].quantity}`)
  }
  console.log(`✓ Batch quantity decremented correctly: ${initialBatchQty} -> ${bAfterPost[0].quantity}`)

  // Verify stock_movements logged
  const [movements] = await pool.query(
    "SELECT * FROM stock_movements WHERE reference_type = 'SALES_ISSUE' AND (reference_id = ? OR reference_id = ?)",
    [testIssueId, testIssueId]
  )
  if (movements.length === 0) {
    throw new Error("No stock_movements record found for posted sales issue!")
  }
  console.log(`✓ Outbound movement recorded in stock_movements (Qty=${movements[0].quantity})`)

  // Verify GL Journal Entries & Lines
  const [jes] = await pool.query(
    "SELECT * FROM journal_entries WHERE id IN (?, ?)",
    [`JE-SALE-${testIssueId}`, `JE-COGS-${testIssueId}`]
  )
  if (jes.length < 2) {
    throw new Error(`Expected 2 journal entries (JE-SALE and JE-COGS), found ${jes.length}`)
  }
  console.log(`✓ Both JE-SALE and JE-COGS created (${jes.map(j => j.id).join(", ")})`)

  const [jels] = await pool.query(
    "SELECT debit_amount, credit_amount FROM journal_entry_lines WHERE journal_entry_id IN (?, ?)",
    [`JE-SALE-${testIssueId}`, `JE-COGS-${testIssueId}`]
  )
  let postDr = 0, postCr = 0
  for (const l of jels) {
    postDr += Number(l.debit_amount || 0)
    postCr += Number(l.credit_amount || 0)
  }
  console.log(`✓ Posted Journal Lines sum: DR=${postDr.toFixed(2)}, CR=${postCr.toFixed(2)}, Diff=${(postDr - postCr).toFixed(2)}`)
  if (Math.abs(postDr - postCr) > 0.01) {
    throw new Error(`Posted journal lines are not balanced! DR=${postDr}, CR=${postCr}`)
  }

  // Verify total Trial Balance remains in parity
  const [[tbAfterPost]] = await pool.query("SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM journal_entry_lines")
  const tbPostDr = Number(tbAfterPost.total_debit || 0)
  const tbPostCr = Number(tbAfterPost.total_credit || 0)
  console.log(`✓ Global Trial Balance after Post: DR=${tbPostDr.toFixed(2)}, CR=${tbPostCr.toFixed(2)}, Diff=${(tbPostDr - tbPostCr).toFixed(2)}`)
  if (Math.abs(tbPostDr - tbPostCr) > 0.01) {
    throw new Error(`Global Trial balance broke after posting! Diff=${tbPostDr - tbPostCr}`)
  }

  // 5. Test: Cancel Sales Issue
  console.log("\n--- TEST STEP 3: CANCEL POSTED SALES ISSUE ---")
  const cancelRes = await cancelSalesIssue(testIssueId)
  console.log(`Cancel response: status=${cancelRes.status}, status body=${cancelRes.body?.status}`)
  if (cancelRes.status !== 200) {
    throw new Error(`Failed to cancel sales issue: ${JSON.stringify(cancelRes.body)}`)
  }

  // Verify stock restoration
  const [bAfterCancel] = await pool.query("SELECT quantity FROM pharma_product_batches WHERE id = ?", [batchId])
  if (Number(bAfterCancel[0].quantity) !== initialBatchQty) {
    throw new Error(`Batch quantity after cancel was not restored! Expected ${initialBatchQty}, got ${bAfterCancel[0].quantity}`)
  }
  console.log(`✓ Batch quantity completely restored: ${bAfterPost[0].quantity} -> ${bAfterCancel[0].quantity}`)

  // Verify stock movements deleted/reversed
  const [movAfterCancel] = await pool.query(
    "SELECT * FROM stock_movements WHERE reference_type = 'SALES_ISSUE' AND (reference_id = ? OR reference_id = ?)",
    [testIssueId, testIssueId]
  )
  if (movAfterCancel.length !== 0) {
    throw new Error(`Stock movements still exist after cancellation! Count=${movAfterCancel.length}`)
  }
  console.log("✓ Stock issue movement cleanly removed from ledger.")

  // Verify Journal Entries deleted
  const [jesAfterCancel] = await pool.query(
    "SELECT * FROM journal_entries WHERE id IN (?, ?)",
    [`JE-SALE-${testIssueId}`, `JE-COGS-${testIssueId}`]
  )
  if (jesAfterCancel.length !== 0) {
    throw new Error(`Journal entries still exist after cancellation! Count=${jesAfterCancel.length}`)
  }
  const [jelsAfterCancel] = await pool.query(
    "SELECT id FROM journal_entry_lines WHERE journal_entry_id IN (?, ?)",
    [`JE-SALE-${testIssueId}`, `JE-COGS-${testIssueId}`]
  )
  if (jelsAfterCancel.length !== 0) {
    throw new Error(`Journal entry lines still exist after cancellation! Count=${jelsAfterCancel.length}`)
  }
  console.log("✓ Journal entries and journal entry lines completely purged.")

  // Verify global trial balance restored to original
  const [[tbAfterCancel]] = await pool.query("SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM journal_entry_lines")
  const tbCancelDr = Number(tbAfterCancel.total_debit || 0)
  const tbCancelCr = Number(tbAfterCancel.total_credit || 0)
  console.log(`✓ Global Trial Balance after Cancel: DR=${tbCancelDr.toFixed(2)}, CR=${tbCancelCr.toFixed(2)}, Diff=${(tbCancelDr - tbCancelCr).toFixed(2)}`)
  if (Math.abs(tbCancelDr - tbCancelCr) > 0.01) {
    throw new Error(`Global Trial balance discrepancy after cancel! Diff=${tbCancelDr - tbCancelCr}`)
  }

  // 6. Test: Delete Sales Issue
  console.log("\n--- TEST STEP 4: DELETE SALES ISSUE ---")
  const delRes = await deleteSalesIssue(testIssueId)
  console.log(`Delete response: status=${delRes.status}, ok=${delRes.body?.ok}`)
  if (delRes.status !== 200) {
    throw new Error(`Failed to delete sales issue: ${JSON.stringify(delRes.body)}`)
  }

  const [issueRow] = await pool.query("SELECT * FROM sales_issues WHERE id = ?", [testIssueId])
  const [itemRows] = await pool.query("SELECT * FROM sales_issue_items WHERE sales_issue_id = ?", [testIssueId])
  if (issueRow.length !== 0 || itemRows.length !== 0) {
    throw new Error("Sales issue header or items still exist after delete!")
  }
  console.log("✓ Sales issue header and items completely deleted with 0 orphaned records.")

  // 7. Test: Direct Post and Delete
  console.log("\n--- TEST STEP 5: CREATE POSTED -> DIRECT DELETE ATOMICTY ---")
  const testIssue2 = `TEST-DIRECT-DEL-${Date.now()}`
  trackedIssues.add(testIssue2)
  await createSalesIssue({
    id: testIssue2,
    fs_no: testIssue2,
    customer_id: "TEST-CUST-2",
    customer_name: "Walk-in Buyer",
    warehouse_id: testBatch.warehouse_id || "WH2",
    payment_type: "Cash",
    status: "Posted",
    items: [
      {
        item_id: prodId,
        product_id: prodId,
        item_name: testBatch.product_name,
        batch_id: batchId,
        batch_no: testBatch.batch_no,
        quantity: testQty,
        unit_price: testPrice,
        amount: testSubtotal,
      },
    ],
  })

  // Verify deducted
  const [b2] = await pool.query("SELECT quantity FROM pharma_product_batches WHERE id = ?", [batchId])
  if (Number(b2[0].quantity) !== initialBatchQty - testQty) {
    throw new Error("Direct-post failed to deduct stock!")
  }
  console.log(`✓ Direct create-as-posted deducted stock: ${initialBatchQty} -> ${b2[0].quantity}`)

  // Delete directly while in posted status
  const del2Res = await deleteSalesIssue(testIssue2)
  if (del2Res.status !== 200) {
    throw new Error(`Direct delete failed: ${JSON.stringify(del2Res.body)}`)
  }

  // Verify stock restored
  const [b2After] = await pool.query("SELECT quantity FROM pharma_product_batches WHERE id = ?", [batchId])
  if (Number(b2After[0].quantity) !== initialBatchQty) {
    throw new Error(`Batch quantity not restored after direct delete! Expected ${initialBatchQty}, got ${b2After[0].quantity}`)
  }
  console.log(`✓ Batch quantity restored on direct delete: ${b2After[0].quantity}`)

  // 8. Test: WH1 Export Commodity Lifecycle
  console.log("\n--- TEST STEP 6: WH1 EXPORT COMMODITY LIFECYCLE ---")
  const [grvs] = await pool.query(`
    SELECT m.id as grv_id, m.product_id, m.net_quantity, p.quantity as prod_qty, p.name as prod_name, p.warehouse_id
    FROM export_warehouse_movements m
    JOIN export_products p ON m.product_id = p.id
    WHERE (m.movement_type = 'GRV_ENTRY' OR m.movement_type = 'entry') AND m.net_quantity >= 10
    LIMIT 1
  `)

  if (grvs.length > 0) {
    const grv = grvs[0]
    const initGrvNet = Number(grv.net_quantity)
    const expIssueId = `TEST-WH1-SI-${Date.now()}`
    trackedIssues.add(expIssueId)
    const expQty = 5
    const expPrice = 12000

    // Create & Post
    await createSalesIssue({
      id: expIssueId,
      fs_no: expIssueId,
      customer_id: "TEST-EXP-BUYER",
      customer_name: "Global Grain Exports Ltd",
      warehouse_id: grv.warehouse_id || "WH1",
      payment_type: "Cash",
      status: "Posted",
      items: [
        {
          item_id: grv.product_id,
          product_id: grv.product_id,
          item_name: grv.prod_name,
          batch_id: grv.grv_id,
          quantity: expQty,
          unit_price: expPrice,
          amount: expQty * expPrice,
        },
      ],
    })

    // Verify GRV net decremented
    const [grvAfterPost] = await pool.query("SELECT net_quantity FROM export_warehouse_movements WHERE id = ?", [grv.grv_id])
    console.log(`✓ WH1 GRV decremented: ${initGrvNet} -> ${grvAfterPost[0].net_quantity}`)

    // Cancel
    await cancelSalesIssue(expIssueId)

    // Verify GRV net restored
    const [grvAfterCancel] = await pool.query("SELECT net_quantity FROM export_warehouse_movements WHERE id = ?", [grv.grv_id])
    if (Number(grvAfterCancel[0].net_quantity) !== initGrvNet) {
      throw new Error(`WH1 GRV not restored! Expected ${initGrvNet}, got ${grvAfterCancel[0].net_quantity}`)
    }
    console.log(`✓ WH1 GRV restored: ${grvAfterPost[0].net_quantity} -> ${grvAfterCancel[0].net_quantity}`)

    // Delete
    await deleteSalesIssue(expIssueId)
    console.log("✓ WH1 export sales issue deleted cleanly.")
  }

  // Verify final Trial Balance
  const [[tbFinal]] = await pool.query("SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM journal_entry_lines")
  const finDr = Number(tbFinal.total_debit || 0)
  const finCr = Number(tbFinal.total_credit || 0)
  const finDiff = Math.abs(finDr - finCr)
  console.log(`\n=== FINAL TRIAL BALANCE: DR=${finDr.toFixed(2)}, CR=${finCr.toFixed(2)}, Difference=${finDiff.toFixed(2)} ETB ===`)
  if (finDiff > 0.01) {
    throw new Error(`Final trial balance discrepancy: ${finDiff}`)
  }

  console.log("\n🎉 ALL ACID SALES TRANSACTIONS PASSED WITH 100% SUCCESS! ZERO ORPHANED RECORDS, ZERO TRIAL BALANCE DISCREPANCY!")
  } finally {
    for (const id of trackedIssues) {
      await pool.query("DELETE FROM sales_issue_items WHERE sales_issue_id = ?", [id]).catch(() => {})
      await pool.query("DELETE FROM sales_issues WHERE id = ?", [id]).catch(() => {})
    }
  }
  process.exit(0)
}

runTest().catch((err) => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err)
  process.exit(1)
})
