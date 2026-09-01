import { useState } from "react"
import { motion } from "framer-motion"
import { X, Save } from "lucide-react"
import type { HkcDocAttachment, HkcDocRecord } from "@/lib/erpStore"
import HkcDocAttachmentPanel from "./HkcDocAttachmentPanel"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { createHkcDocRecord } from "@/lib/hkcDocsApi"
import { useFeedback } from "@/context/FeedbackContext"

interface HkcDocAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveSuccess: (record: HkcDocRecord) => void
}

export default function HkcDocAddModal({
  isOpen,
  onClose,
  onSaveSuccess,
}: HkcDocAddModalProps) {
  const { showToast } = useFeedback()
  const [shipmentId, setShipmentId] = useState("")
  const [itemsDescription, setItemsDescription] = useState("")
  const [type, setType] = useState<"Import" | "Export">("Import")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [attachments, setAttachments] = useState<HkcDocAttachment[]>([])
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleAddAttachments = (newFiles: { fileName: string; fileUrl: string }[]) => {
    const fresh = newFiles.map((nf) => ({
      attachmentId: `ATT-${Date.now()}-${Math.random().toString().slice(-4)}`,
      fileName: nf.fileName,
      fileUrl: nf.fileUrl,
      uploadedAt: new Date().toISOString(),
    }))
    setAttachments((prev) => [...prev, ...fresh])
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.attachmentId !== attachmentId))
  }

  const handleSave = async () => {
    if (!shipmentId.trim() || !itemsDescription.trim()) {
      showToast("Validation failed", "warning", "Provide a shipment reference ID and items description.")
      return
    }

    setIsSaving(true)
    try {
      const record = await createHkcDocRecord({
        shipmentId: shipmentId.trim(),
        itemsDescription: itemsDescription.trim(),
        type,
        date,
        attachments,
      })
      showToast("Documentation saved", "success", `Record ${record.shipmentId} saved.`)
      onSaveSuccess(record)
      onClose()
      setShipmentId("")
      setItemsDescription("")
      setType("Import")
      setDate(new Date().toISOString().slice(0, 10))
      setAttachments([])
    } catch (err) {
      showToast("Save failed", "warning", err instanceof Error ? err.message : "Failed to save record.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-200 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-zinc-900">Add Documentation Record</h3>
            <p className="text-[11px] sm:text-xs text-zinc-500">Attach compliance and shipping certificates for imports or exports.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 text-xs font-semibold overflow-y-auto pr-1 flex-1">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <label className="space-y-1 block">
              <span className="text-[11px] font-black uppercase text-zinc-700">Shipment ID <span className="text-rose-600">*</span></span>
              <input
                type="text"
                placeholder="e.g. SHP-2025-001"
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
                className="h-11 w-full border border-zinc-200 rounded-xl px-3 outline-none focus:border-emerald-500 font-mono text-zinc-800"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-[11px] font-black uppercase text-zinc-700">Record Date <span className="text-rose-600">*</span></span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full border border-zinc-200 rounded-xl px-3 outline-none focus:border-emerald-500 font-mono text-zinc-800"
              />
            </label>

            <label className="space-y-1 block md:col-span-2">
              <span className="text-[11px] font-black uppercase text-zinc-700">Type <span className="text-rose-600">*</span></span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="h-11 w-full border border-zinc-200 rounded-xl px-3 outline-none focus:border-emerald-500 cursor-pointer text-zinc-800"
              >
                <option value="Import">Import Shipment</option>
                <option value="Export">Export Shipment</option>
              </select>
            </label>

            <label className="space-y-1 block md:col-span-2">
              <span className="text-[11px] font-black uppercase text-zinc-700">Items Description <span className="text-rose-600">*</span></span>
              <textarea
                rows={3}
                placeholder="e.g. 500 Bags of sesame seeds for agricultural export"
                value={itemsDescription}
                onChange={(e) => setItemsDescription(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl p-3 outline-none focus:border-emerald-500 text-zinc-800"
              />
            </label>
          </div>

          <HkcDocAttachmentPanel
            attachments={attachments}
            onAddAttachments={handleAddAttachments}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3.5 mt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-zinc-200 px-4 font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="h-11 min-w-[130px] rounded-xl bg-zinc-950 text-white font-bold px-5 inline-flex items-center justify-center gap-1.5 shadow-md hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isSaving ? <LoadingDots color="bg-white" size="sm" /> : <><Save className="size-4" /> Save Record</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
