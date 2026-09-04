import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowDownLeft, ArrowUpRight, Info } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { loadResource } from "@/lib/apiPersistence"
import type { Product, WH1Entry } from "@/lib/erpStore"

interface WH1AddMovementModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
  onSaveEntry: (productId: string, entryData: Omit<WH1Entry, "entryId">) => Promise<void>
  onSaveLeave: (productId: string, leaveData: {
    date: string
    voucherNo?: string
    party: string
    plateNumber?: string
    quantityIssued: number
    remark?: string
    unitPrice?: number
  }) => Promise<void>
}

const TON_TO_QUINTAL = 10

export default function WH1AddMovementModal({
  isOpen,
  product,
  onClose,
  onSaveEntry,
  onSaveLeave,
}: WH1AddMovementModalProps) {
  const { showToast } = useFeedback()
  const [activeTab, setActiveTab] = useState<"entry" | "leave">("entry")
  const [isSaving, setIsSaving] = useState(false)

  // Inbound Entry Form State
  const [voucherNo, setVoucherNo] = useState("")
  const [customer, setCustomer] = useState("")
  const [plateNumber, setPlateNumber] = useState("")
  const [packagingUnit, setPackagingUnit] = useState("Quintal")
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [entryDate, setEntryDate] = useState("")
  const [notes, setNotes] = useState("")

  // Outbound Leave Form State
  const [leaveDate, setLeaveDate] = useState("")
  const [leaveVoucherNo, setLeaveVoucherNo] = useState("")
  const [leaveCustomer, setLeaveCustomer] = useState("")
  const [leavePlateNumber, setLeavePlateNumber] = useState("")
  const [leaveQuantity, setLeaveQuantity] = useState("")
  const [leaveRemarks, setLeaveRemarks] = useState("")
  const [existingSalesIssues, setExistingSalesIssues] = useState<any[]>([])
  const [selectedIssueId, setSelectedIssueId] = useState("")

  useEffect(() => {
    if (isOpen && product) {
      setActiveTab("entry")
      setVoucherNo("")
      setCustomer(product.customer || "")
      setPlateNumber(product.plateNumber || "")
      setPackagingUnit(product.unit || "Quintal")
      setQuantity("")
      setUnitPrice(product.unitCost ? String(product.unitCost) : "")
      setEntryDate(new Date().toISOString().slice(0, 10))
      setNotes("")

      // Reset Leave fields
      setLeaveDate(new Date().toISOString().slice(0, 10))
      setLeaveVoucherNo("")
      setLeaveCustomer("")
      setLeavePlateNumber("")
      setLeaveQuantity("")
      setLeaveRemarks("")
      setSelectedIssueId("")

      // Load matching sales issues for fallback reconciliation
      loadResource<any>("sales_issues")
        .then((issues: any[]) => {
          if (Array.isArray(issues)) {
            const matching = issues.filter((iss: any) => {
              const items = iss.items || iss.line_items || []
              return items.some(
                (it: any) =>
                  it.item_id === product.id ||
                  it.productId === product.id ||
                  (it.item_name || "").toLowerCase().trim() === product.name.toLowerCase().trim()
              )
            })
            setExistingSalesIssues(matching)
          }
        })
        .catch(() => setExistingSalesIssues([]))
    }
  }, [isOpen, product])

  const handleSelectIssue = (issueId: string) => {
    setSelectedIssueId(issueId)
    const found = existingSalesIssues.find((i) => i.id === issueId || String(i.fs_no) === issueId)
    if (found) {
      setLeaveVoucherNo(found.fs_no ? String(found.fs_no) : found.id)
      setLeaveCustomer(found.customer_name || found.customer || "")
      setLeavePlateNumber(found.plate_number || found.plateNumber || "")
      if (found.sale_date) setLeaveDate(found.sale_date)

      // Find matching quantity for this product
      const item = (found.items || found.line_items || []).find(
        (it: any) =>
          it.item_id === product?.id ||
          it.productId === product?.id ||
          (it.item_name || "").toLowerCase().trim() === (product?.name || "").toLowerCase().trim()
      )
      if (item) {
        setLeaveQuantity(String(item.quantity || item.qty || ""))
      }
    }
  }

  if (!isOpen || !product) return null

  const handleSaveEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawQty = Number(quantity)
    if (!entryDate || !Number.isFinite(rawQty) || rawQty <= 0) {
      showToast("Validation Error", "warning", "Please provide a valid entry date and positive quantity.")
      return
    }

    const finalQty = packagingUnit === "Ton" ? rawQty * TON_TO_QUINTAL : rawQty

    setIsSaving(true)
    try {
      await onSaveEntry(product.id, {
        voucherNo: voucherNo.trim(),
        customer: customer.trim(),
        plateNumber: plateNumber.trim(),
        entryDate,
        quantityReceived: finalQty,
        quantityRemaining: finalQty,
        unitPrice: Number(unitPrice) || 0,
        notes: notes.trim(),
      })
      showToast("Success", "success", `Inbound entry of ${finalQty.toLocaleString()} Quintals recorded.`)
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to record entry.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawQty = Number(leaveQuantity)
    if (!leaveDate || !Number.isFinite(rawQty) || rawQty <= 0) {
      showToast("Validation Error", "warning", "Please provide a valid leave date and positive quantity.")
      return
    }

    if (rawQty > product.quantity) {
      showToast("Stock Error", "warning", `Cannot dispatch ${rawQty} Qtl. Current balance is only ${product.quantity} Qtl.`)
      return
    }

    setIsSaving(true)
    try {
      await onSaveLeave(product.id, {
        date: leaveDate,
        voucherNo: leaveVoucherNo.trim(),
        party: leaveCustomer.trim() || "Customer Dispatch",
        plateNumber: leavePlateNumber.trim() || "—",
        quantityIssued: rawQty,
        remark: leaveRemarks.trim() || (leaveVoucherNo ? `Sales Issue FS-${leaveVoucherNo}` : "Outbound Dispatch"),
      })
      showToast("Success", "success", `Outbound leave of ${rawQty.toLocaleString()} Quintals reconciled.`)
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to reconcile leave.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-zinc-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-150">
            <div>
              <h3 className="font-black text-zinc-900 text-base">Record Stock Movement &bull; {product.name}</h3>
              <p className="text-xs text-zinc-500">
                Available Physical Balance: <span className="font-mono font-bold text-zinc-900">{product.quantity.toLocaleString()} {product.unit}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex rounded-xl bg-zinc-100 p-1 mb-5 border border-zinc-200/80">
            <button
              type="button"
              onClick={() => setActiveTab("entry")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "entry"
                  ? "bg-white text-emerald-800 shadow-xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <ArrowDownLeft className="size-3.5 text-emerald-600" />
              📥 Inbound Entry (GRV Receipt)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("leave")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "leave"
                  ? "bg-white text-amber-800 shadow-xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <ArrowUpRight className="size-3.5 text-amber-600" />
              📤 Reconcile Sales Issue (Outbound)
            </button>
          </div>

          {/* TAB 1: INBOUND ENTRY */}
          {activeTab === "entry" && (
            <form onSubmit={handleSaveEntrySubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Voucher No / GRV #</span>
                  <input
                    type="text"
                    placeholder="e.g. 1042"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Supplier / Source</span>
                  <input
                    type="text"
                    placeholder="e.g. Adola Farmers Union"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Truck Plate Number</span>
                  <input
                    type="text"
                    placeholder="e.g. ET-3-A52735"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">UOM</span>
                  <select
                    value={packagingUnit}
                    onChange={(e) => setPackagingUnit(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 cursor-pointer"
                  >
                    <option value="Quintal">Quintal</option>
                    <option value="Ton">Ton</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Quantity</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono font-bold text-zinc-900"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Unit Cost / Price (ETB)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Entry Date</span>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Notes / Remarks</span>
                  <input
                    type="text"
                    placeholder="e.g. Lot 1, Moisture 11.5%"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                  />
                </label>
              </div>

              {packagingUnit === "Ton" && (
                <p className="text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                  Converts automatically: {quantity || 0} Tons = {(Number(quantity || 0) * TON_TO_QUINTAL).toLocaleString()} Quintals.
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-zinc-150 pt-4 mt-6">
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  {isSaving ? "Recording Entry..." : "Record Inbound Entry"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: RECONCILE SALES ISSUE */}
          {activeTab === "leave" && (
            <form onSubmit={handleSaveLeaveSubmit} className="space-y-4 text-xs font-semibold">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2 text-amber-900 text-[11px]">
                <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black">Automatic Reconciliation:</span> When a Sales Issue is posted in <span className="font-bold">Sales Issued</span>, the leave record is automatically created. Use this form only if you need to manually reconcile an existing sales issue.
                </div>
              </div>

              {existingSalesIssues.length > 0 && (
                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Select Existing Sales Issue</span>
                  <select
                    value={selectedIssueId}
                    onChange={(e) => handleSelectIssue(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono cursor-pointer bg-zinc-50/50"
                  >
                    <option value="">-- Choose from open sales issues --</option>
                    {existingSalesIssues.map((iss) => (
                      <option key={iss.id} value={iss.id}>
                        FS-{iss.fs_no || iss.id} &bull; {iss.customer_name || iss.customer} &bull; {iss.sale_date || "—"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">FS / Sales Issue Voucher #</span>
                  <input
                    type="text"
                    placeholder="e.g. 3095"
                    value={leaveVoucherNo}
                    onChange={(e) => setLeaveVoucherNo(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Buying Customer</span>
                  <input
                    type="text"
                    placeholder="e.g. Horizon Coffee Export"
                    value={leaveCustomer}
                    onChange={(e) => setLeaveCustomer(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Dispatch Truck Plate</span>
                  <input
                    type="text"
                    placeholder="e.g. ET-3-99120"
                    value={leavePlateNumber}
                    onChange={(e) => setLeavePlateNumber(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Leave / Dispatch Date</span>
                  <input
                    type="date"
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Quantity Dispatched (Quintal)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 80"
                    value={leaveQuantity}
                    onChange={(e) => setLeaveQuantity(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono font-bold text-amber-900"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Dispatch Remarks / Reference</span>
                  <input
                    type="text"
                    placeholder="e.g. Contract No. EXP-2026"
                    value={leaveRemarks}
                    onChange={(e) => setLeaveRemarks(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-150 pt-4 mt-6">
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
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  {isSaving ? "Reconciling Leave..." : "Reconcile Outbound Leave"}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
