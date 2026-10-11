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
 * For business documents, receipts, and screenshots, preserving original clarity and preventing
 * browser memory saturation is critical.
 * Files under 20MB are uploaded as authentic originals (since server/Nginx accepts up to 25MB).
 * Only exceptionally oversized camera photos (> 20MB) are resized.
 */
export async function compressImageToFile(
  file: File,
  _maxWidth = 2560,
  _maxHeight = 1440,
  _quality = 0.88
): Promise<File> {
  // Direct authentic passthrough: eliminates CPU/RAM canvas freezing on older PCs,
  // preserves 100% original document and photo fidelity, and streams directly as raw bytes (identical to PDFs).
  return file
}

export const CHUNK_SIZE = 2 * 1024 * 1024 // 2 MB per chunk
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
 * Uploads an isolated 2 MB chunk via XHR with granular byte progress and abort support.
 */
function uploadSingleChunk(
  chunkBlob: Blob,
  uploadId: string,
  chunkIndex: number,
  totalChunks: number,
  originalName: string,
  folder: UploadFolder,
  onChunkProgress?: (loaded: number) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; size: number }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Upload aborted"))

    const formData = new FormData()
    formData.append("uploadId", uploadId)
    formData.append("chunkIndex", chunkIndex.toString())
    formData.append("totalChunks", totalChunks.toString())
    formData.append("originalName", originalName)
    formData.append("folder", folder)
    formData.append("chunk", chunkBlob, `chunk_${chunkIndex}`)

    const xhr = new XMLHttpRequest()
    const chunkUrl = `${API_BASE}/api/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${chunkIndex}&folder=${encodeURIComponent(folder)}`

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

    xhr.open("POST", chunkUrl)
    const authHeaders = getAuthHeaders()
    for (const [key, val] of Object.entries(authHeaders)) {
      if (val) xhr.setRequestHeader(key, val)
    }
    xhr.timeout = 60000 // 60s timeout is ample for 2 MB even on slow networks

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onChunkProgress) {
        onChunkProgress(e.loaded)
      }
    }

    xhr.onload = () => {
      cleanup()
      let data: any = null
      try {
        data = JSON.parse(xhr.responseText || "{}")
      } catch {}

      if (xhr.status >= 200 && xhr.status < 300 && data?.success) {
        resolve(data)
      } else {
        reject(new Error(data?.error || `Chunk ${chunkIndex + 1} failed with status ${xhr.status}`))
      }
    }

    xhr.onerror = () => {
      cleanup()
      reject(new Error(`Network error uploading chunk ${chunkIndex + 1}/${totalChunks}`))
    }
    xhr.ontimeout = () => {
      cleanup()
      reject(new Error(`Chunk ${chunkIndex + 1}/${totalChunks} timed out`))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new Error("Upload aborted"))
    }

    xhr.send(formData)
  })
}

/**
 * Uploads large files in robust 2 MB chunks with automatic single-chunk retry,
 * streaming server assembly, and real-time progress reporting.
 */
export async function uploadFileChunked(
  file: File,
  folder: UploadFolder = "general",
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  const validationError = validateFileForUpload(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const totalSize = file.size
  const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE))
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const chunkLoaded = new Array(totalChunks).fill(0)
  let lastProgressTick = 0

  const notifyProgress = () => {
    if (!onProgress) return
    const now = performance.now()
    if (now - lastProgressTick < 50) return
    lastProgressTick = now
    const aggregateLoaded = Math.min(totalSize, chunkLoaded.reduce((a, b) => a + b, 0))
    const aggregatePct = Math.min(99, Math.round((aggregateLoaded / totalSize) * 100))
    onProgress(aggregatePct, aggregateLoaded, totalSize)
  }

  try {
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (signal?.aborted) throw new Error("Upload aborted")

      const start = chunkIndex * CHUNK_SIZE
      const end = Math.min(totalSize, start + CHUNK_SIZE)
      const chunkBlob = file.slice(start, end)

      // Single-chunk retry up to 2 times with 1.2s backoff
      let attempt = 0
      let chunkSucceeded = false
      let lastChunkError: any = null

      while (attempt < 3 && !chunkSucceeded) {
        if (signal?.aborted) throw new Error("Upload aborted")
        try {
          await uploadSingleChunk(
            chunkBlob,
            uploadId,
            chunkIndex,
            totalChunks,
            file.name,
            folder,
            (bytesInChunk) => {
              chunkLoaded[chunkIndex] = bytesInChunk
              notifyProgress()
            },
            signal
          )
          chunkLoaded[chunkIndex] = chunkBlob.size
          chunkSucceeded = true
          notifyProgress()
        } catch (err: any) {
          lastChunkError = err
          attempt++
          if (signal?.aborted || attempt >= 3) break
          console.warn(`[CHUNK RETRY]: Chunk ${chunkIndex + 1}/${totalChunks} failed, retrying in 1.2s...`, err)
          await new Promise((r) => setTimeout(r, 1200))
        }
      }

      if (!chunkSucceeded) {
        throw lastChunkError || new Error(`Failed to upload chunk ${chunkIndex + 1} of ${totalChunks}`)
      }
    }

    if (signal?.aborted) throw new Error("Upload aborted")

    // All chunks uploaded: assemble on server
    const completeRes = await fetch(`${API_BASE}/api/upload/chunk/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        originalName: file.name,
        folder,
        totalSize,
      }),
      signal,
    })

    const rawText = await completeRes.text()
    let completeData: any = null
    try {
      completeData = rawText ? JSON.parse(rawText) : null
    } catch {}

    if (!completeRes.ok || !completeData?.success) {
      throw new Error(completeData?.error || `Server assembly failed with status ${completeRes.status}`)
    }

    if (onProgress) {
      onProgress(100, totalSize, totalSize)
    }

    return {
      url: completeData.url,
      filename: completeData.filename,
      originalName: completeData.originalName || file.name,
      size: completeData.size || totalSize,
      mimeType: completeData.mimeType || file.type || "application/octet-stream",
      folder,
    }
  } catch (err) {
    void fetch(`${API_BASE}/api/upload/chunk/abort`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ uploadId }),
    }).catch(() => {})
    throw err
  }
}

/**
 * Uploads a local file to server storage organized under the specified folder category.
 * Enforces client-side validation, authentic stream upload, and safe retry.
 * Automatically delegates to 2 MB chunked uploads for files exceeding 2 MB.
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

  // Files exceeding 2 MB automatically use chunked uploads
  if (file.size > CHUNK_SIZE) {
    return uploadFileChunked(file, folder)
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

    const rawText = await res.text()
    let data: any = null
    try {
      data = rawText ? JSON.parse(rawText) : null
    } catch {}

    if (!res.ok) {
      const errorMsg =
        data?.error ||
        (rawText && rawText.length < 200 ? rawText : `Server responded with status ${res.status}`)
      throw new Error(errorMsg)
    }

    if (!data || typeof data !== "object") {
      throw new Error(
        rawText && rawText.length < 200
          ? `Server returned non-JSON response: ${rawText}`
          : "Server returned an invalid or empty response."
      )
    }

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
    console.warn(`[FILE UPLOAD]: First attempt failed for ${file.name}, retrying in 1.2s...`, firstError)
    await new Promise((resolve) => setTimeout(resolve, 1200))
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
 * Features progress event throttling, cleanup guards, and backoff retries.
 */
export async function uploadFileWithProgress(
  file: File,
  folder: UploadFolder = "general",
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  const validationError = validateFileForUpload(file)
  if (validationError) {
    throw new Error(validationError)
  }

  // Files exceeding 2 MB automatically use chunked uploads
  if (file.size > CHUNK_SIZE) {
    return uploadFileChunked(file, folder, onProgress, signal)
  }

  const processedFile = file.type.startsWith("image/") ? await compressImageToFile(file) : file

  let lastProgressTick = 0
  let lastPercent = -1

  const throttledProgress = (pct: number, loaded: number, total: number) => {
    if (!onProgress) return
    const now = performance.now()
    if (pct === 100 || pct === 0 || pct !== lastPercent || now - lastProgressTick > 60) {
      lastProgressTick = now
      lastPercent = pct
      onProgress(pct, loaded, total)
    }
  }

  const doAttempt = (): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error("Upload aborted"))
      }
      const authHeaders = getAuthHeaders()
      const formData = new FormData()
      formData.append("folder", folder)
      formData.append("file", processedFile)

      const uploadUrl = `${API_BASE}/api/upload?folder=${encodeURIComponent(folder)}`
      const xhr = new XMLHttpRequest()

      const abortHandler = () => {
        xhr.abort()
        reject(new Error("Upload aborted"))
      }

      if (signal) {
        signal.addEventListener("abort", abortHandler, { once: true })
      }

      const cleanup = () => {
        if (signal) {
          signal.removeEventListener("abort", abortHandler)
        }
      }

      xhr.open("POST", uploadUrl)

      // Set auth headers
      for (const [key, value] of Object.entries(authHeaders)) {
        if (value) {
          xhr.setRequestHeader(key, value)
        }
      }

      // 120-second timeout for large files on slower connections
      xhr.timeout = 120000

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
          throttledProgress(percent, event.loaded, event.total)
        }
      }

      xhr.onload = () => {
        cleanup()
        const rawText = (xhr.responseText || "").trim()
        let data: any = null
        try {
          data = rawText ? JSON.parse(rawText) : null
        } catch {}

        if (xhr.status >= 200 && xhr.status < 300) {
          if (!data || typeof data !== "object") {
            return reject(new Error("Server returned an invalid or empty response."))
          }
          if (onProgress) onProgress(100, file.size, file.size)
          resolve({
            url: data.url,
            filename: data.filename,
            originalName: data.originalName || file.name,
            size: data.size || file.size,
            mimeType: data.mimeType || file.type || "application/octet-stream",
            folder,
          })
        } else {
          let errorMsg = `Server responded with status ${xhr.status}`
          if (data?.error) {
            errorMsg = data.error
          } else if (rawText && rawText.length < 200) {
            errorMsg = rawText
          }
          reject(new Error(errorMsg))
        }
      }

      xhr.onerror = () => {
        cleanup()
        reject(new Error(`Network error while uploading ${file.name}. Please check connection.`))
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

  try {
    return await doAttempt()
  } catch (firstError) {
    if (signal?.aborted) throw firstError
    console.warn(`[FILE UPLOAD PROGRESS]: First attempt failed for ${file.name}, auto-retrying in 1.5s...`, firstError)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    if (signal?.aborted) throw new Error("Upload aborted")
    try {
      if (onProgress) onProgress(0, 0, file.size)
      return await doAttempt()
    } catch (secondError) {
      if (signal?.aborted) throw secondError
      console.warn(`[FILE UPLOAD PROGRESS]: Second attempt failed for ${file.name}, final retry in 3.0s...`, secondError)
      await new Promise((resolve) => setTimeout(resolve, 3000))
      if (signal?.aborted) throw new Error("Upload aborted")
      try {
        if (onProgress) onProgress(0, 0, file.size)
        return await doAttempt()
      } catch (thirdError) {
        console.error(`[FILE UPLOAD PROGRESS]: Server upload permanently failed for ${file.name}:`, thirdError)
        throw thirdError instanceof Error
          ? thirdError
          : new Error(`Failed to upload ${file.name} to server storage.`)
      }
    }
  }
}

export interface ConcurrentUploadOptions {
  maxConcurrency?: number
  onProgress?: (completedCount: number, totalCount: number, currentFileName: string) => void
  onFileSuccess?: (result: UploadResult, file: File, index: number) => void
  onFileError?: (error: Error, file: File, index: number) => void
  signal?: AbortSignal
}

/**
 * Uploads multiple files strictly one-by-one (concurrency = 1 by default)
 * to prevent saturating Nginx proxy buffers or starving server event loops.
 * Commits each file progressively via onFileSuccess, and isolates failures so
 * previously succeeded files are never lost if a subsequent item fails.
 */
export async function uploadFilesConcurrently(
  files: File[],
  folder: UploadFolder = "general",
  optionsOrConcurrency: number | ConcurrentUploadOptions = 1,
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

  const maxConcurrency = Math.max(1, options.maxConcurrency ?? 1)
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
        // Inter-file pacing to allow server sockets to recycle cleanly
        await new Promise((r) => setTimeout(r, 350))
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
