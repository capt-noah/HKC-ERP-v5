import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema/index.js"
import { config } from "../config.js"

function getPoolConfig() {
  if (process.env.DATABASE_URL) {
    let uri = String(process.env.DATABASE_URL)
    if (uri.includes("@localhost")) {
      uri = uri.replace("@localhost", "@127.0.0.1")
    }
    return {
      uri,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true,
    }
  }

  const host = config.dbHost === "localhost" ? "127.0.0.1" : (config.dbHost || "127.0.0.1")

  return {
    host,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    dateStrings: true,
  }
}

// MySQL connection pool
export const pool = mysql.createPool(getPoolConfig())

// Unified type-safe Drizzle MySQL client
export const db = drizzle(pool, { schema, mode: "default" })

export default db
