import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import type { BinCard } from "@/lib/binCardApi"
import type { Product } from "@/lib/erpStore"

interface BinCardHeaderModalProps {
  isOpen: boolean
  card: BinCard | null
  products: Product[]
  onClose: () => void
  onSave: (data: Partial<BinCard>) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
}

export default function BinCardHeaderModal({
  isOpen,
  card,
  products,
  onClose,
  onSave,
  onDelete
}: BinCardHeaderModalProps) {
  const [cardNo, setCardNo] = useState("")
  const [productId, setProductId] = useState("")
  const [description, setDescription] = useState("")
  const [dosage, setDosage] = useState("")
  const [unit, setUnit] = useState("Vial")
  const [shelfNo, setShelfNo] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (card) {
      setCardNo(card.cardNo || "")
      setProductId(card.productId || "")
      setDescription(card.description || "")
      setDosage(card.dosage || "")
      setUnit(card.unit || "Vial")
      setShelfNo(card.shelfNo || "")
    } else {
      setCardNo(`BC-2026-${Math.floor(1000 + Math.random() * 9000)}`)
      setProductId(products[0]?.id || "")
      setDescription(products[0]?.name || "")
      setDosage("100ml Vial")
      setUnit(products[0]?.unit || "Vial")
      setShelfNo("Shelf A-01")
    }
  }, [card, products, isOpen])

  const handleProductSelect = (selectedId: string) => {
    setProductId(selectedId)
    const prod = products.find(p => p.id === selectedId)
    if (prod) {
      setDescription(prod.name)
      setUnit(prod.unit || "Vial")
      if (prod.sku) setShelfNo(`Shelf ${prod.sku.substring(0, 4)}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      await Promise.resolve(onSave({
        cardNo,
        productId: productId || undefined,
        description,
        dosage,
        unit,
        shelfNo,
      }))
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!card || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(card.id)
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
            title={card ? "Edit Bin Card Item" : "Create New Bin Card"}
            subtitle="Configure stock item card specifications and shelf location"
            onClose={onClose}
            onRequestDelete={card && onDelete ? () => setIsDeleteModalOpen(true) : undefined}
            deleteLabel="Delete Bin Card"
          />

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {products.length > 0 && !card && (
              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">
                  Select ERP Stock Item (Optional)
                </label>
                <select
                  value={productId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold outline-none"
                >
                  <option value="">-- Custom Item --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit || 'Units'})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Bin Card Number</label>
                <input
                  type="text"
                  required
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Shelf Location No</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shelf A-04"
                  value={shelfNo}
                  onChange={(e) => setShelfNo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Description / Item Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Oxytetracycline 20% LA Injection"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Strength / Dosage</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100ml Vial"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-zinc-500 block mb-1">Unit of Measurement</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vial, Box, Bottle"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold outline-none"
                />
              </div>
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
                className="min-w-[130px] inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <LoadingDots color="bg-white" size="sm" /> : (card ? "Save Bin Card" : "Create Bin Card")}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Shared Delete Confirmation Modal */}
      <RecordDeleteModal
        isOpen={isDeleteModalOpen}
        title="Delete Bin Card Item"
        recordId={card?.cardNo}
        recordName={card?.description}
        description="Are you sure you want to delete this Bin Card? All associated stock movement transaction entries will be permanently removed."
        isDeleting={isDeleting}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  )
}
