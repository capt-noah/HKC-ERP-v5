import { pool } from "../db/client.js"

/**
 * Ensures `warehouses` relational table has all necessary columns:
 * manager, specialization, target_markets, status
 */
export async function migrateWarehousesSchema() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM `warehouses`")
    const existingCols = new Set(cols.map((c) => c.Field.toLowerCase()))

    if (!existingCols.has("manager")) {
      await pool.query("ALTER TABLE `warehouses` ADD COLUMN `manager` VARCHAR(255) NULL AFTER `type`")
      console.log("[DB Migration] Added `manager` column to `warehouses` table.")
    }
    if (!existingCols.has("specialization")) {
      await pool.query("ALTER TABLE `warehouses` ADD COLUMN `specialization` VARCHAR(255) NULL AFTER `manager`")
      console.log("[DB Migration] Added `specialization` column to `warehouses` table.")
    }
    if (!existingCols.has("target_markets")) {
      await pool.query("ALTER TABLE `warehouses` ADD COLUMN `target_markets` VARCHAR(255) NULL AFTER `specialization`")
      console.log("[DB Migration] Added `target_markets` column to `warehouses` table.")
    }
    if (!existingCols.has("status")) {
      await pool.query("ALTER TABLE `warehouses` ADD COLUMN `status` VARCHAR(50) NULL DEFAULT 'Active' AFTER `target_markets`")
      console.log("[DB Migration] Added `status` column to `warehouses` table.")
    }

    // Ensure baseline initial warehouse rows exist ONLY IF table is empty
    const [existingRows] = await pool.query("SELECT COUNT(*) as count FROM `warehouses`")
    if (existingRows && existingRows[0]?.count === 0) {
      const defaultRows = [
        ["WH1", "WH1 - Ethiopia Agricultural Export Hub", "WH1-AGRI-EXP", "Modjo Export Terminal, Ethiopia", "EXPORT_WH", "Export Hub", "Abebe Kasahun", "Agricultural Commodities", "Europe, Asia, USA", "Active"],
        ["WH2", "WH2 - Veterinary Import Hub (alem bank)IND", "WH2-VET-ALEM", "Alem Bank Hub, Addis Ababa, Ethiopia", "PHARMA_WH", "Import & Distribution Hub", "Dr. Alemayehu Worku", "Veterinary Drugs & Biologicals", "Domestic & Regional Dist.", "Active"],
        ["WH3", "WH3 - Veterinary Import Hub (LEBU)CHINA", "WH3-VET-LEBU", "Lebu Commercial Center, Addis Ababa, Ethiopia", "PHARMA_WH", "Import & Distribution Hub", "Tigist Haile", "Veterinary Supplies & Consumables", "Oromia & Southern Regions", "Active"],
      ]
      for (const row of defaultRows) {
        await pool.query(
          "INSERT IGNORE INTO `warehouses` (id, name, code, location, warehouse_type, type, manager, specialization, target_markets, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))",
          row
        )
      }
      console.log("[DB Migration] Seeded initial operating warehouses into `warehouses` table.")
    }
  } catch (err) {
    console.warn("[DB Migration] Warehouses schema check notice:", err.message)
  }
}

if (process.argv[1]?.endsWith("migrateWarehousesSchema.js")) {
  migrateWarehousesSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
