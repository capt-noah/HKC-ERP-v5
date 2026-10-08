import mysql from "mysql2/promise"
import fs from "node:fs"
import { config } from "../config.js"

async function main() {
  const conn = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  })

  const [tables] = await conn.query("SHOW TABLES;")
  const tableNames = tables.map((r) => Object.values(r)[0])

  const localCounts = {}
  for (const t of tableNames) {
    const [cnt] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``)
    localCounts[t] = cnt[0].c
  }

  console.log("Reading /Users/Noah/Desktop/hkc_trading.sql ...")
  const sql = fs.readFileSync("/Users/Noah/Desktop/hkc_trading.sql", "utf8")

  const pleskCounts = {}
  for (const t of tableNames) {
    const tableHeader = `INSERT INTO \`${t}\``
    let pos = 0
    let count = 0
    while (true) {
      const idx = sql.indexOf(tableHeader, pos)
      if (idx === -1) break
      const endIdx = sql.indexOf(";\n", idx)
      const stmt = sql.slice(idx, endIdx === -1 ? undefined : endIdx)
      const valuesIdx = stmt.indexOf("VALUES")
      if (valuesIdx !== -1) {
        const valStr = stmt.slice(valuesIdx + 6)
        // Count tuples
        const tuples = valStr.split(/\),\s*\(/g).length
        count += tuples
      }
      if (endIdx === -1) break
      pos = endIdx + 2
    }
    pleskCounts[t] = count
  }

  console.log(String("TABLE").padEnd(30) + String("LOCAL").padEnd(10) + String("PLESK").padEnd(10) + "DIFF")
  console.log("-".repeat(60))
  for (const t of tableNames) {
    const l = localCounts[t] || 0
    const p = pleskCounts[t] || 0
    if (l > 0 || p > 0) {
      console.log(t.padEnd(30) + String(l).padEnd(10) + String(p).padEnd(10) + (p - l))
    }
  }

  await conn.end()
}

main().catch(console.error)
