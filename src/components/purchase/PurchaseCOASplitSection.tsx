import React from "react"
import { Plus, Trash2, CheckCircle2, AlertTriangle, Sparkles, Layers } from "lucide-react"
import { useFinanceStore } from "@/lib/financeStore"
import COAAccountSelector from "@/components/finance/COAAccountSelector"

export interface SplitLineItem {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  description: string
  amount: number
}

interface PurchaseCOASplitSectionProps {
  totalAmount: number
  paymentType: "Cash" | "Credit"
  debitLines: SplitLineItem[]
  creditLines: SplitLineItem[]
  onDebitLinesChange: (lines: SplitLineItem[]) => void
  onCreditLinesChange: (lines: SplitLineItem[]) => void
  reasonForPayment?: string
}

export const PurchaseCOASplitSection: React.FC<PurchaseCOASplitSectionProps> = ({
  totalAmount,
  paymentType,
  debitLines,
  creditLines,
  onDebitLinesChange,
  onCreditLinesChange,
  reasonForPayment = "",
}) => {
  const financeStore = useFinanceStore()
  const accounts = financeStore.getAccounts()

  const isCredit = paymentType === "Credit"

  // Rounding safe totals
  const totalDebits = Math.round(debitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const totalCredits = Math.round(creditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const poTotal = Math.round((Number(totalAmount) || 0) * 100) / 100
  const difference = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100
  const isBalanced = difference < 0.01 && totalDebits > 0
  const matchesPoTotal = Math.abs(totalDebits - poTotal) < 0.01

  // Debit line operations
  const handleAddDebitLine = () => {
    const currentSum = debitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((poTotal - currentSum) * 100) / 100)
    const defaultAcc = accounts.find((a) => a.code === "1410-01") || accounts[0]
    onDebitLinesChange([
      ...debitLines,
      {
        id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || "1410-01",
        accountCode: defaultAcc?.code || "1410-01",
        accountName: defaultAcc?.name || "STOCK OF GREEN MUNG",
        description: reasonForPayment || "Purchase Cost Allocation",
        amount: remainder,
      },
    ])
  }

  const handleRemoveDebitLine = (id: string) => {
    if (debitLines.length <= 1) return
    onDebitLinesChange(debitLines.filter((l) => l.id !== id))
  }

  const handleUpdateDebitLine = (id: string, updates: Partial<SplitLineItem>) => {
    onDebitLinesChange(debitLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillDebit = (index: number) => {
    const otherSum = debitLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((poTotal - otherSum) * 100) / 100)
    onDebitLinesChange(debitLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  // Credit line operations
  const handleAddCreditLine = () => {
    const currentSum = creditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((poTotal - currentSum) * 100) / 100)
    const defaultAccCode = isCredit ? "2100-06" : "1000-02-26"
    const defaultAcc = accounts.find((a) => a.code === defaultAccCode) || accounts[0]
    onCreditLinesChange([
      ...creditLines,
      {
        id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultAccCode,
        accountCode: defaultAcc?.code || defaultAccCode,
        accountName: defaultAcc?.name || (isCredit ? "Other Accruals & Payables" : "CBE Bank Operating"),
        description: isCredit ? "Supplier Credit Settlement" : "Funding Account Split",
        amount: remainder,
      },
    ])
  }

  const handleRemoveCreditLine = (id: string) => {
    if (creditLines.length <= 1) return
    onCreditLinesChange(creditLines.filter((l) => l.id !== id))
  }

  const handleUpdateCreditLine = (id: string, updates: Partial<SplitLineItem>) => {
    onCreditLinesChange(creditLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillCredit = (index: number) => {
    const otherSum = creditLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((poTotal - otherSum) * 100) / 100)
    onCreditLinesChange(creditLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  return (
    <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/80 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/80 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950 flex items-center gap-1.5">
            <Layers className="size-4 text-emerald-600" />
            General Ledger COA Routing & Multi-Account Split
          </h3>
          <p className="text-[11px] font-medium text-zinc-500 mt-0.5">
            Select the specific General Ledger accounts hit by this transaction. You can add multiple debit accounts and multiple credit funding sources.
          </p>
        </div>

        {/* Live Balance Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {isBalanced && matchesPoTotal ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
              <CheckCircle2 className="size-3 text-emerald-600" /> Balanced
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
              <AlertTriangle className="size-3 text-amber-600" />
              {!isBalanced
                ? `Dr ≠ Cr (${difference.toFixed(2)} diff)`
                : `Diff from Total (${Math.abs(totalDebits - poTotal).toFixed(2)})`}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ═══════════ DEBIT SECTION ═══════════ */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Debit Accounts</h4>
              <span className="text-[10px] text-zinc-400 font-bold">({debitLines.length})</span>
            </div>
            <button
              type="button"
              onClick={handleAddDebitLine}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Plus className="size-3 text-emerald-600" /> Add Debit
            </button>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {debitLines.map((line, idx) => (
              <div key={line.id} className="p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
                  <span className="font-mono text-[10px] bg-zinc-200/80 px-1.5 py-0.5 rounded text-zinc-800">
                    DR #{idx + 1}
                  </span>
                  {debitLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDebitLine(line.id)}
                      className="text-zinc-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                      title="Remove line"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <COAAccountSelector
                    value={line.accountCode}
                    onChange={(acc) =>
                      handleUpdateDebitLine(line.id, {
                        accountId: acc.id,
                        accountCode: acc.code,
                        accountName: acc.name,
                      })
                    }
                    suggestedCodes={["1410-01", "1400-01", "1410-02", "1410-03", "6000-04", "6000-08", "8000-02"]}
                    placeholder="Select debit account..."
                    required
                  />

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={line.amount || ""}
                          onChange={(e) =>
                            handleUpdateDebitLine(line.id, {
                              amount: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      {debitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillDebit(idx)}
                          className="mt-0.5 text-[9px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sparkles className="size-2.5" /> Auto-fill remainder
                        </button>
                      )}
                    </div>

                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Memo / Line Description"
                        value={line.description}
                        onChange={(e) => handleUpdateDebitLine(line.id, { description: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-xs">
            <span className="font-bold text-zinc-500 uppercase text-[10px]">Total Debits:</span>
            <span className="font-mono font-black text-zinc-900">ETB {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* ═══════════ CREDIT SECTION ═══════════ */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" />
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Credit Accounts</h4>
              <span className="text-[10px] text-zinc-400 font-bold">({creditLines.length})</span>
            </div>
            <button
              type="button"
              onClick={handleAddCreditLine}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Plus className="size-3 text-blue-600" /> Add Credit
            </button>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {creditLines.map((line, idx) => (
              <div key={line.id} className="p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
                  <span className="font-mono text-[10px] bg-zinc-200/80 px-1.5 py-0.5 rounded text-zinc-800">
                    CR #{idx + 1}
                  </span>
                  {creditLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCreditLine(line.id)}
                      className="text-zinc-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                      title="Remove line"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <COAAccountSelector
                    value={line.accountCode}
                    onChange={(acc) =>
                      handleUpdateCreditLine(line.id, {
                        accountId: acc.id,
                        accountCode: acc.code,
                        accountName: acc.name,
                      })
                    }
                    suggestedCodes={
                      isCredit
                        ? ["2100-06", "2100-01", "2100-02", "2100-08"]
                        : ["1000-02-26", "1000-01-01", "1000-02-01", "1000-02-14", "1000-02-17"]
                    }
                    placeholder="Select credit account..."
                    required
                  />

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={line.amount || ""}
                          onChange={(e) =>
                            handleUpdateCreditLine(line.id, {
                              amount: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      {creditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillCredit(idx)}
                          className="mt-0.5 text-[9px] font-bold text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sparkles className="size-2.5" /> Auto-fill remainder
                        </button>
                      )}
                    </div>

                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Memo / Line Description"
                        value={line.description}
                        onChange={(e) => handleUpdateCreditLine(line.id, { description: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-xs">
            <span className="font-bold text-zinc-500 uppercase text-[10px]">Total Credits:</span>
            <span className="font-mono font-black text-zinc-900">ETB {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700">
        <div className="flex items-center gap-3">
          <span>Voucher Amount: <strong className="font-mono text-zinc-950">ETB {poTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          <span>Total Dr: <strong className="font-mono text-emerald-700">ETB {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          <span>Total Cr: <strong className="font-mono text-blue-700">ETB {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
        </div>
        <div>
          {isBalanced && matchesPoTotal ? (
            <span className="text-emerald-700 font-extrabold flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="size-3.5 text-emerald-600" /> Balanced (0.00 difference)
            </span>
          ) : (
            <span className="text-rose-600 font-extrabold flex items-center gap-1 text-[11px]">
              <AlertTriangle className="size-3.5 text-rose-600" />
              Unbalanced: difference is ETB {difference.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default PurchaseCOASplitSection
