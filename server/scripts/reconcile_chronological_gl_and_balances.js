import { pool } from "../db/client.js"

async function runReconciliation() {
  console.log("=== STARTING MASTER FINANCIAL RECONCILIATION ===")
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Purge Test Soya Bean Records
    console.log("1. Purging test soya bean records...")
    await conn.query("DELETE FROM sales_orders WHERE id = 'SO-590058'")
    await conn.query("DELETE FROM export_warehouse_movements WHERE id = 'WH1E-1791207544725'")
    await conn.query("DELETE FROM export_products WHERE id = 'P-1791207544725'")

    // 2. Purge 56 legacy wash lines ending in %-1 and %-2
    console.log("2. Purging 56 orphan wash lines in journal_entry_lines...")
    const [delWashRes] = await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE '%-1' OR id LIKE '%-2'")
    console.log(`   Deleted ${delWashRes.affectedRows} wash lines.`)

    // 3. Purge temporary lump sum entry JE-OPENING-STOCK-INTAKE
    console.log("3. Purging temporary lump sum entry JE-OPENING-STOCK-INTAKE...")
    await conn.query("DELETE FROM journal_entry_lines WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.journal_entry_id')) = 'JE-OPENING-STOCK-INTAKE'")
    await conn.query("DELETE FROM journal_entries WHERE id = 'JE-OPENING-STOCK-INTAKE'")

    // 4. Synchronize chart_of_accounts payloads for all accounts so code and name exist in JSON
    console.log("4. Synchronizing chart_of_accounts JSON payloads...")
    const [accounts] = await conn.query("SELECT * FROM chart_of_accounts")
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
    }
    console.log(`   Synchronized ${accounts.length} account payloads.`)

    // 5. Gather all 35 pharmaceutical batches with deductions to compute original intake quantities
    console.log("5. Computing original intake quantities for all 35 batches...")
    const [batches] = await conn.query(`
      SELECT 
        b.id,
        b.product_id,
        p.name as product_name,
        b.batch_no,
        b.quantity as rem_qty,
        b.unit_cost,
        b.mfg_date,
        b.created_at
      FROM pharma_product_batches b
      LEFT JOIN pharma_products p ON b.product_id = p.id
      ORDER BY COALESCE(b.mfg_date, '2026-09-13'), b.batch_no
    `)

    const [items] = await conn.query("SELECT batch_no, SUM(quantity) as sold_qty FROM sales_issue_items GROUP BY batch_no")
    const soldMap = new Map(items.map((i) => [i.batch_no, Number(i.sold_qty)]))

    const [qrn] = await conn.query("SELECT batch_no, SUM(quantity) as qrn_qty FROM quarantine_records GROUP BY batch_no")
    const qrnMap = new Map(qrn.map((q) => [q.batch_no, Number(q.qrn_qty)]))

    let totalIntakeVal = 0
    let totalIntakeUnits = 0

    // Remove any previously created JE-INTAKE-% entries if rerunning
    await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE 'JE-INTAKE-%'")
    await conn.query("DELETE FROM journal_entries WHERE id LIKE 'JE-INTAKE-%'")

    const toSqlTs = (dStr) => {
      const d = new Date(dStr)
      return isNaN(d.getTime()) ? "2026-09-13 10:00:00.000" : d.toISOString().slice(0, 19).replace("T", " ") + ".000"
    }

    for (let i = 0; i < batches.length; i++) {
      const b = batches[i]
      const soldQty = soldMap.get(b.batch_no) || 0
      const qrnQty = qrnMap.get(b.batch_no) || 0

      // Only add deductions to the single matching batch if not duplicate batch_no
      const duplicates = batches.filter((x) => x.batch_no === b.batch_no)
      let origQty = Number(b.rem_qty)
      if (duplicates.length === 1) {
        origQty += soldQty + qrnQty
      }

      const unitCost = Number(b.unit_cost)
      const origVal = Math.round(origQty * unitCost * 100) / 100
      totalIntakeVal += origVal
      totalIntakeUnits += origQty

      const jeId = `JE-INTAKE-${b.id}`
      const entryDate = b.mfg_date || "2026-09-13"
      const description = `Initial Inventory Stock Intake & Beginning Valuation — ${b.product_name} (Batch: ${b.batch_no}, Qty: ${origQty} @ ETB ${unitCost.toFixed(2)})`

      const jePayload = {
        id: jeId,
        entry_number: jeId,
        entry_date: entryDate,
        description,
        source_type: "Inventory Intake",
        source_id: b.id,
        created_by: "System Initializer",
        currency: "ETB",
        exchange_rate: 1.0,
        posting_status: "POSTED",
        total_amount: origVal,
        created_at: `${entryDate}T00:00:00.000Z`,
        updated_at: new Date().toISOString(),
      }

      const sqlCreatedAt = toSqlTs(entryDate)
      const sqlUpdatedAt = toSqlTs(new Date())

      await conn.query(
        "INSERT INTO journal_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)",
        [jeId, JSON.stringify(jePayload), sqlCreatedAt, sqlUpdatedAt]
      )

      // Debit Line: 1400-01 (Stock of Veterinary Drug)
      const drLineId = `${jeId}-DR`
      const drPayload = {
        id: drLineId,
        journal_entry_id: jeId,
        account_id: "1400-01",
        account_code: "1400-01",
        account_name: "STOCK OF VETERINARY DRUG",
        debit_amount: origVal,
        credit_amount: 0,
        currency: "ETB",
        exchange_rate_at_time: 1.0,
        warehouse_id: "WH2",
        description,
        is_cleared: true,
        cleared_date: entryDate,
        created_at: `${entryDate}T00:00:00.000Z`,
        updated_at: new Date().toISOString(),
      }

      await conn.query(
        "INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)",
        [drLineId, JSON.stringify(drPayload), sqlCreatedAt, sqlUpdatedAt]
      )

      // Credit Line: 3000-01 (Habtom Kebede's Capital)
      const crLineId = `${jeId}-CR`
      const crPayload = {
        id: crLineId,
        journal_entry_id: jeId,
        account_id: "3000-01",
        account_code: "3000-01",
        account_name: "HABTOM KEBEDE'S CAPITAL",
        debit_amount: 0,
        credit_amount: origVal,
        currency: "ETB",
        exchange_rate_at_time: 1.0,
        warehouse_id: "WH2",
        description,
        is_cleared: true,
        cleared_date: entryDate,
        created_at: `${entryDate}T00:00:00.000Z`,
        updated_at: new Date().toISOString(),
      }

      await conn.query(
        "INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)",
        [crLineId, JSON.stringify(crPayload), sqlCreatedAt, sqlUpdatedAt]
      )
    }

    console.log(`   Posted ${batches.length} chronological intake entries. Total Units: ${totalIntakeUnits}, Total Valuation: ETB ${totalIntakeVal.toFixed(2)}`)

    // 6. Insert 1 Quarantine Loss Entry on 2026-09-16
    console.log("6. Posting Quarantine Loss entry on 2026-09-16...")
    const qrnJeId = "JE-QRN-ALI25077"
    const qrnDate = "2026-09-16"
    const qrnVal = 1596.00
    const qrnDesc = "Quarantine Loss / Damage — ASHIVER 1% INJECTION (Batch: ALI25077, 19 Vials @ ETB 84.00)"

    // Remove if exists
    await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE 'JE-QRN-ALI25077%'")
    await conn.query("DELETE FROM journal_entries WHERE id = 'JE-QRN-ALI25077'")

    const qrnJePayload = {
      id: qrnJeId,
      entry_number: qrnJeId,
      entry_date: qrnDate,
      description: qrnDesc,
      source_type: "Quarantine Loss",
      source_id: "QRN-1789550847729-NVLH",
      created_by: "Habtom",
      currency: "ETB",
      exchange_rate: 1.0,
      posting_status: "POSTED",
      total_amount: qrnVal,
      created_at: `${qrnDate}T15:27:29.000Z`,
      updated_at: new Date().toISOString(),
    }

    const qrnCreatedAt = toSqlTs(`${qrnDate} 15:27:29`)
    const qrnUpdatedAt = toSqlTs(new Date())

    await conn.query(
      "INSERT INTO journal_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [qrnJeId, JSON.stringify(qrnJePayload), qrnCreatedAt, qrnUpdatedAt]
    )

    // Debit Line: 6000-22 (OTHER / Loss & Shrinkage)
    const qrnDrPayload = {
      id: `${qrnJeId}-DR`,
      journal_entry_id: qrnJeId,
      account_id: "6000-22",
      account_code: "6000-22",
      account_name: "OTHER",
      debit_amount: qrnVal,
      credit_amount: 0,
      currency: "ETB",
      exchange_rate_at_time: 1.0,
      warehouse_id: "WH2-VET-ALEM",
      description: qrnDesc,
      is_cleared: true,
      cleared_date: qrnDate,
      created_at: `${qrnDate}T15:27:29.000Z`,
      updated_at: new Date().toISOString(),
    }
    await conn.query(
      "INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [`${qrnJeId}-DR`, JSON.stringify(qrnDrPayload), qrnCreatedAt, qrnUpdatedAt]
    )

    // Credit Line: 1400-01 (Stock of Veterinary Drug)
    const qrnCrPayload = {
      id: `${qrnJeId}-CR`,
      journal_entry_id: qrnJeId,
      account_id: "1400-01",
      account_code: "1400-01",
      account_name: "STOCK OF VETERINARY DRUG",
      debit_amount: 0,
      credit_amount: qrnVal,
      currency: "ETB",
      exchange_rate_at_time: 1.0,
      warehouse_id: "WH2-VET-ALEM",
      description: qrnDesc,
      is_cleared: true,
      cleared_date: qrnDate,
      created_at: `${qrnDate}T15:27:29.000Z`,
      updated_at: new Date().toISOString(),
    }
    await conn.query(
      "INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [`${qrnJeId}-CR`, JSON.stringify(qrnCrPayload), qrnCreatedAt, qrnUpdatedAt]
    )
    console.log("   Quarantine loss entry posted successfully.")

    // 7. Verify Trial Balance Equilibrium
    console.log("7. Verifying Trial Balance in Database...")
    const [lineRows] = await conn.query("SELECT payload FROM journal_entry_lines")
    let sumDr = 0
    let sumCr = 0
    const accTotals = {}

    for (const r of lineRows) {
      const p = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload
      const dr = Number(p.debit_amount || 0)
      const cr = Number(p.credit_amount || 0)
      sumDr += dr
      sumCr += cr
      const acc = p.account_id || p.account_code || "Unknown"
      if (!accTotals[acc]) accTotals[acc] = { dr: 0, cr: 0 }
      accTotals[acc].dr += dr
      accTotals[acc].cr += cr
    }

    console.log("=== TRIAL BALANCE SUMMARY ===")
    console.table(Object.entries(accTotals).map(([acc, val]) => ({
      Account: acc,
      Debit: val.dr.toFixed(2),
      Credit: val.cr.toFixed(2),
      Net: (val.dr - val.cr).toFixed(2)
    })))
    console.log(`Total Debits:  ETB ${sumDr.toFixed(2)}`)
    console.log(`Total Credits: ETB ${sumCr.toFixed(2)}`)
    console.log(`Difference:    ETB ${Math.abs(sumDr - sumCr).toFixed(2)}`)

    if (Math.abs(sumDr - sumCr) > 0.01) {
      throw new Error(`Trial balance is not balanced! Difference is ${Math.abs(sumDr - sumCr)}`)
    }

    await conn.commit()
    console.log("=== MASTER FINANCIAL RECONCILIATION COMPLETED SUCCESSFULLY ===")
    process.exit(0)
  } catch (err) {
    await conn.rollback()
    console.error("FAILED TO RECONCILE:", err)
    process.exit(1)
  } finally {
    conn.release()
  }
}

runReconciliation()
