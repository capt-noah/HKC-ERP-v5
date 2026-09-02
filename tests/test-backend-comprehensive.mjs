import assert from "node:assert/strict"
import { resources, listResources, getResource } from "../server/db/resourceRegistry.js"
import { tableMap, unwrapRow } from "../server/db/drizzleCrud.js"
import { validateStrongPassword, sanitizeUser } from "../server/modules/auth/authUtils.js"
import { parseRequestAction } from "../server/modules/common/activityLogger.js"
import { validateProcessingServiceOrder, VALID_PROCESSING_STAGES, calculateProcessingServiceFee } from "../server/modules/sales/processingServicesLogic.js"
import { validateSalesIssueDraft, availableBatchesForProduct, calculateAmount } from "../server/modules/sales/salesIssueLogic.js"
import { evaluateShipmentDocs, DEFAULT_SHIPMENT_DOC_RULES } from "../server/modules/sales/shipmentDocumentLogic.js"

console.log("=================================================================")
console.log("🚀 STARTING HKC-ERP-v5 COMPREHENSIVE BACKEND VERIFICATION")
console.log("=================================================================\n")

let passed = 0
let total = 0

function test(name, fn) {
  total++
  try {
    fn()
    console.log(`✅ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message)
  }
}

// ── 1. Resource Registry & Schema Integrity ──
console.log("--- 1. Resource Registry & Table Integrity (31 Tables) ---")
test("Registry contains exactly 31 tables", () => {
  const list = listResources()
  assert.equal(list.length, 31, `Expected 31 tables, got ${list.length}`)
})

test("All 31 tables are present in Drizzle tableMap", () => {
  const registered = Object.keys(resources)
  for (const name of registered) {
    assert.ok(tableMap[name], `Table '${name}' missing from Drizzle tableMap`)
  }
})

test("unwrapRow correctly parses JSON documents and preserves ID", () => {
  const rawRow = {
    id: "cust-01",
    payload: JSON.stringify({ name: "Acme Coffee Ltd", balance: 50000 }),
    created_at: "2026-09-01T12:00:00.000Z",
  }
  const unwrapped = unwrapRow(rawRow, "jsonb_document")
  assert.equal(unwrapped.id, "cust-01")
  assert.equal(unwrapped.name, "Acme Coffee Ltd")
  assert.equal(unwrapped.balance, 50000)
  assert.equal(unwrapped.created_at, "2026-09-01T12:00:00.000Z")
})

// ── 2. Auth Security & Password Policy ──
console.log("\n--- 2. Auth Security & Policy Enforcement ---")
test("Strong password validation rejects weak passwords", () => {
  const weak1 = validateStrongPassword("123456")
  assert.equal(weak1.valid, false)

  const weak2 = validateStrongPassword("password")
  assert.equal(weak2.valid, false)

  const weak3 = validateStrongPassword("Short1!")
  assert.equal(weak3.valid, false)
})

test("Strong password validation accepts compliant passwords", () => {
  const strong = validateStrongPassword("HkcAdmin2026!Sec")
  assert.equal(strong.valid, true)
})

test("sanitizeUser completely strips sensitive hashes and passwords", () => {
  const rawUser = {
    id: "USR-01",
    username: "finance_lead",
    password_hash: "$2b$10$e8wfh...secret",
    password: "plain_text_password",
    role: "finance_manager",
    roles: ["finance_manager"],
  }
  const sanitized = sanitizeUser(rawUser)
  assert.equal(sanitized.id, "USR-01")
  assert.equal(sanitized.password_hash, undefined)
  assert.equal(sanitized.password, undefined)
})

// ── 3. Activity Logging & Action Parsing ──
console.log("\n--- 3. Activity Logger Endpoint Action Parsing ---")
test("parseRequestAction correctly identifies resource and actions", () => {
  const p1 = parseRequestAction("GET", "/api/sales_issues")
  assert.equal(p1.resource, "sales_issues")
  assert.equal(p1.action, "GET")

  const p2 = parseRequestAction("POST", "/api/sales-issues/SI-100/post")
  assert.equal(p2.resource, "sales_issues")
  assert.equal(p2.action, "Post")

  const p3 = parseRequestAction("PATCH", "/api/processing_services/PS-001")
  assert.equal(p3.resource, "processing_services")
  assert.equal(p3.action, "Update")

  const p4 = parseRequestAction("DELETE", "/api/invoices/INV-01")
  assert.equal(p4.resource, "invoices")
  assert.equal(p4.action, "Delete")
})

// ── 4. Processing Services Logic & Tiered Storage Calculation ──
console.log("\n--- 4. Processing Services Logic & Tiered Storage Calculation ---")
test("Processing service fee calculation computes base rate & multi-month tiered storage", () => {
  const rates = {
    processingRatePerQuintal: 150,
    baseStorageRatePerQuintalDay: 1.25,
    storageIncrementPerMonth: 0.25,
    maxStorageMonthCap: 4,
    storageFreeDays: 0,
  }

  // 100 Quintals, 35 days in storage
  const calc = calculateProcessingServiceFee(100, "2026-08-01", "2026-09-05", true, rates)
  assert.equal(calc.processingFee, 15000) // 100 * 150
  assert.ok(calc.daysInStorage >= 34 && calc.daysInStorage <= 36)
  assert.ok(calc.storageFee > 0)
  assert.equal(calc.totalFee, calc.processingFee + calc.storageFee)
})

test("validateProcessingServiceOrder enforces positive quantity", () => {
  const invalid = validateProcessingServiceOrder({ client_company_name: "Union", quantity: 0 })
  assert.ok(invalid.length > 0)

  const valid = validateProcessingServiceOrder({ client_company_name: "Union", quantity: 50, goods_description: "Arabica" })
  assert.equal(valid.length, 0)
})

// ── 5. Sales Issue Business Rules ──
console.log("\n--- 5. Sales Issue Calculations & Batch Verification ---")
test("calculateAmount multiplies quantity and unit price cleanly", () => {
  assert.equal(calculateAmount(10, 150), 1500)
  assert.equal(calculateAmount(0, 500), 0)
  assert.equal(calculateAmount(7.5, 200), 1500)
})

test("validateSalesIssueDraft requires items array", () => {
  const noItemsErrors = validateSalesIssueDraft({ fs_no: "FS-01", customer_name: "Customer", items: [] })
  assert.ok(noItemsErrors.length > 0)

  const validErrors = validateSalesIssueDraft({
    fs_no: "FS-01",
    sale_date: "2026-09-01",
    customer_id: "CUST-01",
    warehouse_id: "WH1",
    items: [{ item_id: "p1", batch_no: "BATCH-01", quantity: 5, unit_price: 100 }],
  })
  assert.equal(validErrors.length, 0)
})

// ── 6. Shipment Document Gating ──
console.log("\n--- 6. Shipment Document Rules & Compliance Gating ---")
test("Shipment doc compliance requires mandatory documents", () => {
  const rules = DEFAULT_SHIPMENT_DOC_RULES
  const attachments = [{ document_type: "Commercial Invoice" }]
  const evalResult = evaluateShipmentDocs({ attachments, rules, appliesTo: "purchase_order" })
  assert.equal(evalResult.isComplete, false)
  assert.ok(evalResult.missing.length > 0)
})

test("Shipment doc compliance passes when all mandatory docs are present", () => {
  const rules = DEFAULT_SHIPMENT_DOC_RULES
  const attachments = [
    { document_type: "Commercial Invoice" },
    { document_type: "Packing List" },
    { document_type: "Bill of Lading / Airway Bill" },
  ]

  const evalResult = evaluateShipmentDocs({ record: { origin_country: "USA" }, attachments, rules, appliesTo: "purchase_order" })
  assert.equal(evalResult.isComplete, true)
  assert.equal(evalResult.missing.length, 0)
})

console.log("\n=================================================================")
console.log(`🏁 BACKEND VERIFICATION: ${passed} of ${total} tests PASSED (${Math.round((passed / total) * 100)}% Success)`)
console.log("=================================================================")

if (passed !== total) {
  process.exit(1)
}
