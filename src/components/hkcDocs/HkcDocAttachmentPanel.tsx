import { useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { File, Paperclip, Download, Camera, Image as ImageIcon, Eye, Trash2, FileText } from "lucide-react"
import type { HkcDocAttachment } from "@/lib/erpStore"
import CameraCaptureModal from "./CameraCaptureModal"
import { useFeedback } from "@/context/FeedbackContext"
import { uploadFile, resolveFileUrl } from "@/lib/fileUpload"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"

interface HkcDocAttachmentPanelProps {
  attachments: HkcDocAttachment[]
  onAddAttachments: (newFiles: { fileName: string; fileUrl: string }[]) => void
  onRemoveAttachment: (attachmentId: string) => void
  isEditing?: boolean
}

export default function HkcDocAttachmentPanel({
  attachments,
  onAddAttachments,
  onRemoveAttachment,
}: HkcDocAttachmentPanelProps) {
  const { confirm, showToast } = useFeedback()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null)

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

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files)
    setIsUploading(true)

    try {
      const results: { fileName: string; fileUrl: string }[] = []
      for (const file of files) {
        try {
          const res = await uploadFile(file, "hkc_docs")
          results.push({
            fileName: res.originalName || file.name,
            fileUrl: res.url,
          })
        } catch (err) {
          console.warn("File upload failed for", file.name, err)
        }
      }

      if (results.length > 0) {
        onAddAttachments(results)
      }
    } catch (err) {
      showToast("Upload Error", "warning", "Failed to upload attachments.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
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
            disabled={isUploading}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 disabled:opacity-50 text-xs font-black inline-flex items-center gap-1.5 hover:border-zinc-300 active:scale-95 transition-all text-zinc-800 dark:text-zinc-200 cursor-pointer"
            title="Upload file or document"
          >
            <Paperclip className="size-3.5 text-zinc-500" />
            <span>{isUploading ? "Uploading..." : "Attach File"}</span>
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

      {attachments.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <div className="flex justify-center items-center gap-2 mb-1.5">
            <Camera className="size-5 text-zinc-400" />
            <File className="size-5 text-zinc-400" />
          </div>
          <p className="text-zinc-500 font-semibold text-[11px]">No files attached. Use &quot;Snap Photo&quot; to take a picture or &quot;Attach File&quot; to upload PDFs or documents.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
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


