import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Scale, CheckCircle2 } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import type { Product } from "@/lib/erpStore"

export interface DiffModalRow {
  id: string
  voucherNo: string
  party: string
  date: string
  qtyOut: number
  differenceQty?: number
  unitPrice: number
  remark?: string
}

interface WH1SalesIssueDiffModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  row: DiffModalRow | null
  onSaveDifference: (
    productId: string,
    movementId: string,
    differenceQty: number,
    notes?: string
  ) => Promise<void>
}

export default function WH1SalesIssueDiffModal({
  isOpen,
  onClose,
  product,
  row,
  onSaveDifference,
}: WH1SalesIssueDiffModalProps) {
  const { showToast } = useFeedback()
  const [differenceQty, setDifferenceQty] = useState("")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen && row) {
      setDifferenceQty(row.differenceQty && row.differenceQty > 0 ? String(row.differenceQty) : "")
      // Extract notes if reason has [Diff: ...]
      const match = row.remark?.match(/\[Diff:\s*[\d.]+\s*Qtl\s*-\s*([^\]]+)\]/i)
      setNotes(match ? match[1] : "")
    }
  }, [isOpen, row])

  if (!isOpen || !product || !row) return null

  const invoicedQty = Number(row.qtyOut || 0)
  const diffVal = parseFloat(differenceQty) || 0
  const totalPhysicalDeduction = invoicedQty + diffVal
  const unitCost = Number(row.unitPrice || product.unitCost || 0)
  const diffCostValue = diffVal * unitCost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (diffVal < 0) {
      showToast("Validation Error", "warning", "Difference quantity cannot be negative.")
      return
    }

    setIsSaving(true)
    try {
      await onSaveDifference(product.id, row.id, diffVal, notes.trim() || undefined)
      showToast(
        "Difference Saved",
        "success",
        diffVal > 0
          ? `Recorded difference of ${diffVal.toLocaleString()} ${product.unit || "Quintals"} (Total deduction: ${totalPhysicalDeduction.toLocaleString()} ${product.unit || "Quintals"}).`
          : "Difference cleared. Standard invoiced deduction restored."
      )
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to save difference.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-zinc-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-150">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <Scale className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-zinc-900 text-sm">
                  {row.differenceQty ? "Edit Cleaning Difference" : "Add Cleaning Difference"}
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono">
                  {row.voucherNo} &bull; {product.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            {/* Context Summary Card */}
            <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-2xl grid grid-cols-2 gap-2 text-zinc-700">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Invoiced to Client</span>
                <span className="font-mono font-black text-zinc-900 text-sm">
                  {invoicedQty.toLocaleString()} {product.unit || "Quintal"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Customer / Party</span>
                <span className="font-bold text-zinc-900 text-xs truncate block" title={row.party}>
                  {row.party}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Dispatch Date</span>
                <span className="font-mono text-xs">{row.date}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Unit Cost</span>
                <span className="font-mono text-xs font-bold">
                  ETB {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Difference Input */}
            <label className="space-y-1 block">
              <span className="text-zinc-600 uppercase text-[10px] font-black flex items-center justify-between">
                <span>Difference / Impurity Loss ({product.unit || "Quintal"})</span>
                <span className="text-rose-600 font-bold normal-case">Deducted from warehouse inventory</span>
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 15"
                value={differenceQty}
                onChange={(e) => setDifferenceQty(e.target.value)}
                className="h-10 w-full border border-rose-200 bg-rose-50/20 rounded-xl px-3 font-mono font-bold text-rose-900 focus:outline-rose-500 text-sm"
                autoFocus
              />
            </label>

            {/* Reason / Notes */}
            <label className="space-y-1 block">
              <span className="text-zinc-600 uppercase text-[10px] font-black">Reason / QC Observation</span>
              <input
                type="text"
                placeholder="e.g. Rocks, dust, and chaff removed during cleaning"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 w-full border border-zinc-200 rounded-xl px-3 text-xs"
              />
            </label>

            {/* Live Impact Calculation Preview */}
            <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-700">
                <span>Invoiced Dispatch:</span>
                <span className="font-mono font-bold">-{invoicedQty.toLocaleString()} {product.unit}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
                <span>Cleaning Loss / Difference:</span>
                <span className="font-mono">-{diffVal.toLocaleString()} {product.unit}</span>
              </div>
              <div className="border-t border-amber-200/80 pt-1.5 flex items-center justify-between text-xs font-black text-zinc-950">
                <span>Total Inventory Deducted:</span>
                <span className="font-mono text-sm text-zinc-950">
                  -{totalPhysicalDeduction.toLocaleString()} {product.unit}
                </span>
              </div>
              {diffCostValue > 0 && (
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
                  <span>Stock Value Impact:</span>
                  <span className="font-mono font-semibold text-rose-700">
                    -ETB {diffCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 border-t border-zinc-150 pt-4 mt-5">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 font-bold text-xs hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="size-4 text-white" />
                {isSaving ? "Saving Difference..." : "Save Difference"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
