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
import QuarantineTab from "@/components/stock/QuarantineTab"
import { useErpStore, type Product, type WH1Entry, type BinCardMovementEntry } from "@/lib/erpStore"
import {
  withOperatingWarehouses,
  resolveWarehouseScope,
  isWarehouseInScope,
  isProductInWarehouseScope,
  isExportWarehouse,
  isPharmaWarehouse,
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
import WH1ChildMovementLedger from "@/components/stock/WH1ChildMovementLedger"
import WH1AddMovementModal from "@/components/stock/WH1AddMovementModal"
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
  quantityPerPack?: string
  numberOfCartons?: string
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
  const isWH1 = (w: string) => isExportWarehouse(w, allWarehouses)

  const hasCommercialStoreAccess =
    !isInventoryAdminOnly ||
    resolvedWarehouseIds.length === 0 ||
    resolvedWarehouseIds.some((id) => isPharmaWarehouse(id, allWarehouses))

  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get("search") || ""
  const [activeTab, setActiveTab] = useState<"Register" | "Store Transfer" | "Quarantine">("Register")

  const defaultWarehouse = (isInventoryAdminOnly && warehouseRecords.length === 1)
    ? (warehouseRecords[0].code || warehouseRecords[0].id)
    : "ALL"
  const [selectedWarehouse, setSelectedWarehouse] = useState(defaultWarehouse)

  useEffect(() => {
    void erp.loadInventoryData()
  }, [])

  useEffect(() => {
    if (!hasCommercialStoreAccess && activeTab !== "Register") {
      setActiveTab("Register")
    }
  }, [hasCommercialStoreAccess, activeTab])

  const [searchQuery, setSearchQuery] = useState(initialSearch)
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
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [saveSupplierToRegistry, setSaveSupplierToRegistry] = useState(false)
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
  const [showEditSubSupplierDropdown, setShowEditSubSupplierDropdown] = useState(false)
  const [editSubEntryPlateNumber, setEditSubEntryPlateNumber] = useState("")
  const [editSubEntryQty, setEditSubEntryQty] = useState("")
  const [editSubEntryPrice, setEditSubEntryPrice] = useState("")
  const [editSubEntryDate, setEditSubEntryDate] = useState("")
  const [editSubEntryLeave, setEditSubEntryLeave] = useState("")
  const [editSubEntryNotes, setEditSubEntryNotes] = useState("")
  const [isSavingSubEdit, setIsSavingSubEdit] = useState(false)
  const [showEditParentSupplierDropdown, setShowEditParentSupplierDropdown] = useState(false)

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
    setShowSupplierDropdown(false)
    setSaveSupplierToRegistry(false)
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
      value: warehouse.id || warehouse.code,
      label: warehouse.name || warehouse.code || warehouse.id,
    })),
  ], [warehouseRecords])

  const warehouseKeyMap = useMemo(() => new Map(warehouseRecords.map((warehouse) => [warehouse.id || warehouse.code, new Set([warehouse.id, warehouse.code, warehouse.name].filter(Boolean))])), [warehouseRecords])

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
      const name = (prod.name || "").toLowerCase()
      const sku = (prod.sku || "").toLowerCase()
      const dosage = (prod.dosage || "").toLowerCase()
      const shelfNo = (prod.shelfNo || "").toLowerCase()
      const batch = (prod.batch || "").toLowerCase()
      const q = searchQuery.toLowerCase()

      const matchesSearch = name.includes(q) || sku.includes(q) || dosage.includes(q) || shelfNo.includes(q) || batch.includes(q)
      const selectedWarehouseKeys = warehouseKeyMap.get(selectedWarehouse) || new Set([selectedWarehouse])
      const sb = Array.isArray(prod.stockBreakdown) && prod.stockBreakdown.length > 0
        ? prod.stockBreakdown
        : [{ warehouse: prod.warehouse || "WH1", qty: prod.quantity || 0 }]

      const matchesWarehouse =
        selectedWarehouse === "ALL" ||
        selectedWarehouseKeys.has(prod.warehouse) ||
        sb.some((breakdown) => selectedWarehouseKeys.has(breakdown.warehouse))

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

    if (selectedWarehouse === "ALL") {
      cols.push(
        { key: "warehouse", label: "Warehouse", align: "left" },
        { key: "details", label: "Supplier / Dosage", align: "left" },
        { key: "cartons", label: "Cartons / Plate", align: "left" },
        { key: "quantity", label: "Total Quantity", align: "right" },
        { key: "unit", label: "UOM / Unit", align: "left" },
        { key: "totalStockValue", label: "Stock Value", align: "right" }
      )
    } else if (isWH1(selectedWarehouse)) {
      cols.push(
        { key: "voucherNo", label: "Voucher No", align: "left" },
        { key: "customer", label: "Supplier", align: "left" },
        { key: "plateNumber", label: "Plate No", align: "left" },
        { key: "quantity", label: "Total Quantity", align: "right" },
        { key: "unit", label: "UOM", align: "left" },
        { key: "totalStockValue", label: "Stock Value", align: "right" }
      )
    } else {
      cols.push(
        { key: "dosage", label: "Strength / Dosage", align: "left" },
        { key: "shelfNo", label: "Shelf Number", align: "left" },
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
    warehouse: 100,
    details: 140,
    cartons: 110,
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
      if (isWH1Form && saveSupplierToRegistry && addCustomer.trim()) {
        const suppName = addCustomer.trim()
        const existingSupp = erp.getSuppliers().find((s) => s.name.toLowerCase() === suppName.toLowerCase())
        if (!existingSupp) {
          erp.addSupplier({
            id: `SUP-${Date.now()}`,
            name: suppName,
            country: "Ethiopia",
            status: "Active",
          })
        }
      }

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

  // Handle saving direct slim sub-entry modal (WH1)
  const handleSaveWH1Entry = async (productId: string, entryData: Omit<WH1Entry, "entryId">) => {
    await erp.addWH1Entry(productId, entryData)
  }

  const handleSaveWH1Leave = async (
    productId: string,
    leaveData: {
      date: string
      voucherNo?: string
      party: string
      plateNumber?: string
      quantityIssued: number
      remark?: string
      unitPrice?: number
    }
  ) => {
    await erp.addWH1LeaveEntry(productId, leaveData)
  }

  const handleSaveWH1Reject = async (
    productId: string,
    rejectData: {
      date: string
      rejectQuantity: number
      party?: string
    }
  ) => {
    await erp.addWH1RejectEntry(productId, rejectData)
  }

  // Handle Edit/Delete Sub Entry
  const openEditSubEntry = (product: Product, entry: WH1Entry) => {
    setEditingSubEntry({ product, entry })
    setEditSubEntryVoucherNo(entry.voucherNo || "")
    setEditSubEntryCustomer(entry.customer || "")
    setShowEditSubSupplierDropdown(false)
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
    setShowEditParentSupplierDropdown(false)
    const whRecord = allWarehouses.find(
      (w) => w.id === product.warehouse || w.code === product.warehouse || w.name === product.warehouse
    )
    const resolvedWarehouse = whRecord?.id || product.warehouse || (isWH1(product.warehouse) ? "WH1" : "WH2")
    const isWh1 = isWH1(resolvedWarehouse)

    setEditForm({
      name: product.name,
      sku: product.sku,
      voucherNo: product.voucherNo || (product.wh1Entries?.[0]?.voucherNo || ""),
      customer: product.customer || (product.wh1Entries?.[0]?.customer || ""),
      plateNumber: product.plateNumber || (product.wh1Entries?.[0]?.plateNumber || ""),
      dosage: product.dosage || (product as any).strength || (product as any).dosage_form || "",
      shelfNo: product.shelfNo || (product as any).shelf_number || (product as any).shelf_no || "",
      category: product.category || "",
      warehouse: resolvedWarehouse,
      batch: product.batch || (product.batches?.[0]?.batchNo || ""),
      expiry: product.expiry || (product.batches?.[0]?.expiry || ""),
      entryDate: product.entryDate || "",
      leaveDate: product.leaveDate || "",
      quantityPerPack: String(product.quantityPerPack || (product as any).quantity_per_pack || 1),
      numberOfCartons: String(product.numberOfCartons || (product as any).number_of_cartons || 0),
      unit: product.unit || (isWh1 ? "Quintal" : "Box"),
      unitCost: String(product.unitCost || 0),
      sellingPrice: String(product.sellingPrice || 0),
      price: isWh1 ? String(product.unitCost || 0) : "",
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
    const warehouse = editForm.warehouse
    const isWh1 = isWH1(warehouse)
    const voucherNo = isWh1 ? (editForm.voucherNo?.trim() || undefined) : undefined
    const customer = isWh1 ? (editForm.customer?.trim() || undefined) : undefined
    const plateNumber = isWh1 ? (editForm.plateNumber?.trim() || undefined) : undefined
    const dosage = isWh1 ? undefined : (editForm.dosage?.trim() || undefined)
    const shelfNo = isWh1 ? undefined : (editForm.shelfNo?.trim() || undefined)
    const batch = isWh1 ? "" : editForm.batch.trim()
    const expiry = isWh1 ? "" : editForm.expiry
    const entryDate = isWh1 ? editForm.entryDate : undefined
    const leaveDate = (isWh1 && editForm.leaveDate) ? editForm.leaveDate : undefined
    const unit = editForm.unit.trim()
    const quantityPerPack = isWh1 ? undefined : (editForm.quantityPerPack ? Number(editForm.quantityPerPack) : undefined)
    const numberOfCartons = isWh1 ? undefined : (editForm.numberOfCartons ? Number(editForm.numberOfCartons) : undefined)
    
    const priceVal = isWh1 ? Number(editForm.price || 0) : Number(editForm.unitCost || 0)
    const unitCost = priceVal
    const sellingPrice = priceVal
    const reorderLevel = editForm.reorderLevel === "" ? undefined : Number(editForm.reorderLevel)

    if (isWh1) {
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

    const selectedWarehouseRecord = warehouseRecords.find((item) => (item.id || item.code) === warehouse || item.code === warehouse)
    const nextBreakdown = editingProduct.stockBreakdown.length
      ? editingProduct.stockBreakdown.map((item, index) => index === 0 ? { ...item, warehouse } : item)
      : [{ warehouse, qty: editingProduct.quantity }]
    const nextBatches = isWh1 ? [] : (editingProduct.batches.length
      ? editingProduct.batches.map((item, index) => index === 0 ? { ...item, batchNo: batch, expiry: expiry || item.expiry } : item)
      : [{ batchNo: batch || "BATCH-01", qty: editingProduct.quantity, expiry: expiry || "", status: "Released" as const }])

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
        quantityPerPack,
        numberOfCartons,
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
              { id: "Quarantine", label: "Quarantine" },
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

                          // WH1 entries and calculations
                          const wh1Entries = prod.wh1Entries || []
                          const wh1TotalReceived = wh1Entries.reduce((sum, e) => sum + Number(e.quantityReceived || 0), 0)

                          // Pharma bin card calculations
                          const binEntries = prod.binCardEntries || []
                          const pharmaTotalReceived = binEntries.reduce((sum, e) => sum + Number(e.qtyReceived || 0), 0)
                          const pharmaTotalIssued = binEntries.reduce((sum, e) => sum + Number(e.qtyIssued || 0), 0)
                          const pharmaBalance = binEntries.length > 0
                            ? Number(binEntries[binEntries.length - 1].balance ?? 0)
                            : (Array.isArray(prod.batches) && prod.batches.length > 0)
                              ? prod.batches.reduce((sum, b) => sum + Number(b.qty ?? (b as any).quantity ?? 0), 0)
                              : Number(prod.quantity ?? 0)
                          const packSize = Number(prod.quantityPerPack || (prod as any).quantity_per_pack || 0)
                          const explicitCartons = Number(prod.numberOfCartons || (prod as any).number_of_cartons || 0)
                          const computedCartons = explicitCartons > 0 ? explicitCartons : (packSize > 0 ? Math.floor(pharmaBalance / packSize) : 0)

                          const displayQuantity = isWH1Item ? Number(prod.quantity || 0) : pharmaBalance
                          const computedStockValue = Number(prod.totalStockValue || 0) > 0
                            ? Number(prod.totalStockValue)
                            : (isWH1Item
                                ? displayQuantity * Number(prod.unitCost || 0)
                                : (Array.isArray(prod.batches) && prod.batches.length > 0)
                                  ? prod.batches.reduce((sum, b) => sum + (Number(b.qty ?? (b as any).quantity ?? 0) * Number((b as any).unitPrice ?? (prod as any).unitPrice ?? (prod as any).unit_price ?? 0)), 0)
                                  : (displayQuantity * Number((prod as any).unitPrice ?? (prod as any).unit_price ?? prod.unitCost ?? 0)))

                          // 1. ALL Warehouses View
                          if (selectedWarehouse === "ALL") {
                            return (
                              <Fragment key={prod.id}>
                                <tr
                                  onClick={() => toggleRowExpand(prod.id)}
                                  className="hover:bg-white/45 cursor-pointer transition-colors font-semibold text-xs border-b border-zinc-100"
                                >
                                  {/* ID / SKU */}
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

                                  {/* Item Name */}
                                  <td className="py-4 px-4 overflow-hidden font-black text-zinc-950 leading-tight">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate">{prod.name}</span>
                                      {isWH1Item ? (
                                        wh1Entries.length > 0 && (
                                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[9px] font-black text-emerald-800 border border-emerald-100 shrink-0">
                                            {wh1Entries.length} {wh1Entries.length === 1 ? "entry" : "entries"}
                                          </span>
                                        )
                                      ) : (
                                        binEntries.length > 0 && (
                                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[9px] font-black text-emerald-800 border border-emerald-100 shrink-0">
                                            {binEntries.length} {binEntries.length === 1 ? "entry" : "entries"}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </td>

                                  {/* Warehouse Badge */}
                                  <td className="py-4 px-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                      isWH1Item 
                                        ? "bg-amber-50 text-amber-800 border-amber-200" 
                                        : (prod.warehouse === "WH2" || prod.warehouseName?.includes("2"))
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                          : "bg-purple-50 text-purple-800 border-purple-200"
                                    }`}>
                                      {prod.warehouseName || prod.warehouse || (isWH1Item ? "WH1" : "WH2")}
                                    </span>
                                  </td>

                                  {/* Supplier / Dosage */}
                                  <td className="py-4 px-4 font-bold text-zinc-700 truncate max-w-[150px]" title={isWH1Item ? (prod.customer || wh1Entries[0]?.customer || "—") : (prod.dosage || "—")}>
                                    {isWH1Item ? (
                                      <div>
                                        <div className="truncate text-zinc-900">{prod.customer || wh1Entries[0]?.customer || "—"}</div>
                                        {prod.voucherNo && <div className="text-[9px] font-mono text-rose-700">No. {prod.voucherNo}</div>}
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="truncate text-zinc-800">{prod.dosage || "—"}</div>
                                        {prod.shelfNo && <div className="text-[9px] font-mono text-zinc-400">Shelf {prod.shelfNo}</div>}
                                      </div>
                                    )}
                                  </td>

                                  {/* Cartons / Plate */}
                                  <td className="py-4 px-4 font-mono text-[11px] text-zinc-600">
                                    {isWH1Item ? (
                                      <div>{prod.plateNumber || wh1Entries[0]?.plateNumber || "—"}</div>
                                    ) : (
                                      <div>
                                        <div className="font-bold text-zinc-800">{computedCartons > 0 ? `${computedCartons.toLocaleString()} ctn` : (pharmaBalance > 0 ? "0 ctn" : "—")}</div>
                                        {packSize > 0 && <div className="text-[9px] text-zinc-400 font-semibold">{packSize.toLocaleString()}/pack</div>}
                                      </div>
                                    )}
                                  </td>

                                  {/* Total Quantity */}
                                  <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                    <div>{displayQuantity.toLocaleString()}</div>
                                    {isWH1Item ? (
                                      <div className="text-[9px] text-zinc-400 font-bold">of {wh1TotalReceived.toLocaleString()} received</div>
                                    ) : binEntries.length > 0 ? (
                                      <div className="text-[9px] text-zinc-400 font-bold">+{pharmaTotalReceived.toLocaleString()} / -{pharmaTotalIssued.toLocaleString()}</div>
                                    ) : null}
                                  </td>

                                  {/* UOM / Unit */}
                                  <td className="py-4 px-4 font-bold text-zinc-500 uppercase">{prod.unit}</td>

                                  {/* Stock Value */}
                                  <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                    ETB {money(computedStockValue || 0)}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-4 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1.5">
                                      {isWH1Item ? (
                                        <>
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
                                        </>
                                      ) : (
                                        <>
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
                                        </>
                                      )}
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

                                {isExpanded && (
                                  <tr className="bg-zinc-50/60">
                                    <td colSpan={currentProductColumns.length} className="px-6 py-3">
                                      {isWH1Item ? (
                                        <WH1ChildMovementLedger
                                          product={prod}
                                          onEditEntry={openEditSubEntry}
                                        />
                                      ) : (
                                        <StockBinCardLedger
                                          product={prod}
                                          onEditEntry={(product, entry) => setBinEntryModal({ isOpen: true, product, entry })}
                                        />
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          }

                          // 2. WH1 Dedicated Warehouse View
                          if (isWH1Item && isWH1(selectedWarehouse)) {
                            return (
                              <Fragment key={prod.id}>
                                <tr 
                                  onClick={() => toggleRowExpand(prod.id)}
                                  className="hover:bg-white/45 cursor-pointer transition-colors font-semibold text-xs border-b border-zinc-100"
                                >
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
                                      {wh1Entries.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[9px] font-black text-emerald-800 border border-emerald-100">
                                          {wh1Entries.length} {wh1Entries.length === 1 ? "entry" : "entries"}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Voucher No */}
                                  <td className="py-4 px-4 font-mono text-[11px] font-black text-rose-700">
                                    {prod.voucherNo || (wh1Entries[0]?.voucherNo ? `No. ${wh1Entries[0].voucherNo}` : "—")}
                                  </td>

                                  {/* Supplier */}
                                  <td className="py-4 px-4 font-bold text-zinc-900 truncate max-w-[130px]" title={prod.customer || wh1Entries[0]?.customer || "—"}>
                                    {prod.customer || (wh1Entries[0]?.customer || "—")}
                                  </td>

                                  {/* Plate Number */}
                                  <td className="py-4 px-4 font-mono text-[11px] text-zinc-600">
                                    {prod.plateNumber || (wh1Entries[0]?.plateNumber || "—")}
                                  </td>

                                  {/* Total quantity */}
                                  <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                    <div>{displayQuantity.toLocaleString()}</div>
                                    <div className="text-[9px] text-zinc-400 font-bold">of {wh1TotalReceived.toLocaleString()} received</div>
                                  </td>

                                  {/* UOM */}
                                  <td className="py-4 px-4 font-bold text-zinc-500 uppercase">{prod.unit}</td>

                                  {/* Stock Value */}
                                  <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                    <div>ETB {money(computedStockValue || 0)}</div>
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
                                      <WH1ChildMovementLedger
                                        product={prod}
                                        onEditEntry={openEditSubEntry}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          }

                          // 3. Standard / WH2 / WH3 Pharma Warehouse rendering
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

                                {/* Cartons */}
                                <td className="py-4 px-4 text-right font-mono font-bold text-zinc-700">
                                  {computedCartons > 0 ? computedCartons.toLocaleString() : (pharmaBalance > 0 ? "0" : "—")}
                                </td>

                                {/* Quantity Per Pack */}
                                <td className="py-4 px-4 text-right font-mono font-bold text-zinc-700">
                                  {packSize > 0 ? packSize.toLocaleString() : "—"}
                                </td>

                                {/* Total Quantity */}
                                <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                  <div>{pharmaBalance.toLocaleString()}</div>
                                  {binEntries.length > 0 && (
                                    <div className="text-[9px] text-zinc-400 font-bold">+{pharmaTotalReceived.toLocaleString()} / -{pharmaTotalIssued.toLocaleString()}</div>
                                  )}
                                </td>

                                {/* Packaging Unit */}
                                <td className="py-4 px-4 font-bold text-zinc-600 uppercase">{prod.unit}</td>

                                {/* Total Stock Value */}
                                <td className="py-4 px-4 text-right font-mono font-black text-zinc-900">
                                  ETB {money(computedStockValue || 0)}
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

          {activeTab === "Quarantine" && (
            <motion.div
              key="quarantine-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <QuarantineTab warehouseId={selectedWarehouse} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* MODAL: EDIT PRODUCT DETAILS */}
      <AnimatePresence>
        {editingProduct && (() => {
          const isEditWH1 = isWH1(editForm.warehouse)
          return (
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
                  title={isEditWH1 ? `Edit Commodity Details: ${editingProduct.name}` : `Edit Medicine Details: ${editingProduct.name}`}
                  subtitle={`SKU / Card No: ${editingProduct.sku}`}
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
                    <span className="block text-[11px] font-black uppercase text-zinc-500">{isEditWH1 ? "ID / SKU" : "SKU / Card No"}</span>
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
                  
                  {!isEditWH1 ? (
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
                      <label className="space-y-1">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">Packaging Unit</span>
                        <select 
                          value={editForm.unit} 
                          onChange={(e) => updateEditForm({ unit: e.target.value })} 
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="Box">Box</option>
                          <option value="Bottle">Bottle</option>
                          <option value="Vial">Vial</option>
                          <option value="Sachet">Sachet</option>
                          <option value="Ampoule">Ampoule</option>
                          <option value="Carton">Carton</option>
                          <option value="Piece">Piece</option>
                          <option value="Tube">Tube</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">Quantity Per Pack (Pack Size)</span>
                        <input 
                          type="number"
                          min="1"
                          value={editForm.quantityPerPack || "1"} 
                          onChange={(e) => updateEditForm({ quantityPerPack: e.target.value })} 
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" 
                          placeholder="e.g. 10"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">Number of Cartons</span>
                        <input 
                          type="number"
                          min="0"
                          value={editForm.numberOfCartons || "0"} 
                          onChange={(e) => updateEditForm({ numberOfCartons: e.target.value })} 
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" 
                          placeholder="e.g. 50"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">Unit Price (ETB)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editForm.unitCost}
                          onChange={(e) => updateEditForm({ unitCost: e.target.value, sellingPrice: e.target.value, price: e.target.value })}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                          placeholder="e.g. 150"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">Reorder Level (Optional)</span>
                        <input 
                          type="number" 
                          min="0"
                          value={editForm.reorderLevel} 
                          onChange={(e) => updateEditForm({ reorderLevel: e.target.value })} 
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono" 
                          placeholder="e.g. 50"
                        />
                      </label>
                    </>
                  ) : (
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
                      <div className="space-y-1 relative">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">Supplier / Source (Optional)</span>
                        <div className="relative flex items-center">
                          <input 
                            type="text" 
                            placeholder="Search or enter supplier..." 
                            value={editForm.customer || ""} 
                            onFocus={() => setShowEditParentSupplierDropdown(true)}
                            onChange={(e) => {
                              updateEditForm({ customer: e.target.value })
                              setShowEditParentSupplierDropdown(true)
                            }} 
                            className="h-11 w-full rounded-xl border border-zinc-200 pl-3 pr-9 text-xs outline-none focus:border-emerald-500" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditParentSupplierDropdown((prev) => !prev)}
                            className="absolute right-2 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                            title="Choose supplier from registry"
                          >
                            <ChevronDown className={`size-4 transition-transform ${showEditParentSupplierDropdown ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                        {showEditParentSupplierDropdown && (
                          <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl bg-white border border-zinc-200 shadow-xl py-1 divide-y divide-zinc-50">
                            {(() => {
                              const allSuppliers = Array.from(
                                new Set([
                                  ...erp.getSuppliers().map((s) => s.name),
                                  editingProduct.customer,
                                  editingProduct.supplierName,
                                  ...(editingProduct.wh1Entries || []).map((e: any) => e.customer || e.party),
                                ].filter((s): s is string => Boolean(s && s.trim())))
                              )
                              const currentVal = (editForm.customer || "").trim()
                              const filtered = currentVal
                                ? allSuppliers.filter((s) => s.toLowerCase().includes(currentVal.toLowerCase()))
                                : allSuppliers
                              if (filtered.length === 0) {
                                return (
                                  <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                                    {allSuppliers.length === 0 ? "No suppliers registered yet" : `No matches for "${currentVal}"`}
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
                                      updateEditForm({ customer: suppName })
                                      setShowEditParentSupplierDropdown(false)
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
                      <label className="space-y-1">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">UOM</span>
                        <select 
                          value={editForm.unit} 
                          onChange={(e) => updateEditForm({ unit: e.target.value })} 
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="Quintal">Quintal</option>
                          <option value="Ton">Ton</option>
                          <option value="Kg">Kg</option>
                          <option value="Bag">Bag</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-black uppercase text-zinc-500">Price / Cost per Unit (ETB)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editForm.price}
                          onChange={(e) => updateEditForm({ price: e.target.value, unitCost: e.target.value, sellingPrice: e.target.value })}
                          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-xs font-mono"
                          placeholder="e.g. 2400"
                        />
                      </label>
                    </>
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
          )
        })()}
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
                              const parentSupp = p.customer || p.supplierName || ""
                              if (parentSupp) {
                                setAddCustomer(parentSupp)
                              }
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
                      <div className="space-y-1 relative">
                        <span className="text-[11px] font-black uppercase text-zinc-700">
                          Supplier / Source <span className="text-[10px] text-zinc-400 lowercase">(optional)</span>
                        </span>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Search or select supplier..."
                            value={addCustomer}
                            onFocus={() => setShowSupplierDropdown(true)}
                            onChange={(e) => {
                              setAddCustomer(e.target.value)
                              setShowSupplierDropdown(true)
                            }}
                            className="h-11 w-full rounded-xl border border-zinc-200 pl-3 pr-9 text-xs"
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
                              const list = erp.getSuppliers()
                              const filtered = addCustomer.trim()
                                ? list.filter((s) => s.name.toLowerCase().includes(addCustomer.toLowerCase()))
                                : list
                              if (filtered.length === 0) {
                                return (
                                  <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                                    {list.length === 0 ? "No suppliers registered yet" : `No matches for "${addCustomer}"`}
                                  </div>
                                )
                              }
                              return filtered.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setAddCustomer(s.name)
                                    setShowSupplierDropdown(false)
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-xs flex items-center justify-between transition-colors cursor-pointer"
                                >
                                  <div>
                                    <span className="font-bold text-zinc-900 block">{s.name}</span>
                                    <span className="text-[10px] text-zinc-500 font-medium">
                                      {s.phone ? `📞 ${s.phone} • ` : ""}{s.city || "Ethiopia"}
                                    </span>
                                  </div>
                                </button>
                              ))
                            })()}
                          </div>
                        )}
                      </div>
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
                      {!erp.getSuppliers().some((s) => s.name.toLowerCase() === addCustomer.trim().toLowerCase()) && addCustomer.trim() !== "" && (
                        <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center gap-2 md:col-span-2">
                          <input
                            type="checkbox"
                            id="saveSupplierCheckStock"
                            checked={saveSupplierToRegistry}
                            onChange={(e) => setSaveSupplierToRegistry(e.target.checked)}
                            className="size-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                          />
                          <label htmlFor="saveSupplierCheckStock" className="text-xs font-bold text-emerald-950 cursor-pointer">
                            Save new supplier details to registry for future arrivals
                          </label>
                        </div>
                      )}
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

      {/* WH1 ADD MOVEMENT MODAL (INBOUND, RECONCILE LEAVE & REJECT LOSS) */}
      <WH1AddMovementModal
        isOpen={Boolean(slimAddEntryProduct)}
        product={slimAddEntryProduct}
        onClose={() => setSlimAddEntryProduct(null)}
        onSaveEntry={handleSaveWH1Entry}
        onSaveLeave={handleSaveWH1Leave}
        onSaveReject={handleSaveWH1Reject}
      />

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

                  <div className="space-y-1 block relative">
                    <span className="text-zinc-500 uppercase text-[10px] font-black">Supplier / Source (Optional)</span>
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        placeholder="Search or enter supplier..." 
                        value={editSubEntryCustomer} 
                        onFocus={() => setShowEditSubSupplierDropdown(true)}
                        onChange={(e) => {
                          setEditSubEntryCustomer(e.target.value)
                          setShowEditSubSupplierDropdown(true)
                        }} 
                        className="h-10 w-full border border-zinc-200 rounded-xl pl-3 pr-9 font-semibold text-xs outline-none focus:border-emerald-500" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditSubSupplierDropdown((prev) => !prev)}
                        className="absolute right-2 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                        title="Choose supplier from registry"
                      >
                        <ChevronDown className={`size-4 transition-transform ${showEditSubSupplierDropdown ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {showEditSubSupplierDropdown && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl bg-white border border-zinc-200 shadow-xl py-1 divide-y divide-zinc-50">
                        {(() => {
                          const allSuppliers = Array.from(
                            new Set([
                              ...erp.getSuppliers().map((s) => s.name),
                              editingSubEntry.product.customer,
                              editingSubEntry.product.supplierName,
                              ...(editingSubEntry.product.wh1Entries || []).map((e: any) => e.customer || e.party),
                            ].filter((s): s is string => Boolean(s && s.trim())))
                          )
                          const currentVal = editSubEntryCustomer.trim()
                          const filtered = currentVal
                            ? allSuppliers.filter((s) => s.toLowerCase().includes(currentVal.toLowerCase()))
                            : allSuppliers
                          if (filtered.length === 0) {
                            return (
                              <div className="px-3 py-2.5 text-xs text-zinc-400 font-medium text-center">
                                {allSuppliers.length === 0 ? "No suppliers registered yet" : `No matches for "${currentVal}"`}
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
                                  setEditSubEntryCustomer(suppName)
                                  setShowEditSubSupplierDropdown(false)
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
