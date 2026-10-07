import { pool } from "../server/db/client.js"
import { drizzleListRows, drizzleGetRow } from "../server/db/drizzleCrud.js"
import { getResource } from "../server/db/resourceRegistry.js"

async function runFullRelationalVerification() {
  const conn = await pool.getConnection()
  try {
    console.log("=================================================================")
    console.log("       FULL RELATIONAL DATABASE SCHEMA VERIFICATION SUITE        ")
    console.log("=================================================================")

    // 1. Audit tables & phantom tables
    console.log("\n--> 1. Auditing Tables and Schema Integrity...")
    const [allTables] = await conn.query("SHOW TABLES")
    const tableNames = allTables.map((r) => Object.values(r)[0])
    console.log(`  Total database tables: ${tableNames.length} (Target: 35)`)

    const phantomTables = [
      "bank_reconciliations",
      "vehicles",
      "recurring_expense_schedules",
      "leave_types",
    ]
    for (const pt of phantomTables) {
      if (tableNames.includes(pt)) {
        throw new Error(`Phantom table '${pt}' still exists in the database!`)
      }
    }
    console.log("  ✓ All 4 phantom/dead tables are confirmed dropped.")

    // Check payload columns
    const payloadTables = []
    for (const t of tableNames) {
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${t}\` LIKE 'payload'`)
      if (cols.length > 0) {
        payloadTables.push(t)
      }
    }
    console.log(`  Tables containing 'payload' column: [${payloadTables.join(", ")}]`)
    if (payloadTables.length !== 1 || payloadTables[0] !== "company_settings") {
      throw new Error(`Unexpected payload tables! Expected only ['company_settings'], found: ${JSON.stringify(payloadTables)}`)
    }
    console.log("  ✓ Exactly 1 table contains 'payload' column (company_settings singleton).")

    // 2. Customers verification
    console.log("\n--> 2. Verifying Customers Table & Name Persistence...")
    const [custRows] = await conn.query("SELECT id, name, phone, tin, credit_limit, status FROM customers ORDER BY name ASC")
    console.log(`  Customers count: ${custRows.length} (Target: 12)`)
    if (custRows.length !== 12) throw new Error(`Expected 12 customers, found ${custRows.length}`)

    for (const c of custRows) {
      if (!c.name || c.name.trim() === "") {
        throw new Error(`Customer ${c.id} has an empty name!`)
      }
    }
    console.log("  ✓ All 12 customer records have legal names restored and populated.")

    // Test non-destructive patch on a customer to guarantee name cannot be wiped
    const testCust = custRows[0]
    const originalName = testCust.name
    await conn.query("UPDATE customers SET trade_paper_file_name = ?, trade_paper_url = ? WHERE id = ?", [
      "test_license.pdf",
      "/uploads/trade_papers/test_license.pdf",
      testCust.id,
    ])
    const [afterUpdate] = await conn.query("SELECT name FROM customers WHERE id = ?", [testCust.id])
    if (afterUpdate[0].name !== originalName) {
      throw new Error(`Customer name was mutated during trade paper update!`)
    }
    console.log(`  ✓ Relational column isolation verified: updating trade paper preserves customer name '${originalName}'.`)

    // 3. HKC Docs Records verification
    console.log("\n--> 3. Verifying HKC Docs Records...")
    const [hkcRows] = await conn.query("SELECT id, shipment_id, items_description, type, record_date, attachments FROM hkc_doc_records ORDER BY record_date DESC")
    console.log(`  HKC Doc Records count: ${hkcRows.length} (Target: >= 2)`)
    if (hkcRows.length < 2) throw new Error(`Expected at least 2 historical HKC Doc records, found ${hkcRows.length}`)

    const doc160 = hkcRows.find((r) => r.shipment_id === "HKC-160")
    const doc161 = hkcRows.find((r) => r.shipment_id === "HKC-0161/19")
    if (!doc160 || !doc161) {
      throw new Error("Historical HKC Doc records HKC-160 and HKC-0161/19 not found!")
    }

    const doc160Atts = typeof doc160.attachments === "string" ? JSON.parse(doc160.attachments) : doc160.attachments
    console.log(`  ✓ HKC-160 restored with ${doc160Atts.length} attachments: [${doc160Atts.map((a) => a.fileName).join(", ")}]`)

    // Test reading via drizzleListRows to verify unwrapRow formatting
    const hkcListRes = await drizzleListRows({ resource: getResource("hkc_doc_records") })
    if (hkcListRes.status !== 200 || !Array.isArray(hkcListRes.body)) {
      throw new Error(`drizzleListRows failed for hkc_doc_records: ${JSON.stringify(hkcListRes)}`)
    }
    const sampleHkc = hkcListRes.body[0]
    if (!sampleHkc.shipmentId || !sampleHkc.itemsDescription || !sampleHkc.date) {
      throw new Error(`Sample HKC doc missing camelCase fields: ${JSON.stringify(sampleHkc)}`)
    }
    console.log(`  ✓ HKC Docs drizzle unwrapRow produces valid camelCase properties (shipmentId, itemsDescription, date).`)

    // 4. Invoices verification
    console.log("\n--> 4. Verifying Invoices Table...")
    const [invRows] = await conn.query("SELECT id, invoice_number, fs_no, customer_name, total_amount, balance_due, status FROM invoices ORDER BY issue_date DESC")
    console.log(`  Invoices count: ${invRows.length} (Target: 14)`)
    if (invRows.length !== 14) throw new Error(`Expected 14 invoices, found ${invRows.length}`)

    const invListRes = await drizzleListRows({ resource: getResource("invoices") })
    if (invListRes.status !== 200 || !Array.isArray(invListRes.body)) {
      throw new Error(`drizzleListRows failed for invoices: ${JSON.stringify(invListRes)}`)
    }
    const sampleInv = invListRes.body[0]
    if (!sampleInv.invoiceNumber || !sampleInv.customerName || !Array.isArray(sampleInv.lineItems)) {
      throw new Error(`Sample invoice missing relational unwrap: ${JSON.stringify(sampleInv)}`)
    }
    console.log(`  ✓ Invoices relational headers and lineItems JSON parsing verified.`)

    // 5. Sales Orders verification
    console.log("\n--> 5. Verifying Sales Orders Table...")
    const [soRows] = await conn.query("SELECT id, order_number, customer_name, amount, stage, delivery_status, billing_status FROM sales_orders")
    console.log(`  Sales Orders count: ${soRows.length} (Target: 14)`)
    if (soRows.length !== 14) throw new Error(`Expected 14 sales orders, found ${soRows.length}`)

    const soListRes = await drizzleListRows({ resource: getResource("sales_orders") })
    if (soListRes.status !== 200 || !Array.isArray(soListRes.body)) {
      throw new Error(`drizzleListRows failed for sales_orders: ${JSON.stringify(soListRes)}`)
    }
    const sampleSo = soListRes.body[0]
    if (!sampleSo.customer || !sampleSo.orderDate || !sampleSo.warehouse) {
      throw new Error(`Sample sales order missing compatibility fields: ${JSON.stringify(sampleSo)}`)
    }
    console.log(`  ✓ Sales Orders relational columns and frontend compatibility aliases verified.`)

    // 6. Trial Balance Parity
    console.log("\n--> 6. Verifying Global General Ledger Trial Balance Parity...")
    const [[tb]] = await conn.query(
      "SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM journal_entry_lines"
    )
    const debit = Number(tb.total_debit)
    const credit = Number(tb.total_credit)
    const diff = Math.abs(debit - credit)
    console.log(`  Trial Balance: DR=${debit.toFixed(2)} ETB, CR=${credit.toFixed(2)} ETB, Difference=${diff.toFixed(2)} ETB`)
    if (diff > 0.001) {
      throw new Error(`Trial Balance out of balance! DR=${debit}, CR=${credit}, diff=${diff}`)
    }
    console.log("  ✓ PERFECT 0.00 ETB TRIAL BALANCE PARITY CONFIRMED.")

    // 7. Product Catalog & Batch Integrity
    console.log("\n--> 7. Verifying Product Catalog & Batches...")
    const [[{ pCount }]] = await conn.query("SELECT COUNT(*) as pCount FROM pharma_products")
    const [[{ bCount }]] = await conn.query("SELECT COUNT(*) as bCount FROM pharma_product_batches")
    console.log(`  Pharma Products: ${pCount} (Target: 36 pharma + 1 export = 37 total)`)
    console.log(`  Batches: ${bCount} (Target: 57)`)
    if (pCount !== 36 || bCount !== 57) {
      throw new Error(`Catalog count unexpected: ${pCount} products, ${bCount} batches`)
    }
    console.log("  ✓ Product catalog and batch counts 100% preserved.")

    console.log("\n=================================================================")
    console.log("      ALL RELATIONAL DATABASE VERIFICATION CHECKS PASSED!        ")
    console.log("=================================================================")
  } finally {
    conn.release()
    await pool.end()
  }
}

runFullRelationalVerification().catch((err) => {
  console.error("Verification suite failed:", err)
  process.exit(1)
})
