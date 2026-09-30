import { useEffect } from "react"
import { Wallet, Calendar, ArrowUpRight, DollarSign, TrendingUp, TrendingDown, BarChart3 } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFinanceStore, isCogsAccount } from "@/lib/financeStore"
import { erpStore } from "@/lib/erpStore"
import { cn } from "@/lib/utils"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Link } from "react-router-dom"

import { Skeleton } from "@/components/ui/skeleton"

export default function FinanceOverview() {
  const store = useFinanceStore()
  const isLoading = store.isLoading()

  useEffect(() => {
    void store.loadFromApi()
    void erpStore.loadInventoryData()
    void erpStore.loadSalesData()
  }, [])

  const invoices = store.getInvoices()
  const journalLines = store.getJournalEntryLines()
  const journalEntries = store.getJournalEntries()
  const accounts = store.getAccounts()
  const accountById = new Map(accounts.flatMap((account) => [[account.id, account], [account.code, account]]))
  const entryById = new Map(journalEntries.map((entry) => [entry.id, entry]))

  const {
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMargin,
    netProfit,
    netMargin,
    cashPosition,
    isCashNegative,
  } = store.getFinancialMetrics()

  // Find distinct years from journal entries or fallback to current year
  const entryYears = new Set<number>()
  for (const entry of journalEntries) {
    if (entry.entry_date) {
      const y = parseInt(entry.entry_date.slice(0, 4), 10)
      if (!isNaN(y)) entryYears.add(y)
    }
  }
  const currentYear = new Date().getFullYear()
  if (entryYears.size === 0) entryYears.add(currentYear)
  const sortedYears = [...entryYears].sort((a, b) => a - b)

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const cashFlowByMonth = new Map<string, { monthKey: string; name: string; Revenue: number; Expenses: number; COGS: number; NetProfit: number }>()

  // Initialize all 12 months for the fiscal year so the chart renders a continuous baseline
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

  for (const line of journalLines) {
    const entry = entryById.get(line.journal_entry_id)
    const account = accountById.get(line.account_id)
    if (!entry || !account || !entry.entry_date) continue
    const monthKey = entry.entry_date.slice(0, 7)
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

    if (account.account_type === "Revenue") {
      row.Revenue += line.credit_amount - line.debit_amount
    } else if (account.account_type === "Expense") {
      const amt = line.debit_amount - line.credit_amount
      row.Expenses += amt
      if (isCogsAccount(account)) {
        row.COGS += amt
      }
    }
    row.NetProfit = row.Revenue - row.Expenses
  }

  const cashFlowData = [...cashFlowByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)

  // Unpaid invoices
  const unpaidInvoices = invoices.filter((inv) => inv.balance_due > 0)
  const totalReceivables = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0)

  // Timeline strip items sorted by due date
  const sortedInvoiceTimeline = [...invoices]
    .filter((inv) => inv.status !== "Void")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

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
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </div>

        {/* Executive Profitability & Treasury Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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

          {/* Card 4: Net Operating Income (EBIT) */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Net Operating Income</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                    {netMargin.toFixed(1)}%
                  </span>
                  <div className="size-7 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center">
                    <BarChart3 className="size-4" />
                  </div>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 bg-zinc-200/80 my-1" />
              ) : (
                <div className="flex items-baseline gap-1.5 mt-1 min-w-0 overflow-hidden">
                  <span className="text-xs font-extrabold text-emerald-800/70 font-sans tracking-wide shrink-0">
                    ETB
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-emerald-800 truncate" title={`ETB ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                    {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 font-medium">Bottom line profit (EBIT)</p>
          </GlassCard>

          {/* Card 5: Liquid Cash Position */}
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
          {/* Revenue vs Expenses vs Net Profit Chart */}
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-base text-black">Cash Flow & Profit Trends</h3>
                <p className="text-xs text-gray-400">Monthly breakdown of operating revenue, costs, and net operating income</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#18181b]" /> Revenue</div>
                <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-500" /> Expenses</div>
                <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-600" /> Net Profit</div>
              </div>
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
