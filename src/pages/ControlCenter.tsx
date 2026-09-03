import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowUpRight,
  DollarSign,
  Package,
  Activity,
  Search,
  MapPin,
  RefreshCw,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  CheckCircle2,
  X,
  Clock,
  FileCheck,
  ShieldCheck,
  Check,
  ShoppingCart,
  AlertCircle,
  Eye,
  Phone,
  Building2,
  FileText,
  Download,
  Receipt,
  ArrowRight,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { Skeleton } from "@/components/ui/skeleton"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, type SalesOrder } from "@/lib/erpStore"
import { useFinanceStore } from "@/lib/financeStore"
import { useAuthStore } from "@/lib/authStore"
import { useFeedback } from "@/context/FeedbackContext"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { fetchAllShipmentDocs, type ShipmentDocAttachment } from "@/lib/tradeDocumentService"
import { type HRData, loadHRData, money } from "@/lib/hrApi"
import { loadResource } from "@/lib/apiPersistence"
import { listSalesIssues, type SalesIssue } from "@/lib/salesIssuesApi"
import { isWH1 } from "@/lib/warehouses"
import { cn } from "@/lib/utils"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const emptyHRData: HRData = { employees: [], attendance: [], leaves: [], payrollPeriods: [], payrollRecords: [] }

export interface UserAccount {
  id: string
  username: string
  fullname: string
  roles: string[]
  status: "active" | "suspended"
  employee_id: string | null
  warehouse_ids?: string[]
}

export interface UserActivityLog {
  id: string
  user_id: string | null
  username: string
  fullname?: string
  action: string
  resource: string
  details?: {
    path?: string
    ip?: string
    itemId?: string
  }
  created_at: string
}

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  sales_manager: "Sales Manager",
  hr_manager: "HR Manager",
  finance_manager: "Finance Manager",
  inventory_manager: "Inventory Manager",
  operator: "Staff Operator",
  auditor: "Auditor",
}

const auditLogColumns: TableColumn[] = [
  { key: "resolvedName", label: "Operator Name" },
  { key: "action", label: "Action" },
  { key: "resource", label: "Module / Resource" },
  { key: "details", label: "Context Details", noSort: true },
  { key: "created_at", label: "Timestamp" },
  { key: "_actions", label: "Navigation", align: "center", noSort: true },
]

const resourceLabels: Record<string, string> = {
  auth: "Authentication",
  users: "User Accounts",
  partners: "Partners Directory",
  employees: "Employee Profiles",
  attendance_records: "Attendance Log",
  leave_requests: "Leave Management",
  payroll_records: "Payroll Records",
  warehouses: "Warehouses Scope",
  inventory_products: "Products Registry",
  stock_movements: "Stock Ledger",
  store_transfers: "Store Transfers",
  sales_orders: "Sales Orders",
  purchase_orders: "Purchase Orders",
  sales_issues: "Issued Sales",
  customers: "Customers Directory",
  suppliers: "Suppliers Directory",
  shipment_documents: "HKC Documents",
  chart_of_accounts: "Chart of Accounts",
  journal_entries: "General Journal",
  invoices: "Accounts Receivable Invoices",
  payments: "Cash Accounts / Banking",
  expenses: "Audit Expenses Claims",
  tax_rules: "Tax Settings",
  company_settings: "System Configuration",
}

// Custom Skeleton Components (Zero Spinners)
function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 bg-black/[0.03] border border-black/5 animate-pulse">
      <div className="flex items-start justify-between">
        <div>
          <div className="h-5 w-24 bg-black/10 rounded-full" />
          <div className="h-3 w-32 bg-black/10 rounded-full mt-3" />
        </div>
        <div className="size-12 rounded-2xl bg-black/10" />
      </div>
      <div className="mt-4">
        <div className="h-9 w-52 bg-black/10 rounded-xl" />
        <div className="h-3 w-64 bg-black/5 rounded-full mt-2.5" />
      </div>
    </div>
  )
}

function SystemOverviewGridSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-pulse">
      {/* Left (2/3): Analytics Chart Skeleton */}
      <GlassCard className="p-6 xl:col-span-2 relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="space-y-2">
              <div className="h-5 w-52 bg-black/10 rounded-lg" />
              <div className="h-3 w-72 bg-black/5 rounded-full" />
            </div>
            <div className="h-8 w-44 bg-black/5 rounded-2xl" />
          </div>

          <div className="h-[320px] w-full bg-black/[0.02] rounded-2xl flex items-end justify-between p-6 gap-3">
            {[45, 65, 30, 85, 55, 70, 90, 45, 60, 75, 50, 80].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-black/10 rounded-t-xl transition-all"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Right (1/3): Customer Receivables Skeleton */}
      <GlassCard className="p-6 xl:col-span-1 relative overflow-hidden flex flex-col justify-between">
        <div>
          {/* Header Skeleton */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-black/10" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-black/10 rounded-full" />
                <div className="h-2.5 w-24 bg-black/5 rounded-full" />
              </div>
            </div>
            <div className="size-7 bg-black/5 rounded-lg" />
          </div>

          {/* Metric Banner Skeleton */}
          <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/5 mb-3.5 flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-2.5 w-20 bg-black/10 rounded-full" />
              <div className="h-5 w-28 bg-black/10 rounded-lg" />
            </div>
            <div className="h-5 w-16 bg-black/10 rounded-md" />
          </div>

          {/* Filter Pills Skeleton */}
          <div className="h-7 w-full bg-black/5 rounded-xl mb-3" />

          {/* Issue Cards Skeleton */}
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-2 rounded-xl border border-black/[0.03] bg-black/[0.01] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-28 bg-black/10 rounded-full" />
                  <div className="h-3 w-16 bg-black/10 rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-2.5 w-20 bg-black/5 rounded-full" />
                  <div className="h-2.5 w-12 bg-black/5 rounded-full" />
                </div>
                <div className="w-full bg-black/5 rounded-full h-1.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer Button Skeleton */}
        <div className="pt-3 border-t border-black/5 mt-3">
          <div className="h-8 w-full bg-black/10 rounded-xl" />
        </div>
      </GlassCard>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between pb-4 border-b border-black/5">
        <div className="h-4 w-32 bg-black/10 rounded-full" />
        <div className="h-4 w-24 bg-black/10 rounded-full" />
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3.5 border-b border-black/[0.03]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-black/10 shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-36 bg-black/10 rounded-full" />
              <div className="h-2.5 w-24 bg-black/5 rounded-full" />
            </div>
          </div>
          <div className="h-6 w-20 bg-black/10 rounded-full" />
          <div className="h-3.5 w-28 bg-black/10 rounded-full hidden sm:block" />
          <div className="h-3 w-32 bg-black/5 rounded-full hidden md:block" />
          <div className="h-7 w-24 bg-black/10 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function AuditLogSkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index} className="border-b border-zinc-150/40">
          <td className="px-3 py-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-full bg-zinc-200/80 shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-28 bg-zinc-200/80" />
                <Skeleton className="h-2.5 w-16 bg-zinc-200/80" />
              </div>
            </div>
          </td>
          <td className="px-3 py-3"><Skeleton className="h-5 w-16 rounded-full bg-zinc-200/80" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3.5 w-24 bg-zinc-200/80" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3.5 w-36 bg-zinc-200/80" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3.5 w-28 bg-zinc-200/80" /></td>
          <td className="px-3 py-3 text-center"><Skeleton className="h-7 w-24 rounded-xl bg-zinc-200/80 mx-auto" /></td>
        </tr>
      ))}
    </>
  )
}

export default function ControlCenter() {
  const erp = useErpStore()
  const finance = useFinanceStore()
  const navigate = useNavigate()
  const { showToast } = useFeedback()
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get("tab")
  const initialTab = tabParam === "approvals" || tabParam === "logs" || tabParam === "overview" ? tabParam : "overview"
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "approvals">(initialTab)
  const [chartMode, setChartMode] = useState<"revenue" | "inventory">("revenue")

  useEffect(() => {
    if (tabParam === "approvals" || tabParam === "logs" || tabParam === "overview") {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = (newTab: "overview" | "logs" | "approvals") => {
    setActiveTab(newTab)
    setSearchParams({ tab: newTab })
  }

  // Data states
  const [hrData, setHrData] = useState<HRData>(emptyHRData)
  const [hrError, setHrError] = useState("")
  const [dataLoading, setDataLoading] = useState(true)

  const [logs, setLogs] = useState<UserActivityLog[]>([])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Filters state
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState("All")
  const [selectedModule, setSelectedModule] = useState("All")
  const [selectedAction, setSelectedAction] = useState("All")
  const [selectedTimeframe, setSelectedTimeframe] = useState("All")
  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize, setAuditPageSize] = useState(10)

  // Sales Order Approvals State
  const salesOrders = erp.getSalesOrders()
  const pendingOrders = useMemo(() => salesOrders.filter((so) => (so.approvalStatus || "Pending") === "Pending"), [salesOrders])
  const approvedOrders = useMemo(() => salesOrders.filter((so) => so.approvalStatus === "Approved"), [salesOrders])
  const declinedOrders = useMemo(() => salesOrders.filter((so) => so.approvalStatus === "Declined"), [salesOrders])

  const [approvalFilter, setApprovalFilter] = useState<string>("ALL")
  const [approvalSearch, setApprovalSearch] = useState<string>("")
  const [approveModalOrder, setApproveModalOrder] = useState<SalesOrder | null>(null)
  const [declineModalOrder, setDeclineModalOrder] = useState<SalesOrder | null>(null)
  const [viewModalOrder, setViewModalOrder] = useState<SalesOrder | null>(null)
  const [declineReasonText, setDeclineReasonText] = useState<string>("")
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null)

  // Document preview state
  const [previewDocUrl, setPreviewDocUrl] = useState<string>("")
  const [previewDocName, setPreviewDocName] = useState<string>("")
  const [soDocsMap, setSoDocsMap] = useState<Record<string, ShipmentDocAttachment[]>>({})

  useEffect(() => {
    fetchAllShipmentDocs().then((docs) => {
      if (Array.isArray(docs)) {
        const map: Record<string, ShipmentDocAttachment[]> = {}
        docs.forEach((d) => {
          if (!map[d.record_id]) map[d.record_id] = []
          map[d.record_id].push(d)
        })
        setSoDocsMap(map)
      }
    }).catch(() => {})
  }, [])

  // Outstanding Customer Receivables & Unsettled Sales Issues State
  const [salesIssues, setSalesIssues] = useState<SalesIssue[]>([])
  const [salesIssuesLoading, setSalesIssuesLoading] = useState<boolean>(true)
  const [receivableFilter, setReceivableFilter] = useState<"all" | "unpaid" | "ongoing">("all")
  const [receivableSearch, setReceivableSearch] = useState<string>("")

  const fetchSalesIssuesData = async () => {
    setSalesIssuesLoading(true)
    try {
      const res = await listSalesIssues(new URLSearchParams({ limit: "100" }))
      const rows = Array.isArray(res) ? res : (res.rows || [])
      setSalesIssues(rows)
    } catch (err: any) {
      console.error("[SALES ISSUES FETCH ERROR]:", err.message)
    } finally {
      setSalesIssuesLoading(false)
    }
  }

  useEffect(() => {
    fetchSalesIssuesData()
  }, [])

  const financeStore = useFinanceStore()
  const invoices = financeStore.getInvoices()

  // Unsettled Invoices & Outstanding Customer Receivables Computation
  interface ReceivableItem {
    id: string
    fs_no: string
    reference_no: string
    sale_date: string
    customer_name: string
    payment_type: string
    calculatedTotal: number
    calculatedPaid: number
    calculatedDue: number
    percentPaid: number
    effectiveSettlement: string
    sales_issue_id?: string
  }

  // Unsettled Invoices & Outstanding Customer Receivables Computation
  const {
    unsettledIssues,
    filteredReceivables,
    totalOutstandingReceivables,
    unpaidCount,
    ongoingCount,
  } = useMemo(() => {
    // 1. Primary source: Active AR Invoices from Finance Store
    let list: ReceivableItem[] = []
    if (invoices.length > 0) {
      list = invoices
        .filter((inv) => inv.status !== "Cancelled" && inv.status !== "Draft")
        .map((inv) => {
          const total = Number(inv.total || 0)
          const paid = Number(inv.amount_paid || 0)
          const due = typeof inv.balance_due === "number" ? Math.max(0, inv.balance_due) : Math.max(0, total - paid)
          const percentPaid = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
          const isPaid = (inv.status || "").toLowerCase() === "paid" || due <= 0.01

          return {
            id: inv.id,
            fs_no: inv.fs_no || inv.invoice_number || inv.id,
            reference_no: inv.sales_order_id || inv.sales_issue_id || "",
            sale_date: inv.issue_date || "",
            customer_name: inv.customer_name || "Customer",
            payment_type: inv.payment_terms || "Credit",
            calculatedTotal: total,
            calculatedPaid: paid,
            calculatedDue: due,
            percentPaid,
            effectiveSettlement: isPaid ? "Paid" : paid > 0 ? "Ongoing" : "Unpaid",
            sales_issue_id: inv.sales_issue_id,
          }
        })
        .filter((inv) => inv.calculatedDue > 0.01 && inv.effectiveSettlement !== "Paid")
    } else if (salesIssues.length > 0) {
      // 2. Fallback only if no invoices exist in database at all
      list = salesIssues
        .filter((si) => si.status !== "Cancelled")
        .map((si) => {
          const isCash = (si.payment_type || "Cash").toLowerCase() === "cash"
          const totalAmount = Number(si.total_amount || 0)
          const amountPaid = isCash ? totalAmount : Number(si.amount_paid || 0)
          const balanceDue = isCash ? 0 : (typeof si.balance_due === "number" ? Math.max(0, si.balance_due) : Math.max(0, totalAmount - amountPaid))
          const percentPaid = totalAmount > 0 ? Math.min(100, Math.round((amountPaid / totalAmount) * 100)) : (isCash ? 100 : 0)
          const isPaid = isCash || (totalAmount > 0 && amountPaid >= totalAmount) || balanceDue <= 0.01 || si.settlement_status === "Fully Settled"

          return {
            id: si.id,
            fs_no: si.fs_no || si.id,
            reference_no: si.reference_no || "",
            sale_date: si.sale_date || "",
            customer_name: si.customer_name || "Customer",
            payment_type: si.payment_type || "Credit",
            calculatedTotal: totalAmount,
            calculatedPaid: amountPaid,
            calculatedDue: balanceDue,
            percentPaid,
            effectiveSettlement: isPaid ? "Paid" : amountPaid > 0 ? "Ongoing" : "Unpaid",
            sales_issue_id: si.id,
          }
        })
        .filter((si) => si.calculatedDue > 0.01 && si.effectiveSettlement !== "Paid")
    }

    list.sort((a, b) => new Date(b.sale_date || 0).getTime() - new Date(a.sale_date || 0).getTime())

    const totalOutstanding = list.reduce((sum, item) => sum + item.calculatedDue, 0)
    const unpaid = list.filter((item) => item.calculatedPaid === 0 || item.effectiveSettlement === "Unpaid").length
    const ongoing = list.filter((item) => item.calculatedPaid > 0 && item.calculatedDue > 0).length

    const filtered = list.filter((item) => {
      if (receivableFilter === "unpaid" && (item.calculatedPaid > 0 || item.effectiveSettlement !== "Unpaid")) return false
      if (receivableFilter === "ongoing" && (item.calculatedPaid <= 0 || item.effectiveSettlement !== "Ongoing")) return false

      if (receivableSearch.trim()) {
        const q = receivableSearch.toLowerCase()
        const matchCustomer = item.customer_name?.toLowerCase().includes(q)
        const matchFs = item.fs_no?.toLowerCase().includes(q)
        const matchRef = item.reference_no?.toLowerCase().includes(q)
        if (!matchCustomer && !matchFs && !matchRef) return false
      }

      return true
    })

    return {
      unsettledIssues: list,
      filteredReceivables: filtered,
      totalOutstandingReceivables: totalOutstanding,
      unpaidCount: unpaid,
      ongoingCount: ongoing,
    }
  }, [invoices, salesIssues, receivableFilter, receivableSearch])

  const filteredApprovals = useMemo(() => {
    return salesOrders.filter((so) => {
      const matchesSearch =
        so.id.toLowerCase().includes(approvalSearch.toLowerCase()) ||
        so.customer.toLowerCase().includes(approvalSearch.toLowerCase()) ||
        so.warehouse.toLowerCase().includes(approvalSearch.toLowerCase()) ||
        (so.salesPerson && so.salesPerson.toLowerCase().includes(approvalSearch.toLowerCase()))

      if (!matchesSearch) return false

      const currentStatus = so.approvalStatus || "Pending"
      if (approvalFilter !== "ALL" && currentStatus !== approvalFilter) return false

      return true
    })
  }, [salesOrders, approvalSearch, approvalFilter])

  const handleConfirmApprove = async () => {
    if (!approveModalOrder) return
    setIsProcessingAction(approveModalOrder.id)
    try {
      const approver = user?.fullname || user?.username || "Super Admin"
      await erp.approveSalesOrder(approveModalOrder.id, approver)
      showToast("Order Approved", "success", `Sales Order ${approveModalOrder.id} approved for ${approveModalOrder.customer}. It can now be fulfilled into Sales Issues.`)
      setApproveModalOrder(null)
    } catch (err) {
      showToast("Approval Failed", "warning", err instanceof Error ? err.message : "Failed to approve order.")
    } finally {
      setIsProcessingAction(null)
    }
  }

  const handleOpenDeclineModal = (so: SalesOrder) => {
    setDeclineModalOrder(so)
    setDeclineReasonText("Pricing / terms adjustments required before fulfillment.")
  }

  const handleConfirmDecline = async () => {
    if (!declineModalOrder) return
    setIsProcessingAction(declineModalOrder.id)
    try {
      const decliner = user?.fullname || user?.username || "Super Admin"
      await erp.declineSalesOrder(declineModalOrder.id, decliner, declineReasonText)
      showToast("Order Declined", "info", `Sales Order ${declineModalOrder.id} has been marked as Declined.`)
      setDeclineModalOrder(null)
    } catch (err) {
      showToast("Decline Failed", "warning", err instanceof Error ? err.message : "Failed to decline order.")
    } finally {
      setIsProcessingAction(null)
    }
  }

  // Load standard overview ERP, Finance, and HR data
  useEffect(() => {
    let cancelled = false
    setDataLoading(true)

    Promise.all([
      loadHRData().catch((e) => {
        console.warn("Failed to load HR data:", e)
        return emptyHRData
      }),
      erp.reloadFromApi().catch((e) => console.warn("Failed to reload ERP data:", e)),
      finance.reloadFromApi().catch((e) => console.warn("Failed to reload Finance data:", e)),
    ])
      .then(([hr]) => {
        if (!cancelled) setHrData(hr)
      })
      .catch((error) => {
        if (!cancelled) setHrError(error instanceof Error ? error.message : "Failed to load HR data.")
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Load audit logs and user context
  const fetchAuditLogsData = async () => {
    setLogsLoading(true)
    try {
      const [logsData, usersData] = await Promise.all([
        loadResource<UserActivityLog>("user_activity_logs"),
        loadResource<UserAccount>("users"),
      ])
      setLogs(logsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      setUsers(usersData)
    } catch (err: any) {
      console.error("[AUDIT LOGS FETCH ERROR]:", err.message)
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditLogsData()
  }, [])

  // Key ERP Metrics
  const inventoryValue = erp
    .getProducts()
    .reduce(
      (sum, product) =>
        sum + Number(product.totalStockValue ?? (Number(product.quantity || 0) * Number(product.unitCost || 0))),
      0
    )

  const postedRevenue = useMemo(() => {
    // 1. Calculate from active Sales Issues (primary source of fulfilled enterprise sales)
    const salesIssueRev = salesIssues
      .filter((si) => si.status !== "Cancelled")
      .reduce((sum, si) => sum + Number(si.total_amount || 0), 0)

    // 2. Or from Journal Entry Lines if available
    const glRev = finance.getJournalEntryLines().reduce((sum, line) => {
      const account = finance.getAccounts().find((item) => item.id === line.account_id)
      return account?.account_type === "Revenue"
        ? sum + Number(line.credit_amount || 0) - Number(line.debit_amount || 0)
        : sum
    }, 0)

    return Math.max(salesIssueRev, glRev)
  }, [salesIssues, finance])

  // Chart Data Preparation (Revenue & Sales Pipeline)
  const revenueChartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthlyMap: Record<string, { revenue: number; orders: number }> = {}
    months.forEach((m) => {
      monthlyMap[m] = { revenue: 0, orders: 0 }
    })

    // 1. Aggregate posted revenue from Sales Issues
    salesIssues.forEach((si) => {
      if (si.status === "Cancelled") return
      const dateStr = si.sale_date || (si as any).created_at
      const d = dateStr ? new Date(dateStr) : null
      if (d && !isNaN(d.getTime())) {
        const monthLabel = months[d.getMonth()]
        monthlyMap[monthLabel].revenue += Number(si.total_amount || 0)
      }
    })

    // 2. Aggregate sales pipeline from Sales Orders
    erp.getSalesOrders().forEach((so) => {
      if (so.approvalStatus === "Declined") return
      const dateStr = so.date || (so as any).createdAt
      const d = dateStr ? new Date(dateStr) : null
      if (d && !isNaN(d.getTime())) {
        const monthLabel = months[d.getMonth()]
        monthlyMap[monthLabel].orders += Number(so.amount || 0)
      }
    })

    // 3. Fallback to Journal Revenue Entries if sales issues are not populated
    if (salesIssues.length === 0) {
      finance.getJournalEntries().forEach((entry) => {
        const entryDate = entry.entry_date ? new Date(entry.entry_date) : null
        if (entryDate && !isNaN(entryDate.getTime())) {
          const monthLabel = months[entryDate.getMonth()]
          const lines = finance.getJournalEntryLines().filter((l) => l.journal_entry_id === entry.id)
          lines.forEach((line) => {
            const acc = finance.getAccounts().find((a) => a.id === line.account_id)
            if (acc?.account_type === "Revenue") {
              monthlyMap[monthLabel].revenue += Number(line.credit_amount || 0) - Number(line.debit_amount || 0)
            }
          })
        }
      })
    }

    return months.map((month) => ({
      name: month,
      revenue: Math.max(0, monthlyMap[month].revenue),
      orders: Math.max(0, monthlyMap[month].orders),
    }))
  }, [salesIssues, erp, finance])

  // Stock Valuation Breakdown by Commodity / Category
  const inventoryCategoryData = useMemo(() => {
    const categoryMap: Record<string, { value: number; count: number }> = {}
    erp.getProducts().forEach((p) => {
      const cat = p.category?.trim() || p.name || "General Stock"
      const val = Number(p.totalStockValue ?? (Number(p.quantity || 0) * Number(p.unitCost || 0)))
      if (!categoryMap[cat]) {
        categoryMap[cat] = { value: 0, count: 0 }
      }
      categoryMap[cat].value += val
      categoryMap[cat].count += Number(p.quantity || 0)
    })

    return Object.entries(categoryMap)
      .map(([name, stat]) => ({
        name,
        value: Math.round(stat.value),
        count: stat.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [erp, erp.getProducts()])

  // Resolve user identity against employees and user profiles
  const logsWithUserInfo = useMemo(() => {
    return logs.map((log) => {
      const user = users.find((u) => u.id === log.user_id || u.username === log.username)
      let personName = log.fullname || ""
      let roleDisplay = ""

      if (user) {
        if (user.employee_id && hrData.employees.length > 0) {
          const emp = hrData.employees.find((e) => e.id === user.employee_id)
          if (emp) {
            personName = emp.full_name || personName
          }
        }
        if (!personName) {
          personName = user.fullname || user.username
        }
        if (user.roles && user.roles.length > 0) {
          roleDisplay = roleLabels[user.roles[0]] || user.roles[0]
        }
      }

      if (!personName) {
        personName = log.username || "System"
      }

      return {
        ...log,
        resolvedName: personName,
        roleDisplay,
      }
    })
  }, [logs, users, hrData.employees])

  // Filters calculation
  const filteredLogs = useMemo(() => {
    return logsWithUserInfo.filter((log) => {
      const matchesSearch =
        log.resolvedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesUser = selectedUser === "All" || log.username === selectedUser
      const matchesModule = selectedModule === "All" || log.resource === selectedModule
      const matchesAction = selectedAction === "All" || log.action === selectedAction

      const matchesTimeframe = (() => {
        if (selectedTimeframe === "All") return true
        const logDate = new Date(log.created_at)
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        switch (selectedTimeframe) {
          case "Today":
            return logDate >= startOfDay
          case "Yesterday": {
            const yesterdayStart = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000)
            return logDate >= yesterdayStart && logDate < startOfDay
          }
          case "7Days": {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return logDate >= sevenDaysAgo
          }
          case "30Days": {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return logDate >= thirtyDaysAgo
          }
          default:
            return true
        }
      })()

      return matchesSearch && matchesUser && matchesModule && matchesAction && matchesTimeframe
    })
  }, [logsWithUserInfo, searchQuery, selectedUser, selectedModule, selectedAction, selectedTimeframe])

  const uniqueUsernames = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((log) => {
      if (log.username) set.add(log.username)
    })
    return Array.from(set).sort()
  }, [logs])

  const uniqueResources = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((log) => {
      if (log.resource) set.add(log.resource)
    })
    return Array.from(set).sort()
  }, [logs])

  const uniqueActions = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((log) => {
      if (log.action) set.add(log.action)
    })
    return Array.from(set).sort()
  }, [logs])

  // Table sorting & resizing hook for Audit Logs
  const auditTable = useResizableTable<typeof logsWithUserInfo[0]>(
    auditLogColumns,
    filteredLogs,
    {
      resolvedName: 200,
      action: 130,
      resource: 170,
      details: 260,
      created_at: 170,
      _actions: 140,
    }
  )

  const sortedAuditLogs = auditTable.sorted()
  const totalAuditLogs = sortedAuditLogs.length
  const totalAuditPages = Math.max(1, Math.ceil(totalAuditLogs / auditPageSize))
  const paginatedLogs = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize
    return sortedAuditLogs.slice(start, start + auditPageSize)
  }, [sortedAuditLogs, auditPage, auditPageSize])

  // View Module routing logic
  const handleViewModule = (resource: string) => {
    const normalized = resource.toLowerCase().replace(/_/g, "-")
    switch (normalized) {
      case "auth":
      case "users":
        navigate("/admin/users")
        break
      case "partners":
        navigate("/admin/partners")
        break
      case "settings":
      case "company-settings":
        navigate("/admin/settings")
        break
      case "employees":
        navigate("/hr/employees")
        break
      case "attendance-records":
        navigate("/hr/attendance")
        break
      case "leave-requests":
      case "leave-types":
        navigate("/hr/leave")
        break
      case "payroll-runs":
      case "payroll-periods":
      case "payroll-records":
        navigate("/hr/payroll")
        break
      case "warehouses":
      case "inventory-products":
      case "stock-movements":
      case "warehouse-stock":
      case "inventory":
        navigate("/inventory")
        break
      case "sales-orders":
      case "quotations":
      case "delivery-notes":
        navigate("/sales/sales-orders")
        break
      case "purchase-orders":
        navigate("/sales/purchase-orders")
        break
      case "sales-issues":
        navigate("/sales/sales-issued")
        break
      case "customers":
      case "suppliers":
        navigate("/sales")
        break
      case "shipment-documents":
        navigate("/sales/hkc-docs")
        break
      case "chart-of-accounts":
      case "journal-entries":
      case "journal-entry-lines":
        navigate("/finance/ledger")
        break
      case "invoices":
        navigate("/finance/invoices")
        break
      case "payments":
        navigate("/finance/banking")
        break
      case "expenses":
        navigate("/finance/expenses")
        break
      case "fixed-assets":
        navigate("/finance/assets")
        break
      case "tax-rules":
        navigate("/finance/taxes")
        break
      default:
        if (normalized.includes("sales")) navigate("/sales")
        else if (normalized.includes("inventory")) navigate("/inventory")
        else if (normalized.includes("finance")) navigate("/finance")
        else if (normalized.includes("hr")) navigate("/hr")
        else navigate("/admin")
        break
    }
  }

  const getActionBadgeStyle = (action: string) => {
    const norm = action.toLowerCase()
    if (norm.includes("create")) return "bg-green-50 text-green-700 border-green-200/50"
    if (norm.includes("update") || norm.includes("edit")) return "bg-sky-50 text-sky-700 border-sky-200/50"
    if (norm.includes("delete") || norm.includes("remove")) return "bg-rose-50 text-rose-700 border-rose-200/50"
    if (norm.includes("login")) return "bg-purple-50 text-purple-700 border-purple-200/50"
    if (norm.includes("post")) return "bg-emerald-50 text-emerald-700 border-emerald-200/50"
    if (norm.includes("cancel")) return "bg-amber-50 text-amber-700 border-amber-200/50"
    return "bg-zinc-50 text-zinc-700 border-zinc-200/50"
  }

  const formatDateTime = (isoString: string) => {
    if (!isoString) return "-"
    const d = new Date(isoString)
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const handleExportAuditLogs = () => {
    if (filteredLogs.length === 0) {
      showToast("No Logs to Export", "warning", "Current filter yielded 0 audit records.")
      return
    }

    const headers = ["Timestamp", "Operator Name", "Username", "Role", "Action", "Module / Resource", "IP Address", "Item ID", "Path"]
    const rows = filteredLogs.map((l) => [
      `"${l.created_at || ""}"`,
      `"${(l.resolvedName || "").replace(/"/g, '""')}"`,
      `"${(l.username || "").replace(/"/g, '""')}"`,
      `"${(l.roleDisplay || "").replace(/"/g, '""')}"`,
      `"${(l.action || "").replace(/"/g, '""')}"`,
      `"${(resourceLabels[l.resource] || l.resource || "").replace(/"/g, '""')}"`,
      `"${(l.details?.ip || "").replace(/"/g, '""')}"`,
      `"${(l.details?.itemId || "").replace(/"/g, '""')}"`,
      `"${(l.details?.path || "").replace(/"/g, '""')}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `hkc_audit_trail_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Audit Trail Exported", "success", `Exported ${filteredLogs.length} audit records to CSV.`)
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-3 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12">
        {/* Header Block */}
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-6 gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">Control Center</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Operational analytics and live audit logs across all ERP modules.</p>
          </div>
          <SubPageNav items={getSectionChildren("/admin")} />
        </motion.div>

        {hrError && <GlassCard className="p-4 mb-5 text-xs font-bold text-rose-700 bg-rose-50 border-rose-200">{hrError}</GlassCard>}

        {/* Tab Toggle Navigation */}
        <motion.div variants={fade} className="flex items-center gap-1.5 sm:gap-2 mb-6 border-b border-black/5 pb-3 overflow-x-auto no-scrollbar overscroll-x-contain py-1">
          <button
            onClick={() => handleTabChange("overview")}
            className={cn(
              "px-3.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer",
              activeTab === "overview" ? "bg-zinc-900 text-white shadow-sm" : "text-gray-500 hover:text-black hover:bg-black/5"
            )}
          >
            System Overview & Analytics
          </button>
          <button
            onClick={() => handleTabChange("logs")}
            className={cn(
              "px-3.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer",
              activeTab === "logs" ? "bg-zinc-900 text-white shadow-sm" : "text-gray-500 hover:text-black hover:bg-black/5"
            )}
          >
            <Activity className="size-4 shrink-0" />
            Audit Activity Logs
          </button>
          <button
            onClick={() => handleTabChange("approvals")}
            className={cn(
              "px-3.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer",
              activeTab === "approvals" ? "bg-zinc-900 text-white shadow-sm" : "text-gray-500 hover:text-black hover:bg-black/5"
            )}
          >
            <ShieldCheck className="size-4 shrink-0" />
            Sales Order Approvals
            {pendingOrders.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white leading-none shadow-xs">
                {pendingOrders.length}
              </span>
            )}
          </button>
        </motion.div>

        {/* Tab Content 1: Overview */}
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Colored Metric Cards (Posted Revenue & Inventory Value) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {dataLoading ? (
                <>
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </>
              ) : (
                <>
                  {/* Card 1: Posted Revenue (Emerald/Green Gradient) */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                    className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-emerald-500/15 via-emerald-600/5 to-white/70 border border-emerald-500/30 backdrop-blur-xl shadow-lg shadow-emerald-950/[0.04]"
                  >
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-sm">
                          Financial Balance
                        </span>
                        <p className="text-xs text-emerald-900 font-extrabold uppercase tracking-wider mt-2.5">Posted Revenue</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-800 border border-emerald-500/30 shadow-inner">
                        <DollarSign className="size-6 text-emerald-700" />
                      </div>
                    </div>
                    <div className="mt-4 relative z-10">
                      <p className="text-3xl sm:text-4xl font-black text-black tracking-tight font-mono">
                        ETB {money(postedRevenue)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-800">
                        <TrendingUp className="size-4" />
                        <span>Calculated from posted general ledger revenue transactions</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Card 2: Inventory Value (Indigo/Violet Gradient) */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                    className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-indigo-500/15 via-violet-600/5 to-white/70 border border-indigo-500/30 backdrop-blur-xl shadow-lg shadow-indigo-950/[0.04]"
                  >
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-sm">
                          Asset Valuation
                        </span>
                        <p className="text-xs text-indigo-900 font-extrabold uppercase tracking-wider mt-2.5">Total Inventory Value</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-800 border border-indigo-500/30 shadow-inner">
                        <Package className="size-6 text-indigo-700" />
                      </div>
                    </div>
                    <div className="mt-4 relative z-10">
                      <p className="text-3xl sm:text-4xl font-black text-black tracking-tight font-mono">
                        ETB {money(inventoryValue)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-indigo-800">
                        <Layers className="size-4" />
                        <span>Valued across all active warehouse stock batches</span>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </div>

            {/* Interactive Graph & Outstanding Customer Receivables Section */}
            {dataLoading ? (
              <SystemOverviewGridSkeleton />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left (2/3): Enterprise Performance Analytics */}
                <GlassCard className="p-6 xl:col-span-2 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-black text-black tracking-tight flex items-center gap-2">
                          <BarChart3 className="size-5 text-zinc-900" />
                          Enterprise Performance Analytics
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {chartMode === "revenue"
                            ? "Revenue performance & sales orders pipeline across the active fiscal year."
                            : "Inventory valuation and stock distribution breakdown by product category."}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 p-1 bg-black/5 rounded-2xl shrink-0 self-start sm:self-auto">
                        <button
                          onClick={() => setChartMode("revenue")}
                          className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                            chartMode === "revenue"
                              ? "bg-white text-black shadow-sm"
                              : "text-gray-500 hover:text-black"
                          )}
                        >
                          <TrendingUp className="size-3.5 text-emerald-600" />
                          Revenue Trend
                        </button>
                        <button
                          onClick={() => setChartMode("inventory")}
                          className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                            chartMode === "inventory"
                              ? "bg-white text-black shadow-sm"
                              : "text-gray-500 hover:text-black"
                          )}
                        >
                          <PieChartIcon className="size-3.5 text-indigo-600" />
                          Stock Valuation
                        </button>
                      </div>
                    </div>

                    {chartMode === "revenue" ? (
                      <div className="h-[320px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#888", fontWeight: 600 }} />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: "#888", fontWeight: 600 }}
                              tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(255, 255, 255, 0.95)",
                                borderRadius: "16px",
                                border: "1px solid rgba(0,0,0,0.08)",
                                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}
                              formatter={(val: any) => [`ETB ${Number(val).toLocaleString()}`, "Amount"]}
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              name="Posted Revenue"
                              stroke="#059669"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorRevenue)"
                            />
                            <Area
                              type="monotone"
                              dataKey="orders"
                              name="Sales Pipeline"
                              stroke="#4f46e5"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              fillOpacity={1}
                              fill="url(#colorOrders)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[320px] w-full pt-4">
                        {inventoryCategoryData.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs font-semibold text-gray-400">
                            No product category valuation data available.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={inventoryCategoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#888", fontWeight: 600 }} />
                              <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: "#888", fontWeight: 600 }}
                                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                                  borderRadius: "16px",
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                }}
                                formatter={(val: any) => [
                                  `ETB ${Number(val).toLocaleString()}`,
                                  "Category Value",
                                ]}
                              />
                              <Bar dataKey="value" name="Valuation (ETB)" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    )}
                  </div>
                </GlassCard>

                {/* Right (1/3): Outstanding Customer Receivables & Unsettled Sales Issues Panel */}
                <GlassCard className="p-6 xl:col-span-1 flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                            <Receipt className="size-4" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-black tracking-tight flex items-center gap-1.5">
                              Customer Receivables
                              {unsettledIssues.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                  {unsettledIssues.length} Unsettled
                                </span>
                              )}
                            </h3>
                            <p className="text-[11px] text-gray-500">Unpaid & partial customer sales</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => navigate("/sales/sales-issued")}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-black hover:bg-black/5 transition-all text-xs font-bold flex items-center gap-1"
                        title="Open in Sales Issued"
                      >
                        <ArrowRight className="size-4" />
                      </button>
                    </div>

                    {/* Total Outstanding Metric Banner */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/80 to-rose-50/80 border border-amber-200/50 mb-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-amber-900/70 uppercase tracking-wider">Total Uncollected</p>
                        <p className="text-base sm:text-lg font-black text-amber-950 tracking-tight">
                          ETB {totalOutstandingReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                          {unpaidCount} Unpaid
                        </span>
                        {ongoingCount > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md ml-1">
                            {ongoingCount} Ongoing
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Filter Tabs & Mini Search */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-1 p-1 bg-black/5 rounded-xl text-[11px] font-bold">
                        <button
                          onClick={() => setReceivableFilter("all")}
                          className={cn(
                            "flex-1 py-1 rounded-lg transition-all text-center",
                            receivableFilter === "all" ? "bg-white text-black shadow-xs font-black" : "text-gray-500 hover:text-black"
                          )}
                        >
                          All ({unsettledIssues.length})
                        </button>
                        <button
                          onClick={() => setReceivableFilter("unpaid")}
                          className={cn(
                            "flex-1 py-1 rounded-lg transition-all text-center",
                            receivableFilter === "unpaid" ? "bg-white text-rose-600 shadow-xs font-black" : "text-gray-500 hover:text-black"
                          )}
                        >
                          Unpaid ({unpaidCount})
                        </button>
                        <button
                          onClick={() => setReceivableFilter("ongoing")}
                          className={cn(
                            "flex-1 py-1 rounded-lg transition-all text-center",
                            receivableFilter === "ongoing" ? "bg-white text-amber-600 shadow-xs font-black" : "text-gray-500 hover:text-black"
                          )}
                        >
                          Ongoing ({ongoingCount})
                        </button>
                      </div>

                      {unsettledIssues.length > 2 && (
                        <div className="relative flex items-center h-8 px-2.5 rounded-xl border border-black/5 bg-black/[0.02]">
                          <Search className="size-3.5 text-gray-400 mr-1.5 shrink-0" />
                          <input
                            type="text"
                            value={receivableSearch}
                            onChange={(e) => setReceivableSearch(e.target.value)}
                            placeholder="Filter customer, FS no..."
                            className="bg-transparent border-none text-[11px] font-medium text-black outline-none w-full placeholder:text-gray-400"
                          />
                          {receivableSearch && (
                            <button onClick={() => setReceivableSearch("")} className="text-gray-400 hover:text-black">
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scrollable Issue Cards */}
                    <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 divide-y divide-black/5">
                      {salesIssuesLoading ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-gray-400">
                          <RefreshCw className="size-4 animate-spin text-gray-400" />
                          Loading receivables...
                        </div>
                      ) : filteredReceivables.length === 0 ? (
                        <div className="py-8 text-center px-4">
                          {unsettledIssues.length === 0 ? (
                            <div className="flex flex-col items-center">
                              <div className="size-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
                                <CheckCircle2 className="size-5" />
                              </div>
                              <p className="text-xs font-bold text-black">All Accounts Settled</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">No outstanding or partial customer balances.</p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No sales issues match your filter.</p>
                          )}
                        </div>
                      ) : (
                        filteredReceivables.map((si) => (
                          <div
                            key={si.id}
                            onClick={() => navigate(`/sales/sales-issued?search=${encodeURIComponent(si.fs_no || si.customer_name || "")}`)}
                            className="pt-2 first:pt-0 group cursor-pointer hover:bg-black/[0.02] p-2 rounded-xl transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-black truncate group-hover:text-indigo-600 transition-colors">
                                    {si.customer_name || "Unknown Customer"}
                                  </p>
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider shrink-0",
                                      si.effectiveSettlement === "Unpaid"
                                        ? "bg-rose-100 text-rose-700"
                                        : "bg-amber-100 text-amber-700"
                                    )}
                                  >
                                    {si.effectiveSettlement === "Ongoing" ? `${si.percentPaid}% paid` : "Unpaid"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium mt-0.5">
                                  <span>{si.fs_no || si.id}</span>
                                  {si.sale_date && <span>• {si.sale_date}</span>}
                                  <span>• {si.payment_type || "Credit"}</span>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-xs font-black text-rose-600">
                                  ETB {si.calculatedDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] text-gray-400 font-semibold">
                                  of {si.calculatedTotal.toLocaleString()}
                                </p>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-black/5 rounded-full h-1.5 mt-2 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  si.effectiveSettlement === "Unpaid"
                                    ? "bg-rose-500 w-1"
                                    : "bg-amber-500"
                                )}
                                style={{ width: `${Math.max(4, si.percentPaid)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className="pt-3 border-t border-black/5 mt-3">
                    <button
                      onClick={() => navigate("/sales/sales-issued")}
                      className="w-full py-2 px-3 rounded-xl bg-black text-white hover:bg-zinc-800 transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Manage All Sales Issues</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </GlassCard>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab Content 2: Activity Logs */}
        {activeTab === "logs" && (
          <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <GlassCard className="p-0 overflow-hidden border border-white/65 shadow-md">
              <div className="px-6 pt-6">
                <FinanceTableToolbar
                  title="Audit Activity Logs"
                  subtitle={`${totalAuditLogs} records from the audit activity log`}
                  searchValue={searchQuery}
                  onSearchChange={(value) => {
                    setSearchQuery(value)
                    setAuditPage(1)
                  }}
                  searchPlaceholder="Search operator, username, action, module, details..."
                  filters={[
                    {
                      value: selectedUser,
                      onChange: (v) => {
                        setSelectedUser(v)
                        setAuditPage(1)
                      },
                      ariaLabel: "User",
                      options: [
                        { value: "All", label: "All Users" },
                        ...uniqueUsernames.map((u) => ({ value: u, label: `@${u}` })),
                      ],
                    },
                    {
                      value: selectedModule,
                      onChange: (v) => {
                        setSelectedModule(v)
                        setAuditPage(1)
                      },
                      ariaLabel: "Module",
                      options: [
                        { value: "All", label: "All Modules" },
                        ...uniqueResources.map((r) => ({ value: r, label: resourceLabels[r] || r })),
                      ],
                    },
                    {
                      value: selectedAction,
                      onChange: (v) => {
                        setSelectedAction(v)
                        setAuditPage(1)
                      },
                      ariaLabel: "Action",
                      options: [
                        { value: "All", label: "All Actions" },
                        ...uniqueActions.map((a) => ({ value: a, label: a })),
                      ],
                    },
                    {
                      value: selectedTimeframe,
                      onChange: (v) => {
                        setSelectedTimeframe(v)
                        setAuditPage(1)
                      },
                      ariaLabel: "Timeframe",
                      options: [
                        { value: "All", label: "All Time" },
                        { value: "Today", label: "Today" },
                        { value: "Yesterday", label: "Yesterday" },
                        { value: "7Days", label: "Last 7 Days" },
                        { value: "30Days", label: "Last 30 Days" },
                      ],
                    },
                  ]}
                  actions={[
                    {
                      label: "Export CSV",
                      onClick: handleExportAuditLogs,
                      icon: <Download className="size-4" />,
                      variant: "secondary",
                    },
                  ]}
                >
                  <button
                    type="button"
                    onClick={fetchAuditLogsData}
                    disabled={logsLoading}
                    className="flex items-center justify-center size-[38px] sm:size-[40px] rounded-2xl border border-black/5 bg-black/[0.04] hover:bg-black/[0.08] transition-all shrink-0 disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Refresh log registry"
                  >
                    <RefreshCw className={cn("size-4 text-zinc-700", logsLoading && "animate-spin")} />
                  </button>
                </FinanceTableToolbar>
              </div>

              <TableScrollWrapper>
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                      {auditLogColumns.map((col) => (
                        <ResizableTh
                          key={col.key}
                          col={col}
                          width={auditTable.colWidths[col.key] || 140}
                          sortKey={auditTable.sortKey}
                          sortDir={auditTable.sortDir}
                          openMenuCol={auditTable.openMenuCol}
                          onResizeStart={auditTable.handleResizeStart}
                          onToggleMenu={auditTable.toggleMenu}
                          onSortAsc={auditTable.setSortAsc}
                          onSortDesc={auditTable.setSortDesc}
                          onClearSort={auditTable.clearSort}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {logsLoading ? (
                      <AuditLogSkeletonRows />
                    ) : paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={auditLogColumns.length} className="py-16 text-center text-xs font-bold text-zinc-400">
                          No operational audit logs match your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => {
                        const initials =
                          log.resolvedName
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "U"

                        return (
                          <tr key={log.id} className="border-b border-zinc-150/40 hover:bg-zinc-50/60 transition-colors text-xs">
                            {/* Operator Name */}
                            <td style={{ width: `${auditTable.colWidths.resolvedName}px` }} className="px-3 py-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="size-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-black text-[11px] shrink-0 border border-black/5">
                                  {initials}
                                </div>
                                <div className="min-w-0 truncate">
                                  <p className="font-bold text-zinc-900 text-xs leading-snug truncate">{log.resolvedName}</p>
                                  <p className="text-[10px] text-zinc-400 font-semibold truncate">
                                    @{log.username} {log.roleDisplay ? `• ${log.roleDisplay}` : ""}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Action */}
                            <td style={{ width: `${auditTable.colWidths.action}px` }} className="px-3 py-3">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                  getActionBadgeStyle(log.action)
                                )}
                              >
                                {log.action}
                              </span>
                            </td>

                            {/* Module / Resource */}
                            <td style={{ width: `${auditTable.colWidths.resource}px` }} className="px-3 py-3 text-xs font-bold text-zinc-700 truncate">
                              {resourceLabels[log.resource] || log.resource}
                            </td>

                            {/* Context Details */}
                            <td style={{ width: `${auditTable.colWidths.details}px` }} className="px-3 py-3">
                              <div className="flex flex-col gap-1 text-[10px] min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {log.details?.itemId && (
                                    <span className="text-zinc-700 font-extrabold font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/80 shrink-0">
                                      ID: {log.details.itemId}
                                    </span>
                                  )}
                                  {log.details?.ip && (
                                    <span className="text-zinc-400 font-semibold font-mono flex items-center gap-1 shrink-0">
                                      <MapPin className="size-2.5" /> {log.details.ip}
                                    </span>
                                  )}
                                </div>
                                {log.details?.path && (
                                  <span className="text-zinc-400 truncate max-w-[220px] font-medium" title={log.details.path}>
                                    {log.details.path}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Timestamp */}
                            <td style={{ width: `${auditTable.colWidths.created_at}px` }} className="px-3 py-3 font-mono text-xs font-bold text-zinc-600 truncate">
                              {formatDateTime(log.created_at)}
                            </td>

                            {/* Navigation */}
                            <td style={{ width: `${auditTable.colWidths._actions}px` }} className="px-3 py-3 text-center whitespace-nowrap overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handleViewModule(log.resource)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                                title="Navigate to module"
                              >
                                <span>View Module</span>
                                <ArrowUpRight className="size-3 text-zinc-700 shrink-0" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </TableScrollWrapper>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 px-6 py-4 bg-white/40 gap-3">
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                  <span>
                    Showing {totalAuditLogs === 0 ? 0 : (auditPage - 1) * auditPageSize + 1} to {Math.min(auditPage * auditPageSize, totalAuditLogs)} of {totalAuditLogs} entries
                  </span>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                    <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                    <select
                      value={auditPageSize}
                      onChange={(e) => {
                        setAuditPageSize(Number(e.target.value))
                        setAuditPage(1)
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
                    disabled={auditPage === 1}
                    onClick={() => setAuditPage((value) => Math.max(1, value - 1))}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-black text-zinc-700 px-2 font-mono">
                    Page {auditPage} of {totalAuditPages}
                  </span>
                  <button
                    disabled={auditPage >= totalAuditPages}
                    onClick={() => setAuditPage((value) => value + 1)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Tab Content 3: Sales Order Approvals */}
        {activeTab === "approvals" && (
          <motion.div key="approvals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {erp.isLoading() ? (
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </div>
                <TableSkeleton />
              </div>
            ) : (
              <>
                {/* Top Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <GlassCard className="p-4 flex items-center justify-between border-black/5 bg-white/60">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Total Sales Orders</p>
                      <p className="text-2xl font-black text-zinc-950 mt-1">{salesOrders.length}</p>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-zinc-100 text-zinc-700">
                      <ShoppingCart className="size-5" />
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 flex items-center justify-between border-amber-200 bg-amber-50/50">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Pending Approval</p>
                      <p className="text-2xl font-black text-amber-950 mt-1">{pendingOrders.length}</p>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800">
                      <Clock className="size-5" />
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 flex items-center justify-between border-emerald-200 bg-emerald-50/50">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Approved Orders</p>
                      <p className="text-2xl font-black text-emerald-950 mt-1">{approvedOrders.length}</p>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="size-5" />
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 flex items-center justify-between border-rose-200 bg-rose-50/50">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Declined Orders</p>
                      <p className="text-2xl font-black text-rose-950 mt-1">{declinedOrders.length}</p>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-800">
                      <X className="size-5" />
                    </div>
                  </GlassCard>
                </div>

                {/* Filter & Search Toolbar */}
                <GlassCard className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-black/5">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                      <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search order ID, customer, warehouse..."
                        value={approvalSearch}
                        onChange={(e) => setApprovalSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/[0.04] border border-black/5 text-xs font-bold outline-none placeholder:text-zinc-400"
                      />
                    </div>
                  </div>

                  {/* Status Filter Buttons */}
                  <div className="flex items-center gap-1.5 p-1 bg-black/[0.04] rounded-xl w-full md:w-auto overflow-x-auto">
                    {[
                      { key: "ALL", label: `All (${salesOrders.length})` },
                      { key: "Pending", label: `Pending (${pendingOrders.length})` },
                      { key: "Approved", label: `Approved (${approvedOrders.length})` },
                      { key: "Declined", label: `Declined (${declinedOrders.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setApprovalFilter(tab.key)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                          approvalFilter === tab.key
                            ? "bg-zinc-950 text-white shadow-xs"
                            : "text-zinc-600 hover:text-zinc-950 hover:bg-white/60"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </GlassCard>

                {/* Approvals Table */}
                <GlassCard className="p-0 overflow-hidden border-black/5 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-black/5 bg-black/[0.02] text-[10px] text-zinc-400 font-black uppercase tracking-wider">
                          <th className="py-4 px-5">Order ID & Date</th>
                          <th className="py-4 px-4">Customer & Channel</th>
                          <th className="py-4 px-4">Warehouse & Terms</th>
                          <th className="py-4 px-4">Contract Items</th>
                          <th className="py-4 px-4 text-right">Amount (ETB)</th>
                          <th className="py-4 px-4">Attached Documents</th>
                          <th className="py-4 px-4 text-center">Approval Status</th>
                          <th className="py-4 px-5 text-right">Super Admin Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 text-xs font-medium">
                        {filteredApprovals.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-16 text-center text-xs font-bold text-zinc-400">
                              No sales orders match your approval filter criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredApprovals.map((so) => {
                            const status = so.approvalStatus || "Pending"
                            const docs = soDocsMap[so.id] || []
                            const isWh1Order = isWH1(so.warehouse)
                            const tradeDoc = docs.find((d) => 
                              isWh1Order 
                                ? (d.document_type === "Bank Permit" || d.document_type === "Trade Paper" || d.document_type === "Trade License") 
                                : (d.document_type === "Trade License" || d.document_type === "Trade Paper")
                            )
                            const adviceDoc = docs.find((d) => d.document_type === "Payment Advice")
                            const isCredit = so.paymentType === "Credit"
                            const isProcessing = isProcessingAction === so.id

                            return (
                              <tr key={so.id} className="hover:bg-black/[0.015] transition-colors">
                                <td className="py-4 px-5">
                                  <span className="font-mono font-black text-xs text-zinc-950 block">{so.id}</span>
                                  <span className="text-[10px] text-zinc-400 font-medium">{so.date || "Recent"}</span>
                                </td>

                                <td className="py-4 px-4">
                                  <span className="font-bold text-zinc-900 block">{so.customer}</span>
                                  <span className="text-[10px] text-zinc-500 font-medium">Customer Order</span>
                                </td>

                                <td className="py-4 px-4">
                                  <span className="font-semibold text-zinc-800 block">{so.warehouse}</span>
                                  <span className={cn(
                                    "inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase mt-0.5",
                                    isCredit ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                                  )}>
                                    {isCredit ? "Credit" : "Sales"}
                                  </span>
                                </td>

                                <td className="py-4 px-4">
                                  <span className="font-bold text-zinc-800 block">
                                    {so.items.length} {so.items.length === 1 ? "Line Item" : "Line Items"}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 truncate max-w-[140px] block">
                                    {so.items.map((i) => i.name).join(", ")}
                                  </span>
                                </td>

                                <td className="py-4 px-4 text-right font-mono">
                                  <span className="font-black text-zinc-950 block">{so.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                  <span className="text-[9px] text-zinc-400 font-medium">ETB Gross</span>
                                </td>

                                <td className="py-4 px-4">
                                  <div className="flex flex-col gap-1">
                                    {tradeDoc ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPreviewDocUrl(tradeDoc.file_url)
                                          setPreviewDocName(tradeDoc.file_name || (isWh1Order ? "Bank Permit.pdf" : "Trade License.pdf"))
                                        }}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                                      >
                                        <FileText className="size-3 text-emerald-600" />
                                        <span className="max-w-[100px] truncate">{tradeDoc.file_name || (isWh1Order ? "Bank Permit" : "Trade License")}</span>
                                        <Eye className="size-2.5 opacity-60" />
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                                        <AlertCircle className="size-3 text-amber-500" /> No {isWh1Order ? "Bank Permit" : "Trade License"}
                                      </span>
                                    )}

                                    {adviceDoc ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPreviewDocUrl(adviceDoc.file_url)
                                          setPreviewDocName(adviceDoc.file_name || "Payment Advice.pdf")
                                        }}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                                      >
                                        <FileText className="size-3 text-blue-600" />
                                        <span className="max-w-[100px] truncate">{adviceDoc.file_name || "Payment Advice"}</span>
                                        <Eye className="size-2.5 opacity-60" />
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                                        <AlertCircle className="size-3 text-amber-500" /> No Payment Advice
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Approval Status Indicator */}
                                <td className="py-4 px-4 text-center">
                                  {status === "Approved" ? (
                                    <div className="flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        <CheckCircle2 className="size-3 text-emerald-600" /> Approved
                                      </span>
                                      {so.approvedBy && (
                                        <span className="text-[9px] text-zinc-400 font-medium mt-0.5">by {so.approvedBy}</span>
                                      )}
                                    </div>
                                  ) : status === "Declined" ? (
                                    <div className="flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200" title={so.declineReason || "Declined"}>
                                        <X className="size-3 text-rose-600" /> Declined
                                      </span>
                                      {so.declineReason && (
                                        <span className="text-[9px] text-rose-600 font-semibold max-w-[120px] truncate mt-0.5" title={so.declineReason}>
                                          {so.declineReason}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                      <Clock className="size-3 text-amber-600" /> Pending Approval
                                    </span>
                                  )}
                                </td>

                                {/* Action Buttons */}
                                <td className="py-4 px-5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    {status !== "Approved" && (
                                      <button
                                        type="button"
                                        disabled={isProcessing}
                                        onClick={() => setApproveModalOrder(so)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-2xs disabled:opacity-50 cursor-pointer"
                                        title="Approve Sales Order"
                                      >
                                        <Check className="size-3 text-emerald-700" /> Approve
                                      </button>
                                    )}

                                    {/* View Details Button */}
                                    <button
                                      type="button"
                                      onClick={() => setViewModalOrder(so)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                                      title="View Full Order Details"
                                    >
                                      <Eye className="size-3 text-zinc-700" /> View
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Approve Confirmation Modal */}
      <AnimatePresence>
        {approveModalOrder && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-4 text-zinc-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 text-emerald-700">
                  <div className="p-2 rounded-2xl bg-emerald-100">
                    <CheckCircle2 className="size-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-950">Approve Sales Order</h3>
                    <p className="text-[11px] font-bold text-zinc-400">Confirmation Required</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setApproveModalOrder(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-bold">Order ID:</span>
                  <span className="font-mono font-black text-zinc-900">{approveModalOrder.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-bold">Customer:</span>
                  <span className="font-bold text-zinc-900 truncate max-w-[200px]">{approveModalOrder.customer}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-bold">Warehouse & Terms:</span>
                  <span className="font-bold text-zinc-800">{approveModalOrder.warehouse} • {approveModalOrder.paymentType === "Cash" ? "Sales" : "Credit"}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-zinc-200">
                  <span className="text-zinc-700 font-black">Total Contract Amount:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    ETB {Number(approveModalOrder.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                Approving this order will unlock it in <span className="font-bold text-zinc-950">Sales Issue</span>, allowing warehouse operators to pull and fulfill the items.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setApproveModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction === approveModalOrder.id}
                  onClick={handleConfirmApprove}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Check className="size-4 stroke-[3]" /> Confirm Approval
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Decline Confirmation Modal */}
      <AnimatePresence>
        {declineModalOrder && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-4 text-zinc-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="p-2 rounded-2xl bg-rose-100">
                    <AlertCircle className="size-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-950">Decline Sales Order</h3>
                    <p className="text-[11px] font-bold text-zinc-400">Lock Order Fulfillment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeclineModalOrder(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs font-semibold text-zinc-600 leading-relaxed">
                You are declining Sales Order <span className="font-mono font-bold text-zinc-950">{declineModalOrder.id}</span> for <span className="font-bold text-zinc-950">{declineModalOrder.customer}</span> (ETB {Number(declineModalOrder.amount || 0).toLocaleString()}). This will lock the order from being issued.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Decline Reason / Feedback Notes:
                </label>
                <textarea
                  rows={3}
                  value={declineReasonText}
                  onChange={(e) => setDeclineReasonText(e.target.value)}
                  placeholder="Provide a reason for declining..."
                  className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold outline-none resize-none focus:border-zinc-400 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setDeclineModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction === declineModalOrder.id}
                  onClick={handleConfirmDecline}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  Confirm Decline
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Full Sales Order Details Modal */}
      <AnimatePresence>
        {viewModalOrder && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-5 text-zinc-900 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-zinc-950 font-mono">{viewModalOrder.id}</h3>
                    {(() => {
                      const status = viewModalOrder.approvalStatus || "Pending"
                      if (status === "Approved") {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="size-3 text-emerald-600" /> Approved
                          </span>
                        )
                      }
                      if (status === "Declined") {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            <X className="size-3 text-rose-600" /> Declined
                          </span>
                        )
                      }
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <Clock className="size-3 text-amber-600" /> Pending Super Admin Approval
                        </span>
                      )
                    })()}
                  </div>
                  <p className="text-xs font-semibold text-zinc-500 mt-0.5">Created on {viewModalOrder.date} • Warehouse: {viewModalOrder.warehouse}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewModalOrder(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Customer & Order Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Building2 className="size-3 text-zinc-500" /> Customer Information
                  </p>
                  <p className="text-sm font-black text-zinc-950">{viewModalOrder.customer}</p>
                  <div className="space-y-1 text-xs text-zinc-600 font-medium">
                    {viewModalOrder.customerPhone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-zinc-400" /> {viewModalOrder.customerPhone}
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-500 font-semibold">
                      Account Type: {viewModalOrder.customerGroup || "Direct Client"}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <FileText className="size-3 text-zinc-500" /> Payment & Logistics
                  </p>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-500">Payment Method:</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-black",
                        viewModalOrder.paymentType === "Credit" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                      )}>
                        {viewModalOrder.paymentType || "Cash"}
                      </span>
                      {viewModalOrder.paymentType === "Credit" && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          (viewModalOrder.remainingBalance ?? 0) <= 0 && (viewModalOrder.paidAmount ?? 0) > 0
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : (viewModalOrder.paidAmount ?? 0) > 0
                            ? "bg-amber-50 text-amber-900 border-amber-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        )}>
                          {(viewModalOrder.remainingBalance ?? 0) <= 0 && (viewModalOrder.paidAmount ?? 0) > 0
                            ? "Fully Settled"
                            : (viewModalOrder.paidAmount ?? 0) > 0
                            ? `Ongoing (${Math.round(((viewModalOrder.paidAmount || 0) / (viewModalOrder.amount || 1)) * 100)}% Paid)`
                            : "Unpaid"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-500">Sales Officer:</span>
                    <span className="text-zinc-900 font-bold">{viewModalOrder.salesPerson || "HKC Sales Rep"}</span>
                  </div>
                  {viewModalOrder.approvedBy && (
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-500">Approved By:</span>
                      <span className="text-emerald-700 font-bold">{viewModalOrder.approvedBy}</span>
                    </div>
                  )}
                  {viewModalOrder.declineReason && (
                    <div className="text-xs pt-1 border-t border-zinc-200">
                      <span className="text-rose-700 font-bold">Decline Reason: </span>
                      <span className="text-zinc-700">{viewModalOrder.declineReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-zinc-900 mb-2">
                  Contract Line Items ({(viewModalOrder.items || []).length})
                </p>
                <div className="border border-zinc-200 rounded-2xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-100 text-zinc-600 font-bold uppercase text-[9px]">
                      <tr>
                        <th className="px-3.5 py-2.5">Product Name</th>
                        <th className="px-3.5 py-2.5 text-center">Quantity</th>
                        <th className="px-3.5 py-2.5 text-right">Unit Price (ETB)</th>
                        <th className="px-3.5 py-2.5 text-right">Total (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {(viewModalOrder.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="px-3.5 py-2.5 font-bold text-zinc-900">{item.name}</td>
                          <td className="px-3.5 py-2.5 text-center font-mono font-bold">{item.qty} {item.unit || "units"}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono">{Number(item.unitPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-black text-zinc-950">
                            {Number(item.total || item.qty * item.unitPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 border-t border-zinc-200 font-mono font-black text-xs">
                      <tr>
                        <td colSpan={3} className="px-3.5 py-2.5 text-right font-sans font-black text-zinc-700">
                          Total Contract Amount:
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-emerald-800 text-sm">
                          ETB {Number(viewModalOrder.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Attached Documents */}
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-zinc-900 mb-2">
                  Attached Shipment Documents
                </p>
                {(() => {
                  const docs = soDocsMap[viewModalOrder.id] || []
                  const tradeDoc = docs.find((d) => d.document_type === "Trade License" || d.document_type === "Trade Paper")
                  const adviceDoc = docs.find((d) => d.document_type === "Payment Advice")
                  const isCredit = viewModalOrder.paymentType === "Credit"

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Trade License Card */}
                      <div className="p-3 rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className="size-4 text-emerald-600" />
                          <div>
                            <p className="text-xs font-bold text-zinc-900">Trade License</p>
                            <p className="text-[10px] text-zinc-500">{tradeDoc?.file_name || "Document verification"}</p>
                          </div>
                        </div>
                        {tradeDoc?.file_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(tradeDoc.file_url)
                              setPreviewDocName(tradeDoc.file_name || "Trade License.pdf")
                            }}
                            className="px-3 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-[11px] font-bold text-emerald-700 transition-colors shadow-2xs cursor-pointer"
                          >
                            Preview Doc
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Missing
                          </span>
                        )}
                      </div>

                      {/* Payment Advice Card */}
                      <div className="p-3 rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className="size-4 text-blue-600" />
                          <div>
                            <p className="text-xs font-bold text-zinc-900">Payment Advice</p>
                            <p className="text-[10px] text-zinc-500">{adviceDoc?.file_name || (isCredit ? "Not required for credit sale" : "Mandatory for cash sales")}</p>
                          </div>
                        </div>
                        {isCredit ? (
                          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-200 px-2 py-0.5 rounded-full">
                            Optional (Credit)
                          </span>
                        ) : adviceDoc?.file_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(adviceDoc.file_url)
                              setPreviewDocName(adviceDoc.file_name || "Payment Advice.pdf")
                            }}
                            className="px-3 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-[11px] font-bold text-blue-700 transition-colors shadow-2xs cursor-pointer"
                          >
                            Preview Doc
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Missing
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Bottom Actions inside View Modal */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setViewModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  {viewModalOrder.approvalStatus !== "Declined" && (
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenDeclineModal(viewModalOrder)
                        setViewModalOrder(null)
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition-all shadow-2xs cursor-pointer"
                    >
                      Decline Order
                    </button>
                  )}
                  {viewModalOrder.approvalStatus !== "Approved" && (
                    <button
                      type="button"
                      onClick={() => {
                        setApproveModalOrder(viewModalOrder)
                        setViewModalOrder(null)
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="size-4 stroke-[3]" /> Approve Order
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDocUrl}
        onClose={() => {
          setPreviewDocUrl("")
          setPreviewDocName("")
        }}
        fileUrl={previewDocUrl}
        fileName={previewDocName}
      />
    </div>
  )
}
