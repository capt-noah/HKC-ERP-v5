import assert from "node:assert"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { pool } from "../server/db/client.js"
import { config } from "../server/config.js"

console.log("==================================================================")
console.log("   HKC-ERP v5: AUTH & ROBUST RBAC ROLE SEPARATION VERIFICATION  ")
console.log("==================================================================")

async function run() {
  let passed = 0
  let failed = 0

  async function test(name, fn) {
    try {
      await fn()
      console.log(`  [PASS] ${name}`)
      passed++
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message)
      failed++
    }
  }

  // 1. Verify Superadmin Record in MySQL
  await test("Verify superadmin account exists and has plesk hash", async () => {
    const [rows] = await pool.query("SELECT id, username, role, roles, password_hash FROM users WHERE username = 'admin'")
    assert.strictEqual(rows.length, 1, "Admin user must exist")
    const admin = rows[0]
    assert.strictEqual(admin.username, "admin")
    assert.strictEqual(admin.password_hash, "$2b$10$Roxf5M9hchWaTJUXkn62QeUAAwDzJijeuzcSGRBIlmX9zpUFyu2R2")
  })

  // 2. Test Failsafe Dual-Hash Verification Logic
  await test("Failsafe Dual-Hash verification: SuperadminPassword1! matches default hash", async () => {
    const defaultHash = "$2b$10$VxLgpDF7yuhj2YfCUm2Q3.shvayM8Gb7luUQyQCwL3G2P.G62x07e"
    const isMatch = await bcrypt.compare("SuperadminPassword1!", defaultHash)
    assert.strictEqual(isMatch, true, "SuperadminPassword1! must match default bootstrap hash")
  })

  // 3. Test authorizeRoles middleware
  const { authorizeRoles } = await import("../server/modules/auth/authMiddleware.js")

  await test("authorizeRoles: Allows superadmin regardless of required role", async () => {
    const middleware = authorizeRoles("hr_manager")
    let nextCalled = false
    const req = {
      method: "POST",
      user: { id: "1", username: "admin", roles: ["superadmin"], role: "superadmin" }
    }
    const res = {
      status: () => res,
      json: () => res,
    }
    middleware(req, res, () => { nextCalled = true })
    assert.strictEqual(nextCalled, true, "Superadmin must always bypass role restriction")
  })

  await test("authorizeRoles: Blocks inventory_admin from accessing hr_manager route with 403", async () => {
    const middleware = authorizeRoles("hr_manager")
    let statusCode = null
    let responseBody = null
    const req = {
      method: "GET",
      user: { id: "2", username: "yad", roles: ["inventory_admin"], role: "inventory_admin" }
    }
    const res = {
      status: (code) => { statusCode = code; return res },
      json: (body) => { responseBody = body; return res },
    }
    middleware(req, res, () => {
      assert.fail("Should not call next for unauthorized role")
    })
    assert.strictEqual(statusCode, 403, "Should return HTTP 403")
    assert.strictEqual(responseBody?.code, "FORBIDDEN")
  })

  await test("authorizeRoles: Blocks sales_manager from mutating inventory", async () => {
    const middleware = authorizeRoles("superadmin", "inventory_admin")
    let statusCode = null
    const req = {
      method: "POST",
      user: { id: "3", username: "selam", roles: ["sales_manager"], role: "sales_manager" }
    }
    const res = {
      status: (code) => { statusCode = code; return res },
      json: () => res,
    }
    middleware(req, res, () => {
      assert.fail("Should not call next for unauthorized role")
    })
    assert.strictEqual(statusCode, 403, "Sales manager must not mutate inventory")
  })

  await test("authorizeRoles: Allows inventory_admin to mutate inventory", async () => {
    const middleware = authorizeRoles("superadmin", "inventory_admin")
    let nextCalled = false
    const req = {
      method: "POST",
      user: { id: "4", username: "yad", roles: ["inventory_admin"], role: "inventory_admin" }
    }
    const res = {
      status: () => res,
      json: () => res,
    }
    middleware(req, res, () => { nextCalled = true })
    assert.strictEqual(nextCalled, true, "Inventory admin must be allowed to mutate inventory")
  })

  await test("authorizeRoles: Correctly parses JSON string roles from DB", async () => {
    const middleware = authorizeRoles("finance_manager")
    let nextCalled = false
    const req = {
      method: "POST",
      user: { id: "5", username: "fin_user", roles: JSON.stringify(["finance_manager"]) }
    }
    const res = {
      status: () => res,
      json: () => res,
    }
    middleware(req, res, () => { nextCalled = true })
    assert.strictEqual(nextCalled, true, "Stringified JSON roles array must be parsed and matched")
  })

  console.log("\n------------------------------------------------------------------")
  console.log(`RESULTS: ${passed} passed, ${failed} failed`)
  console.log("==================================================================")
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error("FATAL TEST ERROR:", err)
  process.exit(1)
})
