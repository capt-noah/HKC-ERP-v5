import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import express from "express"
import cors from "cors"
import { assertConfig, config } from "./config.js"
import { masterRouter } from "./router/index.js"
import { logger } from "./logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.resolve(__dirname, "../dist")

assertConfig()

const app = express()

// 1. CORS — MUST be the VERY FIRST middleware so every request (and preflight OPTIONS) gets proper headers immediately!
app.use(
  cors({
    origin: true, // Dynamically reflects request origin (e.g. https://hkc-erp-v4.vercel.app, localhost, etc.)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "apikey",
      "prefer",
      "x-client-info",
      "Cache-Control",
      "Pragma",
      "If-None-Match",
    ],
    exposedHeaders: ["Content-Length", "Content-Range", "Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
    optionsSuccessStatus: 204,
  })
)

// 2. Request logger middleware — logs every request to stdout (for Render) and server/logs/access.log
app.use(logger.requestLogger)

// 3. Parse JSON request bodies before any route handler runs.
app.use(express.json({ limit: "10mb" }))

import { pool } from "./db/client.js"
import { ensureSuperAdmin } from "./modules/auth/authController.js"

// Auto-bootstrap superadmin account in background on startup
void ensureSuperAdmin()

// 4. API Diagnostics & Health Endpoints (Matching Plesk architecture)
app.get("/hello", (req, res) => {
  res.json({
    status: "ok",
    message: "HKC ERP Express server running on Plesk",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    port: process.env.PORT || config.port,
    dbHost: config.dbHost,
    dbName: config.dbName,
  })
})

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "HKC is working" })
})

app.get("/api/auth/seed", async (req, res) => {
  try {
    await ensureSuperAdmin()
    res.json({ status: "success", message: "Superadmin account verified/seeded: admin / SuperadminPassword1!" })
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message })
  }
})

app.get("/api/db-test", async (req, res) => {
  try {
    const [ping] = await pool.query("SELECT 1+1 AS result, NOW() AS server_time")
    const [tables] = await pool.query("SHOW TABLES")
    let usersList = []
    try {
      const [rows] = await pool.query("SELECT id, username, role, status, is_active FROM users")
      usersList = rows
    } catch {}
    res.json({
      status: "success",
      ping: ping[0],
      database: config.dbName,
      host: config.dbHost,
      totalTables: tables.length,
      users: usersList,
      tables,
    })
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message })
  }
})

app.get("/api/db-test/sales-issues", async (req, res) => {
  try {
    const [issues] = await pool.query("SELECT * FROM `sales_issues` ORDER BY created_at DESC LIMIT 20").catch(async () => {
      const [rows] = await pool.query("SELECT * FROM `sales_issues` LIMIT 20")
      return [rows]
    })
    const [items] = await pool.query("SELECT * FROM `sales_issue_items` LIMIT 50")
    res.json({
      status: "success",
      totalIssues: issues.length,
      totalItems: items.length,
      issues,
      items,
    })
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message })
  }
})

// 5. API & Backend routes
app.use("/", masterRouter)

// 6. Serve uploaded files statically with caching, security headers, and cross-folder resolver fallback
const uploadsPath = path.resolve(__dirname, "../uploads")
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}

app.use(
  "/uploads",
  express.static(uploadsPath, {
    maxAge: "7d",
    setHeaders: (res) => {
      res.set("X-Content-Type-Options", "nosniff")
    },
  })
)

// Fallback resolver for legacy files or path mismatches under /uploads/
app.use("/uploads", (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next()

  const rawPath = decodeURIComponent(req.path || "")
  const filename = path.basename(rawPath)
  if (!filename || filename === "." || filename === "/") return next()

  // 1. Check directly under uploads root
  const directPath = path.join(uploadsPath, filename)
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return res.sendFile(directPath)
  }

  // 2. Search all category subdirectories under uploads/
  try {
    const subdirs = fs.readdirSync(uploadsPath, { withFileTypes: true }).filter((d) => d.isDirectory())
    for (const dir of subdirs) {
      const candidate = path.join(uploadsPath, dir.name, filename)
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return res.sendFile(candidate)
      }
    }
  } catch (err) {
    console.warn("[Uploads Fallback Resolver Notice]:", err.message)
  }

  return res.status(404).json({ error: `File '${filename}' not found in server storage.` })
})

// 7. Serve static assets from pre-compiled dist/ directory (for Plesk / standalone hosting)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: "1d", index: false }))
}

// 8. SPA Client-Side Catch-All Fallback (eliminates page refresh trap on Plesk across all Express versions)
app.use((req, res, next) => {
  if (req.method !== "GET") return next()
  const indexPath = path.join(distPath, "index.html")
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(200).send("HKC ERP API is running. Run 'npm run build' to generate frontend assets.")
  }
})

// Generic error handler — catches anything thrown inside route handlers.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl || req.url}`, err)
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD")
  res.header("Access-Control-Allow-Headers", "*")
  res.status(500).json({
    error: "Internal server error",
    message: err instanceof Error ? err.message : "Unknown error",
  })
})

const rawPort = process.env.PORT || config.port || 1000
const isNamedPipeOrSocket = typeof rawPort === "string" && isNaN(Number(rawPort))

const server = isNamedPipeOrSocket
  ? app.listen(rawPort, () => {
      console.log(`HKC ERP API listening on socket/pipe ${rawPort}`)
    })
  : app.listen(Number(rawPort), () => {
      console.log(`HKC ERP API listening on port ${rawPort}`)
    })

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully.`)
  server.close(() => {
    console.log("HTTP server closed.")
    process.exit(0)
  })

  setTimeout(() => {
    console.error("Forced exit after timeout.")
    process.exit(1)
  }, 10_000).unref()
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

process.on("unhandledRejection", (reason) => {
  console.error("[SERVER UNHANDLED REJECTION]:", reason)
})

process.on("uncaughtException", (err) => {
  console.error("[SERVER UNCAUGHT EXCEPTION]:", err)
})

export { app, server }
export default app

