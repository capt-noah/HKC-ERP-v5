import assert from "node:assert"
import jwt from "jsonwebtoken"
import { pool } from "../server/db/client.js"
import { config } from "../server/config.js"
import {
  createSession,
  validateSession,
  refreshSession,
  getUserActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
  parseUserAgent,
  getClientIp,
} from "../server/modules/auth/sessionService.js"

const JWT_SECRET = config.jwtSecret

console.log("==================================================================")
console.log("   HKC-ERP v5: SESSION MANAGEMENT & 6-HOUR POLICY TEST SUITE     ")
console.log("==================================================================")

async function runTests() {
  let passed = 0
  let failed = 0

  function test(name, fn) {
    return (async () => {
      try {
        await fn()
        console.log(`  [PASS] ${name}`)
        passed++
      } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message)
        failed++
      }
    })()
  }

  // 1. User-Agent and IP Parser tests
  await test("User-Agent Parsing: macOS Chrome", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    const parsed = parseUserAgent(ua)
    assert.strictEqual(parsed.osName, "macOS")
    assert.strictEqual(parsed.browserName, "Chrome")
    assert.strictEqual(parsed.deviceType, "desktop")
  })

  await test("User-Agent Parsing: iPhone Safari", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    const parsed = parseUserAgent(ua)
    assert.strictEqual(parsed.osName, "iOS")
    assert.strictEqual(parsed.browserName, "Safari")
    assert.strictEqual(parsed.deviceType, "mobile")
  })

  await test("User-Agent Parsing: Windows Edge", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0"
    const parsed = parseUserAgent(ua)
    assert.strictEqual(parsed.osName, "Windows 10/11")
    assert.strictEqual(parsed.browserName, "Edge")
    assert.strictEqual(parsed.deviceType, "desktop")
  })

  await test("Client IP Extraction and Sanitization", () => {
    const mockReq = {
      headers: { "x-forwarded-for": "::ffff:196.188.42.10, 10.0.0.1" },
    }
    const ip = getClientIp(mockReq)
    assert.strictEqual(ip, "196.188.42.10")
  })

  // 2. Fetch a test user from database (e.g. admin)
  const [users] = await pool.query("SELECT id, username FROM users LIMIT 1")
  assert(users.length > 0, "At least one user must exist in database.")
  const testUser = users[0]

  let session1 = null
  let session2 = null

  // 3. Session Creation Test
  await test("Session Creation: Inserts valid 6-hour record in user_sessions", async () => {
    const mockReq = {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
        "x-forwarded-for": "127.0.0.1",
      },
    }
    session1 = await createSession({ userId: testUser.id, req: mockReq, durationHours: 6 })
    assert(session1.id.startsWith("sess_"), "Session ID must start with sess_")
    assert.strictEqual(session1.osName, "macOS")
    assert.strictEqual(session1.browserName, "Chrome")
    assert.strictEqual(session1.deviceType, "desktop")

    const [dbRows] = await pool.query("SELECT * FROM user_sessions WHERE id = ?", [session1.id])
    assert.strictEqual(dbRows.length, 1, "Session row must be in database")
    assert.strictEqual(dbRows[0].is_revoked, 0, "Session must not be revoked")

    const expiresDiffMs = new Date(dbRows[0].expires_at).getTime() - Date.now()
    const expiresDiffHours = expiresDiffMs / (1000 * 60 * 60)
    assert(expiresDiffHours >= 5.9 && expiresDiffHours <= 6.1, "Expiration must be approximately 6 hours")
  })

  // 4. Session Validation Test
  await test("Session Validation: Validates active unexpired session", async () => {
    const check = await validateSession(session1.id)
    assert.strictEqual(check.valid, true, "Session must be valid")
    assert.strictEqual(check.user.username, testUser.username)
  })

  // 5. Create a 2nd session (simulating second device like mobile phone)
  await test("Multiple Sessions: Create secondary device session", async () => {
    const mockMobileReq = {
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
        "x-forwarded-for": "196.188.10.5",
      },
    }
    session2 = await createSession({ userId: testUser.id, req: mockMobileReq, durationHours: 6 })
    assert.strictEqual(session2.deviceType, "mobile")
    assert.strictEqual(session2.osName, "iOS")
  })

  // 6. List active sessions test
  await test("Listing Active Sessions: Marks isCurrent properly", async () => {
    const list = await getUserActiveSessions(testUser.id, session1.id)
    assert(list.length >= 2, "Must return at least 2 active sessions")

    const currentSess = list.find((s) => s.id === session1.id)
    const otherSess = list.find((s) => s.id === session2.id)

    assert(currentSess, "Session 1 must exist in list")
    assert.strictEqual(currentSess.isCurrent, true, "Session 1 must have isCurrent = true")

    assert(otherSess, "Session 2 must exist in list")
    assert.strictEqual(otherSess.isCurrent, false, "Session 2 must have isCurrent = false")
  })

  // 7. Refresh Session Test (1-Click Extension)
  await test("Session Refresh: Extends session window by 6 hours", async () => {
    const refreshed = await refreshSession(session1.id, testUser.id, 6)
    assert.strictEqual(refreshed.sessionId, session1.id)

    const [dbRows] = await pool.query("SELECT expires_at FROM user_sessions WHERE id = ?", [session1.id])
    const newExpiresDiffMs = new Date(dbRows[0].expires_at).getTime() - Date.now()
    const newExpiresDiffHours = newExpiresDiffMs / (1000 * 60 * 60)
    assert(newExpiresDiffHours >= 5.9 && newExpiresDiffHours <= 6.1, "Expiration must be pushed out by 6 hours")
  })

  // 8. Revoke Specific Session Test (Single device sign-out)
  await test("Single Session Revocation: Revokes secondary session and rejects validation", async () => {
    const revoked = await revokeSession(session2.id, testUser.id)
    assert.strictEqual(revoked, true, "Revocation query must succeed")

    const check = await validateSession(session2.id)
    assert.strictEqual(check.valid, false, "Revoked session must be marked invalid")
    assert.strictEqual(check.code, "SESSION_REVOKED", "Error code must be SESSION_REVOKED")

    // Session 1 must remain completely unaffected
    const check1 = await validateSession(session1.id)
    assert.strictEqual(check1.valid, true, "Session 1 must remain active and valid")
  })

  // 9. Bulk Revocation Test (Revoke all other sessions)
  await test("Bulk Revocation: Revoke all other sessions except current", async () => {
    // Create a 3rd session
    const mockReq3 = {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/128.0", "x-forwarded-for": "10.0.0.9" },
    }
    const session3 = await createSession({ userId: testUser.id, req: mockReq3, durationHours: 6 })

    const count = await revokeAllOtherSessions(testUser.id, session1.id)
    assert(count >= 1, "Must revoke other sessions")

    // Session 3 should now be revoked
    const check3 = await validateSession(session3.id)
    assert.strictEqual(check3.valid, false, "Session 3 must be revoked")

    // Current session 1 must still be valid
    const check1 = await validateSession(session1.id)
    assert.strictEqual(check1.valid, true, "Current session must remain valid")
  })

  // 10. Strict Session Enforcement Test
  await test("Strict Session Enforcement: Missing or invalid sessionId rejected", async () => {
    const checkNoSession = await validateSession(undefined)
    assert.strictEqual(checkNoSession.valid, false)
    assert.strictEqual(checkNoSession.code, "INVALID_SESSION")

    const checkFakeSession = await validateSession("sess_non_existent_fake_id_123")
    assert.strictEqual(checkFakeSession.valid, false)
    assert.strictEqual(checkFakeSession.code, "SESSION_REVOKED")
  })

  // Clean up all test sessions from database
  await pool.query("DELETE FROM user_sessions WHERE user_id = ?", [testUser.id])

  console.log("\n==================================================================")
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================================")

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered fatal error:", err)
  process.exit(1)
})
