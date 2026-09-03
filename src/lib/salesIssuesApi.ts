import { API_BASE, getAuthHeaders } from "./apiPersistence"

export type SalesIssueStatus = "Draft" | "Posted" | "Cancelled"
export type PaymentType = "Cash" | "Credit"

export interface SalesIssueItem {
  id?: string
  sales_issue_id?: string
  item_id: string
  item_name: string
  batch_id: string
  batch_no: string
  packaging_unit?: string
  available_quantity?: number
  quantity: number
  unit_price: number
  amount: number
}

export interface SalesIssue {
  id: string
  fs_no: string
  reference_no: string
  sale_date: string
  customer_id: string
  customer_name: string
  warehouse_id: string
  payment_type: PaymentType
  status: SalesIssueStatus
  total_quantity: number
  subtotal?: number
  vat_rate?: number
  vat_amount?: number
  total_amount: number
  amount_paid?: number
  balance_due?: number
  payment_status?: string
  settlement_status?: "Unpaid" | "Ongoing" | "Fully Settled"
  created_by: string
  posted_by?: string | null
  posted_at?: string | null
  items?: SalesIssueItem[]
}

export interface AvailableBatch {
  batch_id: string
  batch_no: string
  item_id: string
  item_name: string
  warehouse_id: string
  available_quantity: number
  manufacturing_date?: string
  expiry: string
  expiry_date?: string
  packaging_unit: string
  unit_price: number
  unit_cost?: number
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

export async function listSalesIssues(params: URLSearchParams) {
  const result = await api<any>(`/api/sales-issues?${params.toString()}`)
  if (Array.isArray(result)) {
    return { rows: result as SalesIssue[], total: result.length, page: 1, pageSize: result.length }
  }
  return {
    rows: Array.isArray(result?.rows) ? (result.rows as SalesIssue[]) : [],
    total: typeof result?.total === "number" ? result.total : 0,
    page: result?.page || 1,
    pageSize: result?.pageSize || 20,
  }
}

export function getSalesIssue(id: string) {
  return api<SalesIssue>(`/api/sales-issues/${encodeURIComponent(id)}`)
}

export function createSalesIssue(issue: Partial<SalesIssue> & { items: SalesIssueItem[] }) {
  return api<SalesIssue>("/api/sales-issues", {
    method: "POST",
    body: JSON.stringify(issue),
  })
}

export function updateSalesIssue(id: string, issue: Partial<SalesIssue> & { items: SalesIssueItem[] }) {
  return api<SalesIssue>(`/api/sales-issues/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(issue),
  })
}

export function postSalesIssue(id: string) {
  return api<{ id: string; status: SalesIssueStatus }>(`/api/sales-issues/${encodeURIComponent(id)}/post`, { method: "POST" })
}

export function cancelSalesIssue(id: string) {
  return api<SalesIssue>(`/api/sales-issues/${encodeURIComponent(id)}/cancel`, { method: "POST" })
}

export function deleteSalesIssue(id: string) {
  return api<{ ok: true }>(`/api/sales-issues/${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function getAvailableBatches(itemId: string, warehouseId: string) {
  const params = new URLSearchParams({ item_id: itemId, warehouse_id: warehouseId })
  return api<AvailableBatch[]>(`/api/sales-issues/batches?${params.toString()}`)
}
