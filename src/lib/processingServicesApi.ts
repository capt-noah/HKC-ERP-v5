export type ProcessingServiceStage = "Received" | "Processed" | "Delivered"

export interface StatusHistoryEntry {
  stage: ProcessingServiceStage
  timestamp: string
}

export interface ProcessingServiceOrder {
  id: string
  reference_number: string
  client_company_name: string
  customer_id?: string | null
  goods_description: string
  quantity: number
  uom: string
  entry_date: string
  agreed_price: number
  currency: string
  status: ProcessingServiceStage
  status_history: StatusHistoryEntry[]
  assigned_to: string
  invoice_id?: string | null
  notes?: string
  contract_url?: string | null
  contract_file_name?: string | null
  locked_processing_rate?: number | null
  locked_processing_fee?: number | null
  locked_storage_fee?: number | null
  locked_total_fee?: number | null
  processed_at?: string | null
  delivered_at?: string | null
  created_at?: string
  updated_at?: string
}

import { API_BASE, getAuthHeaders } from "./apiPersistence"
import { sortNewestFirst } from "./utils"

export async function fetchProcessingServices(status?: string): Promise<ProcessingServiceOrder[]> {
  try {
    const url = new URL(`${API_BASE}/api/processing-services`, window.location.origin)
    if (status && status !== "ALL") {
      url.searchParams.set("status", status)
    }
    const res = await fetch(url.toString(), {
      headers: { ...getAuthHeaders() },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) return sortNewestFirst(data)
    }
  } catch (err) {
    console.warn("fetchProcessingServices error:", err)
  }
  return []
}

export async function createProcessingService(payload: Partial<ProcessingServiceOrder>): Promise<ProcessingServiceOrder> {
  const res = await fetch(`${API_BASE}/api/processing-services`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to create processing service order.")
  }
  return res.json()
}

export async function updateProcessingService(id: string, payload: Partial<ProcessingServiceOrder>): Promise<ProcessingServiceOrder> {
  const res = await fetch(`${API_BASE}/api/processing-services/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to update processing service order.")
  }
  return res.json()
}

export async function transitionProcessingServiceStage(
  id: string,
  stage: ProcessingServiceStage,
  snapshotData?: {
    processingRate?: number
    processingFee?: number
    storageFee?: number
    totalFee?: number
    deliveryDate?: string
    [key: string]: any
  }
): Promise<{ ok: boolean; journalEntry?: unknown } & ProcessingServiceOrder> {
  const res = await fetch(`${API_BASE}/api/processing-services/${id}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ stage, ...(snapshotData || {}) }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to advance order to ${stage}.`)
  }
  return res.json()
}

export async function deleteProcessingService(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/processing-services/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to delete processing service order.")
  }
}

export async function uploadProcessingServiceContract(
  id: string,
  file: File
): Promise<ProcessingServiceOrder> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/processing-services/${id}/upload-contract`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            contract_url: reader.result as string,
            contract_file_name: file.name,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          reject(new Error(err.error || "Failed to upload contract."))
        } else {
          resolve(await res.json())
        }
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read contract file."))
    reader.readAsDataURL(file)
  })
}

