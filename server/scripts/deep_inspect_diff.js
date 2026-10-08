import mysql from "mysql2/promise"
import fs from "node:fs"
import { config } from "../config.js"

// Temporary load plesk sql into a temporary database or parse it
async function main() {
  const conn = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
  })

  console.log("Creating temporary database hkc_trading_plesk_temp...")
  await conn.query("DROP DATABASE IF EXISTS hkc_trading_plesk_temp;")
  await conn.query("CREATE DATABASE hkc_trading_plesk_temp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")

  console.log("Importing /Users/Noah/Desktop/hkc_trading.sql into hkc_trading_plesk_temp...")
  // We can use run_command or mysql CLI to import
  await conn.end()
}

main().catch(console.error)
