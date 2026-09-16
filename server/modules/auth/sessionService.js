import crypto from "node:crypto"
import { pool } from "../../db/client.js"

/**
 * Lightweight, zero-dependency User-Agent parser.
 * Extracts operating system, browser, and hardware device type.
 */
export function parseUserAgent(ua = "") {
  const uaString = String(ua || "")
  let osName = "Unknown OS"
  let browserName = "Web Browser"
  let deviceType = "desktop"

  // OS Detection
  if (/iPhone/i.test(uaString)) {
    osName = "iOS"
    deviceType = "mobile"
  } else if (/iPad/i.test(uaString)) {
    osName = "iPadOS"
    deviceType = "tablet"
  } else if (/Macintosh|Mac OS X/i.test(uaString)) {
    osName = "macOS"
    deviceType = "desktop"
  } else if (/Windows NT 10\.0/i.test(uaString)) {
    osName = "Windows 10/11"
    deviceType = "desktop"
  } else if (/Windows NT/i.test(uaString)) {
    osName = "Windows"
    deviceType = "desktop"
  } else if (/Android/i.test(uaString)) {
    osName = "Android"
    deviceType = /Mobile/i.test(uaString) ? "mobile" : "tablet"
  } else if (/Linux/i.test(uaString)) {
    osName = "Linux"
    deviceType = "desktop"
  }

  // Browser Detection
  if (/Edg\//i.test(uaString)) {
    browserName = "Edge"
  } else if (/OPR\/|Opera\//i.test(uaString)) {
    browserName = "Opera"
  } else if (/Chrome\/|CriOS\//i.test(uaString)) {
    browserName = "Chrome"
  } else if (/Firefox\/|FxiOS\//i.test(uaString)) {
    browserName = "Firefox"
  } else if (/Safari\//i.test(uaString) && !/Chrome\/|CriOS\//i.test(uaString)) {
    browserName = "Safari"
  }

  return { osName, browserName, deviceType }
}

/**
 * Extracts and cleans the client IP address from request headers or socket.
 */
export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"]
  let ip = forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress || "127.0.0.1"

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "")
  }
  if (ip === "::1") {
    ip = "127.0.0.1"
  }
  return ip
}

/**
 * Creates a new stateful session record in `user_sessions`.
 * Duration defaults to 6 hours as mandated by client security policy.
 */
export async function createSession({ userId, req, durationHours = 6 }) {
  const sessionId = `sess_${crypto.randomUUID().replace(/-/g, "")}`
  const userAgent = req.headers["user-agent"] || ""
  const { osName, browserName, deviceType } = parseUserAgent(userAgent)
  const ipAddress = getClientIp(req)

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

  try {
    await pool.query(
      `INSERT INTO user_sessions 
        (id, user_id, ip_address, user_agent, device_type, os_name, browser_name, is_revoked, last_active_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), ?, NOW(), NOW())`,
      [sessionId, userId, ipAddress, userAgent, deviceType, osName, browserName, expiresAt]
    )
  } catch (dbErr) {
    if (dbErr.code === "ER_NO_SUCH_TABLE" || dbErr.errno === 1146) {
      console.log("[SESSION SERVICE] `user_sessions` table missing, creating table now...")
      try {
        const { migrateUserSessions } = await import("../../scripts/migrateUserSessions.js")
        await migrateUserSessions()
        // Retry insert after table creation
        await pool.query(
          `INSERT INTO user_sessions 
            (id, user_id, ip_address, user_agent, device_type, os_name, browser_name, is_revoked, last_active_at, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), ?, NOW(), NOW())`,
          [sessionId, userId, ipAddress, userAgent, deviceType, osName, browserName, expiresAt]
        )
      } catch (retryErr) {
        console.warn("[SESSION SERVICE INSERT RETRY FAILED]:", retryErr.message)
      }
    } else {
      console.warn("[SESSION SERVICE INSERT ERROR]:", dbErr.message)
    }
  }

  return {
    id: sessionId,
    expiresAt,
    ipAddress,
    deviceType,
    osName,
    browserName,
  }
}

/**
 * Validates a session by ID against MySQL.
 * Verifies revocation status, expiration, and user account status.
 * Throttles `last_active_at` updates to once per 60 seconds.
 */
export async function validateSession(sessionId) {
  if (!sessionId) {
    return { valid: false, code: "INVALID_SESSION", error: "Session identifier missing" }
  }

  const [rows] = await pool.query(
    `SELECT s.id AS session_id, s.user_id, s.is_revoked, s.expires_at, s.last_active_at,
            u.id, u.username, u.roles, u.role, u.status, u.is_active, u.warehouse_ids, u.warehouse_id
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = ? LIMIT 1`,
    [sessionId]
  )

  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, code: "SESSION_REVOKED", error: "Session does not exist or has been terminated." }
  }

  const row = rows[0]

  if (row.is_revoked === 1 || row.is_revoked === true) {
    return { valid: false, code: "SESSION_REVOKED", error: "This session has been revoked from another device." }
  }

  const expiresAt = new Date(row.expires_at).getTime()
  if (expiresAt <= Date.now()) {
    return { valid: false, code: "SESSION_EXPIRED", error: "Session has expired after 6 hours. Please log in again." }
  }

  // Check user active status
  const isInactive =
    row.status === "suspended" ||
    row.status === "inactive" ||
    row.status === "disabled" ||
    row.status === "deactivated" ||
    row.is_active === 0 ||
    row.is_active === false

  if (isInactive) {
    return { valid: false, code: "ACCOUNT_SUSPENDED", error: "Your user account has been deactivated." }
  }

  // Throttled last_active_at update: only execute update if > 60 seconds have elapsed
  const lastActiveTime = new Date(row.last_active_at).getTime()
  if (Date.now() - lastActiveTime > 60_000) {
    pool.query("UPDATE user_sessions SET last_active_at = NOW() WHERE id = ?", [sessionId]).catch((err) => {
      console.warn("[SESSION ACTIVITY UPDATE WARNING]:", err.message)
    })
  }

  return {
    valid: true,
    user: row,
  }
}

/**
 * Refreshes an active session, extending its `expires_at` by another duration window (default 6 hours).
 * Returns the updated expiration timestamp.
 */
export async function refreshSession(sessionId, userId, durationHours = 6) {
  const [rows] = await pool.query(
    "SELECT id, user_id, is_revoked, expires_at FROM user_sessions WHERE id = ? AND user_id = ? LIMIT 1",
    [sessionId, userId]
  )

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Session not found.")
  }

  const session = rows[0]
  if (session.is_revoked === 1 || session.is_revoked === true) {
    throw new Error("Cannot refresh a revoked session.")
  }

  const newExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

  await pool.query(
    "UPDATE user_sessions SET expires_at = ?, last_active_at = NOW(), updated_at = NOW() WHERE id = ? AND user_id = ?",
    [newExpiresAt, sessionId, userId]
  )

  return {
    sessionId,
    expiresAt: newExpiresAt,
  }
}

/**
 * Returns all active, unrevoked sessions for a given user.
 * Tags the currently active session with `is_current: true`.
 */
export async function getUserActiveSessions(userId, currentSessionId = null) {
  const [rows] = await pool.query(
    `SELECT id, ip_address, device_type, os_name, browser_name, is_revoked, last_active_at, expires_at, created_at
     FROM user_sessions
     WHERE user_id = ? AND is_revoked = 0 AND expires_at > NOW()
     ORDER BY last_active_at DESC`,
    [userId]
  )

  if (!Array.isArray(rows)) return []

  return rows.map((s, idx) => ({
    id: s.id,
    ipAddress: s.ip_address || "127.0.0.1",
    deviceType: s.device_type || "desktop",
    osName: s.os_name || "Unknown OS",
    browserName: s.browser_name || "Web Browser",
    lastActiveAt: s.last_active_at,
    expiresAt: s.expires_at,
    createdAt: s.created_at,
    isCurrent: Boolean(currentSessionId ? s.id === currentSessionId : (idx === 0 && rows.length === 1)),
  }))
}

/**
 * Revokes a specific session belonging to the user.
 */
export async function revokeSession(sessionId, userId) {
  const [result] = await pool.query(
    "UPDATE user_sessions SET is_revoked = 1, updated_at = NOW() WHERE id = ? AND user_id = ?",
    [sessionId, userId]
  )

  return result.affectedRows > 0
}

/**
 * Revokes all sessions belonging to the user EXCEPT the current session.
 */
export async function revokeAllOtherSessions(userId, currentSessionId) {
  let query = "UPDATE user_sessions SET is_revoked = 1, updated_at = NOW() WHERE user_id = ? AND is_revoked = 0"
  const params = [userId]

  if (currentSessionId) {
    query += " AND id != ?"
    params.push(currentSessionId)
  }

  const [result] = await pool.query(query, params)
  return result.affectedRows || 0
}
