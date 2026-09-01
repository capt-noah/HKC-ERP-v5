import { Router } from "express"
import { financeService } from "../modules/finance/financeService.js"

export const financeRouter = Router()

financeRouter.post("/payroll-records/:id/pay", async (req, res, next) => {
  try {
    const result = await financeService.payPayrollRecord(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})
