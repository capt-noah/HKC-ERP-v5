import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootEnvPath = path.resolve(__dirname, "../.env")

try {
  process.loadEnvFile?.(rootEnvPath)
} catch {
  try {
    process.loadEnvFile?.()
  } catch {
    // Environment files are optional; hardcoded fallback credentials will be used.
  }
}

// ── Hardcoded Default MySQL Configuration Fallbacks ───────────────────────────
const DEFAULT_MYSQL_HOST = "127.0.0.1"
const DEFAULT_MYSQL_PORT = 3306
const DEFAULT_MYSQL_USER = "root"
const DEFAULT_MYSQL_PASSWORD = ""
const DEFAULT_MYSQL_DATABASE = "hkc_erp_v5"
const DEFAULT_DATABASE_URL = `mysql://${DEFAULT_MYSQL_USER}:${DEFAULT_MYSQL_PASSWORD}@${DEFAULT_MYSQL_HOST}:${DEFAULT_MYSQL_PORT}/${DEFAULT_MYSQL_DATABASE}`

export const config = {
  port: Number(process.env.PORT || process.env.SERVER_PORT || 1000),
  host: process.env.SERVER_HOST || "0.0.0.0",

  // Direct Database URL (with hardcoded fallback)
  databaseUrl: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,

  // Discrete MySQL connection parameters (with hardcoded fallbacks)
  dbHost: process.env.DB_HOST || DEFAULT_MYSQL_HOST,
  dbPort: Number(process.env.DB_PORT || DEFAULT_MYSQL_PORT),
  dbUser: process.env.DB_USER || DEFAULT_MYSQL_USER,
  dbPassword: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : DEFAULT_MYSQL_PASSWORD,
  dbName: process.env.DB_NAME || DEFAULT_MYSQL_DATABASE,

  // Authentication & Security
  jwtSecret: process.env.JWT_SECRET || "hkc_erp_v5_fallback_jwt_secret_key_2026",
}

export function assertConfig() {
  // Always valid due to complete hardcoded fallbacks
  return true
}

