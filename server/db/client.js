import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema/index.js"
import { config } from "../config.js"

function getPoolConfig() {
  if (config.databaseUrl) {
    return {
      uri: config.databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    }
  }

  return {
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  }
}

// MySQL connection pool
export const pool = mysql.createPool(getPoolConfig())

// Unified type-safe Drizzle MySQL client
export const db = drizzle(pool, { schema, mode: "default" })

export default db
