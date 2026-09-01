import { Router } from "express"
import { listResources } from "../db/resourceRegistry.js"
import { crudRouter } from "./crudRouter.js"
import { financeRouter } from "./financeRouter.js"
import { salesRouter } from "./salesRouter.js"
import { authRouter } from "../modules/auth/authRouter.js"
import { authenticateToken, authorizeRoles } from "../modules/auth/authMiddleware.js"
import { activityLoggerMiddleware } from "../modules/common/activityLogger.js"

export const masterRouter = Router()

// Health check endpoints (open for diagnostics)
masterRouter.get(["/health", "/api/health"], (_req, res) => {
  res.json({ ok: true, status: "healthy", service: "hkc-erp-server", timestamp: new Date().toISOString() })
})

// Auth routes (unprotected for login)
masterRouter.use("/api/auth", authRouter)

// Protect all other /api routes
masterRouter.use("/api", authenticateToken)

// Track user activity on mutations
masterRouter.use("/api", activityLoggerMiddleware)

// Restrict users management endpoint to superadmin only
masterRouter.use("/api/users", authorizeRoles("superadmin"))
masterRouter.use("/api/user_activity_logs", authorizeRoles("superadmin"))

// Resource registry endpoint
masterRouter.get("/api", (_req, res) => {
  res.json({ service: "HKC ERP API", resources: listResources() })
})

// Domain routers (Order matters: specific domain routes before generic /api/:resource fallback)
masterRouter.use("/api", salesRouter)
masterRouter.use("/api", financeRouter)
masterRouter.use("/api", crudRouter)

// Catch-all 404 for unmatched /api routes only
masterRouter.use("/api", (_req, res) => {
  res.status(404).json({
    error: "Not found",
    hint: "Use /api for the resource registry or /api/:resource for table routes.",
  })
})
