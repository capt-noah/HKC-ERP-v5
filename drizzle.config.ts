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
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "habtom",
    password: process.env.MYSQL_PASSWORD || "DMka6&jn0*Wsdfo0",
    database: process.env.MYSQL_DATABASE || "hkc_trading",
  },
  verbose: true,
  strict: true,
})
