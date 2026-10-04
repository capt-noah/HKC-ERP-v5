import React from "react"
import { Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRightLeft } from "lucide-react"
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

  const totalDebits = Math.round(debitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const totalCredits = Math.round(creditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const poTotal = Math.round((Number(totalAmount) || 0) * 100) / 100
  const difference = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100
  const isBalanced = difference < 0.01 && totalDebits > 0
  const matchesPoTotal = Math.abs(totalDebits - poTotal) < 0.01

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
        description: reasonForPayment || "Purchase Allocation",
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
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-zinc-700" />
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
            Accounting & COA Account Allocation
          </h4>
        </div>

        {/* Balance Status */}
        {isBalanced && matchesPoTotal ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300">
            <CheckCircle2 className="size-3 text-emerald-600" /> Balanced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black border border-amber-300">
            <AlertTriangle className="size-3 text-amber-600" />
            {!isBalanced
              ? `Unbalanced (Diff: ETB ${difference.toFixed(2)})`
              : `Diff from Total (ETB ${Math.abs(totalDebits - poTotal).toFixed(2)})`}
          </span>
        )}
      </div>

      {/* Two Clean Columns: Debit Accounts & Credit Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ═══ DEBIT SECTION ═══ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-zinc-800 uppercase tracking-wide flex items-center gap-1.5 shrink-0">
              <span className="size-2 rounded-full bg-emerald-500" />
              Debit Accounts (Asset / Expense)
            </span>
            <button
              type="button"
              onClick={handleAddDebitLine}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="size-3" /> Add Debit
            </button>
          </div>

          <div className="space-y-2">
            {debitLines.map((line, idx) => (
              <div
                key={line.id}
                className="p-2 rounded-xl bg-white border border-zinc-200 shadow-2xs space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <COAAccountSelector
                      value={line.accountCode}
                      onChange={(acc) =>
                        handleUpdateDebitLine(line.id, {
                          accountId: acc.id,
                          accountCode: acc.code,
                          accountName: acc.name,
                        })
                      }
                      placeholder="Select debit account..."
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
                        handleUpdateDebitLine(line.id, {
                          amount: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 h-[34px] rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 text-right outline-none focus:bg-white focus:border-emerald-500"
                    />
                  </div>

                  {debitLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDebitLine(line.id)}
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
                    onChange={(e) => handleUpdateDebitLine(line.id, { description: e.target.value })}
                    className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-zinc-300 focus:bg-white text-zinc-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoFillDebit(idx)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 shrink-0 px-1 py-0.5 cursor-pointer"
                    title="Fill remaining balance into this line"
                  >
                    Auto-fill
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs px-1 pt-1 font-mono">
            <span className="text-zinc-500 font-sans font-bold">Total Debits:</span>
            <span className="font-black text-zinc-900">
              ETB {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ═══ CREDIT SECTION ═══ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-zinc-800 uppercase tracking-wide flex items-center gap-1.5 shrink-0">
              <span className="size-2 rounded-full bg-blue-500" />
              {isCredit ? "Credit Accounts (Accounts Payable)" : "Credit Accounts (Bank / Cash)"}
            </span>
            <button
              type="button"
              onClick={handleAddCreditLine}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="size-3" /> Add Credit
            </button>
          </div>

          <div className="space-y-2">
            {creditLines.map((line, idx) => (
              <div
                key={line.id}
                className="p-2 rounded-xl bg-white border border-zinc-200 shadow-2xs space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <COAAccountSelector
                      value={line.accountCode}
                      onChange={(acc) =>
                        handleUpdateCreditLine(line.id, {
                          accountId: acc.id,
                          accountCode: acc.code,
                          accountName: acc.name,
                        })
                      }
                      placeholder={isCredit ? "Select AP account..." : "Select bank/cash account..."}
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
                        handleUpdateCreditLine(line.id, {
                          amount: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 h-[34px] rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 text-right outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  {creditLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCreditLine(line.id)}
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
                    onChange={(e) => handleUpdateCreditLine(line.id, { description: e.target.value })}
                    className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-zinc-300 focus:bg-white text-zinc-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoFillCredit(idx)}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 shrink-0 px-1 py-0.5 cursor-pointer"
                    title="Fill remaining balance into this line"
                  >
                    Auto-fill
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs px-1 pt-1 font-mono">
            <span className="text-zinc-500 font-sans font-bold">Total Credits:</span>
            <span className="font-black text-zinc-900">
              ETB {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PurchaseCOASplitSection
