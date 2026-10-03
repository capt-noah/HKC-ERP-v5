import { useState, useEffect } from "react"
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
  Warehouse as WarehouseIcon,
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Tag,
  UserCheck,
  MoreVertical,
} from "lucide-react"
import { useErpStore, type Warehouse, type WarehouseType } from "@/lib/erpStore"
import { useFinanceStore } from "@/lib/financeStore"
import { OPERATING_WAREHOUSES, isExportWarehouse, getWarehouseType } from "@/lib/warehouses"
import { loadResource } from "@/lib/apiPersistence"
import { cn } from "@/lib/utils"
import { LoadingDots } from "@/components/ui/LoadingDots"

function AdminSettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 animate-pulse">
      {/* Sidebar Tabs Skeleton */}
      <div className="flex flex-col gap-2">
        {[...Array(3)].map((_, i) => (
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => erp.getWarehouses())

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"general" | "warehouses" | "rates">("general")
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

  // 4. Warehouse Modal & Editing State
  const [whModalOpen, setWhModalOpen] = useState(false)
  const [isSavingWh, setIsSavingWh] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [whName, setWhName] = useState("")
  const [whCode, setWhCode] = useState("")
  const [whLocation, setWhLocation] = useState("")
  const [whType, setWhType] = useState<WarehouseType>("EXPORT_WH")
  const [whSpecialization, setWhSpecialization] = useState("Commercial & Specialty Coffee")
  const [whTargetMarkets, setWhTargetMarkets] = useState("Domestic & Export")
  const [whManager, setWhManager] = useState("")
  const [whStatus, setWhStatus] = useState("Active")
  const [activeWhMenuId, setActiveWhMenuId] = useState<string | null>(null)
  const [managerOptions, setManagerOptions] = useState<string[]>([])

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
  }

  // Fetch verified data from DB / stores on initial mount
  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      try {
        const [, , usersData, employeesData] = await Promise.all([
          erp.loadFromApi("all"),
          finance.loadFromApi(),
          loadResource<any>("users").catch(() => []),
          loadResource<any>("employees").catch(() => []),
        ])
        if (active) {
          const fresh = finance.getCompanySettings()
          syncFormFromSettings(fresh)

          const names = new Set<string>()
          OPERATING_WAREHOUSES.forEach((w) => {
            if (w.manager && w.manager !== "Unassigned") names.add(w.manager)
          })
          erp.getWarehouses().forEach((w) => {
            if (w.manager && w.manager !== "Unassigned") names.add(w.manager)
          })
          ;(usersData || []).forEach((u: any) => {
            const name = u.full_name || u.name || u.username
            if (name && name !== "superadmin") names.add(name)
          })
          ;(employeesData || []).forEach((e: any) => {
            const name = e.full_name || e.name || `${e.first_name || ""} ${e.last_name || ""}`.trim()
            if (name) names.add(name)
          })
          setManagerOptions(Array.from(names).filter(Boolean))
          setWarehouses(erp.getWarehouses())
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

    const unsubErp = erp.subscribe(() => {
      if (active) {
        setWarehouses(erp.getWarehouses())
      }
    })

    return () => {
      active = false
      unsubFinance()
      unsubErp()
    }
  }, [])

  // Save Company & Rates Configurations
  const handleSave = () => {
    confirm({
      title: "Save System Settings",
      message: "Save changes to company profile and processing & storage fee schedules?",
      confirmLabel: "Save Configurations",
      cancelLabel: "Cancel",
      onConfirm: () => {
        const currentSettings = finance.getCompanySettings()
        const updated = {
          ...currentSettings,
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
    syncFormFromSettings(s)
    showToast("Changes Discarded", "info", "Form changes have been reverted.")
  }

  // --- Warehouse Handlers ---
  const handleOpenWhModal = (wh?: Warehouse) => {
    if (wh) {
      setEditingWarehouse(wh)
      setWhName(wh.name || "")
      setWhCode(wh.code || wh.id || "")
      setWhLocation(wh.location || "")
      setWhType(wh.warehouse_type || getWarehouseType(wh, warehouses))
      setWhSpecialization(wh.specialization || "Commercial & Specialty Coffee")
      setWhTargetMarkets(wh.targetMarkets || "Domestic & Export")
      setWhManager(wh.manager && wh.manager !== "Unassigned" ? wh.manager : "")
      setWhStatus(wh.status || "Active")
    } else {
      setEditingWarehouse(null)
      setWhName("")
      setWhCode("")
      setWhLocation("")
      setWhType("EXPORT_WH")
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

    const trimmedManager = whManager.trim()
    const finalManager = trimmedManager ? trimmedManager : "Unassigned"

    try {
      setIsSavingWh(true)
      const payload: Omit<Warehouse, "id"> & { id?: string } = {
        name: whName.trim(),
        code: whCode.trim() || (editingWarehouse ? (editingWarehouse.code || editingWarehouse.id) : `WH-${Date.now().toString(36).toUpperCase()}`),
        location: whLocation.trim(),
        warehouse_type: whType,
        type: whType === "EXPORT_WH" ? "Export Hub" : "Pharmaceutical Hub",
        manager: finalManager,
        status: whStatus || "Active",
        specialization: whSpecialization.trim(),
        targetMarkets: whTargetMarkets.trim(),
      }

      if (editingWarehouse) {
        await erp.updateWarehouse(editingWarehouse.id, payload)
        showToast("Warehouse Updated", "success", `Warehouse '${whName}' updated successfully with assigned manager '${finalManager}'.`)
      } else {
        await erp.addWarehouse(payload)
        showToast("Warehouse Created", "success", `New ${whType === "EXPORT_WH" ? "Export" : "Pharmaceutical"} facility '${whName}' added with assigned manager '${finalManager}'.`)
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
    { id: "warehouses" as const, label: "Warehouse Facilities", icon: WarehouseIcon, description: "Change warehouse names, codes & details" },
    { id: "rates" as const, label: "Processing & Storage", icon: SlidersHorizontal, description: "Toll fee rates & tiered monthly storage" },
  ]

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <div className="max-w-[98%] mx-auto px-3 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">System Settings</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Configure company profile, warehouse locations, and fee schedules.</p>
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
            {/* Sidebar Tabs */}
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
              {/* Tab 1: Company Profile */}
              {activeTab === "general" && (
                <div key="general" className="flex flex-col gap-5">
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
                </div>
              )}

              {/* Tab 2: Warehouse Facilities */}
              {activeTab === "warehouses" && (
                <div key="warehouses" className="flex flex-col gap-5">
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
                          const hasManager = Boolean(wh.manager && wh.manager.trim() && wh.manager !== "Unassigned")
                          return (
                            <div
                              key={wh.id}
                              className="relative p-5 rounded-2xl bg-black/[0.02] border border-black/5 hover:border-black/15 transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-3">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/5 text-gray-700 border border-black/10">
                                        {wh.code || wh.id}
                                      </span>
                                      {isExportWarehouse(wh, warehouses) ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                          <span className="size-1.5 rounded-full bg-emerald-600 inline-block" />
                                          Export Warehouse
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
                                          <span className="size-1.5 rounded-full bg-indigo-600 inline-block" />
                                          Pharmaceutical Warehouse
                                        </span>
                                      )}
                                    </div>
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

                                <div className="space-y-2 text-xs text-gray-600 mb-4">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="size-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{wh.location || "Location not specified"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Tag className="size-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{wh.type || (isExportWarehouse(wh, warehouses) ? "Export Processing & Storage" : "Pharmaceutical Storage")}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <UserCheck className={`size-3.5 shrink-0 ${hasManager ? "text-emerald-600" : "text-amber-500"}`} />
                                    <span className="truncate">
                                      <span className="text-gray-400 font-medium">Assigned Manager: </span>
                                      <span className={`font-semibold ${hasManager ? "text-gray-900 font-bold" : "text-amber-700 italic"}`}>
                                        {hasManager ? wh.manager : "Unassigned"}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-end pt-3 border-t border-black/5 text-xs">
                                <button
                                  onClick={() => handleOpenEditWarehouseModal(wh)}
                                  className="px-3 py-1 rounded-xl bg-white border border-black/10 text-xs font-bold text-black hover:bg-black/5 transition-colors shadow-2xs flex items-center gap-1.5"
                                >
                                  <Pencil className="size-3 text-gray-500" />
                                  Edit
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </GlassCard>
                </div>
              )}

              {/* Tab 3: Processing & Storage Rates */}
              {activeTab === "rates" && (
                <div key="rates" className="flex flex-col gap-5">
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
                </div>
              )}

              {/* Bottom Action Buttons (for tabs with general form inputs) */}
              {["general", "rates"].includes(activeTab) && (
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={handleDiscardChanges}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full glass-card border border-black/5 text-xs font-bold hover:bg-white text-[#505054] transition-colors h-[38px] cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                    Discard Changes
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-black hover:bg-zinc-800 text-white text-xs font-bold active:scale-95 transition-all shadow-md h-[38px] cursor-pointer"
                  >
                    {isSaved ? <Check className="size-3.5 text-emerald-400" /> : <Save className="size-3.5" />}
                    {isSaved ? "Settings Saved" : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add/Edit Warehouse */}
      {whModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-black/10">
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

              {/* Dual Warehouse Operational Type Selector */}
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">
                  Warehouse Operational Classification <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWhType("EXPORT_WH")}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                      whType === "EXPORT_WH"
                        ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-black/[0.02] border-black/10 hover:border-black/20"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn("size-7 rounded-xl flex items-center justify-center text-xs font-bold", whType === "EXPORT_WH" ? "bg-emerald-600 text-white" : "bg-black/10 text-black")}>
                        EXP
                      </div>
                      <span className="text-xs font-black text-black">Export Warehouse</span>
                    </div>
                    {whType === "EXPORT_WH" && <Check className="size-4 text-emerald-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setWhType("PHARMA_WH")}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                      whType === "PHARMA_WH"
                        ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-black/[0.02] border-black/10 hover:border-black/20"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn("size-7 rounded-xl flex items-center justify-center text-xs font-bold", whType === "PHARMA_WH" ? "bg-indigo-600 text-white" : "bg-black/10 text-black")}>
                        PH
                      </div>
                      <span className="text-xs font-black text-black">Pharmaceutical Warehouse</span>
                    </div>
                    {whType === "PHARMA_WH" && <Check className="size-4 text-indigo-600" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Assigned Manager</span>
                  {whManager && whManager !== "Unassigned" && (
                    <span className="text-[10px] text-emerald-600 font-bold normal-case">Manager Assigned</span>
                  )}
                </label>
                <input
                  type="text"
                  list="wh-manager-suggestions"
                  value={whManager}
                  placeholder="e.g. Dawit Tadesse or select staff"
                  onChange={(e) => setWhManager(e.target.value)}
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-amber-600 focus:bg-white transition-colors"
                />
                <datalist id="wh-manager-suggestions">
                  {managerOptions.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-black/5">
              <button
                type="button"
                disabled={isSavingWh}
                onClick={() => setWhModalOpen(false)}
                className="px-4 py-2 rounded-2xl border border-black/10 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingWh}
                onClick={handleSaveWarehouse}
                className="min-w-[130px] inline-flex items-center justify-center px-5 py-2 rounded-2xl bg-black text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isSavingWh ? <LoadingDots color="bg-white" size="sm" /> : (editingWarehouse ? "Save Changes" : "Create Warehouse")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
