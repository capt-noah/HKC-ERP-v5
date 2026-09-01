import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FloatingNav } from "@/components/FloatingNav"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { GlassCard } from "@/components/GlassCard"
import { useFeedback } from "@/context/FeedbackContext"
import {
  Building2,
  SlidersHorizontal,
  Save,
  RotateCcw,
  Check,
  Receipt,
  Warehouse as WarehouseIcon,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  X,
  Percent,
  MapPin,
  Tag,
  UserCheck,
  MoreVertical,
  Coins,
  ShieldCheck,
  Scale,
  BookOpen,
} from "lucide-react"
import { useErpStore, type Warehouse } from "@/lib/erpStore"
import { useFinanceStore, type TaxRule } from "@/lib/financeStore"
import { DEFAULT_ETHIOPIAN_TAX_BRACKETS, DEFAULT_ETHIOPIAN_PENSION_CONFIG, type TaxBracket } from "@/core/hr/payrollEngine"
import { cn } from "@/lib/utils"
import { LoadingDots } from "@/components/ui/LoadingDots"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const listContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
}

function AdminSettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 animate-pulse">
      {/* Sidebar Tabs Skeleton */}
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full p-3.5 rounded-2xl bg-black/[0.03] border border-black/5 flex items-start gap-3.5">
            <div className="size-9 rounded-xl bg-black/10 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-4 w-32 bg-black/10 rounded-full" />
              <div className="h-2.5 w-44 bg-black/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Card Skeleton */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3.5 pb-4 border-b border-black/5">
          <div className="size-10 rounded-2xl bg-black/10 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 bg-black/10 rounded-lg" />
            <div className="h-3 w-72 bg-black/5 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="h-3 w-36 bg-black/10 rounded-full" />
              <div className="h-11 w-full bg-black/[0.04] rounded-2xl" />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
          <div className="h-10 w-28 bg-black/5 rounded-full" />
          <div className="h-10 w-36 bg-black/10 rounded-full" />
        </div>
      </GlassCard>
    </div>
  )
}

export default function AdminSettings() {
  const subPages = getSectionChildren("/admin")
  const { showToast, confirm } = useFeedback()
  const erp = useErpStore()
  const finance = useFinanceStore()
  const companySettings = finance.getCompanySettings()
  const accounts = finance.getAccounts()
  const taxRules = finance.getTaxRules()
  const warehouses = erp.getWarehouses()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"general" | "pension" | "tax" | "warehouses" | "rates" | "accounts">("general")
  const [isSaved, setIsSaved] = useState(false)

  // 1. General & Entity Profile State
  const [companyName, setCompanyName] = useState(companySettings.company_name || "")
  const [tinNumber, setTinNumber] = useState(companySettings.tin_number || "")
  const [address, setAddress] = useState(companySettings.address || "")
  const [contactEmail, setContactEmail] = useState(companySettings.contact_email || "")
  const [contactPhone, setContactPhone] = useState(companySettings.contact_phone || "")
  const [baseCurrency, setBaseCurrency] = useState(companySettings.base_currency || "ETB")
  const [fiscalYearStart, setFiscalYearStart] = useState(companySettings.fiscal_year_start || "July")

  // 2. Processing & Storage Rates State
  const [procRate, setProcRate] = useState<number | "">(companySettings.processing_rate_per_quintal ?? 0)
  const [baseStorage, setBaseStorage] = useState<number | "">(companySettings.base_storage_rate_per_quintal_day ?? 0)
  const [storageIncrement, setStorageIncrement] = useState<number | "">(companySettings.storage_increment_per_month ?? 0)
  const [maxStorageMonth, setMaxStorageMonth] = useState<number | "">(companySettings.max_storage_month_cap ?? 0)
  const [storageFreeDays, setStorageFreeDays] = useState<number | "">(companySettings.storage_free_days ?? 0)

  // 3. Default GL Account Mappings State
  const [defaultInventoryAcc, setDefaultInventoryAcc] = useState(companySettings.default_inventory_account_id || "")
  const [defaultRevenueAcc, setDefaultRevenueAcc] = useState(companySettings.default_revenue_account_id || "")
  const [defaultCogsAcc, setDefaultCogsAcc] = useState(companySettings.default_cogs_account_id || "")
  const [defaultDamageAcc, setDefaultDamageAcc] = useState(companySettings.default_damage_account_id || "")
  const [defaultCashAcc, setDefaultCashAcc] = useState(companySettings.default_cash_account_id || "")

  // 4. Ethiopian Pension & Progressive Tax Brackets State
  const [pensionEmpRate, setPensionEmpRate] = useState<number | "">(companySettings.pension_employee_rate ?? 7)
  const [pensionCompRate, setPensionCompRate] = useState<number | "">(companySettings.pension_employer_rate ?? 11)
  const [pensionExpatExempt, setPensionExpatExempt] = useState<boolean>(companySettings.pension_expat_exempt ?? true)
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>(
    companySettings.tax_brackets_config && companySettings.tax_brackets_config.length > 0
      ? companySettings.tax_brackets_config
      : DEFAULT_ETHIOPIAN_TAX_BRACKETS
  )
  const [bracketModalOpen, setBracketModalOpen] = useState(false)
  const [editingBracketIndex, setEditingBracketIndex] = useState<number | null>(null)
  const [bracketMin, setBracketMin] = useState<number | "">(0)
  const [bracketMax, setBracketMax] = useState<number | "">(2000)
  const [bracketRate, setBracketRate] = useState<number | "">(0)
  const [bracketDeductible, setBracketDeductible] = useState<number | "">(0)

  // 5. Tax Rules Modal & Editing State
  const [taxModalOpen, setTaxModalOpen] = useState(false)
  const [editingTaxRule, setEditingTaxRule] = useState<TaxRule | null>(null)
  const [taxName, setTaxName] = useState("")
  const [taxRate, setTaxRate] = useState<number>(0)
  const [taxType, setTaxType] = useState<TaxRule["type"]>("VAT/GST")
  const [taxAccountCode, setTaxAccountCode] = useState("")
  const [taxIsInclusive, setTaxIsInclusive] = useState(false)
  const [taxDescription, setTaxDescription] = useState("")

  // 6. Warehouse Modal & Editing State
  const [whModalOpen, setWhModalOpen] = useState(false)
  const [isSavingWh, setIsSavingWh] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [whName, setWhName] = useState("")
  const [whCode, setWhCode] = useState("")
  const [whLocation, setWhLocation] = useState("")
  const [whType, setWhType] = useState("Dry Storage / Processing")
  const [whSpecialization, setWhSpecialization] = useState("Commercial & Specialty Coffee")
  const [whTargetMarkets, setWhTargetMarkets] = useState("Domestic & Export")
  const [whManager, setWhManager] = useState("")
  const [whStatus, setWhStatus] = useState("Active")
  const [activeWhMenuId, setActiveWhMenuId] = useState<string | null>(null)

  const syncFormFromSettings = (s: any) => {
    setCompanyName(s.company_name || "")
    setTinNumber(s.tin_number || "")
    setAddress(s.address || "")
    setContactEmail(s.contact_email || "")
    setContactPhone(s.contact_phone || "")
    setBaseCurrency(s.base_currency || "ETB")
    setFiscalYearStart(s.fiscal_year_start || "July")
    setProcRate(s.processing_rate_per_quintal ?? 0)
    setBaseStorage(s.base_storage_rate_per_quintal_day ?? 0)
    setStorageIncrement(s.storage_increment_per_month ?? 0)
    setMaxStorageMonth(s.max_storage_month_cap ?? 0)
    setStorageFreeDays(s.storage_free_days ?? 0)
    setDefaultInventoryAcc(s.default_inventory_account_id || "")
    setDefaultRevenueAcc(s.default_revenue_account_id || "")
    setDefaultCogsAcc(s.default_cogs_account_id || "")
    setDefaultDamageAcc(s.default_damage_account_id || "")
    setDefaultCashAcc(s.default_cash_account_id || "")
    setPensionEmpRate(s.pension_employee_rate ?? 7)
    setPensionCompRate(s.pension_employer_rate ?? 11)
    setPensionExpatExempt(s.pension_expat_exempt ?? true)
    setTaxBrackets(
      s.tax_brackets_config && s.tax_brackets_config.length > 0
        ? s.tax_brackets_config
        : DEFAULT_ETHIOPIAN_TAX_BRACKETS
    )
  }

  // Fetch verified data from DB / stores on initial mount
  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      try {
        await Promise.all([erp.loadFromApi(), finance.loadFromApi()])
        if (active) {
          const fresh = finance.getCompanySettings()
          syncFormFromSettings(fresh)
        }
      } catch (err) {
        console.warn("Failed to load settings data:", err)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadData()

    const unsubFinance = finance.subscribe(() => {
      if (active) {
        const fresh = finance.getCompanySettings()
        syncFormFromSettings(fresh)
      }
    })

    return () => {
      active = false
      unsubFinance()
    }
  }, [])

  // Save Company, Pension & Rates Configurations
  const handleSave = () => {
    confirm({
      title: "Save System Settings",
      message: "Save changes to company profile, fee rates, pension parameters, and tax brackets?",
      confirmLabel: "Save Configurations",
      cancelLabel: "Cancel",
      onConfirm: () => {
        const updated = {
          company_name: companyName,
          tin_number: tinNumber,
          address,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          base_currency: baseCurrency,
          fiscal_year_start: fiscalYearStart,
          processing_rate_per_quintal: Number(procRate) || 0,
          base_storage_rate_per_quintal_day: Number(baseStorage) || 0,
          storage_increment_per_month: Number(storageIncrement) || 0,
          max_storage_month_cap: Number(maxStorageMonth) || 0,
          storage_free_days: Number(storageFreeDays) || 0,
          default_inventory_account_id: defaultInventoryAcc,
          default_revenue_account_id: defaultRevenueAcc,
          default_cogs_account_id: defaultCogsAcc,
          default_damage_account_id: defaultDamageAcc,
          default_cash_account_id: defaultCashAcc,
          pension_employee_rate: Number(pensionEmpRate) || 0,
          pension_employer_rate: Number(pensionCompRate) || 0,
          pension_expat_exempt: Boolean(pensionExpatExempt),
          tax_brackets_config: taxBrackets,
        }

        erp.updateCompanySettings(updated)
        setIsSaved(true)
        showToast("Settings Saved", "success", "Configuration parameters have been saved successfully.")
        setTimeout(() => setIsSaved(false), 3000)
      },
    })
  }

  // Discard Unsaved Changes (revert form state back to store values)
  const handleDiscardChanges = () => {
    const s = finance.getCompanySettings()
    setCompanyName(s.company_name || "")
    setTinNumber(s.tin_number || "")
    setAddress(s.address || "")
    setContactEmail(s.contact_email || "")
    setContactPhone(s.contact_phone || "")
    setBaseCurrency(s.base_currency || "ETB")
    setFiscalYearStart(s.fiscal_year_start || "July")
    setProcRate(s.processing_rate_per_quintal ?? 0)
    setBaseStorage(s.base_storage_rate_per_quintal_day ?? 0)
    setStorageIncrement(s.storage_increment_per_month ?? 0)
    setMaxStorageMonth(s.max_storage_month_cap ?? 0)
    setStorageFreeDays(s.storage_free_days ?? 0)
    setDefaultInventoryAcc(s.default_inventory_account_id || "")
    setDefaultRevenueAcc(s.default_revenue_account_id || "")
    setDefaultCogsAcc(s.default_cogs_account_id || "")
    setDefaultDamageAcc(s.default_damage_account_id || "")
    setDefaultCashAcc(s.default_cash_account_id || "")
    setPensionEmpRate(s.pension_employee_rate ?? 7)
    setPensionCompRate(s.pension_employer_rate ?? 11)
    setPensionExpatExempt(s.pension_expat_exempt ?? true)
    setTaxBrackets(
      s.tax_brackets_config && s.tax_brackets_config.length > 0
        ? s.tax_brackets_config
        : DEFAULT_ETHIOPIAN_TAX_BRACKETS
    )
    showToast("Changes Discarded", "info", "Form changes have been reverted.")
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
      showToast("Tax Bracket Updated", "success", `Tier updated to ${rate}% rate. Click Save Settings to persist.`)
    } else {
      setTaxBrackets((prev) => [...prev, updatedBracket])
      showToast("Tax Bracket Added", "success", `Added new ${rate}% tax tier. Click Save Settings to persist.`)
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
      message: `Are you sure you want to delete the tax bracket tier "${label}"? This will modify the progressive income tax computation table.`,
      confirmLabel: "Delete Tier",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        setTaxBrackets((prev) => prev.filter((_, i) => i !== index))
        showToast("Tax Bracket Removed", "info", "Tier removed. Click Save Changes to apply.")
      },
    })
  }

  const handleResetPension = () => {
    confirm({
      title: "Reset Pension Scheme to Statutory Defaults",
      message: "Reset employee contribution rate to 7%, employer contribution rate to 11%, and enable expatriate exemption (Proclamation No. 1268/2022)?",
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

  const handleResetDefaultBrackets = () => {
    confirm({
      title: "Reset to Proclamation No. 1395/2025",
      message: "Reset all employment income tax brackets and pension contribution rates to standard Ethiopian statutory defaults?",
      confirmLabel: "Reset to Legal Defaults",
      cancelLabel: "Cancel",
      onConfirm: () => {
        setTaxBrackets(DEFAULT_ETHIOPIAN_TAX_BRACKETS)
        setPensionEmpRate(DEFAULT_ETHIOPIAN_PENSION_CONFIG.employeeRatePercent)
        setPensionCompRate(DEFAULT_ETHIOPIAN_PENSION_CONFIG.employerRatePercent)
        setPensionExpatExempt(DEFAULT_ETHIOPIAN_PENSION_CONFIG.expatExempt)
        showToast("Brackets Reset", "success", "Loaded statutory rules (0-2000 ETB exempt, up to 35% above 14k ETB, 7%/11% pension).")
      },
    })
  }

  // --- Tax Rule Handlers ---
  const handleOpenTaxModal = (rule?: TaxRule) => {
    if (rule) {
      setEditingTaxRule(rule)
      setTaxName(rule.name)
      setTaxRate(rule.ratePercent)
      setTaxType(rule.type)
      setTaxAccountCode(rule.accountCode || "")
      setTaxIsInclusive(rule.isInclusive || false)
      setTaxDescription(rule.description || "")
    } else {
      setEditingTaxRule(null)
      setTaxName("")
      setTaxRate(15)
      setTaxType("VAT/GST")
      setTaxAccountCode("")
      setTaxIsInclusive(false)
      setTaxDescription("")
    }
    setTaxModalOpen(true)
  }

  const handleSaveTaxRule = () => {
    if (!taxName.trim()) {
      showToast("Validation Error", "warning", "Please provide a valid tax name.")
      return
    }
    if (isNaN(taxRate) || taxRate < 0) {
      showToast("Validation Error", "warning", "Tax rate percentage must be a non-negative number.")
      return
    }

    if (editingTaxRule) {
      finance.updateTaxRule(editingTaxRule.id, {
        name: taxName.trim(),
        ratePercent: Number(taxRate),
        type: taxType,
        accountCode: taxAccountCode.trim(),
        isInclusive: taxIsInclusive,
        description: taxDescription.trim(),
      })
      showToast("Tax Rate Updated", "success", `Tax rule '${taxName}' has been updated to ${taxRate}%.`)
    } else {
      finance.addTaxRule({
        name: taxName.trim(),
        ratePercent: Number(taxRate),
        type: taxType,
        accountCode: taxAccountCode.trim(),
        isInclusive: taxIsInclusive,
        description: taxDescription.trim(),
      })
      showToast("Tax Rule Created", "success", `New tax rule '${taxName}' with ${taxRate}% rate has been added.`)
    }
    setTaxModalOpen(false)
  }

  const handleDeleteTaxRule = (id: string, name: string) => {
    confirm({
      title: "Delete Tax Rule",
      message: `Are you sure you want to delete tax rule '${name}'? Existing historical invoices will retain their recorded totals.`,
      confirmLabel: "Delete Rule",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        finance.deleteTaxRule(id)
        showToast("Tax Rule Deleted", "info", `Tax rule '${name}' was removed.`)
      },
    })
  }

  // --- Warehouse Handlers ---
  const handleOpenWhModal = (wh?: Warehouse) => {
    if (wh) {
      setEditingWarehouse(wh)
      setWhName(wh.name)
      setWhCode(wh.code || wh.id)
      setWhLocation(wh.location || "")
      setWhType(wh.type || "Dry Storage / Processing")
      setWhSpecialization(wh.specialization || "Commercial & Specialty Coffee")
      setWhTargetMarkets(wh.targetMarkets || "Domestic & Export")
      setWhManager(wh.manager || "")
      setWhStatus(wh.status || "Active")
    } else {
      setEditingWarehouse(null)
      setWhName("")
      setWhCode("")
      setWhLocation("")
      setWhType("Dry Storage / Processing")
      setWhSpecialization("Commercial & Specialty Coffee")
      setWhTargetMarkets("Domestic & Export")
      setWhManager("")
      setWhStatus("Active")
    }
    setWhModalOpen(true)
  }
  const handleOpenCreateWarehouseModal = () => handleOpenWhModal()
  const handleOpenEditWarehouseModal = (wh: Warehouse) => handleOpenWhModal(wh)

  const handleSaveWarehouse = async () => {
    if (!whName.trim()) {
      showToast("Validation Error", "warning", "Warehouse name is required.")
      return
    }

    try {
      setIsSavingWh(true)
      if (editingWarehouse) {
        await erp.updateWarehouse(editingWarehouse.id, {
          name: whName.trim(),
          code: whCode.trim() || editingWarehouse.id,
          location: whLocation.trim(),
          type: whType,
          specialization: whSpecialization.trim(),
          targetMarkets: whTargetMarkets.trim(),
          manager: whManager.trim() || "Unassigned",
          status: whStatus,
        })
        showToast("Warehouse Updated", "success", `Warehouse '${whName}' updated successfully.`)
      } else {
        await erp.addWarehouse({
          name: whName.trim(),
          code: whCode.trim(),
          location: whLocation.trim(),
          type: whType,
          specialization: whSpecialization.trim(),
          targetMarkets: whTargetMarkets.trim(),
          manager: whManager.trim() || "Unassigned",
          status: whStatus,
        })
        showToast("Warehouse Created", "success", `New warehouse facility '${whName}' added.`)
      }
      setWhModalOpen(false)
    } catch (err: any) {
      showToast("Save Failed", "warning", err.message || "Failed to save warehouse.")
    } finally {
      setIsSavingWh(false)
    }
  }

  const handleDeleteWarehouse = (wh: Warehouse) => {
    setActiveWhMenuId(null)

    // Prompt 1: Initial Warning Confirmation
    confirm({
      title: "Step 1 of 2: Confirm Warehouse Deletion",
      message: `Are you sure you want to request deletion of warehouse facility '${wh.name}' (${wh.code || wh.id})? This facility must have 0 active stock in inventory before it can be removed.`,
      confirmLabel: "Proceed to Final Confirmation",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        // Prompt 2: Final High-Security Confirmation
        setTimeout(() => {
          confirm({
            title: `⚠️ FINAL CONFIRMATION (Step 2 of 2): Permanent Delete`,
            message: `FINAL STEP: Are you absolutely certain you want to permanently delete '${wh.name}' (${wh.code || wh.id})? This action is irreversible.`,
            confirmLabel: "Yes, Permanently Delete Facility",
            cancelLabel: "Abort Deletion",
            isDestructive: true,
            onConfirm: async () => {
              const res = await erp.deleteWarehouse(wh.id)
              if (res.success) {
                showToast("Warehouse Deleted", "info", `Warehouse facility '${wh.name}' has been permanently deleted.`)
              } else {
                showToast("Deletion Blocked", "warning", res.error || "Could not delete warehouse.")
              }
            },
          })
        }, 150)
      },
    })
  }

  const settingsTabs = [
    { id: "general" as const, label: "Company Profile", icon: Building2, description: "Legal entity, TIN, address & currency" },
    { id: "pension" as const, label: "Pension & Employment Tax", icon: Scale, description: "Statutory 7%/11% rates & progressive income tax tiers" },
    { id: "tax" as const, label: "Tax Rates & Rules", icon: Receipt, description: "Configure VAT, withholding & customs rates" },
    { id: "warehouses" as const, label: "Warehouse Facilities", icon: WarehouseIcon, description: "Change warehouse names, codes & details" },
    { id: "rates" as const, label: "Processing & Storage", icon: SlidersHorizontal, description: "Toll fee rates & tiered monthly storage" },
    { id: "accounts" as const, label: "GL Account Mappings", icon: BookOpen, description: "Default inventory, revenue, and COGS accounts" },
  ]

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={fade} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-3 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white flex items-center gap-1">
                <Sparkles className="size-3 text-emerald-400" /> Operational Configurations
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">System Settings</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Configure company profile, tax rules, warehouse locations, fee schedules, and statutory rates.</p>
          </div>
          <div className="shrink-0">
            <SubPageNav items={subPages} />
          </div>
        </div>



        {/* Layout Main Grid or Skeleton */}
        {loading ? (
          <AdminSettingsSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 sm:gap-6">
            {/* Sidebar Tabs (Horizontal swipe on mobile/tablet, vertical stack on desktop) */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar overscroll-x-contain pb-2 lg:pb-0 py-1 -my-1">
            {settingsTabs.map((tab) => {
              const TabIcon = tab.icon
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "text-left p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center lg:items-start gap-3 group shrink-0 min-w-[200px] sm:min-w-[240px] lg:min-w-0 lg:w-full active:scale-95 cursor-pointer",
                    isSelected
                      ? "bg-[#1c1c1e] border-transparent text-white shadow-md shadow-black/10"
                      : "glass-card border-black/[0.03] text-[#505054] hover:text-black hover:bg-white/80 hover:border-black/10"
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "bg-white/10 text-white"
                        : "bg-black/5 text-[#505054] group-hover:bg-black/10 group-hover:text-black"
                    )}
                  >
                    <TabIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs sm:text-sm font-bold leading-tight truncate lg:whitespace-normal", isSelected ? "text-white" : "text-black")}>
                      {tab.label}
                    </p>
                    <p className={cn("text-[10px] sm:text-xs mt-0.5 truncate hidden sm:block", isSelected ? "text-zinc-400" : "text-gray-400")}>
                      {tab.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Settings Tab Content */}
          <div className="flex flex-col gap-6">
            <AnimatePresence mode="wait">
                {/* Tab 1: Company Profile */}
                {activeTab === "general" && (
                  <motion.div key="general" variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
                    <GlassCard>
                      <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-black/5">
                        <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
                          <Building2 className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-black">Company & Entity Profile</h3>
                          <p className="text-xs text-gray-400">Configure legal enterprise metadata, tax identity, and official business contacts.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Legal Enterprise Name</label>
                          <input
                            type="text"
                            value={companyName}
                            placeholder="e.g. HKC Trading Enterprise"
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">TIN / Tax Number</label>
                          <input
                            type="text"
                            value={tinNumber}
                            placeholder="e.g. 0012345678"
                            onChange={(e) => setTinNumber(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Contact Email</label>
                          <input
                            type="email"
                            value={contactEmail}
                            placeholder="e.g. info@hkctrading.com"
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Contact Phone</label>
                          <input
                            type="text"
                            value={contactPhone}
                            placeholder="e.g. +251 11 662 4580"
                            onChange={(e) => setContactPhone(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors font-mono"
                          />
                        </div>
                      </div>

                      <div className="mb-5">
                        <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Head Office Physical Address</label>
                        <input
                          type="text"
                          value={address}
                          placeholder="e.g. Bole Subcity, Woreda 03, Addis Ababa, Ethiopia"
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Primary Operating Currency</label>
                          <select
                            value={baseCurrency}
                            onChange={(e) => setBaseCurrency(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                          >
                            <option value="ETB">ETB (Br) - Ethiopian Birr</option>
                            <option value="USD">USD ($) - United States Dollar</option>
                            <option value="EUR">EUR (€) - Euro</option>
                            <option value="GBP">GBP (£) - British Pound</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Fiscal Year Start Month</label>
                          <select
                            value={fiscalYearStart}
                            onChange={(e) => setFiscalYearStart(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                          >
                            <option value="July">July (Hamle 1 - Ethiopian Fiscal Calendar)</option>
                            <option value="January">January (Gregorian Fiscal Calendar)</option>
                            <option value="September">September (Meskerem 1)</option>
                          </select>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}

                {/* Tab 2: Pension & Employment Tax */}
                {activeTab === "pension" && (
                  <motion.div key="pension" variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
                    {/* 1. Ethiopian Statutory Pension Configuration */}
                    <GlassCard>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/5">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
                            <Coins className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-black">Ethiopian Pension Scheme</h3>
                            <p className="text-xs text-gray-400">
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
                            onClick={handleResetPension}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-2xl border border-black/10 bg-white hover:bg-gray-50 text-black text-xs font-bold transition-all shadow-xs"
                          >
                            <RotateCcw className="size-3.5" /> Reset to 7%/11%
                          </button>
                          <button
                            type="button"
                            onClick={handleSave}
                            className="flex items-center gap-1 px-3.5 py-1.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
                          >
                            <Save className="size-3.5" /> Save Pension
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                        <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/5">
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                            Employee Contribution Rate
                          </label>
                          <p className="text-[11px] text-gray-400 mb-2">Deducted from gross monthly basic salary (Default 7%).</p>
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
                          <p className="text-[11px] text-gray-400 mb-2">Company co-contribution on basic salary (Default 11%).</p>
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
                            <p className="text-[11px] text-gray-400 mb-2">Foreign expatriate employees are legally exempt from Ethiopian pension.</p>
                          </div>
                          <label className="flex items-center gap-2.5 cursor-pointer mt-2">
                            <input
                              type="checkbox"
                              checked={pensionExpatExempt}
                              onChange={(e) => setPensionExpatExempt(e.target.checked)}
                              className="size-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-xs font-bold text-black">Exempt Foreign Expats</span>
                          </label>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">Statutory Sequence:</span> Employee pension (7%) is computed on the <strong>Gross Basic Salary</strong> and deducted <em>prior</em> to applying progressive employment income tax brackets.
                      </div>
                    </GlassCard>

                    {/* 2. Progressive Employment Income Tax Brackets */}
                    <GlassCard>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/5">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
                            <Scale className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-black">Employment Income Tax Brackets</h3>
                            <p className="text-xs text-gray-400">
                              Progressive tax rates and deductibles under Proclamation No. 1395/2025 applied to Taxable Base ((Basic + Allowances) - 7% Pension).
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={handleResetDefaultBrackets}
                            className="flex items-center gap-1 px-3 py-2 rounded-2xl border border-black/10 bg-white hover:bg-gray-50 text-black text-xs font-bold transition-all shadow-xs"
                          >
                            <RotateCcw className="size-3.5" /> Reset to Proc. 1395/2025
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBracketModal()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                          >
                            <Plus className="size-4" /> Add Tax Tier
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-black/5 bg-black/[0.02] text-[10px] font-black uppercase tracking-wider text-zinc-500">
                              <th className="py-3 px-4">Taxable Income Range (ETB)</th>
                              <th className="py-3 px-4">Marginal Tax Rate</th>
                              <th className="py-3 px-4">Statutory Deductible</th>
                              <th className="py-3 px-4">Calculation Quick Formula</th>
                              <th className="py-3 px-4 text-right">Action</th>
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
                                <tr key={index} className="hover:bg-black/[0.02] transition-colors">
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
                                        className="p-1.5 rounded-lg hover:bg-black/5 text-zinc-600"
                                        title="Edit Tier"
                                      >
                                        <Pencil className="size-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBracket(index)}
                                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
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
                  </motion.div>
                )}

                {/* Tab 3: Tax Rates & Rules (Corporate & Commercial Taxes) */}
                {activeTab === "tax" && (
                  <motion.div key="tax" variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
                    {/* Standard Commercial Tax Rules (VAT, Withholding, Duties) */}
                    <GlassCard>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/5">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700">
                            <Receipt className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-black">Commercial Transaction Taxes</h3>
                            <p className="text-xs text-gray-400">Manage standard VAT, withholding tax (TDS), and customs duty rates.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenTaxModal()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
                        >
                          <Plus className="size-4" /> Add Tax Rule
                        </button>
                      </div>

                      {taxRules.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-black/10 rounded-2xl">
                          <Percent className="size-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-gray-500">No Commercial Tax Rules Configured</p>
                          <p className="text-xs text-gray-400 mt-1">Click &quot;Add Tax Rule&quot; to establish standard VAT or withholding tax rates.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {taxRules.map((rule) => (
                            <div
                              key={rule.id}
                              className="p-4 rounded-2xl bg-black/[0.02] border border-black/5 hover:border-black/15 transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {rule.type}
                                    </span>
                                    <h4 className="text-base font-bold text-black mt-1.5">{rule.name}</h4>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-2xl font-black text-black tracking-tight">{rule.ratePercent}%</span>
                                    <p className="text-[10px] font-semibold text-gray-400">{rule.isInclusive ? "Tax Inclusive" : "Tax Exclusive"}</p>
                                  </div>
                                </div>
                                {rule.description && <p className="text-xs text-gray-500 mb-3">{rule.description}</p>}
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 pt-2 border-t border-black/5 font-mono">
                                  <span>GL Account:</span>
                                  <span className="font-bold text-black">{rule.accountCode || "Default Tax Ledger"}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-black/5">
                                <button
                                  onClick={() => handleOpenTaxModal(rule)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-gray-50 text-black text-xs font-semibold transition-all"
                                >
                                  <Pencil className="size-3.5" /> Edit Rate
                                </button>
                                <button
                                  onClick={() => handleDeleteTaxRule(rule.id, rule.name)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-all"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                )}

                {/* Tab 4: Warehouse Facilities */}
                {activeTab === "warehouses" && (
                  <motion.div key="warehouses" variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
                    <GlassCard>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/5">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
                            <WarehouseIcon className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-black">Operating Warehouses & Facilities</h3>
                            <p className="text-xs text-gray-400">Add, rename, edit location, or delete processing and storage centers.</p>
                          </div>
                        </div>
                        <button
                          onClick={handleOpenCreateWarehouseModal}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
                        >
                          <Plus className="size-4" /> Add Warehouse
                        </button>
                      </div>

                      {warehouses.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-black/10 rounded-2xl">
                          <WarehouseIcon className="size-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-gray-500">No Warehouse Facilities Configured</p>
                          <p className="text-xs text-gray-400 mt-1">Add your coffee processing plants, central hubs, or regional stations.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {warehouses.map((wh) => {
                            const isAssignedMenuOpen = activeWhMenuId === wh.id
                            return (
                              <div
                                key={wh.id}
                                className="relative p-5 rounded-2xl bg-black/[0.02] border border-black/5 hover:border-black/15 transition-all flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2 mb-3">
                                    <div>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                        {wh.code || "WH"}
                                      </span>
                                      <h4 className="text-base font-bold text-black mt-1.5 leading-snug">{wh.name}</h4>
                                    </div>
                                    <div className="relative">
                                      <button
                                        onClick={() => setActiveWhMenuId(isAssignedMenuOpen ? null : wh.id)}
                                        className="p-1.5 rounded-xl hover:bg-black/5 text-gray-400 hover:text-black transition-colors"
                                      >
                                        <MoreVertical className="size-4" />
                                      </button>
                                      {isAssignedMenuOpen && (
                                        <div className="absolute right-0 top-8 z-30 w-36 bg-white rounded-2xl shadow-xl border border-black/10 p-1.5 flex flex-col gap-1">
                                          <button
                                            onClick={() => handleOpenEditWarehouseModal(wh)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-black hover:bg-black/5 w-full text-left"
                                          >
                                            <Pencil className="size-3.5" /> Edit Details
                                          </button>
                                          <button
                                            onClick={() => handleDeleteWarehouse(wh)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 w-full text-left"
                                          >
                                            <Trash2 className="size-3.5" /> Delete Facility
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="size-3.5 text-gray-400 shrink-0" />
                                      <span className="truncate">{wh.location || "Location not specified"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Tag className="size-3.5 text-gray-400 shrink-0" />
                                      <span>{wh.type || "Dry Storage / Processing"}</span>
                                    </div>
                                    {wh.manager && (
                                      <div className="flex items-center gap-2">
                                        <UserCheck className="size-3.5 text-gray-400 shrink-0" />
                                        <span>{wh.manager}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-black/5 text-xs">
                                  <span className="font-semibold text-gray-400">{wh.targetMarkets || "Domestic & Export"}</span>
                                  <button
                                    onClick={() => handleOpenEditWarehouseModal(wh)}
                                    className="px-3 py-1 rounded-xl bg-white border border-black/10 text-xs font-bold text-black hover:bg-black/5 transition-colors shadow-2xs"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                )}

                {/* Tab 5: Processing & Storage Rates */}
                {activeTab === "rates" && (
                  <motion.div key="rates" variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
                    <GlassCard>
                      <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-black/5">
                        <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
                          <SlidersHorizontal className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-black">Toll Processing &amp; Storage Fee Matrix</h3>
                          <p className="text-xs text-gray-400">Default processing rates per quintal and tiered monthly storage charge schedules.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Standard Processing Fee (ETB / Quintal)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={procRate}
                            placeholder="0.00"
                            onChange={(e) => setProcRate(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors font-mono"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Base rate applied when generating Toll Processing job orders.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Base Storage Rate (ETB / Quintal / Day)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={baseStorage}
                            placeholder="0.00"
                            onChange={(e) => setBaseStorage(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors font-mono"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Starting daily storage fee assessed per quintal for month 1.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Monthly Storage Increment (ETB / Qtl / Month)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={storageIncrement}
                            placeholder="0.00"
                            onChange={(e) => setStorageIncrement(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors font-mono"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Automatic fee addition applied for each month goods remain stored.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Max Storage Month Cap (Months)</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={maxStorageMonth}
                            placeholder="0"
                            onChange={(e) => setMaxStorageMonth(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors font-mono"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Maximum month cap before tiered storage rates stop compounding.</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Free Storage Grace Period (Days)</label>
                        <input
                          type="number"
                          min="0"
                          value={storageFreeDays}
                          placeholder="0"
                          onChange={(e) => setStorageFreeDays(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full md:w-1/2 bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-emerald-600 focus:bg-white transition-colors font-mono"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Initial grace window before storage fees begin accruing.</p>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}

                {/* Tab 6: GL Account Mappings */}
                {activeTab === "accounts" && (
                  <motion.div key="accounts" variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
                    <GlassCard>
                      <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-black/5">
                        <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700">
                          <BookOpen className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-black">Chart of Accounts GL Mappings</h3>
                          <p className="text-xs text-gray-400">Map automated ERP transactions directly to corresponding General Ledger accounts.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Default Inventory Asset Account</label>
                          <select
                            value={defaultInventoryAcc}
                            onChange={(e) => setDefaultInventoryAcc(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                          >
                            <option value="">Select Inventory Account...</option>
                            {accounts.filter((a) => a.account_type === "Asset" && !a.is_group).map((a) => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Default Sales Revenue Account</label>
                          <select
                            value={defaultRevenueAcc}
                            onChange={(e) => setDefaultRevenueAcc(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                          >
                            <option value="">Select Revenue Account...</option>
                            {accounts.filter((a) => a.account_type === "Revenue" && !a.is_group).map((a) => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Default Cost of Goods Sold (COGS) Account</label>
                          <select
                            value={defaultCogsAcc}
                            onChange={(e) => setDefaultCogsAcc(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                          >
                            <option value="">Select COGS Account...</option>
                            {accounts.filter((a) => a.account_type === "Expense" && !a.is_group).map((a) => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Default Damage / Adjustment Loss Account</label>
                          <select
                            value={defaultDamageAcc}
                            onChange={(e) => setDefaultDamageAcc(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                          >
                            <option value="">Select Adjustment Account...</option>
                            {accounts.filter((a) => a.account_type === "Expense" && !a.is_group).map((a) => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">Primary Settlement Bank / Cash Account</label>
                          <select
                            value={defaultCashAcc}
                            onChange={(e) => setDefaultCashAcc(e.target.value)}
                            className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                          >
                            <option value="">Select Cash/Bank Account...</option>
                            {accounts.filter((a) => a.account_type === "Asset" && !a.is_group).map((a) => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>

            {/* Bottom Action Buttons (for tabs with general form inputs) */}
            {["general", "pension", "tax", "rates", "accounts"].includes(activeTab) && (
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={handleDiscardChanges}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full glass-card border border-black/5 text-xs font-bold hover:bg-white text-[#505054] transition-colors h-[38px]"
                >
                  <RotateCcw className="size-3.5" />
                  Discard Changes
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-black hover:bg-zinc-800 text-white text-xs font-bold active:scale-95 transition-all shadow-md h-[38px]"
                >
                  {isSaved ? <Check className="size-3.5 text-emerald-400" /> : <Save className="size-3.5" />}
                  {isSaved ? "Settings Saved" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </motion.div>

      {/* Modal: Add/Edit Tax Rule */}
      <AnimatePresence>
        {taxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-black/10"
            >
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                    <Receipt className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">
                      {editingTaxRule ? "Edit Tax Rule" : "Add New Tax Rule"}
                    </h3>
                    <p className="text-xs text-gray-400">Configure tax rates and statutory categories</p>
                  </div>
                </div>
                <button
                  onClick={() => setTaxModalOpen(false)}
                  className="p-2 rounded-full hover:bg-black/5 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Tax Name</label>
                  <input
                    type="text"
                    value={taxName}
                    placeholder="e.g. Standard VAT (15%)"
                    onChange={(e) => setTaxName(e.target.value)}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Tax Type</label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as TaxRule["type"])}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white"
                  >
                    <option value="VAT/GST">VAT / GST</option>
                    <option value="Withholding Tax (TDS)">Withholding Tax (TDS)</option>
                    <option value="Import Duty">Import Duty</option>
                  </select>
                </div>

                {/* Horizontal Scroll / Slider Bar for Tax Percentage */}
                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-black uppercase tracking-wider">
                        Tax Rate Percentage
                      </label>
                      <p className="text-[11px] text-gray-400">Slide or scroll to select exact rate with decimals.</p>
                    </div>
                    <div className="flex items-center bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-2xl shadow-xs">
                      <span className="text-xl font-black text-indigo-700 font-mono tracking-tight">
                        {Number(taxRate || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Range Slider Track */}
                  <div className="relative pt-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxRate || 0}
                      onChange={(e) => setTaxRate(Math.round(Number(e.target.value) * 10) / 10)}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                      style={{
                        background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${Math.min(100, Math.max(0, taxRate || 0))}%, #e5e7eb ${Math.min(100, Math.max(0, taxRate || 0))}%, #e5e7eb 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1 px-0.5">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Preset Quick Buttons & Exact Number Input */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Presets:</span>
                      {[0, 2, 5, 10, 15, 30].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTaxRate(preset)}
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-colors border",
                            Number(taxRate) === preset
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-white text-gray-600 border-black/10 hover:border-black/30 hover:bg-gray-50"
                          )}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-gray-400 font-semibold mr-1">Exact:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value === "" ? 0 : Math.round(Number(e.target.value) * 10) / 10)}
                        className="w-20 bg-white border border-black/10 rounded-xl px-2.5 py-1 text-xs font-bold text-black font-mono text-right outline-none focus:border-indigo-600 shadow-2xs"
                      />
                      <span className="text-xs font-bold text-gray-500 font-mono">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">GL Account Code</label>
                  <select
                    value={taxAccountCode}
                    onChange={(e) => setTaxAccountCode(e.target.value)}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white"
                  >
                    <option value="">Select Ledger Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} - {a.name} ({a.account_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/[0.02] border border-black/5">
                  <div>
                    <p className="text-xs font-bold text-black">Tax Inclusivity</p>
                    <p className="text-[11px] text-gray-400">Check if sales/purchase prices already include this tax.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={taxIsInclusive}
                    onChange={(e) => setTaxIsInclusive(e.target.checked)}
                    className="size-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Description (Optional)</label>
                  <input
                    type="text"
                    value={taxDescription}
                    placeholder="e.g. Standard 15% value added tax for all commercial commodities"
                    onChange={(e) => setTaxDescription(e.target.value)}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-black/5">
                <button
                  onClick={() => setTaxModalOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-black/10 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTaxRule}
                  className="px-5 py-2 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 shadow-md"
                >
                  {editingTaxRule ? "Update Tax Rate" : "Save Tax Rule"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add/Edit Progressive Tax Bracket Tier */}
      <AnimatePresence>
        {bracketModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-black/10"
            >
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                    <Scale className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">
                      {editingBracketIndex !== null ? "Edit Employment Tax Tier" : "Add Employment Tax Tier"}
                    </h3>
                    <p className="text-xs text-gray-400">Configure progressive bracket range and marginal tax rate</p>
                  </div>
                </div>
                <button
                  onClick={() => setBracketModalOpen(false)}
                  className="p-2 rounded-full hover:bg-black/5 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
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
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                      Maximum Income (ETB)
                    </label>
                    <input
                      type="number"
                      value={bracketMax}
                      placeholder="Leave blank for No Cap / Over"
                      onChange={(e) => setBracketMax(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black font-mono outline-none focus:border-emerald-600 focus:bg-white"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Leave empty if top tier (e.g. Over 14,000 ETB).</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
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
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
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

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-xs text-emerald-950 font-mono">
                  Quick Formula: (Taxable Base × {Number(bracketRate) || 0}%) - {Number(bracketDeductible) || 0} ETB
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-black/5">
                <button
                  onClick={() => setBracketModalOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-black/10 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBracket}
                  className="px-5 py-2 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 shadow-md"
                >
                  {editingBracketIndex !== null ? "Update Tier" : "Add Tier"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add/Edit Warehouse */}
      <AnimatePresence>
        {whModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-black/10"
            >
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                    <WarehouseIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">
                      {editingWarehouse ? "Edit Warehouse Facility" : "Add Warehouse Facility"}
                    </h3>
                    <p className="text-xs text-gray-400">Manage storage depot details and location parameters</p>
                  </div>
                </div>
                <button
                  onClick={() => setWhModalOpen(false)}
                  className="p-2 rounded-full hover:bg-black/5 text-gray-400 hover:text-black transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Warehouse Name</label>
                    <input
                      type="text"
                      value={whName}
                      placeholder="e.g. Central Processing Depot"
                      onChange={(e) => setWhName(e.target.value)}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Facility Code</label>
                    <input
                      type="text"
                      value={whCode}
                      placeholder="e.g. WH-01"
                      onChange={(e) => setWhCode(e.target.value)}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Physical Location / Address</label>
                  <input
                    type="text"
                    value={whLocation}
                    placeholder="e.g. Kality Industrial Zone, Addis Ababa"
                    onChange={(e) => setWhLocation(e.target.value)}
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Facility Type</label>
                    <select
                      value={whType}
                      onChange={(e) => setWhType(e.target.value)}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white"
                    >
                      <option value="Dry Storage / Processing">Dry Storage / Processing</option>
                      <option value="Bonded Export Warehouse">Bonded Export Warehouse</option>
                      <option value="Regional Transit Depot">Regional Transit Depot</option>
                      <option value="Cold / Climate Controlled">Cold / Climate Controlled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Operational Status</label>
                    <select
                      value={whStatus}
                      onChange={(e) => setWhStatus(e.target.value)}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Facility Specialization</label>
                    <input
                      type="text"
                      value={whSpecialization}
                      placeholder="e.g. Export Grade 1 & 2 Coffee"
                      onChange={(e) => setWhSpecialization(e.target.value)}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Assigned Manager</label>
                    <input
                      type="text"
                      value={whManager}
                      placeholder="e.g. Dawit Tadesse"
                      onChange={(e) => setWhManager(e.target.value)}
                      className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-black/5">
                <button
                  type="button"
                  disabled={isSavingWh}
                  onClick={() => setWhModalOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-black/10 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingWh}
                  onClick={handleSaveWarehouse}
                  className="min-w-[130px] inline-flex items-center justify-center px-5 py-2 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSavingWh ? <LoadingDots color="bg-white" size="sm" /> : (editingWarehouse ? "Save Changes" : "Create Warehouse")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
