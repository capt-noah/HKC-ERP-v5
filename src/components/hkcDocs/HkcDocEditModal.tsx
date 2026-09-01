import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { X, Save, Trash2 } from "lucide-react"
import type { HkcDocAttachment, HkcDocRecord } from "@/lib/erpStore"
import HkcDocAttachmentPanel from "./HkcDocAttachmentPanel"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { updateHkcDocRecord, deleteHkcDocRecord } from "@/lib/hkcDocsApi"
import { useFeedback } from "@/context/FeedbackContext"

interface HkcDocEditModalProps {
  record: HkcDocRecord | null
  onClose: () => void
  onSaveSuccess: (record: HkcDocRecord) => void
  onDeleteSuccess: (id: string) => void
}

export default function HkcDocEditModal({
  record,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
}: HkcDocEditModalProps) {
  const { showToast, confirm } = useFeedback()
  const [shipmentId, setShipmentId] = useState("")
  const [itemsDescription, setItemsDescription] = useState("")
  const [type, setType] = useState<"Import" | "Export">("Import")
  const [date, setDate] = useState("")
  const [attachments, setAttachments] = useState<HkcDocAttachment[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (record) {
      setShipmentId(record.shipmentId)
      setItemsDescription(record.itemsDescription)
      setType(record.type)
      setDate(record.date)
      setAttachments(record.attachments || [])
    }
  }, [record])

  if (!record) return null

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shipmentId.trim() || !itemsDescription.trim()) {
      showToast("Validation failed", "warning", "Provide a shipment reference ID and items description.")
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateHkcDocRecord(record.id, {
        shipmentId: shipmentId.trim(),
        itemsDescription: itemsDescription.trim(),
        type,
        date,
        attachments,
      })
      showToast("Documentation updated", "success", `Record ${updated.shipmentId} updated successfully.`)
      onSaveSuccess(updated)
      onClose()
    } catch (err) {
      showToast("Save failed", "warning", err instanceof Error ? err.message : "Failed to update record.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    confirm({
      title: "Delete Documentation Record?",
      message: "Are you sure you want to permanently delete this documentation record? This will delete all its attachments.",
      confirmLabel: "Delete Record",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        setIsDeleting(true)
        try {
          await deleteHkcDocRecord(record.id)
          showToast("Documentation deleted", "info", `Record ${record.shipmentId} deleted successfully.`)
          onDeleteSuccess(record.id)
          onClose()
        } catch (err) {
          showToast("Delete failed", "warning", err instanceof Error ? err.message : "Failed to delete record.")
        } finally {
          setIsDeleting(false)
        }
      },
    })
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
        <div className="flex items-start justify-between pb-3.5 mb-4 border-b border-zinc-200 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-zinc-900">Manage Shipment Documentation</h3>
            <p className="text-[11px] sm:text-xs text-zinc-500">Record ID: {record.id}</p>
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
        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center border-t border-zinc-200 pt-3.5 mt-4 gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="h-11 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-black px-4 inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="size-4" /> {isDeleting ? "Deleting..." : "Delete Record"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="h-11 flex-1 sm:flex-none rounded-xl border border-zinc-200 px-4 font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="h-11 flex-1 sm:flex-none min-w-[130px] rounded-xl bg-zinc-950 text-white font-bold px-5 inline-flex items-center justify-center gap-1.5 shadow-md hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isSaving ? <LoadingDots color="bg-white" size="sm" /> : <><Save className="size-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
