/**
 * ResizableTable.tsx
 * Shared hook + component for resizable, sortable table columns.
 * Usage:
 *   const { colWidths, sortKey, sortDir, openMenuCol, handleResizeStart, toggleMenu, setSortAsc, setSortDesc, clearSort, sorted } = useResizableTable(columns, rows, defaultWidths)
 *   Then render <ResizableTh> inside your <thead><tr> and use sorted() on rows for the tbody.
 */

import { useState, useCallback } from "react"
import { ChevronDown, ArrowUp, ArrowDown, RotateCcw } from "lucide-react"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TableColumn {
  key: string
  label: string
  align?: "left" | "right" | "center"
  noSort?: boolean
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useResizableTable<T>(
  columns: TableColumn[],
  rows: T[],
  defaultWidths?: Record<string, number>
) {
  // Column widths
  const initWidths: Record<string, number> = {}
  columns.forEach((c) => {
    initWidths[c.key] = defaultWidths?.[c.key] ?? 140
  })
  const [colWidths, setColWidths] = useState<Record<string, number>>(initWidths)

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Open popover key
  const [openMenuCol, setOpenMenuCol] = useState<string | null>(null)

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = colWidths[colKey] ?? 140
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      setColWidths((prev) => ({ ...prev, [colKey]: Math.max(60, startWidth + delta) }))
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [colWidths])

  const toggleMenu = useCallback((key: string) => {
    setOpenMenuCol((prev) => (prev === key ? null : key))
  }, [])

  const setSortAsc = useCallback((key: string) => {
    setSortKey(key)
    setSortDir("asc")
    setOpenMenuCol(null)
  }, [])

  const setSortDesc = useCallback((key: string) => {
    setSortKey(key)
    setSortDir("desc")
    setOpenMenuCol(null)
  }, [])

  const clearSort = useCallback(() => {
    setSortKey(null)
    setOpenMenuCol(null)
  }, [])

  // Sorted rows
  const sorted = useCallback((): T[] => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey]
      const bVal = (b as Record<string, unknown>)[sortKey]
      if (aVal === undefined || bVal === undefined) return 0
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (aStr < bStr) return sortDir === "asc" ? -1 : 1
      if (aStr > bStr) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [rows, sortKey, sortDir])

  return {
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
  }
}

// ─────────────────────────────────────────────
// ResizableTh component
// ─────────────────────────────────────────────

interface ResizableThProps {
  col: TableColumn
  width: number
  sortKey: string | null
  sortDir: "asc" | "desc"
  openMenuCol: string | null
  onResizeStart: (e: React.MouseEvent, key: string) => void
  onToggleMenu: (key: string) => void
  onSortAsc: (key: string) => void
  onSortDesc: (key: string) => void
  onClearSort: () => void
}

export function ResizableTh({
  col,
  width,
  sortKey,
  sortDir,
  openMenuCol,
  onResizeStart,
  onToggleMenu,
  onSortAsc,
  onSortDesc,
  onClearSort,
}: ResizableThProps) {
  const isSorted = sortKey === col.key
  const isMenuOpen = openMenuCol === col.key

  return (
    <th
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
      className={`relative px-3 py-3 group border-r border-zinc-200/50 last:border-r-0 select-none ${
        isMenuOpen ? "overflow-visible z-30" : "overflow-hidden"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 w-full ${
          col.align === "right"
            ? "justify-end text-right"
            : col.align === "center"
            ? "justify-center text-center"
            : "justify-start text-left"
        }`}
      >
        <span className="truncate">{col.label}</span>

        {/* Sort button — hidden until hover, always visible if sorted */}
        {!col.noSort && (
          <div className="relative flex items-center shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleMenu(col.key)
              }}
              className={`p-1 rounded hover:bg-zinc-200/80 transition-colors flex items-center gap-0.5 ${
                isSorted
                  ? "text-emerald-700 font-bold bg-emerald-100/80"
                  : "text-zinc-400 opacity-0 group-hover:opacity-100"
              }`}
              title="Sort options"
            >
              {isSorted ? (
                sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>

            {/* Dropdown popover */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={(e) => { e.stopPropagation(); onToggleMenu(col.key) }}
                />
                <div
                  className={`absolute top-full mt-1.5 z-30 bg-white border border-zinc-200 shadow-xl rounded-xl p-1.5 min-w-[150px] text-xs font-semibold normal-case tracking-normal ${
                    col.align === "right" ? "right-0 text-left" : "left-0 text-left"
                  }`}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-400 border-b border-zinc-100 mb-1">
                    Sort: {col.label}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSortAsc(col.key) }}
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
                    onClick={(e) => { e.stopPropagation(); onSortDesc(col.key) }}
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
                      onClick={(e) => { e.stopPropagation(); onClearSort() }}
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

      {/* Resize handle */}
      <div
        onMouseDown={(e) => onResizeStart(e, col.key)}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/60 active:bg-emerald-600 z-10 transition-colors"
        title="Drag to resize column"
      />
    </th>
  )
}
