import React, { useState, useEffect, useMemo } from "react"
import {
  X,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowLeftRight,
  Plus,
  Trash2,
  Edit2,
  Check,
  Wallet,
} from "lucide-react"
import { useFinanceStore, type AccountItem } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { COAAccountSelector } from "@/components/finance/COAAccountSelector"

interface PeachtreeBeginningBalancesModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: "counterbalance" | "overview"
}

type MainMode = "counterbalance" | "overview"
type CategoryFilter = "ALL" | "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"

interface DestinationAllocation {
  id: string
  accountId: string
  amount: string
}

export const PeachtreeBeginningBalancesModal: React.FC<PeachtreeBeginningBalancesModalProps> = ({
  isOpen,
  onClose,
  initialTab = "counterbalance",
}) => {
  const { showToast } = useFeedback()
  const store = useFinanceStore()

  // Primary Mode Navigation: "counterbalance" | "overview"
  const [activeMode, setActiveMode] = useState<MainMode>(initialTab)

  // Accounts from store
  const accounts = useMemo(() => store.getAccounts(), [store, isOpen])

  // Non-group active accounts eligible for posting
  const postableAccounts = useMemo(() => {
    return accounts.filter((a) => !a.is_group && a.is_active !== false)
  }, [accounts])

  // -------------------------------------------------------------------------
  // 1. LIVE GROUND-TRUTH ACCOUNT BALANCES COMPUTATION
  // -------------------------------------------------------------------------
  // Computes exact GL debits, credits, and net balance for every account.
  // Never opens blank.
  const liveBalancesMap = useMemo(() => {
    const lines = store.getJournalEntryLines()
    const agg: Record<string, { debitSum: number; creditSum: number }> = {}

    for (const acc of postableAccounts) {
      agg[acc.id] = { debitSum: 0, creditSum: 0 }
    }

    for (const line of lines) {
      const lineAccId = String(line.account_id || "").trim()
      const lineAccCode = String((line as any).account_code || "").trim()

      const match = postableAccounts.find(
        (a) =>
          a.id === lineAccId ||
          a.code === lineAccId ||
          (lineAccCode && (a.code === lineAccCode || a.id === lineAccCode)) ||
          lineAccId === `ACC-${a.code}`
      )

      if (match && agg[match.id]) {
        agg[match.id].debitSum += Number(line.debit_amount) || 0
        agg[match.id].creditSum += Number(line.credit_amount) || 0
      }
    }

    const result: Record<
      string,
      {
        debitSum: number
        creditSum: number
        netBalance: number // debitSum - creditSum
        normalSide: "Dr" | "Cr"
        formattedNet: string
        isNormalPositive: boolean
      }
    > = {}

    for (const acc of postableAccounts) {
      const data = agg[acc.id] || { debitSum: 0, creditSum: 0 }
      const dr = Math.round(data.debitSum * 100) / 100
      const cr = Math.round(data.creditSum * 100) / 100
      const net = Math.round((dr - cr) * 100) / 100
      const isDrNormal = acc.account_type === "Asset" || acc.account_type === "Expense"
      const normalSide = isDrNormal ? "Dr" : "Cr"

      result[acc.id] = {
        debitSum: dr,
        creditSum: cr,
        netBalance: net,
        normalSide,
        formattedNet: Math.abs(net).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isNormalPositive: isDrNormal ? net >= 0 : net <= 0,
      }
    }

    return result
  }, [postableAccounts, store, isOpen])

  // Overall General Ledger totals
  const overallLedgerSummary = useMemo(() => {
    let totalDr = 0
    let totalCr = 0
    for (const b of Object.values(liveBalancesMap)) {
      totalDr += b.debitSum
      totalCr += b.creditSum
    }
    totalDr = Math.round(totalDr * 100) / 100
    totalCr = Math.round(totalCr * 100) / 100
    const diff = Math.round(Math.abs(totalDr - totalCr) * 100) / 100
    return {
      totalDebits: totalDr,
      totalCredits: totalCr,
      difference: diff,
      isBalanced: diff <= 0.01,
    }
  }, [liveBalancesMap])

  // -------------------------------------------------------------------------
  // 2. TAB 1: CASH & ACCOUNT COUNTERBALANCE / REALLOCATION STATE
  // -------------------------------------------------------------------------
  // Source Account: Default to CBE (1000-02-26) or first cash account
  const defaultCashAcc = useMemo(() => {
    return (
      postableAccounts.find((a) => a.code === "1000-02-26") ||
      postableAccounts.find((a) => a.code.startsWith("1000-02")) ||
      postableAccounts[0]
    )
  }, [postableAccounts])

  const [sourceAccountId, setSourceAccountId] = useState<string>("")
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [transferNotes, setTransferNotes] = useState<string>(
    "Cash Counterbalance / Bank Balance Reallocation"
  )
  const [destinations, setDestinations] = useState<DestinationAllocation[]>([
    { id: "dest-1", accountId: "", amount: "" },
  ])
  const [isPostingRebalance, setIsPostingRebalance] = useState<boolean>(false)
  const [showConfirmPostModal, setShowConfirmPostModal] = useState<boolean>(false)

  // Initialize or reset source account when modal opens
  useEffect(() => {
    if (isOpen && defaultCashAcc && !sourceAccountId) {
      setSourceAccountId(defaultCashAcc.id)
    }
    if (isOpen && initialTab) {
      setActiveMode(initialTab)
    }
  }, [isOpen, defaultCashAcc, initialTab, sourceAccountId])

  // Source account item and live balance
  const sourceAccountItem = useMemo(() => {
    return postableAccounts.find((a) => a.id === sourceAccountId || a.code === sourceAccountId)
  }, [postableAccounts, sourceAccountId])

  const sourceLiveBal = useMemo(() => {
    if (!sourceAccountItem) return null
    return liveBalancesMap[sourceAccountItem.id] || null
  }, [sourceAccountItem, liveBalancesMap])

  // Destination allocation handlers
  const handleAddDestination = (suggestedAccId?: string) => {
    const newId = `dest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    setDestinations((prev) => [
      ...prev,
      { id: newId, accountId: suggestedAccId || "", amount: "" },
    ])
  }

  const handleRemoveDestination = (id: string) => {
    setDestinations((prev) => {
      if (prev.length <= 1) {
        return [{ id: prev[0].id, accountId: "", amount: "" }]
      }
      return prev.filter((d) => d.id !== id)
    })
  }

  const handleDestinationAccountChange = (id: string, accId: string) => {
    setDestinations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, accountId: accId } : d))
    )
  }

  const handleDestinationAmountChange = (id: string, val: string) => {
    const clean = val.replace(/[^0-9.]/g, "")
    const parts = clean.split(".")
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean
    setDestinations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, amount: sanitized } : d))
    )
  }

  // Counterbalance totals calculation
  const rebalanceMetrics = useMemo(() => {
    let totalAmt = 0
    let validCount = 0
    const resolvedDests: Array<{
      id: string
      account: AccountItem
      liveBal: (typeof liveBalancesMap)[string]
      amountNum: number
      projectedNet: number
    }> = []

    for (const d of destinations) {
      const amt = parseFloat(d.amount) || 0
      const acc = postableAccounts.find((a) => a.id === d.accountId || a.code === d.accountId)
      if (acc && amt > 0) {
        validCount++
        totalAmt += amt
        const live = liveBalancesMap[acc.id] || {
          debitSum: 0,
          creditSum: 0,
          netBalance: 0,
          normalSide: "Dr",
          formattedNet: "0.00",
          isNormalPositive: true,
        }
        // Since destination account is debited (increased for asset)
        const projected = Math.round((live.netBalance + amt) * 100) / 100
        resolvedDests.push({
          id: d.id,
          account: acc,
          liveBal: live,
          amountNum: amt,
          projectedNet: projected,
        })
      }
    }

    totalAmt = Math.round(totalAmt * 100) / 100
    const sourceCurrentNet = sourceLiveBal ? sourceLiveBal.netBalance : 0
    // Source account is credited (decreased for asset)
    const sourceProjectedNet = Math.round((sourceCurrentNet - totalAmt) * 100) / 100

    const hasDuplicateDest =
      new Set(destinations.map((d) => d.accountId).filter(Boolean)).size !==
      destinations.map((d) => d.accountId).filter(Boolean).length

    const includesSourceAsDest = destinations.some(
      (d) => d.accountId && (d.accountId === sourceAccountId || (sourceAccountItem && d.accountId === sourceAccountItem.code))
    )

    const isValid =
      Boolean(sourceAccountItem) &&
      validCount >= 1 &&
      totalAmt > 0 &&
      !hasDuplicateDest &&
      !includesSourceAsDest

    return {
      totalAmount: totalAmt,
      validCount,
      resolvedDests,
      sourceCurrentNet,
      sourceProjectedNet,
      hasDuplicateDest,
      includesSourceAsDest,
      isValid,
    }
  }, [destinations, postableAccounts, liveBalancesMap, sourceAccountId, sourceAccountItem, sourceLiveBal])

  // Open confirmation modal when form submitted
  const handleOpenPostConfirmation = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPostingRebalance || !rebalanceMetrics.isValid || !sourceAccountItem) return

    if (!transferDate) {
      showToast("Date Required", "warning", "Please select a transfer date.")
      return
    }

    if (rebalanceMetrics.includesSourceAsDest) {
      showToast("Invalid Destination", "warning", "Source account cannot also be a destination account.")
      return
    }

    if (rebalanceMetrics.hasDuplicateDest) {
      showToast("Duplicate Account", "warning", "Each destination account in the allocation must be unique.")
      return
    }

    setShowConfirmPostModal(true)
  }

  // Execute Counterbalance / Reallocation after user confirms
  const executePostCounterbalance = async () => {
    if (isPostingRebalance || !rebalanceMetrics.isValid || !sourceAccountItem) return

    setIsPostingRebalance(true)
    try {
      const desc =
        transferNotes.trim() ||
        `Cash Counterbalance / Reallocation from ${sourceAccountItem.code} (${sourceAccountItem.name})`

      // Build lines: Debits to all destinations, Credit to source
      const entryLines = [
        ...rebalanceMetrics.resolvedDests.map((d) => ({
          account_id: d.account.id,
          debit_amount: d.amountNum,
          credit_amount: 0,
        })),
        {
          account_id: sourceAccountItem.id,
          debit_amount: 0,
          credit_amount: rebalanceMetrics.totalAmount,
        },
      ]

      const result = store.postJournalEntry(
        {
          entry_date: transferDate,
          description: desc,
          source_type: "Manual Adjustment",
          source_id: `COUNTERBALANCE-${Date.now()}`,
          created_by: "Finance Admin",
          currency: "ETB",
          exchange_rate: 1.0,
          is_reversal_of: null,
        },
        entryLines
      )

      if (!result.success) {
        showToast("Posting Failed", "warning", result.error || "Failed to post counterbalance entry.")
        return
      }

      await store.flushPersistence()

      showToast(
        "Reallocation Posted Successfully",
        "success",
        `Transferred ETB ${rebalanceMetrics.totalAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })} from ${sourceAccountItem.code} across ${rebalanceMetrics.resolvedDests.length} account(s).`
      )

      // Reset destination rows and close confirmation
      setDestinations([{ id: `dest-${Date.now()}`, accountId: "", amount: "" }])
      setShowConfirmPostModal(false)
    } catch (err: any) {
      showToast("Reallocation Error", "warning", err.message || "An unexpected error occurred.")
    } finally {
      setIsPostingRebalance(false)
    }
  }

  // Common Cash / Bank Presets for quick-click allocation
  const cashBankPresets = useMemo(() => {
    return postableAccounts
      .filter((a) => a.code.startsWith("1000") && a.id !== sourceAccountId)
      .slice(0, 8)
  }, [postableAccounts, sourceAccountId])

  // -------------------------------------------------------------------------
  // 3. TAB 2: LIVE BALANCES & ACCOUNT MASTER DATA EDITING STATE
  // -------------------------------------------------------------------------
  const [overviewSearch, setOverviewSearch] = useState<string>("")
  const [overviewCategory, setOverviewCategory] = useState<CategoryFilter>("ALL")

  // Inline Account Master Data Editor Modal state
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null)
  const [editName, setEditName] = useState<string>("")
  const [editPeachtreeType, setEditPeachtreeType] = useState<string>("")
  const [editIsActive, setEditIsActive] = useState<boolean>(true)
  const [isSavingAccount, setIsSavingAccount] = useState<boolean>(false)

  const handleStartEditAccount = (acc: AccountItem) => {
    setEditingAccount(acc)
    setEditName(acc.name || "")
    setEditPeachtreeType(acc.peachtree_type || acc.account_type || "")
    setEditIsActive(acc.is_active !== false)
  }

  const handleSaveAccountMasterData = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAccount || isSavingAccount) return
    if (!editName.trim()) {
      showToast("Name Required", "warning", "Account name cannot be empty.")
      return
    }

    setIsSavingAccount(true)
    try {
      const res = await store.updateAccount(editingAccount.id, {
        name: editName.trim(),
        peachtree_type: editPeachtreeType.trim() || undefined,
        is_active: editIsActive,
      })

      if (!res.success) {
        showToast("Update Failed", "warning", res.error || "Failed to update account.")
        return
      }

      await store.flushPersistence()
      showToast(
        "Account Master Data Updated",
        "success",
        `Updated account ${editingAccount.code} directly in Chart of Accounts. 0 journal entries created.`
      )
      setEditingAccount(null)
    } catch (err: any) {
      showToast("Update Error", "warning", err.message || "Failed to update account.")
    } finally {
      setIsSavingAccount(false)
    }
  }

  // Filtered accounts for Live Overview
  const displayedOverviewAccounts = useMemo(() => {
    let filtered = postableAccounts

    if (overviewCategory !== "ALL") {
      filtered = filtered.filter((a) => a.account_type === overviewCategory)
    }

    if (overviewSearch.trim()) {
      const q = overviewSearch.toLowerCase().trim()
      filtered = filtered.filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.peachtree_type || "").toLowerCase().includes(q)
      )
    }

    return [...filtered].sort((a, b) => a.code.localeCompare(b.code))
  }, [postableAccounts, overviewCategory, overviewSearch])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-white dark:bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 shrink-0">
              <Scale className="size-6" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white">
                Maintain Chart of Accounts (COA)
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Counterbalance cash balances, inspect live GL totals, and manage master account definitions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="px-4 py-2.5 bg-zinc-100/70 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Tab 1: Cash & Balance Counterbalance */}
            <button
              type="button"
              onClick={() => setActiveMode("counterbalance")}
              className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 transition-all cursor-pointer ${
                activeMode === "counterbalance"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                  : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700"
              }`}
            >
              <ArrowLeftRight className="size-3.5" />
              <span>Cash Counterbalance & Reallocation</span>
            </button>

            {/* Tab 2: Live Balances & Audit */}
            <button
              type="button"
              onClick={() => setActiveMode("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 transition-all cursor-pointer ${
                activeMode === "overview"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md"
                  : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700"
              }`}
            >
              <Wallet className="size-3.5" />
              <span>Live Account Balances ({postableAccounts.length})</span>
            </button>
          </div>

          {/* Quick Trial Balance Health Pill */}
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 shadow-2xs">
            <span className="text-zinc-400 font-semibold">GL Net Variance:</span>
            {overallLedgerSummary.isBalanced ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> ETB 0.00
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-mono font-black flex items-center gap-1">
                <AlertTriangle className="size-3.5" /> ETB {overallLedgerSummary.difference.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODE 1: CASH & ACCOUNT COUNTERBALANCE / REALLOCATION                     */}
        {/* ========================================================================= */}
        {activeMode === "counterbalance" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50/50 dark:bg-zinc-950 flex flex-col gap-5">
            <form onSubmit={handleOpenPostConfirmation} className="space-y-6">
              {/* SOURCE ACCOUNT CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                      Cr
                    </span>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                      Source Account <span className="text-rose-600 dark:text-rose-400 font-bold">(Credit / Decrease)</span>
                    </h4>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    The cash/bank account currently holding the accumulated receipts
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Select Source Account
                    </label>
                    <COAAccountSelector
                      value={sourceAccountId}
                      onChange={(acc) => setSourceAccountId(acc.id)}
                      placeholder="Select source account (e.g. CBE 1000-02-26)..."
                    />
                  </div>

                  {/* Live Balance Card for Source */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Current Live Balance
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black font-mono text-zinc-900 dark:text-white">
                        ETB {sourceLiveBal ? sourceLiveBal.formattedNet : "0.00"}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {sourceLiveBal ? sourceLiveBal.normalSide : "Dr"}
                      </span>
                    </div>
                    {rebalanceMetrics.totalAmount > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-[11px] flex items-center justify-between">
                        <span className="text-zinc-500">Projected Remaining:</span>
                        <span
                          className={`font-mono font-bold ${
                            rebalanceMetrics.sourceProjectedNet < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          ETB {rebalanceMetrics.sourceProjectedNet.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DESTINATION ALLOCATIONS CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">
                      Dr
                    </span>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                      Destination Allocations <span className="text-emerald-600 dark:text-emerald-400 font-bold">(Debit / Increase)</span>
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddDestination()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Another Account</span>
                  </button>
                </div>

                {/* Quick Cash Account Presets */}
                {cashBankPresets.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                      Quick Add Common Cash & Bank Accounts:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {cashBankPresets.map((acc) => {
                        const isAlreadySelected = destinations.some((d) => d.accountId === acc.id)
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            disabled={isAlreadySelected}
                            onClick={() => {
                              const emptySlot = destinations.find((d) => !d.accountId)
                              if (emptySlot) {
                                handleDestinationAccountChange(emptySlot.id, acc.id)
                              } else {
                                handleAddDestination(acc.id)
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              isAlreadySelected
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent cursor-not-allowed"
                                : "bg-zinc-50 dark:bg-zinc-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-300 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300"
                            }`}
                          >
                            + {acc.code} ({acc.name.slice(0, 18)})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Destinations Grid / Rows */}
                <div className="space-y-3 pt-2">
                  {destinations.map((dest, idx) => {
                    const accItem = postableAccounts.find(
                      (a) => a.id === dest.accountId || a.code === dest.accountId
                    )
                    const live = accItem ? liveBalancesMap[accItem.id] : null
                    const amtNum = parseFloat(dest.amount) || 0
                    const projected = live ? Math.round((live.netBalance + amtNum) * 100) / 100 : 0

                    return (
                      <div
                        key={dest.id}
                        className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col md:flex-row items-stretch md:items-center gap-3"
                      >
                        <span className="size-6 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-black flex items-center justify-center shrink-0 self-start md:self-center">
                          {idx + 1}
                        </span>

                        {/* Account Selector */}
                        <div className="flex-1 min-w-[240px]">
                          <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                            Destination Account
                          </label>
                          <COAAccountSelector
                            value={dest.accountId}
                            onChange={(acc) => handleDestinationAccountChange(dest.id, acc.id)}
                            placeholder="Select destination account..."
                          />
                        </div>

                        {/* Current Balance */}
                        <div className="w-full md:w-36 text-left md:text-right shrink-0">
                          <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                            Current Balance
                          </label>
                          <div className="py-2 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            ETB {live ? live.formattedNet : "0.00"}
                          </div>
                        </div>

                        {/* Allocation Amount Input */}
                        <div className="w-full md:w-44 shrink-0">
                          <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                            Reallocate Amount (ETB)
                          </label>
                          <input
                            type="text"
                            value={dest.amount}
                            placeholder="0.00"
                            onChange={(e) => handleDestinationAmountChange(dest.id, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono font-black text-right outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>

                        {/* Projected New Balance */}
                        <div className="w-full md:w-36 text-left md:text-right shrink-0">
                          <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                            Projected Balance
                          </label>
                          <div className="py-2 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                            ETB {amtNum > 0 ? projected.toLocaleString(undefined, { minimumFractionDigits: 2 }) : live ? live.formattedNet : "0.00"}
                          </div>
                        </div>

                        {/* Remove Row Button */}
                        <div className="shrink-0 self-end md:self-center pt-2 md:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveDestination(dest.id)}
                            className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                            title="Remove allocation line"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* POSTING DETAILS */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Posting Date
                  </label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Voucher Description / Notes
                  </label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="e.g. Cash Counterbalance from CBE to Awash and Petty Cash"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* IMPACT & DOUBLE-ENTRY PREVIEW */}
              <div className="p-4 rounded-2xl bg-zinc-900 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                      Total Counterbalanced
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                      ETB {rebalanceMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="pl-4 border-l border-zinc-800">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                      Ledger Impact
                    </span>
                    <span className="text-xs font-bold text-zinc-300">
                      Creates exactly {rebalanceMetrics.validCount + 1} lines (Credit 1, Debit {rebalanceMetrics.validCount})
                    </span>
                  </div>

                  <div className="pl-4 border-l border-zinc-800">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                      Balance Status
                    </span>
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Variance ETB 0.00 (Balanced)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <button
                    type="submit"
                    disabled={isPostingRebalance || !rebalanceMetrics.isValid}
                    className="w-full md:w-auto px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer active:scale-95"
                  >
                    {isPostingRebalance ? (
                      <>
                        <LoadingDots color="bg-white" size="sm" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" />
                        <span>Post</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 2: LIVE ACCOUNT BALANCES & MASTER DATA AUDIT                        */}
        {/* ========================================================================= */}
        {activeMode === "overview" && (
          <div className="flex-1 overflow-y-auto flex flex-col bg-zinc-50/50 dark:bg-zinc-950">
            {/* Filter Bar */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: "ALL", label: `All Accounts (${postableAccounts.length})` },
                    { id: "Asset", label: "Assets (1000s)" },
                    { id: "Liability", label: "Liabilities (2000s)" },
                    { id: "Equity", label: "Equity (3000s)" },
                    { id: "Revenue", label: "Revenue (4000s)" },
                    { id: "Expense", label: "Expenses (5000-8000s)" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOverviewCategory(tab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      overviewCategory === tab.id
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={overviewSearch}
                  onChange={(e) => setOverviewSearch(e.target.value)}
                  placeholder="Search code or account name..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Live Balances Table */}
            <div className="flex-1 overflow-x-auto p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    <th className="py-2.5 px-3 w-32">Account Code</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Account Name</th>
                    <th className="py-2.5 px-3 w-28 hidden sm:table-cell">Peachtree Type</th>
                    <th className="py-2.5 px-3 w-16 text-center">Normal</th>
                    <th className="py-2.5 px-3 w-36 text-right">GL Debits (ETB)</th>
                    <th className="py-2.5 px-3 w-36 text-right">GL Credits (ETB)</th>
                    <th className="py-2.5 px-3 w-40 text-right">Live Net Balance</th>
                    <th className="py-2.5 px-3 w-28 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                  {displayedOverviewAccounts.map((acc) => {
                    const live = liveBalancesMap[acc.id] || {
                      debitSum: 0,
                      creditSum: 0,
                      netBalance: 0,
                      normalSide: "Dr",
                      formattedNet: "0.00",
                      isNormalPositive: true,
                    }
                    const hasTransactions = live.debitSum > 0 || live.creditSum > 0

                    return (
                      <tr
                        key={acc.id}
                        className={`hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 transition-colors ${
                          hasTransactions ? "bg-white dark:bg-zinc-900/40" : ""
                        }`}
                      >
                        {/* Code */}
                        <td className="py-3 px-3 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {acc.code}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                            {acc.name}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-3 px-3 text-[11px] font-semibold text-zinc-500 hidden sm:table-cell">
                          {acc.peachtree_type || acc.account_type}
                        </td>

                        {/* Normal Side Pill */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              live.normalSide === "Dr"
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                            }`}
                          >
                            {live.normalSide}
                          </span>
                        </td>

                        {/* Total Debits */}
                        <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                          {live.debitSum > 0 ? live.debitSum.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                        </td>

                        {/* Total Credits */}
                        <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                          {live.creditSum > 0 ? live.creditSum.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                        </td>

                        {/* Net Balance */}
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-mono font-black text-xs inline-block px-2 py-0.5 rounded-lg ${
                              hasTransactions
                                ? live.isNormalPositive
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "text-zinc-400"
                            }`}
                          >
                            ETB {live.formattedNet} {hasTransactions ? (live.netBalance >= 0 ? "Dr" : "Cr") : ""}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Rebalance Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSourceAccountId(acc.id)
                                setActiveMode("counterbalance")
                              }}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-zinc-400 hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Counterbalance / Reallocate from this account"
                            >
                              <ArrowLeftRight className="size-3.5" />
                            </button>

                            {/* Edit Master Data Button */}
                            <button
                              type="button"
                              onClick={() => handleStartEditAccount(acc)}
                              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                              title="Edit account master data (0 journal entries created)"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {displayedOverviewAccounts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-400 font-semibold text-xs">
                        No accounts match your search query or category filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Total Summary Bar for Overview */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-white shrink-0 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                    Total GL Debits
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                    ETB {overallLedgerSummary.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                    Total GL Credits
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-purple-400">
                    ETB {overallLedgerSummary.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="pl-4 border-l border-zinc-700">
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                    General Ledger Status
                  </span>
                  {overallLedgerSummary.isBalanced ? (
                    <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                      <CheckCircle2 className="size-4" />
                      <span>In Exact Balance (ETB 0.00 Variance)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                      <AlertTriangle className="size-4" />
                      <span>Variance: ETB {overallLedgerSummary.difference.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: POST CONFIRMATION DIALOG                                          */}
        {/* ========================================================================= */}
        {showConfirmPostModal && sourceAccountItem && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                    <ArrowLeftRight className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-zinc-900 dark:text-white">
                      Confirm Account Reallocation
                    </h4>
                    <p className="text-xs text-zinc-500">
                      Review transaction details before posting to General Ledger
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmPostModal(false)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Transaction Details */}
              <div className="space-y-3.5 text-xs">
                {/* Source Box */}
                <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40">
                  <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-200/70 dark:bg-rose-900/60 font-black">
                        CREDIT
                      </span>
                      Source Account (Decreasing)
                    </span>
                    <span className="font-mono font-black text-sm">
                      - ETB {rebalanceMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {sourceAccountItem.code} - {sourceAccountItem.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Current: ETB {sourceLiveBal ? sourceLiveBal.formattedNet : "0.00"} → Projected: ETB {rebalanceMetrics.sourceProjectedNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Destination Boxes */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 space-y-2.5">
                  <div className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-200/70 dark:bg-emerald-900/60 font-black">
                        DEBIT
                      </span>
                      Destination Account(s) (Increasing)
                    </span>
                    <span className="font-mono font-black text-sm">
                      + ETB {rebalanceMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="divide-y divide-emerald-200/50 dark:divide-emerald-900/40">
                    {rebalanceMetrics.resolvedDests.map((d) => (
                      <div key={d.id} className="pt-2 first:pt-0 flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            {d.account.code} - {d.account.name}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            Current: ETB {d.liveBal.formattedNet} → Projected: ETB {d.projectedNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          ETB {d.amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date & Memo Meta */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-zinc-400 block font-semibold">Posting Date:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{transferDate}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-semibold">Voucher Type:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">Manual Adjustment</span>
                  </div>
                  {transferNotes && (
                    <div className="col-span-2 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                      <span className="text-zinc-400 block font-semibold">Description / Notes:</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{transferNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isPostingRebalance}
                  onClick={() => setShowConfirmPostModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isPostingRebalance}
                  onClick={executePostCounterbalance}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isPostingRebalance ? (
                    <>
                      <LoadingDots color="bg-white" size="sm" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      <span>Confirm & Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* INLINE MODAL: ACCOUNT MASTER DATA EDITOR                                 */}
        {/* ========================================================================= */}
        {editingAccount && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
                    <Edit2 className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                      Edit Account Master Data
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Code: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{editingAccount.code}</span> (0 GL Entries)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAccountMasterData} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Peachtree / Industry Type
                  </label>
                  <input
                    type="text"
                    value={editPeachtreeType}
                    onChange={(e) => setEditPeachtreeType(e.target.value)}
                    placeholder="e.g. Cash, Accounts Receivable, Inventory..."
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="size-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                  />
                  <label htmlFor="editIsActive" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Account is Active (eligible for GL posting)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
                    disabled={isSavingAccount}
                    className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingAccount || !editName.trim()}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAccount ? (
                      <>
                        <LoadingDots color="bg-white" size="sm" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        <span>Save Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PeachtreeBeginningBalancesModal
