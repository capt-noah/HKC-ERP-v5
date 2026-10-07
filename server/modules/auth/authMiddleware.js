import jwt from "jsonwebtoken"
import { config } from "../../config.js"
import { pool } from "../../db/client.js"
import { validateSession } from "./sessionService.js"

const JWT_SECRET = config.jwtSecret

export function normalizeRole(role) {
  if (!role) return "sales"
  const clean = String(role).toLowerCase().trim()
  if (clean === "admin" || clean === "super_admin" || clean === "superadmin") return "superadmin"
  if (clean === "sales" || clean === "sales_manager") return "sales"
  if (clean === "hr" || clean === "hr_manager") return "hr"
  if (clean === "inventory" || clean === "inventory_admin" || clean === "inventory_manager") return "inventory"
  if (clean === "finance" || clean === "finance_manager") return "finance"
  if (clean === "hkc_docs" || clean === "hkc_docs_manager" || clean === "hkcdocs" || clean === "docs_specialist" || clean === "docs") return "hkc_docs"
  return clean
}

export function authenticateToken(req, res, next) {
  if (req.method === "OPTIONS") {
    return next()
  }

  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token missing", code: "TOKEN_EXPIRED" })
  }

  jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
    if (err || !decodedUser?.id) {
      return res.status(401).json({ error: "Invalid or expired token", code: "TOKEN_EXPIRED" })
    }

    try {
      // Enforce strict database session requirement: only sessions registered in user_sessions can access the system
      if (!decodedUser.sessionId) {
        return res.status(401).json({
          error: "Your session has expired or is no longer valid. Please log in again.",
          code: "SESSION_EXPIRED",
        })
      }

      const sessionCheck = await validateSession(decodedUser.sessionId)

      if (!sessionCheck.valid) {
        const statusCode = sessionCheck.code === "ACCOUNT_SUSPENDED" ? 403 : 401
        return res.status(statusCode).json({
          error: sessionCheck.error,
          code: sessionCheck.code || "SESSION_REVOKED",
        })
      }

      // Real-time live role and warehouse scope sync: inherit latest permissions without requiring re-login
      if (sessionCheck.user) {
        let currentRoles = sessionCheck.user.roles
        if (typeof currentRoles === "string") {
          try {
            currentRoles = JSON.parse(currentRoles)
          } catch {
            currentRoles = [sessionCheck.user.role || "viewer"]
          }
        }
        if (Array.isArray(currentRoles) && currentRoles.length > 0) {
          decodedUser.roles = currentRoles.map(normalizeRole)
          decodedUser.role = normalizeRole(currentRoles[0])
        }

        let currentWhIds = sessionCheck.user.warehouse_ids
        if (typeof currentWhIds === "string") {
          try {
            currentWhIds = JSON.parse(currentWhIds)
          } catch {
            currentWhIds = currentWhIds ? [currentWhIds] : []
          }
        }
        if (!Array.isArray(currentWhIds)) {
          currentWhIds = sessionCheck.user.warehouse_id ? [sessionCheck.user.warehouse_id] : []
        }
        decodedUser.warehouse_ids = currentWhIds
        decodedUser.warehouse_id = currentWhIds[0] || sessionCheck.user.warehouse_id || null
      }

      if (Array.isArray(decodedUser.roles)) {
        decodedUser.roles = decodedUser.roles.map(normalizeRole)
      }
      if (decodedUser.role) {
        decodedUser.role = normalizeRole(decodedUser.role)
      }

      req.user = decodedUser
      req.sessionId = decodedUser.sessionId

      // Expose active session database expiration timestamp on all authenticated responses
      if (sessionCheck.user?.expires_at) {
        res.setHeader("X-Session-Expires-At", new Date(sessionCheck.user.expires_at).toISOString())
      }

      return next()
    } catch (dbErr) {
      console.warn("[AUTH TOKEN DB CHECK WARNING]:", dbErr.message)
      return res.status(401).json({
        error: "Session verification error. Please log in again.",
        code: "SESSION_EXPIRED",
      })
    }
  })
}

export function authorizeRoles(...allowedRoles) {
  const flatRoles = allowedRoles.flat().map((r) => normalizeRole(r))

  return (req, res, next) => {
    if (req.method === "OPTIONS") {
      return next()
    }

    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated", code: "UNAUTHORIZED" })
    }

    let userRoles = req.user.roles || (req.user.role ? [req.user.role] : [])
    if (typeof userRoles === "string") {
      try {
        userRoles = JSON.parse(userRoles)
      } catch {
        userRoles = [userRoles]
      }
    }
    if (!Array.isArray(userRoles)) {
      userRoles = [String(userRoles)]
    }
    userRoles = userRoles.map((r) => normalizeRole(r))

    // Superadmin always has universal access across all modules
    if (userRoles.includes("superadmin")) {
      return next()
    }

    const hasAccess = userRoles.some((role) => flatRoles.includes(role))
    if (!hasAccess) {
      return res.status(403).json({
        error: `Access Denied: Role [${userRoles.join(", ")}] does not have required permissions [${flatRoles.join(", ")}].`,
        code: "FORBIDDEN",
      })
    }

    next()
  }
}
