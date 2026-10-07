import { pool } from "../server/db/client.js"
import { syncInvoiceGLDistribution, saveBeginningBalances } from "../server/modules/finance/financeGlSync.js"
import { drizzleDeleteRow } from "../server/db/drizzleCrud.js"

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    failures++
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function run() {
  console.log("================================================================================")
  console.log("       MASTER VERIFICATION: ADMIN KPI PARITY, GL SYNC & CRUD ACID SUITE        ")
  console.log("================================================================================\n")

  // ---------------------------------------------------------------------------
  // TEST 1: Admin KPI Gross Profit & Metrics Calculation Parity
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Admin KPI Gross Profit & Metrics Calculation Parity ---")
  const [lines] = await pool.query(`
    SELECT jel.*, a.account_type 
    FROM journal_entry_lines jel 
    JOIN chart_of_accounts a ON jel.account_id = a.id
  `)

  let glRevenue = 0
  let glCogs = 0
  let glExpenses = 0

  for (const line of lines) {
    const debit = Number(line.debit_amount || 0)
    const credit = Number(line.credit_amount || 0)
    if (line.account_type === "Revenue") {
      glRevenue += (credit - debit)
    } else if (line.account_type === "Expense") {
      glExpenses += (debit - credit)
      if (line.account_id.startsWith("5000") || (line.account_code && line.account_code.startsWith("5000"))) {
        glCogs += (debit - credit)
      }
    }
  }

  const grossProfit = glRevenue - glCogs
  const grossMargin = glRevenue > 0 ? (grossProfit / glRevenue) * 100 : 0

  console.log(`Audited GL Revenue:     ${glRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })} ETB`)
  console.log(`Audited GL COGS:        ${glCogs.toLocaleString("en-US", { minimumFractionDigits: 2 })} ETB`)
  console.log(`Audited Gross Profit:   ${grossProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })} ETB`)
  console.log(`Audited Gross Margin:   ${grossMargin.toFixed(2)}%`)

  assert(glRevenue === 4993680, `GL Revenue matches expected audited figure (4,993,680.00 ETB)`)
  assert(Math.abs(glCogs - 4116899.22) < 0.01, `GL COGS matches expected audited figure (4,116,899.22 ETB)`)
  assert(Math.abs(grossProfit - 876780.78) < 0.01, `Gross Profit matches expected audited figure (876,780.78 ETB)`)
  assert(Math.abs(grossMargin - 17.56) < 0.05, `Gross Margin matches expected audited figure (17.56%)`)

  // ---------------------------------------------------------------------------
  // TEST 2: Invoice Split Modal & Sales Issue GL Re-Allocation (Atomic Replacement)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Invoice GL Distribution Atomic Line Replacement ---")
  const targetInvoiceId = "INV-SI-00000606"
  const targetJeId = "JE-SALE-00000606"

  // Capture original state
  const [originalLines] = await pool.query(
    "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?",
    [targetJeId]
  )
  const [originalInvRows] = await pool.query(
    "SELECT gl_distribution FROM invoices WHERE id = ?",
    [targetInvoiceId]
  )
  const [originalSiRows] = await pool.query(
    "SELECT account_entries FROM sales_issues WHERE id = '00000606'"
  )

  try {
    // Perform split: 200,000 to 4000-01, 109,000 to 4000-02 (Debit AR 309,000)
    const splitPayload = {
      revenueLines: [
        {
          id: `JEL-${targetJeId}-DR-1`,
          account_id: "1200-01",
          account_code: "1200-01",
          account_name: "ACCOUNTS RECEIVABLE",
          debit: 309000.0,
          credit: 0.0,
          description: "Accounts Receivable",
        },
        {
          id: `JEL-${targetJeId}-CR-1`,
          account_id: "4000-01",
          account_code: "4000-01",
          account_name: "SALES REVENUE - MAIN",
          debit: 0.0,
          credit: 200000.0,
          description: "Sales Revenue Primary Split",
        },
        {
          id: `JEL-${targetJeId}-CR-2`,
          account_id: "4000-02",
          account_code: "4000-02",
          account_name: "SALES REVENUE - SECONDARY",
          debit: 0.0,
          credit: 109000.0,
          description: "Sales Revenue Secondary Split",
        },
      ],
      cogsLines: [],
      notes: "Verification split test",
      salesIssueId: "00000606",
    }

    const splitRes = await syncInvoiceGLDistribution(targetInvoiceId, splitPayload)
    assert(splitRes.status === 200, "syncInvoiceGLDistribution returned 200 OK")

    // Verify lines in MySQL
    const [updatedLines] = await pool.query(
      "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?",
      [targetJeId]
    )
    assert(updatedLines.length === 3, `Old lines purged and exactly 3 new lines exist (found ${updatedLines.length})`)

    const totalDebits = updatedLines.reduce((s, l) => s + Number(l.debit_amount), 0)
    const totalCredits = updatedLines.reduce((s, l) => s + Number(l.credit_amount), 0)
    assert(totalDebits === 309000 && totalCredits === 309000, `Double-entry balance verified: Debits == Credits (309,000.00 ETB, 0.00 variance)`)

    // Verify bidirectional sync to sales_issues
    const [siRows] = await pool.query(
      "SELECT account_entries FROM sales_issues WHERE id = '00000606'"
    )
    const siEntries = typeof siRows[0].account_entries === "string" 
      ? JSON.parse(siRows[0].account_entries) 
      : siRows[0].account_entries
    assert(siEntries && siEntries.credit_lines && siEntries.credit_lines.length === 2, "sales_issues.account_entries reflect updated split lines bidirectionally")

  } finally {
    // Guaranteed restore of original lines and state
    console.log("Restoring original GL lines for 00000606...")
    await pool.query("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [targetJeId])
    for (const line of originalLines) {
      await pool.query(
        `INSERT INTO journal_entry_lines 
         (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, currency, exchange_rate_at_time, warehouse_id, party_type, party_id, party_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          line.id,
          line.journal_entry_id,
          line.account_id,
          line.account_code,
          line.account_name,
          line.description,
          line.debit_amount,
          line.credit_amount,
          line.currency,
          line.exchange_rate_at_time,
          line.warehouse_id,
          line.party_type,
          line.party_id,
          line.party_name,
        ]
      )
    }
    await pool.query("UPDATE invoices SET gl_distribution = ? WHERE id = ?", [
      originalInvRows[0].gl_distribution ? JSON.stringify(originalInvRows[0].gl_distribution) : null,
      targetInvoiceId,
    ])
    await pool.query("UPDATE sales_issues SET account_entries = ? WHERE id = '00000606'", [
      originalSiRows[0].account_entries ? JSON.stringify(originalSiRows[0].account_entries) : null,
    ])
    console.log("Original GL state restored cleanly.")
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Maintain COA Beginning Balances (Atomic Line Replacement)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Maintain COA Beginning Balances Atomic Replacement ---")
  const bbJeId = "JE-OPENING-BALANCES"

  try {
    // 1. Post initial balance: 2 accounts
    const initialPayload = {
      asOfDate: "2026-01-01",
      balances: [
        { account_id: "1000-01", debit_amount: 50000, credit_amount: 0 },
        { account_id: "3000-01", debit_amount: 0, credit_amount: 50000 },
      ],
      notes: "Initial Cutover Verification",
      created_by: "Verification Admin",
    }
    const bbRes1 = await saveBeginningBalances(initialPayload)
    assert(bbRes1.status === 200, "First saveBeginningBalances returned 200 OK")

    const [bbLines1] = await pool.query(
      "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?",
      [bbJeId]
    )
    assert(bbLines1.length === 2, `Initial save created exactly 2 lines (found ${bbLines1.length})`)

    // 2. Re-post updated balance: 3 accounts (testing line purge and replacement)
    const updatePayload = {
      asOfDate: "2026-01-01",
      balances: [
        { account_id: "1000-01", debit_amount: 30000, credit_amount: 0 },
        { account_id: "1000-02", debit_amount: 20000, credit_amount: 0 },
        { account_id: "3000-01", debit_amount: 0, credit_amount: 50000 },
      ],
      notes: "Updated Cutover Verification",
      created_by: "Verification Admin",
    }
    const bbRes2 = await saveBeginningBalances(updatePayload)
    assert(bbRes2.status === 200, "Second saveBeginningBalances returned 200 OK")

    const [bbLines2] = await pool.query(
      "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?",
      [bbJeId]
    )
    assert(bbLines2.length === 3, `Re-posting purged old lines and inserted exactly 3 lines (found ${bbLines2.length}, 0 duplicate lines)`)

    const bbDebits = bbLines2.reduce((s, l) => s + Number(l.debit_amount), 0)
    const bbCredits = bbLines2.reduce((s, l) => s + Number(l.credit_amount), 0)
    assert(bbDebits === 50000 && bbCredits === 50000, "Beginning balance double-entry verified (0.00 ETB variance)")

  } finally {
    // Guaranteed cleanup of opening balances test entries
    await pool.query("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [bbJeId])
    await pool.query("DELETE FROM journal_entries WHERE id = ?", [bbJeId])
    console.log("Beginning balances test entries completely cleaned up.")
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Invoice Cascade Deletion ACID Compliance
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Invoice Cascade Deletion ACID Hardening ---")
  const tempInvId = "VERIFY-CASCADE-INV-001"
  const tempJeId = `JE-SALE-${tempInvId}`

  try {
    // Create temporary invoice and linked journal entry
    await pool.query(
      `INSERT INTO invoices (id, invoice_number, customer_name, total_amount, status)
       VALUES (?, ?, 'Verification Customer', 1000.00, 'Draft')`,
      [tempInvId, tempInvId]
    )
    await pool.query(
      `INSERT INTO journal_entries (id, entry_date, description, source_type, source_id, created_by, total_amount)
       VALUES (?, '2026-10-08', 'Verification Invoice Entry', 'Sales Invoice', ?, 'Verification Admin', 1000.00)`,
      [tempJeId, tempInvId]
    )
    await pool.query(
      `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit_amount, credit_amount)
       VALUES (?, ?, '1200-01', 1000.00, 0.00)`,
      [`${tempJeId}-L1`, tempJeId]
    )

    // Call drizzleDeleteRow for invoices
    const delRes = await drizzleDeleteRow({
      resource: { table: "invoices" },
      id: tempInvId,
    })
    assert(delRes.status === 200, "drizzleDeleteRow for invoice returned 200 OK")

    // Verify invoice is gone
    const [invCheck] = await pool.query("SELECT id FROM invoices WHERE id = ?", [tempInvId])
    assert(invCheck.length === 0, "Invoice row deleted from invoices table")

    // Verify linked journal entry is cascade-deleted
    const [jeCheck] = await pool.query("SELECT id FROM journal_entries WHERE id = ?", [tempJeId])
    assert(jeCheck.length === 0, "Linked journal entry cascade-deleted from journal_entries table")

    // Verify linked lines are cascade-deleted
    const [jelCheck] = await pool.query("SELECT id FROM journal_entry_lines WHERE journal_entry_id = ?", [tempJeId])
    assert(jelCheck.length === 0, "Linked journal entry lines cascade-deleted from journal_entry_lines table (0 orphans)")

  } finally {
    // Extra safety cleanup
    await pool.query("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [tempJeId])
    await pool.query("DELETE FROM journal_entries WHERE id = ?", [tempJeId])
    await pool.query("DELETE FROM invoices WHERE id = ?", [tempInvId])
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Strict Zero Test Records Audit Across All 35 Tables
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Zero Test Records Audit Across All Database Tables ---")
  const [tables] = await pool.query("SHOW TABLES")
  let testRecordsFound = 0

  for (const row of tables) {
    const table = Object.values(row)[0]
    const [cols] = await pool.query(`DESCRIBE \`${table}\``)
    const idOrNameCols = cols
      .filter((c) => /id|name|code|title|description|order_number|invoice_number|status/i.test(c.Field) && /char|text/i.test(c.Type))
      .map((c) => c.Field)

    if (idOrNameCols.length === 0) continue

    const whereClauses = idOrNameCols.map((c) => `LOWER(\`${c}\`) LIKE "%test%"`).join(" OR ")
    const [matches] = await pool.query(`SELECT * FROM \`${table}\` WHERE ${whereClauses}`)

    // Filter out the known real customer CUST-3174 with uploaded file test_license.pdf
    const realMatches = table === "customers"
      ? matches.filter((m) => m.id !== "CUST-3174")
      : matches

    if (realMatches.length > 0) {
      testRecordsFound += realMatches.length
      console.error(`🚨 Found ${realMatches.length} test records in table ${table}!`)
    }
  }

  assert(testRecordsFound === 0, `Zero test records found across all 35 database tables (exact count: 0)`)

  console.log("\n================================================================================")
  if (failures === 0) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY WITH 100% ACID & PARITY COMPLIANCE!")
  } else {
    console.error(`❌ ${failures} TEST(S) FAILED!`)
  }
  console.log("================================================================================\n")

  await pool.end()
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((err) => {
  console.error("FATAL ERROR IN VERIFICATION:", err)
  process.exit(1)
})
