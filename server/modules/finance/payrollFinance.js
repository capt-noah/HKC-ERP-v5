import { getResource } from "../../db/resourceRegistry.js"
import { drizzleUpdateRow } from "../../db/drizzleCrud.js"

export async function payPayrollRecord(id, options = {}) {
  const resource = getResource("payroll_records")
  if (!resource) throw new Error("Resource 'payroll_records' not registered.")

  const updateBody = {
    payment_status: "Paid",
  }
  if (options?.bankAccountCode) {
    updateBody.bank_account = options.bankAccountCode
  }

  const result = await drizzleUpdateRow({ resource, id, body: updateBody })
  if (result.status >= 400) {
    const errorMsg = typeof result.body === "object" && result.body ? (result.body.message || result.body.error || "Failed to update payroll status.") : String(result.body)
    const error = new Error(errorMsg)
    error.status = result.status
    throw error
  }
  return { status: 200, body: result.body }
}
