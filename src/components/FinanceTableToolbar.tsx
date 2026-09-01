import { useState, useEffect, type ReactNode } from "react"
import { Search, Plus, Calendar, ChevronDown, Check, X } from "lucide-react"
import { FINANCE_DATE_FILTER_OPTIONS } from "@/lib/peachtreeExportUtils"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface FinanceTableFilterOption {
  value: string
  label: string
}

export interface FinanceTableFilter {
  value: string
  onChange: (value: string) => void
  options: FinanceTableFilterOption[]
  ariaLabel?: string
}

export interface FinanceTableAction {
  label: string
  onClick: () => void
  icon?: ReactNode
  variant?: "primary" | "secondary" | "emerald" | "emeraldLight"
}

export interface FinanceDateFilterConfig {
  value: string
  onChange: (value: string) => void
  startDate?: string
  endDate?: string
  onCustomDateChange?: (start: string, end: string) => void
  align?: "left" | "right"
  className?: string
}

export type FilterOption = FinanceTableFilter
export type HeaderAction = FinanceTableAction

export const financeTableSelectClass =
  "bg-black/[0.03] text-xs font-bold px-3 py-2 rounded-xl text-gray-700 outline-none border border-transparent hover:border-black/5 cursor-pointer h-[38px] max-w-[155px] truncate"

export const financeTableActionClass = {
  primary:
    "flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-zinc-800 shadow-lg shadow-black/10 transition-all h-[38px] uppercase tracking-wider shrink-0 cursor-pointer",
  secondary:
    "flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.03] text-xs font-bold text-gray-700 hover:bg-black/[0.06] border border-transparent hover:border-black/5 transition-all h-[38px] shrink-0 cursor-pointer",
  emerald:
    "flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 shadow-lg shadow-emerald-900/10 transition-all h-[38px] uppercase tracking-wider shrink-0 cursor-pointer",
  emeraldLight:
    "flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-black shadow-md shadow-emerald-900/15 transition-all h-[38px] shrink-0 cursor-pointer active:scale-95",
} as const

export function FinanceDateFilter({
  value,
  onChange,
  startDate = "",
  endDate = "",
  onCustomDateChange,
  align = "right",
  className = "",
}: FinanceDateFilterConfig) {
  const [isOpen, setIsOpen] = useState(false)
  const [localStart, setLocalStart] = useState(startDate)
  const [localEnd, setLocalEnd] = useState(endDate)

  useEffect(() => {
    setLocalStart(startDate)
    setLocalEnd(endDate)
  }, [startDate, endDate])

  const activeOption = FINANCE_DATE_FILTER_OPTIONS.find((o) => o.value === value)

  const getLabel = () => {
    if (value === "CUSTOM") {
      if (startDate && endDate) return `${startDate} → ${endDate}`
      if (startDate) return `From ${startDate}`
      if (endDate) return `Until ${endDate}`
      return "Custom Range"
    }
    return activeOption?.label || "All Time"
  }

  const handleSelectPreset = (preset: string) => {
    onChange(preset)
    if (preset !== "CUSTOM") {
      setIsOpen(false)
    }
  }

  const handleApplyCustom = () => {
    onChange("CUSTOM")
    if (onCustomDateChange) {
      onCustomDateChange(localStart, localEnd)
    }
    setIsOpen(false)
  }

  const handleClearCustom = () => {
    setLocalStart("")
    setLocalEnd("")
    if (onCustomDateChange) {
      onCustomDateChange("", "")
    }
    onChange("ALL")
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 bg-black/[0.03] hover:bg-black/[0.06] text-xs font-bold px-3 py-2 rounded-xl text-gray-700 border border-transparent hover:border-black/5 transition-all h-[38px] cursor-pointer whitespace-nowrap",
            className
          )}
        >
          <Calendar className="size-3.5 text-zinc-500 shrink-0" />
          <span className="truncate max-w-[130px]" title={getLabel()}>{getLabel()}</span>
          <ChevronDown
            className={cn(
              "size-3.5 text-zinc-400 shrink-0 transition-transform duration-150",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align === "left" ? "start" : "end"}
        sideOffset={6}
        className="w-72 bg-white rounded-2xl shadow-2xl border border-zinc-200/90 p-3.5 z-50 text-zinc-900"
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Date Filter Range</span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded-md hover:bg-zinc-100 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-2 gap-1 mb-2">
          {FINANCE_DATE_FILTER_OPTIONS.map((opt) => {
            const isSelected = value === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectPreset(opt.value)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="size-3 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Custom Date Form Section */}
        {value === "CUSTOM" && (
          <div className="pt-2.5 border-t border-zinc-100 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[9px] font-black text-zinc-400 uppercase mb-0.5">From</label>
                <input
                  type="date"
                  value={localStart}
                  onChange={(e) => setLocalStart(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-zinc-900 outline-none focus:border-zinc-500 focus:bg-white transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] font-black text-zinc-400 uppercase mb-0.5">To</label>
                <input
                  type="date"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-zinc-900 outline-none focus:border-zinc-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleClearCustom}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-all cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-zinc-900 hover:bg-black transition-all shadow-xs cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface FinanceTableToolbarProps {
  title: string
  subtitle?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FinanceTableFilter[]
  dateFilter?: FinanceDateFilterConfig
  actions?: FinanceTableAction[]
  /** Extra controls rendered inline with search/filters (e.g. date inputs) */
  children?: ReactNode
  /** Full-width row below the main toolbar (e.g. category pill filters) */
  secondary?: ReactNode
  className?: string
}

export function FinanceTableToolbar({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  dateFilter,
  actions = [],
  children,
  secondary,
  className = "",
}: FinanceTableToolbarProps) {
  const showControls =
    onSearchChange !== undefined || filters.length > 0 || dateFilter !== undefined || actions.length > 0 || children

  return (
    <div className={className}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between ${secondary ? "mb-3 sm:mb-4" : "mb-4 sm:mb-5"} gap-3 sm:gap-4`}>
        <div>
          <h3 className="font-bold text-sm sm:text-base text-black">{title}</h3>
          {subtitle && <p className="text-[11px] sm:text-xs text-gray-400">{subtitle}</p>}
        </div>

        {showControls && (
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
            {onSearchChange !== undefined && (
              <div className="flex items-center gap-2 bg-black/[0.04] rounded-2xl px-3 h-[38px] sm:h-[40px] flex-1 min-w-[140px] sm:w-48 sm:flex-none">
                <Search className="size-4 text-gray-400 shrink-0" />
                <input
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-black placeholder:text-gray-400 outline-none w-full"
                  placeholder={searchPlaceholder}
                />
              </div>
            )}

            {dateFilter && <FinanceDateFilter {...dateFilter} />}

            {filters.map((filter, index) => (
              <select
                key={`${filter.ariaLabel ?? "filter"}-${index}`}
                aria-label={filter.ariaLabel}
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className={financeTableSelectClass}
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}

            {children}

            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={financeTableActionClass[action.variant ?? "primary"]}
              >
                {action.icon ?? <Plus className="size-4" />}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {secondary && <div className="mb-4 sm:mb-5">{secondary}</div>}
    </div>
  )
}

