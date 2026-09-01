import { Fragment, useState, useMemo } from "react"
import { ChevronDown, ChevronRight, Plus, Printer, Edit3, Package } from "lucide-react"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { Skeleton } from "@/components/ui/skeleton"
import type { BinCard, BinCardEntry } from "@/lib/binCardApi"

interface BinCardTableProps {
  cards: BinCard[]
  isLoading?: boolean
  searchQuery: string
  selectedBatchFilter: string
  onAddEntry: (card: BinCard) => void
  onEditCard: (card: BinCard) => void
  onPrintCard: (card: BinCard) => void
  onEditEntry: (card: BinCard, entry: BinCardEntry) => void
}

function BinCardTableSkeletonRows({ colSpan }: { colSpan: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td className="py-4 px-6">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28 bg-zinc-200/80" />
            </div>
          </td>
          {Array.from({ length: Math.max(1, colSpan - 1) }).map((_, cIdx) => (
            <td key={cIdx} className="py-4 px-4">
              <Skeleton className="h-3 w-24 bg-zinc-200/80" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function BinCardTable({
  cards,
  isLoading = false,
  searchQuery,
  selectedBatchFilter,
  onAddEntry,
  onEditCard,
  onPrintCard,
  onEditEntry
}: BinCardTableProps) {
  // Truncated (collapsed) by default
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set())

  const toggleRowExpand = (id: string) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter cards & sub-entries
  const filteredCards = useMemo(() => {
    return cards.map(card => {
      const entries = card.entries || []
      const filteredEntries = entries.filter(e => {
        const matchesSearch = 
          e.batchNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.party.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.remark.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.date.includes(searchQuery)

        const matchesBatch = selectedBatchFilter === "ALL" || e.batchNo === selectedBatchFilter
        return matchesSearch && matchesBatch
      })

      const cardMatchesSearch = 
        card.cardNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.dosage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.shelfNo.toLowerCase().includes(searchQuery.toLowerCase())

      const shouldShow = cardMatchesSearch || filteredEntries.length > 0
      return {
        card,
        entries: filteredEntries,
        shouldShow,
        cardNo: card.cardNo,
        description: card.description,
        dosage: card.dosage,
        shelfNo: card.shelfNo,
      }
    }).filter(item => item.shouldShow)
  }, [cards, searchQuery, selectedBatchFilter])

  // Refined parent columns: Card No, Description / Name, Strength / Dosage, Shelf Number, Action
  const columns: TableColumn[] = useMemo(() => [
    { key: "cardNo", label: "Card No", align: "left" },
    { key: "description", label: "Description / Name", align: "left" },
    { key: "dosage", label: "Strength / Dosage", align: "left" },
    { key: "shelfNo", label: "Shelf Number", align: "left" },
    { key: "_actions", label: "Action", align: "center", noSort: true },
  ], [])

  const resizableTable = useResizableTable(columns, filteredCards, {
    cardNo: 140,
    description: 280,
    dosage: 180,
    shelfNo: 140,
    _actions: 220,
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse table-fixed">
        <thead className="relative z-20">
          <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
            {columns.map((col: TableColumn) => (
              <ResizableTh
                key={col.key}
                col={col}
                width={resizableTable.colWidths[col.key] || 140}
                sortKey={resizableTable.sortKey}
                sortDir={resizableTable.sortDir}
                openMenuCol={resizableTable.openMenuCol}
                onResizeStart={resizableTable.handleResizeStart}
                onToggleMenu={resizableTable.toggleMenu}
                onSortAsc={resizableTable.setSortAsc}
                onSortDesc={resizableTable.setSortDesc}
                onClearSort={resizableTable.clearSort}
              />
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-zinc-150/40">
          {isLoading ? (
            <BinCardTableSkeletonRows colSpan={columns.length} />
          ) : filteredCards.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-12 text-center text-zinc-400 text-xs font-semibold">
                <Package className="size-10 mx-auto text-zinc-300 mb-2" />
                <h4 className="text-sm font-black text-zinc-950">No Bin Cards Found</h4>
                <p className="text-xs text-zinc-500 font-semibold max-w-sm mx-auto mt-1">
                  No matching stock bin cards or ledger entries found. Click "+ Add Bin Card" above to register a new card.
                </p>
              </td>
            </tr>
          ) : (
            resizableTable.sorted().map((item) => {
              const { card, entries } = item
              const isExpanded = expandedCardIds.has(card.id)

              return (
                <Fragment key={card.id}>
                  {/* PARENT BIN CARD ROW */}
                  <tr 
                    onClick={() => toggleRowExpand(card.id)}
                    className="hover:bg-white/45 cursor-pointer transition-colors font-semibold text-xs border-b border-zinc-100"
                  >
                    {/* Card No */}
                    <td className="py-4 px-6 overflow-hidden">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 font-bold uppercase truncate">
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleRowExpand(card.id) }} 
                          className="p-1 hover:bg-zinc-100 rounded-md transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="size-3 text-zinc-800" /> : <ChevronRight className="size-3 text-zinc-400" />}
                        </button>
                        <span className="truncate text-zinc-950 font-black">{card.cardNo}</span>
                      </div>
                    </td>

                    {/* Description / Name */}
                    <td className="py-4 px-4 overflow-hidden font-black text-zinc-950 leading-tight">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{card.description}</span>
                      </div>
                    </td>

                    {/* Strength / Dosage */}
                    <td className="py-4 px-4 font-bold text-zinc-600 truncate">
                      {card.dosage}
                    </td>

                    {/* Shelf Number */}
                    <td className="py-4 px-4 font-mono font-bold text-emerald-800 truncate">
                      {card.shelfNo}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onAddEntry(card)}
                          className="px-2.5 py-1.5 rounded-full bg-zinc-950 text-white font-extrabold text-[10px] inline-flex items-center gap-1 hover:bg-zinc-800 transition-all active:scale-95 shadow-xs cursor-pointer"
                          title="Add Stock Entry to this Bin Card"
                        >
                          <Plus className="size-3.5" /> Add
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintCard(card)}
                          className="px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-800 font-extrabold text-[10px] inline-flex items-center gap-1 hover:bg-zinc-50 transition-all active:scale-95 shadow-xs cursor-pointer"
                          title="Print / Export Bin Card"
                        >
                          <Printer className="size-3 text-zinc-500" /> Export
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditCard(card)}
                          className="px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-800 font-extrabold text-[10px] inline-flex items-center gap-1 hover:bg-zinc-50 transition-all active:scale-95 shadow-xs cursor-pointer"
                          title="Edit Card Details"
                        >
                          <Edit3 className="size-3 text-zinc-500" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* EXPANDED SUB-TABLE ROW */}
                  {isExpanded && (
                    <tr className="bg-zinc-50/60">
                      <td colSpan={columns.length} className="px-6 py-3">
                        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
                          {entries.length === 0 ? (
                            <div className="text-zinc-400 text-xs py-3 px-4 text-center font-medium">
                              No active sub-entries. Click "Add" to record stock movement.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs font-semibold">
                                <thead>
                                  {/* Grouped Header with Quantity In */}
                                  <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                                    <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Date</th>
                                    <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Batch Number</th>
                                    <th colSpan={3} className="py-1.5 text-center border-r border-b border-zinc-200 bg-zinc-100/80 font-black text-zinc-800">
                                      Quantity In
                                    </th>
                                    <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Expiry Date</th>
                                    <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Received / Issued To</th>
                                    <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Remark</th>
                                    <th rowSpan={2} className="py-2.5 px-4 text-center">Actions</th>
                                  </tr>
                                  <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[9px] font-black uppercase tracking-wider text-zinc-500">
                                    <th className="py-2 px-4 border-r border-zinc-200 text-right text-emerald-700">Received</th>
                                    <th className="py-2 px-4 border-r border-zinc-200 text-right text-rose-700">Issued</th>
                                    <th className="py-2 px-4 border-r border-zinc-200 text-right bg-zinc-100/60 text-zinc-950">Balance</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-150">
                                  {entries.map((rec) => (
                                    <tr key={rec.id} className="hover:bg-zinc-50 transition-colors">
                                      <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-800 font-bold border-r border-zinc-100">{rec.date}</td>
                                      <td className="py-2.5 px-4 font-mono text-zinc-950 font-bold border-r border-zinc-100">{rec.batchNo}</td>
                                      <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-zinc-100 ${rec.qtyReceived > 0 ? "text-emerald-700 font-black" : "text-zinc-400"}`}>
                                        {rec.qtyReceived > 0 ? `+${rec.qtyReceived.toLocaleString()}` : "-"}
                                      </td>
                                      <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-zinc-100 ${rec.qtyIssued > 0 ? "text-rose-700 font-black" : "text-zinc-400"}`}>
                                        {rec.qtyIssued > 0 ? `-${rec.qtyIssued.toLocaleString()}` : "-"}
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-950 bg-zinc-50 border-r border-zinc-100">
                                        {rec.balance.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-4 font-mono text-zinc-600 border-r border-zinc-100">{rec.expiryDate}</td>
                                      <td className="py-2.5 px-4 font-semibold text-zinc-800 border-r border-zinc-100">{rec.party}</td>
                                      <td className="py-2.5 px-4 text-zinc-500 max-w-xs truncate border-r border-zinc-100">{rec.remark}</td>
                                      <td className="py-2.5 px-4 text-center">
                                        <button
                                          type="button"
                                          onClick={() => onEditEntry(card, rec)}
                                          className="px-2.5 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 text-[10px] font-extrabold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                          title="Edit sub-entry details"
                                        >
                                          <Edit3 className="size-3 text-zinc-500" /> Edit
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
