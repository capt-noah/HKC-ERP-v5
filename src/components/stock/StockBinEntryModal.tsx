import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { useErpStore, type BinCardMovementEntry, type Product } from "@/lib/erpStore"

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
  const [unitPrice, setUnitPrice] = useState("")
  const [remark, setRemark] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (entry) {
      const isRec = Number(entry.qtyReceived || 0) > 0
      setMovementType(isRec ? "received" : "issued")
      setDate(entry.date || new Date().toISOString().slice(0, 10))
      setBatchNo(entry.batchNo || "")
      setQuantity(String(isRec ? entry.qtyReceived : entry.qtyIssued))
      setMfgDate(entry.mfgDate || "")
      setExpiryDate(entry.expiryDate || "")
      setParty(entry.party || "")
      setShowSupplierDropdown(false)
      setUnitPrice(entry.unitPrice !== undefined ? String(entry.unitPrice) : "")
      setRemark(entry.remark || "")
    } else {
      setMovementType("received")
      setDate(new Date().toISOString().slice(0, 10))
      setBatchNo(product?.batch || "")
      setQuantity("")
      setMfgDate("")
      setExpiryDate(product?.expiry || "")

      // Associated suppliers for this product
      const itemSuppliers = Array.from(
        new Set(
          [
            product?.supplierName,
            product?.customer,
            ...(product?.binCardEntries || [])
              .filter((e) => Number(e.qtyReceived || 0) > 0 && e.party)
              .map((e) => e.party),
          ]
            .filter((s): s is string => Boolean(s && s.trim()))
            .map((s) => s.trim())
        )
      )
      const suppliers = erp.getSuppliers()
      const parentSupplier =
        product?.supplierName ||
        product?.customer ||
        (product?.binCardEntries && product.binCardEntries.length > 0
          ? product.binCardEntries.find((e) => Number(e.qtyReceived || 0) > 0 && e.party)?.party
          : "") ||
        ""

      const defaultSupplier =
        parentSupplier ||
        (itemSuppliers.length === 1
          ? itemSuppliers[0]
          : itemSuppliers.length === 0 && suppliers.length === 1
          ? suppliers[0].name
          : "")

      setParty(defaultSupplier)
      setShowSupplierDropdown(false)
      setUnitPrice(product?.unitCost !== undefined ? String(product.unitCost) : "")
      setRemark("")
    }
  }, [entry, product, isOpen])

  if (!isOpen || !product) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qtyNum = Number(quantity)
    if (!date || !batchNo.trim() || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      showToast("Validation Error", "warning", "Please provide a valid date, batch number, and positive quantity.")
      return
    }

    setIsSaving(true)
    try {
      const entryPayload: Omit<BinCardMovementEntry, "id" | "balance"> = {
        date,
        batchNo: batchNo.trim().toUpperCase(),
        qtyReceived: movementType === "received" ? qtyNum : 0,
        qtyIssued: movementType === "issued" ? qtyNum : 0,
        mfgDate: mfgDate.trim(),
        expiryDate: expiryDate.trim(),
        party: party.trim(),
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        remark: remark.trim()
      }

      await onSave(product.id, entryPayload, entry?.id)
      showToast("Success", "success", isEditing ? "Movement entry updated." : "Stock movement entry recorded.")
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 my-8 space-y-6"
        >
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
                  - Issued (Stock Out)
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

            {/* Quantity & Unit Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-500">
                  Quantity ({product.unit}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  placeholder="e.g. 100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-zinc-500">Unit Price (ETB)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 240.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:border-zinc-900 outline-none font-mono"
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
                <label className="block text-[10px] font-black uppercase text-zinc-500">
                  Received From (Supplier)
                </label>
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
                        ? allSuppliers.filter((s) => s.toLowerCase().includes(party.toLowerCase()))
                        : allSuppliers
                      if (filtered.length === 0) {
                        return (
                          <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                            {allSuppliers.length === 0 ? "No suppliers registered yet" : `No matches for "${party}"`}
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
        </motion.div>
      </div>

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
