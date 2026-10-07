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

const salesOrders = parseTableRows("sales_orders")
const salesIssues = parseTableRows("sales_issues")
const salesIssueItems = parseTableRows("sales_issue_items")
const journalEntries = parseTableRows("journal_entries")
const journalLines = parseTableRows("journal_entry_lines")

console.log("=== SALES ISSUES IN DUMP ===")
console.log(`Total Sales Issues: ${salesIssues.length}`)
salesIssues.forEach(si => {
  const items = salesIssueItems.filter(sii => (sii.sales_issue_id || sii.salesIssueId) === si.id)
  console.log(`[${si.id}] Status: ${si.status}, Customer: ${si.customer_name}, Amount: ${si.total_amount}, Items: ${items.length}`)
  items.forEach(it => {
    console.log(`   - Product: ${it.product_name}, Qty: ${it.quantity}, Batch: ${it.batch_no}, UnitCost: ${it.unit_cost}, UnitPrice: ${it.unit_price}`)
  })
})
