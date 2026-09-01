import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Boxes,
  Building2,
  Clock,
  Sparkles,
  Eye,
  X,
  Warehouse,
  Calendar,
  CheckCircle2,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useFeedback } from "@/context/FeedbackContext"
import {
  type ProcessingServiceOrder,
  type ProcessingServiceStage,
  fetchProcessingServices,
  transitionProcessingServiceStage,
} from "@/lib/processingServicesApi"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

const STAGE_COLOR_MAP: Record<ProcessingServiceStage, { bg: string; text: string; border: string }> = {
  Received: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500/20" },
  Processed: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/20" },
  Delivered: { bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-300", border: "border-purple-500/20" },
}

const tollGoodsColumns: TableColumn[] = [
  { key: "reference_number", label: "Lot Ref", align: "left" },
  { key: "client_company_name", label: "Client / Consignor", align: "left" },
  { key: "goods_description", label: "Physical Commodity", align: "left" },
  { key: "entry_date", label: "Entry Date", align: "left" },
  { key: "status", label: "Warehouse Stage", align: "center" },
  { key: "_actions", label: "Inspect", align: "center", noSort: true },
]

export default function TollProcessingGoods() {
  const { showToast } = useFeedback()
  const [services, setServices] = useState<ProcessingServiceOrder[]>([])
  const [stageFilter, setStageFilter] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState<ProcessingServiceOrder | null>(null)

  const loadData = async () => {
    const data = await fetchProcessingServices()
    setServices(data)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleStageTransition = async (id: string, targetStage: ProcessingServiceStage) => {
    try {
      const result = await transitionProcessingServiceStage(id, targetStage)
      if (result.ok) {
        showToast("Warehouse Status Updated", "success", `Commodity lot ${id} updated to '${targetStage}'.`)
        loadData()
        if (selectedItem?.id === id) {
          setSelectedItem(result)
        }
      }
    } catch (err) {
      showToast("Update Failed", "warning", "Failed to update warehouse processing stage.")
    }
  }

  // Goods physical inventory list
  const onSiteGoods = services

  const filteredGoods = onSiteGoods.filter((s) => {
    const matchesSearch =
      s.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.client_company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.goods_description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStage = stageFilter === "ALL" || s.status === stageFilter
    return matchesSearch && matchesStage
  })

  const goodsTable = useResizableTable<ProcessingServiceOrder>(tollGoodsColumns, filteredGoods, {
    reference_number: 120,
    client_company_name: 180,
    goods_description: 180,
    entry_date: 110,
    status: 140,
    _actions: 90,
  })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, stageFilter, filteredGoods.length])

  const sortedGoods = goodsTable.sorted()
  const totalPages = Math.max(1, Math.ceil(sortedGoods.length / pageSize))
  const displayedGoods = sortedGoods.slice((page - 1) * pageSize, page * pageSize)

  // Telemetry Calculations
  const receivedCount = services.filter((s) => s.status === "Received").length
  const processedCount = services.filter((s) => s.status === "Processed").length
  const deliveredCount = services.filter((s) => s.status === "Delivered").length
  const totalVolumeOnSite = services
    .filter((s) => s.status === "Received" || s.status === "Processed")
    .reduce((sum, s) => sum + Number(s.quantity || 0), 0)

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={fade} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-black tracking-tight">Toll Processing Physical Inventory</h1>
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                WH1 Client Commodities
              </span>
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Physical inventory tracking for non-owned client goods undergoing washing, sorting, milling, and grading at Warehouse 1.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/inventory")} />
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Received (Awaiting Processing)", value: `${receivedCount} Lots`, sub: "Staged in WH1 Receiving Bay", Icon: Clock, iconBg: "bg-blue-50", iconColor: "text-blue-700" },
            { label: "Processed (Milling Complete)", value: `${processedCount} Lots`, sub: "Packaged for client pickup", Icon: Sparkles, iconBg: "bg-emerald-50", iconColor: "text-emerald-700" },
            { label: "Delivered & Dispatched", value: `${deliveredCount} Lots`, sub: "Finished goods released", Icon: CheckCircle2, iconBg: "bg-purple-50", iconColor: "text-purple-700" },
            { label: "Total Physical Goods On-Site", value: `${totalVolumeOnSite.toLocaleString()} Quintals`, sub: "Non-owned client stock at WH1", Icon: Boxes, iconBg: "bg-purple-50", iconColor: "text-purple-700" },
          ].map((s, idx) => {
            const Icon = s.Icon
            return (
              <GlassCard key={s.label} className="flex items-center justify-between" transition={{ delay: 0.05 * idx, duration: 0.4 }}>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{s.label}</p>
                  <p className="text-2xl font-black text-black mt-1 mb-1 font-mono">{s.value}</p>
                  <p className="text-[10px] font-bold text-zinc-500">{s.sub}</p>
                </div>
                <div className={`p-3 rounded-2xl ${s.iconBg} ${s.iconColor}`}>
                  <Icon className="size-6" />
                </div>
              </GlassCard>
            )
          })}
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Data Table */}
          <div className="lg:col-span-8">
            <GlassCard className="flex flex-col overflow-hidden p-0 border border-white/65 shadow-md">
              <div className="px-6 pt-6">
                <FinanceTableToolbar
                  title="Toll Goods Inventory Register"
                  subtitle={`Total: ${goodsTable.sorted().length} physical commodity lots`}
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Search lot ref, client, or commodity..."
                  filters={[
                    {
                      value: stageFilter,
                      onChange: (val) => setStageFilter(val),
                      ariaLabel: "Filter by Stage",
                      options: [
                        { value: "ALL", label: "All Stages" },
                        { value: "Received", label: "Received" },
                        { value: "In Progress", label: "In Progress" },
                        { value: "Processed", label: "Processed" },
                        { value: "Picked Up/Delivered", label: "Picked Up/Delivered" },
                      ],
                    },
                  ]}
                />
              </div>

              <TableScrollWrapper>
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                      {tollGoodsColumns.map((col) => (
                        <ResizableTh
                          key={col.key}
                          col={col}
                          width={goodsTable.colWidths[col.key] || 120}
                          sortKey={goodsTable.sortKey}
                          sortDir={goodsTable.sortDir}
                          openMenuCol={goodsTable.openMenuCol}
                          onResizeStart={goodsTable.handleResizeStart}
                          onToggleMenu={goodsTable.toggleMenu}
                          onSortAsc={goodsTable.setSortAsc}
                          onSortDesc={goodsTable.setSortDesc}
                          onClearSort={goodsTable.clearSort}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {sortedGoods.length === 0 ? (
                      <tr>
                        <td colSpan={tollGoodsColumns.length} className="px-4 py-8 text-center text-xs font-semibold text-zinc-400">
                          No client commodities physically present for selected filter.
                        </td>
                      </tr>
                    ) : (
                      displayedGoods.map((item) => {
                        const isSelected = selectedItem?.id === item.id
                        const colors = STAGE_COLOR_MAP[item.status] || STAGE_COLOR_MAP.Received

                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`border-b border-zinc-150/40 hover:bg-zinc-50/60 transition-colors text-xs cursor-pointer ${
                              isSelected ? "bg-zinc-900/5 dark:bg-white/10" : ""
                            }`}
                          >
                            <td style={{ width: `${goodsTable.colWidths.reference_number}px` }} className="px-3 py-3 whitespace-nowrap font-mono font-bold text-zinc-900 truncate">
                              {item.reference_number || item.id}
                            </td>
                            <td style={{ width: `${goodsTable.colWidths.client_company_name}px` }} className="px-3 py-3 font-bold text-zinc-900 truncate">
                              <div className="flex items-center gap-1.5 truncate">
                                <Building2 className="size-3.5 text-zinc-400 inline shrink-0" />
                                <span className="truncate">{item.client_company_name}</span>
                              </div>
                            </td>
                            <td style={{ width: `${goodsTable.colWidths.goods_description}px` }} className="px-3 py-3 truncate">
                              <div className="font-bold text-zinc-800 truncate">{item.goods_description}</div>
                              <div className="text-[10px] font-mono text-zinc-500 font-bold truncate">
                                {item.quantity} {item.uom}
                              </div>
                            </td>
                            <td style={{ width: `${goodsTable.colWidths.entry_date}px` }} className="px-3 py-3 font-mono text-zinc-600 truncate">{item.entry_date}</td>
                            <td style={{ width: `${goodsTable.colWidths.status}px` }} className="px-3 py-3 text-center whitespace-nowrap truncate">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${colors.bg} ${colors.text} ${colors.border}`}>
                                {item.status}
                              </span>
                            </td>
                            <td style={{ width: `${goodsTable.colWidths._actions}px` }} className="px-3 py-3 text-center whitespace-nowrap truncate pr-4">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedItem(item)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] inline-flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Eye className="size-3" /> View Lifecycle
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </TableScrollWrapper>

              {sortedGoods.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                    <span>
                      Showing {Math.min((page - 1) * pageSize + 1, sortedGoods.length)} to {Math.min(page * pageSize, sortedGoods.length)} of {sortedGoods.length} entries
                    </span>
                    <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                      <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value))
                          setPage(1)
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
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right Inspector Drawer */}
          <div className="lg:col-span-4">
            {selectedItem ? (
              <GlassCard transition={{ delay: 0.15, duration: 0.4 }}>
                <div className="flex items-start justify-between mb-4 border-b border-zinc-200/80 pb-3">
                  <div>
                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">PHYSICAL LOT INSPECTION</div>
                    <h3 className="text-xl font-black font-mono text-zinc-950 dark:text-zinc-50 mt-0.5">
                      {selectedItem.reference_number || selectedItem.id}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400">
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Consignor / Owner</span>
                    <span className="font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5">
                      <Building2 className="size-3.5 text-zinc-500" /> {selectedItem.client_company_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Commodity</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{selectedItem.goods_description}</span>
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Physical Quantity</span>
                      <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                        {selectedItem.quantity} {selectedItem.uom}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Warehouse Storage</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 flex items-center gap-1">
                        <Warehouse className="size-3.5" /> WH1 - Export Hub
                      </span>
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Arrival Date</span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-center gap-1">
                        <Calendar className="size-3.5 text-zinc-400" /> {selectedItem.entry_date}
                      </span>
                    </div>
                  </div>

                  {selectedItem.notes && (
                    <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-800 uppercase block">Handling Instructions</span>
                      <p className="text-xs font-semibold text-amber-950 mt-0.5">{selectedItem.notes}</p>
                    </div>
                  )}

                  {/* Stage Transition Controls for Warehouse Staff */}
                  <div className="pt-3 border-t border-zinc-200/80 space-y-2">
                    <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Warehouse Operations Action</div>

                    {selectedItem.status === "Received" && (
                      <button
                        onClick={() => handleStageTransition(selectedItem.id, "Processed")}
                        className="w-full py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2"
                      >
                        <Sparkles className="size-4" /> Complete Processing & Stage for Delivery
                      </button>
                    )}

                    {selectedItem.status === "Processed" && (
                      <button
                        onClick={() => handleStageTransition(selectedItem.id, "Delivered")}
                        className="w-full py-2 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-700 shadow-sm flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="size-4" /> Release Commodity to Client (Deliver)
                      </button>
                    )}

                    {selectedItem.status === "Delivered" && (
                      <div className="p-3 bg-purple-50 text-purple-900 border border-purple-200 text-center font-bold text-xs rounded-xl">
                        Commodity Dispatched & Delivered to Client
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="text-center py-12" transition={{ delay: 0.15, duration: 0.4 }}>
                <Boxes className="size-10 text-zinc-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-zinc-500">Select a lot row to view physical warehouse storage and stage actions.</p>
              </GlassCard>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
