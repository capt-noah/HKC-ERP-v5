import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, 
  X, 
  AlertOctagon, 
  ShieldAlert, 
  Building2,
  Clock,
  Edit3,
  Boxes
} from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { useErpStore, type QuarantineRecord } from "@/lib/erpStore"
import { useAuthStore } from "@/lib/authStore"
import { DataTable } from "@/components/DataTable"
import { type TableColumn } from "@/components/ResizableTable"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { GlassCard } from "@/components/GlassCard"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"

interface QuarantineTabProps {
  warehouseId?: string
}

const quarantineColumns: TableColumn[] = [
  { key: "item", label: "Medicine / Product", align: "left" },
  { key: "batchNo", label: "Batch Number", align: "left" },
  { key: "warehouse", label: "Warehouse", align: "left" },
  { key: "nameEntered", label: "NAME ENTERED", align: "left" },
  { key: "quarantineDate", label: "QUARANTINE DATE", align: "left" },
  { key: "quantity", label: "QUANTITY", align: "right" },
  { key: "proposedReleaseDate", label: "PROPOSED RELEASE DATE", align: "left" },
  { key: "status", label: "Status", align: "center" },
  { key: "reason", label: "Reason / Notes", align: "left" },
  { key: "_actions", label: "Actions", align: "center", noSort: true },
]

export default function QuarantineTab({ warehouseId = "ALL" }: QuarantineTabProps) {
  const { showToast } = useFeedback()
  const erp = useErpStore()
  const { user } = useAuthStore()

  const currentUserName = user?.fullname || user?.username || (user as any)?.email || "Store Officer"

  // Warehouse filter state
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>(
    warehouseId && warehouseId !== "ALL" ? warehouseId : "ALL"
  )

  useEffect(() => {
    if (warehouseId && warehouseId !== "ALL") {
      setSelectedWarehouseFilter(warehouseId)
    }
  }, [warehouseId])

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<QuarantineRecord | null>(null)
  const [deletingRecord, setDeletingRecord] = useState<QuarantineRecord | null>(null)
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Add Form State
  const [addWarehouse, setAddWarehouse] = useState<string>(
    selectedWarehouseFilter !== "ALL" ? selectedWarehouseFilter : "WH2"
  )
  const [addProductId, setAddProductId] = useState("")
  const [addBatchNo, setAddBatchNo] = useState("")
  const [addNameEntered, setAddNameEntered] = useState(currentUserName)
  const [addQuarantineDate, setAddQuarantineDate] = useState(new Date().toISOString().slice(0, 10))
  const [addQuantity, setAddQuantity] = useState("")
  const [addProposedReleaseDate, setAddProposedReleaseDate] = useState("")
  const [addReason, setAddReason] = useState("")

  // Edit Form State
  const [editNameEntered, setEditNameEntered] = useState("")
  const [editQuarantineDate, setEditQuarantineDate] = useState("")
  const [editProposedReleaseDate, setEditProposedReleaseDate] = useState("")
  const [editStatus, setEditStatus] = useState<QuarantineRecord["status"]>("Quarantined")
  const [editReason, setEditReason] = useState("")

  useEffect(() => {
    if (editingRecord) {
      setEditNameEntered(editingRecord.nameEntered || "")
      setEditQuarantineDate(editingRecord.quarantineDate || "")
      setEditProposedReleaseDate(editingRecord.proposedReleaseDate || "")
      setEditStatus(editingRecord.status || "Quarantined")
      setEditReason(editingRecord.reason || "")
    }
  }, [editingRecord])

  const matchesWarehouse = (whA?: string, whB?: string): boolean => {
    if (!whA || !whB) return false
    const a = whA.toLowerCase().trim()
    const b = whB.toLowerCase().trim()
    if (a === b) return true
    if (a.includes("wh2") && b.includes("wh2")) return true
    if (a.includes("wh3") && b.includes("wh3")) return true
    return a.includes(b) || b.includes(a)
  }

  // Available commercial warehouses
  const commercialWarehouses = useMemo(() => {
    return erp.getWarehouses().filter((w) => {
      const code = (w.code || w.id || w.name || "").toUpperCase()
      return (
        code.includes("WH2") ||
        code.includes("WH3") ||
        code.includes("WH-02") ||
        code.includes("WH-03") ||
        code.includes("WAREHOUSE 2") ||
        code.includes("WAREHOUSE 3") ||
        code.includes("VET")
      )
    })
  }, [erp])

  // Products available in the selected add modal warehouse
  const addWarehouseProducts = useMemo(() => {
    return erp.getProducts().filter((p) => {
      const matchMain = matchesWarehouse(p.warehouse, addWarehouse)
      const matchBreakdown = (p.stockBreakdown || []).some(
        (sb) => matchesWarehouse(sb.warehouse, addWarehouse) && Number(sb.qty || 0) > 0
      )
      return matchMain || matchBreakdown
    })
  }, [erp, addWarehouse])

  // Selected product & available batches in add modal
  const selectedProduct = useMemo(() => {
    return addWarehouseProducts.find((p) => p.id === addProductId) || null
  }, [addWarehouseProducts, addProductId])

  const availableBatches = useMemo(() => {
    if (!selectedProduct) return []
    return (selectedProduct.batches || []).filter((b) => Number(b.qty || 0) > 0)
  }, [selectedProduct])

  const selectedBatchInfo = useMemo(() => {
    return availableBatches.find((b) => b.batchNo === addBatchNo) || null
  }, [availableBatches, addBatchNo])

  const maxAvailableQty = useMemo(() => {
    if (selectedBatchInfo) return Number(selectedBatchInfo.qty || 0)
    if (selectedProduct) return Number(selectedProduct.quantity || 0)
    return 0
  }, [selectedBatchInfo, selectedProduct])

  // All Quarantine records
  const allQuarantineRecords = erp.getQuarantineRecords()

  const filteredRecords = useMemo(() => {
    return allQuarantineRecords.filter((rec) => {
      if (selectedWarehouseFilter !== "ALL") {
        if (!matchesWarehouse(rec.warehouseId, selectedWarehouseFilter)) {
          return false
        }
      }

      if (statusFilter !== "ALL" && rec.status !== statusFilter) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const match =
          rec.productName.toLowerCase().includes(q) ||
          rec.sku.toLowerCase().includes(q) ||
          rec.batchNo.toLowerCase().includes(q) ||
          rec.nameEntered.toLowerCase().includes(q) ||
          (rec.reason || "").toLowerCase().includes(q) ||
          rec.warehouseId.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [allQuarantineRecords, selectedWarehouseFilter, statusFilter, searchQuery])

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalVolume = filteredRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0)
    const activeCount = filteredRecords.filter((r) => r.status === "Quarantined").length
    const wh2Count = filteredRecords.filter((r) => matchesWarehouse(r.warehouseId, "WH2")).length
    const wh3Count = filteredRecords.filter((r) => matchesWarehouse(r.warehouseId, "WH3")).length

    const estimatedValue = filteredRecords.reduce((sum, r) => {
      const prod = erp.getProducts().find((p) => p.id === r.productId)
      const cost = prod?.unitCost || 0
      return sum + Number(r.quantity || 0) * cost
    }, 0)

    return { totalVolume, activeCount, wh2Count, wh3Count, estimatedValue }
  }, [filteredRecords, erp])

  const openAddModal = () => {
    const defaultWh = selectedWarehouseFilter !== "ALL" ? selectedWarehouseFilter : (commercialWarehouses[0]?.code || "WH2")
    setAddWarehouse(defaultWh)
    setAddProductId("")
    setAddBatchNo("")
    setAddNameEntered(currentUserName)
    setAddQuarantineDate(new Date().toISOString().slice(0, 10))
    setAddQuantity("")
    setAddProposedReleaseDate("")
    setAddReason("")
    setIsAddModalOpen(true)
  }

  const handleAddWarehouseChange = (wh: string) => {
    setAddWarehouse(wh)
    setAddProductId("")
    setAddBatchNo("")
  }

  const handleAddProductChange = (productId: string) => {
    setAddProductId(productId)
    const prod = addWarehouseProducts.find((p) => p.id === productId)
    if (prod && prod.batches && prod.batches.length > 0) {
      const activeBatch = prod.batches.find((b) => Number(b.qty || 0) > 0)
      setAddBatchNo(activeBatch ? activeBatch.batchNo : "")
    } else {
      setAddBatchNo(prod?.batch || "")
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addProductId || !selectedProduct) {
      showToast("Validation Error", "warning", "Please select a medicine/product.")
      return
    }
    if (!addBatchNo) {
      showToast("Validation Error", "warning", "Please select a batch number.")
      return
    }
    if (!addNameEntered.trim()) {
      showToast("Validation Error", "warning", "Please enter the name of the person logging the quarantine.")
      return
    }
    const qtyNum = Number(addQuantity)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      showToast("Validation Error", "warning", "Please enter a valid quarantine quantity greater than 0.")
      return
    }
    if (qtyNum > maxAvailableQty) {
      showToast(
        "Insufficient Quantity",
        "warning",
        `Requested quantity (${qtyNum}) exceeds the available batch balance (${maxAvailableQty} ${selectedProduct.unit}).`
      )
      return
    }
    if (!addQuarantineDate) {
      showToast("Validation Error", "warning", "Please specify the quarantine date.")
      return
    }
    if (!addProposedReleaseDate) {
      showToast("Validation Error", "warning", "Please specify the proposed release date.")
      return
    }

    setIsSubmittingAdd(true)
    try {
      const whRecord = commercialWarehouses.find(
        (w) => matchesWarehouse(w.id, addWarehouse) || matchesWarehouse(w.code, addWarehouse)
      )
      await erp.addQuarantineRecord({
        warehouseId: addWarehouse,
        warehouseName: whRecord?.name || addWarehouse,
        productId: selectedProduct.id,
        batchNo: addBatchNo,
        nameEntered: addNameEntered.trim(),
        quarantineDate: addQuarantineDate,
        quantity: qtyNum,
        proposedReleaseDate: addProposedReleaseDate,
        reason: addReason.trim() || "Broken / Damaged Medicine",
      })

      showToast(
        "Quarantine Recorded",
        "success",
        `Deducted ${qtyNum} ${selectedProduct.unit} of ${selectedProduct.name} (Batch: ${addBatchNo}) and recorded under Quarantine.`
      )
      setIsAddModalOpen(false)
    } catch (err: any) {
      showToast("Error Recording Quarantine", "warning", err.message || "Failed to record quarantine.")
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRecord) return
    if (!editNameEntered.trim()) {
      showToast("Validation Error", "warning", "Name entered cannot be empty.")
      return
    }

    setIsSubmittingEdit(true)
    try {
      await erp.updateQuarantineRecord(editingRecord.id, {
        nameEntered: editNameEntered.trim(),
        quarantineDate: editQuarantineDate,
        proposedReleaseDate: editProposedReleaseDate,
        status: editStatus,
        reason: editReason.trim(),
      })

      showToast("Quarantine Updated", "success", `Quarantine record ${editingRecord.id} updated successfully.`)
      setEditingRecord(null)
    } catch (err: any) {
      showToast("Update Failed", "warning", err.message || "Failed to update record.")
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleConfirmDeleteQuarantine = async () => {
    if (!deletingRecord) return
    setIsDeleting(true)
    try {
      await erp.deleteQuarantineRecord(deletingRecord.id)
      showToast(
        "Record Deleted",
        "success",
        `Quarantine record deleted and ${deletingRecord.quantity} ${deletingRecord.unit} restored to available stock.`
      )
      setDeletingRecord(null)
      setEditingRecord(null)
    } catch (err: any) {
      showToast("Delete Failed", "warning", err.message || "Failed to delete record.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. KPI Metric Summary Cards (GlassCard design matching website) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 rounded-2xl flex items-center gap-4 bg-white/70 border border-zinc-200/80 shadow-xs">
          <div className="size-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Active Quarantine Holds</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-zinc-950">{metrics.activeCount}</span>
              <span className="text-xs font-bold text-emerald-700">records</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl flex items-center gap-4 bg-white/70 border border-zinc-200/80 shadow-xs">
          <div className="size-11 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20 shadow-2xs">
            <Boxes className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Total Quarantined Volume</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-rose-700">{metrics.totalVolume.toLocaleString()}</span>
              <span className="text-xs font-bold text-zinc-500">units on hold</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl flex items-center gap-4 bg-white/70 border border-zinc-200/80 shadow-xs">
          <div className="size-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-2xs">
            <Building2 className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Warehouse Breakdown</span>
            <div className="flex items-center gap-2 mt-0.5 text-xs font-black">
              <span className="text-zinc-800">WH2: <strong className="text-indigo-600 font-bold">{metrics.wh2Count}</strong></span>
              <span className="text-zinc-300">&bull;</span>
              <span className="text-zinc-800">WH3: <strong className="text-indigo-600 font-bold">{metrics.wh3Count}</strong></span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl flex items-center gap-4 bg-white/70 border border-zinc-200/80 shadow-xs">
          <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
            <Clock className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Estimated Value on Hold</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-zinc-950 font-mono">
                ETB {metrics.estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 2. Unified DataTable matching HKC website design */}
      <DataTable
        title="Medicine Quarantine Register"
        subtitle={`${filteredRecords.length} quarantine isolation records for broken & damaged medicines`}
        columns={quarantineColumns}
        data={filteredRecords}
        isLoading={false}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search medicine, batch number, or officer..."
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setEditingRecord(item)}
        actions={[
          {
            label: "Log Broken / Damaged Medicine",
            onClick: openAddModal,
            icon: <Plus className="size-4 stroke-[2.5]" />,
            variant: "primary",
          },
        ]}
        filters={[
          {
            value: selectedWarehouseFilter,
            onChange: (val) => setSelectedWarehouseFilter(val),
            ariaLabel: "Filter by Warehouse",
            options: [
              { value: "ALL", label: "All Commercial Warehouses" },
              { value: "WH2", label: "Warehouse 2 (Indian)" },
              { value: "WH3", label: "Warehouse 3 (Chinese)" },
            ],
          },
          {
            value: statusFilter,
            onChange: (val) => setStatusFilter(val),
            ariaLabel: "Filter by Status",
            options: [
              { value: "ALL", label: "All Statuses" },
              { value: "Quarantined", label: "Quarantined" },
              { value: "Released", label: "Released" },
              { value: "Disposed", label: "Disposed" },
            ],
          },
        ]}
        defaultWidths={{
          item: 200,
          batchNo: 130,
          warehouse: 130,
          nameEntered: 140,
          quarantineDate: 130,
          quantity: 120,
          proposedReleaseDate: 160,
          status: 120,
          reason: 180,
          _actions: 90,
        }}
        renderRow={(rec, colWidths) => {
          const isWH2 = matchesWarehouse(rec.warehouseId, "WH2")

          return (
            <>
              {/* Medicine / Product */}
              <td style={{ width: `${colWidths.item}px` }} className="py-4 px-4 overflow-hidden border-r border-zinc-100">
                <div className="flex flex-col">
                  <span className="font-black text-zinc-950 text-xs truncate">{rec.productName}</span>
                  <span className="font-mono text-[10px] text-zinc-400">{rec.sku}</span>
                </div>
              </td>

              {/* Batch Number */}
              <td style={{ width: `${colWidths.batchNo}px` }} className="py-4 px-4 font-mono font-bold text-zinc-950 border-r border-zinc-100 overflow-hidden">
                {rec.batchNo}
              </td>

              {/* Warehouse */}
              <td style={{ width: `${colWidths.warehouse}px` }} className="py-4 px-4 border-r border-zinc-100 overflow-hidden">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  isWH2 ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                }`}>
                  {isWH2 ? "WH2" : "WH3"}
                </span>
              </td>

              {/* NAME ENTERED */}
              <td style={{ width: `${colWidths.nameEntered}px` }} className="py-4 px-4 font-bold text-zinc-800 border-r border-zinc-100 overflow-hidden">
                {rec.nameEntered}
              </td>

              {/* QUARANTINE DATE */}
              <td style={{ width: `${colWidths.quarantineDate}px` }} className="py-4 px-4 font-mono font-bold text-zinc-700 border-r border-zinc-100 overflow-hidden">
                {rec.quarantineDate}
              </td>

              {/* QUANTITY */}
              <td style={{ width: `${colWidths.quantity}px` }} className="py-4 px-4 text-right font-mono font-black text-rose-700 border-r border-zinc-100 overflow-hidden">
                -{rec.quantity.toLocaleString()} {rec.unit}
              </td>

              {/* PROPOSED RELEASE DATE */}
              <td style={{ width: `${colWidths.proposedReleaseDate}px` }} className="py-4 px-4 font-mono font-bold text-zinc-700 border-r border-zinc-100 overflow-hidden">
                {rec.proposedReleaseDate || "—"}
              </td>

              {/* Status */}
              <td style={{ width: `${colWidths.status}px` }} className="py-4 px-4 text-center border-r border-zinc-100 overflow-hidden">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-900 border border-emerald-200">
                  <AlertOctagon className="size-3 text-emerald-700" />
                  {rec.status}
                </span>
              </td>

              {/* Reason / Notes */}
              <td style={{ width: `${colWidths.reason}px` }} className="py-4 px-4 text-zinc-600 truncate border-r border-zinc-100 overflow-hidden">
                {rec.reason || "Broken / Damaged Medicine"}
              </td>

              {/* Actions */}
              <td style={{ width: `${colWidths._actions}px` }} className="py-4 px-4 text-center overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingRecord(rec)
                  }}
                  className="px-2.5 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 text-[10px] font-extrabold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                  title="Edit record"
                >
                  <Edit3 className="size-3 text-zinc-500" /> Edit
                </button>
              </td>
            </>
          )
        }}
      />

      {/* =========================================================================
          ADD MODAL: EXACT STOCK ITEM MODAL DESIGN (Rounded-3xl, P-6/8, Light Green Section)
          ========================================================================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-zinc-200 z-[121] relative"
            >
              {/* Modal Header matching Stock Item Modal */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-200">
                <div>
                  <h3 className="text-xl font-black text-zinc-900">
                    Log Medicine for Quarantine
                  </h3>
                  <p className="text-xs text-zinc-500">Record broken or compromised medicine isolation and deduct from warehouse inventory.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-semibold">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Storage Warehouse */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      Primary Warehouse <span className="text-rose-600">*</span>
                    </span>
                    <select
                      value={addWarehouse}
                      onChange={(e) => handleAddWarehouseChange(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500 bg-white cursor-pointer"
                    >
                      {commercialWarehouses.map((w) => (
                        <option key={w.id} value={w.code || w.id}>
                          {w.name || w.code || w.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Medicine / Product */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      Medicine / Product Item <span className="text-rose-600">*</span>
                    </span>
                    <select
                      value={addProductId}
                      onChange={(e) => handleAddProductChange(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500 bg-white cursor-pointer"
                    >
                      <option value="">Select Medicine...</option>
                      {addWarehouseProducts.map((p) => {
                        const availInWh =
                          p.warehouse === addWarehouse
                            ? p.quantity
                            : (p.stockBreakdown?.find((sb) => matchesWarehouse(sb.warehouse, addWarehouse))?.qty ?? p.quantity)
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — Available: {availInWh} {p.unit}
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  {/* Batch / Lot Number */}
                  <label className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-zinc-700 block">
                        Batch / Lot Number <span className="text-rose-600">*</span>
                      </span>
                      {selectedBatchInfo && (
                        <span className="text-[10px] font-bold text-emerald-700">
                          {selectedBatchInfo.qty} {selectedProduct?.unit} left
                        </span>
                      )}
                    </div>
                    {availableBatches.length > 0 ? (
                      <select
                        value={addBatchNo}
                        onChange={(e) => setAddBatchNo(e.target.value)}
                        required
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono outline-none focus:border-emerald-500 bg-white cursor-pointer"
                      >
                        <option value="">Select Batch...</option>
                        {availableBatches.map((b) => (
                          <option key={b.batchNo} value={b.batchNo}>
                            {b.batchNo} (Available: {b.qty} {selectedProduct?.unit} | Exp: {b.expiry || "N/A"})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder={selectedProduct ? "No batch records found, enter batch" : "Select medicine first"}
                        value={addBatchNo}
                        onChange={(e) => setAddBatchNo(e.target.value)}
                        required
                        disabled={!selectedProduct}
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono outline-none focus:border-emerald-500 bg-white"
                      />
                    )}
                  </label>

                  {/* Quantity */}
                  <label className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-zinc-700 block">
                        Quarantine Quantity <span className="text-rose-600">*</span>
                      </span>
                      {maxAvailableQty > 0 && (
                        <span className="text-[10px] font-bold text-zinc-400">Max: {maxAvailableQty} {selectedProduct?.unit}</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max={maxAvailableQty || undefined}
                        value={addQuantity}
                        onChange={(e) => setAddQuantity(e.target.value)}
                        required
                        placeholder={`Max ${maxAvailableQty}`}
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 pr-14 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                        {selectedProduct?.unit || "Units"}
                      </span>
                    </div>
                  </label>

                  {/* NAME ENTERED */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      NAME ENTERED <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="text"
                      value={addNameEntered}
                      onChange={(e) => setAddNameEntered(e.target.value)}
                      required
                      placeholder="Officer / Inspector Name"
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500"
                    />
                  </label>

                  {/* QUARANTINE DATE */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      QUARANTINE DATE <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="date"
                      value={addQuarantineDate}
                      onChange={(e) => setAddQuarantineDate(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono outline-none focus:border-emerald-500"
                    />
                  </label>

                  {/* PROPOSED RELEASE DATE */}
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      PROPOSED RELEASE DATE <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="date"
                      value={addProposedReleaseDate}
                      onChange={(e) => setAddProposedReleaseDate(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono outline-none focus:border-emerald-500"
                    />
                  </label>

                  {/* Reason */}
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      Reason for Quarantine / Damage Description
                    </span>
                    <input
                      type="text"
                      value={addReason}
                      onChange={(e) => setAddReason(e.target.value)}
                      placeholder="e.g. Broken ampoules, damaged seal, cracked packaging"
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500"
                    />
                  </label>
                </div>

                {/* Light Green Alert Section (Replacing Yellow Section) */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 p-3.5 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-semibold">
                    Logging this quarantine will immediately <strong>deduct {addQuantity || "0"} {selectedProduct?.unit || "units"}</strong> from available physical warehouse inventory and record a dedicated <strong>QUARANTINE</strong> deduction in the Stock Bin Card ledger.
                  </p>
                </div>

                {/* Footer Buttons matching Stock Modal theme */}
                <div className="flex justify-between items-center border-t border-zinc-200 pt-4 mt-6">
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="h-10 rounded-full border border-zinc-200 px-4 font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAdd}
                      className="h-10 rounded-full bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                    >
                      {isSubmittingAdd ? <LoadingDots color="bg-white" size="sm" /> : "Confirm Quarantine Hold"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          EDIT MODAL: WITH 3-DOTS MENU DELETE BUTTON (Light Green Theme, No Yellow)
          ========================================================================= */}
      <AnimatePresence>
        {editingRecord && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRecord(null)}
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-zinc-200 z-[121] relative"
            >
              <EditModalHeader
                title={`Edit Quarantine: ${editingRecord.productName}`}
                subtitle={`Ref: ${editingRecord.id} • Batch: ${editingRecord.batchNo} • Warehouse: ${editingRecord.warehouseId}`}
                onClose={() => setEditingRecord(null)}
                onRequestDelete={() => setDeletingRecord(editingRecord)}
                deleteLabel="Delete Quarantine Record"
              />

              <form onSubmit={handleEditSave} className="mt-4 space-y-4 text-xs font-semibold">
                {/* Light Green Summary Section (Replacing Yellow Section) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800/70 block">Medicine / SKU</span>
                    <span className="font-bold text-zinc-950">{editingRecord.productName}</span>
                    <span className="font-mono text-[10px] text-zinc-500 block">{editingRecord.sku}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800/70 block">Batch Number</span>
                    <span className="font-mono font-bold text-zinc-950">{editingRecord.batchNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800/70 block">Quarantined Quantity</span>
                    <span className="font-mono font-black text-rose-700">
                      -{editingRecord.quantity.toLocaleString()} {editingRecord.unit}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* NAME ENTERED */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      NAME ENTERED <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="text"
                      value={editNameEntered}
                      onChange={(e) => setEditNameEntered(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500"
                    />
                  </label>

                  {/* Status */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">Quarantine Status</span>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs bg-white outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Quarantined">Quarantined</option>
                      <option value="Released">Released</option>
                      <option value="Disposed">Disposed</option>
                    </select>
                  </label>

                  {/* QUARANTINE DATE */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      QUARANTINE DATE <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="date"
                      value={editQuarantineDate}
                      onChange={(e) => setEditQuarantineDate(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono outline-none focus:border-emerald-500"
                    />
                  </label>

                  {/* PROPOSED RELEASE DATE */}
                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">
                      PROPOSED RELEASE DATE <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="date"
                      value={editProposedReleaseDate}
                      onChange={(e) => setEditProposedReleaseDate(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono outline-none focus:border-emerald-500"
                    />
                  </label>

                  {/* Reason */}
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-black uppercase text-zinc-700 block">Reason / Inspection Notes</span>
                    <input
                      type="text"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500"
                    />
                  </label>
                </div>

                {/* Footer Buttons matching Stock Modal theme */}
                <div className="flex justify-between items-center border-t border-zinc-200 pt-4 mt-6">
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      disabled={isSubmittingEdit}
                      onClick={() => setEditingRecord(null)}
                      className="h-10 rounded-full border border-zinc-200 px-4 font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingEdit}
                      className="h-10 rounded-full bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                    >
                      {isSubmittingEdit ? <LoadingDots color="bg-white" size="sm" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          CONFIRMATION MODAL: RECORD DELETE MODAL
          ========================================================================= */}
      <RecordDeleteModal
        isOpen={!!deletingRecord}
        title="Delete Quarantine Record?"
        recordId={deletingRecord?.id}
        recordName={`${deletingRecord?.productName} (Batch: ${deletingRecord?.batchNo})`}
        description="This will permanently delete this quarantine record. The deducted quantity will be restored back into the product's physical stock and lot/batch ledger."
        isDeleting={isDeleting}
        onClose={() => setDeletingRecord(null)}
        onConfirmDelete={handleConfirmDeleteQuarantine}
      />
    </div>
  )
}
