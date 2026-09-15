import { drizzleListRows, drizzleGetRow, drizzleCreateRow, drizzleUpdateRow, drizzleDeleteRow } from "./db/drizzleCrud.js"
import { getResource } from "./db/resourceRegistry.js"

process.env.DB_DRIVER = "mysql"
process.env.MYSQL_HOST = "127.0.0.1"
process.env.MYSQL_PORT = "3306"
process.env.MYSQL_USER = "root"
process.env.MYSQL_PASSWORD = ""
process.env.MYSQL_DATABASE = "hkc_erp"

async function runTests() {
  console.log("\n======================================================")
  console.log("🧪 Starting Automated HKC ERP MySQL Verification Tests")
  console.log("======================================================\n")

  let passed = 0
  let failed = 0

  async function assertTest(description, testFn) {
    try {
      process.stdout.write(`• ${description.padEnd(50)} ... `)
      await testFn()
      console.log("✅ PASS")
      passed++
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`)
      failed++
    }
  }

  // Test 1: Users & Auth
  await assertTest("Query users table", async () => {
    const res = await drizzleListRows({ resource: getResource("users") })
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
      throw new Error(`Expected users array, got status ${res.status}`)
    }
    const admin = res.body.find((u) => u.username === "admin" || u.username === "men")
    if (!admin) throw new Error("Expected admin user not found in MySQL")
  })

  // Test 2: Inventory Warehouses
  await assertTest("List warehouses (JSON document)", async () => {
    const res = await drizzleListRows({ resource: getResource("warehouses") })
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length !== 3) {
      throw new Error(`Expected 3 warehouses, got ${res.body?.length}`)
    }
  })

  // Test 3: Inventory Products
  await assertTest("List inventory products (JSON document)", async () => {
    const res = await drizzleListRows({ resource: getResource("inventory_products") })
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length !== 8) {
      throw new Error(`Expected 8 products, got ${res.body?.length}`)
    }
  })

  // Test 4: CRUD Lifecycle (Create, Read, Update, Delete on Document table)
  await assertTest("Document Table CRUD Lifecycle (test item)", async () => {
    const testId = `TEST-PROD-${Date.now()}`
    const resource = getResource("inventory_products")

    // Create
    const createRes = await drizzleCreateRow({
      resource,
      body: { id: testId, name: "MySQL Automated Test Item", category: "Test", price: 99.99 },
    })
    if (createRes.status !== 201 && createRes.status !== 200) {
      throw new Error(`Create failed with status ${createRes.status}`)
    }

    // Read
    const getRes = await drizzleGetRow({ resource, id: testId })
    if (getRes.status !== 200 || getRes.body?.name !== "MySQL Automated Test Item") {
      throw new Error(`Get failed: ${JSON.stringify(getRes.body)}`)
    }

    // Update
    const updateRes = await drizzleUpdateRow({
      resource,
      id: testId,
      body: { price: 149.99, updatedField: true },
    })
    if (updateRes.status !== 200 || updateRes.body?.price !== 149.99) {
      throw new Error(`Update failed: ${JSON.stringify(updateRes.body)}`)
    }

    // Delete
    const deleteRes = await drizzleDeleteRow({ resource, id: testId })
    if (deleteRes.status !== 200) {
      throw new Error(`Delete failed: ${JSON.stringify(deleteRes.body)}`)
    }

    // Verify deletion
    const verifyGet = await drizzleGetRow({ resource, id: testId })
    if (verifyGet.status !== 404) {
      throw new Error(`Expected 404 after delete, got ${verifyGet.status}`)
    }
  })

  // Test 5: Sales Issues (Relational)
  await assertTest("List sales issues (Relational)", async () => {
    const res = await drizzleListRows({ resource: getResource("sales_issues") })
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length < 11) {
      throw new Error(`Expected at least 11 sales issues, got ${res.body?.length}`)
    }
  })

  // Test 6: Customers & Filtering
  await assertTest("List customers and filter by field", async () => {
    const res = await drizzleListRows({
      resource: getResource("customers"),
      query: { category: "eq.Commercial Union" },
    })
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
      throw new Error(`Expected filtered customers, got ${res.body?.length}`)
    }
  })

  // Test 7: Finance Chart of Accounts & Journal Entries
  await assertTest("List chart of accounts & journal entries", async () => {
    const coa = await drizzleListRows({ resource: getResource("chart_of_accounts") })
    const je = await drizzleListRows({ resource: getResource("journal_entries") })
    const lines = await drizzleListRows({ resource: getResource("journal_entry_lines") })

    if (coa.body.length < 50) throw new Error(`COA count low: ${coa.body.length}`)
    if (je.body.length < 32) throw new Error(`Journal entries expected at least 32, got ${je.body.length}`)
    if (lines.body.length < 64) throw new Error(`Journal entry lines expected at least 64, got ${lines.body.length}`)
  })

  // Test 8: HR Employees & Payroll
  await assertTest("List employees, payroll periods, & records", async () => {
    const emp = await drizzleListRows({ resource: getResource("employees") })
    const periods = await drizzleListRows({ resource: getResource("payroll_periods") })
    const records = await drizzleListRows({ resource: getResource("payroll_records") })

    if (emp.body.length < 8) throw new Error(`Employees expected at least 8, got ${emp.body.length}`)
    if (periods.body.length < 2) throw new Error(`Periods expected at least 2, got ${periods.body.length}`)
    if (records.body.length < 12) throw new Error(`Payroll records expected at least 12, got ${records.body.length}`)
  })

  console.log("\n======================================================")
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`)
  console.log("======================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch((err) => {
  console.error("Test execution failed:", err)
  process.exit(1)
})
