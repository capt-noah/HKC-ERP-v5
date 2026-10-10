import { API_BASE, getAuthHeaders } from "./apiPersistence"

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
 * Compresses an image file in-browser for high quality and compact storage.
 */
export async function compressImageIfPossible(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.85
): Promise<string> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL("image/jpeg", quality))
        } else {
          resolve(e.target?.result as string)
        }
      }
      img.onerror = () => resolve(e.target?.result as string)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve("")
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads a local file to the server storage organized under the specified folder category.
 * If the server is unreachable or responds with an error, it gracefully falls back to optimized DataURL encoding.
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder = "general",
  allowDataUrlFallback = false
): Promise<UploadResult> {
  const authHeaders = getAuthHeaders()

  const formData = new FormData()
  formData.append("folder", folder)
  formData.append("file", file)

  try {
    const uploadUrl = `${API_BASE}/api/upload?folder=${encodeURIComponent(folder)}`
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    })

    if (!res.ok) {
      let errorMsg = `Server responded with status ${res.status}`
      try {
        const errData = await res.json()
        if (errData?.error) errorMsg = errData.error
      } catch {}
      throw new Error(errorMsg)
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
    if (allowDataUrlFallback) {
      console.warn(`[FILE UPLOAD]: Server upload failed for ${file.name}, falling back to local encoding:`, error)
      const dataUrl = await compressImageIfPossible(file)
      return {
        url: dataUrl,
        filename: file.name,
        originalName: file.name,
        size: file.size,
        mimeType: file.type || "image/jpeg",
        folder,
      }
    }

    console.error(`[FILE UPLOAD]: Server upload failed for ${file.name}:`, error)
    throw error instanceof Error
      ? error
      : new Error(`Failed to upload ${file.name} to server storage.`)
  }
}

/**
 * Uploads a local file to server storage with real-time byte and percentage progress events.
 */
export function uploadFileWithProgress(
  file: File,
  folder: UploadFolder = "general",
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const authHeaders = getAuthHeaders()
    const formData = new FormData()
    formData.append("folder", folder)
    formData.append("file", file)

    const uploadUrl = `${API_BASE}/api/upload?folder=${encodeURIComponent(folder)}`
    const xhr = new XMLHttpRequest()

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort()
        reject(new Error("Upload aborted"))
      })
    }

    xhr.open("POST", uploadUrl)

    // Set auth headers
    for (const [key, value] of Object.entries(authHeaders)) {
      if (value) {
        xhr.setRequestHeader(key, value)
      }
    }

    // Set timeout to 90 seconds
    xhr.timeout = 90000

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
        onProgress(percent, event.loaded, event.total)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (onProgress) onProgress(100, file.size, file.size)
          resolve({
            url: data.url,
            filename: data.filename,
            originalName: data.originalName || file.name,
            size: data.size || file.size,
            mimeType: data.mimeType || file.type || "application/octet-stream",
            folder,
          })
        } catch (parseErr) {
          reject(new Error("Failed to parse server upload response"))
        }
      } else {
        let errorMsg = `Server responded with status ${xhr.status}`
        try {
          const errData = JSON.parse(xhr.responseText)
          if (errData.error) errorMsg = errData.error
        } catch {}
        reject(new Error(errorMsg))
      }
    }

    xhr.onerror = () => {
      reject(new Error(`Network error while uploading ${file.name}. Please check connection.`))
    }

    xhr.ontimeout = () => {
      reject(new Error(`Upload timed out for ${file.name}. Please retry.`))
    }

    xhr.send(formData)
  })
}

/**
 * Resolves a stored file URL into a fully accessible asset URL.
 * Handles both relative '/uploads/...' paths, data URLs, and full external URLs.
 */
export function resolveFileUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return ""
  const cleanUrl = url.trim()
  if (!cleanUrl) return ""
  if (cleanUrl.startsWith("data:") || cleanUrl.startsWith("blob:") || cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    return cleanUrl
  }
  if (cleanUrl.startsWith("/uploads/")) {
    return `${API_BASE}${cleanUrl}`
  }
  if (cleanUrl.startsWith("uploads/")) {
    return `${API_BASE}/${cleanUrl}`
  }
  return `${API_BASE}/${cleanUrl.replace(/^\//, "")}`
}
