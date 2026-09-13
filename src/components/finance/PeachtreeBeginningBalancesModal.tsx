import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import {
  X,
  Scale,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Search,
  RotateCcw,
} from "lucide-react"
import { useFinanceStore, type AccountItem } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import {
  downloadPeachtreeBeginningBalanceTemplate,
  parsePeachtreeBeginningBalanceCsv,
} from "@/lib/peachtreeExportUtils"
import { LoadingDots } from "@/components/ui/LoadingDots"

interface PeachtreeBeginningBalancesModalProps {
  isOpen: boolean
  onClose: () => void
}

type CategoryTab = "ALL" | "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"

export const PeachtreeBeginningBalancesModal: React.FC<PeachtreeBeginningBalancesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast, confirm } = useFeedback()
  const store = useFinanceStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Memoize accounts so array references remain stable across internal keystrokes
  const accounts = useMemo(() => store.getAccounts(), [store, isOpen])

  // Non-group active accounts
  const postableAccounts = useMemo(() => {
    return accounts.filter((a) => !a.is_group && a.is_active !== false)
  }, [accounts])

  // Cutover Date State
  const [asOfDate, setAsOfDate] = useState<string>(`${new Date().getFullYear()}-01-01`)
  const [notes, setNotes] = useState<string>("Maintain COA Balances")
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Active Tab & Search
  const [activeTab, setActiveTab] = useState<CategoryTab>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Form Balances State: Map of account_id -> { debit: string; credit: string }
  const [balanceMap, setBalanceMap] = useState<Record<string, { debit: string; credit: string }>>({})

  // Helper to compute actual current balances from General Ledger entries
  const populateFromActualLedger = useCallback(() => {
    const lines = store.getJournalEntryLines()
    const ledgerMap: Record<string, { debit: string; credit: string }> = {}
    let count = 0

    for (const acc of postableAccounts) {
      const accLines = lines.filter(
        (l) => l.account_id === acc.id || l.account_id === acc.code || l.account_id === `ACC-${acc.code}`
      )
      const debitSum = accLines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0)
      const creditSum = accLines.reduce((s, l) => s + (Number(l.credit_amount) || 0), 0)
      const net = Math.round((debitSum - creditSum) * 100) / 100

      if (net > 0) {
        ledgerMap[acc.id] = { debit: net.toFixed(2), credit: "" }
        count++
      } else if (net < 0) {
        ledgerMap[acc.id] = { debit: "", credit: Math.abs(net).toFixed(2) }
        count++
      } else {
        ledgerMap[acc.id] = { debit: "", credit: "" }
      }
    }

    setBalanceMap(ledgerMap)
    return count
  }, [store, postableAccounts])

  // Initialize balances strictly once when modal opens
  useEffect(() => {
    if (!isOpen) return

    const current = store.getBeginningBalances()
    if (current.asOfDate) {
      setAsOfDate(current.asOfDate)
    }
    if (current.notes) {
      setNotes(current.notes)
    }

    const hasOpeningValues = Boolean(
      current.entry &&
      Object.values(current.balances).some((b) => (b.debit || 0) > 0 || (b.credit || 0) > 0)
    )

    if (hasOpeningValues) {
      const initialMap: Record<string, { debit: string; credit: string }> = {}
      for (const acc of accounts) {
        if (acc.is_group) continue
        const existing = current.balances[acc.id] || current.balances[acc.code]
        initialMap[acc.id] = {
          debit: existing && existing.debit > 0 ? String(existing.debit) : "",
          credit: existing && existing.credit > 0 ? String(existing.credit) : "",
        }
      }
      setBalanceMap(initialMap)
    } else {
      // Automatically load actual net balances from current ledger journal lines!
      populateFromActualLedger()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Filtered accounts for display
  const displayedAccounts = useMemo(() => {
    let filtered = postableAccounts

    if (activeTab !== "ALL") {
      filtered = filtered.filter((a) => a.account_type === activeTab)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.peachtree_type && a.peachtree_type.toLowerCase().includes(q))
      )
    }

    return [...filtered].sort((a, b) => a.code.localeCompare(b.code))
  }, [postableAccounts, activeTab, searchQuery])

  // Real-time Sum Calculations
  const { totalDebit, totalCredit, diff, isBalanced, nonZeroCount } = useMemo(() => {
    let dr = 0
    let cr = 0
    let count = 0

    for (const acc of postableAccounts) {
      const row = balanceMap[acc.id]
      if (!row) continue
      const d = parseFloat(row.debit) || 0
      const c = parseFloat(row.credit) || 0
      if (d > 0 || c > 0) count++
      dr += d
      cr += c
    }

    dr = Math.round(dr * 100) / 100
    cr = Math.round(cr * 100) / 100
    const difference = Math.round(Math.abs(dr - cr) * 100) / 100
    const balanced = difference <= 0.01 && count >= 2

    return {
      totalDebit: dr,
      totalCredit: cr,
      diff: difference,
      isBalanced: balanced,
      nonZeroCount: count,
    }
  }, [postableAccounts, balanceMap])

  // Handlers for inputs
  const handleDebitChange = (accId: string, val: string) => {
    const clean = val.replace(/[^0-9.]/g, "")
    const parts = clean.split(".")
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean

    setBalanceMap((prev) => ({
      ...prev,
      [accId]: {
        debit: sanitized,
        credit: sanitized && parseFloat(sanitized) > 0 ? "" : (prev[accId]?.credit || ""),
      },
    }))
  }

  const handleCreditChange = (accId: string, val: string) => {
    const clean = val.replace(/[^0-9.]/g, "")
    const parts = clean.split(".")
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean

    setBalanceMap((prev) => ({
      ...prev,
      [accId]: {
        debit: sanitized && parseFloat(sanitized) > 0 ? "" : (prev[accId]?.debit || ""),
        credit: sanitized,
      },
    }))
  }

  // Row Clear with Confirmation
  const handleClearRow = (acc: AccountItem) => {
    confirm({
      title: "Clear Account Balance?",
      message: `Are you sure you want to clear the balance for account "${acc.code} - ${acc.name}"?`,
      confirmLabel: "Clear Balance",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        setBalanceMap((prev) => ({
          ...prev,
          [acc.id]: { debit: "", credit: "" },
        }))
        showToast("Balance Cleared", "info", `Cleared balance for ${acc.code}.`)
      },
    })
  }

  // Reset All with Confirmation
  const handleClearAll = () => {
    confirm({
      title: "Reset All Account Balances?",
      message: "Are you sure you want to reset all account balances to zero? All entered debit and credit values across all accounts will be cleared.",
      confirmLabel: "Reset All",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        const resetMap: Record<string, { debit: string; credit: string }> = {}
        for (const acc of postableAccounts) {
          resetMap[acc.id] = { debit: "", credit: "" }
        }
        setBalanceMap(resetMap)
        showToast("All Balances Reset", "info", "All account balances have been cleared.")
      },
    })
  }

  // CSV Import Handler
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      try {
        const result = parsePeachtreeBeginningBalanceCsv(text, accounts)
        if (result.errors.length > 0 && result.balances.length === 0) {
          showToast("Import Failed", "warning", result.errors[0])
          return
        }

        const newMap: Record<string, { debit: string; credit: string }> = { ...balanceMap }
        for (const row of result.balances) {
          newMap[row.account_id] = {
            debit: row.debit_amount > 0 ? row.debit_amount.toFixed(2) : "",
            credit: row.credit_amount > 0 ? row.credit_amount.toFixed(2) : "",
          }
        }
        setBalanceMap(newMap)

        if (result.errors.length > 0) {
          showToast(
            "Imported with Warnings",
            "info",
            `Imported ${result.balances.length} account balances (${result.errors.length} notice).`
          )
        } else {
          showToast(
            "Peachtree Import Complete",
            "success",
            `Successfully imported ${result.balances.length} beginning balances.`
          )
        }
      } catch (err: any) {
        showToast("Parse Error", "warning", err.message || "Failed to parse CSV file.")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  // Re-sync / Load Current Ledger Handler
  const handleLoadCurrentLedger = () => {
    const count = populateFromActualLedger()
    showToast(
      "Ledger Balances Loaded",
      "info",
      `Populated ${count} active account balances from current General Ledger postings.`
    )
  }

  // Template Download Handler
  const handleDownloadTemplate = () => {
    const currentNumeric: Record<string, { debit: number; credit: number }> = {}
    for (const [id, row] of Object.entries(balanceMap)) {
      currentNumeric[id] = {
        debit: parseFloat(row.debit) || 0,
        credit: parseFloat(row.credit) || 0,
      }
    }
    downloadPeachtreeBeginningBalanceTemplate(accounts, currentNumeric)
    showToast("Template Downloaded", "success", "Peachtree COA template downloaded.")
  }

  // Submit Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return

    if (!asOfDate) {
      showToast("Date Required", "warning", "Please specify a cutover date for COA balances.")
      return
    }

    if (nonZeroCount < 2) {
      showToast("Incomplete Balances", "warning", "Please enter at least two non-zero account balances.")
      return
    }

    if (!isBalanced) {
      showToast(
        "Out of Balance",
        "warning",
        `Total Debits (ETB ${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}) must equal Total Credits (ETB ${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}). Difference: ETB ${diff.toFixed(2)}.`
      )
      return
    }

    setIsSaving(true)
    try {
      const payloadBalances = postableAccounts
        .map((acc) => {
          const row = balanceMap[acc.id]
          const debit = parseFloat(row?.debit || "0") || 0
          const credit = parseFloat(row?.credit || "0") || 0
          return {
            account_id: acc.id,
            debit_amount: debit,
            credit_amount: credit,
          }
        })
        .filter((b) => b.debit_amount > 0 || b.credit_amount > 0)

      const result = store.saveBeginningBalances({
        asOfDate,
        balances: payloadBalances,
        notes: notes.trim(),
        created_by: "Finance Team",
      })

      if (!result.success) {
        showToast("Save Error", "warning", result.error || "Failed to save COA balances.")
        return
      }

      showToast(
        "COA Balances Posted",
        "success",
        `Posted opening trial balance across ${payloadBalances.length} accounts as of ${asOfDate}.`
      )
      onClose()
    } catch (err: any) {
      showToast("Error", "warning", err.message || "Failed to post COA balances.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-6xl max-h-[92vh] bg-white dark:bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col"
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <Scale className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white">
                Maintain Chart of Accounts (COA)
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Enter or import ledger account balances and historical trial balance values.
              </p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadCurrentLedger}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Load current net balances calculated from General Ledger entries"
            >
              <RotateCcw className="size-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Load Current Ledger</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Download CSV template for offline entry"
            >
              <Download className="size-3.5 text-zinc-500" />
              <span className="hidden sm:inline">CSV Template</span>
            </button>

            <label className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
              <Upload className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Import Peachtree CSV</span>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvFileUpload}
              />
            </label>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer ml-1"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Configuration Bar: Cutover Date & Filter Tabs */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            {/* Cutover Date Picker */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                Cutover Date:
              </span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search account code or name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="px-4 py-2 bg-zinc-100/60 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {(
            [
              { id: "ALL", label: `All Accounts (${postableAccounts.length})` },
              { id: "Asset", label: "Assets (1000s)" },
              { id: "Liability", label: "Liabilities (2000s)" },
              { id: "Equity", label: "Equity (3000s)" },
              { id: "Revenue", label: "Revenue (4000s)" },
              { id: "Expense", label: "Expenses (6000-8000s)" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}

          {nonZeroCount > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="ml-auto text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline px-2 py-0.5 cursor-pointer shrink-0"
            >
              Reset All
            </button>
          )}
        </div>

        {/* Main Accounts Matrix Table */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 bg-zinc-50/40 dark:bg-zinc-950">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                <th className="py-2.5 px-3 w-28">Account Code</th>
                <th className="py-2.5 px-3 min-w-[200px]">Account Name</th>
                <th className="py-2.5 px-3 w-32 hidden md:table-cell">Peachtree Type</th>
                <th className="py-2.5 px-3 w-20 text-center">Normal</th>
                <th className="py-2.5 px-3 w-40 text-right">Debit Balance (ETB)</th>
                <th className="py-2.5 px-3 w-40 text-right">Credit Balance (ETB)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {displayedAccounts.map((acc) => {
                const row = balanceMap[acc.id] || { debit: "", credit: "" }
                const isDebitNormal = acc.account_type === "Asset" || acc.account_type === "Expense"
                const hasValue = Boolean(row.debit || row.credit)

                return (
                  <tr
                    key={acc.id}
                    className={`hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 transition-colors ${
                      hasValue ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                    }`}
                  >
                    {/* Account Code */}
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                      {acc.code}
                    </td>

                    {/* Account Name */}
                    <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {acc.name}
                    </td>

                    {/* Peachtree Type */}
                    <td className="py-2.5 px-3 text-[11px] font-semibold text-zinc-500 hidden md:table-cell">
                      {acc.peachtree_type || acc.account_type}
                    </td>

                    {/* Normal Balance Pill */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          isDebitNormal
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                        }`}
                      >
                        {isDebitNormal ? "Dr" : "Cr"}
                      </span>
                    </td>

                    {/* Debit Input */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="text"
                        value={row.debit}
                        placeholder="0.00"
                        onChange={(e) => handleDebitChange(acc.id, e.target.value)}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none transition-colors ${
                          row.debit && parseFloat(row.debit) > 0
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:border-zinc-400"
                        }`}
                      />
                    </td>

                    {/* Credit Input */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="text"
                        value={row.credit}
                        placeholder="0.00"
                        onChange={(e) => handleCreditChange(acc.id, e.target.value)}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none transition-colors ${
                          row.credit && parseFloat(row.credit) > 0
                            ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-100"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:border-zinc-400"
                        }`}
                      />
                    </td>

                    {/* Clear Row Button */}
                    <td className="py-2 px-2 text-center">
                      {hasValue && (
                        <button
                          type="button"
                          onClick={() => handleClearRow(acc)}
                          className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Clear line balance"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}

              {displayedAccounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 font-semibold text-xs">
                    No accounts match the current filter or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Live Trial Balance Summary Bar */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-white shrink-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Totals Section */}
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Total Debits
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                  ETB {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Total Credits
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-purple-400">
                  ETB {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Status Indicator */}
              <div className="pl-2 border-l border-zinc-700">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Trial Balance Status
                </span>
                {isBalanced ? (
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                    <CheckCircle2 className="size-4" />
                    <span>In Perfect Balance (0.00)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                    <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                    <span>Out of Balance: ETB {diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isBalanced || nonZeroCount < 2}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black inline-flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer active:scale-95"
              >
                {isSaving ? (
                  <>
                    <LoadingDots color="bg-white" size="sm" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>Save COA Balances</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default PeachtreeBeginningBalancesModal
