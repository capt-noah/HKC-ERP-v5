import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import type { BinCardEntry } from "@/lib/binCardApi"

interface BinCardEntryModalProps {
  isOpen: boolean
  cardTitle: string
  unit: string
  entry: BinCardEntry | null
  onClose: () => void
  onSave: (data: Omit<BinCardEntry, "id" | "balance">) => void | Promise<void>
  onDelete?: (entryId: string) => void | Promise<void>
}

export default function BinCardEntryModal({
  isOpen,
  cardTitle,
  unit,
  entry,
  onClose,
  onSave,
  onDelete
}: BinCardEntryModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [batchNo, setBatchNo] = useState("")
  const [type, setType] = useState<"received" | "issued">("received")
  const [qty, setQty] = useState<number | "">(0)
  const [expiryDate, setExpiryDate] = useState("")
  const [party, setParty] = useState("")
  const [remark, setRemark] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (entry) {
      setDate(entry.date)
      setBatchNo(entry.batchNo)
      setType(entry.qtyReceived > 0 ? "received" : "issued")
      setQty(entry.qtyReceived > 0 ? entry.qtyReceived : entry.qtyIssued)
      setExpiryDate(entry.expiryDate)
      setParty(entry.party)
      setRemark(entry.remark)
    } else {
      setDate(new Date().toISOString().split("T")[0])
      setBatchNo("")
      setType("received")
      setQty("")
      setExpiryDate("")
      setParty("")
      setRemark("")
    }
  }, [entry, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numericQty = Number(qty || 0)
    if (numericQty <= 0) return

    try {
      setIsSubmitting(true)
      await Promise.resolve(onSave({
        date,
        batchNo: batchNo || "N/A",
        qtyReceived: type === "received" ? numericQty : 0,
        qtyIssued: type === "issued" ? numericQty : 0,
        expiryDate: expiryDate || "N/A",
        party: party || "Standard Processing",
        remark: remark || "N/A"
      }))
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!entry || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(entry.id)
      setIsDeleteModalOpen(false)
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800"
        >
          {/* Shared Standard Edit Modal Header */}
          <EditModalHeader
            title={entry ? "Edit Movement Entry" : "Add Bin Stock Movement"}
            subtitle={`Card: ${cardTitle}`}
            onClose={onClose}
            onRequestDelete={entry && onDelete ? () => setIsDeleteModalOpen(true) : undefined}
            deleteLabel="Delete Movement Entry"
          />

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Transaction Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BATCH-2026-X01"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Movement Type</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setType("received")}
                    className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      type === "received" 
                        ? "bg-emerald-600 text-white shadow-xs" 
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    Received (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("issued")}
                    className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      type === "issued" 
                        ? "bg-rose-600 text-white shadow-xs" 
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    Issued (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Quantity ({unit})</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 100"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Batch Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-semibold outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Received From / Issued To</label>
                <input
                  type="text"
                  placeholder="e.g. Addis Vet Clinic"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-semibold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Remark / Reference</label>
              <input
                type="text"
                placeholder="e.g. GRN#9021 or Invoice #INV-2026-88"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-semibold outline-none"
              />
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-full border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[140px] inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <LoadingDots color="bg-white" size="sm" /> : (entry ? "Save Movement Entry" : "Record Entry")}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Shared Delete Confirmation Modal */}
      <RecordDeleteModal
        isOpen={isDeleteModalOpen}
        title="Delete Movement Entry"
        recordId={entry?.batchNo}
        recordName={`${entry?.qtyReceived ? `Received +${entry.qtyReceived}` : `Issued -${entry?.qtyIssued}`} ${unit} (${entry?.party || ''})`}
        description="Are you sure you want to delete this movement entry? The running stock balance will be automatically recalculated."
        isDeleting={isDeleting}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  )
}
