import { pool } from "../db/client.js"

/**
 * Ensures `users` relational table has all necessary columns:
 * permissions JSON
 */
export async function migrateUsersSchema() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM `users`")
    const existingCols = new Set(cols.map((c) => c.Field.toLowerCase()))

    if (!existingCols.has("permissions")) {
      await pool.query("ALTER TABLE `users` ADD COLUMN `permissions` JSON DEFAULT NULL")
      console.log("[DB Migration] Added `permissions` JSON column to `users` table.")
    }
  } catch (err) {
    console.warn("[DB Migration] Users schema check notice:", err.message)
  }
}

if (process.argv[1]?.endsWith("migrateUsersSchema.js")) {
  migrateUsersSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
