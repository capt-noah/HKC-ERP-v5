import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Download,
  CheckSquare,
  Square,
  Search,
  BookOpen,
  CreditCard,
  FileText,
  Users,
  Layers,
  Building2,
  X,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { FinanceDateFilter } from "@/components/FinanceTableToolbar"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFinanceStore, type FixedAsset } from "@/lib/financeStore"
import { useErpStore } from "@/lib/erpStore"
import { useHRStore } from "@/lib/hrStore"
import { useFeedback } from "@/context/FeedbackContext"
import { Skeleton } from "@/components/ui/skeleton"
import {
  exportPeachtreeGeneralJournal,
  exportPeachtreeDisbursements,
  exportPeachtreeSalesInvoices,
  exportPeachtreeChartOfAccounts,
  exportPeachtreePayroll,
  exportPeachtreeFixedAssets,
  isDateInRange,
  type ExportFormat,
  type DateFilterOptions,
} from "@/lib/peachtreeExportUtils"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

type ExportSectionKey = "JOURNAL" | "DISBURSEMENTS" | "SALES_INVOICES" | "PAYROLL" | "COA" | "FIXED_ASSETS"

const selectClass =
  "bg-black/[0.04] text-xs font-bold px-3 py-2 rounded-xl text-zinc-800 outline-none border border-transparent hover:border-black/5 cursor-pointer h-[38px]"

export default function FinanceExport() {
  const finance = useFinanceStore()
  const erp = useErpStore()
  const hr = useHRStore()
  const { showToast } = useFeedback()

  // Controls - default format is PEACHTREE_EXCEL (Excel Sheet)
  const [datePreset, setDatePreset] = useState<string>("ALL")
  const [customStartDate, setCustomStartDate] = useState<string>("")
  const [customEndDate, setCustomEndDate] = useState<string>("")
  const [format, setFormat] = useState<ExportFormat>("PEACHTREE_EXCEL")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const [selectedSections, setSelectedSections] = useState<Set<ExportSectionKey>>(
    new Set(["JOURNAL", "DISBURSEMENTS", "SALES_INVOICES", "PAYROLL", "COA", "FIXED_ASSETS"])
  )

  // Compute active date boundaries
  const dateFilter: DateFilterOptions = useMemo(() => {
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split("T")[0]

    if (datePreset === "TODAY") {
      const todayStr = formatDate(today)
      return { startDate: todayStr, endDate: todayStr }
    }
    if (datePreset === "THIS_WEEK") {
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday
      const monday = new Date(today.setDate(diff))
      return { startDate: formatDate(monday), endDate: formatDate(new Date()) }
    }
    if (datePreset === "THIS_MONTH") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      return { startDate: formatDate(firstDay), endDate: formatDate(today) }
    }
    if (datePreset === "LAST_MONTH") {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
      return { startDate: formatDate(firstDay), endDate: formatDate(lastDay) }
    }
    if (datePreset === "CUSTOM") {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      }
    }
    return {}
  }, [datePreset, customStartDate, customEndDate])

  // Data sets from stores
  const entries = finance.getJournalEntries()
  const lines = finance.getJournalEntryLines()
  const accounts = finance.getAccounts()
  const purchaseOrders = erp.getPurchaseOrders()
  const invoices = finance.getInvoices()
  const payrollRuns = finance.getPayrollRuns?.() || []
  const assets: FixedAsset[] = finance.getFixedAssets()

  // Filtered counts
  const filteredEntries = useMemo(() => entries.filter((e) => isDateInRange(e.entry_date, dateFilter)), [entries, dateFilter])
  const filteredPOs = useMemo(() => purchaseOrders.filter((p) => isDateInRange(p.date, dateFilter)), [purchaseOrders, dateFilter])
  const filteredInvoices = useMemo(() => invoices.filter((i) => isDateInRange(i.issue_date, dateFilter)), [invoices, dateFilter])
  const filteredPayroll = useMemo(() => payrollRuns.filter((r) => isDateInRange(r.period_end || r.period_start, dateFilter)), [payrollRuns, dateFilter])

  // Total amounts in scope
  const totalJournalDebit = useMemo(() => {
    const ids = new Set(filteredEntries.map((e) => e.id))
    return lines.filter((l) => ids.has(l.journal_entry_id)).reduce((s, l) => s + (Number(l.debit_amount) || 0), 0)
  }, [filteredEntries, lines])

  const totalDisbursed = useMemo(() => {
    return filteredPOs.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }, [filteredPOs])

  const totalInvoiced = useMemo(() => {
    return filteredInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
  }, [filteredInvoices])

  const totalPayrollGross = useMemo(() => {
    return filteredPayroll.reduce((s, p) => s + (Number(p.total_gross) || 0), 0)
  }, [filteredPayroll])

  // Section Configurations
  const exportCards = [
    {
      key: "JOURNAL" as ExportSectionKey,
      title: "General Journal",
      peachtreeTarget: "General Ledger > General Journal",
      icon: BookOpen,
      iconBg: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
      count: filteredEntries.length,
      unit: "Vouchers",
      metricLabel: "Total Debits",
      metricValue: `ETB ${totalJournalDebit.toLocaleString()}`,
      description: "Balanced double-entry debits, credits, account IDs, and warehouse job codes.",
      exportFn: () => exportPeachtreeGeneralJournal(entries, lines, accounts, { format, filter: dateFilter }),
    },
    {
      key: "DISBURSEMENTS" as ExportSectionKey,
      title: "Cash Disbursements",
      peachtreeTarget: "Accounts Payable > Disbursements Journal",
      icon: CreditCard,
      iconBg: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
      count: filteredPOs.length,
      unit: "Payment Vouchers",
      metricLabel: "Total Disbursed",
      metricValue: `ETB ${totalDisbursed.toLocaleString()}`,
      description: "Cheque numbers, vendor payees, cash accounts (1010), and expense allocations.",
      exportFn: () => exportPeachtreeDisbursements(purchaseOrders, accounts, { format, filter: dateFilter }),
    },
    {
      key: "SALES_INVOICES" as ExportSectionKey,
      title: "Sales Invoices",
      peachtreeTarget: "Accounts Receivable > Sales Journal",
      icon: FileText,
      iconBg: "bg-blue-50 text-blue-700 border-blue-200/70",
      count: filteredInvoices.length,
      unit: "Invoices",
      metricLabel: "Total Billed",
      metricValue: `ETB ${totalInvoiced.toLocaleString()}`,
      description: "Customer invoice details, item lines, quantities, unit prices, and AR accounts (1200).",
      exportFn: () => exportPeachtreeSalesInvoices(invoices, { format, filter: dateFilter }),
    },
    {
      key: "PAYROLL" as ExportSectionKey,
      title: "Payroll Summary",
      peachtreeTarget: "Payroll > Payroll Journal",
      icon: Users,
      iconBg: "bg-purple-50 text-purple-700 border-purple-200/70",
      count: filteredPayroll.length || hr.getEmployees().length,
      unit: filteredPayroll.length ? "Cycles" : "Active Staff",
      metricLabel: "Gross Pay",
      metricValue: totalPayrollGross > 0 ? `ETB ${totalPayrollGross.toLocaleString()}` : "Ready",
      description: "Gross wages, Ethiopian income tax withholdings, pension deductions, and net payouts.",
      exportFn: () => exportPeachtreePayroll(payrollRuns, { format, filter: dateFilter }),
    },
    {
      key: "COA" as ExportSectionKey,
      title: "Chart of Accounts",
      peachtreeTarget: "General Ledger > Account Master",
      icon: Layers,
      iconBg: "bg-amber-50 text-amber-700 border-amber-200/70",
      count: accounts.length,
      unit: "Accounts",
      metricLabel: "Mapped Roots",
      metricValue: "5 Types",
      description: "Account codes, descriptions, active statuses, and mapped Peachtree root types.",
      exportFn: () => exportPeachtreeChartOfAccounts(accounts, { format }),
    },
    {
      key: "FIXED_ASSETS" as ExportSectionKey,
      title: "Fixed Assets",
      peachtreeTarget: "Fixed Assets > Asset Schedule",
      icon: Building2,
      iconBg: "bg-rose-50 text-rose-700 border-rose-200/70",
      count: assets.length,
      unit: "Assets",
      metricLabel: "Total Cost",
      metricValue: `ETB ${assets.reduce((s: number, a: FixedAsset) => s + (Number(a.cost) || 0), 0).toLocaleString()}`,
      description: "Asset registry, historical cost, monthly straight-line depreciation, and accumulated totals.",
      exportFn: () => exportPeachtreeFixedAssets(assets, { format }),
    },
  ]

  // Filter cards by search query
  const displayedCards = useMemo(() => {
    if (!searchQuery.trim()) return exportCards
    const q = searchQuery.toLowerCase()
    return exportCards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.peachtreeTarget.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    )
  }, [exportCards, searchQuery])

  // Toggle selection
  const toggleSection = (key: ExportSectionKey) => {
    setSelectedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedSections.size === exportCards.length) {
      setSelectedSections(new Set())
    } else {
      setSelectedSections(new Set(exportCards.map((c) => c.key)))
    }
  }

  // Bulk Export Handler
  const handleBulkExport = () => {
    if (selectedSections.size === 0) {
      showToast("No Selection", "warning", "Please select at least one section checkbox to export.")
      return
    }

    let exportedCount = 0
    exportCards.forEach((card) => {
      if (selectedSections.has(card.key)) {
        setTimeout(() => {
          card.exportFn()
        }, exportedCount * 300)
        exportedCount++
      }
    })

    showToast(
      "Export Complete",
      "success",
      `Exported ${exportedCount} HKC file${exportedCount > 1 ? "s" : ""} in ${format === "PEACHTREE_CSV" ? "CSV" : "Excel"} format.`
    )
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12 space-y-6"
      >
        {/* Top Header */}
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-black tracking-tight">Peachtree Export Center</h1>
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Export live ERP financial transactions formatted for Peachtree (Sage 50) and Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </motion.div>

        {/* Simplified Toolbar & Filter Bar */}
        <motion.div variants={fade} className="relative z-20">
          <GlassCard className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
            {/* Left: Search Box */}
            <div className="flex items-center gap-2.5 bg-zinc-100/90 rounded-full px-4 h-10 w-full md:max-w-xs border border-zinc-200/70">
              <Search className="size-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold focus:outline-none text-zinc-900 placeholder:text-zinc-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-zinc-400 hover:text-zinc-600">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Right Controls: Filters, Format, Select All & Export Button */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
              {/* Floating Date Filter Dropdown with Popover */}
              <FinanceDateFilter
                value={datePreset}
                onChange={setDatePreset}
                startDate={customStartDate}
                endDate={customEndDate}
                onCustomDateChange={(start, end) => {
                  setCustomStartDate(start)
                  setCustomEndDate(end)
                }}
              />

              {/* Format Dropdown (Excel Sheet default) */}
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                aria-label="Export Format"
                className={selectClass}
              >
                <option value="PEACHTREE_EXCEL">Excel Sheet</option>
                <option value="PEACHTREE_CSV">CSV</option>
              </select>

              {/* Select All Toggle */}
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 bg-black/[0.03] hover:bg-black/[0.06] transition-all h-[38px] cursor-pointer"
              >
                {selectedSections.size === exportCards.length ? (
                  <CheckSquare className="size-4 text-emerald-600" />
                ) : (
                  <Square className="size-4 text-zinc-400" />
                )}
                <span>{selectedSections.size === exportCards.length ? "Deselect All" : "Select All"}</span>
              </button>

              {/* Primary Export Button */}
              <button
                type="button"
                onClick={handleBulkExport}
                disabled={selectedSections.size === 0}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all h-[38px] uppercase tracking-wider shrink-0 cursor-pointer shadow-lg shadow-black/10 ${
                  selectedSections.size > 0
                    ? "bg-black text-white hover:bg-zinc-800 active:scale-95"
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                }`}
              >
                <Download className="size-3.5" />
                <span>Export Selected ({selectedSections.size})</span>
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Section Cards Grid */}
        {finance.isLoading() ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <GlassCard key={idx} className="p-6 min-h-[220px] flex flex-col justify-between animate-pulse">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3.5">
                      <Skeleton className="size-11 rounded-xl bg-zinc-200/80" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32 bg-zinc-200/80" />
                        <Skeleton className="h-3 w-20 bg-zinc-200/80" />
                      </div>
                    </div>
                    <Skeleton className="size-5 rounded bg-zinc-200/80" />
                  </div>
                  <Skeleton className="h-3 w-full bg-zinc-200/80 mt-3" />
                  <Skeleton className="h-3 w-4/5 bg-zinc-200/80 mt-1.5" />
                </div>
                <div className="p-3 rounded-xl bg-zinc-100/70 border border-zinc-100 flex items-center justify-between mt-4">
                  <Skeleton className="h-3 w-16 bg-zinc-200/80" />
                  <Skeleton className="h-4 w-24 bg-zinc-200/80" />
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedCards.map((card) => {
            const isSelected = selectedSections.has(card.key)
            const CardIcon = card.icon

            return (
              <motion.div key={card.key} variants={fade}>
                <div
                  onClick={() => toggleSection(card.key)}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[220px] group ${
                    isSelected
                      ? "bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-600 shadow-md ring-2 ring-emerald-600/20"
                      : "bg-white/70 hover:bg-white border-zinc-200/80 shadow-xs opacity-80 hover:opacity-100"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`size-11 rounded-xl border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-emerald-700 text-white border-emerald-700 shadow-xs" : card.iconBg
                        }`}>
                          <CardIcon className="size-5.5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-zinc-950 truncate leading-tight group-hover:text-zinc-900">{card.title}</h3>
                          <span className="text-[10px] font-bold text-zinc-400 font-mono block truncate mt-1">{card.peachtreeTarget}</span>
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSection(card.key)}
                          className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-5 text-emerald-700" />
                          ) : (
                            <Square className="size-5 text-zinc-300 group-hover:text-zinc-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-zinc-500 line-clamp-2 leading-relaxed mb-4">{card.description}</p>
                  </div>

                  {/* Metric Row */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    isSelected ? "bg-emerald-100/50 border-emerald-200/80" : "bg-zinc-50/80 border-zinc-100"
                  }`}>
                    <div>
                      <span className="text-[10px] font-black uppercase text-zinc-400 block tracking-wider">Matching</span>
                      <span className="text-xs font-black font-mono text-zinc-900">
                        {card.count.toLocaleString()} {card.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-zinc-400 block tracking-wider">{card.metricLabel}</span>
                      <span className="text-xs font-black font-mono text-emerald-700">{card.metricValue}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
        )}
      </motion.div>
    </div>
  )
}
