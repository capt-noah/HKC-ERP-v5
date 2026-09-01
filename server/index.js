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

// 4. API & Backend routes
app.use("/", masterRouter)

// 2. Serve static assets from pre-compiled dist/ directory (for Plesk / standalone hosting)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: "1d", index: false }))
}

// 3. SPA Client-Side Catch-All Fallback (eliminates page refresh trap on Plesk across all Express versions)
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

const server = app.listen(config.port, config.host, () => {
  console.log(`HKC ERP API listening on http://${config.host}:${config.port}`)
})

// Graceful shutdown — Render sends SIGTERM before killing the container.
function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully.`)
  server.close(() => {
    console.log("HTTP server closed.")
    process.exit(0)
  })

  // Force-exit if connections don't drain within 10 seconds.
  setTimeout(() => {
    console.error("Forced exit after timeout.")
    process.exit(1)
  }, 10_000).unref()
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
