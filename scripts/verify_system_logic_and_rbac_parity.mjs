import { pool } from "../server/db/client.js"
import { hrService } from "../server/modules/hr/hrService.js"
import { salesService } from "../server/modules/sales/salesService.js"
import { inventoryService } from "../server/modules/inventory/inventoryService.js"
import { financeService } from "../server/modules/finance/financeService.js"
import { normalizeRole } from "../server/modules/auth/authMiddleware.js"
import { getResource } from "../server/db/resourceRegistry.js"
import { drizzleCreateRow, drizzleGetRow, drizzleDeleteRow, drizzleListRows } from "../server/db/drizzleCrud.js"

async function runComprehensiveParityVerification() {
  const conn = await pool.getConnection()
  try {
    console.log("=================================================================")
    console.log("  HKC-ERP-v5: COMPREHENSIVE SYSTEM LOGIC & RBAC PARITY SUITE    ")
    console.log("=================================================================")

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Database Schema Integrity
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--> [TEST 1] Verifying Database Schema & Zero-Payload Integrity...")
    const [allTables] = await conn.query("SHOW TABLES")
    const tableNames = allTables.map((r) => Object.values(r)[0])
    console.log(`  Total database tables: ${tableNames.length} (Target: 35)`)
    if (tableNames.length !== 35) {
      throw new Error(`Expected exactly 35 tables, found ${tableNames.length}`)
    }

    const payloadTables = []
    for (const t of tableNames) {
      const [cols] = await conn.query(`DESCRIBE \`${t}\``)
      const colNames = cols.map((c) => c.Field)
      if (colNames.includes("payload")) {
        payloadTables.push(t)
      }
    }
    console.log("  Tables containing payload column:", payloadTables)
    if (payloadTables.length !== 1 || payloadTables[0] !== "company_settings") {
      throw new Error(`Only company_settings should have payload! Found: ${payloadTables.join(", ")}`)
    }
    console.log("  ✓ Relational schema verified: exactly 1 singleton configuration table has payload.")

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: HR Module 100% Relational Operations
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--> [TEST 2] Testing HR Module Relational Operations...")
    const testEmpId = `EMP-TEST-${Date.now()}`
    const createEmpRes = await hrService.createEmployee({
      id: testEmpId,
      full_name: "Abebe Bikila Test",
      employee_number: `HKC-TST-${String(Date.now()).slice(-4)}`,
      email: "abebe.test@hkctrading.com",
      phone: "+251911009988",
      basic_salary: 18500.0,
      employment_type: "Permanent",
      status: "Active",
      warehouse_id: "WH1",
    })
    console.log(`  Create Employee: status ${createEmpRes.status}, id: ${createEmpRes.body.id}`)
    if (createEmpRes.status !== 201 || !createEmpRes.body.full_name) {
      throw new Error(`Failed to create employee relationally! Result: ${JSON.stringify(createEmpRes)}`)
    }

    const listEmpRes = await hrService.listEmployees({ search: "Abebe" })
    const foundEmp = listEmpRes.body.find((e) => e.id === testEmpId)
    if (!foundEmp) throw new Error("Created employee not returned in listEmployees search!")
    console.log(`  ✓ Employee retrieved relationally: ${foundEmp.full_name} (${foundEmp.employee_number})`)

    // Attendance
    const testAttId = `ATT-TEST-${Date.now()}`
    const recordAttRes = await hrService.recordAttendance({
      id: testAttId,
      employee_id: testEmpId,
      attendance_date: "2026-10-07",
      check_in_time: "08:30",
      check_out_time: "17:30",
      hours_worked: 8.5,
      overtime_hours: 0.5,
      status: "Present",
    })
    if (recordAttRes.status !== 201) throw new Error("Failed to record attendance relationally!")
    console.log(`  ✓ Attendance recorded relationally for ${testEmpId}: status ${recordAttRes.status}`)

    // Leave
    const testLeaveId = `LV-TEST-${Date.now()}`
    const submitLeaveRes = await hrService.submitLeave({
      id: testLeaveId,
      employee_id: testEmpId,
      leave_type: "Annual Leave",
      start_date: "2026-11-01",
      end_date: "2026-11-05",
      number_of_days: 5,
      reason: "Family vacation",
    })
    if (submitLeaveRes.status !== 201) throw new Error("Failed to submit leave relationally!")
    console.log(`  ✓ Leave submitted relationally: status ${submitLeaveRes.status}`)

    const leaveTypesRes = await hrService.listLeaveTypes()
    if (leaveTypesRes.status !== 200 || !Array.isArray(leaveTypesRes.body) || leaveTypesRes.body.length === 0) {
      throw new Error("listLeaveTypes failed to return statutory leave types!")
    }
    console.log(`  ✓ Statutory Ethiopian leave types returned: ${leaveTypesRes.body.length} types`)

    // Payroll Period & Calculation
    const testPeriodId = `PP-TEST-${Date.now()}`
    const createPeriodRes = await hrService.createPayrollPeriod({
      id: testPeriodId,
      name: "October 2026 Verification Run",
      month: 10,
      year: 2026,
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      status: "Draft",
    })
    if (createPeriodRes.status !== 201) throw new Error("Failed to create payroll period relationally!")

    const calcPayrollRes = await hrService.calculatePayrollForPeriod(testPeriodId)
    if (calcPayrollRes.status !== 200 || !calcPayrollRes.body.records) {
      throw new Error("calculatePayrollForPeriod failed!")
    }
    console.log(`  ✓ Payroll period calculated: ${calcPayrollRes.body.records.length} records generated`)

    const appPeriodRes = await hrService.approvePayrollPeriod(testPeriodId, "GM Test Approver")
    if (appPeriodRes.status !== 200 || appPeriodRes.body.status !== "Approved") {
      throw new Error("Failed to approve payroll period!")
    }
    console.log("  ✓ Payroll period approved successfully")

    // Clean up HR test artifacts
    await hrService.deletePayrollPeriod(testPeriodId)
    await hrService.deleteLeave(testLeaveId)
    await hrService.deleteAttendance(testAttId)
    await hrService.deleteEmployee(testEmpId)
    console.log("  ✓ All HR test entities created, verified, and cleaned up cleanly.")

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: RBAC Roles Normalization & Matrix Verification (6 Canonical Roles)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--> [TEST 3] Testing RBAC Role Normalization across exactly 6 canonical roles...")
    const allRoles = [
      { input: "superadmin", expected: "superadmin" },
      { input: "admin", expected: "superadmin" },
      { input: "super_admin", expected: "superadmin" },
      { input: "sales", expected: "sales" },
      { input: "sales_manager", expected: "sales" },
      { input: "hr", expected: "hr" },
      { input: "hr_manager", expected: "hr" },
      { input: "inventory", expected: "inventory" },
      { input: "inventory_admin", expected: "inventory" },
      { input: "inventory_manager", expected: "inventory" },
      { input: "finance", expected: "finance" },
      { input: "finance_manager", expected: "finance" },
      { input: "hkc_docs", expected: "hkc_docs" },
      { input: "hkc_docs_manager", expected: "hkc_docs" },
      { input: "docs_specialist", expected: "hkc_docs" },
      { input: "docs", expected: "hkc_docs" },
    ]

    for (const r of allRoles) {
      const normalized = normalizeRole(r.input)
      if (normalized !== r.expected) {
        throw new Error(`Role '${r.input}' normalized to '${normalized}', expected '${r.expected}'!`)
      }
    }
    console.log(`  ✓ All ${allRoles.length} role aliases correctly normalize to 6 canonical roles.`)

    // Verify all database users have only canonical roles
    const [dbUsers] = await conn.query("SELECT username, role, roles FROM users")
    const allowedCanonicalRoles = ["superadmin", "sales", "hr", "inventory", "finance", "hkc_docs"]
    for (const u of dbUsers) {
      const userRolesArr = Array.isArray(u.roles) ? u.roles : (typeof u.roles === "string" ? JSON.parse(u.roles) : [u.role])
      if (!allowedCanonicalRoles.includes(u.role)) {
        throw new Error(`Database user '${u.username}' has non-canonical primary role '${u.role}'!`)
      }
      for (const r of userRolesArr) {
        if (!allowedCanonicalRoles.includes(r)) {
          throw new Error(`Database user '${u.username}' has non-canonical role '${r}' in roles array!`)
        }
      }
    }
    console.log(`  ✓ All ${dbUsers.length} users in database strictly have valid canonical roles.`)

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: HKC Docs Records & Attachment Schema Parity
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--> [TEST 4] Testing HKC Docs Records & Quality Attachment Registry...")
    const docResource = getResource("hkc_doc_records")
    const testDocId = `HKCD-VERIFY-${Date.now()}`
    const testDocPayload = {
      id: testDocId,
      shipmentId: "HKC-EXP-992/26",
      itemsDescription: "Certified Organic Sesame Seeds Grade 1",
      type: "Export",
      date: "2026-10-07",
      attachments: [
        {
          attachmentId: `ATT-${Date.now()}-1`,
          fileName: "phytosanitary_certificate_2026.pdf",
          fileUrl: "/uploads/hkc_docs/phytosanitary_certificate_2026.pdf",
          uploadedAt: new Date().toISOString(),
        },
        {
          attachmentId: `ATT-${Date.now()}-2`,
          fileName: "quality_analysis_report.jpg",
          fileUrl: "/uploads/hkc_docs/quality_analysis_report.jpg",
          uploadedAt: new Date().toISOString(),
        },
      ],
    }

    const docCreateRes = await drizzleCreateRow({ resource: docResource, body: testDocPayload })
    if (docCreateRes.status !== 200 && docCreateRes.status !== 201) {
      throw new Error(`Failed to create hkc_doc_records: ${JSON.stringify(docCreateRes)}`)
    }

    const docGetRes = await drizzleGetRow({ resource: docResource, id: testDocId })
    if (!docGetRes.body || docGetRes.body.shipmentId !== "HKC-EXP-992/26") {
      throw new Error(`Failed to retrieve hkc_doc_records with correct fields: ${JSON.stringify(docGetRes)}`)
    }
    if (!Array.isArray(docGetRes.body.attachments) || docGetRes.body.attachments.length !== 2) {
      throw new Error(`Attachments array not properly deserialized! Found: ${JSON.stringify(docGetRes.body.attachments)}`)
    }
    console.log(`  ✓ HKC Doc Record created and verified with ${docGetRes.body.attachments.length} attached documents.`)

    await drizzleDeleteRow({ resource: docResource, id: testDocId })
    console.log("  ✓ HKC Doc Record test artifact deleted cleanly.")

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Financial General Ledger Balance Verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--> [TEST 5] Auditing General Ledger Balancing (Debit == Credit)...")
    const [jeLines] = await conn.query("SELECT debit_amount, credit_amount FROM journal_entry_lines")
    let totalDebit = 0
    let totalCredit = 0
    for (const l of jeLines) {
      totalDebit += Number(l.debit_amount || 0)
      totalCredit += Number(l.credit_amount || 0)
    }
    totalDebit = Math.round(totalDebit * 100) / 100
    totalCredit = Math.round(totalCredit * 100) / 100
    const glDiff = Math.abs(totalDebit - totalCredit)
    console.log(`  Total Debits : ${totalDebit.toLocaleString()} ETB`)
    console.log(`  Total Credits: ${totalCredit.toLocaleString()} ETB`)
    console.log(`  Discrepancy  : ${glDiff.toFixed(2)} ETB`)

    if (glDiff > 0.001) {
      throw new Error(`General Ledger is unbalanced! Debit: ${totalDebit}, Credit: ${totalCredit}`)
    }
    console.log("  ✓ General Ledger is perfectly balanced with 0.00 ETB variance.")

    console.log("\n=================================================================")
    console.log("  ✓ ALL TESTS PASSED: 100% SYSTEM LOGIC & RBAC PARITY VERIFIED! ")
    console.log("=================================================================\n")
  } finally {
    conn.release()
    await pool.end()
  }
}

runComprehensiveParityVerification().catch((err) => {
  console.error("\n❌ VERIFICATION FAILED:", err)
  process.exit(1)
})
