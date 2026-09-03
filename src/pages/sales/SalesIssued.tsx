import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Plus, Send, Trash2, X, Download, Upload, CheckCircle2, Receipt, ArrowRight, Pencil, AlertCircle, Lock, ExternalLink } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, getTradeLicenseStatus } from "@/lib/erpStore"
import { useFinanceStore } from "@/lib/financeStore"
import { withOperatingWarehouses } from "@/lib/warehouses"
import { useFeedback } from "@/context/FeedbackContext"
import { sortNewestFirst } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { EditModalHeader } from "@/components/EditModalHeader"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import SalesIssuePrintModal from "@/components/sales/SalesIssuePrintModal"

import {
  saveTradeLicense,
  savePaymentAdvice,
  fetchTradeAndAdviceDocs,
} from "@/lib/tradeDocumentService"
import { uploadFile } from "@/lib/fileUpload"

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

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d?: string | Date | null) {
  if (!d) return "—"
  try {
    const str = typeof d === "string" ? (d.includes("T") ? d.split("T")[0] : d) : new Date(d).toISOString().split("T")[0]
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

const isWH1 = (w?: string) => {
  if (!w) return false
  const upper = w.toUpperCase()
  return upper.includes("WH1") || upper.includes("WH-01") || upper.includes("WH 1") || upper.includes("AGRI")
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
  const { showToast, confirm } = useFeedback()
  const products = erp.getProducts()
  const warehouses = withOperatingWarehouses(erp.getWarehouses())
  const bankAccounts = useMemo(() => {
    const raw = financeStore.getAccounts().filter((a) => !a.is_group && (a.code.startsWith("1000") || a.account_type === "Asset"))
    if (raw.length > 0) return raw
    return [
      { id: "1000-02-26", code: "1000-02-26", name: "Commercial Bank of Ethiopia (CBE)", account_type: "Asset" },
      { id: "1000-02-27", code: "1000-02-27", name: "Awash Bank", account_type: "Asset" },
      { id: "1000-02-28", code: "1000-02-28", name: "Dashen Bank", account_type: "Asset" },
      { id: "1000-02-29", code: "1000-02-29", name: "Bank of Abyssinia", account_type: "Asset" },
      { id: "1000-01-01", code: "1000-01-01", name: "Cash on Hand / Main Cash", account_type: "Asset" },
    ]
  }, [financeStore])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [batchFilter, setBatchFilter] = useState("ALL")
  const [search, setSearch] = useState("")

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
  const [warehouseId, setWarehouseId] = useState("")
  const [paymentType, setPaymentType] = useState<PaymentType>("Cash")
  const [items, setItems] = useState<SalesIssueItem[]>([blankItem()])

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
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0])
  const [payBank, setPayBank] = useState("1000-02-26")
  const [payRef, setPayRef] = useState("")
  const [payAdviceFile, setPayAdviceFile] = useState<File | null>(null)
  const [payNotes, setPayNotes] = useState("")
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  const salesOrders = erp.getSalesOrders()

  const evaluatedPendingSalesOrders = useMemo(() => {
    const customers = erp.getCustomers()
    return salesOrders.map((so) => {
      const alreadyIssued = rows.some((row) => (row.reference_no || "").includes(so.id))
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
    const warehouse = warehouses.find((entry) => entry.id === value || entry.code === value || entry.name === value)
    return warehouse?.id || value
  }

  const handleSelectPullSalesOrder = async (so: any) => {
    if (selectedSoId === so.id) {
      setSelectedSoId(null)
      setCustomerName("")
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

    setSelectedSoId(so.id)
    setCustomerName(so.customer)
    const matchedWh = warehouses.find((w) => w.code === so.warehouse || w.id === so.warehouse || w.name === so.warehouse)
    const targetWhId = matchedWh ? matchedWh.id : canonicalWarehouseId(so.warehouse)
    setWarehouseId(targetWhId)
    const targetIsWh1 = isWH1(so.warehouse) || isWH1(targetWhId)
    const explicitPaymentType = (so.paymentType || so.payment_type || so.payment_method || so.paymentMethod || "").toString().trim().toLowerCase()
    const targetIsCash = explicitPaymentType === "cash" || (!explicitPaymentType && (so.payment_terms || so.paymentTerms || "").toString().toLowerCase() === "cash")
    setPaymentType(targetIsCash ? "Cash" : "Credit")
    setReferenceNo(so.id)
    if (!saleDate) setSaleDate(new Date().toISOString().split("T")[0])
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

    setItems(newItems.length > 0 ? newItems : [blankItem(targetIsWh1 ? "Quintal" : "Box")])
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
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      if (batchFilter !== "ALL") params.set("batch", batchFilter)
      if (search.trim()) params.set("search", search.trim())

      const [result] = await Promise.all([
        listSalesIssues(params),
        financeStore.getInvoices().length === 0 ? financeStore.reloadFromApi() : Promise.resolve(),
      ])
      const sorted = sortNewestFirst(result.rows)
      setRows(sorted)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales issues")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, pageSize, batchFilter, search])

  const openCreate = (preselectedSo?: any) => {
    setEditing(null)
    setIssueFormErrors({})
    const nextFs = `FS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    setFsNo(nextFs)
    setSaleDate(new Date().toISOString().split("T")[0])
    setStagedTradePaperName("")
    setStagedTradePaperUrl("")
    setStagedPaymentAdviceName("")
    setStagedPaymentAdviceUrl("")

    if (preselectedSo && preselectedSo.id) {
      setSelectedSoId(preselectedSo.id)
      setCustomerName(preselectedSo.customer)
      const matchedWh = warehouses.find((w) => w.code === preselectedSo.warehouse || w.id === preselectedSo.warehouse || w.name === preselectedSo.warehouse)
      const targetWhId = matchedWh ? matchedWh.id : canonicalWarehouseId(preselectedSo.warehouse)
      const targetIsWh1 = isWH1(preselectedSo.warehouse) || isWH1(targetWhId)
      setWarehouseId(targetWhId)
      const explicitPaymentType = (preselectedSo.paymentType || preselectedSo.payment_type || preselectedSo.payment_method || preselectedSo.paymentMethod || "").toString().trim().toLowerCase()
      const targetIsCash = explicitPaymentType === "cash" || (!explicitPaymentType && (preselectedSo.payment_terms || preselectedSo.paymentTerms || "").toString().toLowerCase() === "cash")
      setPaymentType(targetIsCash ? "Cash" : "Credit")
      setReferenceNo(preselectedSo.id)
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
      setWarehouseId("")
      setPaymentType("Cash")
      setItems([blankItem()])
    }
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
      setSaleDate(full.sale_date ? (typeof full.sale_date === "string" ? full.sale_date.split("T")[0] : new Date(full.sale_date).toISOString().split("T")[0]) : "")
      setCustomerName(full.customer_name || (full as any).customer || "")
      const canonicalWh = canonicalWarehouseId(full.warehouse_id || "")
      setWarehouseId(canonicalWh)
      setPaymentType(((full.payment_type || (full as any).paymentType || "Cash") === "Credit" ? "Credit" : "Cash") as PaymentType)
      
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

  // Open Record Installment Modal for Credit issue
  const openRecordPayment = (issue: SalesIssue) => {
    const paymentsForIssue = financeStore.getPaymentsForSalesIssue(issue.id)
    const paidVal = paymentsForIssue.reduce((s, p) => s + p.amount, 0) || Number(issue.amount_paid || 0)
    const totalVal = Number(issue.total_amount || 0)
    const dueVal = Number(Math.max(0, totalVal - paidVal).toFixed(2))

    setPayingIssue(issue)
    setPayAmount(dueVal > 0 ? String(dueVal) : "")
    setPayDate(new Date().toISOString().split("T")[0])
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

        try {
          await savePaymentAdvice({
            salesIssueId: payingIssue.id,
            salesOrderId: payingIssue.reference_no.trim() || undefined,
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

      // Record payment with auto balanced double entry
      financeStore.recordPayment({
        linked_invoice_id: `INV-SI-${payingIssue.id}`,
        sales_issue_id: payingIssue.id,
        sales_order_id: payingIssue.reference_no,
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
      const linkedOrders = salesOrders.filter((so) => refStr.includes(so.id) || so.id === payingIssue.reference_no)
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
      if (targetIsWh1) {
        updated.batch_no = "N/A"
        updated.batch_id = "N/A"
      } else {
        const prod = products.find((p) => p.id === patch.item_id)
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
  }

  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount || 0), 0), [items])
  const isWh1Export = isWH1(warehouseId)
  const vatRate = isWh1Export ? 0 : 15
  const vatAmount = useMemo(() => Math.round(subtotal * (vatRate / 100)), [subtotal, vatRate])
  const grandTotal = useMemo(() => subtotal + vatAmount, [subtotal, vatAmount])

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
        const prodWhMatches =
          p.warehouse === targetWh ||
          prodWhCanon === targetWh ||
          p.warehouse.toUpperCase().startsWith(targetWhBase) ||
          prodWhCanon.toUpperCase().startsWith(targetWhBase)
        if (prodWhMatches && Number(p.quantity || 0) > 0) return true
      }

      // 3. WH1 commodities check
      if (targetIsWh1 && isWH1(p.warehouse) && Number(p.quantity || 0) > 0) return true

      return false
    })
  }, [products, warehouseId])

  const handleSave = async () => {
    if (isSaving) return
    const isWh1Active = isWH1(warehouseId)
    const errors: Record<string, string> = {}
    if (!fsNo.trim()) errors.fsNo = "FS Number is required."
    if (!saleDate) errors.saleDate = "Sale Date is required."
    if (!customerName.trim()) errors.customer = "Customer Name is required."
    if (!warehouseId) errors.warehouse = "Warehouse selection is required."

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

    if (paymentType === "Cash" && (!stagedPaymentAdviceUrl || !stagedPaymentAdviceName)) {
      errors.paymentAdvice = "Payment Advice (deposit receipt / bank slip) is mandatory for Cash sales issues."
    }

    const validItems = items.filter((item) => item.item_id && item.quantity > 0)
    if (validItems.length === 0) {
      errors.items = "At least one item with a valid product and quantity > 0 is required."
    } else if (!isWh1Active) {
      const hasMissingBatch = validItems.some((item) => !item.batch_no || item.batch_no === "N/A")
      if (hasMissingBatch) {
        errors.items = "Batch selection is required for all veterinary/pharma line items."
      }
    }

    if (Object.keys(errors).length > 0) {
      setIssueFormErrors(errors)
      return
    }
    setIssueFormErrors({})

    setIsSaving(true)
    try {
      const isPostedEdit = Boolean(editing && (editing.status || "").toLowerCase() === "posted")
      let issueId = editing?.id

      if (editing) {
        await updateSalesIssue(editing.id, {
          fs_no: fsNo.trim(),
          reference_no: referenceNo.trim() || selectedSoId || undefined,
          sale_date: saleDate,
          customer_name: customerName.trim(),
          warehouse_id: canonicalWarehouseId(warehouseId),
          payment_type: paymentType,
          items: validItems,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total_amount: grandTotal,
        })
      } else {
        const created = await createSalesIssue({
          fs_no: fsNo.trim(),
          reference_no: referenceNo.trim() || selectedSoId || undefined,
          sale_date: saleDate,
          customer_name: customerName.trim(),
          warehouse_id: canonicalWarehouseId(warehouseId),
          payment_type: paymentType,
          items: validItems,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total_amount: grandTotal,
        })
        issueId = created.id
      }

      if (issueId && stagedTradePaperName && stagedTradePaperUrl) {
        try {
          await saveTradeLicense({
            salesIssueId: issueId,
            salesOrderId: referenceNo.trim() || undefined,
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
            salesOrderId: referenceNo.trim() || undefined,
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

      if (selectedSoId) {
        erp.updateSalesOrderStage(selectedSoId, "Shipped")
      }

      showToast(
        "Sales Issue Saved",
        "success",
        isPostedEdit
          ? `Sales issue ${fsNo} terms updated to ${paymentType}.`
          : `Sales issue ${fsNo} saved successfully.`
      )
      setFormOpen(false)
      await load()
    } catch (err) {
      showToast("Save failed", "warning", err instanceof Error ? err.message : "Could not save sales issue.")
    } finally {
      setIsSaving(false)
    }
  }

  const doPost = (issue: SalesIssue) => {
    confirm({
      title: `Post Sales Issue ${issue.fs_no || issue.id}?`,
      message: "Posting reduces batch stock and creates balanced journal entries. This can happen only once.",
      confirmLabel: "Post",
      onConfirm: async () => {
        try {
          await postSalesIssue(issue.id || issue.fs_no)
          const refStr = issue.reference_no || ""
          const matchingOrders = salesOrders.filter((so) => refStr.includes(so.id))
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
    total_amount: 110,
    _actions: 190,
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
                      <td style={{ width: `${salesTable.colWidths._actions}px` }} className="py-4 px-4 text-center whitespace-nowrap overflow-hidden">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <BodyScrollLock />
            <motion.div className="absolute inset-0 bg-black/35 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFormOpen(false)} />
            <motion.div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
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
                    value={customerName} 
                    onChange={(e) => {
                      setCustomerName(e.target.value)
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
                      if (isWH1(wh)) {
                        setPaymentType("Credit")
                      } else {
                        setPaymentType("Cash")
                      }
                      setItems([blankItem(isWH1(wh) ? "Quintal" : "Box")]) 
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
                const isWh1Active = isWH1(warehouseId)
                const docLabel = isWh1Active ? "Customer Bank Permit" : "Customer Trade License"
                return (
                  <div className="mt-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-800 block">
                          {isWh1Active ? "Order Bank Permit & Proof of Payment" : "Order Documentation & Payment Advice"}
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-500 block mt-0.5">
                          {paymentType === "Cash"
                            ? (isWh1Active 
                                ? "Payment Advice receipt is mandatory for Cash export sales issues" 
                                : "Payment Advice is mandatory / recommended for Cash sales proof")
                            : (isWh1Active 
                                ? "Bank Permit is attached for this credit export issue (Payment Advice is hidden)"
                                : "Payment Advice can be attached anytime when recording partial installments")}
                        </span>
                      </div>
                    </div>

                    <div className={`grid gap-3 ${paymentType === "Cash" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                      <div className={`p-3 rounded-xl border shadow-sm space-y-1.5 transition-colors ${
                        issueFormErrors.tradePaper 
                          ? "bg-rose-50/40 border-rose-400" 
                          : "bg-white border-zinc-200"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                            <FileText className="size-3.5 text-emerald-600" /> {docLabel}
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

                      {/* Payment Advice Dropzone - Shown when Cash or when Credit has slip attached / is settled */}
                      {(paymentType === "Cash" || Boolean(stagedPaymentAdviceName || stagedPaymentAdviceUrl || (editing && (editing.payment_type || "Cash") === "Credit"))) && (
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
                                    onChange={(e) => {
                                      const f = e.target.files?.[0]
                                      if (f) {
                                        const reader = new FileReader()
                                        reader.onload = () => {
                                          setStagedPaymentAdviceName(f.name)
                                          setStagedPaymentAdviceUrl(reader.result as string)
                                          setIssueFormErrors((prev) => {
                                            const next = { ...prev }
                                            delete next.paymentAdvice
                                            return next
                                          })
                                        }
                                        reader.readAsDataURL(f)
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

              {/* ITEM ROWS */}
              <div className="mt-6 space-y-3">
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
                              void updateItem(index, { 
                                item_id: e.target.value, 
                                item_name: product?.name || "", 
                                packaging_unit: product?.unit || (isWh1 ? "Quintal" : "Box"), 
                                unit_price: product?.sellingPrice || 0, 
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
                              value={item.batch_no}
                              onChange={(e) => {
                                const rawOpts = batchOptions[index] || []
                                const batch = rawOpts.find((b) => b.batch_no === e.target.value)
                                void updateItem(index, {
                                  batch_no: e.target.value,
                                  batch_id: e.target.value,
                                  packaging_unit: batch?.packaging_unit || item.packaging_unit,
                                  available_quantity: batch?.available_quantity || item.available_quantity || 1000,
                                  unit_price: batch?.unit_price ?? item.unit_price,
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
                                const hasSelected = opts.some((b) => b.batch_no === item.batch_no)
                                const displayOpts = item.batch_no && !hasSelected && item.batch_no !== "N/A"
                                  ? [{ batch_no: item.batch_no, available_quantity: item.available_quantity || 1000, unit_price: item.unit_price, packaging_unit: item.packaging_unit }, ...opts]
                                  : opts
                                return displayOpts.map((b) => (
                                  <option key={b.batch_no} value={b.batch_no}>
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
                        <span className="mb-1 block text-[10px] font-black uppercase text-zinc-400">Unit Price</span>
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
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-zinc-500">
                  {isPostedEditing ? "Stock balances are already updated in GL ledger." : "Posting deducts the selected batch quantity from inventory in one server transaction."}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200">
                    <span className="text-zinc-400 text-[9px] uppercase font-black block">Total Qty</span>
                    <span className="font-mono font-black text-zinc-800 text-xs">{totalQuantity.toLocaleString()}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200">
                    <span className="text-zinc-400 text-[9px] uppercase font-black block">Subtotal (Net)</span>
                    <span className="font-mono font-black text-zinc-800 text-xs">ETB {money(subtotal)}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200">
                    <span className="text-zinc-400 text-[9px] uppercase font-black block">VAT ({vatRate}%)</span>
                    <span className="font-mono font-black text-zinc-800 text-xs">ETB {money(vatAmount)}</span>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 text-[9px] uppercase font-black block">Total Payable</span>
                    <span className="font-mono font-black text-emerald-800 text-sm">ETB {money(grandTotal)}</span>
                  </div>
                </div>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RECORD PAYMENT INSTALLMENT */}
      <AnimatePresence>
        {payingIssue && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <BodyScrollLock />
            <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPayingIssue(null)} />
            <motion.div
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
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
                      <label className="font-bold text-zinc-700 mb-1 block">Attach Payment Advice / Deposit Slip</label>
                      <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-zinc-300 hover:border-zinc-400 rounded-xl cursor-pointer bg-zinc-50/60 hover:bg-zinc-50 transition-colors">
                        <Upload className="size-4 text-zinc-400 mb-1" />
                        <span className="text-xs font-bold text-zinc-700">
                          {payAdviceFile ? payAdviceFile.name : "Choose bank slip (PDF, PNG, JPG)"}
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
