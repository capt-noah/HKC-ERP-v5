import { payPayrollRecord } from "./payrollFinance.js"
import { syncInvoiceGLDistribution, saveBeginningBalances } from "./financeGlSync.js"

export const financeService = {
  payPayrollRecord,
  syncInvoiceGLDistribution,
  saveBeginningBalances,
}
