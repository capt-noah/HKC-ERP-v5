import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, Scale, X } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"
import type { Product } from "@/lib/erpStore"
import { financeStore } from "@/lib/financeStore"

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

  const handleClearDifference = async () => {
    if (confirm("Are you sure you want to clear this cleaning difference? The physical deduction will revert to only the invoiced quantity.")) {
      setIsSaving(true)
      try {
        await onSaveDifference(product.id, row.id, 0, undefined)
        try {
          financeStore.reverseStockLoss("diff", row.id)
        } catch (finErr) {
          console.warn("Failed to reverse cleaning diff GL loss:", finErr)
        }
        showToast("Difference Cleared", "info", "Cleaning difference reset to 0.")
        onClose()
      } catch (err: any) {
        showToast("Error", "warning", err.message || "Failed to clear difference.")
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (diffVal < 0) {
      showToast("Validation Error", "warning", "Difference quantity cannot be negative.")
      return
    }

    setIsSaving(true)
    try {
      await onSaveDifference(product.id, row.id, diffVal, notes.trim() || undefined)
      if (diffVal > 0) {
        try {
          await financeStore.recordStockLoss({
            productId: product.id,
            productName: product.name,
            lossType: "diff",
            recordId: row.id,
            warehouseId: product.warehouse,
            quantity: diffVal,
            unitCost,
            unit: product.unit || "Quintal",
            lossDate: row.date || new Date().toISOString().slice(0, 10),
            reason: notes.trim() || "Sales Issue Cleaning Difference / Shrinkage",
          })
        } catch (finErr) {
          console.warn("Failed to record cleaning diff GL loss:", finErr)
        }
      } else {
        try {
          await financeStore.reverseStockLoss("diff", row.id)
        } catch (finErr) {
          console.warn("Failed to reverse cleaning diff GL loss:", finErr)
        }
      }

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

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <BodyScrollLock />
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150 relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-zinc-150">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-xs">
              <Scale className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-zinc-950 text-base">
                {row.differenceQty && row.differenceQty > 0 ? "Edit Cleaning Difference" : "Add Cleaning Difference"}
              </h3>
              <p className="text-xs text-zinc-500 font-semibold">
                {product.name} &bull; <span className="font-mono text-zinc-700">{row.voucherNo ? `Voucher: ${row.voucherNo}` : "Outbound Dispatch"}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          {/* Context Summary Card */}
          <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-zinc-700">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-black block">Invoiced Out</span>
              <span className="font-mono font-black text-zinc-900 text-sm">
                {invoicedQty.toLocaleString()} {product.unit || "Qtl"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-black block">Party / Client</span>
              <span className="font-bold text-zinc-900 text-xs truncate block" title={row.party}>
                {row.party || "—"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-black block">Dispatch Date</span>
              <span className="font-mono text-xs text-zinc-800">{row.date || "—"}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-black block">Unit Cost</span>
              <span className="font-mono text-xs font-bold text-zinc-800">
                ETB {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Difference Input */}
          <label className="space-y-1 block">
            <span className="text-zinc-600 uppercase text-[10px] font-black flex items-center justify-between">
              <span>Difference / Impurity Loss ({product.unit || "Quintal"})</span>
              <span className="text-rose-600 font-bold normal-case">Deducted from physical warehouse balance</span>
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 15"
              value={differenceQty}
              onChange={(e) => setDifferenceQty(e.target.value)}
              className="h-11 w-full border border-rose-200 bg-rose-50/30 rounded-xl px-3.5 font-mono font-black text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-base outline-none transition-all"
              autoFocus
            />
          </label>

          {/* Reason / Notes */}
          <label className="space-y-1 block">
            <span className="text-zinc-600 uppercase text-[10px] font-black">Reason / QC Observation (Optional)</span>
            <input
              type="text"
              placeholder="e.g. Foreign matter, rocks, and chaff removed during cleaning"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 w-full border border-zinc-200 rounded-xl px-3 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold transition-all"
            />
          </label>

          {/* Live Impact Preview */}
          <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-700">
              <span>Invoiced Outbound Dispatch:</span>
              <span className="font-mono font-bold">-{invoicedQty.toLocaleString()} {product.unit || "Qtl"}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
              <span>Cleaning Difference / Reject Loss:</span>
              <span className="font-mono">-{diffVal.toLocaleString()} {product.unit || "Qtl"}</span>
            </div>
            <div className="border-t border-amber-200/80 pt-2 flex items-center justify-between text-xs font-black text-zinc-950">
              <span>Total Physical Inventory Deduction:</span>
              <span className="font-mono text-base text-zinc-950">
                -{totalPhysicalDeduction.toLocaleString()} {product.unit || "Qtl"}
              </span>
            </div>
            {diffCostValue > 0 && (
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
                <span>Stock Valuation Reduction:</span>
                <span className="font-mono font-semibold text-rose-700">
                  -ETB {diffCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between border-t border-zinc-150 pt-4 mt-6">
            <div>
              {row.differenceQty && row.differenceQty > 0 ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleClearDifference}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  Clear Difference
                </button>
              ) : <div />}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-bold text-xs hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 className="size-4 text-white" />
                {isSaving ? "Saving..." : "Save Difference"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

