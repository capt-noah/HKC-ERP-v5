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

    console.log("[DB Migration] `warehouses` table columns verified successfully.")
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
