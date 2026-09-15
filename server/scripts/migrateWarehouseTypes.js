import { pool } from "../db/client.js"

async function runMigration() {
  console.log("Starting warehouse_type database normalization migration...")
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.query("SELECT id, payload FROM warehouses")
    console.log(`Found ${rows.length} warehouses in database.`)

    for (const row of rows) {
      let payload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {})
      const id = String(row.id || payload.id || "").toUpperCase()
      const typeStr = String(payload.type || "").toUpperCase()

      let warehouse_type = "PHARMA_WH"
      if (id.includes("WH1") || id.includes("AGRI") || typeStr.includes("EXPORT") || typeStr.includes("AGRI")) {
        warehouse_type = "EXPORT_WH"
      } else {
        warehouse_type = "PHARMA_WH"
      }

      payload.warehouse_type = warehouse_type
      if (warehouse_type === "EXPORT_WH" && (!payload.type || payload.type.includes("Dry Storage"))) {
        payload.type = "Export Hub"
      } else if (warehouse_type === "PHARMA_WH" && (!payload.type || payload.type.includes("Dry Storage"))) {
        payload.type = "Central Warehouse"
      }

      await conn.query("UPDATE warehouses SET payload = ? WHERE id = ?", [JSON.stringify(payload), row.id])
      console.log(`Updated warehouse ${row.id} -> warehouse_type: ${warehouse_type}`)
    }

    console.log("Warehouse type migration completed successfully.")
  } catch (err) {
    console.error("Migration error:", err)
  } finally {
    conn.release()
  }
}

runMigration().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
