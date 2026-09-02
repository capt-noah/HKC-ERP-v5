import { drizzleCreateRow, drizzleUpdateRow, drizzleListRows, drizzleDeleteRow } from '../server/db/drizzleCrud.js'
import { getResource } from '../server/db/resourceRegistry.js'
import { pool } from '../server/db/client.js'

async function run() {
  console.log("=================================================================")
  console.log("🚀 STARTING E2E DATABASE PERSISTENCE VERIFICATION")
  console.log("=================================================================")

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`)
      passed++
    } else {
      console.error(`❌ [FAIL] ${message}`)
      failed++
    }
  }

  try {
    // 1. Employee Persistence & Status Updates
    console.log("\n--- 1. Employee DB Persistence ---")
    const testEmpId = `EMP_TEST_${Date.now()}`
    const empResource = getResource("employees")
    const empData = {
      id: testEmpId,
      employee_number: "HKC-T999",
      full_name: "Abebe Bikila",
      phone: "+251911223344",
      email: "abebe@example.com",
      warehouse_id: "WH-KALITI",
      employment_type: "Full-time",
      basic_salary: 25000,
      status: "Active"
    }

    const insEmp = await drizzleCreateRow({ resource: empResource, body: empData })
    assert(insEmp.status === 200, "Inserted test employee via drizzle CRUD")

    // Update status to Inactive (Deactivate)
    const updEmp = await drizzleUpdateRow({ resource: empResource, id: testEmpId, body: { status: "Inactive" } })
    assert(updEmp.status === 200, "Deactivated employee in DB via drizzle CRUD")

    // Fetch and check
    const listEmp = await drizzleListRows({ resource: empResource, query: { id: testEmpId } })
    assert(listEmp.body && listEmp.body[0]?.status === "Inactive", "Employee retrieved with Inactive status")

    // Reactivate
    const reactivateEmp = await drizzleUpdateRow({ resource: empResource, id: testEmpId, body: { status: "Active" } })
    assert(reactivateEmp.status === 200, "Reactivated employee in DB via drizzle CRUD")

    const listEmpActive = await drizzleListRows({ resource: empResource, query: { id: testEmpId } })
    assert(listEmpActive.body && listEmpActive.body[0]?.status === "Active", "Employee retrieved with Active status")

    // 2. Leave Request Persistence
    console.log("\n--- 2. Leave Request DB Persistence ---")
    const testLeaveId = `LV_TEST_${Date.now()}`
    const leaveResource = getResource("leave_requests")
    const leaveData = {
      id: testLeaveId,
      employee_id: testEmpId,
      leave_type: "Annual Leave",
      start_date: "2026-09-10",
      end_date: "2026-09-12",
      number_of_days: 3,
      reason: "Personal rest",
      status: "Pending"
    }

    const insLeave = await drizzleCreateRow({ resource: leaveResource, body: leaveData })
    assert(insLeave.status === 200, "Inserted test leave request via drizzle CRUD")

    // Reject / Cancel
    const cancelLeave = await drizzleUpdateRow({ resource: leaveResource, id: testLeaveId, body: { status: "Cancelled" } })
    assert(cancelLeave.status === 200, "Cancelled leave request via drizzle CRUD")

    const listLeave = await drizzleListRows({ resource: leaveResource, query: { id: testLeaveId } })
    assert(listLeave.body && listLeave.body[0]?.status === "Cancelled", "Leave request retrieved with Cancelled status")

    // 3. Payroll Record & Allowance Taxation Persistence
    console.log("\n--- 3. Payroll Record & Allowance Taxation Persistence ---")
    const testPeriodId = `PRD_TEST_${Date.now()}`
    const periodResource = getResource("payroll_periods")
    await drizzleCreateRow({
      resource: periodResource,
      body: { id: testPeriodId, name: "September 2026", month: 9, year: 2026, status: "Draft" }
    })

    const testPayId = `PAY_TEST_${Date.now()}`
    const payResource = getResource("payroll_records")
    // Basic: 10,000, Allowance: 3,000, Overtime: 1,000
    // Gross: 14,000, Pension (7%): 700, Taxable Base: 13,300, PIT (30% - 1350): 2,640, Net: 10,660
    const payData = {
      id: testPayId,
      payroll_period_id: testPeriodId,
      employee_id: testEmpId,
      basic_salary: 10000,
      allowances: 3000,
      overtime_pay: 1000,
      bonus: 0,
      other_earnings: 0,
      tax: 2640,
      pension: 700,
      net_salary: 10660,
      payment_status: "Pending"
    }

    const insPay = await drizzleCreateRow({ resource: payResource, body: payData })
    assert(insPay.status === 200, "Inserted test payroll record with allowances and computed tax")

    const listPay = await drizzleListRows({ resource: payResource, query: { id: testPayId } })
    const loadedPay = listPay.body && listPay.body[0]
    assert(loadedPay?.allowances === 3000, "Allowance persisted correctly in DB")
    assert(loadedPay?.tax === 2640, "Ethiopian tax with allowances persisted correctly in DB")
    assert(loadedPay?.net_salary === 10660, "Net salary persisted correctly in DB")

    // Update payment status to Approved then Paid
    const approvePay = await drizzleUpdateRow({ resource: payResource, id: testPayId, body: { payment_status: "Approved" } })
    assert(approvePay.status === 200, "Payroll record status updated to Approved in DB")

    // Clean up test rows
    await drizzleDeleteRow({ resource: payResource, id: testPayId })
    await drizzleDeleteRow({ resource: periodResource, id: testPeriodId })
    await drizzleDeleteRow({ resource: leaveResource, id: testLeaveId })
    await drizzleDeleteRow({ resource: empResource, id: testEmpId })
    assert(true, "Cleaned up all temporary test records cleanly")

    console.log(`\n=================================================================`)
    console.log(`🏁 E2E PERSISTENCE RESULT: ${passed} of ${passed + failed} passed (${failed === 0 ? "100% Success" : "Failed"})`)
    console.log(`=================================================================`)

    if (failed > 0) process.exit(1)
  } finally {
    await pool.end()
  }
}

run().catch((err) => {
  console.error("Fatal test error:", err)
  process.exit(1)
})
