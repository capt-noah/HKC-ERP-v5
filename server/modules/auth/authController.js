import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import crypto from "node:crypto"
import { drizzleListRows, drizzleGetRow, drizzleCreateRow, drizzleUpdateRow } from "../../db/drizzleCrud.js"
import { getResource } from "../../db/resourceRegistry.js"
import { logActivity } from "../common/activityLogger.js"
import { config } from "../../config.js"

const JWT_SECRET = config.jwtSecret

export async function ensureSuperAdmin() {
  try {
    const resource = getResource("users")
    const listRes = await drizzleListRows({ resource })
    const allUsers = Array.isArray(listRes.body) ? listRes.body : []
    const adminExists = allUsers.some((u) => (u.username || "").toLowerCase() === "admin")
    if (!adminExists) {
      const password_hash = await bcrypt.hash("SuperadminPassword1!", 10)
      await drizzleCreateRow({
        resource,
        body: {
          id: "USR-SUPERADMIN-01",
          username: "admin",
          password_hash,
          role: "superadmin",
          roles: ["superadmin"],
          first_name: "Super",
          last_name: "Admin",
          fullname: "Super Administrator",
          is_active: true,
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
      console.log("[AUTH AUTO-BOOTSTRAP] Superadmin account seeded: admin / SuperadminPassword1!")
    }
  } catch (err) {
    console.warn("[AUTH AUTO-BOOTSTRAP WARNING]:", err.message)
  }
}

import { pool } from "../../db/client.js"

export async function login(req, res) {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" })
  }

  const cleanUsername = String(username).trim()

  try {
    // 1. Direct MySQL query for zero-friction lookup from imported SQL dump
    const [userRows] = await pool.query(
      "SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?) LIMIT 1",
      [cleanUsername]
    )

    let user = Array.isArray(userRows) && userRows.length > 0 ? userRows[0] : null

    // 2. Fallback search by employee_id or ID if username wasn't an exact match
    if (!user) {
      const [altRows] = await pool.query(
        "SELECT * FROM users WHERE LOWER(TRIM(id)) = LOWER(?) OR LOWER(TRIM(employee_id)) = LOWER(?) LIMIT 1",
        [cleanUsername, cleanUsername]
      )
      if (Array.isArray(altRows) && altRows.length > 0) {
        user = altRows[0]
      }
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials (user not found)" })
    }

    const passwordHash = user.password_hash || user.passwordHash || user.password

    if (!passwordHash) {
      return res.status(401).json({ error: "Invalid credentials (account has no password set)" })
    }

    // Check active status (handles active/inactive, is_active = 1/0)
    const isInactive =
      user.status === "inactive" ||
      user.status === "disabled" ||
      user.status === "deactivated" ||
      user.is_active === 0 ||
      user.is_active === false ||
      user.isActive === false
    if (isInactive) {
      return res.status(403).json({ error: "Your account is deactivated. Please contact the administrator." })
    }

    // Verify password with bcryptjs OR raw equality (if plain text was in dump)
    let isMatch = false
    try {
      if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$") || passwordHash.startsWith("$2y$")) {
        isMatch = await bcrypt.compare(password, passwordHash)
      } else {
        isMatch = (password === passwordHash)
      }
    } catch {
      isMatch = (password === passwordHash)
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials (password incorrect)" })
    }

    const fullname =
      user.fullname ||
      [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(" ") ||
      user.username

    let roles = user.roles
    if (typeof roles === "string") {
      try {
        roles = JSON.parse(roles)
      } catch {
        roles = [user.role || "viewer"]
      }
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      roles = [user.role || "viewer"]
    }
    const primaryRole = roles[0]

    let warehouseIds = user.warehouse_ids || user.warehouseIds
    if (typeof warehouseIds === "string") {
      try {
        warehouseIds = JSON.parse(warehouseIds)
      } catch {
        warehouseIds = warehouseIds ? [warehouseIds] : []
      }
    }
    if (!Array.isArray(warehouseIds)) {
      warehouseIds = user.warehouse_id ? [user.warehouse_id] : []
    }

    // Generate JWT (30 days expiration)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        roles,
        fullname,
        role: primaryRole,
        warehouse_ids: warehouseIds,
        warehouse_id: warehouseIds[0] || user.warehouse_id || null,
        employee_id: user.employee_id || null,
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    )

    // Log login activity asynchronously
    try {
      await pool.query(
        "INSERT INTO user_activity_logs (id, user_id, username, fullname, action, module, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          user.id,
          user.username,
          fullname,
          "Login",
          "auth",
          JSON.stringify({ ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1").split(",")[0].trim() }),
        ]
      )
    } catch (logErr) {
      console.warn("[LOGIN LOG WARNING]:", logErr.message)
    }

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        roles,
        role: primaryRole,
        fullname,
        first_name: user.first_name || user.firstName,
        last_name: user.last_name || user.lastName,
        warehouse_ids: warehouseIds,
        warehouse_id: warehouseIds[0] || user.warehouse_id || null,
        employee_id: user.employee_id || null,
      },
    })
  } catch (error) {
    console.error("Auth login controller error:", error)
    res.status(500).json({ error: "Internal server error", details: error.message })
  }
}

export async function getCurrentUser(req, res) {
  try {
    const userId = req.user.id
    const resource = getResource("users")
    const result = await drizzleGetRow({ resource, id: userId })

    if (result.status !== 200 || !result.body) {
      return res.status(404).json({ error: "User not found" })
    }

    const u = result.body
    const fullname = u.fullname || [u.first_name || u.firstName, u.last_name || u.lastName].filter(Boolean).join(" ") || u.username
    const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || "viewer"]

    let warehouseIds = u.warehouse_ids || u.warehouseIds
    if (typeof warehouseIds === "string") {
      try {
        warehouseIds = JSON.parse(warehouseIds)
      } catch {
        warehouseIds = warehouseIds ? [warehouseIds] : []
      }
    }
    if (!Array.isArray(warehouseIds)) {
      warehouseIds = u.warehouse_id ? [u.warehouse_id] : []
    }

    res.status(200).json({
      id: u.id,
      username: u.username,
      roles,
      role: roles[0],
      fullname,
      first_name: u.first_name || u.firstName,
      last_name: u.last_name || u.lastName,
      warehouse_ids: warehouseIds,
      warehouse_id: warehouseIds[0] || u.warehouse_id || null,
      employee_id: u.employee_id || null,
      status: u.status || (u.isActive ? "active" : "inactive"),
      created_at: u.created_at || u.createdAt,
      updated_at: u.updated_at || u.updatedAt,
    })
  } catch (error) {
    console.error("getCurrentUser error:", error)
    res.status(500).json({ error: "Internal server error", details: error.message })
  }
}

export async function updateCurrentUserProfile(req, res) {
  try {
    const userId = req.user.id
    const { fullname, firstName, lastName, password } = req.body
    const resource = getResource("users")

    const updateBody = {
      updated_at: new Date().toISOString(),
    }

    if (firstName !== undefined) updateBody.first_name = firstName
    if (lastName !== undefined) updateBody.last_name = lastName
    if (fullname) {
      updateBody.fullname = fullname
      if (!firstName && !lastName) {
        const parts = fullname.split(" ")
        updateBody.first_name = parts[0] || ""
        updateBody.last_name = parts.slice(1).join(" ") || ""
      }
    }
    if (password) {
      updateBody.password_hash = await bcrypt.hash(password, 10)
    }

    const result = await drizzleUpdateRow({ resource, id: userId, body: updateBody })
    if (result.status !== 200) {
      return res.status(result.status || 500).json(result.body || { error: "Failed to update profile" })
    }

    res.status(200).json({ message: "Profile updated successfully", user: result.body })
  } catch (error) {
    console.error("updateCurrentUserProfile error:", error)
    res.status(500).json({ error: "Internal server error", details: error.message })
  }
}

export async function register(req, res) {
  const { username, password, roles, role, status, fullname, firstName, lastName, warehouse_ids, warehouse_id, employee_id } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" })
  }

  const assignedRoles = Array.isArray(roles) && roles.length > 0 ? roles : [role || "viewer"]
  let assignedWarehouseIds = Array.isArray(warehouse_ids) ? warehouse_ids : warehouse_id ? [warehouse_id] : []

  try {
    const resource = getResource("users")
    const password_hash = await bcrypt.hash(password, 10)
    const id = `USR-${crypto.randomUUID().slice(0, 8)}`

    let fName = firstName || ""
    let lName = lastName || ""
    let fNameFull = fullname || ""
    if (fNameFull && !fName && !lName) {
      const parts = fNameFull.split(" ")
      fName = parts[0] || ""
      lName = parts.slice(1).join(" ") || ""
    } else if (!fNameFull && (fName || lName)) {
      fNameFull = [fName, lName].filter(Boolean).join(" ")
    }

    const result = await drizzleCreateRow({
      resource,
      body: {
        id,
        username: username.trim(),
        password_hash,
        role: assignedRoles[0],
        roles: assignedRoles,
        fullname: fNameFull || username,
        first_name: fName,
        last_name: lName,
        employee_id: employee_id || null,
        warehouse_ids: assignedWarehouseIds,
        warehouse_id: assignedWarehouseIds[0] || null,
        status: status || "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })

    if (result.status !== 200 && result.status !== 201) {
      return res.status(result.status || 500).json(result.body || { error: "Failed to create user" })
    }

    res.status(201).json({ message: "User created successfully", id })
  } catch (error) {
    console.error("Register error:", error)
    res.status(500).json({ error: "Internal server error", details: error.message })
  }
}
