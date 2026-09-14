import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { pool } from "/Users/Noah/Documents/React/HKC-ERP-v5/server/db/client.js"

const TABLES_TO_WIPE = [
  "export_warehouse_movements",
  "export_products",
  "pharma_product_batches",
  "pharma_products",
  "stock_movements",
  "store_transfer_items",
  "store_transfers",
  "sales_issue_items",
  "sales_issues",
  "invoices",
  "payments",
  "sales_orders",
  "purchase_orders",
  "journal_entry_lines",
  "journal_entries",
  "expenses",
  "recurring_expense_schedules",
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
  "customers",
  "suppliers",
]

const TABLES_TO_PRESERVE = [
  "users",
  "user_sessions",
  "tax_rules",
  "chart_of_accounts",
  "gl_account_mappings",
  "company_settings",
  "warehouses",
  "leave_types",
]

// Helper to parse SQL INSERT tuples safely
function parseTuples(str) {
  const list = []
  let inTuple = false
  let inStr = false
  let escape = false
  let curr = ""
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (escape) {
      curr += c
      escape = false
      continue
    }
    if (c === "\\") {
      escape = true
      curr += c
      continue
    }
    if (c === "'" && !escape) {
      inStr = !inStr
      curr += c
      continue
    }
    if (!inStr) {
      if (c === "(") {
        inTuple = true
        curr = ""
        continue
      }
      if (c === ")") {
        inTuple = false
        list.push(curr)
        curr = ""
        continue
      }
    }
    if (inTuple) curr += c
  }
  return list
}

function parseTupleValues(tupleStr) {
  const vals = []
  let inStr = false
  let escape = false
  let curr = ""
  for (let i = 0; i < tupleStr.length; i++) {
    const c = tupleStr[i];
    if (escape) {
      curr += c
      escape = false
      continue
    }
    if (c === "\\") {
      escape = true
      continue
    }
    if (c === "'" && !escape) {
      inStr = !inStr
      continue
    }
    if (c === "," && !inStr) {
      vals.push(curr === "NULL" ? null : curr)
      curr = ""
      continue
    }
    curr += c
  }
  vals.push(curr === "NULL" ? null : curr)
  return vals
}

async function runMigration() {
  console.log("================================================================")
  console.log("=== HKC-ERP-v5: PRODUCTION INVENTORY MIGRATION ===")
  console.log("================================================================\n")

  const dumpPath = "/Users/Noah/Documents/React/HKC-ERP-v5/hkc_trading_inventory.sql"
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`SQL dump file not found at: ${dumpPath}`)
  }

  const sql = fs.readFileSync(dumpPath, "utf8")
  console.log(`✓ Read SQL dump file: ${dumpPath} (${Math.round(sql.length / 1024)} KB)`)

  // Parse INSERT INTO pharma_products
  const ppInsertMatch = sql.match(/INSERT INTO \`pharma_products\` VALUES (.*?\));/s)
  if (!ppInsertMatch) throw new Error("Could not find INSERT INTO pharma_products in SQL dump")
  const rawProducts = parseTuples(ppInsertMatch[1]).map(parseTupleValues)
  console.log(`✓ Extracted ${rawProducts.length} pharmaceutical products from SQL dump`)

  // Parse INSERT INTO pharma_product_batches
  const pbInsertMatch = sql.match(/INSERT INTO \`pharma_product_batches\` VALUES (.*?\));/s)
  if (!pbInsertMatch) throw new Error("Could not find INSERT INTO pharma_product_batches in SQL dump")
  const rawBatches = parseTuples(pbInsertMatch[1]).map(parseTupleValues)
  console.log(`✓ Extracted ${rawBatches.length} batch records from SQL dump`)

  // Map products
  const productMap = new Map()
  const validProducts = []
  for (const row of rawProducts) {
    const [
      id, sku, name, generic_name, category, sub_category, warehouse_id,
      dosage_form, strength, shelf_number, storage_condition, unit,
      quantity_per_pack, number_of_cartons, quantity, quantity_sold,
      total_quantity, unit_cost, selling_price, total_stock_value,
      reorder_level, min_stock_level, shelf_life_months, status,
      description, supplier_id, supplier_name, created_at, updated_at
    ] = row

    const parsedUnitCost = Number(unit_cost || 0)
    const parsedQty = Number(quantity || 0)
    const parsedSelling = Number(selling_price || parsedUnitCost || 0)
    const calculatedStockVal = Math.round(parsedQty * parsedUnitCost * 100) / 100
    const finalStockVal = parsedUnitCost > 0 ? calculatedStockVal : Number(total_stock_value || 0)

    const prod = {
      id,
      sku,
      name,
      generic_name: generic_name || name,
      category: category || "Veterinary Medicine",
      sub_category: sub_category || null,
      warehouse_id: warehouse_id || "WH2",
      dosage_form: dosage_form || null,
      strength: strength || null,
      shelf_number: shelf_number || null,
      storage_condition: storage_condition || "Room Temperature (15-25°C)",
      unit: unit || "Box",
      quantity_per_pack: Number(quantity_per_pack || 1),
      number_of_cartons: Number(number_of_cartons || 0),
      quantity: parsedQty,
      quantity_sold: Number(quantity_sold || 0),
      total_quantity: Number(total_quantity || parsedQty),
      unit_cost: parsedUnitCost,
      selling_price: parsedSelling,
      total_stock_value: finalStockVal,
      reorder_level: Number(reorder_level || 0),
      min_stock_level: Number(min_stock_level || 0),
      shelf_life_months: shelf_life_months ? Number(shelf_life_months) : null,
      status: status || "In Stock",
      description: description || name,
      supplier_id: supplier_id || null,
      supplier_name: supplier_name || null,
      created_at: created_at || new Date().toISOString().slice(0, 19).replace("T", " "),
      updated_at: updated_at || new Date().toISOString().slice(0, 19).replace("T", " "),
    }
    productMap.set(id, prod)
    validProducts.push(prod)
  }

  // Filter batches to only those belonging to valid products (filters out orphaned test batches like BT-3478)
  const validBatches = []
  for (const row of rawBatches) {
    const [
      id, product_id, warehouse_id, batch_no, mfg_date, expiry_date,
      quantity, unit_cost, qa_status, location, notes, created_at, updated_at
    ] = row

    if (!productMap.has(product_id)) {
      console.log(`  ℹ Skipping orphaned test batch: ${batch_no} (product ${product_id} not in dump products)`)
      continue
    }

    const prod = productMap.get(product_id)
    const bCost = Number(unit_cost || prod.unit_cost || 0)
    const bQty = Number(quantity || 0)

    validBatches.push({
      id,
      product_id,
      warehouse_id: warehouse_id || prod.warehouse_id || "WH2",
      batch_no: batch_no || "BATCH",
      mfg_date: mfg_date || null,
      expiry_date: expiry_date || "2029-01-01",
      quantity: bQty,
      unit_cost: bCost,
      qa_status: qa_status || "Released",
      location: location || null,
      notes: notes || `Initial batch for ${prod.name}`,
      created_at: created_at || new Date().toISOString().slice(0, 19).replace("T", " "),
      updated_at: updated_at || new Date().toISOString().slice(0, 19).replace("T", " "),
    })
  }

  console.log(`\n✓ Verified ${validProducts.length} valid products and ${validBatches.length} matching batches`)

  // Connect to MySQL
  const conn = await pool.getConnection()
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    console.log("\n--- PHASE 1: WIPING TRANSACTIONAL & TEST DATA ---")
    for (const table of TABLES_TO_WIPE) {
      process.stdout.write(`  Wiping \`${table}\`... `)
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``)
        console.log("✓ Done")
      } catch (err) {
        console.log(`(note: ${err.message})`)
      }
    }

    console.log("\n--- PHASE 2: VERIFYING PRESERVED CONFIGURATION TABLES ---")
    for (const table of TABLES_TO_PRESERVE) {
      try {
        const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``)
        console.log(`  ✓ Table '${table}': ${rows[0].count} records intact`)
      } catch (err) {
        console.log(`  ⚠ Table '${table}': ${err.message}`)
      }
    }

    console.log("\n--- PHASE 3: IMPORTING REAL PHARMA PRODUCTS ---")
    for (const p of validProducts) {
      await conn.query(
        `INSERT INTO pharma_products (
          id, sku, name, generic_name, category, sub_category, warehouse_id,
          dosage_form, strength, shelf_number, storage_condition, unit,
          quantity_per_pack, number_of_cartons, quantity, quantity_sold,
          total_quantity, unit_cost, selling_price, total_stock_value,
          reorder_level, min_stock_level, shelf_life_months, status,
          description, supplier_id, supplier_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id, p.sku, p.name, p.generic_name, p.category, p.sub_category, p.warehouse_id,
          p.dosage_form, p.strength, p.shelf_number, p.storage_condition, p.unit,
          p.quantity_per_pack, p.number_of_cartons, p.quantity, p.quantity_sold,
          p.total_quantity, p.unit_cost, p.selling_price, p.total_stock_value,
          p.reorder_level, p.min_stock_level, p.shelf_life_months, p.status,
          p.description, p.supplier_id, p.supplier_name, p.created_at, p.updated_at
        ]
      )
      console.log(`  ✓ [${p.warehouse_id}] ${p.name.padEnd(24)} | SKU: ${p.sku.padEnd(16)} | Qty: ${String(p.quantity).padStart(8)} ${p.unit.padEnd(6)} | Cost: ETB ${p.unit_cost}`)
    }

    console.log("\n--- PHASE 4: IMPORTING BATCHES & GENERATING STOCK MOVEMENTS ---")
    for (const b of validBatches) {
      // 1. Insert into pharma_product_batches
      await conn.query(
        `INSERT INTO pharma_product_batches (
          id, product_id, warehouse_id, batch_no, mfg_date, expiry_date,
          quantity, unit_cost, qa_status, location, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.id, b.product_id, b.warehouse_id, b.batch_no, b.mfg_date, b.expiry_date,
          b.quantity, b.unit_cost, b.qa_status, b.location, b.notes, b.created_at, b.updated_at
        ]
      )

      // 2. Insert into stock_movements with both unit_cost AND unit_price
      const prod = productMap.get(b.product_id)
      const movId = `SM-INIT-${b.id}`
      const movDate = b.mfg_date || "2026-01-01"

      await conn.query(
        `INSERT INTO stock_movements (
          id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price,
          balance_after, batch_no, expiry_date, reference_type, reference_id,
          notes, performed_by, movement_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          movId,
          b.product_id,
          b.warehouse_id,
          "RECEIPT",
          b.quantity,
          b.unit_cost,
          b.unit_cost, // Explicit unit_price matches unit_cost for initial receipt
          b.quantity,
          b.batch_no,
          b.expiry_date,
          "STOCK_RECEIPT",
          "INITIAL_DEPOSIT",
          `Initial Stock Deposit: ${prod?.name || ""} [Batch: ${b.batch_no}]`,
          "System Migration",
          movDate,
        ]
      )

      console.log(`  ✓ Batch ${b.batch_no.padEnd(12)} | Prod: ${b.product_id} | Qty: ${String(b.quantity).padStart(8)} | Movement: ${movId}`)
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")
    console.log("\n================================================================")
    console.log("=== MIGRATION COMPLETED SUCCESSFULLY! ===")
    console.log("================================================================")
  } catch (err) {
    console.error("❌ Migration error:", err)
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

runMigration()
