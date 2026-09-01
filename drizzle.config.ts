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

export default defineConfig({
  schema: "./server/db/schema/index.js",
  out: "./server/db/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.DB_HOST || "10.180.50.142",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "habtom",
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "DMka6&jn0*Wsdfo0",
    database: process.env.DB_NAME || "hkc_trading",
  },
  verbose: true,
  strict: true,
})
