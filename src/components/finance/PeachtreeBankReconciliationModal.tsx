import React, { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Check,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  FileSpreadsheet,
} from "lucide-react"
import { useFinanceStore } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"

interface PeachtreeBankReconciliationModalProps {
  isOpen: boolean
  onClose: () => void
  defaultAccountId?: string
}

interface ReconTxLine {
  id: string
  journalEntryId: string
  accountId: string
  date: string
  reference: string
  sourceType: string
  payee: string
  type: "Deposit" | "Check"
  amount: number
  isCleared: boolean
}

export const PeachtreeBankReconciliationModal: React.FC<PeachtreeBankReconciliationModalProps> = ({
  isOpen,
  onClose,
  defaultAccountId,
}) => {
  const store = useFinanceStore()
  const { showToast, confirm } = useFeedback()

  const [activeTab, setActiveTab] = useState<"worksheet" | "history">("worksheet")
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [statementDate, setStatementDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [statementBalance, setStatementBalance] = useState<string>("0.00")

  // Adjustments
  const [serviceChargeAmount, setServiceChargeAmount] = useState<string>("")
  const [serviceChargeDate, setServiceChargeDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [serviceChargeAccountId, setServiceChargeAccountId] = useState<string>("")

  const [interestIncomeAmount, setInterestIncomeAmount] = useState<string>("")
  const [interestIncomeDate, setInterestIncomeDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [interestIncomeAccountId, setInterestIncomeAccountId] = useState<string>("")

  // Cleared lines selection state (Set of line IDs)
  const [clearedLineIds, setClearedLineIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const accounts = useMemo(() => store.getAccounts(), [store])
  const entries = useMemo(() => store.getJournalEntries(), [store])
  const lines = useMemo(() => store.getJournalEntryLines(), [store])

  // Filter bank and cash accounts
  const bankAccounts = useMemo(() => {
    return accounts.filter(
      (a) =>
        a.account_type === "Asset" &&
        (a.peachtree_type === "Cash" ||
          a.code.startsWith("10") ||
          /cash|bank|cbe|boa|aib|abay|unb|cbo|ahadu|oib/i.test(a.name))
    )
  }, [accounts])

  // Expense accounts for bank fees
  const expenseAccounts = useMemo(() => {
    return accounts.filter((a) => a.account_type === "Expense")
  }, [accounts])

  // Revenue accounts for interest
  const revenueAccounts = useMemo(() => {
    return accounts.filter((a) => a.account_type === "Revenue")
  }, [accounts])

  // Initialize selected account
  useEffect(() => {
    if (!isOpen) return
    if (defaultAccountId && bankAccounts.some((a) => a.id === defaultAccountId)) {
      setSelectedAccountId(defaultAccountId)
    } else if (bankAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(bankAccounts[0].id)
    }

    // Set default expense and revenue accounts
    const defaultBankFee = accounts.find((a) => a.code === "8000-09" || /bank charge|fee/i.test(a.name))
    if (defaultBankFee) setServiceChargeAccountId(defaultBankFee.id)

    const defaultInterest = accounts.find((a) => a.code === "7000-02" || /interest income/i.test(a.name))
    if (defaultInterest) setInterestIncomeAccountId(defaultInterest.id)
  }, [isOpen, defaultAccountId, bankAccounts, accounts, selectedAccountId])

  // Map entries for quick lookup
  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  // Extract candidate statement lines for the selected bank account up to statement date
  const accountLines: ReconTxLine[] = useMemo(() => {
    if (!selectedAccountId) return []

    return lines
      .filter((l) => {
        if (l.account_id !== selectedAccountId) return false
        const entry = entryById.get(l.journal_entry_id)
        if (!entry) return false
        if (statementDate && entry.entry_date > statementDate) return false
        return true
      })
      .map((l) => {
        const entry = entryById.get(l.journal_entry_id)!
        const isDeposit = (l.debit_amount || 0) > 0
        const amount = isDeposit ? l.debit_amount : l.credit_amount
        return {
          id: l.id,
          journalEntryId: entry.id,
          accountId: l.account_id,
          date: entry.entry_date,
          reference: entry.source_id || entry.id.slice(0, 8),
          sourceType: entry.source_type || "General Ledger",
          payee: l.party_name || entry.description,
          type: (isDeposit ? "Deposit" : "Check") as "Deposit" | "Check",
          amount: amount || 0,
          isCleared: Boolean(l.is_cleared),
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [selectedAccountId, lines, entryById, statementDate])

  // Pre-seed cleared lines when account or lines change
  useEffect(() => {
    if (!isOpen) return
    const initialCleared = new Set<string>()
    accountLines.forEach((l) => {
      if (l.isCleared) {
        initialCleared.add(l.id)
      }
    })
    setClearedLineIds(initialCleared)
  }, [selectedAccountId, accountLines, isOpen])

  // Filtered deposits and checks
  const checksList = useMemo(() => {
    return accountLines.filter(
      (l) =>
        l.type === "Check" &&
        (!searchQuery ||
          l.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.amount.toString().includes(searchQuery))
    )
  }, [accountLines, searchQuery])

  const depositsList = useMemo(() => {
    return accountLines.filter(
      (l) =>
        l.type === "Deposit" &&
        (!searchQuery ||
          l.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.amount.toString().includes(searchQuery))
    )
  }, [accountLines, searchQuery])

  // Live Math Calculations (Peachtree Account Reconciliation Engine)
  const stmtBal = parseFloat(statementBalance) || 0
  const svcCharge = parseFloat(serviceChargeAmount) || 0
  const intEarned = parseFloat(interestIncomeAmount) || 0

  // Cleared lines metrics
  const clearedChecks = useMemo(() => {
    return accountLines.filter((l) => l.type === "Check" && clearedLineIds.has(l.id))
  }, [accountLines, clearedLineIds])

  const clearedDeposits = useMemo(() => {
    return accountLines.filter((l) => l.type === "Deposit" && clearedLineIds.has(l.id))
  }, [accountLines, clearedLineIds])

  const unclearedChecks = useMemo(() => {
    return accountLines.filter((l) => l.type === "Check" && !clearedLineIds.has(l.id))
  }, [accountLines, clearedLineIds])

  const unclearedDeposits = useMemo(() => {
    return accountLines.filter((l) => l.type === "Deposit" && !clearedLineIds.has(l.id))
  }, [accountLines, clearedLineIds])

  const totalClearedChecks = useMemo(
    () => clearedChecks.reduce((sum, c) => sum + c.amount, 0),
    [clearedChecks]
  )
  const totalClearedDeposits = useMemo(
    () => clearedDeposits.reduce((sum, d) => sum + d.amount, 0),
    [clearedDeposits]
  )

  const totalOutstandingChecks = useMemo(
    () => unclearedChecks.reduce((sum, c) => sum + c.amount, 0),
    [unclearedChecks]
  )
  const totalDepositsInTransit = useMemo(
    () => unclearedDeposits.reduce((sum, d) => sum + d.amount, 0),
    [unclearedDeposits]
  )

  // GL Book balance as of statement date
  const rawGlBalance = useMemo(() => {
    if (!selectedAccountId) return 0
    return accountLines.reduce((acc, l) => {
      return l.type === "Deposit" ? acc + l.amount : acc - l.amount
    }, 0)
  }, [accountLines, selectedAccountId])

  // Adjusted GL Balance accounting for unposted Service Charges and Interest
  const adjustedGlBalance = rawGlBalance - svcCharge + intEarned

  // Adjusted Bank Balance = Statement Ending Balance - Outstanding Checks + Deposits in Transit
  const adjustedBankBalance = stmtBal - totalOutstandingChecks + totalDepositsInTransit

  // Unreconciled Difference: Adjusted Bank Balance vs Adjusted GL Balance
  const unreconciledDifference = Math.round((adjustedBankBalance - adjustedGlBalance) * 100) / 100
  const isReconciled = Math.abs(unreconciledDifference) < 0.01

  // Toggle single line
  const handleToggleLine = (id: string) => {
    setClearedLineIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Select all checks
  const handleSelectAllChecks = (selectAll: boolean) => {
    setClearedLineIds((prev) => {
      const next = new Set(prev)
      checksList.forEach((c) => {
        if (selectAll) next.add(c.id)
        else next.delete(c.id)
      })
      return next
    })
  }

  // Select all deposits
  const handleSelectAllDeposits = (selectAll: boolean) => {
    setClearedLineIds((prev) => {
      const next = new Set(prev)
      depositsList.forEach((d) => {
        if (selectAll) next.add(d.id)
        else next.delete(d.id)
      })
      return next
    })
  }

  // Commit Reconciliation
  const handleCommitReconciliation = async () => {
    if (!isReconciled) {
      showToast(
        "Cannot Reconcile",
        "warning",
        `Unreconciled Difference must be ETB 0.00 (Current: ETB ${unreconciledDifference.toFixed(2)})`
      )
      return
    }

    const selectedAcc = accounts.find((a) => a.id === selectedAccountId)
    confirm({
      title: "Commit Bank Reconciliation?",
      message: `Are you sure you want to commit reconciliation for ${selectedAcc?.name || "this account"} as of ${statementDate}? This will mark ${clearedLineIds.size} transactions cleared and lock this statement balance.`,
      confirmLabel: "Commit Reconciliation",
      onConfirm: async () => {
        setIsSubmitting(true)
        try {
          const res = store.reconcileBankAccount({
            account_id: selectedAccountId,
            statement_date: statementDate,
            statement_balance: stmtBal,
            cleared_line_ids: Array.from(clearedLineIds),
            gl_balance: adjustedGlBalance,
            cleared_deposits_count: clearedDeposits.length,
            cleared_deposits_total: totalClearedDeposits,
            cleared_checks_count: clearedChecks.length,
            cleared_checks_total: totalClearedChecks,
            cleared_balance: stmtBal,
            unreconciled_difference: 0,
            service_charge: svcCharge > 0 ? { amount: svcCharge, date: serviceChargeDate, account_id: serviceChargeAccountId } : undefined,
            interest_income: intEarned > 0 ? { amount: intEarned, date: interestIncomeDate, account_id: interestIncomeAccountId } : undefined,
          })

          if (res.success) {
            showToast(
              "Reconciliation Completed",
              "success",
              `Bank account ${selectedAcc?.code} - ${selectedAcc?.name} successfully reconciled to ETB 0.00 difference!`
            )
            // Switch to history tab to show the recorded reconciliation
            setActiveTab("history")
          } else {
            showToast("Reconciliation Error", "warning", res.error || "Failed to commit bank reconciliation.")
          }
        } catch (err: any) {
          showToast("Error", "warning", err.message || "Failed to commit bank reconciliation.")
        } finally {
          setIsSubmitting(false)
        }
      },
    })
  }

  // Reconciliation history records
  const reconHistory = useMemo(() => {
    return store.getBankReconciliationHistory(selectedAccountId)
  }, [store, selectedAccountId, activeTab])

  if (!isOpen) return null

  const selectedAcc = accounts.find((a) => a.id === selectedAccountId)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-zinc-900">Account Reconciliation</h2>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Sage 50 / Peachtree Standard
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Two-pane checkoff worksheet with live difference calculation & auto-adjustments.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tab Switcher */}
              <div className="flex items-center p-1 bg-zinc-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("worksheet")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "worksheet"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Worksheet
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === "history"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <History className="size-3.5" /> History ({reconHistory.length})
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Account & Statement Controls Bar */}
          <div className="px-6 py-3.5 bg-zinc-100/60 border-b border-zinc-200/80 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Cash / Bank Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-500"
              >
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} — {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Statement Ending Date
              </label>
              <input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Statement Ending Balance (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-900 outline-none focus:border-emerald-500 text-right"
              />
            </div>

            <div className="flex items-center gap-2 pt-4 md:pt-0">
              <div className="relative flex-1">
                <Search className="size-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Main Body */}
          {activeTab === "worksheet" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Optional Adjustments Bar: Service Charges & Interest */}
              <div className="px-6 py-2.5 bg-amber-50/40 border-b border-amber-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Service Charge */}
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[11px] text-zinc-700">Bank Service Charge:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={serviceChargeAmount}
                      onChange={(e) => setServiceChargeAmount(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg bg-white border border-zinc-200 font-mono font-bold text-right outline-none"
                    />
                    <input
                      type="date"
                      value={serviceChargeDate}
                      onChange={(e) => setServiceChargeDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 font-semibold outline-none text-[11px]"
                    />
                    <select
                      value={serviceChargeAccountId}
                      onChange={(e) => setServiceChargeAccountId(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 font-medium text-[11px] max-w-[140px] truncate"
                    >
                      {expenseAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="h-4 w-px bg-zinc-300 hidden md:block" />

                  {/* Interest Income */}
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[11px] text-zinc-700">Interest Earned:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={interestIncomeAmount}
                      onChange={(e) => setInterestIncomeAmount(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg bg-white border border-zinc-200 font-mono font-bold text-right outline-none"
                    />
                    <input
                      type="date"
                      value={interestIncomeDate}
                      onChange={(e) => setInterestIncomeDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 font-semibold outline-none text-[11px]"
                    />
                    <select
                      value={interestIncomeAccountId}
                      onChange={(e) => setInterestIncomeAccountId(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 font-medium text-[11px] max-w-[140px] truncate"
                    >
                      {revenueAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <span className="text-[10px] text-zinc-400 font-medium italic">
                  Charges and interest auto-post to GL upon commit.
                </span>
              </div>

              {/* Two-Pane Worksheet */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 overflow-hidden">
                {/* Left Pane: Checks and Payments (Debits/Disbursements) */}
                <div className="flex flex-col overflow-hidden">
                  <div className="p-3 bg-red-50/50 border-b border-zinc-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-red-900">
                        <ArrowUpRight className="size-3.5 text-red-600" />
                        Checks and Payments ({checksList.length})
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        Cleared: {clearedChecks.length} of {checksList.length} (ETB{" "}
                        {totalClearedChecks.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectAllChecks(true)}
                        className="px-2 py-1 text-[10px] font-bold rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllChecks(false)}
                        className="px-2 py-1 text-[10px] font-bold rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                      >
                        Uncheck All
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-50/90 sticky top-0 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase">
                        <tr>
                          <th className="px-3 py-2 w-10 text-center">Clear</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Ref / Cheque</th>
                          <th className="px-3 py-2">Payee / Memo</th>
                          <th className="px-3 py-2 text-right">Amount (ETB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {checksList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-zinc-400 text-xs italic">
                              No checks or payments for this period.
                            </td>
                          </tr>
                        ) : (
                          checksList.map((c) => {
                            const isSelected = clearedLineIds.has(c.id)
                            return (
                              <tr
                                key={c.id}
                                onClick={() => handleToggleLine(c.id)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? "bg-emerald-50/60 font-semibold" : "hover:bg-zinc-50"
                                }`}
                              >
                                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleLine(c.id)}
                                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] text-zinc-600">{c.date}</td>
                                <td className="px-3 py-2 font-mono text-zinc-900 font-bold">{c.reference}</td>
                                <td className="px-3 py-2 text-zinc-700 truncate max-w-[140px]" title={c.payee}>
                                  {c.payee}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-red-700">
                                  {c.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Pane: Deposits and Other Credits */}
                <div className="flex flex-col overflow-hidden">
                  <div className="p-3 bg-emerald-50/50 border-b border-zinc-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                        <ArrowDownLeft className="size-3.5 text-emerald-600" />
                        Deposits and Other Credits ({depositsList.length})
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        Cleared: {clearedDeposits.length} of {depositsList.length} (ETB{" "}
                        {totalClearedDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectAllDeposits(true)}
                        className="px-2 py-1 text-[10px] font-bold rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllDeposits(false)}
                        className="px-2 py-1 text-[10px] font-bold rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                      >
                        Uncheck All
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-50/90 sticky top-0 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase">
                        <tr>
                          <th className="px-3 py-2 w-10 text-center">Clear</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Ref / Deposit</th>
                          <th className="px-3 py-2">Payee / Memo</th>
                          <th className="px-3 py-2 text-right">Amount (ETB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {depositsList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-zinc-400 text-xs italic">
                              No deposits or credits for this period.
                            </td>
                          </tr>
                        ) : (
                          depositsList.map((d) => {
                            const isSelected = clearedLineIds.has(d.id)
                            return (
                              <tr
                                key={d.id}
                                onClick={() => handleToggleLine(d.id)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? "bg-emerald-50/60 font-semibold" : "hover:bg-zinc-50"
                                }`}
                              >
                                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleLine(d.id)}
                                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] text-zinc-600">{d.date}</td>
                                <td className="px-3 py-2 font-mono text-zinc-900 font-bold">{d.reference}</td>
                                <td className="px-3 py-2 text-zinc-700 truncate max-w-[140px]" title={d.payee}>
                                  {d.payee}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                                  {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Bottom Summary Bar & Commit Panel */}
              <div className="p-4 bg-zinc-900 text-white border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Peachtree Math Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs w-full md:w-auto">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Statement Ending</span>
                    <span className="font-mono font-bold text-sm text-zinc-100">
                      ETB {stmtBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Outstanding Checks</span>
                    <span className="font-mono font-bold text-sm text-red-400">
                      - ETB {totalOutstandingChecks.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Deposits in Transit</span>
                    <span className="font-mono font-bold text-sm text-emerald-400">
                      + ETB {totalDepositsInTransit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">Adjusted GL Balance</span>
                    <span className="font-mono font-bold text-sm text-sky-400">
                      ETB {adjustedGlBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Status Indicator & Commit Button */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                      Unreconciled Difference
                    </span>
                    <div className="flex items-center gap-2 justify-end">
                      {isReconciled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-400 bg-emerald-950/80 border border-emerald-700/50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="size-3.5 text-emerald-400" /> Reconciled (ETB 0.00)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-amber-400 bg-amber-950/80 border border-amber-700/50 px-2.5 py-1 rounded-full">
                          <AlertTriangle className="size-3.5 text-amber-400" /> Out by ETB{" "}
                          {unreconciledDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommitReconciliation}
                    disabled={!isReconciled || isSubmitting}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-lg ${
                      isReconciled && !isSubmitting
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-900/40"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                    }`}
                    title={
                      isReconciled
                        ? "Commit this reconciliation worksheet"
                        : "Peachtree enforces zero difference: Unreconciled Difference must be ETB 0.00 to commit."
                    }
                  >
                    {isSubmitting ? (
                      <LoadingDots />
                    ) : (
                      <>
                        <Check className="size-4" /> Commit Reconciliation
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-zinc-900">Reconciliation History</h3>
                  <p className="text-xs text-zinc-500">
                    Audit trail of past bank reconciliations performed for {selectedAcc?.name || "this account"}.
                  </p>
                </div>
              </div>

              {reconHistory.length === 0 ? (
                <div className="py-16 text-center text-zinc-400">
                  <History className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No prior bank reconciliations recorded for this account.</p>
                </div>
              ) : (
                <TableScrollWrapper>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase">
                      <tr>
                        <th className="px-4 py-3">Statement Date</th>
                        <th className="px-4 py-3">Statement Balance</th>
                        <th className="px-4 py-3">Cleared Checks</th>
                        <th className="px-4 py-3">Cleared Deposits</th>
                        <th className="px-4 py-3">Service Charges</th>
                        <th className="px-4 py-3">Interest Earned</th>
                        <th className="px-4 py-3">Reconciled By</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {reconHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-zinc-900">{rec.statement_date}</td>
                          <td className="px-4 py-3 font-mono font-bold text-zinc-800">
                            ETB {rec.statement_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {rec.cleared_checks_count} checks (ETB{" "}
                            {rec.cleared_checks_total.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {rec.cleared_deposits_count} deposits (ETB{" "}
                            {rec.cleared_deposits_total.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                          </td>
                          <td className="px-4 py-3 font-mono text-red-600">
                            ETB {rec.service_charges.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-600">
                            ETB {rec.interest_earned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">{rec.reconciled_by}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="size-3 text-emerald-600" /> Reconciled
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScrollWrapper>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
