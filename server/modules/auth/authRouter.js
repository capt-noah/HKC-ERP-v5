import express from "express"
import { login, register, getCurrentUser, updateCurrentUserProfile } from "./authController.js"
import { authenticateToken, authorizeRoles } from "./authMiddleware.js"

const authRouter = express.Router()

authRouter.post("/login", login)
authRouter.get("/me", authenticateToken, getCurrentUser)
authRouter.put("/me", authenticateToken, updateCurrentUserProfile)

// Only superadmins can register new users
authRouter.post("/register", authenticateToken, authorizeRoles("superadmin"), register)

export { authRouter }
