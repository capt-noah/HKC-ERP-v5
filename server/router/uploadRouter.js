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
try {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true })
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
    // If client disconnected before response could be sent
    if (req.destroyed || res.writableEnded) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        // Keep or cleanly remove only if response could not be delivered
      }
      if (!res.writableEnded) {
        try {
          res.end()
        } catch {}
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
    if (req.destroyed || res.writableEnded) {
      if (!res.writableEnded) {
        try {
          res.end()
        } catch {}
      }
      return
    }

    if (err) {
      console.warn("[MULTIPLE UPLOAD ERROR]:", err.message)
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

