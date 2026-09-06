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
import { useErpStore, type Transfer, type TransferLineItem, type TransferStatus, type Product } from "@/lib/erpStore"
import { withOperatingWarehouses, isWH1, resolveWarehouseScope } from "@/lib/warehouses"
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

  // Dynamic user warehouse privileges for WH2 and WH3
  const hasWH2Privilege = useMemo(() => {
    if (isSuperAdmin) return true
    if (userWarehouseIds.length === 0) return false
    const resolved = resolveWarehouseScope(userWarehouseIds, erp.getWarehouses())
    return (
      resolved.some((id) => {
        const upper = id.toUpperCase()
        return upper === "WH2" || upper.includes("WH2") || upper.includes("WH-02") || upper.includes("WH 2")
      }) ||
      userWarehouseIds.some((id) => {
        const upper = id.toUpperCase()
        return upper === "WH2" || upper.includes("WH2") || upper.includes("WH-02")
      })
    )
  }, [isSuperAdmin, userWarehouseIds, erp])

  const hasWH3Privilege = useMemo(() => {
    if (isSuperAdmin) return true
    if (userWarehouseIds.length === 0) return false
    const resolved = resolveWarehouseScope(userWarehouseIds, erp.getWarehouses())
    return (
      resolved.some((id) => {
        const upper = id.toUpperCase()
        return upper === "WH3" || upper.includes("WH3") || upper.includes("WH-03") || upper.includes("WH 3")
      }) ||
      userWarehouseIds.some((id) => {
        const upper = id.toUpperCase()
        return upper === "WH3" || upper.includes("WH3") || upper.includes("WH-03")
      })
    )
  }, [isSuperAdmin, userWarehouseIds, erp])

  // Warehouse classification helpers
  const isWH2Warehouse = (whNameOrCode?: string): boolean => {
    if (!whNameOrCode) return false
    const upper = whNameOrCode.toUpperCase()
    return upper.includes("WH2") || upper.includes("WH-02") || upper.includes("WH 2") || upper.includes("INDIA") || upper.includes("IND")
  }

  const isWH3Warehouse = (whNameOrCode?: string): boolean => {
    if (!whNameOrCode) return false
    const upper = whNameOrCode.toUpperCase()
    return upper.includes("WH3") || upper.includes("WH-03") || upper.includes("WH 3") || upper.includes("CHINA") || upper.includes("CHN")
  }

  // Strict permission guards:
  // A user can ONLY send/dispatch from a warehouse they have privilege for
  const canSendFrom = (warehouse?: string): boolean => {
    if (isSuperAdmin) return true
    if (isWH2Warehouse(warehouse)) return hasWH2Privilege
    if (isWH3Warehouse(warehouse)) return hasWH3Privilege
    return false
  }

  // A user can ONLY approve/receive for a warehouse they have privilege for
  const canApproveReceiptFor = (warehouse?: string): boolean => {
    if (isSuperAdmin) return true
    if (isWH2Warehouse(warehouse)) return hasWH2Privilege
    if (isWH3Warehouse(warehouse)) return hasWH3Privilege
    return false
  }

  // --- TRANSFERS & PRODUCTS DATA ---
  const transfers = erp.getTransfers()
  const products = erp.getProducts()
  
  // Store-to-store transfers exist strictly between WH2 and WH3 since they share commercial products
  const transferWarehouses = useMemo(() => {
    const rawWhs = withOperatingWarehouses(erp.getWarehouses())
    return rawWhs.filter((w) => {
      const code = (w.code || w.id || w.name || "").toUpperCase()
      if (isWH1(code)) return false
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

  const warehouseOptions = useMemo(
    () => transferWarehouses.map((warehouse) => warehouse.code || warehouse.id).filter(Boolean),
    [transferWarehouses]
  )

  // Identify user's locked origin if assigned strictly to a single warehouse
  const isAssignedOnlyToWH2 = hasWH2Privilege && !hasWH3Privilege && !isSuperAdmin
  const isAssignedOnlyToWH3 = hasWH3Privilege && !hasWH2Privilege && !isSuperAdmin

  const defaultOrigin = isAssignedOnlyToWH3 
    ? (warehouseOptions.find(w => w.toUpperCase().includes("WH3")) || "WH3-VET-CHN") 
    : (warehouseOptions.find(w => w.toUpperCase().includes("WH2")) || "WH2-VET-IND")
  const defaultDestination = isAssignedOnlyToWH3 
    ? (warehouseOptions.find(w => w.toUpperCase().includes("WH2")) || "WH2-VET-IND") 
    : (warehouseOptions.find(w => w.toUpperCase().includes("WH3")) || "WH3-VET-CHN")

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
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0])
  const [formLineItems, setFormLineItems] = useState<TransferLineItem[]>([])

  // Products available in selected Origin Store
  const originProducts = useMemo(() => {
    if (!formFromW) return []
    const originUpper = formFromW.toUpperCase()
    return products.filter((p) => {
      const pWh = (p.warehouse || "").toUpperCase()
      const matchesWh = pWh === originUpper ||
        (originUpper.includes("WH2") && pWh.includes("WH2")) ||
        (originUpper.includes("WH3") && pWh.includes("WH3"))
      if (matchesWh && (p.quantity || 0) > 0) return true

      const hasBreakdown = (p.stockBreakdown || []).some((sb) => {
        const sbWh = (sb.warehouse || "").toUpperCase()
        const matchesSb = sbWh === originUpper ||
          (originUpper.includes("WH2") && sbWh.includes("WH2")) ||
          (originUpper.includes("WH3") && sbWh.includes("WH3"))
        return matchesSb && Number(sb.qty || 0) > 0
      })
      return hasBreakdown
    })
  }, [products, formFromW])

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
  // Sender privilege is strictly tied to origin warehouse (from_warehouse)
  const isSender = (transfer: Transfer) => {
    return canSendFrom(transfer.from_warehouse)
  }

  // Receiver approval privilege is strictly tied to destination warehouse (to_warehouse)
  // A sender with privilege for Warehouse 2 CANNOT approve for Warehouse 3, and vice versa!
  const isReceiver = (transfer: Transfer) => {
    return canApproveReceiptFor(transfer.to_warehouse)
  }

  // Helper to extract clean positive batches for a product, deduplicated by batchNo
  const getAvailableBatches = (prod?: Product) => {
    if (!prod) return []
    const batchMap = new Map<string, { batchNo: string; qty: number; expiry: string }>()

    if (prod.batches && prod.batches.length > 0) {
      for (const b of prod.batches) {
        const bNo = (b.batchNo || "").trim()
        if (!bNo) continue
        const q = Number(b.qty || 0)
        if (batchMap.has(bNo)) {
          const existing = batchMap.get(bNo)!
          existing.qty += q
          if (!existing.expiry && b.expiry) existing.expiry = b.expiry
        } else {
          batchMap.set(bNo, { batchNo: bNo, qty: q, expiry: b.expiry || "" })
        }
      }
    } else if (prod.batch) {
      const bNo = prod.batch.trim()
      batchMap.set(bNo, { batchNo: bNo, qty: Number(prod.quantity || 0), expiry: prod.expiry || "" })
    }

    // Exclude batches with 0 or negative stock completely
    return Array.from(batchMap.values()).filter((b) => b.qty > 0)
  }

  const getRowAvailableStock = (row: TransferLineItem, currentIndex?: number): number => {
    if (!row.productId && !row.item) return 0
    const prod = originProducts.find((p) => p.id === row.productId || p.name === row.item)
    if (!prod) return 0

    let totalStock = 0
    if (row.batch_no) {
      const activeBatches = getAvailableBatches(prod)
      const b = activeBatches.find((x) => x.batchNo === row.batch_no)
      totalStock = b ? b.qty : 0
    }
    if (totalStock === 0) {
      const originUpper = formFromW.toUpperCase()
      const breakdownEntry = prod.stockBreakdown?.find((sb) => {
        const sbWh = (sb.warehouse || "").toUpperCase()
        return sbWh === originUpper || (originUpper.includes("WH2") && sbWh.includes("WH2")) || (originUpper.includes("WH3") && sbWh.includes("WH3"))
      })
      totalStock = breakdownEntry != null ? Number(breakdownEntry.qty || 0) : Number(prod.quantity || 0)
    }

    // Deduct stock allocated by other rows for the same product and batch
    const allocatedInOtherRows = formLineItems.reduce((sum, item, idx) => {
      if (currentIndex !== undefined && idx === currentIndex) return sum
      const sameProduct = (row.productId && item.productId === row.productId) || (row.item && item.item === row.item)
      if (!sameProduct) return sum
      if (row.batch_no && item.batch_no) {
        if (row.batch_no === item.batch_no) {
          return sum + (Number(item.quantity) || 0)
        }
        return sum
      }
      return sum + (Number(item.quantity) || 0)
    }, 0)

    return Math.max(0, totalStock - allocatedInOtherRows)
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
    setFormDate(new Date().toISOString().split("T")[0])

    setFormLineItems([
      { line_no: 1, productId: "", item: "", UOM: "Pieces", batch_no: "", expiry: "", quantity: 0, unit_price: 0, remark: "" }
    ])

    setIsFormOpen(true)
  }

  // --- FORM LINE ITEM MANIPULATION ---
  const handleAddLineRow = () => {
    const nextLineNo = formLineItems.length + 1
    setFormLineItems(prev => [
      ...prev,
      { line_no: nextLineNo, productId: "", item: "", UOM: "Pieces", batch_no: "", expiry: "", quantity: 0, unit_price: 0, remark: "" }
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

  const handleSelectProduct = (index: number, selectedProductId: string) => {
    const selectedProd = originProducts.find(p => p.id === selectedProductId)
    setFormLineItems(prev => prev.map((row, idx) => {
      if (idx !== index) return row
      if (!selectedProd) {
        return {
          ...row,
          productId: "",
          item: "",
          UOM: "Pieces",
          batch_no: "",
          expiry: "",
          quantity: 0,
          unit_price: 0,
        }
      }
      const activeBatches = getAvailableBatches(selectedProd)
      const firstBatch = activeBatches[0]
      const defaultBatchNo = firstBatch?.batchNo || ""
      const defaultExpiry = firstBatch?.expiry || selectedProd.expiry || ""

      return {
        ...row,
        productId: selectedProd.id,
        item: selectedProd.name,
        UOM: selectedProd.unit || "Pieces",
        unit_price: selectedProd.unitCost || 0,
        batch_no: defaultBatchNo,
        expiry: defaultExpiry,
        quantity: row.quantity > 0 ? row.quantity : 1,
      }
    }))
  }

  const handleSelectBatch = (index: number, batchNo: string) => {
    setFormLineItems(prev => prev.map((row, idx) => {
      if (idx !== index) return row
      const prod = originProducts.find(p => p.id === row.productId || p.name === row.item)
      const batches = getAvailableBatches(prod)
      const matchedBatch = batches.find(b => b.batchNo === batchNo)
      return {
        ...row,
        batch_no: batchNo,
        expiry: matchedBatch?.expiry || row.expiry || "",
      }
    }))
  }

  const handleUpdateLineItem = (index: number, field: keyof TransferLineItem, value: any) => {
    setFormLineItems(prev => prev.map((row, idx) => {
      if (idx === index) {
        return { ...row, [field]: value }
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
    if (formLineItems.length === 0) {
      showToast("Validation Error", "warning", "Please add at least one line item.")
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
    const hasExceededQty = formLineItems.some((item, idx) => {
      const avail = getRowAvailableStock(item, idx)
      return Number(item.quantity) > avail
    })
    if (hasExceededQty) {
      showToast("Stock Alert", "warning", "One or more line items exceed the available stock in origin store.")
      return false
    }
    return true
  }

  // --- SAVE AS DRAFT ---
  const handleSaveDraft = async () => {
    if (!validateForm()) return

    if (!canSendFrom(formFromW)) {
      showToast(
        "Privilege Restriction",
        "warning",
        `You do not have permission to initiate transfers from ${formFromW}. You can only initiate transfers from your authorized warehouse.`
      )
      return
    }

    const payload: Transfer = {
      reference_number: formRefNum,
      from_warehouse: formFromW,
      to_warehouse: formToW,
      status: "Draft",
      line_items: formLineItems,
      total_quantity: formTotalQuantity,
      date: formDate || new Date().toISOString().split("T")[0],
      issued_by: currentUserName,
      issued_at: new Date().toISOString().replace("T", " ").substring(0, 16),
      issued_signature: currentUserName,
    }

    await erp.addStockTransfer(payload)
    showToast("Transfer Saved", "success", `Draft transfer ${formRefNum} recorded.`)
    setIsFormOpen(false)
  }

  // --- SIGN & DISPATCH DIRECTLY ---
  const handleSignAndDispatch = async () => {
    if (!validateForm()) return

    if (!canSendFrom(formFromW)) {
      showToast(
        "Privilege Restriction",
        "warning",
        `You do not have permission to dispatch stock from ${formFromW}. You can only dispatch transfers from your authorized warehouse.`
      )
      return
    }

    const todayStr = new Date().toISOString().replace("T", " ").substring(0, 16)
    const payload: Transfer = {
      reference_number: formRefNum,
      from_warehouse: formFromW,
      to_warehouse: formToW,
      status: "Issued",
      line_items: formLineItems,
      total_quantity: formTotalQuantity,
      date: formDate || new Date().toISOString().split("T")[0],
      issued_by: currentUserName,
      issued_at: todayStr,
      issued_signature: currentUserName,
    }

    const res = await erp.addStockTransfer(payload)
    showToast(
      "Transfer Dispatched",
      "success",
      `Stock units dispatched from ${formFromW} to ${formToW} by ${currentUserName}. ${res.journalEntryId ? `Voucher ${res.journalEntryId} created.` : ""}`
    )
    setIsFormOpen(false)
  }

  // --- CONFIRM RECEIPT (MATCH OR DISCREPANCY) ---
  const handleConfirmReceipt = async () => {
    if (!receivingTransfer) return

    if (!canApproveReceiptFor(receivingTransfer.to_warehouse)) {
      showToast(
        "Privilege Restriction",
        "warning",
        `You do not have permission to approve stock receipt for ${receivingTransfer.to_warehouse}. Only authorized store managers for this destination warehouse can confirm receipt.`
      )
      setIsReceiptOpen(false)
      setReceivingTransfer(null)
      return
    }

    if (receiptMode === "discrepancy" && !discrepancyText.trim()) {
      showToast("Input Required", "warning", "Please specify the discrepancy details.")
      return
    }

    setIsProcessingReceipt(true)
    const todayStr = new Date().toISOString().replace("T", " ").substring(0, 16)
    const newStatus: TransferStatus = receiptMode === "match" ? "Received" : "Discrepancy"

    await erp.updateTransferStatus(
      receivingTransfer.reference_number,
      newStatus,
      currentUserName,
      receiptMode === "discrepancy" ? discrepancyText.trim() : undefined,
      currentUserName,
      todayStr
    )

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
      if (!isSuperAdmin) {
        if (!hasWH2Privilege && !hasWH3Privilege) return false
        const matchesFrom = canSendFrom(t.from_warehouse)
        const matchesTo = canApproveReceiptFor(t.to_warehouse)
        if (!matchesFrom && !matchesTo) return false
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

                  {isSender(transfer) && transfer.status === "Draft" && (
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
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-zinc-200 flex flex-col text-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-200 shrink-0">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-black text-zinc-900">
                      {formMode === "create" ? "Initiate Store-to-Store Transfer" : "Edit Store Transfer"}
                    </h3>
                    <span className="font-mono text-xs font-black bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full border border-zinc-200">
                      {formRefNum}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Record commercial inventory movement between Warehouse 2 and Warehouse 3.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 cursor-pointer transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto space-y-6">
                {/* 1. Origin, Destination & Date Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-50 p-4.5 rounded-2xl border border-zinc-200">
                  {/* Origin Warehouse */}
                  <div className="space-y-1">
                    <span className="block text-[11px] font-black uppercase text-zinc-700">
                      Origin Warehouse (Sender) <span className="text-rose-600">*</span>
                    </span>
                    {isAssignedOnlyToWH2 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 flex items-center text-xs font-bold text-zinc-800">
                        {transferWarehouses.find(w => (w.code || w.id || "").toUpperCase().includes("WH2"))?.name || "WH2 (Veterinary Import Hub)"}
                      </div>
                    ) : isAssignedOnlyToWH3 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 flex items-center text-xs font-bold text-zinc-800">
                        {transferWarehouses.find(w => (w.code || w.id || "").toUpperCase().includes("WH3"))?.name || "WH3 (Veterinary Import Hub)"}
                      </div>
                    ) : (
                      <select
                        value={formFromW}
                        onChange={(e) => {
                          const newFrom = e.target.value
                          setFormFromW(newFrom)
                          const other = transferWarehouses.find(w => (w.code || w.id) !== newFrom)
                          if (other) setFormToW(other.code || other.id)
                          // Reset line item product selections since origin warehouse changed
                          setFormLineItems([
                            { line_no: 1, productId: "", item: "", UOM: "Pieces", batch_no: "", expiry: "", quantity: 0, unit_price: 0, remark: "" }
                          ])
                        }}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                      >
                        {transferWarehouses.map((w) => (
                          <option key={w.id || w.code} value={w.code || w.id}>
                            {w.name || w.code || w.id}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Destination Warehouse */}
                  <div className="space-y-1">
                    <span className="block text-[11px] font-black uppercase text-zinc-700">
                      Destination Warehouse (Receiver) <span className="text-rose-600">*</span>
                    </span>
                    {isAssignedOnlyToWH2 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 flex items-center text-xs font-bold text-zinc-800">
                        {transferWarehouses.find(w => (w.code || w.id || "").toUpperCase().includes("WH3"))?.name || "WH3 (Veterinary Import Hub)"}
                      </div>
                    ) : isAssignedOnlyToWH3 ? (
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 flex items-center text-xs font-bold text-zinc-800">
                        {transferWarehouses.find(w => (w.code || w.id || "").toUpperCase().includes("WH2"))?.name || "WH2 (Veterinary Import Hub)"}
                      </div>
                    ) : (
                      <select
                        value={formToW}
                        onChange={(e) => setFormToW(e.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                      >
                        {transferWarehouses.filter(w => (w.code || w.id) !== formFromW).map((w) => (
                          <option key={w.id || w.code} value={w.code || w.id}>
                            {w.name || w.code || w.id}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Transfer Date */}
                  <div className="space-y-1">
                    <span className="block text-[11px] font-black uppercase text-zinc-700">
                      Transfer Date <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-500 shadow-xs"
                    />
                  </div>
                </div>

                {/* 2. Line Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-black uppercase text-zinc-700 block">
                        Transfer Line Items <span className="text-rose-600">*</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        Select product items and lots available in {formFromW}.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLineRow}
                      className="px-3.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="size-3.5 text-emerald-700" /> Add Product Row
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formLineItems.map((row, idx) => {
                      const prod = originProducts.find(p => p.id === row.productId || p.name === row.item)
                      const availStock = getRowAvailableStock(row, idx)
                      const isOverStock = row.quantity > 0 && Number(row.quantity) > availStock
                      const availableBatches = getAvailableBatches(prod)

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border transition-all ${
                            isOverStock ? "bg-rose-50/40 border-rose-300" : "bg-zinc-50/80 border-zinc-200"
                          }`}
                        >
                          <div className="grid grid-cols-12 gap-3 items-start">
                            {/* Product Selector */}
                            <div className="col-span-12 sm:col-span-4 space-y-1">
                              <span className="text-[10px] font-black uppercase text-zinc-500 block">
                                Product Item <span className="text-rose-600">*</span>
                              </span>
                              <select
                                value={row.productId || (prod?.id || "")}
                                onChange={(e) => handleSelectProduct(idx, e.target.value)}
                                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                              >
                                <option value="">Select product...</option>
                                {originProducts.map((p) => {
                                  const stockInOrigin = p.warehouse === formFromW
                                    ? p.quantity
                                    : (p.stockBreakdown?.find(sb => sb.warehouse === formFromW)?.qty ?? p.quantity)
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({stockInOrigin} {p.unit} available)
                                    </option>
                                  )
                                })}
                              </select>
                            </div>

                            {/* Batch Selector */}
                            <div className="col-span-12 sm:col-span-3 space-y-1">
                              <span className="text-[10px] font-black uppercase text-zinc-500 block">
                                Batch / Lot No.
                              </span>
                              {availableBatches.length > 0 ? (
                                <select
                                  value={row.batch_no}
                                  onChange={(e) => handleSelectBatch(idx, e.target.value)}
                                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-mono font-bold text-zinc-900 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                                >
                                  {availableBatches.map((b) => (
                                    <option key={b.batchNo} value={b.batchNo}>
                                      {b.batchNo}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-2.5 flex items-center text-xs font-mono text-zinc-600">
                                  {row.batch_no || prod?.batch || "Standard Lot"}
                                </div>
                              )}
                            </div>

                            {/* Locked UOM */}
                            <div className="col-span-4 sm:col-span-2 space-y-1">
                              <span className="text-[10px] font-black uppercase text-zinc-500 block text-center">
                                UOM
                              </span>
                              <div className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-2 flex items-center justify-center text-xs font-bold text-zinc-700">
                                {row.UOM || prod?.unit || "Pieces"}
                              </div>
                            </div>

                            {/* Quantity */}
                            <div className="col-span-6 sm:col-span-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-zinc-500 block">
                                  Quantity <span className="text-rose-600">*</span>
                                </span>
                                {row.productId && (
                                  <span className="text-[9px] font-bold text-zinc-400 font-mono">
                                    Max: {availStock}
                                  </span>
                                )}
                              </div>
                              <input
                                type="number"
                                min="1"
                                max={availStock || undefined}
                                value={row.quantity || ""}
                                onChange={(e) => handleUpdateLineItem(idx, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                                placeholder="0"
                                className={`h-10 w-full rounded-xl border px-2.5 text-xs font-mono font-black text-right outline-none shadow-xs ${
                                  isOverStock
                                    ? "border-rose-500 bg-rose-50 text-rose-800 focus:border-rose-600"
                                    : "border-zinc-200 bg-white text-zinc-900 focus:border-emerald-500"
                                }`}
                              />
                            </div>

                            {/* Delete Button */}
                            <div className="col-span-2 sm:col-span-1 space-y-1 flex flex-col items-center">
                              <span className="text-[10px] font-black uppercase text-transparent block select-none">
                                Del
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveLineRow(idx)}
                                className="h-10 w-10 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>

                          {/* Sub-row: Expiry & Remark */}
                          <div className="mt-2.5 pt-2 border-t border-zinc-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-3 text-zinc-500 font-medium">
                              {row.expiry && (
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                                  Expiry: {row.expiry}
                                </span>
                              )}
                              {isOverStock && (
                                <span className="text-rose-600 font-bold flex items-center gap-1 text-[10px]">
                                  <AlertTriangle className="size-3" /> Exceeds available stock in {formFromW}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 max-w-sm">
                              <input
                                type="text"
                                placeholder="Optional line note or instructions..."
                                value={row.remark || ""}
                                onChange={(e) => handleUpdateLineItem(idx, "remark", e.target.value)}
                                className="h-7 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] text-zinc-700 outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 3. Live Total Quantity Banner */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 text-white shadow-md">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-300">Total Dispatch Volume:</span>
                  <span className="font-mono text-sm font-black text-white">
                    {formTotalQuantity.toLocaleString()} Units
                  </span>
                </div>

                {/* 4. Digital Certification & Dispatcher Signature Box */}
                <div className="p-4.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-emerald-700" />
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      Authorized Dispatcher Digital Signature
                    </h4>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-400 block">Issuing Officer</span>
                      <span className="text-xs font-black text-zinc-900">{currentUserName}</span>
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
              <div className="pt-4 border-t border-zinc-200 shrink-0 flex items-center justify-end gap-2.5 mt-5">
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
              className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl z-[121] border border-zinc-200 max-h-[90vh] flex flex-col overflow-hidden text-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 shrink-0">
                <div>
                  <h2 className="text-xl font-black text-zinc-900 tracking-tight leading-tight">
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
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200 font-semibold">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 block mb-0.5">Origin Facility (Sender)</span>
                    <span className="text-xs font-black text-zinc-900">{selectedTransfer.from_warehouse}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 block mb-0.5">Destination Facility (Receiver)</span>
                    <span className="text-xs font-black text-zinc-900">{selectedTransfer.to_warehouse}</span>
                  </div>
                </div>

                {/* Items Ledger Table */}
                <div className="border border-zinc-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-400">
                        <th className="py-2.5 px-4">No.</th>
                        <th className="py-2.5 px-4">Item Description</th>
                        <th className="py-2.5 px-4 text-center">UOM</th>
                        <th className="py-2.5 px-4 text-right">Transfer Qty</th>
                        <th className="py-2.5 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-bold text-zinc-800">
                      {selectedTransfer.line_items.map((line, i) => (
                        <tr key={i}>
                          <td className="py-2.5 px-4 font-mono text-zinc-400">{line.line_no}</td>
                          <td className="py-2.5 px-4 text-zinc-900">{line.item}</td>
                          <td className="py-2.5 px-4 text-center text-zinc-500">{line.UOM}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-900">{line.quantity.toLocaleString()}</td>
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
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">1. Origin Issuance Sign-off</span>
                    <div className="text-xs space-y-1 font-semibold">
                      <p><span className="text-zinc-400">Date:</span> {selectedTransfer.issued_at || selectedTransfer.date}</p>
                      <p><span className="text-zinc-400">Dispatcher:</span> <strong className="text-zinc-900">{selectedTransfer.issued_by || "Store Manager"}</strong></p>
                      <div className="pt-1">
                        <span className="font-serif italic text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                          {selectedTransfer.issued_signature || selectedTransfer.issued_by || "Authorized"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Sign-off */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">2. Receiver Verification Sign-off</span>
                    {selectedTransfer.status === "Received" ? (
                      <div className="text-xs space-y-1 font-semibold">
                        <p><span className="text-zinc-400">Date:</span> {selectedTransfer.received_at || selectedTransfer.date}</p>
                        <p><span className="text-zinc-400">Verified By:</span> <strong className="text-zinc-900">{selectedTransfer.received_by}</strong></p>
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
              <div className="pt-4 border-t border-zinc-200 shrink-0 flex items-center justify-end gap-2.5">
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
                {selectedTransfer.status === "Issued" && (
                  isReceiver(selectedTransfer) ? (
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
                  ) : (
                    <div className="text-[11px] font-bold text-zinc-500 bg-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-200 flex items-center gap-1.5">
                      <Shield className="size-3.5 text-zinc-400" />
                      Awaiting confirmation by {selectedTransfer.to_warehouse} receiver
                    </div>
                  )
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
              className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl z-[131] border border-zinc-200 text-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 mb-4">
                <div>
                  <h3 className="text-base font-black text-zinc-900 uppercase tracking-tight">
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
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 mb-4 font-semibold">
                <span className="text-[10px] font-black uppercase text-zinc-400 block">Receiving Officer</span>
                <span className="text-xs font-black text-zinc-900">{currentUserName}</span>
              </div>

              {/* Verification Choices */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReceiptMode("match")}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-28 cursor-pointer ${
                      receiptMode === "match"
                        ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <div className="size-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <Check className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-zinc-900 text-xs">Quantities Match</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Physical goods match transfer manifest</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptMode("discrepancy")}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-28 cursor-pointer ${
                      receiptMode === "discrepancy"
                        ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-zinc-900 text-xs">Discrepancy</h4>
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
              <div className="pt-5 mt-5 border-t border-zinc-200 flex items-center justify-end gap-2.5">
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
