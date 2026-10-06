import { useState, useEffect, useMemo } from "react"
import {
  X,
  Edit,
  Trash2,
  Receipt,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Scale,
  Coins,
  ShieldCheck,
  RotateCcw,
  Save,
  Check,
  Pencil,
  Calculator,
  SlidersHorizontal,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore } from "@/lib/financeStore"
import { useErpStore, erpStore } from "@/lib/erpStore"
import type { TaxRule } from "@/lib/taxEngine"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { Skeleton } from "@/components/ui/skeleton"
import COAAccountSelector from "@/components/finance/COAAccountSelector"
import {
  DEFAULT_ETHIOPIAN_TAX_BRACKETS,
  DEFAULT_ETHIOPIAN_PENSION_CONFIG,
  type TaxBracket,
  calculateEthiopianIncomeTax,
} from "@/core/hr/payrollEngine"
import { cn } from "@/lib/utils"

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
  const erp = useErpStore()
  const isLoading = finance.isLoading()
  const taxRules = finance.getTaxRules()
  const taxSchedules = finance.getTaxSchedules()
  const accounts = finance.getAccounts()
  const companySettings = finance.getCompanySettings()

  const [activeTab, setActiveTab] = useState<"rules" | "schedules" | "pension">("rules")

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
        (rule.name || "").toLowerCase().includes(q) ||
        (rule.id || "").toLowerCase().includes(q) ||
        (rule.accountCode || "").toLowerCase().includes(q) ||
        ((rule.description || "").toLowerCase().includes(q))
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

  // -------------------------------------------------------------
  // TAB 3: PENSION & EMPLOYMENT TAX STATE & PERSISTENCE
  // -------------------------------------------------------------
  const [pensionEmpRate, setPensionEmpRate] = useState<number | "">(companySettings.pension_employee_rate ?? 7)
  const [pensionCompRate, setPensionCompRate] = useState<number | "">(companySettings.pension_employer_rate ?? 11)
  const [pensionExpatExempt, setPensionExpatExempt] = useState<boolean>(companySettings.pension_expat_exempt ?? true)
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>(
    companySettings.tax_brackets_config && companySettings.tax_brackets_config.length > 0
      ? companySettings.tax_brackets_config
      : DEFAULT_ETHIOPIAN_TAX_BRACKETS
  )

  const [isPensionSaved, setIsPensionSaved] = useState(false)
  const [bracketModalOpen, setBracketModalOpen] = useState(false)
  const [editingBracketIndex, setEditingBracketIndex] = useState<number | null>(null)
  const [bracketMin, setBracketMin] = useState<number | "">(0)
  const [bracketMax, setBracketMax] = useState<number | "">(2000)
  const [bracketRate, setBracketRate] = useState<number | "">(0)
  const [bracketDeductible, setBracketDeductible] = useState<number | "">(0)

  // Live Payroll Simulator Test State
  const [simSalary, setSimSalary] = useState<number | "">(15000)
  const [simAllowance, setSimAllowance] = useState<number | "">(2000)
  const [simIsExpat, setSimIsExpat] = useState(false)

  const syncPensionFromSettings = (s: any) => {
    setPensionEmpRate(s.pension_employee_rate ?? 7)
    setPensionCompRate(s.pension_employer_rate ?? 11)
    setPensionExpatExempt(s.pension_expat_exempt ?? true)
    setTaxBrackets(
      s.tax_brackets_config && s.tax_brackets_config.length > 0
        ? s.tax_brackets_config
        : DEFAULT_ETHIOPIAN_TAX_BRACKETS
    )
  }

  // Subscribe to finance store updates
  useEffect(() => {
    const unsub = finance.subscribe(() => {
      const fresh = finance.getCompanySettings()
      syncPensionFromSettings(fresh)
    })
    return () => unsub()
  }, [])

  const handleSavePensionAndTax = () => {
    confirm({
      title: "Save Pension & Employment Tax Settings",
      message: "Persist Ethiopian statutory pension rates (7%/11%) and progressive income tax brackets to the database?",
      confirmLabel: "Save Configuration",
      cancelLabel: "Cancel",
      onConfirm: () => {
        const current = finance.getCompanySettings()
        const updated = {
          ...current,
          pension_employee_rate: Number(pensionEmpRate) || 0,
          pension_employer_rate: Number(pensionCompRate) || 0,
          pension_expat_exempt: Boolean(pensionExpatExempt),
          tax_brackets_config: taxBrackets,
        }

        finance.updateCompanySettings(updated)
        erp.updateCompanySettings(updated)
        setIsPensionSaved(true)
        showToast("Pension & Tax Saved", "success", "Statutory pension rates and tax brackets persisted successfully.")
        setTimeout(() => setIsPensionSaved(false), 3000)
      },
    })
  }

  const handleDiscardPension = () => {
    const s = finance.getCompanySettings()
    syncPensionFromSettings(s)
    showToast("Changes Discarded", "info", "Pension and employment tax parameters reverted to current saved state.")
  }

  const handleResetPensionToStatutory = () => {
    confirm({
      title: "Reset Pension Scheme to Statutory Defaults",
      message: "Reset employee contribution rate to 7%, employer contribution rate to 11%, and enable expatriate exemption (Proclamations No. 1267/2022 & 1268/2022)?",
      confirmLabel: "Reset Pension Rates",
      cancelLabel: "Cancel",
      onConfirm: () => {
        setPensionEmpRate(DEFAULT_ETHIOPIAN_PENSION_CONFIG.employeeRatePercent)
        setPensionCompRate(DEFAULT_ETHIOPIAN_PENSION_CONFIG.employerRatePercent)
        setPensionExpatExempt(DEFAULT_ETHIOPIAN_PENSION_CONFIG.expatExempt)
        showToast("Pension Rates Reset", "success", "Reverted to statutory 7% employee and 11% employer rates.")
      },
    })
  }

  const handleResetBracketsToStatutory = () => {
    confirm({
      title: "Reset to Proclamation No. 1395/2025",
      message: "Reset progressive employment income tax brackets to statutory legal defaults (0-2000 ETB exempt, up to 35% above 14,000 ETB)?",
      confirmLabel: "Reset to Statutory Defaults",
      cancelLabel: "Cancel",
      onConfirm: () => {
        setTaxBrackets(DEFAULT_ETHIOPIAN_TAX_BRACKETS)
        showToast("Tax Brackets Reset", "success", "Loaded statutory Proclamation No. 1395/2025 tax bracket tiers.")
      },
    })
  }

  const handleOpenBracketModal = (index?: number) => {
    if (typeof index === "number" && taxBrackets[index]) {
      const b = taxBrackets[index]
      setEditingBracketIndex(index)
      setBracketMin(b.min)
      setBracketMax(b.max === null ? "" : b.max)
      setBracketRate(b.ratePercent)
      setBracketDeductible(b.deductible)
    } else {
      setEditingBracketIndex(null)
      const last = taxBrackets[taxBrackets.length - 1]
      setBracketMin(last && last.max ? last.max + 1 : 0)
      setBracketMax("")
      setBracketRate(35)
      setBracketDeductible(0)
    }
    setBracketModalOpen(true)
  }

  const handleSaveBracket = () => {
    const min = Number(bracketMin) || 0
    const max = bracketMax === "" || bracketMax === null ? null : Number(bracketMax)
    const rate = Number(bracketRate) || 0
    const deductible = Number(bracketDeductible) || 0

    const updatedBracket: TaxBracket = {
      min,
      max,
      ratePercent: rate,
      deductible,
    }

    if (editingBracketIndex !== null) {
      setTaxBrackets((prev) => prev.map((b, i) => (i === editingBracketIndex ? updatedBracket : b)))
      showToast("Tax Bracket Updated", "success", `Tier updated to ${rate}% rate. Click Save Configurations to persist.`)
    } else {
      setTaxBrackets((prev) => [...prev, updatedBracket])
      showToast("Tax Bracket Added", "success", `Added new ${rate}% tax tier. Click Save Configurations to persist.`)
    }
    setBracketModalOpen(false)
  }

  const handleDeleteBracket = (index: number) => {
    if (taxBrackets.length <= 1) {
      showToast("Cannot Delete", "warning", "At least one tax tier must be defined.")
      return
    }
    const bracket = taxBrackets[index]
    const label = bracket
      ? bracket.max === null
        ? `Over ${bracket.min.toLocaleString()} ETB (${bracket.ratePercent}%)`
        : `${bracket.min.toLocaleString()} - ${bracket.max.toLocaleString()} ETB (${bracket.ratePercent}%)`
      : "this tier"

    confirm({
      title: "Delete Tax Bracket Tier",
      message: `Are you sure you want to delete the tax bracket tier "${label}"? This will modify the progressive income tax computation schedule.`,
      confirmLabel: "Delete Tier",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        setTaxBrackets((prev) => prev.filter((_, i) => i !== index))
        showToast("Tax Bracket Removed", "info", "Tier removed. Click Save Configurations to persist.")
      },
    })
  }

  // Simulation Calculations
  const simResults = useMemo(() => {
    const grossBasic = Number(simSalary) || 0
    const allowances = Number(simAllowance) || 0
    const empRate = Number(pensionEmpRate) || 0
    const compRate = Number(pensionCompRate) || 0
    const isExempt = simIsExpat && pensionExpatExempt

    const employeePension = isExempt ? 0 : Math.round(grossBasic * (empRate / 100) * 100) / 100
    const employerPension = isExempt ? 0 : Math.round(grossBasic * (compRate / 100) * 100) / 100
    const taxableBase = grossBasic + allowances
    const incomeTax = calculateEthiopianIncomeTax(taxableBase, taxBrackets)
    const totalDeductions = employeePension + incomeTax
    const grossTotal = grossBasic + allowances
    const netTakeHome = grossTotal - totalDeductions

    return {
      grossBasic,
      allowances,
      grossTotal,
      employeePension,
      employerPension,
      taxableBase,
      incomeTax,
      totalDeductions,
      netTakeHome,
      isExempt,
    }
  }, [simSalary, simAllowance, simIsExpat, pensionEmpRate, pensionCompRate, pensionExpatExempt, taxBrackets])

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
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Tax Engine & Schedules</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Multi-tax calculation rules, rate schedules, Chart of Accounts mappings, and Ethiopian statutory pension & payroll income tax brackets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("Finance")} />
          </div>
        </div>

        {/* TOP STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-blue-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Tax Rules</span>
            {isLoading ? (
              <Skeleton className="h-7 w-24 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black font-mono text-zinc-900 mt-1">{taxRules.length}</p>
            )}
            <span className="text-[10px] text-gray-400 mt-0.5">Commercial & VAT Rules</span>
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

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-amber-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Statutory Pension</span>
            <p className="text-xl font-black font-mono text-zinc-900 mt-1">
              {Number(pensionEmpRate || 7)}% + {Number(pensionCompRate || 11)}%
            </p>
            <span className="text-[10px] text-gray-400 mt-0.5">
              Total {Number(pensionEmpRate || 7) + Number(pensionCompRate || 11)}% Contribution
            </span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-purple-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Progressive PIT Tiers</span>
            <p className="text-xl font-black font-mono text-zinc-900 mt-1">{taxBrackets.length} Tiers</p>
            <span className="text-[10px] text-gray-400 mt-0.5">0% to 35% Income Tax</span>
          </GlassCard>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 mb-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("rules")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === "rules"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-white/60 text-zinc-600 hover:bg-white hover:text-zinc-900"
            )}
          >
            <Receipt className="size-4" />
            Tax Rules Master ({taxRules.length})
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === "schedules"
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-white/60 text-emerald-800 hover:bg-white hover:text-emerald-950"
            )}
          >
            <Layers className="size-4" />
            Tax Schedules (Multi-Tax Bundles) ({taxSchedules.length})
          </button>
          <button
            onClick={() => setActiveTab("pension")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === "pension"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-white/60 text-amber-800 hover:bg-white hover:text-amber-950"
            )}
          >
            <Scale className="size-4" />
            Pension & Employment Tax ({taxBrackets.length} Tiers)
          </button>
        </div>

        {/* TAB 1: TAX RULES */}
        {activeTab === "rules" && (
          <div className="space-y-4">
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
                      { value: "Customs Duty", label: "Customs Duty" },
                      { value: "Exempt", label: "Exempt / Zero-Rated" },
                    ],
                  },
                ]}
                actions={[{ label: "Add Tax Rule", onClick: () => setShowAddRuleModal(true) }]}
                onReload={async () => {
                  await Promise.all([finance.reloadFromApi(), erpStore.reloadFromApi()])
                }}
                isReloading={isLoading}
                reloadTooltip="Reload tax rules from server"
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
                      className="px-3 py-1 rounded-lg border border-zinc-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="font-mono font-bold text-zinc-800">
                      Page {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg border border-zinc-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* TAB 2: TAX SCHEDULES (BUNDLES) */}
        {activeTab === "schedules" && (
          <div className="space-y-4">
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
          </div>
        )}

        {/* TAB 3: PENSION & EMPLOYMENT TAX */}
        {activeTab === "pension" && (
          <div className="space-y-6">
            {/* 1. Ethiopian Statutory Pension Configuration */}
            <GlassCard className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/5">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
                    <Coins className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">Ethiopian Pension Scheme</h3>
                    <p className="text-xs text-gray-500">
                      Statutory contribution rates under Proclamation No. 1267/2022 (Public) &amp; No. 1268/2022 (Private Organization Employees).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <span className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" />
                    Mandatory Local Scheme
                  </span>
                  <button
                    type="button"
                    onClick={handleResetPensionToStatutory}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-2xl border border-black/10 bg-white hover:bg-gray-50 text-black text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" /> Reset to 7%/11%
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                    Employee Contribution Rate
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">Deducted from gross monthly basic salary (Default 7%).</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={pensionEmpRate}
                      onChange={(e) => setPensionEmpRate(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-white border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-black text-black font-mono outline-none focus:border-amber-600"
                    />
                    <span className="text-sm font-bold text-gray-500 font-mono">%</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                    Employer Contribution Rate
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">Company co-contribution on basic salary (Default 11%).</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={pensionCompRate}
                      onChange={(e) => setPensionCompRate(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-white border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-black text-black font-mono outline-none focus:border-amber-600"
                    />
                    <span className="text-sm font-bold text-gray-500 font-mono">%</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/5 flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                      Expatriate Exemption Rule
                    </label>
                    <p className="text-[11px] text-gray-500 mb-2">Foreign expatriate employees are legally exempt from Ethiopian pension.</p>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={pensionExpatExempt}
                      onChange={(e) => setPensionExpatExempt(e.target.checked)}
                      className="size-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 accent-amber-600"
                    />
                    <span className="text-xs font-bold text-black">Exempt Foreign Expats</span>
                  </label>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Statutory Sequence:</span> Employee pension ({Number(pensionEmpRate || 7)}%) is computed on the <strong>Gross Basic Salary</strong> and deducted <em>prior</em> to applying progressive employment income tax brackets. Employer pension ({Number(pensionCompRate || 11)}%) is recorded as a company payroll expense.
              </div>
            </GlassCard>

            {/* 2. Progressive Employment Income Tax Brackets */}
            <GlassCard className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/5">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
                    <Scale className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">Employment Income Tax Brackets (PIT)</h3>
                    <p className="text-xs text-gray-500">
                      Progressive tax rates and deductibles under Proclamation No. 1395/2025 applied automatically during monthly payroll calculation.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleResetBracketsToStatutory}
                    className="flex items-center gap-1 px-3 py-2 rounded-2xl border border-black/10 bg-white hover:bg-gray-50 text-black text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" /> Reset to Proc. 1395/2025
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBracketModal()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Plus className="size-4" /> Add Tax Tier
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/5 bg-black/[0.02] text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      <th className="py-3.5 px-4">Tier #</th>
                      <th className="py-3.5 px-4">Taxable Income Range (ETB)</th>
                      <th className="py-3.5 px-4">Marginal Tax Rate</th>
                      <th className="py-3.5 px-4">Statutory Deductible</th>
                      <th className="py-3.5 px-4">Calculation Quick Formula</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-xs">
                    {taxBrackets.map((bracket, index) => {
                      const rangeLabel =
                        bracket.max === null
                          ? `Over ${bracket.min.toLocaleString()} ETB`
                          : `${bracket.min.toLocaleString()} - ${bracket.max.toLocaleString()} ETB`
                      const formula =
                        bracket.ratePercent === 0
                          ? "0.00 ETB (Exempt)"
                          : `(Taxable Base × ${bracket.ratePercent}%) - ${bracket.deductible.toLocaleString()} ETB`

                      return (
                        <tr key={index} className="hover:bg-black/[0.015] transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-zinc-400">
                            #{index + 1}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-950 font-mono">
                            {rangeLabel}
                            {bracket.min === 0 && bracket.ratePercent === 0 && (
                              <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                                EXEMPT
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-black text-zinc-900 font-mono text-sm">
                            {bracket.ratePercent}%
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-700 font-mono">
                            {bracket.deductible.toLocaleString()} ETB
                          </td>
                          <td className="py-3.5 px-4 font-mono text-zinc-500 text-[11px]">
                            {formula}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenBracketModal(index)}
                                className="p-1.5 rounded-lg hover:bg-black/5 text-zinc-600 cursor-pointer"
                                title="Edit Tier"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBracket(index)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                                title="Delete Tier"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* 3. Interactive Live Payroll Tax & Net Take-Home Simulator */}
            <GlassCard className="p-6 md:p-8 bg-gradient-to-br from-white/90 to-emerald-50/30">
              <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-black/5">
                <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800">
                  <Calculator className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-black">Live Statutory Payroll Simulator</h3>
                  <p className="text-xs text-gray-500">
                    Test and verify real-time Ethiopian pension &amp; income tax computations based on the configured rates above.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inputs */}
                <div className="space-y-4 p-5 rounded-2xl bg-white border border-black/5 shadow-xs">
                  <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3.5 text-emerald-600" />
                    Simulation Inputs
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Monthly Gross Basic Salary (ETB)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={simSalary}
                      onChange={(e) => setSimSalary(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-zinc-50 border border-black/10 rounded-xl px-3 py-2 text-sm font-bold font-mono text-black outline-none focus:border-emerald-600 focus:bg-white"
                      placeholder="15000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Taxable Allowances (ETB)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={simAllowance}
                      onChange={(e) => setSimAllowance(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-zinc-50 border border-black/10 rounded-xl px-3 py-2 text-sm font-bold font-mono text-black outline-none focus:border-emerald-600 focus:bg-white"
                      placeholder="2000"
                    />
                  </div>

                  <div className="pt-2 border-t border-black/5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-800">
                      <input
                        type="checkbox"
                        checked={simIsExpat}
                        onChange={(e) => setSimIsExpat(e.target.checked)}
                        className="size-4 rounded accent-emerald-600"
                      />
                      <span>Foreign Expatriate Employee</span>
                    </label>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {simIsExpat && pensionExpatExempt
                        ? "Exempt from 7% employee and 11% employer pension."
                        : "Subject to full statutory pension deduction."}
                    </p>
                  </div>
                </div>

                {/* Calculation Breakdown */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-black/5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-black uppercase tracking-wider mb-4 flex items-center justify-between">
                      <span>Payroll Deduction Breakdown</span>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Total Gross: {simResults.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                      </span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Employee Pension ({Number(pensionEmpRate || 7)}%)</span>
                        <span className="text-base font-black font-mono text-amber-950">
                          {simResults.employeePension.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </span>
                        <span className="text-[9px] text-amber-700 block mt-0.5">Deducted from salary</span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/60">
                        <span className="text-[10px] font-bold text-blue-800 uppercase block">Employer Pension ({Number(pensionCompRate || 11)}%)</span>
                        <span className="text-base font-black font-mono text-blue-950">
                          {simResults.employerPension.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </span>
                        <span className="text-[9px] text-blue-700 block mt-0.5">Company co-share</span>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/60">
                        <span className="text-[10px] font-bold text-purple-800 uppercase block">PIT Income Tax</span>
                        <span className="text-base font-black font-mono text-purple-950">
                          {simResults.incomeTax.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </span>
                        <span className="text-[9px] text-purple-700 block mt-0.5">Progressive bracket</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs border-t border-black/5 pt-3">
                      <div className="flex items-center justify-between text-zinc-600">
                        <span>Taxable Base (Basic + Allowances):</span>
                        <span className="font-mono font-bold text-zinc-900">
                          {simResults.taxableBase.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-600">
                        <span>Total Statutory Deductions (Pension + PIT):</span>
                        <span className="font-mono font-bold text-rose-600">
                          -{simResults.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t-2 border-dashed border-zinc-200 flex items-center justify-between bg-emerald-50/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                        Net Monthly Take-Home Pay
                      </span>
                      <span className="text-xs text-emerald-700">Disbursed to Employee Bank Account</span>
                    </div>
                    <span className="text-2xl font-black font-mono text-emerald-900">
                      {simResults.netTakeHome.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Bottom Persistence Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDiscardPension}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full glass-card border border-black/5 text-xs font-bold hover:bg-white text-[#505054] transition-colors h-[38px] cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleSavePensionAndTax}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-black hover:bg-zinc-800 text-white text-xs font-bold active:scale-95 transition-all shadow-md h-[38px] cursor-pointer"
              >
                {isPensionSaved ? <Check className="size-3.5 text-emerald-400" /> : <Save className="size-3.5" />}
                {isPensionSaved ? "Configuration Saved" : "Save Pension & Tax Configuration"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ADD TAX RULE */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200">
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
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
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

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 block">Linked GL Account (From Company COA)</label>
                <COAAccountSelector
                  value={addRuleAccount}
                  onChange={(acc) => setAddRuleAccount(acc.code)}
                  placeholder="Select COA account..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Scope</label>
                  <select
                    value={addRuleAppliesTo}
                    onChange={(e) => setAddRuleAppliesTo(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
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
          </div>
        </div>
      )}

      {/* MODAL: EDIT TAX RULE */}
      {showEditRuleModal && editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200">
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
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
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

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 block">Linked GL Account</label>
                <COAAccountSelector
                  value={editRuleAccount}
                  onChange={(acc) => setEditRuleAccount(acc.code)}
                  placeholder="Select COA account..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Scope</label>
                  <select
                    value={editRuleAppliesTo}
                    onChange={(e) => setEditRuleAppliesTo(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
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
          </div>
        </div>
      )}

      {/* MODAL: CREATE TAX SCHEDULE / BUNDLE */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-200">
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
          </div>
        </div>
      )}

      {/* MODAL: ADD/EDIT PROGRESSIVE TAX BRACKET TIER */}
      {bracketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-black/10">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Scale className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-black">
                    {editingBracketIndex !== null ? "Edit Employment Tax Tier" : "Add Employment Tax Tier"}
                  </h3>
                  <p className="text-xs text-gray-500">Configure progressive bracket range and marginal tax rate</p>
                </div>
              </div>
              <button
                onClick={() => setBracketModalOpen(false)}
                className="p-2 rounded-full hover:bg-black/5 text-gray-400 hover:text-black transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-black uppercase tracking-wider mb-1.5">
                    Minimum Income (ETB)
                  </label>
                  <input
                    type="number"
                    value={bracketMin}
                    placeholder="0"
                    onChange={(e) => setBracketMin(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black font-mono outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-black uppercase tracking-wider mb-1.5">
                    Maximum Income (ETB)
                  </label>
                  <input
                    type="number"
                    value={bracketMax}
                    placeholder="Leave blank for No Cap"
                    onChange={(e) => setBracketMax(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black font-mono outline-none focus:border-emerald-600 focus:bg-white"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Leave empty for top tier (e.g. Over 14,000 ETB).</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-black uppercase tracking-wider mb-1.5">
                    Tax Rate (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={bracketRate}
                      placeholder="0"
                      onChange={(e) => setBracketRate(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black font-mono outline-none focus:border-emerald-600 focus:bg-white"
                    />
                    <span className="text-sm font-bold text-gray-500 font-mono">%</span>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-black uppercase tracking-wider mb-1.5">
                    Deductible (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bracketDeductible}
                    placeholder="0"
                    onChange={(e) => setBracketDeductible(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black font-mono outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 font-mono">
                Quick Formula: (Taxable Base × {Number(bracketRate) || 0}%) - {Number(bracketDeductible) || 0} ETB
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-black/5">
              <button
                onClick={() => setBracketModalOpen(false)}
                className="px-4 py-2 rounded-2xl border border-black/10 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBracket}
                className="px-5 py-2 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 shadow-md cursor-pointer"
              >
                {editingBracketIndex !== null ? "Update Tier" : "Add Tier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
