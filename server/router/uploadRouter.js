import path from "node:path"
import fs from "node:fs"
import { Router } from "express"
import multer from "multer"

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

// Base uploads root directory
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads")
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true })
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    let folder = (req.body?.folder || req.query?.folder || "general").toString().toLowerCase().trim()
    if (!ALLOWED_FOLDERS.has(folder)) {
      folder = "general"
    }

    const targetDir = path.join(UPLOADS_ROOT, folder)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    cb(null, targetDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const basename = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50)
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const safeFilename = `${uniqueSuffix}-${basename}${ext}`
    cb(null, safeFilename)
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
    cb(new Error(`File type '${ext}' is not allowed. Allowed types: PDF, PNG, JPG, JPEG, WEBP, DOCX, XLSX, CSV.`))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit
  },
})

/**
 * POST /api/upload
 * Single file upload handler
 */
uploadRouter.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file was uploaded" })
  }

  let folder = (req.body?.folder || req.query?.folder || "general").toString().toLowerCase().trim()
  if (!ALLOWED_FOLDERS.has(folder)) {
    folder = "general"
  }

  const fileUrl = `/uploads/${folder}/${req.file.filename}`

  res.status(201).json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    folder,
  })
})

/**
 * POST /api/upload/multiple
 * Multiple files upload handler
 */
uploadRouter.post("/upload/multiple", upload.array("files", 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files were uploaded" })
  }

  let folder = (req.body?.folder || req.query?.folder || "general").toString().toLowerCase().trim()
  if (!ALLOWED_FOLDERS.has(folder)) {
    folder = "general"
  }

  const filesResult = req.files.map((file) => ({
    url: `/uploads/${folder}/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    folder,
  }))

  res.status(201).json({
    success: true,
    files: filesResult,
    count: filesResult.length,
  })
})
