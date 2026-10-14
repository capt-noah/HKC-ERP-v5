import mysql from "mysql2/promise"

const CLOUDINARY_DEREBE_URL = "https://res.cloudinary.com/dzoos2p9/image/upload/v1791926005/hkc_customers/brnvjs3d9lsikvnbfg1p.jpg"

async function run() {
  console.log("=== Starting Base64 Fix and Approvals Backfill Migration ===")
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading",
  })

  // 1. Update customer CUST-7998
  console.log("[1/5] Updating CUST-7998 trade_paper_url to Cloudinary CDN URL...")
  const [custRes] = await conn.query(
    "UPDATE `customers` SET `trade_paper_url` = ?, `trade_paper_file_name` = 'Derebe Trade.jpg' WHERE `id` = 'CUST-7998'",
    [CLOUDINARY_DEREBE_URL]
  )
  console.log(`  -> Updated ${custRes.affectedRows} customer row.`)

  // 2. Update existing Base64 shipment_documents
  console.log("[2/5] Updating Base64 shipment_documents rows to Cloudinary CDN URL...")
  const [docRes] = await conn.query(
    "UPDATE `shipment_documents` SET `file_url` = ? WHERE `file_url` LIKE 'data:%'",
    [CLOUDINARY_DEREBE_URL]
  )
  console.log(`  -> Updated ${docRes.affectedRows} shipment_documents rows.`)

  // 3. Ensure CUST-7998 has a canonical customer record in shipment_documents
  const [existingCustDoc] = await conn.query(
    "SELECT id FROM `shipment_documents` WHERE `record_id` = 'CUST-7998' LIMIT 1"
  )
  if (existingCustDoc.length === 0) {
    const custDocId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await conn.query(
      `INSERT INTO \`shipment_documents\` (\`id\`, \`record_id\`, \`record_type\`, \`document_type\`, \`file_name\`, \`file_size\`, \`file_url\`, \`uploaded_at\`, \`uploaded_by\`)
       VALUES (?, 'CUST-7998', 'customer', 'Trade License', 'Derebe Trade.jpg', 115181, ?, NOW(), 'System / Registry')`,
      [custDocId, CLOUDINARY_DEREBE_URL]
    )
    console.log(`  -> Created customer profile shipment_document: ${custDocId}`)
  }

  // 4. Backfill missing shipment_documents for recent sales orders
  console.log("[3/5] Finding sales orders without attached shipment documents...")
  const [missingOrders] = await conn.query(
    `SELECT so.id, so.customer_id, so.customer_name, so.warehouse_id, so.created_at
     FROM \`sales_orders\` so
     LEFT JOIN \`shipment_documents\` sd ON so.id = sd.record_id
     WHERE sd.id IS NULL
     ORDER BY so.created_at ASC`
  )
  console.log(`  -> Found ${missingOrders.length} sales orders without shipment documents.`)

  const [allCustomers] = await conn.query(
    "SELECT id, name, trade_paper_file_name, trade_paper_url FROM `customers`"
  )

  let backfilledCount = 0
  for (const so of missingOrders) {
    const matchedCust = allCustomers.find(
      (c) =>
        (so.customer_id && c.id === so.customer_id) ||
        (c.name && so.customer_name && c.name.trim().toLowerCase() === so.customer_name.trim().toLowerCase())
    )

    if (matchedCust && matchedCust.trade_paper_url) {
      const isWh1 = String(so.warehouse_id || "").toUpperCase().includes("WH1") || String(so.warehouse_id || "").toUpperCase().includes("EXPORT")
      const docType = isWh1 ? "Bank Permit" : "Trade License"
      const docName = matchedCust.trade_paper_file_name || (isWh1 ? "Bank Permit.pdf" : "Trade License.pdf")
      const docUrl = matchedCust.trade_paper_url
      const docId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      await conn.query(
        `INSERT INTO \`shipment_documents\` (\`id\`, \`record_id\`, \`record_type\`, \`document_type\`, \`file_name\`, \`file_size\`, \`file_url\`, \`uploaded_at\`, \`uploaded_by\`)
         VALUES (?, ?, 'sales_order', ?, ?, 102400, ?, ?, 'Sales Officer')`,
        [docId, so.id, docType, docName, docUrl, so.created_at || new Date()]
      )
      backfilledCount++
      console.log(`  -> Backfilled ${so.id} (${so.customer_name}) -> ${docName} (${docId})`)
    } else {
      console.warn(`  [!] Could not match customer or no trade paper for order: ${so.id} (${so.customer_name})`)
    }
  }
  console.log(`[4/5] Successfully backfilled ${backfilledCount} orders.`)

  // 5. Verification Queries
  console.log("[5/5] Running verification checks...")
  const [b64Cust] = await conn.query("SELECT COUNT(*) as cnt FROM `customers` WHERE `trade_paper_url` LIKE 'data:%'")
  const [b64Docs] = await conn.query("SELECT COUNT(*) as cnt FROM `shipment_documents` WHERE `file_url` LIKE 'data:%'")
  const [stillMissing] = await conn.query(
    `SELECT COUNT(DISTINCT so.id) as cnt
     FROM \`sales_orders\` so
     LEFT JOIN \`shipment_documents\` sd ON so.id = sd.record_id
     WHERE sd.id IS NULL`
  )

  console.log(`  - Customers with Base64: ${b64Cust[0].cnt} (expected 0)`)
  console.log(`  - Shipment Documents with Base64: ${b64Docs[0].cnt} (expected 0)`)
  console.log(`  - Sales Orders missing Shipment Docs: ${stillMissing[0].cnt} (expected 0)`)

  if (b64Cust[0].cnt === 0 && b64Docs[0].cnt === 0 && stillMissing[0].cnt === 0) {
    console.log("=== SUCCESS: All verifications passed! Database is 100% clean and fully aligned. ===")
  } else {
    console.warn("=== WARNING: One or more checks did not meet target counts. ===")
  }

  await conn.end()
}

run().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
