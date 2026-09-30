import React, { useState } from "react"
import { Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRightLeft, DollarSign, Package } from "lucide-react"
import { useFinanceStore } from "@/lib/financeStore"
import COAAccountSelector from "@/components/finance/COAAccountSelector"

export interface SplitLineItem {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  description: string
  amount: number
  debit?: number
  credit?: number
}

interface SalesIssueCOASplitSectionProps {
  totalAmount?: number
  grandTotal?: number
  subtotal?: number
  vatAmount?: number
  totalCost?: number
  warehouseId?: string
  paymentType: "Cash" | "Credit"
  customerName?: string
  // Section A: Revenue
  debitLines?: SplitLineItem[]
  creditLines?: SplitLineItem[]
  onDebitLinesChange?: (lines: SplitLineItem[]) => void
  onCreditLinesChange?: (lines: SplitLineItem[]) => void
  revDebitLines?: SplitLineItem[]
  revCreditLines?: SplitLineItem[]
  onRevDebitLinesChange?: (lines: SplitLineItem[]) => void
  onRevCreditLinesChange?: (lines: SplitLineItem[]) => void
  // Section B: Inventory & COGS
  cogsDebitLines?: SplitLineItem[]
  cogsCreditLines?: SplitLineItem[]
  onCogsDebitLinesChange?: (lines: SplitLineItem[]) => void
  onCogsCreditLinesChange?: (lines: SplitLineItem[]) => void
}

export const SalesIssueCOASplitSection: React.FC<SalesIssueCOASplitSectionProps> = ({
  totalAmount,
  grandTotal,
  totalCost = 0,
  warehouseId,
  paymentType,
  customerName = "",
  debitLines,
  creditLines,
  onDebitLinesChange,
  onCreditLinesChange,
  revDebitLines,
  revCreditLines,
  onRevDebitLinesChange,
  onRevCreditLinesChange,
  cogsDebitLines = [],
  cogsCreditLines = [],
  onCogsDebitLinesChange,
  onCogsCreditLinesChange,
}) => {
  const financeStore = useFinanceStore()
  const accounts = financeStore.getAccounts()

  const [activeTab, setActiveTab] = useState<"revenue" | "cogs">("revenue")

  const isCredit = paymentType === "Credit"
  const isWh1 =
    String(warehouseId || "").toUpperCase().startsWith("WH1") ||
    String(warehouseId || "").toUpperCase().includes("EXP")

  // ── Section A: Revenue & Settlement Lines ──────────────────────────────────────
  const effectiveRevDebitLines = debitLines || revDebitLines || []
  const effectiveRevCreditLines = creditLines || revCreditLines || []

  const setRevDebits = onDebitLinesChange || onRevDebitLinesChange || (() => {})
  const setRevCredits = onCreditLinesChange || onRevCreditLinesChange || (() => {})

  const targetRevTotal = Math.round(Number(totalAmount !== undefined ? totalAmount : (grandTotal || 0)) * 100) / 100
  const revTotalDebits = Math.round(effectiveRevDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const revTotalCredits = Math.round(effectiveRevCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const revDifference = Math.round(Math.abs(revTotalDebits - revTotalCredits) * 100) / 100
  const isRevBalanced = revDifference < 0.01 && revTotalDebits > 0
  const matchesRevTotal = Math.abs(revTotalDebits - targetRevTotal) < 0.01

  // Section A Debit line handlers
  const handleAddRevDebitLine = () => {
    const currentSum = effectiveRevDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetRevTotal - currentSum) * 100) / 100)
    const defaultCode = isCredit ? (isWh1 ? "1300-01" : "1300-03") : "1000-02-26"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    setRevDebits([
      ...effectiveRevDebitLines,
      {
        id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || (isCredit ? "Trade Accounts Receivable" : "CBE Bank Operating"),
        description: isCredit ? `Receivable - ${customerName || "Customer"}` : "Customer Direct Deposit",
        amount: remainder,
      },
    ])
  }

  const handleRemoveRevDebitLine = (id: string) => {
    if (effectiveRevDebitLines.length <= 1) return
    setRevDebits(effectiveRevDebitLines.filter((l) => l.id !== id))
  }

  const handleUpdateRevDebitLine = (id: string, updates: Partial<SplitLineItem>) => {
    setRevDebits(effectiveRevDebitLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillRevDebit = (index: number) => {
    const otherSum = effectiveRevDebitLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetRevTotal - otherSum) * 100) / 100)
    setRevDebits(effectiveRevDebitLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  // Section A Credit line handlers
  const handleAddRevCreditLine = () => {
    const currentSum = effectiveRevCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetRevTotal - currentSum) * 100) / 100)
    const defaultCode = isWh1 ? "4000-02-01" : "4000-01-01"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    setRevCredits([
      ...effectiveRevCreditLines,
      {
        id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || (isWh1 ? "Revenue - Export Commodities" : "Sales Revenue - Pharmaceuticals"),
        description: "Sales Revenue Recognition",
        amount: remainder,
      },
    ])
  }

  const handleRemoveRevCreditLine = (id: string) => {
    if (effectiveRevCreditLines.length <= 1) return
    setRevCredits(effectiveRevCreditLines.filter((l) => l.id !== id))
  }

  const handleUpdateRevCreditLine = (id: string, updates: Partial<SplitLineItem>) => {
    setRevCredits(effectiveRevCreditLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillRevCredit = (index: number) => {
    const otherSum = effectiveRevCreditLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetRevTotal - otherSum) * 100) / 100)
    setRevCredits(effectiveRevCreditLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  // ── Section B: Inventory & COGS Lines ──────────────────────────────────────────
  const effectiveCogsDebitLines = cogsDebitLines || []
  const effectiveCogsCreditLines = cogsCreditLines || []

  const setCogsDebits = onCogsDebitLinesChange || (() => {})
  const setCogsCredits = onCogsCreditLinesChange || (() => {})

  const targetCogsTotal = Math.round(Number(totalCost > 0 ? totalCost : (effectiveCogsDebitLines[0]?.amount || 0)) * 100) / 100
  const cogsTotalDebits = Math.round(effectiveCogsDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const cogsTotalCredits = Math.round(effectiveCogsCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const cogsDifference = Math.round(Math.abs(cogsTotalDebits - cogsTotalCredits) * 100) / 100
  const isCogsBalanced = cogsDifference < 0.01 && cogsTotalDebits > 0

  const handleAddCogsDebitLine = () => {
    const currentSum = effectiveCogsDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCogsTotal - currentSum) * 100) / 100)
    const defaultCode = isWh1 ? "5000-02" : "5000-01"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    setCogsDebits([
      ...effectiveCogsDebitLines,
      {
        id: `dr-cogs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || (isWh1 ? "Cost of Goods Export" : "COST OF VETERINARY DRUG"),
        description: "Cost of Goods Sold - Stock Issued",
        amount: remainder,
      },
    ])
  }

  const handleRemoveCogsDebitLine = (id: string) => {
    if (effectiveCogsDebitLines.length <= 1) return
    setCogsDebits(effectiveCogsDebitLines.filter((l) => l.id !== id))
  }

  const handleUpdateCogsDebitLine = (id: string, updates: Partial<SplitLineItem>) => {
    setCogsDebits(effectiveCogsDebitLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillCogsDebit = (index: number) => {
    const otherSum = effectiveCogsDebitLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCogsTotal - otherSum) * 100) / 100)
    setCogsDebits(effectiveCogsDebitLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  const handleAddCogsCreditLine = () => {
    const currentSum = effectiveCogsCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCogsTotal - currentSum) * 100) / 100)
    const defaultCode = isWh1 ? "1410-01" : "1400-01"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    setCogsCredits([
      ...effectiveCogsCreditLines,
      {
        id: `cr-cogs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || (isWh1 ? "STOCK OF GREEN MUNG" : "STOCK OF VETERINARY DRUG"),
        description: "Inventory Asset Relieved - Stock Issued",
        amount: remainder,
      },
    ])
  }

  const handleRemoveCogsCreditLine = (id: string) => {
    if (effectiveCogsCreditLines.length <= 1) return
    setCogsCredits(effectiveCogsCreditLines.filter((l) => l.id !== id))
  }

  const handleUpdateCogsCreditLine = (id: string, updates: Partial<SplitLineItem>) => {
    setCogsCredits(effectiveCogsCreditLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillCogsCredit = (index: number) => {
    const otherSum = effectiveCogsCreditLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCogsTotal - otherSum) * 100) / 100)
    setCogsCredits(effectiveCogsCreditLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-4">
      {/* Section Header with Tabs and Balance Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-zinc-700" />
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
            Accounting & General Ledger COA Allocation
          </h4>
        </div>

        {/* Tab Toggle: Section A (Revenue) vs Section B (COGS) */}
        <div className="flex items-center p-0.5 rounded-xl bg-zinc-200/80 border border-zinc-300">
          <button
            type="button"
            onClick={() => setActiveTab("revenue")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === "revenue"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <DollarSign className="size-3.5 text-emerald-600" />
            Section A: Revenue & Receivables
            {isRevBalanced && matchesRevTotal ? (
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            ) : (
              <span className="size-2 rounded-full bg-amber-500 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cogs")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === "cogs"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <Package className="size-3.5 text-amber-600" />
            Section B: Inventory & COGS
            {isCogsBalanced ? (
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            ) : (
              <span className="size-2 rounded-full bg-amber-500 shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════
          TAB 1: SECTION A (REVENUE & SETTLEMENT / AR)
         ══════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <div className="space-y-3.5 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500">
              Record sales revenue and customer settlement / receivables distribution.
            </span>
            {isRevBalanced && matchesRevTotal ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300">
                <CheckCircle2 className="size-3 text-emerald-600" /> Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black border border-amber-300">
                <AlertTriangle className="size-3 text-amber-600" />
                {!isRevBalanced
                  ? `Unbalanced (Diff: ETB ${revDifference.toFixed(2)})`
                  : `Diff from Total (ETB ${Math.abs(revTotalDebits - targetRevTotal).toFixed(2)})`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Debit Section (Cash / Bank / AR) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Debit Accounts (Settlement / Cash / AR)
                </span>
                <button
                  type="button"
                  onClick={handleAddRevDebitLine}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="size-3" /> Add Debit
                </button>
              </div>

              <div className="space-y-2">
                {effectiveRevDebitLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-2 rounded-xl bg-white border border-zinc-200 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <COAAccountSelector
                          value={line.accountCode}
                          onChange={(acc) =>
                            handleUpdateRevDebitLine(line.id, {
                              accountId: acc.id,
                              accountCode: acc.code,
                              accountName: acc.name,
                            })
                          }
                          placeholder={isCredit ? "Select AR account..." : "Select cash/bank account..."}
                          compact
                          required
                        />
                      </div>

                      <div className="w-28 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Amount"
                          value={line.amount || ""}
                          onChange={(e) =>
                            handleUpdateRevDebitLine(line.id, {
                              amount: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 h-[34px] rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 text-right outline-none focus:bg-white focus:border-emerald-500"
                        />
                      </div>

                      {effectiveRevDebitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRevDebitLine(line.id)}
                          className="text-zinc-400 hover:text-rose-600 p-1 shrink-0 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Memo / Line Description (Optional)"
                        value={line.description}
                        onChange={(e) => handleUpdateRevDebitLine(line.id, { description: e.target.value })}
                        className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-zinc-300 focus:bg-white text-zinc-700 outline-none"
                      />
                      {effectiveRevDebitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillRevDebit(idx)}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 shrink-0 px-1 py-0.5 cursor-pointer"
                          title="Fill remaining balance into this line"
                        >
                          Auto-fill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs px-1 pt-1 font-mono">
                <span className="text-zinc-500 font-sans font-bold">Total Debits:</span>
                <span className="font-black text-zinc-900">
                  ETB {revTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Credit Section (Sales Revenue / Output VAT) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" />
                  Credit Accounts (Sales Revenue / VAT)
                </span>
                <button
                  type="button"
                  onClick={handleAddRevCreditLine}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="size-3" /> Add Credit
                </button>
              </div>

              <div className="space-y-2">
                {effectiveRevCreditLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-2 rounded-xl bg-white border border-zinc-200 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <COAAccountSelector
                          value={line.accountCode}
                          onChange={(acc) =>
                            handleUpdateRevCreditLine(line.id, {
                              accountId: acc.id,
                              accountCode: acc.code,
                              accountName: acc.name,
                            })
                          }
                          placeholder="Select revenue/tax account..."
                          compact
                          required
                        />
                      </div>

                      <div className="w-28 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Amount"
                          value={line.amount || ""}
                          onChange={(e) =>
                            handleUpdateRevCreditLine(line.id, {
                              amount: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 h-[34px] rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 text-right outline-none focus:bg-white focus:border-blue-500"
                        />
                      </div>

                      {effectiveRevCreditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRevCreditLine(line.id)}
                          className="text-zinc-400 hover:text-rose-600 p-1 shrink-0 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Memo / Line Description (Optional)"
                        value={line.description}
                        onChange={(e) => handleUpdateRevCreditLine(line.id, { description: e.target.value })}
                        className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-zinc-300 focus:bg-white text-zinc-700 outline-none"
                      />
                      {effectiveRevCreditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillRevCredit(idx)}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 shrink-0 px-1 py-0.5 cursor-pointer"
                          title="Fill remaining balance into this line"
                        >
                          Auto-fill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs px-1 pt-1 font-mono">
                <span className="text-zinc-500 font-sans font-bold">Total Credits:</span>
                <span className="font-black text-zinc-900">
                  ETB {revTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════
          TAB 2: SECTION B (INVENTORY & COGS ALLOCATION)
         ══════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "cogs" && (
        <div className="space-y-3.5 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500">
              Relieve inventory stock asset and recognize Cost of Goods Sold (COGS).
            </span>
            {isCogsBalanced ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300">
                <CheckCircle2 className="size-3 text-emerald-600" /> Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black border border-amber-300">
                <AlertTriangle className="size-3 text-amber-600" />
                Unbalanced (Diff: ETB {cogsDifference.toFixed(2)})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* COGS Debit Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  Debit Accounts (COGS Expense)
                </span>
                <button
                  type="button"
                  onClick={handleAddCogsDebitLine}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="size-3" /> Add COGS Debit
                </button>
              </div>

              <div className="space-y-2">
                {effectiveCogsDebitLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-2 rounded-xl bg-white border border-zinc-200 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <COAAccountSelector
                          value={line.accountCode}
                          onChange={(acc) =>
                            handleUpdateCogsDebitLine(line.id, {
                              accountId: acc.id,
                              accountCode: acc.code,
                              accountName: acc.name,
                            })
                          }
                          placeholder="Select COGS account (e.g. 5000-01)..."
                          compact
                          required
                        />
                      </div>

                      <div className="w-28 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Amount"
                          value={line.amount || ""}
                          onChange={(e) =>
                            handleUpdateCogsDebitLine(line.id, {
                              amount: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 h-[34px] rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 text-right outline-none focus:bg-white focus:border-amber-500"
                        />
                      </div>

                      {effectiveCogsDebitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCogsDebitLine(line.id)}
                          className="text-zinc-400 hover:text-rose-600 p-1 shrink-0 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Memo / Line Description (Optional)"
                        value={line.description}
                        onChange={(e) => handleUpdateCogsDebitLine(line.id, { description: e.target.value })}
                        className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-zinc-300 focus:bg-white text-zinc-700 outline-none"
                      />
                      {effectiveCogsDebitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillCogsDebit(idx)}
                          className="text-[10px] font-bold text-amber-700 hover:text-amber-900 shrink-0 px-1 py-0.5 cursor-pointer"
                          title="Fill remaining balance into this line"
                        >
                          Auto-fill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs px-1 pt-1 font-mono">
                <span className="text-zinc-500 font-sans font-bold">Total COGS Debits:</span>
                <span className="font-black text-zinc-900">
                  ETB {cogsTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Inventory Stock Credit Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-zinc-700" />
                  Credit Accounts (Inventory Asset Relieved)
                </span>
                <button
                  type="button"
                  onClick={handleAddCogsCreditLine}
                  className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="size-3" /> Add Stock Credit
                </button>
              </div>

              <div className="space-y-2">
                {effectiveCogsCreditLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-2 rounded-xl bg-white border border-zinc-200 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <COAAccountSelector
                          value={line.accountCode}
                          onChange={(acc) =>
                            handleUpdateCogsCreditLine(line.id, {
                              accountId: acc.id,
                              accountCode: acc.code,
                              accountName: acc.name,
                            })
                          }
                          placeholder="Select Stock account (e.g. 1400-01)..."
                          compact
                          required
                        />
                      </div>

                      <div className="w-28 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Amount"
                          value={line.amount || ""}
                          onChange={(e) =>
                            handleUpdateCogsCreditLine(line.id, {
                              amount: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 h-[34px] rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 text-right outline-none focus:bg-white focus:border-zinc-700"
                        />
                      </div>

                      {effectiveCogsCreditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCogsCreditLine(line.id)}
                          className="text-zinc-400 hover:text-rose-600 p-1 shrink-0 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Memo / Line Description (Optional)"
                        value={line.description}
                        onChange={(e) => handleUpdateCogsCreditLine(line.id, { description: e.target.value })}
                        className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-zinc-300 focus:bg-white text-zinc-700 outline-none"
                      />
                      {effectiveCogsCreditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillCogsCredit(idx)}
                          className="text-[10px] font-bold text-zinc-700 hover:text-zinc-950 shrink-0 px-1 py-0.5 cursor-pointer"
                          title="Fill remaining balance into this line"
                        >
                          Auto-fill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs px-1 pt-1 font-mono">
                <span className="text-zinc-500 font-sans font-bold">Total Stock Credits:</span>
                <span className="font-black text-zinc-900">
                  ETB {cogsTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesIssueCOASplitSection
