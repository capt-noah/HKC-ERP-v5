import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { drizzleListRows, drizzleGetRow, drizzleCreateRow, drizzleUpdateRow } from "../../db/drizzleCrud.js"
import { getResource } from "../../db/resourceRegistry.js"
import { logActivity } from "../common/activityLogger.js"
import crypto from "node:crypto"

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev_only"

export async function login(req, res) {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" })
  }

  try {
    const resource = getResource("users")
    const result = await drizzleListRows({
      resource,
      query: { username: `eq.${username.trim()}` },
    })

    const rows = result.body || []
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const user = rows[0]
    const passwordHash = user.password_hash || user.passwordHash

    // Check active status
    const isActive = user.status ? user.status === "active" : user.isActive !== false
    if (!isActive) {
      return res.status(403).json({ error: "Your account is deactivated. Please contact the administrator." })
    }

    if (!passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, passwordHash)
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const fullname = user.fullname || [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(" ") || user.username
    const roles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role || "viewer"]
    const primaryRole = roles[0]

    // Generate JWT (30 days expiration)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        roles,
        fullname,
        role: primaryRole,
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    )

    // Log login activity asynchronously
    logActivity(
      user.id,
      user.username,
      fullname,
      "Login",
      "auth",
      { ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1").split(",")[0].trim() }
    ).catch(err => console.error("[AUTH LOGIN LOG ERROR]", err.message))

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

    res.status(200).json({
      id: u.id,
      username: u.username,
      roles,
      role: roles[0],
      fullname,
      first_name: u.first_name || u.firstName,
      last_name: u.last_name || u.lastName,
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
  const { username, password, roles, role, status, fullname, firstName, lastName } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" })
  }

  const assignedRoles = Array.isArray(roles) && roles.length > 0 ? roles : [role || "viewer"]

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
