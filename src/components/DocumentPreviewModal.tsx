import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Download, ExternalLink, FileText } from "lucide-react"
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

    const prevOverflow = document.body.style.overflow === "hidden" ? "" : document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow || ""
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/10 bg-zinc-900/90 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate">{fileName || "Document Preview"}</h3>
                  <p className="text-[10px] text-zinc-400">ERP Secure Document Vault</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {resolvedUrl && (
                  <>
                    <button
                      onClick={handleDownload}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-bold"
                      title="Download Document"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-bold"
                      title="Open in New Tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">Full Screen</span>
                    </a>
                  </>
                )}
                <div className="w-[1px] h-6 bg-zinc-800 mx-1" />
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewport Content */}
            <div className="flex-1 bg-zinc-950 p-4 flex items-center justify-center overflow-auto min-h-0">
              {resolvedUrl ? (
                isPdf ? (
                  <iframe
                    src={resolvedUrl}
                    className="w-full h-full border-0 rounded-lg bg-white"
                    title="PDF Document Preview"
                  />
                ) : isImage ? (
                  <img
                    src={resolvedUrl}
                    alt={fileName}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-lg border border-zinc-800"
                  />
                ) : (
                  <div className="text-center p-8 space-y-4">
                    <FileText className="w-16 h-16 text-zinc-600 mx-auto" />
                    <p className="text-sm font-semibold text-zinc-400">
                      No inline preview available for this document type.
                    </p>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download & View File
                    </button>
                  </div>
                )
              ) : (
                <div className="text-zinc-500 text-xs font-bold">Loading document viewer...</div>
              )}
            </div>
          </div>
        </div>,
    document.body
  )
}
