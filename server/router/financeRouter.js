import { Router } from "express"
import { financeService } from "../modules/finance/financeService.js"
import { authorizeRoles } from "../modules/auth/authMiddleware.js"

export const financeRouter = Router()

financeRouter.post(
  "/payroll-records/:id/pay",
  authorizeRoles("superadmin", "finance"),
  async (req, res, next) => {
    try {
      const result = await financeService.payPayrollRecord(req.params.id)
      res.status(result.status).json(result.body)
    } catch (err) {
      next(err)
    }
  }
)

financeRouter.post(
  ["/finance/invoices/:id/gl-distribution", "/invoices/:id/gl-distribution"],
  authorizeRoles("superadmin", "finance", "admin"),
  async (req, res, next) => {
    try {
      const result = await financeService.syncInvoiceGLDistribution(req.params.id, req.body)
      res.status(result.status).json(result.body)
    } catch (err) {
      next(err)
    }
  }
)

financeRouter.post(
  ["/finance/beginning-balances", "/beginning-balances"],
  authorizeRoles("superadmin", "finance", "admin"),
  async (req, res, next) => {
    try {
      const result = await financeService.saveBeginningBalances(req.body)
      res.status(result.status).json(result.body)
    } catch (err) {
      next(err)
    }
  }
)

