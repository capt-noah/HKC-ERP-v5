import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev_only"

export function authenticateToken(req, res, next) {
  if (req.method === "OPTIONS") {
    return next()
  }

  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token missing", code: "TOKEN_EXPIRED" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: "Invalid or expired token", code: "TOKEN_EXPIRED" })
    }
    req.user = user
    next()
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
