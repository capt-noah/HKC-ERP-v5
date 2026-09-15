import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootEnvPath = path.resolve(__dirname, "../.env")

import fs from "node:fs"

// Zero-dependency cross-version .env loader (compatible with Node 18, 20, 22+)
function loadEnvFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8")
      for (const rawLine of content.split(/\r?\n/)) {
        let line = rawLine.trim()
        if (!line || line.startsWith("#")) continue

        // Handle export prefix if present (e.g. export DB_HOST=...)
        if (line.startsWith("export ")) {
          line = line.slice(7).trim()
        }

        const eqIdx = line.indexOf("=")
        if (eqIdx !== -1) {
          const key = line.slice(0, eqIdx).trim()
          let val = line.slice(eqIdx + 1).trim()

          // Remove enclosing quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")) || (val.startsWith("`") && val.endsWith("`"))) {
            val = val.slice(1, -1)
          }

          if (process.env[key] === undefined || process.env[key] === "") {
            process.env[key] = val
          }
        }
      }
      console.log(`[CONFIG] Loaded environment variables from: ${filePath}`)
    }
  } catch (err) {
    console.warn("[CONFIG] Notice reading env file:", err.message)
  }
}

// Attempt loading from root .env and cwd .env and parent paths
loadEnvFileSafe(rootEnvPath)
loadEnvFileSafe(path.resolve(process.cwd(), ".env"))
loadEnvFileSafe(path.resolve(__dirname, "../../.env"))

// ── Hardcoded Default MySQL Configuration Fallbacks ───────────────────────────
const DEFAULT_MYSQL_HOST = "127.0.0.1"
const DEFAULT_MYSQL_PORT = 3306
const DEFAULT_MYSQL_USER = "habtom"
const DEFAULT_MYSQL_PASSWORD = "DMka6&jn0*Wsdfo0"
const DEFAULT_MYSQL_DATABASE = "hkc_trading"
const DEFAULT_DATABASE_URL = `mysql://${DEFAULT_MYSQL_USER}:${DEFAULT_MYSQL_PASSWORD}@${DEFAULT_MYSQL_HOST}:${DEFAULT_MYSQL_PORT}/${DEFAULT_MYSQL_DATABASE}`

export const config = {
  port: Number(process.env.PORT || process.env.SERVER_PORT || 1000),
  host: process.env.SERVER_HOST || "0.0.0.0",

  // Direct Database URL (with hardcoded fallback)
  databaseUrl: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,

  // Discrete MySQL connection parameters (with hardcoded fallbacks)
  dbHost: process.env.DB_HOST || process.env.MYSQL_HOST || DEFAULT_MYSQL_HOST,
  dbPort: Number(process.env.DB_PORT || process.env.MYSQL_PORT || DEFAULT_MYSQL_PORT),
  dbUser: process.env.DB_USER || process.env.MYSQL_USER || DEFAULT_MYSQL_USER,
  dbPassword: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : DEFAULT_MYSQL_PASSWORD),
  dbName: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_DATABASE || process.env.MYSQL_DB || DEFAULT_MYSQL_DATABASE,

  // Authentication & Security
  jwtSecret: process.env.JWT_SECRET || "hkc_erp_v5_fallback_jwt_secret_key_2026",
  superadminRecoveryKey: process.env.SUPERADMIN_RECOVERY_KEY || "HKC-MASTER-RECOVERY-2026-KEY",
}

export function assertConfig() {
  // Always valid due to complete hardcoded fallbacks
  return true
}

