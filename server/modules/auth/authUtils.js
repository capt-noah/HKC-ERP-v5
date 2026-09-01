/**
 * Password validation rules:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validateStrongPassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." }
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." }
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character." }
  }
  return { valid: true }
}

/**
 * Sanitizes user object to remove sensitive password_hash before returning to client.
 */
export function sanitizeUser(user) {
  if (!user || typeof user !== "object") return user
  const { password_hash, passwordHash, ...safeUser } = user

  // Ensure roles is parsed properly if stored as JSON string
  if (typeof safeUser.roles === "string") {
    try {
      safeUser.roles = JSON.parse(safeUser.roles)
    } catch {
      safeUser.roles = [safeUser.role || "viewer"]
    }
  }
  if (typeof safeUser.warehouse_ids === "string") {
    try {
      safeUser.warehouse_ids = JSON.parse(safeUser.warehouse_ids)
    } catch {
      safeUser.warehouse_ids = []
    }
  }

  return safeUser
}
