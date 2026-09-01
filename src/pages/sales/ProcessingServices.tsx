import React, { useState, useEffect, useRef, useMemo } from "react"
import { Navigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileText,
  Upload,
  Check,
  ExternalLink,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useErpStore } from "@/lib/erpStore"
import { useFeedback } from "@/context/FeedbackContext"
import { Skeleton } from "@/components/ui/skeleton"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { useAuthStore } from "@/lib/authStore"
import { financeStore } from "@/lib/financeStore"
import { calculateProcessingServiceFee } from "@/lib/processingFeeCalculator"
import {
  type ProcessingServiceOrder,
  type ProcessingServiceStage,
  fetchProcessingServices,
  createProcessingService,
  updateProcessingService,
  transitionProcessingServiceStage,
  uploadProcessingServiceContract,
  deleteProcessingService,
} from "@/lib/processingServicesApi"

function ProcessingServicesSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-b border-zinc-150/40">
          <td className="px-3 py-4"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
          <td className="px-3 py-4"><Skeleton className="h-4 w-36 bg-zinc-200/80" /></td>
          <td className="px-3 py-4"><div className="space-y-1.5"><Skeleton className="h-4 w-32 bg-zinc-200/80" /><Skeleton className="h-3 w-20 bg-zinc-200/80" /></div></td>
          <td className="px-3 py-4"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
          <td className="px-3 py-4"><Skeleton className="h-5 w-24 rounded-full mx-auto bg-zinc-200/80" /></td>
          <td className="px-3 py-4"><Skeleton className="h-4 w-24 ml-auto bg-zinc-200/80" /></td>
          <td className="px-3 py-4 pr-4"><Skeleton className="h-7 w-24 rounded-xl mx-auto bg-zinc-200/80" /></td>
        </tr>
      ))}
    </>
  )
}

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

const STAGE_STEPS: { stage: ProcessingServiceStage; label: string; desc: string }[] = [
  { stage: "Received", label: "Received", desc: "Raw commodity received at WH1" },
  { stage: "Processed", label: "Processed", desc: "Milling, washing & sorting complete" },
  { stage: "Delivered", label: "Delivered", desc: "Finished goods dispatched / picked up" },
]

const STAGE_COLOR_MAP: Record<ProcessingServiceStage, { bg: string; text: string; border: string }> = {
  Received: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  Processed: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" },
  Delivered: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
}

const serviceOrderColumns: TableColumn[] = [
  { key: "reference_number", label: "Ref Number", align: "left" },
  { key: "client_company_name", label: "Client Company", align: "left" },
  { key: "goods_description", label: "Raw Commodity", align: "left" },
  { key: "entry_date", label: "Entry Date", align: "left" },
  { key: "status", label: "Stage Status", align: "center" },
  { key: "agreed_price", label: "Calculated Fee", align: "right" },
  { key: "_actions", label: "Action", align: "center", noSort: true },
]

function getStageIndex(stage?: ProcessingServiceStage): number {
  if (stage === "Received") return 0
  if (stage === "Processed") return 1
  if (stage === "Delivered") return 2
  return -1
}

export default function ProcessingServices() {
  const { showToast } = useFeedback()
  const erp = useErpStore()
  const customers = erp.getCustomers()

  const { user } = useAuthStore()
  const userRoles = user?.roles || ((user as any)?.role ? [(user as any).role] : [])
  const userWarehouseIds = user?.warehouse_ids || ((user as any)?.warehouse_id ? [(user as any).warehouse_id] : [])
  const resolvedWarehouseIds = useMemo(() => {
    const allWhs = erp.getWarehouses()
    const set = new Set<string>()
    userWarehouseIds.forEach((id: string) => {
      set.add(id)
      const matched = allWhs.find(w => w.id === id || w.code === id)
      if (matched) {
        if (matched.id) set.add(matched.id)
        if (matched.code) set.add(matched.code)
      }
    })
    return Array.from(set)
  }, [userWarehouseIds, erp])

  const isInventoryAdminOnly = userRoles.includes("inventory_admin") && !userRoles.includes("superadmin")
  const hasWH1Access = !isInventoryAdminOnly || resolvedWarehouseIds.length === 0 || resolvedWarehouseIds.includes("WH1") || resolvedWarehouseIds.includes("WH1-AGRI-EXP")

  const [services, setServices] = useState<ProcessingServiceOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [stageFilter, setStageFilter] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Modals & Active Edit/Delete Order
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [editingOrder, setEditingOrder] = useState<ProcessingServiceOrder | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<ProcessingServiceOrder | null>(null)
  const [isUploadingContract, setIsUploadingContract] = useState<boolean>(false)

  // Document preview states
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewName, setPreviewName] = useState("")

  // Create Form State
  const [createClientInput, setCreateClientInput] = useState("")
  const [createCustomerId, setCreateCustomerId] = useState("")
  const [showCreateCustDropdown, setShowCreateCustDropdown] = useState(false)
  const [createGoodsDesc, setCreateGoodsDesc] = useState("")
  const [createQuantity, setCreateQuantity] = useState<number | "">("")
  const [createUom, setCreateUom] = useState("Quintal")
  const [createEntryDate, setCreateEntryDate] = useState(new Date().toISOString().split("T")[0])
  const [createNotes, setCreateNotes] = useState("")

  // Edit Form State
  const [editClientInput, setEditClientInput] = useState("")
  const [editCustomerId, setEditCustomerId] = useState("")
  const [showEditCustDropdown, setShowEditCustDropdown] = useState(false)
  const [editGoodsDesc, setEditGoodsDesc] = useState("")
  const [editQuantity, setEditQuantity] = useState<number | "">(0)
  const [editUom, setEditUom] = useState("Quintal")
  const [editEntryDate, setEditEntryDate] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editStatus, setEditStatus] = useState<ProcessingServiceStage>("Received")
  const [previewCalcDate, setPreviewCalcDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Combobox refs
  const createComboboxRef = useRef<HTMLDivElement>(null)
  const editComboboxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createComboboxRef.current && !createComboboxRef.current.contains(e.target as Node)) {
        setShowCreateCustDropdown(false)
      }
      if (editComboboxRef.current && !editComboboxRef.current.contains(e.target as Node)) {
        setShowEditCustDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadServices = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        fetchProcessingServices().then(setServices),
        financeStore.loadFromApi().catch(() => {}),
        erp.loadFromApi().catch(() => {}),
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
    const unsub = financeStore.subscribe(() => {
      // Re-trigger component render when company settings update
      setServices((prev) => [...prev])
    })
    return () => unsub()
  }, [])

  const openEditModal = (order: ProcessingServiceOrder) => {
    setEditingOrder(order)
    setEditClientInput(order.client_company_name || "")
    setEditCustomerId(order.customer_id || "")
    setEditGoodsDesc(order.goods_description || "")
    setEditQuantity(order.quantity || 0)
    setEditUom(order.uom || "Quintal")
    setEditEntryDate(order.entry_date || new Date().toISOString().split("T")[0])
    setPreviewCalcDate(new Date().toISOString().split("T")[0])
    setEditNotes(order.notes || "")
    setEditStatus(order.status || "Received")
  }

  const [createContractFile, setCreateContractFile] = useState<File | null>(null)

  // Create Service Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetClient = createClientInput.trim() || customers.find((c) => c.id === createCustomerId)?.name || "Client Company"

    if (!createGoodsDesc || !createQuantity) {
      showToast("Validation Error", "warning", "Please fill in goods description and quantity.")
      return
    }

    setIsSubmitting(true)
    try {
      const companySettings = erp.getCompanySettings()
      const rates = {
        processingRatePerQuintal: companySettings.processing_rate_per_quintal ?? 150,
        baseStorageRatePerQuintalDay: companySettings.base_storage_rate_per_quintal_day ?? 1.25,
        storageIncrementPerMonth: companySettings.storage_increment_per_month ?? 0.25,
        maxStorageMonthCap: companySettings.max_storage_month_cap ?? 4,
        storageFreeDays: companySettings.storage_free_days ?? 0,
      }

      const feeCalc = calculateProcessingServiceFee(
        Number(createQuantity),
        createEntryDate,
        null,
        false, // Status Received initially
        rates
      )

      const created = await createProcessingService({
        client_company_name: targetClient,
        customer_id: createCustomerId || null,
        goods_description: createGoodsDesc,
        quantity: Number(createQuantity),
        uom: createUom,
        entry_date: createEntryDate,
        agreed_price: feeCalc.totalFee,
        currency: "ETB",
        status: "Received",
        notes: createNotes,
      })

      if (createContractFile) {
        try {
          await uploadProcessingServiceContract(created.id, createContractFile)
        } catch (contractErr) {
          console.warn("Contract upload warning:", contractErr)
        }
      }

      showToast("Service Order Created", "success", `Order ${created.reference_number || created.id} registered for ${targetClient}.`)
      setIsCreateOpen(false)
      setCreateGoodsDesc("")
      setCreateClientInput("")
      setCreateCustomerId("")
      setCreateContractFile(null)
      loadServices()
    } catch (err) {
      showToast("Creation Failed", "warning", err instanceof Error ? err.message : "Failed to create processing service order.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Save Edit Order Metadata & Stage Status Changes
  const handleSaveEdit = async () => {
    if (!editingOrder) return
    const targetClient = editClientInput.trim() || customers.find((c) => c.id === editCustomerId)?.name || editingOrder.client_company_name

    if (!editGoodsDesc || !editQuantity) {
      showToast("Validation Error", "warning", "Goods description and quantity are required.")
      return
    }

    setIsSavingEdit(true)
    try {
      const companySettings = erp.getCompanySettings()
      const rates = {
        processingRatePerQuintal: companySettings.processing_rate_per_quintal ?? 150,
        baseStorageRatePerQuintalDay: companySettings.base_storage_rate_per_quintal_day ?? 1.25,
        storageIncrementPerMonth: companySettings.storage_increment_per_month ?? 0.25,
        maxStorageMonthCap: companySettings.max_storage_month_cap ?? 4,
        storageFreeDays: companySettings.storage_free_days ?? 0,
      }

      const isProcessedChecked = getStageIndex(editStatus) >= 1
      const isDeliveredChecked = getStageIndex(editStatus) >= 2

      // Calculate total fee up to previewCalcDate (which is Today when Delivered is selected)
      const targetEndDate = isDeliveredChecked ? (previewCalcDate || new Date().toISOString().split("T")[0]) : previewCalcDate
      const feeCalc = calculateProcessingServiceFee(
        Number(editQuantity),
        editEntryDate,
        targetEndDate,
        isProcessedChecked,
        rates,
        {
          lockedProcessingRate: editingOrder.locked_processing_rate,
          lockedProcessingFee: editingOrder.locked_processing_fee,
          lockedStorageFee: editingOrder.locked_storage_fee,
          lockedTotalFee: editingOrder.locked_total_fee,
          isDelivered: isDeliveredChecked,
        }
      )

      let updated = await updateProcessingService(editingOrder.id, {
        client_company_name: targetClient,
        customer_id: editCustomerId || null,
        goods_description: editGoodsDesc,
        quantity: Number(editQuantity),
        uom: editUom,
        entry_date: editEntryDate,
        agreed_price: isDeliveredChecked ? (editingOrder.locked_total_fee || feeCalc.totalFee) : feeCalc.totalFee,
        notes: editNotes,
      })

      // If status stage changed, trigger stage transition to recognize revenue / log history
      if (editStatus !== editingOrder.status) {
        const transitionSnapshot = {
          processingRate: companySettings.processing_rate_per_quintal ?? 150,
          processingFee: feeCalc.processingFee,
          storageFee: feeCalc.storageFee,
          totalFee: feeCalc.totalFee,
          deliveryDate: targetEndDate,
        }
        const transitionRes = await transitionProcessingServiceStage(editingOrder.id, editStatus, transitionSnapshot)
        if (transitionRes.ok) {
          updated = transitionRes
          if (editStatus === "Delivered" && transitionRes.journalEntry) {
            showToast(
              "Service Delivered & Billed!",
              "success",
              `Processing complete for ${editingOrder.id}! Accounts Receivable Invoice generated & Service Revenue GL Voucher posted.`
            )
          } else {
            showToast("Stage Updated", "info", `Order status updated to '${editStatus}'.`)
          }
        }
      } else {
        showToast("Service Order Saved", "success", `Updated details for ${updated.reference_number || updated.id}.`)
      }

      setEditingOrder(null)
      loadServices()
    } catch (err) {
      showToast("Save Failed", "warning", err instanceof Error ? err.message : "Failed to save order details.")
    } finally {
      setIsSavingEdit(false)
    }
  }



  // Upload Contract File
  const handleUploadContract = async (id: string, file: File) => {
    setIsUploadingContract(true)
    try {
      const updated = await uploadProcessingServiceContract(id, file)
      showToast("Contract Uploaded", "success", `Contract document attached to order ${updated.reference_number || id}.`)
      setEditingOrder(updated)
      loadServices()
    } catch (err) {
      showToast("Upload Error", "warning", err instanceof Error ? err.message : "Failed to upload contract.")
    } finally {
      setIsUploadingContract(false)
    }
  }

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.client_company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.goods_description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStage = stageFilter === "ALL" || s.status === stageFilter
    return matchesSearch && matchesStage
  })

  const ordersTable = useResizableTable<ProcessingServiceOrder>(serviceOrderColumns, filteredServices, {
    reference_number: 140,
    client_company_name: 220,
    goods_description: 200,
    entry_date: 120,
    status: 150,
    agreed_price: 130,
    _actions: 120,
  })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, stageFilter, filteredServices.length])

  const sortedOrders = ordersTable.sorted()
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize))
  const displayedOrders = sortedOrders.slice((page - 1) * pageSize, page * pageSize)

  if (!hasWH1Access) {
    return <Navigate to="/inventory/stock" replace />
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={fade} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-black tracking-tight">Warehouse 1 Processing Services</h1>
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Client toll-processing contract management, washing, sorting, milling, and automated service revenue recognition.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/inventory")} />
          </div>
        </div>

        {/* Register Table Container */}
        <GlassCard className="flex flex-col overflow-hidden p-0 border border-white/65 shadow-md">
          <div className="px-6 pt-6">
            <FinanceTableToolbar
              title="Processing Services Register"
              subtitle={`Total: ${ordersTable.sorted().length} service orders`}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search PS number, client, or commodity..."
              filters={[
                {
                  value: stageFilter,
                  onChange: (val) => setStageFilter(val),
                  ariaLabel: "Filter by Stage",
                  options: [
                    { value: "ALL", label: "All Stages" },
                    { value: "Received", label: "Received" },
                    { value: "Processed", label: "Processed" },
                    { value: "Delivered", label: "Delivered" },
                  ],
                },
              ]}
              actions={[
                {
                  label: "Create Service Order",
                  onClick: () => setIsCreateOpen(true),
                  icon: <Plus className="size-4" />,
                  variant: "primary",
                },
              ]}
            />
          </div>

          <TableScrollWrapper>
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                  {serviceOrderColumns.map((col) => (
                    <ResizableTh
                      key={col.key}
                      col={col}
                      width={ordersTable.colWidths[col.key] || 120}
                      sortKey={ordersTable.sortKey}
                      sortDir={ordersTable.sortDir}
                      openMenuCol={ordersTable.openMenuCol}
                      onResizeStart={ordersTable.handleResizeStart}
                      onToggleMenu={ordersTable.toggleMenu}
                      onSortAsc={ordersTable.setSortAsc}
                      onSortDesc={ordersTable.setSortDesc}
                      onClearSort={ordersTable.clearSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {isLoading ? (
                  <ProcessingServicesSkeletonRows />
                ) : sortedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={serviceOrderColumns.length} className="px-4 py-8 text-center text-xs font-semibold text-zinc-400">
                      No processing service orders found matching criteria.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => {
                    const colors = STAGE_COLOR_MAP[order.status] || STAGE_COLOR_MAP.Received
                    const companySettings = erp.getCompanySettings()
                    const rates = {
                      processingRatePerQuintal: companySettings.processing_rate_per_quintal ?? 150,
                      baseStorageRatePerQuintalDay: companySettings.base_storage_rate_per_quintal_day ?? 1.25,
                      storageIncrementPerMonth: companySettings.storage_increment_per_month ?? 0.25,
                      maxStorageMonthCap: companySettings.max_storage_month_cap ?? 4,
                      storageFreeDays: companySettings.storage_free_days ?? 0,
                    }

                    const isProcessed = getStageIndex(order.status) >= 1
                    const isDelivered = getStageIndex(order.status) >= 2

                    const feeCalc = calculateProcessingServiceFee(
                      order.quantity,
                      order.entry_date,
                      isDelivered ? (order.delivered_at || order.updated_at || order.created_at) : null,
                      isProcessed,
                      rates,
                      {
                        lockedProcessingRate: order.locked_processing_rate,
                        lockedProcessingFee: order.locked_processing_fee,
                        lockedStorageFee: isDelivered ? order.locked_storage_fee : null,
                        lockedTotalFee: isDelivered ? order.locked_total_fee : null,
                        isDelivered,
                      }
                    )

                    const displayFee = isDelivered
                      ? (order.locked_total_fee ?? order.agreed_price ?? feeCalc.totalFee)
                      : feeCalc.totalFee

                    return (
                      <tr
                        key={order.id}
                        className="border-b border-zinc-150/40 hover:bg-zinc-50/60 transition-colors text-xs"
                      >
                        <td style={{ width: `${ordersTable.colWidths.reference_number}px` }} className="px-3 py-3 whitespace-nowrap font-mono font-bold text-zinc-900 truncate">
                          {order.reference_number || order.id}
                        </td>
                        <td style={{ width: `${ordersTable.colWidths.client_company_name}px` }} className="px-3 py-3 font-bold text-zinc-900 truncate">
                          {order.client_company_name}
                        </td>
                        <td style={{ width: `${ordersTable.colWidths.goods_description}px` }} className="px-3 py-3 truncate">
                          <div className="font-bold text-zinc-800">{order.goods_description}</div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            {order.quantity} {order.uom}
                          </div>
                        </td>
                        <td style={{ width: `${ordersTable.colWidths.entry_date}px` }} className="px-3 py-3 font-mono font-semibold text-zinc-600 truncate">
                          {order.entry_date}
                        </td>
                        <td style={{ width: `${ordersTable.colWidths.status}px` }} className="px-3 py-3 text-center whitespace-nowrap truncate">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${colors.bg} ${colors.text} ${colors.border}`}>
                            {order.status}
                          </span>
                        </td>
                        <td style={{ width: `${ordersTable.colWidths.agreed_price}px` }} className="px-3 py-3 text-right font-mono font-black text-zinc-950 truncate">
                          ETB {displayFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ width: `${ordersTable.colWidths._actions}px` }} className="px-3 py-3 text-center whitespace-nowrap truncate pr-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(order)
                            }}
                            className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-xs inline-flex items-center gap-1"
                            title="Edit processing service"
                          >
                            <Edit3 className="size-3 text-emerald-600" /> Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </TableScrollWrapper>

          {!isLoading && sortedOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
              <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                <span>
                  Showing {Math.min((page - 1) * pageSize + 1, sortedOrders.length)} to {Math.min(page * pageSize, sortedOrders.length)} of {sortedOrders.length} entries
                </span>
                <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                  <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                >
                  Previous
                </button>
                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* MODAL: EDIT PROCESSING SERVICE ORDER */}
        <AnimatePresence>
          {editingOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <EditModalHeader
                  title={`Edit Processing Service: ${editingOrder.reference_number || editingOrder.id}`}
                  subtitle={`Client: ${editingOrder.client_company_name} • Toll Service Order`}
                  onClose={() => setEditingOrder(null)}
                  onRequestDelete={() => setDeletingOrder(editingOrder)}
                  deleteLabel="Delete Service Order"
                />

                <div className="space-y-6 text-xs mt-4">
                  {/* 1. Editable Details Form */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                    <span className="text-xs font-black uppercase text-zinc-500 tracking-wider block">Contract Details & Parameters</span>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Client Combobox */}
                      <div className="md:col-span-6 relative" ref={editComboboxRef}>
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Client / Customer Company</label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            required
                            placeholder="Search customer registry or type company name..."
                            value={editClientInput}
                            onChange={(e) => {
                              setEditClientInput(e.target.value)
                              setShowEditCustDropdown(true)
                            }}
                            onFocus={() => setShowEditCustDropdown(true)}
                            className="w-full pl-3 pr-12 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none"
                          />
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {editClientInput && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditClientInput("")
                                  setEditCustomerId("")
                                  setShowEditCustDropdown(false)
                                }}
                                className="text-zinc-400 hover:text-zinc-700 p-0.5"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowEditCustDropdown(!showEditCustDropdown)}
                              className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded"
                            >
                              {showEditCustDropdown ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </button>
                          </div>
                        </div>

                        {showEditCustDropdown && customers.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xl max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
                            {customers
                              .filter((c) => (c.name || "").toLowerCase().includes(editClientInput.toLowerCase()))
                              .map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setEditCustomerId(c.id)
                                    setEditClientInput(c.name)
                                    setShowEditCustDropdown(false)
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{c.name}</span>
                                    <span className="text-[10px] text-zinc-500 font-medium">{c.phone || "No phone"} &bull; {c.category || "Client"}</span>
                                  </div>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Raw Commodity */}
                      <div className="md:col-span-6">
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Raw Commodity Description</label>
                        <input
                          type="text"
                          value={editGoodsDesc}
                          onChange={(e) => setEditGoodsDesc(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-medium outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-bold outline-none font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">UOM</label>
                        <select
                          value={editUom}
                          onChange={(e) => setEditUom(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-bold outline-none"
                        >
                          <option value="Quintal">Quintal</option>
                          <option value="Kg">Kg</option>
                          <option value="Bags">Bags</option>
                          <option value="Tons">Tons</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Entry Date</label>
                        <input
                          type="date"
                          value={editEntryDate}
                          onChange={(e) => setEditEntryDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-mono font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Operational Notes / Special Processing Instructions</label>
                      <textarea
                        rows={2}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="e.g. Toll milling, moisture testing, custom packaging..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-medium outline-none"
                      />
                    </div>
                  </div>

                  {/* 1.5. ITEMIZED RECEIPT BREAKDOWN SECTION */}
                  {(() => {
                    const companySettings = erp.getCompanySettings()
                    const rates = {
                      processingRatePerQuintal: companySettings.processing_rate_per_quintal ?? 150,
                      baseStorageRatePerQuintalDay: companySettings.base_storage_rate_per_quintal_day ?? 1.25,
                      storageIncrementPerMonth: companySettings.storage_increment_per_month ?? 0.25,
                      maxStorageMonthCap: companySettings.max_storage_month_cap ?? 4,
                      storageFreeDays: companySettings.storage_free_days ?? 0,
                    }

                    const isProcessedChecked = getStageIndex(editStatus) >= 1
                    const isOrderDelivered = editingOrder.status === "Delivered" || editStatus === "Delivered"
                    const calcTargetDate = previewCalcDate || new Date().toISOString().split("T")[0]

                    const feeCalc = calculateProcessingServiceFee(
                      Number(editQuantity || 0),
                      editEntryDate,
                      calcTargetDate,
                      isProcessedChecked,
                      rates,
                      {
                        lockedProcessingRate: editingOrder.locked_processing_rate,
                        lockedProcessingFee: editingOrder.locked_processing_fee,
                        lockedStorageFee: isOrderDelivered ? editingOrder.locked_storage_fee : null,
                        lockedTotalFee: isOrderDelivered ? editingOrder.locked_total_fee : null,
                        isDelivered: isOrderDelivered,
                      }
                    )

                    const qty = Number(editQuantity || 0)
                    const activeProcRate = editingOrder.locked_processing_rate ?? rates.processingRatePerQuintal

                    return (
                      <div className="p-5 bg-stone-50/90 dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl shadow-xs font-mono text-xs space-y-4">
                        {/* Receipt Header */}
                        <div className="border-b border-dashed border-stone-300 dark:border-zinc-700 pb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-stone-900 dark:text-zinc-100 uppercase tracking-widest text-xs">
                              SERVICE FEE BREAKDOWN
                            </span>
                            {isOrderDelivered && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                Locked & Settled
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 uppercase">Calculation Date:</span>
                            <input
                              type="date"
                              value={previewCalcDate}
                              onChange={(e) => setPreviewCalcDate(e.target.value)}
                              className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 font-mono font-bold text-xs outline-none focus:border-emerald-600 shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewCalcDate(new Date().toISOString().split("T")[0])}
                              className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold transition-colors border border-emerald-200 dark:border-emerald-800"
                            >
                              Today
                            </button>
                          </div>
                        </div>

                        {/* Breakdown Lines */}
                        <div className="space-y-2 text-[11px]">
                          {/* Processing Fee Row */}
                          <div className="flex items-start justify-between py-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-stone-800 dark:text-zinc-200">Processing Fee</span>
                                {editingOrder.locked_processing_rate !== null && editingOrder.locked_processing_rate !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                    Rate Locked
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-stone-500 dark:text-zinc-400">
                                {activeProcRate} ETB × {qty} Quintals
                              </span>
                            </div>
                            <span className={`font-bold text-right font-mono ${isProcessedChecked ? "text-stone-900 dark:text-zinc-100" : "text-stone-400"}`}>
                              {isProcessedChecked 
                                ? `ETB ${feeCalc.processingFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}` 
                                : "ETB 0.00 (Pending)"}
                            </span>
                          </div>

                          {/* Storage Fee Section */}
                          <div className="pt-2 border-t border-stone-200/60 dark:border-zinc-800">
                            <div className="flex items-center justify-between font-bold text-stone-800 dark:text-zinc-200 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span>Storage Fee ({feeCalc.daysInStorage} Days Total)</span>
                                {isOrderDelivered && editingOrder.locked_storage_fee !== null && editingOrder.locked_storage_fee !== undefined && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                    Storage Settled
                                  </span>
                                )}
                              </div>
                              <span>ETB {feeCalc.storageFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                            </div>

                            {/* Storage Month-by-Month Rows */}
                            {feeCalc.storageFeeBreakdown.length === 0 ? (
                              <div className="flex items-center justify-between text-[10px] text-stone-500 pl-3">
                                <span>Day 1–30: FREE (0 ETB × {qty} Q × 0 days)</span>
                                <span>ETB 0.00</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5 pl-2 border-l-2 border-emerald-400/60 my-1">
                                {feeCalc.storageFeeBreakdown.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[10px]">
                                    <span className="text-stone-600 dark:text-zinc-400">
                                      {item.monthLabel}: {item.ratePerQuintalDay === 0 ? "0 ETB (FREE)" : `${item.ratePerQuintalDay} ETB`} × {qty} Q × {item.daysInMonth} days
                                    </span>
                                    <span className="font-bold text-stone-800 dark:text-zinc-200 font-mono">
                                      ETB {item.monthTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Receipt Total */}
                        <div className="border-t-2 border-dashed border-stone-300 dark:border-zinc-700 pt-3 flex items-center justify-between font-bold text-sm">
                          <span className="text-stone-900 dark:text-zinc-100 tracking-tight">TOTAL STATEMENT FEE</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-mono text-base font-black">
                            ETB {feeCalc.totalFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* 2. Status Progression Checkboxes */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-500 tracking-wider">Service Stage Checkbox Progression</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      {STAGE_STEPS.map((step, idx) => {
                        const isChecked = getStageIndex(editStatus) >= idx
                        const isCurrentSelected = editStatus === step.stage
                        const timestampEntry = editingOrder.status_history?.find((h) => h.stage === step.stage)

                        return (
                          <div
                            key={step.stage}
                            onClick={() => {
                              const targetStage = isCurrentSelected 
                                ? (idx > 0 ? STAGE_STEPS[idx - 1].stage : "Received") 
                                : step.stage
                              setEditStatus(targetStage)
                              if (targetStage === "Delivered") {
                                setPreviewCalcDate(new Date().toISOString().split("T")[0])
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md ${
                              isChecked
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`size-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white border-zinc-300 text-transparent hover:border-emerald-500"
                                }`}
                              >
                                <Check className="size-3.5 stroke-[3]" />
                              </div>
                              <div>
                                <span className={`text-xs font-black block ${isChecked ? "text-emerald-900 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                                  {step.label}
                                </span>
                                <span className="text-[10px] text-zinc-500 leading-tight block mt-0.5">{step.desc}</span>
                              </div>
                            </div>

                            {timestampEntry && (
                              <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 mt-2 block font-semibold">
                                ✓ {new Date(timestampEntry.timestamp).toLocaleDateString()} {new Date(timestampEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-zinc-400 mt-2 block">
                              {isChecked ? "Click to uncheck/revert" : "Click to select"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 3. Contract Attachment Section */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <span className="text-xs font-black uppercase text-zinc-500 tracking-wider block">Service Contract Document</span>
                    
                    {editingOrder.contract_url ? (
                      <div className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 dark:bg-emerald-950 rounded-lg text-emerald-600">
                            <FileText className="size-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">{editingOrder.contract_file_name || "Contract.pdf"}</span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Contract Attached & Verified in HKC Docs</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button
                             type="button"
                             onClick={() => {
                               setPreviewUrl(editingOrder.contract_url || "")
                               setPreviewName(editingOrder.contract_file_name || "Contract.pdf")
                             }}
                             className="px-3.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1 border border-blue-200"
                           >
                             View Contract <ExternalLink className="size-3" />
                           </button>
                          <label className="px-3.5 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 cursor-pointer">
                            {isUploadingContract ? "Uploading..." : "Replace"}
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              disabled={isUploadingContract}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUploadContract(editingOrder.id, file)
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-center hover:bg-white/50 transition-colors">
                        <Upload className="size-6 text-zinc-400 mx-auto mb-1.5" />
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-0.5">Attach Toll Processing Contract</span>
                        <span className="text-[10px] text-zinc-400 block mb-2">PDF, PNG, or JPG document up to 10MB</span>
                        <label className="px-4 py-1.5 bg-zinc-950 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 inline-block cursor-pointer">
                          {isUploadingContract ? "Uploading..." : "Browse File"}
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            disabled={isUploadingContract}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleUploadContract(editingOrder.id, file)
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={isSavingEdit}
                      onClick={() => setEditingOrder(null)}
                      className="px-4 py-2 rounded-full border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingEdit}
                      onClick={handleSaveEdit}
                      className="min-w-[140px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingEdit ? <LoadingDots color="bg-white" size="sm" /> : "Save Order Changes"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: CREATE PROCESSING SERVICE ORDER */}
        <AnimatePresence>
          {isCreateOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Create Processing Service Order</h3>
                    <p className="text-xs text-zinc-500">Register a new client toll-processing contract at WH1.</p>
                  </div>
                  <button onClick={() => setIsCreateOpen(false)} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400">
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
                  {/* ROW 1: Client Combobox */}
                  <div className="relative" ref={createComboboxRef}>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Client / Customer Company *</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="Type to search customer registry or enter custom client company name..."
                        value={createClientInput}
                        onChange={(e) => {
                          setCreateClientInput(e.target.value)
                          setShowCreateCustDropdown(true)
                        }}
                        onFocus={() => setShowCreateCustDropdown(true)}
                        className="w-full pl-3 pr-12 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {createClientInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setCreateClientInput("")
                              setCreateCustomerId("")
                              setShowCreateCustDropdown(false)
                            }}
                            className="text-zinc-400 hover:text-zinc-700 p-0.5"
                            title="Clear"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowCreateCustDropdown(!showCreateCustDropdown)}
                          className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded"
                        >
                          {showCreateCustDropdown ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>
                      </div>
                    </div>

                    {showCreateCustDropdown && customers.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xl max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
                        {customers
                          .filter((c) => (c.name || "").toLowerCase().includes(createClientInput.toLowerCase()))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCreateCustomerId(c.id)
                                setCreateClientInput(c.name)
                                setShowCreateCustDropdown(false)
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{c.name}</span>
                                <span className="text-[10px] text-zinc-500 font-medium">{c.phone || "No phone"} &bull; {c.category || "Client"}</span>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Raw Commodity Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Raw Arabica Coffee Beans (Grade 4 Unwashed)"
                      value={createGoodsDesc}
                      onChange={(e) => setCreateGoodsDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-medium outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={createQuantity}
                        onChange={(e) => setCreateQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="e.g. 500"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold outline-none font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Unit of Measure (UOM)</label>
                      <select
                        value={createUom}
                        onChange={(e) => setCreateUom(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold outline-none"
                      >
                        <option value="Quintal">Quintal</option>
                        <option value="Kg">Kg</option>
                        <option value="Bags">Bags</option>
                        <option value="Tons">Tons</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Entry Date</label>
                    <input
                      type="date"
                      value={createEntryDate}
                      onChange={(e) => setCreateEntryDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono font-bold outline-none"
                    />
                  </div>

                  {(() => {
                    const companySettings = erp.getCompanySettings()
                    const freeDays = companySettings.storage_free_days ?? 0
                    const procRate = companySettings.processing_rate_per_quintal ?? 150
                    const baseRate = companySettings.base_storage_rate_per_quintal_day ?? 1.25
                    const incRate = companySettings.storage_increment_per_month ?? 0.25

                    return (
                      <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 leading-relaxed">
                        💡 <strong>Live Pricing Rules:</strong> Processing fee is <strong>ETB {procRate}/quintal</strong> when processed. Storage is <strong>FREE for the first {freeDays} {freeDays === 1 ? "day" : "days"} (Grace Period)</strong>, then <strong>ETB {baseRate}/quintal/day</strong> with +ETB {incRate} monthly step increments.
                      </div>
                    )
                  })()}

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Operational Notes / Special Processing Instructions</label>
                    <textarea
                      rows={2}
                      value={createNotes}
                      onChange={(e) => setCreateNotes(e.target.value)}
                      placeholder="e.g. Toll milling, moisture testing, custom packaging..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-medium outline-none"
                    />
                  </div>

                  {/* Service Contract Attachment Section */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <span className="text-xs font-black uppercase text-zinc-500 tracking-wider block">Attach Service Contract Document (Optional)</span>
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <FileText className="size-5 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate">
                          {createContractFile ? createContractFile.name : "No contract document selected"}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium block">
                          PDF, PNG, or JPG contract file (will sync to HKC Docs)
                        </span>
                      </div>
                      <label className="px-3.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer shrink-0">
                        {createContractFile ? "Change File" : "Attach Contract"}
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setCreateContractFile(file)
                          }}
                        />
                      </label>
                      {createContractFile && (
                        <button
                          type="button"
                          onClick={() => setCreateContractFile(null)}
                          className="p-1 text-zinc-400 hover:text-rose-600 rounded"
                          title="Remove contract file"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-4 py-2 rounded-full border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-w-[140px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? <LoadingDots color="bg-white" size="sm" /> : "Save Service Order"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* REUSABLE DELETE CONFIRMATION MODAL */}
        <RecordDeleteModal
          isOpen={!!deletingOrder}
          title="Delete Processing Service Order?"
          recordId={deletingOrder?.reference_number || deletingOrder?.id}
          recordName={deletingOrder?.client_company_name}
          description="This will permanently delete this toll-processing service contract and its record history."
          onClose={() => setDeletingOrder(null)}
          onConfirmDelete={async () => {
            if (!deletingOrder) return
            try {
              await deleteProcessingService(deletingOrder.id)
              showToast("Order Deleted", "info", `Processing service order ${deletingOrder.reference_number || deletingOrder.id} deleted.`)
              setDeletingOrder(null)
              setEditingOrder(null)
              loadServices()
            } catch {
              showToast("Delete Error", "warning", "Failed to delete processing service order.")
            }
          }}
        />

        {/* Document Preview Modal */}
        <DocumentPreviewModal
          isOpen={!!previewUrl}
          onClose={() => {
            setPreviewUrl("")
            setPreviewName("")
          }}
          fileUrl={previewUrl}
          fileName={previewName}
        />
      </motion.div>
    </div>
  )
}

