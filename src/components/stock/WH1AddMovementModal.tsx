import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowDownLeft, ArrowUpRight, MinusCircle, CheckCircle2, ChevronDown } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { loadResource } from "@/lib/apiPersistence"
import { useErpStore, type Product, type WH1Entry } from "@/lib/erpStore"

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
  onSaveReject: (productId: string, rejectData: {
    date: string
    rejectQuantity: number
    party?: string
  }) => Promise<void>
}

const TON_TO_QUINTAL = 10

export default function WH1AddMovementModal({
  isOpen,
  product,
  onClose,
  onSaveEntry,
  onSaveLeave,
  onSaveReject,
}: WH1AddMovementModalProps) {
  const erp = useErpStore()
  const { showToast } = useFeedback()
  const [activeTab, setActiveTab] = useState<"entry" | "leave" | "reject">("entry")
  const [isSaving, setIsSaving] = useState(false)

  // Inbound Entry Form State
  const [voucherNo, setVoucherNo] = useState("")
  const [customer, setCustomer] = useState("")
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [saveSupplierToRegistry, setSaveSupplierToRegistry] = useState(false)
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
  const [existingSalesIssues, setExistingSalesIssues] = useState<any[]>([])
  const [selectedIssueId, setSelectedIssueId] = useState("")

  // Reject Loss Form State (Simplified strictly as requested)
  const [rejectDate, setRejectDate] = useState("")
  const [rejectQuantity, setRejectQuantity] = useState("")
  const [rejectParty, setRejectParty] = useState("")
  const [showRejectSupplierDropdown, setShowRejectSupplierDropdown] = useState(false)

  useEffect(() => {
    if (isOpen && product) {
      const parentSupplier =
        product.customer ||
        product.supplierName ||
        (product.wh1Entries && product.wh1Entries.length > 0
          ? product.wh1Entries.find((e) => Boolean(e.customer))?.customer || (product.wh1Entries[0] as any)?.customer
          : "") ||
        (erp.getSuppliers().length === 1 ? erp.getSuppliers()[0].name : "") ||
        ""

      setActiveTab("entry")
      setVoucherNo("")
      setCustomer(parentSupplier)
      setShowSupplierDropdown(false)
      setSaveSupplierToRegistry(false)
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
      setSelectedIssueId("")

      // Associated suppliers for this product
      const itemSuppliers = Array.from(
        new Set(
          [
            product.customer,
            product.supplierName,
            ...(product.wh1Entries || []).map((e: any) => e.party || e.customer),
          ]
            .filter((s): s is string => Boolean(s && s.trim()))
            .map((s) => s.trim())
        )
      )
      const defaultSupplier =
        parentSupplier ||
        (itemSuppliers.length === 1
          ? itemSuppliers[0]
          : itemSuppliers.length === 0 && erp.getSuppliers().length === 1
          ? erp.getSuppliers()[0].name
          : "")

      // Reset Reject fields
      setRejectDate(new Date().toISOString().slice(0, 10))
      setRejectQuantity("")
      setRejectParty(defaultSupplier)
      setShowRejectSupplierDropdown(false)

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

  const isVoucherAlreadyReconciled = (voucher: string) => {
    if (!product || !voucher) return false
    const clean = voucher.toLowerCase().trim()
    if (!clean) return false
    const raw = clean.replace(/^fs-/, "")
    return (product.binCardEntries || []).some((b) => {
      if (b.type !== "leave") return false
      const bVoucher = (b.voucherNo || "").toLowerCase().trim()
      const bRawVoucher = bVoucher.replace(/^fs-/, "")
      const bRemark = (b.remark || "").toLowerCase().trim()

      return (
        bVoucher === clean ||
        bRawVoucher === raw ||
        (clean && bVoucher.includes(clean)) ||
        (raw && bVoucher.includes(raw)) ||
        (clean && bRemark.includes(clean)) ||
        (raw && bRemark.includes(raw))
      )
    })
  }

  const isIssueAlreadyReconciled = (iss: any) => {
    const fsNo = String(iss.fs_no || iss.id || "").toLowerCase().trim()
    return isVoucherAlreadyReconciled(fsNo)
  }

  const isCurrentVoucherAlreadyReconciled = isVoucherAlreadyReconciled(leaveVoucherNo)

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
      if (saveSupplierToRegistry && customer.trim()) {
        const suppName = customer.trim()
        const existingSupp = erp.getSuppliers().find((s) => s.name.toLowerCase() === suppName.toLowerCase())
        if (!existingSupp) {
          erp.addSupplier({
            id: `SUP-${Date.now()}`,
            name: suppName,
            country: "Ethiopia",
            status: "Active",
          })
        }
      }

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
      showToast("Save Error", "warning", err.message || "Failed to record inbound entry.")
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

    if (isCurrentVoucherAlreadyReconciled) {
      showToast(
        "Already Reconciled",
        "warning",
        `Sales Issue ${leaveVoucherNo} has already been deducted and recorded in the movement ledger. Duplicate deduction prevented.`
      )
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
        remark: leaveVoucherNo ? `Sales Issue FS-${leaveVoucherNo}` : "Outbound Dispatch",
      })
      showToast("Success", "success", `Outbound leave of ${rawQty.toLocaleString()} Quintals reconciled.`)
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to reconcile leave.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawQty = Number(rejectQuantity)
    if (!rejectDate || !Number.isFinite(rawQty) || rawQty <= 0) {
      showToast("Validation Error", "warning", "Please provide a valid rejection date and positive quantity.")
      return
    }

    if (rawQty > product.quantity) {
      showToast("Stock Error", "warning", `Cannot reject ${rawQty} Qtl. Current balance is only ${product.quantity} Qtl.`)
      return
    }

    setIsSaving(true)
    try {
      await onSaveReject(product.id, {
        date: rejectDate,
        rejectQuantity: rawQty,
        party: rejectParty.trim() || product.customer || product.supplierName || "Direct Supplier",
      })
      showToast("Success", "success", `Reject loss deduction of ${rawQty.toLocaleString()} Quintals recorded.`)
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to record rejection deduction.")
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

          {/* Segmented Mode Selector with 3 options */}
          <div className="flex rounded-xl bg-zinc-100 p-1 mb-5 border border-zinc-200/80 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("entry")}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "entry"
                  ? "bg-white text-emerald-800 shadow-xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <ArrowDownLeft className="size-3.5 text-emerald-600" />
              Inbound Entry (GRV)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("leave")}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "leave"
                  ? "bg-white text-amber-800 shadow-xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <ArrowUpRight className="size-3.5 text-amber-600" />
              Outbound Dispatch
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reject")}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "reject"
                  ? "bg-white text-rose-800 shadow-xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <MinusCircle className="size-3.5 text-rose-600" />
              Reject Loss (-)
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

                <div className="space-y-1 block relative">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Supplier / Source</span>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Search or select supplier..."
                      value={customer}
                      onFocus={() => setShowSupplierDropdown(true)}
                      onChange={(e) => {
                        setCustomer(e.target.value)
                        setShowSupplierDropdown(true)
                      }}
                      className="h-10 w-full border border-zinc-200 rounded-xl pl-3 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSupplierDropdown((prev) => !prev)}
                      className="absolute right-2 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                      title="Choose supplier from registry"
                    >
                      <ChevronDown className={`size-4 transition-transform ${showSupplierDropdown ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {showSupplierDropdown && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl bg-white border border-zinc-200 shadow-xl py-1 divide-y divide-zinc-50">
                      {(() => {
                        const allSuppliers = Array.from(
                          new Set([
                            ...erp.getSuppliers().map((s) => s.name),
                            product.customer,
                            product.supplierName,
                            ...(product.wh1Entries || []).map((e: any) => e.party || e.customer),
                          ].filter((s): s is string => Boolean(s && s.trim())))
                        )
                        const filtered = customer.trim()
                          ? allSuppliers.filter((s) => s.toLowerCase().includes(customer.toLowerCase()))
                          : allSuppliers
                        if (filtered.length === 0) {
                          return (
                            <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                              {allSuppliers.length === 0 ? "No suppliers registered yet" : `No matches for "${customer}"`}
                            </div>
                          )
                        }
                        return filtered.map((suppName) => {
                          const regSupp = erp.getSuppliers().find((s) => s.name.toLowerCase() === suppName.toLowerCase())
                          return (
                            <button
                              key={suppName}
                              type="button"
                              onClick={() => {
                                setCustomer(suppName)
                                setShowSupplierDropdown(false)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-xs flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div>
                                <span className="font-bold text-zinc-900 block">{suppName}</span>
                                {regSupp && (
                                  <span className="text-[10px] text-zinc-500 font-medium">
                                    {regSupp.phone ? `📞 ${regSupp.phone} • ` : ""}{regSupp.city || "Ethiopia"}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })
                      })()}
                    </div>
                  )}
                </div>

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

                {!erp.getSuppliers().some((s) => s.name.toLowerCase() === customer.trim().toLowerCase()) && customer.trim() !== "" && (
                  <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      id="saveSupplierCheckModal"
                      checked={saveSupplierToRegistry}
                      onChange={(e) => setSaveSupplierToRegistry(e.target.checked)}
                      className="size-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                    />
                    <label htmlFor="saveSupplierCheckModal" className="text-xs font-bold text-emerald-950 cursor-pointer">
                      Save new supplier details to registry for future arrivals
                    </label>
                  </div>
                )}

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

          {/* TAB 2: RECONCILE SALES ISSUE (OUTBOUND) */}
          {activeTab === "leave" && (
            <form onSubmit={handleSaveLeaveSubmit} className="space-y-4 text-xs font-semibold">
              {isCurrentVoucherAlreadyReconciled && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-900 text-[11px] font-bold">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>Sales Issue {leaveVoucherNo} has already been deducted and recorded in the movement ledger. No additional deduction is needed.</span>
                </div>
              )}

              {existingSalesIssues.length > 0 && (
                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Select Existing Sales Issue</span>
                  <select
                    value={selectedIssueId}
                    onChange={(e) => handleSelectIssue(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono cursor-pointer bg-zinc-50/50"
                  >
                    <option value="">-- Choose from sales issues --</option>
                    {existingSalesIssues.map((iss) => {
                      const alreadyDone = isIssueAlreadyReconciled(iss)
                      return (
                        <option key={iss.id} value={iss.id}>
                          FS-{iss.fs_no || iss.id} &bull; {iss.customer_name || iss.customer} &bull; {iss.sale_date || "—"} {alreadyDone ? "✓ (Already Deducted)" : "⚠️ (Missing Leave Deduction)"}
                        </option>
                      )
                    })}
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

                <label className="space-y-1 block md:col-span-2">
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
                  disabled={isSaving || isCurrentVoucherAlreadyReconciled}
                  className={`px-5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer ${
                    isCurrentVoucherAlreadyReconciled
                      ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                      : "bg-amber-700 hover:bg-amber-800 text-white"
                  }`}
                >
                  {isSaving
                    ? "Reconciling Leave..."
                    : isCurrentVoucherAlreadyReconciled
                    ? "Already Deducted"
                    : "Reconcile Outbound Leave"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: REJECT LOSS (CLEANING DEDUCTION) */}
          {activeTab === "reject" && (
            <form onSubmit={handleSaveRejectSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Rejection Date</span>
                  <input
                    type="date"
                    value={rejectDate}
                    onChange={(e) => setRejectDate(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    required
                  />
                </label>

                <div className="space-y-1 relative">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Supplier / Source</span>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="e.g. Adola Farmers Union"
                      value={rejectParty}
                      onFocus={() => setShowRejectSupplierDropdown(true)}
                      onChange={(e) => {
                        setRejectParty(e.target.value)
                        setShowRejectSupplierDropdown(true)
                      }}
                      className="h-10 w-full border border-zinc-200 rounded-xl pl-3 pr-9 font-semibold text-xs outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRejectSupplierDropdown((prev) => !prev)}
                      className="absolute right-2 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                      title="Choose supplier from registry"
                    >
                      <ChevronDown className={`size-4 transition-transform ${showRejectSupplierDropdown ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {showRejectSupplierDropdown && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl bg-white border border-zinc-200 shadow-xl py-1 divide-y divide-zinc-50">
                      {(() => {
                        const allSuppliers = Array.from(
                          new Set([
                            ...erp.getSuppliers().map((s) => s.name),
                            ...((product?.wh1Entries || []).map((e: any) => e.party || e.customer).filter(Boolean)),
                            product?.customer,
                            product?.supplierName,
                          ].filter((s): s is string => Boolean(s && s.trim())))
                        )
                        const filtered = rejectParty.trim()
                          ? allSuppliers.filter((s) => s.toLowerCase().includes(rejectParty.toLowerCase()))
                          : allSuppliers
                        if (filtered.length === 0) {
                          return (
                            <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                              {allSuppliers.length === 0 ? "No suppliers found" : `No matches for "${rejectParty}"`}
                            </div>
                          )
                        }
                        return filtered.map((suppName) => {
                          const regSupp = erp.getSuppliers().find((s) => s.name.toLowerCase() === suppName.toLowerCase())
                          return (
                            <button
                              key={suppName}
                              type="button"
                              onClick={() => {
                                setRejectParty(suppName)
                                setShowRejectSupplierDropdown(false)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-rose-50 text-xs flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div>
                                <span className="font-bold text-zinc-900 block">{suppName}</span>
                                {regSupp && (
                                  <span className="text-[10px] text-zinc-500 font-medium">
                                    {regSupp.phone ? `📞 ${regSupp.phone} • ` : ""}{regSupp.city || "Ethiopia"}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })
                      })()}
                    </div>
                  )}
                </div>

                <label className="space-y-1 block md:col-span-2">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Deducted Reject Quantity (Quintal)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 15.5"
                    value={rejectQuantity}
                    onChange={(e) => setRejectQuantity(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono font-bold text-rose-900"
                    required
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
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  {isSaving ? "Recording Rejection..." : "Record Rejection Loss"}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
