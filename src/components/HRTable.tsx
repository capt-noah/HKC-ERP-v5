import { useState } from "react"
import type { ReactNode, MouseEvent } from "react"
import { Search, Plus, ArrowUp, ArrowDown, ChevronDown, RotateCcw } from "lucide-react"

export interface TableColumn {
  key: string
  label: string
  align?: "left" | "right" | "center"
  sortable?: boolean
  initialWidth?: number
}

export interface HRTableFilterOption {
  value: string
  label: string
}

export interface HRTableFilter {
  value: string
  onChange: (val: string) => void
  options: HRTableFilterOption[]
  ariaLabel?: string
}

export interface HRTableAction {
  label: string
  onClick: () => void
  icon?: ReactNode
  variant?: "primary" | "secondary" | "emerald" | "danger"
}

interface HRTableToolbarProps {
  title: string
  subtitle?: string
  searchValue?: string
  onSearchChange?: (val: string) => void
  searchPlaceholder?: string
  filters?: HRTableFilter[]
  actions?: HRTableAction[]
  children?: ReactNode
  secondary?: ReactNode
}

export function HRTableToolbar({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  actions = [],
  children,
  secondary,
}: HRTableToolbarProps) {
  return (
    <div className="px-5 pt-5 pb-3 bg-black/[0.01] border-b border-black/5">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div>
          <h3 className="font-extrabold text-sm md:text-base text-black uppercase tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-500 font-medium">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {onSearchChange !== undefined && (
            <div className="flex items-center gap-2 bg-black/[0.04] rounded-full px-3.5 h-[38px] border border-transparent focus-within:border-black/10 transition-all">
              <Search className="size-3.5 text-zinc-400 shrink-0" />
              <input
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-transparent text-xs text-black placeholder:text-zinc-400 outline-none w-40 sm:w-48 font-medium"
                placeholder={searchPlaceholder}
              />
            </div>
          )}

          {filters.map((filter, idx) => (
            <select
              key={filter.ariaLabel || `filter-${idx}`}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="bg-black/[0.04] text-xs font-bold px-3.5 py-2 rounded-full text-zinc-800 outline-none border border-transparent hover:border-black/10 cursor-pointer h-[38px] transition-all"
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}

          {children}

          {actions.map((act) => (
            <button
              key={act.label}
              onClick={act.onClick}
              type="button"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all h-[38px] uppercase tracking-wider shrink-0 shadow-2xs active:scale-95 ${
                act.variant === "danger"
                  ? "bg-rose-700 hover:bg-rose-800 text-white"
                  : act.variant === "emerald"
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : act.variant === "secondary"
                  ? "bg-black/5 hover:bg-black/10 text-zinc-800"
                  : "bg-black hover:bg-zinc-800 text-white"
              }`}
            >
              {act.icon ?? <Plus className="size-3.5" />}
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {secondary && <div className="mt-3">{secondary}</div>}
    </div>
  )
}

interface ResizableTableHeaderProps {
  columns: TableColumn[]
  colWidths: Record<string, number>
  onResizeStart: (e: MouseEvent<HTMLDivElement>, colKey: string) => void
  sortKey: string | null
  sortDir: "asc" | "desc"
  onSort: (key: string, dir: "asc" | "desc") => void
  onClearSort: () => void
}

export function ResizableTableHeader({
  columns,
  colWidths,
  onResizeStart,
  sortKey,
  sortDir,
  onSort,
  onClearSort,
}: ResizableTableHeaderProps) {
  const [openMenuCol, setOpenMenuCol] = useState<string | null>(null)

  return (
    <thead>
      <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase select-none">
        {columns.map((col) => {
          const width = colWidths[col.key] || col.initialWidth || 130
          const isSorted = sortKey === col.key
          const isMenuOpen = openMenuCol === col.key
          const sortable = col.sortable !== false

          return (
            <th
              key={col.key}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              className="relative px-3.5 py-3 group border-r border-black/5 last:border-r-0"
            >
              <div
                className={`flex items-center justify-between gap-1.5 ${
                  col.align === "right"
                    ? "flex-row-reverse text-right"
                    : col.align === "center"
                    ? "justify-center"
                    : ""
                }`}
              >
                <span className="truncate">{col.label}</span>

                {sortable && (
                  <div className="relative flex items-center shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuCol(isMenuOpen ? null : col.key)
                      }}
                      className={`p-1 rounded hover:bg-black/10 transition-colors flex items-center gap-0.5 ${
                        isSorted
                          ? "text-emerald-700 font-bold bg-emerald-100"
                          : "text-zinc-400 opacity-0 group-hover:opacity-100"
                      }`}
                      title="Sort Options"
                    >
                      {isSorted ? (
                        sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ChevronDown className="size-3" />
                      )}
                    </button>

                    {/* Popover Menu */}
                    {isMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20 cursor-default"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuCol(null)
                          }}
                        />
                        <div
                          className={`absolute top-full mt-1 z-30 bg-white border border-zinc-200 shadow-xl rounded-xl p-1.5 min-w-[150px] text-xs font-semibold normal-case tracking-normal ${
                            col.align === "right" ? "right-0 text-left" : "left-0 text-left"
                          }`}
                        >
                          <div className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-400 border-b border-zinc-100 mb-1">
                            Sort {col.label}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onSort(col.key, "asc")
                              setOpenMenuCol(null)
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                              isSorted && sortDir === "asc"
                                ? "bg-emerald-50 text-emerald-800 font-bold"
                                : "text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <ArrowUp className="size-3 text-emerald-600" />
                            Sort Ascending
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onSort(col.key, "desc")
                              setOpenMenuCol(null)
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                              isSorted && sortDir === "desc"
                                ? "bg-emerald-50 text-emerald-800 font-bold"
                                : "text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <ArrowDown className="size-3 text-emerald-600" />
                            Sort Descending
                          </button>
                          {isSorted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onClearSort()
                                setOpenMenuCol(null)
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors border-t border-zinc-100 mt-1 pt-1.5"
                            >
                              <RotateCcw className="size-3" />
                              Clear Sort
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Resize Handle */}
              <div
                onMouseDown={(e) => onResizeStart(e, col.key)}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/60 active:bg-emerald-600 z-10 transition-colors"
                title="Drag to resize column"
              />
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

export function useTableSort(initialKey: string | null = null, initialDir: "asc" | "desc" = "asc") {
  const [sortKey, setSortKey] = useState<string | null>(initialKey)
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir)

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key)
    setSortDir(dir)
  }

  const handleClearSort = () => {
    setSortKey(null)
  }

  const sortItems = <U,>(items: U[], getSortValue?: (item: U, key: string) => any): U[] => {
    if (!sortKey) return items
    return [...items].sort((a, b) => {
      let valA = getSortValue ? getSortValue(a, sortKey) : (a as any)[sortKey]
      let valB = getSortValue ? getSortValue(b, sortKey) : (b as any)[sortKey]

      if (valA === undefined || valA === null) valA = ""
      if (valB === undefined || valB === null) valB = ""

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()

      if (strA < strB) return sortDir === "asc" ? -1 : 1
      if (strA > strB) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }

  return { sortKey, sortDir, handleSort, handleClearSort, sortItems }
}

export function useColumnWidths(initialWidths: Record<string, number>) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(initialWidths)

  const handleResizeStart = (e: MouseEvent<HTMLDivElement>, colKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = colWidths[colKey] || 120

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(50, startWidth + deltaX)
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }))
    }

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  return { colWidths, handleResizeStart }
}
