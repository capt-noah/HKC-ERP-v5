/**
 * HKC ERP v5 - Batch Historical Cost & General Ledger Synchronization Script
 * 
 * Target: WH1 (Agricultural Export Hub) - GREEN MUNG (P-1789991499832, SKU: GRE-WH1)
 * Purpose:
 *   1. Assigns historical purchase cost prices to the 18 child Goods Receiving Vouchers (GRVs).
 *   2. Recalculates weighted average unit cost and total inventory valuation on the parent product.
 *   3. Generates 18 balanced historical Journal Entries and 36 Journal Entry Lines.
 *   4. Strictly preserves historical date fidelity (entry_date and created_at match original movement dates).
 *   5. Guarantees 0.00 ETB trial balance discrepancy and full double-entry GL integrity.
 * 
 * Usage:
 *   Dry-Run (Simulate without committing):
 *     node scripts/batch_update_green_mung_costs_and_gl.mjs --dry-run
 * 
 *   Live Execution with Uniform Price:
 *     node scripts/batch_update_green_mung_costs_and_gl.mjs --live --uniform-price=5250
 * 
 *   Live Execution with Distinct Voucher Prices JSON:
 *     node scripts/batch_update_green_mung_costs_and_gl.mjs --live --prices='{"1320": 5200, "1323": 5250, ...}'
 */

import mysql from "mysql2/promise"

// Default prices dictionary - can be pre-filled or passed via CLI arguments
const DEFAULT_VOUCHER_PRICES = {
  "1320": 0, // 2026-06-11 | 111.00 Qtl | HUSSEN
  "1323": 0, // 2026-06-12 | 213.40 Qtl | ZEYNU
  "1324": 0, // 2026-06-16 | 218.80 Qtl | GIRMA
  "1331": 0, // 2026-06-22 | 277.60 Qtl | ZEYNU
  "1332": 0, // 2026-06-22 | 176.60 Qtl | GIRMA
  "1345": 0, // 2026-06-24 | 101.20 Qtl | HUSSEN
  "1346": 0, // 2026-06-24 | 100.80 Qtl | ZEYNU
  "1357": 0, // 2026-06-30 | 138.80 Qtl | HUSSEN
  "1363": 0, // 2026-07-02 | 252.40 Qtl | HUSSEN
  "1364": 0, // 2026-07-02 | 273.00 Qtl | HUSSEN
  "1365": 0, // 2026-07-02 | 116.20 Qtl | SAMUEL
  "1366": 0, // 2026-07-03 | 254.20 Qtl | HUSSEN
  "1367": 0, // 2026-07-03 | 232.00 Qtl | HUSSEN
  "1372": 0, // 2026-07-08 | 102.00 Qtl | HUSSEN
  "1373": 0, // 2026-07-09 | 291.80 Qtl | HUSSEN
  "1374": 0, // 2026-07-10 | 505.80 Qtl | HUSSEN
  "1375": 0, // 2026-07-13 | 470.20 Qtl | HUSSEN
  "1376": 0, // 2026-07-14 | 242.00 Qtl | HUSSEN
}

async function run() {
  const args = process.argv.slice(2)
  const isLive = args.includes("--live")
  const isDryRun = args.includes("--dry-run") || !isLive

  // Parse uniform price if provided: --uniform-price=5200
  let uniformPrice = null
  const uniformArg = args.find((a) => a.startsWith("--uniform-price="))
  if (uniformArg) {
    uniformPrice = parseFloat(uniformArg.split("=")[1])
  }

  // Parse distinct voucher prices JSON if provided: --prices='{"1320": 5200, ...}'
  let customPrices = {}
  const pricesArg = args.find((a) => a.startsWith("--prices="))
  if (pricesArg) {
    try {
      customPrices = JSON.parse(pricesArg.slice("--prices=".length))
    } catch (e) {
      console.error("[ERROR] Could not parse --prices JSON argument:", e.message)
      process.exit(1)
    }
  }

  console.log("================================================================================")
  console.log("   HKC ERP v5 - GREEN MUNG HISTORICAL COST & GL MIGRATION ENGINE")
  console.log("================================================================================")
  console.log(`Mode:            ${isLive ? ">>> LIVE EXECUTION (PERSISTING TO MYSQL) <<<" : "DRY RUN (Simulation Only)"}`)
  if (uniformPrice !== null) {
    console.log(`Uniform Price:   ETB ${uniformPrice.toFixed(2)} / Quintal`)
  }
  console.log("--------------------------------------------------------------------------------\n")

  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading",
  })

  try {
    // 1. Fetch Green Mung Product
    const [prods] = await conn.query(
      "SELECT id, sku, name, unit, quantity, unit_cost, total_stock_value, warehouse_id FROM export_products WHERE id = ?",
      ["P-1789991499832"]
    )
    if (prods.length === 0) {
      throw new Error("Green Mung product 'P-1789991499832' not found in export_products!")
    }
    const product = prods[0]
    console.log(`Target Product:  ${product.name} (${product.sku}) | WH: ${product.warehouse_id}`)
    console.log(`Current State:   Qty: ${product.quantity} ${product.unit} | Unit Cost: ETB ${Number(product.unit_cost).toFixed(2)} | Valuation: ETB ${Number(product.total_stock_value).toFixed(2)}\n`)

    // 2. Fetch all 18 Movements
    const [movements] = await conn.query(
      `SELECT id, warehouse_id, product_id, movement_type, voucher_no, batch_no, party_name,
              gross_quantity, reject_quantity, net_quantity, uom, unit_price,
              DATE_FORMAT(movement_date, '%Y-%m-%d') as movement_date_str,
              movement_date, created_at
       FROM export_warehouse_movements
       WHERE product_id = ?
       ORDER BY movement_date ASC, voucher_no ASC`,
      ["P-1789991499832"]
    )

    console.log(`Found ${movements.length} child movements in export_warehouse_movements.\n`)
    if (movements.length !== 18) {
      console.warn(`[WARNING] Expected exactly 18 movements, but found ${movements.length}! Proceeding with found records.`)
    }

    // 3. Resolve COA Target Accounts
    const [assetAccounts] = await conn.query(
      "SELECT id, code, name, account_type FROM chart_of_accounts WHERE code = '1410-01'"
    )
    if (assetAccounts.length === 0) {
      throw new Error("COA Asset account '1410-01' (STOCK OF GREEN MUNG) not found!")
    }
    const assetAccount = assetAccounts[0]

    const [equityAccounts] = await conn.query(
      "SELECT id, code, name, account_type FROM chart_of_accounts WHERE code = '3000-01'"
    )
    if (equityAccounts.length === 0) {
      throw new Error("COA Equity account '3000-01' (PAID IN CAPITAL) not found!")
    }
    const equityAccount = equityAccounts[0]

    console.log(`GL Debit Account:  [${assetAccount.code}] ${assetAccount.name} (${assetAccount.account_type})`)
    console.log(`GL Credit Account: [${equityAccount.code}] ${equityAccount.name} (${equityAccount.account_type})\n`)

    // 4. Map Prices and Compute Valuations
    let totalQty = 0
    let totalValuation = 0
    const processedRows = []

    for (let i = 0; i < movements.length; i++) {
      const m = movements[i]
      const vNo = String(m.voucher_no || "").trim()
      const qty = Number(m.net_quantity || 0)
      totalQty += qty

      let assignedPrice = 0
      if (uniformPrice !== null && uniformPrice > 0) {
        assignedPrice = uniformPrice
      } else if (customPrices[vNo] !== undefined && Number(customPrices[vNo]) > 0) {
        assignedPrice = Number(customPrices[vNo])
      } else if (DEFAULT_VOUCHER_PRICES[vNo] !== undefined && Number(DEFAULT_VOUCHER_PRICES[vNo]) > 0) {
        assignedPrice = Number(DEFAULT_VOUCHER_PRICES[vNo])
      } else {
        // Fallback for simulation if dry-run and no prices configured yet
        assignedPrice = isDryRun ? 5000.00 : 0
      }

      const rowValuation = Math.round(qty * assignedPrice * 100) / 100
      totalValuation += rowValuation

      processedRows.push({
        movement: m,
        voucher_no: vNo,
        date: m.movement_date_str,
        party: m.party_name || "Direct Supplier",
        qty,
        unitPrice: assignedPrice,
        valuation: rowValuation,
      })
    }

    const weightedAvgCost = totalQty > 0 ? Math.round((totalValuation / totalQty) * 100) / 100 : 0

    // Display Plan Summary Table
    console.log("------------------------------------------------------------------------------------------------------------------")
    console.log("| #  | Voucher | Date       | Supplier         | Net Qty (Qtl) | Unit Price (ETB) | Voucher Valuation (ETB)        |")
    console.log("------------------------------------------------------------------------------------------------------------------")
    processedRows.forEach((r, idx) => {
      const idxStr = String(idx + 1).padStart(2, " ")
      const vStr = r.voucher_no.padEnd(7, " ")
      const dStr = r.date.padEnd(10, " ")
      const pStr = r.party.slice(0, 16).padEnd(16, " ")
      const qStr = r.qty.toFixed(2).padStart(13, " ")
      const prStr = r.unitPrice.toFixed(2).padStart(16, " ")
      const valStr = r.valuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(30, " ")
      console.log(`| ${idxStr} | ${vStr} | ${dStr} | ${pStr} | ${qStr} | ${prStr} | ${valStr} |`)
    })
    console.log("------------------------------------------------------------------------------------------------------------------")
    console.log(`TOTALS:                                        ${totalQty.toFixed(2).padStart(13, " ")} Qtl                     ETB ${totalValuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(26, " ")}`)
    console.log(`CALCULATED WEIGHTED AVERAGE COST:             ETB ${weightedAvgCost.toFixed(2)} / Quintal\n`)

    if (totalValuation === 0) {
      console.warn("[WARNING] Total valuation is 0.00 ETB. Provide prices tomorrow via --uniform-price or --prices argument.")
      if (isLive) {
        throw new Error("Aborting live run: Prices must be greater than 0.00 ETB!")
      }
    }

    // 5. Check Idempotency for Journal Entries
    const sourceIds = movements.map((m) => m.id)
    const [existingJEs] = await conn.query(
      "SELECT id, source_id, total_amount FROM journal_entries WHERE source_id IN (?)",
      [sourceIds]
    )
    if (existingJEs.length > 0) {
      console.warn(`[IDEMPOTENCY NOTE] Found ${existingJEs.length} existing JEs for these movements. If re-running, existing records will be updated or replaced.`)
    }

    if (isDryRun) {
      console.log("================================================================================")
      console.log("   DRY RUN COMPLETE — 0 DATABASE MODIFICATIONS WERE EXECUTED")
      console.log("================================================================================")
      console.log("Summary of operations that will be executed in --live mode:")
      console.log(`  1. UPDATE export_warehouse_movements:  ${movements.length} rows (setting exact unit_price)`)
      console.log(`  2. UPDATE export_products:             1 row (unit_cost: ETB ${weightedAvgCost.toFixed(2)}, total_stock_value: ETB ${totalValuation.toFixed(2)})`)
      console.log(`  3. INSERT INTO journal_entries:        ${movements.length} balanced entries with historical dates (June–July 2026)`)
      console.log(`  4. INSERT INTO journal_entry_lines:    ${movements.length * 2} lines (Debit 1410-01, Credit 3000-01)`)
      console.log(`  5. Net GL Discrepancy:                 0.00 ETB (100% Balanced)`)
      console.log("\nTo execute live tomorrow with your prices, run:")
      console.log("  node scripts/batch_update_green_mung_costs_and_gl.mjs --live --uniform-price=<YOUR_PRICE>")
      console.log("================================================================================\n")
      return
    }

    // -------------------------------------------------------------------------
    // 6. LIVE TRANSACTION EXECUTION
    // -------------------------------------------------------------------------
    console.log("\nStarting MySQL ACID Transaction for Live Migration...")
    await conn.beginTransaction()

    // 6a. Update Movements
    for (const r of processedRows) {
      await conn.query(
        `UPDATE export_warehouse_movements 
         SET unit_price = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [r.unitPrice, r.movement.id]
      )
    }
    console.log(`[1/5] Successfully updated ${processedRows.length} rows in export_warehouse_movements.`)

    // 6b. Update Parent Product
    await conn.query(
      `UPDATE export_products
       SET unit_cost = ?, total_stock_value = ?, updated_at = NOW(3)
       WHERE id = ?`,
      [weightedAvgCost, totalValuation, product.id]
    )
    console.log(`[2/5] Successfully updated export_products (unit_cost = ${weightedAvgCost}, total_stock_value = ${totalValuation}).`)

    // 6c. Clean existing JEs for these movements if any (clean re-entry)
    if (existingJEs.length > 0) {
      const existingJeIds = existingJEs.map((e) => e.id)
      await conn.query("DELETE FROM journal_entry_lines WHERE journal_entry_id IN (?)", [existingJeIds])
      await conn.query("DELETE FROM journal_entries WHERE id IN (?)", [existingJeIds])
      console.log(`[3/5] Cleaned ${existingJEs.length} prior historical JEs to ensure 0 duplicates.`)
    } else {
      console.log(`[3/5] Zero prior duplicate JEs found. Proceeding with clean insert.`)
    }

    // 6d. Insert 18 Journal Entries & 36 Lines with HISTORICAL DATES
    for (const r of processedRows) {
      const m = r.movement
      const jeId = `JE-INTAKE-${m.id}`
      const entryNumber = jeId
      const historicalDate = `${r.date} 10:00:00`
      const desc = `Stock Intake Valuation — GREEN MUNG [GRV: ${r.voucher_no}] (+${r.qty} Quintal @ ETB ${r.unitPrice.toFixed(2)}) — Supplier: ${r.party}`

      // Insert Parent JE
      await conn.query(
        `INSERT INTO journal_entries (
          id, entry_number, entry_date, description, source_type, source_id,
          created_by, currency, exchange_rate, posting_status, total_amount,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          jeId,
          entryNumber,
          r.date, // YYYY-MM-DD
          desc,
          "Inventory Intake",
          m.id,
          "System Inventory Manager",
          "ETB",
          1.000000,
          "POSTED",
          r.valuation,
          historicalDate, // Historical created_at (June / July 2026)
          historicalDate,
        ]
      )

      // Insert DR Line (1410-01 Asset)
      const drLineId = `${jeId}-DR`
      await conn.query(
        `INSERT INTO journal_entry_lines (
          id, journal_entry_id, account_id, account_code, account_name,
          description, debit_amount, credit_amount, warehouse_id, party_name, party_type,
          currency, exchange_rate_at_time, is_cleared, cleared_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          drLineId,
          jeId,
          assetAccount.id,
          assetAccount.code,
          assetAccount.name,
          `Stock Intake Asset — GREEN MUNG [GRV: ${r.voucher_no}]`,
          r.valuation,
          0.00,
          m.warehouse_id,
          r.party,
          "Supplier",
          "ETB",
          1.000000,
          1,
          r.date,
          historicalDate,
          historicalDate,
        ]
      )

      // Insert CR Line (3000-01 Equity)
      const crLineId = `${jeId}-CR`
      await conn.query(
        `INSERT INTO journal_entry_lines (
          id, journal_entry_id, account_id, account_code, account_name,
          description, debit_amount, credit_amount, warehouse_id, party_name, party_type,
          currency, exchange_rate_at_time, is_cleared, cleared_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crLineId,
          jeId,
          equityAccount.id,
          equityAccount.code,
          equityAccount.name,
          `Stock Intake Valuation Offset — GREEN MUNG [GRV: ${r.voucher_no}]`,
          0.00,
          r.valuation,
          m.warehouse_id,
          r.party,
          "Supplier",
          "ETB",
          1.000000,
          1,
          r.date,
          historicalDate,
          historicalDate,
        ]
      )
    }
    console.log(`[4/5] Successfully inserted ${processedRows.length} historical Journal Entries and ${processedRows.length * 2} Journal Entry Lines.`)

    // 6e. Verification Query (Trial Balance Check)
    const [[tbSummary]] = await conn.query(
      `SELECT 
         SUM(debit_amount) as total_debits,
         SUM(credit_amount) as total_credits,
         ABS(SUM(debit_amount) - SUM(credit_amount)) as variance
       FROM journal_entry_lines
       WHERE journal_entry_id LIKE 'JE-INTAKE-%'`
    )
    console.log(`[5/5] Trial Balance Check for Inventory Intakes:`)
    console.log(`      Total Debits:  ETB ${Number(tbSummary.total_debits).toFixed(2)}`)
    console.log(`      Total Credits: ETB ${Number(tbSummary.total_credits).toFixed(2)}`)
    console.log(`      Variance:      ETB ${Number(tbSummary.variance).toFixed(2)}`)

    if (Number(tbSummary.variance) > 0.01) {
      throw new Error(`Trial balance discrepancy detected: ETB ${tbSummary.variance}! Aborting transaction.`)
    }

    // Commit Transaction
    await conn.commit()
    console.log("\n================================================================================")
    console.log("   SUCCESS! TRANSACTION COMMITTED TO MYSQL WITHOUT ERRORS")
    console.log("================================================================================\n")
  } catch (err) {
    if (isLive) {
      console.error("\n[ROLLBACK] An error occurred during transaction. Rolling back MySQL:", err.message)
      await conn.rollback().catch(() => {})
    } else {
      console.error("\n[ERROR] Dry-run execution error:", err.message)
    }
    process.exit(1)
  } finally {
    await conn.end()
  }
}

run().catch((e) => {
  console.error("Fatal Script Error:", e)
  process.exit(1)
})
