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
const coa = parseTableRows("chart_of_accounts")

console.log("==========================================================")
console.log("            DEEP AUDIT OF hkc_trading (3).sql             ")
console.log("==========================================================")

// 1. All Products Inventory Valuation (Cost & Selling)
let totalPharmaCostValuation = 0
let totalPharmaSaleValuation = 0

console.log("\n--- PHARMA PRODUCTS (35) ---")
pharmaProducts.forEach((p, idx) => {
  const pBatches = batches.filter(b => b.product_id === p.id)
  const batchSum = pBatches.reduce((s, b) => s + Number(b.quantity || 0), 0)
  const costVal = pBatches.length > 0
    ? pBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.unit_cost || p.unit_cost || 0)), 0)
    : Number(p.quantity || 0) * Number(p.unit_cost || 0)
  const saleVal = pBatches.length > 0
    ? pBatches.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.selling_price || p.selling_price || 0)), 0)
    : Number(p.quantity || 0) * Number(p.selling_price || 0)

  totalPharmaCostValuation += costVal
  totalPharmaSaleValuation += saleVal

  console.log(`${idx + 1}. [${p.id}] ${p.name}`)
  console.log(`   Prod Qty: ${p.quantity}, Sum Batches: ${batchSum}, Batches Count: ${pBatches.length}`)
  console.log(`   Cost Val: ETB ${costVal.toLocaleString()}, Sale Val: ETB ${saleVal.toLocaleString()}`)
  if (pBatches.length > 0) {
    pBatches.forEach(b => {
      console.log(`     - Batch [${b.id}] ${b.batch_no}: Qty ${b.quantity}, UnitCost ${b.unit_cost}, SalePrice ${b.selling_price}, Status ${b.qa_status}`)
    })
  }
})

// 2. Export Products Inventory Valuation
let totalExportCostValuation = 0
let totalExportSaleValuation = 0
console.log("\n--- EXPORT PRODUCTS (1) ---")
exportProducts.forEach((ep) => {
  const costVal = Number(ep.total_stock_value || (Number(ep.quantity || 0) * Number(ep.unit_cost || 0)))
  const saleVal = Number(ep.quantity || 0) * Number(ep.selling_price || 0)
  totalExportCostValuation += costVal
  totalExportSaleValuation += saleVal
  console.log(`1. [${ep.id}] ${ep.name}, Qty: ${ep.quantity}, Cost: ${ep.unit_cost}, Total Cost Val: ${costVal}`)
})

const grandTotalInventoryCostValuation = totalPharmaCostValuation + totalExportCostValuation
const grandTotalInventorySaleValuation = totalPharmaSaleValuation + totalExportSaleValuation

console.log("\n==========================================================")
console.log(`TOTAL INVENTORY COST VALUATION: ETB ${grandTotalInventoryCostValuation.toFixed(2)}`)
console.log(`TOTAL INVENTORY SALE VALUATION: ETB ${grandTotalInventorySaleValuation.toFixed(2)}`)
console.log("==========================================================")

// 3. COA Balances from Journal Entry Lines
const coaLines = journalLines.map(jl => {
  let p = {}
  try {
    p = typeof jl.payload === "string" ? JSON.parse(jl.payload) : (jl.payload || {})
  } catch (e) {}
  return {
    id: jl.id,
    account_id: jl.account_id || p.account_id,
    debit_amount: Number(jl.debit_amount ?? p.debit_amount ?? 0),
    credit_amount: Number(jl.credit_amount ?? p.credit_amount ?? 0),
    journal_entry_id: jl.journal_entry_id || p.journal_entry_id,
  }
})

const coaMap = new Map()
coa.forEach(a => {
  coaMap.set(a.id, { code: a.code, name: a.name, type: a.account_type, debit: 0, credit: 0, net: 0 })
})

coaLines.forEach(l => {
  const acc = coaMap.get(l.account_id) || Array.from(coaMap.values()).find(a => a.code === l.account_id)
  if (acc) {
    acc.debit += l.debit_amount
    acc.credit += l.credit_amount
  }
})

for (const [id, a] of coaMap.entries()) {
  if (a.type === "Asset" || a.type === "Expense") {
    a.net = a.debit - a.credit
  } else {
    a.net = a.credit - a.debit
  }
}

console.log("\n--- RELEVANT COA STOCK ACCOUNTS IN DUMP ---")
const stockCodes = ["1400-01", "1410-01", "1410-02", "1410-03", "1410-04", "1410-05"]
let totalCoaStockNet = 0
for (const [id, a] of coaMap.entries()) {
  if (stockCodes.includes(a.code) || a.code.startsWith("1400") || a.code.startsWith("1410")) {
    totalCoaStockNet += a.net
    console.log(`  Account [${a.code}] ${a.name}: Debit = ${a.debit.toFixed(2)}, Credit = ${a.credit.toFixed(2)}, Net Balance = ${a.net.toFixed(2)}`)
  }
}
console.log(`TOTAL STOCK COA (1400 / 1410): ETB ${totalCoaStockNet.toFixed(2)}`)
console.log(`VARIANCE (Inventory Cost Valuation - COA Stock Net): ETB ${(grandTotalInventoryCostValuation - totalCoaStockNet).toFixed(2)}`)

// 4. Trace Journal Entries for Products & Movements
console.log("\n--- AUDITING JOURNAL ENTRIES COVERAGE ---")
const jeList = journalEntries.map(je => {
  let p = {}
  try {
    p = typeof je.payload === "string" ? JSON.parse(je.payload) : (je.payload || {})
  } catch (e) {}
  return { id: je.id, ...p }
})

console.log(`Total Journal Entries in Dump: ${jeList.length}`)
const invJeList = jeList.filter(je => je.source_type === "Inventory" || /stock|batch|intake|quarantine|inventory/i.test(je.description || ""))
console.log(`Inventory Related Journal Entries: ${invJeList.length}`)

// Check each stock movement in stock_movements
console.log("\n--- CHECKING WHICH STOCK MOVEMENTS LACK JOURNAL ENTRIES ---")
let missingJeCount = 0
stockMovements.forEach(sm => {
  // Check if a JE matches sm.id or sm.batch_no or sm.product_id
  const match = jeList.find(je => 
    je.source_id === sm.id ||
    je.source_id === `STK-INTAKE-${sm.id}` ||
    je.source_id === `STK-BATCH-${sm.id}` ||
    (je.description && sm.batch_no && je.description.includes(sm.batch_no)) ||
    (je.description && sm.id && je.description.includes(sm.id))
  )
  if (!match) {
    missingJeCount++
    const prod = pharmaProducts.find(p => p.id === sm.product_id)
    console.log(`  MISSING JE for movement [${sm.id}]: Prod ${prod ? prod.name : sm.product_id}, Type: ${sm.movement_type}, Qty: ${sm.quantity}, Batch: ${sm.batch_no}, UnitCost: ${sm.unit_cost}`)
  }
})
console.log(`Total Movements Missing JE: ${missingJeCount} / ${stockMovements.length}`)
