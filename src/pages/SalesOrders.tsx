import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, 
  CheckCircle2, 
  FileText, 
  X, 
  Pencil,
  Trash2,
  AlertTriangle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Phone,
  ExternalLink,
  Clock,
  AlertCircle,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, getTradeLicenseStatus, type SalesOrder, type Quotation, type SalesOrderItem, type Product } from "@/lib/erpStore"
import { useFinanceStore, calculateMultiTax, resolveAutoTaxScheduleId } from "@/lib/financeStore"
import { withOperatingWarehouses } from "@/lib/warehouses"
import { useFeedback } from "@/context/FeedbackContext"
import { type TableColumn } from "@/components/ResizableTable"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { DataTable } from "@/components/DataTable"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { LoadingDots } from "@/components/ui/LoadingDots"

import {
  type ShipmentDocAttachment,
  saveTradeLicense,
  savePaymentAdvice,
  fetchDocumentsForRecord,
  fetchAllShipmentDocs,
} from "@/lib/tradeDocumentService"
import { uploadFile } from "@/lib/fileUpload"

const isWH1 = (w?: string) => {
  if (!w) return false
  const upper = w.toUpperCase()
  return upper.includes("WH1") || upper.includes("WH-01") || upper.includes("WH 1") || upper.includes("AGRI")
}

const COMMODITY_UNITS = ["Quintal", "Ton"]
const CONTAINER_UNITS = ["Box", "Bottle", "Vial", "Sachet", "Pack", "Carton"]

function resolveSalesOrderDocs(
  soId: string,
  customerName: string,
  tradePaperUrl: string | undefined,
  tradePaperFileName: string | undefined,
  attachments: ShipmentDocAttachment[],
  warehouse?: string
) {
  const docsList = [...(attachments || [])]
  const isWh1Order = isWH1(warehouse)
  const defaultDocType = isWh1Order ? "Bank Permit" : "Trade License"

  let tradeLicense = docsList.find(
    (d) =>
      d.document_type === "Bank Permit" ||
      d.document_type === "Trade License" ||
      d.document_type === "Trade Paper" ||
      d.document_type?.toLowerCase().includes("permit")
  )
  const paymentAdvice = docsList.find((d) => d.document_type === "Payment Advice" || d.document_type?.toLowerCase().includes("advice"))

  if (!tradeLicense && tradePaperUrl) {
    tradeLicense = {
      id: `CUST-DOC-${soId}`,
      record_id: soId,
      record_type: "sales_order",
      document_type: defaultDocType,
      file_name: tradePaperFileName || (isWh1Order ? "Bank Permit.pdf" : "Trade License.pdf"),
      file_size: 102400,
      file_url: tradePaperUrl,
      uploaded_at: new Date().toISOString(),
      uploaded_by: customerName,
    }
    docsList.push(tradeLicense)
  }

  return {
    docsList,
    tradeLicense,
    paymentAdvice,
  }
}

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

export default function SalesOrders() {
  const { showToast } = useFeedback()
  const erp = useErpStore()
  const isLoading = erp.isLoading()
  
  const salesOrders = erp.getSalesOrders()
  const customers = erp.getCustomers()
  const products = erp.getProducts()
  const warehouses = withOperatingWarehouses(erp.getWarehouses())
  const warehouseOptions = warehouses.map((warehouse) => ({ value: warehouse.code || warehouse.id, label: warehouse.name || warehouse.code || warehouse.id }))

  // Search & Filter states for Sales Orders
  const [soSearch, setSoSearch] = useState("")
  const [soWhFilter, setSoWhFilter] = useState("ALL")
  const [soApprovalFilter, setSoApprovalFilter] = useState("ALL")

  // Selected Sales Order for Inspection / Fulfillment / Invoicing
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)

  const [soAttachmentsMap, setSoAttachmentsMap] = useState<Record<string, ShipmentDocAttachment[]>>({})
  const [soAttachmentsLoaded, setSoAttachmentsLoaded] = useState(false)

  // Hydrate sales & inventory data on mount
  useEffect(() => {
    void erp.loadSalesData()
    void erp.loadInventoryData()
  }, [erp])

  // Batch load all shipment documents on mount to eliminate N separate async calls
  useEffect(() => {
    let cancelled = false
    fetchAllShipmentDocs()
      .then((docs) => {
        if (!cancelled && Array.isArray(docs)) {
          const map: Record<string, ShipmentDocAttachment[]> = {}
          docs.forEach((d) => {
            if (!map[d.record_id]) map[d.record_id] = []
            map[d.record_id].push(d)
          })
          setSoAttachmentsMap(map)
          setSoAttachmentsLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setSoAttachmentsLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedOrder?.id) {
      fetchDocumentsForRecord(selectedOrder.id, "sales_order").then((docs) => {
        setSoAttachmentsMap((prev) => ({ ...prev, [selectedOrder.id]: docs }))
      })
    }
  }, [selectedOrder?.id])

  const customerComboboxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerComboboxRef.current && !customerComboboxRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Modals
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [isSavingEditOrder, setIsSavingEditOrder] = useState(false)
  const [isSubmittingQuotation, setIsSubmittingQuotation] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState<SalesOrder | null>(null)
  const [isNewQuotationOpen, setIsNewQuotationOpen] = useState(false)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const financeStore = useFinanceStore()
  const taxRules = financeStore.getTaxRules()
  const taxSchedules = financeStore.getTaxSchedules()

  // Billing form state
  const [selectedTaxScheduleId, setSelectedTaxScheduleId] = useState<string>("SCH-DOM-VAT")
  const [paymentTerms, setPaymentTerms] = useState("Net 30")

  // Auto-resolve tax schedule whenever selectedOrder opens
  useEffect(() => {
    if (selectedOrder) {
      const customers = erp.getCustomers()
      const cust = customers.find((c) => c.name === selectedOrder.customer || c.id === selectedOrder.customer)
      const firstItem = selectedOrder.items?.[0]
      const autoId = resolveAutoTaxScheduleId(cust, { name: firstItem?.name }, "SALES")
      setSelectedTaxScheduleId(autoId)
    }
  }, [selectedOrder, erp])

  const orderTaxCalc = useMemo(() => {
    if (!selectedOrder) return { subtotal: 0, taxLines: [], totalTaxAdded: 0, totalTaxDeducted: 0, netTotal: 0 }
    return calculateMultiTax(selectedOrder.amount, taxRules, selectedTaxScheduleId)
  }, [selectedOrder, taxRules, selectedTaxScheduleId])

  // New Sales Order Form State
  const [newCustomerId, setNewCustomerId] = useState("")
  const [customerSearchInput, setCustomerSearchInput] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [saveCustomerToRegistry, setSaveCustomerToRegistry] = useState(true)
  const [custPhone, setCustPhone] = useState("")
  const [custEmail, setCustEmail] = useState("")
  const [custAddress, setCustAddress] = useState("")
  const [newPaymentType, setNewPaymentType] = useState<"Cash" | "Credit">("Credit")

  // Staged Attachments
  const [stagedTradePaperName, setStagedTradePaperName] = useState("")
  const [stagedTradePaperUrl, setStagedTradePaperUrl] = useState("")
  const [isNewlyUploadedTradeLicense, setIsNewlyUploadedTradeLicense] = useState(false)
  const [stagedPaymentAdviceName, setStagedPaymentAdviceName] = useState("")
  const [stagedPaymentAdviceUrl, setStagedPaymentAdviceUrl] = useState("")

  // Document Preview Modal States
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewName, setPreviewName] = useState("")

  const [newWarehouse, setNewWarehouse] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([])

  // Inline Form Validation Errors
  const [createFormErrors, setCreateFormErrors] = useState<Record<string, string>>({})
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({})

  // New Quotation Form State
  const [quoteCustomerId, setQuoteCustomerId] = useState("")
  const [quoteWarehouse, setQuoteWarehouse] = useState("")
  const [quoteValidDays, setQuoteValidDays] = useState("")
  const [quoteDesc, setQuoteDesc] = useState("")
  const [quoteItems] = useState<SalesOrderItem[]>([])

  // Filtered data for tables
  const filteredOrders = salesOrders.filter((so) => {
    const cust = (so.customer || (so as any).customer_name || "").toLowerCase()
    const id = (so.id || "").toLowerCase()
    const desc = (so.desc || (so as any).description || "").toLowerCase()
    const q = (soSearch || "").toLowerCase()

    const matchesSearch = cust.includes(q) || id.includes(q) || desc.includes(q)
    if (!matchesSearch) return false
    if (soWhFilter !== "ALL" && so.warehouse !== soWhFilter) return false
    if (soApprovalFilter !== "ALL") {
      const currentApproval = so.approvalStatus || "Pending"
      if (currentApproval !== soApprovalFilter) return false
    }
    return true
  })

  // Table Columns setup
  const salesOrderColumns: TableColumn[] = [
    { key: "id", label: "Order ID", align: "left" },
    { key: "customer", label: "Customer", align: "left" },
    { key: "warehouse", label: "Warehouse", align: "left" },
    { key: "paymentType", label: "Payment Method", align: "left" },
    { key: "approvalStatus", label: "Approval Status", align: "center" },
    { key: "docsStatus", label: "Required Docs", align: "left" },
    { key: "amount", label: "Amount (ETB)", align: "right" },
    { key: "_actions", label: "Action", align: "center", noSort: true },
  ]

function resolveWarehouseCode(rawWh: string | undefined, warehousesList: Array<{ id: string; code?: string; name?: string }>): string {
  if (!warehousesList || warehousesList.length === 0) return "WH1"
  if (!rawWh) return warehousesList[0].code || warehousesList[0].id
  const clean = rawWh.trim().toLowerCase()
  const match = warehousesList.find((w) => 
    (w.code && w.code.toLowerCase() === clean) ||
    (w.id && w.id.toLowerCase() === clean) ||
    (w.name && w.name.toLowerCase() === clean) ||
    (w.code && clean.includes(w.code.toLowerCase())) ||
    (w.id && clean.includes(w.id.toLowerCase()))
  )
  return match ? (match.code || match.id) : (warehousesList[0].code || warehousesList[0].id)
}

  const getProductsForWarehouse = (targetWh: string) => {
    if (!targetWh || targetWh === "ALL") return products
    const cleanTarget = targetWh.trim()
    const targetWhBase = cleanTarget.split("-")[0].toUpperCase()
    const targetIsWh1 = isWH1(cleanTarget)

    const matched = products.filter((p) => {
      // 1. Stock breakdown match with qty > 0
      const sbMatch = (p.stockBreakdown || []).some((sb) => {
        if (!sb.warehouse) return false
        const sbCode = resolveWarehouseCode(sb.warehouse, warehouses)
        return (
          sb.warehouse === cleanTarget ||
          sbCode === cleanTarget ||
          sb.warehouse.toUpperCase().startsWith(targetWhBase) ||
          sbCode.toUpperCase().startsWith(targetWhBase)
        ) && Number(sb.qty || 0) > 0
      })
      if (sbMatch) return true

      // 2. Primary warehouse match
      if (p.warehouse) {
        const prodWhCode = resolveWarehouseCode(p.warehouse, warehouses)
        const matchesWh =
          p.warehouse === cleanTarget ||
          prodWhCode === cleanTarget ||
          p.warehouse.toUpperCase().startsWith(targetWhBase) ||
          prodWhCode.toUpperCase().startsWith(targetWhBase)
        if (matchesWh) return true
      }

      // 3. WH1 commodities match
      if (targetIsWh1 && (isWH1(p.warehouse) || isWH1(resolveWarehouseCode(p.warehouse, warehouses)))) {
        return true
      }

      return false
    })

    if (matched.length > 0) return matched
    return products.filter((p) => (targetIsWh1 ? isWH1(p.warehouse) : !isWH1(p.warehouse)))
  }

  // Open New Order modal prefilled with default line item and product warehouse
  const handleOpenNewOrderModal = () => {
    const targetWh = soWhFilter !== "ALL" 
      ? soWhFilter 
      : (warehouses[0]?.code || warehouses[0]?.id || "WH1")
    const isWh1Target = isWH1(targetWh)
    const matchingProducts = getProductsForWarehouse(targetWh)
    const defaultProduct = matchingProducts[0] || (isWh1Target 
      ? { id: "PRD-001", name: "Sesame Seed", sku: "SES-001", valuationRate: 1500, unit: "Quintal", sellingPrice: 1500, warehouse: "WH1" }
      : { id: "PRD-002", name: "Oxytetracycline 20%", sku: "OXY-002", valuationRate: 850, unit: "Box", sellingPrice: 850, warehouse: "WH2" }
    )
    const loadedPrice = defaultProduct.sellingPrice || defaultProduct.unitCost || defaultProduct.valuationRate || 1500
    const defaultUnit = isWh1Target ? (defaultProduct.unit === "Ton" ? "Ton" : "Quintal") : (defaultProduct.unit || "Box")

    setNewWarehouse(targetWh)
    setNewPaymentType(isWh1Target ? "Credit" : "Cash")
    setNewCustomerId("")
    setCustomerSearchInput("")
    setShowCustomerDropdown(false)
    setCustPhone("")
    setCustEmail("")
    setCustAddress("")
    setNewDesc("")
    setStagedTradePaperName("")
    setStagedTradePaperUrl("")
    setStagedPaymentAdviceName("")
    setStagedPaymentAdviceUrl("")
    setIsNewlyUploadedTradeLicense(false)

    setOrderItems([
      {
        productId: defaultProduct.id,
        name: defaultProduct.name,
        qty: 10,
        unit: defaultUnit,
        unitPrice: loadedPrice,
        total: loadedPrice * 10,
      },
    ])
    setIsNewOrderOpen(true)
  }

  // Item Row Handlers for New/Edit Order
  const handleOrderItemChange = (index: number, field: keyof SalesOrderItem, value: any, isEditing = false) => {
    const setter = isEditing ? setEditingOrderItems : setOrderItems
    setter((prev) => {
      const next = [...prev]
      const current = { ...next[index] }

      if (field === "productId") {
        const currentWh = isEditing ? editingOrder?.warehouse : newWarehouse
        const availableForWh = getProductsForWarehouse(currentWh || "")
        const prod = availableForWh.find((p) => p.id === value) || products.find((p) => p.id === value)
        if (prod) {
          const loadedPrice = prod.sellingPrice || prod.unitCost || prod.valuationRate || 1500
          const targetWh = !isEditing ? resolveWarehouseCode(prod.warehouse, warehouses) : (editingOrder?.warehouse || newWarehouse)
          const targetIsWh1 = isWH1(targetWh)
          const prodUnit = targetIsWh1 ? (prod.unit === "Ton" ? "Ton" : "Quintal") : (prod.unit || "Box")

          current.productId = prod.id
          current.name = prod.name
          current.unit = prodUnit
          current.unitPrice = loadedPrice
          current.total = current.qty * current.unitPrice

          // If no warehouse has been chosen yet, auto-bind to product's designated stock warehouse
          if (!isEditing && !newWarehouse) {
            setNewWarehouse(targetWh)
            if (targetIsWh1) {
              setNewPaymentType("Credit")
            }
          }
        }
      } else if (field === "qty") {
        const parsed = Math.max(0, Number(value) || 0)
        current.qty = parsed
        current.total = current.qty * current.unitPrice
      } else if (field === "unitPrice") {
        const parsed = Math.max(0, Number(value) || 0)
        current.unitPrice = parsed
        current.total = current.qty * current.unitPrice
      } else if (field === "unit") {
        current.unit = String(value)
      }

      next[index] = current
      return next
    })
  }

  const handleWarehouseChange = (whCode: string, isEditing = false) => {
    const isWh1 = isWH1(whCode)
    const availableForWh = getProductsForWarehouse(whCode)
    const fallbackProd: Partial<Product> & { id: string; name: string } = (availableForWh[0] as Product) || (isWh1
      ? { id: "PRD-001", name: "Sesame Seed", unit: "Quintal", valuationRate: 1500, sellingPrice: 1500, quantity: 1000, warehouse: "WH1" }
      : { id: "PRD-002", name: "Oxytetracycline 20%", unit: "Box", valuationRate: 850, sellingPrice: 850, quantity: 1000, warehouse: "WH2" }
    )

    if (isEditing && editingOrder) {
      setEditingOrder({ ...editingOrder, warehouse: whCode })
      if (isWh1) {
        setEditingPaymentType("Credit")
      }
      setEditingOrderItems((prev) =>
        prev.map((item) => {
          const prod: Partial<Product> & { id: string; name: string } = availableForWh.find((p) => p.id === item.productId) || fallbackProd
          const loadedPrice = prod.sellingPrice || prod.unitCost || prod.valuationRate || 1500
          let newUnit = item.unit
          if (isWh1) {
            if (!COMMODITY_UNITS.includes(newUnit)) {
              newUnit = prod.unit === "Ton" ? "Ton" : "Quintal"
            }
          } else {
            if (!CONTAINER_UNITS.includes(newUnit)) {
              newUnit = prod.unit && CONTAINER_UNITS.includes(prod.unit) ? prod.unit : "Box"
            }
          }
          return {
            ...item,
            productId: prod.id,
            name: prod.name,
            unit: newUnit,
            unitPrice: loadedPrice,
            total: (Number(item.qty) || 1) * loadedPrice,
          }
        })
      )
    } else {
      setNewWarehouse(whCode)
      if (isWh1) {
        setNewPaymentType("Credit")
      } else {
        setNewPaymentType("Cash")
      }
      setOrderItems((prev) =>
        prev.map((item) => {
          const prod: Partial<Product> & { id: string; name: string } = availableForWh.find((p) => p.id === item.productId) || fallbackProd
          const loadedPrice = prod.sellingPrice || prod.unitCost || prod.valuationRate || 1500
          let newUnit = item.unit
          if (isWh1) {
            if (!COMMODITY_UNITS.includes(newUnit)) {
              newUnit = prod.unit === "Ton" ? "Ton" : "Quintal"
            }
          } else {
            if (!CONTAINER_UNITS.includes(newUnit)) {
              newUnit = prod.unit && CONTAINER_UNITS.includes(prod.unit) ? prod.unit : "Box"
            }
          }
          return {
            ...item,
            productId: prod.id,
            name: prod.name,
            unit: newUnit,
            unitPrice: loadedPrice,
            total: (Number(item.qty) || 1) * loadedPrice,
          }
        })
      )
    }
  }

  const handleAddOrderItemRow = (isEditing = false) => {
    const currentWh = isEditing ? editingOrder?.warehouse : newWarehouse
    const targetIsWh1 = isWH1(currentWh || "")
    const availableForWh = getProductsForWarehouse(currentWh || "")
    const p = availableForWh[0] || (targetIsWh1 
      ? { id: "PRD-001", name: "Sesame Seed", unit: "Quintal", valuationRate: 1500, sellingPrice: 1500 }
      : { id: "PRD-002", name: "Oxytetracycline 20%", unit: "Box", valuationRate: 850, sellingPrice: 850 }
    )
    const loadedPrice = p.sellingPrice || p.unitCost || p.valuationRate || 1500
    const defaultUnit = targetIsWh1 ? (p.unit === "Ton" ? "Ton" : "Quintal") : (p.unit || "Box")
    const setter = isEditing ? setEditingOrderItems : setOrderItems

    setter((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        qty: 10,
        unit: defaultUnit,
        unitPrice: loadedPrice,
        total: loadedPrice * 10,
      },
    ])
  }

  const handleRemoveOrderItemRow = (index: number, isEditing = false) => {
    const setter = isEditing ? setEditingOrderItems : setOrderItems
    setter((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  // State for Editing Sales Order
  const [editingOrderItems, setEditingOrderItems] = useState<SalesOrderItem[]>([])
  const [editingCustPhone, setEditingCustPhone] = useState("")
  const [editingPaymentType, setEditingPaymentType] = useState<"Cash" | "Credit">("Credit")

  const handleOpenEditModal = async (so: SalesOrder) => {
    const isWh1 = isWH1(so.warehouse)
    setEditingOrder(so)
    setEditingCustPhone(so.customerPhone || "")
    setCustomerSearchInput(so.customer)
    setEditingPaymentType(so.paymentType || (isWh1 ? "Credit" : "Cash"))
    setEditingOrderItems(so.items.length > 0 ? [...so.items] : [
      {
        productId: products[0]?.id || "PRD-001",
        name: products[0]?.name || (isWh1 ? "Sesame Seed" : "Amoxicillin 500mg"),
        qty: 10,
        unit: isWh1 ? "Quintal" : (products[0]?.unit || "Box"),
        unitPrice: products[0]?.valuationRate || 1500,
        total: (products[0]?.valuationRate || 1500) * 10,
      }
    ])

    // 1. Instant resolution from in-memory cache and customer profile for 0ms delay
    const cachedDocs = soAttachmentsMap[so.id] || []
    const cust = customers.find((c) => c.id === so.customerId || c.name === so.customer)

    const resolved = resolveSalesOrderDocs(
      so.id,
      so.customer,
      cust?.tradePaperUrl,
      cust?.tradePaperFileName,
      cachedDocs,
      so.warehouse
    )

    setStagedTradePaperName(resolved.tradeLicense?.file_name || "")
    setStagedTradePaperUrl(resolved.tradeLicense?.file_url || "")
    setStagedPaymentAdviceName(resolved.paymentAdvice?.file_name || "")
    setStagedPaymentAdviceUrl(resolved.paymentAdvice?.file_url || "")

    // Open modal immediately without waiting on network
    setIsEditOrderOpen(true)

    // 2. Refresh attachments in background
    fetchDocumentsForRecord(so.id, "sales_order").then((freshDocs) => {
      if (Array.isArray(freshDocs) && freshDocs.length > 0) {
        setSoAttachmentsMap((prev) => ({ ...prev, [so.id]: freshDocs }))
        const updatedResolved = resolveSalesOrderDocs(
          so.id,
          so.customer,
          cust?.tradePaperUrl,
          cust?.tradePaperFileName,
          freshDocs,
          so.warehouse
        )
        if (updatedResolved.tradeLicense) {
          setStagedTradePaperName(updatedResolved.tradeLicense.file_name || "")
          setStagedTradePaperUrl(updatedResolved.tradeLicense.file_url || "")
        }
        if (updatedResolved.paymentAdvice) {
          setStagedPaymentAdviceName(updatedResolved.paymentAdvice.file_name || "")
          setStagedPaymentAdviceUrl(updatedResolved.paymentAdvice.file_url || "")
        }
      }
    }).catch(() => {})
  }

  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder || isSavingEditOrder) return

    const isWh1Order = isWH1(editingOrder.warehouse)
    const matchedCust = customers.find((c) => c.id === editingOrder.customerId || c.name === editingOrder.customer)

    const errors: Record<string, string> = {}
    if (!isWh1Order && !editingCustPhone.trim()) {
      errors.phone = "Customer phone number is required for WH2/WH3 orders."
    }

    if (matchedCust) {
      const evaluation = getTradeLicenseStatus(matchedCust, editingOrder.warehouse)
      if (evaluation.status !== "valid" && (!stagedTradePaperUrl || !stagedTradePaperName)) {
        errors.tradePaper = isWh1Order 
          ? "A valid Customer Bank Permit file must be attached." 
          : "An active (unexpired) Trade License file must be attached."
      }
    }

    if (editingPaymentType === "Cash" && (!stagedPaymentAdviceUrl || !stagedPaymentAdviceName)) {
      errors.paymentAdvice = "Payment Advice deposit receipt is mandatory when saving or converting to a Cash order."
    }

    if (editingOrderItems.length === 0 || editingOrderItems.some((i) => !i.productId || Number(i.qty) <= 0)) {
      errors.items = "Order must contain at least one valid item with a quantity greater than 0."
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors)
      return
    }
    setEditFormErrors({})
    setIsSavingEditOrder(true)

    const sanitizedItems: SalesOrderItem[] = editingOrderItems.map((i) => {
      const q = Math.max(1, Number(i.qty) || 1)
      const p = Math.max(0, Number(i.unitPrice) || 0)
      return { ...i, qty: q, unitPrice: p, total: q * p }
    })

    const totalAmt = sanitizedItems.reduce((sum, i) => sum + i.total, 0)
    const updatedSo: SalesOrder = {
      ...editingOrder,
      customerPhone: isWh1Order ? "" : editingCustPhone.trim(),
      items: sanitizedItems,
      amount: totalAmt,
      paymentType: editingPaymentType,
    }

    erp.updateSalesOrder(updatedSo)

    // Save/Upload staged files using unified synchronizer
    if (stagedTradePaperUrl && stagedTradePaperName) {
      try {
        await saveTradeLicense({
          customerId: matchedCust?.id,
          customerName: matchedCust?.name || editingOrder.customer,
          salesOrderId: editingOrder.id,
          fileName: stagedTradePaperName,
          fileUrl: stagedTradePaperUrl,
          documentType: isWh1Order ? "Bank Permit" : "Trade License",
          uploadedBy: "Sales Officer",
        })
      } catch (err) {
        console.error(`Failed uploading document:`, err)
      }
    }

    if (stagedPaymentAdviceUrl && stagedPaymentAdviceName) {
      try {
        await savePaymentAdvice({
          salesOrderId: editingOrder.id,
          fileName: stagedPaymentAdviceName,
          fileUrl: stagedPaymentAdviceUrl,
          uploadedBy: "Sales Officer",
        })
      } catch (err) {
        console.error("Failed uploading Payment Advice:", err)
      }
    }

    try {
      setIsSavingEditOrder(true)
      // Refresh attachments map for order
      const updatedDocs = await fetchDocumentsForRecord(editingOrder.id, "sales_order")
      setSoAttachmentsMap((prev) => ({ ...prev, [editingOrder.id]: updatedDocs }))

      setIsEditOrderOpen(false)
      setEditingOrder(null)
      showToast("Sales Order Updated", "success", `Sales Order contract ${updatedSo.id} updated successfully.`)
    } catch (err) {
      showToast("Update Error", "warning", "Failed to update sales order.")
    } finally {
      setIsSavingEditOrder(false)
    }
  }

  // Handle Create Sales Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetWh = newWarehouse || (warehouses[0]?.code || "WH1")
    const isWh1Order = isWH1(targetWh)

    let finalCustName = customerSearchInput.trim()
    if (!finalCustName && newCustomerId) {
      const found = customers.find((c) => c.id === newCustomerId)
      if (found) finalCustName = found.name
    }

    let selectedCust = customers.find(
      (c) => (c.name || "").toLowerCase() === finalCustName.toLowerCase() || c.id === newCustomerId
    )

    const errors: Record<string, string> = {}
    if (!finalCustName) {
      errors.customer = "Customer selection or customer name is required."
    }

    if (!isWh1Order && !custPhone.trim()) {
      errors.phone = "Customer phone number is required for WH2/WH3 orders."
    }

    if (selectedCust) {
      const evaluation = getTradeLicenseStatus(selectedCust, targetWh)
      if (evaluation.status !== "valid" && (!stagedTradePaperUrl || !stagedTradePaperName)) {
        errors.tradePaper = isWh1Order 
          ? "Customer Bank Permit file is required before submitting this order." 
          : "An active (unexpired) Trade License file is required before submitting this order."
      }
    } else if (!stagedTradePaperUrl || !stagedTradePaperName) {
      errors.tradePaper = isWh1Order 
        ? "Customer Bank Permit file is required for new customer orders." 
        : "Trade License file is required for new customer orders."
    }

    if (newPaymentType === "Cash" && (!stagedPaymentAdviceUrl || !stagedPaymentAdviceName)) {
      errors.paymentAdvice = "Payment Advice (bank deposit receipt) is mandatory for Cash orders."
    }

    if (orderItems.length === 0) {
      errors.items = "Please add at least one line item."
    } else {
      const hasInvalidItem = orderItems.some((i) => !i.productId || Number(i.qty) <= 0)
      if (hasInvalidItem) {
        errors.items = "All line items must have a selected product and quantity greater than 0."
      }
    }

    if (Object.keys(errors).length > 0) {
      setCreateFormErrors(errors)
      return
    }
    setCreateFormErrors({})
    setIsSubmittingOrder(true)

    try {
      if (selectedCust && (stagedTradePaperUrl !== (selectedCust.tradePaperUrl || "") || stagedTradePaperName !== (selectedCust.tradePaperFileName || ""))) {
        erp.updateCustomer(selectedCust.id, {
          tradePaperFileName: stagedTradePaperName || selectedCust.tradePaperFileName,
          tradePaperUrl: stagedTradePaperUrl || selectedCust.tradePaperUrl,
          tradePaperUploadedAt: new Date().toISOString(),
        })
      }

    if (!selectedCust) {
      const newCustId = `CUST-${Date.now().toString().slice(-4)}`
      selectedCust = {
        id: newCustId,
        name: finalCustName,
        country: "Ethiopia",
        region: "Addis Ababa",
        contactPerson: finalCustName,
        phone: isWh1Order ? "" : custPhone.trim(),
        email: custEmail.trim() || `${finalCustName.toLowerCase().replace(/\s+/g, "")}@example.com`,
        address: custAddress.trim() || "Addis Ababa, Ethiopia",
        category: isWh1Order ? "Commodities Exporter / Union" : "Pharmaceutical Distributor",
        tradePaperFileName: stagedTradePaperName || (isWh1Order ? "Bank Permit.pdf" : "Trade License.pdf"),
        tradePaperUrl: stagedTradePaperUrl,
        tradePaperUploadedAt: new Date().toISOString(),
      }
      erp.addCustomer(selectedCust)
    }

    const soId = `SO-${Date.now().toString().slice(-6)}`
    const finalItems = orderItems.map((i) => ({
      ...i,
      total: i.qty * i.unitPrice,
    }))
    const totalAmt = finalItems.reduce((sum, i) => sum + i.total, 0)

    const wh = warehouses.find((w) => w.code === targetWh || w.id === targetWh)

    const newSo: SalesOrder = {
      id: soId,
      customerId: selectedCust.id,
      customer: selectedCust.name,
      customerPhone: isWh1Order ? "" : custPhone.trim(),
      customerGroup: selectedCust.category,
      warehouse: targetWh,
      warehouseName: wh ? `${wh.code} - ${wh.name}` : targetWh,
      date: new Date().toISOString().split("T")[0],
      amount: totalAmt,
      currency: "ETB",
      stage: "Quote",
      desc: newDesc || `Sales Order contract for ${selectedCust.name}`,
      initials: selectedCust.name.slice(0, 2).toUpperCase(),
      label: selectedCust.contactPerson || selectedCust.name,
      avatarBg: "bg-emerald-100 text-emerald-800",
      urgent: false,
      attachment: true,
      items: finalItems,
      deliveredAmount: 0,
      billedAmount: 0,
      deliveryStatus: "Not Delivered",
      billingStatus: "Not Billed",
      paymentTerms,
      paymentType: newPaymentType,
    }

    // Persist Trade License / Bank Permit and Payment Advice via unified tradeDocumentService
    const activeTradeName = stagedTradePaperName || selectedCust.tradePaperFileName || (isWh1Order ? "Bank Permit.pdf" : "Trade License.pdf")
    const activeTradeUrl = stagedTradePaperUrl || selectedCust.tradePaperUrl || ""

    if (activeTradeUrl && activeTradeName) {
      try {
        await saveTradeLicense({
          customerId: selectedCust.id,
          customerName: selectedCust.name,
          salesOrderId: soId,
          fileName: activeTradeName,
          fileUrl: activeTradeUrl,
          documentType: isWh1Order ? "Bank Permit" : "Trade License",
          uploadedBy: "Sales Officer",
        })
      } catch (err) {
        console.error(`Failed uploading ${isWh1Order ? "Bank Permit" : "Trade License"}:`, err)
      }
    }

    if (stagedPaymentAdviceUrl && stagedPaymentAdviceName) {
      try {
        await savePaymentAdvice({
          salesOrderId: soId,
          fileName: stagedPaymentAdviceName,
          fileUrl: stagedPaymentAdviceUrl,
          uploadedBy: "Sales Officer",
        })
      } catch (err) {
        console.error("Failed uploading Payment Advice:", err)
      }
    }

    const docs = await fetchDocumentsForRecord(soId, "sales_order")
    setSoAttachmentsMap((prev) => ({ ...prev, [soId]: docs }))

    erp.addSalesOrder(newSo)

    showToast("Sales Order Created", "success", `Contract ${newSo.id} created under Quote stage for ${selectedCust.name}.`)
    setIsNewOrderOpen(false)
    setNewDesc("")
    setCustomerSearchInput("")
    setNewCustomerId("")
    setStagedTradePaperName("")
    setStagedTradePaperUrl("")
    setStagedPaymentAdviceName("")
    setStagedPaymentAdviceUrl("")
  } catch (err) {
    showToast("Create Error", "warning", "Failed to create sales order.")
  } finally {
    setIsSubmittingOrder(false)
  }
  }

  // Handle Create Quotation
  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingQuotation) return
    const selectedCust = customers.find((c) => c.id === quoteCustomerId)
    if (!selectedCust || !quoteWarehouse || !quoteValidDays) {
      showToast("Validation Error", "warning", "Please select a customer, warehouse, and valid-until period.")
      return
    }

    const defaultItemProduct = products[0] || { id: "PRD-001", name: "Amoxicillin 500mg", sku: "AMX-500", valuationRate: 150 }
    const finalItems: SalesOrderItem[] = quoteItems.length > 0 ? quoteItems : [
      {
        productId: defaultItemProduct.id,
        name: defaultItemProduct.name,
        qty: 100,
        unit: "Pcs",
        unitPrice: defaultItemProduct.valuationRate || 150,
        total: (defaultItemProduct.valuationRate || 150) * 100,
      }
    ]

    const totalAmt = finalItems.reduce((sum, item) => sum + item.total, 0)
    const wh = warehouses.find((w) => w.code === quoteWarehouse)
    const validTillDate = new Date()
    validTillDate.setDate(validTillDate.getDate() + Number(quoteValidDays))

    const newQt: Quotation = {
      id: `QT-${Date.now().toString().slice(-4)}`,
      customer: selectedCust.name,
      customerId: selectedCust.id,
      customerGroup: selectedCust.category,
      warehouse: quoteWarehouse,
      warehouseName: wh ? `${wh.code} - ${wh.name}` : quoteWarehouse,
      date: new Date().toISOString().split("T")[0],
      validTill: validTillDate.toISOString().split("T")[0],
      amount: totalAmt,
      currency: "ETB",
      status: "Draft",
      desc: quoteDesc || `Pro-forma Quotation for ${selectedCust.name}`,
      paymentTerms,
      items: finalItems,
    }

    try {
      setIsSubmittingQuotation(true)
      erp.addQuotation(newQt)
      showToast("Quotation Generated", "success", `Pro-Forma ${newQt.id} created for ${selectedCust.name}.`)
      setIsNewQuotationOpen(false)
      setQuoteDesc("")
    } catch (err) {
      showToast("Quotation Error", "warning", "Failed to generate quotation.")
    } finally {
      setIsSubmittingQuotation(false)
    }
  }

  // Confirm Sales Invoice Creation
  const handleConfirmInvoice = () => {
    if (!selectedOrder) return

    const res = erp.createSalesInvoiceForSalesOrder(selectedOrder.id, selectedTaxScheduleId, paymentTerms)
    if (res.success && res.invoiceId) {
      showToast(
        "Sales Invoice Generated",
        "success",
        `Invoice ${res.invoiceId} created with multi-tax automation! Net due: ETB ${orderTaxCalc.netTotal.toLocaleString()}.`
      )
      setIsInvoiceModalOpen(false)
      const updated = erp.getSalesOrderById(selectedOrder.id)
      if (updated) setSelectedOrder(updated)
    } else {
      showToast("Billing Error", "warning", res.error || "Could not generate Sales Invoice.")
    }
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={fade} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Top Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-black tracking-tight">Sales Orders & Contracts</h1>
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Manage sales contracts, fulfillment, and invoicing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("/sales")} />
          </div>
        </div>

        {/* SALES ORDERS REGISTER */}
        <DataTable
          title="Sales Orders Register"
          subtitle={`Total: ${filteredOrders.length} sales contracts`}
          columns={salesOrderColumns}
          data={filteredOrders}
          isLoading={isLoading || !soAttachmentsLoaded}
          searchQuery={soSearch}
          onSearchChange={setSoSearch}
          searchPlaceholder="Search order ID, client..."
          filters={[
            {
              value: soWhFilter,
              onChange: setSoWhFilter,
              ariaLabel: "Filter by Warehouse",
              options: [{ value: "ALL", label: "All Warehouses" }, ...warehouseOptions],
            },
            {
              value: soApprovalFilter,
              onChange: setSoApprovalFilter,
              ariaLabel: "Filter by Approval Status",
              options: [
                { value: "ALL", label: "All Approvals" },
                { value: "Pending", label: "Pending Approval" },
                { value: "Approved", label: "Approved" },
                { value: "Declined", label: "Declined" },
              ],
            },
          ]}
          actions={[
            {
              label: "New Order",
              onClick: handleOpenNewOrderModal,
              icon: <Plus className="size-4" />,
              variant: "primary",
            },
          ]}
          defaultWidths={{
            id: 110,
            customer: 220,
            warehouse: 100,
            paymentType: 120,
            approvalStatus: 140,
            docsStatus: 170,
            amount: 140,
            _actions: 110,
          }}
          keyExtractor={(so) => so.id}
          renderRow={(so, colWidths) => (
            <>
              <td style={{ width: `${colWidths.id}px` }} className="py-4 px-6 overflow-hidden">
                <div className="flex flex-col">
                  <span className="font-black text-zinc-950 text-xs tracking-tight leading-tight mb-0.5 truncate font-mono">
                    {so.id}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase">
                    {so.date}
                  </span>
                </div>
              </td>

              <td style={{ width: `${colWidths.customer}px` }} className="py-4 px-4 overflow-hidden">
                <div className="flex flex-col">
                  <span className="font-black text-zinc-950 text-xs tracking-tight leading-tight mb-0.5 truncate">
                    {so.customer}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-bold tracking-tight truncate">
                    {so.customerPhone ? `📞 ${so.customerPhone} • ` : ""}{so.customerGroup || "Client"}
                  </span>
                </div>
              </td>

              <td style={{ width: `${colWidths.warehouse}px` }} className="py-4 px-4 overflow-hidden">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tight bg-zinc-100 border border-zinc-200/50 px-2 py-0.5 rounded-full inline-block truncate max-w-full">
                  {so.warehouse}
                </span>
              </td>

              <td style={{ width: `${colWidths.paymentType}px` }} className="py-4 px-4 overflow-hidden">
                {(() => {
                  const isCredit = so.paymentType === "Credit"
                  if (!isCredit) {
                    return (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Cash
                      </span>
                    )
                  }
                  const totalAmt = Number(so.amount || 0)
                  const paidAmt = Number(so.paidAmount || 0)
                  const dueAmt = Number(so.remainingBalance ?? Math.max(0, totalAmt - paidAmt))
                  const pct = totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0

                  if (dueAmt <= 0 && paidAmt > 0) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Credit • Settled
                      </span>
                    )
                  }
                  if (paidAmt > 0) {
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200 self-start">
                          Credit • Ongoing ({pct}%)
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Paid: ETB {paidAmt.toLocaleString()}
                        </span>
                      </div>
                    )
                  }
                  return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-100 text-zinc-800 border border-zinc-200">
                      Credit (Unpaid)
                    </span>
                  )
                })()}
              </td>

              {/* Approval Status */}
              <td style={{ width: `${colWidths.approvalStatus}px` }} className="py-4 px-4 text-center overflow-hidden">
                {(() => {
                  const status = so.approvalStatus || "Pending"
                  if (status === "Approved") {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200" title={so.approvedBy ? `Approved by ${so.approvedBy}` : "Approved by Super Admin"}>
                        <CheckCircle2 className="size-3 text-emerald-600" /> Approved
                      </span>
                    )
                  }
                  if (status === "Declined") {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-200" title={so.declineReason || "Declined by Super Admin"}>
                        <X className="size-3 text-rose-600" /> Declined
                      </span>
                    )
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      <Clock className="size-3 text-amber-600" /> Pending Approval
                    </span>
                  )
                })()}
              </td>

              <td style={{ width: `${colWidths.docsStatus}px` }} className="py-4 px-4 overflow-hidden">
                {(() => {
                  const docs = soAttachmentsMap[so.id] || []
                  const cust = customers.find((c) => c.id === so.customerId || c.name === so.customer)
                  const isWh1 = isWH1(so.warehouse)
                  const docName = isWh1 ? "Bank Permit" : "Trade License"
                  const hasTrade = docs.some((d) => d.document_type === "Bank Permit" || d.document_type === "Trade License" || d.document_type === "Trade Paper") || !!cust?.tradePaperUrl
                  const hasAdvice = docs.some((d) => d.document_type === "Payment Advice")
                  const isCredit = so.paymentType === "Credit"

                  if (isCredit) {
                    if (hasTrade) {
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="size-3 text-emerald-600" /> Docs Complete
                        </span>
                      )
                    }
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        <AlertTriangle className="size-3 text-amber-600" /> {docName} Missing
                      </span>
                    )
                  }

                  // Cash sale (default)
                  if (hasTrade && hasAdvice) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Docs Complete
                      </span>
                    )
                  }
                  if (!hasTrade && !hasAdvice) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        <AlertTriangle className="size-3 text-amber-600" /> {docName} & Advice Missing
                      </span>
                    )
                  }
                  if (!hasAdvice) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        <AlertTriangle className="size-3 text-amber-600" /> Payment Advice Missing
                      </span>
                    )
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      <AlertTriangle className="size-3 text-amber-600" /> {docName} Missing
                    </span>
                  )
                })()}
              </td>

              <td style={{ width: `${colWidths.amount}px` }} className="py-4 px-4 text-right font-mono text-xs overflow-hidden">
                <div className="font-black text-zinc-950">ETB {so.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                <div className="mt-0.5 text-[9px] font-bold uppercase text-zinc-400">{so.items?.length || 0} items</div>
              </td>

              <td style={{ width: `${colWidths._actions}px` }} className="py-4 px-4 text-center whitespace-nowrap overflow-hidden">
                <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => handleOpenEditModal(so)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs"
                    title="Edit Sales Order"
                  >
                    <Pencil className="size-3 text-zinc-700" /> Edit
                  </button>
                </div>
              </td>
            </>
          )}
        />
      </motion.div>

      {/* MODAL: GENERATE SALES INVOICE */}
      <AnimatePresence>
        {isInvoiceModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <h2 className="text-xl font-black text-zinc-950 mb-1">Generate Sales Invoice</h2>
              <p className="text-xs font-semibold text-zinc-500 mb-4">
                Creates an Accounts Receivable invoice in Finance for customer <span className="font-bold text-zinc-800">{selectedOrder.customer}</span>.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-700">Tax Schedule / Multi-Tax Profile</label>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ⚡ Auto-Determined
                    </span>
                  </div>
                  <select
                    value={selectedTaxScheduleId}
                    onChange={(e) => setSelectedTaxScheduleId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                  >
                    {taxSchedules.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name} ({sch.appliesTo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Terms</label>
                  <select 
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Payment on Delivery">Payment on Delivery</option>
                  </select>
                </div>

                {/* Dynamic Multi-Tax Breakdown Card */}
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 font-mono text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-sans">Contract Subtotal:</span>
                    <span className="font-bold">ETB {orderTaxCalc.subtotal.toLocaleString()}</span>
                  </div>
                  {orderTaxCalc.taxLines.map((tl: any) => (
                    <div key={tl.ruleId} className="flex justify-between text-[11px]">
                      <span className="text-zinc-500 font-sans">
                        {tl.isDeduction ? "–" : "+"} {tl.ruleName} ({tl.ratePercent}%):
                      </span>
                      <span className={`font-bold ${tl.isDeduction ? "text-amber-700" : "text-blue-700"}`}>
                        {tl.isDeduction ? "-ETB " : "+ETB "}
                        {tl.taxAmount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 border-t border-zinc-200 font-black text-sm">
                    <span className="font-sans">Net Invoiced / Due:</span>
                    <span className="text-emerald-700">ETB {orderTaxCalc.netTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmInvoice}
                  className="px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 shadow-md"
                >
                  Generate Sales Invoice
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: NEW SALES ORDER */}
      <AnimatePresence>
        {isNewOrderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop: Click outside to close */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewOrderOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 bg-white rounded-3xl p-6 max-w-5xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[90vh]"
            >
              {/* Header with Close X Button */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-950 mb-0.5">Create HKC Sales Contract</h2>
                  <p className="text-xs font-semibold text-zinc-500">Draft a new sales contract with item quantities, packaging units, and prices.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewOrderOpen(false)}
                  className="rounded-xl border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                  title="Close modal"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-4 relative" ref={customerComboboxRef}>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Customer / Union Name *</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Search or enter customer..."
                        value={customerSearchInput}
                        onChange={(e) => {
                          setCustomerSearchInput(e.target.value)
                          setShowCustomerDropdown(true)
                          setCreateFormErrors((prev) => {
                            const next = { ...prev }
                            delete next.customer
                            return next
                          })
                          const match = customers.find((c) => (c.name || "").toLowerCase() === e.target.value.toLowerCase())
                          if (match) {
                            setNewCustomerId(match.id)
                            setCustPhone(match.phone || "")
                            setCustEmail(match.email || "")
                            setCustAddress(match.address || "")
                            const evaluation = getTradeLicenseStatus(match)
                            if (evaluation.status === "valid" && match.tradePaperFileName && match.tradePaperUrl) {
                              setStagedTradePaperName(match.tradePaperFileName)
                              setStagedTradePaperUrl(match.tradePaperUrl)
                            } else {
                              setStagedTradePaperName("")
                              setStagedTradePaperUrl("")
                            }
                          } else {
                            setNewCustomerId("")
                            setStagedTradePaperName("")
                            setStagedTradePaperUrl("")
                          }
                        }}
                        className={`w-full pl-3 pr-16 py-2 rounded-xl text-xs font-bold outline-none transition-colors ${
                          createFormErrors.customer ? "bg-rose-50 border border-rose-400 text-rose-900" : "bg-zinc-50 border border-zinc-200"
                        }`}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {customerSearchInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerSearchInput("")
                              setNewCustomerId("")
                              setCustPhone("")
                              setCustEmail("")
                              setCustAddress("")
                              setStagedTradePaperName("")
                              setStagedTradePaperUrl("")
                              setShowCustomerDropdown(false)
                              setCreateFormErrors((prev) => {
                                const next = { ...prev }
                                delete next.customer
                                delete next.phone
                                delete next.tradePaper
                                return next
                              })
                            }}
                            className="text-zinc-400 hover:text-zinc-700 p-0.5"
                            title="Clear input"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                          className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded hover:bg-zinc-200/60"
                        >
                          {showCustomerDropdown ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                    {createFormErrors.customer && (
                      <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                        ⚠️ {createFormErrors.customer}
                      </span>
                    )}

                    {showCustomerDropdown && customers.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-2xl border border-zinc-200 shadow-xl max-h-48 overflow-y-auto divide-y divide-zinc-100">
                        {customers
                          .filter((c) => (c.name || "").toLowerCase().includes(customerSearchInput.toLowerCase()))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setNewCustomerId(c.id)
                                setCustomerSearchInput(c.name)
                                setCustPhone(c.phone || "")
                                setCustEmail(c.email || "")
                                setCustAddress(c.address || "")
                                setCreateFormErrors((prev) => {
                                  const next = { ...prev }
                                  delete next.customer
                                  delete next.phone
                                  return next
                                })
                                const evaluation = getTradeLicenseStatus(c)
                                if (evaluation.status === "valid" && c.tradePaperFileName && c.tradePaperUrl) {
                                  setStagedTradePaperName(c.tradePaperFileName)
                                  setStagedTradePaperUrl(c.tradePaperUrl)
                                } else {
                                  setStagedTradePaperName("")
                                  setStagedTradePaperUrl("")
                                }
                                setShowCustomerDropdown(false)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-zinc-900 block">{c.name}</span>
                                <span className="text-[10px] text-zinc-500 font-medium">
                                  {c.phone ? `📞 ${c.phone} • ` : ""}{c.category || "General Client"}
                                </span>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  {(() => {
                    const isWh1Order = isWH1(newWarehouse)
                    return (
                      <>
                        {!isWh1Order && (
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">Customer Phone *</label>
                            <div className="relative flex items-center">
                              <Phone className="size-3.5 text-zinc-400 absolute left-3" />
                              <input
                                type="text"
                                required
                                placeholder="+251 91 123 4567"
                                value={custPhone}
                                onChange={(e) => {
                                  setCustPhone(e.target.value)
                                  setCreateFormErrors((prev) => {
                                    const next = { ...prev }
                                    delete next.phone
                                    return next
                                  })
                                }}
                                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold outline-none transition-colors ${
                                  createFormErrors.phone ? "bg-rose-50 border border-rose-400 text-rose-900" : "bg-zinc-50 border border-zinc-200"
                                }`}
                              />
                            </div>
                            {createFormErrors.phone && (
                              <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                                ⚠️ {createFormErrors.phone}
                              </span>
                            )}
                          </div>
                        )}

                        <div className={isWh1Order ? "md:col-span-3" : "md:col-span-2"}>
                          <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Method *</label>
                          <select
                            value={newPaymentType}
                            onChange={(e) => setNewPaymentType(e.target.value as "Cash" | "Credit")}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="Credit">Credit</option>
                            <option value="Cash">Cash</option>
                          </select>
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-xs font-bold text-zinc-700 mb-1">
                            Fulfillment Warehouse *
                          </label>
                          <select 
                            value={newWarehouse}
                            onChange={(e) => handleWarehouseChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="">Select warehouse</option>
                            {warehouseOptions.map((warehouse) => (
                              <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {!customers.some((c) => c.id === newCustomerId) && customerSearchInput.trim() !== "" && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveCustomerCheck"
                      checked={saveCustomerToRegistry}
                      onChange={(e) => setSaveCustomerToRegistry(e.target.checked)}
                      className="size-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                    />
                    <label htmlFor="saveCustomerCheck" className="text-xs font-bold text-emerald-950 cursor-pointer">
                      Save new customer details & {isWH1(newWarehouse) ? "Bank Permit" : "Trade License"} to registry for future orders
                    </label>
                  </div>
                )}

                <div className="w-full">
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Contract Description</label>
                  <textarea 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    placeholder="Enter sales contract terms or description..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold outline-none resize-none" 
                  />
                </div>

                {(() => {
                  const isWh1Order = isWH1(newWarehouse)
                  const selectedCust = customers.find(c => c.id === newCustomerId)
                  if (selectedCust) {
                    const evaluation = getTradeLicenseStatus(selectedCust, newWarehouse)
                    if (evaluation.status !== "valid" && (!stagedTradePaperUrl || !stagedTradePaperName)) {
                      return (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 mb-3">
                          <AlertTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-black uppercase tracking-wider block">
                              Warning: {isWh1Order ? "Bank Permit Missing" : "Trade License Missing or Expired"}
                            </span>
                            <span className="text-[11px] block mt-0.5 leading-normal">
                              {isWh1Order
                                ? "This customer does not have an attached Bank Permit on file. Please attach a Bank Permit file to proceed."
                                : "This customer's trade license has expired (exceeded 6 months) or is missing. You must upload a new trade license to create this sales order."
                              }
                            </span>
                          </div>
                        </div>
                      )
                    }
                  }
                  return null
                })()}

                {/* Minimalistic Required Document Attachments Section */}
                {(() => {
                  const isWh1Order = isWH1(newWarehouse)
                  const docLabel = isWh1Order ? "Bank Permit" : "Trade License / Business Permit"
                  return (
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block">
                            {isWh1Order ? "Required Bank Permit" : "Required Order Documentation"}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium block">
                            {isWh1Order
                              ? (newPaymentType === "Cash"
                                  ? "Attach mandatory Bank Permit and Payment Advice receipt for this cash commodity order"
                                  : "Attach Bank Permit for this export credit order (Payment Advice not needed on credit)")
                              : (newPaymentType === "Cash"
                                  ? "Upload Trade License and Payment Advice (deposit receipt / bank slip) for Cash orders"
                                  : "Upload Trade License (Payment Advice is optional for credit sales)")
                            }
                          </span>
                        </div>
                      </div>

                      <div className={`grid gap-3 ${newPaymentType === "Cash" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                        {/* Trade License / Bank Permit Dropzone */}
                        <div className={`p-3 rounded-xl border shadow-sm space-y-1.5 transition-colors ${
                          createFormErrors.tradePaper 
                            ? "bg-rose-50/40 border-rose-400" 
                            : "bg-white border-zinc-200"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                              <FileText className="size-3.5 text-emerald-600" /> {docLabel}
                            </span>
                            {(() => {
                              const selectedCust = customers.find(c => c.name === customerSearchInput || c.id === newCustomerId)
                              const evaluation = selectedCust ? getTradeLicenseStatus(selectedCust, newWarehouse) : { status: "missing", daysRemaining: 0, isPermanent: isWh1Order, docType: isWh1Order ? "Bank Permit" : "Trade License" }

                              if (isNewlyUploadedTradeLicense && stagedTradePaperName) {
                                return (
                                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 className="size-3 text-emerald-600" /> Valid & Attached (New)
                                  </span>
                                )
                              }

                              if (isWh1Order && (stagedTradePaperName || selectedCust?.tradePaperFileName)) {
                                return (
                                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 className="size-3 text-emerald-600" /> Bank Permit Attached (Permanent)
                                  </span>
                                )
                              }

                              if (evaluation.status === "expired" && stagedTradePaperName) {
                                return (
                                  <span className="text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <AlertTriangle className="size-3 text-rose-600" /> Expired Permit
                                  </span>
                                )
                              }

                              if (evaluation.status === "valid" && stagedTradePaperName) {
                                return (
                                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 className="size-3 text-emerald-600" /> Valid ({evaluation.daysRemaining}d left)
                                  </span>
                                )
                              }

                              if (!stagedTradePaperName) {
                                return (
                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Required
                                  </span>
                                )
                              }

                              return (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                  Pre-attached
                                </span>
                              )
                            })()}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <label className="cursor-pointer px-3 py-1 rounded-lg bg-zinc-900 text-white font-bold text-[11px] hover:bg-zinc-800 flex items-center gap-1 shrink-0">
                              <FileCheck className="size-3" /> Select File
                              <input
                                type="file"
                                className="hidden"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0]
                                  if (f) {
                                    try {
                                      const res = await uploadFile(f, "sales_orders")
                                      setStagedTradePaperName(res.originalName)
                                      setStagedTradePaperUrl(res.url)
                                      setIsNewlyUploadedTradeLicense(true)
                                      setCreateFormErrors((prev) => {
                                        const next = { ...prev }
                                        delete next.tradePaper
                                        return next
                                      })
                                    } catch (err: any) {
                                      showToast("Upload Error", "warning", err.message || "Failed to upload file")
                                    }
                                  }
                                }}
                              />
                            </label>
                            <span className="text-[11px] font-mono text-zinc-600 truncate flex-1">{stagedTradePaperName || "No file attached"}</span>
                            {stagedTradePaperUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewUrl(stagedTradePaperUrl)
                                  setPreviewName(stagedTradePaperName || docLabel)
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                View Doc <ExternalLink className="size-3" />
                              </button>
                            )}
                          </div>
                          {createFormErrors.tradePaper && (
                            <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                              ⚠️ {createFormErrors.tradePaper}
                            </span>
                          )}
                        </div>

                        {/* Payment Advice Dropzone */}
                        {newPaymentType === "Cash" && (
                          <div className={`p-3 rounded-xl border shadow-sm space-y-1.5 transition-colors ${
                            createFormErrors.paymentAdvice 
                              ? "bg-rose-50/40 border-rose-400" 
                              : "bg-white border-zinc-200"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-emerald-600" /> Payment Advice Receipt
                              </span>
                              {stagedPaymentAdviceName ? (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Attached</span>
                              ) : (
                                <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Required for Cash</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <label className="cursor-pointer px-3 py-1 rounded-lg bg-zinc-900 text-white font-bold text-[11px] hover:bg-zinc-800 flex items-center gap-1 shrink-0">
                                <FileCheck className="size-3" /> Select Advice File
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const f = e.target.files?.[0]
                                    if (f) {
                                      try {
                                        const res = await uploadFile(f, "sales_orders")
                                        setStagedPaymentAdviceName(res.originalName)
                                        setStagedPaymentAdviceUrl(res.url)
                                        setCreateFormErrors((prev) => {
                                          const next = { ...prev }
                                          delete next.paymentAdvice
                                          return next
                                        })
                                      } catch (err: any) {
                                        showToast("Upload Error", "warning", err.message || "Failed to upload file")
                                      }
                                    }
                                  }}
                                />
                              </label>
                              <span className="text-[11px] font-mono text-zinc-600 truncate flex-1">
                                {stagedPaymentAdviceName || "No receipt attached"}
                              </span>
                              {stagedPaymentAdviceUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewUrl(stagedPaymentAdviceUrl)
                                    setPreviewName(stagedPaymentAdviceName || "Payment Advice")
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md inline-flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  View Doc <ExternalLink className="size-3" />
                                </button>
                              )}
                            </div>
                            {createFormErrors.paymentAdvice && (
                              <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                                ⚠️ {createFormErrors.paymentAdvice}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Line Items Table */}
                {(() => {
                  const isWh1Order = isWH1(newWarehouse)
                  const availableUnits = isWh1Order ? COMMODITY_UNITS : CONTAINER_UNITS
                  return (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <label className="block text-xs font-black uppercase text-zinc-900 tracking-wide">
                            Contract Line Items ({isWh1Order ? "Commodities in Quintals / Tons" : "Products & Quantities"})
                          </label>
                          {createFormErrors.items && (
                            <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                              ⚠️ {createFormErrors.items}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleAddOrderItemRow(false)
                            setCreateFormErrors((prev) => {
                              const next = { ...prev }
                              delete next.items
                              return next
                            })
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 transition-colors"
                        >
                          <Plus className="size-3" /> Add Item Row
                        </button>
                      </div>

                      <div className={`border rounded-2xl overflow-hidden text-xs transition-colors ${
                        createFormErrors.items ? "border-rose-400 bg-rose-50/10" : "border-zinc-200"
                      }`}>
                        <table className="w-full text-left">
                          <thead className="bg-zinc-100 text-zinc-600 font-bold uppercase text-[9px]">
                            <tr>
                              <th className="px-3 py-2 w-[35%]">Product Item</th>
                              <th className="px-3 py-2 w-[18%] text-center">Qty</th>
                              <th className="px-3 py-2 w-[20%] text-center">Unit</th>
                              <th className="px-3 py-2 w-[20%] text-right">Unit Price</th>
                              <th className="px-3 py-2 w-[7%] text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {orderItems.map((item, index) => {
                              const p = products.find((prod) => prod.id === item.productId)
                              const avail = p ? (newWarehouse && newWarehouse !== "ALL" ? (p.stockBreakdown?.find((sb) => sb.warehouse === newWarehouse)?.qty ?? p.quantity) : p.quantity) : 0
                              const isOver = item.qty > avail
                              return (
                                <tr key={index}>
                                  <td className="p-2">
                                    {(() => {
                                      const scopedProducts = getProductsForWarehouse(newWarehouse)
                                      return (
                                        <select
                                          disabled={!newWarehouse}
                                          value={item.productId}
                                          onChange={(e) => handleOrderItemChange(index, "productId", e.target.value, false)}
                                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-bold disabled:cursor-not-allowed disabled:bg-zinc-100"
                                        >
                                          <option value="">{newWarehouse ? "Select item" : "Select warehouse first"}</option>
                                          {scopedProducts.map((prod) => (
                                            <option key={prod.id} value={prod.id}>{prod.name}</option>
                                          ))}
                                        </select>
                                      )
                                    })()}
                                    <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                                      <span className="text-zinc-500 font-bold">Store Available: <span className="font-mono font-black text-zinc-900">{avail}{isWh1Order ? ` ${item.unit}` : ""}</span></span>
                                      {isOver && (
                                        <span className="flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md mt-0.5">
                                          <AlertTriangle className="size-3 text-amber-600 shrink-0" />
                                          <span>Insufficient Stock ({item.qty} &gt; {avail})</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2 align-top">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.qty === 0 ? "" : item.qty}
                                      onChange={(e) => handleOrderItemChange(index, "qty", e.target.value, false)}
                                      className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-bold text-center"
                                    />
                                  </td>
                                  <td className="p-2 align-top">
                                    <select
                                      value={item.unit}
                                      onChange={(e) => handleOrderItemChange(index, "unit", e.target.value, false)}
                                      className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-bold"
                                    >
                                      {availableUnits.map((u) => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-2 align-top text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.unitPrice === 0 ? "" : item.unitPrice}
                                      onChange={(e) => handleOrderItemChange(index, "unitPrice", e.target.value, false)}
                                      className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-bold text-right"
                                    />
                                  </td>
                                  <td className="p-2 align-top text-center">
                                    <button
                                      type="button"
                                      disabled={orderItems.length === 1}
                                      onClick={() => handleRemoveOrderItemRow(index, false)}
                                      className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:text-zinc-400"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                <div className="mt-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 font-mono text-xs flex justify-between items-center">
                  <span className="text-zinc-500 font-sans font-bold">Total Contract Amount:</span>
                  <span className="font-black text-sm text-emerald-800">
                    ETB {orderItems.reduce((sum, i) => sum + i.total, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {Object.keys(createFormErrors).length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold space-y-1.5 animate-in fade-in-50">
                    <div className="flex items-center gap-1.5 font-black text-rose-700 uppercase tracking-wider text-[11px]">
                      <AlertCircle className="size-4 shrink-0 text-rose-600" />
                      Please complete the required items before creating contract:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800 font-medium pl-1">
                      {Object.values(createFormErrors).map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                  <button 
                    type="button" 
                    disabled={isSubmittingOrder}
                    onClick={() => setIsNewOrderOpen(false)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingOrder}
                    className="min-w-[130px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmittingOrder ? <LoadingDots color="bg-white" size="sm" /> : "Create Contract"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT SALES ORDER */}
      <AnimatePresence>
        {isEditOrderOpen && editingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop: Click outside to close */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditOrderOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 bg-white rounded-3xl p-6 max-w-5xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[90vh]"
            >
      <EditModalHeader
        title={`Edit Sales Order (${editingOrder.id})`}
        subtitle="Update contract terms, customer details, products, and required order documentation."
        onClose={() => setIsEditOrderOpen(false)}
        onRequestDelete={() => setDeletingOrder(editingOrder)}
        deleteLabel="Delete Sales Order"
      />

      <form onSubmit={handleSaveEditOrder} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-zinc-700 mb-1">Customer / Union Name *</label>
            <select 
              value={editingOrder.customerId}
              onChange={(e) => {
                const cust = customers.find((c) => c.id === e.target.value)
                setEditingOrder({
                  ...editingOrder,
                  customerId: e.target.value,
                  customer: cust ? cust.name : editingOrder.customer,
                })
                if (cust) {
                  setEditingCustPhone(cust.phone || editingCustPhone)
                }
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {(() => {
            const isWh1Editing = isWH1(editingOrder.warehouse)
            return (
              <>
                {!isWh1Editing && (
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Customer Phone *</label>
                    <div className="relative flex items-center">
                      <Phone className="size-3.5 text-zinc-400 absolute left-3" />
                      <input
                        type="text"
                        required
                        value={editingCustPhone}
                        onChange={(e) => {
                          setEditingCustPhone(e.target.value)
                          setEditFormErrors((prev) => {
                            const next = { ...prev }
                            delete next.phone
                            return next
                          })
                        }}
                        className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold outline-none transition-colors ${
                          editFormErrors.phone ? "bg-rose-50 border border-rose-400 text-rose-900" : "bg-zinc-50 border border-zinc-200"
                        }`}
                      />
                    </div>
                    {editFormErrors.phone && (
                      <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                        ⚠️ {editFormErrors.phone}
                      </span>
                    )}
                  </div>
                )}

                <div className={isWh1Editing ? "md:col-span-3" : "md:col-span-2"}>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Method *</label>
                  <select
                    value={editingPaymentType}
                    onChange={(e) => setEditingPaymentType(e.target.value as "Cash" | "Credit")}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="Credit">Credit</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Fulfillment Warehouse</label>
                  <select 
                    value={editingOrder.warehouse}
                    onChange={(e) => handleWarehouseChange(e.target.value, true)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                  >
                    {warehouseOptions.map((warehouse) => (
                      <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )
          })()}
        </div>

        <div className="w-full">
          <label className="block text-xs font-bold text-zinc-700 mb-1">Contract Description</label>
          <textarea 
            value={editingOrder.desc}
            onChange={(e) => setEditingOrder({ ...editingOrder, desc: e.target.value })}
            rows={2}
            placeholder="Enter contract terms..."
            className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold outline-none resize-none" 
          />
        </div>

        {(() => {
          const isWh1Editing = isWH1(editingOrder.warehouse)
          const selectedCust = customers.find(c => c.id === editingOrder.customerId || c.name === editingOrder.customer)
          if (selectedCust) {
            const evaluation = getTradeLicenseStatus(selectedCust, editingOrder.warehouse)
            if (evaluation.status !== "valid" && (!stagedTradePaperUrl || !stagedTradePaperName)) {
              return (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 mb-3">
                  <AlertTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black uppercase tracking-wider block">
                      Warning: {isWh1Editing ? "Bank Permit Missing" : "Trade License Missing or Expired"}
                    </span>
                    <span className="text-[11px] block mt-0.5 leading-normal">
                      {isWh1Editing
                        ? "This customer does not have an attached Bank Permit on file. Please attach a Bank Permit file to update this order."
                        : "This customer's trade license has expired (exceeded 6 months) or is missing. You must upload a new trade license to update this sales order."
                      }
                    </span>
                  </div>
                </div>
              )
            }
          }
          return null
        })()}

        {(() => {
          const isWh1Editing = isWH1(editingOrder.warehouse)
          const docLabel = isWh1Editing ? "Bank Permit" : "Trade License / Business Permit"
          return (
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block">
                    {isWh1Editing ? "Required Bank Permit" : "Required Order Documentation"}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-medium block">
                    {editingPaymentType === "Cash"
                      ? (isWh1Editing 
                          ? "Payment Advice is mandatory when converting/settling a WH1 contract to Cash"
                          : "View attached files or upload missing Trade License and Payment Advice")
                      : (isWh1Editing
                          ? "Bank Permit is attached for this credit commodity order (Payment Advice is hidden)"
                          : "View attached Trade License (Payment Advice is optional for credit sales)")
                    }
                  </span>
                </div>
              </div>

              <div className={`grid gap-3 ${editingPaymentType === "Cash" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                <div className={`p-3 rounded-xl border shadow-sm space-y-1.5 transition-colors ${
                  editFormErrors.tradePaper 
                    ? "bg-rose-50/40 border-rose-400" 
                    : "bg-white border-zinc-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                      <FileText className="size-3.5 text-emerald-600" /> {docLabel}
                    </span>
                    {(() => {
                      const selectedCust = customers.find(c => c.id === editingOrder.customerId || c.name === editingOrder.customer)
                      const evaluation = selectedCust ? getTradeLicenseStatus(selectedCust, editingOrder.warehouse) : { status: "missing", daysRemaining: 0, isPermanent: isWh1Editing, docType: isWh1Editing ? "Bank Permit" : "Trade License" }

                      if (isNewlyUploadedTradeLicense && stagedTradePaperName) {
                        return (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3 text-emerald-600" /> Valid & Attached (New)
                          </span>
                        )
                      }

                      if (isWh1Editing && (stagedTradePaperName || selectedCust?.tradePaperFileName)) {
                        return (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3 text-emerald-600" /> Bank Permit Attached (Permanent)
                          </span>
                        )
                      }

                      if (evaluation.status === "expired" && stagedTradePaperName) {
                        return (
                          <span className="text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <AlertTriangle className="size-3 text-rose-600" /> Expired Permit
                          </span>
                        )
                      }

                      if (evaluation.status === "valid" && stagedTradePaperName) {
                        return (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3 text-emerald-600" /> Valid ({evaluation.daysRemaining}d left)
                          </span>
                        )
                      }

                      if (!stagedTradePaperName) {
                        return (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Required
                          </span>
                        )
                      }

                      return (
                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          Pre-attached
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer px-3 py-1 rounded-lg bg-zinc-900 text-white font-bold text-[11px] hover:bg-zinc-800 flex items-center gap-1 shrink-0">
                      <FileCheck className="size-3" /> Select File
                      <input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0]
                          if (f) {
                            try {
                              const res = await uploadFile(f, "sales_orders")
                              setStagedTradePaperName(res.originalName)
                              setStagedTradePaperUrl(res.url)
                              setIsNewlyUploadedTradeLicense(true)
                              setEditFormErrors((prev) => {
                                const next = { ...prev }
                                delete next.tradePaper
                                return next
                              })
                            } catch (err: any) {
                              showToast("Upload Error", "warning", err.message || "Failed to upload file")
                            }
                          }
                        }}
                      />
                    </label>
                    <span className="text-[11px] font-mono text-zinc-600 truncate flex-1">{stagedTradePaperName || "No file attached"}</span>
                    {stagedTradePaperUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewUrl(stagedTradePaperUrl)
                          setPreviewName(stagedTradePaperName || docLabel)
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        View Doc <ExternalLink className="size-3" />
                      </button>
                    )}
                  </div>
                  {editFormErrors.tradePaper && (
                    <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                      ⚠️ {editFormErrors.tradePaper}
                    </span>
                  )}
                </div>

                {editingPaymentType === "Cash" && (
                  <div className={`p-3 rounded-xl border shadow-sm space-y-1.5 transition-colors ${
                    editFormErrors.paymentAdvice 
                      ? "bg-rose-50/40 border-rose-400" 
                      : "bg-white border-zinc-200"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" /> Payment Advice Receipt
                      </span>
                      {stagedPaymentAdviceName ? (
                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Attached</span>
                      ) : (
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Required for Cash</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="cursor-pointer px-3 py-1 rounded-lg bg-zinc-900 text-white font-bold text-[11px] hover:bg-zinc-800 flex items-center gap-1 shrink-0">
                        <FileCheck className="size-3" /> Select Advice File
                        <input
                          type="file"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]
                            if (f) {
                              try {
                                const res = await uploadFile(f, "sales_orders")
                                setStagedPaymentAdviceName(res.originalName)
                                setStagedPaymentAdviceUrl(res.url)
                                setEditFormErrors((prev) => {
                                  const next = { ...prev }
                                  delete next.paymentAdvice
                                  return next
                                })
                              } catch (err: any) {
                                showToast("Upload Error", "warning", err.message || "Failed to upload file")
                              }
                            }
                          }}
                        />
                      </label>
                      <span className="text-[11px] font-mono text-zinc-600 truncate flex-1">
                        {stagedPaymentAdviceName || "No receipt attached"}
                      </span>
                      {stagedPaymentAdviceUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(stagedPaymentAdviceUrl)
                            setPreviewName(stagedPaymentAdviceName || "Payment Advice")
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          View Doc <ExternalLink className="size-3" />
                        </button>
                      )}
                    </div>
                    {editFormErrors.paymentAdvice && (
                      <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                        ⚠️ {editFormErrors.paymentAdvice}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {(() => {
          const isWh1Editing = isWH1(editingOrder.warehouse)
          const availableEditUnits = isWh1Editing ? COMMODITY_UNITS : CONTAINER_UNITS
          return (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-900 tracking-wide">
                    Contract Line Items ({isWh1Editing ? "Commodities in Quintals / Tons" : "Products & Quantities"})
                  </label>
                  {editFormErrors.items && (
                    <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                      ⚠️ {editFormErrors.items}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleAddOrderItemRow(true)
                    setEditFormErrors((prev) => {
                      const next = { ...prev }
                      delete next.items
                      return next
                    })
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 transition-colors"
                >
                  <Plus className="size-3" /> Add Item Row
                </button>
              </div>

              <div className={`border rounded-2xl overflow-hidden text-xs transition-colors ${
                editFormErrors.items ? "border-rose-400 bg-rose-50/10" : "border-zinc-200"
              }`}>
                <table className="w-full text-left">
                  <thead className="bg-zinc-100 text-zinc-600 font-bold uppercase text-[9px]">
                    <tr>
                      <th className="px-3 py-2 w-[35%]">Product Item</th>
                      <th className="px-3 py-2 w-[18%] text-center">Qty</th>
                      <th className="px-3 py-2 w-[20%] text-center">Unit</th>
                      <th className="px-3 py-2 w-[20%] text-right">Unit Price</th>
                      <th className="px-3 py-2 w-[7%] text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {editingOrderItems.map((item, index) => {
                      const p = products.find((prod) => prod.id === item.productId)
                      const avail = p ? (editingOrder.warehouse && editingOrder.warehouse !== "ALL" ? (p.stockBreakdown?.find((sb) => sb.warehouse === editingOrder.warehouse)?.qty ?? p.quantity) : p.quantity) : 0
                      const isOver = item.qty > avail
                      return (
                        <tr key={index}>
                          <td className="p-2">
                            {(() => {
                              const scopedProducts = getProductsForWarehouse(editingOrder.warehouse)
                              return (
                                <select
                                  disabled={!editingOrder.warehouse}
                                  value={item.productId}
                                  onChange={(e) => handleOrderItemChange(index, "productId", e.target.value, true)}
                                  className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-bold disabled:cursor-not-allowed disabled:bg-zinc-100"
                                >
                                  <option value="">{editingOrder.warehouse ? "Select item" : "Select warehouse first"}</option>
                                  {scopedProducts.map((prod) => (
                                    <option key={prod.id} value={prod.id}>{prod.name}</option>
                                  ))}
                                </select>
                              )
                            })()}
                            <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                              <span className="text-zinc-500 font-bold">Store Available: <span className="font-mono font-black text-zinc-900">{avail}{isWh1Editing ? ` ${item.unit}` : ""}</span></span>
                              {isOver && (
                                <span className="flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md mt-0.5">
                                  <AlertTriangle className="size-3 text-amber-600 shrink-0" />
                                  <span>Insufficient Stock ({item.qty} &gt; {avail})</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <input
                              type="number"
                              min="1"
                              value={item.qty === 0 ? "" : item.qty}
                              onChange={(e) => handleOrderItemChange(index, "qty", e.target.value, true)}
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-mono font-bold text-center"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <select
                              value={item.unit}
                              onChange={(e) => handleOrderItemChange(index, "unit", e.target.value, true)}
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-bold text-center"
                            >
                              {availableEditUnits.map((unit) => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 align-top">
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice === 0 ? "" : item.unitPrice}
                              onChange={(e) => handleOrderItemChange(index, "unitPrice", e.target.value, true)}
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-mono font-bold text-right"
                            />
                          </td>
                          <td className="p-2 text-center align-top pt-2.5">
                            {editingOrderItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOrderItemRow(index, true)}
                                className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        <div className="mt-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 font-mono text-xs flex justify-between items-center">
          <span className="text-zinc-500 font-sans font-bold">Total Contract Amount:</span>
          <span className="font-black text-sm text-emerald-800">
            ETB {editingOrderItems.reduce((sum, i) => sum + i.total, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {Object.keys(editFormErrors).length > 0 && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold space-y-1.5 animate-in fade-in-50">
            <div className="flex items-center gap-1.5 font-black text-rose-700 uppercase tracking-wider text-[11px]">
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
              Please complete the required items before saving changes:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800 font-medium pl-1">
              {Object.values(editFormErrors).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
          <button 
            type="button" 
            disabled={isSavingEditOrder}
            onClick={() => setIsEditOrderOpen(false)}
            className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSavingEditOrder}
            className="min-w-[150px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSavingEditOrder ? <LoadingDots color="bg-white" size="sm" /> : "Save Order Changes"}
          </button>
        </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: NEW QUOTATION */}
      <AnimatePresence>
        {isNewQuotationOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[90vh]"
            >
              <h2 className="text-xl font-black text-zinc-950 mb-1">Draft Pro-Forma Quotation</h2>
              <p className="text-xs font-semibold text-zinc-500 mb-5">Generates an ERPNext-aligned pro-forma quotation.</p>

              <form onSubmit={handleCreateQuotation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Target Customer</label>
                  <select 
                    value={quoteCustomerId}
                    onChange={(e) => setQuoteCustomerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.category})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Warehouse</label>
                    <select 
                      value={quoteWarehouse}
                      onChange={(e) => setQuoteWarehouse(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    >
                      <option value="">Select warehouse</option>
                      {warehouseOptions.map((warehouse) => (
                        <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Validity (Days)</label>
                    <input 
                      type="number"
                      value={quoteValidDays}
                      onChange={(e) => setQuoteValidDays(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Quotation Notes</label>
                  <textarea 
                    value={quoteDesc}
                    onChange={(e) => setQuoteDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold outline-none resize-none" 
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button 
                    type="button" 
                    disabled={isSubmittingQuotation}
                    onClick={() => setIsNewQuotationOpen(false)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingQuotation}
                    className="min-w-[140px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmittingQuotation ? <LoadingDots color="bg-white" size="sm" /> : "Generate Quotation"}
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
        title="Delete Sales Order Contract?"
        recordId={deletingOrder?.id}
        recordName={deletingOrder ? `${deletingOrder.customer} — ETB ${deletingOrder.amount.toLocaleString()}` : ""}
        description="This will permanently delete this Sales Order contract from system registry."
        onClose={() => setDeletingOrder(null)}
        onConfirmDelete={() => {
          if (!deletingOrder) return
          erp.deleteSalesOrder(deletingOrder.id)
          showToast("Order Deleted", "info", `Sales Order ${deletingOrder.id} removed successfully.`)
          setDeletingOrder(null)
          setIsEditOrderOpen(false)
          setEditingOrder(null)
        }}
      />

      {/* DOCUMENT PREVIEW MODAL */}
      <DocumentPreviewModal
        isOpen={!!previewUrl}
        onClose={() => {
          setPreviewUrl("")
          setPreviewName("")
        }}
        fileUrl={previewUrl}
        fileName={previewName}
      />
    </div>
  )
}
