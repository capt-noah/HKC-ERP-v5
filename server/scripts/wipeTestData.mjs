import mysql from "mysql2/promise"

const essentialTables = [
  "users",
  "warehouses",
  "company_settings",
  "chart_of_accounts",
  "gl_account_mappings",
  "tax_rules",
  "leave_types",
]

const transactionalTables = [
  "export_warehouse_movements",
  "export_products",
  "pharma_product_batches",
  "pharma_products",
  "stock_movements",
  "store_transfer_items",
  "store_transfers",
  "sales_issue_items",
  "sales_issues",
  "sales_orders",
  "purchase_orders",
  "processing_services",
  "shipment_documents",
  "hkc_doc_records",
  "invoices",
  "payments",
  "expenses",
  "recurring_expense_schedules",
  "journal_entry_lines",
  "journal_entries",
  "payroll_records",
  "payroll_periods",
  "attendance_records",
  "leave_requests",
  "user_activity_logs",
  "user_sessions",
]

async function runWipe() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading",
  })

  console.log("=== CHECKING ESSENTIAL TABLES BEFORE WIPE ===")
  for (const table of essentialTables) {
    const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``)
    console.log(`[PRESERVE] ${table}: ${rows[0].count} rows`)
  }

  console.log("\n=== WIPING TRANSACTIONAL TABLES ===")
  await conn.query("SET FOREIGN_KEY_CHECKS = 0")
  for (const table of transactionalTables) {
    try {
      await conn.query(`TRUNCATE TABLE \`${table}\``)
      console.log(`[WIPED] ${table}`)
    } catch (err) {
      console.warn(`[SKIP/ERROR] ${table}:`, err.message)
    }
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1")

  console.log("\n=== VERIFYING ESSENTIAL TABLES AFTER WIPE ===")
  let allIntact = true
  for (const table of essentialTables) {
    const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``)
    console.log(`[VERIFIED] ${table}: ${rows[0].count} rows`)
    if (rows[0].count === 0 && table !== "leave_types") {
      allIntact = false
    }
  }

  if (allIntact) {
    console.log("\n SUCCESS: All essential tables preserved, test transactional data wiped clean!")
  } else {
    console.error("\n WARNING: An essential table appears empty!")
  }

  await conn.end()
}

runWipe().catch((err) => {
  console.error("Wipe failed:", err)
  process.exit(1)
})
