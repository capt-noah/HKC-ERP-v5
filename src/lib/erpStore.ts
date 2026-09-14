import { useState, useEffect } from "react"
import { createResource, deleteResource, loadResource, updateResource } from "./apiPersistence"
import { useAuthStore } from "./authStore"
import { financeStore, calculateMultiTax } from "./financeStore"
import { evaluateStockStatus } from "../core/inventory/stockEngine"
import { validateTransferNote } from "../core/inventory/transferEngine"
import { processSalesOrderPipeline } from "../core/sales/orderPipeline"
import { OPERATING_WAREHOUSES, withOperatingWarehouses, registerDynamicWarehouses, isWH1, isExportWarehouse } from "./warehouses"
import { sortNewestFirst } from "./utils"

export type WarehouseType = "EXPORT_WH" | "PHARMA_WH"

export interface Warehouse {
  id: string
  name: string
  code: string
  location: string
  warehouse_type?: WarehouseType
  type?: string
}

export interface StockBreakdown {
  warehouse: string
  qty: number
}

export interface BatchInfo {
  id?: string
  batchNo: string
  qty: number
  expiry: string
  mfgDate?: string
  unitPrice?: number
  notes?: string
  status: "Released" | "Pending QA" | "Quarantined"
}

export interface WH1Entry {
  id?: string
  entryId: string
  voucherNo?: string
  customer?: string
  plateNumber?: string
  entryDate: string
  leaveDate?: string
  quantityReceived: number
  quantityRemaining: number
  rejectQuantity?: number
  unitPrice: number
  notes?: string
}

export interface BinCardMovementEntry {
  id: string
  batchId?: string
  type?: "entry" | "leave" | "quarantine" | "reject"
  date: string
  batchNo: string
  voucherNo?: string
  plateNumber?: string
  qtyReceived: number
  qtyIssued: number
  balance: number
  expiryDate: string
  mfgDate?: string
  party: string
  unitPrice?: number
  remark: string
  reason?: string
  createdAt?: string
}

export interface Product {
  id: string
  name: string
  sku: string
  voucherNo?: string
  customer?: string
  plateNumber?: string
  dosage?: string
  shelfNo?: string
  category: string
  itemType?: string
  description?: string
  warehouse: string
  warehouseName?: string
  quantity: number
  quantityPerPack?: number
  numberOfCartons?: number
  totalQuantity?: number
  quantitySold?: number
  openingBalance?: number
  reorderLevel?: number
  reorderQuantity?: number
  valuationRate?: number
  unit: string
  unitCost: number
  costPrice?: number
  totalStockValue?: number
  defaultTaxScheduleId?: string
  sellingPrice: number
  batch: string
  batchNo?: string
  batch_no?: string
  mfgDate?: string
  mfg_date?: string
  manufacturingDate?: string
  expiry: string
  expiryDate?: string
  expiry_date?: string
  entryDate?: string
  leaveDate?: string
  shelfLifeMonths?: number
  expiryAlertEnabled?: boolean
  expiryAlertPeriod?: string
  status: "In Stock" | "Low Stock" | "Quarantined" | "Out of Stock" | "Pending QA"
  stockBreakdown: StockBreakdown[]
  batches: BatchInfo[]
  wh1Entries?: WH1Entry[]
  binCardEntries?: BinCardMovementEntry[]
  origin: string
  supplierName: string
  supplier?: string
  inventoryAssetAccount?: string
  cogsAccount?: string
  revenueAccount?: string
  damageExpenseAccount?: string
  taxCategory?: string
  trackBatchNumber?: boolean
  trackManufacturingDate?: boolean
  trackExpiryDate?: boolean
  trackSerialNumber?: boolean
  allowDecimalCartons?: boolean
  preventNegativeStock?: boolean
  requireApprovalBeforeActivation?: boolean
  productImageName?: string
  supportingDocumentName?: string
  internalNotes?: string
  itemRegistrationStatus?: "Draft" | "Submitted" | "Active"
  approvalStatus?: "Not Submitted" | "Submitted" | "Approved"
  createdBy?: string
  createdDate?: string
  createdAt?: string
  updatedAt?: string
}

export type TransferStatus = "Draft" | "Issued" | "Received" | "Discrepancy"

export interface TransferLineItem {
  line_no: number
  productId?: string
  item: string
  UOM: string
  quantity: number
  batch_no?: string
  expiry?: string
  unit_price?: number
  remark?: string
}

export interface Transfer {
  reference_number: string
  from_warehouse: string
  to_warehouse: string
  status: TransferStatus
  line_items: TransferLineItem[]
  total_quantity: number
  issued_by?: string
  issued_at?: string
  received_by?: string
  received_at?: string
  discrepancy_remark?: string
  issued_signature?: string
  received_signature?: string
  date: string
  journalEntryId?: string
}

type PersistedTransfer = Transfer & { id?: string }

export interface QuarantineRecord {
  id: string
  warehouseId: string
  warehouseName?: string
  productId: string
  productName: string
  sku: string
  batchNo: string
  nameEntered: string
  quarantineDate: string
  quantity: number
  unit: string
  proposedReleaseDate: string
  reason?: string
  status: "Quarantined" | "Released" | "Disposed"
  binCardEntryId?: string
  createdAt: string
}

export interface StockMovementLog {
  id: string
  date: string
  type: "TRANSFER" | "ADJUSTMENT" | "RECEIPT" | "FULFILLMENT" | "SALES_OUT" | "QUARANTINE" | "ISSUE"
  productId?: string
  productName: string
  sku?: string
  fromWarehouse?: string
  toWarehouse?: string
  qty: number
  unit: string
  reference: string
  journalEntryId?: string
  remarks?: string
}

export interface SalesOrderItem {
  productId: string
  name: string
  qty: number
  unit: string
  unitPrice: number
  total: number
  deliveredQty?: number
}

export interface Quotation {
  id: string
  customer: string
  customerId: string
  customerGroup?: string
  warehouse: string
  warehouseName?: string
  date: string
  validTill: string
  amount: number
  currency: string
  status: "Draft" | "Quoted" | "Ordered" | "Expired" | "Cancelled"
  desc: string
  paymentTerms?: string
  salesPerson?: string
  items: SalesOrderItem[]
}

export interface DeliveryNoteItem {
  productId: string
  name: string
  qty: number
  unit: string
  unitCost: number
  unitPrice: number
  totalValue: number
}

export interface DeliveryNote {
  id: string
  salesOrderId: string
  customer: string
  customerId: string
  warehouse: string
  warehouseName?: string
  postingDate: string
  driverName?: string
  vehicleReg?: string
  status: "Draft" | "Submitted" | "Cancelled"
  items: DeliveryNoteItem[]
  totalValue: number
  cogsTotal: number
  journalEntryId?: string
}

export interface SalesOrder {
  id: string
  quotationId?: string
  customer: string
  customerId: string
  customerPhone?: string
  customerGroup?: string
  warehouse: string
  warehouseName?: string
  date: string
  deliveryDate?: string
  amount: number
  currency: string
  stage: "Quote" | "Confirmed" | "Picking" | "Shipped" | "Delivered" | "Cancelled"
  progress?: number
  desc: string
  initials: string
  label: string
  avatarBg: string
  urgent: boolean
  attachment: boolean
  items: SalesOrderItem[]
  // ERPNext Sales alignment fields
  deliveredAmount?: number
  billedAmount?: number
  paidAmount?: number
  remainingBalance?: number
  settlementStatus?: "Unpaid" | "Ongoing" | "Fully Settled"
  deliveryStatus?: "Not Delivered" | "Partially Delivered" | "Fully Delivered"
  billingStatus?: "Not Billed" | "Partially Billed" | "Fully Billed"
  paymentTerms?: string
  paymentType?: "Cash" | "Credit"
  salesPerson?: string
  shippingAddress?: string
  deliveryNoteIds?: string[]
  invoiceIds?: string[]
  approvalStatus?: "Pending" | "Approved" | "Declined"
  approvedBy?: string
  approvedAt?: string
  declineReason?: string
}

export interface PurchaseOrderItem {
  productId?: string
  name: string
  sku?: string
  qty: number
  unit: string
  unitPrice: number
  total: number
  accountCode?: string
  accountName?: string
}

export interface VoucherAccountRow {
  id?: string
  accountId?: string
  accountCode: string
  accountName?: string
  description: string
  debit: number
  credit: number
}

export interface PurchaseOrderAttachment {
  id: string
  name: string
  size: number
  url: string
  uploadedAt: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  voucherNo?: string
  paidTo?: string
  supplier: string
  supplierId?: string
  reasonForPayment?: string
  chequeNo?: string
  amountInWords?: string
  accountEntries?: VoucherAccountRow[]
  warehouse?: string
  warehouseName?: string
  status: "DRAFT" | "PAID" | "COMPLETED" | "RECEIVED" | "IN TRANSIT" | "CANCELLED"
  statusColor: string
  date: string
  requiredByDate?: string
  eta?: string
  amount: number
  amountPaid?: number
  amount_paid?: number
  balanceDue?: number
  balance_due?: number
  settlementStatus?: "Unpaid" | "Ongoing" | "Fully Settled"
  settlement_status?: "Unpaid" | "Ongoing" | "Fully Settled"
  dueDate?: string
  due_date?: string
  currency: string
  category?: string
  targetAccountId?: string
  targetAccountCode?: string
  targetAccountName?: string
  paymentType?: "Cash" | "Credit"
  payment_type?: "Cash" | "Credit"
  paymentTerms?: string
  payment_terms?: string
  preparedBy?: string
  approvedBy?: string
  paidBy?: string
  receivedBy?: string
  items?: PurchaseOrderItem[]
  bankName?: string
  paymentMethod?: "Cheque" | "Bank Transfer" | "RTGS" | "Cash" | string
  paymentAdviceAttachment?: PurchaseOrderAttachment | null
  attachments?: PurchaseOrderAttachment[] | string[]
  installmentPayments?: Array<{
    id: string
    amount: number
    date: string
    bankAccountCode?: string
    reference: string
    paymentAdviceUrl?: string
    paymentAdviceFilename?: string
    notes?: string
  }>
  receivedAmount?: number
  billedAmount?: number
  receiptStatus?: "Not Received" | "Partially Received" | "Fully Received"
  billingStatus?: "Not Billed" | "Partially Billed" | "Fully Billed"
  receiptIds?: string[]
  invoiceIds?: string[]
  journalEntryId?: string
}

export interface Customer {
  id: string
  name: string
  country: string
  region?: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  category?: string
  warehouseTarget?: string
  creditLimit?: number
  tradePaperUrl?: string
  tradePaperFileName?: string
  tradePaperUploadedAt?: string
  defaultTaxScheduleId?: string
  isGovAgent?: boolean
  status?: string
}

export function getTradeLicenseStatus(customer: Customer, warehouse?: string): {
  status: "valid" | "expired" | "missing"
  daysRemaining: number
  isPermanent: boolean
  docType: "Bank Permit" | "Trade License"
} {
  const targetWh = warehouse || customer.warehouseTarget
  const isWh1Target = targetWh ? isWH1(targetWh) : false
  const docType = isWh1Target ? "Bank Permit" : "Trade License"

  if (!customer.tradePaperUrl || !customer.tradePaperFileName) {
    return { status: "missing", daysRemaining: 0, isPermanent: isWh1Target, docType }
  }

  // Bank Permit for WH1 is a permanent compliance document with no expiration date
  if (isWh1Target) {
    return { status: "valid", daysRemaining: 9999, isPermanent: true, docType }
  }

  // Trade License for WH2 / WH3 requires active 6-month (180 days) compliance tracking
  if (!customer.tradePaperUploadedAt) {
    return { status: "expired", daysRemaining: 0, isPermanent: false, docType }
  }
  const uploadedDate = new Date(customer.tradePaperUploadedAt)
  const expiryDate = new Date(uploadedDate.getTime() + 180 * 24 * 60 * 60 * 1000)
  const today = new Date()
  const diffMs = expiryDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 0) {
    return { status: "expired", daysRemaining: 0, isPermanent: false, docType }
  }
  return { status: "valid", daysRemaining: diffDays, isPermanent: false, docType }
}

export interface Supplier {
  id: string
  name: string
  country: string
  city?: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  category?: string
  taxId?: string
  warehouseTarget?: string
  rating?: string
  tradePaperUrl?: string
  tradePaperFileName?: string
  defaultTaxScheduleId?: string
  isGovAgent?: boolean
  status?: string
}

class ErpStore {
  private warehouses: Warehouse[] = [...OPERATING_WAREHOUSES]
  private products: Product[] = []
  private salesOrders: SalesOrder[] = []
  private purchaseOrders: PurchaseOrder[] = []
  private customers: Customer[] = []
  private suppliers: Supplier[] = []
  private quotations: Quotation[] = []
  private deliveryNotes: DeliveryNote[] = []
  private transfers: Transfer[] = []
  private stockMovements: StockMovementLog[] = []
  private quarantineRecords: QuarantineRecord[] = []

  private listeners = new Set<() => void>()
  private loading = false
  private _loadError: string | null = null
  private _inventoryLoaded = false
  private _salesLoaded = false
  private _inventoryLoading = false
  private _salesLoading = false
  private broadcastChannel: BroadcastChannel | null = null

  constructor() {
    if (typeof window !== "undefined") {
      try {
        if ("BroadcastChannel" in window) {
          this.broadcastChannel = new BroadcastChannel("hkc_erp_sync_channel")
          this.broadcastChannel.onmessage = (event) => {
            const data = event?.data
            if (data?.type === "INVENTORY_CHANGED" || data?.type === "PRODUCT_UPDATED") {
              this.loadInventoryData(true).catch(() => {})
            }
          }
        }
      } catch {}
    }
  }

  public broadcastInventoryChange() {
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: "INVENTORY_CHANGED", timestamp: Date.now() })
      }
    } catch {}
  }

  public isInventoryLoaded(): boolean {
    return this._inventoryLoaded
  }

  public isSalesLoaded(): boolean {
    return this._salesLoaded
  }

  /**
   * Scoped loader for Inventory Module (Warehouses, Inventory Products, Transfers, Movements)
   * Optional read-only load of Suppliers & Purchase Orders for stock receiving operations.
   */
  public async loadInventoryData(force = false): Promise<void> {
    if (!useAuthStore.getState().token) return
    if (this._inventoryLoaded && !force) return
    if (this._inventoryLoading) return

    this._inventoryLoading = true
    if (!this._inventoryLoaded) {
      this.loading = true
      this._loadError = null
      this.listeners.forEach((l) => l())
    }

    try {
      const [
        warehouses,
        exportProducts,
        pharmaProducts,
        pharmaBatches,
        transfers,
        stockMovements,
        exportMovements,
        suppliers,
        purchaseOrders,
        transferItems,
        salesIssues,
        salesIssueItems,
        salesOrdersList,
        quarantineDbRecords,
      ] = await Promise.all([
        loadResource<Warehouse>("warehouses"),
        loadResource<Product>("export_products").catch(() => []),
        loadResource<Product>("pharma_products").catch(() => []),
        loadResource<any>("pharma_product_batches").catch(() => []),
        loadResource<PersistedTransfer>("store_transfers"),
        loadResource<StockMovementLog>("stock_movements"),
        loadResource<any>("export_warehouse_movements").catch(() => []),
        loadResource<Supplier>("suppliers").catch(() => []),
        loadResource<PurchaseOrder>("purchase_orders").catch(() => []),
        loadResource<any>("store_transfer_items").catch(() => []),
        loadResource<any>("sales_issues").catch(() => []),
        loadResource<any>("sales_issue_items").catch(() => []),
        loadResource<any>("sales_orders").catch(() => []),
        loadResource<any>("quarantine_records").catch(() => []),
      ])

      registerDynamicWarehouses(warehouses)
      this.warehouses = withOperatingWarehouses(warehouses)

      const getSalesIssueUnitPrice = (productId: string, ...references: (string | undefined)[]) => {
        const cleanRefs = references
          .map((r) => String(r || "").trim())
          .filter((r) => r && r !== "—" && r !== "N/A")

        if (cleanRefs.length === 0) return 0

        // 1. Check sales_issues and sales_issue_items
        for (const cleanRef of cleanRefs) {
          const matchedIssue = (salesIssues || []).find((si: any) => {
            const sId = String(si.id || "").trim()
            const sFs = String(si.fs_no || si.fsNo || "").trim()
            const sRef = String(si.reference_no || si.referenceNo || "").trim()
            return sId === cleanRef || sFs === cleanRef || sRef === cleanRef ||
              (cleanRef.length > 2 && (sId.includes(cleanRef) || sFs.includes(cleanRef) || cleanRef.includes(sFs) || cleanRef.includes(sId)))
          })

          const issueId = matchedIssue?.id || cleanRef
          const matchedItem = (salesIssueItems || []).find((it: any) => {
            const itIssueId = String(it.sales_issue_id || it.salesIssueId || it.sales_order_id || "").trim()
            const itProdId = String(it.item_id || it.product_id || it.productId || "").trim()
            const matchesParent = itIssueId === issueId || itIssueId === cleanRef || 
              (matchedIssue?.id && itIssueId === matchedIssue.id) ||
              (matchedIssue?.fs_no && itIssueId === matchedIssue.fs_no) ||
              (matchedIssue?.reference_no && itIssueId === matchedIssue.reference_no)
            return matchesParent && (itProdId === productId || itProdId === "")
          })

          if (matchedItem && Number(matchedItem.unit_price || matchedItem.unitPrice || 0) > 0) {
            return Number(matchedItem.unit_price || matchedItem.unitPrice)
          }

          if (matchedIssue && Array.isArray(matchedIssue.items)) {
            const embItem = matchedIssue.items.find((it: any) => {
              const itProdId = String(it.item_id || it.product_id || it.productId || "").trim()
              return itProdId === productId
            })
            if (embItem && Number(embItem.unit_price || embItem.unitPrice || 0) > 0) {
              return Number(embItem.unit_price || embItem.unitPrice)
            }
          }
        }

        // 2. Check sales_orders
        for (const cleanRef of cleanRefs) {
          const matchedOrder = (salesOrdersList || []).find((so: any) => {
            const soObj = so?.payload ? { ...so.payload, ...so } : so
            const soId = String(soObj.id || "").trim()
            const soOrderNo = String(soObj.orderNumber || soObj.order_number || "").trim()
            return soId === cleanRef || soOrderNo === cleanRef ||
              (cleanRef.length > 2 && (soId.includes(cleanRef) || soOrderNo.includes(cleanRef) || cleanRef.includes(soId)))
          })

          if (matchedOrder) {
            const soObj = matchedOrder?.payload ? { ...matchedOrder.payload, ...matchedOrder } : matchedOrder
            if (Array.isArray(soObj.items)) {
              const matchedItem = soObj.items.find((it: any) => {
                const itProdId = String(it.productId || it.product_id || it.item_id || it.id || "").trim()
                return itProdId === productId
              })
              if (matchedItem && Number(matchedItem.unitPrice || matchedItem.unit_price || 0) > 0) {
                return Number(matchedItem.unitPrice || matchedItem.unit_price)
              }
            }
          }
        }

        return 0
      }

      // 1. Hydrate export products with wh1Entries and binCardEntries from export_warehouse_movements
      const exportList = (exportProducts || []).filter((p) =>
        isExportWarehouse(p.warehouse || (p as any).warehouse_id, this.warehouses)
      )
      const hydratedExport = exportList.map((p) => {
        const prodMovements = (exportMovements || []).filter((em: any) => em.product_id === p.id || em.productId === p.id)
        
        // Define movement classification helpers
        const isDeduction = (mType: string) =>
          ["reject", "REJECT_DEDUCTION", "leave", "OUTBOUND_DISPATCH", "issue", "SALE_OUTBOUND", "sale", "dispatch"].includes(mType)
        const isEntryType = (mType: string) =>
          ["entry", "GRV_ENTRY"].includes(mType)
        const isRejectType = (mType: string) =>
          ["reject", "REJECT_DEDUCTION"].includes(mType)

        const getMovementDeductQty = (em: any) => {
          const rej = Number(em.reject_quantity ?? em.rejectQuantity ?? 0)
          if (rej > 0) return rej
          const gross = Number(em.gross_quantity ?? em.grossQuantity ?? 0)
          if (gross > 0) return gross
          return Math.abs(Number(em.net_quantity ?? em.netQuantity ?? 0))
        }

        const totalRejects = prodMovements
          .filter((em: any) => isRejectType(em.movement_type))
          .reduce((sum: number, em: any) => sum + getMovementDeductQty(em), 0)
        
        const totalLeaves = prodMovements
          .filter((em: any) => isDeduction(em.movement_type) && !isRejectType(em.movement_type))
          .reduce((sum: number, em: any) => sum + getMovementDeductQty(em), 0)

        // Build wh1Entries (Inbound GRVs)
        const grvMovements = prodMovements.filter((em: any) => isEntryType(em.movement_type))
        let mappedWh1Entries: WH1Entry[] = grvMovements.map((em: any) => ({
          id: em.id,
          entryId: em.id,
          voucherNo: em.voucher_no || undefined,
          entryDate: em.movement_date || em.created_at?.slice(0, 10) || "",
          plateNumber: em.plate_number || undefined,
          customer: em.party_name || undefined,
          quantityReceived: Number(em.gross_quantity || em.net_quantity || 0),
          quantityRemaining: Number(em.gross_quantity || em.net_quantity || 0),
          unitPrice: Number(em.unit_price || p.unitCost || 0),
          notes: em.reason || undefined,
        }))

        // Fallback / Base arrival: if no explicit GRV movement exists in export_warehouse_movements, synthesize from parent product
        const initialGrossQty = Math.max(
          Number(p.totalQuantity || 0),
          Number(p.quantity || 0) + totalRejects + totalLeaves
        )

        if (mappedWh1Entries.length === 0 && Array.isArray(p.wh1Entries) && p.wh1Entries.length > 0) {
          mappedWh1Entries = p.wh1Entries.map((e) => ({
            ...e,
            quantityReceived: Number(e.quantityReceived || e.quantityRemaining || 0),
            quantityRemaining: Number(e.quantityRemaining ?? e.quantityReceived ?? 0),
            unitPrice: Number(e.unitPrice || p.unitCost || 0),
          }))
        } else if (mappedWh1Entries.length === 0 && (initialGrossQty > 0 || p.voucherNo || p.customer)) {
          mappedWh1Entries = [{
            id: `WH1E-base-${p.id}`,
            entryId: `WH1E-base-${p.id}`,
            voucherNo: p.voucherNo,
            customer: p.customer || p.supplierName || "Initial Stock Deposit",
            plateNumber: p.plateNumber,
            entryDate: p.entryDate || p.createdDate?.slice(0, 10) || (p as any).createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            leaveDate: undefined,
            quantityReceived: initialGrossQty,
            quantityRemaining: initialGrossQty,
            unitPrice: Number(p.unitCost || 0),
            notes: "Initial Stock Deposit",
          }]
        }

        // Apply all deductions strictly to mappedWh1Entries using safe numeric deduction quantity
        prodMovements
          .filter((em: any) => isDeduction(em.movement_type))
          .forEach((ded: any) => {
            const deductQty = getMovementDeductQty(ded)
            if (deductQty <= 0) return

            let rem = deductQty
            const targetBatch = (ded.batch_no || ded.entryId || ded.id || "").trim()

            // Try matching specific entry first
            let matched = false
            mappedWh1Entries = mappedWh1Entries.map((e) => {
              if (
                targetBatch &&
                targetBatch !== "N/A" &&
                targetBatch !== "COMMODITY-WH1" &&
                (e.entryId === targetBatch || e.id === targetBatch || (e.voucherNo && targetBatch.includes(e.voucherNo)))
              ) {
                matched = true
                const d = Math.min(e.quantityRemaining, rem)
                rem -= d
                return { ...e, quantityRemaining: Math.max(0, e.quantityRemaining - d) }
              }
              return e
            })

            // If not matched to specific entry, deduct FIFO from oldest
            if (!matched && rem > 0) {
              mappedWh1Entries = mappedWh1Entries.map((e) => {
                if (rem <= 0) return e
                const d = Math.min(e.quantityRemaining, rem)
                rem -= d
                return { ...e, quantityRemaining: Math.max(0, e.quantityRemaining - d) }
              })
            }
          })

        // Build binCardEntries (All movements: Inbound, Rejection, Outbound Dispatch)
        let mappedBinEntries: BinCardMovementEntry[] = prodMovements.map((em: any) => {
          const isReject = isRejectType(em.movement_type)
          const isEntry = isEntryType(em.movement_type)
          const qtyReceived = isEntry ? Number(em.gross_quantity || em.net_quantity || 0) : 0
          const qtyIssued = isReject || !isEntry ? getMovementDeductQty(em) : 0

          let effectiveUnitPrice = 0
          if (!isEntry && !isReject) {
            const soUnitPrice = getSalesIssueUnitPrice(p.id, em.voucher_no, em.reason, em.batch_no)
            if (soUnitPrice > 0) {
              effectiveUnitPrice = soUnitPrice
            } else if (Number(em.unit_price || 0) > 0) {
              effectiveUnitPrice = Number(em.unit_price)
            } else {
              effectiveUnitPrice = Number(p.sellingPrice || (p as any).selling_price || p.unitCost || 0)
            }
          } else {
            effectiveUnitPrice = Number(em.unit_price || p.unitCost || 0)
          }

          return {
            id: em.id,
            batchId: em.batch_no || em.id,
            type: (isReject ? "reject" : isEntry ? "entry" : "leave") as any,
            date: em.movement_date || em.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            batchNo: em.batch_no || (em.voucher_no ? `GRV-${em.voucher_no}` : "COMMODITY-WH1"),
            voucherNo: em.voucher_no || undefined,
            plateNumber: em.plate_number || undefined,
            qtyReceived,
            qtyIssued,
            balance: Number(p.quantity || 0),
            expiryDate: "",
            party: em.party_name || (isReject ? "Cleaning Loss Deduction" : isEntry ? "Supplier Arrival" : "Customer Dispatch"),
            unitPrice: effectiveUnitPrice,
            remark: isReject
              ? (em.reason || "Impurity Deduction")
              : isEntry
              ? (em.reason || (em.voucher_no ? `Goods Received Voucher No. ${em.voucher_no}` : "Goods Receipt"))
              : (em.reason || "Outbound Dispatch"),
            reason: em.reason || undefined,
            createdAt: em.created_at || new Date().toISOString(),
          }
        })

        if (mappedBinEntries.length === 0 && Array.isArray(p.binCardEntries) && p.binCardEntries.length > 0) {
          mappedBinEntries = p.binCardEntries
        } else if (!mappedBinEntries.some((b) => b.type === "entry") && (initialGrossQty > 0 || p.voucherNo || p.customer)) {
          const baseEntry: BinCardMovementEntry = {
            id: `BCE-base-${p.id}`,
            type: "entry",
            date: p.entryDate || p.createdDate?.slice(0, 10) || (p as any).createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            batchNo: p.voucherNo ? `GRV-${p.voucherNo}` : "COMMODITY-WH1",
            voucherNo: p.voucherNo,
            plateNumber: p.plateNumber,
            qtyReceived: initialGrossQty,
            qtyIssued: 0,
            balance: initialGrossQty,
            expiryDate: "",
            party: p.customer || p.supplierName || "Initial Stock Deposit",
            unitPrice: Number(p.unitCost || 0),
            remark: "Initial Stock Registration",
            createdAt: p.createdDate || (p as any).createdAt || new Date().toISOString(),
          }
          mappedBinEntries.unshift(baseEntry)
        }

        // Chronologically sort and compute sequential running balance
        mappedBinEntries.sort((a, b) => {
          const timeA = new Date(a.date && a.date !== "—" ? a.date : 0).getTime()
          const timeB = new Date(b.date && b.date !== "—" ? b.date : 0).getTime()
          if (timeA !== timeB) return timeA - timeB
          const createA = new Date((a as any).createdAt || (a as any).created_at || 0).getTime()
          const createB = new Date((b as any).createdAt || (b as any).created_at || 0).getTime()
          if (createA && createB && createA !== createB) return createA - createB
          const aIsEntry = a.type === "entry" || Number(a.qtyReceived || 0) > 0
          const bIsEntry = b.type === "entry" || Number(b.qtyReceived || 0) > 0
          if (aIsEntry && !bIsEntry) return -1
          if (!aIsEntry && bIsEntry) return 1
          return 0
        })

        let runningBal = 0
        mappedBinEntries = mappedBinEntries.map((rec) => {
          runningBal += Number(rec.qtyReceived || 0) - Number(rec.qtyIssued || 0)
          return { ...rec, balance: Math.max(0, runningBal) }
        })

        const currentWh1Qty = mappedWh1Entries.length > 0
          ? mappedWh1Entries.reduce((sum, e) => sum + Number(e.quantityRemaining || 0), 0)
          : Number(p.quantity || 0)

        // Calculate accurate remaining stock value from mappedWh1Entries (inbound parcels & remaining stock)
        const totalRemainingStockValue = currentWh1Qty <= 0
          ? 0
          : (mappedWh1Entries.length > 0
              ? Math.max(0, Math.round(mappedWh1Entries.reduce((sum, e) => sum + (Number(e.quantityRemaining || 0) * Number(e.unitPrice || p.unitCost || 0)), 0) * 100) / 100)
              : Number(p.totalStockValue || (p as any).total_stock_value || (currentWh1Qty * Number(p.unitCost || 0))))

        const totalInboundQty = mappedWh1Entries.reduce(
          (sum, e) => sum + Number(e.quantityReceived || 0),
          0
        ) || initialGrossQty

        const wh1WeightedCost = currentWh1Qty > 0 ? Math.round((totalRemainingStockValue / currentWh1Qty) * 100) / 100 : Number(p.unitCost || 0)
        const catalogueSellingPrice = Number(p.sellingPrice || (p as any).selling_price || wh1WeightedCost)

        return {
          ...p,
          quantity: currentWh1Qty,
          totalStockValue: totalRemainingStockValue,
          unitCost: wh1WeightedCost,
          sellingPrice: catalogueSellingPrice,
          totalQuantity: totalInboundQty,
          wh1Entries: mappedWh1Entries,
          binCardEntries: mappedBinEntries,
        }
      })

      // 2. Hydrate pharma products with batches and binCardEntries from stock_movements
      const pharmaList = (pharmaProducts || []).filter((p) =>
        !isExportWarehouse(p.warehouse || (p as any).warehouse_id, this.warehouses)
      )
      const hydratedPharma = pharmaList.map((p: any) => {
        const matchingBatches = (pharmaBatches || []).filter((b: any) => b.product_id === p.id || b.productId === p.id)
        let mappedBatches: BatchInfo[] = matchingBatches.map((b: any) => ({
          id: b.id,
          batchNo: b.batch_no || b.batchNo || "BATCH-001",
          qty: Number(b.quantity || b.qty || 0),
          expiry: b.expiry_date || b.expiryDate || "",
          mfgDate: b.mfg_date || b.mfgDate,
          unitPrice: Number(b.unit_cost || b.unitPrice || p.unitCost || 0),
          status: b.qa_status === "Released" ? ("Released" as const) : b.qa_status === "Quarantined" ? ("Quarantined" as const) : ("Released" as const),
          notes: b.notes,
        }))

        if (mappedBatches.length === 0 && Array.isArray(p.batches) && p.batches.length > 0) {
          mappedBatches = p.batches
        } else if (mappedBatches.length === 0 && (Number(p.quantity || p.totalQuantity || 0) > 0 || p.batch)) {
          mappedBatches = [{
            batchNo: p.batch || "BATCH-001",
            qty: Number(p.quantity || p.totalQuantity || 0),
            expiry: p.expiry || "",
            mfgDate: p.manufacturingDate,
            unitPrice: Number(p.unitCost || 0),
            status: "Released",
          }]
        }

        const matchingMovements = (stockMovements || []).filter((sm: any) => sm.product_id === p.id || sm.productId === p.id)
        let mappedPharmaBinEntries: BinCardMovementEntry[] = matchingMovements.map((sm: any) => {
          const isReceipt = sm.movement_type === "RECEIPT" || sm.movement_type === "INBOUND" || sm.movement_type === "ADJUSTMENT_IN"
          const isQuarantine = sm.movement_type === "QUARANTINE"
          const isTransfer = sm.movement_type === "TRANSFER"
          const isIssue = sm.movement_type === "ISSUE" || sm.movement_type === "OUTBOUND" || sm.movement_type === "DISPATCH" || sm.movement_type === "ADJUSTMENT_OUT"
          
          const qty = Number(sm.quantity || sm.qty || 0)
          const qtyReceived = isReceipt ? qty : 0
          const qtyIssued = (isIssue || isQuarantine || isTransfer) ? qty : 0
          const mType = isQuarantine ? "quarantine" : isReceipt ? "entry" : "leave"

          let effectiveUnitPrice = 0
          if (isIssue) {
            const soUnitPrice = getSalesIssueUnitPrice(p.id, sm.reference_id, sm.reference, sm.notes, sm.batch_no)
            if (soUnitPrice > 0) {
              effectiveUnitPrice = soUnitPrice
            } else if (Number(sm.unit_price || 0) > 0) {
              effectiveUnitPrice = Number(sm.unit_price)
            } else {
              effectiveUnitPrice = Number(p.sellingPrice || (p as any).selling_price || p.unitCost || 0)
            }
          } else {
            effectiveUnitPrice = Number(sm.unit_price || sm.unit_cost || sm.unitPrice || p.unitCost || 0)
            if (isQuarantine && effectiveUnitPrice <= 0) {
              const matchingBatch = mappedBatches.find((b: any) => (b.batchNo || "").toUpperCase() === (sm.batch_no || sm.batchNo || "").toUpperCase())
              if (matchingBatch && Number(matchingBatch.unitPrice || 0) > 0) {
                effectiveUnitPrice = Number(matchingBatch.unitPrice)
              }
            }
          }

          return {
            id: sm.id,
            batchId: sm.batch_id || sm.batchId || undefined,
            type: mType as any,
            date: sm.movement_date || sm.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            batchNo: sm.batch_no || sm.batchNo || "BATCH",
            voucherNo: sm.reference_id || sm.reference || undefined,
            qtyReceived,
            qtyIssued,
            balance: Number(sm.balance_after || 0),
            expiryDate: sm.expiry_date || sm.expiryDate || "",
            party: sm.notes || sm.reference_type || (isReceipt ? "Stock Receipt" : isIssue ? "Stock Issue" : "Stock Movement"),
            unitPrice: effectiveUnitPrice,
            remark: sm.notes || (sm.reference_type ? `${sm.reference_type} ${sm.reference_id || ""}` : "Stock Movement"),
            createdAt: sm.created_at || new Date().toISOString(),
          }
        })

        if (mappedPharmaBinEntries.length === 0 && Array.isArray(p.binCardEntries) && p.binCardEntries.length > 0) {
          mappedPharmaBinEntries = p.binCardEntries
        }

        // Check if explicit receipts exist in movements
        const explicitReceipts = mappedPharmaBinEntries.filter(
          (m) => m.type === "entry" || Number(m.qtyReceived || 0) > 0
        )

        const totalIssuesInMovements = mappedPharmaBinEntries
          .filter((m) => m.type !== "entry" && Number(m.qtyIssued || 0) > 0)
          .reduce((sum, m) => sum + Number(m.qtyIssued || 0), 0)

        const initialGrossQty = Math.max(
          Number(p.totalQuantity || 0),
          Number(p.quantity || 0) + totalIssuesInMovements,
          mappedBatches.reduce((sum, b) => sum + Number(b.qty || 0), 0)
        )

        if (explicitReceipts.length === 0 && mappedBatches.length > 0) {
          // Construct base entries for each batch individually with its specific unit cost and batch ID
          const baseEntries: BinCardMovementEntry[] = mappedBatches.map((b) => {
            const issuesForBatch = mappedPharmaBinEntries
              .filter((m) => (m.type !== "entry" && Number(m.qtyIssued || 0) > 0) && (m.batchId === b.id || m.batchNo === b.batchNo))
              .reduce((sum, m) => sum + Number(m.qtyIssued || 0), 0)

            const initBatchQty = Number(b.qty || 0) + issuesForBatch
            const initUnitPrice = Number(b.unitPrice || (b as any).unit_cost || p.unitCost || 0)
            const initDate = b.mfgDate || p.manufacturingDate || p.createdDate?.slice(0, 10) || (p.createdAt ? p.createdAt.slice(0, 10) : "2020-01-01")

            return {
              id: b.id || `BCE-init-${p.id}-${b.batchNo}`,
              batchId: b.id,
              type: "entry" as const,
              date: initDate,
              batchNo: b.batchNo || "BATCH-001",
              qtyReceived: initBatchQty,
              qtyIssued: 0,
              balance: initBatchQty,
              expiryDate: b.expiry || p.expiry || "",
              mfgDate: b.mfgDate || p.manufacturingDate,
              party: p.supplierName || "Initial Stock Deposit",
              unitPrice: initUnitPrice,
              remark: "Initial Stock Deposit",
              createdAt: p.createdDate || p.createdAt || new Date().toISOString(),
            }
          })
          mappedPharmaBinEntries.unshift(...baseEntries)
        } else if (explicitReceipts.length === 0 && initialGrossQty > 0) {
          const baseEntry: BinCardMovementEntry = {
            id: `BCE-init-${p.id}`,
            type: "entry",
            date: p.manufacturingDate || p.createdDate?.slice(0, 10) || (p.createdAt ? p.createdAt.slice(0, 10) : "2020-01-01"),
            batchNo: p.batch || "BATCH-001",
            qtyReceived: initialGrossQty,
            qtyIssued: 0,
            balance: initialGrossQty,
            expiryDate: p.expiry || "",
            mfgDate: p.manufacturingDate,
            party: p.supplierName || "Initial Stock Deposit",
            unitPrice: Number(p.unitCost || 0),
            remark: "Initial Stock Deposit",
            createdAt: p.createdDate || p.createdAt || new Date().toISOString(),
          }
          mappedPharmaBinEntries.unshift(baseEntry)
        }

        // Sort chronologically and compute running balances
        mappedPharmaBinEntries.sort((a, b) => {
          const timeA = new Date(a.date && a.date !== "—" ? a.date : 0).getTime()
          const timeB = new Date(b.date && b.date !== "—" ? b.date : 0).getTime()
          if (timeA !== timeB) return timeA - timeB
          const createA = new Date((a as any).createdAt || (a as any).created_at || 0).getTime()
          const createB = new Date((b as any).createdAt || (b as any).created_at || 0).getTime()
          if (createA && createB && createA !== createB) return createA - createB
          const aIsEntry = a.type === "entry" || Number(a.qtyReceived || 0) > 0
          const bIsEntry = b.type === "entry" || Number(b.qtyReceived || 0) > 0
          if (aIsEntry && !bIsEntry) return -1
          if (!aIsEntry && bIsEntry) return 1
          return 0
        })

        let rBal = 0
        mappedPharmaBinEntries = mappedPharmaBinEntries.map((m) => {
          rBal += Number(m.qtyReceived || 0) - Number(m.qtyIssued || 0)
          return { ...m, balance: Math.max(0, rBal) }
        })

        const { updatedBatches, totalStockValue: reconciledVal, weightedCost: pharmaCost, totalQuantity: pharmaQty } =
          this.reconcileBatches(mappedPharmaBinEntries, Number(p.unitCost || 0))

        const calculatedVal: number = pharmaQty <= 0 ? 0 : reconciledVal

        const finalPharmaVal: number = pharmaQty <= 0
          ? 0
          : (Number(p.totalStockValue || p.total_stock_value || 0) > 0
              ? Number(p.totalStockValue || p.total_stock_value)
              : calculatedVal)

        const finalPharmaCost: number = Number(p.unitCost || p.unit_cost || 0) > 0
          ? Number(p.unitCost || p.unit_cost)
          : (pharmaQty > 0 ? Math.round((finalPharmaVal / pharmaQty) * 100) / 100 : pharmaCost)

        const latestBatch = p.batch_no || p.batchNo || updatedBatches[0]?.batchNo || mappedBatches[0]?.batchNo || p.batch || ""
        const latestExpiry = p.expiry_date || p.expiryDate || updatedBatches[0]?.expiry || mappedBatches[0]?.expiry || p.expiry || ""
        const mfgDate = p.mfg_date || p.mfgDate || p.manufacturingDate || ""

        return {
          ...p,
          warehouse: p.warehouse || p.warehouse_id || "WH2",
          dosage: p.dosage || p.strength || p.dosage_form || "",
          shelfNo: p.shelfNo || p.shelf_number || p.shelf_no || "",
          quantityPerPack: Number(p.quantityPerPack || p.quantity_per_pack || 1),
          numberOfCartons: Number(p.numberOfCartons || p.number_of_cartons || 0),
          quantity: pharmaQty,
          totalQuantity: initialGrossQty,
          totalStockValue: finalPharmaVal,
          unitCost: finalPharmaCost,
          sellingPrice: Number(p.sellingPrice || (p as any).selling_price || p.price || finalPharmaCost),
          batch: latestBatch,
          batchNo: latestBatch,
          expiry: latestExpiry,
          expiryDate: latestExpiry,
          mfgDate: mfgDate,
          manufacturingDate: mfgDate,
          batches: updatedBatches.length > 0 ? updatedBatches : mappedBatches,
          binCardEntries: mappedPharmaBinEntries,
        }
      })

      const rawProducts: Product[] = [...hydratedExport, ...hydratedPharma]
      const uniqueProductMap = new Map<string, Product>()
      for (const prod of rawProducts) {
        if (prod && prod.id && !uniqueProductMap.has(prod.id)) {
          uniqueProductMap.set(prod.id, prod)
        }
      }
      this.products = sortNewestFirst(Array.from(uniqueProductMap.values())).map((product) => this.withInventoryValue(product))

      this.transfers = sortNewestFirst(
        (transfers || []).map((t: any) => {
          const rawItems = (transferItems || []).filter((ti: any) => ti.transfer_id === t.id || ti.transferId === t.id)
          const line_items =
            rawItems.length > 0
              ? rawItems.map((ti: any, idx: number) => ({
                  line_no: idx + 1,
                  productId: ti.product_id || ti.productId || "",
                  item: ti.product_name || ti.productName || "Product",
                  batch_no: ti.batch_no || ti.batchNo || "BATCH",
                  quantity: Number(ti.quantity || 0),
                  UOM: ti.uom || ti.UOM || "Unit",
                  unit_price: Number(ti.unit_cost || ti.unitCost || 0),
                  expiry: "",
                  remark: ti.notes || "",
                }))
              : Array.isArray(t.line_items)
              ? t.line_items
              : Array.isArray(t.items)
              ? t.items
              : []

          const totalQty = line_items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0)

          return {
            id: t.id,
            reference_number: t.transfer_no || t.transferNo || t.reference_number || t.id,
            from_warehouse: t.from_warehouse_id || t.from_warehouse || t.fromWarehouse || "WH2",
            to_warehouse: t.to_warehouse_id || t.to_warehouse || t.toWarehouse || "WH3",
            status: t.status || "Draft",
            date: t.request_date || t.requestDate || t.date || new Date().toISOString().slice(0, 10),
            total_quantity: totalQty || Number(t.total_quantity || t.totalQuantity || 0),
            issued_by: t.requested_by || t.requestedBy || t.issued_by || "",
            received_by: t.approved_by || t.approvedBy || t.received_by || "",
            issued_at: t.request_date || t.issued_at || "",
            received_at: t.completed_date || t.completedDate || t.received_at || "",
            line_items,
          } as Transfer
        })
      )
      this.stockMovements = sortNewestFirst(stockMovements)
      if (suppliers.length > 0) this.suppliers = sortNewestFirst(suppliers)
      if (purchaseOrders.length > 0) this.purchaseOrders = sortNewestFirst(purchaseOrders)

      // Direct quarantine records from dedicated MySQL table
      const directQuarantines: QuarantineRecord[] = (quarantineDbRecords || []).map((q: any) => ({
        id: q.id,
        warehouseId: q.warehouse_id || q.warehouseId || "WH2",
        warehouseName: q.warehouse_name || q.warehouseName || q.warehouse_id || "WH2",
        productId: q.product_id || q.productId || "",
        productName: q.product_name || q.productName || "Medicine",
        sku: q.sku || "",
        batchNo: q.batch_no || q.batchNo || "",
        nameEntered: q.name_entered || q.nameEntered || "Store Officer",
        quarantineDate: q.quarantine_date || q.quarantineDate || new Date().toISOString().slice(0, 10),
        quantity: Number(q.quantity || 0),
        unit: q.unit || "Box",
        proposedReleaseDate: q.proposed_release_date || q.proposedReleaseDate || "",
        reason: q.reason || "Broken / Damaged Medicine",
        status: (q.status || "Quarantined") as "Quarantined" | "Released" | "Disposed",
        binCardEntryId: q.bin_card_entry_id || q.binCardEntryId,
        createdAt: q.created_at || q.createdAt || new Date().toISOString(),
      }))

      // Sync quarantine records from stock movements and product bin card ledgers
      const movementQuarantines: QuarantineRecord[] = this.stockMovements
        .filter((m: any) => {
          const type = String(m.type || m.movementType || m.movement_type || "").toUpperCase()
          const ref = String(m.reference || m.referenceId || m.reference_id || "")
          const refType = String(m.referenceType || m.reference_type || "").toUpperCase()
          return type === "QUARANTINE" || refType === "QUARANTINE" || ref.startsWith("QRN-")
        })
        .map((m: any) => {
          const prodId = m.productId || (m as any).product_id || ""
          const prod = this.products.find((p) => p.id === prodId || (m.sku && p.sku === m.sku))
          const batchNo = (m as any).batchNo || (m as any).batch_no || prod?.batch || ""
          const qty = Number(m.qty !== undefined ? m.qty : (m.quantity !== undefined ? m.quantity : 0))
          const nameEntered = (m as any).nameEntered || (m as any).performedBy || (m as any).performed_by || "Store Officer"
          const quarantineDate = (m as any).quarantineDate || m.date || (m as any).movementDate || (m as any).movement_date || new Date().toISOString().slice(0, 10)
          const reason = m.remarks || m.notes || (m as any).reason || "Broken / Damaged Medicine"
          const whId = m.fromWarehouse || m.toWarehouse || m.warehouseId || (m as any).warehouse_id || prod?.warehouse || "WH2"

          return {
            id: m.id || (m as any).reference_id || `QRN-${Date.now()}`,
            warehouseId: whId,
            warehouseName: whId,
            productId: prodId || prod?.id || "",
            productName: prod?.name || m.productName || (m as any).product_name || "Medicine",
            sku: prod?.sku || m.sku || "",
            batchNo: batchNo,
            nameEntered: nameEntered,
            quarantineDate: quarantineDate,
            quantity: qty,
            unit: prod?.unit || m.unit || "Box",
            proposedReleaseDate: (m as any).proposedReleaseDate || "",
            reason: reason,
            status: ((m as any).status || "Quarantined") as "Quarantined" | "Released" | "Disposed",
            createdAt: (m as any).createdAt || m.date || new Date().toISOString(),
          }
        })

      // Also collect from product binCardEntries with type === "quarantine"
      const binCardQuarantines: QuarantineRecord[] = []
      for (const prod of this.products) {
        if (prod.binCardEntries && Array.isArray(prod.binCardEntries)) {
          for (const bce of prod.binCardEntries) {
            if (bce.type === "quarantine") {
              const alreadyInMovs = movementQuarantines.some((mq) => mq.id === bce.id || mq.binCardEntryId === bce.id || mq.id.includes(bce.id) || bce.id.includes(mq.id))
              if (!alreadyInMovs) {
                binCardQuarantines.push({
                  id: bce.id,
                  warehouseId: prod.warehouse || "WH2",
                  warehouseName: prod.warehouse || "WH2",
                  productId: prod.id,
                  productName: prod.name,
                  sku: prod.sku,
                  batchNo: bce.batchNo || prod.batch || "",
                  nameEntered: "Store Officer",
                  quarantineDate: bce.date || new Date().toISOString().slice(0, 10),
                  quantity: Number(bce.qtyIssued || 0),
                  unit: prod.unit || "Box",
                  proposedReleaseDate: "",
                  reason: bce.remark || "Broken / Damaged Medicine",
                  status: "Quarantined",
                  binCardEntryId: bce.id,
                  createdAt: bce.createdAt || bce.date || new Date().toISOString(),
                })
              }
            }
          }
        }
      }

      // Merge direct dedicated table records first, then fallback to movement/bin-card quarantined entries
      const allQuarantineMap = new Map<string, QuarantineRecord>()
      for (const dq of directQuarantines) {
        allQuarantineMap.set(dq.id, dq)
      }
      for (const mq of [...movementQuarantines, ...binCardQuarantines]) {
        if (!allQuarantineMap.has(mq.id)) {
          allQuarantineMap.set(mq.id, mq)
        }
      }
      this.quarantineRecords = sortNewestFirst(Array.from(allQuarantineMap.values()))

      this._inventoryLoaded = true
      this._loadError = null
    } catch (error) {
      console.error("Failed to load Inventory data from Database.", error)
      const msg = error instanceof Error ? error.message : "Could not connect to the server. Inventory data is unavailable."
      if (/token|expired|jwt/i.test(msg)) {
        this._loadError = null
      } else {
        this._loadError = msg
      }
    } finally {
      this._inventoryLoading = false
      this.loading = this._salesLoading
      this.listeners.forEach((l) => l())
    }
  }

  /**
   * Scoped loader for Sales Module (Sales Orders, Quotations, Delivery Notes, Customers, Suppliers)
   */
  public async loadSalesData(force = false): Promise<void> {
    if (!useAuthStore.getState().token) return
    if (this._salesLoaded && !force) return
    if (this._salesLoading) return

    this._salesLoading = true
    if (!this._salesLoaded) {
      this.loading = true
      this._loadError = null
      this.listeners.forEach((l) => l())
    }

    try {
      const [
        salesOrders,
        purchaseOrders,
        customers,
        suppliers,
        warehouses,
        exportProducts,
        pharmaProducts,
      ] = await Promise.all([
        loadResource<SalesOrder>("sales_orders"),
        loadResource<PurchaseOrder>("purchase_orders"),
        loadResource<Customer>("customers"),
        loadResource<Supplier>("suppliers"),
        loadResource<Warehouse>("warehouses").catch(() => []),
        loadResource<Product>("export_products").catch(() => []),
        loadResource<Product>("pharma_products").catch(() => []),
      ])

      this.salesOrders = sortNewestFirst(salesOrders)
      this.purchaseOrders = sortNewestFirst(purchaseOrders)
      this.customers = sortNewestFirst(customers)
      this.suppliers = sortNewestFirst(suppliers)
      if (warehouses && warehouses.length > 0) {
        this.warehouses = withOperatingWarehouses(warehouses)
      }
      if (!this._inventoryLoaded && this.products.length === 0) {
        const combinedProds = [...(exportProducts || []), ...(pharmaProducts || [])]
        if (combinedProds.length > 0) {
          this.products = sortNewestFirst(combinedProds).map((product) => this.withInventoryValue(product))
        }
      }
      this.quotations = []
      this.deliveryNotes = []

      this._salesLoaded = true
      this._loadError = null
    } catch (error) {
      console.error("Failed to load Sales data from Database.", error)
      const msg = error instanceof Error ? error.message : "Could not connect to the server. Sales data is unavailable."
      if (/token|expired|jwt/i.test(msg)) {
        this._loadError = null
      } else {
        this._loadError = msg
      }
    } finally {
      this._salesLoading = false
      this.loading = this._inventoryLoading
      this.listeners.forEach((l) => l())
    }
  }

  /**
   * Role-aware loader: loads inventory, sales, or both depending on the active user's roles or explicit scope.
   */
  public async loadFromApi(scope?: "inventory" | "sales" | "all") {
    const user = useAuthStore.getState().user
    const roles = user?.roles || []

    if (!user || roles.length === 0) return

    if (scope === "inventory") {
      await this.loadInventoryData(true)
      return
    }
    if (scope === "sales") {
      await this.loadSalesData(true)
      return
    }
    if (scope === "all" || roles.includes("superadmin")) {
      await Promise.all([this.loadInventoryData(true), this.loadSalesData(true)])
      return
    }

    const tasks: Promise<void>[] = []
    if (roles.includes("inventory_admin")) {
      tasks.push(this.loadInventoryData(true))
    }
    if (roles.includes("sales_manager") || roles.includes("hkc_docs_manager")) {
      tasks.push(this.loadSalesData(true))
    }

    if (tasks.length > 0) {
      await Promise.all(tasks)
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public async reloadFromApi() {
    await this.loadFromApi("all")
  }

  public isLoading() {
    return this.loading || this._inventoryLoading || this._salesLoading
  }

  public getLoadError(): string | null {
    return this._loadError
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  private withInventoryValue(product: Product): Product {
    const quantity = Number(product.quantity || 0)
    const unitCost = Number(product.unitCost || product.sellingPrice || (product as any).unit_price || 0)

    const isExport = isExportWarehouse(product.warehouse, this.warehouses) || (Array.isArray(product.wh1Entries) && product.wh1Entries.length > 0)

    let totalStockValue = Math.round(quantity * unitCost * 100) / 100
    let batches = Array.isArray(product.batches) ? product.batches : []
    let derivedQty = quantity
    let derivedUnitCost = unitCost

    if (Array.isArray(product.binCardEntries) && product.binCardEntries.length > 0) {
      if (!isExport) {
        const val = this.reconcileBatches(product.binCardEntries, unitCost)
        derivedQty = val.totalQuantity
        totalStockValue = val.totalStockValue
        derivedUnitCost = val.weightedCost
        if (val.updatedBatches.length > 0) {
          batches = val.updatedBatches
        }
      } else {
        totalStockValue = (product.wh1Entries || []).reduce(
          (sum, entry) => sum + (Number(entry.quantityRemaining || 0) * Number(entry.unitPrice || unitCost || 0)),
          0
        )
        totalStockValue = derivedQty <= 0 ? 0 : Math.round(totalStockValue * 100) / 100
        derivedUnitCost = derivedQty > 0 ? Math.round((totalStockValue / derivedQty) * 100) / 100 : unitCost
      }
    } else if (isExport && Array.isArray(product.wh1Entries) && product.wh1Entries.length > 0) {
      totalStockValue = product.wh1Entries.reduce(
        (sum, entry) => sum + (Number(entry.quantityRemaining || 0) * Number(entry.unitPrice || unitCost || 0)),
        0
      )
      totalStockValue = derivedQty <= 0 ? 0 : Math.round(totalStockValue * 100) / 100
      derivedUnitCost = derivedQty > 0 ? Math.round((totalStockValue / derivedQty) * 100) / 100 : unitCost
    } else if (!isExport && batches.length > 0) {
      const batchSum = batches.reduce(
        (sum, b) => sum + (Number(b.qty ?? (b as any).quantity ?? 0) * Number((b as any).unitPrice ?? (b as any).unit_cost ?? unitCost ?? 0)),
        0
      )
      totalStockValue = Math.round(batchSum * 100) / 100
      derivedUnitCost = derivedQty > 0 ? Math.round((totalStockValue / derivedQty) * 100) / 100 : unitCost
    }

    const stockBreakdown =
      Array.isArray(product.stockBreakdown) && product.stockBreakdown.length > 0
        ? product.stockBreakdown
        : [{ warehouse: product.warehouse || "WH1", qty: derivedQty }]

    const wh1Entries = Array.isArray(product.wh1Entries) ? product.wh1Entries : []
    const binCardEntries = Array.isArray(product.binCardEntries) ? product.binCardEntries : []

    const derivedSellingPrice = Number(product.sellingPrice || (product as any).selling_price || (product as any).price || derivedUnitCost)
    const preservedTotalQuantity =
      product.totalQuantity !== undefined && product.totalQuantity !== null && Number(product.totalQuantity) > 0
        ? Number(product.totalQuantity)
        : derivedQty + Number(product.quantitySold || (product as any).quantity_sold || 0)

    return {
      ...product,
      quantity: derivedQty,
      totalQuantity: preservedTotalQuantity,
      unitCost: derivedUnitCost,
      sellingPrice: derivedSellingPrice,
      stockBreakdown,
      batches,
      wh1Entries,
      binCardEntries,
      totalStockValue,
    }
  }

  // Getters
  public getWarehouses(): Warehouse[] {
    return [...this.warehouses]
  }

  public getProducts(): Product[] {
    return [...this.products]
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id)
  }

  public getSalesOrders(): SalesOrder[] {
    return [...this.salesOrders]
  }

  public getSalesOrderById(id: string): SalesOrder | undefined {
    return this.salesOrders.find((so) => so.id === id)
  }

  public getPurchaseOrders(): PurchaseOrder[] {
    return [...this.purchaseOrders]
  }

  public getPurchaseOrderById(id: string): PurchaseOrder | undefined {
    return this.purchaseOrders.find((po) => po.id === id)
  }

  public getCustomers(): Customer[] {
    const seen = new Set<string>()
    const unique: Customer[] = []
    for (const c of this.customers) {
      const key = (c.name || c.id || "").toLowerCase().trim()
      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(c)
      }
    }
    return unique
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id)
  }

  public getSuppliers(): Supplier[] {
    const seen = new Set<string>()
    const unique: Supplier[] = []
    for (const s of this.suppliers) {
      const key = (s.name || s.id || "").toLowerCase().trim()
      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(s)
      }
    }
    return unique
  }

  public getQuotations(): Quotation[] {
    return [...this.quotations]
  }

  public getDeliveryNotes(): DeliveryNote[] {
    return [...this.deliveryNotes]
  }

  public getTransfers(): Transfer[] {
    return [...this.transfers]
  }

  public getStockMovements(): StockMovementLog[] {
    return [...this.stockMovements]
  }

  public async addStockMovement(movement: StockMovementLog) {
    const savedMovement = await createResource<StockMovementLog>("stock_movements", movement)
    this.stockMovements = [savedMovement, ...this.stockMovements]
    this.listeners.forEach((l) => l())
  }

  public getQuarantineRecords(warehouseId?: string): QuarantineRecord[] {
    if (!warehouseId || warehouseId === "ALL") return [...this.quarantineRecords]
    const wid = warehouseId.toLowerCase()
    return this.quarantineRecords.filter((r) => {
      const rWid = (r.warehouseId || "").toLowerCase()
      return (
        rWid === wid ||
        (wid.includes("wh2") && rWid.includes("wh2")) ||
        (wid.includes("wh3") && rWid.includes("wh3"))
      )
    })
  }

  public async addQuarantineRecord(input: {
    warehouseId: string
    warehouseName?: string
    productId: string
    batchNo: string
    nameEntered: string
    quarantineDate: string
    quantity: number
    proposedReleaseDate: string
    reason?: string
  }): Promise<QuarantineRecord> {
    const prod = this.products.find((p) => p.id === input.productId)
    if (!prod) throw new Error("Product not found")

    const issueQty = Number(input.quantity) || 0
    if (issueQty <= 0) throw new Error("Quarantine quantity must be greater than 0")

    const prevQty = Number(prod.quantity || 0)
    if (issueQty > prevQty) {
      throw new Error(`Cannot quarantine ${issueQty} ${prod.unit || "units"}. Only ${prevQty} available in total stock.`)
    }

    const matchesWarehouse = (whA?: string, whB?: string): boolean => {
      if (!whA || !whB) return false
      const a = whA.toLowerCase().trim()
      const b = whB.toLowerCase().trim()
      if (a === b) return true
      if (a.includes("wh2") && b.includes("wh2")) return true
      if (a.includes("wh3") && b.includes("wh3")) return true
      return a.includes(b) || b.includes(a)
    }

    // 1. Deduct from specific batch
    let remainingToDeduct = issueQty
    const updatedBatches = (prod.batches || []).map((b) => {
      if (remainingToDeduct > 0 && (!input.batchNo || b.batchNo === input.batchNo)) {
        const deduct = Math.min(Number(b.qty || 0), remainingToDeduct)
        remainingToDeduct -= deduct
        return { ...b, qty: Math.max(0, Number(b.qty || 0) - deduct) }
      }
      return b
    })

    // 2. Deduct from warehouse stock breakdown
    const updatedBreakdown = (prod.stockBreakdown || []).map((sb) => {
      if (matchesWarehouse(sb.warehouse, input.warehouseId)) {
        return { ...sb, qty: Math.max(0, Number(sb.qty || 0) - issueQty) }
      }
      return sb
    })

    const nextQty = Math.max(0, prevQty - issueQty)
    const packSize = Number(prod.quantityPerPack || 1)
    const nextCartons = packSize > 0 ? Math.floor(nextQty / packSize) : (prod.numberOfCartons || 0)
    const targetBatch = (prod.batches || []).find((b) => b.batchNo === input.batchNo)
    const expiryDate = targetBatch?.expiry || prod.expiry || ""
    const batchPrice = Number(targetBatch?.unitPrice || (targetBatch as any)?.unit_cost || prod.unitCost || 0)

    const qrnId = `QRN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const binEntryId = `BCE-QRN-${Date.now()}`

    // 3. Create dedicated Bin Card movement entry with type "quarantine"
    const quarantineBinEntry: BinCardMovementEntry = {
      id: binEntryId,
      type: "quarantine",
      date: input.quarantineDate || new Date().toISOString().slice(0, 10),
      batchNo: input.batchNo || prod.batch || "BATCH-WH",
      qtyReceived: 0,
      qtyIssued: issueQty,
      balance: nextQty,
      expiryDate,
      party: "Quarantine Hold - Broken/Damaged",
      unitPrice: batchPrice,
      remark: `Quarantined by ${input.nameEntered}: ${input.reason || "Broken/Damaged Medicine"} (Release Date: ${input.proposedReleaseDate})`.trim(),
      createdAt: new Date().toISOString(),
    }

    const currentBinEntries = prod.binCardEntries || []
    const updatedBinEntries = [...currentBinEntries, quarantineBinEntry]

    const { updatedBatches: reconciledBatches, totalStockValue: nextVal, weightedCost } =
      this.reconcileBatches(updatedBinEntries, Number(prod.unitCost || 0))

    // 4. Update product details in store & API
    await this.updateProductDetails(prod.id, {
      quantity: nextQty,
      numberOfCartons: nextCartons,
      totalStockValue: nextVal,
      unitCost: weightedCost,
      stockBreakdown: updatedBreakdown,
      batches: reconciledBatches.length > 0 ? reconciledBatches : updatedBatches,
      binCardEntries: updatedBinEntries,
    })

    // 5. Store Quarantine record
    const record: QuarantineRecord = {
      id: qrnId,
      warehouseId: input.warehouseId,
      warehouseName: input.warehouseName,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      batchNo: input.batchNo,
      nameEntered: input.nameEntered,
      quarantineDate: input.quarantineDate,
      quantity: issueQty,
      unit: prod.unit || "Box",
      proposedReleaseDate: input.proposedReleaseDate,
      reason: input.reason,
      status: "Quarantined",
      binCardEntryId: binEntryId,
      createdAt: new Date().toISOString(),
    }

    this.quarantineRecords.unshift(record)

    // 6. Log to stock_movements in MySQL
    const movementLog: any = {
      id: qrnId,
      date: input.quarantineDate || new Date().toISOString().slice(0, 10),
      movement_date: input.quarantineDate || new Date().toISOString().slice(0, 10),
      type: "QUARANTINE",
      movement_type: "QUARANTINE",
      productId: prod.id,
      product_id: prod.id,
      productName: prod.name,
      sku: prod.sku,
      fromWarehouse: input.warehouseId,
      warehouseId: input.warehouseId,
      warehouse_id: input.warehouseId,
      qty: issueQty,
      quantity: issueQty,
      unit: prod.unit || "Box",
      unit_price: batchPrice,
      unitPrice: batchPrice,
      unit_cost: batchPrice,
      unitCost: batchPrice,
      batchNo: input.batchNo || prod.batch || "",
      batch_no: input.batchNo || prod.batch || "",
      performedBy: input.nameEntered,
      performed_by: input.nameEntered,
      nameEntered: input.nameEntered,
      reference: qrnId,
      reference_id: qrnId,
      referenceType: "QUARANTINE",
      reference_type: "QUARANTINE",
      remarks: `Quarantined by ${input.nameEntered}: ${input.reason || "Broken/Damaged Medicine"} [Batch: ${input.batchNo}]`,
      notes: `Quarantined by ${input.nameEntered}: ${input.reason || "Broken/Damaged Medicine"} [Batch: ${input.batchNo}]`,
      balanceAfter: nextQty,
      balance_after: nextQty,
    }
    await createResource<StockMovementLog>("stock_movements", movementLog).catch(() => {})

    // 7. Persist to dedicated MySQL quarantine_records table
    await createResource<any>("quarantine_records", {
      id: qrnId,
      warehouse_id: input.warehouseId,
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku,
      batch_no: input.batchNo,
      quantity: issueQty,
      unit: prod.unit || "Box",
      quarantine_date: input.quarantineDate,
      proposed_release_date: input.proposedReleaseDate || null,
      status: "Quarantined",
      reason: input.reason || "Broken / Damaged Medicine",
      name_entered: input.nameEntered,
      bin_card_entry_id: binEntryId,
    }).catch((e) => console.warn("Could not save to quarantine_records table:", e))

    this.broadcastInventoryChange()
    this.notify()
    return record
  }

  public async updateQuarantineRecord(id: string, patch: Partial<QuarantineRecord>): Promise<QuarantineRecord> {
    const idx = this.quarantineRecords.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Quarantine record not found")

    const existing = this.quarantineRecords[idx]
    const updated: QuarantineRecord = {
      ...existing,
      ...patch,
    }

    if (existing.binCardEntryId && (patch.reason || patch.proposedReleaseDate || patch.nameEntered)) {
      const prod = this.products.find((p) => p.id === existing.productId)
      if (prod && prod.binCardEntries) {
        const nextBinEntries = prod.binCardEntries.map((b) => {
          if (b.id === existing.binCardEntryId) {
            return {
              ...b,
              remark: `Quarantined by ${updated.nameEntered}: ${updated.reason || "Broken/Damaged Medicine"} (Release Date: ${updated.proposedReleaseDate})`.trim(),
            }
          }
          return b
        })
        await this.updateProductDetails(prod.id, { binCardEntries: nextBinEntries })
      }
    }

    this.quarantineRecords[idx] = updated

    // Persist to MySQL stock_movements
    const movementPatch: Record<string, any> = {}
    if (patch.reason !== undefined) {
      movementPatch.notes = patch.reason
      movementPatch.remarks = patch.reason
    }
    if (patch.nameEntered !== undefined) {
      movementPatch.performed_by = patch.nameEntered
    }
    if (patch.quarantineDate !== undefined) {
      movementPatch.movement_date = patch.quarantineDate
    }
    if (Object.keys(movementPatch).length > 0) {
      await updateResource("stock_movements", id, movementPatch).catch(() => {})
    }

    // Persist to dedicated MySQL quarantine_records table
    const qrnDbPatch: Record<string, any> = {}
    if (patch.nameEntered !== undefined) qrnDbPatch.name_entered = patch.nameEntered
    if (patch.quarantineDate !== undefined) qrnDbPatch.quarantine_date = patch.quarantineDate
    if (patch.proposedReleaseDate !== undefined) qrnDbPatch.proposed_release_date = patch.proposedReleaseDate
    if (patch.status !== undefined) qrnDbPatch.status = patch.status
    if (patch.reason !== undefined) qrnDbPatch.reason = patch.reason
    if (Object.keys(qrnDbPatch).length > 0) {
      await updateResource("quarantine_records", id, qrnDbPatch).catch(() => {})
    }

    this.broadcastInventoryChange()
    this.notify()
    return updated
  }

  public async deleteQuarantineRecord(id: string): Promise<void> {
    const record = this.quarantineRecords.find((r) => r.id === id)
    if (!record) return

    const prod = this.products.find((p) => p.id === record.productId)
    if (prod) {
      const restoreQty = Number(record.quantity) || 0
      const nextQty = Number(prod.quantity || 0) + restoreQty

      const matchesWarehouse = (whA?: string, whB?: string): boolean => {
        if (!whA || !whB) return false
        const a = whA.toLowerCase().trim()
        const b = whB.toLowerCase().trim()
        if (a === b) return true
        if (a.includes("wh2") && b.includes("wh2")) return true
        if (a.includes("wh3") && b.includes("wh3")) return true
        return a.includes(b) || b.includes(a)
      }

      const updatedBatches = (prod.batches || []).map((b) => {
        if (b.batchNo === record.batchNo) {
          return { ...b, qty: Number(b.qty || 0) + restoreQty }
        }
        return b
      })

      const updatedBreakdown = (prod.stockBreakdown || []).map((sb) => {
        if (matchesWarehouse(sb.warehouse, record.warehouseId)) {
          return { ...sb, qty: Number(sb.qty || 0) + restoreQty }
        }
        return sb
      })

      const updatedBinEntries = (prod.binCardEntries || []).filter(
        (b) => b.id !== record.binCardEntryId && b.id !== record.id
      )

      const { recalculatedEntries } = this.recalculateBinCardLedger(updatedBinEntries)
      const { updatedBatches: reconciledBatches, totalStockValue: nextVal, weightedCost } =
        this.reconcileBatches(recalculatedEntries, Number(prod.unitCost || 0))

      const packSize = Number(prod.quantityPerPack || 1)
      const nextCartons = packSize > 0 ? Math.floor(nextQty / packSize) : (prod.numberOfCartons || 0)

      await this.updateProductDetails(prod.id, {
        quantity: nextQty,
        numberOfCartons: nextCartons,
        totalStockValue: nextVal,
        unitCost: weightedCost,
        stockBreakdown: updatedBreakdown,
        batches: reconciledBatches.length > 0 ? reconciledBatches : updatedBatches,
        binCardEntries: recalculatedEntries,
      })
    }

    this.quarantineRecords = this.quarantineRecords.filter((r) => r.id !== id)
    await Promise.all([
      deleteResource("stock_movements", id).catch(() => {}),
      deleteResource("quarantine_records", id).catch(() => {}),
    ])
    this.broadcastInventoryChange()
    this.notify()
  }

  public async recordStockReceipt(input: { productId: string; warehouse: string; quantity: number; remarks?: string }): Promise<StockMovementLog> {
    const product = this.products.find((item) => item.id === input.productId)
    if (!product) throw new Error("Product not found.")
    if (!input.warehouse) throw new Error("Receiving warehouse is required.")
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Receipt quantity must be greater than zero.")

    const existingEntry = product.stockBreakdown.find((entry) => entry.warehouse === input.warehouse)
    const nextBreakdown = existingEntry
      ? product.stockBreakdown.map((entry) => entry.warehouse === input.warehouse ? { ...entry, qty: Number(entry.qty || 0) + input.quantity } : entry)
      : [...product.stockBreakdown, { warehouse: input.warehouse, qty: input.quantity }]
    const nextQuantity = nextBreakdown.reduce((sum, entry) => sum + Number(entry.qty || 0), 0)
    const hasQuarantinedBatch = product.batches.some((batch) => batch.status === "Quarantined")
    const hasPendingBatch = product.batches.some((batch) => batch.status === "Pending QA")
    const nextStatus: Product["status"] = hasQuarantinedBatch
      ? "Quarantined"
      : hasPendingBatch
        ? "Pending QA"
        : nextQuantity <= 0
          ? "Out of Stock"
          : nextQuantity <= Number(product.reorderLevel || 0)
            ? "Low Stock"
            : "In Stock"
    const timestamp = Date.now()
    const movement: StockMovementLog = {
      id: `SM-${timestamp}`,
      date: new Date().toISOString(),
      type: "RECEIPT",
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      toWarehouse: input.warehouse,
      qty: input.quantity,
      unit: product.unit,
      reference: `RECEIPT-${timestamp}`,
      remarks: input.remarks,
    }

    const updatedProduct = this.withInventoryValue({ ...product, quantity: nextQuantity, stockBreakdown: nextBreakdown, status: nextStatus })
    const isExport = isExportWarehouse(product.warehouse, this.warehouses)
    const targetTable = isExport ? "export_products" : "pharma_products"
    const savedProduct = await updateResource<Product>(targetTable, product.id, updatedProduct)
    const savedMovement = await createResource<StockMovementLog>("stock_movements", movement)
    const nextProducts = this.products.map((item) => item.id === product.id ? savedProduct : item)
    const nextMovements = [savedMovement, ...this.stockMovements]
    this.products = nextProducts
    this.stockMovements = nextMovements
    this.listeners.forEach((listener) => listener())
    return movement
  }

  // Inter-Warehouse Transfer Execution
  public async addStockTransfer(transfer: Transfer): Promise<{ success: boolean; journalEntryId?: string }> {
    let transferVal = 0
    let jeId: string | undefined = undefined

    const matchesWarehouse = (whA?: string, whB?: string): boolean => {
      if (!whA || !whB) return false
      const a = whA.toLowerCase().trim()
      const b = whB.toLowerCase().trim()
      if (a === b) return true
      if (a.includes("wh2") && b.includes("wh2")) return true
      if (a.includes("wh3") && b.includes("wh3")) return true
      return a.includes(b) || b.includes(a)
    }

    // Only move inventory and post GL entry if transfer is Issued or Received (not Draft)
    if (transfer.status !== "Draft") {
      for (const item of transfer.line_items) {
        const originProd = this.products.find(
          (p) =>
            matchesWarehouse(p.warehouse, transfer.from_warehouse) &&
            (p.id === item.productId || p.name.toLowerCase().trim() === item.item.toLowerCase().trim() || p.sku === item.item)
        ) || this.products.find(
          (p) => p.id === item.productId || p.name.toLowerCase().trim() === item.item.toLowerCase().trim()
        )

        const valuation = originProd ? (originProd.unitCost || 1000) : 1000
        const issueQty = Number(item.quantity) || 0
        transferVal += issueQty * valuation

        if (originProd) {
          let remainingToDeduct = issueQty
          const updatedBatches = (originProd.batches || []).map((b) => {
            if (remainingToDeduct > 0 && (!item.batch_no || b.batchNo === item.batch_no)) {
              const deduct = Math.min(Number(b.qty || 0), remainingToDeduct)
              remainingToDeduct -= deduct
              return { ...b, qty: Math.max(0, Number(b.qty || 0) - deduct) }
            }
            return b
          })

          const prevQty = Number(originProd.quantity || 0)
          const newBalance = Math.max(0, prevQty - issueQty)

          const updatedBreakdown = (originProd.stockBreakdown || []).map((sb) => {
            if (matchesWarehouse(sb.warehouse, transfer.from_warehouse)) {
              return { ...sb, qty: Math.max(0, Number(sb.qty || 0) - issueQty) }
            }
            return sb
          })

          const currentBinEntries = originProd.binCardEntries || []
          const leaveEntry: BinCardMovementEntry = {
            id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "leave",
            date: transfer.date || new Date().toISOString().slice(0, 10),
            voucherNo: transfer.reference_number,
            batchNo: item.batch_no || originProd.batch || originProd.batches?.[0]?.batchNo || "BATCH-WH",
            qtyReceived: 0,
            qtyIssued: issueQty,
            balance: newBalance,
            expiryDate: item.expiry || originProd.batches?.[0]?.expiry || originProd.expiry || "",
            party: `Transfer to ${transfer.to_warehouse}`,
            unitPrice: item.unit_price || originProd.unitCost,
            remark: item.remark || `Stock Transfer Dispatch (${transfer.reference_number})`,
            createdAt: new Date().toISOString(),
          }

          await this.updateProductDetails(originProd.id, {
            quantity: newBalance,
            batches: updatedBatches,
            stockBreakdown: updatedBreakdown,
            binCardEntries: [...currentBinEntries, leaveEntry],
          })
        }

        // Record Stock Movement Log
        const movement: StockMovementLog = {
          id: `SM-${Date.now().toString().slice(-4)}`,
          date: transfer.date || new Date().toISOString().split("T")[0],
          type: "TRANSFER",
          productId: originProd?.id,
          productName: item.item,
          fromWarehouse: transfer.from_warehouse,
          toWarehouse: transfer.to_warehouse,
          qty: issueQty,
          unit: item.UOM,
          reference: transfer.reference_number,
          remarks: item.remark || `Transfer from ${transfer.from_warehouse} to ${transfer.to_warehouse}`,
        }
        await createResource<StockMovementLog>("stock_movements", movement).catch(() => {})
        this.stockMovements.unshift(movement)
      }

      // Post Double-Entry Journal Voucher in Finance Store for inter-warehouse inventory asset transfer
      const stockAcc = financeStore.getMappedAccount("inventory_stock_in_hand", "1410-01")

      if (stockAcc && transferVal > 0) {
        const postRes = financeStore.postJournalEntry(
          {
            entry_date: transfer.date || new Date().toISOString().split("T")[0],
            description: `Inter-Warehouse Inventory Asset Transfer ${transfer.reference_number} (${transfer.from_warehouse} → ${transfer.to_warehouse})`,
            source_type: "Warehouse Transfer",
            source_id: transfer.reference_number,
            created_by: transfer.issued_by || "Warehouse Store Manager",
            currency: "ETB",
            exchange_rate: 1.0,
          },
          [
            { account_id: stockAcc.id, debit_amount: transferVal, credit_amount: 0, warehouse_id: transfer.to_warehouse },
            { account_id: stockAcc.id, debit_amount: 0, credit_amount: transferVal, warehouse_id: transfer.from_warehouse },
          ]
        )
        if (postRes.success && postRes.entry) {
          jeId = postRes.entry.id
          transfer.journalEntryId = jeId
        }
      }
    }

    this.transfers.unshift(transfer)
    await createResource<PersistedTransfer>("store_transfers", { id: transfer.reference_number, ...transfer }).catch((err) =>
      console.error("Failed to persist store transfer:", err)
    )
    this.notify()
    return { success: true, journalEntryId: jeId }
  }

  public async updateTransferStatus(
    refNum: string,
    status: TransferStatus,
    receivedBy?: string,
    remark?: string,
    receivedSignature?: string,
    receivedAt?: string
  ): Promise<void> {
    const currentTransfer = this.transfers.find((t) => t.reference_number === refNum)
    if (!currentTransfer) return
    const prevStatus = currentTransfer.status

    const matchesWarehouse = (whA?: string, whB?: string): boolean => {
      if (!whA || !whB) return false
      const a = whA.toLowerCase().trim()
      const b = whB.toLowerCase().trim()
      if (a === b) return true
      if (a.includes("wh2") && b.includes("wh2")) return true
      if (a.includes("wh3") && b.includes("wh3")) return true
      return a.includes(b) || b.includes(a)
    }

    // 1. If moving from Draft to Issued: deduct origin stock and record leave in stock ledger
    if (status === "Issued" && prevStatus === "Draft") {
      for (const item of currentTransfer.line_items) {
        const originProd = this.products.find(
          (p) =>
            matchesWarehouse(p.warehouse, currentTransfer.from_warehouse) &&
            (p.id === item.productId || p.name.toLowerCase().trim() === item.item.toLowerCase().trim() || p.sku === item.item)
        ) || this.products.find(
          (p) => p.id === item.productId || p.name.toLowerCase().trim() === item.item.toLowerCase().trim()
        )

        if (originProd) {
          const issueQty = Number(item.quantity) || 0
          let remainingToDeduct = issueQty
          const updatedBatches = (originProd.batches || []).map((b) => {
            if (remainingToDeduct > 0 && (!item.batch_no || b.batchNo === item.batch_no)) {
              const deduct = Math.min(Number(b.qty || 0), remainingToDeduct)
              remainingToDeduct -= deduct
              return { ...b, qty: Math.max(0, Number(b.qty || 0) - deduct) }
            }
            return b
          })
          const newBalance = Math.max(0, Number(originProd.quantity || 0) - issueQty)
          const updatedBreakdown = (originProd.stockBreakdown || []).map((sb) => {
            if (matchesWarehouse(sb.warehouse, currentTransfer.from_warehouse)) {
              return { ...sb, qty: Math.max(0, Number(sb.qty || 0) - issueQty) }
            }
            return sb
          })
          const leaveEntry: BinCardMovementEntry = {
            id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "leave",
            date: currentTransfer.date || new Date().toISOString().slice(0, 10),
            voucherNo: currentTransfer.reference_number,
            batchNo: item.batch_no || originProd.batch || originProd.batches?.[0]?.batchNo || "BATCH-WH",
            qtyReceived: 0,
            qtyIssued: issueQty,
            balance: newBalance,
            expiryDate: item.expiry || originProd.batches?.[0]?.expiry || originProd.expiry || "",
            party: `Transfer to ${currentTransfer.to_warehouse}`,
            unitPrice: item.unit_price || originProd.unitCost,
            remark: item.remark || `Stock Transfer Dispatch (${currentTransfer.reference_number})`,
            createdAt: new Date().toISOString(),
          }
          await this.updateProductDetails(originProd.id, {
            quantity: newBalance,
            batches: updatedBatches,
            stockBreakdown: updatedBreakdown,
            binCardEntries: [...(originProd.binCardEntries || []), leaveEntry],
          })
        }
      }
    }

    // 2. If status is Received and wasn't received yet: post entry into destination warehouse stock
    if (status === "Received" && prevStatus !== "Received") {
      // If it skipped Issued (e.g. from Draft), deduct origin stock first
      if (prevStatus === "Draft") {
        for (const item of currentTransfer.line_items) {
          const originProd = this.products.find(
            (p) =>
              matchesWarehouse(p.warehouse, currentTransfer.from_warehouse) &&
              (p.id === item.productId || p.name.toLowerCase().trim() === item.item.toLowerCase().trim() || p.sku === item.item)
          ) || this.products.find(
            (p) => p.id === item.productId || p.name.toLowerCase().trim() === item.item.toLowerCase().trim()
          )

          if (originProd) {
            const issueQty = Number(item.quantity) || 0
            const newBalance = Math.max(0, Number(originProd.quantity || 0) - issueQty)
            const leaveEntry: BinCardMovementEntry = {
              id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: "leave",
              date: currentTransfer.date || new Date().toISOString().slice(0, 10),
              voucherNo: currentTransfer.reference_number,
              batchNo: item.batch_no || originProd.batch || "BATCH-WH",
              qtyReceived: 0,
              qtyIssued: issueQty,
              balance: newBalance,
              expiryDate: item.expiry || originProd.expiry || "",
              party: `Transfer to ${currentTransfer.to_warehouse}`,
              unitPrice: item.unit_price || originProd.unitCost,
              remark: item.remark || `Stock Transfer Dispatch (${currentTransfer.reference_number})`,
              createdAt: new Date().toISOString(),
            }
            await this.updateProductDetails(originProd.id, {
              quantity: newBalance,
              binCardEntries: [...(originProd.binCardEntries || []), leaveEntry],
            })
          }
        }
      }

      // Add stock entry to destination warehouse
      for (const item of currentTransfer.line_items) {
        const destProd = this.products.find(
          (p) =>
            matchesWarehouse(p.warehouse, currentTransfer.to_warehouse) &&
            (p.name.toLowerCase().trim() === item.item.toLowerCase().trim() || p.sku === item.item)
        )
        const incQty = Number(item.quantity) || 0

        if (destProd) {
          const nextQty = Number(destProd.quantity || 0) + incQty
          let batchMatched = false
          const updatedBatches = (destProd.batches || []).map((b) => {
            if (item.batch_no && b.batchNo === item.batch_no) {
              batchMatched = true
              return { ...b, qty: Number(b.qty || 0) + incQty }
            }
            return b
          })
          if (!batchMatched) {
            updatedBatches.push({
              batchNo: item.batch_no || "BATCH-01",
              qty: incQty,
              expiry: item.expiry || "",
              status: "Released",
            })
          }

          let breakdownMatched = false
          const updatedBreakdown = (destProd.stockBreakdown || []).map((sb) => {
            if (matchesWarehouse(sb.warehouse, currentTransfer.to_warehouse)) {
              breakdownMatched = true
              return { ...sb, qty: Number(sb.qty || 0) + incQty }
            }
            return sb
          })
          if (!breakdownMatched) {
            updatedBreakdown.push({ warehouse: currentTransfer.to_warehouse, qty: incQty })
          }

          const entryRecord: BinCardMovementEntry = {
            id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "entry",
            date: new Date().toISOString().slice(0, 10),
            voucherNo: currentTransfer.reference_number,
            batchNo: item.batch_no || destProd.batch || (destProd.batches?.[0]?.batchNo) || "BATCH-01",
            qtyReceived: incQty,
            qtyIssued: 0,
            balance: nextQty,
            expiryDate: item.expiry || (destProd.batches?.[0]?.expiry) || destProd.expiry || "",
            party: `Transfer from ${currentTransfer.from_warehouse}`,
            unitPrice: item.unit_price || destProd.unitCost,
            remark: `Transfer received from ${currentTransfer.from_warehouse} (${currentTransfer.reference_number})${remark ? ` - Note: ${remark}` : ""}`,
            createdAt: new Date().toISOString(),
          }

          await this.updateProductDetails(destProd.id, {
            quantity: nextQty,
            batches: updatedBatches,
            stockBreakdown: updatedBreakdown,
            binCardEntries: [...(destProd.binCardEntries || []), entryRecord],
          })
        } else {
          // Destination product does not exist yet: create it in to_warehouse
          const originProd = this.products.find(
            (p) => p.id === item.productId || p.name.toLowerCase().trim() === item.item.toLowerCase().trim()
          )
          const newProdId = `P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          const entryRecord: BinCardMovementEntry = {
            id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "entry",
            date: new Date().toISOString().slice(0, 10),
            voucherNo: currentTransfer.reference_number,
            batchNo: item.batch_no || "BATCH-01",
            qtyReceived: incQty,
            qtyIssued: 0,
            balance: incQty,
            expiryDate: item.expiry || "",
            party: `Transfer from ${currentTransfer.from_warehouse}`,
            unitPrice: item.unit_price || (originProd?.unitCost || 0),
            remark: `Transfer received from ${currentTransfer.from_warehouse} (${currentTransfer.reference_number})${remark ? ` - Note: ${remark}` : ""}`,
            createdAt: new Date().toISOString(),
          }
          const newProd: Product = {
            id: newProdId,
            name: item.item,
            sku: originProd ? `${originProd.sku}-${currentTransfer.to_warehouse.split("-")[0]}` : `SKU-${Date.now().toString().slice(-4)}`,
            category: originProd?.category || "Commercial Drugs",
            unit: item.UOM || originProd?.unit || "Pieces",
            unitCost: item.unit_price || originProd?.unitCost || 0,
            sellingPrice: originProd?.sellingPrice || item.unit_price || 0,
            reorderLevel: originProd?.reorderLevel || 10,
            quantity: incQty,
            status: "In Stock",
            warehouse: currentTransfer.to_warehouse,
            warehouseName: currentTransfer.to_warehouse,
            batch: item.batch_no || "BATCH-01",
            expiry: item.expiry || "",
            batches: [
              {
                batchNo: item.batch_no || "BATCH-01",
                qty: incQty,
                expiry: item.expiry || "",
                status: "Released",
              },
            ],
            stockBreakdown: [
              {
                warehouse: currentTransfer.to_warehouse,
                qty: incQty,
              },
            ],
            binCardEntries: [entryRecord],
            origin: originProd?.origin || "Imported",
            supplierName: originProd?.supplierName || "Internal Transfer",
          }
          await this.addProduct(newProd)
        }

        // Record stock movement log for receipt
        const movement: StockMovementLog = {
          id: `SM-${Date.now().toString().slice(-4)}`,
          date: new Date().toISOString().split("T")[0],
          type: "RECEIPT",
          productName: item.item,
          fromWarehouse: currentTransfer.from_warehouse,
          toWarehouse: currentTransfer.to_warehouse,
          qty: incQty,
          unit: item.UOM,
          reference: currentTransfer.reference_number,
          remarks: `Transfer received from ${currentTransfer.from_warehouse} (${currentTransfer.reference_number})`,
        }
        await createResource<StockMovementLog>("stock_movements", movement).catch(() => {})
        this.stockMovements.unshift(movement)
      }
    }

    const todayStr = receivedAt || new Date().toISOString().replace("T", " ").substring(0, 16)
    const updatedTransfer: Transfer = {
      ...currentTransfer,
      status,
      received_by: receivedBy || currentTransfer.received_by,
      received_at: todayStr,
      received_signature: receivedSignature || currentTransfer.received_signature || receivedBy,
      discrepancy_remark: remark || currentTransfer.discrepancy_remark,
    }

    this.transfers = this.transfers.map((t) => (t.reference_number === refNum ? updatedTransfer : t))
    await updateResource<PersistedTransfer>("store_transfers", refNum, { id: refNum, ...updatedTransfer }).catch((err) =>
      console.error("Failed to update store transfer in DB:", err)
    )
    this.notify()
  }

  // Stock Adjustment (Physical Count Audit & Valuation Adjustment with GL Journal Voucher)
  public adjustStock(
    productId: string,
    warehouse: string,
    newQty: number,
    reason: string
  ): { success: boolean; error?: string; journalEntryId?: string } {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) return { success: false, error: "Product not found" }

    const currentWQty = prod.stockBreakdown.find((sb) => sb.warehouse === warehouse)?.qty ?? prod.quantity
    const delta = newQty - currentWQty
    if (delta === 0) return { success: true }

    const unitCost = prod.unitCost || 1000
    const adjustmentVal = Math.abs(delta) * unitCost

    // Update Product Stock Breakdown & Total
    let updatedBreakdown = prod.stockBreakdown.map((sb) =>
      sb.warehouse === warehouse ? { ...sb, qty: newQty } : sb
    )
    if (!updatedBreakdown.some((sb) => sb.warehouse === warehouse)) {
      updatedBreakdown.push({ warehouse, qty: newQty })
    }

    const newTotalQty = updatedBreakdown.reduce((sum, sb) => sum + sb.qty, 0)
    const newStatus = newTotalQty === 0 ? "Out of Stock" : newTotalQty < (prod.reorderLevel || 100) ? "Low Stock" : "In Stock"

    this.updateProduct(productId, {
      quantity: newTotalQty,
      stockBreakdown: updatedBreakdown,
      totalStockValue: newTotalQty * unitCost,
      status: newStatus,
    })

    // Post GL Journal Entry for Stock Gain/Loss
    const isGain = delta > 0
    const stockAcc = financeStore.getMappedAccount("inventory_stock_in_hand", "1410-01")
    const adjAcc = isGain
      ? financeStore.getMappedAccount("stock_adjustment_gain", "4200")
      : financeStore.getMappedAccount("stock_shrinkage_loss", "6000-22")

    let jeId: string | undefined = undefined
    if (stockAcc && adjAcc && adjustmentVal > 0) {
      const postRes = financeStore.postJournalEntry(
        {
          entry_date: new Date().toISOString().split("T")[0],
          description: `Stock Adjustment Audit for ${prod.name} (${warehouse}): ${isGain ? "Gain" : "Write-off/Loss"} of ${Math.abs(delta)} ${prod.unit} - Reason: ${reason}`,
          source_type: "Warehouse Transfer",
          source_id: `ADJ-${prod.id}`,
          created_by: "Inventory Control Auditor",
          currency: "ETB",
          exchange_rate: 1.0,
        },
        isGain
          ? [
              { account_id: stockAcc.id, debit_amount: adjustmentVal, credit_amount: 0, warehouse_id: warehouse },
              { account_id: adjAcc.id, debit_amount: 0, credit_amount: adjustmentVal, warehouse_id: warehouse },
            ]
          : [
              { account_id: adjAcc.id, debit_amount: adjustmentVal, credit_amount: 0, warehouse_id: warehouse },
              { account_id: stockAcc.id, debit_amount: 0, credit_amount: adjustmentVal, warehouse_id: warehouse },
            ]
      )
      if (postRes.success && postRes.entry) {
        jeId = postRes.entry.id
      }
    }

    // Log Stock Movement
    this.stockMovements.unshift({
      id: `SM-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split("T")[0],
      type: "ADJUSTMENT",
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      fromWarehouse: delta < 0 ? warehouse : undefined,
      toWarehouse: delta > 0 ? warehouse : undefined,
      qty: Math.abs(delta),
      unit: prod.unit,
      reference: `ADJ-${prod.id}`,
      journalEntryId: jeId,
      remarks: `Reason: ${reason}`,
    })

    this.notify()
    return { success: true, journalEntryId: jeId }
  }

  // Actions - Warehouses
  public async addWarehouse(warehouse: Omit<Warehouse, "id"> & { id?: string }): Promise<Warehouse> {
    const id = warehouse.id || `WH-${String(this.warehouses.length + 1).padStart(2, "0")}`
    const newWarehouse: Warehouse = {
      id,
      name: warehouse.name,
      code: warehouse.code || id,
      location: warehouse.location || "",
      warehouse_type: warehouse.warehouse_type || "PHARMA_WH",
      type: warehouse.type || (warehouse.warehouse_type === "EXPORT_WH" ? "Export Hub" : "Pharmaceutical Warehouse"),
    }
    const savedWarehouse = await createResource<Warehouse>("warehouses", newWarehouse)
    this.warehouses = [savedWarehouse, ...this.warehouses]
    this.notify()
    return savedWarehouse
  }

  public async updateWarehouse(id: string, partial: Partial<Warehouse>): Promise<Warehouse> {
    const current = this.warehouses.find((w) => w.id === id)
    if (!current) throw new Error(`Warehouse with ID ${id} not found.`)
    const updated: Warehouse = { ...current, ...partial }
    const savedWarehouse = await updateResource<Warehouse>("warehouses", id, updated)
    this.warehouses = this.warehouses.map((w) => (w.id === id ? savedWarehouse : w))
    this.notify()
    return savedWarehouse
  }

  public async deleteWarehouse(id: string): Promise<{ success: boolean; error?: string }> {
    const hasProducts = this.products.some(
      (p) => p.warehouse === id || p.stockBreakdown?.some((sb) => sb.warehouse === id && sb.qty > 0)
    )
    if (hasProducts) {
      return { success: false, error: "Cannot delete warehouse with active stock in inventory." }
    }
    await deleteResource("warehouses", id)
    this.warehouses = this.warehouses.filter((w) => w.id !== id)
    this.notify()
    return { success: true }
  }

  // Actions - Products
  public async addProduct(product: Product) {
    const isExport = isExportWarehouse(product.warehouse, this.warehouses)
    const targetTable = isExport ? "export_products" : "pharma_products"
    const withVal = this.withInventoryValue(product)
    const savedProduct = await createResource<Product>(targetTable, withVal)

    const initialGross = Number(product.quantity || product.totalQuantity || 0)
    let initWh1Entries: WH1Entry[] = (savedProduct as any)?.wh1Entries || product.wh1Entries || []
    let initBinEntries: BinCardMovementEntry[] = (savedProduct as any)?.binCardEntries || product.binCardEntries || []
    let initBatches: BatchInfo[] = (savedProduct as any)?.batches || product.batches || []

    if (isExport) {
      if (initialGross > 0 && initWh1Entries.length === 0) {
        const initEntryId = `EWM-GRV-${Date.now()}`
        const baseWh1: WH1Entry = {
          id: initEntryId,
          entryId: initEntryId,
          voucherNo: product.voucherNo,
          customer: product.customer || product.supplierName || "Supplier Arrival",
          plateNumber: product.plateNumber,
          entryDate: product.entryDate || new Date().toISOString().slice(0, 10),
          quantityReceived: initialGross,
          quantityRemaining: initialGross,
          unitPrice: Number(product.unitCost || 0),
          notes: "Initial Stock Registration",
        }
        const baseBin: BinCardMovementEntry = {
          id: `BCE-${Date.now()}`,
          type: "entry",
          date: product.entryDate || new Date().toISOString().slice(0, 10),
          batchNo: product.voucherNo ? `GRV-${product.voucherNo}` : "COMMODITY-WH1",
          voucherNo: product.voucherNo,
          plateNumber: product.plateNumber,
          qtyReceived: initialGross,
          qtyIssued: 0,
          balance: initialGross,
          expiryDate: "",
          party: product.customer || product.supplierName || "Supplier Arrival",
          unitPrice: Number(product.unitCost || 0),
          remark: "Initial Stock Registration",
          createdAt: new Date().toISOString(),
        }
        initWh1Entries = [baseWh1]
        initBinEntries = [baseBin]
      }
    } else {
      if (initialGross > 0) {
        const batchNo = product.batch || product.batchNo || "BATCH-01"
        if (initBatches.length === 0) {
          initBatches = [{
            batchNo,
            qty: initialGross,
            expiry: product.expiry || "",
            mfgDate: product.manufacturingDate,
            unitPrice: Number(product.unitCost || 0),
            status: "Released",
          }]
        }
        if (initBinEntries.length === 0) {
          const baseBin: BinCardMovementEntry = {
            id: `BCE-${Date.now()}`,
            type: "entry",
            date: product.manufacturingDate || new Date().toISOString().slice(0, 10),
            batchNo,
            voucherNo: product.voucherNo,
            plateNumber: product.plateNumber,
            qtyReceived: initialGross,
            qtyIssued: 0,
            balance: initialGross,
            expiryDate: product.expiry || "",
            mfgDate: product.manufacturingDate,
            party: product.supplierName || product.customer || "Initial Stock Registration",
            unitPrice: Number(product.unitCost || 0),
            remark: "Initial Stock Registration",
            createdAt: new Date().toISOString(),
          }
          initBinEntries = [baseBin]
        }
        // Update local movement log without extra network POSTs
        for (const entry of initBinEntries) {
          const movementLog: StockMovementLog = {
            id: entry.id,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            type: "RECEIPT",
            toWarehouse: product.warehouse,
            qty: initialGross,
            unit: product.unit || "Unit",
            reference: product.voucherNo || entry.id,
            remarks: "Initial Stock Registration",
            date: entry.date || new Date().toISOString().slice(0, 10),
          }
          this.stockMovements = [movementLog, ...this.stockMovements.filter((m) => m.id !== entry.id)]
        }
      }
    }

    const mergedProduct: Product = {
      ...withVal,
      ...savedProduct,
      wh1Entries: initWh1Entries,
      binCardEntries: initBinEntries,
      batches: initBatches,
      stockBreakdown: withVal.stockBreakdown || [{ warehouse: product.warehouse, qty: product.quantity }],
    }

    this.products = [mergedProduct, ...this.products]
    this.notify()
    this.broadcastInventoryChange()
    return mergedProduct
  }

  public async deleteProduct(id: string) {
    const product = this.products.find((item) => item.id === id)
    const isExport = product ? isExportWarehouse(product.warehouse, this.warehouses) : false
    const targetTable = isExport ? "export_products" : "pharma_products"

    const removedMovements = this.stockMovements.filter((movement) => movement.productId === id || movement.productName === product?.name)
    await Promise.all([
      deleteResource(targetTable, id),
      ...removedMovements.map((movement) => deleteResource("stock_movements", movement.id)),
    ])
    const nextProducts = this.products.filter((item) => item.id !== id)
    const nextMovements = this.stockMovements.filter((movement) => movement.productId !== id && movement.productName !== product?.name)
    this.products = nextProducts
    this.stockMovements = nextMovements
    this.notify()
    this.broadcastInventoryChange()
  }

  public updateProduct(id: string, partial: Partial<Product>) {
    this.products = this.products.map((p) => (p.id === id ? this.withInventoryValue({ ...p, ...partial }) : p))
    this.notify()
    this.broadcastInventoryChange()
  }

  public async updateProductDetails(id: string, partial: Partial<Product>) {
    const currentProduct = this.products.find((product) => product.id === id)
    if (!currentProduct) throw new Error("Product not found")

    const isExport = isExportWarehouse(currentProduct.warehouse, this.warehouses)
    const targetTable = isExport ? "export_products" : "pharma_products"

    // If unitCost is updated, synchronize inbound child entries before withInventoryValue()
    let prepPartial = { ...partial }
    if (prepPartial.unitCost !== undefined && Number(prepPartial.unitCost) > 0) {
      const newCost = Number(prepPartial.unitCost)
      if (!prepPartial.wh1Entries && currentProduct.wh1Entries) {
        prepPartial.wh1Entries = currentProduct.wh1Entries.map((e) => ({ ...e, unitPrice: newCost }))
      }
      if (!prepPartial.batches && currentProduct.batches) {
        prepPartial.batches = currentProduct.batches.map((b) => ({ ...b, unitPrice: newCost }))
      }
      if (!prepPartial.binCardEntries && currentProduct.binCardEntries) {
        prepPartial.binCardEntries = currentProduct.binCardEntries.map((b) => {
          if (b.type === "entry" || Number(b.qtyReceived || 0) > 0) {
            return { ...b, unitPrice: newCost }
          }
          return b
        })
      }
    }

    const updatedProduct = this.withInventoryValue({
      ...currentProduct,
      ...prepPartial,
      updatedAt: new Date().toISOString(),
    })

    // 1. Optimistic 0ms instant local mutation for real-time UI response
    this.products = this.products.map((product) => (product.id === id ? updatedProduct : product))
    this.notify()
    this.broadcastInventoryChange()

    try {
      const savedProduct = await updateResource<Product>(targetTable, id, updatedProduct)

      // Preserve child arrays and in-memory properties that are not columns in relational tables
      const mergedProduct: Product = {
        ...savedProduct,
        ...updatedProduct,
        quantity: Number(updatedProduct.quantity ?? currentProduct.quantity ?? 0),
        totalQuantity: Number(updatedProduct.totalQuantity ?? currentProduct.totalQuantity ?? 0),
        totalStockValue: Number(updatedProduct.totalStockValue ?? currentProduct.totalStockValue ?? 0),
        unitCost: Number(updatedProduct.unitCost ?? currentProduct.unitCost ?? 0),
        sellingPrice: Number(updatedProduct.sellingPrice ?? currentProduct.sellingPrice ?? 0),
        wh1Entries: (savedProduct as any)?.wh1Entries ?? updatedProduct.wh1Entries ?? currentProduct.wh1Entries,
        binCardEntries: (savedProduct as any)?.binCardEntries ?? updatedProduct.binCardEntries ?? currentProduct.binCardEntries,
        batches: (savedProduct as any)?.batches ?? updatedProduct.batches ?? currentProduct.batches,
        stockBreakdown: updatedProduct.stockBreakdown ?? currentProduct.stockBreakdown,
      }

      this.products = this.products.map((product) => (product.id === id ? mergedProduct : product))
      this.notify()
      return mergedProduct
    } catch (err) {
      // Revert optimistic mutation if server call fails
      this.products = this.products.map((product) => (product.id === id ? currentProduct : product))
      this.notify()
      throw err
    }
  }

  public async addWH1Entry(productId: string, entry: Omit<WH1Entry, "entryId">) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    const newEntryId = `WH1E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newEntry: WH1Entry = {
      ...entry,
      id: newEntryId,
      entryId: newEntryId,
    }

    const totalExistingRejects = (prod.binCardEntries || []).filter(b => b.type === "reject").reduce((sum, b) => sum + Number(b.qtyIssued || 0), 0)
    const totalExistingLeaves = (prod.binCardEntries || []).filter(b => b.type === "leave").reduce((sum, b) => sum + Number(b.qtyIssued || 0), 0)
    const initialArrivalQty = Math.max(Number(prod.totalQuantity || 0), Number(prod.quantity || 0) + totalExistingRejects + totalExistingLeaves)

    let currentEntries = [...(prod.wh1Entries || [])]
    if (currentEntries.length === 0 && initialArrivalQty > 0) {
      currentEntries = [{
        id: `WH1E-base-${prod.id}`,
        entryId: `WH1E-base-${prod.id}`,
        voucherNo: prod.voucherNo || (prod.sku ? `GRV-${prod.sku}` : "GRV-001"),
        customer: prod.customer || prod.supplierName || "Supplier Arrival",
        plateNumber: prod.plateNumber,
        entryDate: prod.entryDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        leaveDate: undefined,
        quantityReceived: initialArrivalQty,
        quantityRemaining: Number(prod.quantity || 0),
        unitPrice: Number(prod.unitCost || 0),
        notes: "Initial Stock Registration",
      }]
    }

    const updatedEntries = [...currentEntries, newEntry]

    const nextQty = updatedEntries.reduce((sum, e) => sum + Number(e.quantityRemaining || 0), 0)
    const nextVal = updatedEntries.reduce((sum, e) => sum + (Number(e.quantityRemaining || 0) * Number(e.unitPrice || 0)), 0)
    const weightedCost = nextQty > 0 ? Math.round((nextVal / nextQty) * 100) / 100 : Number(prod.unitCost || 0)

    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: nextQty }]
    const updatedBatches = [{ batchNo: prod.batch || "BATCH-WH1", qty: nextQty, expiry: "", status: "Released" as const }]

    let currentBinEntries = [...(prod.binCardEntries || [])]
    if (currentBinEntries.length === 0 && initialArrivalQty > 0) {
      currentBinEntries = [{
        id: `BCE-base-${prod.id}`,
        type: "entry",
        date: prod.entryDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        batchNo: prod.voucherNo ? `GRV-${prod.voucherNo}` : (prod.sku ? `GRV-${prod.sku}` : "COMMODITY-WH1"),
        voucherNo: prod.voucherNo,
        plateNumber: prod.plateNumber,
        qtyReceived: initialArrivalQty,
        qtyIssued: 0,
        balance: initialArrivalQty,
        expiryDate: "",
        party: prod.customer || prod.supplierName || "Supplier Arrival",
        unitPrice: Number(prod.unitCost || 0),
        remark: "Initial Stock Registration",
        createdAt: prod.createdAt || new Date().toISOString(),
      }]
    }

    const newBinEntry: BinCardMovementEntry = {
      id: newEntryId,
      type: "entry",
      date: entry.entryDate || new Date().toISOString().slice(0, 10),
      batchNo: entry.voucherNo ? `GRV-${entry.voucherNo}` : "COMMODITY-WH1",
      voucherNo: entry.voucherNo,
      plateNumber: entry.plateNumber,
      qtyReceived: Number(entry.quantityReceived || 0),
      qtyIssued: 0,
      balance: nextQty,
      expiryDate: "",
      party: entry.customer || "Supplier Arrival",
      unitPrice: Number(entry.unitPrice || prod.unitCost || 0),
      remark: entry.notes || `Goods Received Voucher ${entry.voucherNo ? `No. ${entry.voucherNo}` : ""}`.trim(),
      createdAt: new Date().toISOString(),
    }
    const updatedBinEntries = [...currentBinEntries, newBinEntry]

    const nextTotalReceived = initialArrivalQty + Number(entry.quantityReceived || 0)

    await this.updateProductDetails(productId, {
      quantity: nextQty,
      totalQuantity: nextTotalReceived,
      unitCost: weightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || weightedCost),
      totalStockValue: nextVal,
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches,
      wh1Entries: updatedEntries,
      binCardEntries: updatedBinEntries,
    })

    // Save to relational table export_warehouse_movements
    try {
      await createResource<any>("export_warehouse_movements", {
        id: newEntryId,
        warehouse_id: prod.warehouse || "WH1",
        product_id: productId,
        movement_type: "GRV_ENTRY",
        voucher_no: entry.voucherNo || null,
        batch_no: entry.voucherNo ? `GRV-${entry.voucherNo}` : "COMMODITY-WH1",
        party_name: entry.customer || "Supplier Arrival",
        plate_number: entry.plateNumber || null,
        gross_quantity: Number(entry.quantityReceived || 0),
        reject_quantity: 0,
        net_quantity: Number(entry.quantityReceived || 0),
        uom: prod.unit || "Quintal",
        unit_price: Number(entry.unitPrice || 0),
        movement_date: entry.entryDate || new Date().toISOString().slice(0, 10),
        reason: entry.notes || "Truckload Inbound Delivery",
        created_by: useAuthStore.getState().user?.fullname || "Warehouse Officer",
      })
    } catch (e) {
      console.warn("Could not write to relational export_warehouse_movements table:", e)
    }
  }

  public async addWH1LeaveEntry(
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
  ) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    const issueQty = Number(leaveData.quantityIssued || 0)
    if (issueQty <= 0) throw new Error("Leave quantity must be greater than 0")

    // Guard: Prevent double-deducting a sales issue that already has a leave record
    const cleanVoucher = (leaveData.voucherNo || "").trim().toLowerCase()
    if (cleanVoucher) {
      const rawVoucher = cleanVoucher.replace(/^fs-/, "")
      const alreadyExists = (prod.binCardEntries || []).some((b) => {
        if (b.type !== "leave") return false
        const bVoucher = (b.voucherNo || "").toLowerCase().trim()
        const bRawVoucher = bVoucher.replace(/^fs-/, "")
        const bRemark = (b.remark || "").toLowerCase().trim()
        return (
          bVoucher === cleanVoucher ||
          bRawVoucher === rawVoucher ||
          (cleanVoucher && bVoucher.includes(cleanVoucher)) ||
          (rawVoucher && bVoucher.includes(rawVoucher)) ||
          (cleanVoucher && bRemark.includes(cleanVoucher)) ||
          (rawVoucher && bRemark.includes(rawVoucher))
        )
      })
      if (alreadyExists) {
        throw new Error(`Sales Issue ${leaveData.voucherNo} has already been deducted and recorded in the ledger. Duplicate deduction prevented.`)
      }
    }

    const totalExistingRejects = (prod.binCardEntries || []).filter(b => b.type === "reject").reduce((sum, b) => sum + Number(b.qtyIssued || 0), 0)
    const totalExistingLeaves = (prod.binCardEntries || []).filter(b => b.type === "leave").reduce((sum, b) => sum + Number(b.qtyIssued || 0), 0)
    const wh1InboundFromEntries = (prod.wh1Entries || []).reduce((sum, e) => sum + Number(e.quantityReceived || 0), 0)
    const initialArrivalQty = wh1InboundFromEntries > 0
      ? wh1InboundFromEntries
      : (Number(prod.totalQuantity || 0) > 0 ? Number(prod.totalQuantity) : Number(prod.quantity || 0) + totalExistingRejects + totalExistingLeaves)

    // FIFO deduction on wh1Entries
    let remaining = issueQty
    let leaveUnitPrice = Number(prod.sellingPrice || (prod as any).selling_price || prod.unitCost || 0)
    let currentWH1Entries = [...(prod.wh1Entries || [])]
    if (currentWH1Entries.length === 0 && initialArrivalQty > 0) {
      currentWH1Entries = [{
        id: `WH1E-base-${prod.id}`,
        entryId: `WH1E-base-${prod.id}`,
        voucherNo: prod.voucherNo || (prod.sku ? `GRV-${prod.sku}` : "GRV-001"),
        customer: prod.customer || prod.supplierName || "Supplier Arrival",
        plateNumber: prod.plateNumber,
        entryDate: prod.entryDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        leaveDate: undefined,
        quantityReceived: initialArrivalQty,
        quantityRemaining: Number(prod.quantity || 0),
        unitPrice: Number(prod.unitCost || 0),
        notes: "Initial Stock Registration",
      }]
    }

    const updatedWH1Entries = currentWH1Entries.map((entry) => {
      if (remaining <= 0) return entry
      const deduct = Math.min(entry.quantityRemaining, remaining)
      if (deduct > 0 && (!leaveData.unitPrice || leaveData.unitPrice === 0)) {
        leaveUnitPrice = Number(prod.sellingPrice || (prod as any).selling_price || entry.unitPrice || prod.unitCost || 0)
      }
      remaining -= deduct
      return {
        ...entry,
        quantityRemaining: Math.max(0, entry.quantityRemaining - deduct),
      }
    })

    const nextQty = Math.max(0, Number(prod.quantity || 0) - issueQty)
    const effectiveLeavePrice = leaveData.unitPrice !== undefined && Number(leaveData.unitPrice) > 0 ? Number(leaveData.unitPrice) : leaveUnitPrice

    let currentBinEntries = [...(prod.binCardEntries || [])]
    if (currentBinEntries.length === 0 && initialArrivalQty > 0) {
      currentBinEntries = [{
        id: `BCE-base-${prod.id}`,
        type: "entry",
        date: prod.entryDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        batchNo: prod.voucherNo ? `GRV-${prod.voucherNo}` : (prod.sku ? `GRV-${prod.sku}` : "COMMODITY-WH1"),
        voucherNo: prod.voucherNo,
        plateNumber: prod.plateNumber,
        qtyReceived: initialArrivalQty,
        qtyIssued: 0,
        balance: initialArrivalQty,
        expiryDate: "",
        party: prod.customer || prod.supplierName || "Supplier Arrival",
        unitPrice: Number(prod.unitCost || 0),
        remark: "Initial Stock Registration",
        createdAt: prod.createdAt || new Date().toISOString(),
      }]
    }

    const newBinEntry: BinCardMovementEntry = {
      id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "leave",
      date: leaveData.date || new Date().toISOString().slice(0, 10),
      voucherNo: leaveData.voucherNo,
      batchNo: "COMMODITY-WH1",
      plateNumber: leaveData.plateNumber,
      qtyReceived: 0,
      qtyIssued: issueQty,
      balance: nextQty,
      expiryDate: "",
      party: leaveData.party || "Customer Dispatch",
      unitPrice: effectiveLeavePrice,
      remark: leaveData.remark || `Outbound Dispatch ${leaveData.voucherNo ? `FS-${leaveData.voucherNo}` : ""}`.trim(),
      createdAt: new Date().toISOString(),
    }
    const updatedBinEntries = [...currentBinEntries, newBinEntry]

    let childNetVal = 0
    for (const b of updatedBinEntries) {
      const isRej = b.type === "reject"
      const isEnt = b.type === "entry" || Number(b.qtyReceived || 0) > 0
      const inQ = isEnt ? Number(b.qtyReceived || 0) : 0
      const outQ = isRej ? Number(b.qtyIssued || (b as any).rejectQuantity || 0) : !isEnt ? Number(b.qtyIssued || 0) : 0
      const price = Number(
        b.unitPrice != null && Number(b.unitPrice) > 0
          ? b.unitPrice
          : isEnt || isRej
          ? prod.unitCost
          : (prod.sellingPrice || (prod as any).selling_price || prod.unitCost || 0)
      )
      if (isEnt) {
        childNetVal += inQ * price
      } else {
        childNetVal -= outQ * price
      }
    }
    const nextVal = nextQty <= 0 ? 0 : Math.max(0, Math.round(childNetVal * 100) / 100)
    const weightedCost = nextQty > 0 ? Math.round((nextVal / nextQty) * 100) / 100 : Number(prod.unitCost || 0)

    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: nextQty }]
    const updatedBatches = [{ batchNo: prod.batch || "BATCH-WH1", qty: nextQty, expiry: "", status: "Released" as const }]

    await this.updateProductDetails(productId, {
      quantity: nextQty,
      quantitySold: (prod.quantitySold || 0) + issueQty,
      totalQuantity: initialArrivalQty,
      unitCost: weightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || weightedCost),
      totalStockValue: nextVal,
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches,
      wh1Entries: updatedWH1Entries,
      binCardEntries: updatedBinEntries,
    })

    // Save to relational table export_warehouse_movements
    try {
      await createResource<any>("export_warehouse_movements", {
        id: newBinEntry.id,
        warehouse_id: prod.warehouse || "WH1",
        product_id: productId,
        movement_type: "OUTBOUND_DISPATCH",
        voucher_no: leaveData.voucherNo || null,
        batch_no: "COMMODITY-WH1",
        party_name: leaveData.party || "Customer Dispatch",
        plate_number: leaveData.plateNumber || null,
        gross_quantity: issueQty,
        reject_quantity: 0,
        net_quantity: -issueQty,
        uom: prod.unit || "Quintal",
        unit_price: effectiveLeavePrice,
        movement_date: leaveData.date || new Date().toISOString().slice(0, 10),
        reason: leaveData.remark || null,
        created_by: useAuthStore.getState().user?.fullname || "Warehouse Officer",
      })
    } catch (e) {
      console.warn("Could not write to relational export_warehouse_movements table:", e)
    }
  }

  public async updateWH1Entry(productId: string, entryId: string, patch: Partial<WH1Entry>) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    let targetVoucher = patch.voucherNo
    const currentEntries = prod.wh1Entries || []
    const updatedEntries = currentEntries.map((e) => {
      if (e.entryId !== entryId && (e as any).id !== entryId) return e
      if (!targetVoucher) targetVoucher = e.voucherNo

      const oldReceived = Number(e.quantityReceived || 0)
      const oldRemaining = Number(e.quantityRemaining ?? oldReceived)
      const previousDeductions = Math.max(0, oldReceived - oldRemaining)

      const quantityReceived = patch.quantityReceived !== undefined ? Number(patch.quantityReceived) : oldReceived
      const quantityRemaining = patch.quantityRemaining !== undefined
        ? Number(patch.quantityRemaining)
        : Math.max(0, quantityReceived - previousDeductions)
      const unitPrice = patch.unitPrice !== undefined ? Number(patch.unitPrice) : Number(e.unitPrice || 0)

      return {
        ...e,
        ...patch,
        quantityReceived,
        quantityRemaining: Math.min(quantityReceived, quantityRemaining),
        unitPrice,
      }
    })

    const nextQty = updatedEntries.reduce((sum, e) => sum + Number(e.quantityRemaining || 0), 0)
    const nextTotalReceived = updatedEntries.reduce((sum, e) => sum + Number(e.quantityReceived || 0), 0)
    const nextVal = updatedEntries.reduce((sum, e) => sum + (Number(e.quantityRemaining || 0) * Number(e.unitPrice || 0)), 0)
    const weightedCost = nextQty > 0 ? Math.round((nextVal / nextQty) * 100) / 100 : Number(prod.unitCost || 0)

    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: nextQty }]
    const updatedBatches = [{ batchNo: prod.batch || "BATCH-WH1", qty: nextQty, expiry: "", status: "Released" as const }]

    // Update binCardEntries in sync so WH1ChildMovementLedger immediately reflects edited values
    const currentBinEntries = prod.binCardEntries || []
    const updatedBinEntries = currentBinEntries.map((b) => {
      if (b.id === entryId || (targetVoucher && b.voucherNo && (b.voucherNo === targetVoucher || b.voucherNo.includes(targetVoucher)))) {
        const newInQty = patch.quantityReceived !== undefined ? Number(patch.quantityReceived) : b.qtyReceived
        const newUnitPrice = patch.unitPrice !== undefined ? Number(patch.unitPrice) : b.unitPrice
        return {
          ...b,
          qtyReceived: newInQty,
          unitPrice: newUnitPrice,
          voucherNo: patch.voucherNo || b.voucherNo,
          party: patch.customer || b.party,
          plateNumber: patch.plateNumber || b.plateNumber,
          date: patch.entryDate || b.date,
          remark: patch.notes || b.remark,
        }
      }
      return b
    })

    let rBal = 0
    const recalculatedBinEntries = updatedBinEntries.map((b) => {
      rBal += Number(b.qtyReceived || 0) - Number(b.qtyIssued || 0)
      return { ...b, balance: rBal }
    })

    await this.updateProductDetails(productId, {
      quantity: nextQty,
      totalQuantity: nextTotalReceived > 0 ? nextTotalReceived : Math.max(Number(prod.totalQuantity || 0), nextQty),
      unitCost: weightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || weightedCost),
      totalStockValue: nextVal,
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches,
      wh1Entries: updatedEntries,
      binCardEntries: recalculatedBinEntries,
    })

    // Update relational export_warehouse_movements table
    try {
      await updateResource<any>("export_warehouse_movements", entryId, {
        voucher_no: patch.voucherNo || null,
        party_name: patch.customer || null,
        plate_number: patch.plateNumber || null,
        gross_quantity: patch.quantityReceived !== undefined ? Number(patch.quantityReceived) : undefined,
        net_quantity: patch.quantityReceived !== undefined ? Number(patch.quantityReceived) : undefined,
        unit_price: patch.unitPrice !== undefined ? Number(patch.unitPrice) : undefined,
        movement_date: patch.entryDate || null,
        reason: patch.notes || null,
      })
    } catch (e) {
      console.warn("Could not write update to relational export_warehouse_movements table:", e)
    }
  }

  public async addWH1RejectEntry(
    productId: string,
    rejectData: {
      entryId?: string
      date: string
      voucherNo?: string
      party?: string
      plateNumber?: string
      rejectQuantity: number
      reason?: string
      notes?: string
    }
  ) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    const rejectQty = Number(rejectData.rejectQuantity || 0)
    if (rejectQty <= 0) throw new Error("Reject quantity must be greater than 0")

    if (rejectQty > prod.quantity) {
      throw new Error(`Cannot reject ${rejectQty} ${prod.unit || "Quintals"}. Current available physical stock is only ${prod.quantity} ${prod.unit || "Quintals"}.`)
    }

    const totalExistingRejects = (prod.binCardEntries || []).filter(b => b.type === "reject").reduce((sum, b) => sum + Number(b.qtyIssued || 0), 0)
    const totalExistingLeaves = (prod.binCardEntries || []).filter(b => b.type === "leave").reduce((sum, b) => sum + Number(b.qtyIssued || 0), 0)
    const wh1InboundFromEntries = (prod.wh1Entries || []).reduce((sum, e) => sum + Number(e.quantityReceived || 0), 0)
    const initialArrivalQty = wh1InboundFromEntries > 0
      ? wh1InboundFromEntries
      : (Number(prod.totalQuantity || 0) > 0 ? Number(prod.totalQuantity) : Number(prod.quantity || 0) + totalExistingRejects + totalExistingLeaves)

    // 1. Deduct from target batch or FIFO on wh1Entries
    let remainingToDeduct = rejectQty
    let totalDeductedVal = 0
    let totalDeductedQty = 0
    let currentWH1Entries = [...(prod.wh1Entries || [])]
    if (currentWH1Entries.length === 0 && initialArrivalQty > 0) {
      currentWH1Entries = [{
        id: `WH1E-base-${prod.id}`,
        entryId: `WH1E-base-${prod.id}`,
        voucherNo: prod.voucherNo || (prod.sku ? `GRV-${prod.sku}` : "GRV-001"),
        customer: prod.customer || prod.supplierName || "Supplier Arrival",
        plateNumber: prod.plateNumber,
        entryDate: prod.entryDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        leaveDate: undefined,
        quantityReceived: initialArrivalQty,
        quantityRemaining: Number(prod.quantity || 0),
        unitPrice: Number(prod.unitCost || 0),
        notes: "Initial Stock Registration",
      }]
    }

    const updatedWH1Entries = currentWH1Entries.map((entry) => {
      if (remainingToDeduct <= 0) return entry
      if (rejectData.entryId && entry.entryId !== rejectData.entryId && (entry as any).id !== rejectData.entryId) return entry

      const deduct = Math.min(entry.quantityRemaining, remainingToDeduct)
      const ePrice = Number(entry.unitPrice || prod.unitCost || 0)
      if (deduct > 0) {
        totalDeductedVal += deduct * ePrice
        totalDeductedQty += deduct
      }
      remainingToDeduct -= deduct
      return {
        ...entry,
        quantityRemaining: Math.max(0, entry.quantityRemaining - deduct),
        rejectQuantity: (entry.rejectQuantity || 0) + deduct,
      }
    })

    const rejectUnitPrice = totalDeductedQty > 0 ? Math.round((totalDeductedVal / totalDeductedQty) * 100) / 100 : Number(prod.unitCost || 0)
    const nextQty = Math.max(0, Number(prod.quantity || 0) - rejectQty)

    // 2. Add binCardEntries reject record
    const movementId = `WH1-REJ-${Date.now()}`
    let currentBinEntries = [...(prod.binCardEntries || [])]
    if (currentBinEntries.length === 0 && initialArrivalQty > 0) {
      currentBinEntries = [{
        id: `BCE-base-${prod.id}`,
        type: "entry",
        date: prod.entryDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        batchNo: prod.voucherNo ? `GRV-${prod.voucherNo}` : (prod.sku ? `GRV-${prod.sku}` : "COMMODITY-WH1"),
        voucherNo: prod.voucherNo,
        plateNumber: prod.plateNumber,
        qtyReceived: initialArrivalQty,
        qtyIssued: 0,
        balance: initialArrivalQty,
        expiryDate: "",
        party: prod.customer || prod.supplierName || "Supplier Arrival",
        unitPrice: Number(prod.unitCost || 0),
        remark: "Initial Stock Registration",
        createdAt: prod.createdAt || new Date().toISOString(),
      }]
    }

    const newBinEntry: BinCardMovementEntry = {
      id: movementId,
      type: "reject",
      date: rejectData.date || new Date().toISOString().slice(0, 10),
      voucherNo: rejectData.voucherNo,
      batchNo: rejectData.entryId || "COMMODITY-WH1",
      plateNumber: rejectData.plateNumber,
      qtyReceived: 0,
      qtyIssued: rejectQty,
      balance: nextQty,
      expiryDate: "",
      party: rejectData.party || "WH1 Cleaning / Processing Line",
      unitPrice: rejectUnitPrice,
      remark: `Reject / Cleaning Loss: ${rejectData.reason || "Impurity Deduction"}${rejectData.notes ? ` (${rejectData.notes})` : ""}${rejectData.voucherNo ? ` [Ref: ${rejectData.voucherNo}]` : ""}`.trim(),
      reason: rejectData.reason,
      createdAt: new Date().toISOString(),
    }
    const updatedBinEntries = [...currentBinEntries, newBinEntry]

    let childNetVal = 0
    for (const b of updatedBinEntries) {
      const isRej = b.type === "reject"
      const isEnt = b.type === "entry" || Number(b.qtyReceived || 0) > 0
      const inQ = isEnt ? Number(b.qtyReceived || 0) : 0
      const outQ = isRej ? Number(b.qtyIssued || (b as any).rejectQuantity || 0) : !isEnt ? Number(b.qtyIssued || 0) : 0
      const price = Number(
        b.unitPrice != null && Number(b.unitPrice) > 0
          ? b.unitPrice
          : isEnt || isRej
          ? prod.unitCost
          : (prod.sellingPrice || (prod as any).selling_price || prod.unitCost || 0)
      )
      if (isEnt) {
        childNetVal += inQ * price
      } else {
        childNetVal -= outQ * price
      }
    }
    const nextVal = nextQty <= 0 ? 0 : Math.max(0, Math.round(childNetVal * 100) / 100)
    const weightedCost = nextQty > 0 ? Math.round((nextVal / nextQty) * 100) / 100 : Number(prod.unitCost || 0)

    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: nextQty }]
    const updatedBatches = [{ batchNo: prod.batch || "BATCH-WH1", qty: nextQty, expiry: "", status: "Released" as const }]

    // 3. Update product in MySQL
    await this.updateProductDetails(productId, {
      quantity: nextQty,
      totalQuantity: initialArrivalQty,
      totalStockValue: nextVal,
      unitCost: weightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || weightedCost),
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches,
      wh1Entries: updatedWH1Entries,
      binCardEntries: updatedBinEntries,
    })

    // 4. Save to relational table export_warehouse_movements
    try {
      await createResource<any>("export_warehouse_movements", {
        id: movementId,
        warehouse_id: prod.warehouse || "WH1",
        product_id: productId,
        movement_type: "REJECT_DEDUCTION",
        voucher_no: rejectData.voucherNo || null,
        batch_no: rejectData.entryId || "COMMODITY-WH1",
        party_name: rejectData.party || "WH1 Cleaning Line",
        plate_number: rejectData.plateNumber || null,
        gross_quantity: 0,
        reject_quantity: rejectQty,
        net_quantity: -rejectQty,
        uom: prod.unit || "Quintal",
        unit_price: rejectUnitPrice,
        movement_date: rejectData.date || new Date().toISOString().slice(0, 10),
        reason: rejectData.reason || rejectData.notes || "Cleaning and sorting reject loss",
        created_by: useAuthStore.getState().user?.fullname || "Quality Officer",
      })
    } catch (e) {
      console.warn("Could not write to relational export_warehouse_movements table:", e)
    }
  }

  public async deleteWH1Entry(productId: string, entryId: string) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    const targetEntry = (prod.wh1Entries || []).find((e) => e.entryId === entryId || (e as any).id === entryId)
    const currentEntries = prod.wh1Entries || []
    const updatedEntries = currentEntries.filter((e) => e.entryId !== entryId && (e as any).id !== entryId)
    const nextQty = updatedEntries.reduce((sum, e) => sum + Number(e.quantityRemaining || 0), 0)

    const currentBinEntries = prod.binCardEntries || []
    const updatedBinEntries = currentBinEntries.filter(
      (b) => b.id !== entryId && (!targetEntry?.voucherNo || b.voucherNo !== targetEntry.voucherNo)
    )
    let rBal = 0
    const recalculatedBinEntries = updatedBinEntries.map((b) => {
      rBal += Number(b.qtyReceived || 0) - Number(b.qtyIssued || 0)
      return { ...b, balance: rBal }
    })

    let childNetVal = 0
    for (const b of recalculatedBinEntries) {
      const isRej = b.type === "reject"
      const isEnt = b.type === "entry" || Number(b.qtyReceived || 0) > 0
      const inQ = isEnt ? Number(b.qtyReceived || 0) : 0
      const outQ = isRej ? Number(b.qtyIssued || (b as any).rejectQuantity || 0) : !isEnt ? Number(b.qtyIssued || 0) : 0
      const price = Number(
        b.unitPrice != null && Number(b.unitPrice) > 0
          ? b.unitPrice
          : isEnt || isRej
          ? prod.unitCost
          : (prod.sellingPrice || (prod as any).selling_price || prod.unitCost || 0)
      )
      if (isEnt) {
        childNetVal += inQ * price
      } else {
        childNetVal -= outQ * price
      }
    }
    const nextVal = nextQty <= 0 ? 0 : Math.max(0, Math.round(childNetVal * 100) / 100)
    const weightedCost = nextQty > 0 ? Math.round((nextVal / nextQty) * 100) / 100 : Number(prod.unitCost || 0)

    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: nextQty }]
    const updatedBatches = [{ batchNo: prod.batch || "BATCH-WH1", qty: nextQty, expiry: "", status: "Released" as const }]

    const nextTotalReceived = updatedEntries.reduce((sum, e) => sum + Number(e.quantityReceived || 0), 0)

    await this.updateProductDetails(productId, {
      quantity: nextQty,
      totalQuantity: nextTotalReceived,
      unitCost: weightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || weightedCost),
      totalStockValue: nextVal,
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches,
      wh1Entries: updatedEntries,
      binCardEntries: recalculatedBinEntries,
    })

    deleteResource("export_warehouse_movements", entryId).catch(() => {})
  }

  public recalculateBinCardLedger(entries: BinCardMovementEntry[] = []) {
    const sorted = [...entries].sort((a, b) => {
      const timeA = new Date(a.date && a.date !== "—" ? a.date : 0).getTime()
      const timeB = new Date(b.date && b.date !== "—" ? b.date : 0).getTime()
      if (timeA !== timeB) return timeA - timeB
      const createA = new Date((a as any).createdAt || (a as any).created_at || 0).getTime()
      const createB = new Date((b as any).createdAt || (b as any).created_at || 0).getTime()
      if (createA && createB && createA !== createB) return createA - createB
      const aIsEntry = a.type === "entry" || Number(a.qtyReceived || 0) > 0
      const bIsEntry = b.type === "entry" || Number(b.qtyReceived || 0) > 0
      if (aIsEntry && !bIsEntry) return -1
      if (!aIsEntry && bIsEntry) return 1
      return 0
    })
    let currentBalance = 0
    let totalReceived = 0
    let totalIssued = 0
    let latestBatch = ""
    let latestExpiry = ""

    const recalculatedEntries = sorted.map((entry) => {
      totalReceived += Number(entry.qtyReceived || 0)
      totalIssued += Number(entry.qtyIssued || 0)
      currentBalance += Number(entry.qtyReceived || 0) - Number(entry.qtyIssued || 0)
      if (entry.batchNo) latestBatch = entry.batchNo
      if (entry.expiryDate) latestExpiry = entry.expiryDate
      return {
        ...entry,
        balance: Math.max(0, currentBalance),
      }
    })

    return {
      recalculatedEntries,
      totalQuantity: Math.max(0, currentBalance),
      totalReceived,
      totalIssued,
      latestBatch,
      latestExpiry,
    }
  }

  public reconcileBatches(recalculatedEntries: BinCardMovementEntry[], fallbackUnitCost: number = 0): {
    updatedBatches: BatchInfo[]
    totalStockValue: number
    weightedCost: number
    totalQuantity: number
  } {
    // Sort strictly chronologically
    const sorted = [...recalculatedEntries].sort((a, b) => {
      const timeA = new Date(a.date && a.date !== "—" ? a.date : 0).getTime()
      const timeB = new Date(b.date && b.date !== "—" ? b.date : 0).getTime()
      if (timeA !== timeB) return timeA - timeB
      const createA = new Date((a as any).createdAt || (a as any).created_at || 0).getTime()
      const createB = new Date((b as any).createdAt || (b as any).created_at || 0).getTime()
      if (createA && createB && createA !== createB) return createA - createB
      const aIsEntry = a.type === "entry" || Number(a.qtyReceived || 0) > 0
      const bIsEntry = b.type === "entry" || Number(b.qtyReceived || 0) > 0
      if (aIsEntry && !bIsEntry) return -1
      if (!aIsEntry && bIsEntry) return 1
      return 0
    })

    // 1. Build receipt lots
    const receiptLots: Array<{
      id?: string
      batchNo: string
      qtyReceived: number
      qtyRemaining: number
      unitPrice: number
      date?: string
      expiryDate?: string
      mfgDate?: string
    }> = []

    for (const e of sorted) {
      const inQty = Number(e.qtyReceived || 0)
      if (inQty > 0 && e.type !== "quarantine" && e.type !== "reject") {
        const price = e.unitPrice !== undefined && Number(e.unitPrice) > 0 ? Number(e.unitPrice) : fallbackUnitCost
        receiptLots.push({
          id: (e as any).batchId || e.id,
          batchNo: (e.batchNo || "DEFAULT").trim(),
          qtyReceived: inQty,
          qtyRemaining: inQty,
          unitPrice: price,
          date: e.date,
          expiryDate: e.expiryDate,
          mfgDate: (e as any).mfgDate,
        })
      }
    }

    // 2. Deduct issues, leaves, and quarantines (target internal ID first, target batch second, then FIFO)
    for (const e of sorted) {
      const outQty = Number(e.qtyIssued || 0)
      if (outQty > 0 || e.type === "quarantine" || e.type === "reject" || e.type === "leave") {
        let rem = outQty
        if (rem <= 0) continue

        const targetId = ((e as any).batchId || e.id || "").trim()
        const targetBatch = (e.batchNo || "").trim().toUpperCase()

        // 1. Target matching internal ID first
        if (targetId) {
          for (const lot of receiptLots) {
            if (rem <= 0) break
            if (lot.id && (lot.id === targetId || lot.id.includes(targetId)) && lot.qtyRemaining > 0) {
              const deduct = Math.min(lot.qtyRemaining, rem)
              lot.qtyRemaining -= deduct
              rem -= deduct
            }
          }
        }

        // 2. Target matching batch number second
        if (rem > 0 && targetBatch && targetBatch !== "DEFAULT" && targetBatch !== "N/A") {
          for (const lot of receiptLots) {
            if (rem <= 0) break
            if (lot.batchNo.toUpperCase() === targetBatch && lot.qtyRemaining > 0) {
              const deduct = Math.min(lot.qtyRemaining, rem)
              lot.qtyRemaining -= deduct
              rem -= deduct
            }
          }
        }

        // 3. FIFO fallback across any remaining lot
        if (rem > 0) {
          for (const lot of receiptLots) {
            if (rem <= 0) break
            if (lot.qtyRemaining > 0) {
              const deduct = Math.min(lot.qtyRemaining, rem)
              lot.qtyRemaining -= deduct
              rem -= deduct
            }
          }
        }
      }
    }

    let totalStockValue = 0
    let totalQuantity = 0

    for (const lot of receiptLots) {
      if (lot.qtyRemaining > 0) {
        totalQuantity += lot.qtyRemaining
      }
    }

    const lotStockVal = receiptLots.reduce(
      (sum, lot) => sum + (Math.max(0, lot.qtyRemaining) * Number(lot.unitPrice || fallbackUnitCost || 0)),
      0
    )
    totalStockValue = totalQuantity <= 0 ? 0 : Math.max(0, Math.round(lotStockVal * 100) / 100)
    const weightedCost = totalQuantity > 0 ? Math.round((totalStockValue / totalQuantity) * 100) / 100 : fallbackUnitCost

    // Build reconciled batches preserving exact lot IDs and individual pricing
    const updatedBatches: BatchInfo[] = []
    for (const lot of receiptLots) {
      if (lot.qtyRemaining > 0) {
        updatedBatches.push({
          id: lot.id,
          batchNo: lot.batchNo,
          qty: lot.qtyRemaining,
          expiry: lot.expiryDate || "",
          mfgDate: lot.mfgDate,
          unitPrice: lot.unitPrice,
          status: "Released",
        })
      }
    }

    return {
      updatedBatches,
      totalStockValue,
      weightedCost,
      totalQuantity,
    }
  }

  public async addBinCardEntry(productId: string, entry: Omit<BinCardMovementEntry, "id" | "balance">) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    const newEntry: BinCardMovementEntry = {
      ...entry,
      id: `BCE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      balance: 0,
      createdAt: new Date().toISOString(),
    }

    let currentEntries = prod.binCardEntries || []
    if (currentEntries.length === 0 && (Number(prod.quantity || 0) > 0 || (prod.batches && prod.batches.length > 0))) {
      if (Array.isArray(prod.batches) && prod.batches.length > 0) {
        currentEntries = prod.batches.map((b, idx) => ({
          id: `BCE-base-${prod.id}-${idx}`,
          type: "entry" as const,
          date: b.mfgDate || prod.manufacturingDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          batchNo: b.batchNo || prod.batch || "BATCH-001",
          qtyReceived: Number(b.qty || prod.quantity || 0),
          qtyIssued: 0,
          balance: Number(b.qty || prod.quantity || 0),
          mfgDate: b.mfgDate || prod.manufacturingDate,
          expiryDate: b.expiry || prod.expiry,
          party: prod.supplierName || prod.customer || "Initial Stock Deposit",
          unitPrice: Number(b.unitPrice || prod.unitCost || 0),
          remark: "Initial Stock Deposit",
          createdAt: prod.createdAt || new Date().toISOString(),
        }))
      } else {
        currentEntries = [{
          id: `BCE-base-${prod.id}`,
          type: "entry" as const,
          date: prod.manufacturingDate || prod.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          batchNo: prod.batch || "BATCH-001",
          qtyReceived: Number(prod.quantity || 0),
          qtyIssued: 0,
          balance: Number(prod.quantity || 0),
          mfgDate: prod.manufacturingDate,
          expiryDate: prod.expiry,
          party: prod.supplierName || prod.customer || "Initial Stock Deposit",
          unitPrice: Number(prod.unitCost || 0),
          remark: "Initial Stock Deposit",
          createdAt: prod.createdAt || new Date().toISOString(),
        }]
      }
    }

    const updatedEntries = [...currentEntries, newEntry]

    const { recalculatedEntries, totalQuantity, latestBatch, latestExpiry } = this.recalculateBinCardLedger(updatedEntries)
    const unitPrice = entry.unitPrice !== undefined ? Number(entry.unitPrice) : Number(prod.unitCost || 0)
    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: totalQuantity }]

    const { updatedBatches, totalStockValue: nextVal, weightedCost } = this.reconcileBatches(recalculatedEntries, Number(prod.unitCost || 0))

    const packSize = Number(prod.quantityPerPack || 1)
    const nextCartons = packSize > 0 ? Math.floor(totalQuantity / packSize) : (prod.numberOfCartons || 0)

    const isExport = isExportWarehouse(prod.warehouse, this.warehouses)

    // Sync to relational tables
    if (!isExport) {
      if (entry.batchNo && Number(entry.qtyReceived || 0) > 0) {
        createResource<any>("pharma_product_batches", {
          id: `BAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: productId,
          warehouse_id: prod.warehouse || "WH2",
          batch_no: entry.batchNo,
          mfg_date: (entry as any).mfgDate || null,
          expiry_date: entry.expiryDate || null,
          quantity: Number(entry.qtyReceived || 0),
          unit_cost: unitPrice,
          qa_status: entry.type === "quarantine" ? "Quarantined" : "Released",
          notes: entry.remark || null,
        }).catch((err) => console.warn("Batch upsert error:", err))
      }

      const movementLog: StockMovementLog = {
        id: newEntry.id,
        productId,
        productName: prod.name,
        sku: prod.sku,
        type: entry.type === "quarantine" ? "QUARANTINE" : Number(entry.qtyReceived || 0) > 0 ? "RECEIPT" : "ISSUE",
        fromWarehouse: entry.type === "leave" || entry.type === "quarantine" ? prod.warehouse : undefined,
        toWarehouse: Number(entry.qtyReceived || 0) > 0 ? prod.warehouse : undefined,
        qty: Number(entry.qtyReceived || entry.qtyIssued || 0),
        unit: prod.unit || "Unit",
        reference: entry.voucherNo || newEntry.id,
        remarks: entry.remark || (Number(entry.qtyReceived || 0) > 0 ? "Bin card receipt" : "Bin card issue"),
        date: entry.date || new Date().toISOString().slice(0, 10),
      }
      createResource<any>("stock_movements", {
        id: newEntry.id,
        product_id: productId,
        warehouse_id: prod.warehouse || "WH2",
        movement_type: movementLog.type,
        quantity: movementLog.qty,
        unit_cost: entry.type === "entry" ? unitPrice : Number(prod.unitCost || 0),
        unit_price: unitPrice,
        balance_after: totalQuantity,
        batch_no: entry.batchNo || "BATCH-001",
        expiry_date: entry.expiryDate || null,
        reference_type: Number(entry.qtyReceived || 0) > 0 ? "STOCK_RECEIPT" : entry.type === "quarantine" ? "QUARANTINE" : "STOCK_ISSUE",
        reference_id: entry.voucherNo || newEntry.id,
        notes: entry.remark || entry.party || "Bin card transaction",
        performed_by: useAuthStore.getState().user?.fullname || "Warehouse Officer",
        movement_date: entry.date || new Date().toISOString().slice(0, 10),
      }).catch((err) => console.warn("Stock movement write error:", err))
      this.stockMovements = [movementLog, ...this.stockMovements]
    } else {
      createResource<any>("export_warehouse_movements", {
        id: newEntry.id,
        warehouse_id: prod.warehouse || "WH1",
        product_id: productId,
        movement_type: entry.type === "reject" ? "REJECT_DEDUCTION" : entry.type === "entry" ? "GRV_ENTRY" : "OUTBOUND_DISPATCH",
        voucher_no: entry.voucherNo || null,
        batch_no: entry.batchNo || "COMMODITY-WH1",
        party_name: entry.party || (entry.type === "entry" ? "Supplier Arrival" : "Customer Dispatch"),
        plate_number: entry.plateNumber || null,
        gross_quantity: Number(entry.qtyReceived || entry.qtyIssued || 0),
        reject_quantity: entry.type === "reject" ? Number(entry.qtyIssued || 0) : 0,
        net_quantity: entry.type === "entry" ? Number(entry.qtyReceived || 0) : -Number(entry.qtyIssued || 0),
        uom: prod.unit || "Quintal",
        unit_price: unitPrice,
        movement_date: entry.date || new Date().toISOString().slice(0, 10),
        reason: entry.remark || null,
        created_by: useAuthStore.getState().user?.fullname || "Warehouse Officer",
      }).catch((err) => console.warn("Export movement write error:", err))
    }

    return await this.updateProductDetails(productId, {
      quantity: totalQuantity,
      totalQuantity: totalQuantity + (prod.quantitySold || 0),
      numberOfCartons: nextCartons,
      totalStockValue: nextVal,
      unitCost: weightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || weightedCost),
      batch: latestBatch || prod.batch,
      expiry: latestExpiry || prod.expiry,
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches.length ? updatedBatches : prod.batches,
      binCardEntries: recalculatedEntries,
    })
  }

  public async updateBinCardEntry(productId: string, entryId: string, patch: Partial<BinCardMovementEntry>) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    const isExport = isExportWarehouse(prod.warehouse, this.warehouses)
    const currentEntries = prod.binCardEntries || []
    const rawUpdated = currentEntries.map((e) => {
      if (e.id !== entryId) return e
      return { ...e, ...patch }
    })

    const { recalculatedEntries, totalQuantity, latestBatch, latestExpiry } = this.recalculateBinCardLedger(rawUpdated)
    const { updatedBatches, totalStockValue: nextVal, weightedCost } = this.reconcileBatches(recalculatedEntries, Number(prod.unitCost || 0))

    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: totalQuantity }]
    const packSize = Number(prod.quantityPerPack || 1)
    const nextCartons = packSize > 0 ? Math.floor(totalQuantity / packSize) : (prod.numberOfCartons || 0)

    // For export products, synchronize wh1Entries as well
    let updatedWh1Entries = prod.wh1Entries || []
    if (isExport && updatedWh1Entries.length > 0) {
      updatedWh1Entries = updatedWh1Entries.map((w) => {
        if (w.entryId === entryId || (w as any).id === entryId || (patch.voucherNo && w.voucherNo === patch.voucherNo)) {
          const oldReceived = Number(w.quantityReceived || 0)
          const oldRemaining = Number(w.quantityRemaining ?? oldReceived)
          const diff = oldReceived - oldRemaining
          const newReceived = patch.qtyReceived !== undefined ? Number(patch.qtyReceived) : oldReceived
          return {
            ...w,
            quantityReceived: newReceived,
            quantityRemaining: Math.max(0, newReceived - diff),
            unitPrice: patch.unitPrice !== undefined ? Number(patch.unitPrice) : w.unitPrice,
            voucherNo: patch.voucherNo || w.voucherNo,
            plateNumber: patch.plateNumber || w.plateNumber,
            customer: patch.party || w.customer,
            notes: patch.remark || w.notes,
            entryDate: patch.date || w.entryDate,
          }
        }
        return w
      })
    }

    // Sync to relational tables
    if (!isExport) {
      updateResource<any>("stock_movements", entryId, {
        quantity: patch.qtyReceived !== undefined ? Number(patch.qtyReceived) : patch.qtyIssued !== undefined ? Number(patch.qtyIssued) : undefined,
        unit_cost: patch.unitPrice !== undefined ? Number(patch.unitPrice) : undefined,
        unit_price: patch.unitPrice !== undefined ? Number(patch.unitPrice) : undefined,
        batch_no: patch.batchNo,
        expiry_date: patch.expiryDate,
        notes: patch.remark,
      }).catch((err) => console.warn("Stock movement update error:", err))

      // Also synchronize batch record in pharma_product_batches if batch_no is present
      const targetBatchNo = patch.batchNo || currentEntries.find((e) => e.id === entryId)?.batchNo
      if (targetBatchNo) {
        const matchingBatch = (prod.batches || []).find((b) => b.batchNo === targetBatchNo)
        if (matchingBatch?.id) {
          updateResource<any>("pharma_product_batches", matchingBatch.id, {
            unit_cost: patch.unitPrice !== undefined ? Number(patch.unitPrice) : undefined,
            expiry_date: patch.expiryDate,
          }).catch((err) => console.warn("Batch update error:", err))
        }
      }
    } else {
      updateResource<any>("export_warehouse_movements", entryId, {
        gross_quantity: patch.qtyReceived !== undefined ? Number(patch.qtyReceived) : patch.qtyIssued !== undefined ? Number(patch.qtyIssued) : undefined,
        net_quantity: patch.qtyReceived !== undefined ? Number(patch.qtyReceived) : patch.qtyIssued !== undefined ? -Number(patch.qtyIssued) : undefined,
        unit_price: patch.unitPrice !== undefined ? Number(patch.unitPrice) : undefined,
        voucher_no: patch.voucherNo,
        plate_number: patch.plateNumber,
        party_name: patch.party,
        movement_date: patch.date,
        reason: patch.remark,
      }).catch((err) => console.warn("Export movement update error:", err))
    }

    const calculatedVal = isExport
      ? updatedWh1Entries.reduce((sum, e) => sum + (Number(e.quantityRemaining || 0) * Number(e.unitPrice || 0)), 0)
      : nextVal
    const calculatedWeightedCost = isExport
      ? (totalQuantity > 0 ? Math.round((calculatedVal / totalQuantity) * 100) / 100 : Number(prod.unitCost || 0))
      : weightedCost

    return await this.updateProductDetails(productId, {
      quantity: totalQuantity,
      totalQuantity: totalQuantity + (prod.quantitySold || 0),
      numberOfCartons: nextCartons,
      totalStockValue: calculatedVal,
      unitCost: calculatedWeightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || calculatedWeightedCost),
      batch: latestBatch || prod.batch,
      expiry: latestExpiry || prod.expiry,
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches.length ? updatedBatches : prod.batches,
      wh1Entries: isExport ? updatedWh1Entries : prod.wh1Entries,
      binCardEntries: recalculatedEntries,
    })
  }

  public async deleteBinCardEntry(productId: string, entryId: string) {
    const prod = this.products.find((p) => p.id === productId)
    if (!prod) throw new Error("Product not found")

    const currentEntries = prod.binCardEntries || []
    const rawUpdated = currentEntries.filter((e) => e.id !== entryId)

    const { recalculatedEntries, totalQuantity, latestBatch, latestExpiry } = this.recalculateBinCardLedger(rawUpdated)
    const { updatedBatches, totalStockValue: nextVal, weightedCost } = this.reconcileBatches(recalculatedEntries, Number(prod.unitCost || 0))

    const updatedBreakdown = [{ warehouse: prod.warehouse, qty: totalQuantity }]
    const packSize = Number(prod.quantityPerPack || 1)
    const nextCartons = packSize > 0 ? Math.floor(totalQuantity / packSize) : (prod.numberOfCartons || 0)

    const isExport = isExportWarehouse(prod.warehouse, this.warehouses)
    if (!isExport) {
      deleteResource("stock_movements", entryId).catch(() => {})
      this.stockMovements = this.stockMovements.filter((m) => m.id !== entryId && m.reference !== entryId)
    } else {
      deleteResource("export_warehouse_movements", entryId).catch(() => {})
    }

    return await this.updateProductDetails(productId, {
      quantity: totalQuantity,
      totalQuantity: totalQuantity + (prod.quantitySold || 0),
      numberOfCartons: nextCartons,
      totalStockValue: nextVal,
      unitCost: weightedCost,
      sellingPrice: Number(prod.sellingPrice || (prod as any).selling_price || (prod as any).price || weightedCost),
      batch: latestBatch || prod.batch,
      expiry: latestExpiry || prod.expiry,
      stockBreakdown: updatedBreakdown,
      batches: updatedBatches,
      binCardEntries: recalculatedEntries,
    })
  }

  // Actions - Quotations
  public addQuotation(quotation: Quotation) {
    this.quotations.unshift(quotation)
    this.notify()
  }

  public updateQuotationStatus(id: string, status: Quotation["status"]) {
    this.quotations = this.quotations.map((q) => (q.id === id ? { ...q, status } : q))
    this.notify()
  }

  public convertQuotationToSalesOrder(quotationId: string): SalesOrder | null {
    const q = this.quotations.find((item) => item.id === quotationId)
    if (!q) return null

    q.status = "Ordered"

    const newSo: SalesOrder = {
      id: `SO-${Date.now().toString().slice(-4)}`,
      quotationId: q.id,
      customer: q.customer,
      customerId: q.customerId,
      customerGroup: q.customerGroup,
      warehouse: q.warehouse,
      warehouseName: q.warehouseName,
      date: new Date().toISOString().split("T")[0],
      amount: q.amount,
      currency: q.currency,
      stage: "Confirmed",
      desc: `Converted from Quotation ${q.id}: ${q.desc}`,
      initials: q.customer.slice(0, 2).toUpperCase(),
      label: q.customer,
      avatarBg: "bg-emerald-100 text-emerald-800",
      urgent: false,
      attachment: true,
      items: q.items,
      deliveredAmount: 0,
      billedAmount: 0,
      deliveryStatus: "Not Delivered",
      billingStatus: "Not Billed",
      paymentTerms: q.paymentTerms || "Net 30",
      salesPerson: q.salesPerson
    }

    this.salesOrders.unshift(newSo)
    this.notify()
    return newSo
  }

  // Actions - Sales Orders
  public async addSalesOrder(so: SalesOrder): Promise<SalesOrder> {
    const enrichedSo: SalesOrder = {
      ...so,
      approvalStatus: so.approvalStatus || "Pending",
      deliveredAmount: so.deliveredAmount || (so.stage === "Shipped" || so.stage === "Delivered" ? so.amount : 0),
      billedAmount: so.billedAmount || so.amount,
      deliveryStatus: so.deliveryStatus || (so.stage === "Shipped" || so.stage === "Delivered" ? "Fully Delivered" : "Not Delivered"),
      billingStatus: "Fully Billed",
    }
    this.salesOrders.unshift(enrichedSo)

    // Persist directly to Database
    try {
      await createResource<SalesOrder>("sales_orders", enrichedSo)
      // Also log creation in user activity logs
      await createResource("user_activity_logs", {
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: null,
        username: so.salesPerson || "Sales Officer",
        fullname: so.salesPerson || "Sales Officer",
        action: "Create",
        resource: "sales_orders",
        details: { orderId: enrichedSo.id, customer: enrichedSo.customer, amount: enrichedSo.amount, status: "Pending" },
        created_at: new Date().toISOString(),
      }).catch(() => {})
    } catch (err) {
      console.error("Failed to persist new Sales Order to DB:", err)
    }

    this.notify()
    return enrichedSo
  }

  public async approveSalesOrder(soId: string, approverName: string = "Super Admin"): Promise<SalesOrder | null> {
    const existing = this.salesOrders.find((so) => so.id === soId)
    if (!existing) return null

    const updated: SalesOrder = {
      ...existing,
      approvalStatus: "Approved",
      approvedBy: approverName,
      approvedAt: new Date().toISOString(),
      declineReason: undefined,
    }

    this.salesOrders = this.salesOrders.map((so) => (so.id === soId ? updated : so))
    this.notify()

    try {
      await updateResource<SalesOrder>("sales_orders", soId, updated)
      // Log to user_activity_logs
      await createResource("user_activity_logs", {
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: null,
        username: approverName,
        fullname: approverName,
        action: "Approve",
        resource: "sales_orders",
        details: { orderId: soId, customer: existing.customer, amount: existing.amount },
        created_at: new Date().toISOString(),
      }).catch(() => {})
    } catch (err) {
      console.error("Failed to persist approved Sales Order to DB:", err)
    }

    return updated
  }

  public async declineSalesOrder(soId: string, declinerName: string = "Super Admin", reason?: string): Promise<SalesOrder | null> {
    const existing = this.salesOrders.find((so) => so.id === soId)
    if (!existing) return null

    const updated: SalesOrder = {
      ...existing,
      approvalStatus: "Declined",
      approvedBy: declinerName,
      approvedAt: new Date().toISOString(),
      declineReason: reason || "Declined by Super Admin",
    }

    this.salesOrders = this.salesOrders.map((so) => (so.id === soId ? updated : so))
    this.notify()

    try {
      await updateResource<SalesOrder>("sales_orders", soId, updated)
      // Log to user_activity_logs
      await createResource("user_activity_logs", {
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: null,
        username: declinerName,
        fullname: declinerName,
        action: "Decline",
        resource: "sales_orders",
        details: { orderId: soId, customer: existing.customer, reason: updated.declineReason },
        created_at: new Date().toISOString(),
      }).catch(() => {})
    } catch (err) {
      console.error("Failed to persist declined Sales Order to DB:", err)
    }

    return updated
  }

  public updateSalesOrder(updatedSo: SalesOrder) {
    this.salesOrders = this.salesOrders.map((so) => (so.id === updatedSo.id ? updatedSo : so))
    financeStore.updateInvoiceFromSalesOrder(updatedSo)
    void updateResource("sales_orders", updatedSo.id, updatedSo).catch((err) =>
      console.error("Failed to persist updated Sales Order:", err)
    )
    this.notify()
  }

  public updateSalesOrderStage(id: string, stage: SalesOrder["stage"], progress?: number) {
    this.salesOrders = this.salesOrders.map((so) => {
      if (so.id !== id) return so
      const isDelivered = stage === "Shipped" || stage === "Delivered"
      return {
        ...so,
        stage,
        progress: progress !== undefined ? progress : so.progress,
        deliveryStatus: isDelivered ? "Fully Delivered" : so.deliveryStatus || "Not Delivered",
        deliveredAmount: isDelivered ? so.amount : so.deliveredAmount || 0,
      }
    })
    this.notify()
  }

  // Dispatch / Fulfillment: Creates Delivery Note, reduces Product Inventory, and posts COGS GL Journal Entry
  public createDeliveryNoteForSalesOrder(
    soId: string,
    itemsToFulfill: Array<{ productId: string; qty: number }>,
    driverName?: string,
    vehicleReg?: string
  ): { success: boolean; error?: string; deliveryNote?: DeliveryNote } {
    const so = this.salesOrders.find((s) => s.id === soId)
    if (!so) return { success: false, error: "Sales Order not found." }

    let totalValue = 0
    let totalCogs = 0
    const dnItems: DeliveryNoteItem[] = []

    for (const item of itemsToFulfill) {
      const prod = this.products.find((p) => p.id === item.productId)
      const soLine = so.items.find((i) => i.productId === item.productId)
      const unitPrice = soLine ? soLine.unitPrice : prod ? prod.sellingPrice : 0
      const unitCost = prod ? prod.unitCost : unitPrice * 0.75

      const lineVal = item.qty * unitPrice
      const lineCogs = item.qty * unitCost

      totalValue += lineVal
      totalCogs += lineCogs

      dnItems.push({
        productId: item.productId,
        name: soLine ? soLine.name : prod ? prod.name : "Item",
        qty: item.qty,
        unit: soLine ? soLine.unit : prod ? prod.unit : "units",
        unitCost,
        unitPrice,
        totalValue: lineVal,
      })

      // Deduct Physical Stock from Inventory
      if (prod) {
        const newQty = Math.max(0, prod.quantity - item.qty)
        const updatedBreakdown = (prod.stockBreakdown || []).map((sb) =>
          sb.warehouse === so.warehouse ? { ...sb, qty: Math.max(0, sb.qty - item.qty) } : sb
        )
        const updatedBatches = (prod.batches || []).map((b) => ({
          ...b,
          qty: Math.max(0, b.qty - item.qty),
        }))
        const packSize = Number(prod.quantityPerPack || 1)
        const newCartons = packSize > 0 ? Math.max(0, Math.floor(newQty / packSize)) : Math.max(0, (prod.numberOfCartons || 0) - item.qty)
        const updatedStatus = newQty === 0 ? "Out of Stock" : newQty < 20 ? "Low Stock" : "In Stock"

        this.updateProduct(prod.id, {
          quantity: newQty,
          quantitySold: (prod.quantitySold || 0) + item.qty,
          numberOfCartons: newCartons,
          stockBreakdown: updatedBreakdown,
          batches: updatedBatches,
          status: updatedStatus,
        })
      }
    }

    const dnId = `DN-${Date.now().toString().slice(-4)}`

    // Post Double-Entry Journal Entry in Finance (Debit COGS ACC-5000, Credit Stock ACC-1010)
    let jeId: string | undefined = undefined
    try {
      // Resolve accounts dynamically from GL mappings
      const cogsAcc = financeStore.getMappedAccount("cogs_stock_fulfillment", "6000-04")
      const stockAcc = financeStore.getMappedAccount("inventory_stock_in_hand", "1410-01")

      if (cogsAcc && stockAcc && totalCogs > 0) {
        const postRes = financeStore.postJournalEntry(
          {
            entry_date: new Date().toISOString().split("T")[0],
            description: `Stock Fulfillment & COGS Recognition for Delivery Note ${dnId} (SO: ${so.id}, Client: ${so.customer})`,
            source_type: "Warehouse Transfer",
            source_id: dnId,
            created_by: "Sales & Inventory Dispatch System",
            currency: so.currency || "ETB",
            exchange_rate: 1.0,
          },
          [
            {
              account_id: cogsAcc.id,
              debit_amount: totalCogs,
              credit_amount: 0,
              warehouse_id: so.warehouse,
              party_type: "Customer",
              party_id: so.customerId,
              party_name: so.customer,
            },
            {
              account_id: stockAcc.id,
              debit_amount: 0,
              credit_amount: totalCogs,
              warehouse_id: so.warehouse,
            },
          ]
        )
        if (postRes.success && postRes.entry) {
          jeId = postRes.entry.id
        }
      }
    } catch {
      // GL posting failure must not block the delivery note from being created
    }

    const newDn: DeliveryNote = {
      id: dnId,
      salesOrderId: so.id,
      customer: so.customer,
      customerId: so.customerId,
      warehouse: so.warehouse,
      warehouseName: so.warehouseName,
      postingDate: new Date().toISOString().split("T")[0],
      driverName: driverName || "HKC Dispatch Logistics",
      vehicleReg: vehicleReg || "ET-LOG-01",
      status: "Submitted",
      items: dnItems,
      totalValue,
      cogsTotal: totalCogs,
      journalEntryId: jeId,
    }

    this.deliveryNotes.unshift(newDn)

    // Update Sales Order delivery state
    const currentDelivered = (so.deliveredAmount || 0) + totalValue
    const isFullyDelivered = currentDelivered >= so.amount
    const delStatus = isFullyDelivered ? "Fully Delivered" : "Partially Delivered"

    this.salesOrders = this.salesOrders.map((s) => {
      if (s.id !== soId) return s
      const dnList = s.deliveryNoteIds || []
      return {
        ...s,
        deliveredAmount: currentDelivered,
        deliveryStatus: delStatus,
        stage: isFullyDelivered ? "Shipped" : s.stage,
        deliveryNoteIds: [...dnList, dnId],
      }
    })

    this.notify()
    return { success: true, deliveryNote: newDn }
  }

  // Create Sales Invoice in Finance Store from Sales Order
  public createSalesInvoiceForSalesOrder(
    soId: string,
    taxOption?: number | string,
    paymentTerms = "Net 30"
  ): { success: boolean; error?: string; invoiceId?: string } {
    const so = this.salesOrders.find((s) => s.id === soId)
    if (!so) return { success: false, error: "Sales Order not found." }

    if (so.billingStatus === "Fully Billed" || (so.invoiceIds && so.invoiceIds.length > 0)) {
      return { success: false, error: "An invoice has already been generated for this Sales Order." }
    }

    const subtotal = so.amount
    let appliedTaxPercent = 15
    let taxAmount = 0
    let total = subtotal

    const allRules = financeStore.getTaxRules()
    if (typeof taxOption === "string" && taxOption.startsWith("SCH-")) {
      const calc = calculateMultiTax(subtotal, allRules, taxOption)
      taxAmount = calc.totalTaxAdded
      total = calc.netTotal
      appliedTaxPercent = calc.totalTaxAdded > 0 && subtotal > 0 ? Math.round((calc.totalTaxAdded / subtotal) * 100) : 0
    } else if (typeof taxOption === "number") {
      appliedTaxPercent = taxOption
      taxAmount = Math.round((subtotal * (appliedTaxPercent / 100)) * 100) / 100
      total = subtotal + taxAmount
    } else {
      appliedTaxPercent = financeStore.getDefaultVatRate()
      taxAmount = Math.round((subtotal * (appliedTaxPercent / 100)) * 100) / 100
      total = subtotal + taxAmount
    }

    const lineItems = so.items.map((i) => ({
      description: `${i.name} (${i.qty} ${i.unit})`,
      quantity: i.qty,
      unit_price: i.unitPrice,
      line_total: i.total,
    }))

    const issueDate = new Date().toISOString().split("T")[0]
    const dueDateObj = new Date()
    dueDateObj.setDate(dueDateObj.getDate() + 30)
    const dueDate = dueDateObj.toISOString().split("T")[0]
    const invNum = `INV-${Date.now().toString().slice(-5)}`

    const newInv = financeStore.createInvoice({
      invoice_number: invNum,
      sales_order_id: so.id,
      customer_name: so.customer,
      issue_date: issueDate,
      due_date: dueDate,
      currency: so.currency || "ETB",
      line_items: lineItems,
      subtotal,
      tax_amount: taxAmount,
      tax_rate: appliedTaxPercent,
      discount_amount: 0,
      payment_terms: paymentTerms,
      total,
      status: "Sent",
    })

    const invId = newInv.id

    // Update Sales Order billing status
    const currentBilled = (so.billedAmount || 0) + total
    const isFullyBilled = currentBilled >= total
    const billStatus = isFullyBilled ? "Fully Billed" : "Partially Billed"

    this.salesOrders = this.salesOrders.map((s) => {
      if (s.id !== soId) return s
      const invList = s.invoiceIds || []
      return {
        ...s,
        billedAmount: currentBilled,
        billingStatus: billStatus,
        invoiceIds: [...invList, invId],
      }
    })

    this.notify()
    return { success: true, invoiceId: invId }
  }

  public deleteSalesOrder(id: string) {
    this.salesOrders = this.salesOrders.filter((so) => so.id !== id)
    deleteResource("sales_orders", id).catch((err) => console.error("Failed to delete Sales Order:", err))
    this.notify()
  }

  // Customer Credit Limit Analysis
  public getCustomerCreditUsage(customerId: string): { limit: number; used: number; available: number; isOverLimit: boolean } {
    const cust = this.customers.find((c) => c.id === customerId)
    const limit = (cust?.creditLimit !== undefined && cust?.creditLimit !== null) ? cust.creditLimit : 500000

    // Sum open Sales Orders amount + outstanding AR invoices in financeStore
    const openOrdersAmount = this.salesOrders
      .filter((so) => so.customerId === customerId && so.stage !== "Delivered" && so.stage !== "Cancelled")
      .reduce((sum, so) => sum + so.amount, 0)

    const invoices = financeStore.getInvoices().filter((inv) => inv.customer_name === (cust?.name || ""))
    const outstandingInvoicesAmount = invoices.reduce((sum, inv) => sum + inv.balance_due, 0)

    const used = openOrdersAmount + outstandingInvoicesAmount
    const available = Math.max(0, limit - used)

    return {
      limit,
      used,
      available,
      isOverLimit: used > limit,
    }
  }

  // --- Actions: Customers ---
  public addCustomer(customer: Customer) {
    const existing = this.customers.find((c) => c.id === customer.id || (c.name && c.name.toLowerCase() === customer.name.toLowerCase()))
    if (existing) {
      this.updateCustomer(existing.id, customer)
      return existing
    }
    this.customers.unshift(customer)
    createResource("customers", customer).catch((err) => console.error("Failed to persist new Customer:", err))
    this.notify()
    return customer
  }

  public updateCustomer(id: string, updates: Partial<Customer>) {
    this.customers = this.customers.map((c) => (c.id === id ? { ...c, ...updates } : c))
    updateResource("customers", id, updates).catch((err) => console.error("Failed to update Customer:", err))
    this.notify()
  }

  public deleteCustomer(id: string) {
    this.customers = this.customers.filter((c) => c.id !== id)
    deleteResource("customers", id).catch((err) => console.error("Failed to delete Customer:", err))
    this.notify()
  }

  // --- Actions: Suppliers ---
  public addSupplier(supplier: Supplier) {
    const existing = this.suppliers.find((s) => s.id === supplier.id || (s.name && s.name.toLowerCase() === supplier.name.toLowerCase()))
    if (existing) {
      this.updateSupplier(existing.id, supplier)
      return existing
    }
    this.suppliers.unshift(supplier)
    createResource("suppliers", supplier).catch((err) => console.error("Failed to persist new Supplier:", err))
    this.notify()
    return supplier
  }

  public updateSupplier(id: string, updates: Partial<Supplier>) {
    this.suppliers = this.suppliers.map((s) => (s.id === id ? { ...s, ...updates } : s))
    updateResource("suppliers", id, updates).catch((err) => console.error("Failed to update Supplier:", err))
    this.notify()
  }

  public deleteSupplier(id: string) {
    this.suppliers = this.suppliers.filter((s) => s.id !== id)
    deleteResource("suppliers", id).catch((err) => console.error("Failed to delete Supplier:", err))
    this.notify()
  }

  // Actions - Purchase Orders
  public addPurchaseOrder(po: PurchaseOrder) {
    const isCredit = (po.paymentType || po.payment_type) === "Credit"
    const totalAmt = Number(po.amount || 0)
    const paidAmt = isCredit ? Number(po.amountPaid || po.amount_paid || 0) : totalAmt
    const dueAmt = isCredit ? (typeof po.balanceDue === "number" ? po.balanceDue : Math.max(0, totalAmt - paidAmt)) : 0
    const settlement = isCredit ? (dueAmt <= 0.01 ? "Fully Settled" : (paidAmt > 0 ? "Ongoing" : "Unpaid")) : "Fully Settled"

    const enriched: PurchaseOrder = {
      ...po,
      amountPaid: paidAmt,
      amount_paid: paidAmt,
      balanceDue: dueAmt,
      balance_due: dueAmt,
      settlementStatus: settlement,
      settlement_status: settlement,
    }

    this.purchaseOrders.unshift(enriched)
    if (enriched.status === "PAID" || enriched.status === "COMPLETED") {
      this.syncPurchaseVoucherToFinance(enriched)
    }
    if (isCredit) {
      financeStore.syncPurchaseInvoice(enriched)
    }
    this.notify()
  }

  public updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>) {
    this.purchaseOrders = this.purchaseOrders.map((p) => {
      if (p.id !== id) return p
      const merged = { ...p, ...updates }
      const isCredit = (merged.paymentType || merged.payment_type) === "Credit"
      if (isCredit) {
        const totalAmt = Number(merged.amount || 0)
        const paidAmt = Number(merged.amountPaid ?? merged.amount_paid ?? 0)
        const dueAmt = typeof merged.balanceDue === "number" ? merged.balanceDue : Math.max(0, totalAmt - paidAmt)
        merged.amountPaid = paidAmt
        merged.amount_paid = paidAmt
        merged.balanceDue = dueAmt
        merged.balance_due = dueAmt
        merged.settlementStatus = dueAmt <= 0.01 ? "Fully Settled" : (paidAmt > 0 ? "Ongoing" : "Unpaid")
        merged.settlement_status = merged.settlementStatus
        financeStore.syncPurchaseInvoice(merged)
      }
      if (merged.status === "PAID" || merged.status === "COMPLETED") {
        this.syncPurchaseVoucherToFinance(merged)
      } else if (!isCredit) {
        // Clean up GL journal entry if moved back to draft or cancelled
        financeStore.deleteJournalEntriesBySource("Payment Voucher", merged.id)
        merged.journalEntryId = undefined
      }
      return merged
    })
    this.notify()
  }

  public recordPurchaseOrderInstallment(poId: string, installment: {
    amount: number
    date: string
    bankAccountCode?: string
    reference: string
    paymentAdviceUrl?: string
    paymentAdviceFilename?: string
    notes?: string
  }) {
    const target = this.purchaseOrders.find((p) => p.id === poId)
    if (!target) return

    const totalAmt = Number(target.amount || 0)
    const prevPaid = Number(target.amountPaid ?? target.amount_paid ?? 0)
    const newPaid = Number((prevPaid + installment.amount).toFixed(2))
    const newDue = Number(Math.max(0, totalAmt - newPaid).toFixed(2))
    const settlement = newDue <= 0.01 ? "Fully Settled" : "Ongoing"

    const newInstallmentEntry = {
      id: `INST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...installment,
    }

    const updatedInstallments = [...(target.installmentPayments || []), newInstallmentEntry]

    this.updatePurchaseOrder(poId, {
      amountPaid: newPaid,
      amount_paid: newPaid,
      balanceDue: newDue,
      balance_due: newDue,
      settlementStatus: settlement,
      settlement_status: settlement,
      status: settlement === "Fully Settled" ? "PAID" : target.status,
      installmentPayments: updatedInstallments,
    })
  }

  public deletePurchaseOrder(id: string) {
    financeStore.deleteJournalEntriesBySource("Payment Voucher", id)
    const target = this.purchaseOrders.find((p) => p.id === id)
    if (target?.journalEntryId) {
      financeStore.deleteJournalEntry(target.journalEntryId)
    }
    this.purchaseOrders = this.purchaseOrders.filter((p) => p.id !== id)
    this.notify()
  }

  public syncPurchaseVoucherToFinance(po: PurchaseOrder): { success: boolean; error?: string; journalEntryId?: string } {
    // 1. Remove any previous journal entries for this voucher
    financeStore.deleteJournalEntriesBySource("Payment Voucher", po.id)
    if (po.journalEntryId) {
      financeStore.deleteJournalEntry(po.journalEntryId)
    }

    if (po.status !== "PAID" && po.status !== "COMPLETED") {
      return { success: true }
    }

    const accounts = financeStore.getAccounts()
    const rawLines: Array<{
      account_id: string
      debit_amount: number
      credit_amount: number
      party_type?: "Customer" | "Supplier" | "Employee" | null
      party_id?: string | null
      party_name?: string | null
    }> = []

    const partyName = po.paidTo || po.supplier || "Vendor / Payee"

    // 2. Build lines from account distribution entries
    if (Array.isArray(po.accountEntries) && po.accountEntries.length > 0) {
      for (const entry of po.accountEntries) {
        const acc = accounts.find((a) => a.code === entry.accountCode || a.id === entry.accountId || a.id === `ACC-${entry.accountCode}`)
          || accounts.find((a) => a.code === "1410" || a.code === "5000" || a.account_type === "Expense" || a.account_type === "Asset")
        
        if (!acc) continue

        const debit = Number(entry.debit) || 0
        const credit = Number(entry.credit) || 0

        if (debit > 0 || credit > 0) {
          const accCode = acc.code
          const isPartyReq = accCode === "1200" || accCode === "2000" || accCode === "2100" || acc.name.toLowerCase().includes("payable") || acc.name.toLowerCase().includes("receivable")
          rawLines.push({
            account_id: acc.id,
            debit_amount: debit,
            credit_amount: credit,
            party_type: isPartyReq ? "Supplier" : null,
            party_id: isPartyReq ? (po.supplierId || "SUP-MISC") : null,
            party_name: isPartyReq ? partyName : null,
          })
        }
      }
    }

    // 3. Fallback single line if no valid rows were added
    if (rawLines.length === 0) {
      const debitAcc = (po.targetAccountId && accounts.find((a) => a.id === po.targetAccountId))
        || (po.targetAccountCode && accounts.find((a) => a.code === po.targetAccountCode))
        || accounts.find((a) => a.code === "1410")
        || accounts.find((a) => a.code === "5000")
        || accounts.find((a) => a.account_type === "Expense")
        || accounts.find((a) => a.account_type === "Asset")

      if (debitAcc) {
        rawLines.push({
          account_id: debitAcc.id,
          debit_amount: po.amount || 0,
          credit_amount: 0,
          party_type: "Supplier",
          party_id: po.supplierId || "SUP-MISC",
          party_name: partyName,
        })
      }
    }

    // 4. Calculate total debits & credits and balance the voucher with Bank / Cash
    const totalDebit = rawLines.reduce((sum, l) => sum + (Number(l.debit_amount) || 0), 0)
    const totalCredit = rawLines.reduce((sum, l) => sum + (Number(l.credit_amount) || 0), 0)

    const bankAcc = accounts.find((a) => a.code === "1010" || a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("cash"))
      || accounts.find((a) => a.account_type === "Asset" && !a.is_group)

    if (totalDebit > totalCredit) {
      const diff = Math.round((totalDebit - totalCredit) * 100) / 100
      if (bankAcc) {
        rawLines.push({
          account_id: bankAcc.id,
          debit_amount: 0,
          credit_amount: diff,
          party_type: null,
          party_id: null,
          party_name: null,
        })
      }
    } else if (totalCredit > totalDebit) {
      const diff = Math.round((totalCredit - totalDebit) * 100) / 100
      const invAcc = accounts.find((a) => a.code === "1410" || a.code === "5000" || a.account_type === "Expense")
      if (invAcc) {
        rawLines.push({
          account_id: invAcc.id,
          debit_amount: diff,
          credit_amount: 0,
          party_type: "Supplier",
          party_id: po.supplierId || "SUP-MISC",
          party_name: partyName,
        })
      }
    }

    // 5. Post the balanced journal entry to the General Ledger
    const postRes = financeStore.postJournalEntry(
      {
        entry_date: po.date || new Date().toISOString().split("T")[0],
        description: `Payment Voucher ${po.voucherNo || po.poNumber} (${partyName}): ${po.reasonForPayment || "General Procurement"}`,
        source_type: "Payment Voucher",
        source_id: po.id,
        created_by: po.preparedBy || "Procurement Officer",
        currency: po.currency || "ETB",
        exchange_rate: 1.0,
      },
      rawLines
    )

    if (postRes.success && postRes.entry) {
      po.journalEntryId = postRes.entry.id
      return { success: true, journalEntryId: postRes.entry.id }
    } else {
      console.warn("Failed to post payment voucher to finance:", postRes.error)
      return { success: false, error: postRes.error }
    }
  }

  public updatePurchaseOrderStatus(id: string, status: PurchaseOrder["status"]) {
    const statusColorMap: Record<string, string> = {
      DRAFT: "bg-zinc-600 text-white",
      PAID: "bg-emerald-600 text-white",
      COMPLETED: "bg-emerald-600 text-white",
      "IN TRANSIT": "bg-blue-700 text-white",
      RECEIVED: "bg-emerald-600 text-white",
      CANCELLED: "bg-red-600 text-white",
    }
    this.purchaseOrders = this.purchaseOrders.map((po) => {
      if (po.id !== id) return po
      const updatedPo = { ...po, status, statusColor: statusColorMap[status] || "bg-zinc-600 text-white" }
      if ((status === "PAID" || status === "COMPLETED") && !updatedPo.journalEntryId) {
        this.syncPurchaseVoucherToFinance(updatedPo)
      }
      return updatedPo
    })
    this.notify()
  }

  // Receive Stock Goods for Purchase Order (Stock Goods Receipt & Inventory GL Voucher)
  public createPurchaseReceiptForPO(
    poId: string,
    receivedItems?: Array<{ productId: string; qty: number }>
  ): { success: boolean; error?: string; journalEntryId?: string } {
    const po = this.purchaseOrders.find((p) => p.id === poId)
    if (!po) return { success: false, error: "Purchase Order not found." }

    // 1. Update product quantities in inventory store
    po.items?.forEach((item) => {
      const recQty = receivedItems?.find((i) => i.productId === item.productId)?.qty ?? item.qty
      const pIndex = this.products.findIndex((prod) => prod.id === item.productId || prod.sku === item.sku)
      if (pIndex !== -1) {
        this.products[pIndex] = {
          ...this.products[pIndex],
          quantity: this.products[pIndex].quantity + recQty,
          status: "In Stock",
        }
      }
    })

    // 2. Post Goods Received Double-Entry Journal Entry in Finance Store
    // Debit Inventory / Stock In Hand
    // Credit Other Accruals / GRNI Clearing
    const invAcc = financeStore.getMappedAccount("po_grni_inventory", "1410-01")
    const clearingAcc = financeStore.getMappedAccount("po_grni_clearing", "2100-06")

    let jeId: string | undefined
    if (invAcc && clearingAcc) {
      const postRes = financeStore.postJournalEntry(
        {
          entry_date: new Date().toISOString().split("T")[0],
          description: `Stock Goods Receipt for PO ${po.poNumber} (${po.supplier})`,
          source_type: "Purchase Invoice",
          source_id: po.id,
          created_by: "Warehouse Procurement Officer",
          currency: po.currency || "ETB",
          exchange_rate: 1.0,
        },
        [
          { account_id: invAcc.id, debit_amount: po.amount, credit_amount: 0, warehouse_id: po.warehouse },
          {
            account_id: clearingAcc.id,
            debit_amount: 0,
            credit_amount: po.amount,
            party_type: "Supplier" as const,
            party_id: po.supplierId,
            party_name: po.supplier,
          },
        ]
      )
      if (postRes.success && postRes.entry) {
        jeId = postRes.entry.id
      }
    }

    // 3. Update PO status
    const receiptId = `PR-${Date.now().toString().slice(-5)}`
    this.purchaseOrders = this.purchaseOrders.map((p) => {
      if (p.id !== poId) return p
      const existingReceipts = p.receiptIds || []
      return {
        ...p,
        status: "RECEIVED" as const,
        statusColor: "bg-emerald-600 text-white",
        receiptStatus: "Fully Received" as const,
        receivedAmount: p.amount,
        receiptIds: [...existingReceipts, receiptId],
      }
    })

    this.notify()
    return { success: true, journalEntryId: jeId }
  }

  // Create Supplier Purchase Invoice (Accounts Payable / AP Ledger in Finance)
  public createPurchaseInvoiceForPO(
    poId: string,
    taxPercent?: number,
    paymentTerms = "Net 30"
  ): { success: boolean; error?: string; invoiceId?: string; journalEntryId?: string } {
    const po = this.purchaseOrders.find((p) => p.id === poId)
    if (!po) return { success: false, error: "Purchase Order not found." }

    const appliedTaxPercent = taxPercent !== undefined ? taxPercent : financeStore.getDefaultVatRate()
    const taxAmount = Math.round((po.amount * (appliedTaxPercent / 100)) * 100) / 100
    const totalAmount = po.amount + taxAmount

    // Post AP Journal Entry:
    // Debit GRNI Accruals Clearing (2100-06)
    // Credit Accounts Payable (2100-06)
    const clearingAcc = financeStore.getMappedAccount("po_grni_clearing", "2100-06")
    const apAcc = financeStore.getMappedAccount("ap_trade_payable", "2100-06")

    let jeId: string | undefined
    if (clearingAcc && apAcc) {
      const postRes = financeStore.postJournalEntry(
        {
          entry_date: new Date().toISOString().split("T")[0],
          description: `Accounts Payable Vendor Invoice for PO ${po.poNumber} - ${po.supplier} (${paymentTerms})`,
          source_type: "Purchase Invoice",
          source_id: po.id,
          created_by: "Accounts Payable Manager",
          currency: po.currency || "ETB",
          exchange_rate: 1.0,
        },
        [
          { account_id: clearingAcc.id, debit_amount: po.amount, credit_amount: 0 },
          {
            account_id: apAcc.id,
            debit_amount: 0,
            credit_amount: totalAmount,
            party_type: "Supplier" as const,
            party_id: po.supplierId,
            party_name: po.supplier,
          },
        ]
      )
      if (postRes.success && postRes.entry) {
        jeId = postRes.entry.id
      }
    }

    const pinvId = `PINV-${Date.now().toString().slice(-5)}`

    // Update PO billing status
    this.purchaseOrders = this.purchaseOrders.map((p) => {
      if (p.id !== poId) return p
      const existingInvoices = p.invoiceIds || []
      return {
        ...p,
        billedAmount: totalAmount,
        billingStatus: "Fully Billed" as const,
        invoiceIds: [...existingInvoices, pinvId],
      }
    })

    this.notify()
    return { success: true, invoiceId: pinvId, journalEntryId: jeId }
  }

  public evaluateStock() {
    return evaluateStockStatus(this.products, this.stockMovements)
  }

  public validateTransfer(transfer: any) {
    return validateTransferNote(transfer)
  }

  public processPipeline(so: any, stage: string) {
    return processSalesOrderPipeline(so, stage)
  }

  public getCompanySettings() {
    return financeStore.getCompanySettings()
  }

  public updateCompanySettings(partial: any) {
    financeStore.updateCompanySettings(partial)
    this.notify()
  }

  public clearAllTestingData() {
    this.products = []
    this.salesOrders = []
    this.purchaseOrders = []
    this.quotations = []
    this.deliveryNotes = []
    this.transfers = []
    this.stockMovements = []
    this.notify()
    financeStore.clearAllTestingData()
  }
}

export const erpStore = new ErpStore()

export function useErpStore() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const unsub = erpStore.subscribe(() => setTick((t) => t + 1))
    return () => { unsub() }
  }, [])

  return erpStore
}

export interface HkcDocAttachment {
  attachmentId: string
  fileName: string
  fileUrl: string
  fileSize?: number
  uploadedAt: string
}

export interface HkcDocRecord {
  id: string
  shipmentId: string
  itemsDescription: string
  type: "Import" | "Export"
  date: string
  attachments: HkcDocAttachment[]
  createdAt: string
  updatedAt: string
}
