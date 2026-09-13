import jwt from "jsonwebtoken"
import { config } from "../../config.js"
import { pool } from "../../db/client.js"

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
      // Real-time verification: check if user still exists in database and is active
      const [userRows] = await pool.query(
        "SELECT id, username, roles, role, status, is_active FROM `users` WHERE id = ? OR LOWER(TRIM(username)) = LOWER(?) LIMIT 1",
        [decodedUser.id, decodedUser.username]
      )

      const dbUser = Array.isArray(userRows) && userRows.length > 0 ? userRows[0] : null
      if (!dbUser) {
        return res.status(401).json({
          error: "Your user account has been deleted. Session terminated.",
          code: "ACCOUNT_DELETED",
        })
      }

      const isInactive =
        dbUser.status === "suspended" ||
        dbUser.status === "inactive" ||
        dbUser.status === "disabled" ||
        dbUser.status === "deactivated" ||
        dbUser.is_active === 0 ||
        dbUser.is_active === false

      if (isInactive) {
        return res.status(403).json({
          error: "Your user account has been deactivated. Session terminated.",
          code: "ACCOUNT_SUSPENDED",
        })
      }

      req.user = decodedUser
      next()
    } catch (dbErr) {
      console.warn("[AUTH TOKEN DB CHECK WARNING]:", dbErr.message)
      req.user = decodedUser
      next()
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
