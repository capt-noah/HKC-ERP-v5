import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Building,
  CheckCircle2,
  Download,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore } from "@/lib/financeStore"
import type { FixedAsset } from "@/lib/financeStore"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { exportPeachtreeFixedAssets, isDateInPreset } from "@/lib/peachtreeExportUtils"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

const ASSET_CATEGORIES: FixedAsset["category"][] = ["Vehicles", "Machinery", "IT Hardware", "Buildings", "Office Equipment"]

const categoryColorMap: Record<string, string> = {
  Vehicles: "bg-blue-100 text-blue-700",
  Machinery: "bg-amber-100 text-amber-700",
  "IT Hardware": "bg-purple-100 text-purple-700",
  Buildings: "bg-emerald-100 text-emerald-700",
  "Office Equipment": "bg-zinc-100 text-zinc-700",
}

const statusColorMap: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Draft: "bg-zinc-100 text-zinc-600",
  "Fully Depreciated": "bg-amber-100 text-amber-700",
  Disposed: "bg-rose-100 text-rose-700",
}

import { Skeleton } from "@/components/ui/skeleton"

export default function Assets() {
  const { showToast } = useFeedback()
  const store = useFinanceStore()
  const isLoading = store.isLoading()
  const assets = store.getFixedAssets()
  const accounts = store.getAccounts()

  const [activeTab, setActiveTab] = useState<"registry" | "depreciation">("registry")
  const [expandedAssets, setExpandedAssets] = useState<{ [id: string]: boolean }>({})
  const [assetSearch, setAssetSearch] = useState("")
  const [assetDateFilter, setAssetDateFilter] = useState("ALL")
  const [assetCustomStart, setAssetCustomStart] = useState("")
  const [assetCustomEnd, setAssetCustomEnd] = useState("")
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("ALL")
  const [assetStatusFilter, setAssetStatusFilter] = useState("ALL")
  const [deprSearch, setDeprSearch] = useState("")
  const [deprStatusFilter, setDeprStatusFilter] = useState("ALL")

  // Add Asset Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState("")
  const [addCategory, setAddCategory] = useState<FixedAsset["category"]>("Vehicles")
  const [addCost, setAddCost] = useState("")
  const [addSalvage, setAddSalvage] = useState("")
  const [addLife, setAddLife] = useState("5")
  const [addPurchaseDate, setAddPurchaseDate] = useState(new Date().toISOString().split("T")[0])
  const [addDepStartDate, setAddDepStartDate] = useState(new Date().toISOString().split("T")[0])
  const [addLocation, setAddLocation] = useState("")
  const [addSerial, setAddSerial] = useState("")
  const [addAssetAccount, setAddAssetAccount] = useState("1500")
  const [addAccumAccount, setAddAccumAccount] = useState("1510")
  const [addDepExpAccount, setAddDepExpAccount] = useState("6500")

  // Edit Asset Modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null)
  const [editName, setEditName] = useState("")
  const [editCategory, setEditCategory] = useState<FixedAsset["category"]>("Vehicles")
  const [editLocation, setEditLocation] = useState("")
  const [editSerial, setEditSerial] = useState("")

  // Dispose Asset Modal
  const [showDisposeModal, setShowDisposeModal] = useState(false)
  const [disposingAsset, setDisposingAsset] = useState<FixedAsset | null>(null)
  const [disposeSaleAmount, setDisposeSaleAmount] = useState("")
  const [disposeCashAccount, setDisposeCashAccount] = useState("1100")

  const totalAssetCost = assets.reduce((s, a) => s + a.cost, 0)
  const totalNetBookValue = assets.reduce((s, a) => s + (a.cost - a.accumulatedDepreciation), 0)
  const activeCount = assets.filter((a) => a.status === "Active").length
  const allScheduleItems = assets.flatMap((a) =>
    a.depreciation_schedule.map((s, idx) => ({ ...s, period_number: idx + 1, assetId: a.id, assetName: a.name }))
  )
  const pendingDepreciations = allScheduleItems.filter((s) => s.status === "Pending")

  const filteredAssets = assets.filter((asset) => {
    if (!isDateInPreset(asset.purchaseDate, assetDateFilter, assetCustomStart, assetCustomEnd)) return false
    if (assetCategoryFilter !== "ALL" && asset.category !== assetCategoryFilter) return false
    if (assetStatusFilter !== "ALL" && asset.status !== assetStatusFilter) return false
    if (!assetSearch.trim()) return true
    const q = assetSearch.toLowerCase()
    return (
      asset.name.toLowerCase().includes(q) ||
      asset.id.toLowerCase().includes(q) ||
      (asset.location?.toLowerCase().includes(q) ?? false) ||
      (asset.serialNumber?.toLowerCase().includes(q) ?? false)
    )
  })

  const filteredScheduleItems = allScheduleItems.filter((item) => {
    if (deprStatusFilter !== "ALL" && item.status !== deprStatusFilter) return false
    if (!deprSearch.trim()) return true
    const q = deprSearch.toLowerCase()
    return item.assetName.toLowerCase().includes(q) || item.assetId.toLowerCase().includes(q)
  })

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault()
    const cost = parseFloat(addCost)
    const salvage = parseFloat(addSalvage)
    const life = parseInt(addLife)
    if (!addName || isNaN(cost) || isNaN(salvage) || isNaN(life)) return

    store.addFixedAsset({
      name: addName,
      category: addCategory,
      purchaseDate: addPurchaseDate,
      depreciationStartDate: addDepStartDate,
      cost,
      salvageValue: salvage,
      usefulLifeYears: life,
      asset_account_id: addAssetAccount,
      accumulated_depreciation_account_id: addAccumAccount,
      depreciation_expense_account_id: addDepExpAccount,
      location: addLocation,
      serialNumber: addSerial,
    })

    setShowAddModal(false)
    setAddName("")
    setAddCost("")
    setAddSalvage("")
    setAddLife("5")
    setAddLocation("")
    setAddSerial("")
    showToast("Asset Registered", "success", `Fixed asset '${addName}' added. Depreciation schedule generated.`)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAsset) return
    store.updateFixedAsset(editingAsset.id, {
      name: editName,
      category: editCategory,
      location: editLocation,
      serialNumber: editSerial,
    })
    setShowEditModal(false)
    setEditingAsset(null)
    showToast("Asset Updated", "success", `Asset '${editName}' information saved.`)
  }

  const handlePostDepreciation = (assetId: string, scheduleItemId: string) => {
    const res = store.postDepreciationEntry(assetId, scheduleItemId)
    if (res.success) {
      showToast("Depreciation Posted", "success", "Depreciation journal entry posted to General Ledger.")
    } else {
      showToast("Posting Failed", "warning", res.error || "Could not post depreciation.")
    }
  }

  const handleDisposeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!disposingAsset) return
    const saleAmt = parseFloat(disposeSaleAmount)
    if (isNaN(saleAmt)) return
    const res = store.disposeFixedAsset(disposingAsset.id, saleAmt, disposeCashAccount)
    if (res.success) {
      setShowDisposeModal(false)
      setDisposingAsset(null)
      setDisposeSaleAmount("")
      showToast("Asset Disposed", "success", `Asset '${disposingAsset.name}' marked as disposed. Gain/loss entry posted.`)
    } else {
      showToast("Disposal Failed", "warning", res.error || "Could not dispose asset.")
    }
  }

  const handleDeleteAsset = (id: string, name: string) => {
    if (confirm(`Delete asset '${name}'? This cannot be undone.`)) {
      const res = store.deleteFixedAsset(id)
      if (res.success) {
        showToast("Asset Deleted", "info", `Asset '${name}' removed from registry.`)
      } else {
        showToast("Delete Failed", "warning", res.error || "Could not delete asset.")
      }
    }
  }

  const deprInlineColumns: TableColumn[] = [
    { key: "period_number", label: "Period" },
    { key: "depreciation_date", label: "Date" },
    { key: "depreciation_amount", label: "Amount", align: "right" },
    { key: "accumulated", label: "Accumulated", align: "right" },
    { key: "remaining_nbv", label: "Remaining NBV", align: "right" },
    { key: "status", label: "Status", align: "center" },
    { key: "_actions", label: "Action", align: "right", noSort: true }
  ]

  const deprInlineTable = useResizableTable(deprInlineColumns, [])

  const deprTabColumns: TableColumn[] = [
    { key: "assetName", label: "Asset" },
    { key: "period_number", label: "Period" },
    { key: "depreciation_date", label: "Date" },
    { key: "depreciation_amount", label: "Depreciation", align: "right" },
    { key: "status", label: "Status", align: "center" },
    { key: "_actions", label: "Action", align: "right", noSort: true }
  ]

  const deprTabTable = useResizableTable(deprTabColumns, filteredScheduleItems)

  const [deprPage, setDeprPage] = useState(1)
  const [deprPageSize, setDeprPageSize] = useState(10)

  useEffect(() => {
    setDeprPage(1)
  }, [deprSearch, deprStatusFilter, filteredScheduleItems.length])

  const sortedDepr = deprTabTable.sorted()
  const totalDeprPages = Math.max(1, Math.ceil(sortedDepr.length / deprPageSize))
  const displayedDepr = sortedDepr.slice((deprPage - 1) * deprPageSize, deprPage * deprPageSize)

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      {store.getLoadError() && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-800 shadow-lg flex items-center gap-3">
            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            Server unavailable — asset data cannot be loaded. {store.getLoadError()}
          </div>
        </div>
      )}

      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Fixed Assets Register</h1>
            <p className="text-sm text-gray-400 mt-1">Track capital assets and depreciation schedules.</p>
          </div>
          <div className="flex items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </motion.div>

        {/* KPI Banner */}
        <motion.div variants={fade} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Gross Value</span>
            {isLoading ? (
              <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-black font-mono mt-1">ETB {totalAssetCost.toLocaleString()}</p>
            )}
            <span className="text-[10px] text-gray-400 mt-1">{assets.length} assets registered</span>
          </GlassCard>
          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Book Value</span>
            {isLoading ? (
              <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-emerald-700 font-mono mt-1">ETB {totalNetBookValue.toLocaleString()}</p>
            )}
            <span className="text-[10px] text-emerald-600 mt-1">After Accumulated Depreciation</span>
          </GlassCard>
          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Assets</span>
            {isLoading ? (
              <Skeleton className="h-7 w-20 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-black font-mono mt-1">{activeCount}</p>
            )}
            <span className="text-[10px] text-gray-400 mt-1">Currently in service</span>
          </GlassCard>
          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Depreciations</span>
            {isLoading ? (
              <Skeleton className="h-7 w-20 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-amber-600 font-mono mt-1">{pendingDepreciations.length}</p>
            )}
            <span className="text-[10px] text-amber-600 mt-1">Entries awaiting GL posting</span>
          </GlassCard>
        </motion.div>

        {/* Tab Switcher Bar */}
        <motion.div variants={fade} className="flex items-center border-b border-black/10 mb-6 pb-2">
          <div className="flex gap-2">
            {[
              { id: "registry", label: "Asset Registry" },
              { id: "depreciation", label: "Depreciation Schedule" },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="px-4 py-2.5 text-xs font-black relative tracking-tight transition-colors uppercase"
                >
                  <span className={isActive ? "text-black" : "text-gray-400 hover:text-gray-700"}>{tab.label}</span>
                  {isActive && <motion.div layoutId="asset-tabs" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Tab 1: Asset Registry */}
        {activeTab === "registry" && (
          <div className="flex flex-col gap-4">
            <GlassCard className="flex flex-col">
              <FinanceTableToolbar
                title="Fixed Asset Registry"
                subtitle={`${filteredAssets.length} capital assets tracked with depreciation schedules`}
                searchValue={assetSearch}
                onSearchChange={setAssetSearch}
                searchPlaceholder="Search name, ID, location, serial..."
                dateFilter={{
                  value: assetDateFilter,
                  onChange: setAssetDateFilter,
                  startDate: assetCustomStart,
                  endDate: assetCustomEnd,
                  onCustomDateChange: (start, end) => {
                    setAssetCustomStart(start)
                    setAssetCustomEnd(end)
                  },
                }}
                filters={[
                  {
                    value: assetCategoryFilter,
                    onChange: setAssetCategoryFilter,
                    ariaLabel: "Asset category filter",
                    options: [
                      { value: "ALL", label: "All Categories" },
                      ...ASSET_CATEGORIES.map((c) => ({ value: c, label: c })),
                    ],
                  },
                  {
                    value: assetStatusFilter,
                    onChange: setAssetStatusFilter,
                    ariaLabel: "Asset status filter",
                    options: [
                      { value: "ALL", label: "All Status" },
                      { value: "Active", label: "Active" },
                      { value: "Draft", label: "Draft" },
                      { value: "Fully Depreciated", label: "Fully Depreciated" },
                      { value: "Disposed", label: "Disposed" },
                    ],
                  },
                ]}
                actions={[
                  {
                    label: `Export (${filteredAssets.length})`,
                    onClick: () => {
                      exportPeachtreeFixedAssets(filteredAssets as any, { format: "PEACHTREE_EXCEL" })
                      showToast("Assets Exported", "success", `Exported ${filteredAssets.length} fixed assets to Excel.`)
                    },
                    icon: <Download className="size-3.5" />,
                    variant: "emeraldLight",
                  },
                  { label: "Register Asset", onClick: () => setShowAddModal(true) },
                ]}
              />
            </GlassCard>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <GlassCard key={index} className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-32 bg-zinc-200/80" />
                    <Skeleton className="h-4 w-20 bg-zinc-200/80" />
                  </div>
                  <Skeleton className="h-5 w-48 bg-zinc-200/80" />
                  <Skeleton className="h-3 w-36 bg-zinc-200/80" />
                </GlassCard>
              ))
            ) : filteredAssets.length === 0 ? (
              <GlassCard className="p-12 text-center">
                <Building className="size-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No assets registered yet. Click &quot;Register Asset&quot; to begin.</p>
              </GlassCard>
            ) : (
              filteredAssets.map((asset) => {
                const nbv = asset.cost - asset.accumulatedDepreciation
                const deprPct = asset.cost > 0 ? (asset.accumulatedDepreciation / asset.cost) * 100 : 0
                const isExpanded = expandedAssets[asset.id]

                return (
                  <GlassCard key={asset.id} className="p-5">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => setExpandedAssets((p) => ({ ...p, [asset.id]: !p[asset.id] }))}
                          className="p-1 text-gray-400 hover:text-black hover:bg-black/5 rounded-lg mt-0.5"
                        >
                          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-zinc-500">{asset.id}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${categoryColorMap[asset.category] || "bg-zinc-100 text-zinc-600"}`}>{asset.category}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusColorMap[asset.status] || "bg-zinc-100"}`}>{asset.status}</span>
                          </div>
                          <p className="font-bold text-black text-sm mt-0.5">{asset.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Purchased: {asset.purchaseDate} &bull; Dep. Start: {asset.depreciationStartDate} &bull; {asset.usefulLifeYears} yr life
                            {asset.location && ` \u2022 ${asset.location}`}
                            {asset.serialNumber && ` \u2022 S/N: ${asset.serialNumber}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold text-gray-400 uppercase block">Net Book Value</span>
                          <span className="text-sm font-mono font-black text-black">ETB {nbv.toLocaleString()}</span>
                          <div className="w-32 h-1.5 bg-zinc-100 rounded-full mt-1">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.max(0, 100 - deprPct)}%` }} />
                          </div>
                          <span className="text-[9px] text-zinc-400">{deprPct.toFixed(0)}% depreciated</span>
                        </div>

                        <div className="flex gap-1.5">
                          {asset.status !== "Disposed" && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingAsset(asset)
                                  setEditName(asset.name)
                                  setEditCategory(asset.category)
                                  setEditLocation(asset.location || "")
                                  setEditSerial(asset.serialNumber || "")
                                  setShowEditModal(true)
                                }}
                                className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                title="Edit Asset"
                              >
                                <Edit className="size-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDisposingAsset(asset)
                                  setDisposeSaleAmount("")
                                  setShowDisposeModal(true)
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold transition-colors"
                                title="Dispose Asset"
                              >
                                Dispose
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteAsset(asset.id, asset.name)}
                            className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            title="Delete Asset"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Depreciation Schedule inline */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-black/5">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Depreciation Schedule (Straight-Line)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse table-fixed">
                            <thead>
                              <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                                {deprInlineColumns.map((col) => (
                                  <ResizableTh
                                    key={col.key}
                                    col={col}
                                    width={deprInlineTable.colWidths[col.key] ?? 140}
                                    sortKey={deprInlineTable.sortKey}
                                    sortDir={deprInlineTable.sortDir}
                                    openMenuCol={deprInlineTable.openMenuCol}
                                    onResizeStart={deprInlineTable.handleResizeStart}
                                    onToggleMenu={deprInlineTable.toggleMenu}
                                    onSortAsc={deprInlineTable.setSortAsc}
                                    onSortDesc={deprInlineTable.setSortDesc}
                                    onClearSort={deprInlineTable.clearSort}
                                  />
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/[0.03]">
                              {asset.depreciation_schedule.map((item, idx) => {
                                const periodNumber = idx + 1
                                const accumAfter = Math.min(asset.cost, (idx + 1) * item.depreciation_amount)
                                const remainingNBV = Math.max(asset.salvageValue, asset.cost - accumAfter)
                                return (
                                  <tr key={item.id} className="hover:bg-black/[0.01]">
                                    <td className="py-2 pl-1 font-mono font-bold text-zinc-500">#{periodNumber}</td>
                                    <td className="py-2 font-medium text-zinc-700">{item.depreciation_date}</td>
                                    <td className="py-2 text-right font-mono font-black text-zinc-900">ETB {item.depreciation_amount.toLocaleString()}</td>
                                    <td className="py-2 text-right font-mono text-zinc-600">ETB {accumAfter.toLocaleString()}</td>
                                    <td className="py-2 text-right font-mono text-zinc-600">ETB {remainingNBV.toLocaleString()}</td>
                                    <td className="py-2 text-center">
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                        item.status === "Posted"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-amber-100 text-amber-700"
                                      }`}>{item.status}</span>
                                    </td>
                                    <td className="py-2 text-right pr-2">
                                      {item.status === "Pending" && asset.status !== "Disposed" && (
                                        <button
                                          onClick={() => handlePostDepreciation(asset.id, item.id)}
                                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-black text-white hover:bg-zinc-800 transition-all"
                                        >
                                          Post Entry
                                        </button>
                                      )}
                                      {item.status === "Posted" && (
                                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                                          <CheckCircle2 className="size-3" /> Posted
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                )
              })
            )}
          </div>
        )}

        {/* Tab 2: All Depreciation Schedules */}
        {activeTab === "depreciation" && (
          <GlassCard className="flex flex-col">
            <FinanceTableToolbar
              title="All Depreciation Entries"
              subtitle="Post individual monthly straight-line depreciation entries to the General Ledger."
              searchValue={deprSearch}
              onSearchChange={setDeprSearch}
              searchPlaceholder="Search asset name or ID..."
              filters={[
                {
                  value: deprStatusFilter,
                  onChange: setDeprStatusFilter,
                  ariaLabel: "Depreciation status filter",
                  options: [
                    { value: "ALL", label: "All Status" },
                    { value: "Pending", label: "Pending" },
                    { value: "Posted", label: "Posted" },
                  ],
                },
              ]}
            />
            <TableScrollWrapper>
              <table className="w-full text-left border-collapse table-fixed text-xs">
                <thead>
                  <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                    {deprTabColumns.map((col) => (
                      <ResizableTh
                        key={col.key}
                        col={col}
                        width={deprTabTable.colWidths[col.key] ?? 140}
                        sortKey={deprTabTable.sortKey}
                        sortDir={deprTabTable.sortDir}
                        openMenuCol={deprTabTable.openMenuCol}
                        onResizeStart={deprTabTable.handleResizeStart}
                        onToggleMenu={deprTabTable.toggleMenu}
                        onSortAsc={deprTabTable.setSortAsc}
                        onSortDesc={deprTabTable.setSortDesc}
                        onClearSort={deprTabTable.clearSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedDepr.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No depreciation schedule items match your filters.</td></tr>
                  ) : (
                    displayedDepr.map((item) => (
                      <tr key={`${item.assetId}-${item.id}`} className="hover:bg-black/[0.01]">
                        <td className="py-3.5 pl-2">
                          <div className="font-bold text-black">{item.assetName}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">{item.assetId}</div>
                        </td>
                        <td className="py-3.5 font-mono text-zinc-600">#{item.period_number}</td>
                        <td className="py-3.5 font-mono text-gray-600">{item.depreciation_date}</td>
                        <td className="py-3.5 text-right font-mono font-bold text-black">
                          ETB {item.depreciation_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === "Posted"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-4">
                          {item.status === "Pending" ? (
                            <button
                              onClick={() => handlePostDepreciation(item.assetId, item.id)}
                              className="text-xs font-bold px-3 py-1 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors shadow-xs"
                            >
                              Post GL
                            </button>
                          ) : (
                            <span className="text-xs font-mono text-gray-400">{item.journal_entry_id || "Posted"}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableScrollWrapper>

            {sortedDepr.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-black/5 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                  <span>
                    Showing {Math.min((deprPage - 1) * deprPageSize + 1, sortedDepr.length)} to {Math.min(deprPage * deprPageSize, sortedDepr.length)} of {sortedDepr.length} entries
                  </span>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                    <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                    <select
                      value={deprPageSize}
                      onChange={(e) => {
                        setDeprPageSize(Number(e.target.value))
                        setDeprPage(1)
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
                    type="button"
                    disabled={deprPage === 1}
                    onClick={() => setDeprPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                    Page {deprPage} of {totalDeprPages}
                  </span>
                  <button
                    type="button"
                    disabled={deprPage >= totalDeprPages}
                    onClick={() => setDeprPage((p) => p + 1)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        )}
      </motion.div>

      {/* MODAL: Register Asset */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-base font-black text-zinc-900">Register New Fixed Asset</h3>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600"><X className="size-5" /></button>
              </div>

              <form onSubmit={handleAddAsset} className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Asset Name</label>
                  <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                    placeholder="e.g. Delivery Truck Isuzu 5-Ton" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Category</label>
                    <select value={addCategory} onChange={(e) => setAddCategory(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold">
                      {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Location / Branch</label>
                    <input type="text" value={addLocation} onChange={(e) => setAddLocation(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                      placeholder="e.g. Bole Warehouse" />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Serial / Tag Number</label>
                  <input type="text" value={addSerial} onChange={(e) => setAddSerial(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono"
                    placeholder="e.g. SN-2024-00451" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Asset Cost (ETB)</label>
                    <input type="number" value={addCost} onChange={(e) => setAddCost(e.target.value)} required
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                      placeholder="1200000" />
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Salvage Value</label>
                    <input type="number" value={addSalvage} onChange={(e) => setAddSalvage(e.target.value)} required
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                      placeholder="200000" />
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Useful Life (Yrs)</label>
                    <input type="number" value={addLife} onChange={(e) => setAddLife(e.target.value)} required
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                      placeholder="5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Purchase Date</label>
                    <input type="date" value={addPurchaseDate} onChange={(e) => setAddPurchaseDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50" />
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Depreciation Start Date</label>
                    <input type="date" value={addDepStartDate} onChange={(e) => setAddDepStartDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50" />
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-3 mt-1">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">GL Account Mapping</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-bold text-zinc-600 mb-1 block">Asset Account</label>
                      <select value={addAssetAccount} onChange={(e) => setAddAssetAccount(e.target.value)}
                        className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-[11px]">
                        {accounts.filter((a) => a.account_type === "Asset" && !a.is_group).map((a) => (
                          <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-zinc-600 mb-1 block">Accum. Depr.</label>
                      <select value={addAccumAccount} onChange={(e) => setAddAccumAccount(e.target.value)}
                        className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-[11px]">
                        {accounts.filter((a) => a.account_type === "Asset" && !a.is_group).map((a) => (
                          <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-zinc-600 mb-1 block">Depr. Expense</label>
                      <select value={addDepExpAccount} onChange={(e) => setAddDepExpAccount(e.target.value)}
                        className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-[11px]">
                        {accounts.filter((a) => a.account_type === "Expense" && !a.is_group).map((a) => (
                          <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 font-bold">Cancel</button>
                  <button type="submit"
                    className="px-4 py-2 rounded-full bg-black text-white font-bold hover:bg-zinc-800">Register Asset</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Edit Asset */}
      <AnimatePresence>
        {showEditModal && editingAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-base font-black text-zinc-900">Edit Asset: {editingAsset.id}</h3>
                <button onClick={() => setShowEditModal(false)} className="text-zinc-400 hover:text-zinc-600"><X className="size-5" /></button>
              </div>
              <form onSubmit={handleSaveEdit} className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Asset Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Category</label>
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold">
                      {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 mb-1 block">Location / Branch</label>
                    <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                      placeholder="e.g. Bole Warehouse" />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Serial / Tag Number</label>
                  <input type="text" value={editSerial} onChange={(e) => setEditSerial(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono"
                    placeholder="e.g. SN-2024-00451" />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button type="button" onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 font-bold">Cancel</button>
                  <button type="submit"
                    className="px-4 py-2 rounded-full bg-black text-white font-bold hover:bg-zinc-800">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Dispose Asset */}
      <AnimatePresence>
        {showDisposeModal && disposingAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-base font-black text-zinc-900">Dispose / Scrap Asset</h3>
                <button onClick={() => setShowDisposeModal(false)} className="text-zinc-400 hover:text-zinc-600"><X className="size-5" /></button>
              </div>
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs font-semibold mb-4">
                This will post a disposal journal entry: debit Cash &amp; Accumulated Depreciation, credit the Asset account, and record any gain or loss. The asset will be marked as <strong>Disposed</strong>.
              </div>
              <form onSubmit={handleDisposeSubmit} className="flex flex-col gap-3 text-xs">
                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                  <p className="font-bold text-zinc-700">{disposingAsset.name}</p>
                  <p className="text-zinc-500 mt-0.5">Cost: ETB {disposingAsset.cost.toLocaleString()} &bull; Accumulated Depr: ETB {disposingAsset.accumulatedDepreciation.toLocaleString()}</p>
                  <p className="text-zinc-700 font-bold mt-0.5">Net Book Value: ETB {(disposingAsset.cost - disposingAsset.accumulatedDepreciation).toLocaleString()}</p>
                </div>
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Sale / Proceeds Amount (ETB)</label>
                  <input type="number" value={disposeSaleAmount} onChange={(e) => setDisposeSaleAmount(e.target.value)} required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                    placeholder="Enter sale proceeds (0 for scrapping)" />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 mb-1 block">Cash / Bank Account (Proceeds)</label>
                  <select value={disposeCashAccount} onChange={(e) => setDisposeCashAccount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold">
                    {accounts.filter((a) => a.account_type === "Asset" && !a.is_group).map((a) => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button type="button" onClick={() => setShowDisposeModal(false)}
                    className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 font-bold">Cancel</button>
                  <button type="submit"
                    className="px-5 py-2.5 rounded-full bg-amber-600 text-white font-bold hover:bg-amber-700">Post Disposal Entry</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
