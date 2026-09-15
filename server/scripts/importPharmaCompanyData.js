import fs from "fs"
import { pool } from "../db/client.js"

const TABLES_TO_WIPE = [
  "export_warehouse_movements",
  "export_products",
  "pharma_product_batches",
  "stock_movements",
  "store_transfer_items",
  "store_transfers",
  "sales_issue_items",
  "sales_issues",
  "quarantine_records",
  "invoices",
  "payments",
  "sales_orders",
  "purchase_orders",
  "journal_entry_lines",
  "journal_entries",
  "expenses",
  "recurring_expense_schedules",
  "customers",
  "suppliers",
  "attendance_records",
  "leave_requests",
  "payroll_records",
  "payroll_periods",
  "employees",
  "vehicles",
  "shipment_documents",
  "processing_services",
  "hkc_doc_records",
  "user_activity_logs",
  "pharma_products",
]

// SQL dump path
const DUMP_PATH = "/Users/Noah/Desktop/hkc_trading_data.sql"

function parseSqlValues(content, tableName) {
  const startTag = `INSERT INTO \`${tableName}\``
  const startIdx = content.indexOf(startTag)
  if (startIdx === -1) return { columns: [], rows: [] }

  const valuesIdx = content.indexOf("VALUES", startIdx)
  if (valuesIdx === -1) return { columns: [], rows: [] }

  const colHeader = content.substring(startIdx + startTag.length, valuesIdx)
  const colMatch = colHeader.match(/\(([^)]+)\)/)
  const columns = colMatch ? colMatch[1].split(",").map((c) => c.trim().replace(/`/g, "")) : []

  let inStr = false
  let isEscaped = false
  let endIdx = -1

  for (let i = valuesIdx + 6; i < content.length; i++) {
    const char = content[i]
    if (isEscaped) {
      isEscaped = false
      continue
    }
    if (char === "\\") {
      isEscaped = true
      continue
    }
    if (char === "'") {
      inStr = !inStr
      continue
    }
    if (char === ";" && !inStr) {
      endIdx = i
      break
    }
  }

  if (endIdx === -1) return { columns, rows: [] }
  const rawValuesBlock = content.substring(valuesIdx + 6, endIdx).trim()

  // Parse tuples like (val1, val2, ...), (val1, val2, ...)
  const rows = []
  let currentRow = []
  let currentVal = ""
  let inString = false
  let escapeNext = false
  let inTuple = false

  for (let i = 0; i < rawValuesBlock.length; i++) {
    const char = rawValuesBlock[i]

    if (escapeNext) {
      currentVal += char
      escapeNext = false
      continue
    }

    if (char === "\\") {
      escapeNext = true
      currentVal += char
      continue
    }

    if (char === "'" && !inString) {
      inString = true
      continue
    } else if (char === "'" && inString) {
      // Check for escaped quote '' in SQL
      if (rawValuesBlock[i + 1] === "'") {
        currentVal += "'"
        i++
        continue
      }
      inString = false
      continue
    }

    if (inString) {
      currentVal += char
      continue
    }

    if (char === "(" && !inTuple) {
      inTuple = true
      currentRow = []
      currentVal = ""
      continue
    }

    if (char === "," && inTuple) {
      currentRow.push(normalizeSqlValue(currentVal.trim()))
      currentVal = ""
      continue
    }

    if (char === ")" && inTuple) {
      currentRow.push(normalizeSqlValue(currentVal.trim()))
      rows.push(currentRow)
      currentRow = []
      currentVal = ""
      inTuple = false
      continue
    }

    if (inTuple) {
      currentVal += char
    }
  }

  return { columns, rows }
}

function normalizeSqlValue(val) {
  if (val === "NULL" || val === "null" || val === "") return null
  // Unescape MySQL escapes if present
  let unescaped = val.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n").replace(/\\r/g, "\r")
  return unescaped
}

async function run() {
  console.log("==================================================================")
  console.log("   HKC-ERP v5: WIPE TRANSACTIONAL DATA & IMPORT REAL COMPANY DATA  ")
  console.log("==================================================================")

  if (!fs.existsSync(DUMP_PATH)) {
    console.error(`Dump file not found at: ${DUMP_PATH}`)
    process.exit(1)
  }

  const dumpContent = fs.readFileSync(DUMP_PATH, "utf-8")
  const conn = await pool.getConnection()

  try {
    console.log("\n[1/6] Disabling foreign key checks...")
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    console.log("\n[2/6] Wiping transactional and test data...")
    for (const table of TABLES_TO_WIPE) {
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``)
        console.log(`  ✓ Cleared table: \`${table}\``)
      } catch (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
          console.log(`  - Table \`${table}\` does not exist (skipping).`)
        } else {
          console.warn(`  ! Could not truncate \`${table}\`: ${err.message}`)
        }
      }
    }

    // Ensure warehouses table has correct definitions
    console.log("\n[3/6] Synchronizing warehouse definitions...")
    await conn.query(`
      INSERT INTO \`warehouses\` (\`id\`, \`name\`, \`code\`, \`warehouse_type\`, \`location\`)
      VALUES 
        ('WH1', 'WH1 - Ethiopia Agricultural Export Hub', 'WH1-AGRI-EXP', 'EXPORT_WH', 'Modjo Export Terminal, Ethiopia'),
        ('WH2', 'WH2 - Veterinary Import Hub (alem bank)', 'WH2-VET-ALEM', 'PHARMA_WH', 'Alem Bank Hub, Addis Ababa, Ethiopia'),
        ('WH3', 'WH3 - Veterinary Import Hub (LEBU)', 'WH3-VET-LEBU', 'PHARMA_WH', 'Lebu Commercial Center, Addis Ababa, Ethiopia')
      ON DUPLICATE KEY UPDATE
        \`name\` = VALUES(\`name\`),
        \`code\` = VALUES(\`code\`),
        \`warehouse_type\` = VALUES(\`warehouse_type\`),
        \`location\` = VALUES(\`location\`)
    `)
    console.log("  ✓ Warehouses verified (WH1, WH2, WH3).")

    // Parse dump data
    console.log("\n[4/6] Parsing SQL dump data...")
    const parsedPharma = parseSqlValues(dumpContent, "pharma_products")
    const parsedBatches = parseSqlValues(dumpContent, "pharma_product_batches")
    const parsedMovements = parseSqlValues(dumpContent, "stock_movements")
    const parsedUsers = parseSqlValues(dumpContent, "users")
    const parsedSessions = parseSqlValues(dumpContent, "user_sessions")

    console.log(`  • Extracted ${parsedPharma.rows.length} pharma_products`)
    console.log(`  • Extracted ${parsedBatches.rows.length} pharma_product_batches`)
    console.log(`  • Extracted ${parsedMovements.rows.length} stock_movements`)
    console.log(`  • Extracted ${parsedUsers.rows.length} users`)
    console.log(`  • Extracted ${parsedSessions.rows.length} user_sessions`)

    // Insert pharma_products
    console.log("\n[5/6] Inserting company pharma records...")
    const validProductIds = new Set()
    for (const row of parsedPharma.rows) {
      const rowObj = {}
      parsedPharma.columns.forEach((col, idx) => {
        rowObj[col] = row[idx]
      })
      validProductIds.add(rowObj.id)

      const cols = Object.keys(rowObj).map((c) => `\`${c}\``).join(", ")
      const placeholders = Object.keys(rowObj).map(() => "?").join(", ")
      const updateClause = Object.keys(rowObj).map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(", ")

      await conn.query(
        `INSERT INTO \`pharma_products\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
        Object.values(rowObj)
      )
    }
    console.log(`  ✓ Inserted ${validProductIds.size} pharma_products into database.`)

    // Insert pharma_product_batches (skipping any orphan batches without product)
    let batchInsertCount = 0
    let skippedBatchCount = 0
    for (const row of parsedBatches.rows) {
      const rowObj = {}
      parsedBatches.columns.forEach((col, idx) => {
        rowObj[col] = row[idx]
      })

      if (!validProductIds.has(rowObj.product_id)) {
        console.log(`  ! Skipping orphan batch: ${rowObj.id} (product ${rowObj.product_id} does not exist)`)
        skippedBatchCount++
        continue
      }

      const cols = Object.keys(rowObj).map((c) => `\`${c}\``).join(", ")
      const placeholders = Object.keys(rowObj).map(() => "?").join(", ")
      const updateClause = Object.keys(rowObj).map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(", ")

      await conn.query(
        `INSERT INTO \`pharma_product_batches\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
        Object.values(rowObj)
      )
      batchInsertCount++
    }
    console.log(`  ✓ Inserted ${batchInsertCount} pharma_product_batches (skipped ${skippedBatchCount} orphan batches).`)

    // Insert stock_movements
    let movementInsertCount = 0
    for (const row of parsedMovements.rows) {
      const rowObj = {}
      parsedMovements.columns.forEach((col, idx) => {
        rowObj[col] = row[idx]
      })

      const cols = Object.keys(rowObj).map((c) => `\`${c}\``).join(", ")
      const placeholders = Object.keys(rowObj).map(() => "?").join(", ")
      const updateClause = Object.keys(rowObj).map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(", ")

      await conn.query(
        `INSERT INTO \`stock_movements\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
        Object.values(rowObj)
      )
      movementInsertCount++
    }
    console.log(`  ✓ Inserted ${movementInsertCount} stock_movements.`)

    // Upsert users
    let userUpsertCount = 0
    for (const row of parsedUsers.rows) {
      const rowObj = {}
      parsedUsers.columns.forEach((col, idx) => {
        rowObj[col] = row[idx]
      })

      const cols = Object.keys(rowObj).map((c) => `\`${c}\``).join(", ")
      const placeholders = Object.keys(rowObj).map(() => "?").join(", ")
      const updateClause = Object.keys(rowObj).map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(", ")

      await conn.query(
        `INSERT INTO \`users\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
        Object.values(rowObj)
      )
      userUpsertCount++
    }
    console.log(`  ✓ Upserted ${userUpsertCount} users.`)

    // Upsert user_sessions
    let sessionUpsertCount = 0
    for (const row of parsedSessions.rows) {
      const rowObj = {}
      parsedSessions.columns.forEach((col, idx) => {
        rowObj[col] = row[idx]
      })

      const cols = Object.keys(rowObj).map((c) => `\`${c}\``).join(", ")
      const placeholders = Object.keys(rowObj).map(() => "?").join(", ")
      const updateClause = Object.keys(rowObj).map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(", ")

      await conn.query(
        `INSERT INTO \`user_sessions\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
        Object.values(rowObj)
      )
      sessionUpsertCount++
    }
    console.log(`  ✓ Upserted ${sessionUpsertCount} user_sessions.`)

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")

    // Verification
    console.log("\n[6/6] Final Database Status Verification:")
    const tablesToCheck = [
      "pharma_products",
      "pharma_product_batches",
      "stock_movements",
      "users",
      "user_sessions",
      "warehouses",
      "tax_rules",
      "chart_of_accounts",
      "quarantine_records",
      "sales_issues",
      "store_transfers",
    ]

    for (const t of tablesToCheck) {
      try {
        const [res] = await conn.query(`SELECT COUNT(*) as count FROM \`${t}\``)
        console.log(`  • ${t.padEnd(25)}: ${res[0].count} records`)
      } catch (err) {
        console.log(`  • ${t.padEnd(25)}: [Table not found or error]`)
      }
    }

    console.log("\n==================================================================")
    console.log("   IMPORT COMPLETED SUCCESSFULLY!                                 ")
    console.log("==================================================================")
  } catch (err) {
    console.error("FATAL ERROR during import:", err)
  } finally {
    conn.release()
    await pool.end()
  }
}

run()
