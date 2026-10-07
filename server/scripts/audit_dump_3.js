import fs from "fs"
import path from "path"

const dumpPath = path.resolve(process.env.HOME, "Desktop", "hkc_trading (3).sql")
const content = fs.readFileSync(dumpPath, "utf8")

// Extract raw INSERT INTO statements for a given table
function parseTableRows(tableName) {
  const insertRegex = new RegExp(`INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES\\s*([\\s\\S]*?);`, "g")
  const rows = []
  let match
  while ((match = insertRegex.exec(content)) !== null) {
    const cols = match[1].split(",").map(c => c.trim().replace(/`/g, ""))
    const valuesBlock = match[2]
    
    // Parse tuples: (val1, val2, ...), (val1, val2, ...)
    const tupleRegex = /\(([\s\S]*?)\)(?:,|$)/g
    let tupleMatch
    while ((tupleMatch = tupleRegex.exec(valuesBlock)) !== null) {
      const rawValues = tupleMatch[1]
      // Split by comma, respecting single quotes
      const parsedValues = []
      let cur = ""
      let inQuote = false
      let escape = false
      for (let i = 0; i < rawValues.length; i++) {
        const char = rawValues[i]
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
        if (char === "," && !inQuote) {
          parsedValues.push(cur.trim())
          cur = ""
        } else {
          cur += char
        }
      }
      if (cur.trim()) parsedValues.push(cur.trim())

      const obj = {}
      cols.forEach((col, idx) => {
        let val = parsedValues[idx]
        if (val === undefined || val === "NULL" || val === "null") {
          obj[col] = null
        } else if (val.startsWith("'") && val.endsWith("'")) {
          // Unescape MySQL string
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
    }
  }
  return rows
}

const pharmaProducts = parseTableRows("pharma_products")
const batches = parseTableRows("pharma_product_batches")
const exportProducts = parseTableRows("export_products")
const exportMovements = parseTableRows("export_warehouse_movements")
const stockMovements = parseTableRows("stock_movements")
const quarantine = parseTableRows("quarantine_records")
const salesOrders = parseTableRows("sales_orders")
const salesIssues = parseTableRows("sales_issues")
const journalEntries = parseTableRows("journal_entries")
const journalLines = parseTableRows("journal_entry_lines")
const coa = parseTableRows("chart_of_accounts")

console.log("Parsed Tables:")
console.log(`- pharma_products: ${pharmaProducts.length}`)
console.log(`- batches: ${batches.length}`)
console.log(`- export_products: ${exportProducts.length}`)
console.log(`- export_movements: ${exportMovements.length}`)
console.log(`- stock_movements: ${stockMovements.length}`)
console.log(`- quarantine: ${quarantine.length}`)
console.log(`- sales_orders: ${salesOrders.length}`)
console.log(`- sales_issues: ${salesIssues.length}`)
console.log(`- journal_entries: ${journalEntries.length}`)
console.log(`- journal_entry_lines: ${journalLines.length}`)

// 1. Check Journal Entries payload
const jeParsed = journalEntries.map(je => {
  let p = {}
  try {
    p = typeof je.payload === "string" ? JSON.parse(je.payload) : (je.payload || {})
  } catch (e) {}
  return { id: je.id, ...p }
})

console.log("\nSample Journal Entries Descriptions:")
jeParsed.slice(0, 15).forEach(je => console.log(`  [${je.id}] (${je.source_type || "N/A"} / ${je.source_id || "N/A"}): ${je.description || "N/A"}`))

// 2. Check Ashinero / Ashiver in pharma products
console.log("\nProducts matching 'Ash' or '5':")
pharmaProducts.filter(p => /ash|5/i.test(p.name || "")).forEach(p => {
  console.log(`  Product [${p.id}]: ${p.name}, Qty: ${p.quantity}, UnitCost: ${p.unit_cost}, Wh: ${p.warehouse_id}`)
})

// 3. Batches for Ash products
const ashProdIds = pharmaProducts.filter(p => /ash/i.test(p.name || "")).map(p => p.id)
console.log("\nBatches for Ash products:")
batches.filter(b => ashProdIds.includes(b.product_id)).forEach(b => {
  console.log(`  Batch [${b.id}]: Prod ${b.product_id}, BatchNo: ${b.batch_no}, Qty: ${b.quantity}, UnitCost: ${b.unit_cost}, Status: ${b.qa_status}`)
})

// 4. Stock movements for Ash products
console.log("\nStock movements for Ash products:")
stockMovements.filter(sm => ashProdIds.includes(sm.product_id)).forEach(sm => {
  console.log(`  Move [${sm.id}]: Prod ${sm.product_id}, Type: ${sm.movement_type}, Qty: ${sm.quantity}, Batch: ${sm.batch_no}, BalAfter: ${sm.balance_after}`)
})
