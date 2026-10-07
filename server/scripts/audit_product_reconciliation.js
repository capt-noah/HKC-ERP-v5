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
const exportProducts = parseTableRows("export_products")
const exportMovements = parseTableRows("export_warehouse_movements")
const stockMovements = parseTableRows("stock_movements")
const quarantine = parseTableRows("quarantine_records")
const salesOrders = parseTableRows("sales_orders")
const salesIssues = parseTableRows("sales_issues")
const journalEntries = parseTableRows("journal_entries")
const journalLines = parseTableRows("journal_entry_lines")

// Map JEs
const jeMap = new Map()
journalEntries.forEach(je => {
  let p = {}
  try {
    p = typeof je.payload === "string" ? JSON.parse(je.payload) : (je.payload || {})
  } catch (e) {}
  jeMap.set(je.id, { id: je.id, ...p, lines: [] })
})

// Attach lines
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

console.log("=== ALL JOURNAL ENTRIES WITH 1400-01 LINES ===")
const stock1400Lines = []
let total1400Debit = 0
let total1400Credit = 0

for (const [id, je] of jeMap.entries()) {
  const matchingLines = je.lines.filter(l => l.account_id === "1400-01")
  if (matchingLines.length > 0) {
    matchingLines.forEach(l => {
      total1400Debit += l.debit_amount
      total1400Credit += l.credit_amount
      stock1400Lines.push({ jeId: je.id, desc: je.description, date: je.entry_date, src: je.source_type, debit: l.debit_amount, credit: l.credit_amount })
    })
  }
}

console.log(`Total 1400-01 Debits (Intake): ETB ${total1400Debit.toFixed(2)}`)
console.log(`Total 1400-01 Credits (COGS / Loss): ETB ${total1400Credit.toFixed(2)}`)
console.log(`Net 1400-01 Balance: ETB ${(total1400Debit - total1400Credit).toFixed(2)}`)

// Look at credits
console.log("\n--- Credits to 1400-01 (Deductions from Stock) ---")
stock1400Lines.filter(l => l.credit > 0).forEach(l => {
  console.log(`  [${l.jeId}] ${l.date} (${l.src}): Credit ETB ${l.credit.toFixed(2)} - ${l.desc}`)
})

// Check product by product reconciliation
console.log("\n--- PRODUCT INTAKE vs JOURNAL ENTRIES AUDIT ---")
pharmaProducts.forEach((p, idx) => {
  const pBatches = batches.filter(b => b.product_id === p.id)
  const pMoves = stockMovements.filter(m => m.product_id === p.id)
  
  // Find all JEs mentioning product ID, name, or batch
  const matchingJes = Array.from(jeMap.values()).filter(je => {
    const desc = (je.description || "").toLowerCase()
    const pName = (p.name || "").toLowerCase()
    const matchesName = pName && desc.includes(pName)
    const matchesId = desc.includes(p.id) || (je.source_id && je.source_id.includes(p.id))
    const matchesBatch = pBatches.some(b => b.batch_no && desc.includes(b.batch_no.toLowerCase()))
    return matchesName || matchesId || matchesBatch
  })

  const jeIntakeDebits = matchingJes.reduce((sum, je) => {
    const l1400 = je.lines.filter(l => l.account_id === "1400-01" && l.debit_amount > 0)
    return sum + l1400.reduce((s, l) => s + l.debit_amount, 0)
  }, 0)

  const currentStockVal = pBatches.length > 0
    ? pBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.unit_cost || p.unit_cost || 0)), 0)
    : Number(p.quantity || 0) * Number(p.unit_cost || 0)

  const diff = currentStockVal - jeIntakeDebits
  if (Math.abs(diff) > 0.01) {
    console.log(`\nProduct ${idx + 1}: [${p.id}] ${p.name}`)
    console.log(`  Current Stock Value: ETB ${currentStockVal.toFixed(2)}`)
    console.log(`  JE 1400-01 Intake Debits: ETB ${jeIntakeDebits.toFixed(2)}`)
    console.log(`  DISCREPANCY: ETB ${diff.toFixed(2)}`)
    console.log(`  Batches (${pBatches.length}):`)
    pBatches.forEach(b => console.log(`    - [${b.id}] Batch ${b.batch_no}: Qty ${b.quantity} @ ${b.unit_cost} = ETB ${(Number(b.quantity) * Number(b.unit_cost)).toFixed(2)}`))
    console.log(`  Stock Movements (${pMoves.length}):`)
    pMoves.forEach(m => console.log(`    - [${m.id}] ${m.movement_type}: Qty ${m.quantity} Batch ${m.batch_no} UnitCost ${m.unit_cost}`))
    console.log(`  Matching JEs (${matchingJes.length}):`)
    matchingJes.forEach(je => console.log(`    - [${je.id}] ${je.entry_date}: ${je.description}`))
  }
})
