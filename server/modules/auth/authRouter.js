import express from "express"
import { login, register, getCurrentUser, updateCurrentUserProfile, changePassword, recoverSuperadminPassword } from "./authController.js"
import { authenticateToken, authorizeRoles } from "./authMiddleware.js"

const authRouter = express.Router()

authRouter.post("/login", login)
authRouter.post("/recover-superadmin", recoverSuperadminPassword)
authRouter.get("/me", authenticateToken, getCurrentUser)
authRouter.put("/me", authenticateToken, updateCurrentUserProfile)
authRouter.post("/change-password", authenticateToken, changePassword)

// Only superadmins can register new users
authRouter.post("/register", authenticateToken, authorizeRoles("superadmin"), register)

export { authRouter }
