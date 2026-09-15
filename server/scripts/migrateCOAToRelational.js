import { pool } from "../db/client.js"

export async function migrateCOAToRelational() {
  console.log("==================================================================")
  console.log("   HKC-ERP v5: CHART OF ACCOUNTS RELATIONAL MIGRATION           ")
  console.log("==================================================================")

  const [cols] = await pool.query("DESCRIBE chart_of_accounts")
  const colNames = new Set(cols.map((c) => c.Field))

  const columnsToAdd = [
    { name: "code", type: "VARCHAR(50) NULL" },
    { name: "name", type: "VARCHAR(191) NULL" },
    { name: "account_type", type: "VARCHAR(50) NULL" },
    { name: "peachtree_type", type: "VARCHAR(100) NULL" },
    { name: "parent_account_id", type: "VARCHAR(191) NULL" },
    { name: "is_group", type: "TINYINT(1) NOT NULL DEFAULT 0" },
    { name: "is_active", type: "TINYINT(1) NOT NULL DEFAULT 1" },
  ]

  for (const col of columnsToAdd) {
    if (!colNames.has(col.name)) {
      console.log(`Adding column \`${col.name}\` (${col.type}) to \`chart_of_accounts\`...`)
      await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN \`${col.name}\` ${col.type}`)
    } else {
      console.log(`Column \`${col.name}\` already exists on \`chart_of_accounts\`.`)
    }
  }

  // Make payload NULLABLE if it was NOT NULL, to allow new relational inserts without requiring dummy payload
  try {
    await pool.query("ALTER TABLE chart_of_accounts MODIFY COLUMN `payload` JSON NULL")
  } catch (err) {
    console.warn("Notice: could not alter payload to NULLable (may already be NULLable):", err.message)
  }

  // Populate discrete columns from payload
  const [rows] = await pool.query("SELECT id, payload FROM chart_of_accounts")
  console.log(`\nFound ${rows.length} accounts to migrate/populate in \`chart_of_accounts\`...`)

  let updatedCount = 0
  for (const row of rows) {
    if (!row.payload) continue
    const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload

    const code = p.code || row.id
    const name = p.name || code
    const accountType = p.account_type || "Asset"
    const peachtreeType = p.peachtree_type || null
    const parentAccountId = p.parent_account_id || null
    const isGroup = p.is_group ? 1 : 0
    const isActive = p.is_active !== false ? 1 : 0

    await pool.query(
      `UPDATE chart_of_accounts 
       SET code = ?, name = ?, account_type = ?, peachtree_type = ?, parent_account_id = ?, is_group = ?, is_active = ?
       WHERE id = ?`,
      [code, name, accountType, peachtreeType, parentAccountId, isGroup, isActive, row.id]
    )
    updatedCount++
  }

  console.log(`✅ Successfully updated ${updatedCount} rows with discrete relational columns.`)

  // Add indexes if not present
  try {
    const [indexes] = await pool.query("SHOW INDEX FROM chart_of_accounts")
    const indexNames = new Set(indexes.map((i) => i.Key_name))

    if (!indexNames.has("idx_coa_code")) {
      console.log("Creating index `idx_coa_code`...")
      await pool.query("CREATE INDEX idx_coa_code ON chart_of_accounts (code)")
    }
    if (!indexNames.has("idx_coa_account_type")) {
      console.log("Creating index `idx_coa_account_type`...")
      await pool.query("CREATE INDEX idx_coa_account_type ON chart_of_accounts (account_type)")
    }
  } catch (idxErr) {
    console.warn("Notice on index creation:", idxErr.message)
  }

  console.log("🎉 Chart of Accounts relational migration complete!\n")
}

// Run if called directly
if (process.argv[1]?.endsWith("migrateCOAToRelational.js")) {
  migrateCOAToRelational()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Migration failed:", err)
      pool.end()
      process.exit(1)
    })
}
