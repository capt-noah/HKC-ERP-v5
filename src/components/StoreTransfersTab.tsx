import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, 
  X, 
  Warehouse as WarehouseIcon, 
  Calendar, 
  Check, 
  Trash2, 
  Shield, 
  AlertTriangle, 
  Download, 
  Clock, 
  Edit3
} from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import { useErpStore, type Transfer, type TransferLineItem, type TransferStatus } from "@/lib/erpStore"
import { withOperatingWarehouses } from "@/lib/warehouses"
import { type TableColumn } from "@/components/ResizableTable"
import { DataTable } from "@/components/DataTable"
import { useAuthStore } from "@/lib/authStore"

export type { TransferStatus, TransferLineItem, Transfer }

const transferColumns: TableColumn[] = [
  { key: "reference_number", label: "Ref / TIN No.", align: "left" },
  { key: "from_warehouse", label: "Origin (Sender)", align: "left" },
  { key: "to_warehouse", label: "Destination (Receiver)", align: "left" },
  { key: "total_quantity", label: "Total Quantity", align: "right" },
  { key: "date", label: "Transfer Date", align: "left" },
  { key: "status", label: "Transfer Status", align: "center" },
  { key: "_actions", label: "Actions", align: "center", noSort: true },
]

export default function StoreTransfersTab() {
  const { showToast } = useFeedback()
  const erp = useErpStore()
  const { user } = useAuthStore()

  // Dynamic user details
  const currentUserName = user?.fullname || user?.username || "Store Manager"
  const userRoles = user?.roles || ((user as any)?.role ? [(user as any).role] : [])
  const isSuperAdmin = userRoles.includes("superadmin")
  const userWarehouseIds = useMemo(() => {
    return (user?.warehouse_ids || ((user as any)?.warehouse_id ? [(user as any).warehouse_id] : [])).map((id: string) => String(id).toUpperCase())
  }, [user])

  // --- TRANSFERS & PRODUCTS DATA ---
  const transfers = erp.getTransfers()
  const products = erp.getProducts()
  
  // Store-to-store transfers exist strictly between WH2 and WH3 since they share commercial products
  const transferWarehouses = useMemo(() => {
    const rawWhs = withOperatingWarehouses(erp.getWarehouses())
    const wh2And3 = rawWhs.filter((w) => {
      const idOrCode = (w.code || w.id || w.name || "").toUpperCase()
      return (
        idOrCode.includes("WH2") ||
        idOrCode.includes("WH3") ||
        idOrCode.includes("WH-02") ||
        idOrCode.includes("WH-03") ||
        idOrCode.includes("WAREHOUSE 2") ||
        idOrCode.includes("WAREHOUSE 3")
      )
    })
    if (wh2And3.length >= 2) return wh2And3
    const nonWh1 = rawWhs.filter(
      (w) =>
        !((w.code || w.id || "").toUpperCase().includes("WH1") ||
          (w.code || w.id || "").toUpperCase().includes("WH-01"))
    )
    if (nonWh1.length >= 2) return nonWh1
    return [
      { id: "WH2", code: "WH2", name: "Warehouse 2 (Store)", location: "Addis Ababa", type: "Commercial Store", specialization: "Veterinary Pharmaceuticals & Finished Products", targetMarkets: "Local/Export", manager: "Store Manager", status: "Active" },
      { id: "WH3", code: "WH3", name: "Warehouse 3 (Store)", location: "Addis Ababa", type: "Commercial Store", specialization: "Veterinary Vaccines & Soluble Powders", targetMarkets: "Local/Export", manager: "Store Manager", status: "Active" },
    ]
  }, [erp])

  const warehouseOptions = useMemo(
    () => transferWarehouses.map((warehouse) => warehouse.code || warehouse.id).filter(Boolean),
    [transferWarehouses]
  )

  // Identify user's locked origin if assigned to a single warehouse
  const isAssignedOnlyToWH2 = userWarehouseIds.some(id => id.includes("WH2") || id.includes("WH-02")) && !userWarehouseIds.some(id => id.includes("WH3") || id.includes("WH-03"))
  const isAssignedOnlyToWH3 = userWarehouseIds.some(id => id.includes("WH3") || id.includes("WH-03")) && !userWarehouseIds.some(id => id.includes("WH2") || id.includes("WH-02"))

  const defaultOrigin = isAssignedOnlyToWH3 ? "WH3" : (warehouseOptions[0] || "WH2")
  const defaultDestination = isAssignedOnlyToWH3 ? "WH2" : (warehouseOptions.find(w => w !== defaultOrigin) || "WH3")

  // Products available in WH2 / WH3 commercial stores
  const transferProducts = useMemo(() => {
    return products.filter((p) => {
      if (warehouseOptions.includes(p.warehouse)) return true
      return (p.stockBreakdown || []).some((sb) => warehouseOptions.includes(sb.warehouse) && sb.qty > 0)
    })
  }, [products, warehouseOptions])

  // --- LIST FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | TransferStatus>("ALL")

  // --- FORM & VIEW STATES ---
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null) // Detail modal
  const [isFormOpen, setIsFormOpen] = useState(false) // Single-step Form modal
  const [formMode, setFormMode] = useState<"create" | "edit">("create")

  // --- FORM DATA STATE ---
  const [formRefNum, setFormRefNum] = useState("")
  const [formFromW, setFormFromW] = useState(defaultOrigin)
  const [formToW, setFormToW] = useState(defaultDestination)
  const [formLineItems, setFormLineItems] = useState<TransferLineItem[]>([])

  // --- RECEIPT MODAL STATE ---
  const [receivingTransfer, setReceivingTransfer] = useState<Transfer | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [receiptMode, setReceiptMode] = useState<"match" | "discrepancy">("match")
  const [discrepancyText, setDiscrepancyText] = useState("")
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false)

  // --- PDF EXPORT STATE ---
  const [isExporting, setIsExporting] = useState(false)

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isFormOpen || selectedTransfer !== null || isReceiptOpen || receivingTransfer !== null) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isFormOpen, selectedTransfer, isReceiptOpen, receivingTransfer])

  // Live auto-calculated total quantity in form
  const formTotalQuantity = useMemo(() => {
    return formLineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  }, [formLineItems])

  // Helpers: check user relation to transfer (Sender vs Receiver)
  const isSender = (transfer: Transfer) => {
    if (isSuperAdmin) return true
    const origin = (transfer.from_warehouse || "").toUpperCase()
    return userWarehouseIds.length === 0 || userWarehouseIds.some(id => origin.includes(id) || id.includes(origin))
  }

  const isReceiver = (transfer: Transfer) => {
    if (isSuperAdmin) return true
    const destination = (transfer.to_warehouse || "").toUpperCase()
    return userWarehouseIds.length === 0 || userWarehouseIds.some(id => destination.includes(id) || id.includes(destination))
  }

  // --- START NEW TRANSFER ---
  const handleInitiateNew = () => {
    const nextNum = transfers.length + 1
    const padNum = String(nextNum).padStart(4, "0")
    const refNum = `TR-${padNum}`

    setFormMode("create")
    setFormRefNum(refNum)
    setFormFromW(defaultOrigin)
    setFormToW(defaultDestination)

    setFormLineItems([
      { line_no: 1, item: "", UOM: "Pieces", quantity: 0, remark: "" }
    ])

    setIsFormOpen(true)
  }

  // --- FORM LINE ITEM MANIPULATION ---
  const handleAddLineRow = () => {
    const nextLineNo = formLineItems.length + 1
    setFormLineItems(prev => [
      ...prev,
      { line_no: nextLineNo, item: "", UOM: "Pieces", quantity: 0, remark: "" }
    ])
  }

  const handleRemoveLineRow = (index: number) => {
    if (formLineItems.length <= 1) {
      showToast("Validation Warning", "warning", "A transfer must contain at least 1 line item.")
      return
    }
    const filtered = formLineItems.filter((_, idx) => idx !== index)
    const updated = filtered.map((item, idx) => ({ ...item, line_no: idx + 1 }))
    setFormLineItems(updated)
  }

  const getAvailableStock = (itemName: string) => {
    if (!itemName || !formFromW) return 0
    const prod = transferProducts.find(p => p.name.toLowerCase() === itemName.toLowerCase() || p.id === itemName)
    if (!prod) return 0
    return prod.stockBreakdown?.find(sb => sb.warehouse === formFromW)?.qty ?? (prod.warehouse === formFromW ? prod.quantity : 0)
  }

  const handleUpdateLineItem = (index: number, field: keyof TransferLineItem, value: any) => {
    setFormLineItems(prev => prev.map((row, idx) => {
      if (idx === index) {
        const updatedRow = { ...row, [field]: value }
        
        // Smart auto-fill UOM from product
        if (field === "item" && value) {
          const matchedProd = transferProducts.find(p => p.name.toLowerCase() === value.toLowerCase() || p.id === value)
          if (matchedProd && matchedProd.unit) {
            updatedRow.UOM = matchedProd.unit
          }
        }
        return updatedRow
      }
      return row
    }))
  }

  // --- VALIDATE FORM FIELDS ---
  const validateForm = () => {
    if (!formFromW || !formToW) {
      showToast("Validation Error", "warning", "Please select both origin and destination warehouses.")
      return false
    }
    if (formFromW === formToW) {
      showToast("Validation Error", "warning", "Origin and destination warehouses must be different.")
      return false
    }
    const hasEmptyItem = formLineItems.some(item => !item.item || !item.item.trim())
    if (hasEmptyItem) {
      showToast("Validation Error", "warning", "All line items must have a product selected.")
      return false
    }
    const hasInvalidQty = formLineItems.some(item => Number(item.quantity) <= 0)
    if (hasInvalidQty) {
      showToast("Validation Error", "warning", "All line item quantities must be greater than zero.")
      return false
    }
    const hasExceededQty = formLineItems.some(item => {
      if (!item.item) return false
      const avail = getAvailableStock(item.item)
      return Number(item.quantity) > avail
    })
    if (hasExceededQty) {
      showToast("Stock Alert", "warning", "One or more line items exceed the available stock in origin store.")
      return false
    }
    return true
  }

  // --- SAVE AS DRAFT ---
  const handleSaveDraft = () => {
    if (!validateForm()) return

    const payload: Transfer = {
      reference_number: formRefNum,
      from_warehouse: formFromW,
      to_warehouse: formToW,
      status: "Draft",
      line_items: formLineItems,
      total_quantity: formTotalQuantity,
      date: new Date().toISOString().split("T")[0],
      issued_by: currentUserName,
      issued_at: new Date().toISOString().replace("T", " ").substring(0, 16),
      issued_signature: currentUserName,
    }

    erp.addStockTransfer(payload)
    showToast("Transfer Saved", "success", `Draft transfer ${formRefNum} recorded.`)
    setIsFormOpen(false)
  }

  // --- SIGN & DISPATCH DIRECTLY ---
  const handleSignAndDispatch = () => {
    if (!validateForm()) return

    const todayStr = new Date().toISOString().replace("T", " ").substring(0, 16)
    const payload: Transfer = {
      reference_number: formRefNum,
      from_warehouse: formFromW,
      to_warehouse: formToW,
      status: "Issued",
      line_items: formLineItems,
      total_quantity: formTotalQuantity,
      date: new Date().toISOString().split("T")[0],
      issued_by: currentUserName,
      issued_at: todayStr,
      issued_signature: currentUserName,
    }

    const res = erp.addStockTransfer(payload)
    showToast(
      "Transfer Dispatched",
      "success",
      `Stock units dispatched from ${formFromW} to ${formToW} by ${currentUserName}. ${res.journalEntryId ? `Voucher ${res.journalEntryId} created.` : ""}`
    )
    setIsFormOpen(false)
  }

  // --- CONFIRM RECEIPT (MATCH OR DISCREPANCY) ---
  const handleConfirmReceipt = () => {
    if (!receivingTransfer) return

    if (receiptMode === "discrepancy" && !discrepancyText.trim()) {
      showToast("Input Required", "warning", "Please specify the discrepancy details.")
      return
    }

    setIsProcessingReceipt(true)
    const todayStr = new Date().toISOString().replace("T", " ").substring(0, 16)
    const newStatus: TransferStatus = receiptMode === "match" ? "Received" : "Discrepancy"

    erp.updateTransferStatus(
      receivingTransfer.reference_number,
      newStatus,
      currentUserName,
      receiptMode === "discrepancy" ? discrepancyText.trim() : undefined,
      currentUserName,
      todayStr
    )

    // Stock Ledger Transfer Execution: Deduct from origin and add to destination in product stock breakdown
    if (newStatus === "Received") {
      receivingTransfer.line_items.forEach((line) => {
        const prod = transferProducts.find(p => p.name.toLowerCase() === line.item.toLowerCase() || p.id === line.item)
        if (prod) {
          const qty = Number(line.quantity) || 0
          const currentBreakdown = prod.stockBreakdown || []
          const toEntry = currentBreakdown.find(sb => sb.warehouse === receivingTransfer.to_warehouse)

          const updatedBreakdown = currentBreakdown.map(sb => {
            if (sb.warehouse === receivingTransfer.from_warehouse) {
              return { ...sb, qty: Math.max(0, Number(sb.qty || 0) - qty) }
            }
            if (sb.warehouse === receivingTransfer.to_warehouse) {
              return { ...sb, qty: Number(sb.qty || 0) + qty }
            }
            return sb
          })

          if (!toEntry) {
            updatedBreakdown.push({ warehouse: receivingTransfer.to_warehouse, qty: qty })
          }

          erp.updateProduct(prod.id, {
            stockBreakdown: updatedBreakdown,
          })
        }
      })
    }

    const refNum = receivingTransfer.reference_number
    const destWh = receivingTransfer.to_warehouse

    setIsProcessingReceipt(false)
    setIsReceiptOpen(false)
    setReceivingTransfer(null)
    setDiscrepancyText("")

    showToast(
      receiptMode === "match" ? "Transfer Receipt Confirmed" : "Discrepancy Logged",
      receiptMode === "match" ? "success" : "warning",
      `Transfer ${refNum} verified and posted into ${destWh} stock.`
    )
  }

  // --- PDF DOWNLOAD ---
  const handleDownloadPDF = (refNum: string) => {
    setIsExporting(true)
    setTimeout(() => {
      setIsExporting(false)
      showToast("Document Ready", "success", `Downloaded Material Transfer Note ${refNum}.pdf`)
    }, 1200)
  }

  // --- DUAL-PARTY FILTERED TRANSFERS ---
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      // 1. Role / Facility Scope: WH2/WH3 users see transfers where their warehouse is sender or receiver
      if (!isSuperAdmin && userWarehouseIds.length > 0) {
        const fromUpper = (t.from_warehouse || "").toUpperCase()
        const toUpper = (t.to_warehouse || "").toUpperCase()
        const hasMatch = userWarehouseIds.some(id => 
          fromUpper.includes(id) || id.includes(fromUpper) ||
          toUpper.includes(id) || id.includes(toUpper)
        )
        if (!hasMatch) return false
      }

      // 2. Status filter
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter
      
      // 3. Search query
      const lowerQuery = searchQuery.toLowerCase()
      const matchesSearch = 
        t.reference_number.toLowerCase().includes(lowerQuery) ||
        t.from_warehouse.toLowerCase().includes(lowerQuery) ||
        t.to_warehouse.toLowerCase().includes(lowerQuery) ||
        t.line_items.some(item => item.item.toLowerCase().includes(lowerQuery))

      return matchesStatus && matchesSearch
    })
  }, [transfers, searchQuery, statusFilter, isSuperAdmin, userWarehouseIds])

  return (
    <div className="space-y-6">
      <DataTable
        title="Store-to-Store Transfers"
        subtitle={`${filteredTransfers.length} inter-store movements between WH2 & WH3`}
        columns={transferColumns}
        data={filteredTransfers}
        isLoading={false}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search ref number, warehouse, commodity..."
        onRowClick={(transfer) => setSelectedTransfer(transfer)}
        keyExtractor={(transfer) => transfer.reference_number}
        actions={[
          {
            label: "New Transfer Entry",
            onClick: handleInitiateNew,
            icon: <Plus className="size-4" />,
            variant: "primary",
          },
        ]}
        filters={[
          {
            value: statusFilter,
            onChange: (val) => setStatusFilter(val as any),
            ariaLabel: "Filter by Status",
            options: [
              { value: "ALL", label: "All Statuses" },
              { value: "Draft", label: "Draft Entry" },
              { value: "Issued", label: "Issued / In Transit" },
              { value: "Received", label: "Received & Posted" },
              { value: "Discrepancy", label: "Discrepancy Flagged" },
            ],
          },
        ]}
        defaultWidths={{
          reference_number: 160,
          from_warehouse: 180,
          to_warehouse: 180,
          total_quantity: 140,
          date: 130,
          status: 140,
          _actions: 140,
        }}
        renderRow={(transfer, colWidths) => {
          const isIssued = transfer.status === "Issued"
          const isReceived = transfer.status === "Received"
          const isDiscrepancy = transfer.status === "Discrepancy"

          const statusBadge = 
            isReceived ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
            isIssued ? "bg-blue-50 text-blue-800 border-blue-200" :
            isDiscrepancy ? "bg-amber-50 text-amber-800 border-amber-300" :
            "bg-zinc-100 text-zinc-700 border-zinc-200"

          const canProcessReceipt = isIssued && isReceiver(transfer)

          return (
            <>
              {/* Reference Num */}
              <td style={{ width: `${colWidths.reference_number}px` }} className="py-4 px-6 overflow-hidden">
                <span className="font-mono font-black text-zinc-950 dark:text-white text-xs leading-none">
                  {transfer.reference_number}
                </span>
              </td>

              {/* From Warehouse */}
              <td style={{ width: `${colWidths.from_warehouse}px` }} className="py-4 px-4 overflow-hidden">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  <WarehouseIcon className="size-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">{transfer.from_warehouse}</span>
                </div>
              </td>

              {/* To Warehouse */}
              <td style={{ width: `${colWidths.to_warehouse}px` }} className="py-4 px-4 overflow-hidden">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  <WarehouseIcon className="size-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{transfer.to_warehouse}</span>
                </div>
              </td>

              {/* Total Quantity */}
              <td style={{ width: `${colWidths.total_quantity}px` }} className="py-4 px-4 text-right overflow-hidden">
                <span className="font-mono font-black text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-md border border-zinc-200/80 inline-block">
                  {transfer.total_quantity.toLocaleString()} units
                </span>
              </td>

              {/* Date */}
              <td style={{ width: `${colWidths.date}px` }} className="py-4 px-4 overflow-hidden">
                <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 font-mono">
                  <Calendar className="size-3 text-zinc-400" />
                  <span>{transfer.date}</span>
                </div>
              </td>

              {/* Status */}
              <td style={{ width: `${colWidths.status}px` }} className="py-4 px-4 text-center overflow-hidden">
                <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusBadge}`}>
                  {transfer.status}
                </span>
              </td>

              {/* Actions */}
              <td style={{ width: `${colWidths._actions}px` }} className="py-4 px-4 text-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-1.5">
                  {canProcessReceipt && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTransfer(null)
                        setReceivingTransfer(transfer)
                        setReceiptMode("match")
                        setIsReceiptOpen(true)
                      }}
                      className="px-2.5 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[10px] inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer"
                      title="Receive Stock into Store"
                    >
                      <Check className="size-3" /> Receive
                    </button>
                  )}

                  {isSender(transfer) && (transfer.status === "Draft" || transfer.status === "Issued") && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormMode("edit")
                        setFormRefNum(transfer.reference_number)
                        setFormFromW(transfer.from_warehouse)
                        setFormToW(transfer.to_warehouse)
                        setFormLineItems(transfer.line_items)
                        setIsFormOpen(true)
                      }}
                      className="px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-extrabold text-[10px] inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer"
                      title="Edit Transfer"
                    >
                      <Edit3 className="size-3 text-zinc-500" /> Edit
                    </button>
                  )}
                </div>
              </td>
            </>
          )
        }}
      />

      {/* =========================================================================
          STREAMLINED SINGLE-STEP TRANSFER ENTRY MODAL (MATCHING STOCK MODAL DESIGN)
          ========================================================================= */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl z-[121] border border-zinc-200/80 dark:border-zinc-800 max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800 shrink-0">
                <div>
                  <h2 className="text-xl font-black text-zinc-950 dark:text-white tracking-tight leading-tight">
                    {formMode === "create" ? "New Store-to-Store Transfer" : "Edit Store Transfer"}
                  </h2>
                  <p className="text-xs font-mono font-bold text-zinc-400 mt-0.5">
                    Ref: {formRefNum} &bull; Commercial Store Transfer (WH2 $\leftrightarrow$ WH3)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="size-8 rounded-full border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center transition-colors text-zinc-500 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto py-5 space-y-5 text-xs">
                {/* 1. Origin & Destination Facilities Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
                  {/* Origin Warehouse */}
                  <div className="space-y-1">
                    <span className="block text-[11px] font-black uppercase text-zinc-500">
                      Origin Warehouse (Sender) <span className="text-rose-600">*</span>
                    </span>
                    {isAssignedOnlyToWH2 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-3 flex items-center text-xs font-black text-zinc-900 dark:text-zinc-100 font-mono">
                        WH2 (Veterinary Import Hub)
                      </div>
                    ) : isAssignedOnlyToWH3 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-3 flex items-center text-xs font-black text-zinc-900 dark:text-zinc-100 font-mono">
                        WH3 (Veterinary Import Hub)
                      </div>
                    ) : (
                      <select
                        value={formFromW}
                        onChange={(e) => {
                          const newFrom = e.target.value
                          setFormFromW(newFrom)
                          if (formToW === newFrom) {
                            setFormToW(warehouseOptions.find(w => w !== newFrom) || "")
                          }
                        }}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-3 text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {warehouseOptions.map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Destination Warehouse */}
                  <div className="space-y-1">
                    <span className="block text-[11px] font-black uppercase text-zinc-500">
                      Destination Warehouse (Receiver) <span className="text-rose-600">*</span>
                    </span>
                    {isAssignedOnlyToWH2 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-3 flex items-center text-xs font-black text-zinc-900 dark:text-zinc-100 font-mono">
                        WH3 (Veterinary Import Hub)
                      </div>
                    ) : isAssignedOnlyToWH3 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-3 flex items-center text-xs font-black text-zinc-900 dark:text-zinc-100 font-mono">
                        WH2 (Veterinary Import Hub)
                      </div>
                    ) : (
                      <select
                        value={formToW}
                        onChange={(e) => setFormToW(e.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-3 text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {warehouseOptions.filter(w => w !== formFromW).map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* 2. Line Items Table Card */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-zinc-700 dark:text-zinc-300">
                      Transfer Line Items <span className="text-rose-600">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLineRow}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="size-3.5 text-emerald-700" /> Add Product Row
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {formLineItems.map((row, idx) => {
                      const avail = getAvailableStock(row.item)
                      const isOverStock = row.item && row.quantity && Number(row.quantity) > avail
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/70 items-start font-semibold"
                        >
                          {/* Product Selection */}
                          <div className="col-span-5 space-y-1">
                            <div className="flex items-center min-h-[16px]">
                              <label className="text-[10px] font-black uppercase text-zinc-400 block truncate">
                                Product
                                {row.item && (
                                  <span className={`ml-1 font-bold lowercase ${isOverStock ? "text-rose-600" : "text-zinc-500 font-mono"}`}>
                                    (avail: {avail.toLocaleString()} {row.UOM || "units"})
                                  </span>
                                )}
                              </label>
                            </div>
                            <input
                              type="text"
                              list="transfer-products-suggestions"
                              placeholder="Type product name..."
                              value={row.item}
                              onChange={(e) => handleUpdateLineItem(idx, "item", e.target.value)}
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-3 text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
                            />
                          </div>

                          {/* UOM */}
                          <div className="col-span-2 space-y-1">
                            <div className="flex items-center min-h-[16px]">
                              <label className="text-[10px] font-black uppercase text-zinc-400 block">UOM</label>
                            </div>
                            <input
                              type="text"
                              value={row.UOM || "Pieces"}
                              onChange={(e) => handleUpdateLineItem(idx, "UOM", e.target.value)}
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:border-emerald-500 text-center"
                            />
                          </div>

                          {/* Quantity */}
                          <div className="col-span-2 space-y-1">
                            <div className="flex items-center min-h-[16px]">
                              <label className="text-[10px] font-black uppercase text-zinc-400 block">Qty</label>
                            </div>
                            <input
                              type="number"
                              min="1"
                              value={row.quantity || ""}
                              onChange={(e) => handleUpdateLineItem(idx, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                              className={`h-10 w-full rounded-xl border px-2.5 text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 outline-none ${
                                isOverStock ? "border-rose-500 bg-rose-50/50" : "border-zinc-200 bg-white dark:bg-zinc-900 focus:border-emerald-500"
                              }`}
                            />
                          </div>

                          {/* Remark */}
                          <div className="col-span-2 space-y-1">
                            <div className="flex items-center min-h-[16px]">
                              <label className="text-[10px] font-black uppercase text-zinc-400 block">Remark</label>
                            </div>
                            <input
                              type="text"
                              placeholder="Batch / note"
                              value={row.remark || ""}
                              onChange={(e) => handleUpdateLineItem(idx, "remark", e.target.value)}
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 px-2.5 text-xs font-medium text-zinc-600 outline-none focus:border-emerald-500"
                            />
                          </div>

                          {/* Remove */}
                          <div className="col-span-1 space-y-1 flex flex-col items-center">
                            <div className="min-h-[16px]" />
                            <button
                              type="button"
                              onClick={() => handleRemoveLineRow(idx)}
                              className="h-10 w-10 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <datalist id="transfer-products-suggestions">
                    {transferProducts.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>

                {/* 3. Live Total Quantity Banner */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 text-white shadow-md">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-300">Total Dispatch Volume:</span>
                  <span className="font-mono text-sm font-black text-white">
                    {formTotalQuantity.toLocaleString()} Units
                  </span>
                </div>

                {/* 4. Digital Certification & Dispatcher Signature Box */}
                <div className="p-4.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4.5 text-emerald-700" />
                    <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-300 uppercase tracking-wider">
                      Authorized Dispatcher Digital Signature
                    </h4>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-400 block">Issuing Officer</span>
                      <span className="text-xs font-black text-zinc-950 dark:text-zinc-100">{currentUserName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase text-zinc-400 block mb-0.5">Verified Signature</span>
                      <span className="font-serif italic text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                        {currentUserName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions (Matching Stock Modal button format) */}
              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 shrink-0 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="h-11 px-5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="h-11 px-5 rounded-xl border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-900 cursor-pointer transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleSignAndDispatch}
                  className="h-11 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md active:scale-95 cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Check className="size-4" /> Sign & Dispatch
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          DETAIL INSPECTION MODAL (CLEAN DOCUMENT PREVIEW)
          ========================================================================= */}
      <AnimatePresence>
        {selectedTransfer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTransfer(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl z-[121] border border-zinc-200/80 dark:border-zinc-800 max-h-[90vh] flex flex-col overflow-hidden text-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800 shrink-0">
                <div>
                  <h2 className="text-xl font-black text-zinc-950 dark:text-white tracking-tight leading-tight">
                    Material Transfer Note
                  </h2>
                  <p className="text-xs font-mono font-bold text-zinc-400 mt-0.5">
                    Ref: {selectedTransfer.reference_number} &bull; {selectedTransfer.date}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTransfer(null)}
                  className="size-8 rounded-full border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center transition-colors text-zinc-500 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto py-5 space-y-5">
                {/* Movement Route Card */}
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 font-semibold">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 block mb-0.5">Origin Facility (Sender)</span>
                    <span className="text-xs font-black text-zinc-950 dark:text-zinc-100">{selectedTransfer.from_warehouse}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 block mb-0.5">Destination Facility (Receiver)</span>
                    <span className="text-xs font-black text-zinc-950 dark:text-zinc-100">{selectedTransfer.to_warehouse}</span>
                  </div>
                </div>

                {/* Items Ledger Table */}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/70 border-b border-zinc-200 dark:border-zinc-700 text-[10px] font-black uppercase text-zinc-400">
                        <th className="py-2.5 px-4">No.</th>
                        <th className="py-2.5 px-4">Item Description</th>
                        <th className="py-2.5 px-4 text-center">UOM</th>
                        <th className="py-2.5 px-4 text-right">Transfer Qty</th>
                        <th className="py-2.5 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">
                      {selectedTransfer.line_items.map((line, i) => (
                        <tr key={i}>
                          <td className="py-2.5 px-4 font-mono text-zinc-400">{line.line_no}</td>
                          <td className="py-2.5 px-4 text-zinc-950 dark:text-white">{line.item}</td>
                          <td className="py-2.5 px-4 text-center text-zinc-500">{line.UOM}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-950 dark:text-white">{line.quantity.toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-zinc-400 font-medium text-[11px]">{line.remark || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center p-3.5 rounded-xl bg-zinc-900 text-white font-black">
                  <span className="uppercase text-xs text-zinc-300">Total Validated Quantity:</span>
                  <span className="font-mono text-sm">{selectedTransfer.total_quantity.toLocaleString()} Units</span>
                </div>

                {/* Two-Party Sign-off Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Issuance Sign-off */}
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">1. Origin Issuance Sign-off</span>
                    <div className="text-xs space-y-1 font-semibold">
                      <p><span className="text-zinc-400">Date:</span> {selectedTransfer.issued_at || selectedTransfer.date}</p>
                      <p><span className="text-zinc-400">Dispatcher:</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedTransfer.issued_by || "Store Manager"}</strong></p>
                      <div className="pt-1">
                        <span className="font-serif italic text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                          {selectedTransfer.issued_signature || selectedTransfer.issued_by || "Authorized"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Sign-off */}
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">2. Receiver Verification Sign-off</span>
                    {selectedTransfer.status === "Received" ? (
                      <div className="text-xs space-y-1 font-semibold">
                        <p><span className="text-zinc-400">Date:</span> {selectedTransfer.received_at || selectedTransfer.date}</p>
                        <p><span className="text-zinc-400">Verified By:</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedTransfer.received_by}</strong></p>
                        <div className="pt-1">
                          <span className="font-serif italic text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                            {selectedTransfer.received_signature}
                          </span>
                        </div>
                      </div>
                    ) : selectedTransfer.status === "Discrepancy" ? (
                      <div className="text-xs space-y-1 font-semibold text-amber-700">
                        <p className="flex items-center gap-1 font-black"><AlertTriangle className="size-3.5" /> Discrepancy Flagged</p>
                        <p className="text-zinc-500 font-medium text-[11px]">Remark: {selectedTransfer.discrepancy_remark}</p>
                      </div>
                    ) : (
                      <div className="text-zinc-400 py-3 text-center flex items-center justify-center gap-1.5 font-bold">
                        <Clock className="size-4" /> Pending arrival & receipt at {selectedTransfer.to_warehouse}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Toolbar (Export PDF & Action buttons) */}
              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 shrink-0 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(selectedTransfer.reference_number)}
                  disabled={isExporting}
                  className="h-11 px-5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className={`size-4 ${isExporting ? "animate-spin" : ""}`} />
                  {isExporting ? "Exporting..." : "Download Note PDF"}
                </button>

                {/* Receiver Process Receipt Action */}
                {selectedTransfer.status === "Issued" && isReceiver(selectedTransfer) && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = selectedTransfer
                      setSelectedTransfer(null)
                      setReceivingTransfer(t)
                      setReceiptMode("match")
                      setIsReceiptOpen(true)
                    }}
                    className="h-11 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md active:scale-95 cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Check className="size-4" /> Process Receipt
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          RECEIPT CONFIRMATION MODAL (MATCHING STOCK MODAL DESIGN)
          ========================================================================= */}
      <AnimatePresence>
        {isReceiptOpen && receivingTransfer && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsReceiptOpen(false)
                setReceivingTransfer(null)
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl z-[131] border border-zinc-200/80 dark:border-zinc-800 text-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-150 dark:border-zinc-800 mb-4">
                <div>
                  <h3 className="text-base font-black text-zinc-950 dark:text-white uppercase tracking-tight">
                    Confirm Stock Receipt
                  </h3>
                  <p className="text-xs font-mono font-bold text-zinc-400 mt-0.5">
                    Ref: {receivingTransfer.reference_number} &bull; Destination: {receivingTransfer.to_warehouse}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptOpen(false)
                    setReceivingTransfer(null)
                  }}
                  className="size-7 rounded-full border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center transition-colors text-zinc-500 cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Receiving Officer Banner */}
              <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 mb-4 font-semibold">
                <span className="text-[10px] font-black uppercase text-zinc-400 block">Receiving Officer</span>
                <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">{currentUserName}</span>
              </div>

              {/* Verification Choices */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReceiptMode("match")}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-28 cursor-pointer ${
                      receiptMode === "match"
                        ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <div className="size-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <Check className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-zinc-900 dark:text-white text-xs">Quantities Match</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Physical goods match transfer manifest</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptMode("discrepancy")}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-28 cursor-pointer ${
                      receiptMode === "discrepancy"
                        ? "border-amber-600 bg-amber-50/60 dark:bg-amber-950/20 ring-2 ring-amber-500/20"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-zinc-900 dark:text-white text-xs">Discrepancy</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Variance or damaged goods observed</p>
                    </div>
                  </button>
                </div>

                {receiptMode === "discrepancy" && (
                  <div>
                    <label className="text-[11px] font-black uppercase text-zinc-500 block mb-1">
                      Discrepancy Details <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={discrepancyText}
                      onChange={(e) => setDiscrepancyText(e.target.value)}
                      placeholder="Specify short shipment, carton damage, or lot variance..."
                      className="w-full rounded-xl border border-zinc-200 p-3 text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-5 mt-5 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptOpen(false)
                    setReceivingTransfer(null)
                  }}
                  className="h-11 px-5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceipt}
                  disabled={isProcessingReceipt}
                  className="h-11 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md active:scale-95 cursor-pointer transition-all"
                >
                  {isProcessingReceipt ? "Processing..." : "Confirm & Post into Stock"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
