import { pool } from "../server/db/client.js"
import fs from "fs"

const BACKUP_PATH = "/Users/Noah/Desktop/hkc_trading_full_snapshot_before_wipe.sql"

const ESSENTIAL_TABLES = new Set([
  "users",
  "user_sessions",
  "warehouses",
  "chart_of_accounts",
  "gl_account_mappings",
  "company_settings",
  "tax_rules",
  "user_activity_logs",
])

const TABLES_TO_CLEAR = [
  // 1. Finance & Accounting Transaction Trails
  "journal_entry_lines",
  "journal_entries",
  "payments",
  "invoices",
  "expenses",

  // 2. Sales & Commercial Records
  "sales_issue_items",
  "sales_issues",
  "sales_orders",
  "shipment_documents",
  "hkc_doc_records",
  "processing_services",

  // 3. Procurement Records
  "purchase_orders",

  // 4. Inventory, Batches, Movements & Transfers
  "quarantine_records",
  "store_transfer_items",
  "store_transfers",
  "stock_movements",
  "export_warehouse_movements",
  "pharma_product_batches",
  "pharma_products",
  "export_products",

  // 5. Commercial Partners
  "customers",
  "suppliers",
]

async function main() {
  console.log("================================================================================")
  console.log("              DATABASE CLEANUP FOR FRESH END-TO-END TESTING                     ")
  console.log("================================================================================\n")

  // Safety verification: confirm backup exists
  if (!fs.existsSync(BACKUP_PATH) || fs.statSync(BACKUP_PATH).size < 100000) {
    console.error(`❌ ERROR: Safety snapshot backup not found at ${BACKUP_PATH}! Aborting for safety.`)
    process.exit(1)
  }
  console.log(`✓ Verified safety snapshot backup on Desktop (${(fs.statSync(BACKUP_PATH).size / 1024).toFixed(1)} KB)`)

  const conn = await pool.getConnection()
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    console.log("\nClearing transactional, stock, and partner tables...")
    for (const table of TABLES_TO_CLEAR) {
      const [{ affectedRows }] = await conn.query(`DELETE FROM \`${table}\``)
      console.log(`  ✓ Cleared ${table.padEnd(28)} (${affectedRows} records removed)`)
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")

    console.log("\n--------------------------------------------------------------------------------")
    console.log("                       FINAL DATABASE STATUS AUDIT                              ")
    console.log("--------------------------------------------------------------------------------\n")

    const [allTables] = await conn.query("SHOW TABLES")
    console.log("ESSENTIAL TABLES (PRESERVED):")
    for (const row of allTables) {
      const t = Object.values(row)[0]
      if (ESSENTIAL_TABLES.has(t)) {
        const [c] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``)
        console.log(`  🔒 ${t.padEnd(28)} : ${c[0].cnt} records (PRESERVED)`)
      }
    }

    console.log("\nCLEARED TABLES (READY FOR TESTING):")
    let totalUncleared = 0
    for (const table of TABLES_TO_CLEAR) {
      const [c] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``)
      const count = c[0].cnt
      if (count > 0) totalUncleared++
      console.log(`  ✨ ${table.padEnd(28)} : ${count} records (CLEARED)`)
    }

    if (totalUncleared === 0) {
      console.log("\n================================================================================")
      console.log("🎉 DATABASE CLEANUP COMPLETE! SYSTEM READY FOR FRESH TEST TRANSACTIONS.")
      console.log("================================================================================\n")
    } else {
      console.error(`\n❌ Warning: ${totalUncleared} tables still have records!`)
    }

  } catch (err) {
    console.error("Cleanup failed:", err)
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
