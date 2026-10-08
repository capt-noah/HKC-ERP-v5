import fs from "fs";
import { getMysqlPool } from "../server/db/mysqlClient.js";

async function updateDesktopDump() {
  const pool = getMysqlPool();
  const [rows] = await pool.query("SELECT * FROM shipment_documents ORDER BY created_at ASC");
  console.log("Fetched rows count from DB:", rows.length);

  function escapeSql(val) {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "number") return String(val);
    if (val instanceof Date) {
      const iso = val.toISOString().replace("T", " ").replace("Z", "");
      return `'${iso}'`;
    }
    const str = String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `'${str}'`;
  }

  const tuples = rows.map((r) => {
    return `(${escapeSql(r.id)},${escapeSql(r.record_id)},${escapeSql(r.record_type)},${escapeSql(r.document_type)},${escapeSql(r.file_name)},${parseFloat(r.file_size || 102400).toFixed(2)},${escapeSql(r.file_url)},${escapeSql(r.uploaded_at)},${escapeSql(r.uploaded_by)},${escapeSql(r.created_at)},${escapeSql(r.updated_at)})`;
  });

  const insertSql = `INSERT INTO \`shipment_documents\` VALUES ${tuples.join(",")};`;

  const dumpPath = "/Users/Noah/Desktop/hkc_trading_reconciled.sql";
  let dump = fs.readFileSync(dumpPath, "utf8");

  const startMarker = "LOCK TABLES `shipment_documents` WRITE;\n/*!40000 ALTER TABLE `shipment_documents` DISABLE KEYS */;\n";
  const endMarker = "\n/*!40000 ALTER TABLE `shipment_documents` ENABLE KEYS */;\nUNLOCK TABLES;";

  const startIdx = dump.indexOf(startMarker);
  const endIdx = dump.indexOf(endMarker, startIdx);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Markers not found in desktop dump!");
  }

  const updatedDump = dump.slice(0, startIdx + startMarker.length) + insertSql + dump.slice(endIdx);
  fs.writeFileSync(dumpPath, updatedDump, "utf8");
  console.log("Successfully updated:", dumpPath);

  // Verification
  const verifyDump = fs.readFileSync(dumpPath, "utf8");
  const regex = /\('DOC-[^']+'/g;
  const matches = verifyDump.match(regex);
  console.log("Verified total document records in dump:", matches ? matches.length : 0);

  process.exit(0);
}

updateDesktopDump().catch((err) => {
  console.error(err);
  process.exit(1);
});
