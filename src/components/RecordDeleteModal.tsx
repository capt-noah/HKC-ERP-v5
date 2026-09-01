import { motion, AnimatePresence } from "framer-motion"
import { Trash2, X } from "lucide-react"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"

export interface RecordDeleteModalProps {
  isOpen: boolean
  title: string
  recordId?: string
  recordName?: string
  description?: string
  isDeleting?: boolean
  onClose: () => void
  onConfirmDelete: () => void | Promise<void>
}

export function RecordDeleteModal({
  isOpen,
  title,
  recordId,
  recordName,
  description = "This action is permanent and cannot be undone. All associated data will be removed from system registry.",
  isDeleting = false,
  onClose,
  onConfirmDelete,
}: RecordDeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <BodyScrollLock />
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-100 overflow-hidden"
          >
            {/* Header Title & Close Button */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-lg font-black text-zinc-950 tracking-tight">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0 -mr-1.5 -mt-1.5"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Target Details */}
            <div className="space-y-2 mb-5">
              {(recordId || recordName) && (
                <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-200/70 text-xs font-semibold">
                  {recordId && (
                    <div className="font-mono font-black text-rose-950 text-xs mb-0.5">
                      ID: {recordId}
                    </div>
                  )}
                  {recordName && (
                    <div className="text-zinc-800 font-bold truncate">
                      {recordName}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                {description}
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={onConfirmDelete}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-extrabold shadow-md shadow-rose-600/20 transition-all cursor-pointer min-w-[120px]"
              >
                {isDeleting ? (
                  <LoadingDots color="bg-white" size="sm" />
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Delete Record</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
