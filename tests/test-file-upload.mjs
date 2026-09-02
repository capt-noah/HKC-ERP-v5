import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import express from "express"
import { uploadRouter } from "../server/router/uploadRouter.js"

console.log("=================================================================")
console.log("🚀 STARTING HKC-ERP-v5 FILE STORAGE & UPLOAD VERIFICATION SUITE")
console.log("=================================================================")

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message)
    failed++
  }
}

async function asyncTest(name, fn) {
  try {
    await fn()
    console.log(`✅ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message)
    failed++
  }
}

// 1. Directory Structure Tests
test("Uploads root directory exists", () => {
  const rootDir = path.resolve(process.cwd(), "uploads")
  assert.ok(fs.existsSync(rootDir), "Uploads root folder must exist")
})

// 2. HTTP Upload Server Setup
const app = express()
app.use(express.json())
app.use("/api", uploadRouter)

const uploadsPath = path.resolve(process.cwd(), "uploads")
app.use("/uploads", express.static(uploadsPath))

const server = http.createServer(app)

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => {
    resolve()
  })
})

const port = server.address().port
const baseUrl = `http://127.0.0.1:${port}`

try {
  // 3. Test Uploading a Customer Document
  await asyncTest("Upload a document under 'customers' folder category", async () => {
    const boundary = "--------------------------" + Date.now().toString(16)
    const fileContent = "%PDF-1.4 Mock PDF file content for trade license"
    const filename = "trade_license_test.pdf"

    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="folder"\r\n\r\n`,
      `customers\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
      `Content-Type: application/pdf\r\n\r\n`,
      fileContent,
      `\r\n--${boundary}--\r\n`,
    ]

    const body = Buffer.concat(bodyParts.map((p) => Buffer.from(p)))

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    })

    assert.equal(res.status, 201, `Status should be 201 Created, got ${res.status}`)
    const json = await res.json()
    assert.ok(json.success, "Response should have success: true")
    assert.ok(json.url.startsWith("/uploads/customers/"), `URL should be under /uploads/customers/, got ${json.url}`)
    assert.equal(json.originalName, filename)

    // Verify physical file on disk
    const diskPath = path.resolve(process.cwd(), json.url.slice(1))
    assert.ok(fs.existsSync(diskPath), `Uploaded file must exist on disk at ${diskPath}`)
    const savedContent = fs.readFileSync(diskPath, "utf-8")
    assert.equal(savedContent, fileContent)

    // 4. Test Static Asset Serving
    const staticRes = await fetch(`${baseUrl}${json.url}`)
    assert.equal(staticRes.status, 200, "Static asset should be accessible via HTTP GET 200")
    assert.equal(staticRes.headers.get("content-type"), "application/pdf")
    const staticContent = await staticRes.text()
    assert.equal(staticContent, fileContent)

    // Cleanup test file
    fs.unlinkSync(diskPath)
  })

  // 5. Test Uploading a Sales Order Bank Permit
  await asyncTest("Upload bank permit under 'sales_orders' folder", async () => {
    const boundary = "--------------------------" + Date.now().toString(16)
    const fileContent = "PNG_MOCK_IMAGE_DATA"
    const filename = "bank_permit_scan.png"

    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="folder"\r\n\r\n`,
      `sales_orders\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
      `Content-Type: image/png\r\n\r\n`,
      fileContent,
      `\r\n--${boundary}--\r\n`,
    ]

    const body = Buffer.concat(bodyParts.map((p) => Buffer.from(p)))

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })

    assert.equal(res.status, 201)
    const json = await res.json()
    assert.ok(json.url.startsWith("/uploads/sales_orders/"))

    // Cleanup
    const diskPath = path.resolve(process.cwd(), json.url.slice(1))
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath)
  })

  // 6. Test Disallowed Executable File Extension Rejection
  await asyncTest("Reject unauthorized file extensions (e.g. .exe / .sh)", async () => {
    const boundary = "--------------------------" + Date.now().toString(16)
    const fileContent = "malicious script"
    const filename = "malicious.sh"

    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
      `Content-Type: text/plain\r\n\r\n`,
      fileContent,
      `\r\n--${boundary}--\r\n`,
    ]

    const body = Buffer.concat(bodyParts.map((p) => Buffer.from(p)))

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })

    assert.ok(res.status >= 400, "Should reject disallowed extension with 4xx/5xx error")
  })
} finally {
  server.close()
}

console.log("\n=================================================================")
console.log(`🏁 STORAGE VERIFICATION: ${passed} of ${passed + failed} tests PASSED`)
console.log("=================================================================")

if (failed > 0) process.exit(1)
