import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Edit,
  Trash2,
  Receipt,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Plus,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore } from "@/lib/financeStore"
import type { TaxRule } from "@/lib/taxEngine"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { Skeleton } from "@/components/ui/skeleton"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

const TAX_TYPES: TaxRule["type"][] = [
  "VAT/GST",
  "Withholding Tax (TDS)",
  "Turnover Tax (TOT)",
  "Customs Duty",
  "Exempt",
]

const typeColorMap: Record<string, string> = {
  "VAT/GST": "bg-blue-100 text-blue-800 border-blue-200",
  "Withholding Tax (TDS)": "bg-amber-100 text-amber-800 border-amber-200",
  "Turnover Tax (TOT)": "bg-teal-100 text-teal-800 border-teal-200",
  "Customs Duty": "bg-orange-100 text-orange-800 border-orange-200",
  Exempt: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export default function Taxes() {
  const { showToast, confirm } = useFeedback()
  const finance = useFinanceStore()
  const isLoading = finance.isLoading()
  const taxRules = finance.getTaxRules()
  const taxSchedules = finance.getTaxSchedules()
  const accounts = finance.getAccounts()

  const [activeTab, setActiveTab] = useState<"rules" | "schedules">("rules")

  // -------------------------------------------------------------
  // TAB 1: TAX RULES STATE
  // -------------------------------------------------------------
  const [ruleSearchQuery, setRuleSearchQuery] = useState("")
  const [filterRuleType, setFilterRuleType] = useState("ALL")

  const filteredTaxRules = useMemo(() => {
    return taxRules.filter((rule) => {
      if (filterRuleType !== "ALL" && rule.type !== filterRuleType) return false
      if (!ruleSearchQuery.trim()) return true
      const q = ruleSearchQuery.toLowerCase()
      return (
        rule.name.toLowerCase().includes(q) ||
        rule.id.toLowerCase().includes(q) ||
        rule.accountCode.toLowerCase().includes(q) ||
        (rule.description?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [taxRules, filterRuleType, ruleSearchQuery])

  // Add Tax Rule state
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [addRuleName, setAddRuleName] = useState("")
  const [addRuleRate, setAddRuleRate] = useState("15")
  const [addRuleType, setAddRuleType] = useState<TaxRule["type"]>("VAT/GST")
  const [addRuleAccount, setAddRuleAccount] = useState("2000-05")
  const [addRuleInclusive, setAddRuleInclusive] = useState(false)
  const [addRuleDeduction, setAddRuleDeduction] = useState(false)
  const [addRuleAppliesTo, setAddRuleAppliesTo] = useState<"SALES" | "PURCHASES" | "BOTH">("BOTH")
  const [addRuleDescription, setAddRuleDescription] = useState("")

  // Edit Tax Rule state
  const [showEditRuleModal, setShowEditRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null)
  const [editRuleName, setEditRuleName] = useState("")
  const [editRuleRate, setEditRuleRate] = useState("")
  const [editRuleType, setEditRuleType] = useState<TaxRule["type"]>("VAT/GST")
  const [editRuleAccount, setEditRuleAccount] = useState("")
  const [editRuleInclusive, setEditRuleInclusive] = useState(false)
  const [editRuleDeduction, setEditRuleDeduction] = useState(false)
  const [editRuleAppliesTo, setEditRuleAppliesTo] = useState<"SALES" | "PURCHASES" | "BOTH">("BOTH")
  const [editRuleDescription, setEditRuleDescription] = useState("")

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const rate = parseFloat(addRuleRate)
    if (!addRuleName || isNaN(rate)) return
    finance.addTaxRule({
      name: addRuleName,
      ratePercent: rate,
      type: addRuleType,
      accountCode: addRuleAccount,
      isInclusive: addRuleInclusive,
      isDeduction: addRuleDeduction,
      appliesTo: addRuleAppliesTo,
      description: addRuleDescription,
      is_active: true,
    })
    setShowAddRuleModal(false)
    setAddRuleName("")
    setAddRuleRate("15")
    setAddRuleDescription("")
    showToast("Tax Rule Created", "success", `Tax rule '${addRuleName}' (${rate}%) created and active.`)
  }

  const handleEditRuleOpen = (rule: TaxRule) => {
    setEditingRule(rule)
    setEditRuleName(rule.name)
    setEditRuleRate(String(rule.ratePercent))
    setEditRuleType(rule.type)
    setEditRuleAccount(rule.accountCode)
    setEditRuleInclusive(rule.isInclusive)
    setEditRuleDeduction(rule.isDeduction)
    setEditRuleAppliesTo(rule.appliesTo || "BOTH")
    setEditRuleDescription(rule.description || "")
    setShowEditRuleModal(true)
  }

  const handleEditRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRule) return
    const rate = parseFloat(editRuleRate)
    if (!editRuleName || isNaN(rate)) return
    finance.updateTaxRule(editingRule.id, {
      name: editRuleName,
      ratePercent: rate,
      type: editRuleType,
      accountCode: editRuleAccount,
      isInclusive: editRuleInclusive,
      isDeduction: editRuleDeduction,
      appliesTo: editRuleAppliesTo,
      description: editRuleDescription,
    })
    setShowEditRuleModal(false)
    setEditingRule(null)
    showToast("Tax Rule Updated", "success", `Tax rule '${editRuleName}' updated successfully.`)
  }

  const handleDeleteRule = (id: string, name: string) => {
    confirm({
      title: "Delete Tax Rule",
      message: `Are you sure you want to delete tax rule '${name}'? Linked transactions might be affected.`,
      isDestructive: true,
      onConfirm: () => {
        finance.deleteTaxRule(id)
        showToast("Tax Rule Deleted", "info", `Tax rule '${name}' removed.`)
      },
    })
  }

  // -------------------------------------------------------------
  // TAB 2: TAX SCHEDULES (BUNDLES) STATE
  // -------------------------------------------------------------
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false)
  const [schName, setSchName] = useState("")
  const [schAppliesTo, setSchAppliesTo] = useState<"SALES" | "PURCHASES" | "BOTH">("SALES")
  const [schSelectedRuleIds, setSchSelectedRuleIds] = useState<string[]>(["TAX-VAT-15"])
  const [schDescription, setSchDescription] = useState("")

  const handleToggleScheduleRule = (ruleId: string) => {
    setSchSelectedRuleIds((prev) =>
      prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
    )
  }

  const handleAddScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!schName.trim() || schSelectedRuleIds.length === 0) {
      showToast("Missing Selection", "warning", "Please provide a schedule name and select at least one tax rule.")
      return
    }
    finance.addTaxSchedule({
      name: schName,
      taxRuleIds: schSelectedRuleIds,
      appliesTo: schAppliesTo,
      description: schDescription,
      isDefault: false,
    })
    setShowAddScheduleModal(false)
    setSchName("")
    setSchDescription("")
    setSchSelectedRuleIds(["TAX-VAT-15"])
    showToast("Tax Schedule Created", "success", `Multi-tax bundle '${schName}' is now available.`)
  }

  const handleDeleteSchedule = (id: string, name: string) => {
    confirm({
      title: "Delete Tax Schedule",
      message: `Are you sure you want to delete tax bundle '${name}'?`,
      isDestructive: true,
      onConfirm: () => {
        finance.deleteTaxSchedule(id)
        showToast("Schedule Removed", "info", `Tax bundle '${name}' deleted.`)
      },
    })
  }

  // Table Setup for Rules
  const ruleColumns: TableColumn[] = [
    { key: "id", label: "Rule ID" },
    { key: "name", label: "Tax Rule Name" },
    { key: "type", label: "Type" },
    { key: "ratePercent", label: "Rate (%)", align: "right" },
    { key: "behavior", label: "Behavior", align: "center" },
    { key: "accountCode", label: "Linked GL Account" },
    { key: "appliesTo", label: "Scope", align: "center" },
    { key: "actions", label: "Actions", align: "right", noSort: true },
  ]

  const {
    colWidths,
    sortKey,
    sortDir,
    openMenuCol,
    handleResizeStart,
    toggleMenu,
    setSortAsc,
    setSortDesc,
    clearSort,
    sorted,
  } = useResizableTable(ruleColumns, filteredTaxRules, {
    id: 110,
    name: 220,
    type: 150,
    ratePercent: 90,
    behavior: 130,
    accountCode: 180,
    appliesTo: 110,
    actions: 90,
  })

  const [page, setPage] = useState(1)
  const pageSize = 10
  const sortedRules = sorted()
  const totalPages = Math.max(1, Math.ceil(sortedRules.length / pageSize))
  const displayedRules = sortedRules.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [ruleSearchQuery, filterRuleType])

  return (
    <div className="min-h-screen page-gradient text-black">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <main className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Title Header with SubPageNav */}
        <motion.div initial="hidden" animate="visible" variants={fade} className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Tax Engine & Schedules</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">Multi-tax calculation rules, rate schedules, and Chart of Accounts double-entry mapping.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("Finance")} />
          </div>
        </motion.div>

        {/* TOP STATS CARDS */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-blue-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Tax Rules</span>
            {isLoading ? (
              <Skeleton className="h-7 w-24 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black font-mono text-zinc-900 mt-1">{taxRules.length}</p>
            )}
            <span className="text-[10px] text-gray-400 mt-0.5">Rates & Formulas</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-emerald-600 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tax Schedules (Bundles)</span>
            {isLoading ? (
              <Skeleton className="h-7 w-24 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black font-mono text-zinc-900 mt-1">{taxSchedules.length}</p>
            )}
            <span className="text-[10px] text-gray-400 mt-0.5">Multi-tax Packages</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-emerald-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Zero-Click Engine</span>
            {isLoading ? (
              <Skeleton className="h-7 w-24 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-emerald-600 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> Active
              </p>
            )}
            <span className="text-[10px] text-gray-400 mt-0.5">Party & Product Auto-Resolution</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-amber-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">COA Double-Entry</span>
            {isLoading ? (
              <Skeleton className="h-7 w-24 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black font-mono text-zinc-900 mt-1">100%</p>
            )}
            <span className="text-[10px] text-gray-400 mt-0.5">GL Auto-Posting Enabled</span>
          </GlassCard>
        </motion.div>

        {/* TABS SELECTOR */}
        <motion.div variants={fade} className="flex items-center gap-2 border-b border-zinc-200 pb-2 mb-6">
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "rules"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-white/60 text-zinc-600 hover:bg-white hover:text-zinc-900"
            }`}
          >
            <Receipt className="size-4" />
            Tax Rules Master ({taxRules.length})
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "schedules"
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-white/60 text-emerald-800 hover:bg-white hover:text-emerald-950"
            }`}
          >
            <Layers className="size-4" />
            Tax Schedules (Multi-Tax Bundles) ({taxSchedules.length})
          </button>
        </motion.div>

        {/* TAB 1: TAX RULES */}
        {activeTab === "rules" && (
          <motion.div variants={fade} className="space-y-4">
            <GlassCard className="p-6">
              <FinanceTableToolbar
                title="Tax Rules & Rates Master"
                subtitle="Configure individual tax authorities, rates, and Chart of Accounts links"
                searchPlaceholder="Search rule by name, ID or GL account..."
                searchValue={ruleSearchQuery}
                onSearchChange={setRuleSearchQuery}
                filters={[
                  {
                    value: filterRuleType,
                    onChange: setFilterRuleType,
                    options: [
                      { value: "ALL", label: "All Tax Types" },
                      { value: "VAT/GST", label: "VAT (15%)" },
                      { value: "Withholding Tax (TDS)", label: "Withholding Tax (WHT)" },
                      { value: "Turnover Tax (TOT)", label: "Turnover Tax (TOT)" },
                      { value: "Exempt", label: "Exempt / Zero-Rated" },
                    ],
                  },
                ]}
                actions={[{ label: "Add Tax Rule", onClick: () => setShowAddRuleModal(true) }]}
              />

              <TableScrollWrapper>
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-black/[0.02] border-b border-zinc-200 text-[10px] font-black tracking-wider text-zinc-500 uppercase">
                      {ruleColumns.map((col) => (
                        <ResizableTh
                          key={col.key}
                          col={col}
                          width={colWidths[col.key] ?? 140}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          openMenuCol={openMenuCol}
                          onResizeStart={handleResizeStart}
                          onToggleMenu={toggleMenu}
                          onSortAsc={setSortAsc}
                          onSortDesc={setSortDesc}
                          onClearSort={clearSort}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse text-xs">
                          <td className="py-3.5 pl-2"><Skeleton className="h-4 w-16" /></td>
                          <td className="py-3.5"><Skeleton className="h-4 w-36" /></td>
                          <td className="py-3.5"><Skeleton className="h-4 w-24" /></td>
                          <td className="py-3.5 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                          <td className="py-3.5 text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                          <td className="py-3.5 font-mono"><Skeleton className="h-4 w-24" /></td>
                          <td className="py-3.5 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                          <td className="py-3.5 text-right pr-2"><Skeleton className="h-4 w-12 ml-auto" /></td>
                        </tr>
                      ))
                    ) : displayedRules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-zinc-400 text-xs">
                          No tax rules found. Click &quot;Add Tax Rule&quot; to configure a new rate.
                        </td>
                      </tr>
                    ) : (
                      displayedRules.map((rule) => {
                        const matchedAcc = accounts.find((a) => a.code === rule.accountCode || a.id === rule.accountCode)
                        return (
                          <tr key={rule.id} className="hover:bg-black/[0.015] transition-colors text-xs">
                            <td className="py-3.5 pl-2 font-mono font-bold text-zinc-900">{rule.id}</td>
                            <td className="py-3.5">
                              <span className="font-bold text-zinc-900">{rule.name}</span>
                              {rule.description && (
                                <p className="text-[10px] text-zinc-400 truncate max-w-xs">{rule.description}</p>
                              )}
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                  typeColorMap[rule.type] || "bg-zinc-100 text-zinc-800 border-zinc-200"
                                }`}
                              >
                                {rule.type}
                              </span>
                            </td>
                            <td className="py-3.5 text-right font-mono font-black text-zinc-900">
                              {rule.ratePercent}%
                            </td>
                            <td className="py-3.5 text-center">
                              {rule.isDeduction ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                  <ArrowDownRight className="size-3" /> Deducted (WHT)
                                </span>
                              ) : rule.isInclusive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                                  Inclusive
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                                  <ArrowUpRight className="size-3" /> Added (VAT)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 font-mono text-[11px]">
                              <span className="font-bold text-zinc-800">{rule.accountCode}</span>
                              {matchedAcc && (
                                <span className="text-[10px] text-zinc-400 block truncate max-w-[150px]">
                                  {matchedAcc.name}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-center">
                              <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
                                {rule.appliesTo || "BOTH"}
                              </span>
                            </td>
                            <td className="py-3.5 text-right pr-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleEditRuleOpen(rule)}
                                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                                  title="Edit Rule"
                                >
                                  <Edit className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRule(rule.id, rule.name)}
                                  className="p-1 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 cursor-pointer"
                                  title="Delete Rule"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </TableScrollWrapper>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 text-xs">
                  <span className="text-zinc-500">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedRules.length)} of {sortedRules.length} rules
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg border border-zinc-200 bg-white font-bold disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="font-mono font-bold text-zinc-800">
                      Page {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg border border-zinc-200 bg-white font-bold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* TAB 2: TAX SCHEDULES (BUNDLES) */}
        {activeTab === "schedules" && (
          <motion.div variants={fade} className="space-y-4">
            <GlassCard className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4 mb-6">
                <div>
                  <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                    <Layers className="size-5 text-emerald-600" />
                    Multi-Tax Schedules & Packages
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Bundle multiple individual tax rules together to automatically calculate complex transactions with a single assignment.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddScheduleModal(true)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all self-start sm:self-auto"
                >
                  <Plus className="size-4" /> Create Tax Schedule
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {taxSchedules.map((sch) => {
                  const bundledRules = taxRules.filter((r) => sch.taxRuleIds.includes(r.id))
                  return (
                    <div
                      key={sch.id}
                      className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {sch.id}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">
                            Scope: {sch.appliesTo}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-zinc-900 mb-1">{sch.name}</h4>
                        <p className="text-[11px] text-zinc-500 mb-4">{sch.description || "No description provided."}</p>

                        <div className="space-y-1.5 border-t border-zinc-100 pt-3 mb-4">
                          <p className="text-[10px] font-black uppercase text-zinc-400">Bundled Rules ({bundledRules.length}):</p>
                          {bundledRules.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between text-xs p-2 rounded-xl bg-zinc-50 border border-zinc-100"
                            >
                              <span className="font-bold text-zinc-800">{r.name}</span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                    r.isDeduction
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {r.isDeduction ? `-${r.ratePercent}% WHT` : `+${r.ratePercent}% VAT`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400">
                          {sch.isDefault ? "Default Preset" : "Custom Bundle"}
                        </span>
                        {!sch.isDefault && (
                          <button
                            onClick={() => handleDeleteSchedule(sch.id, sch.name)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </main>

      {/* MODAL: ADD TAX RULE */}
      <AnimatePresence>
        {showAddRuleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-base font-black text-zinc-900">Add Tax Rule</h3>
                <button onClick={() => setShowAddRuleModal(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                  <X className="size-5" />
                </button>
              </div>
              <form onSubmit={handleAddRuleSubmit} className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Tax Rule Name</label>
                  <input
                    type="text"
                    value={addRuleName}
                    onChange={(e) => setAddRuleName(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    placeholder="e.g. Standard VAT (15%)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Tax Type</label>
                    <select
                      value={addRuleType}
                      onChange={(e) => setAddRuleType(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    >
                      {TAX_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Rate (%)</label>
                    <input
                      type="number"
                      value={addRuleRate}
                      onChange={(e) => setAddRuleRate(e.target.value)}
                      required
                      step="0.01"
                      min="0"
                      max="100"
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                      placeholder="15"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Linked GL Account (From Company COA)</label>
                  <select
                    value={addRuleAccount}
                    onChange={(e) => setAddRuleAccount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
                  >
                    {accounts.filter((a) => !a.is_group).map((a) => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Scope</label>
                    <select
                      value={addRuleAppliesTo}
                      onChange={(e) => setAddRuleAppliesTo(e.target.value as any)}
                      className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    >
                      <option value="BOTH">Both (Sales & Purchases)</option>
                      <option value="SALES">Sales Only</option>
                      <option value="PURCHASES">Purchases Only</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={addRuleDeduction}
                        onChange={(e) => setAddRuleDeduction(e.target.checked)}
                        className="accent-amber-600 rounded"
                      />
                      <span>Is WHT Deduction</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={addRuleInclusive}
                        onChange={(e) => setAddRuleInclusive(e.target.checked)}
                        className="accent-blue-600 rounded"
                      />
                      <span>Is Inclusive</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Description (optional)</label>
                  <textarea
                    value={addRuleDescription}
                    onChange={(e) => setAddRuleDescription(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold resize-none"
                    rows={2}
                    placeholder="e.g. Standard 15% Ethiopian VAT"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setShowAddRuleModal(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-black hover:bg-black shadow-sm cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT TAX RULE */}
      <AnimatePresence>
        {showEditRuleModal && editingRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-base font-black text-zinc-900">Edit Tax Rule ({editingRule.id})</h3>
                <button onClick={() => setShowEditRuleModal(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                  <X className="size-5" />
                </button>
              </div>
              <form onSubmit={handleEditRuleSubmit} className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Tax Rule Name</label>
                  <input
                    type="text"
                    value={editRuleName}
                    onChange={(e) => setEditRuleName(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Tax Type</label>
                    <select
                      value={editRuleType}
                      onChange={(e) => setEditRuleType(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    >
                      {TAX_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Rate (%)</label>
                    <input
                      type="number"
                      value={editRuleRate}
                      onChange={(e) => setEditRuleRate(e.target.value)}
                      required
                      step="0.01"
                      min="0"
                      max="100"
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Linked GL Account</label>
                  <select
                    value={editRuleAccount}
                    onChange={(e) => setEditRuleAccount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
                  >
                    {accounts.filter((a) => !a.is_group).map((a) => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Scope</label>
                    <select
                      value={editRuleAppliesTo}
                      onChange={(e) => setEditRuleAppliesTo(e.target.value as any)}
                      className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    >
                      <option value="BOTH">Both (Sales & Purchases)</option>
                      <option value="SALES">Sales Only</option>
                      <option value="PURCHASES">Purchases Only</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={editRuleDeduction}
                        onChange={(e) => setEditRuleDeduction(e.target.checked)}
                        className="accent-amber-600 rounded"
                      />
                      <span>Is WHT Deduction</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={editRuleInclusive}
                        onChange={(e) => setEditRuleInclusive(e.target.checked)}
                        className="accent-blue-600 rounded"
                      />
                      <span>Is Inclusive</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Description</label>
                  <textarea
                    value={editRuleDescription}
                    onChange={(e) => setEditRuleDescription(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setShowEditRuleModal(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-black hover:bg-black shadow-sm cursor-pointer"
                  >
                    Update Rule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE TAX SCHEDULE / BUNDLE */}
      <AnimatePresence>
        {showAddScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-base font-black text-zinc-900">Create Tax Schedule (Bundle)</h3>
                <button onClick={() => setShowAddScheduleModal(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleAddScheduleSubmit} className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Schedule Name</label>
                  <input
                    type="text"
                    value={schName}
                    onChange={(e) => setSchName(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    placeholder="e.g. Gov Agency (15% VAT + 2% WHT)"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Scope</label>
                  <select
                    value={schAppliesTo}
                    onChange={(e) => setSchAppliesTo(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
                  >
                    <option value="SALES">Sales Transactions</option>
                    <option value="PURCHASES">Purchase Disbursements</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Select Bundled Tax Rules:</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-200 rounded-xl p-2 bg-zinc-50">
                    {taxRules.map((rule) => {
                      const isSelected = schSelectedRuleIds.includes(rule.id)
                      return (
                        <div
                          key={rule.id}
                          onClick={() => handleToggleScheduleRule(rule.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                              : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="accent-emerald-600 rounded"
                            />
                            <span className="font-bold">{rule.name}</span>
                          </div>
                          <span className="font-mono font-bold text-[11px]">
                            {rule.isDeduction ? `-${rule.ratePercent}% WHT` : `+${rule.ratePercent}% VAT`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Description (optional)</label>
                  <textarea
                    value={schDescription}
                    onChange={(e) => setSchDescription(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold resize-none"
                    rows={2}
                    placeholder="e.g. For government withholding agent clients with mandatory 2% deduction."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setShowAddScheduleModal(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-black hover:bg-emerald-800 shadow-sm cursor-pointer"
                  >
                    Save Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
