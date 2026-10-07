import { useEffect, useState, useMemo } from "react"
import { Wallet, Calendar, ArrowUpRight, DollarSign, TrendingUp, TrendingDown, BarChart3, RefreshCw, Package, ChevronLeft, ChevronRight } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFinanceStore, isCogsAccount } from "@/lib/financeStore"
import { erpStore } from "@/lib/erpStore"
import { cn } from "@/lib/utils"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Link } from "react-router-dom"

import { Skeleton } from "@/components/ui/skeleton"

export default function FinanceOverview() {
  const store = useFinanceStore()
  const isLoading = store.isLoading()

  useEffect(() => {
    void store.loadFromApi(false)
    void erpStore.loadInventoryData(false)
    void erpStore.loadSalesData(false)
  }, [])

  const invoices = store.getInvoices()
  const journalLines = store.getJournalEntryLines()
  const journalEntries = store.getJournalEntries()
  const accounts = store.getAccounts()
  const salesIssues = erpStore.getSalesIssues()

  const accountById = useMemo(() => {
    const map = new Map<string, any>()
    for (const account of accounts) {
      if (account.id) {
        map.set(account.id, account)
        map.set(account.id.replace(/^ACC-/, ""), account)
        map.set(`ACC-${account.id}`, account)
      }
      if (account.code) {
        map.set(account.code, account)
        map.set(account.code.replace(/^ACC-/, ""), account)
        map.set(`ACC-${account.code}`, account)
      }
    }
    return map
  }, [accounts])

  const entryById = useMemo(() => new Map(journalEntries.map((entry) => [entry.id, entry])), [journalEntries])

  const rawMetrics = store.getFinancialMetrics()

  // Calculate robust fallback from invoices & sales issues if GL lines are not yet populated
  const hasGlMetrics = rawMetrics.totalRevenue > 0 || rawMetrics.totalCogs > 0 || rawMetrics.cashPosition !== 0
  
  const { totalRevenue, totalCogs, grossProfit, grossMargin, cashPosition, isCashNegative } = useMemo(() => {
    let rev = rawMetrics.totalRevenue
    let cogs = rawMetrics.totalCogs
    let gp = rawMetrics.grossProfit
    let gm = rawMetrics.grossMargin
    let cash = rawMetrics.cashPosition
    let isNeg = rawMetrics.isCashNegative

    if (!hasGlMetrics) {
      const activeIssues = salesIssues.filter((si) => si.status !== "Cancelled")
      let fbRevenue = activeIssues.reduce((sum, si) => sum + Number(si.total_amount || 0), 0)
      if (fbRevenue === 0 && invoices.length > 0) {
        fbRevenue = invoices.filter((i) => i.status !== "Void").reduce((sum, i) => sum + Number(i.total || (i as any).total_amount || 0), 0)
      }

      let fbCogs = 0
      let fbCash = 0
      activeIssues.forEach((si) => {
        const entries = typeof si.account_entries === "string" ? JSON.parse(si.account_entries) : si.account_entries
        if (entries?.cogs_lines) {
          fbCogs += entries.cogs_lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0)
        } else if (Array.isArray(si.items)) {
          si.items.forEach((it: any) => {
            fbCogs += Number(it.quantity || 0) * Number(it.unit_cost || it.cost_price || 0)
          })
        }
        if (si.payment_type === "Cash" || si.payment_status === "Paid") {
          fbCash += Number(si.total_amount || 0)
        }
      })

      const fbGp = Math.max(0, fbRevenue - fbCogs)
      const fbGm = fbRevenue > 0 ? (fbGp / fbRevenue) * 100 : 0

      rev = fbRevenue
      cogs = fbCogs
      gp = fbGp
      gm = Math.round(fbGm * 10) / 10
      cash = fbCash
      isNeg = cash < 0
    }

    return {
      totalRevenue: rev,
      totalCogs: cogs,
      grossProfit: gp,
      grossMargin: gm,
      cashPosition: cash,
      isCashNegative: isNeg,
    }
  }, [hasGlMetrics, rawMetrics, salesIssues, invoices])

  const cashFlowData = useMemo(() => {
    const entryYears = new Set<number>()
    for (const entry of journalEntries) {
      if (entry.entry_date) {
        const y = parseInt(entry.entry_date.slice(0, 4), 10)
        if (!isNaN(y)) entryYears.add(y)
      }
    }
    for (const si of salesIssues) {
      const d = si.sale_date || (si as any).created_at
      if (d) {
        const y = parseInt(String(d).slice(0, 4), 10)
        if (!isNaN(y)) entryYears.add(y)
      }
    }
    const currentYear = new Date().getFullYear()
    if (entryYears.size === 0) entryYears.add(currentYear)
    const sortedYears = [...entryYears].sort((a, b) => a - b)

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const cashFlowByMonth = new Map<string, { monthKey: string; name: string; Revenue: number; Expenses: number; COGS: number; NetProfit: number }>()

    for (const yr of sortedYears) {
      for (let m = 1; m <= 12; m++) {
        const monthStr = m.toString().padStart(2, "0")
        const key = `${yr}-${monthStr}`
        const label = sortedYears.length > 1 ? `${monthNames[m - 1]} '${yr.toString().slice(2)}` : monthNames[m - 1]
        cashFlowByMonth.set(key, {
          monthKey: key,
          name: label,
          Revenue: 0,
          Expenses: 0,
          COGS: 0,
          NetProfit: 0,
        })
      }
    }

    let hasGlChartData = false
    for (const line of journalLines) {
      const entry = entryById.get(line.journal_entry_id)
      const cleanAccountId = line.account_id ? String(line.account_id).trim() : ""
      const account = accountById.get(cleanAccountId) || accountById.get(cleanAccountId.replace(/^ACC-/, "")) || accountById.get(`ACC-${cleanAccountId}`)
      if (!entry || !account || !entry.entry_date) continue
      const monthKey = String(entry.entry_date).slice(0, 7)
      let row = cashFlowByMonth.get(monthKey)
      if (!row) {
        const mIdx = parseInt(monthKey.slice(5, 7), 10) - 1
        row = {
          monthKey,
          name: monthNames[mIdx] || monthKey,
          Revenue: 0,
          Expenses: 0,
          COGS: 0,
          NetProfit: 0,
        }
        cashFlowByMonth.set(monthKey, row)
      }

      if (account.account_type === "Revenue" || account.code?.startsWith("4")) {
        row.Revenue += line.credit_amount - line.debit_amount
        hasGlChartData = true
      } else if (account.account_type === "Expense" || account.code?.startsWith("5") || account.code?.startsWith("6") || account.code?.startsWith("7")) {
        const amt = line.debit_amount - line.credit_amount
        row.Expenses += amt
        if (isCogsAccount(account)) {
          row.COGS += amt
        }
        hasGlChartData = true
      }
      row.NetProfit = row.Revenue - row.Expenses
    }

    if (!hasGlChartData && salesIssues.length > 0) {
      for (const si of salesIssues) {
        if (si.status === "Cancelled") continue
        const dateStr = si.sale_date || (si as any).created_at
        if (!dateStr) continue
        const monthKey = String(dateStr).slice(0, 7)
        let row = cashFlowByMonth.get(monthKey)
        if (!row) {
          const mIdx = parseInt(monthKey.slice(5, 7), 10) - 1
          row = {
            monthKey,
            name: monthNames[mIdx] || monthKey,
            Revenue: 0,
            Expenses: 0,
            COGS: 0,
            NetProfit: 0,
          }
          cashFlowByMonth.set(monthKey, row)
        }

        const revAmt = Number(si.total_amount || 0)
        row.Revenue += revAmt

        const entries = typeof si.account_entries === "string" ? JSON.parse(si.account_entries) : si.account_entries
        let cogsAmt = 0
        if (entries?.cogs_lines) {
          cogsAmt = entries.cogs_lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0)
        } else if (Array.isArray(si.items)) {
          si.items.forEach((it: any) => {
            cogsAmt += Number(it.quantity || 0) * Number(it.unit_cost || it.cost_price || 0)
          })
        }
        row.Expenses += cogsAmt
        row.COGS += cogsAmt
        row.NetProfit = row.Revenue - row.Expenses
      }
    }

    return [...cashFlowByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value)
  }, [journalEntries, journalLines, salesIssues, accountById, entryById])

  // --- Items Sold Graph & Analytics State ---
  const currentMonthStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }, [])

  const [activeChartTab, setActiveChartTab] = useState<"cash_flow" | "items_sold">("cash_flow")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)
  const [selectedWeek, setSelectedWeek] = useState<"all" | "1" | "2" | "3" | "4">("all")
  const [itemsViewMode, setItemsViewMode] = useState<"by_item" | "by_week">("by_item")

  // Discover all distinct months from sales issues and journal entries
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    set.add(currentMonthStr)
    salesIssues.forEach((si) => {
      const d = si.sale_date || (si as any).created_at
      if (d && String(d).length >= 7) {
        set.add(String(d).slice(0, 7))
      }
    })
    return Array.from(set).sort().reverse()
  }, [salesIssues, currentMonthStr])

  // Helper for previous/next month navigation
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number)
    const prevDate = new Date(y, m - 2, 1)
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`)
  }

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number)
    const nextDate = new Date(y, m, 1)
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`)
  }

  // Format month label (e.g. October 2026)
  const selectedMonthDisplay = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    if (isNaN(y) || isNaN(m)) return selectedMonth
    const d = new Date(y, m - 1, 1)
    return d.toLocaleString("default", { month: "long", year: "numeric" })
  }, [selectedMonth])

  // Aggregate items sold data filtered by month, warehouse, and week
  const itemsSoldChartData = useMemo(() => {
    const itemMap = new Map<string, {
      name: string
      quantity: number
      packagingUnit: string
      totalValue: number
      w1Qty: number
      w2Qty: number
      w3Qty: number
      w4Qty: number
    }>()

    let totalVolumeInFilter = 0

    salesIssues.forEach((si) => {
      if (si.status === "Cancelled") return

      const dateStr = String(si.sale_date || (si as any).created_at || "")
      if (!dateStr.startsWith(selectedMonth)) return

      // Warehouse filter
      const wh = String(si.warehouse_id || "").toUpperCase()
      if (selectedWarehouse !== "all") {
        if (selectedWarehouse === "WH1" && !wh.includes("WH1") && !wh.includes("EXP")) return
        if (selectedWarehouse === "WH2" && !wh.includes("WH2")) return
        if (selectedWarehouse === "WH3" && !wh.includes("WH3")) return
      }

      // Determine week number (1 to 4+)
      const dayOfMonth = parseInt(dateStr.slice(8, 10), 10) || 1
      let weekNum: "1" | "2" | "3" | "4" = "1"
      if (dayOfMonth <= 7) weekNum = "1"
      else if (dayOfMonth <= 14) weekNum = "2"
      else if (dayOfMonth <= 21) weekNum = "3"
      else weekNum = "4"

      // Filter by selected week if active
      if (selectedWeek !== "all" && weekNum !== selectedWeek) return

      if (Array.isArray(si.items)) {
        si.items.forEach((item: any) => {
          const rawName = String(item.item_name || item.name || "Unknown Item").trim()
          const qty = Number(item.quantity || item.qty || 0)
          const unitPrice = Number(item.unit_price || item.unitPrice || 0)
          const amount = Number(item.amount || item.total || (qty * unitPrice))
          const packUnit = item.packaging_unit || item.unit || "Units"

          if (!itemMap.has(rawName)) {
            itemMap.set(rawName, {
              name: rawName,
              quantity: 0,
              packagingUnit: packUnit,
              totalValue: 0,
              w1Qty: 0,
              w2Qty: 0,
              w3Qty: 0,
              w4Qty: 0,
            })
          }

          const record = itemMap.get(rawName)!
          record.quantity += qty
          record.totalValue += amount
          totalVolumeInFilter += qty

          if (weekNum === "1") record.w1Qty += qty
          else if (weekNum === "2") record.w2Qty += qty
          else if (weekNum === "3") record.w3Qty += qty
          else record.w4Qty += qty
        })
      }
    })

    const sorted = Array.from(itemMap.values())
      .map((item) => ({
        ...item,
        sharePercent: totalVolumeInFilter > 0 ? Math.round((item.quantity / totalVolumeInFilter) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)

    return {
      topItems: sorted.slice(0, 10),
      totalVolume: totalVolumeInFilter,
      distinctItemCount: sorted.length,
      weeklySummary: [
        { name: "Week 1 (1–7)", quantity: sorted.reduce((s, i) => s + i.w1Qty, 0), value: 0 },
        { name: "Week 2 (8–14)", quantity: sorted.reduce((s, i) => s + i.w2Qty, 0), value: 0 },
        { name: "Week 3 (15–21)", quantity: sorted.reduce((s, i) => s + i.w3Qty, 0), value: 0 },
        { name: "Week 4+ (22–End)", quantity: sorted.reduce((s, i) => s + i.w4Qty, 0), value: 0 },
      ],
    }
  }, [salesIssues, selectedMonth, selectedWarehouse, selectedWeek])

  // Unpaid invoices
  const unpaidInvoices = invoices.filter((inv) => inv.balance_due > 0)
  const totalReceivables = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0)

  // Timeline strip items sorted by due date
  const sortedInvoiceTimeline = [...invoices]
    .filter((inv) => inv.status !== "Void")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        store.reloadFromApi(),
        erpStore.loadInventoryData(true),
        erpStore.loadSalesData(true)
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      {store.getLoadError() && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-800 shadow-lg flex items-center gap-3">
            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            Server unavailable — finance data cannot be loaded. {store.getLoadError()}
          </div>
        </div>
      )}

      <div className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Finance Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Real-time treasury status, profitability and cash flow insights.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 bg-white/80 hover:bg-zinc-50 text-xs font-bold text-zinc-700 shadow-sm cursor-pointer transition-all disabled:opacity-50"
              title="Refresh Finance Metrics & Chart"
            >
              <RefreshCw className={cn("size-3.5 text-zinc-500", (isRefreshing || isLoading) && "animate-spin")} />
              Sync
            </button>
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </div>

        {/* Executive Profitability & Treasury Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Operating Revenue */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Operating Revenue</span>
                <div className="size-7 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="size-4" />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 bg-zinc-200/80 my-1" />
              ) : (
                <div className="flex items-baseline gap-1.5 mt-1 min-w-0 overflow-hidden">
                  <span className="text-xs font-extrabold text-emerald-800/70 font-sans tracking-wide shrink-0">
                    ETB
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-emerald-700 truncate" title={`ETB ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                    {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 font-medium">Posted sales & revenue</p>
          </GlassCard>

          {/* Card 2: Cost of Goods Sold */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Cost of Goods Sold</span>
                <div className="size-7 rounded-lg bg-rose-100/80 text-rose-700 flex items-center justify-center">
                  <TrendingDown className="size-4" />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 bg-zinc-200/80 my-1" />
              ) : (
                <div className="flex items-baseline gap-1.5 mt-1 min-w-0 overflow-hidden">
                  <span className="text-xs font-extrabold text-rose-800/70 font-sans tracking-wide shrink-0">
                    ETB
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-rose-600 truncate" title={`ETB (${totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}>
                    ({totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 font-medium">Direct inventory cost (COGS)</p>
          </GlassCard>

          {/* Card 3: Gross Profit & Margin */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Gross Profit</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                    {grossMargin.toFixed(1)}%
                  </span>
                  <div className="size-7 rounded-lg bg-teal-100/80 text-teal-700 flex items-center justify-center">
                    <TrendingUp className="size-4" />
                  </div>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 bg-zinc-200/80 my-1" />
              ) : (
                <div className="flex items-baseline gap-1.5 mt-1 min-w-0 overflow-hidden">
                  <span className="text-xs font-extrabold text-zinc-500 font-sans tracking-wide shrink-0">
                    ETB
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-zinc-900 truncate" title={`ETB ${grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                    {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 font-medium">Gross surplus (Revenue - COGS)</p>
          </GlassCard>

          {/* Card 4: Liquid Cash Position */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Cash Position</span>
                <div className={cn(
                  "size-7 rounded-lg flex items-center justify-center",
                  isCashNegative ? "bg-amber-100/80 text-amber-700" : "bg-emerald-100/80 text-emerald-700"
                )}>
                  <Wallet className="size-4" />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 bg-zinc-200/80 my-1" />
              ) : (
                <div className="flex items-baseline gap-1.5 mt-1 min-w-0 overflow-hidden">
                  <span className={cn(
                    "text-xs font-extrabold font-sans tracking-wide shrink-0",
                    isCashNegative ? "text-amber-800/70" : "text-emerald-800/70"
                  )}>
                    ETB
                  </span>
                  <span
                    className={cn(
                      "text-lg sm:text-xl font-black font-mono truncate",
                      isCashNegative ? "text-amber-700" : "text-emerald-700"
                    )}
                    title={`ETB ${isCashNegative ? `(${Math.abs(cashPosition).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : cashPosition.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  >
                    {isCashNegative
                      ? `(${Math.abs(cashPosition).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                      : cashPosition.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            <p className={cn("text-[11px] mt-2 font-medium", isCashNegative ? "text-amber-600 font-bold" : "text-gray-400")}>
              {isCashNegative ? "Net Cash Outflow / Overdraft" : "Liquid cash & bank reserves"}
            </p>
          </GlassCard>
        </div>

        {/* Slim horizontal timeline strip showing invoice due dates across upcoming months */}
        <GlassCard className="mb-6 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-emerald-700" />
              <h3 className="text-xs font-black text-black uppercase tracking-wider">Invoice Due Dates Timeline</h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">Upcoming Billing Schedule</span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="shrink-0 p-3 rounded-2xl border min-w-[210px] bg-white/50 border-black/5 space-y-2">
                  <Skeleton className="h-3 w-20 bg-zinc-200/80" />
                  <Skeleton className="h-4 w-32 bg-zinc-200/80" />
                  <Skeleton className="h-3 w-24 bg-zinc-200/80" />
                </div>
              ))
            ) : (
              sortedInvoiceTimeline.map((inv) => {
                const isOverdue = inv.status === "Overdue"
                const isPaid = inv.status === "Paid" || Number(inv.balance_due ?? 0) <= 0
                const displayAmt = isPaid ? Number(inv.total || inv.amount_paid || 0) : Number(inv.balance_due || inv.total || 0)
                return (
                  <div
                    key={inv.id}
                    className={`shrink-0 p-3 rounded-2xl border min-w-[210px] transition-all ${
                      isOverdue
                        ? "bg-red-50/60 border-red-200 text-red-950"
                        : isPaid
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                        : "bg-white/80 border-black/10 text-black"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-gray-500">{inv.invoice_number}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        isOverdue
                          ? "bg-red-100 text-red-700"
                          : isPaid
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {isPaid ? "Paid" : inv.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold truncate">{inv.customer_name}</p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5 text-[10px]">
                      <span className="text-gray-400 font-semibold">{isPaid ? `Paid on ${inv.issue_date}` : `Due ${inv.due_date}`}</span>
                      <span className="font-mono font-black text-xs">
                        ETB {displayAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </GlassCard>

        {/* Mid grid: Cash Flow Chart + Unpaid Invoices List */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 mb-6">
          {/* Revenue vs Expenses vs Net Profit Chart OR Items Sold Volume Bar Graph */}
          <GlassCard>
            {/* Top Header & View Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-black/5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-black">
                    {activeChartTab === "cash_flow" ? "Cash Flow & Profit Trends" : "Items Sold & Volume Analytics"}
                  </h3>
                  {activeChartTab === "items_sold" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {selectedMonthDisplay}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeChartTab === "cash_flow"
                    ? "Monthly breakdown of operating revenue, costs, and net operating income"
                    : `Breakdown of physical quantities sold across warehouses for ${selectedMonthDisplay}`}
                </p>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1 p-1 bg-black/5 rounded-2xl shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveChartTab("cash_flow")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    activeChartTab === "cash_flow" ? "bg-white text-black shadow-xs" : "text-gray-500 hover:text-black"
                  )}
                >
                  <TrendingUp className="size-3.5 text-emerald-600" />
                  Cash Flow
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartTab("items_sold")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    activeChartTab === "items_sold" ? "bg-white text-black shadow-xs" : "text-gray-500 hover:text-black"
                  )}
                >
                  <BarChart3 className="size-3.5 text-indigo-600" />
                  Items Sold
                </button>
              </div>
            </div>

            {/* Filter Controls Bar (Visible when Items Sold tab is active) */}
            {activeChartTab === "items_sold" && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                {/* Month Stepper & Picker */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    className="p-1.5 rounded-xl hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white border border-zinc-200 text-xs font-black text-zinc-900 rounded-xl px-2.5 py-1.5 shadow-2xs outline-none cursor-pointer"
                  >
                    {availableMonths.map((m) => {
                      const [yr, mo] = m.split("-").map(Number)
                      const d = new Date(yr, mo - 1, 1)
                      const label = d.toLocaleString("default", { month: "short", year: "numeric" })
                      return (
                        <option key={m} value={m}>
                          {label} {m === currentMonthStr ? "• Current" : ""}
                        </option>
                      )
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    className="p-1.5 rounded-xl hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                {/* Warehouse & Week Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Warehouse Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">WH:</span>
                    <select
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                      className="bg-white border border-zinc-200 text-xs font-bold text-zinc-800 rounded-xl px-2 py-1.5 shadow-2xs outline-none cursor-pointer"
                    >
                      <option value="all">All Warehouses</option>
                      <option value="WH1">WH1 • Export & Cleaning</option>
                      <option value="WH2">WH2 • Central Vet Pharma</option>
                      <option value="WH3">WH3 • Branch Vet Pharma</option>
                    </select>
                  </div>

                  {/* Regional Week Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Week:</span>
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value as any)}
                      className="bg-white border border-zinc-200 text-xs font-bold text-zinc-800 rounded-xl px-2 py-1.5 shadow-2xs outline-none cursor-pointer"
                    >
                      <option value="all">All 4 Weeks</option>
                      <option value="1">Week 1 (Days 1–7)</option>
                      <option value="2">Week 2 (Days 8–14)</option>
                      <option value="3">Week 3 (Days 15–21)</option>
                      <option value="4">Week 4+ (Days 22–End)</option>
                    </select>
                  </div>

                  {/* Mode Toggle: Top Items vs 4 Weeks */}
                  <div className="flex items-center gap-1 p-0.5 bg-zinc-200/60 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setItemsViewMode("by_item")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                        itemsViewMode === "by_item" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-black"
                      )}
                    >
                      Top Items
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemsViewMode("by_week")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                        itemsViewMode === "by_week" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-black"
                      )}
                    >
                      4 Regional Weeks
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1 CONTENT: Cash Flow & Profit Trends AreaChart */}
            {activeChartTab === "cash_flow" && (
              <>
                <div className="flex items-center justify-end gap-4 text-xs font-semibold mb-4">
                  <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#18181b]" /> Revenue</div>
                  <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-500" /> Expenses</div>
                  <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-600" /> Net Profit</div>
                </div>
                <div className="h-[300px]">
                  {cashFlowData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs font-medium text-gray-400">
                      No posted revenue or expense activity yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#18181b" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          stroke="#888"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => {
                            if (Math.abs(val) >= 1000000) return `ETB ${(val / 1000000).toFixed(1)}M`
                            if (Math.abs(val) >= 1000) return `ETB ${(val / 1000).toFixed(0)}k`
                            return `ETB ${val}`
                          }}
                        />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            `ETB ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            name === "NetProfit" || name === "Net Profit" ? "Net Operating Income" : name
                          ]}
                          labelStyle={{ fontWeight: 800, color: "#18181b", marginBottom: "4px" }}
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.96)",
                            backdropFilter: "blur(8px)",
                            borderRadius: "14px",
                            border: "1px solid rgba(0, 0, 0, 0.08)",
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                            padding: "10px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        />
                        <Area type="monotone" dataKey="Revenue" stroke="#18181b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                        <Area type="monotone" dataKey="NetProfit" name="Net Profit" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}

            {/* TAB 2 CONTENT: Items Sold BarChart */}
            {activeChartTab === "items_sold" && (
              <div className="h-[300px]">
                {itemsSoldChartData.topItems.length === 0 ? (
                  <div className="flex flex-col h-full items-center justify-center text-center p-6 text-gray-400">
                    <Package className="size-8 text-zinc-300 mb-2" />
                    <p className="text-xs font-bold text-zinc-600">No Sales Dispatches Found for {selectedMonthDisplay}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      No posted sales issues match warehouse ({selectedWarehouse}) in this time window.
                    </p>
                  </div>
                ) : itemsViewMode === "by_week" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={itemsSoldChartData.weeklySummary} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: any) => [`${Number(value || 0).toLocaleString()} units`, "Volume Sold"]}
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.96)",
                          backdropFilter: "blur(8px)",
                          borderRadius: "14px",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                          padding: "10px 14px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      />
                      <Bar dataKey="quantity" name="Quantity Sold" fill="#059669" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={itemsSoldChartData.topItems.map((item) => ({
                        name: item.name.length > 18 ? `${item.name.slice(0, 16)}…` : item.name,
                        fullName: item.name,
                        quantity: item.quantity,
                        packagingUnit: item.packagingUnit,
                        totalValue: item.totalValue,
                        sharePercent: item.sharePercent,
                      }))}
                      margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis
                        dataKey="name"
                        stroke="#888"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-black/10 shadow-xl text-xs space-y-1">
                                <p className="font-black text-black">{data.fullName}</p>
                                <p className="font-mono text-emerald-700 font-extrabold">
                                  {Number(data.quantity).toLocaleString()} {data.packagingUnit}
                                </p>
                                <p className="text-[11px] text-zinc-500 font-semibold">
                                  Gross Value: ETB {Number(data.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] text-zinc-400 font-bold">
                                  Share of Period Sales: {data.sharePercent}%
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="quantity" name="Quantity Sold" fill="#059669" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </GlassCard>

          {/* Unpaid Invoices List Card */}
          <GlassCard className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-base text-black">Unpaid Invoices</h3>
                  <p className="text-xs text-gray-400">Customer balances awaiting collection</p>
                </div>
                <Link to="/finance/invoices" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-0.5">
                  View Invoices <ArrowUpRight className="size-3.5" />
                </Link>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                {unpaidInvoices.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">No outstanding unpaid invoices.</p>
                ) : (
                  unpaidInvoices.map((inv) => {
                    let statusClass = "bg-zinc-100 text-zinc-700"
                    if (inv.status === "Overdue") statusClass = "bg-red-100 text-red-800"
                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/5 hover:bg-black/[0.04] transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] font-bold text-gray-400">{inv.invoice_number}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusClass}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-black">{inv.customer_name}</p>
                          <p className="text-[10px] text-gray-400 font-medium">Due: {inv.due_date}</p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black font-mono block text-rose-700">
                            ETB {Number(inv.balance_due || (inv as any).balanceDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase">Total Receivables</span>
              <span className="text-base font-black font-mono text-black">
                ETB {totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
