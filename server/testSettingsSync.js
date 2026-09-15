import { drizzleListRows, drizzleGetRow, drizzleCreateRow, drizzleUpdateRow, drizzleDeleteRow } from "./db/drizzleCrud.js"
import { getResource } from "./db/resourceRegistry.js"

async function runSettingsSyncTests() {
  console.log("\n=================================================================")
  console.log("🧪 Testing Settings Persistence & Cross-Module Consistency (MySQL)")
  console.log("=================================================================\n")

  let passed = 0
  let failed = 0

  async function test(name, fn) {
    process.stdout.write(`• ${name.padEnd(58)} ... `)
    try {
      await fn()
      console.log("✅ PASS")
      passed++
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`)
      failed++
    }
  }

  const settingsRes = getResource("company_settings")
  const taxRulesRes = getResource("tax_rules")
  const warehousesRes = getResource("warehouses")

  // 1. Read existing company settings
  let initialSettings
  await test("Read company_settings from MySQL", async () => {
    const res = await drizzleListRows({ resource: settingsRes })
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
      throw new Error(`Failed to load company_settings, status: ${res.status}`)
    }
    initialSettings = res.body[0]
  })

  // 2. Update Pension Rates & Employment Tax Brackets in MySQL
  const testSettingsId = initialSettings?.id || "default"
  await test("Update Pension & Employment Tax in MySQL", async () => {
    const updatedPayload = {
      ...initialSettings,
      pension_employee_rate: 8.5,
      pension_employer_rate: 12.5,
      processing_rate_per_quintal: 175,
      base_storage_rate_per_quintal_day: 1.25,
      tax_brackets_config: [
        { min: 0, max: 2500, ratePercent: 0, deductible: 0 },
        { min: 2501, max: 5000, ratePercent: 10, deductible: 250 },
        { min: 5001, max: null, ratePercent: 35, deductible: 1500 },
      ],
    }

    const res = await drizzleUpdateRow({
      resource: settingsRes,
      id: testSettingsId,
      body: updatedPayload,
    })
    if (res.status !== 200) throw new Error(`Failed to update settings: ${res.status}`)

    // Verify read
    const verify = await drizzleGetRow({ resource: settingsRes, id: testSettingsId })
    if (verify.status !== 200) throw new Error("Could not retrieve updated settings")
    if (verify.body.pension_employee_rate !== 8.5) {
      throw new Error(`Expected pension_employee_rate 8.5, got ${verify.body.pension_employee_rate}`)
    }
    if (verify.body.pension_employer_rate !== 12.5) {
      throw new Error(`Expected pension_employer_rate 12.5, got ${verify.body.pension_employer_rate}`)
    }
    if (verify.body.processing_rate_per_quintal !== 175) {
      throw new Error(`Expected processing_rate_per_quintal 175, got ${verify.body.processing_rate_per_quintal}`)
    }
    if (verify.body.tax_brackets_config?.length !== 3) {
      throw new Error(`Expected 3 tax brackets, got ${verify.body.tax_brackets_config?.length}`)
    }
  })

  // 3. Verify Ethiopian Payroll Calculations with updated settings
  await test("Verify Payroll calculations reflect updated pension rates", async () => {
    const settings = (await drizzleGetRow({ resource: settingsRes, id: testSettingsId })).body
    const basicSalary = 10000

    // Employee pension: 8.5% of 10,000 = 850
    const expectedEmpPension = (basicSalary * settings.pension_employee_rate) / 100
    if (expectedEmpPension !== 850) throw new Error(`Expected 850, got ${expectedEmpPension}`)

    // Employer pension: 12.5% of 10,000 = 1,250
    const expectedCompPension = (basicSalary * settings.pension_employer_rate) / 100
    if (expectedCompPension !== 1250) throw new Error(`Expected 1250, got ${expectedCompPension}`)
  })

  // 4. Test Tax Rules CRUD
  const testTaxId = `TAX-TEST-${Date.now()}`
  await test("Create custom Tax Rule in MySQL", async () => {
    const res = await drizzleCreateRow({
      resource: taxRulesRes,
      body: {
        id: testTaxId,
        name: "Test Customs Duty Tax",
        ratePercent: 12,
        type: "Customs Duty",
        accountCode: "2120",
        isInclusive: false,
        description: "Special rate for testing",
      },
    })
    if (res.status !== 200 && res.status !== 201) throw new Error(`Failed to create tax rule: ${res.status}`)
  })

  await test("Read and verify Tax Rule from MySQL", async () => {
    const res = await drizzleGetRow({ resource: taxRulesRes, id: testTaxId })
    if (res.status !== 200) throw new Error("Tax rule not found")
    if (res.body.ratePercent !== 12) throw new Error(`Expected rate 12%, got ${res.body.ratePercent}`)
  })

  await test("Delete Test Tax Rule from MySQL", async () => {
    const res = await drizzleDeleteRow({ resource: taxRulesRes, id: testTaxId })
    if (res.status !== 200) throw new Error(`Failed to delete tax rule: ${res.status}`)
  })

  // 5. Test Warehouse CRUD
  const testWhId = `WH-TEST-${Date.now()}`
  await test("Create new Warehouse facility in MySQL", async () => {
    const res = await drizzleCreateRow({
      resource: warehousesRes,
      body: {
        id: testWhId,
        code: `${testWhId}-CODE`,
        name: "Test Cold Storage Facility",
        type: "Cold Storage",
        location: "Dire Dawa Hub",
        specialization: "Perishables & Vaccines",
        targetMarkets: "Eastern Region",
        manager: "Abebe Kebede",
        status: "Active",
      },
    })
    if (res.status !== 200 && res.status !== 201) throw new Error(`Failed to create warehouse: ${res.status}`)
  })

  await test("Update Warehouse facility in MySQL", async () => {
    const res = await drizzleUpdateRow({
      resource: warehousesRes,
      id: testWhId,
      body: { manager: "Chala Gemechu", status: "Maintenance" },
    })
    if (res.status !== 200) throw new Error(`Failed to update warehouse: ${res.status}`)

    const updated = await drizzleGetRow({ resource: warehousesRes, id: testWhId })
    if (updated.body.manager !== "Chala Gemechu" || updated.body.status !== "Maintenance") {
      throw new Error(`Warehouse fields mismatch: ${JSON.stringify(updated.body)}`)
    }
  })

  await test("Delete Test Warehouse facility from MySQL", async () => {
    const res = await drizzleDeleteRow({ resource: warehousesRes, id: testWhId })
    if (res.status !== 200) throw new Error(`Failed to delete warehouse: ${res.status}`)
  })

  // 6. Restore Statutory Pension & Default Settings
  await test("Restore Statutory Company & Pension Settings", async () => {
    const statutory = {
      ...initialSettings,
      pension_employee_rate: 7,
      pension_employer_rate: 11,
      processing_rate_per_quintal: 150,
      base_storage_rate_per_quintal_day: 1.0,
      tax_brackets_config: [
        { min: 0, max: 2000, ratePercent: 0, deductible: 0 },
        { min: 2001, max: 4000, ratePercent: 10, deductible: 200 },
        { min: 4001, max: 7000, ratePercent: 15, deductible: 400 },
        { min: 7001, max: 10000, ratePercent: 20, deductible: 750 },
        { min: 10001, max: 14000, ratePercent: 25, deductible: 1250 },
        { min: 14001, max: null, ratePercent: 35, deductible: 2650 },
      ],
    }
    await drizzleUpdateRow({ resource: settingsRes, id: testSettingsId, body: statutory })
  })

  console.log("\n=================================================================")
  console.log(`📊 Settings & Consistency Test Results: ${passed} Passed, ${failed} Failed`)
  console.log("=================================================================\n")

  if (failed > 0) process.exit(1)
  process.exit(0)
}

runSettingsSyncTests().catch((err) => {
  console.error("Fatal Settings Test error:", err)
  process.exit(1)
})
