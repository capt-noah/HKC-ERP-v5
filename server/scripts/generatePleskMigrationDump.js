import { pool } from "../db/client.js"
import fs from "fs"
import path from "path"

async function generateMigrationSql() {
  console.log("================================================================================")
  console.log("       GENERATING COMPLETE MYSQL MIGRATION DUMP FOR PLESK MYSQL DB             ")
  console.log("================================================================================\n")

  const conn = await pool.getConnection()
  try {
    const [tablesRows] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
    const tables = tablesRows.map((r) => Object.values(r)[0])
    console.log(`Found ${tables.length} tables in database.\n`)

    const sqlChunks = []
    const timestamp = new Date().toISOString()

    sqlChunks.push(`-- ============================================================================
-- HKC Trading ERP - Complete Database Migration Dump
-- Target Platform: Plesk / phpMyAdmin / MySQL 5.7+ & 8.0+
-- Generated Date: ${timestamp}
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

`)

    for (const tableName of tables) {
      console.log(`Exporting table: ${tableName}...`)

      // 1. Drop Table If Exists
      sqlChunks.push(`-- ----------------------------------------------------------------------------\n-- Table structure for table \`${tableName}\`\n-- ----------------------------------------------------------------------------\n`)
      sqlChunks.push(`DROP TABLE IF EXISTS \`${tableName}\`;\n`)

      // 2. Create Table DDL
      const [createResult] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``)
      const createTableSql = createResult[0]["Create Table"]
      sqlChunks.push(`${createTableSql};\n\n`)

      // 3. Table Rows Data
      const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``)
      if (rows.length > 0) {
        sqlChunks.push(`-- Dumping data for table \`${tableName}\` (${rows.length} rows)\n`)
        const columns = Object.keys(rows[0])
        const colsSql = columns.map((c) => `\`${c}\``).join(", ")

        // Chunk inserts by 50 rows
        const chunkSize = 50
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize)
          const valuesSql = chunk
            .map((row) => {
              const vals = columns.map((col) => {
                const val = row[col]
                if (val === null || val === undefined) return "NULL"
                if (typeof val === "boolean") return val ? "1" : "0"
                if (typeof val === "number") return isNaN(val) ? "NULL" : String(val)
                if (val instanceof Date) {
                  if (isNaN(val.getTime())) return "NULL"
                  return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`
                }
                if (typeof val === "object") {
                  const jsonStr = JSON.stringify(val)
                    .replace(/\\/g, "\\\\")
                    .replace(/'/g, "\\'")
                    .replace(/\n/g, "\\n")
                    .replace(/\r/g, "\\r")
                  return `'${jsonStr}'`
                }
                const str = String(val)
                  .replace(/\\/g, "\\\\")
                  .replace(/'/g, "\\'")
                  .replace(/\n/g, "\\n")
                  .replace(/\r/g, "\\r")
                  .replace(/\x00/g, "\\0")
                return `'${str}'`
              })
              return `(${vals.join(", ")})`
            })
            .join(",\n")

          sqlChunks.push(`INSERT INTO \`${tableName}\` (${colsSql}) VALUES\n${valuesSql};\n`)
        }
        sqlChunks.push("\n")
      } else {
        sqlChunks.push(`-- No data to dump for table \`${tableName}\`\n\n`)
      }
    }

    sqlChunks.push(`-- ============================================================================
-- End of Migration Dump
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 1;
`)

    const outputPath = path.resolve("./hkc_trading_migration_plesk.sql")
    fs.writeFileSync(outputPath, sqlChunks.join(""), "utf8")
    const stats = fs.statSync(outputPath)

    console.log(`\n✅ Migration SQL generated successfully!`)
    console.log(`   File Path: ${outputPath}`)
    console.log(`   File Size: ${(stats.size / 1024).toFixed(2)} KB`)
  } catch (err) {
    console.error("❌ Error generating migration SQL:", err)
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

generateMigrationSql().catch((err) => {
  console.error(err)
  process.exit(1)
})
