import { useState, useEffect, useMemo } from "react"
import { ChevronRight } from "lucide-react"
import { ResizableTh, useResizableTable, type TableColumn } from "@/components/ResizableTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import type { HkcDocRecord } from "@/lib/erpStore"
import { HkcDocSkeletonRows } from "./HkcDocSkeletonRows"

interface HkcDocsTableProps {
  records: HkcDocRecord[]
  isLoading: boolean
  searchQuery: string
  typeFilter: "ALL" | "Import" | "Export"
  onEditRecord: (record: HkcDocRecord) => void
}

const columns: TableColumn[] = [
  { key: "shipmentId", label: "Shipment ID", align: "left" },
  { key: "itemsDescription", label: "Items Description", align: "left" },
  { key: "type", label: "Type", align: "left" },
  { key: "date", label: "Date", align: "left" },
  { key: "_actions", label: "Action", align: "center", noSort: true },
]

export default function HkcDocsTable({
  records,
  isLoading,
  searchQuery,
  typeFilter,
  onEditRecord,
}: HkcDocsTableProps) {
  
  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        r.shipmentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.itemsDescription.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = typeFilter === "ALL" || r.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [records, searchQuery, typeFilter])

  const table = useResizableTable(columns, filtered, {
    shipmentId: 180,
    itemsDescription: 350,
    type: 120,
    date: 130,
    _actions: 120,
  })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, typeFilter, filtered.length])

  const sortedRecords = table.sorted()
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize))
  const displayedRecords = sortedRecords.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      <TableScrollWrapper>
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              {columns.map((col) => (
                <ResizableTh
                  key={col.key}
                  col={col}
                  width={table.colWidths[col.key]}
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  openMenuCol={table.openMenuCol}
                  onResizeStart={table.handleResizeStart}
                  onToggleMenu={table.toggleMenu}
                  onSortAsc={table.setSortAsc}
                  onSortDesc={table.setSortDesc}
                  onClearSort={table.clearSort}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-medium">
            {isLoading ? (
              <HkcDocSkeletonRows />
            ) : sortedRecords.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-xs font-semibold text-zinc-400">
                  No documentation records found.
                </td>
              </tr>
            ) : (
              displayedRecords.map((record) => {
                const isImport = record.type === "Import"

                return (
                  <tr
                    key={record.id}
                    className="border-b border-zinc-150/40 hover:bg-zinc-50/60 transition-colors text-xs font-semibold"
                  >
                    {/* Shipment ID */}
                    <td className="px-3 py-4 whitespace-nowrap font-mono font-black text-zinc-900 truncate">
                      {record.shipmentId}
                    </td>

                    {/* Items Description */}
                    <td className="px-3 py-4 text-zinc-800 truncate" title={record.itemsDescription}>
                      {record.itemsDescription}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black border ${
                          isImport
                            ? "bg-sky-100/60 text-sky-700 border-sky-200/80"
                            : "bg-emerald-100/60 text-emerald-700 border-emerald-200/80"
                        }`}
                      >
                        {record.type}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-4 font-mono text-zinc-600 whitespace-nowrap">
                      {record.date}
                    </td>

                    {/* Action */}
                    <td className="px-3 py-4 text-center whitespace-nowrap pr-4">
                      <button
                        onClick={() => onEditRecord(record)}
                        className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-xs inline-flex items-center gap-1"
                      >
                        Manage Docs <ChevronRight className="size-3.5 text-emerald-600" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </TableScrollWrapper>

      {!isLoading && sortedRecords.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 px-4 sm:px-6 py-3.5 sm:py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
          <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
            <span>
              Showing {Math.min((page - 1) * pageSize + 1, sortedRecords.length)} to {Math.min(page * pageSize, sortedRecords.length)} of {sortedRecords.length} entries
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
    </>
  )
}
