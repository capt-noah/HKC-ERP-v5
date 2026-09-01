import { useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { File, Plus, X, Download, Camera, Image as ImageIcon, Eye } from "lucide-react"
import type { HkcDocAttachment } from "@/lib/erpStore"
import CameraCaptureModal from "./CameraCaptureModal"

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ fileName: string; fileUrl: string } | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    const promises = files.map((file) => {
      return new Promise<{ fileName: string; fileUrl: string }>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve({
            fileName: file.name,
            fileUrl: reader.result as string,
          })
        }
        reader.readAsDataURL(file)
      })
    })

    Promise.all(promises).then((results) => {
      onAddAttachments(results)
      if (fileInputRef.current) fileInputRef.current.value = ""
    })
  }

  const handleCameraCapture = (captured: { fileName: string; fileUrl: string }) => {
    onAddAttachments([captured])
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const downloadAttachment = (fileName: string, fileUrl: string) => {
    const link = document.createElement("a")
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isImageFile = (fileName: string, fileUrl: string) => {
    return fileUrl.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i.test(fileName)
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
            className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-xs font-black inline-flex items-center gap-1.5 active:scale-95 transition-all text-blue-800 dark:text-blue-200 cursor-pointer shadow-2xs"
            title="Snap photo directly from camera"
          >
            <Camera className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span>Snap Photo</span>
          </button>

          {/* Standard File Upload */}
          <button
            type="button"
            onClick={triggerFileSelect}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-black inline-flex items-center gap-1.5 hover:border-zinc-300 active:scale-95 transition-all text-zinc-800 dark:text-zinc-200 cursor-pointer"
            title="Upload file or document"
          >
            <Plus className="size-3.5 text-emerald-600" />
            <span>Add File</span>
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
          <p className="text-zinc-500 font-semibold text-[11px]">No files attached. Use &quot;Snap Photo&quot; to take a picture or &quot;Add File&quot; to upload.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {attachments.map((file) => {
            const isImg = isImageFile(file.fileName, file.fileUrl)
            return (
              <div
                key={file.attachmentId}
                className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-150/60 bg-white dark:bg-zinc-900 shadow-xs text-xs font-semibold"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isImg ? (
                    <div
                      onClick={() => setPreviewImage({ fileName: file.fileName, fileUrl: file.fileUrl })}
                      className="size-7 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Click to preview image"
                    >
                      {file.fileUrl.startsWith("data:") ? (
                        <img src={file.fileUrl} alt={file.fileName} className="size-full object-cover" />
                      ) : (
                        <ImageIcon className="size-4 text-blue-500" />
                      )}
                    </div>
                  ) : (
                    <File className="size-4 text-zinc-400 shrink-0" />
                  )}

                  <span className="truncate text-zinc-800 dark:text-zinc-200 pr-2">
                    {file.fileName}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                    {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : ""}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isImg && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ fileName: file.fileName, fileUrl: file.fileUrl })}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg cursor-pointer transition-colors"
                      title="Preview photo"
                    >
                      <Eye className="size-3.5" />
                    </button>
                  )}
                  {file.fileUrl.startsWith("data:") && (
                    <button
                      type="button"
                      onClick={() => downloadAttachment(file.fileName, file.fileUrl)}
                      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 rounded-lg cursor-pointer transition-colors"
                      title="Download attached file"
                    >
                      <Download className="size-3.5 text-emerald-600" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file.attachmentId)}
                    className="p-1.5 hover:bg-rose-50 text-zinc-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                    title="Remove attachment"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image Quick Preview Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-zinc-200 dark:border-zinc-800">
              <span className="font-bold text-xs truncate pr-3 text-zinc-800 dark:text-zinc-200">
                {previewImage.fileName}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-3 bg-zinc-950 flex items-center justify-center overflow-auto max-h-[70vh]">
              <img 
                src={previewImage.fileUrl} 
                alt={previewImage.fileName} 
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
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


