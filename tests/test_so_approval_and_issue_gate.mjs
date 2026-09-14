import mysql from "mysql2/promise"
import { drizzleCreateRow, drizzleGetRow, drizzleDeleteRow, drizzleListRows } from "../server/db/drizzleCrud.js"
import { getResource } from "../server/db/resourceRegistry.js"
import { createSalesIssue } from "../server/modules/sales/salesIssues.js"

async function runTest() {
  console.log("=== STARTING SO APPROVAL & ISSUE GATE TEST ===")

  const testSoId = `TEST-SO-${Date.now()}`

  // 1. Create a Sales Order with Pending status
  const newSoBody = {
    id: testSoId,
    customer: "Test Ethiopian Trader Ltd",
    customerId: "CUST-TEST-001",
    customerPhone: "+251911223344",
    warehouse: "WH2",
    amount: 15000,
    approvalStatus: "Pending",
    paymentType: "Cash",
    items: [
      {
        productId: "PROD-TEST-01",
        name: "Test Oxytetracycline 20%",
        qty: 10,
        unit: "Box",
        unitPrice: 1500,
        total: 15000,
      },
    ],
  }

  const createdSo = await drizzleCreateRow({
    resource: getResource("sales_orders"),
    body: newSoBody,
  })
  console.log("1. Created Sales Order:", createdSo.body.id, "Status:", createdSo.body.approvalStatus)

  // 2. Try creating a Sales Issue linked to this unapproved Sales Order
  console.log("2. Attempting to create Sales Issue against unapproved SO...")
  const issueAttempt = await createSalesIssue({
    sales_order_id: testSoId,
    customer_name: "Test Ethiopian Trader Ltd",
    warehouse_id: "WH2",
    items: [
      {
        product_id: "PROD-TEST-01",
        item_name: "Test Oxytetracycline 20%",
        quantity: 5,
        unit_price: 1500,
      },
    ],
  })

  console.log("Sales Issue creation result status:", issueAttempt.status)
  console.log("Sales Issue creation result body:", issueAttempt.body)

  if (issueAttempt.status === 400 && issueAttempt.body.error.includes("must be approved by a Superadmin")) {
    console.log(" PASS: Unapproved Sales Order correctly rejected with 400!")
  } else {
    console.error(" FAIL: Expected HTTP 400 rejection for unapproved Sales Order!")
    process.exit(1)
  }

  // 3. Simulate Superadmin Approval
  console.log("3. Simulating Superadmin Approval...")
  const approvedSo = {
    ...createdSo.body,
    approvalStatus: "Approved",
    approvedBy: "admin (Super Admin)",
    approvedAt: new Date().toISOString(),
  }

  const { drizzleUpdateRow } = await import("../server/db/drizzleCrud.js")
  await drizzleUpdateRow({
    resource: getResource("sales_orders"),
    id: testSoId,
    body: approvedSo,
  })

  const fetchedAfterApproval = await drizzleGetRow({
    resource: getResource("sales_orders"),
    id: testSoId,
  })
  const soAfter = fetchedAfterApproval.body?.payload ? { ...fetchedAfterApproval.body.payload, ...fetchedAfterApproval.body } : fetchedAfterApproval.body
  console.log("Sales Order status after approval:", soAfter.approvalStatus, "Approved By:", soAfter.approvedBy)

  if (soAfter.approvalStatus !== "Approved") {
    console.error(" FAIL: Sales order was not updated to Approved!")
    process.exit(1)
  }

  // 4. Create Sales Issue against the Approved Sales Order
  console.log("4. Attempting to create Sales Issue against Approved SO...")
  const issueSuccess = await createSalesIssue({
    sales_order_id: testSoId,
    customer_name: "Test Ethiopian Trader Ltd",
    warehouse_id: "WH2",
    items: [
      {
        product_id: "PROD-TEST-01",
        item_name: "Test Oxytetracycline 20%",
        quantity: 5,
        unit_price: 1500,
      },
    ],
  })

  console.log("Sales Issue creation result status:", issueSuccess.status)
  if (issueSuccess.status === 201 || issueSuccess.status === 200) {
    console.log(" PASS: Approved Sales Order successfully allowed Sales Issue creation!")
    await drizzleDeleteRow({ resource: getResource("sales_issues"), id: issueSuccess.body.id }).catch(() => {})
  } else {
    console.error(" FAIL: Expected successful creation of Sales Issue against approved SO:", issueSuccess)
    process.exit(1)
  }

  // 5. Clean up test Sales Order
  await drizzleDeleteRow({ resource: getResource("sales_orders"), id: testSoId })
  console.log("5. Cleaned up test Sales Order.")

  console.log("\n ALL SO APPROVAL & ISSUE GATE TESTS PASSED!")
  process.exit(0)
}

runTest().catch((err) => {
  console.error("Test failed with exception:", err)
  process.exit(1)
})
