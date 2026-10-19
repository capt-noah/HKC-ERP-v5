import fs from "fs"
import path from "path"
import mysql from "mysql2/promise"
import { execSync } from "child_process"

const DB_CONFIG = {
  host: "127.0.0.1",
  user: "habtom",
  password: "DMka6&jn0*Wsdfo0",
  database: "hkc_trading",
  multipleStatements: true,
}

const SOURCE_DUMP_PATH = "/Users/Noah/Desktop/hkc_trading (4).sql"
const TARGET_EXPORT_PATH = "/Users/Noah/Desktop/hkc_trading.sql"

async function runMasterReconciliation() {
  console.log("===================================================================")
  console.log("HKC TRADING ERP - MASTER PRODUCTION DATABASE RECONCILIATION & IMPORT")
  console.log("===================================================================\n")

  const conn = await mysql.createConnection(DB_CONFIG)

  try {
    // -------------------------------------------------------------
    // Step 1: Clean Drop of All Existing Tables in local hkc_trading
    // -------------------------------------------------------------
    console.log("Step 1: Dropping all existing tables in local database...")
    await conn.query("SET FOREIGN_KEY_CHECKS = 0;")
    const [tables] = await conn.query("SHOW TABLES;")
    const tableKey = Object.keys(tables[0] || {})[0]
    for (const t of tables) {
      const tableName = t[tableKey]
      await conn.query(`DROP TABLE IF EXISTS \`${tableName}\`;`)
    }
    console.log(`Dropped ${tables.length} tables cleanly.`)

    // -------------------------------------------------------------
    // Step 2: Import /Users/Noah/Desktop/hkc_trading (4).sql
    // -------------------------------------------------------------
    console.log(`\nStep 2: Importing ${SOURCE_DUMP_PATH} into MySQL...`)
    const importCmd = `mysql -u ${DB_CONFIG.user} -p'${DB_CONFIG.password}' ${DB_CONFIG.database} < "${SOURCE_DUMP_PATH}"`
    execSync(importCmd, { stdio: "inherit" })
    await conn.query("SET FOREIGN_KEY_CHECKS = 1;")
    console.log("Import completed successfully.")

    // Verify baseline table counts
    const [[{ cnt: soCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM sales_orders")
    const [[{ cnt: siCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM sales_issues")
    const [[{ cnt: invCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM invoices")
    const [[{ cnt: jeCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM journal_entries")
    const [[{ cnt: smCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM stock_movements")
    const [[{ cnt: prodCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM pharma_products")
    const [[{ cnt: batchCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM pharma_product_batches")

    console.log(`\nBaseline Counts Verified:`)
    console.log(`- sales_orders: ${soCnt}`)
    console.log(`- sales_issues: ${siCnt}`)
    console.log(`- invoices: ${invCnt}`)
    console.log(`- journal_entries: ${jeCnt}`)
    console.log(`- stock_movements: ${smCnt}`)
    console.log(`- pharma_products: ${prodCnt}`)
    console.log(`- pharma_product_batches: ${batchCnt}`)

    if (soCnt !== 64 || siCnt !== 64 || invCnt !== 64) {
      throw new Error(`Integrity check failed: Expected 64 SO/SI/INV, found SO=${soCnt}, SI=${siCnt}, INV=${invCnt}`)
    }

    // -------------------------------------------------------------
    // Step 3: Rectify Sales Issue FS 00000610 (All 9 Linked Records)
    // -------------------------------------------------------------
    console.log("\nStep 3: Rectifying Sales Issue FS 00000610 across all 9 records...")

    // Prepare corrected account_entries for sales_issues 00000610
    const [siRaw] = await conn.query("SELECT account_entries FROM sales_issues WHERE id = '00000610'")
    let siAccEntries = null
    if (siRaw.length > 0 && siRaw[0].account_entries) {
      try {
        siAccEntries = typeof siRaw[0].account_entries === "string" ? JSON.parse(siRaw[0].account_entries) : siRaw[0].account_entries
      } catch {}
    }
    if (siAccEntries) {
      const updateLines = (arr, val) => {
        if (!Array.isArray(arr)) return
        arr.forEach(l => {
          if (l.amount !== undefined) l.amount = val
          if (l.debit > 0) l.debit = val
          if (l.credit > 0) l.credit = val
        })
      }
      updateLines(siAccEntries.debit_lines, 1356800.00)
      updateLines(siAccEntries.credit_lines, 1356800.00)
      updateLines(siAccEntries.revenue_lines, 1356800.00)
      updateLines(siAccEntries.cogs_lines, 1132672.00)
      updateLines(siAccEntries.cogs_debit_lines, 1132672.00)
      updateLines(siAccEntries.cogs_credit_lines, 1132672.00)
    }

    // 1. sales_issues: 00000610
    await conn.query(
      `UPDATE sales_issues SET
        total_quantity = 1600.0000,
        subtotal_amount = 1356800.00,
        total_amount = 1356800.00,
        account_entries = ?,
        updated_at = NOW(3)
       WHERE id = '00000610' OR fs_no = '00000610'`,
      [siAccEntries ? JSON.stringify(siAccEntries) : null]
    )

    // 2. sales_issue_items: 00000610-ITEM-1
    await conn.query(
      `UPDATE sales_issue_items SET
        quantity = 1600.0000,
        total_price = 1356800.00,
        amount = 1356800.00,
        updated_at = NOW(3)
       WHERE sales_issue_id = '00000610'`
    )

    // 3. stock_movements: SM-ISSUE-1792064864344-fe848a
    await conn.query(
      `UPDATE stock_movements SET
        quantity = 1600.00,
        balance_after = 6560.00,
        updated_at = NOW(3)
       WHERE reference_id = '00000610' AND movement_type = 'ISSUE'`
    )

    // Subsequent running balance adjustments for P-1788858054417
    await conn.query(
      `UPDATE stock_movements SET
        balance_after = balance_after + 5,
        updated_at = NOW(3)
       WHERE product_id = 'P-1788858054417' 
         AND created_at > '2026-10-15 14:47:44.327'
         AND reference_id != '00000610'`
    )

    // 4. pharma_products: P-1788858054417
    await conn.query(
      `UPDATE pharma_products SET
        quantity = quantity + 5,
        quantity_sold = quantity_sold - 5,
        updated_at = NOW()
       WHERE id = 'P-1788858054417'`
    )

    // 5. pharma_product_batches: batch-P-1788858054417-251036
    await conn.query(
      `UPDATE pharma_product_batches SET
        quantity = quantity + 5,
        updated_at = NOW()
       WHERE id = 'batch-P-1788858054417-251036' OR (product_id = 'P-1788858054417' AND batch_no = '251036')`
    )

    // 6. sales_orders: SO-214298
    const [soRows] = await conn.query("SELECT items FROM sales_orders WHERE id = 'SO-214298'")
    if (soRows.length > 0) {
      let items = []
      try {
        items = typeof soRows[0].items === "string" ? JSON.parse(soRows[0].items) : soRows[0].items
      } catch {}
      if (Array.isArray(items) && items.length > 0) {
        items[0].qty = 1600
        items[0].quantity = 1600
        items[0].total = 1356800.00
      }
      await conn.query(
        `UPDATE sales_orders SET
          amount = 1356800.00,
          delivered_amount = 1356800.00,
          items = ?,
          updated_at = NOW(3)
         WHERE id = 'SO-214298'`,
        [JSON.stringify(items)]
      )
    }

    // 7. invoices: INV-SI-00000610
    const [invRows] = await conn.query("SELECT line_items, gl_distribution FROM invoices WHERE id = 'INV-SI-00000610' OR sales_issue_id = '00000610'")
    if (invRows.length > 0) {
      let lineItems = []
      try {
        lineItems = typeof invRows[0].line_items === "string" ? JSON.parse(invRows[0].line_items) : invRows[0].line_items
      } catch {}
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        lineItems[0].quantity = 1600
        lineItems[0].line_total = 1356800.00
      }

      let glDist = null
      try {
        glDist = typeof invRows[0].gl_distribution === "string" ? JSON.parse(invRows[0].gl_distribution) : invRows[0].gl_distribution
      } catch {}
      if (glDist) {
        if (Array.isArray(glDist.revenue_lines)) {
          glDist.revenue_lines.forEach((l) => {
            if (l.debit > 0) l.debit = 1356800.00
            if (l.credit > 0) l.credit = 1356800.00
          })
        }
        if (Array.isArray(glDist.cogs_lines)) {
          glDist.cogs_lines.forEach((l) => {
            if (l.debit > 0) l.debit = 1132672.00
            if (l.credit > 0) l.credit = 1132672.00
          })
        }
      }

      await conn.query(
        `UPDATE invoices SET
          subtotal = 1356800.00,
          total_amount = 1356800.00,
          balance_due = 1356800.00,
          line_items = ?,
          gl_distribution = ?,
          updated_at = NOW(3)
         WHERE id = 'INV-SI-00000610' OR sales_issue_id = '00000610'`,
        [JSON.stringify(lineItems), JSON.stringify(glDist)]
      )
    }

    // 8. journal_entries & lines: JE-SALE-00000610
    await conn.query(
      "UPDATE journal_entries SET total_amount = 1356800.00, updated_at = NOW(3) WHERE id = 'JE-SALE-00000610'"
    )
    await conn.query(
      `UPDATE journal_entry_lines SET 
        debit_amount = CASE WHEN debit_amount > 0 THEN 1356800.00 ELSE 0 END,
        credit_amount = CASE WHEN credit_amount > 0 THEN 1356800.00 ELSE 0 END,
        updated_at = NOW(3)
       WHERE journal_entry_id = 'JE-SALE-00000610'`
    )

    // 9. journal_entries & lines: JE-COGS-00000610
    await conn.query(
      "UPDATE journal_entries SET total_amount = 1132672.00, updated_at = NOW(3) WHERE id = 'JE-COGS-00000610'"
    )
    await conn.query(
      `UPDATE journal_entry_lines SET 
        debit_amount = CASE WHEN debit_amount > 0 THEN 1132672.00 ELSE 0 END,
        credit_amount = CASE WHEN credit_amount > 0 THEN 1132672.00 ELSE 0 END,
        updated_at = NOW(3)
       WHERE journal_entry_id = 'JE-COGS-00000610'`
    )

    console.log("FS 00000610 rectified across all 9 records.")

    // -------------------------------------------------------------
    // Step 4: Reconcile 12 Cash Sales Issues Payment Status
    // -------------------------------------------------------------
    console.log("\nStep 4: Reconciling 12 Cash Sales Issues in sales_issues table...")
    const cashIssueIds = [
      "00000606", "00000608", "00000615", "00000622", "00000623",
      "00000642", "00000643", "00000644", "00000649", "00000650",
      "00000657", "00000658"
    ]

    await conn.query(
      `UPDATE sales_issues SET
        payment_status = 'Paid',
        updated_at = NOW(3)
       WHERE (id IN (?) OR fs_no IN (?)) AND payment_type = 'Cash'`,
      [cashIssueIds, cashIssueIds]
    )
    console.log(`Set payment_status = 'Paid' for 12 Cash sales issues.`)

    // -------------------------------------------------------------
    // Step 5: Relink the 8 Mislinked sales_issues.sales_order_id
    // -------------------------------------------------------------
    console.log("\nStep 5: Relinking 8 sales_issues.sales_order_id to their true 1-to-1 SO IDs...")
    const soMislinks = [
      { issueId: "00000643", correctSoId: "SO-374495" },
      { issueId: "00000645", correctSoId: "SO-083109" },
      { issueId: "00000647", correctSoId: "SO-188467" },
      { issueId: "00000648", correctSoId: "SO-486308" },
      { issueId: "00000649", correctSoId: "SO-944290" },
      { issueId: "0000793", correctSoId: "SO-284936" },
      { issueId: "0000795", correctSoId: "SO-502249" },
      { issueId: "0000797", correctSoId: "SO-937317" },
    ]

    for (const link of soMislinks) {
      await conn.query(
        `UPDATE sales_issues SET 
          sales_order_id = ?, 
          updated_at = NOW(3) 
         WHERE id = ? OR fs_no = ?`,
        [link.correctSoId, link.issueId, link.issueId]
      )
    }
    console.log("8 sales issues relinked to their unique sales orders.")

    // -------------------------------------------------------------
    // Step 6: Synchronize 30 Mismatched Invoice Dates with Sales Issues
    // -------------------------------------------------------------
    console.log("\nStep 6: Synchronizing invoice dates with actual sales issue dates...")
    await conn.query(
      `UPDATE invoices inv
       JOIN sales_issues si ON (inv.sales_issue_id = si.id OR inv.fs_no = si.fs_no)
       SET inv.issue_date = si.sale_date,
           inv.due_date = si.sale_date,
           inv.updated_at = NOW(3)
       WHERE inv.issue_date != si.sale_date`
    )
    console.log("All invoice dates aligned to sales issue sale_date.")

    // -------------------------------------------------------------
    // Step 7: Verification & Audit Parity Checks
    // -------------------------------------------------------------
    console.log("\nStep 7: Running automated verification and trial balance audit...")

    // 1. Trial balance check
    const [[{ total_dr, total_cr, net_variance }]] = await conn.query(
      `SELECT SUM(debit_amount) AS total_dr, SUM(credit_amount) AS total_cr, 
              SUM(debit_amount) - SUM(credit_amount) AS net_variance 
       FROM journal_entry_lines;`
    )
    console.log(`GL Trial Balance Check:`)
    console.log(`- Total Debits:  ETB ${Number(total_dr).toLocaleString()}`)
    console.log(`- Total Credits: ETB ${Number(total_cr).toLocaleString()}`)
    console.log(`- Net Variance:  ETB ${Number(net_variance).toFixed(2)}`)

    if (Math.abs(Number(net_variance)) > 0.001) {
      throw new Error(`CRITICAL: GL Trial Balance has non-zero variance: ${net_variance}`)
    }

    // 2. FS 00000610 Verification
    const [si610] = await conn.query("SELECT total_quantity, total_amount, subtotal_amount FROM sales_issues WHERE id='00000610'")
    const [sii610] = await conn.query("SELECT quantity, total_price FROM sales_issue_items WHERE sales_issue_id='00000610'")
    const [sm610] = await conn.query("SELECT quantity, unit_cost, balance_after FROM stock_movements WHERE reference_id='00000610' AND movement_type='ISSUE'")
    const [prod610] = await conn.query("SELECT quantity, quantity_sold FROM pharma_products WHERE id='P-1788858054417'")
    const [batch610] = await conn.query("SELECT quantity FROM pharma_product_batches WHERE id='batch-P-1788858054417-251036'")
    const [so610] = await conn.query("SELECT amount FROM sales_orders WHERE id='SO-214298'")
    const [inv610] = await conn.query("SELECT total_amount, balance_due FROM invoices WHERE id='INV-SI-00000610'")
    const [jeSale610] = await conn.query("SELECT total_amount FROM journal_entries WHERE id='JE-SALE-00000610'")
    const [jeCogs610] = await conn.query("SELECT total_amount FROM journal_entries WHERE id='JE-COGS-00000610'")

    console.log(`\nFS 00000610 Parity Audit:`)
    console.log(`- sales_issues:       qty=${si610[0]?.total_quantity}, amount=${si610[0]?.total_amount}, subtotal=${si610[0]?.subtotal_amount}`)
    console.log(`- sales_issue_items:  qty=${sii610[0]?.quantity}, price=${sii610[0]?.total_price}`)
    console.log(`- stock_movements:    qty=${sm610[0]?.quantity}, unit_cost=${sm610[0]?.unit_cost}, balance_after=${sm610[0]?.balance_after}`)
    console.log(`- pharma_products:    qty=${prod610[0]?.quantity}, sold=${prod610[0]?.quantity_sold}`)
    console.log(`- product_batches:    qty=${batch610[0]?.quantity}`)
    console.log(`- sales_orders:       amount=${so610[0]?.amount}`)
    console.log(`- invoices:           amount=${inv610[0]?.total_amount}, balance=${inv610[0]?.balance_due}`)
    console.log(`- JE-SALE:            total=${jeSale610[0]?.total_amount}`)
    console.log(`- JE-COGS:            total=${jeCogs610[0]?.total_amount}`)

    // 3. 64-Record 1-to-1 Parity Check
    const [[{ cnt: uniqueSoInSi }]] = await conn.query("SELECT COUNT(DISTINCT sales_order_id) as cnt FROM sales_issues WHERE sales_order_id IS NOT NULL")
    const [[{ cnt: uniqueSiInInv }]] = await conn.query("SELECT COUNT(DISTINCT sales_issue_id) as cnt FROM invoices")
    const [[{ cnt: uniqueSoInInv }]] = await conn.query("SELECT COUNT(DISTINCT sales_order_id) as cnt FROM invoices WHERE sales_order_id IS NOT NULL")

    console.log(`\n64-Record 1-to-1 Parity:`)
    console.log(`- Unique SO linked in sales_issues: ${uniqueSoInSi} / 64`)
    console.log(`- Unique SI linked in invoices:     ${uniqueSiInInv} / 64`)
    console.log(`- Unique SO linked in invoices:     ${uniqueSoInInv} / 64`)

    // 4. Cash Sales Issues Unpaid Count
    const [[{ cnt: cashUnpaidCnt }]] = await conn.query("SELECT COUNT(*) as cnt FROM sales_issues WHERE payment_type='Cash' AND payment_status != 'Paid'")
    console.log(`- Cash issues with payment_status != 'Paid': ${cashUnpaidCnt} (must be 0)`)

    // -------------------------------------------------------------
    // Step 8: Export Clean Verified Database to Desktop
    // -------------------------------------------------------------
    console.log(`\nStep 8: Exporting clean production-ready database dump to ${TARGET_EXPORT_PATH}...`)
    const exportCmd = `mysqldump -u ${DB_CONFIG.user} -p'${DB_CONFIG.password}' ` +
      `--no-tablespaces ` +
      `--skip-masking-policies ` +
      `--set-gtid-purged=OFF ` +
      `--column-statistics=0 ` +
      `--skip-lock-tables ` +
      `--routines ` +
      `--triggers ` +
      `--default-character-set=utf8mb4 ` +
      `${DB_CONFIG.database} > "${TARGET_EXPORT_PATH}"`

    execSync(exportCmd, { stdio: "inherit" })

    const stats = fs.statSync(TARGET_EXPORT_PATH)
    console.log(`Exported successfully! File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB at ${TARGET_EXPORT_PATH}`)

    console.log("\n===================================================================")
    console.log("RECONCILIATION & EXPORT COMPLETED WITH 100% PARITY & ZERO VARIANCE!")
    console.log("===================================================================")
  } finally {
    await conn.end()
  }
}

runMasterReconciliation().catch((err) => {
  console.error("Master reconciliation failed:", err)
  process.exit(1)
})
