import { useState, useMemo, useEffect, Fragment } from "react"
import {
  Search,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  Package,
  Printer,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, type Product } from "@/lib/erpStore"
import { useAuthStore } from "@/lib/authStore"
import { useFeedback } from "@/context/FeedbackContext"
import WH1ChildMovementLedger from "@/components/stock/WH1ChildMovementLedger"
import StockBinCardLedger from "@/components/stock/StockBinCardLedger"
import WH1ReceivingVoucherPrintModal from "@/components/stock/WH1ReceivingVoucherPrintModal"
import StockBinCardPrintModal from "@/components/stock/StockBinCardPrintModal"
import { getExpiryStatus } from "@/lib/expiryUtils"
import { 
  resolveWarehouseCode, 
  resolveWarehouseFullName, 
  getUserPermittedWarehouses, 
  isProductInWarehouseScope, 
  isExportWarehouse, 
  isPharmaWarehouse,
  matchesWarehouse
} from "@/lib/warehouses"
import { exportToExcel } from "@/lib/exportUtils"

export default function SalesStock() {
  const erp = useErpStore()
  const { user } = useAuthStore()
  const { showToast } = useFeedback()

  const allWarehouses = erp.getWarehouses()
  const permittedWarehouses = useMemo(() => getUserPermittedWarehouses(user, allWarehouses), [user, allWarehouses])
  const isSuperAdmin = (user?.roles || []).includes("superadmin")
  const isScoped = !isSuperAdmin && (user?.warehouse_ids || []).length > 0

  const [isLoading, setIsLoading] = useState(erp.getProducts().length === 0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(() => {
    if (isScoped && permittedWarehouses.length === 1) {
      return permittedWarehouses[0].code || permittedWarehouses[0].id
    }
    return "ALL"
  })

  // Synchronize single permitted warehouse when warehouses load
  useEffect(() => {
    if (isScoped && permittedWarehouses.length === 1) {
      const singleCode = permittedWarehouses[0].code || permittedWarehouses[0].id
      if (selectedWarehouse !== singleCode) {
        setSelectedWarehouse(singleCode)
      }
    }
  }, [isScoped, permittedWarehouses, selectedWarehouse])

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
          console.error("Sales stock load failed:", err)
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
  }, [erp])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await erp.loadInventoryData(true)
      showToast("Inventory Refreshed", "success", "Latest warehouse inventory and balances loaded.")
    } catch (err: any) {
      showToast("Refresh Failed", "warning", err?.message || "Failed to reload inventory.")
    } finally {
      setIsRefreshing(false)
    }
  }

  const allProducts = erp.getProducts()

  // Base products filtered by permitted warehouse scope
  const scopedProducts = useMemo(() => {
    if (!isScoped) return allProducts
    return allProducts.filter((p) => isProductInWarehouseScope(p, user!.warehouse_ids || []))
  }, [allProducts, isScoped, user])

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

  // Filtered Products for the table
  const filteredProducts = useMemo(() => {
    return scopedProducts.filter((prod) => {
      // Warehouse filter
      if (selectedWarehouse !== "ALL") {
        if (!matchesWarehouse(prod.warehouse, selectedWarehouse)) return false
      }

      // Category filter
      if (selectedCategory !== "ALL") {
        if (selectedCategory === "EXPORT" && !isExportWarehouse(prod.warehouse, allWarehouses)) return false
        if (selectedCategory === "PHARMA" && !isPharmaWarehouse(prod.warehouse, allWarehouses)) return false
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
  }, [scopedProducts, selectedWarehouse, selectedCategory, expiryFilter, searchQuery, allWarehouses])

  // KPIs across scoped products
  const metrics = useMemo(() => {
    let totalQty = 0
    let inStockCount = 0
    let lowStockCount = 0
    let outOfStockCount = 0
    let totalPotentialSalesVal = 0

    scopedProducts.forEach((p) => {
      const qty = Number(p.quantity || 0)
      const sell = Number(p.sellingPrice ?? (p as any).selling_price ?? 0)
      totalQty += qty
      totalPotentialSalesVal += (qty * sell)

      if (qty === 0) outOfStockCount++
      else if (qty < 20) lowStockCount++
      else inStockCount++
    })

    return {
      totalQty,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      totalPotentialSalesVal,
      totalSkus: scopedProducts.length,
    }
  }, [scopedProducts])

  // Export to Excel using native XML export
  const handleExportExcel = () => {
    const headers = [
      "SKU / Item ID",
      "Product Name / Description",
      "Category",
      "Warehouse",
      "Quantity on Hand",
      "Unit",
      "Selling Price (ETB)",
      "Batch Number",
      "Expiry Date",
      "Stock Status",
    ]

    const rows = filteredProducts.map((p) => {
      const qty = Number(p.quantity || 0)
      const sell = Number(p.sellingPrice ?? (p as any).selling_price ?? 0)

      return [
        p.sku || p.id,
        p.name,
        isExportWarehouse(p.warehouse, allWarehouses) ? "Export Commodity" : "Veterinary Medicine",
        p.warehouseName || resolveWarehouseFullName(p.warehouse, allWarehouses) || p.warehouse,
        qty,
        p.unit || "Unit",
        sell,
        p.batch || "—",
        p.expiry || "—",
        p.status || (qty === 0 ? "Out of Stock" : qty < 20 ? "Low Stock" : "In Stock"),
      ]
    })

    exportToExcel({
      fileName: `HKC_Sales_Stock_${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Sales Stock",
      title: "HKC Trading ERP — Sales Inventory & Stock Availability",
      subtitle: `Export Date: ${new Date().toLocaleDateString()} • Available SKUs: ${filteredProducts.length} • Total Units: ${metrics.totalQty.toLocaleString()}`,
      headers,
      rows,
    })

    showToast("Export Complete", "success", "Sales stock availability spreadsheet downloaded successfully.")
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <div className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-black text-black tracking-tight">Stock &amp; Availability Monitor</h1>
              {isScoped && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  {permittedWarehouses.map((w) => w.code || w.id).join(", ")} Scoped
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-2xl leading-relaxed mt-1">
              Live warehouse inventory balances, batch tracking, expiry monitoring, and stock availability across assigned facilities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/sales")} />
          </div>
        </div>

        {/* Executive KPI Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total Units on Hand */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total Quantity on Hand</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <Package className="size-4" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-zinc-950 truncate" title={`${metrics.totalQty.toLocaleString()} Units`}>
              {metrics.totalQty.toLocaleString()} <span className="text-xs font-semibold text-zinc-500 font-sans">Units</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1">Across {metrics.totalSkus} catalog items</p>
          </GlassCard>

          {/* Card 2: In-Stock Products */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">In-Stock SKUs</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-800 truncate">
              {metrics.inStockCount} <span className="text-xs font-semibold text-zinc-500 font-sans">SKUs Ready</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1">Sufficient operational stock (&ge; 20 units)</p>
          </GlassCard>

          {/* Card 3: Low Stock Alerts */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Low Stock Notice</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle className="size-4" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-900 truncate">
              {metrics.lowStockCount} <span className="text-xs font-semibold text-zinc-500 font-sans">SKUs</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1">Inventory critically below 20 units</p>
          </GlassCard>

          {/* Card 4: Out of Stock */}
          <GlassCard className="p-4 rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Out of Stock</span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                <XCircle className="size-4" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-rose-900 truncate">
              {metrics.outOfStockCount} <span className="text-xs font-semibold text-zinc-500 font-sans">Depleted</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1">Requires immediate procurement / restock</p>
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
              {permittedWarehouses.length > 1 && (
                <option value="ALL">{isScoped ? "All Permitted Warehouses" : "All Warehouses"}</option>
              )}
              {permittedWarehouses.map((wh) => {
                const code = wh.code || wh.id
                const shortName = wh.name ? wh.name.replace(/^WH\d+\s*[-—–]\s*/i, "") : code
                return (
                  <option key={wh.id} value={code}>
                    {code} — {shortName}
                  </option>
                )
              })}
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
              title="Export Stock to Excel"
            >
              <Download className="size-3.5 text-white" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Inventory Register Table */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-xs font-bold text-zinc-400 flex flex-col items-center gap-3">
              <RefreshCw className="size-6 animate-spin text-zinc-300" />
              <span>Loading warehouse stock records...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-16 text-center text-xs font-bold text-zinc-400">
              No inventory records match your selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-200 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                    <th className="py-3 px-3 w-10 text-center"></th>
                    <th className="py-3 px-4">SKU / Code</th>
                    <th className="py-3 px-4">Product Name &amp; Description</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Warehouse</th>
                    <th className="py-3 px-4 text-right">Available Qty</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-3">Batch / Lot</th>
                    <th className="py-3 px-3">Expiry Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Ledger / Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs font-medium text-zinc-700">
                  {filteredProducts.map((prod) => {
                    const isExpanded = expandedProductIds.has(prod.id)
                    const isWh1 = isExportWarehouse(prod.warehouse, allWarehouses)
                    const whCode = resolveWarehouseCode(prod.warehouse, allWarehouses)
                    const whFullName = resolveWarehouseFullName(prod.warehouse, allWarehouses)
                    const qty = Number(prod.quantity || 0)
                    const sellPrice = Number(prod.sellingPrice ?? (prod as any).selling_price ?? 0)

                    const expiryStatus = getExpiryStatus(prod.expiry)

                    return (
                      <Fragment key={prod.id}>
                        <tr
                          className={`transition-colors hover:bg-zinc-50/70 ${
                            isExpanded ? "bg-zinc-50/90 font-semibold" : ""
                          }`}
                        >
                          {/* Row Expansion Toggle */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleRowExpand(prod.id)}
                              className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/50 transition-colors cursor-pointer"
                              title="Toggle warehouse movement ledger"
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-4 text-zinc-800" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
                          </td>

                          {/* SKU */}
                          <td className="py-3 px-4 font-mono font-bold text-zinc-950 text-xs">
                            {prod.sku || prod.id}
                          </td>

                          {/* Product Description */}
                          <td className="py-3 px-4 font-bold text-zinc-900 max-w-xs truncate" title={prod.name}>
                            {prod.name}
                          </td>

                          {/* Category Badge */}
                          <td className="py-3 px-3">
                            {isWh1 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                Export Commodity
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-900 border border-sky-200">
                                Vet Medicine
                              </span>
                            )}
                          </td>

                          {/* Warehouse Facility */}
                          <td className="py-3 px-3 font-semibold text-zinc-800" title={whFullName}>
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold">
                              <span className="size-2 rounded-full bg-zinc-400" />
                              {whCode}
                            </span>
                          </td>

                          {/* Quantity on Hand */}
                          <td className="py-3 px-4 text-right font-black font-mono text-xs">
                            <span
                              className={
                                qty === 0
                                  ? "text-rose-600"
                                  : qty < 20
                                  ? "text-amber-600"
                                  : "text-zinc-950"
                              }
                            >
                              {qty.toLocaleString()}
                            </span>
                          </td>

                          {/* Packaging Unit */}
                          <td className="py-3 px-3 text-zinc-500 font-semibold text-[11px]">
                            {prod.unit || "Unit"}
                          </td>

                          {/* Selling Price */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-sky-900">
                            {sellPrice > 0 ? `ETB ${sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </td>

                          {/* Batch Number */}
                          <td className="py-3 px-3 font-mono text-zinc-600 font-semibold text-[11px]">
                            {prod.batch || "—"}
                          </td>

                          {/* Expiry Date */}
                          <td className="py-3 px-3">
                            {prod.expiry ? (
                              <div className="flex flex-col">
                                <span className="font-mono text-[11px] text-zinc-800 font-bold">{prod.expiry}</span>
                                {expiryStatus.isAlert && (
                                  <span
                                    className={`text-[9px] font-extrabold uppercase ${
                                      expiryStatus.tier === "EXPIRED"
                                        ? "text-rose-600"
                                        : expiryStatus.tier === "CRITICAL"
                                        ? "text-orange-600"
                                        : "text-amber-600"
                                    }`}
                                  >
                                    {expiryStatus.label}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 font-mono text-[11px]">—</span>
                            )}
                          </td>

                          {/* Stock Status Badge */}
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                qty === 0
                                  ? "bg-rose-100 text-rose-800"
                                  : qty < 20
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {qty === 0 ? "Out of Stock" : qty < 20 ? "Low Stock" : "In Stock"}
                            </span>
                          </td>

                          {/* Ledger / Document Print Action */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (isWh1) {
                                  setPrintingWH1Product(prod)
                                } else {
                                  setPrintingPharmaProduct(prod)
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold text-[11px] transition-colors border border-zinc-200 cursor-pointer shadow-2xs"
                              title={isWh1 ? "Preview WH1 Receiving Voucher" : "Preview Warehouse Bin Card"}
                            >
                              <Printer className="size-3" />
                              <span>{isWh1 ? "Voucher" : "Bin Card"}</span>
                            </button>
                          </td>
                        </tr>

                        {/* Collapsible Child Movement Ledger Sub-View */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/50">
                            <td colSpan={12} className="p-4 border-y border-zinc-200/80">
                              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
                                <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-zinc-900">
                                      {isWh1 ? "WH1 Commodity Receiving Ledger" : "Bin Card Stock In/Out Chronological Audit"}
                                    </span>
                                    <span className="text-[11px] text-zinc-500 font-mono">
                                      SKU: {prod.sku || prod.id} • {prod.name}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                    Facility: {whFullName}
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
                      Total Catalog Summary ({filteredProducts.length} Items):
                    </td>
                    <td className="py-3 px-4 text-right font-black border-r border-zinc-200 text-emerald-900 bg-emerald-50/50">
                      {filteredProducts.reduce((sum, p) => sum + Number(p.quantity || 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="py-3 px-4 text-center text-zinc-400 font-normal italic border-r border-zinc-200">
                      —
                    </td>
                    <td colSpan={4} className="py-3 px-4 text-center text-zinc-500 font-sans italic text-[11px]">
                      HKC Trading Authoritative Stock Register
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
