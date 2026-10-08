import { useState, useEffect } from "react"
import { ChevronDown, Lock, Package } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { useErpStore, type BinCardMovementEntry, type Product } from "@/lib/erpStore"
import { financeStore } from "@/lib/financeStore"

interface StockBinEntryModalProps {
  isOpen: boolean
  product: Product | null
  entry: BinCardMovementEntry | null
  onClose: () => void
  onSave: (productId: string, entryData: Omit<BinCardMovementEntry, "id" | "balance">, entryId?: string) => Promise<void>
  onDelete?: (productId: string, entryId: string) => Promise<void>
}

export default function StockBinEntryModal({
  isOpen,
  product,
  entry,
  onClose,
  onSave,
  onDelete
}: StockBinEntryModalProps) {
  const erp = useErpStore()
  const { showToast } = useFeedback()
  const isEditing = Boolean(entry)

  const [movementType, setMovementType] = useState<"received" | "issued">("received")
  const [date, setDate] = useState("")
  const [batchNo, setBatchNo] = useState("")
  const [quantity, setQuantity] = useState("")
  const [mfgDate, setMfgDate] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [party, setParty] = useState("")
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [saveSupplierToRegistry, setSaveSupplierToRegistry] = useState(false)
  const [unitPrice, setUnitPrice] = useState("")
  const [sellingPrice, setSellingPrice] = useState("")
  const [remark, setRemark] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  useEffect(() => {
    if (entry) {
      const isRec = entry.type === "entry" || Number(entry.qtyReceived || 0) > 0
      setMovementType(isRec ? "received" : "issued")
      setDate(entry.date || new Date().toISOString().slice(0, 10))
      setBatchNo(entry.batchNo || "")
      setQuantity(String(isRec ? entry.qtyReceived : entry.qtyIssued))
      setMfgDate(entry.mfgDate || (product as any)?.mfgDate || product?.manufacturingDate || "")
      setExpiryDate(entry.expiryDate || product?.expiry || "")
      setParty(entry.party || "")
      setShowSupplierDropdown(false)
      setSaveSupplierToRegistry(false)
      setUnitPrice(entry.unitPrice !== undefined ? String(entry.unitPrice) : (product?.unitCost !== undefined ? String(product.unitCost) : ""))
      setSellingPrice(entry.sellingPrice !== undefined ? String(entry.sellingPrice) : (product?.sellingPrice !== undefined ? String(product.sellingPrice) : ""))
      setRemark(entry.remark || "")
    } else {
      setMovementType("received")
      const today = new Date().toISOString().slice(0, 10)
      const currentYear = new Date().getFullYear()
      setDate(today)
      setBatchNo(product?.batch || product?.batches?.[0]?.batchNo || "")
      setQuantity("")
      setMfgDate(product?.manufacturingDate || (product as any)?.mfgDate || product?.batches?.[0]?.mfgDate || today)
      setExpiryDate(product?.expiry || (product as any)?.expiryDate || product?.batches?.[0]?.expiry || `${currentYear + 2}-12-31`)
      setParty("")
      setShowSupplierDropdown(false)
      setSaveSupplierToRegistry(false)
      setUnitPrice(product?.unitCost !== undefined ? String(product.unitCost) : "")
      setSellingPrice(product?.sellingPrice !== undefined ? String(product.sellingPrice) : "")
      setRemark("")
    }
  }, [entry, product, isOpen])

  if (!isOpen || !product) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const qtyNum = Number(quantity)
    if (!date || !batchNo.trim() || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      showToast("Validation Error", "warning", "Please provide a valid date, batch number, and positive quantity.")
      return
    }

    const isRec = movementType === "received"
    const effectiveUnitPrice = unitPrice ? Number(unitPrice) : (product?.unitCost !== undefined ? Number(product.unitCost) : undefined)

    if (isRec && (!effectiveUnitPrice || effectiveUnitPrice <= 0)) {
      showToast("Validation Error", "warning", "Cost Price is mandatory and must be greater than 0 ETB.")
      return
    }

    // If it's a new inbound receipt, prompt confirmation before saving
    if (!isEditing && isRec) {
      setIsConfirmModalOpen(true)
      return
    }

    void handleExecuteSave()
  }

  const handleExecuteSave = async () => {
    const qtyNum = Number(quantity)
    const isRec = movementType === "received"
    const effectiveUnitPrice = unitPrice ? Number(unitPrice) : (product?.unitCost !== undefined ? Number(product.unitCost) : undefined)
    const effectiveSellingPrice = sellingPrice ? Number(sellingPrice) : (product?.sellingPrice !== undefined ? Number(product.sellingPrice) : undefined)

    setIsSaving(true)
    try {
      const entryPayload: Omit<BinCardMovementEntry, "id" | "balance"> = {
        type: isRec ? "entry" : "leave",
        date,
        batchNo: batchNo.trim().toUpperCase(),
        qtyReceived: isRec ? qtyNum : 0,
        qtyIssued: !isRec ? qtyNum : 0,
        mfgDate: mfgDate.trim() || undefined,
        expiryDate: expiryDate.trim(),
        party: party.trim() || undefined,
        unitPrice: effectiveUnitPrice,
        sellingPrice: (effectiveSellingPrice !== undefined && effectiveSellingPrice > 0) ? effectiveSellingPrice : undefined,
        remark: remark.trim() || (isRec ? "Stock Inbound" : "Stock Dispatch")
      }

      await onSave(product.id, entryPayload, entry?.id)

      // Only save supplier to Supplier Registry if inbound receipt, user checked saveSupplierToRegistry, and newly provided party
      if (isRec && saveSupplierToRegistry && party.trim()) {
        const partyName = party.trim()
        const ignoredParties = [
          "Stock Receipt", "Stock Inbound", "Initial Deposit", "Initial Stock Deposit",
          "Initial stock receipt", "Quarantine Hold", "HKC Intake", "Customer Dispatch"
        ]
        if (!ignoredParties.some((p) => p.toLowerCase() === partyName.toLowerCase())) {
          const existingSupp = erp.getSuppliers().find((s) => (s?.name || "").toLowerCase() === partyName.toLowerCase())
          if (!existingSupp) {
            try {
              await erp.addSupplier({
                id: `SUP-${Date.now()}`,
                name: partyName,
                country: "Ethiopia",
                city: "Addis Ababa",
                category: "Pharmaceutical Manufacturer / Importer",
                warehouseTarget: product?.warehouse || "WH2",
                status: "Active",
              })
            } catch (suppErr) {
              console.warn("Failed to auto-register supplier from bin card entry:", suppErr)
            }
          }
        }
      }

      // Automatically post GL stock intake for new inbound receipts
      if (!isEditing && isRec && effectiveUnitPrice && effectiveUnitPrice > 0) {
        try {
          await financeStore.recordStockIntake({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            warehouseId: product.warehouse,
            quantity: qtyNum,
            unitCost: effectiveUnitPrice,
            unit: product.unit,
            entryDate: date,
            batchNo: batchNo.trim().toUpperCase(),
            isChild: true,
          })
        } catch (finErr) {
          console.warn("Failed to record bin card movement intake to GL:", finErr)
        }
      }

      showToast("Success", "success", isEditing ? "Movement entry updated." : "Stock movement entry recorded.")
      setIsConfirmModalOpen(false)
      onClose()
    } catch (err: any) {
      showToast("Save Error", "warning", err.message || "Failed to save entry.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!entry || !onDelete) return
    setIsSaving(true)
    try {
      await onDelete(product.id, entry.id)
      showToast("Deleted", "success", "Stock movement entry deleted.")
      setIsDeleteModalOpen(false)
      onClose()
    } catch (err: any) {
      showToast("Delete Error", "warning", err.message || "Failed to delete entry.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 my-8 space-y-6">
          {isEditing ? (
            <EditModalHeader
              title="Edit Movement Entry"
              subtitle={`Updating transaction on ${product.name}`}
              onClose={onClose}
              onRequestDelete={onDelete ? () => setIsDeleteModalOpen(true) : undefined}
              deleteLabel="Delete Movement Entry"
            />
          ) : (
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Record Movement Entry</h3>
                <p className="text-xs font-semibold text-zinc-500">
                  {product.name} &bull; <span className="font-mono text-emerald-700">{product.sku}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                &times;
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            {/* Movement Type Toggle */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-zinc-500">Transaction Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType("received")}
                  className={`py-2.5 px-4 rounded-xl font-bold border transition-all cursor-pointer ${
                    movementType === "received"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  + Received (Stock In)
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType("issued")}
                  className={`py-2.5 px-4 rounded-xl font-bold border transition-all cursor-pointer ${
                    movementType === "issued"
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  - Outbound Issue / Dispatch
                </button>
              </div>
            </div>

            {/* Date & Batch */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-500">Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-500">Batch Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OXY-2026-01"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none font-mono"
                />
              </div>
            </div>

            {/* Quantity & Price Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase text-zinc-500">
                    Quantity ({product.unit}) *
                  </label>
                  {isEditing && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                      <Lock className="size-2.5" /> Locked (GL)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  readOnly={isEditing}
                  placeholder="e.g. 100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl outline-none font-mono ${
                    isEditing
                      ? "bg-zinc-100/80 border-zinc-200 text-zinc-600 cursor-not-allowed"
                      : "bg-zinc-50 border-zinc-200 focus:bg-white focus:border-zinc-900"
                  }`}
                  title={isEditing ? "Quantity is locked to maintain General Ledger inventory valuation consistency." : undefined}
                />
                {!isEditing && Number(product.quantityPerPack || 0) > 0 && Number(quantity || 0) > 0 && (
                  <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5">
                    {movementType === "received" ? "+" : "-"}
                    {Math.round((Number(quantity) / Number(product.quantityPerPack)) * 100) / 100} ctns
                    {Number(quantity) % Number(product.quantityPerPack) !== 0 && (
                      <span className="text-zinc-500 text-[9px] font-normal block">
                        ({Math.floor(Number(quantity) / Number(product.quantityPerPack))} full ctns + {Number(quantity) % Number(product.quantityPerPack)} loose units)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase text-zinc-500">
                    {movementType === "received" ? "Cost Price (ETB) *" : "COGS Unit Cost (ETB)"}
                  </label>
                  {isEditing && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                      <Lock className="size-2.5" /> Locked (GL)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required={movementType === "received"}
                  readOnly={isEditing}
                  placeholder="e.g. 240.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl outline-none font-mono ${
                    isEditing
                      ? "bg-zinc-100/80 border-zinc-200 text-zinc-600 cursor-not-allowed"
                      : "bg-zinc-50 border-zinc-200 focus:bg-white focus:border-zinc-900"
                  }`}
                  title={isEditing ? "Cost price is locked to maintain General Ledger inventory valuation consistency." : undefined}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-blue-700">
                  Selling Price (ETB)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 350.00"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl focus:bg-white focus:border-blue-900 outline-none font-mono text-blue-950 font-bold"
                />
              </div>
            </div>

            {/* Mfg Date & Expiry Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-500">Mfg Date</label>
                <input
                  type="date"
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-500">Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none"
                />
              </div>
            </div>

            {/* Received From / Issued To */}
            {movementType === "received" ? (
              <div className="space-y-1 relative">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase text-zinc-500">
                    Received From (Supplier / Source) <span className="text-[9px] text-zinc-400 lowercase">(optional)</span>
                  </label>
                  {!erp.getSuppliers().some((s) => (s?.name || "").toLowerCase() === party.trim().toLowerCase()) && party.trim() !== "" && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors">
                      <input
                        type="checkbox"
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
                    placeholder="Search or enter supplier name..."
                    value={party}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onChange={(e) => {
                      setParty(e.target.value)
                      setShowSupplierDropdown(true)
                    }}
                    className="w-full pl-3.5 pr-9 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none font-semibold text-xs"
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
                          product?.supplierName,
                          product?.customer,
                          ...((product?.binCardEntries || [])
                            .filter((e) => Number(e.qtyReceived || 0) > 0 && e.party)
                            .map((e) => e.party)),
                        ].filter((s): s is string => Boolean(s && s.trim())))
                      )
                      const filtered = party.trim()
                        ? allSuppliers.filter((s) => (s || "").toLowerCase().includes(party.toLowerCase()))
                        : allSuppliers
                      if (filtered.length === 0) {
                        return (
                          <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                            {allSuppliers.length === 0 ? "No suppliers registered yet" : `No matches for "${party}"`}
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
                              setParty(suppName)
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
            ) : (
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-500">
                  Issued To (Client / Dept)
                </label>
                <input
                  type="text"
                  placeholder="Client / Department name"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none"
                />
              </div>
            )}

            {/* Remark */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-zinc-500">Remark / Document Reference</label>
              <input
                type="text"
                placeholder="e.g. GRN #8821 / Invoice #4401 / Dispatch Order"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-w-[130px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <LoadingDots color="bg-white" size="sm" /> : isEditing ? "Update Entry" : "Record Entry"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CONFIRMATION MODAL: INBOUND RECEIPT / INCOMING CHILD BATCH */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-zinc-200 space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
                <Package className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Incoming Child Batch
                  </span>
                </div>
                <h3 className="text-lg font-black text-zinc-950 truncate">
                  Confirm Inbound Stock Receipt
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Review the stock intake details and General Ledger valuation impact before confirming.
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
                <span className="font-semibold text-zinc-500">Batch Number</span>
                <span className="font-mono font-black text-zinc-900 bg-white px-2 py-0.5 rounded-md border border-zinc-200">{batchNo.trim().toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 py-1 border-b border-zinc-200/60">
                <div>
                  <span className="block font-semibold text-zinc-500 text-[11px]">Manufacturing Date</span>
                  <span className="font-mono font-bold text-zinc-800">{mfgDate || "N/A"}</span>
                </div>
                <div>
                  <span className="block font-semibold text-zinc-500 text-[11px]">Expiry Date</span>
                  <span className="font-mono font-bold text-zinc-800">{expiryDate || "N/A"}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                <span className="font-semibold text-zinc-500">Intake Quantity</span>
                <span className="font-black text-emerald-800">
                  {Number(quantity).toLocaleString()} {product.unit || "Units"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                <span className="font-semibold text-zinc-500">Unit Cost Price</span>
                <span className="font-bold text-zinc-900">
                  {Number(unitPrice || product.unitCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 bg-emerald-50/80 -mx-2 px-3 rounded-xl border border-emerald-200">
                <span className="font-black text-emerald-900 text-xs">Total Stock Valuation</span>
                <span className="font-black text-emerald-950 text-sm">
                  {(Number(quantity) * Number(unitPrice || product.unitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-black">General Ledger Impact:</span> This intake will automatically create balanced journal entries debiting Stock Valuation (Account 1400-01 / 1410-01) by {(Number(quantity) * Number(unitPrice || product.unitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsConfirmModalOpen(false)}
                className="h-10 rounded-full border border-zinc-200 px-5 font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleExecuteSave()}
                className="h-10 min-w-[140px] inline-flex items-center justify-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <LoadingDots color="bg-white" size="sm" /> : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <RecordDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirmDelete={handleDeleteConfirm}
          title="Delete Movement Entry"
          recordName={product.name}
          recordId={entry?.id ? `Entry #${entry.id.slice(0, 8)}` : undefined}
          description="Are you sure you want to delete this stock movement record? Subsequent running balances will automatically be recalculated."
          isDeleting={isSaving}
        />
      )}
    </>
  )
}
