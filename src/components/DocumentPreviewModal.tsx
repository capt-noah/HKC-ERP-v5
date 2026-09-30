import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Download, ExternalLink, FileText, Image as ImageIcon } from "lucide-react"
import { resolveFileUrl } from "@/lib/fileUpload"

interface DocumentPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  fileUrl: string
  fileName: string
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>("")
  const [isPdf, setIsPdf] = useState<boolean>(false)
  const [isImage, setIsImage] = useState<boolean>(false)

  // ESC key listener & body scroll lock
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !fileUrl) {
      setResolvedUrl("")
      return
    }

    let urlToUse = resolveFileUrl(fileUrl)
    let revokeUrl: string | null = null

    // Determine type
    const lowerName = fileName.toLowerCase()
    const isPdfFile = lowerName.endsWith(".pdf") || fileUrl.startsWith("data:application/pdf")
    const isImgFile =
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".gif") ||
      lowerName.endsWith(".webp") ||
      lowerName.endsWith(".bmp") ||
      lowerName.endsWith(".svg") ||
      lowerName.endsWith(".heic") ||
      fileUrl.startsWith("data:image/")

    setIsPdf(isPdfFile)
    setIsImage(isImgFile)

    // Convert data: URL to Blob URL to prevent browser navigation block & enable smooth loading
    if (fileUrl.startsWith("data:")) {
      try {
        const arr = fileUrl.split(",")
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
        urlToUse = blobUrl
        revokeUrl = blobUrl
      } catch (e) {
        console.error("Failed to convert base64 to blob url", e)
      }
    }

    setResolvedUrl(urlToUse)

    return () => {
      if (revokeUrl) {
        URL.revokeObjectURL(revokeUrl)
      }
    }
  }, [isOpen, fileUrl, fileName])

  const handleDownload = () => {
    if (!resolvedUrl) return
    const link = document.createElement("a")
    link.href = resolvedUrl
    link.download = fileName || "document"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (typeof document === "undefined" || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      {/* Backdrop Click Dismiss */}
      <div
        onClick={onClose}
        className="absolute inset-0 cursor-pointer"
      />

      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl h-[88vh] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10"
      >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800 bg-zinc-900/95 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className={`p-2 rounded-xl shrink-0 ${isPdf ? "bg-rose-500/15 text-rose-400" : isImage ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}>
                  {isPdf ? <FileText className="size-5" /> : isImage ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-zinc-100 truncate" title={fileName}>
                    {fileName || "Document Preview"}
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {isPdf ? "Portable Document Format (PDF)" : isImage ? "Image Document" : "Attached File"} • HKC Docs Vault
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {resolvedUrl && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                      title="Download Document"
                    >
                      <Download className="size-4 text-zinc-400" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                      title="Open Full Screen in New Tab"
                    >
                      <ExternalLink className="size-4 text-zinc-400" />
                      <span className="hidden sm:inline">Full Screen</span>
                    </a>
                  </>
                )}
                <div className="w-px h-6 bg-zinc-800 mx-1" />
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-600/80 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Close Preview (Esc)"
                  aria-label="Close Preview"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Viewport Content */}
            <div className="flex-1 bg-zinc-950 p-2 sm:p-4 flex items-center justify-center overflow-auto min-h-0">
              {resolvedUrl ? (
                isPdf ? (
                  <iframe
                    src={resolvedUrl}
                    className="size-full border-0 rounded-2xl bg-white"
                    title="PDF Document Preview"
                  />
                ) : isImage ? (
                  <div className="size-full flex items-center justify-center p-2">
                    <img
                      src={resolvedUrl}
                      alt={fileName}
                      className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-zinc-800"
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-4">
                    <FileText className="size-16 text-zinc-600 mx-auto" />
                    <p className="text-sm font-semibold text-zinc-400">
                      Inline preview is not supported for this file format.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <Download className="size-4" /> Download & View File
                    </button>
                  </div>
                )
              ) : (
                <div className="text-zinc-500 text-xs font-bold animate-pulse">Loading document preview...</div>
              )}
            </div>
          </div>
        </div>,
    document.body
  )
}

export default DocumentPreviewModal
