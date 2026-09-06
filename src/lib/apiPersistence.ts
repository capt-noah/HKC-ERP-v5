import { handleAuthExpiry } from "./authStore"

type Identified = { id?: string }

// In local dev & Plesk single-server deployments, API_BASE is empty so requests use relative paths (/api/...)
// In separate frontend deployments (e.g. Vercel), VITE_API_URL is set to the remote backend URL (e.g. https://hkc-erp-api.onrender.com).
const rawApiUrl = (typeof import.meta !== "undefined" && import.meta.env ? (import.meta.env.VITE_API_URL ?? "") : "").trim()
export const API_BASE = (rawApiUrl === "http://localhost:3000" || rawApiUrl === "http://127.0.0.1:3000" || !rawApiUrl) ? "" : rawApiUrl.replace(/\/$/, "")

function itemId(item: Identified, fallbackIndex: number) {
  return item.id ? String(item.id) : `row-${fallbackIndex + 1}`
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

function normalizeSingle<T>(body: unknown): T {
  return (Array.isArray(body) ? body[0] : body) as T
}

function errorMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body) {
    if ("message" in body) return String(body.message)
    if ("error" in body) return String(body.error)
  }
  if (typeof body === "string" && body.trim()) return body
  return fallback
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  try {
    const raw = localStorage.getItem("auth-storage")
    if (raw) {
      const parsed = JSON.parse(raw)
      const token = parsed?.state?.token
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
    }
  } catch {}
  return headers
}

export async function loadResource<T>(resource: string): Promise<T[]> {
  const authHeaders = getAuthHeaders()
  if (!authHeaders["Authorization"]) {
    return []
  }

  const response = await fetch(`${API_BASE}/api/${resource}`, {
    headers: {
      ...authHeaders,
    },
  })
  const body = await parseResponse(response)

  if (!response.ok) {
    if (response.status === 401 || (response.status === 403 && typeof body === "object" && body && "error" in body && /token|expired/i.test(String(body.error)))) {
      handleAuthExpiry()
      return []
    }
    throw new Error(errorMessage(body, `Failed to load ${resource}.`))
  }

  if (Array.isArray(body)) {
    return body as T[]
  }
  if (body && typeof body === "object" && Array.isArray((body as any).rows)) {
    return (body as any).rows as T[]
  }
  return []
}

export async function replaceResource<T extends Identified>(resource: string, items: T[]) {
  const authHeaders = getAuthHeaders()
  const response = await fetch(`${API_BASE}/api/${resource}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(items.map((item, index) => ({ ...item, id: itemId(item, index) }))),
  })
  const body = await parseResponse(response)

  if (!response.ok) {
    throw new Error(errorMessage(body, `Failed to save ${resource}.`))
  }
}

export async function createResource<T extends Identified>(resource: string, item: T) {
  const authHeaders = getAuthHeaders()
  const response = await fetch(`${API_BASE}/api/${resource}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(item),
  })
  const body = await parseResponse(response)

  if (!response.ok) {
    throw new Error(errorMessage(body, `Failed to create ${resource}.`))
  }

  return normalizeSingle<T>(body)
}

export async function updateResource<T extends Identified>(resource: string, id: string, item: Partial<T>) {
  const authHeaders = getAuthHeaders()
  const response = await fetch(`${API_BASE}/api/${resource}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(item),
  })
  const body = await parseResponse(response)

  if (!response.ok) {
    throw new Error(errorMessage(body, `Failed to update ${resource}.`))
  }

  return normalizeSingle<T>(body)
}

export async function deleteResource(resource: string, id: string) {
  const authHeaders = getAuthHeaders()
  const response = await fetch(`${API_BASE}/api/${resource}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      ...authHeaders,
    },
  })
  const body = await parseResponse(response)

  if (!response.ok) {
    throw new Error(errorMessage(body, `Failed to delete ${resource}.`))
  }
}

export function persistResources(resources: Array<{ resource: string; items: Identified[] }>) {
  return Promise.all(resources.map(({ resource, items }) => replaceResource(resource, items))).then(() => undefined)
}
