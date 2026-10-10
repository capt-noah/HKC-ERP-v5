import { withTransaction } from "../../db/transactionHelper.js"
import { pool } from "../../db/client.js"
import { unwrapRow } from "../../db/dbUtils.js"

function toMySqlTimestamp(val) {
  if (!val) return new Date()
  const d = val instanceof Date ? val : new Date(val)
  return isNaN(d.getTime()) ? new Date() : d
}

/**
 * Dedicated ACID-Compliant Service for HKC Shipping Documentation Records.
 * Guarantees:
 * - Atomicity: Multi-table mutations (hkc_doc_records + shipment_documents) run inside MySQL InnoDB transactions.
 * - Consistency: Enforces schema validation before writing and keeps relational document mirrors in lockstep.
 * - Isolation: Uses SELECT ... FOR UPDATE row-level locking on updates and deletions to prevent race conditions.
 * - Durability: All writes commit directly to InnoDB redo log with write-ahead persistence.
 */
export const hkcDocsService = {
  /**
   * List all HKC document records with optional filtering and search.
   */
  async list(query = {}) {
    try {
      let sql = "SELECT * FROM `hkc_doc_records` WHERE 1=1"
      const params = []

      if (query.type && query.type !== "ALL") {
        sql += " AND `type` = ?"
        params.push(query.type)
      }

      if (query.search) {
        sql += " AND (`shipment_id` LIKE ? OR `items_description` LIKE ?)"
        const term = `%${query.search}%`
        params.push(term, term)
      }

      sql += " ORDER BY `record_date` DESC, `created_at` DESC"

      if (query.limit) {
        sql += " LIMIT ?"
        params.push(parseInt(query.limit, 10))
      }
      if (query.offset) {
        sql += " OFFSET ?"
        params.push(parseInt(query.offset, 10))
      }

      const [rows] = await pool.query(sql, params)
      const unwrapped = (rows || []).map((r) => unwrapRow(r, "relational"))
      return { status: 200, body: unwrapped }
    } catch (err) {
      console.error("[HKC DOCS LIST ERROR]:", err)
      return { status: 500, body: { error: "Failed to list HKC documentation records", message: err.message } }
    }
  },

  /**
   * Get a single HKC document record by primary ID or shipment ID.
   */
  async get(id) {
    const cleanId = String(id).trim()
    try {
      const [rows] = await pool.query(
        "SELECT * FROM `hkc_doc_records` WHERE `id` = ? OR `shipment_id` = ? LIMIT 1",
        [cleanId, cleanId]
      )

      if (!rows || rows.length === 0) {
        return { status: 404, body: { error: `Documentation record '${id}' not found.` } }
      }

      return { status: 200, body: unwrapRow(rows[0], "relational") }
    } catch (err) {
      console.error(`[HKC DOCS GET ERROR] ${id}:`, err)
      return { status: 500, body: { error: `Failed to get record '${id}'`, message: err.message } }
    }
  },

  /**
   * Atomically create a new HKC document record and sync child shipment_documents.
   */
  async create(body) {
    const shipmentId = (body.shipmentId || body.shipment_id || "").trim()
    const itemsDescription = (body.itemsDescription || body.items_description || "").trim()
    const type = (body.type || "Import").trim()
    const recordDate = (body.recordDate || body.record_date || body.date || new Date().toISOString().slice(0, 10)).trim()

    if (!shipmentId) {
      return { status: 400, body: { error: "Validation error: shipmentId is required." } }
    }
    if (!itemsDescription) {
      return { status: 400, body: { error: "Validation error: itemsDescription is required." } }
    }

    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : []
    const cleanAttachments = rawAttachments.map((att) => ({
      attachmentId: att.attachmentId || `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fileName: att.fileName || att.file_name || "document.pdf",
      fileUrl: att.fileUrl || att.file_url || "",
      uploadedAt: att.uploadedAt || att.uploaded_at || new Date().toISOString(),
    }))

    const recordId = body.id ? String(body.id) : `HKCD-${Date.now()}`
    const attachmentsJson = JSON.stringify(cleanAttachments)

    return await withTransaction(async (conn) => {
      // 1. Insert master record into hkc_doc_records
      await conn.query(
        `INSERT INTO \`hkc_doc_records\`
         (\`id\`, \`shipment_id\`, \`items_description\`, \`type\`, \`record_date\`, \`attachments\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           \`shipment_id\` = VALUES(\`shipment_id\`),
           \`items_description\` = VALUES(\`items_description\`),
           \`type\` = VALUES(\`type\`),
           \`record_date\` = VALUES(\`record_date\`),
           \`attachments\` = VALUES(\`attachments\`),
           \`updated_at\` = NOW(3)`,
        [recordId, shipmentId, itemsDescription, type, recordDate, attachmentsJson]
      )

      // 2. Synchronize mirrored child rows in shipment_documents
      await conn.query(
        "DELETE FROM `shipment_documents` WHERE `record_id` = ? AND `record_type` = 'hkc_doc_records'",
        [recordId]
      )

      for (const att of cleanAttachments) {
        if (!att.fileUrl) continue
        const docId = `DOC-${att.attachmentId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        await conn.query(
          `INSERT INTO \`shipment_documents\`
           (\`id\`, \`record_id\`, \`record_type\`, \`document_type\`, \`file_name\`, \`file_size\`, \`file_url\`, \`uploaded_at\`, \`uploaded_by\`, \`created_at\`, \`updated_at\`)
           VALUES (?, ?, 'hkc_doc_records', 'Compliance / Shipping Doc', ?, 1024, ?, ?, 'HKC Docs Officer', NOW(3), NOW(3))`,
          [docId, recordId, att.fileName, att.fileUrl, toMySqlTimestamp(att.uploadedAt)]
        )
      }

      // 3. Fetch canonical record created
      const [rows] = await conn.query("SELECT * FROM `hkc_doc_records` WHERE `id` = ? LIMIT 1", [recordId])
      const createdRecord = unwrapRow(rows[0], "relational")

      return { status: 201, body: createdRecord }
    })
  },

  /**
   * Atomically update an existing HKC document record and its child documents with row-level locking.
   */
  async update(id, body) {
    const cleanId = String(id).trim()

    return await withTransaction(async (conn) => {
      // 1. Lock target row for update to guarantee strict transaction isolation
      const [existingRows] = await conn.query(
        "SELECT * FROM `hkc_doc_records` WHERE `id` = ? FOR UPDATE",
        [cleanId]
      )

      if (!existingRows || existingRows.length === 0) {
        return { status: 404, body: { error: `Documentation record '${id}' not found.` } }
      }

      const existing = existingRows[0]
      const shipmentId = body.shipmentId !== undefined ? String(body.shipmentId).trim() : (body.shipment_id !== undefined ? String(body.shipment_id).trim() : existing.shipment_id)
      const itemsDescription = body.itemsDescription !== undefined ? String(body.itemsDescription).trim() : (body.items_description !== undefined ? String(body.items_description).trim() : existing.items_description)
      const type = body.type !== undefined ? String(body.type).trim() : existing.type
      const recordDate = body.recordDate || body.record_date || body.date || existing.record_date

      let cleanAttachments = null
      if (body.attachments !== undefined) {
        const raw = Array.isArray(body.attachments) ? body.attachments : []
        cleanAttachments = raw.map((att) => ({
          attachmentId: att.attachmentId || `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: att.fileName || att.file_name || "document.pdf",
          fileUrl: att.fileUrl || att.file_url || "",
          uploadedAt: att.uploadedAt || att.uploaded_at || new Date().toISOString(),
        }))
      }

      const attachmentsJson = cleanAttachments !== null ? JSON.stringify(cleanAttachments) : existing.attachments

      // 2. Perform atomic master record update
      await conn.query(
        `UPDATE \`hkc_doc_records\`
         SET \`shipment_id\` = ?,
             \`items_description\` = ?,
             \`type\` = ?,
             \`record_date\` = ?,
             \`attachments\` = ?,
             \`updated_at\` = NOW(3)
         WHERE \`id\` = ?`,
        [shipmentId, itemsDescription, type, recordDate, attachmentsJson, cleanId]
      )

      // 3. Synchronize mirrored child rows in shipment_documents if attachments were updated
      if (cleanAttachments !== null) {
        await conn.query(
          "DELETE FROM `shipment_documents` WHERE `record_id` = ? AND `record_type` = 'hkc_doc_records'",
          [cleanId]
        )

        for (const att of cleanAttachments) {
          if (!att.fileUrl) continue
          const docId = `DOC-${att.attachmentId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          await conn.query(
            `INSERT INTO \`shipment_documents\`
             (\`id\`, \`record_id\`, \`record_type\`, \`document_type\`, \`file_name\`, \`file_size\`, \`file_url\`, \`uploaded_at\`, \`uploaded_by\`, \`created_at\`, \`updated_at\`)
             VALUES (?, ?, 'hkc_doc_records', 'Compliance / Shipping Doc', ?, 1024, ?, ?, 'HKC Docs Officer', NOW(3), NOW(3))`,
            [docId, cleanId, att.fileName, att.fileUrl, toMySqlTimestamp(att.uploadedAt)]
          )
        }
      }

      // 4. Fetch updated row
      const [rows] = await conn.query("SELECT * FROM `hkc_doc_records` WHERE `id` = ? LIMIT 1", [cleanId])
      const updatedRecord = unwrapRow(rows[0], "relational")

      return { status: 200, body: updatedRecord }
    })
  },

  /**
   * Atomically delete an HKC document record and cascade clean its mirrored documents.
   */
  async delete(id) {
    const cleanId = String(id).trim()

    return await withTransaction(async (conn) => {
      // 1. Lock row for update
      const [existingRows] = await conn.query(
        "SELECT * FROM `hkc_doc_records` WHERE `id` = ? FOR UPDATE",
        [cleanId]
      )

      if (!existingRows || existingRows.length === 0) {
        return { status: 404, body: { error: `Documentation record '${id}' not found.` } }
      }

      // 2. Cascade delete mirrored entries in shipment_documents
      await conn.query(
        "DELETE FROM `shipment_documents` WHERE `record_id` = ? AND `record_type` = 'hkc_doc_records'",
        [cleanId]
      )

      // 3. Delete master record in hkc_doc_records
      await conn.query("DELETE FROM `hkc_doc_records` WHERE `id` = ?", [cleanId])

      return { status: 200, body: { ok: true, deletedId: cleanId } }
    })
  },
}
