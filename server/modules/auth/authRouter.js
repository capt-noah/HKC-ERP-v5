import express from "express"
import {
  login,
  register,
  getCurrentUser,
  updateCurrentUserProfile,
  changePassword,
  recoverSuperadminPassword,
  refreshUserSession,
  listUserSessions,
  revokeUserSession,
  revokeOtherUserSessions,
  checkSessionStatus,
  setTestSessionExpiry,
} from "./authController.js"
import { authenticateToken, authorizeRoles } from "./authMiddleware.js"

const authRouter = express.Router()

authRouter.post("/login", login)
authRouter.post("/recover-superadmin", recoverSuperadminPassword)
authRouter.get("/me", authenticateToken, getCurrentUser)
authRouter.put("/me", authenticateToken, updateCurrentUserProfile)
authRouter.post("/change-password", authenticateToken, changePassword)

// Session Management & Heartbeat Extension Endpoints
authRouter.get("/session-status", authenticateToken, checkSessionStatus)
authRouter.get("/session/status", authenticateToken, checkSessionStatus)
authRouter.post("/refresh-session", authenticateToken, refreshUserSession)
authRouter.post("/session/refresh", authenticateToken, refreshUserSession)
authRouter.get("/sessions", authenticateToken, listUserSessions)
authRouter.delete("/sessions/:id", authenticateToken, revokeUserSession)
authRouter.post("/sessions/revoke-others", authenticateToken, revokeOtherUserSessions)
authRouter.post("/test-set-expiry", authenticateToken, setTestSessionExpiry)

// Only superadmins can register new users
authRouter.post("/register", authenticateToken, authorizeRoles("superadmin"), register)

export { authRouter }

