import { drizzleListRows, drizzleCreateRow, drizzleDeleteRow } from "../../db/drizzleCrud.js"
import { getResource } from "../../db/resourceRegistry.js"
import { DEFAULT_SHIPMENT_DOC_RULES, evaluateShipmentDocs } from "./shipmentDocumentLogic.js"

export async function listShipmentDocRules(query = {}) {
  let rules = DEFAULT_SHIPMENT_DOC_RULES
  if (query.applies_to) {
    rules = rules.filter((r) => r.applies_to === query.applies_to)
  }
  return { status: 200, body: rules }
}

export async function listShipmentDocs(query = {}) {
  const recordId = query.record_id || query.recordId || null
  const recordType = query.record_type || query.recordType || null

  try {
    const resource = getResource("shipment_documents")
    const apiQuery = {}
    if (recordId) apiQuery.record_id = `eq.${recordId}`
    if (recordType) apiQuery.record_type = `eq.${recordType}`

    const res = await drizzleListRows({ resource, query: apiQuery })
    return res
  } catch (err) {
    console.error("[DRIZZLE DOCS LIST ERROR]:", err.message)
    return { status: 500, body: { error: "Failed to list shipment documents", message: err.message } }
  }
}

export async function saveShipmentDoc(input) {
  const id = input?.id || `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const recordId = input?.record_id || input?.recordId || ""
  const documentType = input?.document_type || input?.documentType || "Other"

  const doc = {
    id,
    record_id: recordId,
    record_type: input?.record_type || input?.recordType || "purchase_order",
    document_type: documentType,
    file_name: input?.file_name || input?.fileName || "document.pdf",
    file_size: String(Number(input?.file_size || input?.fileSize || 1024)),
    file_url: input?.file_url || input?.fileUrl || "",
    uploaded_at: input?.uploaded_at ? new Date(input.uploaded_at).toISOString() : new Date().toISOString(),
    uploaded_by: input?.uploaded_by || "Current User",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (doc.file_url && typeof doc.file_url === "string" && doc.file_url.startsWith("data:")) {
    return { status: 400, body: { error: "Base64 data URLs are prohibited. Files must be uploaded to cloud storage." } }
  }

  try {
    const resource = getResource("shipment_documents")

    // Idempotency safeguard: check if identical document already exists
    if (doc.record_id && doc.file_url) {
      const existing = await drizzleListRows({
        resource,
        query: {
          record_id: `eq.${doc.record_id}`,
          record_type: `eq.${doc.record_type}`,
          document_type: `eq.${doc.document_type}`,
        },
      })
      if (existing?.status === 200 && Array.isArray(existing?.body)) {
        const match = existing.body.find((r) => r.file_url === doc.file_url)
        if (match) {
          return { status: 200, body: match }
        }
      }
    }

    const res = await drizzleCreateRow({ resource, body: doc })
    return res
  } catch (err) {
    console.error("[DRIZZLE DOCS SAVE ERROR]:", err.message)
    return { status: 500, body: { error: "Failed to save shipment document", message: err.message } }
  }
}

export async function listAssignedOfficers() {
  return { status: 200, body: [] }
}

export async function assignOfficer(input) {
  const record_id = input?.record_id || input?.recordId
  if (!record_id) {
    return { status: 400, body: { error: "record_id is required" } }
  }

  const assignment = {
    record_id,
    assigned_employee_id: input?.assigned_employee_id || input?.assignedEmployeeId || null,
    assigned_employee_name: input?.assigned_employee_name || input?.assignedEmployeeName || "Unassigned",
    assigned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return { status: 200, body: assignment }
}

export async function deleteShipmentDoc(id) {
  try {
    const resource = getResource("shipment_documents")
    return await drizzleDeleteRow({ resource, id })
  } catch (err) {
    console.error(`[DRIZZLE DOCS DELETE ERROR] ${id}:`, err.message)
    return { status: 500, body: { error: "Failed to delete shipment doc", message: err.message } }
  }
}

export { evaluateShipmentDocs, DEFAULT_SHIPMENT_DOC_RULES }
