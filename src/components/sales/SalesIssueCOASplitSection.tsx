import React, { useState } from "react"
import { Plus, Trash2, CheckCircle2, AlertTriangle, Sparkles, Layers, Box } from "lucide-react"
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

interface SalesIssueCOASplitSectionProps {
  subtotal: number
  vatAmount: number
  grandTotal: number
  totalCost: number
  warehouseId: string
  paymentType: "Cash" | "Credit"
  customerName: string
  revDebitLines: SplitLineItem[]
  revCreditLines: SplitLineItem[]
  cogsDebitLines: SplitLineItem[]
  cogsCreditLines: SplitLineItem[]
  onRevDebitLinesChange: (lines: SplitLineItem[]) => void
  onRevCreditLinesChange: (lines: SplitLineItem[]) => void
  onCogsDebitLinesChange: (lines: SplitLineItem[]) => void
  onCogsCreditLinesChange: (lines: SplitLineItem[]) => void
}

export const SalesIssueCOASplitSection: React.FC<SalesIssueCOASplitSectionProps> = ({
  subtotal: _subtotal,
  vatAmount: _vatAmount,
  grandTotal,
  totalCost,
  warehouseId,
  paymentType,
  customerName,
  revDebitLines,
  revCreditLines,
  cogsDebitLines,
  cogsCreditLines,
  onRevDebitLinesChange,
  onRevCreditLinesChange,
  onCogsDebitLinesChange,
  onCogsCreditLinesChange,
}) => {
  const financeStore = useFinanceStore()
  const accounts = financeStore.getAccounts()

  const [activeTab, setActiveTab] = useState<"revenue" | "cogs">("revenue")

  const isCredit = paymentType === "Credit"
  const isWh1 = String(warehouseId || "").toUpperCase().startsWith("WH1") || String(warehouseId || "").toUpperCase().includes("EXP")

  // Section A arithmetic
  const revTotalDebits = Math.round(revDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const revTotalCredits = Math.round(revCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const targetGrandTotal = Math.round((Number(grandTotal) || 0) * 100) / 100
  const revDiff = Math.round(Math.abs(revTotalDebits - revTotalCredits) * 100) / 100
  const isRevBalanced = revDiff < 0.01 && revTotalDebits > 0
  const matchesGrandTotal = Math.abs(revTotalDebits - targetGrandTotal) < 0.01

  // Section B arithmetic
  const cogsTotalDebits = Math.round(cogsDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const cogsTotalCredits = Math.round(cogsCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const targetCost = Math.round((Number(totalCost) || 0) * 100) / 100
  const cogsDiff = Math.round(Math.abs(cogsTotalDebits - cogsTotalCredits) * 100) / 100
  const isCogsBalanced = cogsDiff < 0.01 && (cogsTotalDebits > 0 || targetCost === 0)

  // Handlers for Section A (Revenue & Settlement)
  const handleAddRevDebit = () => {
    const currentSum = revDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetGrandTotal - currentSum) * 100) / 100)
    const defaultCode = isCredit ? (isWh1 ? "1300-01" : "1300-03") : "1000-02-26"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    onRevDebitLinesChange([
      ...revDebitLines,
      {
        id: `dr-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || "CBE Bank Operating",
        description: isCredit ? `Receivable - ${customerName}` : "Customer Direct Payment",
        amount: remainder,
      },
    ])
  }

  const handleRemoveRevDebit = (id: string) => {
    if (revDebitLines.length <= 1) return
    onRevDebitLinesChange(revDebitLines.filter((l) => l.id !== id))
  }

  const handleUpdateRevDebit = (id: string, updates: Partial<SplitLineItem>) => {
    onRevDebitLinesChange(revDebitLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillRevDebit = (index: number) => {
    const otherSum = revDebitLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetGrandTotal - otherSum) * 100) / 100)
    onRevDebitLinesChange(revDebitLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  const handleAddRevCredit = () => {
    const currentSum = revCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetGrandTotal - currentSum) * 100) / 100)
    const defaultCode = isWh1 ? "4000-02-01" : "4000-01-01"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    onRevCreditLinesChange([
      ...revCreditLines,
      {
        id: `cr-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || "Operating Sales Revenue",
        description: "Sales Revenue Recognition",
        amount: remainder,
      },
    ])
  }

  const handleRemoveRevCredit = (id: string) => {
    if (revCreditLines.length <= 1) return
    onRevCreditLinesChange(revCreditLines.filter((l) => l.id !== id))
  }

  const handleUpdateRevCredit = (id: string, updates: Partial<SplitLineItem>) => {
    onRevCreditLinesChange(revCreditLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillRevCredit = (index: number) => {
    const otherSum = revCreditLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetGrandTotal - otherSum) * 100) / 100)
    onRevCreditLinesChange(revCreditLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  // Handlers for Section B (Dynamic COGS & Inventory)
  const handleAddCogsDebit = () => {
    const currentSum = cogsDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCost - currentSum) * 100) / 100)
    const defaultCode = isWh1 ? "5010-01" : "5000-01"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    onCogsDebitLinesChange([
      ...cogsDebitLines,
      {
        id: `dr-cogs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || "Cost of Goods Sold",
        description: "Inventory Cost Expense",
        amount: remainder,
      },
    ])
  }

  const handleRemoveCogsDebit = (id: string) => {
    if (cogsDebitLines.length <= 1) return
    onCogsDebitLinesChange(cogsDebitLines.filter((l) => l.id !== id))
  }

  const handleUpdateCogsDebit = (id: string, updates: Partial<SplitLineItem>) => {
    onCogsDebitLinesChange(cogsDebitLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillCogsDebit = (index: number) => {
    const otherSum = cogsDebitLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCost - otherSum) * 100) / 100)
    onCogsDebitLinesChange(cogsDebitLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  const handleAddCogsCredit = () => {
    const currentSum = cogsCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCost - currentSum) * 100) / 100)
    const defaultCode = isWh1 ? "1410-01" : "1400-01"
    const defaultAcc = accounts.find((a) => a.code === defaultCode) || accounts[0]
    onCogsCreditLinesChange([
      ...cogsCreditLines,
      {
        id: `cr-cogs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || defaultCode,
        accountCode: defaultAcc?.code || defaultCode,
        accountName: defaultAcc?.name || "Inventory Asset",
        description: "Inventory Stock Derecognition",
        amount: remainder,
      },
    ])
  }

  const handleRemoveCogsCredit = (id: string) => {
    if (cogsCreditLines.length <= 1) return
    onCogsCreditLinesChange(cogsCreditLines.filter((l) => l.id !== id))
  }

  const handleUpdateCogsCredit = (id: string, updates: Partial<SplitLineItem>) => {
    onCogsCreditLinesChange(cogsCreditLines.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillCogsCredit = (index: number) => {
    const otherSum = cogsCreditLines.filter((_, i) => i !== index).reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((targetCost - otherSum) * 100) / 100)
    onCogsCreditLinesChange(cogsCreditLines.map((l, i) => (i === index ? { ...l, amount: remainder } : l)))
  }

  return (
    <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/80 space-y-3">
      {/* Header with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/80 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950 flex items-center gap-1.5">
            <Layers className="size-4 text-emerald-600" />
            Accounting & COA Distribution (Multi-Account Split)
          </h3>
          <p className="text-[11px] font-medium text-zinc-500 mt-0.5">
            Configure settlement, revenue, tax, and dynamic inventory COGS accounts for this sales transaction.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-200/70 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("revenue")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "revenue" ? "bg-white text-zinc-950 shadow-2xs font-black" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Layers className="size-3.5 text-emerald-600" />
            Revenue & Settlement
            {isRevBalanced && matchesGrandTotal ? (
              <span className="size-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cogs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "cogs" ? "bg-white text-zinc-950 shadow-2xs font-black" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Box className="size-3.5 text-blue-600" />
            Dynamic COGS & Inventory
            {isCogsBalanced ? (
              <span className="size-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* ═══════════ TAB 1: REVENUE & SETTLEMENT ═══════════ */}
      {activeTab === "revenue" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Debit (Cash / Bank / AR) */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Debit: Settlement / AR</h4>
                  <span className="text-[10px] text-zinc-400 font-bold">({revDebitLines.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddRevDebit}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <Plus className="size-3 text-emerald-600" /> Add Debit
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {revDebitLines.map((line, idx) => (
                  <div key={line.id} className="p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
                      <span className="font-mono text-[10px] bg-zinc-200/80 px-1.5 py-0.5 rounded text-zinc-800">
                        DR #{idx + 1}
                      </span>
                      {revDebitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRevDebit(line.id)}
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
                          handleUpdateRevDebit(line.id, {
                            accountId: acc.id,
                            accountCode: acc.code,
                            accountName: acc.name,
                          })
                        }
                        suggestedCodes={
                          isCredit
                            ? ["1300-01", "1300-03", "1300-02"]
                            : ["1000-02-26", "1000-01-01", "1000-02-01", "1000-02-14"]
                        }
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
                                handleUpdateRevDebit(line.id, {
                                  amount: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          {revDebitLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleAutoFillRevDebit(idx)}
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
                            onChange={(e) => handleUpdateRevDebit(line.id, { description: e.target.value })}
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
                <span className="font-mono font-black text-zinc-900">ETB {revTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Right: Credit (Revenue & Tax) */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" />
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Credit: Revenue & Tax</h4>
                  <span className="text-[10px] text-zinc-400 font-bold">({revCreditLines.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddRevCredit}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <Plus className="size-3 text-blue-600" /> Add Credit
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {revCreditLines.map((line, idx) => (
                  <div key={line.id} className="p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
                      <span className="font-mono text-[10px] bg-zinc-200/80 px-1.5 py-0.5 rounded text-zinc-800">
                        CR #{idx + 1}
                      </span>
                      {revCreditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRevCredit(line.id)}
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
                          handleUpdateRevCredit(line.id, {
                            accountId: acc.id,
                            accountCode: acc.code,
                            accountName: acc.name,
                          })
                        }
                        suggestedCodes={
                          isWh1
                            ? ["4000-02-01", "4000-02-02", "4000-02-03", "4000-02-04", "2000-05"]
                            : ["4000-01-01", "4000-03-01", "4000-03-02", "2000-05"]
                        }
                        placeholder="Select revenue account..."
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
                                handleUpdateRevCredit(line.id, {
                                  amount: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          {revCreditLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleAutoFillRevCredit(idx)}
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
                            onChange={(e) => handleUpdateRevCredit(line.id, { description: e.target.value })}
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
                <span className="font-mono font-black text-zinc-900">ETB {revTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Section A Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700">
            <div className="flex items-center gap-3">
              <span>Total Payable: <strong className="font-mono text-zinc-950">ETB {targetGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
              <span>Debits: <strong className="font-mono text-emerald-700">ETB {revTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
              <span>Credits: <strong className="font-mono text-blue-700">ETB {revTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
            </div>
            <div>
              {isRevBalanced && matchesGrandTotal ? (
                <span className="text-emerald-700 font-extrabold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="size-3.5 text-emerald-600" /> Revenue & Settlement Balanced
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="size-3.5 text-rose-600" />
                  {!isRevBalanced
                    ? `Dr ≠ Cr (${revDiff.toFixed(2)} diff)`
                    : `Diff from Payable (${Math.abs(revTotalDebits - targetGrandTotal).toFixed(2)})`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ TAB 2: DYNAMIC COGS & INVENTORY COST ═══════════ */}
      {activeTab === "cogs" && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium">
            <strong>Dynamic COGS & Stock Derecognition:</strong> The total inventory cost of this sale is estimated at{" "}
            <strong className="font-mono font-black">ETB {targetCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> based on FIFO/batch costs. You can select the specific COGS expense accounts and inventory asset accounts hit by this shipment.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Debit (COGS Expense) */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-purple-500" />
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Debit: COGS Expense</h4>
                  <span className="text-[10px] text-zinc-400 font-bold">({cogsDebitLines.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddCogsDebit}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <Plus className="size-3 text-purple-600" /> Add COGS Debit
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {cogsDebitLines.map((line, idx) => (
                  <div key={line.id} className="p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
                      <span className="font-mono text-[10px] bg-zinc-200/80 px-1.5 py-0.5 rounded text-zinc-800">
                        COGS DR #{idx + 1}
                      </span>
                      {cogsDebitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCogsDebit(line.id)}
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
                          handleUpdateCogsDebit(line.id, {
                            accountId: acc.id,
                            accountCode: acc.code,
                            accountName: acc.name,
                          })
                        }
                        suggestedCodes={
                          isWh1
                            ? ["5010-01", "5010-02", "5010-03", "5010-04"]
                            : ["5000-01", "5000-02", "5000-03"]
                        }
                        placeholder="Select COGS account..."
                        required
                      />

                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.amount || ""}
                            onChange={(e) =>
                              handleUpdateCogsDebit(line.id, {
                                amount: e.target.value === "" ? 0 : Number(e.target.value),
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          {cogsDebitLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleAutoFillCogsDebit(idx)}
                              className="mt-0.5 text-[9px] font-bold text-purple-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Sparkles className="size-2.5" /> Auto-fill remainder
                            </button>
                          )}
                        </div>

                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Memo"
                            value={line.description}
                            onChange={(e) => handleUpdateCogsDebit(line.id, { description: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-500 uppercase text-[10px]">Total COGS Debits:</span>
                <span className="font-mono font-black text-zinc-900">ETB {cogsTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Right: Credit (Inventory Asset) */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Credit: Inventory Asset</h4>
                  <span className="text-[10px] text-zinc-400 font-bold">({cogsCreditLines.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddCogsCredit}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <Plus className="size-3 text-amber-600" /> Add Inv Credit
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {cogsCreditLines.map((line, idx) => (
                  <div key={line.id} className="p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
                      <span className="font-mono text-[10px] bg-zinc-200/80 px-1.5 py-0.5 rounded text-zinc-800">
                        INV CR #{idx + 1}
                      </span>
                      {cogsCreditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCogsCredit(line.id)}
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
                          handleUpdateCogsCredit(line.id, {
                            accountId: acc.id,
                            accountCode: acc.code,
                            accountName: acc.name,
                          })
                        }
                        suggestedCodes={
                          isWh1
                            ? ["1410-01", "1410-02", "1410-03", "1410-04", "1410-05"]
                            : ["1400-01", "1400-02", "1400-03"]
                        }
                        placeholder="Select inventory stock account..."
                        required
                      />

                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.amount || ""}
                            onChange={(e) =>
                              handleUpdateCogsCredit(line.id, {
                                amount: e.target.value === "" ? 0 : Number(e.target.value),
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          {cogsCreditLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleAutoFillCogsCredit(idx)}
                              className="mt-0.5 text-[9px] font-bold text-amber-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Sparkles className="size-2.5" /> Auto-fill remainder
                            </button>
                          )}
                        </div>

                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Memo"
                            value={line.description}
                            onChange={(e) => handleUpdateCogsCredit(line.id, { description: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-500 uppercase text-[10px]">Total Inv Credits:</span>
                <span className="font-mono font-black text-zinc-900">ETB {cogsTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Section B Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700">
            <div className="flex items-center gap-3">
              <span>Target Cost: <strong className="font-mono text-zinc-950">ETB {targetCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
              <span>COGS Dr: <strong className="font-mono text-purple-700">ETB {cogsTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
              <span>Inv Cr: <strong className="font-mono text-amber-700">ETB {cogsTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
            </div>
            <div>
              {isCogsBalanced ? (
                <span className="text-emerald-700 font-extrabold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="size-3.5 text-emerald-600" /> COGS & Inventory Balanced
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="size-3.5 text-rose-600" />
                  COGS Unbalanced: difference is ETB {cogsDiff.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesIssueCOASplitSection
