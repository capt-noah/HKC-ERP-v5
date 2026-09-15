import { Router } from "express"
import { financeService } from "../modules/finance/financeService.js"
import { authorizeRoles } from "../modules/auth/authMiddleware.js"

export const financeRouter = Router()

financeRouter.post(
  "/payroll-records/:id/pay",
  authorizeRoles("superadmin", "finance_manager"),
  async (req, res, next) => {
    try {
      const result = await financeService.payPayrollRecord(req.params.id)
      res.status(result.status).json(result.body)
    } catch (err) {
      next(err)
    }
  }
)
