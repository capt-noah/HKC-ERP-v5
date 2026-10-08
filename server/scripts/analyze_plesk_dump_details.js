import mysql from "mysql2/promise"
import fs from "node:fs"
import { config } from "../config.js"

// Simple SQL INSERT parser for mysqldump / phpmyadmin output
function parseInsertValues(sql, tableName) {
  const tableHeader = `INSERT INTO \`${tableName}\``
  let pos = 0
  const rows = []
  
  while (true) {
    const idx = sql.indexOf(tableHeader, pos)
    if (idx === -1) break
    const endIdx = sql.indexOf(";\n", idx)
    const stmt = sql.slice(idx, endIdx === -1 ? undefined : endIdx)
    
    // Find column list if present
    const colMatch = stmt.match(/INSERT INTO \`[^\`]+\` \(([^\)]+)\) VALUES/)
    let cols = null
    let valuesPart = ""
    if (colMatch) {
      cols = colMatch[1].split(",").map(c => c.trim().replace(/\`/g, ""))
      valuesPart = stmt.slice(stmt.indexOf("VALUES") + 6)
    } else {
      const vIdx = stmt.indexOf("VALUES")
      valuesPart = stmt.slice(vIdx + 6)
    }

    // Parse tuples
    // phpmyadmin formats tuples as (\n  'val', ...\n), (\n ... \n)
    // Or (val1, val2, ...)
    let inString = false
    let escape = false
    let currentTuple = []
    let currentField = ""
    let inTuple = false

    for (let i = 0; i < valuesPart.length; i++) {
      const ch = valuesPart[i]
      if (escape) {
        currentField += ch
        escape = false
        continue
      }
      if (ch === "\\") {
        escape = true
        continue
      }
      if (ch === "'") {
        inString = !inString
        continue
      }
      if (!inString) {
        if (ch === "(") {
          inTuple = true
          currentTuple = []
          currentField = ""
          continue
        } else if (ch === ")") {
          inTuple = false
          currentTuple.push(currentField.trim() === "NULL" ? null : currentField.trim())
          currentField = ""
          if (cols) {
            const obj = {}
            cols.forEach((col, idx) => {
              obj[col] = currentTuple[idx]
            })
            rows.push(obj)
          } else {
            rows.push(currentTuple)
          }
          continue
        } else if (ch === "," && inTuple) {
          currentTuple.push(currentField.trim() === "NULL" ? null : currentField.trim())
          currentField = ""
          continue
        }
      }
      if (inTuple) {
        currentField += ch
      }
    }

    if (endIdx === -1) break
    pos = endIdx + 2
  }
  return rows
}

async function main() {
  const sql = fs.readFileSync("/Users/Noah/Desktop/hkc_trading.sql", "utf8")
  
  const conn = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })

  console.log("Analyzing diffs between Plesk dump and local DB...\n")

  // 1. Pharma Products
  const pleskPharmaProds = parseInsertValues(sql, "pharma_products")
  const [localPharmaProds] = await conn.query("SELECT id, name FROM pharma_products;")
  const localProdIds = new Set(localPharmaProds.map(p => p.id))
  const newProds = pleskPharmaProds.filter(p => !localProdIds.has(p.id))
  console.log("Pharma Products in Plesk not in Local:", newProds.map(p => ({ id: p.id, name: p.name })))

  // 2. Pharma Product Batches
  const pleskBatches = parseInsertValues(sql, "pharma_product_batches")
  const [localBatches] = await conn.query("SELECT id, batch_no FROM pharma_product_batches;")
  const localBatchIds = new Set(localBatches.map(b => b.id))
  const newBatches = pleskBatches.filter(b => !localBatchIds.has(b.id))
  console.log("\nPharma Batches in Plesk not in Local:", newBatches.map(b => ({ id: b.id, batch_no: b.batch_no, qty: b.quantity })))

  // 3. Stock Movements
  const pleskMovements = parseInsertValues(sql, "stock_movements")
  const [localMovements] = await conn.query("SELECT id, movement_type, batch_no, quantity FROM stock_movements;")
  const localMovIds = new Set(localMovements.map(m => m.id))
  const newMovements = pleskMovements.filter(m => !localMovIds.has(m.id))
  console.log("\nStock Movements in Plesk not in Local:", newMovements.map(m => ({ id: m.id, type: m.movement_type, batch: m.batch_no, qty: m.quantity })))

  // 4. Suppliers
  const pleskSuppliers = parseInsertValues(sql, "suppliers")
  const [localSuppliers] = await conn.query("SELECT id, name FROM suppliers;")
  const localSupIds = new Set(localSuppliers.map(s => s.id))
  const newSuppliers = pleskSuppliers.filter(s => !localSupIds.has(s.id))
  console.log("\nSuppliers in Plesk not in Local:", newSuppliers)

  // 5. Journal Entries
  const pleskEntries = parseInsertValues(sql, "journal_entries")
  const [localEntries] = await conn.query("SELECT id, entry_number, entry_date, description FROM journal_entries;")
  const localEntryIds = new Set(localEntries.map(e => e.id))
  const pleskEntryIds = new Set(pleskEntries.map(e => e.id))
  
  const entriesInPleskNotLocal = pleskEntries.filter(e => !localEntryIds.has(e.id))
  const entriesInLocalNotPlesk = localEntries.filter(e => !pleskEntryIds.has(e.id))

  console.log(`\nJournal Entries in Plesk not in Local (${entriesInPleskNotLocal.length}):`, entriesInPleskNotLocal.map(e => ({ id: e.id, desc: e.description })))
  console.log(`Journal Entries in Local not in Plesk (${entriesInLocalNotPlesk.length}):`, entriesInLocalNotPlesk.slice(0, 5).map(e => ({ id: e.id, desc: e.description })), `... total ${entriesInLocalNotPlesk.length}`)

  // 6. Journal Entry Lines count & types
  const pleskLines = parseInsertValues(sql, "journal_entry_lines")
  const [localLines] = await conn.query("SELECT id, journal_entry_id, account_code, debit_amount, credit_amount FROM journal_entry_lines;")
  const localLineIds = new Set(localLines.map(l => l.id))
  const linesInPleskNotLocal = pleskLines.filter(l => !localLineIds.has(l.id))
  console.log(`\nJournal Entry Lines in Plesk not in Local: ${linesInPleskNotLocal.length}`)
  if (linesInPleskNotLocal.length > 0) {
    console.log("Sample lines in Plesk not in Local:", linesInPleskNotLocal.slice(0, 6).map(l => ({ id: l.id, je: l.journal_entry_id, acc: l.account_code, dr: l.debit_amount, cr: l.credit_amount })))
  }

  // 7. Shipment documents
  const pleskDocs = parseInsertValues(sql, "shipment_documents")
  const [localDocs] = await conn.query("SELECT id, file_name, file_url FROM shipment_documents;")
  console.log(`\nShipment documents in Plesk: ${pleskDocs.length}, in Local: ${localDocs.length}`)

  // 8. Export Warehouse Movements & Products
  const pleskExpMov = parseInsertValues(sql, "export_warehouse_movements")
  console.log(`\nExport movements in Plesk: ${pleskExpMov.length}, Unit price of first: ${pleskExpMov[0]?.unit_price}`)

  const pleskExpProd = parseInsertValues(sql, "export_products")
  console.log(`Export products in Plesk: ${pleskExpProd.length}, Unit cost: ${pleskExpProd[0]?.unit_cost}, Total value: ${pleskExpProd[0]?.total_stock_value}`)

  await conn.end()
}

main().catch(console.error)
