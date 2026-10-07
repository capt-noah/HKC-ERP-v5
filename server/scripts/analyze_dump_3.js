import fs from "fs"
import path from "path"

const dumpPath = path.resolve(process.env.HOME, "Desktop", "hkc_trading (3).sql")
const content = fs.readFileSync(dumpPath, "utf8")

function extractTableInserts(tableName) {
  const regex = new RegExp(`INSERT INTO \`${tableName}\` [^;]+;`, "g")
  const matches = content.match(regex) || []
  return matches.join("\n")
}

const tables = [
  "pharma_products",
  "pharma_product_batches",
  "export_products",
  "export_warehouse_movements",
  "stock_movements",
  "quarantine_records",
  "sales_orders",
  "sales_issues",
  "sales_issue_items",
  "journal_entries",
  "journal_entry_lines"
]

console.log("=== DUMP SUMMARY FOR hkc_trading (3).sql ===")
for (const t of tables) {
  const inserts = extractTableInserts(t)
  const lineCount = (inserts.match(/\),/g) || []).length + (inserts.match(/\);/g) || []).length
  console.log(`${t}: ${lineCount} rows`)
}
