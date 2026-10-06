import { useEffect, useMemo, useState, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { FileText, Plus, Send, Trash2, X, Download, Upload, CheckCircle2, Receipt, ArrowRight, Pencil, AlertCircle, Lock, ExternalLink } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, getTradeLicenseStatus } from "@/lib/erpStore"
import { useFinanceStore } from "@/lib/financeStore"
import { useAuthStore } from "@/lib/authStore"
import { isWH1, matchesWarehouse, getUserPermittedWarehouses } from "@/lib/warehouses"
import { useFeedback } from "@/context/FeedbackContext"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { EditModalHeader } from "@/components/EditModalHeader"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import SalesIssuePrintModal from "@/components/sales/SalesIssuePrintModal"
import { SalesIssueCOASplitSection, type SplitLineItem } from "@/components/sales/SalesIssueCOASplitSection"
import { COMPANY_CHART_OF_ACCOUNTS } from "@/lib/companyCOA"
import { resolveCommodityAccounts } from "@/lib/commodityAccounts"

import {
  saveTradeLicense,
  savePaymentAdvice,
  fetchTradeAndAdviceDocs,
} from "@/lib/tradeDocumentService"
import { uploadFile } from "@/lib/fileUpload"
import { getLocalDateString } from "@/lib/dateUtils"
import {
  fetchProcessingServices,
  transitionProcessingServiceStage,
  type ProcessingServiceOrder,
} from "@/lib/processingServicesApi"
import { calculateProcessingServiceFee } from "@/lib/processingFeeCalculator"

import {
  createSalesIssue,
  deleteSalesIssue,
  getAvailableBatches,
  getSalesIssue,
  listSalesIssues,
  postSalesIssue,
  updateSalesIssue,
  type AvailableBatch,
  type PaymentType,
  type SalesIssue,
  type SalesIssueItem,
} from "@/lib/salesIssuesApi"

const salesIssueColumns: TableColumn[] = [
  { key: "fs_no", label: "FS No", align: "left" },
  { key: "reference_no", label: "Reference", align: "left" },
  { key: "sale_date", label: "Date", align: "left" },
  { key: "item", label: "Item", align: "left" },
  { key: "customer_name", label: "Customer", align: "left" },
  { key: "payment_status", label: "Payment & Settlement", align: "left" },
  { key: "total_quantity", label: "Quantity", align: "right" },
  { key: "unit_price", label: "Unit Price", align: "right" },
  { key: "total_amount", label: "Total (ETB)", align: "right" },
  { key: "_actions", label: "Actions", align: "center", noSort: true },
]

export const TAX_TYPE_OPTIONS = [
  { id: "TAX-ZERO", label: "No Tax (0%)", rate: 0 },
  { id: "TAX-VAT-15", label: "VAT (15%)", rate: 15 },
  { id: "TAX-TOT-2", label: "TOT (2%)", rate: 2 },
  { id: "CUSTOM", label: "Custom (%)", rate: -1 },
]

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d?: string | Date | null) {
  if (!d) return "—"
  try {
    let str = ""
    if (typeof d === "string") {
      str = d.includes("T") ? d.split("T")[0] : d.split(" ")[0]
    } else if (d instanceof Date) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      str = `${year}-${month}-${day}`
    } else {
      str = String(d)
    }
    const [y, m, day] = str.split("-")
    if (y && m && day) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const mIdx = parseInt(m, 10) - 1
      if (mIdx >= 0 && mIdx < 12) {
        return `${monthNames[mIdx]} ${parseInt(day, 10)}, ${y}`
      }
    }
    return str
  } catch {
    return String(d)
  }
}

export const COMMODITY_UNITS = ["Quintal", "Ton"]
export const CONTAINER_UNITS = ["Box", "Bottle", "Vial", "Sachet", "Pack", "Carton"]

function blankItem(defaultUnit = "Box"): SalesIssueItem {
  return { item_id: "", item_name: "", batch_id: "", batch_no: "", packaging_unit: defaultUnit, available_quantity: 0, quantity: 0, unit_price: 0, amount: 0 }
}

function SalesIssuedSkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index}>
          <td className="px-4 py-4"><Skeleton className="h-3 w-24 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="h-3 w-24 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="h-3 w-20 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="h-3 w-40 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="h-3 w-32 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="h-3 w-28 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="ml-auto h-3 w-16 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="ml-auto h-3 w-20 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><Skeleton className="ml-auto h-3 w-24 bg-zinc-200/80" /></td>
          <td className="px-4 py-4"><div className="flex items-center gap-1"><Skeleton className="size-7 rounded-lg bg-zinc-200/80" /><Skeleton className="size-7 rounded-lg bg-zinc-200/80" /><Skeleton className="size-7 rounded-lg bg-zinc-200/80" /></div></td>
        </tr>
      ))}
    </>
  )
}

export default function SalesIssued() {
  const erp = useErpStore()
  const financeStore = useFinanceStore()
  const { user } = useAuthStore()
  const { showToast, confirm } = useFeedback()
  const products = erp.getProducts()
  const allWarehouses = erp.getWarehouses()
  const warehouses = useMemo(() => getUserPermittedWarehouses(user, allWarehouses), [user, allWarehouses])
  const bankAccounts = useMemo(() => {
    const raw = financeStore.getAccounts().filter((a) => !a.is_group && ((a?.code || "").startsWith("1000") || a.account_type === "Asset"))
    if (raw.length > 0) return raw
    return [
      { id: "1000-02-26", code: "1000-02-26", name: "Commercial Bank of Ethiopia (CBE)", account_type: "Asset" },
      { id: "1000-02-27", code: "1000-02-27", name: "Awash Bank", account_type: "Asset" },
      { id: "1000-02-28", code: "1000-02-28", name: "Dashen Bank", account_type: "Asset" },
      { id: "1000-02-29", code: "1000-02-29", name: "Bank of Abyssinia", account_type: "Asset" },
      { id: "1000-01-01", code: "1000-01-01", name: "Cash on Hand / Main Cash", account_type: "Asset" },
    ]
  }, [financeStore])

  const [searchParams, setSearchParams] = useSearchParams()
  const editIdParam = searchParams.get("editId")
  const searchParam = searchParams.get("search")

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [batchFilter, setBatchFilter] = useState("ALL")
  const [search, setSearch] = useState(() => searchParam || "")
  const openedEditIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (searchParam !== null && searchParam !== undefined && searchParam !== search) {
      setSearch(searchParam)
    }
  }, [searchParam])

  const [rows, setRows] = useState<SalesIssue[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SalesIssue | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [printingIssue, setPrintingIssue] = useState<SalesIssue | null>(null)
  const [batchOptions, setBatchOptions] = useState<Record<number, AvailableBatch[]>>({})
  const [selectedSoId, setSelectedSoId] = useState<string | null>(null)
  const [issueFormErrors, setIssueFormErrors] = useState<Record<string, string>>({})
  const [fsNo, setFsNo] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [saleDate, setSaleDate] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [custTin, setCustTin] = useState("")
  const [warehouseId, setWarehouseId] = useState("")
  const [paymentType, setPaymentType] = useState<PaymentType>("Cash")
  const [items, setItems] = useState<SalesIssueItem[]>([blankItem()])
  const [taxRate, setTaxRate] = useState<number>(0)
  const [taxRuleType, setTaxRuleType] = useState<string>("TAX-ZERO")
  const [customTaxRateInput, setCustomTaxRateInput] = useState<string>("0")

  // Dynamic tax options synced with live Tax Rules from Finance
  const dynamicTaxOptions = useMemo(() => {
    const rules = financeStore.getTaxRules().filter((t) => t.is_active && !["TAX-001", "TAX-002", "TAX-003"].includes(t.id))
    if (rules.length === 0) return TAX_TYPE_OPTIONS
    const mapped = rules.map((r) => {
      let cleanLabel = r.name.replace(/\s*\(\d+%\)/g, "").trim()
      if (cleanLabel.toLowerCase().includes("zero") || r.ratePercent === 0) cleanLabel = "No Tax"
      else if (cleanLabel.toLowerCase().includes("standard vat")) cleanLabel = "VAT"
      else if (cleanLabel.toLowerCase().includes("turnover")) cleanLabel = "TOT"
      return {
        id: r.id,
        label: `${cleanLabel} (${r.ratePercent}%)`,
        rate: Number(r.ratePercent || 0),
      }
    })
    return [
      ...mapped,
      { id: "CUSTOM", label: "Custom (%)", rate: -1 },
    ]
  }, [financeStore])
  
  // COA Multi-Account Split state (Section A Revenue & Section B COGS)
  const [siDebitLines, setSiDebitLines] = useState<SplitLineItem[]>([])
  const [siCreditLines, setSiCreditLines] = useState<SplitLineItem[]>([])
  const [siCogsDebitLines, setSiCogsDebitLines] = useState<SplitLineItem[]>([])
  const [siCogsCreditLines, setSiCogsCreditLines] = useState<SplitLineItem[]>([])

  const handleTaxTypeChange = (selectedId: string) => {
    setTaxRuleType(selectedId)
    let newRate = 0
    if (selectedId === "CUSTOM") {
      newRate = Math.max(0, parseFloat(customTaxRateInput) || 0)
    } else {
      const opt = dynamicTaxOptions.find((o) => o.id === selectedId) || TAX_TYPE_OPTIONS.find((o) => o.id === selectedId)
      newRate = opt ? opt.rate : 0
      setCustomTaxRateInput(String(newRate))
    }
    setTaxRate(newRate)

    const newVat = Math.round(subtotal * (newRate / 100))
    const newGrandTotal = subtotal + newVat

    // Immediately update credit lines for tax
    setSiCreditLines((prev) => {
      const isTax = (l: SplitLineItem) => {
        const c = (l.accountCode || l.accountId || "").toLowerCase()
        const d = (l.description || "").toLowerCase()
        return c.startsWith("2000-05") || c.startsWith("2000-04") || d.includes("vat") || d.includes("tot") || d.includes("tax")
      }
      const revLines = prev.filter((l) => !isTax(l))
      if (newVat <= 0) return revLines

      const activeRules = financeStore.getTaxRules()
      const rule = activeRules.find((r) => r.id === selectedId)
      const targetTaxCode = rule?.accountCode || "2000-05"
      const taxAcc = resolveAcc(targetTaxCode)

      return [
        ...revLines,
        {
          id: `cr-sale-tax-${Date.now()}`,
          accountId: taxAcc?.id || targetTaxCode,
          accountCode: taxAcc?.code || targetTaxCode,
          accountName: taxAcc?.name || rule?.name || "Tax Payable",
          description: rule?.name || (newRate === 2 ? "Turnover Tax (2%)" : "Standard Output VAT"),
          amount: newVat,
        },
      ]
    })

    // Update single debit line if present
    setSiDebitLines((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], amount: newGrandTotal }]
      }
      return prev
    })
  }

  const handleCustomTaxChange = (val: string) => {
    setCustomTaxRateInput(val)
    const newRate = Math.max(0, parseFloat(val) || 0)
    setTaxRate(newRate)

    const newVat = Math.round(subtotal * (newRate / 100))
    const newGrandTotal = subtotal + newVat

    setSiCreditLines((prev) => {
      const isTax = (l: SplitLineItem) => {
        const c = (l.accountCode || l.accountId || "").toLowerCase()
        const d = (l.description || "").toLowerCase()
        return c.startsWith("2000-05") || c.startsWith("2000-04") || d.includes("vat") || d.includes("tot") || d.includes("tax")
      }
      const revLines = prev.filter((l) => !isTax(l))
      if (newVat <= 0) return revLines

      const taxAcc = resolveAcc("2000-05")
      return [
        ...revLines,
        {
          id: `cr-sale-tax-${Date.now()}`,
          accountId: taxAcc?.id || "2000-05",
          accountCode: taxAcc?.code || "2000-05",
          accountName: taxAcc?.name || "VAT PAYABLE",
          description: `Custom Tax (${newRate}%)`,
          amount: newVat,
        },
      ]
    })

    setSiDebitLines((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], amount: newGrandTotal }]
      }
      return prev
    })
  }

  // Staged documentation & payment advice
  const [stagedPaymentAdviceName, setStagedPaymentAdviceName] = useState("")
  const [stagedPaymentAdviceUrl, setStagedPaymentAdviceUrl] = useState("")
  const [stagedTradePaperName, setStagedTradePaperName] = useState("")
  const [stagedTradePaperUrl, setStagedTradePaperUrl] = useState("")
  const [isDocsLoading, setIsDocsLoading] = useState(false)
  const [previewDocUrl, setPreviewDocUrl] = useState("")
  const [previewDocName, setPreviewDocName] = useState("")

  // Partial Payment Installment Modal State
  const [payingIssue, setPayingIssue] = useState<SalesIssue | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(getLocalDateString())
  const [payBank, setPayBank] = useState("1000-02-26")
  const [payRef, setPayRef] = useState("")
  const [payAdviceFile, setPayAdviceFile] = useState<File | null>(null)
  const [payNotes, setPayNotes] = useState("")
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  // Processing Services State (for EXP-WH Processing delivery issues)
  const [processedServices, setProcessedServices] = useState<ProcessingServiceOrder[]>([])
  const [selectedPsId, setSelectedPsId] = useState<string | null>(null)
  const [selectedPsOrder, setSelectedPsOrder] = useState<ProcessingServiceOrder | null>(null)
  const [psCalcDate, setPsCalcDate] = useState<string>(getLocalDateString())

  const isProcessingService =
    warehouseId === "EXP-WH Processing" ||
    warehouseId === "EXP-WH-PS" ||
    Boolean(selectedPsId) ||
    Boolean(editing?.service_order_id) ||
    editing?.warehouse_id === "EXP-WH Processing"

  const pullableProcessedServices = useMemo(() => {
    return processedServices.filter((ps) => {
      if (ps.status !== "Processed") return false
      const alreadyIssued = rows.some(
        (r) =>
          r.service_order_id === ps.id ||
          r.reference_no === ps.reference_number ||
          r.reference_no === ps.id ||
          (r.reference_no && r.reference_no.includes(ps.id))
      )
      return !alreadyIssued
    })
  }, [processedServices, rows])

  const companySettings = erp.getCompanySettings()
  const psRates = useMemo(() => ({
    processingRatePerQuintal: companySettings.processing_rate_per_quintal ?? 150,
    baseStorageRatePerQuintalDay: companySettings.base_storage_rate_per_quintal_day ?? 1.25,
    storageIncrementPerMonth: companySettings.storage_increment_per_month ?? 0.25,
    maxStorageMonthCap: companySettings.max_storage_month_cap ?? 4,
    storageFreeDays: companySettings.storage_free_days ?? 0,
  }), [companySettings])

  const psFeeResult = useMemo(() => {
    if (!isProcessingService || !selectedPsOrder) {
      return {
        processingFee: 0,
        storageFee: 0,
        totalFee: 0,
        daysInStorage: 0,
        storageFeeBreakdown: [] as any[],
      }
    }
    const targetGrossQty = Number(selectedPsOrder.quantity || 0)
    const targetEndDate = psCalcDate || saleDate || getLocalDateString()
    return calculateProcessingServiceFee(
      targetGrossQty,
      selectedPsOrder.entry_date || targetEndDate,
      targetEndDate,
      true,
      psRates,
      {
        lockedProcessingRate: selectedPsOrder.locked_processing_rate,
        lockedProcessingFee: selectedPsOrder.locked_processing_fee,
        lockedStorageFee: selectedPsOrder.locked_storage_fee,
        lockedTotalFee: selectedPsOrder.locked_total_fee,
        isDelivered: selectedPsOrder.status === "Delivered",
      }
    )
  }, [isProcessingService, selectedPsOrder, psCalcDate, saleDate, psRates])

  const salesOrders = erp.getSalesOrders()

  const evaluatedPendingSalesOrders = useMemo(() => {
    const customers = erp.getCustomers()
    return salesOrders.map((so) => {
      const alreadyIssued = rows.some((row) => (row.sales_order_id && row.sales_order_id === so.id) || (row.reference_no && (row.reference_no === so.id || row.reference_no.includes(so.id))))
      const isFullyDelivered = so.deliveryStatus === "Fully Delivered"

      if (isFullyDelivered || alreadyIssued) {
        return null
      }

      const isWh1Order = isWH1(so.warehouse)
      const matchedCust = customers.find((c) => c.id === so.customerId || c.name === so.customer)

      let lockReason = ""
      const isApproved = so.approvalStatus === "Approved"
      if (!isApproved) {
        lockReason = so.approvalStatus === "Declined" ? "Declined by Admin" : "Pending Admin Approval"
      } else if (matchedCust) {
        const compliance = getTradeLicenseStatus(matchedCust, so.warehouse)
        if (compliance.status === "missing") {
          lockReason = isWh1Order ? "Missing Bank Permit" : "Missing Trade License"
        } else if (compliance.status === "expired") {
          lockReason = "Expired Trade License"
        }
      }

      const isFulfillable = !lockReason

      return {
        ...so,
        isFulfillable,
        lockReason,
      }
    }).filter(Boolean) as (any)[]
  }, [salesOrders, rows, erp])

  const fulfillableOrders = useMemo(() => evaluatedPendingSalesOrders.filter((s) => s.isFulfillable), [evaluatedPendingSalesOrders])
  const lockedOrders = useMemo(() => evaluatedPendingSalesOrders.filter((s) => !s.isFulfillable), [evaluatedPendingSalesOrders])

  const canonicalWarehouseId = (value: string) => {
    if (value === "EXP-WH Processing" || value === "EXP-WH-PS") return "EXP-WH Processing"
    const warehouse = warehouses.find((entry) => matchesWarehouse(entry.id, value) || matchesWarehouse(entry.code, value) || entry.name === value)
    return warehouse?.id || value
  }

  const handleSelectPullSalesOrder = async (so: any) => {
    if (selectedSoId === so.id) {
      setSelectedSoId(null)
      setSelectedPsId(null)
      setSelectedPsOrder(null)
      setCustomerName("")
      setCustTin("")
      setWarehouseId("")
      setReferenceNo("")
      setPaymentType("Cash")
      setStagedPaymentAdviceName("")
      setStagedPaymentAdviceUrl("")
      setStagedTradePaperName("")
      setStagedTradePaperUrl("")
      setItems([blankItem()])
      setIssueFormErrors({})
      return
    }

    setSelectedPsId(null)
    setSelectedPsOrder(null)
    setSelectedSoId(so.id)
    setCustomerName(so.customer)
    const matchedCust = erp.getCustomers().find(
      (c) => (c.name || "").toLowerCase() === (so.customer || "").toLowerCase() || c.id === so.customerId
    )
    setCustTin(so.customerTin || so.tin || matchedCust?.tin || "")
    const matchedWh = warehouses.find((w) => matchesWarehouse(w.id, so.warehouse) || matchesWarehouse(w.code, so.warehouse) || w.name === so.warehouse)
    const targetWhId = matchedWh ? matchedWh.id : canonicalWarehouseId(so.warehouse)
    setWarehouseId(targetWhId)
    const targetIsWh1 = isWH1(so.warehouse) || isWH1(targetWhId)
    const explicitPaymentType = (so.paymentType || so.payment_type || so.payment_method || so.paymentMethod || "").toString().trim().toLowerCase()
    const targetIsCash = explicitPaymentType === "cash" || (!explicitPaymentType && (so.payment_terms || so.paymentTerms || "").toString().toLowerCase() === "cash")
    setPaymentType(targetIsCash ? "Cash" : "Credit")
    setReferenceNo("")
    if (!saleDate) setSaleDate(getLocalDateString())
    setIssueFormErrors({})

    setIsDocsLoading(true)
    try {
      const resolved = await fetchTradeAndAdviceDocs({
        salesOrderId: so.id,
        customerId: so.customerId,
        customerName: so.customer,
      })

      if (resolved.tradeLicense) {
        setStagedTradePaperName(resolved.tradeLicense.name)
        setStagedTradePaperUrl(resolved.tradeLicense.url)
      } else {
        setStagedTradePaperName("")
        setStagedTradePaperUrl("")
      }

      if (resolved.paymentAdvice) {
        setStagedPaymentAdviceName(resolved.paymentAdvice.name)
        setStagedPaymentAdviceUrl(resolved.paymentAdvice.url)
      } else {
        setStagedPaymentAdviceName("")
        setStagedPaymentAdviceUrl("")
      }
    } catch {
      setStagedTradePaperName("")
      setStagedTradePaperUrl("")
      setStagedPaymentAdviceName("")
      setStagedPaymentAdviceUrl("")
    } finally {
      setIsDocsLoading(false)
    }

    const newItems: SalesIssueItem[] = []
    const allProducts = erp.getProducts()

    ;(so.items || []).forEach((item: any, idx: number) => {
      const prod = allProducts.find((p) => p.id === (item.productId || item.item_id || item.id))
      const autoBatch = targetIsWh1 
        ? "N/A" 
        : (item.batch_no || item.batch || prod?.batches?.[0]?.batchNo || prod?.batch || "")
      const availQty = prod?.quantity || item.available_quantity || 1000

      newItems.push({
        item_id: item.productId || item.item_id || item.id,
        item_name: item.name || item.item_name || prod?.name || "Contract Item",
        batch_id: autoBatch,
        batch_no: autoBatch,
        packaging_unit: item.unit || item.packaging_unit || (targetIsWh1 ? "Quintal" : "Box"),
        available_quantity: availQty,
        quantity: item.qty || item.quantity || 1,
        unit_price: item.unitPrice || item.unit_price || 0,
        amount: (item.qty || item.quantity || 1) * (item.unitPrice || item.unit_price || 0),
      })

      if (!targetIsWh1 && item.productId) {
        void getAvailableBatches(item.productId, canonicalWarehouseId(targetWhId)).then((batches) => {
          setBatchOptions((prev) => ({ ...prev, [idx]: batches }))
        }).catch(() => {})
      }
    })

    const finalItems = newItems.length > 0 ? newItems : [blankItem(targetIsWh1 ? "Quintal" : "Box")]
    setItems(finalItems)

    const soSubtotal = finalItems.reduce((s, itm) => s + Number(itm.amount || 0), 0)
    const soVat = Math.round(soSubtotal * (taxRate / 100))
    const soCost = targetIsWh1 || !isProcessingService ? calculateTotalCost(finalItems, allProducts) : 0
    const firstItemName = finalItems[0]?.item_name || ""

    const def = buildDefaultSalesCOALines(
      targetIsCash ? "Cash" : "Credit",
      targetWhId,
      soSubtotal,
      soVat,
      so.customer || "",
      soCost,
      firstItemName
    )
    setSiDebitLines(def.debitLines)
    setSiCreditLines(def.creditLines)
    setSiCogsDebitLines(def.cogsDebitLines)
    setSiCogsCreditLines(def.cogsCreditLines)
  }

  const handleSelectPullProcessingService = async (ps: ProcessingServiceOrder) => {
    if (selectedPsId === ps.id) {
      setSelectedPsId(null)
      setSelectedPsOrder(null)
      setSelectedSoId(null)
      setCustomerName("")
      setCustTin("")
      setWarehouseId("")
      setReferenceNo("")
      setPaymentType("Cash")
      setStagedPaymentAdviceName("")
      setStagedPaymentAdviceUrl("")
      setStagedTradePaperName("")
      setStagedTradePaperUrl("")
      setItems([blankItem()])
      setIssueFormErrors({})
      return
    }

    setSelectedSoId(null)
    setSelectedPsId(ps.id)
    setSelectedPsOrder(ps)
    setCustomerName(ps.client_company_name)
    setCustTin("")
    setWarehouseId("EXP-WH Processing")
    setPaymentType("Cash")
    setReferenceNo(ps.reference_number || ps.id)
    setPsCalcDate(getLocalDateString())
    if (!saleDate) setSaleDate(getLocalDateString())
    setIssueFormErrors({})

    setIsDocsLoading(true)
    try {
      if (ps.contract_url) {
        setStagedTradePaperName(ps.contract_file_name || "Processing Contract")
        setStagedTradePaperUrl(ps.contract_url)
      } else {
        const resolved = await fetchTradeAndAdviceDocs({
          customerId: ps.customer_id || undefined,
          customerName: ps.client_company_name,
        })
        if (resolved.tradeLicense) {
          setStagedTradePaperName(resolved.tradeLicense.name)
          setStagedTradePaperUrl(resolved.tradeLicense.url)
        } else {
          setStagedTradePaperName("")
          setStagedTradePaperUrl("")
        }
      }
      setStagedPaymentAdviceName("")
      setStagedPaymentAdviceUrl("")
    } catch {
      setStagedTradePaperName("")
      setStagedTradePaperUrl("")
      setStagedPaymentAdviceName("")
      setStagedPaymentAdviceUrl("")
    } finally {
      setIsDocsLoading(false)
    }

    const calc = calculateProcessingServiceFee(
      Number(ps.quantity || 0),
      ps.entry_date || getLocalDateString(),
      getLocalDateString(),
      true,
      psRates,
      {
        lockedProcessingRate: ps.locked_processing_rate,
        lockedProcessingFee: ps.locked_processing_fee,
        lockedStorageFee: ps.locked_storage_fee,
        lockedTotalFee: ps.locked_total_fee,
        isDelivered: ps.status === "Delivered",
      }
    )

    setItems([
      {
        item_id: "SRV-EXP-PROCESSING",
        item_name: `EXP-WH Processing Fee (${ps.goods_description})`,
        batch_id: "N/A",
        batch_no: "N/A",
        packaging_unit: ps.uom || "Quintal",
        available_quantity: Number(ps.quantity || 0),
        quantity: Number(ps.quantity || 0),
        unit_price: Number(ps.quantity) > 0 ? Math.round((calc.totalFee / Number(ps.quantity)) * 100) / 100 : calc.totalFee,
        amount: calc.totalFee,
      },
    ])
  }

  const batchFilters = useMemo(() => {
    const list = new Set<string>()
    rows.forEach((r) => (r.items || []).forEach((i) => i.batch_no && list.add(i.batch_no)))
    return Array.from(list)
  }, [rows])

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (batchFilter && batchFilter !== "ALL") params.set("batch", batchFilter)
      if (search.trim()) params.set("search", search.trim())
      const [res, psList] = await Promise.all([
        listSalesIssues(params),
        fetchProcessingServices("ALL").catch(() => [] as ProcessingServiceOrder[]),
      ])
      setRows(res.rows)
      setTotal(res.total)
      setProcessedServices(psList)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales issues")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Load finance store, sales data, and inventory data on mount
  useEffect(() => {
    void financeStore.loadFromApi()
    void erp.loadSalesData()
    void erp.loadInventoryData()
  }, [])

  const resolveAcc = (idOrCode?: string) => {
    if (!idOrCode) return null
    const clean = String(idOrCode).trim()
    const unPrefixed = clean.replace(/^ACC-/, "")
    const accounts = financeStore.getAccounts()
    return (
      accounts.find(
        (a) =>
          a.code === clean ||
          a.id === clean ||
          a.code === unPrefixed ||
          a.id === `ACC-${clean}` ||
          a.id === unPrefixed
      ) ||
      COMPANY_CHART_OF_ACCOUNTS.find(
        (a) =>
          a.code === clean ||
          a.id === clean ||
          a.code === unPrefixed ||
          a.id === `ACC-${clean}` ||
          a.id === unPrefixed
      ) ||
      null
    )
  }

  const resolveItemUnitCost = (itm: any, allProducts: any[]): number => {
    if (itm.unit_cost !== undefined && itm.unit_cost !== null && Number(itm.unit_cost) > 0) return Number(itm.unit_cost)
    if (itm.cost_price !== undefined && itm.cost_price !== null && Number(itm.cost_price) > 0) return Number(itm.cost_price)
    
    const prod = allProducts.find((p) => p.id === itm.item_id || p.id === itm.product_id || p.name === itm.item_name || p.sku === itm.sku)
    if (prod) {
      if (itm.batch_no && itm.batch_no !== "N/A" && itm.batch_no !== "BATCH-MAIN") {
        const batch = prod.batches?.find((b: any) => b.batchNo === itm.batch_no || b.id === itm.batch_no)
        if (batch?.costPrice && Number(batch.costPrice) > 0) return Number(batch.costPrice)
        if (batch?.unitPrice && Number(batch.unitPrice) > 0) return Number(batch.unitPrice)
        const wh1Entry = prod.wh1Entries?.find((w: any) => w.entryId === itm.batch_no || w.voucherNo === itm.batch_no || w.id === itm.batch_no)
        if (wh1Entry?.unitPrice && Number(wh1Entry.unitPrice) > 0) return Number(wh1Entry.unitPrice)
      }
      if (prod.unitCost !== undefined && prod.unitCost !== null && Number(prod.unitCost) > 0) return Number(prod.unitCost)
      if (prod.valuationRate !== undefined && prod.valuationRate !== null && Number(prod.valuationRate) > 0) return Number(prod.valuationRate)
    }
    return 0
  }

  const calculateTotalCost = (itemList: any[], allProducts: any[]): number => {
    return itemList.reduce((sum, itm) => {
      const qty = Number(itm.quantity || itm.qty || 0)
      const cost = resolveItemUnitCost(itm, allProducts)
      return sum + (qty * cost)
    }, 0)
  }

  const buildDefaultSalesCOALines = (
    pType: "Cash" | "Credit",
    whId: string,
    subTot: number,
    vat: number,
    cName: string,
    costTot: number = 0,
    itemName?: string
  ) => {
    const isCreditSale = pType === "Credit"
    const cleanWh = String(whId || "").trim().toUpperCase()
    const isProcessing = cleanWh.includes("PROCESSING") || cleanWh === "EXP-WH-PS" || (isProcessingService && (whId === "" || cleanWh.includes("EXP")))
    const isExportSale = cleanWh.startsWith("WH1") || cleanWh.includes("EXP") || isWH1(whId, warehouses) || isProcessing
    const gTot = Math.round((subTot + vat) * 100) / 100

    // 1. Section A: Debit Accounts (Settlement / Cash / Bank / AR)
    const mappingRuleKey = isCreditSale
      ? (isExportSale ? "sales_credit_ar_export" : "sales_credit_ar")
      : "sales_cash_clearing"
    const fallbackDrCode = isCreditSale
      ? (isExportSale ? "1300-01" : "1300-03")
      : "1000-02-26"

    const drAcc = financeStore.getMappedAccount(mappingRuleKey, fallbackDrCode, { warehouseId: whId, itemName })
    const activeMapping = financeStore.getGlMappings().find((m) => m.id === mappingRuleKey)
    const multiAccountsPool = activeMapping?.multi_accounts && activeMapping.multi_accounts.length > 0
      ? activeMapping.multi_accounts
      : null

    let debitLines: SplitLineItem[] = []
    if (multiAccountsPool && multiAccountsPool.length > 1 && !isCreditSale) {
      debitLines = multiAccountsPool.map((poolAcc, idx) => ({
        id: `dr-sale-${Date.now()}-${idx + 1}`,
        accountId: poolAcc.account_id || poolAcc.account_code,
        accountCode: poolAcc.account_code,
        accountName: poolAcc.account_name,
        description: idx === 0 ? "Customer Direct Deposit" : "Settlement Allocation",
        amount: idx === 0 ? gTot : 0,
      }))
    } else {
      debitLines = [
        {
          id: `dr-sale-${Date.now()}-1`,
          accountId: drAcc?.id || fallbackDrCode,
          accountCode: drAcc?.code || fallbackDrCode,
          accountName: drAcc?.name || (isCreditSale ? (isExportSale ? "EXPORT SALES RECIVEABLE" : "VET MEDICEN SALES RECIVABLE") : "Commercial Bank of Ethiopia (CBE)"),
          description: isCreditSale ? `Receivable - ${cName || "Customer"}` : "Customer Direct Deposit",
          amount: gTot,
        },
      ]
    }

    // 2. Section A: Credit Accounts (Sales Revenue + VAT)
    const isWh1Sale = (isExportSale || isWH1(whId, warehouses)) && !isProcessing
    const commSet = (isExportSale || isWh1Sale) ? resolveCommodityAccounts(itemName) : null
    let defaultRevCode = isExportSale ? (commSet?.revenueCode || "4000-02-01") : "4000-01-01"
    let defaultRevName = isExportSale ? (commSet?.revenueName || "Revenue - Export Commodities") : "SALES OF VETERINARY DRUG"

    const revAcc = financeStore.getMappedAccount(
      isExportSale ? "sales_revenue_export" : "sales_revenue_domestic",
      defaultRevCode,
      { warehouseId: whId, itemName }
    )

    const creditLines: SplitLineItem[] = [
      {
        id: `cr-sale-${Date.now()}-1`,
        accountId: revAcc?.id || defaultRevCode,
        accountCode: revAcc?.code || defaultRevCode,
        accountName: revAcc?.name || defaultRevName,
        description: isProcessing ? "Export Processing & Sales Revenue Recognition" : "Sales Revenue Recognition",
        amount: Math.round(subTot * 100) / 100,
      },
    ]
    if (vat > 0) {
      const vatAcc = financeStore.getMappedAccount("sales_vat_output", "2000-05")
      creditLines.push({
        id: `cr-sale-${Date.now()}-2`,
        accountId: vatAcc?.id || "2000-05",
        accountCode: vatAcc?.code || "2000-05",
        accountName: vatAcc?.name || "VAT PAYABLE",
        description: "Standard Output VAT",
        amount: Math.round(vat * 100) / 100,
      })
    }

    // 3. Section B: COGS & Inventory Stock Lines (0 for processing services on client grain)
    const cogsVal = isProcessing ? 0 : Math.round(Number(costTot) * 100) / 100
    const defaultCogsCode = isWh1Sale ? (commSet?.cogsCode || "5010-01") : "5000-01"
    const defaultCogsName = isWh1Sale ? (commSet?.cogsName || "Cost of Goods Export") : "COST OF VETERINARY DRUG"

    const cogsDrAcc = financeStore.getMappedAccount(
      isWh1Sale ? "cogs_export_fulfillment" : "cogs_stock_fulfillment",
      defaultCogsCode,
      { warehouseId: whId, itemName }
    )

    const defaultInvCode = isWh1Sale ? (commSet?.inventoryCode || "1410-01") : "1400-01"
    const defaultInvName = isWh1Sale ? (commSet?.inventoryName || "STOCK OF GREEN MUNG") : "STOCK OF VETERINARY DRUG"

    const cogsCrAcc = financeStore.getMappedAccount(
      isWh1Sale ? "inventory_stock_in_hand" : "inventory_pharma_stock",
      defaultInvCode,
      { warehouseId: whId, itemName }
    )

    let finalCogsDrCode = cogsDrAcc?.code || defaultCogsCode
    let finalCogsDrName = cogsDrAcc?.name || defaultCogsName
    let finalCogsDrId = cogsDrAcc?.id || defaultCogsCode

    let finalCogsCrCode = cogsCrAcc?.code || defaultInvCode
    let finalCogsCrName = cogsCrAcc?.name || defaultInvName
    let finalCogsCrId = cogsCrAcc?.id || defaultInvCode

    // Safeguard: Ensure Debit (COGS) and Credit (Stock Asset) are NEVER identical
    if (finalCogsDrCode === finalCogsCrCode || finalCogsDrId === finalCogsCrId || finalCogsDrCode.startsWith("14")) {
      finalCogsDrCode = defaultCogsCode
      finalCogsDrName = defaultCogsName
      finalCogsDrId = defaultCogsCode
    }
    if (finalCogsCrCode === finalCogsDrCode || finalCogsCrCode.startsWith("50")) {
      finalCogsCrCode = defaultInvCode
      finalCogsCrName = defaultInvName
      finalCogsCrId = defaultInvCode
    }

    const cogsDebitLines: SplitLineItem[] = isProcessing ? [] : [
      {
        id: `dr-cogs-${Date.now()}-1`,
        accountId: finalCogsDrId,
        accountCode: finalCogsDrCode,
        accountName: finalCogsDrName,
        description: "Cost of Goods Sold - Stock Issued",
        amount: cogsVal,
      },
    ]

    const cogsCreditLines: SplitLineItem[] = isProcessing ? [] : [
      {
        id: `cr-cogs-${Date.now()}-1`,
        accountId: finalCogsCrId,
        accountCode: finalCogsCrCode,
        accountName: finalCogsCrName,
        description: "Inventory Asset Relieved - Stock Issued",
        amount: cogsVal,
      },
    ]

    return { debitLines, creditLines, cogsDebitLines, cogsCreditLines, revDr: debitLines, revCr: creditLines }
  }

  useEffect(() => {
    void load()
  }, [page, pageSize, batchFilter, search])

  const openCreate = (preselectedSo?: any) => {
    setEditing(null)
    setIssueFormErrors({})
    setTaxRate(0)
    setTaxRuleType("TAX-ZERO")
    setCustomTaxRateInput("0")
    setFsNo("")
    setReferenceNo("")
    setSaleDate(getLocalDateString())
    setPsCalcDate(getLocalDateString())
    setSelectedPsId(null)
    setSelectedPsOrder(null)
    setStagedTradePaperName("")
    setStagedTradePaperUrl("")
    setStagedPaymentAdviceName("")
    setStagedPaymentAdviceUrl("")

    if (preselectedSo && preselectedSo.id) {
      setSelectedSoId(preselectedSo.id)
      setCustomerName(preselectedSo.customer)
      const matchedCust = erp.getCustomers().find(
        (c) => (c.name || "").toLowerCase() === (preselectedSo.customer || "").toLowerCase() || c.id === preselectedSo.customerId
      )
      setCustTin(preselectedSo.customerTin || preselectedSo.tin || matchedCust?.tin || "")
      const matchedWh = warehouses.find((w) => matchesWarehouse(w.id, preselectedSo.warehouse) || matchesWarehouse(w.code, preselectedSo.warehouse) || w.name === preselectedSo.warehouse)
      const targetWhId = matchedWh ? matchedWh.id : canonicalWarehouseId(preselectedSo.warehouse)
      const targetIsWh1 = isWH1(preselectedSo.warehouse) || isWH1(targetWhId)
      setWarehouseId(targetWhId)
      const explicitPaymentType = (preselectedSo.paymentType || preselectedSo.payment_type || preselectedSo.payment_method || preselectedSo.paymentMethod || "").toString().trim().toLowerCase()
      const targetIsCash = explicitPaymentType === "cash" || (!explicitPaymentType && (preselectedSo.payment_terms || preselectedSo.paymentTerms || "").toString().toLowerCase() === "cash")
      setPaymentType(targetIsCash ? "Cash" : "Credit")
      setReferenceNo("")
      const allProducts = erp.getProducts()

      if (Array.isArray(preselectedSo.items) && preselectedSo.items.length > 0) {
        setItems(
          preselectedSo.items.map((i: any, idx: number) => {
            const prod = allProducts.find((p) => p.id === (i.productId || i.item_id || i.id))
            const autoBatch = targetIsWh1 
              ? "N/A" 
              : (i.batch_no || i.batch || prod?.batches?.[0]?.batchNo || prod?.batch || "")
            const availQty = prod?.quantity || i.available_quantity || 1000

            if (!targetIsWh1 && i.productId) {
              void getAvailableBatches(i.productId, canonicalWarehouseId(targetWhId)).then((batches) => {
                setBatchOptions((prev) => ({ ...prev, [idx]: batches }))
              }).catch(() => {})
            }

            return {
              item_id: i.productId || i.item_id || i.id,
              item_name: i.name || i.item_name || prod?.name || "Contract Item",
              batch_id: autoBatch,
              batch_no: autoBatch,
              packaging_unit: i.unit || i.packaging_unit || (targetIsWh1 ? "Quintal" : "Box"),
              available_quantity: availQty,
              quantity: i.qty || i.quantity || 1,
              unit_price: i.unitPrice || i.unit_price || 0,
              amount: (i.qty || i.quantity || 1) * (i.unitPrice || i.unit_price || 0),
            }
          })
        )
      } else {
        setItems([blankItem(targetIsWh1 ? "Quintal" : "Box")])
      }

      setIsDocsLoading(true)
      fetchTradeAndAdviceDocs({
        salesOrderId: preselectedSo.id,
        customerId: preselectedSo.customerId,
        customerName: preselectedSo.customer,
      })
        .then((res) => {
          if (res.tradeLicense) {
            setStagedTradePaperName(res.tradeLicense.name)
            setStagedTradePaperUrl(res.tradeLicense.url)
          }
          if (res.paymentAdvice) {
            setStagedPaymentAdviceName(res.paymentAdvice.name)
            setStagedPaymentAdviceUrl(res.paymentAdvice.url)
          }
        })
        .catch(() => {})
        .finally(() => setIsDocsLoading(false))
    } else {
      setSelectedSoId(null)
      setReferenceNo("")
      setCustomerName("")
      setCustTin("")
      setWarehouseId("")
      setPaymentType("Cash")
      setItems([blankItem()])
    }

    const allProducts = erp.getProducts()
    const initCost = calculateTotalCost(preselectedSo?.items || [], allProducts)
    const preselectedFirstItemName = preselectedSo?.items?.[0]?.name || preselectedSo?.items?.[0]?.item_name || ""
    const initDef = buildDefaultSalesCOALines(
      preselectedSo ? ((preselectedSo.paymentType || "Cash") as any) : "Cash",
      preselectedSo ? canonicalWarehouseId(preselectedSo.warehouse) : "",
      0,
      0,
      preselectedSo?.customer || "",
      initCost,
      preselectedFirstItemName
    )
    setSiDebitLines(initDef.debitLines)
    setSiCreditLines(initDef.creditLines)
    setSiCogsDebitLines(initDef.cogsDebitLines)
    setSiCogsCreditLines(initDef.cogsCreditLines)

    setFormOpen(true)
  }

  const openEdit = async (issue: SalesIssue) => {
    try {
      let full: SalesIssue
      try {
        full = await getSalesIssue(issue.id || issue.fs_no)
      } catch {
        full = issue
      }
      setEditing(full)
      setFsNo(full.fs_no || full.id || "")
      setReferenceNo(full.reference_no || "")
      setSaleDate(full.sale_date ? getLocalDateString(full.sale_date) : "")
      setCustomerName(full.customer_name || (full as any).customer || "")
      const matchedCust = erp.getCustomers().find(
        (c) => (c.name || "").toLowerCase() === ((full.customer_name || (full as any).customer || "") as string).toLowerCase() || c.id === full.customer_id
      )
      setCustTin(matchedCust?.tin || (full as any).customer_tin || (full as any).tin || "")
      const canonicalWh = canonicalWarehouseId(full.warehouse_id || "")
      setWarehouseId(canonicalWh)
      setPaymentType(((full.payment_type || (full as any).paymentType || "Cash") === "Credit" ? "Credit" : "Cash") as PaymentType)

      const isPs = canonicalWh === "EXP-WH Processing" || canonicalWh === "EXP-WH-PS" || Boolean(full.service_order_id)
      if (isPs) {
        setSelectedPsId(full.service_order_id || null)
        let matchedPs = processedServices.find((p) => p.id === full.service_order_id || p.reference_number === full.reference_no)
        if (!matchedPs && full.service_order_id) {
          try {
            const allPs = await fetchProcessingServices("ALL")
            setProcessedServices(allPs)
            matchedPs = allPs.find((p) => p.id === full.service_order_id || p.reference_number === full.reference_no)
          } catch {}
        }
        if (matchedPs) {
          setSelectedPsOrder(matchedPs)
        } else if (full.service_order_id) {
          const firstItem = full.items?.[0]
          setSelectedPsOrder({
            id: full.service_order_id,
            reference_number: full.reference_no || full.service_order_id,
            client_company_name: full.customer_name || "Client Company",
            goods_description: firstItem?.item_name?.replace(/^EXP-WH Processing Fee \((.*)\)$/, "$1") || "Toll Commodity",
            quantity: Number(firstItem?.quantity || firstItem?.available_quantity || 0),
            uom: firstItem?.packaging_unit || "Quintal",
            entry_date: full.sale_date || getLocalDateString(),
            agreed_price: Number(full.subtotal || full.total_amount || 0),
            currency: "ETB",
            status: "Delivered",
            status_history: [],
            assigned_to: "Sales",
            locked_total_fee: Number(full.subtotal || full.total_amount || 0),
          })
        }
      } else {
        setSelectedPsId(null)
        setSelectedPsOrder(null)
      }

      const loadedTaxRate = Number(full.vat_rate !== undefined ? full.vat_rate : (full.tax_rate !== undefined ? full.tax_rate : 0))
      setTaxRate(loadedTaxRate)
      const matchingTaxOption = TAX_TYPE_OPTIONS.find((o) => o.rate === loadedTaxRate && o.id !== "CUSTOM")
      if (matchingTaxOption) {
        setTaxRuleType(matchingTaxOption.id)
        setCustomTaxRateInput(String(loadedTaxRate))
      } else {
        setTaxRuleType("CUSTOM")
        setCustomTaxRateInput(String(loadedTaxRate))
      }
      
      const mappedItems = (full.items && full.items.length > 0 ? full.items : [blankItem()]).map((item: any) => {
        const qty = Number(item.quantity || item.qty || 1)
        const price = Number(item.unit_price || item.price || 0)
        const amt = Number(item.amount || (qty * price))
        return {
          ...item,
          item_id: item.item_id || item.product_id || item.id,
          item_name: item.item_name || item.product_name || item.name || "Item",
          quantity: qty,
          unit_price: price,
          amount: amt,
          packaging_unit: item.packaging_unit || item.packagingUnit || item.unit || (isWH1(canonicalWh) ? "Quintal" : "Box"),
          batch_no: item.batch_no || item.batch_id || item.batch_number || item.batch || (isWH1(canonicalWh) ? "N/A" : "BATCH-MAIN"),
          batch_id: item.batch_id || item.batch_no || item.batch_number || item.batch || (isWH1(canonicalWh) ? "N/A" : "BATCH-MAIN"),
        }
      })
      setItems(mappedItems)

      // Load custom COA accounts or build defaults (checking both sales_issues.account_entries and linked invoice gl_distribution)
      let loadedEntries = full.account_entries || (full as any).accountEntries
      if (!loadedEntries) {
        const linkedInv = financeStore.getInvoices().find((i) => i.sales_issue_id === full.id || i.id === `INV-SI-${full.id}` || i.invoice_number === full.fs_no)
        if (linkedInv?.gl_distribution) {
          loadedEntries = linkedInv.gl_distribution
        }
      }
      if (typeof loadedEntries === "string") {
        try {
          loadedEntries = JSON.parse(loadedEntries)
        } catch {
          loadedEntries = null
        }
      }

      const allProds = erp.getProducts()
      const itemSubtotal = mappedItems.reduce((s: number, itm: any) => s + Number(itm.amount || 0), 0)
      const itemVat = Math.round(itemSubtotal * (loadedTaxRate / 100))
      const itemCostTotal = calculateTotalCost(mappedItems, allProds)
      const def = buildDefaultSalesCOALines(
        (full.payment_type || "Cash") as "Cash" | "Credit",
        canonicalWh,
        itemSubtotal,
        itemVat,
        full.customer_name || "",
        itemCostTotal,
        mappedItems[0]?.item_name
      )

      if (loadedEntries && (loadedEntries.revenue_lines || loadedEntries.cogs_lines || loadedEntries.debit_lines || loadedEntries.cogs_debit_lines)) {
        const revDrRaw = (loadedEntries.debit_lines && loadedEntries.debit_lines.length > 0)
          ? loadedEntries.debit_lines
          : (loadedEntries.revenue_lines || []).filter((l: any) => Number(l.debit || l.debit_amount || 0) > 0 || (Number(l.amount || 0) > 0 && String(l.id || "").startsWith("dr-")))
        const revCrRaw = (loadedEntries.credit_lines && loadedEntries.credit_lines.length > 0)
          ? loadedEntries.credit_lines
          : (loadedEntries.revenue_lines || []).filter((l: any) => Number(l.credit || l.credit_amount || 0) > 0 || (Number(l.amount || 0) > 0 && String(l.id || "").startsWith("cr-")))

        const rDr = revDrRaw.map((l: any, idx: number) => {
          const acc = resolveAcc(l.accountCode || l.account_code || l.accountId || l.account_id || l.code || l.id)
          return {
            id: l.id || `dr-sale-${idx}-${Date.now()}`,
            accountId: acc?.id || l.accountId || l.account_id || l.accountCode || l.account_code || l.code || "",
            accountCode: acc?.code || l.accountCode || l.account_code || l.accountId || l.account_id || l.code || "",
            accountName: acc?.name || l.accountName || l.account_name || l.name || (acc?.code ? `Account ${acc.code}` : "Settlement Account"),
            description: l.description || "",
            amount: Number(l.amount || l.debit || l.debit_amount || 0),
          }
        })

        const rCr = revCrRaw.map((l: any, idx: number) => {
          const acc = resolveAcc(l.accountCode || l.account_code || l.accountId || l.account_id || l.code || l.id)
          return {
            id: l.id || `cr-sale-${idx}-${Date.now()}`,
            accountId: acc?.id || l.accountId || l.account_id || l.accountCode || l.account_code || l.code || "",
            accountCode: acc?.code || l.accountCode || l.account_code || l.accountId || l.account_id || l.code || "",
            accountName: acc?.name || l.accountName || l.account_name || l.name || (acc?.code ? `Account ${acc.code}` : "Revenue Account"),
            description: l.description || "",
            amount: Number(l.amount || l.credit || l.credit_amount || 0),
          }
        })

        const cogsDrRaw = (loadedEntries.cogs_debit_lines && loadedEntries.cogs_debit_lines.length > 0)
          ? loadedEntries.cogs_debit_lines
          : (loadedEntries.cogs_lines || []).filter((l: any) => Number(l.debit || l.debit_amount || 0) > 0 || (Number(l.amount || 0) > 0 && String(l.id || "").startsWith("dr-")))
        const cogsCrRaw = (loadedEntries.cogs_credit_lines && loadedEntries.cogs_credit_lines.length > 0)
          ? loadedEntries.cogs_credit_lines
          : (loadedEntries.cogs_lines || []).filter((l: any) => Number(l.credit || l.credit_amount || 0) > 0 || (Number(l.amount || 0) > 0 && String(l.id || "").startsWith("cr-")))

        const cogsDebits = cogsDrRaw.map((l: any, idx: number) => {
          const acc = resolveAcc(l.accountCode || l.account_code || l.accountId || l.account_id || l.code || l.id)
          return {
            id: l.id || `dr-cogs-${idx}-${Date.now()}`,
            accountId: acc?.id || l.accountId || l.account_id || l.accountCode || l.account_code || l.code || "",
            accountCode: acc?.code || l.accountCode || l.account_code || l.accountId || l.account_id || l.code || "",
            accountName: acc?.name || l.accountName || l.account_name || l.name || (acc?.code ? `Account ${acc.code}` : "COGS Expense"),
            description: l.description || "",
            amount: Number(l.amount || l.debit || l.debit_amount || 0),
          }
        })

        const cogsCredits = cogsCrRaw.map((l: any, idx: number) => {
          const acc = resolveAcc(l.accountCode || l.account_code || l.accountId || l.account_id || l.code || l.id)
          return {
            id: l.id || `cr-cogs-${idx}-${Date.now()}`,
            accountId: acc?.id || l.accountId || l.account_id || l.accountCode || l.account_code || l.code || "",
            accountCode: acc?.code || l.accountCode || l.account_code || l.accountId || l.account_id || l.code || "",
            accountName: acc?.name || l.accountName || l.account_name || l.name || (acc?.code ? `Account ${acc.code}` : "Inventory Asset"),
            description: l.description || "",
            amount: Number(l.amount || l.credit || l.credit_amount || 0),
          }
        })

        setSiDebitLines(rDr.length > 0 ? rDr : def.debitLines)
        setSiCreditLines(rCr.length > 0 ? rCr : def.creditLines)
        setSiCogsDebitLines(cogsDebits.length > 0 ? cogsDebits : def.cogsDebitLines)
        setSiCogsCreditLines(cogsCredits.length > 0 ? cogsCredits : def.cogsCreditLines)
      } else {
        setSiDebitLines(def.debitLines)
        setSiCreditLines(def.creditLines)
        setSiCogsDebitLines(def.cogsDebitLines)
        setSiCogsCreditLines(def.cogsCreditLines)
      }

      setIsDocsLoading(true)
      fetchTradeAndAdviceDocs({
        salesIssueId: full.id,
        salesOrderId: full.reference_no || undefined,
        fsNo: full.fs_no || undefined,
        customerName: full.customer_name || undefined,
      })
        .then((res) => {
          if (res.tradeLicense) {
            setStagedTradePaperName(res.tradeLicense.name)
            setStagedTradePaperUrl(res.tradeLicense.url)
          } else {
            setStagedTradePaperName("")
            setStagedTradePaperUrl("")
          }
          if (res.paymentAdvice) {
            setStagedPaymentAdviceName(res.paymentAdvice.name)
            setStagedPaymentAdviceUrl(res.paymentAdvice.url)
          } else {
            setStagedPaymentAdviceName("")
            setStagedPaymentAdviceUrl("")
          }
        })
        .catch(() => {
          setStagedTradePaperName("")
          setStagedTradePaperUrl("")
          setStagedPaymentAdviceName("")
          setStagedPaymentAdviceUrl("")
        })
        .finally(() => setIsDocsLoading(false))

      setFormOpen(true)
    } catch (err) {
      showToast("Load failed", "warning", err instanceof Error ? err.message : "Could not open edit form.")
    }
  }

  // Auto-open edit modal if editId was provided via URL (e.g. from Control Center customer receivables)
  useEffect(() => {
    if (!editIdParam) {
      openedEditIdRef.current = null
      return
    }
    if (openedEditIdRef.current === editIdParam) return

    let cancelled = false
    const triggerAutoEdit = async () => {
      try {
        const full = await getSalesIssue(editIdParam)
        if (!cancelled && full) {
          openedEditIdRef.current = editIdParam
          await openEdit(full)
          const nextParams = new URLSearchParams(searchParams)
          nextParams.delete("editId")
          setSearchParams(nextParams, { replace: true })
          return
        }
      } catch {
        // Fallback: match from loaded rows
        const match = rows.find(
          (r) =>
            r.id === editIdParam ||
            (r.fs_no && r.fs_no.toLowerCase() === editIdParam.toLowerCase()) ||
            (r.reference_no && r.reference_no.toLowerCase() === editIdParam.toLowerCase())
        )
        if (!cancelled && match) {
          openedEditIdRef.current = editIdParam
          await openEdit(match)
          const nextParams = new URLSearchParams(searchParams)
          nextParams.delete("editId")
          setSearchParams(nextParams, { replace: true })
        }
      }
    }

    void triggerAutoEdit()

    return () => {
      cancelled = true
    }
  }, [editIdParam, searchParams, setSearchParams, rows])

  // Open Record Installment Modal for Credit issue
  const openRecordPayment = (issue: SalesIssue) => {
    const paymentsForIssue = financeStore.getPaymentsForSalesIssue(issue.id)
    const paidVal = paymentsForIssue.reduce((s, p) => s + p.amount, 0) || Number(issue.amount_paid || 0)
    const totalVal = Number(issue.total_amount || 0)
    const dueVal = Number(Math.max(0, totalVal - paidVal).toFixed(2))

    setPayingIssue(issue)
    setPayAmount(dueVal > 0 ? String(dueVal) : "")
    setPayDate(getLocalDateString())
    setPayBank("1000-02-26")
    setPayRef(`DEP-${Date.now().toString().slice(-4)}`)
    setPayAdviceFile(null)
    setPayNotes("")
  }

  const handleRecordInstallmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingIssue || isSubmittingPayment) return
    const numAmount = parseFloat(payAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Invalid Amount", "warning", "Please enter a valid installment payment amount.")
      return
    }

    const paymentsForIssue = financeStore.getPaymentsForSalesIssue(payingIssue.id)
    const alreadyPaid = paymentsForIssue.reduce((s, p) => s + p.amount, 0) || Number(payingIssue.amount_paid || 0)
    const totalVal = Number(payingIssue.total_amount || 0)
    const currentDue = Number(Math.max(0, totalVal - alreadyPaid).toFixed(2))

    if (numAmount > currentDue + 0.01) {
      showToast("Overpayment Notice", "warning", `Payment amount (ETB ${numAmount.toLocaleString()}) cannot exceed remaining balance due (ETB ${currentDue.toLocaleString()}).`)
      return
    }

    if (!payAdviceFile) {
      showToast("Payment Advice Required", "warning", "Payment Advice / Bank Deposit Slip must be attached before recording an installment payment.")
      return
    }

    setIsSubmittingPayment(true)
    try {
      let stagedSlipUrl = ""
      let stagedSlipName = ""
      if (payAdviceFile) {
        try {
          const uploadRes = await uploadFile(payAdviceFile, "sales_issued")
          stagedSlipName = uploadRes.originalName
          stagedSlipUrl = uploadRes.url
        } catch (uploadErr) {
          console.warn("Server upload failed, falling back to data URL:", uploadErr)
          stagedSlipName = payAdviceFile.name
          stagedSlipUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(payAdviceFile)
          })
        }

        const linkedSoId = (payingIssue as any).sales_order_id || (payingIssue.reference_no?.startsWith("SO-") ? payingIssue.reference_no : undefined)
        try {
          await savePaymentAdvice({
            salesIssueId: payingIssue.id,
            salesOrderId: linkedSoId || payingIssue.reference_no.trim() || undefined,
            fsNo: payingIssue.fs_no.trim(),
            invoiceId: `INV-SI-${payingIssue.id}`,
            fileName: stagedSlipName,
            fileUrl: stagedSlipUrl,
            uploadedBy: "Cashier",
          })
        } catch (err) {
          console.warn("Advice upload note:", err)
        }
      }

      const resolvedSoId = (payingIssue as any).sales_order_id || (payingIssue.reference_no?.startsWith("SO-") ? payingIssue.reference_no : undefined)

      // Record payment with auto balanced double entry
      financeStore.recordPayment({
        linked_invoice_id: `INV-SI-${payingIssue.id}`,
        sales_issue_id: payingIssue.id,
        sales_order_id: resolvedSoId,
        customer_name: payingIssue.customer_name,
        amount: numAmount,
        currency: "ETB",
        date: payDate,
        method: "Bank Deposit",
        bank_account_code: payBank,
        reference: payRef || `DEP-${Date.now().toString().slice(-4)}`,
        payment_advice_url: stagedSlipUrl || undefined,
        payment_advice_filename: stagedSlipName || undefined,
        notes: payNotes,
        direction: "Received",
      })

      const newPaid = Number((alreadyPaid + numAmount).toFixed(2))
      const newDue = Number(Math.max(0, totalVal - newPaid).toFixed(2))
      const newSettlement = newDue <= 0 ? "Fully Settled" : "Ongoing"

      // Update Sales Issue in DB
      await updateSalesIssue(payingIssue.id, {
        items: payingIssue.items || [],
        amount_paid: newPaid,
        balance_due: newDue,
        settlement_status: newSettlement,
      } as any)

      // Update linked sales order in ERP store if present
      const refStr = payingIssue.reference_no || ""
      const linkedOrders = salesOrders.filter((so) => 
        (payingIssue.sales_order_id && payingIssue.sales_order_id === so.id) ||
        (refStr && (refStr.includes(so.id) || refStr === so.id))
      )
      linkedOrders.forEach((so) => {
        const soTotal = Number(so.amount || 0)
        const soPaid = Number(((so.paidAmount || 0) + numAmount).toFixed(2))
        const soDue = Number(Math.max(0, soTotal - soPaid).toFixed(2))
        erp.updateSalesOrder({
          ...so,
          paidAmount: soPaid,
          remainingBalance: soDue,
          settlementStatus: soDue <= 0 ? "Fully Settled" : (soPaid > 0 ? "Ongoing" : "Unpaid"),
        })
      })

      showToast(
        "Payment Recorded",
        "success",
        `Installment of ETB ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} recorded for ${payingIssue.fs_no}. Remaining balance: ETB ${newDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
      )
      setPayingIssue(null)
      await load()
    } catch (err) {
      showToast("Payment Failed", "warning", err instanceof Error ? err.message : "Failed to record payment.")
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const updateItem = async (index: number, patch: Partial<SalesIssueItem>) => {
    const next = [...items]
    const current = next[index]
    const updated = { ...current, ...patch }
    const targetIsWh1 = isWH1(warehouseId)

    if (patch.item_id && patch.item_id !== current.item_id && warehouseId) {
      const prod = products.find((p) => p.id === patch.item_id)
      const defaultSellingPrice = Number(prod?.sellingPrice || 0) > 0 ? Number(prod?.sellingPrice) : Number(prod?.unitCost || 0)
      if (defaultSellingPrice > 0) {
        updated.unit_price = defaultSellingPrice
      }
      if (targetIsWh1) {
        updated.batch_no = "N/A"
        updated.batch_id = "N/A"
      } else {
        const activeBatch = prod?.batches?.[0]?.batchNo || prod?.batch || ""
        updated.batch_no = activeBatch
        updated.batch_id = activeBatch
        updated.available_quantity = prod?.quantity || 1000
        try {
          const batches = await getAvailableBatches(patch.item_id, canonicalWarehouseId(warehouseId))
          setBatchOptions((prev) => ({ ...prev, [index]: batches }))
        } catch {
          setBatchOptions((prev) => ({ ...prev, [index]: [] }))
        }
      }
    }
    const qty = Number(updated.quantity || 0)
    const unitPrice = Number(updated.unit_price || 0)
    updated.amount = qty * unitPrice
    next[index] = updated
    setItems(next)

    // For WH1 / Export warehouse: if first item changes, update commodity revenue & COGS accounts
    if (index === 0 && targetIsWh1 && updated.item_name) {
      const commSet = resolveCommodityAccounts(updated.item_name)
      const revAcc = resolveAcc(commSet.revenueCode)
      const stockAcc = resolveAcc(commSet.inventoryCode)
      const cogsAcc = resolveAcc(commSet.cogsCode)

      setSiCreditLines((prev) =>
        prev.map((l) => {
          const code = (l.accountCode || l.accountId || "").toLowerCase()
          if (code.startsWith("4000-")) {
            return {
              ...l,
              accountId: revAcc?.id || commSet.revenueCode,
              accountCode: revAcc?.code || commSet.revenueCode,
              accountName: revAcc?.name || commSet.revenueName,
            }
          }
          return l
        })
      )
      setSiCogsDebitLines((prev) =>
        prev.map((l) => ({
          ...l,
          accountId: cogsAcc?.id || commSet.cogsCode,
          accountCode: cogsAcc?.code || commSet.cogsCode,
          accountName: cogsAcc?.name || commSet.cogsName,
        }))
      )
      setSiCogsCreditLines((prev) =>
        prev.map((l) => ({
          ...l,
          accountId: stockAcc?.id || commSet.inventoryCode,
          accountCode: stockAcc?.code || commSet.inventoryCode,
          accountName: stockAcc?.name || commSet.inventoryName,
        }))
      )
    }
  }

  const totalQuantity = useMemo(() => {
    if (isProcessingService && selectedPsOrder) {
      return Number(selectedPsOrder.quantity || 0)
    }
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  }, [isProcessingService, selectedPsOrder, items])

  const subtotal = useMemo(() => {
    if (isProcessingService) {
      return psFeeResult.totalFee
    }
    return items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  }, [isProcessingService, psFeeResult.totalFee, items])

  const vatRate = taxRate
  const vatAmount = useMemo(() => Math.round(subtotal * (vatRate / 100)), [subtotal, vatRate])
  const grandTotal = useMemo(() => subtotal + vatAmount, [subtotal, vatAmount])

  // Track previous warehouse, payment type, and item name to know when a fundamental category change occurred
  const prevWarehouseIdRef = useRef<string>(warehouseId)
  const prevPaymentTypeRef = useRef<string>(paymentType)
  const prevFirstItemRef = useRef<string>("")

  // Non-destructive synchronization of COA split lines
  useEffect(() => {
    if (!formOpen) return
    if (editing) return

    const firstItemName = items.find((i) => i.item_name)?.item_name || ""
    const whChanged = prevWarehouseIdRef.current !== warehouseId
    const ptChanged = prevPaymentTypeRef.current !== paymentType
    const itemChanged = Boolean(firstItemName && prevFirstItemRef.current !== firstItemName)
    prevWarehouseIdRef.current = warehouseId
    prevPaymentTypeRef.current = paymentType
    prevFirstItemRef.current = firstItemName

    const itemCostTotal = isProcessingService ? 0 : calculateTotalCost(items, products)
    const def = buildDefaultSalesCOALines(paymentType, warehouseId, subtotal, vatAmount, customerName, itemCostTotal, firstItemName)

    if (isProcessingService) {
      if (whChanged || ptChanged || siDebitLines.length === 0 || siCreditLines.length === 0) {
        setSiDebitLines(def.debitLines)
        setSiCreditLines(def.creditLines)
        setSiCogsDebitLines([])
        setSiCogsCreditLines([])
        return
      }
    }

    // If warehouse, payment type, or primary export item changed or lines are completely uninitialized, load defaults
    if (whChanged || ptChanged || itemChanged || siDebitLines.length === 0 || siCreditLines.length === 0) {
      setSiDebitLines(def.debitLines)
      setSiCreditLines(def.creditLines)
      setSiCogsDebitLines(def.cogsDebitLines)
      setSiCogsCreditLines(def.cogsCreditLines)
      return
    }

    // 1. Non-destructive Debit lines sync
    setSiDebitLines((prevDebits) => {
      const cleanWh = String(warehouseId || "").trim().toUpperCase()
      const isExportSale = cleanWh.startsWith("WH1") || cleanWh.includes("EXP") || cleanWh.includes("PROCESSING") || isWH1(warehouseId, warehouses) || isProcessingService

      if (prevDebits.length <= 1) {
        const single = prevDebits[0] || def.debitLines[0]
        const singleCode = (single?.accountCode || single?.accountId || "").trim()
        const expectedDr = def.debitLines[0]
        const isArAccount = singleCode.startsWith("1300-")
        const isCashAccount = !isArAccount

        let shouldReplaceAccount = false
        if (paymentType === "Credit") {
          // If previous was a cash account or wrong AR account for warehouse scope (e.g. 1300-03 on export or 1300-01 on domestic)
          if (isCashAccount || (isExportSale && singleCode === "1300-03") || (!isExportSale && singleCode === "1300-01")) {
            shouldReplaceAccount = true
          }
        } else {
          // If paymentType is Cash but single line is an AR account
          if (isArAccount) {
            shouldReplaceAccount = true
          }
        }

        if (shouldReplaceAccount && expectedDr) {
          return [{
            ...expectedDr,
            amount: grandTotal,
          }]
        }

        return [{
          ...single,
          amount: grandTotal,
        }]
      }
      // For multi-line debit allocations, do NOT scale proportionally while typing; keep user-entered amounts
      return prevDebits
    })

    // 2. Non-destructive Credit lines sync (Revenue & Tax)
    setSiCreditLines((prevCredits) => {
      // Dynamic tax line check: lookup against tax rules or mapped tax accounts
      const activeTaxRules = financeStore.getTaxRules()
      const taxRuleAccountCodes = new Set(
        activeTaxRules.map((r) => (r.accountCode || "").trim().toLowerCase()).filter(Boolean)
      )
      const mappedVatAcc = financeStore.getMappedAccount("sales_vat_output", "2000-05")
      if (mappedVatAcc?.code) taxRuleAccountCodes.add(mappedVatAcc.code.trim().toLowerCase())

      const isTaxLine = (l: SplitLineItem) => {
        const code = (l.accountCode || l.accountId || "").trim().toLowerCase()
        const desc = (l.description || "").toLowerCase()
        const name = (l.accountName || "").toLowerCase()
        return (
          taxRuleAccountCodes.has(code) ||
          code.startsWith("2000-05") ||
          code.startsWith("2000-04") ||
          code.startsWith("2200") ||
          desc.includes("vat") ||
          name.includes("vat") ||
          desc.includes("turnover tax") ||
          name.includes("turnover tax") ||
          desc.includes("tax") ||
          name.includes("tax")
        )
      }

      const revLines = prevCredits.filter((l) => !isTaxLine(l))
      const taxLines = prevCredits.filter((l) => isTaxLine(l))

      let updatedRevLines: SplitLineItem[]
      if (revLines.length <= 1) {
        const singleRev = revLines[0] || def.creditLines[0]
        updatedRevLines = [{
          ...singleRev,
          amount: subtotal,
        }]
      } else {
        // Multi-line revenue: keep user-entered amounts
        updatedRevLines = revLines
      }

      const nextCredits: SplitLineItem[] = [...updatedRevLines]

      if (vatAmount > 0) {
        // Resolve appropriate tax account according to selected tax rule
        const activeRule = activeTaxRules.find((r) => r.id === taxRuleType)
        const targetTaxCode = activeRule?.accountCode || mappedVatAcc?.code || "2000-05"
        const resolvedTaxAcc = resolveAcc(targetTaxCode) || mappedVatAcc

        if (taxLines.length > 0) {
          nextCredits.push({
            ...taxLines[0],
            accountId: taxLines[0].accountId || resolvedTaxAcc?.id || targetTaxCode,
            accountCode: taxLines[0].accountCode || resolvedTaxAcc?.code || targetTaxCode,
            accountName: taxLines[0].accountName || resolvedTaxAcc?.name || activeRule?.name || "Tax Payable",
            amount: vatAmount,
          })
        } else {
          nextCredits.push({
            id: `cr-sale-vat-${Date.now()}`,
            accountId: resolvedTaxAcc?.id || targetTaxCode,
            accountCode: resolvedTaxAcc?.code || targetTaxCode,
            accountName: resolvedTaxAcc?.name || activeRule?.name || "Tax Payable",
            description: activeRule?.name || "Sales Tax Liability",
            amount: vatAmount,
          })
        }
      }

      return nextCredits
    })

    // 3. Non-destructive Section B (COGS & Stock) sync
    setSiCogsDebitLines((prevCogsDr) => {
      if (prevCogsDr.length <= 1) {
        const single = prevCogsDr[0] || def.cogsDebitLines[0]
        const singleCode = (single?.accountCode || single?.accountId || "").trim()
        const expectedDr = def.cogsDebitLines[0]
        const isStockAccInDebit = singleCode.startsWith("1400-") || singleCode.startsWith("1410-")
        const isStandardCogs = singleCode.startsWith("5000-") || singleCode.startsWith("5010-")
        if ((isStockAccInDebit || !isStandardCogs || (expectedDr && singleCode !== (expectedDr.accountCode || expectedDr.accountId))) && expectedDr) {
          return [{ ...expectedDr, amount: itemCostTotal }]
        }
        return [{ ...single, amount: itemCostTotal }]
      }
      return prevCogsDr
    })

    setSiCogsCreditLines((prevCogsCr) => {
      if (prevCogsCr.length <= 1) {
        const single = prevCogsCr[0] || def.cogsCreditLines[0]
        const singleCode = (single?.accountCode || single?.accountId || "").trim()
        const expectedCr = def.cogsCreditLines[0]
        const isCogsAccInCredit = singleCode.startsWith("5000-") || singleCode.startsWith("5010-")
        const isStandardStock = singleCode.startsWith("1400-") || singleCode.startsWith("1410-")
        if ((isCogsAccInCredit || !isStandardStock || (expectedCr && singleCode !== (expectedCr.accountCode || expectedCr.accountId))) && expectedCr) {
          return [{ ...expectedCr, amount: itemCostTotal }]
        }
        return [{ ...single, amount: itemCostTotal }]
      }
      return prevCogsCr
    })
  }, [formOpen, subtotal, vatAmount, grandTotal, warehouseId, paymentType, customerName, items, products, editing, financeStore, isProcessingService])

  const selectableProducts = useMemo(() => {
    if (!warehouseId) return []
    const targetWh = canonicalWarehouseId(warehouseId)
    const targetWhBase = targetWh.split("-")[0].toUpperCase()
    const targetIsWh1 = isWH1(targetWh)

    return products.filter((p) => {
      // 1. Check stock breakdown for warehouse match with qty > 0
      const sbEntry = (p.stockBreakdown || []).find((sb) => {
        if (!sb.warehouse) return false
        const sbCanon = canonicalWarehouseId(sb.warehouse)
        return (
          sb.warehouse === targetWh ||
          sbCanon === targetWh ||
          sb.warehouse.toUpperCase().startsWith(targetWhBase) ||
          sbCanon.toUpperCase().startsWith(targetWhBase)
        )
      })
      if (sbEntry && Number(sbEntry.qty || 0) > 0) return true

      // 2. Check primary product warehouse property
      if (p.warehouse) {
        const prodWhCanon = canonicalWarehouseId(p.warehouse)
        if (
          p.warehouse === targetWh ||
          prodWhCanon === targetWh ||
          p.warehouse.toUpperCase().startsWith(targetWhBase) ||
          prodWhCanon.toUpperCase().startsWith(targetWhBase)
        ) {
          return true
        }
      }

      // 3. WH1 commodities check
      if (targetIsWh1 && isWH1(p.warehouse) && Number(p.quantity || 0) > 0) return true

      return false
    })
  }, [products, warehouseId])

  const handleSave = async () => {
    if (isSaving) return
    const isWh1Active = isWH1(warehouseId) && !isProcessingService
    const errors: Record<string, string> = {}
    if (!fsNo.trim()) errors.fsNo = "FS Number is required."
    if (!saleDate) errors.saleDate = "Sale Date is required."
    if (!customerName.trim()) errors.customer = "Customer Name is required."
    if (!warehouseId) errors.warehouse = "Warehouse selection is required."

    if (isProcessingService && !selectedPsOrder && !editing?.service_order_id) {
      errors.items = "Please select a Processed Service Order to issue delivery."
    }

    if (!isProcessingService) {
      const matchedCust = erp.getCustomers().find((c) => (c.name || "").toLowerCase() === customerName.trim().toLowerCase() || c.id === customerName)
      if (matchedCust) {
        const evaluation = getTradeLicenseStatus(matchedCust, warehouseId)
        if (evaluation.status === "missing" && (!stagedTradePaperUrl || !stagedTradePaperName)) {
          errors.tradePaper = isWh1Active ? "A valid Customer Bank Permit must be attached." : "Trade License file is required."
        } else if (evaluation.status === "expired" && (!stagedTradePaperUrl || !stagedTradePaperName)) {
          errors.tradePaper = "This customer's Trade License has expired. An active permit must be uploaded."
        }
      } else if (!stagedTradePaperUrl || !stagedTradePaperName) {
        errors.tradePaper = isWh1Active ? "Customer Bank Permit is required." : "Trade License is required."
      }
    }

    if (paymentType === "Cash" && !isProcessingService && (!stagedPaymentAdviceUrl || !stagedPaymentAdviceName)) {
      errors.paymentAdvice = "Payment Advice (deposit receipt / bank slip) is mandatory for Cash sales issues."
    }

    const validItems: SalesIssueItem[] = isProcessingService
      ? [
          {
            item_id: "SRV-EXP-PROCESSING",
            item_name: `EXP-WH Processing Fee (${selectedPsOrder?.goods_description || "Toll Commodity"})`,
            batch_id: "N/A",
            batch_no: "N/A",
            packaging_unit: selectedPsOrder?.uom || "Quintal",
            available_quantity: Number(selectedPsOrder?.quantity || 0),
            quantity: Number(selectedPsOrder?.quantity || 0),
            unit_price:
              Number(selectedPsOrder?.quantity || 0) > 0
                ? Math.round((psFeeResult.totalFee / Number(selectedPsOrder?.quantity || 1)) * 100) / 100
                : psFeeResult.totalFee,
            amount: psFeeResult.totalFee,
          },
        ]
      : items.filter((item) => item.item_id && item.quantity > 0)

    if (validItems.length === 0 && !isProcessingService) {
      errors.items = "At least one item with a valid product and quantity > 0 is required."
    } else if (!isWh1Active && !isProcessingService) {
      const hasMissingBatch = validItems.some((item) => !item.batch_no || item.batch_no === "N/A")
      if (hasMissingBatch) {
        errors.items = "Batch selection is required for all veterinary/pharma line items."
      }
    }

    // COA split validation (Section A: Revenue Debits must equal Credits and match Grand Total)
    const drSum = Math.round(siDebitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
    const crSum = Math.round(siCreditLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
    const coaDiff = Math.round(Math.abs(drSum - crSum) * 100) / 100
    if (coaDiff >= 0.01 || Math.abs(drSum - grandTotal) >= 0.01) {
      errors.coaSplit = `Section A (Revenue) split unbalanced. Total Debits (ETB ${drSum.toLocaleString()}) must equal Total Credits (ETB ${crSum.toLocaleString()}) and match Grand Total (ETB ${grandTotal.toLocaleString()}). Difference: ETB ${coaDiff.toFixed(2)}.`
    }

    // Section B (Inventory & COGS) validation (Skipped for processing services)
    if (!isProcessingService) {
      const cogsDrSum = Math.round(siCogsDebitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
      const cogsCrSum = Math.round(siCogsCreditLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
      const cogsDiff = Math.round(Math.abs(cogsDrSum - cogsCrSum) * 100) / 100
      if (cogsDiff >= 0.01) {
        errors.cogsSplit = `Section B (Inventory & COGS) unbalanced. Total COGS Debits (ETB ${cogsDrSum.toLocaleString()}) must equal Total Stock Credits (ETB ${cogsCrSum.toLocaleString()}). Difference: ETB ${cogsDiff.toFixed(2)}.`
      }
    }

    if (Object.keys(errors).length > 0) {
      setIssueFormErrors(errors)
      return
    }
    setIssueFormErrors({})

    const account_entries = {
      revenue_lines: [
        ...siDebitLines.map((l) => ({ ...l, debit: Number(l.amount), credit: 0 })),
        ...siCreditLines.map((l) => ({ ...l, debit: 0, credit: Number(l.amount) })),
      ],
      cogs_lines: [
        ...siCogsDebitLines.map((l) => ({ ...l, debit: Number(l.amount), credit: 0 })),
        ...siCogsCreditLines.map((l) => ({ ...l, debit: 0, credit: Number(l.amount) })),
      ],
      debit_lines: siDebitLines.map((l) => ({ ...l, debit: Number(l.amount), credit: 0 })),
      credit_lines: siCreditLines.map((l) => ({ ...l, debit: 0, credit: Number(l.amount) })),
    }

    const executeSave = async (autoPost: boolean = false) => {
      setIsSaving(true)
      try {
        const isPostedEdit = Boolean(editing && (editing.status || "").toLowerCase() === "posted")
        let issueId = editing?.id
        const resolvedSoId = selectedSoId || (editing as any)?.sales_order_id || (referenceNo.trim().startsWith("SO-") ? referenceNo.trim() : undefined)
        const resolvedPsId = selectedPsId || editing?.service_order_id
        const matchedCust = erp.getCustomers().find((c) => (c.name || "").toLowerCase() === customerName.trim().toLowerCase() || c.id === customerName.trim())
        if (matchedCust && custTin.trim() && matchedCust.tin !== custTin.trim()) {
          void erp.updateCustomer(matchedCust.id, { tin: custTin.trim() }).catch(() => {})
        }

        if (editing) {
          await updateSalesIssue(editing.id, {
            fs_no: fsNo.trim(),
            reference_no: referenceNo.trim() || undefined,
            sales_order_id: resolvedSoId,
            service_order_id: resolvedPsId || undefined,
            issue_type: isProcessingService ? "PROCESSING_SERVICE" : "GOODS",
            sale_date: saleDate,
            customer_id: matchedCust?.id || (editing as any)?.customer_id || undefined,
            customer_name: customerName.trim(),
            customer_tin: custTin.trim() || undefined,
            warehouse_id: canonicalWarehouseId(warehouseId),
            payment_type: paymentType,
            items: validItems,
            subtotal,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            tax_amount: vatAmount,
            total_amount: grandTotal,
            account_entries,
          } as any)

          // Live bidirectional GL sync: update financeStore invoice, journal entries, and COA balances
          try {
            const invId = `INV-SI-${editing.id}`
            const matchedInv = financeStore.getInvoices().find(
              (i) => i.id === invId || i.sales_issue_id === editing.id || (editing.fs_no && i.fs_no === editing.fs_no)
            )
            if (matchedInv) {
              await financeStore.updateInvoiceGLDistribution(matchedInv.id, {
                revenueLines: account_entries.revenue_lines as any,
                cogsLines: account_entries.cogs_lines as any,
                notes: `Updated from Sales Issue Edit (${fsNo.trim()})`,
              })
            }
          } catch (syncErr) {
            console.warn("Live finance sync warning:", syncErr)
          }
        } else {
          const created = await createSalesIssue({
            fs_no: fsNo.trim(),
            reference_no: referenceNo.trim() || undefined,
            sales_order_id: resolvedSoId,
            service_order_id: resolvedPsId || undefined,
            issue_type: isProcessingService ? "PROCESSING_SERVICE" : "GOODS",
            sale_date: saleDate,
            customer_id: matchedCust?.id || undefined,
            customer_name: customerName.trim(),
            customer_tin: custTin.trim() || undefined,
            warehouse_id: canonicalWarehouseId(warehouseId),
            payment_type: paymentType,
            items: validItems,
            subtotal,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            tax_amount: vatAmount,
            total_amount: grandTotal,
            account_entries,
          } as any)
          issueId = created.id
        }

        if (resolvedPsId) {
          try {
            await transitionProcessingServiceStage(resolvedPsId, "Delivered", {
              processingFee: psFeeResult.processingFee,
              storageFee: psFeeResult.storageFee,
              totalFee: psFeeResult.totalFee,
              storageDays: psFeeResult.daysInStorage,
              salesIssueId: issueId,
              fsNo: fsNo.trim(),
              deliveredDate: saleDate || getLocalDateString(),
            })
          } catch (psErr) {
            console.warn("Processing service delivery transition notice:", psErr)
          }
        }

        if (issueId && stagedTradePaperName && stagedTradePaperUrl) {
          try {
            await saveTradeLicense({
              salesIssueId: issueId,
              salesOrderId: resolvedSoId || referenceNo.trim() || undefined,
              customerName: customerName.trim() || undefined,
              fileName: stagedTradePaperName,
              fileUrl: stagedTradePaperUrl,
              documentType: isWh1Active ? "Bank Permit" : "Trade License",
              uploadedBy: "Sales Officer",
            })
          } catch (docErr) {
            console.warn("Trade document upload notice:", docErr)
          }
        }

        if (issueId && stagedPaymentAdviceName && stagedPaymentAdviceUrl) {
          try {
            await savePaymentAdvice({
              salesIssueId: issueId,
              salesOrderId: resolvedSoId || referenceNo.trim() || undefined,
              fsNo: fsNo.trim(),
              invoiceId: `INV-SI-${issueId}`,
              fileName: stagedPaymentAdviceName,
              fileUrl: stagedPaymentAdviceUrl,
              uploadedBy: "Sales Officer",
            })
          } catch (docErr) {
            console.warn("Payment advice upload notice:", docErr)
          }
        }

        if (autoPost && issueId) {
          let postSucceeded = false
          try {
            const res = await postSalesIssue(issueId)
            if ((res as any)?.status >= 400 || (res as any)?.error) {
              throw new Error((res as any)?.error || "Could not auto-post sales issue.")
            }
            postSucceeded = true
          } catch (postErr) {
            showToast(
              "Saved as Draft (Posting Notice)",
              "warning",
              postErr instanceof Error ? postErr.message : "Sales issue saved, but posting encountered an issue."
            )
          }

          if (postSucceeded) {
            try {
              if (resolvedSoId) {
                erp.updateSalesOrderStage(resolvedSoId, "Shipped")
              }
              await erp.reloadFromApi()
              await financeStore.reloadFromApi()
            } catch (reloadErr) {
              console.warn("Background sync warning after post:", reloadErr)
            }
            showToast(
              "Sales Issue Created & Posted",
              "success",
              `Sales issue ${fsNo.trim()} created and posted. Stock deducted and balanced journals generated.`
            )
          }
        } else {
          if (resolvedSoId) {
            erp.updateSalesOrderStage(resolvedSoId, "Shipped")
          }
          try {
            await erp.reloadFromApi()
            await financeStore.reloadFromApi()
          } catch (reloadErr) {
            console.warn("Background sync warning after edit save:", reloadErr)
          }
          showToast(
            "Sales Issue Saved",
            "success",
            isPostedEdit
              ? `Sales issue ${fsNo} terms updated to ${paymentType}.`
              : `Sales issue ${fsNo} saved successfully.`
          )
        }

        setFormOpen(false)
        await load()
      } catch (err) {
        showToast("Save failed", "warning", err instanceof Error ? err.message : "Could not save sales issue.")
      } finally {
        setIsSaving(false)
      }
    }

    if (!editing) {
      if (isSaving) return
      confirm({
        title: `Create & Post Sales Issue ${fsNo.trim()}?`,
        message: `Are you sure you want to create and immediately post Sales Issue ${fsNo.trim()} for ${customerName.trim()} (Total: ETB ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})? This will deduct batch stock from the warehouse, fulfill sales orders, and post balanced journal entries.`,
        confirmLabel: "Create & Post",
        onConfirm: () => executeSave(true),
      })
    } else {
      executeSave(false)
    }
  }

  const doPost = (issue: SalesIssue) => {
    confirm({
      title: `Post Sales Issue ${issue.fs_no || issue.id}?`,
      message: "Posting reduces batch stock and creates balanced journal entries. This can happen only once.",
      confirmLabel: "Post",
      onConfirm: async () => {
        try {
          const res = await postSalesIssue(issue.id || issue.fs_no)
          if ((res as any)?.status >= 400 || (res as any)?.error) {
            throw new Error((res as any)?.error || "Could not post sales issue.")
          }
          const refStr = issue.reference_no || ""
          const matchingOrders = salesOrders.filter((so) => 
            (issue.sales_order_id && issue.sales_order_id === so.id) ||
            (refStr && (refStr.includes(so.id) || refStr === so.id))
          )
          matchingOrders.forEach((so) => {
            erp.updateSalesOrderStage(so.id, "Shipped")
          })

          showToast("Sales issue posted", "success", `${issue.fs_no || issue.id} posted, inventory stock reduced, and linked Sales Orders fulfilled.`)
          await erp.reloadFromApi()
          await financeStore.reloadFromApi()
          await load()
        } catch (err) {
          showToast("Posting failed", "warning", err instanceof Error ? err.message : "Could not post sales issue.")
        }
      },
    })
  }

  const doDelete = (issue: SalesIssue) => {
    confirm({
      title: "Delete Draft?",
      message: `Delete ${issue.fs_no || issue.id}? Only draft records can be deleted.`,
      isDestructive: true,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await deleteSalesIssue(issue.id || issue.fs_no)
        showToast("Draft deleted", "success", `${issue.fs_no || issue.id} removed.`)
        await load()
      },
    })
  }

  const salesTable = useResizableTable<SalesIssue>(salesIssueColumns, rows, {
    fs_no: 110,
    reference_no: 120,
    sale_date: 100,
    item: 160,
    customer_name: 160,
    payment_status: 170,
    total_quantity: 90,
    unit_price: 100,
    total_amount: 120,
    _actions: 280,
  })

  const isPostedEditing = Boolean(editing && (editing.status || "").toLowerCase() === "posted")

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <main className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Sales Issued</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">Record, track partial credit installments, and manage issued sales transactions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("/sales")} />
          </div>
        </div>

        <GlassCard className="p-0 overflow-hidden border border-white/65 shadow-md">
          <div className="px-6 pt-6">
            <FinanceTableToolbar
              title="Issued Sales Register"
              subtitle={`${total} records from the sales issue register`}
              searchValue={search}
              onSearchChange={(value) => { setSearch(value); setPage(1) }}
              searchPlaceholder="Search FS, reference, item, customer, batch..."
              filters={[
                { value: batchFilter, onChange: setBatchFilter, ariaLabel: "Batch", options: [{ value: "ALL", label: "All Batches" }, ...batchFilters.map((b) => ({ value: b, label: b }))] },
              ]}
              actions={[
                {
                  label: "Add Sales Issue",
                  onClick: openCreate,
                  icon: <Plus className="size-4" />,
                  variant: "primary",
                },
              ]}
              onReload={load}
              isReloading={loading}
              reloadTooltip="Reload sales issue register from server"
            />
          </div>

          {error && <div className="mx-6 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{error}</div>}

          <TableScrollWrapper>
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                  {salesIssueColumns.map((col) => (
                    <ResizableTh
                      key={col.key}
                      col={col}
                      width={salesTable.colWidths[col.key] || 120}
                      sortKey={salesTable.sortKey}
                      sortDir={salesTable.sortDir}
                      openMenuCol={salesTable.openMenuCol}
                      onResizeStart={salesTable.handleResizeStart}
                      onToggleMenu={salesTable.toggleMenu}
                      onSortAsc={salesTable.setSortAsc}
                      onSortDesc={salesTable.setSortDesc}
                      onClearSort={salesTable.clearSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {loading ? (
                  <SalesIssuedSkeletonRows />
                ) : salesTable.sorted().length === 0 ? (
                  <tr><td colSpan={salesIssueColumns.length} className="py-16 text-center text-xs font-bold text-zinc-400">No sales issued records match your filters.</td></tr>
                ) : salesTable.sorted().map((row) => {
                  const isCredit = (row.payment_type || (row as any).paymentType || "").toString().toLowerCase().includes("credit")
                  const isCash = !isCredit
                  const matchingInvoice = financeStore.getInvoices().find(
                    (inv) =>
                      inv.sales_issue_id === row.id ||
                      inv.id === `INV-SI-${row.id}` ||
                      (row.fs_no && (inv.fs_no === row.fs_no || inv.invoice_number?.includes(row.fs_no))) ||
                      (row.reference_no && (inv.sales_order_id === row.reference_no || inv.invoice_number?.includes(row.reference_no)))
                  )
                  const paymentsForIssue = financeStore.getPaymentsForSalesIssue(row.id, row.fs_no, row.reference_no)
                  const totalAmt = Number(row.total_amount || matchingInvoice?.total || 0)
                  const paidFromPayments = paymentsForIssue.reduce((s, p) => s + Number(p.amount || 0), 0)
                  const paidAmt = isCash ? totalAmt : Math.max(Number(row.amount_paid || 0), Number(matchingInvoice?.amount_paid || 0), paidFromPayments)
                  const dueAmt = isCash ? 0 : Number(Math.max(0, totalAmt - paidAmt).toFixed(2))
                  const pct = totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : (isCash ? 100 : 0)
                  const isFullySettled = isCash || (totalAmt > 0 && dueAmt <= 0.01 && paidAmt > 0) || row.settlement_status === "Fully Settled" || row.payment_status === "Paid" || matchingInvoice?.status === "Paid" || matchingInvoice?.settlement_status === "Fully Settled"

                  return (
                    <tr key={row.id} className="border-b border-zinc-150/40 hover:bg-zinc-50/60 transition-colors text-xs">
                      <td style={{ width: `${salesTable.colWidths.fs_no}px` }} className="px-3 py-3 font-mono text-xs font-black text-zinc-950 truncate">{row.fs_no}</td>
                      <td style={{ width: `${salesTable.colWidths.reference_no}px` }} className="px-3 py-3 font-mono text-xs font-bold text-zinc-700 truncate">{row.reference_no}</td>
                      <td style={{ width: `${salesTable.colWidths.sale_date}px` }} className="px-3 py-3 text-xs font-bold text-zinc-700 truncate">{formatDate(row.sale_date)}</td>
                      <td style={{ width: `${salesTable.colWidths.item}px` }} className="px-3 py-3 text-xs font-black text-zinc-900 truncate">{row.items?.[0]?.item_name || "Multiple items"}</td>
                      <td style={{ width: `${salesTable.colWidths.customer_name}px` }} className="px-3 py-3 text-xs font-bold text-zinc-700 truncate">{row.customer_name}</td>
                      
                      {/* Payment & Settlement Status */}
                      <td style={{ width: `${salesTable.colWidths.payment_status}px` }} className="px-3 py-3">
                        {isCash ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Cash
                          </span>
                        ) : isFullySettled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="size-3 text-emerald-600" /> Credit • Fully Settled
                          </span>
                        ) : paidAmt > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 self-start">
                              Credit • Ongoing ({pct}%)
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              Paid: {money(paidAmt)} • Due: {money(dueAmt)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 self-start">
                              Credit • Unpaid (0%)
                            </span>
                            <span className="text-[10px] font-mono text-rose-600 font-bold">
                              Due: {money(dueAmt || totalAmt)}
                            </span>
                          </div>
                        )}
                      </td>

                      <td style={{ width: `${salesTable.colWidths.total_quantity}px` }} className="px-3 py-3 text-right font-mono text-xs font-black truncate">
                        {Number(row.total_quantity).toLocaleString()}{row.items?.[0]?.packaging_unit ? ` ${row.items[0].packaging_unit}` : ""}
                      </td>
                      <td style={{ width: `${salesTable.colWidths.unit_price}px` }} className="px-3 py-3 text-right font-mono text-xs font-bold truncate">{money(row.items?.[0]?.unit_price || 0)}</td>
                      <td style={{ width: `${salesTable.colWidths.total_amount}px` }} className="px-3 py-3 text-right font-mono text-xs font-black truncate">{money(row.total_amount)}</td>
                      <td style={{ width: `${salesTable.colWidths._actions}px` }} className="py-4 px-2 text-center whitespace-nowrap overflow-hidden">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap" onClick={(e) => e.stopPropagation()}>
                          {!isCash && dueAmt > 0 && (
                            <button
                              type="button"
                              onClick={() => openRecordPayment(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-2xs cursor-pointer"
                              title="Record Payment Installment"
                            >
                              <Receipt className="size-3 text-emerald-700" /> Pay
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={row.status === "Cancelled"}
                            onClick={() => void openEdit(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
                            title="Edit Sales Issue"
                          >
                            <Pencil className="size-3 text-zinc-700" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintingIssue(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="Export Sales Issue Voucher"
                          >
                            <Download className="size-3 text-zinc-700" /> Export
                          </button>
                          {row.status === "Draft" && (
                            <button
                              type="button"
                              onClick={() => doPost(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-2xs cursor-pointer"
                              title="Post and deduct stock"
                            >
                              <Send className="size-3 text-emerald-700" /> Post
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScrollWrapper>

          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 px-6 py-4 bg-white/40 gap-3">
            <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
              <span>
                Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
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
                disabled={page === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
              >
                Previous
              </button>
              <span className="text-xs font-black text-zinc-700 px-2 font-mono">
                Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <button
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </GlassCard>
      </main>

      {/* MODAL 1: ADD / EDIT SALES ISSUE */}
      {formOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <BodyScrollLock />
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl">
              {editing ? (
                <EditModalHeader
                  title={isPostedEditing ? `Edit Posted Sales Issue (${editing.fs_no})` : `Edit Sales Issue (${editing.fs_no})`}
                  subtitle={isPostedEditing ? "Stock balances are locked. Update reference documentation and notes." : "Amount is calculated automatically per row."}
                  onClose={() => setFormOpen(false)}
                  onRequestDelete={editing.status === "Draft" ? () => doDelete(editing) : undefined}
                  deleteLabel="Delete Sales Issue"
                />
              ) : (
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-black text-zinc-950">Add Sales Issue</h2>
                    <p className="text-xs font-semibold text-zinc-500">Amount is calculated automatically per row.</p>
                  </div>
                  <button onClick={() => setFormOpen(false)} className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-100 transition-colors">
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {/* FINANCIAL SUMMARY & SETTLEMENT KPI CARD FOR EDITING (CREDIT ONLY) */}
              {editing && (editing.payment_type || "Cash") === "Credit" && (
                (() => {
                  const issuePayments = financeStore.getPaymentsForSalesIssue(editing.id)
                  const totalAmt = Number(editing.total_amount || 0)
                  const paidAmt = issuePayments.reduce((s, p) => s + p.amount, 0) || Number(editing.amount_paid || 0)
                  const dueAmt = Number(Math.max(0, totalAmt - paidAmt).toFixed(2))
                  const pct = totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0
                  const isCredit = true

                  return (
                    <div className="mb-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Financial Settlement Progress</span>
                          <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                            Terms: <span className={isCredit ? "text-zinc-900" : "text-emerald-700"}>{editing.payment_type}</span>
                            {isCredit && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                dueAmt <= 0 ? "bg-emerald-100 text-emerald-800" : paidAmt > 0 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                              }`}>
                                {dueAmt <= 0 ? "Fully Settled (100%)" : paidAmt > 0 ? `Ongoing (${pct}%)` : "Unpaid (0%)"}
                              </span>
                            )}
                          </h4>
                        </div>
                        {isCredit && dueAmt > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormOpen(false)
                              openRecordPayment(editing)
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto transition-colors"
                          >
                            <Receipt className="size-3.5" /> Record Installment
                          </button>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${dueAmt <= 0 ? "bg-emerald-600" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Invoiced</span>
                          <span className="font-mono text-xs font-black text-zinc-900">ETB {money(totalAmt)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase block">Total Paid ({pct}%)</span>
                          <span className="font-mono text-xs font-black text-emerald-700">ETB {money(paidAmt)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-rose-600 uppercase block">Remaining Due</span>
                          <span className="font-mono text-xs font-black text-rose-700">ETB {money(dueAmt)}</span>
                        </div>
                      </div>

                      {/* Payment Installments Timeline */}
                      {issuePayments.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200/80">
                          <span className="text-[10px] font-black uppercase text-zinc-400 block mb-2">Recorded Installment History ({issuePayments.length}):</span>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {issuePayments.map((p, idx) => (
                              <div key={p.id || idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-zinc-200">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] font-black bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                                    #{p.installment_no || idx + 1}
                                  </span>
                                  <span className="font-bold text-zinc-800">{p.date}</span>
                                  <span className="text-zinc-500 font-mono text-[11px]">({p.reference})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-black text-emerald-700">ETB {money(p.amount)}</span>
                                  {p.payment_advice_url && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewDocUrl(p.payment_advice_url!)
                                        setPreviewDocName(p.payment_advice_filename || "Payment Slip")
                                      }}
                                      className="text-emerald-700 font-bold hover:underline text-[11px] cursor-pointer"
                                    >
                                      View Slip ↗
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}

              {/* PROCESSED SERVICES PULL SELECTOR (Only in create mode) */}
              {!editing && pullableProcessedServices.length > 0 && (
                <div className="mb-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block">
                        Pull from Ready Processed Services ({pullableProcessedServices.length} available)
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-500 block mt-0.5">
                        Selecting a processed order auto-populates Customer, Reference, EXP-WH Processing, and Fee calculations.
                      </span>
                    </div>
                    {selectedPsId && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        1 service order selected
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {pullableProcessedServices.map((ps) => {
                      const isSelected = selectedPsId === ps.id
                      return (
                        <button
                          key={ps.id}
                          type="button"
                          onClick={() => void handleSelectPullProcessingService(ps)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-emerald-700 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/20" 
                              : "bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          <div>
                            <div className="font-bold font-mono text-xs flex items-center gap-1.5 flex-wrap">
                              {ps.reference_number || ps.id} • {ps.client_company_name}
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                isSelected ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"
                              }`}>
                                Processed
                              </span>
                            </div>
                            <div className={`text-[10px] mt-0.5 ${isSelected ? "text-emerald-100" : "text-zinc-500"}`}>
                              {ps.goods_description} • {ps.quantity} {ps.uom || "Quintal"} • Entry: {formatDate(ps.entry_date)}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* SALES ORDER PULL SELECTOR (Only in create mode) */}
              {!editing && (fulfillableOrders.length > 0 || lockedOrders.length > 0) && (
                <div className="mb-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block">
                        Pull from Approved Sales Orders ({fulfillableOrders.length} available)
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-500 block mt-0.5">
                        Selecting an approved order auto-populates Customer, Warehouse, Items, and Payment Terms.
                      </span>
                    </div>
                    {selectedSoId && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        1 order selected
                      </span>
                    )}
                  </div>

                  {/* Fulfillable Orders (Single Selection) */}
                  {fulfillableOrders.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {fulfillableOrders.map((so) => {
                        const isSelected = selectedSoId === so.id
                        const isCredit = so.paymentType === "Credit"
                        return (
                          <button
                            key={so.id}
                            type="button"
                            onClick={() => void handleSelectPullSalesOrder(so)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                              isSelected 
                                ? "bg-emerald-700 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/20" 
                                : "bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-100"
                            }`}
                          >
                            <div>
                              <div className="font-bold font-mono text-xs flex items-center gap-1.5 flex-wrap">
                                {so.id} • {so.customer}
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                  isSelected 
                                    ? "bg-white/20 text-white" 
                                    : (isCredit ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800")
                                }`}>
                                  {isCredit ? "Credit" : "Cash"}
                                </span>
                              </div>
                              <div className={`text-[10px] mt-0.5 ${isSelected ? "text-emerald-100" : "text-zinc-500"}`}>
                                {so.warehouse} • ETB {Number(so.amount || 0).toLocaleString()} ({so.items.length} items)
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Locked Orders (Pending Approval or Missing Files) */}
                  {lockedOrders.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/80 space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                        Locked Orders — Cannot Fulfill Yet ({lockedOrders.length})
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1">
                        {lockedOrders.map((so) => (
                          <div
                            key={so.id}
                            className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-100/70 text-zinc-400 text-xs flex items-center justify-between opacity-75"
                            title={`Locked: ${so.lockReason}`}
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono font-bold text-zinc-600 block truncate">{so.id} • {so.customer}</span>
                              <span className="text-[10px] text-zinc-400 block">{so.warehouse}</span>
                            </div>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0 inline-flex items-center gap-1">
                              <Lock className="size-3 text-amber-700 shrink-0" />
                              <span>{so.lockReason}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HEADER FIELDS */}
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-zinc-500">FS No *</span>
                  <input 
                    value={fsNo} 
                    onChange={(e) => {
                      setFsNo(e.target.value)
                      setIssueFormErrors((prev) => {
                        const next = { ...prev }
                        delete next.fsNo
                        return next
                      })
                    }} 
                    className={`h-10 w-full rounded-xl border px-3 font-mono text-xs font-black transition-colors ${
                      issueFormErrors.fsNo ? "border-rose-400 bg-rose-50 text-rose-900" : "border-zinc-200 bg-white"
                    }`} 
                    placeholder="FS-2026-XXXX" 
                  />
                  {issueFormErrors.fsNo && (
                    <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                      ⚠️ {issueFormErrors.fsNo}
                    </span>
                  )}
                </label>
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Reference / SO No</span>
                  <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-xs font-bold" placeholder="REF-XXXX or SO-XXXX" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Date *</span>
                  <input 
                    type="date" 
                    value={saleDate} 
                    onChange={(e) => {
                      setSaleDate(e.target.value)
                      setIssueFormErrors((prev) => {
                        const next = { ...prev }
                        delete next.saleDate
                        return next
                      })
                    }} 
                    className={`h-10 w-full rounded-xl border px-3 text-xs font-bold transition-colors ${
                      issueFormErrors.saleDate ? "border-rose-400 bg-rose-50 text-rose-900" : "border-zinc-200 bg-white"
                    }`} 
                  />
                  {issueFormErrors.saleDate && (
                    <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                      ⚠️ {issueFormErrors.saleDate}
                    </span>
                  )}
                </label>
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Customer Name *</span>
                  <input 
                    list="customer-issue-suggestions"
                    disabled={isPostedEditing}
                    value={customerName} 
                    onChange={(e) => {
                      const val = e.target.value
                      setCustomerName(val)
                      const match = erp.getCustomers().find((c) => (c.name || "").toLowerCase() === val.trim().toLowerCase() || c.id === val.trim())
                      if (match?.tin) {
                        setCustTin(match.tin)
                      }
                      setIssueFormErrors((prev) => {
                        const next = { ...prev }
                        delete next.customer
                        return next
                      })
                    }} 
                    className={`h-10 w-full rounded-xl border px-3 text-xs font-bold transition-colors ${
                      issueFormErrors.customer ? "border-rose-400 bg-rose-50 text-rose-900" : "border-zinc-200 bg-white"
                    }`} 
                    placeholder="Customer name" 
                  />
                  <datalist id="customer-issue-suggestions">
                    {erp.getCustomers().map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  {issueFormErrors.customer && (
                    <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                      ⚠️ {issueFormErrors.customer}
                    </span>
                  )}
                </label>
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Warehouse *</span>
                  <select 
                    disabled={isPostedEditing} 
                    value={warehouseId} 
                    onChange={(e) => { 
                      const wh = e.target.value
                      setWarehouseId(wh)
                      if (wh === "EXP-WH Processing" || wh === "EXP-WH-PS") {
                        setPaymentType("Cash")
                      } else if (isWH1(wh)) {
                        setSelectedPsId(null)
                        setSelectedPsOrder(null)
                        setPaymentType("Credit")
                        setItems([blankItem("Quintal")])
                      } else {
                        setSelectedPsId(null)
                        setSelectedPsOrder(null)
                        setPaymentType("Cash")
                        setItems([blankItem("Box")])
                      }
                      setIssueFormErrors((prev) => {
                        const next = { ...prev }
                        delete next.warehouse
                        return next
                      })
                    }} 
                    className={`h-10 w-full rounded-xl border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:bg-zinc-100 cursor-pointer transition-colors ${
                      issueFormErrors.warehouse ? "border-rose-400 bg-rose-50 text-rose-900" : "border-zinc-200 bg-white"
                    }`}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    <option value="EXP-WH Processing">EXP-WH Processing</option>
                  </select>
                  {issueFormErrors.warehouse && (
                    <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                      ⚠️ {issueFormErrors.warehouse}
                    </span>
                  )}
                </label>
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Payment Terms *</span>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold cursor-pointer"
                  >
                    <option value="Credit">Credit</option>
                    <option value="Cash">Cash</option>
                  </select>
                </label>
              </div>

              {/* DOCUMENTATION & PAYMENT ADVICE ATTACHMENTS */}
              {(() => {
                const isWh1Active = isWH1(warehouseId) && !isProcessingService
                const docLabel = isWh1Active ? "Customer Bank Permit" : "Customer Trade License"
                return (
                  <div className="mt-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-800 block">
                          {isProcessingService 
                            ? "Processing Service Agreement & Documentation" 
                            : isWh1Active 
                              ? "Order Bank Permit & Proof of Payment" 
                              : "Order Documentation & Payment Advice"}
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-500 block mt-0.5">
                          {isProcessingService
                            ? "Client toll processing service agreement on file"
                            : paymentType === "Cash"
                              ? (isWh1Active 
                                  ? "Payment Advice receipt is mandatory for Cash export sales issues" 
                                  : "Payment Advice is mandatory / recommended for Cash sales proof")
                              : (isWh1Active 
                                  ? "Bank Permit is attached for this credit export issue (Payment Advice is hidden)"
                                  : "Payment Advice can be attached anytime when recording partial installments")}
                        </span>
                      </div>
                    </div>

                    <div className={`grid gap-3 ${paymentType === "Cash" && !isProcessingService ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                      <div className={`p-3 rounded-xl border shadow-sm space-y-1.5 transition-colors ${
                        issueFormErrors.tradePaper 
                          ? "bg-rose-50/40 border-rose-400" 
                          : "bg-white border-zinc-200"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                            <FileText className="size-3.5 text-emerald-600" /> {isProcessingService ? "Processing Agreement / Contract" : docLabel}
                          </span>
                          {stagedTradePaperName ? (
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Attached
                            </span>
                          ) : isDocsLoading ? (
                            <Skeleton className="h-4 w-16 bg-zinc-200/80 rounded-full" />
                          ) : (
                            <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                              Not on file
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1 text-xs">
                          {isDocsLoading && !stagedTradePaperName ? (
                            <div className="flex items-center justify-between w-full">
                              <Skeleton className="h-4 w-44 bg-zinc-200/80 rounded-md" />
                              <Skeleton className="h-6 w-16 bg-zinc-200/80 rounded-md" />
                            </div>
                          ) : (
                            <>
                              <span className="text-[11px] font-mono text-zinc-600 truncate">
                                {stagedTradePaperName || "No file attached from order"}
                              </span>
                              {stagedTradePaperUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewDocUrl(stagedTradePaperUrl)
                                    setPreviewDocName(stagedTradePaperName || docLabel)
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md inline-flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  View Doc <ExternalLink className="size-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {issueFormErrors.tradePaper && (
                          <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                            ⚠️ {issueFormErrors.tradePaper}
                          </span>
                        )}
                      </div>

                      {/* Payment Advice Dropzone - Shown when Cash and not processing */}
                      {(paymentType === "Cash" || Boolean(stagedPaymentAdviceName || stagedPaymentAdviceUrl || (editing && (editing.payment_type || "Cash") === "Credit"))) && !isProcessingService && (
                        <div className={`p-3 rounded-xl border shadow-sm space-y-1.5 transition-colors ${
                          issueFormErrors.paymentAdvice 
                            ? "bg-rose-50/40 border-rose-400" 
                            : "bg-white border-zinc-200"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                              <CheckCircle2 className="size-3.5 text-emerald-600" /> Payment Advice Receipt
                            </span>
                            {stagedPaymentAdviceName ? (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                Attached
                              </span>
                            ) : isDocsLoading ? (
                              <Skeleton className="h-4 w-16 bg-zinc-200/80 rounded-full" />
                            ) : paymentType === "Cash" ? (
                              <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                Required for Cash
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                                Optional / Settled Slip
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            {isDocsLoading && !stagedPaymentAdviceName ? (
                              <div className="flex items-center gap-2 w-full">
                                <Skeleton className="h-7 w-24 bg-zinc-200/80 rounded-lg" />
                                <Skeleton className="h-4 flex-1 bg-zinc-200/80 rounded-md" />
                              </div>
                            ) : (
                              <>
                                <label className="cursor-pointer px-3 py-1 rounded-lg bg-zinc-900 text-white font-bold text-[11px] hover:bg-zinc-800 flex items-center gap-1 shrink-0">
                                  <Upload className="size-3" /> Select File
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0]
                                      if (f) {
                                        try {
                                          const uploadRes = await uploadFile(f, "sales_issued")
                                          setStagedPaymentAdviceName(uploadRes.originalName || f.name)
                                          setStagedPaymentAdviceUrl(uploadRes.url)
                                          setIssueFormErrors((prev) => {
                                            const next = { ...prev }
                                            delete next.paymentAdvice
                                            return next
                                          })
                                        } catch (err) {
                                          console.warn("Payment advice upload failed:", err)
                                          showToast("Upload Failed", "warning", "Could not upload payment advice.")
                                        }
                                      }
                                    }}
                                  />
                                </label>
                                <span className="text-[11px] font-mono text-zinc-600 truncate flex-1">
                                  {stagedPaymentAdviceName || "No slip uploaded"}
                                </span>
                              </>
                            )}
                            {stagedPaymentAdviceUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocUrl(stagedPaymentAdviceUrl)
                                  setPreviewDocName(stagedPaymentAdviceName || "Payment Advice")
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                View Doc <ExternalLink className="size-3" />
                              </button>
                            )}
                          </div>
                          {issueFormErrors.paymentAdvice && (
                            <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                              ⚠️ {issueFormErrors.paymentAdvice}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* ITEM ROWS / EXP-WH PROCESSING FEE BREAKDOWN CARD */}
              <div className="mt-6 space-y-3">
                {isProcessingService ? (
                  /* EXP-WH Processing Fee Breakdown Card */
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4 font-sans">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                            EXP-WH Processing & Storage Billing Breakdown
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Toll Service Delivery
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-zinc-500 mt-0.5">
                          Toll processing of client-owned grain. Inventory COGS derecognition is 0 ETB (Section B hidden).
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Calculation Date:</span>
                        <input
                          type="date"
                          disabled={isPostedEditing}
                          value={psCalcDate}
                          onChange={(e) => setPsCalcDate(e.target.value)}
                          className="px-2.5 py-1 rounded-xl bg-white border border-zinc-200 font-mono font-bold text-xs outline-none focus:border-emerald-600 shadow-2xs"
                        />
                        <button
                          type="button"
                          disabled={isPostedEditing}
                          onClick={() => setPsCalcDate(getLocalDateString())}
                          className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold transition-colors border border-emerald-200 cursor-pointer"
                        >
                          Today
                        </button>
                      </div>
                    </div>

                    {/* Service Order Selector if none is pre-selected */}
                    {!selectedPsOrder && (
                      <div className="p-3 rounded-xl bg-white border border-amber-300 shadow-2xs space-y-2">
                        <span className="text-xs font-black text-amber-900 block">Select Processed Service Order:</span>
                        <select
                          value={selectedPsId || ""}
                          onChange={(e) => {
                            const found = processedServices.find((p) => p.id === e.target.value)
                            if (found) {
                              void handleSelectPullProcessingService(found)
                            }
                          }}
                          className="w-full h-10 px-3 rounded-xl border border-zinc-200 text-xs font-bold bg-zinc-50 outline-none"
                        >
                          <option value="">-- Choose Ready Processed Order --</option>
                          {processedServices
                            .filter((p) => p.status === "Processed" || p.status === "Delivered")
                            .map((ps) => (
                              <option key={ps.id} value={ps.id}>
                                {ps.reference_number || ps.id} — {ps.client_company_name} ({ps.goods_description}, {ps.quantity} {ps.uom || "Quintal"})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {selectedPsOrder && (
                      <div className="space-y-3">
                        {/* Yield & Defect Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                          <div className="p-3 rounded-xl bg-white border border-zinc-200">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase block">Gross Input Qty</span>
                            <span className="font-mono text-xs font-black text-zinc-900">
                              {Number(selectedPsOrder.quantity || 0).toLocaleString()} {selectedPsOrder.uom || "Quintal"}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-zinc-200">
                            <span className="text-[10px] font-bold text-amber-700 uppercase block">Screened Defect Loss</span>
                            <span className="font-mono text-xs font-black text-amber-800">
                              {Number(selectedPsOrder.reject_quantity || 0) > 0
                                ? `${Number(selectedPsOrder.reject_quantity).toLocaleString()} ${selectedPsOrder.uom || "Quintal"}${selectedPsOrder.reject_reason ? ` (${selectedPsOrder.reject_reason})` : ""}`
                                : "0 Quintal (None)"}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Net Deliverable Yield</span>
                            <span className="font-mono text-xs font-black text-emerald-800">
                              {(
                                Number(selectedPsOrder.quantity || 0) - Number(selectedPsOrder.reject_quantity || 0)
                              ).toLocaleString()} {selectedPsOrder.uom || "Quintal"}
                            </span>
                          </div>
                        </div>

                        {/* Fee Statement Details */}
                        <div className="p-4 rounded-xl bg-white border border-zinc-200 font-mono text-xs space-y-3">
                          {/* Processing Fee Line */}
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                            <div>
                              <span className="font-bold text-zinc-800">Milling & Cleaning Fee:</span>
                              <span className="text-[11px] text-zinc-500 block">
                                {Number(selectedPsOrder.locked_processing_rate ?? psRates.processingRatePerQuintal)} ETB/Quintal × {Number(selectedPsOrder.quantity || 0)} Quintals
                              </span>
                            </div>
                            <span className="font-black text-zinc-950 text-sm">
                              ETB {money(psFeeResult.processingFee)}
                            </span>
                          </div>

                          {/* Storage Fee Line & Tiered Breakdown */}
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-zinc-800">
                                  Warehousing Storage Fee ({psFeeResult.daysInStorage} Days):
                                </span>
                                <span className="text-[10px] text-zinc-500 block">
                                  Entry Date: {formatDate(selectedPsOrder.entry_date)} → Cutoff: {formatDate(psCalcDate)}
                                </span>
                              </div>
                              <span className="font-black text-zinc-950 text-sm">
                                ETB {money(psFeeResult.storageFee)}
                              </span>
                            </div>

                            {psFeeResult.storageFeeBreakdown.length > 0 ? (
                              <div className="pl-3 border-l-2 border-emerald-400 space-y-1 py-1 text-[11px]">
                                {psFeeResult.storageFeeBreakdown.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-zinc-600">
                                    <span>
                                      {item.monthLabel}: {Number(item.ratePerQuintalDay) === 0 ? "0 ETB (Free Period)" : `${item.ratePerQuintalDay} ETB/day`} × {item.daysInMonth} days
                                    </span>
                                    <span className="font-bold text-zinc-900 font-mono">
                                      ETB {money(item.monthTotal)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-400 pl-3 border-l-2 border-zinc-200">
                                Within initial storage window (0 ETB storage fee).
                              </div>
                            )}
                          </div>

                          {/* Subtotal Statement Banner */}
                          <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-xs font-black text-emerald-900 font-sans">
                            <span>Statement Subtotal (excl. tax):</span>
                            <span className="text-sm font-mono text-emerald-800">
                              ETB {money(psFeeResult.totalFee)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          {isPostedEditing ? "Item Rows (Locked)" : "Item Rows"}
                        </h3>
                        {issueFormErrors.items && (
                          <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                            ⚠️ {issueFormErrors.items}
                          </span>
                        )}
                      </div>
                      {!isPostedEditing && (
                        <button 
                          onClick={() => {
                            setItems((current) => [...current, blankItem(isWH1(warehouseId) ? "Quintal" : "Box")])
                            setIssueFormErrors((prev) => {
                              const next = { ...prev }
                              delete next.items
                              return next
                            })
                          }} 
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-black cursor-pointer"
                        >
                          <Plus className="size-4" /> Add Item Row
                        </button>
                      )}
                    </div>
                    {items.map((item, index) => (
                      <div key={index} className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-black text-zinc-500">Row {index + 1}</span>
                          {!isPostedEditing && (
                            <button 
                              disabled={items.length === 1} 
                              onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} 
                              className="rounded-lg border border-rose-200 bg-white p-2 text-rose-700 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer" 
                              title="Remove row"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid gap-2.5 md:grid-cols-12 items-end">
                          {/* Item Column: 5 cols for WH1, 4 cols for WH2/WH3 */}
                          <label className={isWH1(warehouseId) ? "md:col-span-5" : "md:col-span-4"}>
                            <span className="mb-1 block text-[10px] font-black uppercase text-zinc-400">Item</span>
                            {isPostedEditing ? (
                              <div className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 flex items-center text-xs font-bold text-zinc-700 font-mono">
                                {item.item_name}
                              </div>
                            ) : (
                              <select 
                                disabled={!warehouseId} 
                                value={item.item_id} 
                                onChange={(e) => { 
                                  const product = selectableProducts.find((p) => p.id === e.target.value); 
                                  const isWh1 = isWH1(warehouseId);
                                  const autoBatch = isWh1 ? "N/A" : (product?.batches?.[0]?.batchNo || product?.batch || "");
                                  const defaultSellingPrice = Number(product?.sellingPrice || 0) > 0 ? Number(product?.sellingPrice) : Number(product?.unitCost || 0);
                                  void updateItem(index, { 
                                    item_id: e.target.value, 
                                    item_name: product?.name || "", 
                                    packaging_unit: product?.unit || (isWh1 ? "Quintal" : "Box"), 
                                    unit_price: defaultSellingPrice, 
                                    batch_id: autoBatch, 
                                    batch_no: autoBatch, 
                                    available_quantity: product?.quantity || 0 
                                  }) 
                                }} 
                                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-zinc-100"
                              >
                                <option value="">{warehouseId ? "Select item" : "Select warehouse first"}</option>
                                {(() => {
                                  const hasSelected = selectableProducts.some((p) => p.id === item.item_id)
                                  const extra = item.item_id && !hasSelected ? [{ id: item.item_id, name: item.item_name || item.item_id }] : []
                                  return [...selectableProducts, ...extra].map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))
                                })()}
                              </select>
                            )}
                          </label>

                          {/* Batch Column: Completely removed for WH1; 2 cols for WH2/WH3 */}
                          {!isWH1(warehouseId) && (
                            <label className="md:col-span-2">
                              <span className="mb-1 block text-[10px] font-black uppercase text-zinc-400">
                                Batch No
                              </span>
                              {isPostedEditing ? (
                                <div className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 flex items-center text-xs font-bold text-zinc-700 font-mono">
                                  {item.batch_no || "—"}
                                </div>
                              ) : (
                                <select
                                  value={item.batch_id || item.batch_no}
                                  onChange={(e) => {
                                    const rawOpts = batchOptions[index] || []
                                    const val = e.target.value
                                    const batch = rawOpts.find((b) => (b.batch_id && b.batch_id === val) || b.batch_no === val)
                                    void updateItem(index, {
                                      batch_no: batch?.batch_no || val,
                                      batch_id: batch?.batch_id || batch?.id || val,
                                      packaging_unit: batch?.packaging_unit || item.packaging_unit,
                                      available_quantity: batch?.available_quantity || item.available_quantity || 1000,
                                      unit_price: Number(item.unit_price) > 0 ? item.unit_price : (batch?.unit_price ?? item.unit_price),
                                    })
                                  }}
                                  className={`h-10 w-full rounded-xl text-xs font-bold ${
                                    issueFormErrors.items && (!item.batch_no || item.batch_no === "N/A") 
                                      ? "border border-rose-400 bg-rose-50" 
                                      : "border border-zinc-200 bg-white"
                                  } px-2`}
                                >
                                  <option value="">Select batch</option>
                                  {(() => {
                                    const opts = batchOptions[index] || []
                                    const hasSelected = opts.some((b) => (b.batch_id && b.batch_id === item.batch_id) || b.batch_no === item.batch_no)
                                    const displayOpts = item.batch_no && !hasSelected && item.batch_no !== "N/A"
                                      ? [{ batch_id: item.batch_id || item.batch_no, batch_no: item.batch_no, available_quantity: item.available_quantity || 1000, unit_price: item.unit_price, packaging_unit: item.packaging_unit }, ...opts]
                                      : opts
                                    return displayOpts.map((b) => (
                                      <option key={b.batch_id || b.batch_no} value={b.batch_id || b.batch_no}>
                                        {b.batch_no} {b.available_quantity ? `(${b.available_quantity} avail)` : ""}
                                      </option>
                                    ))
                                  })()}
                                </select>
                              )}
                            </label>
                          )}

                          {/* Quantity: 2 cols for WH1, 1 col for WH2/WH3 */}
                          <label className={isWH1(warehouseId) ? "md:col-span-2" : "md:col-span-1"}>
                            <span className="mb-1 block text-[10px] font-black uppercase text-zinc-400">Qty</span>
                            {isPostedEditing ? (
                              <div className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 flex items-center text-xs font-mono font-black text-zinc-700">
                                {item.quantity}
                              </div>
                            ) : (
                              <input type="number" min={1} value={item.quantity === 0 ? "" : item.quantity} onChange={(e) => void updateItem(index, { quantity: Number(e.target.value) })} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-2 text-center font-mono text-xs font-black" />
                            )}
                          </label>

                          {/* Unit: 1 col */}
                          <label className="md:col-span-1">
                            <span className="mb-1 block text-[10px] font-black uppercase text-zinc-400">Unit</span>
                            <input readOnly value={item.packaging_unit || (isWH1(warehouseId) ? "Quintal" : "Box")} className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-2 text-center text-xs font-bold text-zinc-700" />
                          </label>

                          {/* Unit Price: 2 cols */}
                          <label className="md:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="block text-[10px] font-black uppercase text-zinc-400">Unit Price</span>
                              {(() => {
                                const prod = products.find((p) => p.id === item.item_id)
                                const cost = Number(prod?.unitCost || 0)
                                if (cost > 0 && Number(item.unit_price) > 0) {
                                  const pct = Math.round(((Number(item.unit_price) - cost) / cost) * 100)
                                  return (
                                    <span
                                      className={`text-[10px] font-black font-mono ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                                      title={`Cost Price: ${money(cost)}`}
                                    >
                                      {pct >= 0 ? `+${pct}%` : `${pct}%`}
                                    </span>
                                  )
                                }
                                return null
                              })()}
                            </div>
                            {isPostedEditing ? (
                              <div className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-2 text-right font-mono text-xs font-bold text-zinc-700 flex items-center justify-end">
                                {money(item.unit_price)}
                              </div>
                            ) : (
                              <input type="number" min={0} value={item.unit_price === 0 ? "" : item.unit_price} onChange={(e) => void updateItem(index, { unit_price: Number(e.target.value) })} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-2 text-right font-mono text-xs font-bold" />
                            )}
                          </label>

                          {/* Amount: 2 cols */}
                          <label className="md:col-span-2">
                            <span className="mb-1 block text-[10px] font-black uppercase text-zinc-400">Amount</span>
                            <input readOnly value={money(item.amount)} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-2 text-right font-mono text-xs font-black text-zinc-950" />
                          </label>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Tax Selection & Real-Time Calculation Bar */}
              <div className="mt-4 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                {/* Left: Tax Rule Selection (5 columns on lg) */}
                <div className="lg:col-span-5 flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-zinc-700 text-xs font-black uppercase tracking-wider shrink-0">Tax:</span>
                  <div className="flex items-center gap-2 flex-1 min-w-[150px] max-w-full">
                    <select
                      value={taxRuleType}
                      onChange={(e) => handleTaxTypeChange(e.target.value)}
                      className="h-9 px-3 py-1 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 shadow-2xs focus:border-emerald-600 focus:outline-none cursor-pointer flex-1 min-w-0 truncate"
                    >
                      {dynamicTaxOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {taxRuleType === "CUSTOM" && (
                      <div className="flex items-center gap-1 bg-white border border-zinc-300 rounded-xl px-2.5 h-9 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={customTaxRateInput}
                          onChange={(e) => handleCustomTaxChange(e.target.value)}
                          className="w-12 text-right text-xs font-black font-mono focus:outline-none"
                          placeholder="0"
                        />
                        <span className="text-xs font-bold text-zinc-500">%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: 4-Column Summary Cards (7 columns on lg) */}
                <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="px-2.5 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200 text-center">
                    <span className="text-zinc-400 text-[9px] uppercase font-black block tracking-wider">Total Qty</span>
                    <span className="font-mono font-black text-zinc-800 text-xs truncate block">{totalQuantity.toLocaleString()}</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200 text-center">
                    <span className="text-zinc-400 text-[9px] uppercase font-black block tracking-wider">Subtotal</span>
                    <span className="font-mono font-black text-zinc-800 text-xs truncate block">ETB {money(subtotal)}</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200 text-center">
                    <span className="text-zinc-400 text-[9px] uppercase font-black block tracking-wider">{taxRate > 0 ? `Tax (${taxRate}%)` : "Tax (0%)"}</span>
                    <span className="font-mono font-black text-zinc-800 text-xs truncate block">ETB {money(vatAmount)}</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs text-center">
                    <span className="text-emerald-700 text-[9px] uppercase font-black block tracking-wider">Total Payable</span>
                    <span className="font-mono font-black text-emerald-800 text-xs truncate block">ETB {money(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Chart of Accounts (COA) Account Allocation Section */}
              <div className="mt-4">
                <SalesIssueCOASplitSection
                  totalAmount={grandTotal}
                  totalCost={isProcessingService ? 0 : calculateTotalCost(items, products)}
                  warehouseId={warehouseId}
                  paymentType={paymentType}
                  customerName={customerName}
                  debitLines={siDebitLines}
                  creditLines={siCreditLines}
                  onDebitLinesChange={setSiDebitLines}
                  onCreditLinesChange={setSiCreditLines}
                  cogsDebitLines={siCogsDebitLines}
                  cogsCreditLines={siCogsCreditLines}
                  onCogsDebitLinesChange={setSiCogsDebitLines}
                  onCogsCreditLinesChange={setSiCogsCreditLines}
                  hideSectionB={isProcessingService}
                />
              </div>

              {Object.keys(issueFormErrors).length > 0 && (
                <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold space-y-1.5 animate-in fade-in-50">
                  <div className="flex items-center gap-1.5 font-black text-rose-700 uppercase tracking-wider text-[11px]">
                    <AlertCircle className="size-4 shrink-0 text-rose-600" />
                    Please complete the required items before saving sales issue:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800 font-medium pl-1">
                    {Object.values(issueFormErrors).map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setFormOpen(false)}
                  className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-black disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                  className="h-10 min-w-[90px] inline-flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed px-5 text-xs font-black text-white transition-colors cursor-pointer"
                >
                  {isSaving ? <LoadingDots color="bg-white" size="sm" /> : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* MODAL 2: RECORD PAYMENT INSTALLMENT */}
      {payingIssue && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <BodyScrollLock />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPayingIssue(null)} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <Receipt className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-900">Record Payment Installment</h3>
                    <p className="text-xs text-zinc-500">{payingIssue.fs_no} • {payingIssue.customer_name}</p>
                  </div>
                </div>
                <button onClick={() => setPayingIssue(null)} className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer">
                  <X className="size-5" />
                </button>
              </div>

              {/* Financial State KPI Header */}
              {(() => {
                const paymentsForIssue = financeStore.getPaymentsForSalesIssue(payingIssue.id)
                const totalAmt = Number(payingIssue.total_amount || 0)
                const paidAmt = paymentsForIssue.reduce((s, p) => s + p.amount, 0) || Number(payingIssue.amount_paid || 0)
                const dueAmt = Number(Math.max(0, totalAmt - paidAmt).toFixed(2))
                const currentInputAmt = parseFloat(payAmount) || 0
                const newRemaining = Number(Math.max(0, dueAmt - currentInputAmt).toFixed(2))
                const newPct = totalAmt > 0 ? Math.min(100, Math.round(((paidAmt + currentInputAmt) / totalAmt) * 100)) : 0

                return (
                  <form onSubmit={handleRecordInstallmentSubmit} className="space-y-4 text-xs">
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Amount</span>
                          <span className="font-mono text-xs font-black text-zinc-900">ETB {money(totalAmt)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase block">Already Paid</span>
                          <span className="font-mono text-xs font-black text-emerald-700">ETB {money(paidAmt)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-rose-600 uppercase block">Current Due</span>
                          <span className="font-mono text-xs font-black text-rose-700">ETB {money(dueAmt)}</span>
                        </div>
                      </div>

                      {/* Live Balance Readout */}
                      <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-xs font-bold">
                        <span className="text-zinc-600">Remaining after this payment:</span>
                        <span className={`font-mono text-sm font-black ${newRemaining <= 0 ? "text-emerald-700" : "text-zinc-900"}`}>
                          ETB {money(newRemaining)} ({newPct}%)
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-bold text-zinc-700">Installment Amount (ETB) *</label>
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(dueAmt))}
                          className="text-[11px] font-black text-emerald-700 hover:underline cursor-pointer"
                        >
                          Pay Full Remaining (ETB {money(dueAmt)})
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={dueAmt}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        required
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-sm font-black text-zinc-900 outline-none"
                        placeholder="e.g. 50000"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-zinc-700 mb-1 block">Payment Date</label>
                        <input
                          type="date"
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          required
                          className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-zinc-700 mb-1 block">Deposit Bank Account</label>
                        <select
                          value={payBank}
                          onChange={(e) => setPayBank(e.target.value)}
                          className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
                        >
                          {bankAccounts.map((a) => (
                            <option key={a.id} value={a.code}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Bank Transaction / Slip Reference No</label>
                      <input
                        type="text"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        required
                        placeholder="e.g. CBE-TXN-9842187"
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                      />
                    </div>

                    {/* Payment Advice Receipt Attachment */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-zinc-700">Attach Payment Advice / Deposit Slip *</label>
                        {payAdviceFile && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Attached
                          </span>
                        )}
                      </div>
                      <label className={`flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                        payAdviceFile
                          ? "border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/70"
                          : "border-amber-300 bg-amber-50/30 hover:bg-amber-50/60"
                      }`}>
                        <Upload className={`size-4 mb-1 ${payAdviceFile ? "text-emerald-600" : "text-amber-500"}`} />
                        <span className={`text-xs font-bold ${payAdviceFile ? "text-emerald-800" : "text-amber-900"}`}>
                          {payAdviceFile ? payAdviceFile.name : "Choose bank slip (PDF, PNG, JPG) *"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setPayAdviceFile(e.target.files[0])
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-zinc-500 mt-1 block">
                        Payment Advice / bank deposit receipt is mandatory when recording an installment payment.
                      </span>
                    </div>

                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Notes / Remarks (optional)</label>
                      <textarea
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        rows={2}
                        placeholder="e.g. 1st installment paid via CBE mobile banking transfer."
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                      <button
                        type="button"
                        disabled={isSubmittingPayment}
                        onClick={() => setPayingIssue(null)}
                        className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingPayment}
                        className="px-5 py-2 rounded-xl bg-emerald-700 text-white font-black hover:bg-emerald-800 shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                      >
                        {isSubmittingPayment ? <LoadingDots color="bg-white" size="sm" /> : <>Record Payment <ArrowRight className="size-3.5" /></>}
                      </button>
                    </div>
                  </form>
                )
              })()}
            </div>
          </div>
        )}

      {/* Document preview modal for inspecting trade licenses & payment advices */}
      <DocumentPreviewModal
        isOpen={!!previewDocUrl}
        onClose={() => setPreviewDocUrl("")}
        fileUrl={previewDocUrl}
        fileName={previewDocName}
      />

      {/* Sales Issue Export & Print Modal */}
      <SalesIssuePrintModal
        isOpen={!!printingIssue}
        issue={printingIssue}
        onClose={() => setPrintingIssue(null)}
      />
    </div>
  )
}
