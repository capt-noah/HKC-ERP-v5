import fs from "fs"
import path from "path"
import { pool } from "../db/client.js"

const DUMP_PATH = path.resolve(process.env.HOME, "Desktop", "hkc_trading (3).sql")
const EXPORT_PATH = path.resolve(process.env.HOME, "Desktop", "hkc_trading_reconciled_final.sql")

console.log("=== PLESK DATABASE JOURNAL RECONCILIATION & LOCAL IMPORT ===")
console.log(`Reading source dump: ${DUMP_PATH}`)

if (!fs.existsSync(DUMP_PATH)) {
  console.error(`Dump file not found at ${DUMP_PATH}`)
  process.exit(1)
}

const content = fs.readFileSync(DUMP_PATH, "utf8")

// Helper: Parse table schema and rows from dump
function parseTableRows(tableName) {
  const insertRegex = new RegExp(`INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES\\s*([\\s\\S]*?);`, "g")
  const rows = []
  let match
  let columns = []
  while ((match = insertRegex.exec(content)) !== null) {
    columns = match[1].split(",").map(c => c.trim().replace(/`/g, ""))
    const valuesBlock = match[2]
    
    let cur = ""
    let inQuote = false
    let escape = false
    let inTuple = false
    let tupleTokens = []

    for (let i = 0; i < valuesBlock.length; i++) {
      const char = valuesBlock[i]
      if (char === "\\" && inQuote) {
        escape = !escape
        cur += char
        continue
      }
      if (char === "'" && !escape) {
        inQuote = !inQuote
        cur += char
        continue
      }
      escape = false

      if (!inQuote) {
        if (char === "(" && !inTuple) {
          inTuple = true
          cur = ""
          tupleTokens = []
          continue
        } else if (char === ")" && inTuple) {
          if (cur.trim()) tupleTokens.push(cur.trim())
          inTuple = false
          
          // Process tuple
          const obj = {}
          columns.forEach((col, idx) => {
            let val = tupleTokens[idx]
            if (val === undefined || val === "NULL" || val === "null") {
              obj[col] = null
            } else if (val.startsWith("'") && val.endsWith("'")) {
              let s = val.slice(1, -1)
              s = s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n").replace(/\\r/g, "\r")
              obj[col] = s
            } else if (!isNaN(Number(val))) {
              obj[col] = Number(val)
            } else {
              obj[col] = val
            }
          })
          rows.push(obj)
          cur = ""
          continue
        } else if (char === "," && inTuple) {
          tupleTokens.push(cur.trim())
          cur = ""
          continue
        }
      }
      if (inTuple) {
        cur += char
      }
    }
  }
  return { columns, rows }
}

// 1. Parse target tables
console.log("Parsing tables from dump...")
const pharmaProductsData = parseTableRows("pharma_products")
const pharmaBatchesData = parseTableRows("pharma_product_batches")
const stockMovementsData = parseTableRows("stock_movements")
const exportProductsData = parseTableRows("export_products")
const exportMovementsData = parseTableRows("export_warehouse_movements")
const quarantineData = parseTableRows("quarantine_records")
const salesOrdersData = parseTableRows("sales_orders")
const salesIssuesData = parseTableRows("sales_issues")
const salesIssueItemsData = parseTableRows("sales_issue_items")
const journalEntriesData = parseTableRows("journal_entries")
const journalLinesData = parseTableRows("journal_entry_lines")
const customersData = parseTableRows("customers")
const suppliersData = parseTableRows("suppliers")
const shipmentDocsData = parseTableRows("shipment_documents")
const taxRulesData = parseTableRows("tax_rules")
const coaData = parseTableRows("chart_of_accounts")
const glMappingsData = parseTableRows("gl_account_mappings")

console.log(`Parsed:
  - pharma_products: ${pharmaProductsData.rows.length}
  - pharma_product_batches: ${pharmaBatchesData.rows.length}
  - stock_movements: ${stockMovementsData.rows.length}
  - journal_entries: ${journalEntriesData.rows.length}
  - journal_entry_lines: ${journalLinesData.rows.length}
  - sales_orders: ${salesOrdersData.rows.length}
  - sales_issues: ${salesIssuesData.rows.length}
  - sales_issue_items: ${salesIssueItemsData.rows.length}
`)

// 2. Align stock_movements quantities for TETRACOZASH 900 & 3400
stockMovementsData.rows.forEach(sm => {
  if (sm.id === "SM-INIT-P-1790842873592-1790842874102") {
    sm.quantity = 1980.00
    sm.quantity_after = 1980.00
  }
  if (sm.id === "SM-INIT-P-1790844492109-1790844492880") {
    sm.quantity = 4329.00
    sm.quantity_after = 4329.00
  }
})

// 3. Cleanse Journal Entries & Lines
const badJeIds = new Set([
  "JE-2026-1790857518031", // Ashiver duplicate 1043
  "JE-2026-1790857518032", // Ashiver duplicate 3900
  "JE-2026-1790857518033", // Ashiver duplicate 57
  "JE-2026-1790857518034", // Ashiver orphan 1200
  "JE-2026-1790857518036", // Ashiver empty header (recreated cleanly below)
])

// Filter out bad JEs
const cleanJournalEntries = journalEntriesData.rows.filter(je => !badJeIds.has(je.id))

// Filter out bad lines & duplicate COGS lines
const cleanJournalLines = journalLinesData.rows.filter(jl => {
  let p = {}
  try { p = typeof jl.payload === "string" ? JSON.parse(jl.payload) : (jl.payload || {}) } catch (e) {}
  const jeId = jl.journal_entry_id || p.journal_entry_id || ""
  const lineId = jl.id || p.id || ""

  if (badJeIds.has(jeId)) return false
  if (jeId.startsWith("JE-COGS-") && (lineId.endsWith("-1") || lineId.endsWith("-2"))) return false
  return true
})

console.log(`Cleaned existing journal entries: ${cleanJournalEntries.length} (purged ${badJeIds.size})`)
console.log(`Cleaned existing journal lines: ${cleanJournalLines.length}`)

// 4. Create missing intake entries for the 8 unposted batches
const missingBatches = [
  {
    batchId: "BAT-1791355766364-utnl",
    productId: "P-1791355747403",
    productName: "ASHIVER 5",
    batchNo: "ALT26115",
    qty: 43,
    cost: 189.38,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: true
  },
  {
    batchId: "BAT-1791363547167-tbgl",
    productId: "P-1791363313534",
    productName: "ASHTYL 20% 100G",
    batchNo: "ALG26143",
    qty: 9,
    cost: 3388.89,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: true
  },
  {
    batchId: "BAT-1791363650006-g2rh",
    productId: "P-1791363313534",
    productName: "ASHTYL 20% 100G",
    batchNo: "ALG26144",
    qty: 600,
    cost: 3388.89,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: true
  },
  {
    batchId: "BAT-1791363673598-5622",
    productId: "P-1791363313534",
    productName: "ASHTYL 20% 100G",
    batchNo: "ALG26145",
    qty: 600,
    cost: 3388.89,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: true
  },
  {
    batchId: "BAT-1791363956359-6oa6",
    productId: "P-1791363873086",
    productName: "ASHTYL 20% 100G",
    batchNo: "ALG26215",
    qty: 255,
    cost: 3388.89,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: true
  },
  {
    batchId: "PB-P-1791363873086-1791363876032",
    productId: "P-1791363873086",
    productName: "ASHTYL 20% 100G",
    batchNo: "ALG26174",
    qty: 600,
    cost: 3388.89,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: false
  },
  {
    batchId: "PB-P-1791364508749-1791364509384",
    productId: "P-1791364508749",
    productName: "ASHIENRO-BH",
    batchNo: "ALL26048",
    qty: 100,
    cost: 378.76,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: false
  },
  {
    batchId: "PB-P-1791364630141-1791364630786",
    productId: "P-1791364630786",
    productName: "ASHIENRO-BH",
    batchNo: "ALL26071",
    qty: 19900,
    cost: 378.76,
    entryDate: "2026-10-07",
    warehouseId: "WH2",
    isChild: false
  }
]

let createdIntakeTotal = 0

missingBatches.forEach(item => {
  const amount = Math.round(item.qty * item.cost * 100) / 100
  createdIntakeTotal += amount
  const jeId = `JE-INTAKE-${item.batchId}`
  const desc = item.isChild
    ? `Child Batch Intake Valuation: ${item.productName} [Batch: ${item.batchNo}] (+${item.qty} Box @ ETB ${item.cost})`
    : `Initial Inventory Stock Intake & Beginning Valuation — ${item.productName} (Batch: ${item.batchNo}, Qty: ${item.qty} @ ETB ${item.cost})`

  const jePayload = {
    id: jeId,
    entry_number: jeId,
    entry_date: item.entryDate,
    description: desc,
    source_type: "Inventory Intake",
    source_id: item.batchId,
    posting_status: "POSTED",
    total_amount: amount,
    currency: "ETB",
    exchange_rate: 1,
    created_by: "System Initializer",
    created_at: `${item.entryDate}T00:00:00.000Z`,
    updated_at: new Date().toISOString()
  }

  cleanJournalEntries.push({
    id: jeId,
    payload: JSON.stringify(jePayload),
    created_at: `${item.entryDate} 00:00:00.000`,
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " ")
  })

  // DR: Stock of Veterinary Drug (1400-01)
  const lineDrId = `${jeId}-DR`
  const drPayload = {
    id: lineDrId,
    journal_entry_id: jeId,
    account_id: "1400-01",
    account_code: "1400-01",
    account_name: "STOCK OF VETERINARY DRUG",
    description: desc,
    debit_amount: amount,
    credit_amount: 0,
    currency: "ETB",
    exchange_rate_at_time: 1,
    warehouse_id: item.warehouseId,
    is_cleared: true,
    cleared_date: item.entryDate,
    created_at: `${item.entryDate}T00:00:00.000Z`,
    updated_at: new Date().toISOString()
  }
  cleanJournalLines.push({
    id: lineDrId,
    payload: JSON.stringify(drPayload),
    created_at: `${item.entryDate} 00:00:00.000`,
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " ")
  })

  // CR: Owner's Capital / Beginning Equity (3000-01)
  const lineCrId = `${jeId}-CR`
  const crPayload = {
    id: lineCrId,
    journal_entry_id: jeId,
    account_id: "3000-01",
    account_code: "3000-01",
    account_name: "HABTOM KEBEDE'S CAPITAL",
    description: desc,
    debit_amount: 0,
    credit_amount: amount,
    currency: "ETB",
    exchange_rate_at_time: 1,
    warehouse_id: item.warehouseId,
    is_cleared: true,
    cleared_date: item.entryDate,
    created_at: `${item.entryDate}T00:00:00.000Z`,
    updated_at: new Date().toISOString()
  }
  cleanJournalLines.push({
    id: lineCrId,
    payload: JSON.stringify(crPayload),
    created_at: `${item.entryDate} 00:00:00.000`,
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " ")
  })
})

console.log(`Generated balanced intake JEs for 8 missing batches totaling ETB ${createdIntakeTotal.toFixed(2)}`)
console.log(`Total reconciled journal entries: ${cleanJournalEntries.length}`)
console.log(`Total reconciled journal lines: ${cleanJournalLines.length}`)

// 5. Verify Parity on In-Memory Reconciled Data
let totalCostValuation = 0
let totalSaleValuation = 0

pharmaBatchesData.rows.filter(b => b.qa_status === "Released").forEach(b => {
  const p = pharmaProductsData.rows.find(prod => prod.id === b.product_id)
  const cost = Number(b.unit_cost || (p ? p.unit_cost : 0) || 0)
  const sale = Number(b.selling_price || (p ? p.selling_price : 0) || cost * 1.25)
  totalCostValuation += Number(b.quantity || 0) * cost
  totalSaleValuation += Number(b.quantity || 0) * sale
})

let dr1400 = 0
let cr1400 = 0
cleanJournalLines.forEach(l => {
  let p = {}
  try { p = typeof l.payload === "string" ? JSON.parse(l.payload) : (l.payload || {}) } catch (e) {}
  const acc = l.account_id || p.account_id
  const dr = Number(l.debit_amount ?? p.debit_amount ?? 0)
  const cr = Number(l.credit_amount ?? p.credit_amount ?? 0)
  if (acc === "1400-01") {
    dr1400 += dr
    cr1400 += cr
  }
})

const net1400 = dr1400 - cr1400

console.log("\n--- IN-MEMORY PARITY VERIFICATION ---")
console.log(`Batches Active Stock Cost Valuation: ETB ${totalCostValuation.toFixed(2)}`)
console.log(`Batches Active Stock Sale Valuation: ETB ${totalSaleValuation.toFixed(2)}`)
console.log(`Stock COA (1400-01) Debits:          ETB ${dr1400.toFixed(2)}`)
console.log(`Stock COA (1400-01) Credits:         ETB ${cr1400.toFixed(2)}`)
console.log(`Stock COA (1400-01) Net Balance:     ETB ${net1400.toFixed(2)}`)
console.log(`VARIANCE:                            ETB ${(totalCostValuation - net1400).toFixed(2)}`)

if (Math.abs(totalCostValuation - net1400) > 0.01) {
  console.error("CRITICAL: Variance is not 0.00! Aborting import.")
  process.exit(1)
}

// 6. Import Reconciled Dataset into Local MySQL
async function runLocalImport() {
  console.log("\nConnecting to local MySQL database...")
  const conn = await pool.getConnection()
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0;")
    await conn.beginTransaction()

    console.log("Wiping local operational testing tables...")
    const operationalTables = [
      "pharma_products",
      "pharma_product_batches",
      "stock_movements",
      "quarantine_records",
      "export_products",
      "export_warehouse_movements",
      "sales_orders",
      "sales_issues",
      "sales_issue_items",
      "invoices",
      "payments",
      "journal_entries",
      "journal_entry_lines",
      "store_transfers",
      "store_transfer_items"
    ]

    for (const t of operationalTables) {
      await conn.query(`TRUNCATE TABLE \`${t}\``)
    }

    // Helper: Bulk Insert
    async function insertTable(tableName, cols, rows) {
      if (rows.length === 0) return
      const colList = cols.map(c => `\`${c}\``).join(", ")
      const placeholders = `(${cols.map(() => "?").join(", ")})`
      
      const batchSize = 100
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize)
        const sql = `INSERT INTO \`${tableName}\` (${colList}) VALUES ${chunk.map(() => placeholders).join(", ")}`
        const flatValues = []
        chunk.forEach(r => {
          cols.forEach(c => {
            let val = r[c]
            if (val !== null && typeof val === "object") {
              val = JSON.stringify(val)
            }
            flatValues.push(val)
          })
        })
        await conn.query(sql, flatValues)
      }
      console.log(`  ✓ Inserted ${rows.length} rows into \`${tableName}\``)
    }

    console.log("Importing reconciled data into local MySQL...")
    await insertTable("pharma_products", pharmaProductsData.columns, pharmaProductsData.rows)
    await insertTable("pharma_product_batches", pharmaBatchesData.columns, pharmaBatchesData.rows)
    await insertTable("stock_movements", stockMovementsData.columns, stockMovementsData.rows)
    await insertTable("quarantine_records", quarantineData.columns, quarantineData.rows)
    await insertTable("export_products", exportProductsData.columns, exportProductsData.rows)
    await insertTable("export_warehouse_movements", exportMovementsData.columns, exportMovementsData.rows)
    await insertTable("sales_orders", salesOrdersData.columns, salesOrdersData.rows)
    await insertTable("sales_issues", salesIssuesData.columns, salesIssuesData.rows)
    await insertTable("sales_issue_items", salesIssueItemsData.columns, salesIssueItemsData.rows)

    // Format journal entries and lines columns
    const jeCols = ["id", "payload", "created_at", "updated_at"]
    await insertTable("journal_entries", jeCols, cleanJournalEntries)
    await insertTable("journal_entry_lines", jeCols, cleanJournalLines)

    await conn.commit()
    await conn.query("SET FOREIGN_KEY_CHECKS = 1;")
    console.log("✓ Local database successfully populated and committed!")
  } catch (err) {
    await conn.rollback()
    await conn.query("SET FOREIGN_KEY_CHECKS = 1;")
    console.error("Failed to import into local MySQL:", err)
    throw err
  } finally {
    conn.release()
  }
}

// 7. Generate Clean Export SQL Dump for Plesk
function generateCleanExportDump() {
  console.log(`\nGenerating clean export SQL dump for Plesk at: ${EXPORT_PATH}`)
  
  // Extract CREATE TABLE statements from source content
  const tableCreateStatements = new Map()
  const createTableRegex = /CREATE TABLE `([^`]+)` \([\s\S]*?\) ENGINE=[^;]+;/g
  let match
  while ((match = createTableRegex.exec(content)) !== null) {
    tableCreateStatements.set(match[1], match[0])
  }

  let out = `-- Reconciled Clean Plesk Export Dump
-- Generated at: ${new Date().toISOString()}
-- Database: hkc_trading

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

`

  // Helper to dump table
  function dumpTable(tableName, cols, rows) {
    out += `\n-- --------------------------------------------------------\n`
    out += `-- Table structure for table \`${tableName}\`\n--\n`
    out += `DROP TABLE IF EXISTS \`${tableName}\`;\n`
    const createSql = tableCreateStatements.get(tableName)
    if (createSql) {
      out += `${createSql}\n\n`
    }

    if (rows.length > 0) {
      out += `-- Dumping data for table \`${tableName}\`\n--\n`
      const colList = cols.map(c => `\`${c}\``).join(", ")
      
      const batchSize = 50
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize)
        out += `INSERT INTO \`${tableName}\` (${colList}) VALUES\n`
        const tupleSqls = chunk.map(r => {
          const vals = cols.map(c => {
            let v = r[c]
            if (v === null || v === undefined) return "NULL"
            if (typeof v === "number") return String(v)
            if (typeof v === "object") v = JSON.stringify(v)
            const escaped = String(v)
              .replace(/\\/g, "\\\\")
              .replace(/'/g, "\\'")
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r")
            return `'${escaped}'`
          })
          return `(${vals.join(", ")})`
        })
        out += tupleSqls.join(",\n") + ";\n"
      }
    }
  }

  // Dump all tables in proper order
  dumpTable("attendance_records", parseTableRows("attendance_records").columns, parseTableRows("attendance_records").rows)
  dumpTable("bank_reconciliations", parseTableRows("bank_reconciliations").columns, parseTableRows("bank_reconciliations").rows)
  dumpTable("chart_of_accounts", coaData.columns, coaData.rows)
  dumpTable("company_settings", parseTableRows("company_settings").columns, parseTableRows("company_settings").rows)
  dumpTable("customers", customersData.columns, customersData.rows)
  dumpTable("employees", parseTableRows("employees").columns, parseTableRows("employees").rows)
  dumpTable("expenses", parseTableRows("expenses").columns, parseTableRows("expenses").rows)
  dumpTable("export_products", exportProductsData.columns, exportProductsData.rows)
  dumpTable("export_warehouse_movements", exportMovementsData.columns, exportMovementsData.rows)
  dumpTable("gl_account_mappings", glMappingsData.columns, glMappingsData.rows)
  dumpTable("hkc_doc_records", parseTableRows("hkc_doc_records").columns, parseTableRows("hkc_doc_records").rows)
  dumpTable("invoices", parseTableRows("invoices").columns, parseTableRows("invoices").rows)
  dumpTable("journal_entries", ["id", "payload", "created_at", "updated_at"], cleanJournalEntries)
  dumpTable("journal_entry_lines", ["id", "payload", "created_at", "updated_at"], cleanJournalLines)
  dumpTable("leave_requests", parseTableRows("leave_requests").columns, parseTableRows("leave_requests").rows)
  dumpTable("leave_types", parseTableRows("leave_types").columns, parseTableRows("leave_types").rows)
  dumpTable("payments", parseTableRows("payments").columns, parseTableRows("payments").rows)
  dumpTable("payroll_periods", parseTableRows("payroll_periods").columns, parseTableRows("payroll_periods").rows)
  dumpTable("payroll_records", parseTableRows("payroll_records").columns, parseTableRows("payroll_records").rows)
  dumpTable("pharma_products", pharmaProductsData.columns, pharmaProductsData.rows)
  dumpTable("pharma_product_batches", pharmaBatchesData.columns, pharmaBatchesData.rows)
  dumpTable("processing_services", parseTableRows("processing_services").columns, parseTableRows("processing_services").rows)
  dumpTable("purchase_orders", parseTableRows("purchase_orders").columns, parseTableRows("purchase_orders").rows)
  dumpTable("quarantine_records", quarantineData.columns, quarantineData.rows)
  dumpTable("recurring_expense_schedules", parseTableRows("recurring_expense_schedules").columns, parseTableRows("recurring_expense_schedules").rows)
  dumpTable("sales_orders", salesOrdersData.columns, salesOrdersData.rows)
  dumpTable("sales_issues", salesIssuesData.columns, salesIssuesData.rows)
  dumpTable("sales_issue_items", salesIssueItemsData.columns, salesIssueItemsData.rows)
  dumpTable("shipment_documents", shipmentDocsData.columns, shipmentDocsData.rows)
  dumpTable("stock_movements", stockMovementsData.columns, stockMovementsData.rows)
  dumpTable("store_transfers", parseTableRows("store_transfers").columns, parseTableRows("store_transfers").rows)
  dumpTable("store_transfer_items", parseTableRows("store_transfer_items").columns, parseTableRows("store_transfer_items").rows)
  dumpTable("suppliers", suppliersData.columns, suppliersData.rows)
  dumpTable("tax_rules", taxRulesData.columns, taxRulesData.rows)
  dumpTable("users", parseTableRows("users").columns, parseTableRows("users").rows)
  dumpTable("user_activity_logs", parseTableRows("user_activity_logs").columns, parseTableRows("user_activity_logs").rows)
  dumpTable("user_sessions", parseTableRows("user_sessions").columns, parseTableRows("user_sessions").rows)
  dumpTable("vehicles", parseTableRows("vehicles").columns, parseTableRows("vehicles").rows)
  dumpTable("warehouses", parseTableRows("warehouses").columns, parseTableRows("warehouses").rows)

  // Append original indexes and constraints section
  const indexIdx = content.indexOf("-- Indexes for dumped tables")
  if (indexIdx !== -1) {
    out += `\n-- --------------------------------------------------------\n\n`
    out += content.slice(indexIdx)
  } else {
    out += `\nSET FOREIGN_KEY_CHECKS = 1;\nCOMMIT;\n`
  }
  
  fs.writeFileSync(EXPORT_PATH, out, "utf8")
  const stats = fs.statSync(EXPORT_PATH)
  console.log(`✓ Clean export dump created successfully: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
}

async function main() {
  await runLocalImport()
  generateCleanExportDump()
  console.log("\n=== ALL TASKS COMPLETED SUCCESSFULLY ===")
  process.exit(0)
}

main().catch(err => {
  console.error("FATAL ERROR:", err)
  process.exit(1)
})
