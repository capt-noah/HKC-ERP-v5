import React, { useState, useRef, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { Search, ChevronDown, Check, X } from "lucide-react"
import { useFinanceStore, type AccountItem } from "@/lib/financeStore"
import { COMPANY_CHART_OF_ACCOUNTS } from "@/lib/companyCOA"

export interface COAAccountSelectorProps {
  value: string // account code or id
  onChange: (account: AccountItem) => void
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  suggestedCodes?: string[] // Backwards compatibility, unused to keep UI clean
  helperText?: string
  compact?: boolean
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Asset: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Liability: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  Equity: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  Revenue: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Expense: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
}

export const COAAccountSelector: React.FC<COAAccountSelectorProps> = ({
  value,
  onChange,
  label,
  placeholder = "Select COA account...",
  required = false,
  disabled = false,
  className = "",
  helperText,
  compact = false,
}) => {
  const financeStore = useFinanceStore()
  const rawAccounts = financeStore.getAccounts()

  // Ensure accounts are loaded into financeStore
  useEffect(() => {
    if (rawAccounts.length === 0) {
      void financeStore.loadFromApi()
    }
  }, [rawAccounts.length, financeStore])

  const accounts = useMemo(() => {
    if (rawAccounts && rawAccounts.length > 0) return rawAccounts
    return COMPANY_CHART_OF_ACCOUNTS
  }, [rawAccounts])

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL")
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    placeAbove: false,
  })

  // Selected account lookup
  const selectedAccount = useMemo(() => {
    if (!value) return null
    const clean = String(value).trim()
    const unPrefixed = clean.replace(/^ACC-/, "")
    return (
      accounts.find(
        (a) =>
          a.code === clean ||
          a.id === clean ||
          a.code === unPrefixed ||
          a.id === `ACC-${clean}` ||
          a.id === unPrefixed ||
          a.name.toLowerCase() === clean.toLowerCase()
      ) ||
      COMPANY_CHART_OF_ACCOUNTS.find(
        (a) =>
          a.code === clean ||
          a.id === clean ||
          a.code === unPrefixed ||
          a.id === `ACC-${clean}` ||
          a.id === unPrefixed ||
          a.name.toLowerCase() === clean.toLowerCase()
      ) ||
      null
    )
  }, [value, accounts])

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    return accounts.filter((acc) => {
      if (selectedTypeFilter !== "ALL" && acc.account_type !== selectedTypeFilter) {
        return false
      }
      if (!q) return true
      const matchCode = acc.code.toLowerCase().includes(q)
      const matchName = acc.name.toLowerCase().includes(q)
      const matchType = acc.account_type.toLowerCase().includes(q)
      const matchPeachtree = (acc.peachtree_type || "").toLowerCase().includes(q)
      return matchCode || matchName || matchType || matchPeachtree
    })
  }, [accounts, searchTerm, selectedTypeFilter])

  // Measure and position the dropdown in viewport coordinates
  const updatePosition = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 310
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight

    setCoords({
      top: placeAbove ? rect.top : rect.bottom,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 340) - 8)),
      width: Math.max(rect.width, 340),
      placeAbove,
    })
  }

  // Update position on open & resize/scroll
  useEffect(() => {
    if (!isOpen) return
    updatePosition()

    const handleScrollOrResize = () => {
      updatePosition()
    }

    window.addEventListener("scroll", handleScrollOrResize, true)
    window.addEventListener("resize", handleScrollOrResize)
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true)
      window.removeEventListener("resize", handleScrollOrResize)
    }
  }, [isOpen])

  // Click outside listener (checks both trigger and portal menu)
  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [isOpen])

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm("")
      setSelectedTypeFilter("ALL")
    }
  }, [isOpen])

  const handleSelect = (account: AccountItem) => {
    onChange(account)
    setIsOpen(false)
  }

  const accountTypeStyle = selectedAccount
    ? TYPE_STYLES[selectedAccount.account_type] || TYPE_STYLES.Asset
    : null

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-zinc-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {helperText && <span className="text-[10px] font-medium text-zinc-400">{helperText}</span>}
        </div>
      )}

      {/* Main Trigger Input Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (!isOpen) updatePosition()
          setIsOpen((prev) => !prev)
        }}
        className={`w-full text-left px-3 ${compact ? "py-1.5 min-h-[34px]" : "py-2 min-h-[38px]"} rounded-xl bg-white border transition-all flex items-center justify-between gap-2 cursor-pointer ${
          isOpen
            ? "border-emerald-600 ring-2 ring-emerald-500/15 shadow-sm"
            : "border-zinc-200 hover:border-zinc-300 shadow-2xs"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-zinc-50" : ""}`}
      >
        {selectedAccount ? (
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            <span className="font-mono font-black text-xs text-zinc-950 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 shrink-0">
              {selectedAccount.code}
            </span>
            <span className="text-xs font-bold text-zinc-800 truncate">
              {selectedAccount.name}
            </span>
            {accountTypeStyle && (
              <span
                className={`ml-auto text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${accountTypeStyle.bg} ${accountTypeStyle.text} ${accountTypeStyle.border}`}
              >
                {selectedAccount.account_type}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs font-medium text-zinc-400 truncate">
            {value ? `${value} (Unmapped Account)` : placeholder}
          </span>
        )}

        <ChevronDown
          className={`size-4 text-zinc-400 shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-emerald-600" : ""
          }`}
        />
      </button>

      {/* Portal-based Dropdown Menu: completely immune to parent overflow clipping */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: coords.placeAbove ? undefined : `${coords.top + 4}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top + 4}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 999999,
            }}
            className="bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[300px] animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {/* Search Header */}
            <div className="p-2.5 border-b border-zinc-100 bg-zinc-50/80 space-y-2">
              <div className="relative flex items-center">
                <Search className="size-3.5 text-zinc-400 absolute left-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by code (e.g. 1410), name, or type..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 text-[10px] font-bold">
                {(["ALL", "Asset", "Liability", "Expense", "Revenue", "Equity"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedTypeFilter(type)}
                    className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                      selectedTypeFilter === type
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Accounts List */}
            <div className="overflow-y-auto divide-y divide-zinc-50 flex-1 max-h-[210px]">
              {filteredAccounts.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400">
                  No accounts match &quot;{searchTerm}&quot;
                </div>
              ) : (
                filteredAccounts.map((acc) => {
                  const isSelected = selectedAccount?.code === acc.code || selectedAccount?.id === acc.id
                  const style = TYPE_STYLES[acc.account_type] || TYPE_STYLES.Asset

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleSelect(acc)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-emerald-50/50 transition-colors cursor-pointer ${
                        isSelected ? "bg-emerald-50 font-bold" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono font-black text-xs text-zinc-950 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/70 shrink-0">
                          {acc.code}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-bold text-zinc-800 truncate block">
                            {acc.name}
                          </span>
                          {acc.peachtree_type && (
                            <span className="text-[9px] text-zinc-400 block truncate">
                              {acc.peachtree_type}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}
                        >
                          {acc.account_type}
                        </span>
                        {isSelected && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default COAAccountSelector
