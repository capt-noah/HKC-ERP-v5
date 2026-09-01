import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Camera, X, RotateCcw, Check, SwitchCamera, AlertCircle, Upload } from "lucide-react"

interface CameraCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: { fileName: string; fileUrl: string }) => void
  onFallbackFileSelect?: () => void
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  onFallbackFileSelect,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isLoadingCamera, setIsLoadingCamera] = useState(true)

  // Start camera stream
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    setIsLoadingCamera(true)
    setCameraError(null)

    // Stop existing stream first
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Live camera is not supported on this browser.")
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      }

      let mediaStream: MediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        // Fallback to basic video constraint if ideal resolution fails
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: mode },
        })
      }

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      console.warn("Camera access error:", err)
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please allow camera access in your browser settings.")
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device was found on this system.")
      } else {
        setCameraError(err.message || "Failed to start camera viewfinder.")
      }
    } finally {
      setIsLoadingCamera(false)
    }
  }, [stream])

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null)
      startCamera(facingMode)
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        setStream(null)
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isOpen, facingMode])

  // Attach video stream when video element renders
  useEffect(() => {
    if (videoRef.current && stream && !capturedImage) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream, capturedImage])

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
  }

  const handleSnapPhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // If front camera, flip horizontally for mirror effect
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    setCapturedImage(dataUrl)
  }

  const handleRetake = () => {
    setCapturedImage(null)
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }

  const handleUsePhoto = () => {
    if (!capturedImage) return
    const now = new Date()
    const timeTag = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`
    const fileName = `Doc_Photo_${now.toISOString().slice(0, 10)}_${timeTag}.jpg`

    onCapture({
      fileName,
      fileUrl: capturedImage,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-xl bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 bg-zinc-900/90 border-b border-zinc-800 text-white shrink-0 z-10">
          <div className="flex items-center gap-2">
            <Camera className="size-5 text-blue-400" />
            <h4 className="font-black text-sm sm:text-base">Document Camera Viewfinder</h4>
          </div>
          <div className="flex items-center gap-2">
            {!capturedImage && !cameraError && (
              <button
                type="button"
                onClick={handleFlipCamera}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Switch Camera (Front/Back)"
              >
                <SwitchCamera className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder / Preview Body */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[320px] sm:min-h-[420px] overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-zinc-400 space-y-4 max-w-sm">
              <AlertCircle className="size-10 text-rose-500 mx-auto" />
              <p className="text-xs font-semibold text-zinc-300 leading-relaxed">{cameraError}</p>
              {onFallbackFileSelect && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onFallbackFileSelect()
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Upload className="size-4" /> Choose from Gallery / Files
                </button>
              )}
            </div>
          ) : capturedImage ? (
            <div className="relative size-full flex items-center justify-center p-2">
              <img
                src={capturedImage}
                alt="Captured Document"
                className="max-h-[60vh] w-auto object-contain rounded-xl shadow-lg border border-zinc-800"
              />
            </div>
          ) : (
            <div className="relative size-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`size-full object-cover sm:object-contain max-h-[65vh] ${facingMode === "user" ? "-scale-x-100" : ""}`}
              />

              {/* Document Alignment Frame Guides */}
              <div className="absolute inset-4 sm:inset-8 border-2 border-white/30 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="size-4 border-t-2 border-l-2 border-blue-400 rounded-tl-sm" />
                  <div className="size-4 border-t-2 border-r-2 border-blue-400 rounded-tr-sm" />
                </div>
                <div className="text-center">
                  <span className="bg-black/60 backdrop-blur-xs text-white/90 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Align document inside frame
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="size-4 border-b-2 border-l-2 border-blue-400 rounded-bl-sm" />
                  <div className="size-4 border-b-2 border-r-2 border-blue-400 rounded-br-sm" />
                </div>
              </div>

              {isLoadingCamera && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-xs font-bold">
                  Initializing camera...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Shutter Controls */}
        <div className="p-4 sm:p-5 bg-zinc-900/95 border-t border-zinc-800 shrink-0 flex items-center justify-center gap-6">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs inline-flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="size-4" /> Retake
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-95 cursor-pointer"
              >
                <Check className="size-4" /> Use Photo
              </button>
            </>
          ) : !cameraError ? (
            <button
              type="button"
              onClick={handleSnapPhoto}
              disabled={isLoadingCamera}
              className="size-16 rounded-full bg-white hover:bg-zinc-100 p-1.5 shadow-xl transition-all active:scale-90 cursor-pointer flex items-center justify-center group disabled:opacity-50"
              title="Snap photo"
            >
              <div className="size-full rounded-full border-2 border-zinc-950 bg-white group-hover:bg-zinc-100 flex items-center justify-center">
                <div className="size-10 rounded-full bg-blue-600 group-active:scale-90 transition-transform" />
              </div>
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
