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
 * Compresses an image file in-browser into an optimized, compact File object.
 * Reduces 5-15MB camera photos down to ~200-400KB before uploading to prevent
 * Nginx HTTP/2 protocol errors (client_max_body_size), proxy buffer stalls, and timeouts.
 */
export async function compressImageToFile(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.85
): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file
  }
  // Keep tiny images / SVGs / GIFs untouched
  if (file.size <= 350 * 1024 || file.type.includes("svg") || file.type.includes("gif")) {
    return file
  }

  return new Promise<File>((resolve) => {
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
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const cleanName = file.name.replace(/\.[^.]+$/, ".jpg")
                const compressedFile = new File([blob], cleanName, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                })
                resolve(compressedFile)
              } else {
                resolve(file)
              }
            },
            "image/jpeg",
            quality
          )
        } else {
          resolve(file)
        }
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".heic",
  ".heif",
  ".tiff",
  ".tif",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
])

export function validateFileForUpload(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File '${file.name}' (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB limit. Please select a smaller file.`
  }
  const extMatch = file.name.match(/\.[^.]+$/)
  const ext = extMatch ? extMatch[0].toLowerCase() : ""
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return `File type '${ext}' is not supported. Allowed formats: PDF, PNG, JPG, JPEG, WEBP, HEIC, DOCX, XLSX, CSV.`
  }
  return null
}

/**
 * Uploads a local file to server storage organized under the specified folder category.
 * Enforces client-side validation, in-browser compression, and safe 1-shot retry.
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder = "general",
  _legacyFallback?: boolean
): Promise<UploadResult> {
  const validationError = validateFileForUpload(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const attemptUpload = async (): Promise<UploadResult> => {
    const authHeaders = getAuthHeaders()
    const processedFile = file.type.startsWith("image/") ? await compressImageToFile(file) : file

    const formData = new FormData()
    formData.append("folder", folder)
    formData.append("file", processedFile)

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
      originalName: data.originalName || file.name,
      size: data.size || file.size,
      mimeType: data.mimeType || file.type || "application/octet-stream",
      folder,
    }
  }

  try {
    return await attemptUpload()
  } catch (firstError) {
    console.warn(`[FILE UPLOAD]: First attempt failed for ${file.name}, retrying in 1s...`, firstError)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    try {
      return await attemptUpload()
    } catch (secondError) {
      console.error(`[FILE UPLOAD]: Server upload permanently failed for ${file.name}:`, secondError)
      throw secondError instanceof Error
        ? secondError
        : new Error(`Failed to upload ${file.name} to server storage.`)
    }
  }
}

/**
 * Uploads a local file to server storage with real-time byte and percentage progress events.
 */
export async function uploadFileWithProgress(
  file: File,
  folder: UploadFolder = "general",
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  validateFileForUpload(file)
  const processedFile = file.type.startsWith("image/") ? await compressImageToFile(file) : file

  return new Promise((resolve, reject) => {
    const authHeaders = getAuthHeaders()
    const formData = new FormData()
    formData.append("folder", folder)
    formData.append("file", processedFile)

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
 * Uploads multiple files with a strict concurrency ceiling (default max 2)
 * to prevent saturating Nginx proxy buffers or starving server event loops.
 */
export async function uploadFilesConcurrently(
  files: File[],
  folder: UploadFolder = "general",
  maxConcurrency = 2,
  onProgress?: (completedCount: number, totalCount: number, currentFileName: string) => void,
  signal?: AbortSignal
): Promise<UploadResult[]> {
  if (!files || files.length === 0) return []
  const results: UploadResult[] = new Array(files.length)
  let currentIndex = 0
  let completedCount = 0

  const worker = async (): Promise<void> => {
    while (currentIndex < files.length) {
      if (signal?.aborted) throw new Error("Upload aborted by user")
      const index = currentIndex++
      const file = files[index]
      if (onProgress) onProgress(completedCount, files.length, file.name)

      const res = await uploadFile(file, folder)
      results[index] = res
      completedCount++
      if (onProgress) onProgress(completedCount, files.length, file.name)
    }
  }

  const workerCount = Math.min(maxConcurrency, files.length)
  const workers = Array.from({ length: workerCount }, () => worker())
  await Promise.all(workers)

  return results
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
