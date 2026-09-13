import jwt from "jsonwebtoken"
import { config } from "../../config.js"
import { pool } from "../../db/client.js"
import { validateSession } from "./sessionService.js"

const JWT_SECRET = config.jwtSecret

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
  return (req, res, next) => {
    if (req.method === "OPTIONS") {
      return next()
    }

    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" })
    }
    
    const userRoles = req.user.roles || (req.user.role ? [req.user.role] : [])

    // Superadmin always has access
    if (userRoles.includes("superadmin")) {
      return next()
    }

    const hasAccess = userRoles.some(role => allowedRoles.includes(role))
    if (!hasAccess) {
      return res.status(403).json({ error: "Insufficient permissions" })
    }

    next()
  }
}
