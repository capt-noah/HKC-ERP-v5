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
const salesIssueItems = parseTableRows("sales_issue_items")
const journalEntries = parseTableRows("journal_entries")
const journalLines = parseTableRows("journal_entry_lines")

console.log("=== SIMULATING ACCURATE INVENTORY & COA EQUALITY ===")

// 1. Calculate Active On-Hand Inventory Valuation
let activeInventoryCost = 0
let activeInventorySale = 0

pharmaProducts.forEach(p => {
  const pBatches = batches.filter(b => b.product_id === p.id)
  const cost = Number(p.unit_cost || 0)
  const sale = Number(p.selling_price || 0)
  
  if (pBatches.length > 0) {
    pBatches.filter(b => b.qa_status === "Released").forEach(b => {
      const bCost = Number(b.unit_cost || cost)
      const bSale = Number(b.selling_price || sale || bCost * 1.25)
      activeInventoryCost += Number(b.quantity || 0) * bCost
      activeInventorySale += Number(b.quantity || 0) * bSale
    })
  } else {
    activeInventoryCost += Number(p.quantity || 0) * cost
    activeInventorySale += Number(p.quantity || 0) * (sale || cost * 1.25)
  }
})

console.log(`Active On-Hand Inventory Cost Valuation: ETB ${activeInventoryCost.toFixed(2)}`)
console.log(`Active On-Hand Inventory Sale Valuation: ETB ${activeInventorySale.toFixed(2)}`)

// 2. Audit all Inbound Receipts vs Cumulative Intake
let totalInboundCost = 0
stockMovements.filter(sm => sm.movement_type === "RECEIPT").forEach(sm => {
  const qty = Number(sm.quantity || 0)
  const cost = Number(sm.unit_cost || 0)
  totalInboundCost += qty * cost
})

// Sales Outbound Issues Cost
let totalOutboundCogsCost = 0
stockMovements.filter(sm => sm.movement_type === "ISSUE").forEach(sm => {
  const qty = Number(sm.quantity || 0)
  const cost = Number(sm.unit_cost || 0)
  totalOutboundCogsCost += qty * cost
})

// Quarantine Loss Cost
let totalQuarantineCost = 0
stockMovements.filter(sm => sm.movement_type === "QUARANTINE").forEach(sm => {
  const qty = Number(sm.quantity || 0)
  const cost = Number(sm.unit_cost || 0)
  totalQuarantineCost += qty * cost
})

console.log(`\nFrom Stock Movements:`)
console.log(`  Total Cumulative Receipts: ETB ${totalInboundCost.toFixed(2)}`)
console.log(`  Total Issues (COGS): ETB ${totalOutboundCogsCost.toFixed(2)}`)
console.log(`  Total Quarantine: ETB ${totalQuarantineCost.toFixed(2)}`)
const netCalculatedStockAsset = totalInboundCost - totalOutboundCogsCost - totalQuarantineCost
console.log(`  Net Calculated Stock Asset (Receipts - Issues - Quarantine): ETB ${netCalculatedStockAsset.toFixed(2)}`)
console.log(`  Difference from Active On-Hand Inventory: ETB ${(activeInventoryCost - netCalculatedStockAsset).toFixed(2)}`)
