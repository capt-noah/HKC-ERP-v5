import { Router } from "express"
import { authenticateToken, normalizeRole } from "../modules/auth/authMiddleware.js"
import { validateRecordDeletable } from "../modules/governance/deletionGuardrails.js"
import {
  createDeletionRequest,
  getDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
} from "../modules/governance/deletionRequestService.js"

export const deletionRouter = Router()

// All deletion routes require authentication
deletionRouter.use(authenticateToken)

// 1. Check eligibility: Returns whether record is permanently blocked, eligible, or has pending request
deletionRouter.get("/check-eligibility", async (req, res, next) => {
  try {
    const { resource, id } = req.query
    if (!resource || !id) {
      return res.status(400).json({ error: "Missing required query params: resource, id" })
    }

    const eligibility = await validateRecordDeletable(resource, id)
    res.json(eligibility)
  } catch (err) {
    next(err)
  }
})

// 2. Submit a Deletion Request (All logged-in staff can submit)
deletionRouter.post("/", async (req, res, next) => {
  try {
    const { resource_type, record_id, record_name, warehouse_id, reason } = req.body
    if (!resource_type || !record_id) {
      return res.status(400).json({ error: "resource_type and record_id are required." })
    }

    const result = await createDeletionRequest({
      resource_type,
      record_id,
      record_name,
      warehouse_id,
      reason,
      user: req.user,
    })

    res.status(201).json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// 3. List Deletion Requests (Superadmin only)
deletionRouter.get("/", async (req, res, next) => {
  try {
    const userRoles = (req.user?.roles || (req.user?.role ? [req.user.role] : [])).map(normalizeRole)
    if (!userRoles.includes("superadmin")) {
      return res.status(403).json({ error: "Superadmin role required to review deletion requests." })
    }

    const requests = await getDeletionRequests(req.query)
    res.json(requests)
  } catch (err) {
    next(err)
  }
})

// 4. Approve Deletion Request & Execute Atomic Delete (Superadmin only)
deletionRouter.post("/:id/approve", async (req, res, next) => {
  try {
    const userRoles = (req.user?.roles || (req.user?.role ? [req.user.role] : [])).map(normalizeRole)
    if (!userRoles.includes("superadmin")) {
      return res.status(403).json({ error: "Superadmin role required to approve deletion requests." })
    }

    const result = await approveDeletionRequest(req.params.id, req.user)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// 5. Reject Deletion Request (Superadmin only)
deletionRouter.post("/:id/reject", async (req, res, next) => {
  try {
    const userRoles = (req.user?.roles || (req.user?.role ? [req.user.role] : [])).map(normalizeRole)
    if (!userRoles.includes("superadmin")) {
      return res.status(403).json({ error: "Superadmin role required to reject deletion requests." })
    }

    const result = await rejectDeletionRequest(req.params.id, req.user, req.body?.reason)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})
