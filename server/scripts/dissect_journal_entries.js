import fs from "fs"
import path from "path"

const dumpPath = path.resolve(process.env.HOME, "Desktop", "hkc_trading (3).sql")
const content = fs.readFileSync(dumpPath, "utf8")

function parseTableRows(tableName) {
  const insertRegex = new RegExp(`INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES\\s*([\\s\\S]*?);`, "g")
  const rows = []
  let match
  while ((match = insertRegex.exec(content)) !== null) {
    const cols = match[1].split(",").map(c => c.trim().replace(/`/g, ""))
    const valuesBlock = match[2]
    
    const tupleRegex = /\(([\s\S]*?)\)(?:,|$)/g
    let tupleMatch
    while ((tupleMatch = tupleRegex.exec(valuesBlock)) !== null) {
      const rawValues = tupleMatch[1]
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
const stockMovements = parseTableRows("stock_movements")
const journalEntries = parseTableRows("journal_entries")
const journalLines = parseTableRows("journal_entry_lines")
const salesIssues = parseTableRows("sales_issues")

// 1. Unpack JEs and Lines
const jeMap = new Map()
journalEntries.forEach(je => {
  let p = {}
  try {
    p = typeof je.payload === "string" ? JSON.parse(je.payload) : (je.payload || {})
  } catch (e) {}
  jeMap.set(je.id, { id: je.id, ...p, lines: [] })
})

journalLines.forEach(jl => {
  let p = {}
  try {
    p = typeof jl.payload === "string" ? JSON.parse(jl.payload) : (jl.payload || {})
  } catch (e) {}
  const jeId = jl.journal_entry_id || p.journal_entry_id
  const je = jeMap.get(jeId)
  if (je) {
    je.lines.push({
      id: jl.id,
      account_id: jl.account_id || p.account_id,
      debit_amount: Number(jl.debit_amount ?? p.debit_amount ?? 0),
      credit_amount: Number(jl.credit_amount ?? p.credit_amount ?? 0),
    })
  }
})

console.log("=== DISSECTING ALL JOURNAL ENTRIES IN DUMP ===")
console.log(`Total Journal Entries: ${jeMap.size}`)
console.log(`Total Journal Lines: ${journalLines.length}`)

// A. Identify COGS duplicate lines
console.log("\n--- A. COGS ENTRIES & LINES AUDIT ---")
const cogsJes = Array.from(jeMap.values()).filter(je => je.id.startsWith("JE-COGS-"))
console.log(`Total COGS Journal Entries: ${cogsJes.length}`)
cogsJes.forEach(je => {
  console.log(`  [${je.id}] Lines count: ${je.lines.length}`)
  je.lines.forEach(l => {
    console.log(`     Line [${l.id}]: Account ${l.account_id}, Debit ${l.debit_amount}, Credit ${l.credit_amount}`)
  })
})

// B. Identify all Stock Intake JEs
console.log("\n--- B. STOCK INTAKE JOURNAL ENTRIES AUDIT ---")
const intakeJes = Array.from(jeMap.values()).filter(je => 
  je.source_type === "Inventory" || 
  /intake|valuation|stock/i.test(je.description || "") ||
  je.id.startsWith("JE-INTAKE-")
)
console.log(`Total Stock Intake Journal Entries: ${intakeJes.length}`)
intakeJes.forEach(je => {
  const d1400 = je.lines.filter(l => l.account_id === "1400-01" && l.debit_amount > 0).reduce((s, l) => s + l.debit_amount, 0)
  console.log(`  [${je.id}] Date: ${je.entry_date}, 1400-01 Debit: ${d1400.toFixed(2)} - ${je.description}`)
})

// C. Reconcile with Active Inventory
console.log("\n--- C. RECONCILING ACTIVE PRODUCTS AGAINST INTAKE JEs ---")
// For each product, compute actual active on-hand valuation (from batches)
let totalExpectedStockValue = 0
pharmaProducts.forEach(p => {
  const pBatches = batches.filter(b => b.product_id === p.id)
  const val = pBatches.length > 0
    ? pBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.unit_cost || p.unit_cost || 0)), 0)
    : Number(p.quantity || 0) * Number(p.unit_cost || 0)
  totalExpectedStockValue += val
})
console.log(`Total Active Pharma Inventory Valuation (Cost): ETB ${totalExpectedStockValue.toFixed(2)}`)
