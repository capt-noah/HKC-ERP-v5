import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { Router } from "express"
import multer from "multer"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const uploadRouter = Router()

// Allowed upload folder categories
const ALLOWED_FOLDERS = new Set([
  "customers",
  "suppliers",
  "sales_orders",
  "sales_issued",
  "purchase_orders",
  "processing_services",
  "employees",
  "leave",
  "invoices",
  "hkc_docs",
  "general",
])

// Base uploads root directory (guaranteed relative to project root)
const UPLOADS_ROOT = path.resolve(__dirname, "../../uploads")
const CHUNKS_ROOT = path.join(UPLOADS_ROOT, ".chunks")
try {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true })
  }
  if (!fs.existsSync(CHUNKS_ROOT)) {
    fs.mkdirSync(CHUNKS_ROOT, { recursive: true })
  }
} catch (err) {
  console.warn("[UPLOADS_ROOT INIT NOTICE]:", err.message)
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      let rawFolder = (req.query?.folder || req.body?.folder || "general").toString().toLowerCase().trim()
      let folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : "general"

      const targetDir = path.join(UPLOADS_ROOT, folder)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      cb(null, targetDir)
    } catch (err) {
      console.error("[STORAGE DESTINATION ERROR]:", err)
      cb(err)
    }
  },
  filename: (_req, file, cb) => {
    try {
      const ext = (path.extname(file.originalname) || "").toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 10)
      const basename = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 50)
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const safeFilename = `${uniqueSuffix}-${basename || "file"}${ext}`
      cb(null, safeFilename)
    } catch (err) {
      console.error("[STORAGE FILENAME ERROR]:", err)
      cb(err)
    }
  },
})

// File filter for acceptable business documents and media
const fileFilter = (_req, file, cb) => {
  const allowedExts = new Set([
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".heic",
    ".heif",
    ".tiff",
    ".tif",
    ".jfif",
    ".bmp",
    ".svg",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
  ])
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowedExts.has(ext)) {
    cb(null, true)
  } else {
    cb(new Error(`File type '${ext}' is not allowed. Allowed types: PDF, PNG, JPG, JPEG, WEBP, HEIC, DOCX, XLSX, CSV.`))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit per file
  },
})

/**
 * POST /api/upload
 * Single file upload handler with hardened lifecycle, verified disk write, and zero connection leaks
 */
uploadRouter.post("/upload", (req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "*")

  // Ensure request has a reasonable socket timeout (2 minutes)
  req.setTimeout?.(120000)

  upload.single("file")(req, res, (err) => {
    // If response was already sent or client aborted TCP socket connection
    if (res.writableEnded || res.destroyed || (res.socket && !res.socket.writable)) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {})
      }
      return
    }

    if (err) {
      console.warn("[UPLOAD HANDLER ERROR]:", err.message)
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {})
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` })
      }
      return res.status(400).json({ success: false, error: err.message || "File upload failed" })
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file was uploaded" })
    }

    try {
      // Verify file is genuinely written and non-empty on disk
      if (!fs.existsSync(req.file.path)) {
        throw new Error("File write verification failed on server.")
      }
      const stat = fs.statSync(req.file.path)
      if (stat.size === 0) {
        fs.unlink(req.file.path, () => {})
        throw new Error("Uploaded file is empty (0 bytes).")
      }

      const destinationDir = req.file.destination || ""
      const actualFolder = path.basename(destinationDir) || "general"
      const fileUrl = `/uploads/${actualFolder}/${req.file.filename}`

      return res.status(201).json({
        success: true,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: stat.size || req.file.size,
        mimeType: req.file.mimetype,
        folder: actualFolder,
      })
    } catch (fsErr) {
      console.error("[UPLOAD VERIFICATION ERROR]:", fsErr)
      return res.status(500).json({
        success: false,
        error: fsErr.message || "Failed to finalize uploaded file on server.",
      })
    }
  })
})

/**
 * POST /api/upload/multiple
 * Multiple files upload handler with safe error interceptor and guaranteed lifecycle
 */
uploadRouter.post("/upload/multiple", (req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "*")

  req.setTimeout?.(180000)

  upload.array("files", 30)(req, res, (err) => {
    if (res.writableEnded || res.destroyed || (res.socket && !res.socket.writable)) {
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          if (file?.path && fs.existsSync(file.path)) {
            fs.unlink(file.path, () => {})
          }
        }
      }
      return
    }

    if (err) {
      console.warn("[MULTIPLE UPLOAD ERROR]:", err.message)
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          if (file?.path && fs.existsSync(file.path)) {
            fs.unlink(file.path, () => {})
          }
        }
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` })
      }
      return res.status(400).json({ success: false, error: err.message || "Multiple files upload failed" })
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: "No files were uploaded" })
    }

    try {
      const results = req.files.map((file) => {
        const destinationDir = file.destination || ""
        const actualFolder = path.basename(destinationDir) || "general"
        return {
          url: `/uploads/${actualFolder}/${file.filename}`,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          folder: actualFolder,
        }
      })

      return res.status(201).json({
        success: true,
        files: results,
        count: results.length,
      })
    } catch (multiErr) {
      console.error("[MULTIPLE UPLOAD MAP ERROR]:", multiErr)
      return res.status(500).json({ success: false, error: "Failed to map uploaded files." })
    }
  })
})

// Map allowed extensions to standard MIME types for chunk assembly
const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".jfif": "image/jpeg",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
}

// Multer Disk Storage Configuration for Chunks
const chunkStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const rawUploadId = (req.query?.uploadId || req.body?.uploadId || "").toString().trim()
      const safeUploadId = rawUploadId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
      if (!safeUploadId) {
        return cb(new Error("Missing or invalid uploadId"))
      }
      const chunkSessionDir = path.join(CHUNKS_ROOT, safeUploadId)
      if (!fs.existsSync(chunkSessionDir)) {
        fs.mkdirSync(chunkSessionDir, { recursive: true })
      }
      cb(null, chunkSessionDir)
    } catch (err) {
      console.error("[CHUNK DESTINATION ERROR]:", err)
      cb(err)
    }
  },
  filename: (req, _file, cb) => {
    try {
      const chunkIndexRaw = (req.query?.chunkIndex ?? req.body?.chunkIndex ?? "").toString()
      const chunkIndex = parseInt(chunkIndexRaw, 10)
      if (isNaN(chunkIndex) || chunkIndex < 0) {
        return cb(new Error("Invalid chunkIndex"))
      }
      cb(null, `chunk_${chunkIndex}`)
    } catch (err) {
      console.error("[CHUNK FILENAME ERROR]:", err)
      cb(err)
    }
  },
})

const uploadChunk = multer({
  storage: chunkStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum per single chunk (standard is 2 MB)
  },
})

/**
 * POST /api/upload/chunk
 * Single chunk upload endpoint. Saves chunk_{index} inside .chunks/{uploadId}/
 */
uploadRouter.post("/upload/chunk", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "*")
  req.setTimeout?.(60000)

  uploadChunk.any()(req, res, (err) => {
    if (res.writableEnded || res.destroyed || (res.socket && !res.socket.writable)) {
      return
    }

    if (err) {
      console.warn("[CHUNK UPLOAD ERROR]:", err.message)
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Chunk upload error: ${err.message}` })
      }
      return res.status(400).json({ success: false, error: err.message || "Failed to upload chunk" })
    }

    const uploadedFile = req.files?.[0]
    if (!uploadedFile) {
      return res.status(400).json({ success: false, error: "No chunk file received" })
    }

    const chunkIndex = parseInt((req.query?.chunkIndex ?? req.body?.chunkIndex ?? "").toString(), 10)
    const uploadId = (req.query?.uploadId || req.body?.uploadId || "").toString().replace(/[^a-zA-Z0-9_-]/g, "")

    return res.status(200).json({
      success: true,
      uploadId,
      chunkIndex,
      size: uploadedFile.size,
    })
  })
})

/**
 * POST /api/upload/chunk/complete
 * Assembles all chunks sequentially into the final file using streaming pipes (flat RAM < 2 MB).
 */
uploadRouter.post("/upload/chunk/complete", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "*")
  req.setTimeout?.(180000)

  try {
    const rawUploadId = (req.body?.uploadId || "").toString()
    const uploadId = rawUploadId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
    const totalChunks = parseInt((req.body?.totalChunks || "0").toString(), 10)
    const originalName = (req.body?.originalName || "file").toString().slice(0, 150)

    let rawFolder = (req.body?.folder || "general").toString().toLowerCase().trim()
    let folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : "general"

    if (!uploadId || isNaN(totalChunks) || totalChunks <= 0) {
      return res.status(400).json({ success: false, error: "Invalid uploadId or totalChunks" })
    }

    const chunkDir = path.join(CHUNKS_ROOT, uploadId)
    if (!fs.existsSync(chunkDir)) {
      return res.status(404).json({ success: false, error: "Upload session not found or expired" })
    }

    // Verify all chunks exist
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`)
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({
          success: false,
          error: `Missing chunk ${i} of ${totalChunks}. Please resume or retry.`,
        })
      }
    }

    // Destination target directory
    const targetDir = path.join(UPLOADS_ROOT, folder)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // Generate safe unique filename
    const ext = (path.extname(originalName) || "").toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 10)
    const basename = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50)
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const safeFilename = `${uniqueSuffix}-${basename || "file"}${ext}`
    const finalFilePath = path.join(targetDir, safeFilename)

    // Assemble sequentially via 64KB stream pipes
    const writeStream = fs.createWriteStream(finalFilePath, { flags: "w" })

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk_${i}`)
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(chunkPath, { highWaterMark: 64 * 1024 })
          readStream.pipe(writeStream, { end: false })
          readStream.on("end", resolve)
          readStream.on("error", reject)
        })
      }

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve)
        writeStream.on("error", reject)
        writeStream.end()
      })
    } catch (streamErr) {
      if (fs.existsSync(finalFilePath)) {
        fs.unlink(finalFilePath, () => {})
      }
      throw streamErr
    }

    // Verify assembled file
    if (!fs.existsSync(finalFilePath)) {
      throw new Error("Assembled file does not exist on disk")
    }
    const stat = fs.statSync(finalFilePath)
    if (stat.size === 0) {
      fs.unlink(finalFilePath, () => {})
      throw new Error("Assembled file is empty (0 bytes)")
    }

    // Clean up temporary chunks directory
    try {
      fs.rmSync(chunkDir, { recursive: true, force: true })
    } catch (rmErr) {
      console.warn(`[CHUNK CLEANUP WARN]: Could not clean ${chunkDir}:`, rmErr.message)
    }

    const mimeType = MIME_BY_EXT[ext] || "application/octet-stream"
    const fileUrl = `/uploads/${folder}/${safeFilename}`

    return res.status(201).json({
      success: true,
      url: fileUrl,
      filename: safeFilename,
      originalName: originalName,
      size: stat.size,
      mimeType: mimeType,
      folder: folder,
    })
  } catch (err) {
    console.error("[CHUNK COMPLETE ERROR]:", err)
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to assemble file chunks",
    })
  }
})

/**
 * POST /api/upload/chunk/abort
 * Cleans up temporary chunks if client cancels or encounters an unrecoverable error
 */
uploadRouter.post("/upload/chunk/abort", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "*")

  try {
    const rawUploadId = (req.body?.uploadId || req.query?.uploadId || "").toString()
    const uploadId = rawUploadId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
    if (uploadId) {
      const chunkDir = path.join(CHUNKS_ROOT, uploadId)
      if (fs.existsSync(chunkDir)) {
        fs.rmSync(chunkDir, { recursive: true, force: true })
      }
    }
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * Periodic janitor to clean up abandoned chunks (sessions older than 24h)
 */
function cleanupAbandonedChunks() {
  try {
    if (!fs.existsSync(CHUNKS_ROOT)) return
    const entries = fs.readdirSync(CHUNKS_ROOT)
    const now = Date.now()
    const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

    for (const entry of entries) {
      const sessionDir = path.join(CHUNKS_ROOT, entry)
      try {
        const stat = fs.statSync(sessionDir)
        if (stat.isDirectory() && now - stat.mtimeMs > MAX_AGE_MS) {
          fs.rmSync(sessionDir, { recursive: true, force: true })
          console.log(`[CHUNKS JANITOR]: Purged abandoned upload session ${entry}`)
        }
      } catch {}
    }
  } catch (err) {
    console.warn("[CHUNKS JANITOR ERROR]:", err.message)
  }
}

cleanupAbandonedChunks()
const janitorInterval = setInterval(cleanupAbandonedChunks, 6 * 60 * 60 * 1000)
janitorInterval.unref?.()


