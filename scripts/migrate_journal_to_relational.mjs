import mysql from "mysql2/promise"

async function runMigration() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading",
  })

  console.log("=== STARTING FULL RELATIONAL MIGRATION FOR FINANCE ===")

  try {
    // ----------------------------------------------------
    // STEP 1: Baseline Verification
    // ----------------------------------------------------
    const [[{ count: preJeCount }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entries")
    const [[{ count: preJelCount }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entry_lines")
    const [[{ count: preCoaCount }]] = await conn.query("SELECT COUNT(*) as count FROM chart_of_accounts")
    console.log(`[BASELINE] journal_entries: ${preJeCount}, journal_entry_lines: ${preJelCount}, chart_of_accounts: ${preCoaCount}`)

    // ----------------------------------------------------
    // STEP 2: Finalize Chart of Accounts Relational Storage
    // ----------------------------------------------------
    console.log("\n[COA] Finalizing relational columns & indexes for chart_of_accounts...")
    
    // Ensure all 280 accounts have correct columns
    const [coaRows] = await conn.query("SELECT id, payload, code, name, account_type, peachtree_type, parent_account_id, is_group, is_active FROM chart_of_accounts")
    for (const row of coaRows) {
      let p = {}
      if (row.payload) {
        p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
      }
      const code = row.code || p.code || row.id
      const name = row.name || p.name || code
      const accountType = row.account_type || p.account_type || "Asset"
      const peachtreeType = row.peachtree_type || p.peachtree_type || null
      const parentAccountId = row.parent_account_id !== undefined ? row.parent_account_id : (p.parent_account_id || null)
      const isGroup = row.is_group !== undefined ? (row.is_group ? 1 : 0) : (p.is_group ? 1 : 0)
      const isActive = row.is_active !== undefined ? (row.is_active ? 1 : 0) : (p.is_active !== false ? 1 : 0)

      await conn.query(
        `UPDATE chart_of_accounts 
         SET code = ?, name = ?, account_type = ?, peachtree_type = ?, parent_account_id = ?, is_group = ?, is_active = ?, payload = NULL, updated_at = NOW(3)
         WHERE id = ?`,
        [code, name, accountType, peachtreeType, parentAccountId, isGroup, isActive, row.id]
      )
    }

    // Add indexes on chart_of_accounts if not existing
    const [coaIndexes] = await conn.query("SHOW INDEX FROM chart_of_accounts")
    const coaIdxNames = new Set(coaIndexes.map((i) => i.Key_name))
    if (!coaIdxNames.has("idx_coa_code")) {
      await conn.query("CREATE INDEX idx_coa_code ON chart_of_accounts (code)")
      console.log("  + Created idx_coa_code")
    }
    if (!coaIdxNames.has("idx_coa_parent")) {
      await conn.query("CREATE INDEX idx_coa_parent ON chart_of_accounts (parent_account_id)")
      console.log("  + Created idx_coa_parent")
    }
    if (!coaIdxNames.has("idx_coa_type")) {
      await conn.query("CREATE INDEX idx_coa_type ON chart_of_accounts (account_type)")
      console.log("  + Created idx_coa_type")
    }
    console.log(`[COA] Completed. All ${coaRows.length} accounts finalized with NULL payload.`)

    // ----------------------------------------------------
    // STEP 3: Alter & Populate journal_entries
    // ----------------------------------------------------
    console.log("\n[JOURNAL ENTRIES] Altering table & populating relational columns...")
    const [jeCols] = await conn.query("SHOW COLUMNS FROM journal_entries")
    const jeColSet = new Set(jeCols.map((c) => c.Field))

    const jeColumnsToAdd = [
      { name: "entry_number", ddl: "VARCHAR(100) NULL AFTER id" },
      { name: "entry_date", ddl: "DATE NOT NULL DEFAULT '2026-01-01' AFTER entry_number" },
      { name: "description", ddl: "TEXT NULL AFTER entry_date" },
      { name: "source_type", ddl: "VARCHAR(50) NOT NULL DEFAULT 'MANUAL' AFTER description" },
      { name: "source_id", ddl: "VARCHAR(191) NULL AFTER source_type" },
      { name: "created_by", ddl: "VARCHAR(191) NULL AFTER source_id" },
      { name: "currency", ddl: "VARCHAR(10) NOT NULL DEFAULT 'ETB' AFTER created_by" },
      { name: "exchange_rate", ddl: "DECIMAL(18,6) NOT NULL DEFAULT 1.000000 AFTER currency" },
      { name: "posting_status", ddl: "VARCHAR(50) NOT NULL DEFAULT 'POSTED' AFTER exchange_rate" },
      { name: "total_amount", ddl: "DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER posting_status" },
      { name: "is_reversal_of", ddl: "VARCHAR(191) NULL AFTER total_amount" },
      { name: "auto_reverse", ddl: "TINYINT(1) NOT NULL DEFAULT 0 AFTER is_reversal_of" },
      { name: "reversal_date", ddl: "DATE NULL AFTER auto_reverse" },
      { name: "reversed_by_id", ddl: "VARCHAR(191) NULL AFTER reversal_date" },
    ]

    for (const col of jeColumnsToAdd) {
      if (!jeColSet.has(col.name)) {
        await conn.query(`ALTER TABLE journal_entries ADD COLUMN \`${col.name}\` ${col.ddl}`)
        console.log(`  + Added column journal_entries.${col.name}`)
      }
    }
    await conn.query("ALTER TABLE journal_entries MODIFY COLUMN payload JSON NULL")

    // Populate journal_entries from payload
    const [rawJes] = await conn.query("SELECT id, payload FROM journal_entries")
    for (const row of rawJes) {
      if (!row.payload) continue
      const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload

      const entryNumber = p.entry_number || p.id || row.id
      let entryDate = p.entry_date
      if (entryDate && entryDate.length > 10) entryDate = entryDate.slice(0, 10)
      if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) entryDate = "2026-01-01"

      const description = p.description || null
      const sourceType = p.source_type || "MANUAL"
      const sourceId = p.source_id || null
      const createdBy = p.created_by || null
      const currency = p.currency || "ETB"
      const exchangeRate = Number(p.exchange_rate || 1.0)
      const postingStatus = p.posting_status || "POSTED"
      const totalAmount = Number(p.total_amount || 0.0)
      const isReversalOf = p.is_reversal_of || null
      const autoReverse = p.auto_reverse ? 1 : 0
      let reversalDate = p.reversal_date || null
      if (reversalDate && reversalDate.length > 10) reversalDate = reversalDate.slice(0, 10)
      if (reversalDate && !/^\d{4}-\d{2}-\d{2}$/.test(reversalDate)) reversalDate = null
      const reversedById = p.reversed_by_id || null

      await conn.query(
        `UPDATE journal_entries SET
           entry_number = ?,
           entry_date = ?,
           description = ?,
           source_type = ?,
           source_id = ?,
           created_by = ?,
           currency = ?,
           exchange_rate = ?,
           posting_status = ?,
           total_amount = ?,
           is_reversal_of = ?,
           auto_reverse = ?,
           reversal_date = ?,
           reversed_by_id = ?
         WHERE id = ?`,
        [
          entryNumber,
          entryDate,
          description,
          sourceType,
          sourceId,
          createdBy,
          currency,
          exchangeRate,
          postingStatus,
          totalAmount,
          isReversalOf,
          autoReverse,
          reversalDate,
          reversedById,
          row.id,
        ]
      )
    }

    // Add indexes on journal_entries
    const [jeIndexes] = await conn.query("SHOW INDEX FROM journal_entries")
    const jeIdxNames = new Set(jeIndexes.map((i) => i.Key_name))
    if (!jeIdxNames.has("idx_je_entry_date")) {
      await conn.query("CREATE INDEX idx_je_entry_date ON journal_entries (entry_date DESC)")
      console.log("  + Created idx_je_entry_date")
    }
    if (!jeIdxNames.has("idx_je_source_id")) {
      await conn.query("CREATE INDEX idx_je_source_id ON journal_entries (source_id)")
      console.log("  + Created idx_je_source_id")
    }
    if (!jeIdxNames.has("idx_je_source_type")) {
      await conn.query("CREATE INDEX idx_je_source_type ON journal_entries (source_type)")
      console.log("  + Created idx_je_source_type")
    }
    if (!jeIdxNames.has("idx_je_posting_status")) {
      await conn.query("CREATE INDEX idx_je_posting_status ON journal_entries (posting_status)")
      console.log("  + Created idx_je_posting_status")
    }
    console.log(`[JOURNAL ENTRIES] Completed. ${rawJes.length} rows converted to relational.`)

    // ----------------------------------------------------
    // STEP 4: Alter & Populate journal_entry_lines
    // ----------------------------------------------------
    console.log("\n[JOURNAL ENTRY LINES] Altering table & populating relational columns...")
    const [jelCols] = await conn.query("SHOW COLUMNS FROM journal_entry_lines")
    const jelColSet = new Set(jelCols.map((c) => c.Field))

    const jelColumnsToAdd = [
      { name: "journal_entry_id", ddl: "VARCHAR(191) NOT NULL DEFAULT '' AFTER id" },
      { name: "account_id", ddl: "VARCHAR(191) NOT NULL DEFAULT '' AFTER journal_entry_id" },
      { name: "account_code", ddl: "VARCHAR(50) NULL AFTER account_id" },
      { name: "account_name", ddl: "VARCHAR(255) NULL AFTER account_code" },
      { name: "description", ddl: "TEXT NULL AFTER account_name" },
      { name: "debit_amount", ddl: "DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER description" },
      { name: "credit_amount", ddl: "DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER debit_amount" },
      { name: "warehouse_id", ddl: "VARCHAR(191) NULL AFTER credit_amount" },
      { name: "party_id", ddl: "VARCHAR(191) NULL AFTER warehouse_id" },
      { name: "party_type", ddl: "VARCHAR(50) NULL AFTER party_id" },
      { name: "party_name", ddl: "VARCHAR(255) NULL AFTER party_type" },
      { name: "currency", ddl: "VARCHAR(10) NOT NULL DEFAULT 'ETB' AFTER party_name" },
      { name: "exchange_rate_at_time", ddl: "DECIMAL(18,6) NOT NULL DEFAULT 1.000000 AFTER currency" },
      { name: "is_cleared", ddl: "TINYINT(1) NOT NULL DEFAULT 0 AFTER exchange_rate_at_time" },
      { name: "cleared_date", ddl: "DATE NULL AFTER is_cleared" },
    ]

    for (const col of jelColumnsToAdd) {
      if (!jelColSet.has(col.name)) {
        await conn.query(`ALTER TABLE journal_entry_lines ADD COLUMN \`${col.name}\` ${col.ddl}`)
        console.log(`  + Added column journal_entry_lines.${col.name}`)
      }
    }
    await conn.query("ALTER TABLE journal_entry_lines MODIFY COLUMN payload JSON NULL")

    // Populate journal_entry_lines from payload
    const [rawJels] = await conn.query("SELECT id, payload FROM journal_entry_lines")
    for (const row of rawJels) {
      if (!row.payload) continue
      const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload

      const journalEntryId = p.journal_entry_id
      const accountId = p.account_id
      const accountCode = p.account_code || null
      const accountName = p.account_name || null
      const description = p.description || null
      const debitAmount = Number(p.debit_amount ?? p.debit ?? 0.0)
      const creditAmount = Number(p.credit_amount ?? p.credit ?? 0.0)
      const warehouseId = p.warehouse_id || null
      const partyId = p.party_id || null
      const partyType = p.party_type || null
      const partyName = p.party_name || null
      const currency = p.currency || "ETB"
      const exchangeRateAtTime = Number(p.exchange_rate_at_time || 1.0)
      const isCleared = p.is_cleared ? 1 : 0
      let clearedDate = p.cleared_date || null
      if (clearedDate && clearedDate.length > 10) clearedDate = clearedDate.slice(0, 10)
      if (clearedDate && !/^\d{4}-\d{2}-\d{2}$/.test(clearedDate)) clearedDate = null

      await conn.query(
        `UPDATE journal_entry_lines SET
           journal_entry_id = ?,
           account_id = ?,
           account_code = ?,
           account_name = ?,
           description = ?,
           debit_amount = ?,
           credit_amount = ?,
           warehouse_id = ?,
           party_id = ?,
           party_type = ?,
           party_name = ?,
           currency = ?,
           exchange_rate_at_time = ?,
           is_cleared = ?,
           cleared_date = ?
         WHERE id = ?`,
        [
          journalEntryId,
          accountId,
          accountCode,
          accountName,
          description,
          debitAmount,
          creditAmount,
          warehouseId,
          partyId,
          partyType,
          partyName,
          currency,
          exchangeRateAtTime,
          isCleared,
          clearedDate,
          row.id,
        ]
      )
    }

    // Add indexes on journal_entry_lines
    const [jelIndexes] = await conn.query("SHOW INDEX FROM journal_entry_lines")
    const jelIdxNames = new Set(jelIndexes.map((i) => i.Key_name))
    if (!jelIdxNames.has("idx_jel_je_id")) {
      await conn.query("CREATE INDEX idx_jel_je_id ON journal_entry_lines (journal_entry_id)")
      console.log("  + Created idx_jel_je_id")
    }
    if (!jelIdxNames.has("idx_jel_account_id")) {
      await conn.query("CREATE INDEX idx_jel_account_id ON journal_entry_lines (account_id)")
      console.log("  + Created idx_jel_account_id")
    }
    if (!jelIdxNames.has("idx_jel_account_code")) {
      await conn.query("CREATE INDEX idx_jel_account_code ON journal_entry_lines (account_code)")
      console.log("  + Created idx_jel_account_code")
    }
    if (!jelIdxNames.has("idx_jel_warehouse_id")) {
      await conn.query("CREATE INDEX idx_jel_warehouse_id ON journal_entry_lines (warehouse_id)")
      console.log("  + Created idx_jel_warehouse_id")
    }

    // Add foreign key constraint fk_jel_journal_entry ON DELETE CASCADE
    const [fkCheck] = await conn.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = 'hkc_trading' 
        AND TABLE_NAME = 'journal_entry_lines' 
        AND CONSTRAINT_NAME = 'fk_jel_journal_entry'
    `)
    if (fkCheck.length === 0) {
      await conn.query(`
        ALTER TABLE journal_entry_lines
        ADD CONSTRAINT fk_jel_journal_entry
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id)
        ON DELETE CASCADE
      `)
      console.log("  + Created Foreign Key fk_jel_journal_entry (ON DELETE CASCADE)")
    } else {
      console.log("  + Foreign Key fk_jel_journal_entry already exists.")
    }

    console.log(`[JOURNAL ENTRY LINES] Completed. ${rawJels.length} rows converted to relational.`)

    // ----------------------------------------------------
    // STEP 5: Integrity & Trial Balance Verification
    // ----------------------------------------------------
    console.log("\n[VERIFICATION] Running integrity audits...")
    const [[{ count: postJeCount }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entries")
    const [[{ count: postJelCount }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entry_lines")
    const [[{ count: postCoaCount }]] = await conn.query("SELECT COUNT(*) as count FROM chart_of_accounts")

    console.log(`  Row count check:
    journal_entries: ${postJeCount} (expected: ${preJeCount})
    journal_entry_lines: ${postJelCount} (expected: ${preJelCount})
    chart_of_accounts: ${postCoaCount} (expected: ${preCoaCount})`)

    if (postJeCount !== preJeCount || postJelCount !== preJelCount || postCoaCount !== preCoaCount) {
      throw new Error("Row count mismatch detected after migration!")
    }

    // Check for orphan lines
    const [orphans] = await conn.query(`
      SELECT l.id, l.journal_entry_id 
      FROM journal_entry_lines l 
      LEFT JOIN journal_entries e ON l.journal_entry_id = e.id 
      WHERE e.id IS NULL
    `)
    console.log(`  Orphan check: ${orphans.length} orphan lines found.`)
    if (orphans.length > 0) {
      throw new Error(`Orphan lines detected: ${JSON.stringify(orphans)}`)
    }

    // Trial Balance Parity
    const [[{ total_debit, total_credit }]] = await conn.query(`
      SELECT 
        SUM(debit_amount) as total_debit, 
        SUM(credit_amount) as total_credit 
      FROM journal_entry_lines
    `)
    const diff = Math.abs(Number(total_debit) - Number(total_credit))
    console.log(`  Trial Balance Parity:
    Total Debit : ${Number(total_debit).toLocaleString()} ETB
    Total Credit: ${Number(total_credit).toLocaleString()} ETB
    Discrepancy : ${diff.toFixed(2)} ETB`)

    if (diff > 0.001) {
      throw new Error(`Trial balance discrepancy detected: ${diff}`)
    }

    console.log("\n=== FULL RELATIONAL MIGRATION COMPLETED SUCCESSFULLY ===")
  } finally {
    await conn.end()
  }
}

runMigration().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
