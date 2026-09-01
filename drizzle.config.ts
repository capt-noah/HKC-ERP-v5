import { defineConfig } from "drizzle-kit"
import fs from "node:fs"
import path from "node:path"

// Load .env if present
try {
  const envPath = path.resolve(process.cwd(), ".env")
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath)
  }
} catch {}

const databaseUrl =
  process.env.DATABASE_URL ||
  `mysql://${process.env.DB_USER || "root"}:${encodeURIComponent(process.env.DB_PASSWORD || "")}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || "hkc_erp_v5"}`

export default defineConfig({
  schema: "./server/db/schema/index.js",
  out: "./server/db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
})
