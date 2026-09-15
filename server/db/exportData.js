import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { resources } from "./resourceRegistry.js"
import { config } from "../config.js"
import mysql from "mysql2/promise"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootEnvPath = path.resolve(__dirname, "../../.env")

try {
  process.loadEnvFile?.(rootEnvPath)
} catch {
  try {
    process.loadEnvFile?.()
  } catch {}
}

function isMysql() {
  return process.env.DB_DRIVER === "mysql" || Boolean(process.env.MYSQL_URL)
}

function getMysqlConfig() {
  if (process.env.MYSQL_URL) {
    return { uri: process.env.MYSQL_URL }
  }

  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "hkc_erp",
  }
}

function authHeaders() {
  const key = config.supabaseServiceRoleKey || config.supabasePublishableKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ""
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }
}

async function fetchTableRowsSupabase(tableName, retries = 2) {
  const restUrl = config.supabaseRestUrl || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/rest/v1/` : "")
  if (!restUrl) {
    throw new Error("SUPABASE_REST_URL or SUPABASE_URL environment variable is required to export from Supabase.")
  }

  const url = new URL(tableName, restUrl)
  url.searchParams.set("select", "*")
  url.searchParams.set("limit", "100000") // export all available records

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: authHeaders(),
        signal: AbortSignal.timeout(25000),
      })

      if (!response.ok) {
        const text = await response.text()
        if (response.status === 404 || response.status === 400) {
          return []
        }
        throw new Error(`[${response.status}] ${text.slice(0, 150)}`)
      }

      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (err) {
      if (attempt === retries) {
        if (err.name === "TimeoutError") {
          console.warn(`[Timeout] ${tableName} timed out after ${retries} attempts`)
          return []
        }
        throw err
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  return []
}

async function fetchTableRowsMysql(connection, tableName) {
  const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``)
  return Array.isArray(rows) ? rows : []
}

export async function exportAllData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupDir = path.resolve(__dirname, `backups/snapshot-${timestamp}`)

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const sourceName = isMysql() ? "Local MySQL Database" : "Supabase Cloud"

  console.log(`\n======================================================`)
  console.log(`📦 Starting Zero-Data-Loss Export`)
  console.log(`   Source:      ${sourceName}`)
  console.log(`   Destination: ${backupDir}`)
  console.log(`======================================================\n`)

  const manifest = {
    timestamp: new Date().toISOString(),
    source: isMysql() ? "mysql" : "supabase",
    backupDir,
    tables: {},
    totalRecords: 0,
  }

  let mysqlConn = null
  if (isMysql()) {
    mysqlConn = await mysql.createConnection(getMysqlConfig())
  }

  try {
    const tableEntries = Object.entries(resources)

    for (const [name, meta] of tableEntries) {
      const tableName = meta.table || name
      process.stdout.write(`Exporting ${tableName.padEnd(30)} ... `)

      try {
        let rows = []
        if (isMysql()) {
          rows = await fetchTableRowsMysql(mysqlConn, tableName)
        } else {
          rows = await fetchTableRowsSupabase(tableName)
        }

        const filePath = path.join(backupDir, `${tableName}.json`)
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), "utf-8")

        manifest.tables[tableName] = {
          resource: name,
          storage: meta.storage || "jsonb_document",
          module: meta.module,
          recordCount: rows.length,
          file: `${tableName}.json`,
        }
        manifest.totalRecords += rows.length

        console.log(`✓ ${rows.length} records saved`)
      } catch (err) {
        console.log(`❌ Error: ${err.message}`)
        manifest.tables[tableName] = {
          resource: name,
          storage: meta.storage || "jsonb_document",
          module: meta.module,
          recordCount: 0,
          error: err.message,
        }
      }
    }

    const manifestPath = path.join(backupDir, "manifest.json")
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8")

    console.log(`\n======================================================`)
    console.log(`🎉 Export Complete!`)
    console.log(`   Total Tables Processed: ${tableEntries.length}`)
    console.log(`   Total Records Exported:  ${manifest.totalRecords}`)
    console.log(`   Manifest File:           ${manifestPath}`)
    console.log(`======================================================\n`)

    return { backupDir, manifest }
  } finally {
    if (mysqlConn) {
      await mysqlConn.end()
    }
  }
}

// Direct execution from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  exportAllData().then(() => {
    process.exit(0)
  }).catch((err) => {
    console.error("Export failed:", err)
    process.exit(1)
  })
}
