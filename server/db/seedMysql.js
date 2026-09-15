import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
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
    multipleStatements: true,
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  }
}

function findLatestSnapshotDir() {
  const backupsRoot = path.resolve(__dirname, "backups")
  if (!fs.existsSync(backupsRoot)) return null

  const entries = fs.readdirSync(backupsRoot)
    .filter((e) => e.startsWith("snapshot-"))
    .sort()
    .reverse()

  return entries.length > 0 ? path.join(backupsRoot, entries[0]) : null
}

function formatMysqlValue(v) {
  if (v === undefined || v === null) return null
  if (v instanceof Date) return v
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        const pad = (n, len = 2) => String(n).padStart(len, "0")
        const y = d.getUTCFullYear()
        const m = pad(d.getUTCMonth() + 1)
        const dt = pad(d.getUTCDate())
        const h = pad(d.getUTCHours())
        const min = pad(d.getUTCMinutes())
        const s = pad(d.getUTCSeconds())
        const ms = pad(d.getUTCMilliseconds(), 3)
        return `${y}-${m}-${dt} ${h}:${min}:${s}.${ms}`
      }
    }
    return v
  }
  if (typeof v === "object") return JSON.stringify(v)
  return v
}

export async function seedMysql(targetSnapshotDir) {
  const snapshotDir = targetSnapshotDir || findLatestSnapshotDir()

  if (!snapshotDir || !fs.existsSync(snapshotDir)) {
    throw new Error(`Snapshot directory not found: ${snapshotDir}. Run 'node server/db/exportData.js' first!`)
  }

  const manifestPath = path.join(snapshotDir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json missing in ${snapshotDir}`)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  console.log(`\n======================================================`)
  console.log(`🚀 Starting Zero-Loss MySQL Seed & Migration`)
  console.log(`   Source Snapshot: ${snapshotDir}`)
  console.log(`   Total Records:   ${manifest.totalRecords}`)
  console.log(`======================================================\n`)

  const connection = await mysql.createConnection(getMysqlConfig())

  try {
    // 1. Ensure master schema is applied
    const schemaSqlPath = path.join(__dirname, "schema/sql/master_mysql.sql")
    if (fs.existsSync(schemaSqlPath)) {
      console.log("Applying master_mysql.sql schema...")
      const schemaSql = fs.readFileSync(schemaSqlPath, "utf-8")
      await connection.query(schemaSql)
      console.log("✓ Schema applied / verified.")
    }

    // 2. Disable foreign key checks during batch data seeding
    await connection.query("SET FOREIGN_KEY_CHECKS = 0;")

    let totalSeeded = 0

    for (const [tableName, meta] of Object.entries(manifest.tables)) {
      const dataFilePath = path.join(snapshotDir, `${tableName}.json`)
      if (!fs.existsSync(dataFilePath)) continue

      const rows = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"))
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`- ${tableName.padEnd(30)}: 0 records (skipped)`)
        continue
      }

      process.stdout.write(`Seeding ${tableName.padEnd(28)} (${rows.length} rows) ... `)

      if (meta.storage === "jsonb_document") {
        // Document table seed
        for (const row of rows) {
          const id = String(row.id || "")
          const payload = typeof row.payload === "object" ? JSON.stringify(row.payload) : JSON.stringify(row)
          const createdAt = row.created_at ? new Date(row.created_at) : new Date()
          const updatedAt = row.updated_at ? new Date(row.updated_at) : new Date()

          await connection.query(
            `INSERT INTO \`${tableName}\` (id, payload, created_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
            [id, payload, createdAt, updatedAt]
          )
        }
      } else {
        // Relational table seed
        for (const row of rows) {
          const keys = Object.keys(row)
          const values = Object.values(row).map(formatMysqlValue)

          const columnList = keys.map((k) => `\`${k}\``).join(", ")
          const placeholders = keys.map(() => "?").join(", ")
          const updateClause = keys
            .filter((k) => k !== "id")
            .map((k) => `\`${k}\` = VALUES(\`${k}\`)`)
            .join(", ")

          const sql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})
                       ON DUPLICATE KEY UPDATE ${updateClause || "id=id"}`

          await connection.query(sql, values)
        }
      }

      totalSeeded += rows.length
      console.log(`✓ done`)
    }

    // 3. Re-enable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1;")

    console.log(`\n======================================================`)
    console.log(`✅ Seeding Complete!`)
    console.log(`   Total Records Seeded: ${totalSeeded}`)
    console.log(`======================================================\n`)
  } finally {
    await connection.end()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const customDir = process.argv[2] || null
  seedMysql(customDir).catch((err) => {
    console.error("Seeding failed:", err)
    process.exit(1)
  })
}
