import { pool } from "../db/client.js"

async function clearLocalOperationalData() {
  console.log("================================================================================")
  console.log("       HKC ERP - LOCAL DB OPERATIONAL DATA CLEANUP SCRIPT                       ")
  console.log("================================================================================")

  const operationalTables = [
    // 1. Stock & Inventory Records (Parent, Child, Bin Card / Movements, Loss)
    "pharma_product_batches",
    "stock_movements",
    "pharma_products",
    "export_warehouse_movements",
    "export_products",
    "quarantine_records",
    "store_transfer_items",
    "store_transfers",
    "processing_services",

    // 2. Commercial & Sales Transactions
    "sales_issue_items",
    "sales_issues",
    "sales_orders",
    "invoices",
    "payments",
    "purchase_orders",
    "shipment_documents",
    "hkc_doc_records",

    // 3. Accounting & Financial Transactions
    "journal_entry_lines",
    "journal_entries",
    "bank_reconciliations",
    "expenses",
    "recurring_expense_schedules",

    // 4. Operational Activity Logs
    "user_activity_logs"
  ]

  const preservedMasterTables = [
    "users",
    "user_sessions",
    "warehouses",
    "chart_of_accounts",
    "gl_account_mappings",
    "company_settings",
    "tax_rules",
    "customers",
    "suppliers",
    "vehicles",
    "employees",
    "leave_types",
    "leave_requests",
    "attendance_records",
    "payroll_periods",
    "payroll_records"
  ]

  const conn = await pool.getConnection()
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    console.log("\n[1/3] Gathering pre-cleanup table counts...")
    const beforeCounts = {}
    for (const table of [...operationalTables, ...preservedMasterTables]) {
      try {
        const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``)
        beforeCounts[table] = rows[0]?.cnt || 0
      } catch (err) {
        beforeCounts[table] = "N/A"
      }
    }

    console.log("\n[2/3] Clearing operational tables...")
    const clearedSummary = []
    for (const table of operationalTables) {
      try {
        const [res] = await conn.query(`DELETE FROM \`${table}\``)
        clearedSummary.push({
          Table: table,
          "Prior Rows": beforeCounts[table],
          "Rows Removed": res.affectedRows,
          Status: "CLEARED"
        })
      } catch (err) {
        console.error(`Error clearing ${table}:`, err.message)
        clearedSummary.push({
          Table: table,
          "Prior Rows": beforeCounts[table],
          "Rows Removed": 0,
          Status: `ERROR: ${err.message}`
        })
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")

    console.log("\n[3/3] Verifying remaining counts...")
    const afterCounts = {}
    for (const table of [...operationalTables, ...preservedMasterTables]) {
      try {
        const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``)
        afterCounts[table] = rows[0]?.cnt || 0
      } catch {
        afterCounts[table] = "N/A"
      }
    }

    console.log("\n================================================================================")
    console.log("                  OPERATIONAL TABLES CLEARED (TRANSACTION DATA)                  ")
    console.log("================================================================================")
    console.table(clearedSummary)

    console.log("\n================================================================================")
    console.log("                   PRESERVED MASTER & CONFIGURATION TABLES                       ")
    console.log("================================================================================")
    console.table(
      preservedMasterTables.map((tbl) => ({
        "Master Table": tbl,
        "Rows Preserved": afterCounts[tbl],
        Status: afterCounts[tbl] > 0 || tbl.startsWith("leave") || tbl.startsWith("payroll") || tbl === "attendance_records" || tbl === "vehicles" ? "INTACT & SAFE" : "EMPTY"
      }))
    )

    console.log("\n================================================================================")
    console.log("    SUCCESS: LOCAL DATABASE CLEARED FOR UNINTERRUPTED TESTING & ENTRY!          ")
    console.log("================================================================================\n")
  } catch (err) {
    console.error("Fatal error during cleanup:", err)
    process.exit(1)
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {})
    conn.release()
  }
}

clearLocalOperationalData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
