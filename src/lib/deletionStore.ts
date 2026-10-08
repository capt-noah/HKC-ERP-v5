import { create } from "zustand"
import { API_BASE, getAuthHeaders } from "./apiPersistence"

export interface DeletionEligibility {
  canDelete: boolean
  isPermanentlyBlocked: boolean
  salesCount?: number
  reason: string
}

export interface DeletionRequest {
  id: string
  resource_type: string
  record_id: string
  record_name: string
  warehouse_id?: string
  reason: string
  requested_by_id?: string
  requested_by_name: string
  status: "Pending" | "Executed" | "Rejected"
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  record_snapshot?: any
  created_at: string
  updated_at: string
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = getAuthHeaders()
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers || {}),
    },
  })
  const body = await parseResponse(response)
  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Request failed with ${response.status}`)
  }
  return body as T
}

export async function checkRecordEligibility(resource: string, id: string): Promise<DeletionEligibility> {
  const params = new URLSearchParams({ resource, id })
  return await api<DeletionEligibility>(`/api/deletion-requests/check-eligibility?${params.toString()}`)
}

export async function submitDeletionRequest(data: {
  resource_type: string
  record_id: string
  record_name?: string
  warehouse_id?: string
  reason: string
}): Promise<{ id: string; status: string; message: string }> {
  return await api<{ id: string; status: string; message: string }>("/api/deletion-requests", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function fetchDeletionRequests(params?: { status?: string }): Promise<DeletionRequest[]> {
  const query = params?.status ? `?status=${encodeURIComponent(params.status)}` : ""
  return await api<DeletionRequest[]>(`/api/deletion-requests${query}`)
}

export async function approveDeletionRequest(id: string): Promise<{ success: boolean; message: string }> {
  return await api<{ success: boolean; message: string }>(`/api/deletion-requests/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  })
}

export async function rejectDeletionRequest(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
  return await api<{ success: boolean; message: string }>(`/api/deletion-requests/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

interface DeletionStoreState {
  requests: DeletionRequest[]
  pendingCount: number
  isLoading: boolean
  error: string | null
  fetchRequests: (status?: string) => Promise<void>
  approve: (id: string) => Promise<{ success: boolean; message: string }>
  reject: (id: string, reason?: string) => Promise<{ success: boolean; message: string }>
}

export const useDeletionStore = create<DeletionStoreState>((set, get) => ({
  requests: [],
  pendingCount: 0,
  isLoading: false,
  error: null,

  fetchRequests: async (status?: string) => {
    set({ isLoading: true, error: null })
    try {
      const data = await fetchDeletionRequests(status ? { status } : undefined)
      const pending = data.filter((r) => r.status === "Pending").length
      set({ requests: data, pendingCount: pending, isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  approve: async (id: string) => {
    const res = await approveDeletionRequest(id)
    await get().fetchRequests()
    return res
  },

  reject: async (id: string, reason?: string) => {
    const res = await rejectDeletionRequest(id, reason)
    await get().fetchRequests()
    return res
  },
}))
