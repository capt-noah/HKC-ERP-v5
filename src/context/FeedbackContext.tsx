import { createContext, useContext, useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"

// Toast structure
export interface FeedbackToast {
  id: string
  message: string
  description?: string
  type: "success" | "warning" | "info"
  duration?: number
}

// Confirmation state structure
export interface FeedbackConfirmation {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  onConfirm: () => void
  onCancel?: () => void
}

interface FeedbackContextType {
  showToast: (message: string, type?: FeedbackToast["type"], description?: string) => void
  confirm: (options: FeedbackConfirmation) => void
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined)

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider")
  }
  return context
}

interface FeedbackProviderProps {
  children: ReactNode
}

export function FeedbackProvider({ children }: FeedbackProviderProps) {
  const [toasts, setToasts] = useState<FeedbackToast[]>([])
  const [confirmation, setConfirmation] = useState<FeedbackConfirmation | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const showToast = (message: string, type: FeedbackToast["type"] = "success", description?: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: FeedbackToast = { id, message, type, description }
    setToasts((prev) => [...prev, newToast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }

  const confirm = (options: FeedbackConfirmation) => {
    setConfirmation(options)
  }

  const handleConfirm = async () => {
    if (confirmation) {
      try {
        setIsConfirming(true)
        await Promise.resolve(confirmation.onConfirm())
        setConfirmation(null)
      } finally {
        setIsConfirming(false)
      }
    }
  }

  const handleCancel = () => {
    if (isConfirming) return
    if (confirmation) {
      if (confirmation.onCancel) confirmation.onCancel()
      setConfirmation(null)
    }
  }

  return (
    <FeedbackContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* 1. Sleek Toast Notifications Container (Smooth Slide from Right) */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const isSuccess = toast.type === "success"
            const isWarning = toast.type === "warning"

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, scale: 0.85, x: 50 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85, x: 50, transition: { duration: 0.1, ease: "linear" } }}
                transition={{ duration: 0.12, ease: "linear" }}
                className={cn(
                  "pointer-events-auto flex items-start gap-3.5 p-4 text-zinc-950 shadow-xl relative overflow-hidden transition-all w-[360px] glass-card !rounded-2xl border border-white/80 bg-gradient-to-r from-white/95 via-white/85 to-white/75 backdrop-blur-md",
                  isSuccess && "after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-emerald-600",
                  isWarning && "after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-amber-500",
                  toast.type === "info" && "after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-zinc-900"
                )}
              >
                {/* Icon wrapper with refined badge style */}
                <div className={cn(
                  "size-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs border mt-0.5",
                  isSuccess && "bg-emerald-50/80 border-emerald-200/80 text-emerald-700",
                  isWarning && "bg-amber-50/80 border-amber-200/80 text-amber-800",
                  toast.type === "info" && "bg-zinc-100/80 border-zinc-200/80 text-zinc-900"
                )}>
                  {isSuccess && <CheckCircle2 className="size-4" />}
                  {isWarning && <AlertTriangle className="size-4" />}
                  {toast.type === "info" && <Info className="size-4" />}
                </div>

                <div className="flex-1 pr-3 min-w-0">
                  <h4 className="text-xs font-black text-zinc-950 tracking-tight leading-tight mb-0.5">
                    {toast.message}
                  </h4>
                  {toast.description && (
                    <p className="text-[11px] font-semibold text-zinc-600 leading-snug">
                      {toast.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="p-1 text-zinc-400 hover:text-zinc-900 rounded-md transition-colors hover:bg-black/5"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* 2. Unified Solid Design System Confirmation Modal */}
      <AnimatePresence>
        {confirmation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <BodyScrollLock />
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-black/45 backdrop-blur-xs"
            />

            {/* Modal Card - Solid Opaque */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative z-10 bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden"
            >
              {/* Header Title & Close Button */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-lg font-black text-zinc-950 dark:text-white tracking-tight">
                  {confirmation.title}
                </h3>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 -mr-1.5 -mt-1.5"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Message */}
              <div className="mb-6">
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                  {confirmation.message}
                </p>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {confirmation.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={handleConfirm}
                  className={cn(
                    "min-w-[90px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
                    confirmation.isDestructive
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                      : "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-900/20"
                  )}
                >
                  {isConfirming ? <LoadingDots color="bg-white" size="sm" /> : (confirmation.confirmLabel || "Confirm")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FeedbackContext.Provider>
  )
}
