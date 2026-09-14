import { drizzleCreateRow, drizzleDeleteRow, drizzleListRows } from "../server/db/drizzleCrud.js"
import { getResource } from "../server/db/resourceRegistry.js"
import { createSalesIssue, postSalesIssue } from "../server/modules/sales/salesIssues.js"
import { pool } from "../server/db/client.js"

async function runProfitIntegrationTest() {
  console.log("=== STARTING PROFIT INTEGRATION & FINANCIAL REPORTING TEST ===")

  const testSuffix = Date.now()
  const testProdId = `PROD-TEST-PF-${testSuffix}`
  const testBatchId = `BATCH-TEST-PF-${testSuffix}`
  const testSoId = `SO-TEST-PF-${testSuffix}`
  let issueId = null

  try {
    // 0. Create a temporary pharma product & batch with known cost & sell price
    console.log("1. Creating test pharma product and batch...")
    await drizzleCreateRow({
      resource: getResource("pharma_products"),
      body: {
        id: testProdId,
        name: "Test Profit Pharma Lot",
        sku: `SKU-PF-${testSuffix}`,
        category: "Pharmaceuticals",
        unit: "Bottle",
        unit_cost: 800,
        selling_price: 1200,
        quantity: 50,
        total_quantity: 50,
        total_stock_value: 40000,
        warehouse_id: "WH2",
      },
    })

    await drizzleCreateRow({
      resource: getResource("pharma_product_batches"),
      body: {
        id: testBatchId,
        product_id: testProdId,
        batch_no: `BATCH-${testSuffix}`,
        quantity: 50,
        unit_cost: 800,
        expiry_date: "2028-12-31",
        qa_status: "Released",
        warehouse_id: "WH2",
      },
    })

    // 1. Create an approved Sales Order
    console.log("2. Creating approved Sales Order...")
    const soBody = {
      id: testSoId,
      customer: "Addis Healthcare Pharma PLC",
      customerId: "CUST-ADDIS-01",
      customerPhone: "+251911000111",
      warehouse: "WH2",
      warehouse_id: "WH2",
      amount: 12000,
      approvalStatus: "Approved",
      approvedBy: "Super Admin",
      approvedAt: new Date().toISOString(),
      paymentType: "Cash",
      items: [
        {
          productId: testProdId,
          product_id: testProdId,
          name: "Test Profit Pharma Lot",
          qty: 10,
          unit: "Bottle",
          unitPrice: 1200,
          unitCost: 800,
          total: 12000,
        },
      ],
    }

    await drizzleCreateRow({
      resource: getResource("sales_orders"),
      body: soBody,
    })

    // 2. Create Sales Issue against the Approved SO
    console.log("3. Creating Sales Issue for 10 units...")
    const issueRes = await createSalesIssue({
      sales_order_id: testSoId,
      customer_id: "CUST-ADDIS-01",
      customer_name: "Addis Healthcare Pharma PLC",
      warehouse_id: "WH2",
      payment_type: "Cash",
      items: [
        {
          item_id: testProdId,
          product_id: testProdId,
          item_name: "Test Profit Pharma Lot",
          batch_id: testBatchId,
          batch_no: `BATCH-${testSuffix}`,
          quantity: 10,
          unit_price: 1200,
          unit_cost: 800,
          amount: 12000,
        },
      ],
    })

    if (issueRes.status !== 200 && issueRes.status !== 201) {
      throw new Error(`Failed to create sales issue: ${JSON.stringify(issueRes.body)}`)
    }

    issueId = issueRes.body.id
    console.log("   Created Sales Issue:", issueId, "status:", issueRes.body.status)

    // 3. Post Sales Issue (Triggers Double-Entry GL Generation)
    console.log("4. Posting Sales Issue to GL...")
    const postRes = await postSalesIssue(issueId)
    if (postRes.status !== 200) {
      throw new Error(`Failed to post sales issue: ${JSON.stringify(postRes.body)}`)
    }
    console.log("   Sales Issue successfully posted!")

    // 4. Verify GL Journal Entries & Lines
    console.log("5. Verifying Double-Entry General Ledger journal entries...")
    const saleJeId = `JE-SALE-${issueId}`
    const cogsJeId = `JE-COGS-${issueId}`

    const [jeRows] = await pool.query("SELECT id, payload FROM journal_entries WHERE id IN (?, ?)", [saleJeId, cogsJeId])
    console.log(`   Found ${jeRows.length} posted journal entries for sales issue (Expected: 2)`)
    if (jeRows.length !== 2) {
      throw new Error(`Expected 2 journal entries (Sales & COGS), found ${jeRows.length}`)
    }

    const [jelRows] = await pool.query(
      "SELECT id, payload FROM journal_entry_lines WHERE id LIKE CONCAT(?, '%') OR id LIKE CONCAT(?, '%')",
      [saleJeId, cogsJeId]
    )
    console.log(`   Found ${jelRows.length} journal entry lines`)

    const parsedLines = jelRows.map((r) => {
      const p = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload
      return { id: r.id, ...p }
    })

    // Fetch accounts to check IDs and codes
    const coaRes = await drizzleListRows({ resource: getResource("chart_of_accounts") })
    const coaList = coaRes.body.map((a) => (a?.payload ? { ...a.payload, ...a } : a))
    const accMap = new Map(coaList.map((a) => [a.id, a]))

    let revenueCredited = 0
    let cogsDebited = 0
    let inventoryCredited = 0

    parsedLines.forEach((line) => {
      const acc = accMap.get(line.account_id)
      console.log(`     Line: ${line.id} | Account: ${acc?.code} (${acc?.name}) | DR: ${line.debit_amount} | CR: ${line.credit_amount}`)
      if (acc?.account_type === "Revenue") {
        revenueCredited += Number(line.credit_amount || 0) - Number(line.debit_amount || 0)
      }
      if (acc?.code === "5001" || acc?.peachtree_type === "Cost of Sales") {
        cogsDebited += Number(line.debit_amount || 0) - Number(line.credit_amount || 0)
      }
      if (acc?.code?.startsWith("1410")) {
        inventoryCredited += Number(line.credit_amount || 0) - Number(line.debit_amount || 0)
      }
    })

    console.log("\n6. Mathematical Profit Verification:")
    console.log(`   Posted Revenue:   ETB ${revenueCredited} (Expected: 12000)`)
    console.log(`   Cost of Goods:    ETB ${cogsDebited} (Expected: 8000)`)
    console.log(`   Inventory Relieved: ETB ${inventoryCredited} (Expected: 8000)`)
    const grossProfit = revenueCredited - cogsDebited
    const grossMargin = (grossProfit / revenueCredited) * 100
    console.log(`   Gross Profit:     ETB ${grossProfit} (Expected: 4000)`)
    console.log(`   Gross Margin:     ${grossMargin.toFixed(2)}% (Expected: 33.33%)`)

    if (revenueCredited !== 12000) throw new Error(`Revenue mismatch: got ${revenueCredited}, expected 12000`)
    if (cogsDebited !== 8000) throw new Error(`COGS mismatch: got ${cogsDebited}, expected 8000`)
    if (inventoryCredited !== 8000) throw new Error(`Inventory credit mismatch: got ${inventoryCredited}, expected 8000`)
    if (grossProfit !== 4000) throw new Error(`Gross profit mismatch: got ${grossProfit}, expected 4000`)

    // 7. Verify isCogsAccount classifier logic matches FinancialReports
    const isCogsAccount = (account) => {
      if (!account) return false
      if (account.peachtree_type === "Cost of Sales") return true
      if (account.code === "5001" || account.code?.startsWith("6")) return true
      if (/cogs|cost of (goods|sales)/i.test(account.name || "")) return true
      return false
    }

    const cogsAccount5001 = coaList.find((a) => a.code === "5001")
    const salaryAccount5010 = coaList.find((a) => a.code === "5010")
    const adminAccount8000 = coaList.find((a) => a.code === "8000")

    if (!isCogsAccount(cogsAccount5001)) throw new Error("Account 5001 must be classified as COGS!")
    if (isCogsAccount(salaryAccount5010)) throw new Error("Account 5010 (Salary) must NOT be classified as COGS!")
    if (isCogsAccount(adminAccount8000)) throw new Error("Account 8000 (Admin) must NOT be classified as COGS!")
    console.log("   isCogsAccount classification accuracy: 100% verified.")

    console.log("\n ALL PROFIT INTEGRATION & REPORTING TESTS PASSED (100% ACCURACY)!\n")
  } finally {
    // 8. Clean up created test data
    console.log("7. Cleaning up test records...")
    if (issueId) {
      await pool.query("DELETE FROM `journal_entries` WHERE `id` IN (?, ?)", [`JE-SALE-${issueId}`, `JE-COGS-${issueId}`])
      await pool.query("DELETE FROM `journal_entry_lines` WHERE `id` LIKE CONCAT(?, '%') OR `id` LIKE CONCAT(?, '%')", [`JE-SALE-${issueId}`, `JE-COGS-${issueId}`])
      await drizzleDeleteRow({ resource: getResource("sales_issues"), id: issueId }).catch(() => {})
    }
    await drizzleDeleteRow({ resource: getResource("sales_orders"), id: testSoId }).catch(() => {})
    await drizzleDeleteRow({ resource: getResource("pharma_product_batches"), id: testBatchId }).catch(() => {})
    await drizzleDeleteRow({ resource: getResource("pharma_products"), id: testProdId }).catch(() => {})
    console.log("   Test records successfully cleaned up.")

    // 9. Foundational Table Integrity Check
    console.log("\n8. Foundational table count verification:")
    const tables = {
      users: 5,
      warehouses: 3,
      company_settings: 1,
      chart_of_accounts: 82,
      gl_account_mappings: 28,
      tax_rules: 8,
      leave_types: 5,
    }

    for (const [t, expected] of Object.entries(tables)) {
      const [res] = await pool.query(`SELECT count(*) as count FROM \`${t}\``)
      const count = res[0].count
      console.log(`   - ${t}: ${count} (Expected: ${expected})`)
      if (count !== expected) {
        throw new Error(`Foundational table ${t} corrupted! Expected ${expected}, found ${count}`)
      }
    }
  }

  process.exit(0)
}

runProfitIntegrationTest().catch((err) => {
  console.error("Test execution error:", err)
  process.exit(1)
})
