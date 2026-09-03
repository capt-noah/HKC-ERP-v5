import { useState, useEffect, useMemo, Fragment } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "react-router-dom"
import { 
  Plus, 
  X,
  ChevronDown,
  ChevronRight,
  Edit3,
  PlusCircle,
  Download,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import StoreTransfersTab from "@/components/StoreTransfersTab"
import { useErpStore, type Product, type WH1Entry, type BinCardMovementEntry } from "@/lib/erpStore"
import {
  withOperatingWarehouses,
  resolveWarehouseScope,
  isWarehouseInScope,
  isProductInWarehouseScope,
} from "@/lib/warehouses"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/lib/authStore"
import StockBinCardLedger from "@/components/stock/StockBinCardLedger"
import StockBinEntryModal from "@/components/stock/StockBinEntryModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import StockBinCardPrintModal from "@/components/stock/StockBinCardPrintModal"
import WH1ReceivingVoucherPrintModal from "@/components/stock/WH1ReceivingVoucherPrintModal"
import { getExpiryStatus, getExpiringItemsSummary } from "@/lib/expiryUtils"

const packagingUnits = ["Box", "Bottle", "Vial", "Sachet"]
const TON_TO_QUINTAL = 10

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

interface StockEditForm {
  name: string
  sku: string
  voucherNo?: string
  customer?: string
  plateNumber?: string
  dosage?: string
  shelfNo?: string
  category: string
  warehouse: string
  batch: string
  expiry: string
  entryDate?: string
  leaveDate?: string
  unit: string
  unitCost: string
  sellingPrice: string
  price?: string
  reorderLevel: string
  approvalStatus: Product["approvalStatus"]
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function displayDate(value?: string) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toISOString().slice(0, 10)
}

function ProductTableSkeletonRows({ colSpan }: { colSpan: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index}>
          <td className="py-4 px-6"><div className="space-y-2"><Skeleton className="h-3 w-44 bg-zinc-200/80" /><Skeleton className="h-3 w-24 bg-zinc-200/80" /></div></td>
          {Array.from({ length: colSpan - 1 }).map((_, cIdx) => (
            <td key={cIdx} className="py-4 px-4"><Skeleton className="h-3 w-20 bg-zinc-200/80" /></td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function StockProducts() {
  const { showToast } = useFeedback()
  const erp = useErpStore()
  
  const { user } = useAuthStore()
  const userRoles = user?.roles || ((user as any)?.role ? [(user as any).role] : [])
  const userWarehouseIds = user?.warehouse_ids || ((user as any)?.warehouse_id ? [(user as any).warehouse_id] : [])
  const allWarehouses = withOperatingWarehouses(erp.getWarehouses())
  
  const resolvedWarehouseIds = useMemo(() => {
    return resolveWarehouseScope(userWarehouseIds, erp.getWarehouses())
  }, [userWarehouseIds, erp])

  const isInventoryAdminOnly = userRoles.includes("inventory_admin") && !userRoles.includes("superadmin")

  const allProducts = erp.getProducts()
  const products = (isInventoryAdminOnly && resolvedWarehouseIds.length > 0)
    ? allProducts.filter(p => isProductInWarehouseScope(p, resolvedWarehouseIds))
    : allProducts

  const isLoading = erp.isLoading()
  const warehouseRecords = (isInventoryAdminOnly && resolvedWarehouseIds.length > 0)
    ? allWarehouses.filter(w => isWarehouseInScope(w.id, resolvedWarehouseIds) || isWarehouseInScope(w.code, resolvedWarehouseIds))
    : allWarehouses
  const isWH1 = (w: string) => w === "WH1" || w === "WH1-AGRI-EXP"

  const hasCommercialStoreAccess =
    !isInventoryAdminOnly ||
    resolvedWarehouseIds.length === 0 ||
    resolvedWarehouseIds.some(
      (id) =>
        id.toUpperCase().includes("WH2") ||
        id.toUpperCase().includes("WH3") ||
        id.toUpperCase().includes("WH-02") ||
        id.toUpperCase().includes("WH-03")
    )

  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get("search") || ""
  const [activeTab, setActiveTab] = useState<"Register" | "Store Transfer">("Register")

  useEffect(() => {
    if (!hasCommercialStoreAccess && activeTab !== "Register") {
      setActiveTab("Register")
    }
  }, [hasCommercialStoreAccess, activeTab])
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const defaultWarehouse = (isInventoryAdminOnly && warehouseRecords.length === 1)
    ? (warehouseRecords[0].code || warehouseRecords[0].id)
    : "ALL"
  const [selectedWarehouse, setSelectedWarehouse] = useState(defaultWarehouse)
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL")
  
  useEffect(() => {
    if (isInventoryAdminOnly && warehouseRecords.length === 1) {
      const singleWh = warehouseRecords[0].code || warehouseRecords[0].id
      setSelectedWarehouse(singleWh)
      setAddWarehouse(singleWh)
    }
  }, [isInventoryAdminOnly, warehouseRecords])
  
  // Expanded rows for WH1 items
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())

  // Add Stock Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addDescription, setAddDescription] = useState("")
  const [addVoucherNo, setAddVoucherNo] = useState("")
  const [addCustomer, setAddCustomer] = useState("")
  const [addPlateNumber, setAddPlateNumber] = useState("")
  const [addDosage, setAddDosage] = useState("")
  const [addShelfNo, setAddShelfNo] = useState("")
  const [addPackagingUnit, setAddPackagingUnit] = useState("")
  const [addWarehouse, setAddWarehouse] = useState("")
  const [addBatchNumber, setAddBatchNumber] = useState("")
  const [addUnitPrice, setAddUnitPrice] = useState("")
  const [addMfgDate, setAddMfgDate] = useState("")
  const [addExpDate, setAddExpDate] = useState("")
  const [addQtyPerPack, setAddQtyPerPack] = useState("")
  const [addNumCartons, setAddNumCartons] = useState("")
  const [addEntryDate, setAddEntryDate] = useState("")
  const [addQuantity, setAddQuantity] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [isSavingAdd, setIsSavingAdd] = useState(false)

  // Autocomplete state for WH1 existing items lookup
  const [showItemSuggestions, setShowItemSuggestions] = useState(false)
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<Product | null>(null)

  // Direct Slim Add Entry Modal
  const [slimAddEntryProduct, setSlimAddEntryProduct] = useState<Product | null>(null)
  
  // Edit WH1 sub-entry modal state
  const [editingSubEntry, setEditingSubEntry] = useState<{ product: Product; entry: WH1Entry } | null>(null)
  const [editSubEntryVoucherNo, setEditSubEntryVoucherNo] = useState("")
  const [editSubEntryCustomer, setEditSubEntryCustomer] = useState("")
  const [editSubEntryPlateNumber, setEditSubEntryPlateNumber] = useState("")
  const [editSubEntryQty, setEditSubEntryQty] = useState("")
  const [editSubEntryPrice, setEditSubEntryPrice] = useState("")
  const [editSubEntryDate, setEditSubEntryDate] = useState("")
  const [editSubEntryLeave, setEditSubEntryLeave] = useState("")
  const [editSubEntryNotes, setEditSubEntryNotes] = useState("")
  const [isSavingSubEdit, setIsSavingSubEdit] = useState(false)

  // Bin Card Movement Modal State (WH2 / WH3)
  const [binEntryModal, setBinEntryModal] = useState<{
    isOpen: boolean
    product: Product | null
    entry: BinCardMovementEntry | null
  }>({
    isOpen: false,
    product: null,
    entry: null,
  })

  // Bin Card Print/Export Modal State (WH2 / WH3)
  const [printModalProduct, setPrintModalProduct] = useState<Product | null>(null)

  // Goods Receiving Voucher Print/Export Modal State (WH1)
  const [wh1VoucherModal, setWh1VoucherModal] = useState<{
    isOpen: boolean
    product: Product | null
  }>({
    isOpen: false,
    product: null,
  })

  // Edit/Delete Product state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState<StockEditForm>({
    name: "",
    sku: "",
    voucherNo: "",
    customer: "",
    plateNumber: "",
    dosage: "",
    shelfNo: "",
    category: "",
    warehouse: "",
    batch: "",
    expiry: "",
    entryDate: "",
    leaveDate: "",
    unit: "",
    unitCost: "",
    sellingPrice: "",
    price: "",
    reorderLevel: "",
    approvalStatus: "Approved",
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const isWH1Form = isWH1(addWarehouse)

  // Quantities & Stock values
  const addTotalQuantity = isWH1Form
    ? (addPackagingUnit === "Ton" ? Number(addQuantity || 0) * TON_TO_QUINTAL : Number(addQuantity || 0))
    : Number(addQtyPerPack || 0) * Number(addNumCartons || 0)
  
  const addTotalStockValue = addTotalQuantity * Number(addUnitPrice || 0)

  const daysBetween = (start: string, end: string) => {
    if (!start || !end) return null
    const startDate = new Date(`${start}T00:00:00`)
    const endDate = new Date(`${end}T00:00:00`)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
    return Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000)
  }

  const addShelfLifeDays = daysBetween(addMfgDate, addExpDate)
  const addShelfLifeMonths = addShelfLifeDays === null ? 0 : Math.max(0, Math.round((addShelfLifeDays / 30.4375) * 10) / 10)
  
  const addDateInvalid = !isWH1Form && Boolean(addShelfLifeDays !== null && addShelfLifeDays <= 0)

  const addNormalizedBatch = addBatchNumber.trim().toLowerCase()
  const addDuplicateBatch = !isWH1Form && Boolean(addNormalizedBatch) && products.some((product) => {
    const batches = [product.batch, ...product.batches.map((batch) => batch.batchNo)]
    return batches.some((batch) => String(batch || "").trim().toLowerCase() === addNormalizedBatch)
  })

  const canSaveAdd = isWH1Form
    ? Boolean(
        addDescription &&
        addPackagingUnit &&
        addWarehouse &&
        addEntryDate &&
        Number(addQuantity) > 0 &&
        !addDateInvalid
      )
    : Boolean(
        addDescription &&
        addPackagingUnit &&
        addWarehouse &&
        addBatchNumber &&
        addMfgDate &&
        addExpDate &&
        addQtyPerPack &&
        addNumCartons &&
        addTotalQuantity > 0 &&
        !addDateInvalid &&
        !addDuplicateBatch
      )

  const resetAddForm = () => {
    setAddDescription("")
    setAddVoucherNo("")
    setAddCustomer("")
    setAddPlateNumber("")
    setAddDosage("")
    setAddShelfNo("")
    setAddPackagingUnit("")
    setAddWarehouse("")
    setAddBatchNumber("")
    setAddUnitPrice("")
    setAddMfgDate("")
    setAddExpDate("")
    setAddQtyPerPack("")
    setAddNumCartons("")
    setAddEntryDate("")
    setAddQuantity("")
    setAddNotes("")
    setSelectedExistingProduct(null)
  }

  // Filtered warehouses mapping
  const warehouseOptions = useMemo(() => [
    { value: "ALL", label: "All Warehouses" },
    ...warehouseRecords.map((warehouse) => ({
      value: warehouse.code || warehouse.id,
      label: warehouse.name || warehouse.code || warehouse.id,
    })),
  ], [warehouseRecords])

  const warehouseKeyMap = useMemo(() => new Map(warehouseRecords.map((warehouse) => [warehouse.code || warehouse.id, new Set([warehouse.id, warehouse.code, warehouse.name].filter(Boolean))])), [warehouseRecords])

  // Expiry summary for warehouse stock
  const expirySummary = useMemo(() => {
    return getExpiringItemsSummary(products, {
      thresholdDays: 90,
      warehouseId: selectedWarehouse,
    })
  }, [products, selectedWarehouse])

  // Filters for Table
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            prod.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (prod.dosage && prod.dosage.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (prod.shelfNo && prod.shelfNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            prod.batch.toLowerCase().includes(searchQuery.toLowerCase())
      const selectedWarehouseKeys = warehouseKeyMap.get(selectedWarehouse) || new Set([selectedWarehouse])
      const matchesWarehouse =
        selectedWarehouse === "ALL" ||
        selectedWarehouseKeys.has(prod.warehouse) ||
        prod.stockBreakdown.some((breakdown) => selectedWarehouseKeys.has(breakdown.warehouse))

      let matchesExpiry = true
      if (expiryFilter !== "ALL") {
        const prodExpStatus = getExpiryStatus(prod.expiry, 90)
        const batchExpStatuses = (prod.batches || []).map((b) => getExpiryStatus(b.expiry, 90))
        const allStatuses = [prodExpStatus, ...batchExpStatuses]
        matchesExpiry = allStatuses.some((s) => s.tier === expiryFilter)
      }

      return matchesSearch && matchesWarehouse && matchesExpiry
    })
  }, [products, searchQuery, selectedWarehouse, warehouseKeyMap, expiryFilter])

  // Suggested matching existing items list for WH1 auto-complete lookup
  const wh1ItemSuggestions = useMemo(() => {
    if (!addDescription || addDescription.length < 2) return []
    return products.filter(p => isWH1(p.warehouse) && p.name.toLowerCase().includes(addDescription.toLowerCase()))
  }, [products, addDescription])

  // Table Column Definitions
  const currentProductColumns = useMemo(() => {
    const cols: TableColumn[] = [
      { key: "sku", label: "ID", align: "left" },
      { key: "name", label: "Item", align: "left" },
    ]

    if (isWH1(selectedWarehouse)) {
      cols.push(
        { key: "voucherNo", label: "Voucher No", align: "left" },
        { key: "customer", label: "Customer", align: "left" },
        { key: "plateNumber", label: "Plate No", align: "left" },
        { key: "quantity", label: "Total Quantity", align: "right" },
        { key: "unit", label: "UOM", align: "left" },
        { key: "totalStockValue", label: "Stock Value", align: "right" }
      )
    } else {
      cols.push(
        { key: "dosage", label: "Strength / Dosage", align: "left" },
        { key: "shelfNo", label: "Shelf Number", align: "left" },
        { key: "manufacturingDate", label: "MFG", align: "left" },
        { key: "expiryDate", label: "EXP", align: "left" },
        { key: "numberOfCartons", label: "Cartons", align: "right" },
        { key: "quantityPerPack", label: "Quantity/Pack", align: "right" },
        { key: "quantity", label: "Total Quantity", align: "right" },
        { key: "unit", label: "Packaging Unit", align: "left" },
        { key: "totalStockValue", label: "Stock Value", align: "right" }
      )
    }

    cols.push({ key: "_actions", label: "Action", align: "center", noSort: true })
    return cols
  }, [selectedWarehouse])

  const productsTable = useResizableTable(currentProductColumns, filteredProducts, {
    sku: 110,
    name: 180,
    voucherNo: 110,
    customer: 130,
    plateNumber: 110,
    dosage: 130,
    shelfNo: 120,
    batch: 110,
    manufacturingDate: 100,
    expiryDate: 100,
    unit: 100,
    numberOfCartons: 85,
    quantityPerPack: 95,
    quantity: 130,
    unitCost: 120,
    totalStockValue: 170,
    entryDate: 120,
    leaveDate: 120,
    _actions: 240,
  })

  const totalTableWidth = useMemo(() => {
    return currentProductColumns.reduce((sum, col) => sum + (productsTable.colWidths[col.key] || 120), 0)
  }, [currentProductColumns, productsTable.colWidths])

  const [stockPage, setStockPage] = useState(1)
  const [stockPageSize, setStockPageSize] = useState(10)

  useEffect(() => {
    setStockPage(1)
  }, [searchQuery, selectedWarehouse, expiryFilter, filteredProducts.length])

  const sortedStockProducts = productsTable.sorted()
  const totalStockPages = Math.max(1, Math.ceil(sortedStockProducts.length / stockPageSize))
  const displayedStockProducts = sortedStockProducts.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize)

  // Chevron expand / collapse toggle
  const toggleRowExpand = (productId: string) => {
    const next = new Set(expandedProductIds)
    if (next.has(productId)) {
      next.delete(productId)
    } else {
      next.add(productId)
    }
    setExpandedProductIds(next)
  }

  // Handle Save product form
  const handleSaveNewStockItem = async (addAnother = false) => {
    if (!canSaveAdd) {
      showToast("Cannot save item", "warning", "Complete required stock fields and resolve warnings.")
      return
    }

    setIsSavingAdd(true)
    try {
      const now = new Date().toISOString()
      const selectedWarehouseRecord = warehouseRecords.find((item) => (item.code || item.id) === addWarehouse || item.id === addWarehouse)
      
      const targetUOM = isWH1Form ? "Quintal" : addPackagingUnit

      if (selectedExistingProduct) {
        // Option A: Add sub-entry to existing item
        const newEntryPayload: Omit<WH1Entry, "entryId"> = {
          voucherNo: addVoucherNo.trim() || undefined,
          customer: addCustomer.trim() || undefined,
          plateNumber: addPlateNumber.trim() || undefined,
          entryDate: addEntryDate,
          leaveDate: undefined,
          quantityReceived: addTotalQuantity,
          quantityRemaining: addTotalQuantity,
          unitPrice: Number(addUnitPrice || 0),
          notes: addNotes.trim() || undefined,
        }
        await erp.addWH1Entry(selectedExistingProduct.id, newEntryPayload)
        showToast("Stock entry added", "success", `Entry added to existing item ${selectedExistingProduct.name}.`)
      } else {
        // Option B: Add new item entirely
        const productId = `P-${Date.now()}`
        const initialWH1Entries: WH1Entry[] = isWH1Form ? [{
          entryId: `WH1E-${Date.now()}`,
          voucherNo: addVoucherNo.trim() || undefined,
          customer: addCustomer.trim() || undefined,
          plateNumber: addPlateNumber.trim() || undefined,
          entryDate: addEntryDate,
          leaveDate: undefined,
          quantityReceived: addTotalQuantity,
          quantityRemaining: addTotalQuantity,
          unitPrice: Number(addUnitPrice || 0),
          notes: addNotes.trim() || undefined,
        }] : []

        const product: Product = {
          id: productId,
          name: addDescription,
          sku: `${addDescription.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "STK")}-${isWH1Form ? "WH1" : addBatchNumber}`,
          voucherNo: isWH1Form ? (addVoucherNo.trim() || undefined) : undefined,
          customer: isWH1Form ? (addCustomer.trim() || undefined) : undefined,
          plateNumber: isWH1Form ? (addPlateNumber.trim() || undefined) : undefined,
          dosage: isWH1Form ? undefined : addDosage.trim() || undefined,
          shelfNo: isWH1Form ? undefined : addShelfNo.trim() || undefined,
          category: "",
          itemType: "",
          description: addDescription,
          warehouse: addWarehouse,
          warehouseName: selectedWarehouseRecord?.name,
          quantity: addTotalQuantity,
          quantityPerPack: isWH1Form ? undefined : Number(addQtyPerPack),
          numberOfCartons: isWH1Form ? undefined : Number(addNumCartons),
          totalQuantity: addTotalQuantity,
          quantitySold: 0,
          openingBalance: addTotalQuantity,
          unit: targetUOM,
          unitCost: Number(addUnitPrice || 0),
          sellingPrice: Number(addUnitPrice || 0),
          totalStockValue: addTotalStockValue,
          batch: isWH1Form ? "" : addBatchNumber,
          manufacturingDate: isWH1Form ? undefined : addMfgDate,
          expiry: isWH1Form ? "" : addExpDate,
          shelfLifeMonths: isWH1Form ? undefined : addShelfLifeMonths,
          entryDate: isWH1Form ? addEntryDate : undefined,
          leaveDate: undefined,
          status: addTotalQuantity > 0 ? "In Stock" : "Out of Stock",
          stockBreakdown: [{ warehouse: addWarehouse, qty: addTotalQuantity }],
          batches: isWH1Form ? [] : [{ batchNo: addBatchNumber, qty: addTotalQuantity, expiry: addExpDate, status: "Released" }],
          wh1Entries: isWH1Form ? initialWH1Entries : undefined,
          binCardEntries: (!isWH1Form && addTotalQuantity > 0) ? [{
            id: `BCE-${Date.now()}-init`,
            date: addMfgDate || now.slice(0, 10),
            batchNo: addBatchNumber,
            qtyReceived: addTotalQuantity,
            qtyIssued: 0,
            balance: addTotalQuantity,
            mfgDate: isWH1Form ? undefined : (addMfgDate || undefined),
            expiryDate: addExpDate,
            party: "Initial Stock Deposit",
            unitPrice: Number(addUnitPrice || 0),
            remark: addNotes.trim() || "Initial Stock Registration",
            createdAt: now,
          }] : [],
          origin: "",
          supplierName: "",
          itemRegistrationStatus: "Active",
          approvalStatus: "Approved",
          createdDate: now,
          createdAt: now,
          updatedAt: now,
        }

        await erp.addProduct(product)
        showToast("Stock item saved", "success", `${addDescription} was saved to inventory.`)
      }

      if (addAnother) {
        resetAddForm()
      } else {
        resetAddForm()
        setIsAddModalOpen(false)
      }
    } catch (error) {
      showToast("Save failed", "warning", error instanceof Error ? error.message : "The stock item could not be saved.")
    } finally {
      setIsSavingAdd(false)
    }
  }

  // Handle saving direct slim sub-entry modal
  const handleSaveSlimEntry = async () => {
    if (!slimAddEntryProduct || !addEntryDate || !addQuantity || Number(addQuantity) <= 0) {
      showToast("Validation failed", "warning", "Provide a valid quantity and entry date.")
      return
    }
    setIsSavingAdd(true)
    try {
      const finalQty = addPackagingUnit === "Ton" ? Number(addQuantity) * TON_TO_QUINTAL : Number(addQuantity)
      const newEntryPayload: Omit<WH1Entry, "entryId"> = {
        voucherNo: addVoucherNo.trim() || undefined,
        customer: addCustomer.trim() || undefined,
        plateNumber: addPlateNumber.trim() || undefined,
        entryDate: addEntryDate,
        leaveDate: undefined,
        quantityReceived: finalQty,
        quantityRemaining: finalQty,
        unitPrice: Number(addUnitPrice || 0),
        notes: addNotes.trim() || undefined,
      }
      await erp.addWH1Entry(slimAddEntryProduct.id, newEntryPayload)
      showToast("Stock entry added", "success", `New entry added for ${slimAddEntryProduct.name}.`)
      setSlimAddEntryProduct(null)
      resetAddForm()
    } catch (error) {
      showToast("Save failed", "warning", error instanceof Error ? error.message : "Failed to add entry.")
    } finally {
      setIsSavingAdd(false)
    }
  }

  // Handle Edit/Delete Sub Entry
  const openEditSubEntry = (product: Product, entry: WH1Entry) => {
    setEditingSubEntry({ product, entry })
    setEditSubEntryVoucherNo(entry.voucherNo || "")
    setEditSubEntryCustomer(entry.customer || "")
    setEditSubEntryPlateNumber(entry.plateNumber || "")
    setEditSubEntryQty(String(entry.quantityReceived))
    setEditSubEntryPrice(String(entry.unitPrice))
    setEditSubEntryDate(entry.entryDate)
    setEditSubEntryLeave(entry.leaveDate || "")
    setEditSubEntryNotes(entry.notes || "")
  }

  const handleSaveSubEntryEdit = async () => {
    if (!editingSubEntry || !editSubEntryQty || !editSubEntryDate) return
    setIsSavingSubEdit(true)
    try {
      const nextQty = Number(editSubEntryQty)
      const originalRemaining = editingSubEntry.entry.quantityRemaining
      const difference = editingSubEntry.entry.quantityReceived - nextQty
      const nextRemaining = Math.max(0, originalRemaining - difference)

      await erp.updateWH1Entry(editingSubEntry.product.id, editingSubEntry.entry.entryId, {
        voucherNo: editSubEntryVoucherNo.trim() || undefined,
        customer: editSubEntryCustomer.trim() || undefined,
        plateNumber: editSubEntryPlateNumber.trim() || undefined,
        entryDate: editSubEntryDate,
        leaveDate: editSubEntryLeave || undefined,
        quantityReceived: nextQty,
        quantityRemaining: nextRemaining,
        unitPrice: Number(editSubEntryPrice || 0),
        notes: editSubEntryNotes.trim() || undefined,
      })
      showToast("Entry updated", "success", "Sub-entry values saved.")
      setEditingSubEntry(null)
    } catch (e) {
      showToast("Update failed", "warning", e instanceof Error ? e.message : "Failed to save edit.")
    } finally {
      setIsSavingSubEdit(false)
    }
  }

  const handleDeleteSubEntry = async (product: Product, entryId: string) => {
    if (confirm("Are you sure you want to delete this sub-entry? This will decrease the overall product stock.")) {
      try {
        await erp.deleteWH1Entry(product.id, entryId)
        showToast("Entry deleted", "info", "Sub-entry was removed from inventory.")
      } catch (e) {
        showToast("Delete failed", "warning", e instanceof Error ? e.message : "Failed to delete entry.")
      }
    }
  }

  // Bin Card movement entry handlers (WH2 / WH3)
  const handleSaveBinEntry = async (
    productId: string,
    entryData: Omit<BinCardMovementEntry, "id" | "balance">,
    entryId?: string
  ) => {
    if (entryId) {
      await erp.updateBinCardEntry(productId, entryId, entryData)
    } else {
      await erp.addBinCardEntry(productId, entryData)
    }
  }

  const handleDeleteBinEntry = async (productId: string, entryId: string) => {
    await erp.deleteBinCardEntry(productId, entryId)
  }

  const handleDeleteProductConfirm = async () => {
    if (!deletingProduct) return
    try {
      await erp.deleteProduct(deletingProduct.id)
      showToast("Item deleted", "success", `${deletingProduct.name} was removed from stock register.`)
      setDeletingProduct(null)
      setEditingProduct(null)
    } catch (e: any) {
      showToast("Delete failed", "warning", e.message || "Failed to delete item.")
    }
  }

  // Normal product edit dialog
  const openEditProduct = (product: Product) => {
    setEditingProduct(product)
    setEditForm({
      name: product.name,
      sku: product.sku,
      voucherNo: product.voucherNo || (product.wh1Entries?.[0]?.voucherNo || ""),
      customer: product.customer || (product.wh1Entries?.[0]?.customer || ""),
      plateNumber: product.plateNumber || (product.wh1Entries?.[0]?.plateNumber || ""),
      dosage: product.dosage || "",
      shelfNo: product.shelfNo || "",
      category: product.category || "",
      warehouse: product.warehouse,
      batch: product.batch || "",
      expiry: product.expiry || "",
      entryDate: product.entryDate || "",
      leaveDate: product.leaveDate || "",
      unit: product.unit,
      unitCost: String(product.unitCost || 0),
      sellingPrice: String(product.sellingPrice || 0),
      price: isWH1(product.warehouse) ? String(product.unitCost || 0) : "",
      reorderLevel: String(product.reorderLevel || ""),
      approvalStatus: product.approvalStatus || "Approved",
    })
  }

  const updateEditForm = (partial: Partial<StockEditForm>) => {
    setEditForm((current) => ({ ...current, ...partial }))
  }

  const handleSaveProductDetails = async () => {
    if (!editingProduct) return
    const name = editForm.name.trim()
    const sku = editForm.sku.trim()
    const voucherNo = editForm.voucherNo?.trim() || undefined
    const customer = editForm.customer?.trim() || undefined
    const plateNumber = editForm.plateNumber?.trim() || undefined
    const dosage = editForm.dosage?.trim() || undefined
    const shelfNo = editForm.shelfNo?.trim() || undefined
    const batch = editForm.batch.trim()
    const warehouse = editForm.warehouse
    const expiry = isWH1(warehouse) ? "" : editForm.expiry
    const entryDate = isWH1(warehouse) ? editForm.entryDate : undefined
    const leaveDate = (isWH1(warehouse) && editForm.leaveDate) ? editForm.leaveDate : undefined
    const unit = editForm.unit.trim()
    
    const priceVal = isWH1(warehouse) ? Number(editForm.price || 0) : Number(editForm.unitCost || 0)
    const unitCost = priceVal
    const sellingPrice = priceVal
    const reorderLevel = editForm.reorderLevel === "" ? undefined : Number(editForm.reorderLevel)

    if (isWH1(warehouse)) {
      if (!name || !sku || !warehouse || !entryDate || !unit) {
        showToast("Cannot save stock details", "warning", "Complete item name, ID (SKU), warehouse, entry date, and UOM.")
        return
      }
      const datesInvalid = Boolean(
        entryDate &&
        leaveDate &&
        daysBetween(entryDate, leaveDate) !== null &&
        (daysBetween(entryDate, leaveDate) ?? 0) <= 0
      )
      if (datesInvalid) {
        showToast("Cannot save stock details", "warning", "Leave date must be after entry date.")
        return
      }
    } else {
      if (!name || !sku || !warehouse || !unit || !Number.isFinite(unitCost)) {
        showToast("Cannot save stock details", "warning", "Complete item name, SKU, warehouse, unit, and unit price.")
        return
      }
    }

    const selectedWarehouseRecord = warehouseRecords.find((item) => (item.code || item.id) === warehouse || item.id === warehouse)
    const nextBreakdown = editingProduct.stockBreakdown.length
      ? editingProduct.stockBreakdown.map((item, index) => index === 0 ? { ...item, warehouse } : item)
      : [{ warehouse, qty: editingProduct.quantity }]
    const nextBatches = editingProduct.batches.length
      ? editingProduct.batches.map((item, index) => index === 0 ? { ...item, batchNo: batch, expiry: expiry || item.expiry } : item)
      : [{ batchNo: batch || "BATCH-01", qty: editingProduct.quantity, expiry: expiry || "", status: "Released" as const }]

    setIsSavingEdit(true)
    try {
      const saved = await erp.updateProductDetails(editingProduct.id, {
        name,
        sku,
        voucherNo,
        customer,
        plateNumber,
        dosage,
        shelfNo,
        category: editForm.category.trim(),
        warehouse,
        warehouseName: selectedWarehouseRecord?.name,
        batch,
        expiry,
        entryDate,
        leaveDate,
        unit,
        unitCost,
        sellingPrice,
        reorderLevel,
        totalStockValue: editingProduct.quantity * unitCost,
        stockBreakdown: nextBreakdown,
        batches: nextBatches,
        approvalStatus: editForm.approvalStatus,
      })
      setEditingProduct(null)
      showToast("Stock details saved", "success", `${saved.name} was updated.`)
    } catch (error) {
      showToast("Save failed", "warning", error instanceof Error ? error.message : "The stock details could not be saved.")
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading" sections={navSections} />

      <motion.div 
        variants={stagger} 
        initial="hidden" 
        animate="visible" 
        className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12"
      >
        {/* Header Section */}
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Stock</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Manage product inventory, warehouse records, and stock entries across standard and agricultural warehouses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/inventory")} />
          </div>
        </motion.div>
        {/* Tab Selection Row (Visible only for WH2 / WH3 commercial store access) */}
        {hasCommercialStoreAccess && (
          <motion.div variants={fade} className="flex items-center gap-2 border-b border-zinc-200/60 mb-6 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "Register", label: "Stock" },
              { id: "Store Transfer", label: "Store Transfer" },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="px-4 py-2.5 text-xs font-black relative tracking-tight transition-colors uppercase shrink-0 cursor-pointer"
                >
                  <span className={isActive ? "text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-700"}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="stock-tabs"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950"
                    />
                  )}
                </button>
              )
            })}
          </motion.div>
        )}

        {/* Tab Contents */}
        <AnimatePresence mode="wait">
          {activeTab === "Register" && (
            <motion.div
              key="products-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Expiry Risk Alert Banner */}
              {(expirySummary.totalExpiredCount > 0 || expirySummary.totalCriticalCount > 0) && (
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  expirySummary.totalExpiredCount > 0
                    ? "bg-rose-50/70 border-rose-200/80 text-rose-950"
                    : "bg-amber-50/70 border-amber-200/80 text-amber-950"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                      expirySummary.totalExpiredCount > 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {expirySummary.totalExpiredCount > 0 ? (
                        <AlertOctagon className="size-5" />
                      ) : (
                        <AlertTriangle className="size-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider">
                          Inventory Expiry Alert
                        </span>
                        {expirySummary.totalExpiredCount > 0 && (
                          <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.2 rounded-full">
                            {expirySummary.totalExpiredCount} Expired
                          </span>
                        )}
                        {expirySummary.totalCriticalCount > 0 && (
                          <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.2 rounded-full">
                            {expirySummary.totalCriticalCount} Critical (≤30d)
                          </span>
                        )}
                        {expirySummary.totalWarningCount > 0 && (
                          <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.2 rounded-full">
                            {expirySummary.totalWarningCount} Watchlist (≤90d)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-zinc-600 mt-0.5">
                        Total At-Risk Valuation: <strong className="font-mono text-zinc-900">ETB {expirySummary.totalAtRiskValue.toLocaleString()}</strong> across warehouses.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {expiryFilter !== "ALL" ? (
                      <button
                        onClick={() => setExpiryFilter("ALL")}
                        className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Clear Expiry Filter
                      </button>
                    ) : (
                      <>
                        {expirySummary.totalCriticalCount > 0 && (
                          <button
                            onClick={() => setExpiryFilter("CRITICAL")}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all shadow-2xs cursor-pointer"
                          >
                            Filter Critical (≤30d)
                          </button>
                        )}
                        {expirySummary.totalExpiredCount > 0 && (
                          <button
                            onClick={() => setExpiryFilter("EXPIRED")}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-2xs cursor-pointer"
                          >
                            Filter Expired
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <GlassCard className="flex flex-col overflow-hidden p-0 border border-white/65 shadow-md">
                <div className="px-6 pt-6">
                  <FinanceTableToolbar
                    title="Stock List"
                    subtitle={`Total: ${productsTable.sorted().length} products matches filters`}
                    searchValue={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder="Search product name, SKU..."
                    filters={[
                      ...(warehouseRecords.length > 1
                        ? [
                            {
                              value: selectedWarehouse,
                              onChange: setSelectedWarehouse,
                              ariaLabel: "Filter by Warehouse",
                              options: warehouseOptions,
                            },
                          ]
                        : []),
                      {
                        value: expiryFilter,
                        onChange: setExpiryFilter,
                        ariaLabel: "Filter by Expiry Status",
                        options: [
                          { value: "ALL", label: "All Expiry Status" },
                          { value: "CRITICAL", label: `Critical (≤30d) (${expirySummary.totalCriticalCount})` },
                          { value: "WARNING", label: `Watchlist (≤90d) (${expirySummary.totalWarningCount})` },
                          { value: "EXPIRED", label: `Expired (${expirySummary.totalExpiredCount})` },
                        ],
                      },
                    ]}
                    actions={[
                      {
                        label: "Add Item",
                        onClick: () => setIsAddModalOpen(true),
                        icon: <Plus className="size-4" />,
                        variant: "primary",
                      },
                    ]}
                  />
                </div>

                <TableScrollWrapper>
                  <table className="w-full text-left border-collapse table-fixed" style={{ minWidth: `${Math.max(totalTableWidth, 1100)}px` }}>
                    <thead className="relative z-20">
                      <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                        {currentProductColumns.map((col: TableColumn) => (
                          <ResizableTh
                            key={col.key}
                            col={col}
                            width={productsTable.colWidths[col.key] || 110}
                            sortKey={productsTable.sortKey}
                            sortDir={productsTable.sortDir}
                            openMenuCol={productsTable.openMenuCol}
                            onResizeStart={productsTable.handleResizeStart}
                            onToggleMenu={productsTable.toggleMenu}
                            onSortAsc={productsTable.setSortAsc}
                            onSortDesc={productsTable.setSortDesc}
                            onClearSort={productsTable.clearSort}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150/40">
                      {isLoading ? (
                        <ProductTableSkeletonRows colSpan={currentProductColumns.length} />
                      ) : sortedStockProducts.length === 0 ? (
                        <tr>
                          <td colSpan={currentProductColumns.length} className="text-center py-16 text-zinc-400 text-xs font-semibold">
                            No stock records found matching filters.
                          </td>
                        </tr>
                      ) : (
                        displayedStockProducts.map((prod) => {
                          const isWH1Item = isWH1(prod.warehouse)
                          const isExpanded = expandedProductIds.has(prod.id)

                          // Render Parent Row for WH1 items
                          if (isWH1Item && isWH1(selectedWarehouse)) {
                            const entries = prod.wh1Entries || []
                            const totalReceived = entries.reduce((sum, e) => sum + e.quantityReceived, 0)

                            return (
                              <Fragment key={prod.id}>
                                <tr className="hover:bg-white/45 cursor-pointer transition-colors font-semibold text-xs border-b border-zinc-100">
                                  {/* ID / SKU */}
                                  <td className="py-4 px-6 overflow-hidden">
                                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 font-bold uppercase">
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleRowExpand(prod.id) }} 
                                        className="p-1 hover:bg-zinc-100 rounded-md"
                                      >
                                        {isExpanded ? <ChevronDown className="size-3 text-zinc-800" /> : <ChevronRight className="size-3 text-zinc-400" />}
                                      </button>
                                      <span className="truncate">{prod.sku}</span>
                                    </div>
                                  </td>
                                  
                                  {/* Item */}
                                  <td className="py-4 px-4 overflow-hidden font-black text-zinc-950">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate">{prod.name}</span>
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[9px] font-black text-emerald-800 border border-emerald-100">
                                        {entries.length} {entries.length === 1 ? "entry" : "entries"}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Voucher No */}
                                  <td className="py-4 px-4 font-mono text-[11px] font-black text-rose-700">
                                    {prod.voucherNo || (entries[0]?.voucherNo ? `No. ${entries[0].voucherNo}` : "—")}
                                  </td>

                                  {/* Customer */}
                                  <td className="py-4 px-4 font-bold text-zinc-900 truncate max-w-[130px]" title={prod.customer || entries[0]?.customer || "—"}>
                                    {prod.customer || (entries[0]?.customer || "—")}
                                  </td>

                                  {/* Plate Number */}
                                  <td className="py-4 px-4 font-mono text-[11px] text-zinc-600">
                                    {prod.plateNumber || (entries[0]?.plateNumber || "—")}
                                  </td>

                                  {/* Total quantity */}
                                  <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                    <div>{prod.quantity.toLocaleString()}</div>
                                    <div className="text-[9px] text-zinc-400 font-bold">of {totalReceived.toLocaleString()} received</div>
                                  </td>

                                  {/* UOM */}
                                  <td className="py-4 px-4 font-bold text-zinc-500 uppercase">{prod.unit}</td>

                                  {/* Stock Value */}
                                  <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                    <div>ETB {money(prod.totalStockValue || 0)}</div>
                                  </td>

                                  {/* Actions */}
                                  <td className="py-4 px-6 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => setSlimAddEntryProduct(prod)}
                                        className="px-2.5 py-1.5 rounded-full bg-zinc-950 text-white font-extrabold text-[10px] inline-flex items-center gap-1 hover:bg-zinc-800 transition-all active:scale-95 shadow-xs cursor-pointer"
                                        title="Add sub-entry"
                                      >
                                        <PlusCircle className="size-3" /> Add
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setWh1VoucherModal({ isOpen: true, product: prod })}
                                        className="px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-extrabold text-[10px] inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer"
                                        title="Print & Export Goods Receiving Voucher"
                                      >
                                        <Download className="size-3 text-zinc-500" /> Export
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openEditProduct(prod)}
                                        className="px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-800 font-extrabold text-[10px] inline-flex items-center gap-1 hover:bg-zinc-50 transition-all active:scale-95 shadow-xs cursor-pointer"
                                        title="Edit stock item"
                                      >
                                        <Edit3 className="size-3 text-zinc-500" /> Edit
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr className="bg-zinc-50/60">
                                    <td colSpan={currentProductColumns.length} className="px-6 py-3">
                                      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
                                        {entries.length === 0 ? (
                                          <div className="text-zinc-400 text-xs py-3 px-4 text-center font-medium">No active sub-entries.</div>
                                        ) : (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs font-semibold">
                                              <thead>
                                                <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                                                  <th className="py-2.5 px-4">Entry ID</th>
                                                  <th className="py-2.5 px-4">Voucher No</th>
                                                  <th className="py-2.5 px-4">Customer</th>
                                                  <th className="py-2.5 px-4">Plate No</th>
                                                  <th className="py-2.5 px-4">Entry Date</th>
                                                  <th className="py-2.5 px-4">Leave Date</th>
                                                  <th className="py-2.5 px-4 text-right">Qty Received</th>
                                                  <th className="py-2.5 px-4 text-right">Qty Remaining</th>
                                                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                                                  <th className="py-2.5 px-4 text-center">Actions</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-zinc-150">
                                                {entries.map((entry) => (
                                                  <tr key={entry.entryId} className="hover:bg-zinc-50 transition-colors">
                                                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-600 font-bold">{entry.entryId}</td>
                                                    <td className="py-2.5 px-4 font-mono text-rose-700 font-bold">{entry.voucherNo ? `No. ${entry.voucherNo}` : "—"}</td>
                                                    <td className="py-2.5 px-4 font-bold text-zinc-800">{entry.customer || "—"}</td>
                                                    <td className="py-2.5 px-4 font-mono text-zinc-600">{entry.plateNumber || "—"}</td>
                                                    <td className="py-2.5 px-4 font-mono text-zinc-800">{entry.entryDate || prod.entryDate || "—"}</td>
                                                    <td className="py-2.5 px-4 font-mono text-zinc-500">{entry.leaveDate || "—"}</td>
                                                    <td className="py-2.5 px-4 text-right font-mono text-zinc-700">{entry.quantityReceived.toLocaleString()}</td>
                                                    <td className="py-2.5 px-4 text-right font-mono text-zinc-950 font-black">{entry.quantityRemaining.toLocaleString()}</td>
                                                    <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-bold">ETB {money(entry.unitPrice)}</td>
                                                    <td className="py-2.5 px-4 text-center">
                                                      <button
                                                        type="button"
                                                        onClick={() => openEditSubEntry(prod, entry)}
                                                        className="px-2.5 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 text-[10px] font-extrabold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                                        title="Edit sub-entry details"
                                                      >
                                                        <Edit3 className="size-3 text-zinc-500" /> Edit
                                                      </button>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          }

                          // Standard / WH2 / WH3 Warehouse rendering (Unified Bin Card parent-child row)
                          const binEntries = prod.binCardEntries || []
                          const totalReceived = binEntries.reduce((sum, e) => sum + Number(e.qtyReceived || 0), 0)
                          const totalIssued = binEntries.reduce((sum, e) => sum + Number(e.qtyIssued || 0), 0)
                          const currentBalance = binEntries.length > 0 ? binEntries[binEntries.length - 1].balance : prod.quantity

                          return (
                            <Fragment key={prod.id}>
                              <tr
                                onClick={() => toggleRowExpand(prod.id)}
                                className="hover:bg-white/45 cursor-pointer transition-colors text-xs border-b border-zinc-100 font-semibold"
                              >
                                {/* SKU / Card No with expand toggle */}
                                <td className="py-4 px-4 overflow-hidden">
                                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 font-bold uppercase">
                                    <button 
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleRowExpand(prod.id) }} 
                                      className="p-1 hover:bg-zinc-100 rounded-md"
                                    >
                                      {isExpanded ? <ChevronDown className="size-3 text-zinc-800" /> : <ChevronRight className="size-3 text-zinc-400" />}
                                    </button>
                                    <span className="truncate">{prod.sku}</span>
                                  </div>
                                </td>

                                {/* Item name */}
                                <td className="py-4 px-4 font-black text-zinc-950 leading-tight">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">{prod.name}</span>
                                    {binEntries.length > 0 && (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[9px] font-black text-emerald-800 border border-emerald-100 shrink-0">
                                        {binEntries.length} {binEntries.length === 1 ? "entry" : "entries"}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Dosage */}
                                <td className="py-4 px-4 font-bold text-zinc-600 truncate">{prod.dosage || "—"}</td>

                                {/* Shelf Number */}
                                <td className="py-4 px-4 font-mono font-bold text-zinc-600 truncate">{prod.shelfNo || "—"}</td>

                                {/* MFG */}
                                <td className="py-4 px-4 font-mono text-zinc-600">{displayDate(prod.manufacturingDate)}</td>

                                {/* EXP */}
                                <td className="py-4 px-4 font-mono">
                                  {(() => {
                                    const status = getExpiryStatus(prod.expiry, 90)
                                    if (status.tier === "UNKNOWN") {
                                      return <span className="text-zinc-400 font-bold text-[11px]">—</span>
                                    }
                                    return (
                                      <div className="flex flex-col gap-0.5 min-w-[90px]">
                                        <span className="font-bold text-zinc-800 text-[11px]">{displayDate(prod.expiry)}</span>
                                        <span
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] border font-black truncate max-w-[110px] ${status.badgeClass}`}
                                          title={status.sublabel}
                                        >
                                          <span className={`size-1.5 rounded-full shrink-0 ${status.dotClass}`} />
                                          <span className="truncate">{status.label}</span>
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </td>

                                {/* Cartons */}
                                <td className="py-4 px-4 text-right font-mono font-bold text-zinc-700">{prod.numberOfCartons?.toLocaleString() || "—"}</td>

                                {/* Quantity Per Pack */}
                                <td className="py-4 px-4 text-right font-mono font-bold text-zinc-700">{prod.quantityPerPack?.toLocaleString() || "—"}</td>

                                {/* Total Quantity */}
                                <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                  <div>{currentBalance.toLocaleString()}</div>
                                  {binEntries.length > 0 && (
                                    <div className="text-[9px] text-zinc-400 font-bold">+{totalReceived.toLocaleString()} / -{totalIssued.toLocaleString()}</div>
                                  )}
                                </td>

                                {/* Packaging Unit */}
                                <td className="py-4 px-4 font-bold text-zinc-600 uppercase">{prod.unit}</td>

                                {/* Total Stock Value (Aggregate across all child batches) */}
                                <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                  ETB {money(prod.totalStockValue || 0)}
                                </td>

                                {/* Actions */}
                                <td className="py-4 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setBinEntryModal({ isOpen: true, product: prod, entry: null })}
                                      className="px-2.5 py-1.5 rounded-full bg-zinc-950 text-white font-extrabold text-[10px] inline-flex items-center gap-1 hover:bg-zinc-800 transition-all active:scale-95 shadow-xs cursor-pointer"
                                      title="Record Stock Movement"
                                    >
                                      <PlusCircle className="size-3" /> Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPrintModalProduct(prod)}
                                      className="px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-extrabold text-[10px] inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer"
                                      title="Print & Export Bin Card"
                                    >
                                      <Download className="size-3 text-zinc-500" /> Export
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditProduct(prod)}
                                      className="px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-extrabold text-[10px] inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer"
                                      title="Edit stock item"
                                    >
                                      <Edit3 className="size-3 text-zinc-500" /> Edit
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Sub-table */}
                              {isExpanded && (
                                <tr className="bg-zinc-50/60">
                                  <td colSpan={currentProductColumns.length} className="px-6 py-3">
                                    <StockBinCardLedger
                                      product={prod}
                                      onEditEntry={(product, entry) => setBinEntryModal({ isOpen: true, product, entry })}
                                    />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </TableScrollWrapper>

                {!isLoading && sortedStockProducts.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                    <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                      <span>
                        Showing {Math.min((stockPage - 1) * stockPageSize + 1, sortedStockProducts.length)} to {Math.min(stockPage * stockPageSize, sortedStockProducts.length)} of {sortedStockProducts.length} entries
                      </span>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                        <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                        <select
                          value={stockPageSize}
                          onChange={(e) => {
                            setStockPageSize(Number(e.target.value))
                            setStockPage(1)
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
                        disabled={stockPage === 1}
                        onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                        Page {stockPage} of {totalStockPages}
                      </span>
                      <button
                        type="button"
                        disabled={stockPage >= totalStockPages}
                        onClick={() => setStockPage((p) => p + 1)}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {activeTab === "Store Transfer" && (
            <motion.div
              key="store-transfers-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <StoreTransfersTab />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* MODAL: EDIT PRODUCT DETAILS */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
              onClick={() => setEditingProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl z-[121]"
            >
              <EditModalHeader
                title={`Edit Stock Details: ${editingProduct.name}`}
                subtitle={`SKU: ${editingProduct.sku}`}
                onClose={() => setEditingProduct(null)}
                onRequestDelete={() => setDeletingProduct(editingProduct)}
                deleteLabel="Delete Stock Product"
              />

              <div className="grid gap-4 md:grid-cols-2 mt-4 text-xs font-semibold">
                <label className="space-y-1">
                  <span className="block text-[11px] font-black uppercase text-zinc-500">Item Name</span>
                  <input value={editForm.name} onChange={(e) => updateEditForm({ name: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs" />
                </label>
                <label className="space-y-1">
                  <span className="block text-[11px] font-black uppercase text-zinc-500">SKU</span>
                  <input value={editForm.sku} onChange={(e) => updateEditForm({ sku: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                </label>
                <label className="space-y-1">
                  <span className="block text-[11px] font-black uppercase text-zinc-500">Warehouse</span>
                  <select value={editForm.warehouse} onChange={(e) => updateEditForm({ warehouse: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs">
                    {warehouseOptions.filter(w => w.value !== "ALL").map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </label>
                
                {!isWH1(editForm.warehouse) && (
                  <>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Strength / Dosage</span>
                      <input 
                        value={editForm.dosage || ""} 
                        placeholder="e.g. 100ml Vial / 500mg" 
                        onChange={(e) => updateEditForm({ dosage: e.target.value })} 
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs" 
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Shelf Number</span>
                      <input 
                        value={editForm.shelfNo || ""} 
                        placeholder="e.g. Shelf A-04" 
                        onChange={(e) => updateEditForm({ shelfNo: e.target.value })} 
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" 
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Batch Number</span>
                      <input value={editForm.batch} onChange={(e) => updateEditForm({ batch: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                    </label>
                  </>
                )}

                {isWH1(editForm.warehouse) ? (
                  <>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Voucher No / ID (Optional)</span>
                      <input 
                        type="text" 
                        placeholder="e.g. 1251" 
                        value={editForm.voucherNo || ""} 
                        onChange={(e) => updateEditForm({ voucherNo: e.target.value })} 
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" 
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Customer (Optional)</span>
                      <input 
                        type="text" 
                        placeholder="e.g. Samii" 
                        value={editForm.customer || ""} 
                        onChange={(e) => updateEditForm({ customer: e.target.value })} 
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs" 
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Plate Number (Optional)</span>
                      <input 
                        type="text" 
                        placeholder="e.g. A52735" 
                        value={editForm.plateNumber || ""} 
                        onChange={(e) => updateEditForm({ plateNumber: e.target.value })} 
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" 
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Entry Date</span>
                      <input type="date" value={editForm.entryDate} onChange={(e) => updateEditForm({ entryDate: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Leave Date <span className="text-[10px] text-zinc-400 font-semibold lowercase">(optional)</span></span>
                      <input type="date" value={editForm.leaveDate} onChange={(e) => updateEditForm({ leaveDate: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                    </label>
                  </>
                ) : (
                  <label className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="block text-[11px] font-black uppercase text-zinc-500">Expiry Date</span>
                      {editForm.expiry && (() => {
                        const s = getExpiryStatus(editForm.expiry)
                        if (s.tier !== "UNKNOWN") {
                          return (
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${s.badgeClass}`}>
                              {s.label}
                            </span>
                          )
                        }
                        return null
                      })()}
                    </div>
                    <input type="date" value={editForm.expiry} onChange={(e) => updateEditForm({ expiry: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                  </label>
                )}
                
                <label className="space-y-1">
                  <span className="block text-[11px] font-black uppercase text-zinc-500">{isWH1(editForm.warehouse) ? "UOM" : "Unit"}</span>
                  <select 
                    value={editForm.unit} 
                    onChange={(e) => updateEditForm({ unit: e.target.value })} 
                    className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {isWH1(editForm.warehouse) ? (
                      <>
                        <option value="Quintal">Quintal</option>
                        <option value="Ton">Ton</option>
                      </>
                    ) : (
                      <>
                        <option value="Box">Box</option>
                        <option value="Bottle">Bottle</option>
                        <option value="Vial">Vial</option>
                        <option value="Sachet">Sachet</option>
                      </>
                    )}
                  </select>
                </label>

                {!isWH1(editForm.warehouse) && (
                  <label className="space-y-1">
                    <span className="block text-[11px] font-black uppercase text-zinc-500">Unit Price (ETB)</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editForm.unitCost}
                      onChange={(e) => updateEditForm({ unitCost: e.target.value, sellingPrice: e.target.value, price: e.target.value })}
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs"
                      placeholder="e.g. 150"
                    />
                  </label>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingProduct(null)}
                  className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-black disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => void handleSaveProductDetails()}
                  className="h-10 min-w-[130px] inline-flex items-center justify-center rounded-xl bg-zinc-950 hover:bg-zinc-800 px-5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {isSavingEdit ? <LoadingDots color="bg-white" size="sm" /> : "Save Stock Details"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD NEW STOCK ITEM / ENTRY */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-200">
                <div>
                  <h3 className="text-xl font-black text-zinc-900">
                    {selectedExistingProduct ? `Add Entry to Existing Item: ${selectedExistingProduct.name}` : "Add Stock Item"}
                  </h3>
                  <p className="text-xs text-zinc-500">Register new product inventory into warehouse stock.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); resetAddForm() }}
                  className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid gap-4 md:grid-cols-2 font-semibold">
                  <div className="space-y-1 md:col-span-2 relative">
                    <span className="text-[11px] font-black uppercase text-zinc-700">
                      Item Name / Description of Goods <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Sesame Seed (White)"
                      value={addDescription}
                      disabled={!!selectedExistingProduct}
                      onChange={(e) => {
                        setAddDescription(e.target.value)
                        setShowItemSuggestions(true)
                      }}
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500"
                    />

                    {/* Auto-complete Suggestions Dropdown */}
                    {showItemSuggestions && isWH1Form && wh1ItemSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-150 bg-white p-2 shadow-xl">
                        {wh1ItemSuggestions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedExistingProduct(p)
                              setAddDescription(p.name)
                              setAddPackagingUnit(p.unit)
                              setShowItemSuggestions(false)
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-50 flex items-center justify-between text-xs font-bold"
                          >
                            <span className="text-zinc-900">{p.name}</span>
                            <span className="text-[10px] text-zinc-400">{p.quantity} Q left</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {warehouseRecords.length > 1 ? (
                    <label className="space-y-1">
                      <span className="text-[11px] font-black uppercase text-zinc-700">Primary Warehouse <span className="text-rose-600">*</span></span>
                      <select
                        value={addWarehouse}
                        disabled={!!selectedExistingProduct}
                        onChange={(e) => {
                          setAddWarehouse(e.target.value)
                          setAddPackagingUnit("")
                          setAddQuantity("")
                        }}
                        className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">Select Warehouse...</option>
                        {warehouseRecords.map((item) => (
                          <option key={item.id} value={item.code || item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-[11px] font-black uppercase text-zinc-700">Assigned Facility</span>
                      <div className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 flex items-center text-xs font-bold text-zinc-800 font-mono">
                        {warehouseRecords[0]?.name || warehouseRecords[0]?.code}
                      </div>
                    </div>
                  )}

                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700">
                      {isWH1Form ? "UOM" : "Packaging Unit"} <span className="text-rose-600">*</span>
                    </span>
                    <select
                      value={addPackagingUnit}
                      disabled={!!selectedExistingProduct}
                      onChange={(e) => setAddPackagingUnit(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">{isWH1Form ? "Select UOM" : "Select packaging unit"}</option>
                      {isWH1Form ? (
                        <>
                          <option value="Quintal">Quintal</option>
                          <option value="Ton">Ton</option>
                        </>
                      ) : (
                        packagingUnits.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))
                      )}
                    </select>
                  </label>

                  {!isWH1Form && (
                    <>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Strength / Dosage <span className="text-[10px] text-zinc-400 font-semibold lowercase">(optional)</span></span>
                        <input
                          type="text"
                          placeholder="e.g. 100ml Vial / 500mg"
                          value={addDosage}
                          onChange={(e) => setAddDosage(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Shelf Number <span className="text-[10px] text-zinc-400 font-semibold lowercase">(optional)</span></span>
                        <input
                          type="text"
                          placeholder="e.g. Shelf A-04 / Bin 12"
                          value={addShelfNo}
                          onChange={(e) => setAddShelfNo(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Batch Number <span className="text-rose-600">*</span></span>
                        <input
                          type="text"
                          placeholder="BATCH-001"
                          value={addBatchNumber}
                          onChange={(e) => setAddBatchNumber(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                        />
                      </label>
                    </>
                  )}

                  <label className="space-y-1">
                    <span className="text-[11px] font-black uppercase text-zinc-700">Price per unit (ETB)</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={addUnitPrice}
                      onChange={(e) => setAddUnitPrice(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                    />
                  </label>

                  {isWH1Form ? (
                    <>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Voucher No / ID <span className="text-[10px] text-zinc-400 lowercase">(optional)</span></span>
                        <input
                          type="text"
                          placeholder="e.g. 1251"
                          value={addVoucherNo}
                          onChange={(e) => setAddVoucherNo(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Customer <span className="text-[10px] text-zinc-400 lowercase">(optional)</span></span>
                        <input
                          type="text"
                          placeholder="e.g. Samii"
                          value={addCustomer}
                          onChange={(e) => setAddCustomer(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Plate Number <span className="text-[10px] text-zinc-400 lowercase">(optional)</span></span>
                        <input
                          type="text"
                          placeholder="e.g. A52735"
                          value={addPlateNumber}
                          onChange={(e) => setAddPlateNumber(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Entry Date <span className="text-rose-600">*</span></span>
                        <input
                          type="date"
                          value={addEntryDate}
                          onChange={(e) => setAddEntryDate(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Quantity <span className="text-rose-600">*</span></span>
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          value={addQuantity}
                          onChange={(e) => setAddQuantity(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Notes <span className="text-[10px] text-zinc-400 lowercase">(optional)</span></span>
                        <input
                          type="text"
                          placeholder="e.g. Received from exporter"
                          value={addNotes}
                          onChange={(e) => setAddNotes(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Manufacturing Date <span className="text-rose-600">*</span></span>
                        <input type="date" value={addMfgDate} onChange={(e) => setAddMfgDate(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                      </label>
                      <label className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase text-zinc-700">Expiry Date <span className="text-rose-600">*</span></span>
                          {addExpDate && (() => {
                            const s = getExpiryStatus(addExpDate)
                            if (s.tier !== "UNKNOWN") {
                              return (
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${s.badgeClass}`}>
                                  {s.label}
                                </span>
                              )
                            }
                            return null
                          })()}
                        </div>
                        <input type="date" value={addExpDate} onChange={(e) => setAddExpDate(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Quantity Per Pack <span className="text-rose-600">*</span></span>
                        <input type="number" placeholder="100" value={addQtyPerPack} onChange={(e) => setAddQtyPerPack(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-black uppercase text-zinc-700">Number of Cartons <span className="text-rose-600">*</span></span>
                        <input type="number" placeholder="50" value={addNumCartons} onChange={(e) => setAddNumCartons(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" />
                      </label>
                    </>
                  )}
                </div>

                {isWH1Form && addPackagingUnit === "Ton" && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 p-3 text-[11px] font-bold">
                    Note: 1 Ton = 10 Quintals. Entering {addQuantity || 0} Tons will save as {(Number(addQuantity || 0) * TON_TO_QUINTAL).toLocaleString()} Quintals in the database.
                  </p>
                )}

                {addDateInvalid && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 font-bold">
                    {isWH1Form ? "Leave date must be after entry date." : "Expiry date must be after manufacturing date."}
                  </p>
                )}

                {addDuplicateBatch && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 font-bold">
                    Batch number already exists.
                  </p>
                )}

                <div className="flex justify-between items-center border-t border-zinc-200 pt-4 mt-6">
                  {selectedExistingProduct && (
                    <button 
                      type="button" 
                      onClick={() => setSelectedExistingProduct(null)} 
                      className="text-xs font-black text-emerald-700 hover:underline"
                    >
                      ← Create new item instead
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => { setIsAddModalOpen(false); resetAddForm() }}
                      className="h-10 rounded-full border border-zinc-200 px-4 font-bold text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!canSaveAdd || isSavingAdd}
                      onClick={() => void handleSaveNewStockItem(true)}
                      className="h-10 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 font-bold disabled:opacity-40"
                    >
                      Save & Add Another
                    </button>
                    <button
                      type="button"
                      disabled={!canSaveAdd || isSavingAdd}
                      onClick={() => void handleSaveNewStockItem(false)}
                      className="h-10 min-w-[110px] inline-flex items-center justify-center rounded-full bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingAdd ? <LoadingDots color="bg-white" size="sm" /> : "Save Item"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SLIM ADD ENTRY MODAL */}
      <AnimatePresence>
        {slimAddEntryProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-150">
                <div>
                  <h3 className="font-black text-zinc-900 text-base">Add New Entry to {slimAddEntryProduct.name}</h3>
                  <p className="text-xs text-zinc-500">Record a new daily batch receipt into stock.</p>
                </div>
                <button onClick={() => setSlimAddEntryProduct(null)} className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400"><X className="size-5" /></button>
              </div>

              <div className="space-y-4 text-xs font-semibold">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Voucher No / ID (Optional)</span>
                    <input 
                      type="text" 
                      placeholder="e.g. 1251" 
                      value={addVoucherNo} 
                      onChange={(e) => setAddVoucherNo(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Customer (Optional)</span>
                    <input 
                      type="text" 
                      placeholder="e.g. Samii" 
                      value={addCustomer} 
                      onChange={(e) => setAddCustomer(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Plate Number (Optional)</span>
                    <input 
                      type="text" 
                      placeholder="e.g. A52735" 
                      value={addPlateNumber} 
                      onChange={(e) => setAddPlateNumber(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">UOM</span>
                    <select 
                      value={addPackagingUnit} 
                      onChange={(e) => setAddPackagingUnit(e.target.value)} 
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
                      placeholder="Quantity" 
                      value={addQuantity} 
                      onChange={(e) => setAddQuantity(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Unit Price (ETB)</span>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={addUnitPrice} 
                      onChange={(e) => setAddUnitPrice(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Entry Date</span>
                    <input 
                      type="date" 
                      value={addEntryDate} 
                      onChange={(e) => setAddEntryDate(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Notes (Optional)</span>
                    <input 
                      type="text" 
                      placeholder="Notes" 
                      value={addNotes} 
                      onChange={(e) => setAddNotes(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                    />
                  </label>
                </div>

                {addPackagingUnit === "Ton" && (
                  <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-100 p-2 rounded-lg">
                    Converts automatically: {addQuantity || 0} Tons = {(Number(addQuantity || 0) * TON_TO_QUINTAL).toLocaleString()} Quintals.
                  </p>
                )}

                <div className="flex justify-end gap-2 border-t border-zinc-150 pt-4 mt-6">
                  <button 
                    type="button"
                    disabled={isSavingAdd}
                    onClick={() => setSlimAddEntryProduct(null)} 
                    className="h-9 rounded-xl border border-zinc-200 px-4 text-xs font-bold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    disabled={isSavingAdd} 
                    onClick={handleSaveSlimEntry} 
                    className="h-9 min-w-[100px] inline-flex items-center justify-center rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white px-5 text-xs font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSavingAdd ? <LoadingDots color="bg-white" size="sm" /> : "Add Entry"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT WH1 SUB ENTRY MODAL */}
      <AnimatePresence>
        {editingSubEntry && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-zinc-200"
            >
              <EditModalHeader
                title={`Edit Entry: ${editingSubEntry.entry.entryId}`}
                subtitle={`Product: ${editingSubEntry.product.name}`}
                onClose={() => setEditingSubEntry(null)}
                onRequestDelete={() => {
                  handleDeleteSubEntry(editingSubEntry.product, editingSubEntry.entry.entryId)
                  setEditingSubEntry(null)
                }}
                deleteLabel="Delete This Entry"
              />

              <div className="space-y-4 text-xs font-semibold">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Voucher No / ID (Optional)</span>
                    <input 
                      type="text" 
                      placeholder="e.g. 1251" 
                      value={editSubEntryVoucherNo} 
                      onChange={(e) => setEditSubEntryVoucherNo(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Customer (Optional)</span>
                    <input 
                      type="text" 
                      placeholder="e.g. Samii" 
                      value={editSubEntryCustomer} 
                      onChange={(e) => setEditSubEntryCustomer(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Plate Number (Optional)</span>
                    <input 
                      type="text" 
                      placeholder="e.g. A52735" 
                      value={editSubEntryPlateNumber} 
                      onChange={(e) => setEditSubEntryPlateNumber(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Quantity (Received)</span>
                    <input 
                      type="number" 
                      value={editSubEntryQty} 
                      onChange={(e) => setEditSubEntryQty(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Unit Price (ETB)</span>
                    <input 
                      type="number" 
                      value={editSubEntryPrice} 
                      onChange={(e) => setEditSubEntryPrice(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Entry Date</span>
                    <input 
                      type="date" 
                      value={editSubEntryDate} 
                      onChange={(e) => setEditSubEntryDate(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Leave Date (Optional)</span>
                    <input 
                      type="date" 
                      value={editSubEntryLeave} 
                      onChange={(e) => setEditSubEntryLeave(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block md:col-span-2">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Notes (Optional)</span>
                    <input 
                      type="text" 
                      value={editSubEntryNotes} 
                      onChange={(e) => setEditSubEntryNotes(e.target.value)} 
                      className="h-10 w-full border border-zinc-200 rounded-xl px-3"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-zinc-150 pt-4 mt-6">
                  <button 
                    type="button"
                    disabled={isSavingSubEdit}
                    onClick={() => setEditingSubEntry(null)} 
                    className="h-9 rounded-xl border border-zinc-200 px-4 text-xs font-bold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    disabled={isSavingSubEdit} 
                    onClick={handleSaveSubEntryEdit} 
                    className="h-9 min-w-[110px] inline-flex items-center justify-center rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white px-5 text-xs font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSavingSubEdit ? <LoadingDots color="bg-white" size="sm" /> : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: BIN CARD MOVEMENT ENTRY (WH2 / WH3) */}
      <StockBinEntryModal
        isOpen={binEntryModal.isOpen}
        product={binEntryModal.product}
        entry={binEntryModal.entry}
        onClose={() => setBinEntryModal({ isOpen: false, product: null, entry: null })}
        onSave={handleSaveBinEntry}
        onDelete={handleDeleteBinEntry}
      />

      {/* MODAL: BIN CARD PRINT & EXPORT (WH2 / WH3) */}
      <StockBinCardPrintModal
        isOpen={!!printModalProduct}
        product={printModalProduct}
        onClose={() => setPrintModalProduct(null)}
      />

      {/* MODAL: GOODS RECEIVING VOUCHER PRINT & EXPORT (WH1) */}
      <WH1ReceivingVoucherPrintModal
        isOpen={wh1VoucherModal.isOpen}
        product={wh1VoucherModal.product}
        onClose={() => setWh1VoucherModal({ isOpen: false, product: null })}
      />

      {/* MODAL: DELETE PRODUCT */}
      <RecordDeleteModal
        isOpen={!!deletingProduct}
        title="Delete Stock Item?"
        recordId={deletingProduct?.sku}
        recordName={deletingProduct?.name}
        description="This will permanently delete this stock product and all associated movement ledger records from the inventory registry. This action is irreversible."
        onClose={() => setDeletingProduct(null)}
        onConfirmDelete={handleDeleteProductConfirm}
      />
    </div>
  )
}
