import { useState, useEffect } from "react"
import { X, ArrowDownLeft, MinusCircle, ChevronDown, CheckCircle2, Info } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { useErpStore, type Product, type WH1Entry } from "@/lib/erpStore"

interface WH1AddMovementModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
  onSaveEntry: (productId: string, entryData: Omit<WH1Entry, "entryId">) => Promise<void>
  onSaveLeave?: (productId: string, leaveData: {
    date: string
    voucherNo?: string
    party: string
    plateNumber?: string
    quantityIssued: number
    remark?: string
    unitPrice?: number
  }) => Promise<void>
  onSaveReject: (productId: string, rejectData: {
    entryId?: string
    date: string
    voucherNo?: string
    party?: string
    plateNumber?: string
    rejectQuantity: number
    reason?: string
    notes?: string
  }) => Promise<void>
  onSaveProcessed?: (productId: string, processedData: {
    date: string
    voucherNo?: string
    quantity: number
    notes?: string
    plateNumber?: string
  }) => Promise<void>
}

const TON_TO_QUINTAL = 10

export default function WH1AddMovementModal({
  isOpen,
  product,
  onClose,
  onSaveEntry,
  onSaveReject,
  onSaveProcessed,
}: WH1AddMovementModalProps) {
  const erp = useErpStore()
  const { showToast } = useFeedback()
  const [activeTab, setActiveTab] = useState<"entry" | "processed" | "reject">("entry")
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
  const [sellingPrice, setSellingPrice] = useState("")
  const [entryDate, setEntryDate] = useState("")
  const [notes, setNotes] = useState("")

  // Reject Loss Form State
  const [rejectDate, setRejectDate] = useState("")
  const [rejectQuantity, setRejectQuantity] = useState("")
  const [rejectParty, setRejectParty] = useState("")
  const [showRejectSupplierDropdown, setShowRejectSupplierDropdown] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")

  // Processed Goods Form State
  const [processedDate, setProcessedDate] = useState("")
  const [processedQuantity, setProcessedQuantity] = useState("")
  const [processedVoucher, setProcessedVoucher] = useState("")
  const [processedPlate, setProcessedPlate] = useState("")
  const [processedNotes, setProcessedNotes] = useState("")

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
      setSellingPrice(product.sellingPrice ? String(product.sellingPrice) : "")
      setEntryDate(new Date().toISOString().slice(0, 10))
      setNotes("")

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
      setRejectNotes("")

      // Reset Processed fields
      setProcessedDate(new Date().toISOString().slice(0, 10))
      setProcessedQuantity("")
      setProcessedVoucher("")
      setProcessedPlate(product.plateNumber || "")
      setProcessedNotes("")
    }
  }, [isOpen, product])

  if (!isOpen || !product) return null

  const handleSaveEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawQty = Number(quantity)
    const costPrice = Number(unitPrice)
    if (!entryDate || !Number.isFinite(rawQty) || rawQty <= 0) {
      showToast("Validation Error", "warning", "Please provide a valid entry date and positive quantity.")
      return
    }
    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      showToast("Validation Error", "warning", "Cost Price is mandatory and must be greater than 0 ETB.")
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
        unitPrice: costPrice,
        sellingPrice: Number(sellingPrice) > 0 ? Number(sellingPrice) : undefined,
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

  const availableRejectStock = product?.quantity || 0
  const totalRemainingStock = (product?.wh1Entries || []).reduce(
    (sum, e) => sum + Number(e.quantityRemaining ?? e.quantityReceived ?? 0),
    0
  )
  const totalRemainingValue = (product?.wh1Entries || []).reduce(
    (sum, e) =>
      sum +
      Number(e.quantityRemaining ?? e.quantityReceived ?? 0) *
        Number(e.unitPrice ?? product.unitCost ?? 0),
    0
  )
  const effectiveRejectUnitCost =
    totalRemainingStock > 0
      ? totalRemainingValue / totalRemainingStock
      : Number(product?.unitCost || 0)
  const computedRejectLossValue = (Number(rejectQuantity) || 0) * effectiveRejectUnitCost

  const handleSaveRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawQty = Number(rejectQuantity)
    if (!rejectDate || !Number.isFinite(rawQty) || rawQty <= 0) {
      showToast("Validation Error", "warning", "Please provide a valid rejection date and positive quantity.")
      return
    }

    if (rawQty > availableRejectStock) {
      showToast(
        "Stock Error",
        "warning",
        `Cannot reject ${rawQty} ${product.unit || "Qtl"}. Total warehouse balance is only ${product.quantity} ${product.unit || "Qtl"}.`
      )
      return
    }

    setIsSaving(true)
    try {
      await onSaveReject(product.id, {
        date: rejectDate,
        party: rejectParty.trim() || product.customer || product.supplierName || "Direct Supplier",
        rejectQuantity: rawQty,
        reason: "Reject / Cleaning Loss",
        notes: rejectNotes.trim() || undefined,
      })
      showToast(
        "Success",
        "success",
        `Reject loss deduction of ${rawQty.toLocaleString()} ${product.unit || "Quintals"} recorded (Loss Value: ETB ${computedRejectLossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
      )
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to record rejection deduction.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveProcessedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !onSaveProcessed) return
    const rawQty = parseFloat(processedQuantity)
    if (isNaN(rawQty) || rawQty <= 0) {
      showToast("Validation Error", "warning", "Please specify a valid processed quantity.")
      return
    }

    setIsSaving(true)
    try {
      await onSaveProcessed(product.id, {
        date: processedDate || new Date().toISOString().slice(0, 10),
        voucherNo: processedVoucher.trim() || undefined,
        quantity: rawQty,
        notes: processedNotes.trim() || undefined,
        plateNumber: processedPlate.trim() || undefined,
      })
      showToast(
        "Processed Goods Recorded",
        "success",
        `Categorized ${rawQty.toLocaleString()} ${product.unit || "Quintals"} as processed goods.`
      )
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to record processed goods.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-zinc-200">
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
              onClick={() => setActiveTab("processed")}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "processed"
                  ? "bg-white text-sky-800 shadow-xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <CheckCircle2 className="size-3.5 text-sky-600" />
              Processed Goods
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
                  <span className="text-zinc-700 uppercase text-[10px] font-black">Cost Price (ETB) *</span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    required
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono font-bold text-zinc-900"
                  />
                </label>

                <label className="space-y-1 block">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-900 uppercase text-[10px] font-black">
                      Selling Price (ETB) <span className="text-[9px] text-zinc-400 font-normal lowercase">(optional)</span>
                    </span>
                    {(() => {
                      const cost = Number(unitPrice || 0)
                      const sell = Number(sellingPrice || 0)
                      if (cost > 0 && sell > 0) {
                        const pct = Math.round(((sell - cost) / cost) * 100)
                        return (
                          <span className={`text-[10px] font-black font-mono ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {pct >= 0 ? `+${pct}%` : `${pct}%`}
                          </span>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="h-10 w-full border border-blue-200 bg-blue-50/30 rounded-xl px-3 font-mono font-bold text-blue-950"
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

          {/* TAB 2: PROCESSED GOODS CATEGORIZATION */}
          {activeTab === "processed" && (
            <form onSubmit={handleSaveProcessedSubmit} className="space-y-4 text-xs font-semibold">
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-sky-950 text-xs flex items-start gap-2.5">
                <Info className="size-4 text-sky-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-sky-950">Informational Categorization</p>
                  <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                    Recording processed goods documents cleaned, sorted commodity surplus remaining in the warehouse. It does not alter your physical inventory total or financial stock valuation.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Date Processed</span>
                  <input
                    type="date"
                    value={processedDate}
                    onChange={(e) => setProcessedDate(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono font-bold"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">
                    Quantity Processed ({product.unit || "Quintal"})
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 485"
                    value={processedQuantity}
                    onChange={(e) => setProcessedQuantity(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono font-bold text-sky-900"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Parcel / Batch / Reference (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. Surplus from SO-2500 run"
                    value={processedVoucher}
                    onChange={(e) => setProcessedVoucher(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Truck Plate / Staging Bay (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. Bay 2 / Warehouse Floor"
                    value={processedPlate}
                    onChange={(e) => setProcessedPlate(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 uppercase font-mono"
                  />
                </label>

                <label className="space-y-1 block md:col-span-2">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Cleaning Line / QC Notes</span>
                  <input
                    type="text"
                    placeholder="e.g. Cleaned & destoned grade-1 mung bean surplus ready in store"
                    value={processedNotes}
                    onChange={(e) => setProcessedNotes(e.target.value)}
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
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="size-4 text-white" />
                  {isSaving ? "Saving..." : "Record Processed Goods"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: REJECT LOSS (CLEANING DEDUCTION) */}
          {activeTab === "reject" && (
            <form onSubmit={handleSaveRejectSubmit} className="space-y-4 text-xs font-semibold">
              {/* Dynamic Live Loss Card */}
              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-900 font-extrabold flex items-center gap-1.5">
                    <MinusCircle className="size-3.5 text-rose-600" />
                    Deducting from Total Warehouse Balance (Average Unit Cost)
                  </span>
                  <span className="font-mono text-zinc-500 text-[11px]">
                    Available: <strong className="text-zinc-900">{availableRejectStock.toLocaleString()} {product.unit}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-rose-200/50 text-[11px]">
                  <div className="bg-white/80 p-2 rounded-xl border border-rose-100">
                    <span className="text-zinc-400 block text-[9px] uppercase font-bold">Average Unit Cost</span>
                    <span className="font-mono font-black text-zinc-900">
                      ETB {effectiveRejectUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-rose-100">
                    <span className="text-zinc-400 block text-[9px] uppercase font-bold">Deducted Quantity</span>
                    <span className="font-mono font-black text-rose-700">
                      {Number(rejectQuantity) > 0 ? Number(rejectQuantity).toLocaleString() : "0"} {product.unit}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-rose-100 col-span-2 sm:col-span-1">
                    <span className="text-zinc-400 block text-[9px] uppercase font-bold">Total Loss Valuation</span>
                    <span className="font-mono font-black text-rose-700">
                      ETB {computedRejectLossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-rose-800/80 italic pt-0.5">
                  💡 Stock asset value will decrease by ETB {computedRejectLossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} based on weighted average acquisition cost.
                </p>
              </div>

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

                <label className="space-y-1 block md:col-span-1">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">
                    Deducted Reject Quantity ({product.unit})
                  </span>
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

                <label className="space-y-1 block md:col-span-1">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">Quality / QC Notes (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. Broken seeds removed during sorting"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
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
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  {isSaving ? "Recording Rejection..." : "Record Rejection Loss"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
  )
}
