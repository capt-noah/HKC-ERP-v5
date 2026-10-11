import { API_BASE } from "./apiPersistence"

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

// Cloudinary Configuration (Unsigned direct browser upload preset)
const CLOUDINARY_CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dzoos2p9").trim()
const CLOUDINARY_UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "hkc_erp").trim()

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
 * For business documents, receipts, and screenshots, preserving original clarity and preventing
 * browser memory saturation is critical.
 * Authentic passthrough eliminates CPU/RAM canvas freezing on older PCs.
 */
export async function compressImageToFile(
  file: File,
  _maxWidth = 2560,
  _maxHeight = 1440,
  _quality = 0.88
): Promise<File> {
  return file
}

export const CHUNK_SIZE = 2 * 1024 * 1024 // 2 MB compatibility constant
export const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB max total file size
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
    return `File '${file.name}' (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 500 MB limit. Please select a smaller file.`
  }
  const extMatch = file.name.match(/\.[^.]+$/)
  const ext = extMatch ? extMatch[0].toLowerCase() : ""
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return `File type '${ext}' is not supported. Allowed formats: PDF, PNG, JPG, JPEG, WEBP, HEIC, DOCX, XLSX, CSV.`
  }
  return null
}

/**
 * Direct browser-to-cloud upload to Cloudinary.
 * Bypasses Phusion Passenger, Nginx proxy, and Plesk server completely.
 * Zero credit card required, 25 GB free storage, global high-speed CDN.
 */
async function uploadToCloudinary(
  file: File,
  folder: UploadFolder = "general",
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  const validationError = validateFileForUpload(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`

  const attemptUpload = (): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Upload aborted"))

      const formData = new FormData()
      formData.append("file", file)
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET)
      formData.append("folder", `hkc_${folder}`)

      const xhr = new XMLHttpRequest()

      const abortHandler = () => {
        xhr.abort()
        reject(new Error("Upload aborted"))
      }
      if (signal) {
        signal.addEventListener("abort", abortHandler, { once: true })
      }
      const cleanup = () => {
        if (signal) signal.removeEventListener("abort", abortHandler)
      }

      xhr.open("POST", uploadUrl)
      // 120s timeout ample for multi-megabyte files on any connection
      xhr.timeout = 120000

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.min(99, Math.round((e.loaded / e.total) * 100))
          onProgress(pct, e.loaded, e.total)
        }
      }

      xhr.onload = () => {
        cleanup()
        let data: any = null
        try {
          data = JSON.parse(xhr.responseText || "{}")
        } catch {}

        if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
          if (onProgress) onProgress(100, file.size, file.size)
          resolve({
            url: data.secure_url,
            filename: data.original_filename || file.name,
            originalName: file.name,
            size: data.bytes || file.size,
            mimeType: data.format ? `${data.resource_type || "file"}/${data.format}` : (file.type || "application/octet-stream"),
            folder,
          })
        } else {
          const errMsg = data?.error?.message || `Cloudinary upload failed with status ${xhr.status}`
          reject(new Error(errMsg))
        }
      }

      xhr.onerror = () => {
        cleanup()
        reject(new Error(`Network error uploading ${file.name}. Please check internet connection.`))
      }

      xhr.ontimeout = () => {
        cleanup()
        reject(new Error(`Upload timed out for ${file.name}. Please retry.`))
      }

      xhr.onabort = () => {
        cleanup()
        reject(new Error("Upload aborted"))
      }

      xhr.send(formData)
    })
  }

  // Graceful single-retry on transient network drop
  try {
    return await attemptUpload()
  } catch (err: any) {
    if (signal?.aborted) throw err
    console.warn(`[CLOUDINARY UPLOAD]: First attempt for ${file.name} failed (${err.message}), retrying once in 1.5s...`)
    await new Promise((r) => setTimeout(r, 1500))
    if (signal?.aborted) throw new Error("Upload aborted")
    return await attemptUpload()
  }
}

/**
 * Uploads large or standard files. Delegates to Cloudinary direct upload.
 */
export async function uploadFileChunked(
  file: File,
  folder: UploadFolder = "general",
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  return uploadToCloudinary(file, folder, onProgress, signal)
}

/**
 * Uploads a local file directly to high-speed cloud storage.
 * Bypasses Plesk / Passenger server completely to prevent 502/memory crashes.
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder = "general",
  _legacyFallback?: boolean
): Promise<UploadResult> {
  return uploadToCloudinary(file, folder)
}

/**
 * Uploads a file with real-time progress callbacks and cancellation signal.
 */
export async function uploadFileWithProgress(
  file: File,
  folder: UploadFolder = "general",
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  return uploadToCloudinary(file, folder, onProgress, signal)
}

export interface ConcurrentUploadOptions {
  maxConcurrency?: number
  onProgress?: (completedCount: number, totalCount: number, currentFileName: string) => void
  onFileSuccess?: (result: UploadResult, file: File, index: number) => void
  onFileError?: (error: Error, file: File, index: number) => void
  signal?: AbortSignal
}

/**
 * Uploads multiple files concurrently to Cloudinary.
 * Runs with controlled concurrency to respect browser network sockets,
 * committing each file progressively so no successful upload is lost.
 */
export async function uploadFilesConcurrently(
  files: File[],
  folder: UploadFolder = "general",
  optionsOrConcurrency: number | ConcurrentUploadOptions = 2,
  legacyOnProgress?: (completedCount: number, totalCount: number, currentFileName: string) => void,
  legacySignal?: AbortSignal
): Promise<UploadResult[]> {
  if (!files || files.length === 0) return []

  const options: ConcurrentUploadOptions =
    typeof optionsOrConcurrency === "object"
      ? optionsOrConcurrency
      : {
          maxConcurrency: optionsOrConcurrency,
          onProgress: legacyOnProgress,
          signal: legacySignal,
        }

  const maxConcurrency = Math.max(1, options.maxConcurrency ?? 2)
  const signal = options.signal

  const succeeded: UploadResult[] = []
  const failed: { file: File; error: string; index: number }[] = []
  let currentIndex = 0
  let completedCount = 0

  const worker = async (): Promise<void> => {
    while (currentIndex < files.length) {
      if (signal?.aborted) throw new Error("Upload aborted by user")
      const index = currentIndex++
      const file = files[index]

      if (options.onProgress) {
        options.onProgress(completedCount, files.length, file.name)
      }

      try {
        const res = await uploadFile(file, folder)
        succeeded.push(res)
        completedCount++
        if (options.onFileSuccess) {
          options.onFileSuccess(res, file, index)
        }
        if (options.onProgress) {
          options.onProgress(completedCount, files.length, file.name)
        }
      } catch (err: any) {
        const errMsg = err?.message || `Failed to upload ${file.name}`
        console.warn(`[BATCH UPLOAD ITEM FAILED]: ${file.name} - ${errMsg}`)
        failed.push({ file, error: errMsg, index })
        if (options.onFileError) {
          options.onFileError(err instanceof Error ? err : new Error(errMsg), file, index)
        }
      }
    }
  }

  const workerCount = Math.min(maxConcurrency, files.length)
  const workers = Array.from({ length: workerCount }, () => worker())
  await Promise.all(workers)

  if (succeeded.length === 0 && failed.length > 0) {
    throw new Error(failed[0].error || "Failed to upload files.")
  }

  return succeeded
}

/**
 * Resolves a stored file URL into a fully accessible asset URL.
 * Transparently supports Cloudinary CDN URLs, data/blob URLs, and legacy '/uploads/...' paths.
 */
export function resolveFileUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return ""
  const cleanUrl = url.trim()
  if (!cleanUrl) return ""
  if (
    cleanUrl.startsWith("data:") ||
    cleanUrl.startsWith("blob:") ||
    cleanUrl.startsWith("http://") ||
    cleanUrl.startsWith("https://")
  ) {
    return cleanUrl
  }
  if (cleanUrl.startsWith("/uploads/")) {
    return `${API_BASE}${cleanUrl}`
  }
  if (cleanUrl.startsWith("uploads/")) {
    return `${API_BASE}/${cleanUrl}`
  }
  return `${API_BASE}/uploads/${cleanUrl}`
}
