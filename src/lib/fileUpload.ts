import { API_BASE } from "./apiPersistence"
import { useAuthStore } from "./authStore"

export type UploadFolder =
  | "customers"
  | "suppliers"
  | "sales_orders"
  | "sales_issued"
  | "purchase_orders"
  | "processing_services"
  | "employees"
  | "leave"
  | "invoices"
  | "hkc_docs"
  | "general"

export interface UploadResult {
  url: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  folder: UploadFolder
}

/**
 * Uploads a local file to the server storage organized under the specified folder category.
 * If the server is unreachable or responds with an error, it gracefully falls back to DataURL encoding.
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder = "general"
): Promise<UploadResult> {
  const token = useAuthStore.getState().token

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", folder)

  try {
    const headers: Record<string, string> = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers,
      body: formData,
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Server responded with status ${res.status}`)
    }

    const data = await res.json()
    return {
      url: data.url,
      filename: data.filename,
      originalName: data.originalName,
      size: data.size,
      mimeType: data.mimeType,
      folder,
    }
  } catch (error) {
    console.warn(`[FILE UPLOAD]: Server upload failed for ${file.name}, falling back to local encoding:`, error)
    
    // Resilient fallback to DataURL if server upload endpoint fails
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    return {
      url: dataUrl,
      filename: file.name,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      folder,
    }
  }
}

/**
 * Resolves a stored file URL into a fully accessible asset URL.
 * Handles both relative '/uploads/...' paths and full external URLs.
 */
export function resolveFileUrl(url?: string | null): string {
  if (!url) return ""
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  if (url.startsWith("/uploads/")) {
    return `${API_BASE}${url}`
  }
  return url
}
