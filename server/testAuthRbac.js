import bcrypt from "bcryptjs"
import { drizzleListRows, drizzleGetRow, drizzleCreateRow, drizzleUpdateRow, drizzleDeleteRow } from "./db/drizzleCrud.js"
import { getResource } from "./db/resourceRegistry.js"
import { validateStrongPassword } from "./modules/auth/authUtils.js"

async function runAuthRbacTests() {
  console.log("\n======================================================")
  console.log("🧪 Testing RBAC & Strong Password Management (MySQL)")
  console.log("======================================================\n")

  let passed = 0
  let failed = 0

  async function test(name, fn) {
    process.stdout.write(`• ${name.padEnd(52)} ... `)
    try {
      await fn()
      console.log("✅ PASS")
      passed++
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`)
      failed++
    }
  }

  const usersRes = getResource("users")

  // 1. Password Strength Validation
  await test("Validate weak passwords (rejected)", async () => {
    const weak1 = validateStrongPassword("weak")
    if (weak1.valid) throw new Error("Accepted weak password 'weak'")

    const weak2 = validateStrongPassword("Password123") // Missing special char
    if (weak2.valid) throw new Error("Accepted password without special char")
  })

  await test("Validate strong passwords (accepted)", async () => {
    const strong = validateStrongPassword("StrongPass123!@#")
    if (!strong.valid) throw new Error(`Rejected valid strong password: ${strong.error}`)
  })

  // 2. Create User with Multiple Roles
  const testUserId = `USR-TEST-${Date.now()}`
  const initialPassword = "InitialPassword123!"
  const initialHash = await bcrypt.hash(initialPassword, 10)

  await test("Create user with multi-roles in MySQL", async () => {
    const res = await drizzleCreateRow({
      resource: usersRes,
      body: {
        id: testUserId,
        username: `testuser_${Date.now()}`,
        password_hash: initialHash,
        roles: ["sales_manager", "finance_manager"],
        role: "sales_manager",
        fullname: "Test MultiRole User",
        status: "active",
      },
    })
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Failed to create user: status ${res.status}`)
    }
  })

  // 3. Read and verify roles stored in MySQL
  await test("Read and verify assigned roles from MySQL", async () => {
    const res = await drizzleGetRow({ resource: usersRes, id: testUserId })
    if (res.status !== 200 || !res.body) throw new Error("User not found")
    const u = res.body
    const roles = Array.isArray(u.roles) ? u.roles : JSON.parse(u.roles || "[]")
    if (!roles.includes("sales_manager") || !roles.includes("finance_manager")) {
      throw new Error(`Roles mismatch: ${JSON.stringify(roles)}`)
    }
  })

  // 4. Change Password with Strong Password
  const newPassword = "NewStrongPassword456!$"
  const newHash = await bcrypt.hash(newPassword, 10)

  await test("Update password with new bcrypt hash in MySQL", async () => {
    const res = await drizzleUpdateRow({
      resource: usersRes,
      id: testUserId,
      body: { password_hash: newHash },
    })
    if (res.status !== 200) throw new Error(`Failed to update password: status ${res.status}`)

    // Verify bcrypt compare
    const updated = await drizzleGetRow({ resource: usersRes, id: testUserId })
    const isMatch = await bcrypt.compare(newPassword, updated.body.password_hash)
    if (!isMatch) throw new Error("New password hash did not verify against bcrypt.compare")
  })

  // 5. Update Roles in MySQL
  await test("Update roles (assign inventory_admin & hr_manager)", async () => {
    const newRoles = ["inventory_admin", "hr_manager"]
    const res = await drizzleUpdateRow({
      resource: usersRes,
      id: testUserId,
      body: { roles: newRoles, role: newRoles[0] },
    })
    if (res.status !== 200) throw new Error(`Failed to update roles: status ${res.status}`)

    const updated = await drizzleGetRow({ resource: usersRes, id: testUserId })
    const roles = Array.isArray(updated.body.roles) ? updated.body.roles : JSON.parse(updated.body.roles || "[]")
    if (!roles.includes("inventory_admin") || !roles.includes("hr_manager")) {
      throw new Error(`Updated roles mismatch: ${JSON.stringify(roles)}`)
    }
  })

  // 6. Suspend and Reactivate Status
  await test("Suspend user account status in MySQL", async () => {
    await drizzleUpdateRow({ resource: usersRes, id: testUserId, body: { status: "suspended" } })
    const updated = await drizzleGetRow({ resource: usersRes, id: testUserId })
    if (updated.body.status !== "suspended") throw new Error("Status was not updated to suspended")
  })

  // 7. Cleanup
  await test("Delete test user account from MySQL", async () => {
    await drizzleDeleteRow({ resource: usersRes, id: testUserId })
    const check = await drizzleGetRow({ resource: usersRes, id: testUserId })
    if (check.status === 200) throw new Error("Test user still exists after deletion")
  })

  console.log("\n======================================================")
  console.log(`📊 Auth & RBAC Test Results: ${passed} Passed, ${failed} Failed`)
  console.log("======================================================\n")

  if (failed > 0) process.exit(1)
  process.exit(0)
}

runAuthRbacTests().catch(err => {
  console.error("Fatal test error:", err)
  process.exit(1)
})
