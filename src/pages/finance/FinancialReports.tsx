import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Scale,
  Download,
  BookOpen,
  CheckCircle2,
  Landmark,
  TrendingUp,
  Coins,
  Building2,
  Receipt,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore } from "@/lib/financeStore"
import { exportToExcel } from "@/lib/exportUtils"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { isDateInPreset } from "@/lib/peachtreeExportUtils"
import { Skeleton } from "@/components/ui/skeleton"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

export type ReportTab = "GL" | "TrialBalance" | "BalanceSheet" | "IncomeStatement" | "CashFlow"

export default function FinancialReports() {
  const { showToast } = useFeedback()
  const store = useFinanceStore()
  const isLoading = store.isLoading()

  const [activeTab, setActiveTab] = useState<ReportTab>("GL")

  // General Ledger Filters State
  const [glAccountFilter, setGlAccountFilter] = useState<string>("ALL")
  const [glVoucherTypeFilter, setGlVoucherTypeFilter] = useState<string>("ALL")
  const [glDateFilter, setGlDateFilter] = useState<string>("ALL")
  const [glCustomStart, setGlCustomStart] = useState<string>("")
  const [glCustomEnd, setGlCustomEnd] = useState<string>("")
  const [glSearchQuery, setGlSearchQuery] = useState<string>("")

  const glColumns: TableColumn[] = [
    { key: "entry_date", label: "Posting Date", align: "left" },
    { key: "account", label: "Account", align: "left" },
    { key: "source_type", label: "Voucher Type", align: "left" },
    { key: "source_id", label: "Voucher No", align: "left" },
    { key: "party", label: "Party", align: "left" },
    { key: "description", label: "Remarks", align: "left" },
    { key: "against_account", label: "Against Account", align: "left" },
    { key: "debit_amount", label: "Debit (ETB)", align: "right" },
    { key: "credit_amount", label: "Credit (ETB)", align: "right" },
    { key: "running_balance", label: "Running Balance", align: "right" },
  ]

  // Data from store
  const accounts = store.getAccounts()
  const entries = store.getJournalEntries()
  const lines = store.getJournalEntryLines()

  // Trial Balance Filters State
  const [tbCategoryFilter, setTbCategoryFilter] = useState<string>("ALL")
  const [tbBalanceFilter, setTbBalanceFilter] = useState<string>("ALL")
  const [tbDateFilter, setTbDateFilter] = useState<string>("ALL")
  const [tbCustomStart, setTbCustomStart] = useState<string>("")
  const [tbCustomEnd, setTbCustomEnd] = useState<string>("")
  const [tbSearchTerm, setTbSearchTerm] = useState<string>("")

  const tbColumns: TableColumn[] = [
    { key: "code", label: "Account Code", align: "left" },
    { key: "name", label: "Account Name", align: "left" },
    { key: "account_type", label: "Category", align: "left" },
    { key: "debit_sum", label: "Debit Sum (ETB)", align: "right" },
    { key: "credit_sum", label: "Credit Sum (ETB)", align: "right" },
    { key: "net_balance", label: "Net Balance (ETB)", align: "right" },
    { key: "balance_type", label: "Balance Status", align: "center" },
  ]

  // Dynamic Trial Balance Calculation (filtered by Date preset / custom)
  const trialBalance = useMemo(() => {
    const accountMap = new Map<
      string,
      { code: string; name: string; account_type: string; debit_sum: number; credit_sum: number }
    >()

    accounts.forEach((acc) => {
      accountMap.set(acc.id, {
        code: acc.code,
        name: acc.name,
        account_type: acc.account_type,
        debit_sum: 0,
        credit_sum: 0,
      })
    })

    lines.forEach((line) => {
      const parentEntry = entries.find((e) => e.id === line.journal_entry_id)
      if (!parentEntry) return
      if (!isDateInPreset(parentEntry.entry_date, tbDateFilter, tbCustomStart, tbCustomEnd)) return

      let acc = accountMap.get(line.account_id)
      if (!acc) {
        const matched = accounts.find((a) => a.code === line.account_id || a.id === line.account_id)
        if (matched) {
          acc = accountMap.get(matched.id)
        }
      }
      if (acc) {
        acc.debit_sum += line.debit_amount
        acc.credit_sum += line.credit_amount
      }
    })

    const rows = Array.from(accountMap.entries()).map(([id, val]) => ({
      account_id: id,
      code: val.code,
      name: val.name,
      account_type: val.account_type,
      debit_sum: Math.round(val.debit_sum * 100) / 100,
      credit_sum: Math.round(val.credit_sum * 100) / 100,
      net_balance: Math.round((val.debit_sum - val.credit_sum) * 100) / 100,
    }))

    const totalDebits = Math.round(rows.reduce((sum, r) => sum + r.debit_sum, 0) * 100) / 100
    const totalCredits = Math.round(rows.reduce((sum, r) => sum + r.credit_sum, 0) * 100) / 100
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

    return { rows, totalDebits, totalCredits, isBalanced }
  }, [accounts, lines, entries, tbDateFilter, tbCustomStart, tbCustomEnd])

  const filteredTbRows = trialBalance.rows.filter((r) => {
    if (tbCategoryFilter !== "ALL" && r.account_type !== tbCategoryFilter) return false
    if (tbBalanceFilter === "NON_ZERO" && r.debit_sum === 0 && r.credit_sum === 0 && r.net_balance === 0) return false
    if (tbBalanceFilter === "DEBIT_ONLY" && r.debit_sum <= 0 && r.net_balance <= 0) return false
    if (tbBalanceFilter === "CREDIT_ONLY" && r.credit_sum <= 0 && r.net_balance >= 0) return false
    if (tbSearchTerm.trim()) {
      const q = tbSearchTerm.toLowerCase()
      const matches =
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.account_type.toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  })

  const tbTable = useResizableTable<any>(
    tbColumns,
    filteredTbRows,
    {
      code: 110,
      name: 240,
      account_type: 130,
      debit_sum: 140,
      credit_sum: 140,
      net_balance: 150,
      balance_type: 120,
    }
  )

  const sortedTbRows = tbTable.sorted()

  const tbFilteredTotalDebits = sortedTbRows.reduce((s, r) => s + r.debit_sum, 0)
  const tbFilteredTotalCredits = sortedTbRows.reduce((s, r) => s + r.credit_sum, 0)

  // GL Engine Calculations
  const allGlTransactions = lines
    .map((line) => {
      const parentEntry = entries.find((e) => e.id === line.journal_entry_id)
      if (!parentEntry) return null

      const accountObj = accounts.find(
        (a) => a.id === line.account_id || a.code === line.account_id
      )

      const contraLines = lines.filter(
        (l) => l.journal_entry_id === line.journal_entry_id && l.id !== line.id
      )
      const contraAccountNames = Array.from(
        new Set(
          contraLines.map((cl) => {
            const acc = accounts.find((a) => a.id === cl.account_id || a.code === cl.account_id)
            return acc ? `${acc.code} ${acc.name}` : cl.account_id
          })
        )
      ).join(", ")

      return {
        id: line.id,
        journal_entry_id: parentEntry.id,
        entry_date: parentEntry.entry_date,
        source_type: parentEntry.source_type,
        source_id: parentEntry.source_id || parentEntry.id,
        description: parentEntry.description,
        account_id: line.account_id,
        account_code: accountObj?.code || line.account_id,
        account_name: accountObj?.name || "Account",
        account_type: accountObj?.account_type || "Asset",
        party_type: line.party_type,
        party_name: line.party_name || (line.party_type ? `${line.party_type}: ${line.party_id}` : null),
        against_account: contraAccountNames || "N/A",
        debit_amount: line.debit_amount,
        credit_amount: line.credit_amount,
        currency: line.currency || "ETB",
      }
    })
    .filter((tx): tx is NonNullable<typeof tx> => tx !== null)

  const uniqueVoucherTypes = Array.from(
    new Set(allGlTransactions.map((tx) => tx.source_type))
  )

  const filteredGlTransactions = allGlTransactions.filter((tx) => {
    if (glAccountFilter !== "ALL") {
      if (tx.account_id !== glAccountFilter && tx.account_code !== glAccountFilter) {
        return false
      }
    }
    if (glVoucherTypeFilter !== "ALL") {
      if (tx.source_type !== glVoucherTypeFilter) {
        return false
      }
    }
    if (!isDateInPreset(tx.entry_date, glDateFilter, glCustomStart, glCustomEnd)) {
      return false
    }

    if (glSearchQuery.trim()) {
      const q = glSearchQuery.toLowerCase()
      const matches =
        tx.source_id.toLowerCase().includes(q) ||
        tx.journal_entry_id.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        tx.account_code.toLowerCase().includes(q) ||
        tx.account_name.toLowerCase().includes(q) ||
        (tx.party_name && tx.party_name.toLowerCase().includes(q)) ||
        tx.against_account.toLowerCase().includes(q)
      if (!matches) return false
    }

    return true
  })

  let runningBal = 0
  const glRowsWithRunningBalance = filteredGlTransactions.map((tx) => {
    if (tx.account_type === "Asset" || tx.account_type === "Expense") {
      runningBal += tx.debit_amount - tx.credit_amount
    } else {
      runningBal += tx.credit_amount - tx.debit_amount
    }
    return {
      ...tx,
      account: `${tx.account_code} - ${tx.account_name}`,
      running_balance: runningBal,
    }
  })

  const glTable = useResizableTable<any>(
    glColumns,
    glRowsWithRunningBalance,
    {
      entry_date: 125,
      account: 170,
      source_type: 120,
      source_id: 110,
      party: 130,
      description: 180,
      against_account: 150,
      debit_amount: 115,
      credit_amount: 115,
      running_balance: 145,
    }
  )

  const sortedGlTransactions = glTable.sorted()

  const glTotalDebit = sortedGlTransactions.reduce((s, tx) => s + tx.debit_amount, 0)
  const glTotalCredit = sortedGlTransactions.reduce((s, tx) => s + tx.credit_amount, 0)

  const accountsByType = {
    Asset: accounts.filter((a) => a.account_type === "Asset"),
    Liability: accounts.filter((a) => a.account_type === "Liability"),
    Equity: accounts.filter((a) => a.account_type === "Equity"),
    Revenue: accounts.filter((a) => a.account_type === "Revenue"),
    Expense: accounts.filter((a) => a.account_type === "Expense"),
  }

  const accountBalance = (account: typeof accounts[number]) => lines.filter((line) => line.account_id === account.id).reduce((total, line) => total + (account.account_type === "Asset" || account.account_type === "Expense" ? line.debit_amount - line.credit_amount : line.credit_amount - line.debit_amount), 0)
  const totalAssets = accountsByType.Asset.reduce((s, account) => s + accountBalance(account), 0)
  const totalLiabilities = accountsByType.Liability.reduce((s, account) => s + accountBalance(account), 0)
  const totalEquity = accountsByType.Equity.reduce((s, account) => s + accountBalance(account), 0)
  const totalRevenue = accountsByType.Revenue.reduce((s, account) => s + accountBalance(account), 0)
  const totalExpenses = accountsByType.Expense.reduce((s, account) => s + accountBalance(account), 0)
  const netIncome = totalRevenue - totalExpenses
  const cogsTotal = accountsByType.Expense.filter((account) => /^6|^5/i.test(account.code) || account.peachtree_type === "Cost of Sales" || /cogs|cost of/i.test(account.name)).reduce((total, account) => total + accountBalance(account), 0)
  const operatingExpenseTotal = totalExpenses - cogsTotal
  const monthlyReports = new Map<string, { month: string; revenue: number; cogs: number; expenses: number; netProfit: number; operating: number; investing: number; financing: number; netCash: number; cashBalance: number }>()
  let cumulativeCash = 0
  for (const transaction of [...allGlTransactions].sort((a, b) => a.entry_date.localeCompare(b.entry_date))) {
    const month = transaction.entry_date.slice(0, 7)
    const row = monthlyReports.get(month) || { month, revenue: 0, cogs: 0, expenses: 0, netProfit: 0, operating: 0, investing: 0, financing: 0, netCash: 0, cashBalance: 0 }
    if (transaction.account_type === "Revenue") row.revenue += transaction.credit_amount - transaction.debit_amount
    if (transaction.account_type === "Expense") {
      const amount = transaction.debit_amount - transaction.credit_amount
      if (/^6|^5/i.test(transaction.account_code) || /cogs|cost of/i.test(transaction.account_name)) row.cogs += amount
      else row.expenses += amount
    }
    if (transaction.account_type === "Asset" && (transaction.account_code.startsWith("1000") || /cash|bank/i.test(transaction.account_name))) row.operating += transaction.debit_amount - transaction.credit_amount
    monthlyReports.set(month, row)
  }
  const plMonthlyTrendData = [...monthlyReports.values()].map((row) => ({ ...row, netProfit: row.revenue - row.cogs - row.expenses }))
  for (const row of plMonthlyTrendData) { cumulativeCash += row.operating; row.netCash = row.operating + row.investing + row.financing; row.cashBalance = cumulativeCash }
  const cashFlowTrendData = plMonthlyTrendData.map((row) => ({ period: row.month, operating: row.operating, investing: row.investing, financing: row.financing, netCash: row.netCash, cashBalance: row.cashBalance }))
  const chartColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"]
  const plExpenseCategoryData = accountsByType.Expense.map((account, index) => ({ name: `${account.code} ${account.name}`, value: accountBalance(account), color: chartColors[index % chartColors.length] })).filter((item) => item.value !== 0)

  return (
    <div className="min-h-screen page-gradient text-black">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      {store.getLoadError() && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-800 shadow-lg flex items-center gap-3">
            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            Server unavailable — financial reports cannot be loaded. {store.getLoadError()}
          </div>
        </div>
      )}

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12"
      >
        {/* Page Title & SubPageNav Header */}
        <motion.div variants={fade} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Financial Reports & Statements</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              AR/AP aging, ledger logs, trial balance, and statements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </motion.div>

        {/* Tab Selection Bar */}
        <motion.div variants={fade} className="flex border-b border-zinc-200/60 mb-6 pb-px items-center justify-between overflow-x-auto scrollbar-none">
          <div className="flex gap-1 min-w-max">
            {[
              { id: "GL", label: "General Ledger", icon: BookOpen },
              { id: "TrialBalance", label: "Trial Balance", icon: Scale },
              { id: "BalanceSheet", label: "Balance Sheet", icon: Landmark },
              { id: "IncomeStatement", label: "Profit & Loss", icon: TrendingUp },
              { id: "CashFlow", label: "Cash Flow", icon: Coins },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black relative tracking-tight transition-colors uppercase whitespace-nowrap cursor-pointer"
                >
                  <Icon className={`size-3.5 ${isActive ? "text-emerald-600" : "text-zinc-400"}`} />
                  <span className={isActive ? "text-zinc-950 font-black" : "text-zinc-400 hover:text-zinc-700"}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="reports-tabs"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Tab Contents */}
        <AnimatePresence mode="wait">
          {/* TAB 0: General Ledger (ERPNext Account-Wise Detailed Report) */}
          {activeTab === "GL" && (
            <motion.div
              key="gl-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {/* Summary Metric Strip - Standardized 3 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Debits Posted</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      ETB {glTotalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Across all active account lines</span>
                </GlassCard>
                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Credits Posted</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      ETB {glTotalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Across all active account lines</span>
                </GlassCard>
                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Running Balance</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-zinc-950 font-mono mt-1">
                      ETB {runningBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Cumulative ledger position</span>
                </GlassCard>
              </div>

              {/* General Ledger Table with Integrated Filter Parameters */}
              <GlassCard className="flex flex-col p-0">
                <div className="px-6 pt-6">
                  <FinanceTableToolbar
                    title="General Ledger Transactions"
                    subtitle={`${glRowsWithRunningBalance.length} accounting entries posted across all chart of accounts`}
                    searchValue={glSearchQuery}
                    onSearchChange={setGlSearchQuery}
                    searchPlaceholder="Search ref #, desc, account..."
                    dateFilter={{
                      value: glDateFilter,
                      onChange: setGlDateFilter,
                      startDate: glCustomStart,
                      endDate: glCustomEnd,
                      onCustomDateChange: (start, end) => {
                        setGlCustomStart(start)
                        setGlCustomEnd(end)
                      },
                    }}
                    filters={[
                      {
                        value: glAccountFilter,
                        onChange: setGlAccountFilter,
                        ariaLabel: "Account filter",
                        options: [
                          { value: "ALL", label: "All Accounts" },
                          ...accounts.map((a) => ({ value: a.code, label: `${a.code} - ${a.name}` })),
                        ],
                      },
                      {
                        value: glVoucherTypeFilter,
                        onChange: setGlVoucherTypeFilter,
                        ariaLabel: "Voucher type filter",
                        options: [
                          { value: "ALL", label: "All Vouchers" },
                          ...uniqueVoucherTypes.map((v) => ({ value: v, label: v })),
                        ],
                      },
                    ]}
                    actions={[
                      {
                        label: `Export (${glRowsWithRunningBalance.length})`,
                        onClick: () => {
                          exportToExcel({
                            fileName: `HKC_General_Ledger_Report_${new Date().toISOString().split("T")[0]}`,
                            title: "HKC Trading - General Ledger Detailed Report",
                            headers: ["Posting Date", "Voucher ID", "Voucher Type", "Account", "Party", "Description", "Debit (ETB)", "Credit (ETB)", "Balance (ETB)"],
                            rows: glRowsWithRunningBalance.map((r: any) => [
                              r.entry_date,
                              r.source_id,
                              r.source_type,
                              `${r.account_code} - ${r.account_name}`,
                              r.party_name || "—",
                              r.description,
                              r.debit_amount || 0,
                              r.credit_amount || 0,
                              r.running_balance || 0,
                            ]),
                          })
                          showToast("Report Exported", "success", `Exported ${glRowsWithRunningBalance.length} GL records to Excel.`)
                        },
                        icon: <Download className="size-3.5" />,
                        variant: "emeraldLight",
                      },
                    ]}
                  />
                </div>

                {/* Table View */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider select-none">
                        {glColumns.map((col) => (
                          <ResizableTh
                            key={col.key}
                            col={col}
                            width={glTable.colWidths[col.key] ?? 140}
                            sortKey={glTable.sortKey}
                            sortDir={glTable.sortDir}
                            openMenuCol={glTable.openMenuCol}
                            onResizeStart={glTable.handleResizeStart}
                            onToggleMenu={glTable.toggleMenu}
                            onSortAsc={glTable.setSortAsc}
                            onSortDesc={glTable.setSortDesc}
                            onClearSort={glTable.clearSort}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {isLoading ? (
                        Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse text-xs">
                            {glColumns.map((col) => (
                              <td key={col.key} className="px-3 py-3.5">
                                <Skeleton
                                  className={`h-4 ${
                                    col.align === "right"
                                      ? "w-20 ml-auto"
                                      : col.align === "center"
                                      ? "w-16 mx-auto"
                                      : "w-28"
                                  } bg-zinc-200/80`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : sortedGlTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={glColumns.length} className="px-4 py-12 text-center text-xs font-bold text-zinc-400">
                            No general ledger entries found matching the current filter criteria.
                          </td>
                        </tr>
                      ) : (
                        sortedGlTransactions.map((row) => (
                          <tr key={row.id} className="hover:bg-zinc-50/60 transition-colors text-xs">
                            <td
                              style={{ width: `${glTable.colWidths.entry_date ?? 125}px` }}
                              className="px-3 py-3 font-mono text-zinc-800 whitespace-nowrap truncate"
                            >
                              {row.entry_date}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.account ?? 170}px` }}
                              className="px-3 py-3 whitespace-nowrap truncate"
                            >
                              <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px] mr-1">
                                {row.account_code}
                              </span>
                              <span className="font-semibold text-zinc-800">{row.account_name}</span>
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.source_type ?? 120}px` }}
                              className="px-3 py-3 whitespace-nowrap text-[11px] font-semibold text-zinc-600 truncate"
                            >
                              {row.source_type}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.source_id ?? 110}px` }}
                              className="px-3 py-3 whitespace-nowrap font-mono font-bold text-emerald-700 truncate"
                            >
                              {row.source_id}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.party ?? 130}px` }}
                              className="px-3 py-3 whitespace-nowrap truncate"
                            >
                              {row.party_name ? (
                                <span className="inline-block font-sans text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded truncate">
                                  {row.party_name}
                                </span>
                              ) : (
                                <span className="text-zinc-300">-</span>
                              )}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.description ?? 180}px` }}
                              className="px-3 py-3 text-[11px] text-zinc-600 truncate"
                            >
                              {row.description}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.against_account ?? 150}px` }}
                              className="px-3 py-3 text-[11px] text-zinc-600 truncate font-mono"
                            >
                              {row.against_account}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.debit_amount ?? 115}px` }}
                              className="px-3 py-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap truncate"
                            >
                              {row.debit_amount > 0
                                ? row.debit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                : "-"}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.credit_amount ?? 115}px` }}
                              className="px-3 py-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap truncate"
                            >
                              {row.credit_amount > 0
                                ? row.credit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                : "-"}
                            </td>
                            <td
                              style={{ width: `${glTable.colWidths.running_balance ?? 145}px` }}
                              className="px-3 py-3 text-right font-mono font-black text-emerald-800 whitespace-nowrap bg-emerald-50/20 truncate"
                            >
                              ETB {row.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}
          {/* TAB 3: Trial Balance */}
          {activeTab === "TrialBalance" && (
            <motion.div
              key="tb-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {/* Summary Metric Strip - 3 Standard KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Debits</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      ETB {trialBalance.totalDebits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">All debit account lines</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Credits</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      ETB {trialBalance.totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">All credit account lines</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trial Balance Health</span>
                    {isLoading ? (
                      <Skeleton className="h-5 w-20 rounded-full bg-zinc-200/80" />
                    ) : (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${
                        trialBalance.isBalanced ? "text-emerald-700 bg-emerald-100/80 border border-emerald-200" : "text-rose-700 bg-rose-100/80 border border-rose-200"
                      }`}>
                        {trialBalance.isBalanced ? "BALANCED" : "IMBALANCED"}
                      </span>
                    )}
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-zinc-900 font-mono mt-1">
                      ETB {Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Net difference (should be 0.00)</span>
                </GlassCard>
              </div>

              {/* Table Container Card with Standard FinanceTableToolbar */}
              <GlassCard className="flex flex-col p-0">
                <div className="px-6 pt-6">
                  <FinanceTableToolbar
                    title="General Ledger Trial Balance Statement"
                    subtitle={`${sortedTbRows.length} accounts • ${trialBalance.isBalanced ? "Balanced" : "Imbalanced"}`}
                    searchValue={tbSearchTerm}
                    onSearchChange={setTbSearchTerm}
                    searchPlaceholder="Search code, name, category..."
                    dateFilter={{
                      value: tbDateFilter,
                      onChange: setTbDateFilter,
                      startDate: tbCustomStart,
                      endDate: tbCustomEnd,
                      onCustomDateChange: (start, end) => {
                        setTbCustomStart(start)
                        setTbCustomEnd(end)
                      },
                    }}
                    filters={[
                      {
                        value: tbCategoryFilter,
                        onChange: setTbCategoryFilter,
                        ariaLabel: "Category filter",
                        options: [
                          { value: "ALL", label: "All 5 Categories" },
                          { value: "Asset", label: "Assets" },
                          { value: "Liability", label: "Liabilities" },
                          { value: "Equity", label: "Equity" },
                          { value: "Revenue", label: "Revenue" },
                          { value: "Expense", label: "Expenses" },
                        ],
                      },
                      {
                        value: tbBalanceFilter,
                        onChange: setTbBalanceFilter,
                        ariaLabel: "Balance filter",
                        options: [
                          { value: "ALL", label: "All Accounts" },
                          { value: "NON_ZERO", label: "Non-Zero Balances Only" },
                          { value: "DEBIT_ONLY", label: "Debit Balances Only" },
                          { value: "CREDIT_ONLY", label: "Credit Balances Only" },
                        ],
                      },
                    ]}
                    actions={[
                      {
                        label: `Export (${sortedTbRows.length})`,
                        onClick: () => {
                          exportToExcel({
                            fileName: `HKC_Trial_Balance_${new Date().toISOString().split("T")[0]}`,
                            title: "HKC Trading - General Ledger Trial Balance",
                            headers: ["Account Code", "Account Name", "Category", "Debit (ETB)", "Credit (ETB)", "Net Balance (ETB)", "Status"],
                            rows: sortedTbRows.map((r) => [
                              r.code,
                              r.name,
                              r.account_type,
                              r.debit_sum,
                              r.credit_sum,
                              r.net_balance,
                              r.net_balance > 0 ? "Debit" : r.net_balance < 0 ? "Credit" : "Settled",
                            ]),
                          })
                          showToast("Trial Balance Exported", "success", `Exported ${sortedTbRows.length} accounts to Excel.`)
                        },
                        icon: <Download className="size-3.5" />,
                        variant: "emeraldLight",
                      },
                    ]}
                  />
                </div>

                {/* Resizable & Sortable Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider select-none">
                        {tbColumns.map((col) => (
                          <ResizableTh
                            key={col.key}
                            col={col}
                            width={tbTable.colWidths[col.key] ?? 140}
                            sortKey={tbTable.sortKey}
                            sortDir={tbTable.sortDir}
                            openMenuCol={tbTable.openMenuCol}
                            onResizeStart={tbTable.handleResizeStart}
                            onToggleMenu={tbTable.toggleMenu}
                            onSortAsc={tbTable.setSortAsc}
                            onSortDesc={tbTable.setSortDesc}
                            onClearSort={tbTable.clearSort}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs font-mono">
                      {isLoading ? (
                        Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse text-xs">
                            {tbColumns.map((col) => (
                              <td key={col.key} className="px-3 py-3">
                                <Skeleton
                                  className={`h-4 ${
                                    col.align === "right"
                                      ? "w-24 ml-auto"
                                      : col.align === "center"
                                      ? "w-16 mx-auto"
                                      : "w-32"
                                  } bg-zinc-200/80`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : sortedTbRows.length === 0 ? (
                        <tr>
                          <td colSpan={tbColumns.length} className="py-12 text-center text-zinc-400 font-sans font-bold">
                            No accounts match the selected category or filter criteria.
                          </td>
                        </tr>
                      ) : (
                        sortedTbRows.map((r) => {
                          const categoryStyleMap: Record<string, string> = {
                            Asset: "bg-emerald-100/80 text-emerald-800 border-emerald-200/80",
                            Liability: "bg-amber-100/80 text-amber-800 border-amber-200/80",
                            Equity: "bg-purple-100/80 text-purple-800 border-purple-200/80",
                            Revenue: "bg-teal-100/80 text-teal-800 border-teal-200/80",
                            Expense: "bg-rose-100/80 text-rose-800 border-rose-200/80",
                          }
                          const categoryStyle = categoryStyleMap[r.account_type] || "bg-zinc-100 text-zinc-800 border-zinc-200"

                          const isDebit = r.net_balance > 0 || (r.net_balance === 0 && r.debit_sum > r.credit_sum)
                          const isCredit = r.net_balance < 0 || (r.net_balance === 0 && r.credit_sum > r.debit_sum)

                          return (
                            <tr key={r.account_id} className="hover:bg-zinc-50/80 transition-colors">
                              {/* Account Code Column */}
                              <td style={{ width: `${tbTable.colWidths.code ?? 110}px` }} className="px-3 py-2.5">
                                <span className="font-mono font-black text-zinc-900 bg-zinc-200/90 px-1.5 py-0.5 rounded text-[11px]">
                                  {r.code}
                                </span>
                              </td>

                              {/* Account Name Column */}
                              <td style={{ width: `${tbTable.colWidths.name ?? 240}px` }} className="px-3 py-2.5 font-sans font-bold text-zinc-900 truncate">
                                {r.name}
                              </td>

                              {/* Account Category Column */}
                              <td style={{ width: `${tbTable.colWidths.account_type ?? 130}px` }} className="px-3 py-2.5 font-sans">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${categoryStyle}`}>
                                  {r.account_type}
                                </span>
                              </td>

                              {/* Debit Sum Column */}
                              <td style={{ width: `${tbTable.colWidths.debit_sum ?? 140}px` }} className="px-3 py-2.5 text-right font-bold text-zinc-900">
                                {r.debit_sum > 0 ? (
                                  `ETB ${r.debit_sum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                ) : (
                                  <span className="text-zinc-300 font-normal">-</span>
                                )}
                              </td>

                              {/* Credit Sum Column */}
                              <td style={{ width: `${tbTable.colWidths.credit_sum ?? 140}px` }} className="px-3 py-2.5 text-right font-bold text-zinc-900">
                                {r.credit_sum > 0 ? (
                                  `ETB ${r.credit_sum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                ) : (
                                  <span className="text-zinc-300 font-normal">-</span>
                                )}
                              </td>

                              {/* Net Balance Column */}
                              <td style={{ width: `${tbTable.colWidths.net_balance ?? 150}px` }} className="px-3 py-2.5 text-right font-black text-zinc-950">
                                ETB {r.net_balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* Balance Type Column */}
                              <td style={{ width: `${tbTable.colWidths.balance_type ?? 120}px` }} className="px-3 py-2.5 text-center font-sans">
                                {isDebit ? (
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                                    Debit Balance
                                  </span>
                                ) : isCredit ? (
                                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full">
                                    Credit Balance
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                                    Zero Balance
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 bg-zinc-100/90 font-mono font-black text-xs">
                        <td colSpan={3} className="px-3 py-3 font-sans text-zinc-900">
                          Filtered Summary Totals ({sortedTbRows.length} accounts)
                        </td>
                        <td className="px-3 py-3 text-right text-zinc-950">
                          ETB {tbFilteredTotalDebits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-right text-zinc-950">
                          ETB {tbFilteredTotalCredits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} className="px-3 py-3 text-right font-sans">
                          {trialBalance.isBalanced ? (
                            <span className="text-emerald-700 font-bold bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3.5" /> BALANCED
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-full text-[11px]">
                              IMBALANCED
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* TAB 4: Balance Sheet (Separate Assets, Liabilities, and Equity) */}
          {activeTab === "BalanceSheet" && (
            <motion.div
              key="balance-sheet-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {/* Header & KPI Cards Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Assets</span>
                    <Building2 className="size-4 text-emerald-600" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      ETB {totalAssets.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">1000 Series Account Ledger</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Liabilities</span>
                    <Receipt className="size-4 text-amber-600" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-amber-600 font-mono mt-1">
                      ETB {totalLiabilities.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">2000 Series Account Ledger</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Shareholder Equity</span>
                    <Landmark className="size-4 text-purple-600" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-purple-700 font-mono mt-1">
                      ETB {totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">3000 Series Account Ledger</span>
                </GlassCard>
              </div>

              {/* 3 Separate Cards Layout: 1. Assets, 2. Liabilities, 3. Equity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* CARD 1: ASSETS */}
                <GlassCard className="p-5 flex flex-col justify-between border-t-4 border-t-emerald-500 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 mb-3">
                      <div>
                        <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                          <Building2 className="size-4 text-emerald-600" /> Assets
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-medium">1000 Series Account Ledger</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Resources
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5 text-xs font-mono">
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-100/80 animate-pulse">
                            <div className="space-y-1">
                              <Skeleton className="h-3.5 w-28 bg-zinc-200/80" />
                              <Skeleton className="h-2.5 w-14 bg-zinc-200/80" />
                            </div>
                            <Skeleton className="h-4 w-20 bg-zinc-200/80" />
                          </div>
                        ))
                      ) : accountsByType.Asset.length === 0 ? (
                        <p className="text-zinc-400 text-[11px] italic py-2">No asset accounts recorded.</p>
                      ) : (
                        accountsByType.Asset.map((a) => {
                          const bal = accountBalance(a)
                          return (
                            <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-zinc-100/80 hover:bg-zinc-50/80 px-1 rounded transition-colors">
                              <div className="flex flex-col">
                                <span className="font-bold text-zinc-900 font-sans text-xs">{a.name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono">{a.code}</span>
                              </div>
                              <span className="font-black text-zinc-900">
                                ETB {bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t-2 border-zinc-200 flex justify-between items-center font-mono font-black text-sm text-emerald-800 bg-emerald-50/50 p-2.5 rounded-xl">
                    <span className="font-sans uppercase text-xs tracking-wider">Total Assets</span>
                    <span>ETB {totalAssets.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </GlassCard>

                {/* CARD 2: LIABILITIES */}
                <GlassCard className="p-5 flex flex-col justify-between border-t-4 border-t-amber-500 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 mb-3">
                      <div>
                        <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                          <Receipt className="size-4 text-amber-600" /> Liabilities
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-medium">2000 Series Account Ledger</p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-full">
                        Obligations
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5 text-xs font-mono">
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-100/80 animate-pulse">
                            <div className="space-y-1">
                              <Skeleton className="h-3.5 w-28 bg-zinc-200/80" />
                              <Skeleton className="h-2.5 w-14 bg-zinc-200/80" />
                            </div>
                            <Skeleton className="h-4 w-20 bg-zinc-200/80" />
                          </div>
                        ))
                      ) : accountsByType.Liability.length === 0 ? (
                        <p className="text-zinc-400 text-[11px] italic py-2">No liability accounts recorded.</p>
                      ) : (
                        accountsByType.Liability.map((a) => {
                          const bal = accountBalance(a)
                          return (
                            <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-zinc-100/80 hover:bg-zinc-50/80 px-1 rounded transition-colors">
                              <div className="flex flex-col">
                                <span className="font-bold text-zinc-900 font-sans text-xs">{a.name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono">{a.code}</span>
                              </div>
                              <span className="font-black text-zinc-900">
                                ETB {bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t-2 border-zinc-200 flex justify-between items-center font-mono font-black text-sm text-amber-900 bg-amber-50/50 p-2.5 rounded-xl">
                    <span className="font-sans uppercase text-xs tracking-wider">Total Liabilities</span>
                    <span>ETB {totalLiabilities.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </GlassCard>

                {/* CARD 3: EQUITY */}
                <GlassCard className="p-5 flex flex-col justify-between border-t-4 border-t-purple-500 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 mb-3">
                      <div>
                        <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                          <Landmark className="size-4 text-purple-600" /> Equity
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-medium">3000 Series Account Ledger</p>
                      </div>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 border border-purple-200 px-2 py-0.5 rounded-full">
                        Capital & Claims
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5 text-xs font-mono">
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-100/80 animate-pulse">
                            <div className="space-y-1">
                              <Skeleton className="h-3.5 w-28 bg-zinc-200/80" />
                              <Skeleton className="h-2.5 w-14 bg-zinc-200/80" />
                            </div>
                            <Skeleton className="h-4 w-20 bg-zinc-200/80" />
                          </div>
                        ))
                      ) : accountsByType.Equity.length === 0 ? (
                        <p className="text-zinc-400 text-[11px] italic py-2">No equity accounts recorded.</p>
                      ) : (
                        accountsByType.Equity.map((a) => {
                          const bal = accountBalance(a)
                          return (
                            <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-zinc-100/80 hover:bg-zinc-50/80 px-1 rounded transition-colors">
                              <div className="flex flex-col">
                                <span className="font-bold text-zinc-900 font-sans text-xs">{a.name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono">{a.code}</span>
                              </div>
                              <span className="font-black text-zinc-900">
                                ETB {bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t-2 border-zinc-200 flex justify-between items-center font-mono font-black text-sm text-purple-900 bg-purple-50/50 p-2.5 rounded-xl">
                    <span className="font-sans uppercase text-xs tracking-wider">Total Equity</span>
                    <span>ETB {totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </GlassCard>
              </div>

              {/* Balance Sheet Summary Card */}
              <GlassCard className="p-5 bg-white/80 backdrop-blur-md rounded-2xl shadow-xs border border-zinc-200/80">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 shrink-0">
                      <Scale className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                        Balance Sheet
                      </h4>
                      <p className="text-xs text-zinc-600 font-mono mt-0.5">
                        Assets (ETB {totalAssets.toLocaleString("en-US")}) = Liabilities (ETB {totalLiabilities.toLocaleString("en-US")}) + Equity (ETB {totalEquity.toLocaleString("en-US")})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Liabilities + Equity</span>
                      <span className="text-sm font-mono font-black text-emerald-700">
                        ETB {(totalLiabilities + totalEquity).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-600" /> Balanced
                    </span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* TAB 5: Profit & Loss Statement (ERPNext Aligned with Graphs) */}
          {activeTab === "IncomeStatement" && (
            <motion.div
              key="income-statement-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {/* Summary KPIs Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operating Revenue</span>
                    <ArrowUpRight className="size-4 text-emerald-600" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      ETB {totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Sales & Services (4000 Series)</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cost of Goods Sold</span>
                    <ArrowDownRight className="size-4 text-rose-600" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-rose-600 font-mono mt-1">
                      ETB ({cogsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Direct Materials & COGS (5000 Series)</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gross Profit Margin</span>
                    {isLoading ? (
                      <Skeleton className="h-5 w-14 rounded-full bg-zinc-200/80" />
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                        {totalRevenue ? (((totalRevenue - cogsTotal) / totalRevenue) * 100).toFixed(1) : "0.0"}%
                      </span>
                    )}
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-zinc-900 font-mono mt-1">
                      ETB {(totalRevenue - cogsTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Gross Surplus (Revenue - COGS)</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Operating Income</span>
                    <TrendingUp className="size-4 text-emerald-600" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-800 font-mono mt-1">
                      ETB {netIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1">Bottom Line Net Profit (EBIT)</span>
                </GlassCard>
              </div>

              {/* ERPNext Visual Analytics Section: Graphs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Graph 1: Revenue vs COGS vs Expenses Trend BarChart */}
                <GlassCard className="p-5 lg:col-span-2 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                        <BarChart3 className="size-4 text-emerald-600" /> Revenue, COGS & Profit Trends (YTD)
                      </h4>
                      <p className="text-[11px] text-zinc-500">Monthly breakdown of operating revenues, costs, and net margin output.</p>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full">
                      ERPNext Financial Analytics
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={plMonthlyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `ETB ${(val / 1000).toFixed(0)}k`} />
                        <RechartsTooltip
                          formatter={(value: any) => [`ETB ${Number(value).toLocaleString()}`, '']}
                          contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', color: '#ffffff', fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="revenue" name="Operating Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cogs" name="COGS" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Operating Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="netProfit" name="Net Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Graph 2: Operating Expense Allocation Breakdown Donut Chart */}
                <GlassCard className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                        <BarChart3 className="size-4 text-purple-600" /> Expense Allocation
                      </h4>
                      <p className="text-[11px] text-zinc-500">6000 Series Operating Expenses</p>
                    </div>
                  </div>

                  <div className="h-44 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={plExpenseCategoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {plExpenseCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val: any) => [`ETB ${Number(val).toLocaleString()}`, 'Amount']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col gap-1.5 text-[11px]">
                    {plExpenseCategoryData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-zinc-700 truncate max-w-[140px]">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-zinc-900">
                          ETB {(item.value / 1000).toFixed(0)}k
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>

              {/* Profit & Loss Detailed Statement Table (ERPNext Aligned Ledger Grouping) */}
              <GlassCard className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                  <div>
                    <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                      <TrendingUp className="size-5 text-emerald-600" /> ERPNext Statement of Profit & Loss (FY2026 YTD)
                    </h3>
                    <p className="text-xs text-zinc-500">Official ledger account breakdown by operating series.</p>
                  </div>
                  <span className="text-xs font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full">
                    Audited YTD Statement
                  </span>
                </div>

                <div className="flex flex-col gap-4 text-xs font-mono">
                  {/* Revenue Section */}
                  <div className="bg-zinc-50/80 p-4 rounded-xl border border-zinc-200/60">
                    <div className="flex justify-between items-center text-sm font-black text-zinc-900 uppercase font-sans mb-2 border-b border-zinc-200 pb-1.5">
                      <span>1. Operating Revenues (4000 Series)</span>
                      <span className="text-emerald-700 font-mono">ETB {totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {isLoading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex justify-between py-2 border-b border-zinc-100 animate-pulse">
                          <Skeleton className="h-3.5 w-40 bg-zinc-200/80" />
                          <Skeleton className="h-3.5 w-24 bg-zinc-200/80" />
                        </div>
                      ))
                    ) : (
                      accountsByType.Revenue.map((a) => (
                        <div key={a.id} className="flex justify-between py-1.5 border-b border-zinc-100 text-zinc-700">
                          <span>{a.code} - {a.name}</span>
                          <span className="font-bold text-zinc-900">
                            ETB {accountBalance(a).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Cost of Sales (6000 Series) Section */}
                  <div className="bg-zinc-50/80 p-4 rounded-xl border border-zinc-200/60">
                    <div className="flex justify-between items-center text-sm font-black text-zinc-900 uppercase font-sans mb-2 border-b border-zinc-200 pb-1.5">
                      <span>2. Cost of Sales / Selling & Distribution (6000 Series)</span>
                      <span className="text-rose-600 font-mono">ETB ({cogsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                    </div>
                    {isLoading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex justify-between py-2 border-b border-zinc-100 animate-pulse">
                          <Skeleton className="h-3.5 w-40 bg-zinc-200/80" />
                          <Skeleton className="h-3.5 w-24 bg-zinc-200/80" />
                        </div>
                      ))
                    ) : (
                      accountsByType.Expense.filter((a) => a.code.startsWith("6")).map((a) => (
                        <div key={a.id} className="flex justify-between py-1.5 border-b border-zinc-100 text-zinc-700">
                          <span>{a.code} - {a.name}</span>
                          <span className="font-bold text-rose-600">ETB ({accountBalance(a).toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Gross Profit Summary Bar */}
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-zinc-100 font-sans font-black text-sm text-zinc-950 border border-zinc-300">
                    <span>GROSS PROFIT MARGIN</span>
                    <span className="font-mono text-emerald-800 text-base">ETB {(totalRevenue - cogsTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Administrative & General Expenses (8000 Series) Section */}
                  <div className="bg-zinc-50/80 p-4 rounded-xl border border-zinc-200/60">
                    <div className="flex justify-between items-center text-sm font-black text-zinc-900 uppercase font-sans mb-2 border-b border-zinc-200 pb-1.5">
                      <span>3. Administrative & General Expenses (8000 Series)</span>
                      <span className="text-rose-600 font-mono">ETB ({operatingExpenseTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                    </div>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex justify-between py-2 border-b border-zinc-100 animate-pulse">
                          <Skeleton className="h-3.5 w-40 bg-zinc-200/80" />
                          <Skeleton className="h-3.5 w-24 bg-zinc-200/80" />
                        </div>
                      ))
                    ) : (
                      accountsByType.Expense.filter((a) => !a.code.startsWith("6")).map((a) => (
                        <div key={a.id} className="flex justify-between py-1.5 border-b border-zinc-100 text-zinc-700">
                          <span>{a.code} - {a.name}</span>
                          <span className="font-bold text-rose-600">
                            ETB ({accountBalance(a).toLocaleString("en-US", { minimumFractionDigits: 2 })})
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Net Operating Income Highlight */}
                  <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 font-sans font-black text-base shadow-xs">
                    <span className="uppercase tracking-wider text-emerald-950">NET OPERATING INCOME (EBIT)</span>
                    <span className="font-mono text-xl text-emerald-800">
                      ETB {netIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* TAB 6: Cash Flow Statement (ERPNext Aligned with Graphs) */}
          {activeTab === "CashFlow" && (
            <motion.div
              key="cash-flow-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operating Cash Flow</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      ETB {cashFlowTrendData.reduce((total, row) => total + row.operating, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Collections & Customer Sales</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Investing Cash Flow</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-rose-600 font-mono mt-1">
                      ETB {cashFlowTrendData.reduce((total, row) => total + row.investing, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Capex, Vehicles & Equipment</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Financing Cash Flow</span>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-zinc-900 font-mono mt-1">
                      ETB {cashFlowTrendData.reduce((total, row) => total + row.financing, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Debt Servicing & Capital</span>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Cash Position Increase</span>
                    <Coins className="size-4 text-emerald-600" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <p className="text-xl font-black text-emerald-800 font-mono mt-1">
                      ETB {cashFlowTrendData.reduce((total, row) => total + row.netCash, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1">Net Liquidity Inflow YTD</span>
                </GlassCard>
              </div>

              {/* ERPNext Visual Analytics Section: Cash Flow Graphs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Graph 1: Monthly Cash Flow Activity (Operating vs Investing Stacked Bar) */}
                <GlassCard className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                        <Activity className="size-4 text-emerald-600" /> Cash Flow Activity Trends
                      </h4>
                      <p className="text-[11px] text-zinc-500">Monthly Operating vs. Investing inflows & outflows.</p>
                    </div>
                  </div>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashFlowTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `ETB ${(val / 1000).toFixed(0)}k`} />
                        <RechartsTooltip
                          formatter={(value: any) => [`ETB ${Number(value).toLocaleString()}`, '']}
                          contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', color: '#ffffff', fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="operating" name="Operating Cash Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="investing" name="Investing Capex Outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Graph 2: Cumulative Cash & Liquidity Reserve Trend AreaChart */}
                <GlassCard className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                        <Coins className="size-4 text-blue-600" /> Cumulative Cash Reserve Growth
                      </h4>
                      <p className="text-[11px] text-zinc-500">Total liquid bank balance reserves over time.</p>
                    </div>
                  </div>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashFlowTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `ETB ${(val / 1000000).toFixed(2)}M`} />
                        <RechartsTooltip
                          formatter={(value: any) => [`ETB ${Number(value).toLocaleString()}`, 'Liquid Reserve']}
                          contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', color: '#ffffff', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="cashBalance" name="Cash Balance" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#cashGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </div>

              {/* ERPNext Cash Flow Detailed Statement Table */}
              <GlassCard className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                  <div>
                    <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
                      <Coins className="size-5 text-emerald-600" /> ERPNext Statement of Cash Flows (Direct Method)
                    </h3>
                    <p className="text-xs text-zinc-500">Detailed liquidity breakdown across operating, investing, and financing activities.</p>
                  </div>
                  <span className="text-xs font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full">
                    Direct Liquidity Reporting
                  </span>
                </div>

                <div className="flex flex-col gap-4 text-xs font-mono">
                  <div className="bg-zinc-50/80 p-4 rounded-xl border border-zinc-200/60 flex flex-col gap-2">
                    <span className="text-xs font-black text-zinc-900 font-sans uppercase">1. Cash Flow from Operating Activities</span>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex justify-between py-2 border-b border-zinc-100 animate-pulse">
                          <Skeleton className="h-3.5 w-48 bg-zinc-200/80" />
                          <Skeleton className="h-3.5 w-24 bg-zinc-200/80" />
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex justify-between text-zinc-700 py-1.5 border-b border-zinc-100">
                          <span>Receipts from Customers & Sales Ledger</span>
                          <span className="font-bold text-emerald-700">ETB {totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-zinc-700 py-1.5 border-b border-zinc-100">
                          <span>Payments to Suppliers for Goods & Services</span>
                          <span className="font-bold text-rose-600">ETB ({cogsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                        </div>
                        <div className="flex justify-between text-zinc-700 py-1.5 border-b border-zinc-100">
                          <span>Payroll & Employee Disbursements</span>
                          <span className="font-bold text-rose-600">ETB ({operatingExpenseTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-sans font-black text-emerald-800 pt-1 text-xs">
                      <span>Net Cash Generated from Operating Activities</span>
                      <span>ETB {cashFlowTrendData.reduce((total, row) => total + row.operating, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-50/80 p-4 rounded-xl border border-zinc-200/60 flex flex-col gap-2">
                    <span className="text-xs font-black text-zinc-900 font-sans uppercase">2. Cash Flow from Investing Activities</span>
                    {isLoading ? (
                      <div className="flex justify-between py-2 border-b border-zinc-100 animate-pulse">
                        <Skeleton className="h-3.5 w-48 bg-zinc-200/80" />
                        <Skeleton className="h-3.5 w-24 bg-zinc-200/80" />
                      </div>
                    ) : (
                      <div className="flex justify-between text-zinc-700 py-1.5 border-b border-zinc-100">
                        <span>Purchase of Plant Machinery & Logistics Fleet</span>
                        <span className="font-bold text-rose-600">ETB {cashFlowTrendData.reduce((total, row) => total + row.investing, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-sans font-black text-rose-700 pt-1 text-xs">
                      <span>Net Cash Used in Investing Activities</span>
                      <span>ETB {cashFlowTrendData.reduce((total, row) => total + row.investing, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-50/80 p-4 rounded-xl border border-zinc-200/60 flex flex-col gap-2">
                    <span className="text-xs font-black text-zinc-900 font-sans uppercase">3. Cash Flow from Financing Activities</span>
                    {isLoading ? (
                      <div className="flex justify-between py-2 border-b border-zinc-100 animate-pulse">
                        <Skeleton className="h-3.5 w-48 bg-zinc-200/80" />
                        <Skeleton className="h-3.5 w-24 bg-zinc-200/80" />
                      </div>
                    ) : (
                      <div className="flex justify-between text-zinc-700 py-1.5 border-b border-zinc-100">
                        <span>Share Capital Issuance / Dividend Payments</span>
                        <span className="font-bold text-zinc-600">ETB {cashFlowTrendData.reduce((total, row) => total + row.financing, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-sans font-black text-zinc-800 pt-1 text-xs">
                      <span>Net Cash Flow from Financing Activities</span>
                      <span>ETB {cashFlowTrendData.reduce((total, row) => total + row.financing, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 font-sans font-black text-sm shadow-xs">
                    <span className="uppercase tracking-wider text-emerald-950">NET INCREASE IN CASH & CASH EQUIVALENTS</span>
                    <span className="font-mono text-emerald-800 text-lg font-black">ETB {cashFlowTrendData.reduce((total, row) => total + row.netCash, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
