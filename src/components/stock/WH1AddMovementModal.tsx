import { useState, useEffect } from "react"
import { X, ArrowDownLeft, MinusCircle, ChevronDown, CheckCircle2, Package } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { useErpStore, type Product, type WH1Entry } from "@/lib/erpStore"
import { financeStore } from "@/lib/financeStore"
import { LoadingDots } from "@/components/ui/LoadingDots"

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
  const [isConfirmEntryOpen, setIsConfirmEntryOpen] = useState(false)

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
  const [rejectVoucher, setRejectVoucher] = useState("")
  const [rejectNotes, setRejectNotes] = useState("")

  // Processed Goods Form State
  const [processedDate, setProcessedDate] = useState("")
  const [processedQuantity, setProcessedQuantity] = useState("")
  const [processedVoucher, setProcessedVoucher] = useState("")
  const [processedPlate, setProcessedPlate] = useState("")
  const [processedNotes, setProcessedNotes] = useState("")

  useEffect(() => {
    if (isOpen && product) {
      setActiveTab("entry")
      setVoucherNo("")
      setCustomer("")
      setShowSupplierDropdown(false)
      setSaveSupplierToRegistry(false)
      setPlateNumber(product.plateNumber || "")
      setPackagingUnit(product.unit || "Quintal")
      setQuantity("")
      setUnitPrice(product.unitCost ? String(product.unitCost) : "")
      setSellingPrice(product.sellingPrice ? String(product.sellingPrice) : "")
      setEntryDate(new Date().toISOString().slice(0, 10))
      setNotes("")

      // Reset Reject fields
      setRejectDate(new Date().toISOString().slice(0, 10))
      setRejectQuantity("")
      setRejectVoucher("")
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

  const handleSaveEntrySubmit = (e: React.FormEvent) => {
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

    setIsConfirmEntryOpen(true)
  }

  const handleExecuteEntrySave = async () => {
    const rawQty = Number(quantity)
    const costPrice = Number(unitPrice)
    const finalQty = packagingUnit === "Ton" ? rawQty * TON_TO_QUINTAL : rawQty

    setIsSaving(true)
    try {
      if (saveSupplierToRegistry && customer.trim()) {
        const suppName = customer.trim()
        const existingSupp = erp.getSuppliers().find((s) => (s?.name || "").toLowerCase() === suppName.toLowerCase())
        if (!existingSupp) {
          await erp.addSupplier({
            id: `SUP-${Date.now()}`,
            name: suppName,
            country: "Ethiopia",
            city: "Addis Ababa",
            category: "Agricultural Producer / Union",
            warehouseTarget: "WH1-AGRI-EXP",
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

      // Automatically post GL stock intake for inbound movement
      try {
        await financeStore.recordStockIntake({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          warehouseId: product.warehouse,
          quantity: finalQty,
          unitCost: costPrice,
          unit: "Quintal",
          entryDate,
          entryId: voucherNo.trim() ? `GRV-${voucherNo.trim()}` : undefined,
          isChild: true,
        })
      } catch (finErr) {
        console.warn("Failed to record inbound truckload stock GL intake:", finErr)
      }

      showToast("Success", "success", `Inbound entry of ${finalQty.toLocaleString()} Quintals recorded.`)
      setIsConfirmEntryOpen(false)
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
        voucherNo: rejectVoucher.trim() || undefined,
        party: "WH1 Cleaning / Processing Line",
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
    <>
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
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Supplier / Source</span>
                    {!erp.getSuppliers().some((s) => (s?.name || "").toLowerCase() === customer.trim().toLowerCase()) && customer.trim() !== "" && (
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors">
                        <input
                          type="checkbox"
                          id="saveSupplierCheckModal"
                          checked={saveSupplierToRegistry}
                          onChange={(e) => setSaveSupplierToRegistry(e.target.checked)}
                          className="size-3.5 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                        />
                        Save to registry
                      </label>
                    )}
                  </div>
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
                          ? allSuppliers.filter((s) => (s || "").toLowerCase().includes(customer.toLowerCase()))
                          : allSuppliers
                        if (filtered.length === 0) {
                          return (
                            <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                              {allSuppliers.length === 0 ? "No suppliers registered yet" : `No matches for "${customer}"`}
                            </div>
                          )
                        }
                        return filtered.map((suppName) => {
                          const regSupp = erp.getSuppliers().find((s) => (s?.name || "").toLowerCase() === (suppName || "").toLowerCase())
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
                  <span className="text-zinc-700 uppercase text-[10px] font-black">
                    Quantity ({packagingUnit}) *
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
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

                <label className="space-y-1 block">
                  <span className="text-zinc-500 uppercase text-[10px] font-black">
                    Voucher / Ref <span className="text-[9px] text-zinc-400 font-normal lowercase">(optional)</span>
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. VR-001 or REF-2024"
                    value={rejectVoucher}
                    onChange={(e) => setRejectVoucher(e.target.value)}
                    className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono font-bold text-zinc-900 outline-none focus:border-rose-500"
                  />
                </label>

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

      {/* CONFIRMATION MODAL: INCOMING EXPORT SUB-ENTRY */}
      {isConfirmEntryOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-zinc-200 space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
                <Package className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Incoming Export Sub-Entry
                  </span>
                </div>
                <h3 className="text-lg font-black text-zinc-950 truncate">
                  Confirm Export Sub-Entry Intake
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Review the export stock intake details and General Ledger valuation impact before confirming.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                <span className="font-semibold text-zinc-500">Item Name</span>
                <span className="font-black text-zinc-900 text-right max-w-[240px] truncate">{product.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                <span className="font-semibold text-zinc-500">SKU</span>
                <span className="font-mono font-bold text-zinc-800">{product.sku}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                <span className="font-semibold text-zinc-500">Voucher / GRV #</span>
                <span className="font-mono font-black text-zinc-900 bg-white px-2 py-0.5 rounded-md border border-zinc-200">{voucherNo.trim() || "N/A"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 py-1 border-b border-zinc-200/60">
                <div>
                  <span className="block font-semibold text-zinc-500 text-[11px]">Plate Number</span>
                  <span className="font-mono font-bold text-zinc-800">{plateNumber.trim() || "N/A"}</span>
                </div>
                <div>
                  <span className="block font-semibold text-zinc-500 text-[11px]">Entry Date</span>
                  <span className="font-mono font-bold text-zinc-800">{entryDate}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                <span className="font-semibold text-zinc-500">Intake Quantity</span>
                <span className="font-black text-emerald-800">
                  {(packagingUnit === "Ton" ? Number(quantity || 0) * TON_TO_QUINTAL : Number(quantity || 0)).toLocaleString()} Quintals
                  {packagingUnit === "Ton" ? ` (${Number(quantity || 0)} Tons)` : ""}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                <span className="font-semibold text-zinc-500">Unit Cost Price</span>
                <span className="font-bold text-zinc-900">
                  {Number(unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 bg-emerald-50/80 -mx-2 px-3 rounded-xl border border-emerald-200">
                <span className="font-black text-emerald-900 text-xs">Total Stock Valuation</span>
                <span className="font-black text-emerald-950 text-sm">
                  {((packagingUnit === "Ton" ? Number(quantity || 0) * TON_TO_QUINTAL : Number(quantity || 0)) * Number(unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-black">General Ledger Impact:</span> This intake will automatically create balanced journal entries debiting Stock Valuation (Account 1410-01) by {((packagingUnit === "Ton" ? Number(quantity || 0) * TON_TO_QUINTAL : Number(quantity || 0)) * Number(unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsConfirmEntryOpen(false)}
                className="h-10 rounded-full border border-zinc-200 px-5 font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleExecuteEntrySave()}
                className="h-10 min-w-[140px] inline-flex items-center justify-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <LoadingDots color="bg-white" size="sm" /> : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
