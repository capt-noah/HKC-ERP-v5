import { useState, useMemo, useEffect, Fragment } from "react"
import {
  Search,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Package,
  Printer,
  Percent,
  Warehouse as WarehouseIcon,
  Layers,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, type Product } from "@/lib/erpStore"
import { useFeedback } from "@/context/FeedbackContext"
import WH1ChildMovementLedger from "@/components/stock/WH1ChildMovementLedger"
import StockBinCardLedger from "@/components/stock/StockBinCardLedger"
import WH1ReceivingVoucherPrintModal from "@/components/stock/WH1ReceivingVoucherPrintModal"
import StockBinCardPrintModal from "@/components/stock/StockBinCardPrintModal"
import { getExpiryStatus } from "@/lib/expiryUtils"
import { isExportWarehouse, isPharmaWarehouse } from "@/lib/warehouses"
import { exportToExcel } from "@/lib/exportUtils"

export default function FinanceStock() {
  const erp = useErpStore()
  const { showToast } = useFeedback()

  const [isLoading, setIsLoading] = useState(erp.getProducts().length === 0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("ALL")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL")
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())

  // Read-only document preview modals
  const [printingWH1Product, setPrintingWH1Product] = useState<Product | null>(null)
  const [printingPharmaProduct, setPrintingPharmaProduct] = useState<Product | null>(null)

  // Initial load: ensure products are loaded if not already in store
  useEffect(() => {
    let isMounted = true
    async function init() {
      if (erp.getProducts().length === 0) {
        setIsLoading(true)
        try {
          await erp.loadInventoryData()
        } catch (err: any) {
          console.error("Finance stock load failed:", err)
        } finally {
          if (isMounted) setIsLoading(false)
        }
      } else {
        setIsLoading(false)
      }
    }
    void init()
    return () => {
      isMounted = false
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await erp.loadInventoryData(true)
      showToast("Inventory Refreshed", "success", "Latest warehouse inventory and valuations loaded.")
    } catch (err: any) {
      showToast("Refresh Failed", "warning", err?.message || "Failed to reload inventory.")
    } finally {
      setIsRefreshing(false)
    }
  }

  const products = erp.getProducts()

  const toggleRowExpand = (id: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Warehouse filter
      if (selectedWarehouse !== "ALL") {
        const prodWh = String(prod.warehouse || "").toUpperCase()
        if (prodWh !== selectedWarehouse.toUpperCase()) return false
      }

      // Category filter
      if (selectedCategory !== "ALL") {
        if (selectedCategory === "EXPORT" && !isExportWarehouse(prod.warehouse)) return false
        if (selectedCategory === "PHARMA" && !isPharmaWarehouse(prod.warehouse)) return false
      }

      // Expiry filter for pharma items
      if (expiryFilter !== "ALL") {
        const statusResult = getExpiryStatus(prod.expiry)
        if (statusResult.tier !== expiryFilter) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = (prod.name || "").toLowerCase().includes(q)
        const matchSku = (prod.sku || "").toLowerCase().includes(q)
        const matchWh = (prod.warehouseName || prod.warehouse || "").toLowerCase().includes(q)
        const matchBatch = (prod.batch || "").toLowerCase().includes(q)
        const matchParty = (prod.customer || "").toLowerCase().includes(q)
        if (!matchName && !matchSku && !matchWh && !matchBatch && !matchParty) return false
      }

      return true
    })
  }, [products, selectedWarehouse, selectedCategory, expiryFilter, searchQuery])

  // Executive Financial KPIs across all products or scoped warehouse
  const metrics = useMemo(() => {
    let totalCostValuation = 0
    let totalPotentialSalesVal = 0
    let wh1CostVal = 0
    let wh1Qty = 0
    let wh2CostVal = 0
    let wh2Qty = 0
    let wh3CostVal = 0
    let wh3Qty = 0
    let inStockCount = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    products.forEach((p) => {
      const qty = Number(p.quantity || 0)
      const cost = Number(p.unitCost ?? (p as any).unit_cost ?? 0)
      const sell = Number(p.sellingPrice ?? (p as any).selling_price ?? 0)
      const val = Number(p.totalStockValue ?? qty * cost)
      const potSales = qty * sell

      totalCostValuation += val
      totalPotentialSalesVal += potSales

      const whUpper = String(p.warehouse || "").toUpperCase()
      if (whUpper === "WH1" || isExportWarehouse(whUpper)) {
        wh1CostVal += val
        wh1Qty += qty
      } else if (whUpper === "WH2") {
        wh2CostVal += val
        wh2Qty += qty
      } else if (whUpper === "WH3") {
        wh3CostVal += val
        wh3Qty += qty
      }

      if (qty === 0) outOfStockCount++
      else if (qty < 20) lowStockCount++
      else inStockCount++
    })

    const totalUnrealizedProfit = Math.max(0, totalPotentialSalesVal - totalCostValuation)
    const marginPct = totalPotentialSalesVal > 0
      ? Math.round((totalUnrealizedProfit / totalPotentialSalesVal) * 1000) / 10
      : 0

    return {
      totalCostValuation,
      totalPotentialSalesVal,
      totalUnrealizedProfit,
      marginPct,
      wh1CostVal,
      wh1Qty,
      wh2CostVal,
      wh2Qty,
      wh3CostVal,
      wh3Qty,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      totalSkus: products.length,
    }
  }, [products])

  // Export to Excel using native XML export
  const handleExportExcel = () => {
    const headers = [
      "SKU / Item ID",
      "Product Name / Description",
      "Category",
      "Warehouse",
      "Quantity on Hand",
      "Unit",
      "Unit Acquisition Cost (ETB)",
      "Selling Price (ETB)",
      "Stock Valuation at Cost (ETB)",
      "Potential Sales Value (ETB)",
      "Gross Margin %",
      "Batch Number",
      "Expiry Date",
      "Stock Status",
    ]

    const rows = filteredProducts.map((p) => {
      const qty = Number(p.quantity || 0)
      const cost = Number(p.unitCost ?? (p as any).unit_cost ?? 0)
      const sell = Number(p.sellingPrice ?? (p as any).selling_price ?? 0)
      const val = Number(p.totalStockValue ?? qty * cost)
      const potSales = qty * sell
      const margin = potSales > 0 ? `${(((potSales - val) / potSales) * 100).toFixed(1)}%` : "0.0%"

      return [
        p.sku || p.id,
        p.name,
        isExportWarehouse(p.warehouse) ? "Export Commodity" : "Veterinary Medicine",
        p.warehouseName || p.warehouse,
        qty,
        p.unit || "Unit",
        cost,
        sell,
        val,
        potSales,
        margin,
        p.batch || "—",
        p.expiry || "—",
        p.status || (qty === 0 ? "Out of Stock" : qty < 20 ? "Low Stock" : "In Stock"),
      ]
    })

    exportToExcel({
      fileName: `HKC_Finance_Stock_Valuation_${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Stock Valuation",
      title: "HKC Trading ERP — Inventory Asset Valuation",
      subtitle: `Export Date: ${new Date().toLocaleDateString()} • Total Portfolio Value: ETB ${metrics.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      headers,
      rows,
    })

    showToast("Export Complete", "success", "Stock valuation spreadsheet downloaded successfully.")
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <div
        className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12"
      >
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-black text-black tracking-tight">Stock &amp; Inventory Valuation</h1>
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-2xl leading-relaxed mt-1">
              Authoritative warehouse inventory balances, acquisition asset valuations, estimated sales value, and chronological movement audit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </div>

        {/* Executive KPI Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total Valuation at Cost */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total Stock Cost</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <Package className="size-4" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-zinc-950 truncate" title={`ETB ${metrics.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              ETB {metrics.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1">Asset balance sheet valuation</p>
          </GlassCard>

          {/* Card 2: Estimated Sales Revenue */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Estimated Sales Value</span>
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-sky-800 truncate" title={`ETB ${metrics.totalPotentialSalesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              ETB {metrics.totalPotentialSalesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1">Projected revenue at selling prices</p>
          </GlassCard>

          {/* Card 3: Estimated Profit & Margin */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Estimated Profit</span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                <Percent className="size-4" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-indigo-950 truncate" title={`ETB ${metrics.totalUnrealizedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              ETB {metrics.totalUnrealizedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">
                +{metrics.marginPct}% Margin
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">on retail</span>
            </div>
          </GlassCard>

          {/* Card 4: Warehouse Valuation Breakdown */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Warehouse Breakdown</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <WarehouseIcon className="size-4" />
              </div>
            </div>
            <div className="space-y-1 text-[11px] font-semibold text-zinc-700">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-800">WH1 Export:</span>
                <span className="font-mono text-zinc-950 font-bold">ETB {(metrics.wh1CostVal / 1000).toFixed(0)}k</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-blue-800">WH2 Alem Bank:</span>
                <span className="font-mono text-zinc-950 font-bold">ETB {(metrics.wh2CostVal / 1000).toFixed(0)}k</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-purple-800">WH3 Lebu:</span>
                <span className="font-mono text-zinc-950 font-bold">ETB {(metrics.wh3CostVal / 1000).toFixed(0)}k</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-6 bg-white/70 p-3 rounded-2xl border border-zinc-200/70 shadow-2xs">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by SKU, product name, batch, voucher, or party..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-zinc-200 text-xs font-semibold placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
            />
          </div>

          {/* Right: Dropdowns & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Warehouse Filter */}
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-3 py-2 bg-white rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Warehouses</option>
              <option value="WH1">WH1 — Export Hub</option>
              <option value="WH2">WH2 — Ashish Pharma</option>
              <option value="WH3">WH3 — Tongda Pharma</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-white rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Categories</option>
              <option value="EXPORT">Export Commodities</option>
              <option value="PHARMA">Veterinary Medicines</option>
            </select>

            {/* Expiry Filter */}
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="px-3 py-2 bg-white rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Expiry Status</option>
              <option value="CRITICAL">Critical (≤30d)</option>
              <option value="WARNING">Watchlist (≤90d)</option>
              <option value="EXPIRED">Expired</option>
              <option value="GOOD">Good Status</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
              title="Reload live inventory data"
            >
              <RefreshCw className={`size-3.5 text-zinc-500 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Export Stock Valuation to Excel"
            >
              <Download className="size-3.5 text-white" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Stock Valuation Table */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="size-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-zinc-600">Loading authoritative inventory stock data...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Package className="size-10 text-zinc-300 mx-auto" />
              <p className="text-sm font-bold text-zinc-800">No inventory products found</p>
              <p className="text-xs text-zinc-400">Try changing your search term, warehouse filter, or expiry criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-medium">
                <thead>
                  <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">Audit</th>
                    <th className="py-3 px-4">SKU / Item ID</th>
                    <th className="py-3 px-4">Description / Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Warehouse</th>
                    <th className="py-3 px-4 text-right">Physical Qty</th>
                    <th className="py-3 px-4 text-right">Unit Cost (ETB)</th>
                    <th className="py-3 px-4 text-right">Selling Price (ETB)</th>
                    <th className="py-3 px-4 text-right bg-emerald-50/40 text-emerald-950 font-black">Stock Val @ Cost</th>
                    <th className="py-3 px-4 text-right text-sky-950">Potential Revenue</th>
                    <th className="py-3 px-4 text-center">Gross Margin</th>
                    <th className="py-3 px-4 text-center">Expiry Status</th>
                    <th className="py-3 px-4 text-center">Voucher / Bin Doc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150">
                  {filteredProducts.map((prod) => {
                    const isExpanded = expandedProductIds.has(prod.id)
                    const isWh1 = isExportWarehouse(prod.warehouse)
                    const qty = Number(prod.quantity || 0)
                    const unitCost = Number(prod.unitCost ?? (prod as any).unit_cost ?? 0)
                    const sellingPrice = Number(prod.sellingPrice ?? (prod as any).selling_price ?? 0)
                    const stockValueAtCost = Number(prod.totalStockValue ?? qty * unitCost)
                    const potentialSales = qty * sellingPrice
                    const unrealizedMargin = potentialSales > 0 ? potentialSales - stockValueAtCost : 0
                    const marginPct = potentialSales > 0 ? Math.round((unrealizedMargin / potentialSales) * 1000) / 10 : 0
                    const expiry = prod.expiry || ""
                    const expiryResult = getExpiryStatus(expiry)

                    return (
                      <Fragment key={prod.id}>
                        <tr
                          onClick={() => toggleRowExpand(prod.id)}
                          className="hover:bg-zinc-50/70 cursor-pointer transition-colors border-b border-zinc-100"
                        >
                          {/* Audit Expand Chevron */}
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleRowExpand(prod.id)}
                              className="p-1 hover:bg-zinc-200/70 rounded-md transition-colors text-zinc-500 cursor-pointer"
                              title={isExpanded ? "Collapse movement ledger" : "Expand chronological movement ledger"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-4 text-zinc-900" />
                              ) : (
                                <ChevronRight className="size-4 text-zinc-400" />
                              )}
                            </button>
                          </td>

                          {/* SKU / Code */}
                          <td className="py-3 px-4 font-mono text-[11px] font-bold text-zinc-800">
                            {prod.sku || prod.id}
                          </td>

                          {/* Product Name */}
                          <td className="py-3 px-4 font-bold text-zinc-950">
                            <div className="flex items-center gap-1.5">
                              <span>{prod.name}</span>
                              {prod.dosage && (
                                <span className="text-[10px] font-semibold text-zinc-400">({prod.dosage})</span>
                              )}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-4 text-[11px] font-semibold text-zinc-600">
                            {isWh1 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                                Export Commodity
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/60">
                                Veterinary Medicine
                              </span>
                            )}
                          </td>

                          {/* Warehouse */}
                          <td className="py-3 px-4 text-xs font-bold text-zinc-700">
                            {prod.warehouseName || prod.warehouse}
                          </td>

                          {/* Physical Qty */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-zinc-950">
                            {qty.toLocaleString()} <span className="text-[10px] font-normal text-zinc-400">{prod.unit || (isWh1 ? "Qtl" : "Box")}</span>
                          </td>

                          {/* Unit Cost */}
                          <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-800">
                            ETB {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Selling Price */}
                          <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-800">
                            {sellingPrice > 0 ? (
                              `ETB ${sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Stock Valuation @ Cost */}
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-800 bg-emerald-50/20">
                            ETB {stockValueAtCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Potential Sales Value */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-sky-900">
                            {potentialSales > 0 ? (
                              `ETB ${potentialSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Gross Margin % */}
                          <td className="py-3 px-4 text-center">
                            {marginPct > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                +{marginPct}%
                              </span>
                            ) : (
                              <span className="text-zinc-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Expiry Status */}
                          <td className="py-3 px-4 text-center font-mono text-[11px]">
                            {expiry ? (
                              <div>
                                <div className="text-zinc-700 font-bold">{expiry}</div>
                                <div className="text-[9px] font-sans font-bold">
                                  {expiryResult.tier === "EXPIRED" && <span className="text-rose-600">Expired</span>}
                                  {expiryResult.tier === "CRITICAL" && <span className="text-amber-600">≤30 Days</span>}
                                  {expiryResult.tier === "WARNING" && <span className="text-orange-500">≤90 Days</span>}
                                  {expiryResult.tier === "GOOD" && <span className="text-emerald-600">Good</span>}
                                  {expiryResult.tier === "UNKNOWN" && <span className="text-zinc-400">Active</span>}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-[10px]">N/A</span>
                            )}
                          </td>

                          {/* Print / Preview Actions */}
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {isWh1 ? (
                              <button
                                type="button"
                                onClick={() => setPrintingWH1Product(prod)}
                                className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[11px] font-bold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Preview & Print Official WH1 Receiving Voucher"
                              >
                                <Printer className="size-3 text-zinc-500" /> Voucher
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPrintingPharmaProduct(prod)}
                                className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[11px] font-bold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Preview & Print Official Pharma Bin Card Document"
                              >
                                <Printer className="size-3 text-zinc-500" /> Bin Card
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Collapsible Read-Only Movement Audit Ledger */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/50">
                            <td colSpan={13} className="p-4 sm:p-6 border-b border-zinc-200">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="p-1 rounded-md bg-zinc-900 text-white">
                                      <Layers className="size-3.5" />
                                    </span>
                                    <span className="text-xs font-black uppercase tracking-wider text-zinc-800">
                                      Chronological Stock Movement Audit &bull; {prod.name} ({prod.sku || prod.id})
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-200 text-zinc-700">
                                      Read-Only Ledger
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-zinc-500 font-semibold">
                                    Warehouse: <strong className="text-zinc-900">{prod.warehouseName || prod.warehouse}</strong>
                                  </span>
                                </div>

                                {isWh1 ? (
                                  <WH1ChildMovementLedger product={prod} />
                                ) : (
                                  <StockBinCardLedger product={prod} />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100/90 border-t-2 border-zinc-300 text-xs font-mono font-bold text-zinc-950">
                    <td colSpan={5} className="py-3 px-4 text-right uppercase text-[10px] font-black border-r border-zinc-200">
                      Total Portfolio Summary ({filteredProducts.length} Products):
                    </td>
                    <td className="py-3 px-4 text-right font-black border-r border-zinc-200">
                      {filteredProducts.reduce((sum, p) => sum + Number(p.quantity || 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="py-3 px-4 text-center text-zinc-400 font-normal italic border-r border-zinc-200">
                      —
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-900 bg-emerald-100/60 border-r border-zinc-200">
                      ETB {filteredProducts.reduce((sum, p) => sum + Number(p.totalStockValue ?? (Number(p.quantity || 0) * Number(p.unitCost || 0))), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-sky-900 border-r border-zinc-200">
                      ETB {filteredProducts.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.sellingPrice || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3} className="py-3 px-4 text-center text-zinc-500 font-sans italic text-[11px]">
                      Authoritative HKC Trading Valuation Registry
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Read-Only Document Print Previews */}
      {printingWH1Product && (
        <WH1ReceivingVoucherPrintModal
          isOpen={Boolean(printingWH1Product)}
          onClose={() => setPrintingWH1Product(null)}
          product={printingWH1Product}
        />
      )}

      {printingPharmaProduct && (
        <StockBinCardPrintModal
          isOpen={Boolean(printingPharmaProduct)}
          onClose={() => setPrintingPharmaProduct(null)}
          product={printingPharmaProduct}
        />
      )}
    </div>
  )
}
