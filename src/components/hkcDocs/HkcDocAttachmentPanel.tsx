import { useRef, useState, useEffect, useCallback } from "react"
import type { ChangeEvent } from "react"
import {
  File,
  Paperclip,
  Download,
  Camera,
  Image as ImageIcon,
  Eye,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  X as XIcon,
} from "lucide-react"
import type { HkcDocAttachment } from "@/lib/erpStore"
import CameraCaptureModal from "./CameraCaptureModal"
import { useFeedback } from "@/context/FeedbackContext"
import { uploadFileWithProgress, resolveFileUrl } from "@/lib/fileUpload"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"

interface HkcDocAttachmentPanelProps {
  attachments: HkcDocAttachment[]
  onAddAttachments: (newFiles: { fileName: string; fileUrl: string }[]) => void
  onRemoveAttachment: (attachmentId: string) => void
  isEditing?: boolean
}

interface UploadQueueItem {
  id: string
  file: File
  fileName: string
  fileSize: number
  fileType: string
  previewUrl?: string
  progress: number
  loadedBytes: number
  totalBytes: number
  status: "queued" | "uploading" | "success" | "error"
  errorMessage?: string
}

const MAX_CONCURRENT_UPLOADS = 3

export default function HkcDocAttachmentPanel({
  attachments,
  onAddAttachments,
  onRemoveAttachment,
}: HkcDocAttachmentPanelProps) {
  const { confirm } = useFeedback()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])

  const handleDeleteAttachment = (file: HkcDocAttachment) => {
    confirm({
      title: "Delete Attached File?",
      message: `Are you sure you want to delete "${file.fileName}"? This attachment will be permanently removed.`,
      confirmLabel: "Delete File",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        onRemoveAttachment(file.attachmentId)
      },
    })
  }

  // Upload runner for a single item
  const runUpload = useCallback(
    async (item: UploadQueueItem) => {
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: Math.max(q.progress, 5) } : q))
      )

      try {
        const res = await uploadFileWithProgress(
          item.file,
          "hkc_docs",
          (pct, loaded, total) => {
            setUploadQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      progress: pct,
                      loadedBytes: loaded,
                      totalBytes: total,
                    }
                  : q
              )
            )
          }
        )

        // Mark as success
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  progress: 100,
                  status: "success",
                  loadedBytes: item.fileSize,
                  totalBytes: item.fileSize,
                }
              : q
          )
        )

        // Commit to active attachments
        onAddAttachments([
          {
            fileName: res.originalName || item.fileName,
            fileUrl: res.url,
          },
        ])

        // Automatically clean up the successful queue item after a brief celebration
        setTimeout(() => {
          setUploadQueue((prev) => prev.filter((q) => q.id !== item.id))
        }, 1200)
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  errorMessage: err?.message || "Upload failed. Please retry.",
                }
              : q
          )
        )
      }
    },
    [onAddAttachments]
  )

  // Concurrency queue processor
  useEffect(() => {
    const uploadingCount = uploadQueue.filter((q) => q.status === "uploading").length
    if (uploadingCount >= MAX_CONCURRENT_UPLOADS) return

    const nextQueued = uploadQueue.find((q) => q.status === "queued")
    if (nextQueued) {
      void runUpload(nextQueued)
    }
  }, [uploadQueue, runUpload])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files)

    const newQueueItems: UploadQueueItem[] = files.map((file) => {
      const isImg = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|heic|bmp)$/i.test(file.name)
      let previewUrl: string | undefined = undefined
      if (isImg) {
        try {
          previewUrl = URL.createObjectURL(file)
        } catch {}
      }

      return {
        id: `UQ-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        previewUrl,
        progress: 0,
        loadedBytes: 0,
        totalBytes: file.size,
        status: "queued",
      }
    })

    setUploadQueue((prev) => [...prev, ...newQueueItems])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleRetryItem = (itemId: string) => {
    const item = uploadQueue.find((q) => q.id === itemId)
    if (!item) return
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, status: "queued", progress: 0, errorMessage: undefined } : q))
    )
  }

  const handleDismissItem = (itemId: string) => {
    setUploadQueue((prev) => prev.filter((q) => q.id !== itemId))
  }

  const handleCameraCapture = (captured: { fileName: string; fileUrl: string }) => {
    onAddAttachments([captured])
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const downloadAttachment = (fileName: string, fileUrl: string) => {
    const resolved = resolveFileUrl(fileUrl)
    if (resolved.startsWith("data:")) {
      try {
        const arr = resolved.split(",")
        const mimeMatch = arr[0].match(/:(.*?);/)
        const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream"
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        const blob = new Blob([u8arr], { type: mime })
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = blobUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
        return
      } catch (err) {
        console.warn("Blob conversion failed, fallback to direct link", err)
      }
    }

    const link = document.createElement("a")
    link.href = resolved
    link.download = fileName
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isImageFile = (fileName: string, fileUrl: string) => {
    return fileUrl.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i.test(fileName)
  }

  const isPdfFile = (fileName: string, fileUrl: string) => {
    return fileUrl.startsWith("data:application/pdf") || /\.pdf$/i.test(fileName)
  }

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
    return `${bytes} B`
  }

  const isAnyUploading = uploadQueue.some((q) => q.status === "uploading" || q.status === "queued")

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 bg-zinc-50/30 dark:bg-zinc-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
          File & Photo Attachments ({attachments.length})
        </span>

        <div className="flex items-center gap-2">
          {/* Live Camera Viewfinder Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-black inline-flex items-center gap-1.5 active:scale-95 transition-all text-emerald-800 dark:text-emerald-200 cursor-pointer shadow-2xs"
            title="Snap photo directly from camera"
          >
            <Camera className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Snap Photo</span>
          </button>

          {/* Standard File Upload */}
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={isAnyUploading}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 disabled:opacity-60 text-xs font-black inline-flex items-center gap-1.5 hover:border-zinc-300 active:scale-95 transition-all text-zinc-800 dark:text-zinc-200 cursor-pointer"
            title="Upload file or document"
          >
            <Paperclip className="size-3.5 text-zinc-500" />
            <span>{isAnyUploading ? "Uploading..." : "Attach File"}</span>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <style>{`
        @keyframes slidingShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {attachments.length === 0 && uploadQueue.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <div className="flex justify-center items-center gap-2 mb-1.5">
            <Camera className="size-5 text-zinc-400" />
            <File className="size-5 text-zinc-400" />
          </div>
          <p className="text-zinc-500 font-semibold text-[11px]">No files attached. Use &quot;Snap Photo&quot; to take a picture or &quot;Attach File&quot; to upload PDFs or documents.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
          {/* Active Upload Queue Items (Sliding Window Loader Cards) */}
          {uploadQueue.map((item) => {
            const isImg = item.fileType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|heic|bmp)$/i.test(item.fileName)
            const isPdf = item.fileType === "application/pdf" || /\.pdf$/i.test(item.fileName)

            return (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  item.status === "error"
                    ? "border-rose-300 bg-rose-50/40 dark:bg-rose-950/20"
                    : item.status === "success"
                    ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-sky-200 bg-sky-50/30 dark:bg-sky-950/20 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {/* Thumbnail Preview */}
                    <div className="size-8 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0">
                      {isImg && item.previewUrl ? (
                        <img src={item.previewUrl} alt={item.fileName} className="size-full object-cover" />
                      ) : isPdf ? (
                        <FileText className="size-4 text-rose-600" />
                      ) : (
                        <File className="size-4 text-sky-600" />
                      )}
                    </div>

                    {/* File Meta */}
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate text-zinc-900 dark:text-zinc-100 font-bold text-xs" title={item.fileName}>
                        {item.fileName}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {item.status === "uploading" ? (
                          `Uploading • ${formatFileSize(item.loadedBytes)} of ${formatFileSize(item.totalBytes)}`
                        ) : item.status === "queued" ? (
                          `Queued • ${formatFileSize(item.fileSize)}`
                        ) : item.status === "success" ? (
                          <span className="text-emerald-700 font-semibold">Uploaded ready • {formatFileSize(item.fileSize)}</span>
                        ) : (
                          <span className="text-rose-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="size-3 shrink-0" />
                            {item.errorMessage || "Upload failed"}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges & Action Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === "uploading" && (
                      <span className="font-mono font-black text-xs text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs">
                        {item.progress}%
                      </span>
                    )}

                    {item.status === "queued" && (
                      <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                        Queued
                      </span>
                    )}

                    {item.status === "success" && (
                      <span className="inline-flex items-center gap-1 font-bold text-xs text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        Uploaded
                      </span>
                    )}

                    {item.status === "error" && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRetryItem(item.id)}
                          className="px-2 py-1 rounded-lg bg-amber-500 text-white font-bold text-[10px] inline-flex items-center gap-1 hover:bg-amber-600 transition-colors cursor-pointer shadow-xs"
                          title="Retry file upload"
                        >
                          <RotateCw className="size-3" />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissItem(item.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Dismiss item"
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sliding Window Progress Bar */}
                <div className="w-full bg-zinc-200/80 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden relative mt-2">
                  <div
                    className={`h-full transition-all duration-300 ease-out relative rounded-full ${
                      item.status === "error"
                        ? "bg-rose-500"
                        : item.status === "success"
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-500"
                    }`}
                    style={{
                      width: `${item.status === "queued" ? 8 : Math.max(8, item.progress)}%`,
                    }}
                  >
                    {item.status === "uploading" && (
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                        style={{
                          animation: "slidingShimmer 1.5s infinite linear",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Persisted Attached Files */}
          {attachments.map((file) => {
            const isImg = isImageFile(file.fileName, file.fileUrl)
            const isPdf = isPdfFile(file.fileName, file.fileUrl)

            return (
              <div
                key={file.attachmentId}
                className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-150/60 bg-white dark:bg-zinc-900 shadow-xs text-xs font-semibold"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {isImg ? (
                    <div
                      onClick={() => setPreviewDoc({ fileName: file.fileName, fileUrl: file.fileUrl })}
                      className="size-8 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Click to preview image"
                    >
                      {file.fileUrl ? (
                        <img src={resolveFileUrl(file.fileUrl)} alt={file.fileName} className="size-full object-cover" />
                      ) : (
                        <ImageIcon className="size-4 text-emerald-600" />
                      )}
                    </div>
                  ) : isPdf ? (
                    <div
                      onClick={() => setPreviewDoc({ fileName: file.fileName, fileUrl: file.fileUrl })}
                      className="size-8 rounded-lg border border-rose-200 bg-rose-50 flex items-center justify-center shrink-0 cursor-pointer hover:bg-rose-100 transition-colors"
                      title="Click to preview PDF"
                    >
                      <FileText className="size-4 text-rose-600" />
                    </div>
                  ) : (
                    <div
                      onClick={() => setPreviewDoc({ fileName: file.fileName, fileUrl: file.fileUrl })}
                      className="size-8 rounded-lg border border-blue-200 bg-blue-50 flex items-center justify-center shrink-0 cursor-pointer hover:bg-blue-100 transition-colors"
                      title="Click to view document"
                    >
                      <File className="size-4 text-blue-600" />
                    </div>
                  )}

                  <div className="flex flex-col min-w-0 pr-2">
                    <span
                      onClick={() => setPreviewDoc({ fileName: file.fileName, fileUrl: file.fileUrl })}
                      className="truncate text-zinc-900 dark:text-zinc-100 font-bold hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                      title={file.fileName}
                    >
                      {file.fileName}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono">
                      {isPdf ? "PDF Document" : isImg ? "Photo / Image" : "Document"} • {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : "Attached"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc({ fileName: file.fileName, fileUrl: file.fileUrl })}
                    className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg cursor-pointer transition-colors"
                    title="Preview document"
                  >
                    <Eye className="size-3.5" />
                  </button>
                  {file.fileUrl && (
                    <button
                      type="button"
                      onClick={() => downloadAttachment(file.fileName, file.fileUrl)}
                      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 rounded-lg cursor-pointer transition-colors"
                      title="Download attached file"
                    >
                      <Download className="size-3.5 text-zinc-600 dark:text-zinc-300" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(file)}
                    className="p-1.5 hover:bg-rose-50 text-zinc-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                    title="Delete attached file"
                  >
                    <Trash2 className="size-3.5 text-rose-500" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Universal Document & PDF Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          fileName={previewDoc.fileName}
          fileUrl={previewDoc.fileUrl}
        />
      )}

      {/* Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        onFallbackFileSelect={triggerFileSelect}
      />
    </div>
  )
}


