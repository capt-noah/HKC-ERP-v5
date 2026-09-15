import { pool } from "../db/client.js"

const TABLES_TO_WIPE = [
  "export_warehouse_movements",
  "pharma_product_batches",
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
  "export_products",
  "pharma_products",
  "quarantine_records",
  "customers",
  "suppliers",
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

async function wipeDatabase() {
  console.log("=== WIPING TRANSACTIONAL & TEST DATA ===")
  const conn = await pool.getConnection()
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    for (const table of TABLES_TO_WIPE) {
      process.stdout.write(`  Wiping ${table}... `)
      await conn.query(`TRUNCATE TABLE \`${table}\``)
      console.log("✓ Done")
    }

    console.log("\n--- Verifying Preserved Configuration ---")
    for (const table of TABLES_TO_PRESERVE) {
      const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``)
      console.log(`  ✓ Table '${table}': ${rows[0].count} records preserved`)
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")
    console.log("\n=== DATABASE CLEANED SUCCESSFULLY ===")
  } catch (err) {
    console.error("Error wiping database:", err)
  } finally {
    conn.release()
    await pool.end()
  }
}

wipeDatabase()
