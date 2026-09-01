import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import jwt from "jsonwebtoken"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logsDir = path.join(__dirname, "logs")
const accessLogPath = path.join(logsDir, "access.log")
const errorLogPath = path.join(logsDir, "error.log")

// Ensure server/logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

function formatTimestamp(date = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, "0")
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())

  let hours = date.getHours()
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  const hh = pad(hours)

  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  const ms = pad(date.getMilliseconds(), 3)

  return `${y}-${m}-${d} ${hh}:${mm}:${ss}.${ms} ${ampm}`
}

function writeToFile(filePath, content) {
  try {
    fs.appendFileSync(filePath, content + "\n", "utf8")
  } catch (err) {
    console.error(`[LOGGER ERROR] Failed to write to ${filePath}:`, err.message)
  }
}

function extractUserFromReq(req) {
  const url = req.originalUrl || req.url || ""

  // 1. If req.user is populated by JWT middleware
  if (req.user) {
    const roles = req.user.roles || (req.user.role ? [req.user.role] : [])
    return {
      username: req.user.username || "token-user",
      role: roles.length ? roles.join(",") : "authenticated",
    }
  }

  // 2. Check Authorization Bearer header if req.user is not yet attached
  try {
    const authHeader = req.headers["authorization"]
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      const payload = jwt.decode(token)
      if (payload && typeof payload === "object") {
        const roles = payload.roles || (payload.role ? [payload.role] : [])
        return {
          username: payload.username || "token-user",
          role: roles.length ? roles.join(",") : "authenticated",
        }
      }
    }
  } catch {}

  // 3. Login attempt
  if (req.body && typeof req.body === "object" && req.body.username) {
    return {
      username: String(req.body.username),
      role: "auth",
    }
  }

  // 4. Health checks
  if (url === "/health" || url === "/api/health") {
    return {
      username: "system",
      role: "health",
    }
  }

  // 5. Static Assets
  if (url.startsWith("/assets/") || /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|json)$/i.test(url)) {
    return {
      username: "asset",
      role: "static",
    }
  }

  // 6. SPA / Browser Page Navigation (e.g. GET /admin, GET /sales, GET /finance)
  if (!url.startsWith("/api/")) {
    return {
      username: "browser",
      role: "page",
    }
  }

  // 7. Unauthenticated API request
  return {
    username: "unauthenticated",
    role: "guest",
  }
}

// ANSI Colors for formatted console output
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  bgRed: "\x1b[41m\x1b[37m\x1b[1m",
}

function getMethodColor(method) {
  switch (method) {
    case "GET": return C.cyan
    case "POST": return C.green
    case "PUT":
    case "PATCH": return C.yellow
    case "DELETE": return C.red
    default: return C.magenta
  }
}

function getStatusColor(status) {
  if (status >= 500) return C.bgRed
  if (status >= 400) return C.yellow
  if (status >= 300) return C.cyan
  if (status >= 200) return C.green
  return C.reset
}

export const logger = {
  info(message, meta = {}) {
    const timestamp = formatTimestamp()
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""
    const plainLine = `[${timestamp}] [INFO] ${message}${metaStr}`
    const consoleLine = `${C.dim}[${timestamp}]${C.reset} ${C.green}[INFO]${C.reset} ${message}${metaStr}`
    console.log(consoleLine)
    writeToFile(accessLogPath, plainLine)
  },

  error(message, error = null) {
    const timestamp = formatTimestamp()
    const errDetails = error instanceof Error ? `${error.message}\n${error.stack}` : error ? JSON.stringify(error) : ""
    const plainLine = `[${timestamp}] [ERROR] ${message} ${errDetails}`.trim()
    const consoleLine = `${C.dim}[${timestamp}]${C.reset} ${C.red}[ERROR]${C.reset} ${C.bold}${message}${C.reset} ${errDetails}`.trim()
    console.error(consoleLine)
    writeToFile(errorLogPath, plainLine)
    writeToFile(accessLogPath, plainLine)
  },

  /**
   * Express request logging middleware.
   * Format: [Timestamp 12hr] [Role] [Username] Method URL Status Duration
   */
  requestLogger(req, res, next) {
    const start = process.hrtime()
    const method = req.method
    const url = req.originalUrl || req.url

    const logRequest = () => {
      res.removeListener("finish", logRequest)
      res.removeListener("close", logRequest)

      const diff = process.hrtime(start)
      const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(1)
      const status = res.statusCode
      const timestamp = formatTimestamp()
      const userInfo = extractUserFromReq(req)

      const plainLine = `[${timestamp}] [${userInfo.role}] [${userInfo.username}] ${method} ${url} ${status} ${durationMs}ms`

      if (status >= 400) {
        // Highlight the ENTIRE row in bright bold red for instant visibility on failures
        const failedConsoleLine = `${C.red}${C.bold}[${timestamp}] [${userInfo.role}] [${userInfo.username}] ${method} ${url} ${status} ${durationMs}ms${C.reset}`
        console.error(failedConsoleLine)
        writeToFile(errorLogPath, `${plainLine} - UA: ${req.headers["user-agent"] || "-"}`)
      } else {
        const timeStr = `${C.dim}[${timestamp}]${C.reset}`
        const roleStr = `${C.cyan}[${userInfo.role}]${C.reset}`
        const userStr = `${C.green}[${userInfo.username}]${C.reset}`
        const methodStr = `${getMethodColor(method)}${C.bold}${method}${C.reset}`
        const urlStr = `${C.bold}${url}${C.reset}`
        const statusStr = `${getStatusColor(status)}${status}${C.reset}`
        const durationStr = `${C.dim}${durationMs}ms${C.reset}`

        const consoleLine = `${timeStr} ${roleStr} ${userStr} ${methodStr} ${urlStr} ${statusStr} ${durationStr}`
        console.log(consoleLine)
      }

      writeToFile(accessLogPath, plainLine)
    }

    res.on("finish", logRequest)
    res.on("close", logRequest)

    next()
  },
}
