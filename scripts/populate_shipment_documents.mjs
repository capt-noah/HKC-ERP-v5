import fs from "fs";
import { getMysqlPool } from "../server/db/mysqlClient.js";

async function populateShipmentDocuments() {
  console.log("=== POPULATING SHIPMENT DOCUMENTS ===");
  const pool = getMysqlPool();

  const dumpPath = "/Users/Noah/Downloads/hkc_trading (2).sql";
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at ${dumpPath}`);
  }

  const content = fs.readFileSync(dumpPath, "utf8");
  const start = content.indexOf("INSERT INTO `shipment_documents`");
  const end = content.indexOf("ALTER TABLE `shipment_documents`", start);
  const chunk = content.slice(start, end);

  // Parse tuples
  const regex = /\(\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*([0-9.]+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/g;
  let match;
  const docs = [];
  while ((match = regex.exec(chunk)) !== null) {
    docs.push({
      id: match[1],
      record_id: match[2],
      record_type: match[3],
      document_type: match[4],
      file_name: match[5],
      file_size: parseFloat(match[6]) || 102400.00,
      file_url: match[7],
      uploaded_at: match[8],
      uploaded_by: match[9],
      created_at: match[10],
      updated_at: match[11],
    });
  }

  console.log(`Extracted ${docs.length} canonical shipment documents from dump.`);

  let insertedCount = 0;
  for (const doc of docs) {
    const [result] = await pool.query(
      `INSERT INTO shipment_documents 
        (id, record_id, record_type, document_type, file_name, file_size, file_url, uploaded_at, uploaded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        record_id = VALUES(record_id),
        record_type = VALUES(record_type),
        document_type = VALUES(document_type),
        file_name = VALUES(file_name),
        file_size = VALUES(file_size),
        file_url = VALUES(file_url),
        uploaded_at = VALUES(uploaded_at),
        uploaded_by = VALUES(uploaded_by),
        updated_at = VALUES(updated_at)`,
      [
        doc.id,
        doc.record_id,
        doc.record_type,
        doc.document_type,
        doc.file_name,
        doc.file_size,
        doc.file_url,
        doc.uploaded_at,
        doc.uploaded_by,
        doc.created_at,
        doc.updated_at,
      ]
    );
    if (result.affectedRows > 0) {
      insertedCount++;
    }
  }

  console.log(`Processed ${insertedCount} rows.`);

  const [totalRows] = await pool.query("SELECT COUNT(*) as count FROM shipment_documents");
  console.log(`Current total rows in shipment_documents: ${totalRows[0].count}`);

  const [paymentAdvices] = await pool.query(
    "SELECT record_id, document_type, file_name, file_url FROM shipment_documents WHERE document_type = 'Payment Advice'"
  );
  console.log(`Payment Advices in table: ${paymentAdvices.length}`);
  console.table(paymentAdvices);

  const [tradeLicenses] = await pool.query(
    "SELECT record_id, document_type, file_name, file_url FROM shipment_documents WHERE document_type = 'Trade License' LIMIT 10"
  );
  console.log(`Sample Trade Licenses in table:`);
  console.table(tradeLicenses);

  process.exit(0);
}

populateShipmentDocuments().catch((err) => {
  console.error("Error populating shipment documents:", err);
  process.exit(1);
});
