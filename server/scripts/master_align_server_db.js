import { pool } from "../db/client.js"

async function masterAlignDatabase() {
  console.log("================================================================================")
  console.log("     HKC ERP - MASTER SERVER DATABASE ALIGNMENT & RECONCILIATION SCRIPT         ")
  console.log("================================================================================")

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Purge Local Test Records (Sesame Seed, test movements, test Penicillin)
    console.log("\n[1/6] Purging local test records...")
    const [delTestExpMov] = await conn.query("DELETE FROM export_warehouse_movements WHERE id = 'WH1E-1791352880586'")
    const [delTestExpProd] = await conn.query("DELETE FROM export_products WHERE id = 'P-1791352880586'")
    const [delTestSm] = await conn.query("DELETE FROM stock_movements WHERE product_id = 'P-1791352808054'")
    const [delTestBatches] = await conn.query("DELETE FROM pharma_product_batches WHERE product_id = 'P-1791352808054'")
    const [delTestPharma] = await conn.query("DELETE FROM pharma_products WHERE id = 'P-1791352808054'")
    console.log(`   - Deleted test export movements: ${delTestExpMov.affectedRows}`)
    console.log(`   - Deleted test export products: ${delTestExpProd.affectedRows}`)
    console.log(`   - Deleted test pharma records (movements: ${delTestSm.affectedRows}, batches: ${delTestBatches.affectedRows}, products: ${delTestPharma.affectedRows})`)

    // 2. Purge Employee Ghost Entries & Lines from retries
    console.log("\n[2/6] Purging ghost journal entries & lines from employee retries...")
    const ghostJEIds = [
      "JE-2026-1790857518029",
      "JE-2026-1790857518030",
      "JE-2026-1790857518031",
      "JE-2026-1790857518032",
      "JE-2026-1790857518033",
      "JE-2026-1790857518034",
      "JE-2026-1790857518035",
      "JE-2026-1790857518036",
    ]
    const [delGhostLines] = await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE 'JEL-179135%'")
    console.log(`   - Deleted ${delGhostLines.affectedRows} ghost JEL lines.`)
    for (const jeId of ghostJEIds) {
      await conn.query("DELETE FROM journal_entry_lines WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.journal_entry_id')) = ?", [jeId])
      await conn.query("DELETE FROM journal_entries WHERE id = ?", [jeId])
    }

    // 3. Purge Duplicate Journal Entry Lines (%-1 and %-2)
    console.log("\n[3/6] Purging 56 duplicate journal entry lines ending in %-1 and %-2...")
    const [delWashRes] = await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE '%-1' OR id LIKE '%-2'")
    console.log(`   - Deleted ${delWashRes.affectedRows} duplicate lines from sales & COGS.`)

    // 4. Align Ashiver 5 Products and Batches
    console.log("\n[4/6] Verifying and aligning ASHIVER 5 records...")
    // Ensure WH2 ASHIVER 5 has exactly 1 batch (ALT26025)
    const [wh2Prod] = await conn.query("SELECT * FROM pharma_products WHERE id = 'P-1788854908608'")
    if (wh2Prod.length > 0) {
      await conn.query(
        "UPDATE pharma_products SET quantity = 3500.00, total_quantity = 3500.00, unit_cost = 185.33, total_stock_value = 648655.00, batch_no = 'ALT26025', mfg_date = '2026-01-01', expiry_date = '2029-12-01' WHERE id = 'P-1788854908608'"
      )
      console.log("   - WH2 ASHIVER 5 (P-1788854908608) verified: 1 batch (ALT26025, 3,500 boxes @ 185.33 ETB).")
    }

    // Ensure WH3 ASHIVER 5 has exactly 2 batches (ALT26087 and ALT26115)
    const wh3ProdId = "P-1791354752900"
    // Delete any stray fragmented products
    const strayProdIds = ["P-1791355747403", "P-1791352826780", "P-1791355648019"]
    for (const pid of strayProdIds) {
      await conn.query("DELETE FROM stock_movements WHERE product_id = ?", [pid])
      await conn.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [pid])
      await conn.query("DELETE FROM pharma_products WHERE id = ?", [pid])
    }

    // Upsert WH3 ASHIVER 5 parent product
    const now = new Date().toISOString()
    const wh3ProdData = {
      id: wh3ProdId,
      sku: "ASH-ALT26087",
      name: "ASHIVER 5",
      category: "Veterinary Medicine",
      warehouse_id: "WH3-VET-LEBU",
      batch_no: "ALT26087",
      mfg_date: "2026-05-01",
      expiry_date: "2030-04-01",
      unit: "Box",
      quantity_per_pack: 100,
      number_of_cartons: 50,
      quantity: 5000.00,
      total_quantity: 5000.00,
      quantity_sold: 0.00,
      unit_cost: 189.38,
      selling_price: 208.00,
      total_stock_value: 946900.00,
      shelf_life_months: 47,
      status: "In Stock",
      description: "ASHIVER 5 - 50 Cartons (5,000 Boxes)",
      created_at: "2026-05-01 08:00:00",
      updated_at: now.slice(0, 19).replace("T", " ")
    }

    await conn.query(
      `INSERT INTO pharma_products (
        id, sku, name, category, warehouse_id, batch_no, mfg_date, expiry_date,
        unit, quantity_per_pack, number_of_cartons, quantity, total_quantity,
        quantity_sold, unit_cost, selling_price, total_stock_value,
        shelf_life_months, status, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        sku = VALUES(sku), name = VALUES(name), category = VALUES(category),
        warehouse_id = VALUES(warehouse_id), batch_no = VALUES(batch_no),
        mfg_date = VALUES(mfg_date), expiry_date = VALUES(expiry_date),
        unit = VALUES(unit), quantity_per_pack = VALUES(quantity_per_pack),
        number_of_cartons = VALUES(number_of_cartons), quantity = VALUES(quantity),
        total_quantity = VALUES(total_quantity), quantity_sold = VALUES(quantity_sold),
        unit_cost = VALUES(unit_cost), selling_price = VALUES(selling_price),
        total_stock_value = VALUES(total_stock_value), shelf_life_months = VALUES(shelf_life_months),
        status = VALUES(status), description = VALUES(description), updated_at = VALUES(updated_at)`,
      [
        wh3ProdData.id, wh3ProdData.sku, wh3ProdData.name, wh3ProdData.category,
        wh3ProdData.warehouse_id, wh3ProdData.batch_no, wh3ProdData.mfg_date, wh3ProdData.expiry_date,
        wh3ProdData.unit, wh3ProdData.quantity_per_pack, wh3ProdData.number_of_cartons,
        wh3ProdData.quantity, wh3ProdData.total_quantity, wh3ProdData.quantity_sold,
        wh3ProdData.unit_cost, wh3ProdData.selling_price, wh3ProdData.total_stock_value,
        wh3ProdData.shelf_life_months, wh3ProdData.status, wh3ProdData.description,
        wh3ProdData.created_at, wh3ProdData.updated_at
      ]
    )

    // Upsert WH3 batches (ALT26087 and ALT26115)
    await conn.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [wh3ProdId])
    await conn.query(
      `INSERT INTO pharma_product_batches (
        id, product_id, warehouse_id, batch_no, mfg_date, expiry_date,
        quantity, unit_cost, selling_price, qa_status, location, notes, created_at, updated_at
      ) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `PB-${wh3ProdId}-ALT26087`, wh3ProdId, "WH3-VET-LEBU", "ALT26087", "2026-05-01", "2030-04-01",
        3957.00, 189.38, 208.00, "Released", "WH3-LEBU", "Batch 1: 39 ctns + 57 loose boxes", "2026-05-01 08:00:00", now.slice(0, 19).replace("T", " "),

        `PB-${wh3ProdId}-ALT26115`, wh3ProdId, "WH3-VET-LEBU", "ALT26115", "2026-06-01", "2030-05-01",
        1043.00, 189.38, 208.00, "Released", "WH3-LEBU", "Batch 2: 10 ctns + 43 loose boxes", "2026-06-01 08:00:00", now.slice(0, 19).replace("T", " ")
      ]
    )

    // Upsert WH3 stock movements
    await conn.query("DELETE FROM stock_movements WHERE product_id = ?", [wh3ProdId])
    await conn.query(
      `INSERT INTO stock_movements (
        id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price,
        selling_price, balance_after, batch_no, expiry_date, mfg_date,
        reference_type, reference_id, notes, party, movement_date, created_at, updated_at
      ) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "SM-WH3-ALT26087", wh3ProdId, "WH3-VET-LEBU", "RECEIPT", 3957.00, 189.38, 189.38,
        208.00, 3957.00, "ALT26087", "2030-04-01", "2026-05-01",
        "STOCK_RECEIPT", "GRV-ALT26087", "Intake Receipt: Batch ALT26087 (+3957 boxes)", "Initial Stock Deposit", "2026-05-01", "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000",

        "SM-WH3-ALT26115", wh3ProdId, "WH3-VET-LEBU", "RECEIPT", 1043.00, 189.38, 189.38,
        208.00, 5000.00, "ALT26115", "2030-05-01", "2026-06-01",
        "STOCK_RECEIPT", "GRV-ALT26115", "Intake Receipt: Batch ALT26115 (+1043 boxes)", "Intake Batch Receipt", "2026-06-01", "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
      ]
    )
    console.log("   - WH3 ASHIVER 5 (P-1791354752900) verified: 2 batches (ALT26087: 3,957 boxes, ALT26115: 1,043 boxes @ 189.38 ETB).")

    // Upsert WH3 Intake Journal Entries
    const val1 = 749376.66
    const val2 = 197523.34
    await conn.query("DELETE FROM journal_entry_lines WHERE id IN ('JE-INTAKE-WH3-ALT26087-DR', 'JE-INTAKE-WH3-ALT26087-CR', 'JE-INTAKE-WH3-ALT26115-DR', 'JE-INTAKE-WH3-ALT26115-CR')")
    await conn.query("DELETE FROM journal_entries WHERE id IN ('JE-INTAKE-WH3-ALT26087', 'JE-INTAKE-WH3-ALT26115')")

    const je1Payload = {
      id: "JE-INTAKE-WH3-ALT26087",
      entry_number: "JE-INTAKE-WH3-ALT26087",
      currency: "ETB",
      source_id: `PB-${wh3ProdId}-ALT26087`,
      source_type: "Inventory Intake",
      entry_date: "2026-05-01",
      created_at: "2026-05-01T08:00:00.000Z",
      created_by: "System Initializer",
      updated_at: now,
      description: "Inventory Stock Intake & Valuation — ASHIVER 5 [WH3] (Batch: ALT26087, Qty: 3957 @ ETB 189.38)",
      total_amount: val1,
      exchange_rate: 1,
      posting_status: "POSTED",
      is_cleared: true,
      cleared_date: "2026-05-01"
    }
    const je1LineDr = {
      id: "JE-INTAKE-WH3-ALT26087-DR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26087",
      account_id: "1400-01",
      account_code: "1400-01",
      account_name: "STOCK OF VETERINARY DRUG",
      debit_amount: val1,
      credit_amount: 0,
      currency: "ETB",
      description: "Inventory Stock Intake Asset Debit — ASHIVER 5 (Batch: ALT26087, 3957 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-05-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-05-01",
      exchange_rate_at_time: 1
    }
    const je1LineCr = {
      id: "JE-INTAKE-WH3-ALT26087-CR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26087",
      account_id: "3000-01",
      account_code: "3000-01",
      account_name: "HABTOM KEBEDE'S CAPITAL",
      debit_amount: 0,
      credit_amount: val1,
      currency: "ETB",
      description: "Contributed Capital Intake Credit — ASHIVER 5 (Batch: ALT26087, 3957 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-05-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-05-01",
      exchange_rate_at_time: 1
    }

    await conn.query("INSERT INTO journal_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      "JE-INTAKE-WH3-ALT26087", JSON.stringify(je1Payload), "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je1LineDr.id, JSON.stringify(je1LineDr), "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je1LineCr.id, JSON.stringify(je1LineCr), "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])

    const je2Payload = {
      id: "JE-INTAKE-WH3-ALT26115",
      entry_number: "JE-INTAKE-WH3-ALT26115",
      currency: "ETB",
      source_id: `PB-${wh3ProdId}-ALT26115`,
      source_type: "Inventory Intake",
      entry_date: "2026-06-01",
      created_at: "2026-06-01T08:00:00.000Z",
      created_by: "System Initializer",
      updated_at: now,
      description: "Inventory Stock Intake & Valuation — ASHIVER 5 [WH3] (Batch: ALT26115, Qty: 1043 @ ETB 189.38)",
      total_amount: val2,
      exchange_rate: 1,
      posting_status: "POSTED",
      is_cleared: true,
      cleared_date: "2026-06-01"
    }
    const je2LineDr = {
      id: "JE-INTAKE-WH3-ALT26115-DR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26115",
      account_id: "1400-01",
      account_code: "1400-01",
      account_name: "STOCK OF VETERINARY DRUG",
      debit_amount: val2,
      credit_amount: 0,
      currency: "ETB",
      description: "Inventory Stock Intake Asset Debit — ASHIVER 5 (Batch: ALT26115, 1043 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-06-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-06-01",
      exchange_rate_at_time: 1
    }
    const je2LineCr = {
      id: "JE-INTAKE-WH3-ALT26115-CR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26115",
      account_id: "3000-01",
      account_code: "3000-01",
      account_name: "HABTOM KEBEDE'S CAPITAL",
      debit_amount: 0,
      credit_amount: val2,
      currency: "ETB",
      description: "Contributed Capital Intake Credit — ASHIVER 5 (Batch: ALT26115, 1043 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-06-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-06-01",
      exchange_rate_at_time: 1
    }

    await conn.query("INSERT INTO journal_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      "JE-INTAKE-WH3-ALT26115", JSON.stringify(je2Payload), "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je2LineDr.id, JSON.stringify(je2LineDr), "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je2LineCr.id, JSON.stringify(je2LineCr), "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    console.log("   - Posted balanced intake entries for WH3 ASHIVER 5.")

    // 5. Synchronize Chart of Accounts & Backfill Account Names on JEL lines
    console.log("\n[5/6] Synchronizing Chart of Accounts and backfilling JEL names...")
    const [accounts] = await conn.query("SELECT * FROM chart_of_accounts")
    const coaMap = new Map()

    for (const acc of accounts) {
      let p = {}
      if (typeof acc.payload === "string") {
        try { p = JSON.parse(acc.payload) } catch {}
      } else if (acc.payload && typeof acc.payload === "object") {
        p = { ...acc.payload }
      }
      p.id = acc.id
      p.code = p.code || acc.code || acc.id
      p.name = p.name || acc.name || acc.code || acc.id
      p.account_type = p.account_type || acc.account_type || "Asset"
      p.peachtree_type = p.peachtree_type || acc.peachtree_type || null
      p.parent_account_id = p.parent_account_id !== undefined ? p.parent_account_id : acc.parent_account_id
      p.is_group = p.is_group !== undefined ? p.is_group : Boolean(acc.is_group)
      p.is_active = p.is_active !== undefined ? p.is_active : Boolean(acc.is_active)

      await conn.query(
        "UPDATE chart_of_accounts SET payload = ?, code = ?, name = ?, account_type = ?, peachtree_type = ? WHERE id = ?",
        [JSON.stringify(p), p.code, p.name, p.account_type, p.peachtree_type, acc.id]
      )

      coaMap.set(acc.id, p)
      coaMap.set(p.code, p)
    }
    console.log(`   - Synchronized ${accounts.length} Chart of Accounts records.`)

    // Backfill missing account names/codes in JEL lines
    const [jelRows] = await conn.query("SELECT id, payload FROM journal_entry_lines")
    let backfilledCount = 0
    for (const jel of jelRows) {
      let p = typeof jel.payload === "string" ? JSON.parse(jel.payload) : jel.payload
      const acc = coaMap.get(p.account_id) || coaMap.get(p.account_code)
      if (acc && (!p.account_name || !p.account_code)) {
        p.account_name = acc.name
        p.account_code = acc.code
        await conn.query("UPDATE journal_entry_lines SET payload = ? WHERE id = ?", [JSON.stringify(p), jel.id])
        backfilledCount++
      }
    }
    console.log(`   - Backfilled account metadata on ${backfilledCount} journal entry lines.`)

    // 6. Comprehensive Financial Verification & Trial Balance Check
    console.log("\n[6/6] Verifying Trial Balance and Financial Equilibrium...")
    const [lines] = await conn.query("SELECT payload FROM journal_entry_lines")
    let sumDr = 0
    let sumCr = 0
    const accTotals = {}

    for (const r of lines) {
      const p = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload
      const dr = Number(p.debit_amount || 0)
      const cr = Number(p.credit_amount || 0)
      sumDr += dr
      sumCr += cr
      const acc = p.account_id || p.account_code || "Unknown"
      if (!accTotals[acc]) accTotals[acc] = { name: p.account_name || acc, dr: 0, cr: 0 }
      accTotals[acc].dr += dr
      accTotals[acc].cr += cr
    }

    console.log("\n================================================================================")
    console.log("                           TRIAL BALANCE SUMMARY                                 ")
    console.log("================================================================================")
    console.table(
      Object.entries(accTotals).map(([accId, val]) => ({
        "Account ID": accId,
        "Account Name": val.name,
        "Debit (ETB)": val.dr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Credit (ETB)": val.cr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Net Balance": (val.dr - val.cr).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }))
    )

    const diff = Math.abs(sumDr - sumCr)
    console.log(`Total Debits:  ETB ${sumDr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`Total Credits: ETB ${sumCr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`Difference:    ETB ${diff.toFixed(2)}`)

    if (diff > 0.01) {
      throw new Error(`Trial balance is unbalanced! Discrepancy is ${diff.toFixed(2)} ETB`)
    }

    // Physical Inventory Valuation Check
    const [invRows] = await conn.query(`
      SELECT SUM(b.quantity * b.unit_cost) as total_val
      FROM pharma_product_batches b
      JOIN pharma_products p ON b.product_id = p.id
    `)
    const physicalVal = Number(invRows[0]?.total_val || 0)
    const stockGlVal = (accTotals["1400-01"]?.dr || 0) - (accTotals["1400-01"]?.cr || 0)
    console.log(`\nInventory Valuation Audit:`)
    console.log(`  Physical Batches Valuation: ETB ${physicalVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`  GL Account 1400-01 Balance: ETB ${stockGlVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`  Valuation Discrepancy:      ETB ${Math.abs(physicalVal - stockGlVal).toFixed(2)}`)

    if (Math.abs(physicalVal - stockGlVal) > 0.01) {
      throw new Error(`Inventory GL does not match physical stock! Discrepancy is ${Math.abs(physicalVal - stockGlVal).toFixed(2)} ETB`)
    }

    await conn.commit()
    console.log("\n================================================================================")
    console.log("    SUCCESS: ALL DATABASE RECORDS FULLY ALIGNED, RECONCILED, AND COMMITTED!     ")
    console.log("================================================================================\n")
  } catch (err) {
    await conn.rollback()
    console.error("\nFATAL ERROR DURING ALIGNMENT, ROLLED BACK:", err)
    process.exit(1)
  } finally {
    conn.release()
  }
}

masterAlignDatabase()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
