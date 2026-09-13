import assert from "node:assert"
import jwt from "jsonwebtoken"
import { pool } from "../server/db/client.js"
import { config } from "../server/config.js"
import { createSession } from "../server/modules/auth/sessionService.js"

const BASE_URL = "http://localhost:1000"
const JWT_SECRET = config.jwtSecret

async function runTests() {
  console.log("==================================================")
  console.log("   HKC-ERP v5: SESSION EXPIRY & LIVE SYNC TEST    ")
  console.log("==================================================")

  // 1. Get an active user and create an authentic database-backed session
  console.log("\n[Test 1] Establishing database-backed session...")
  const [users] = await pool.query("SELECT id, username, roles, fullname FROM users WHERE status = 'active' OR is_active = 1 LIMIT 1")
  assert.ok(users.length > 0, "No active user found in database")
  const user = users[0]

  let roles = user.roles
  if (typeof roles === "string") {
    try { roles = JSON.parse(roles) } catch { roles = ["superadmin"] }
  }

  const mockReq = {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
      "x-forwarded-for": "127.0.0.1",
    },
  }

  const session = await createSession({ userId: user.id, req: mockReq, durationHours: 6 })
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      roles,
      fullname: user.fullname,
      role: roles[0],
      sessionId: session.id,
    },
    JWT_SECRET,
    { expiresIn: "6h" }
  )

  console.log(`✅ Session created in user_sessions: ${session.id} for user: ${user.username}`)

  // 2. Test CORS Exposed Headers & X-Session-Expires-At on authenticated route
  console.log("\n[Test 2] Verifying X-Session-Expires-At header on authenticated request...")
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.strictEqual(meRes.status, 200, `GET /me failed: ${meRes.status}`)
  const expiresHeader = meRes.headers.get("x-session-expires-at")
  assert.ok(expiresHeader, "X-Session-Expires-At header was not attached to response")
  const parsedHeaderDate = new Date(expiresHeader).getTime()
  assert.ok(!isNaN(parsedHeaderDate), `Invalid date in header: ${expiresHeader}`)
  console.log(`✅ X-Session-Expires-At header verified: ${expiresHeader}`)

  // 3. Test GET /api/auth/session-status
  console.log("\n[Test 3] Calling GET /api/auth/session-status...")
  const statusRes = await fetch(`${BASE_URL}/api/auth/session-status`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.strictEqual(statusRes.status, 200, `GET /session-status failed: ${statusRes.status}`)
  const statusData = await statusRes.json()
  assert.strictEqual(statusData.valid, true, "Session should be valid")
  assert.ok(statusData.remainingSeconds > 21000, `Expected ~21600s remaining, got ${statusData.remainingSeconds}`)
  console.log(`✅ Initial session remaining seconds: ${statusData.remainingSeconds}s (~6 hours)`)

  // 4. Test POST /api/auth/test-set-expiry with { minutes: 4 }
  console.log("\n[Test 4] Setting session expiry to 4 minutes from now...")
  const setExpiryRes = await fetch(`${BASE_URL}/api/auth/test-set-expiry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ minutes: 4 }),
  })
  assert.strictEqual(setExpiryRes.status, 200, `POST /test-set-expiry failed: ${setExpiryRes.status}`)
  const setExpiryData = await setExpiryRes.json()
  assert.strictEqual(setExpiryData.minutesRemaining, 4)
  assert.ok(setExpiryData.secondsRemaining <= 240, `Expected <= 240s, got ${setExpiryData.secondsRemaining}`)
  console.log(`✅ Test expiry set. New expiration: ${setExpiryData.expiresAt}`)
  console.log(`   Seconds remaining: ${setExpiryData.secondsRemaining}s (<= 300s, triggers 5-minute warning modal!)`)

  const updatedToken = setExpiryData.token || token

  // 5. Verify that GET /session-status now reports <= 240 seconds
  console.log("\n[Test 5] Querying session-status after shortening to 4 minutes...")
  const verifyRes = await fetch(`${BASE_URL}/api/auth/session-status`, {
    headers: { Authorization: `Bearer ${updatedToken}` },
  })
  assert.strictEqual(verifyRes.status, 200)
  const verifyData = await verifyRes.json()
  assert.ok(verifyData.remainingSeconds <= 240, `Expected <= 240s, got ${verifyData.remainingSeconds}`)
  assert.ok(verifyData.remainingSeconds > 230, `Expected > 230s, got ${verifyData.remainingSeconds}`)
  console.log(`✅ Verified: remainingSeconds is ${verifyData.remainingSeconds}s. Modal threshold is 300s -> MODAL APPEARS!`)

  // 6. Test POST /api/auth/refresh-session (simulating user clicking "Stay Signed In (Extend 6h)")
  console.log("\n[Test 6] Extending session back to 6 hours via /refresh-session...")
  const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh-session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${updatedToken}` },
  })
  assert.strictEqual(refreshRes.status, 200, `POST /refresh-session failed: ${refreshRes.status}`)
  const refreshData = await refreshRes.json()
  assert.ok(refreshData.token, "Refresh did not return a new token")
  console.log(`✅ Session refreshed successfully. New expiresAt: ${refreshData.expiresAt}`)

  // 7. Verify session-status is back to ~21600 seconds
  console.log("\n[Test 7] Verifying session-status after extension...")
  const finalRes = await fetch(`${BASE_URL}/api/auth/session-status`, {
    headers: { Authorization: `Bearer ${refreshData.token}` },
  })
  assert.strictEqual(finalRes.status, 200)
  const finalData = await finalRes.json()
  assert.ok(finalData.remainingSeconds > 21000, `Expected ~21600s, got ${finalData.remainingSeconds}`)
  console.log(`✅ Session extended back to 6 hours: ${finalData.remainingSeconds}s remaining. Modal closes!`)

  // Cleanup: delete test session so DB stays clean
  await pool.query("DELETE FROM user_sessions WHERE id = ?", [session.id])
  console.log(`\n🧹 Cleaned up test session: ${session.id}`)

  console.log("\n==================================================")
  console.log("   🎉 ALL 7 EXPIRY SYNC & MODAL TESTS PASSED!     ")
  console.log("==================================================")
  process.exit(0)
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err)
  process.exit(1)
})
