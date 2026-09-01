import { useState, useEffect, type ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { GlassCard } from "@/components/GlassCard"
import { FinanceTableToolbar, type FilterOption, type HeaderAction } from "@/components/FinanceTableToolbar"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"

export interface DataTableProps<T> {
  title: string
  subtitle?: string
  columns: TableColumn[]
  data: T[]
  isLoading?: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  searchPlaceholder?: string
  filters?: FilterOption[]
  actions?: HeaderAction[]
  defaultWidths?: Record<string, number>
  emptyMessage?: string
  enablePagination?: boolean
  initialPageSize?: number
  renderRow: (item: T, colWidths: Record<string, number>) => ReactNode
  keyExtractor: (item: T) => string | number
  onRowClick?: (item: T) => void
}

function DataTableSkeletonRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index} className="border-b border-zinc-150/40">
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <td key={colIdx} className="py-4 px-4">
              <Skeleton className="h-4 w-full bg-zinc-200/80" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function DataTable<T>({
  title,
  subtitle,
  columns,
  data,
  isLoading = false,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search records...",
  filters = [],
  actions = [],
  defaultWidths,
  emptyMessage = "No records match your active search filters.",
  enablePagination = true,
  initialPageSize = 10,
  renderRow,
  keyExtractor,
  onRowClick,
}: DataTableProps<T>) {
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
  } = useResizableTable(columns, data, defaultWidths)

  const sortedData = sorted()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Reset to page 1 whenever search query, filters, or dataset length change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters.map((f) => String(f.value)).join(","), sortedData.length])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const displayedData = enablePagination
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData

  return (
    <GlassCard className="flex flex-col overflow-hidden p-0 border border-white/65 shadow-md">
      {/* Header Toolbar — Aligned directly to table with px-6 pt-6 (no extra bottom gap) */}
      <div className="px-6 pt-6">
        <FinanceTableToolbar
          title={title}
          subtitle={subtitle ?? `Total: ${sortedData.length} records`}
          searchValue={searchQuery}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          actions={actions}
        />
      </div>

      {/* Resizable & Sortable Table Container with Desktop Horizontal Scrollbars */}
      <TableScrollWrapper>
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
              {columns.map((col) => (
                <ResizableTh
                  key={col.key}
                  col={col}
                  width={colWidths[col.key] || 120}
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
          <tbody className="divide-y divide-zinc-150/40 font-semibold text-zinc-800 text-xs">
            {isLoading ? (
              <DataTableSkeletonRows columnCount={columns.length} />
            ) : displayedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-zinc-400 text-xs font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={`hover:bg-zinc-50/60 dark:hover:bg-white/10 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {renderRow(item, colWidths)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollWrapper>

      {/* Pagination Footer matching SalesIssued design */}
      {enablePagination && !isLoading && sortedData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
          <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
            </span>
            <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
              <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
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
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
            >
              Previous
            </button>
            <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  )
}
