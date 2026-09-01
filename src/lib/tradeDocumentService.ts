import { API_BASE, getAuthHeaders } from "./apiPersistence"
import { erpStore } from "./erpStore"

export interface ShipmentDocAttachment {
  id: string
  record_id: string
  record_type: "purchase_order" | "sales_order" | "sales_issue" | "invoice" | "customer" | "processing_service"
  document_type: string
  file_name: string
  file_size: number
  file_url: string
  uploaded_at: string
  uploaded_by: string
}

export interface DocumentInfo {
  id?: string
  name: string
  url: string
  uploadedAt?: string
  uploadedBy?: string
  fileSize?: number
}

/**
 * Reads a browser File object as a Base64 data URL with metadata.
 */
export function readFileAsDataUrl(file: File): Promise<{ fileName: string; fileUrl: string; fileSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        fileName: file.name,
        fileUrl: (reader.result as string) || "",
        fileSize: file.size || 102400,
      })
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

/**
 * Fetches all shipment documents from backend REST API.
 */
export async function fetchAllShipmentDocs(): Promise<ShipmentDocAttachment[]> {
  try {
    const res = await fetch(`${API_BASE}/api/shipment-documents`, {
      headers: { ...getAuthHeaders() },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) return data
    }
  } catch (err) {
    console.warn("fetchAllShipmentDocs error:", err)
  }
  return []
}

/**
 * Fetches shipment documents for a specific record ID.
 */
export async function fetchDocumentsForRecord(recordId: string, recordType?: string): Promise<ShipmentDocAttachment[]> {
  if (!recordId) return []
  try {
    const url = new URL(`${API_BASE}/api/shipment-documents`, window.location.origin)
    url.searchParams.set("record_id", recordId)
    if (recordType) {
      url.searchParams.set("record_type", recordType)
    }
    const res = await fetch(url.toString(), {
      headers: { ...getAuthHeaders() },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) return data
    }
  } catch (err) {
    console.warn("fetchDocumentsForRecord error:", err)
  }
  return []
}

/**
 * Uploads/saves a shipment document payload to the backend REST API via JSON.
 */
export async function uploadShipmentDoc(doc: Partial<ShipmentDocAttachment>): Promise<ShipmentDocAttachment> {
  const payload: Partial<ShipmentDocAttachment> = {
    ...doc,
    file_size: doc.file_size || 102400,
    uploaded_at: doc.uploaded_at || new Date().toISOString(),
    uploaded_by: doc.uploaded_by || "System User",
  }

  const res = await fetch(`${API_BASE}/api/shipment-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Failed to upload shipment document (${res.status})`)
  }
  return res.json()
}

/**
 * Deletes a shipment document by ID.
 */
export async function deleteShipmentDoc(id: string): Promise<void> {
  if (!id) return
  try {
    await fetch(`${API_BASE}/api/shipment-documents/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    })
  } catch (err) {
    console.warn("deleteShipmentDoc warning:", err)
  }
}

/**
 * Resolves both Trade License and Payment Advice across any linked identifiers.
 * Cascades across Sales Order, Sales Issue, Invoice, and Customer Registry profile.
 */
export async function fetchTradeAndAdviceDocs(params: {
  customerId?: string
  customerName?: string
  salesOrderId?: string
  salesIssueId?: string
  invoiceId?: string
  fsNo?: string
}): Promise<{
  tradeLicense: DocumentInfo | null
  paymentAdvice: DocumentInfo | null
  allDocs: ShipmentDocAttachment[]
}> {
  const { customerId, customerName, salesOrderId, salesIssueId, invoiceId, fsNo } = params

  const searchIds = [salesOrderId, salesIssueId, invoiceId, fsNo, customerId].filter(Boolean) as string[]
  let attachedDocs: ShipmentDocAttachment[] = []

  if (searchIds.length > 0) {
    try {
      const allDocs = await fetchAllShipmentDocs()
      attachedDocs = allDocs.filter((d) => searchIds.includes(d.record_id))
    } catch {
      attachedDocs = []
    }
  }

  // 1. Resolve Payment Advice (Order/Issue/Invoice specific)
  let paymentAdvice: DocumentInfo | null = null
  const adviceDoc = attachedDocs.find(
    (d) =>
      d.document_type === "Payment Advice" ||
      d.document_type?.toLowerCase().includes("advice") ||
      d.file_name?.toLowerCase().includes("advice")
  )
  if (adviceDoc && adviceDoc.file_url) {
    paymentAdvice = {
      id: adviceDoc.id,
      name: adviceDoc.file_name,
      url: adviceDoc.file_url,
      uploadedAt: adviceDoc.uploaded_at,
      uploadedBy: adviceDoc.uploaded_by,
      fileSize: adviceDoc.file_size,
    }
  }

  // 2. Resolve Trade License / Bank Permit (Order/Issue specific or from Customer Registry)
  let tradeLicense: DocumentInfo | null = null
  const tradeDoc = attachedDocs.find(
    (d) =>
      d.document_type === "Bank Permit" ||
      d.document_type === "Trade License" ||
      d.document_type === "Trade Paper" ||
      d.document_type?.toLowerCase().includes("permit") ||
      d.file_name?.toLowerCase().includes("permit") ||
      d.file_name?.toLowerCase().includes("license")
  )

  if (tradeDoc && tradeDoc.file_url) {
    tradeLicense = {
      id: tradeDoc.id,
      name: tradeDoc.file_name,
      url: tradeDoc.file_url,
      uploadedAt: tradeDoc.uploaded_at,
      uploadedBy: tradeDoc.uploaded_by,
      fileSize: tradeDoc.file_size,
    }
  } else {
    // Fallback to customer profile in ERP store
    const customers = erpStore.getCustomers()
    const matchedCust = customers.find(
      (c) =>
        (customerId && c.id === customerId) ||
        (customerName && (c.name?.toLowerCase() === customerName.toLowerCase() || c.id === customerName))
    )

    if (matchedCust?.tradePaperUrl) {
      tradeLicense = {
        name: matchedCust.tradePaperFileName || "Permit Document.pdf",
        url: matchedCust.tradePaperUrl,
        uploadedAt: matchedCust.tradePaperUploadedAt || new Date().toISOString(),
        uploadedBy: matchedCust.name,
      }
    }
  }

  return {
    tradeLicense,
    paymentAdvice,
    allDocs: attachedDocs,
  }
}

/**
 * Persists a Trade License / Bank Permit across all linked records AND updates the customer registry profile in erpStore.
 */
export async function saveTradeLicense(params: {
  customerId?: string
  customerName?: string
  salesOrderId?: string
  salesIssueId?: string
  fileName: string
  fileUrl: string
  fileSize?: number
  uploadedBy?: string
  documentType?: string
}): Promise<void> {
  const { customerId, customerName, salesOrderId, salesIssueId, fileName, fileUrl, fileSize, uploadedBy, documentType } = params
  if (!fileName || !fileUrl) return

  const now = new Date().toISOString()
  const user = uploadedBy || "Sales Officer"
  const docType = documentType || "Trade License"

  // 1. Sync to Customer Registry in erpStore
  const customers = erpStore.getCustomers()
  const matchedCust = customers.find(
    (c) =>
      (customerId && c.id === customerId) ||
      (customerName && (c.name?.toLowerCase() === customerName.toLowerCase() || c.id === customerName))
  )

  if (matchedCust) {
    erpStore.updateCustomer(matchedCust.id, {
      tradePaperFileName: fileName,
      tradePaperUrl: fileUrl,
      tradePaperUploadedAt: now,
    })
  }

  // 2. Persist to shipment_documents table for all linked record IDs
  const recordsToSave: Array<{ id: string; type: ShipmentDocAttachment["record_type"] }> = []

  if (matchedCust?.id) {
    recordsToSave.push({ id: matchedCust.id, type: "customer" })
  }
  if (salesOrderId) {
    recordsToSave.push({ id: salesOrderId, type: "sales_order" })
  }
  if (salesIssueId) {
    recordsToSave.push({ id: salesIssueId, type: "sales_issue" })
  }

  await Promise.all(
    recordsToSave.map((rec) =>
      uploadShipmentDoc({
        record_id: rec.id,
        record_type: rec.type,
        document_type: docType,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize || 102400,
        uploaded_at: now,
        uploaded_by: user,
      }).catch((err) => console.warn(`Failed saving ${docType} for ${rec.id}:`, err))
    )
  )
}

/**
 * Persists a Payment Advice across Sales Order, Sales Issue, and Finance Invoice records simultaneously.
 */
export async function savePaymentAdvice(params: {
  salesOrderId?: string
  salesIssueId?: string
  invoiceId?: string
  fsNo?: string
  fileName: string
  fileUrl: string
  fileSize?: number
  uploadedBy?: string
}): Promise<void> {
  const { salesOrderId, salesIssueId, invoiceId, fsNo, fileName, fileUrl, fileSize, uploadedBy } = params
  if (!fileName || !fileUrl) return

  const now = new Date().toISOString()
  const user = uploadedBy || "Finance / Sales Officer"

  const recordsToSave: Array<{ id: string; type: ShipmentDocAttachment["record_type"] }> = []

  if (salesOrderId) {
    recordsToSave.push({ id: salesOrderId, type: "sales_order" })
  }
  if (salesIssueId) {
    recordsToSave.push({ id: salesIssueId, type: "sales_issue" })
  }
  if (fsNo && fsNo !== salesIssueId) {
    recordsToSave.push({ id: fsNo, type: "sales_issue" })
  }
  if (invoiceId) {
    recordsToSave.push({ id: invoiceId, type: "invoice" })
  }

  await Promise.all(
    recordsToSave.map((rec) =>
      uploadShipmentDoc({
        record_id: rec.id,
        record_type: rec.type,
        document_type: "Payment Advice",
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize || 102400,
        uploaded_at: now,
        uploaded_by: user,
      }).catch((err) => console.warn(`Failed saving Payment Advice for ${rec.id}:`, err))
    )
  )
}
