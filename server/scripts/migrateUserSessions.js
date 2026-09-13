import { pool } from "../db/client.js"

export async function migrateUserSessions() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`user_agent\` TEXT NULL,
        \`device_type\` VARCHAR(50) NULL DEFAULT 'desktop',
        \`os_name\` VARCHAR(50) NULL,
        \`browser_name\` VARCHAR(50) NULL,
        \`is_revoked\` TINYINT(1) NOT NULL DEFAULT 0,
        \`last_active_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`expires_at\` TIMESTAMP NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_user_sessions_user_id\` (\`user_id\`),
        INDEX \`idx_user_sessions_lookup\` (\`id\`, \`is_revoked\`, \`expires_at\`),
        CONSTRAINT \`fk_user_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log("[DB Migration] `user_sessions` table verified/created successfully.")
  } catch (err) {
    if (err.message && (err.message.includes("Cannot add foreign key constraint") || err.message.includes("foreign key"))) {
      console.warn("[DB Migration] Retrying `user_sessions` creation without foreign key constraint:", err.message)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`user_sessions\` (
          \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
          \`user_id\` VARCHAR(191) NOT NULL,
          \`ip_address\` VARCHAR(45) NULL,
          \`user_agent\` TEXT NULL,
          \`device_type\` VARCHAR(50) NULL DEFAULT 'desktop',
          \`os_name\` VARCHAR(50) NULL,
          \`browser_name\` VARCHAR(50) NULL,
          \`is_revoked\` TINYINT(1) NOT NULL DEFAULT 0,
          \`last_active_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`expires_at\` TIMESTAMP NOT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_user_sessions_user_id\` (\`user_id\`),
          INDEX \`idx_user_sessions_lookup\` (\`id\`, \`is_revoked\`, \`expires_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)
      console.log("[DB Migration] `user_sessions` table verified/created (without FK constraint).")
    } else {
      console.error("[DB Migration] Error initializing `user_sessions` table:", err.message)
      throw err
    }
  }
}

// Auto-run if directly invoked via CLI
if (process.argv[1]?.endsWith("migrateUserSessions.js")) {
  migrateUserSessions()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
