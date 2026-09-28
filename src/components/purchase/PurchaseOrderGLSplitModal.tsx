import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRightLeft, Sparkles } from "lucide-react"
import { type PurchaseOrder, type VoucherAccountRow, useErpStore } from "@/lib/erpStore"
import { useFinanceStore } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import COAAccountSelector from "@/components/finance/COAAccountSelector"
import { LoadingDots } from "@/components/ui/LoadingDots"

interface PurchaseOrderGLSplitModalProps {
  isOpen: boolean
  onClose: () => void
  purchaseOrder: PurchaseOrder | null
  onSaveSuccess?: () => void
}

interface SplitLineItem {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  description: string
  amount: number
}

export const PurchaseOrderGLSplitModal: React.FC<PurchaseOrderGLSplitModalProps> = ({
  isOpen,
  onClose,
  purchaseOrder,
  onSaveSuccess,
}) => {
  const { showToast } = useFeedback()
  const erpStore = useErpStore()
  const financeStore = useFinanceStore()
  const accounts = financeStore.getAccounts()

  const [debitLines, setDebitLines] = useState<SplitLineItem[]>([])
  const [creditLines, setCreditLines] = useState<SplitLineItem[]>([])
  const [auditNote, setAuditNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Initialize modal state whenever a PO is opened
  useEffect(() => {
    if (!purchaseOrder) return

    const poAmount = Number(purchaseOrder.amount || 0)
    const existingEntries = purchaseOrder.accountEntries || []

    const existingDebits = existingEntries.filter((e) => Number(e.debit) > 0)
    const existingCredits = existingEntries.filter((e) => Number(e.credit) > 0)

    // Set debit lines
    if (existingDebits.length > 0) {
      setDebitLines(
        existingDebits.map((e, idx) => ({
          id: e.id || `dr-${idx}-${Date.now()}`,
          accountId: e.accountId || `ACC-${e.accountCode}`,
          accountCode: e.accountCode,
          accountName: e.accountName || "Account " + e.accountCode,
          description: e.description || purchaseOrder.reasonForPayment || "Purchase Allocation",
          amount: Number(e.debit) || 0,
        }))
      )
    } else {
      const defaultDrCode = purchaseOrder.targetAccountCode || "1410-01"
      const defaultDrAcc = accounts.find((a) => a.code === defaultDrCode || a.id === purchaseOrder.targetAccountId)
      setDebitLines([
        {
          id: `dr-init-${Date.now()}`,
          accountId: defaultDrAcc?.id || purchaseOrder.targetAccountId || `ACC-${defaultDrCode}`,
          accountCode: defaultDrAcc?.code || defaultDrCode,
          accountName: defaultDrAcc?.name || purchaseOrder.targetAccountName || "Stock of Green Mung",
          description: purchaseOrder.reasonForPayment || "Procurement Goods Receipt",
          amount: poAmount,
        },
      ])
    }

    // Set credit lines
    if (existingCredits.length > 0) {
      setCreditLines(
        existingCredits.map((e, idx) => ({
          id: e.id || `cr-${idx}-${Date.now()}`,
          accountId: e.accountId || `ACC-${e.accountCode}`,
          accountCode: e.accountCode,
          accountName: e.accountName || "Account " + e.accountCode,
          description: e.description || (purchaseOrder.paymentType === "Credit" ? "Accounts Payable" : "Bank Disbursement"),
          amount: Number(e.credit) || 0,
        }))
      )
    } else {
      const isCreditPo = (purchaseOrder.paymentType || purchaseOrder.payment_type) === "Credit"
      const defaultCrCode = purchaseOrder.creditAccountCode || (isCreditPo ? "2100-06" : "1000-02-26")
      const defaultCrAcc = accounts.find((a) => a.code === defaultCrCode || a.id === purchaseOrder.creditAccountId)
      setCreditLines([
        {
          id: `cr-init-${Date.now()}`,
          accountId: defaultCrAcc?.id || purchaseOrder.creditAccountId || `ACC-${defaultCrCode}`,
          accountCode: defaultCrAcc?.code || defaultCrCode,
          accountName: defaultCrAcc?.name || purchaseOrder.creditAccountName || (isCreditPo ? "Other Accruals / AP" : "CBE Bank Operating"),
          description: isCreditPo ? "Accounts Payable Liability" : "Bank Disbursement",
          amount: poAmount,
        },
      ])
    }

    setAuditNote("")
  }, [purchaseOrder, accounts])

  if (!isOpen || !purchaseOrder) return null

  // Rounding-safe arithmetic
  const totalDebits = Math.round(debitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const totalCredits = Math.round(creditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const difference = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100
  const isBalanced = difference < 0.001 && totalDebits > 0
  const poTotal = Number(purchaseOrder.amount || 0)
  const matchesPoTotal = Math.round(Math.abs(totalDebits - poTotal) * 100) / 100 < 0.001

  // Debit line operations
  const handleAddDebitLine = () => {
    const currentSum = debitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((poTotal - currentSum) * 100) / 100)
    setDebitLines((prev) => [
      ...prev,
      {
        id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: "1410-01",
        accountCode: "1410-01",
        accountName: "STOCK OF GREEN MUNG",
        description: "Procurement Split Allocation",
        amount: remainder,
      },
    ])
  }

  const handleRemoveDebitLine = (id: string) => {
    if (debitLines.length <= 1) {
      showToast("Cannot Delete", "warning", "At least one debit ledger line is required.")
      return
    }
    setDebitLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleUpdateDebitLine = (id: string, updates: Partial<SplitLineItem>) => {
    setDebitLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  // Credit line operations
  const handleAddCreditLine = () => {
    const currentSum = creditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((poTotal - currentSum) * 100) / 100)
    setCreditLines((prev) => [
      ...prev,
      {
        id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: "1000-02-26",
        accountCode: "1000-02-26",
        accountName: "CBE_ECB_AC_1000465135224",
        description: "Funding Account Split",
        amount: remainder,
      },
    ])
  }

  const handleRemoveCreditLine = (id: string) => {
    if (creditLines.length <= 1) {
      showToast("Cannot Delete", "warning", "At least one credit funding line is required.")
      return
    }
    setCreditLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleUpdateCreditLine = (id: string, updates: Partial<SplitLineItem>) => {
    setCreditLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  // Auto-fill remainder on a specific debit line
  const handleAutoFillDebit = (index: number) => {
    const otherSum = debitLines
      .filter((_, idx) => idx !== index)
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const needed = Math.max(0, Math.round((poTotal - otherSum) * 100) / 100)
    setDebitLines((prev) =>
      prev.map((l, idx) => (idx === index ? { ...l, amount: needed } : l))
    )
  }

  // Auto-fill remainder on a specific credit line
  const handleAutoFillCredit = (index: number) => {
    const otherSum = creditLines
      .filter((_, idx) => idx !== index)
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const needed = Math.max(0, Math.round((totalDebits - otherSum) * 100) / 100)
    setCreditLines((prev) =>
      prev.map((l, idx) => (idx === index ? { ...l, amount: needed } : l))
    )
  }

  // Save Split & Sync to GL
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return

    if (!isBalanced) {
      showToast(
        "Ledger Unbalanced",
        "warning",
        `Total debits (ETB ${totalDebits.toLocaleString()}) must equal total credits (ETB ${totalCredits.toLocaleString()}). Difference is ETB ${difference.toFixed(2)}.`
      )
      return
    }

    // Check for 0 amounts
    const hasZeroDebit = debitLines.some((l) => Number(l.amount) <= 0)
    const hasZeroCredit = creditLines.some((l) => Number(l.amount) <= 0)
    if (hasZeroDebit || hasZeroCredit) {
      showToast("Invalid Amount", "warning", "Each split line must have an amount greater than zero.")
      return
    }

    setIsSaving(true)
    try {
      const voucherRows: VoucherAccountRow[] = [
        ...debitLines.map((l) => ({
          id: l.id,
          accountId: l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          description: l.description.trim() || purchaseOrder.reasonForPayment || "Purchase GL Debit Distribution",
          debit: Number(l.amount),
          credit: 0,
        })),
        ...creditLines.map((l) => ({
          id: l.id,
          accountId: l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          description: l.description.trim() || "Payment Funding Distribution",
          debit: 0,
          credit: Number(l.amount),
        })),
      ]

      const firstDebit = debitLines[0]
      const firstCredit = creditLines[0]

      const res = erpStore.updatePurchaseOrderGLDistribution(purchaseOrder.id, voucherRows, {
        targetAccountId: firstDebit.accountId,
        targetAccountCode: firstDebit.accountCode,
        targetAccountName: firstDebit.accountName,
        creditAccountId: firstCredit.accountId,
        creditAccountCode: firstCredit.accountCode,
        creditAccountName: firstCredit.accountName,
        notes: auditNote.trim() || undefined,
      })

      if (!res.success) {
        throw new Error(res.error || "Failed to update GL distribution")
      }

      showToast(
        "GL Split Saved & Posted",
        "success",
        `General ledger distribution for PO #${purchaseOrder.voucherNo || purchaseOrder.poNumber} has been updated across ${debitLines.length} debit and ${creditLines.length} credit accounts.`
      )

      if (onSaveSuccess) onSaveSuccess()
      onClose()
    } catch (err: any) {
      console.error("Save GL split error:", err)
      showToast("Save Failed", "warning", err.message || "Could not save GL distribution.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 bg-white rounded-3xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                  <ArrowRightLeft className="size-3 text-purple-700" />
                  Finance GL Distribution & Split
                </span>
                <span className="text-xs font-mono font-bold text-zinc-500">
                  {purchaseOrder.voucherNo || purchaseOrder.poNumber}
                </span>
              </div>
              <h2 className="text-lg font-black text-zinc-950">
                Maintain General Ledger Accounts & Transaction Split
              </h2>
              <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                Vendor: <span className="text-zinc-800 font-bold">{purchaseOrder.paidTo || purchaseOrder.supplier}</span> &bull; PO Total: <span className="font-mono font-black text-emerald-700">ETB {poTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-5 pt-4">
            {/* Section 1: DEBIT SPLIT LINES (Asset / Expense / Cost) */}
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Debit Account Split (Inventory / Expense / Costs)
                  </h3>
                  <p className="text-[11px] font-medium text-zinc-500">
                    Allocate the purchase cost across one or more inventory, direct cost, or operating expense accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDebitLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5 text-emerald-600" /> Add Debit Line
                </button>
              </div>

              <div className="space-y-3">
                {debitLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black font-mono bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                          DR #{idx + 1}
                        </span>
                        <span>Debit Allocation</span>
                      </span>
                      {debitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDebitLine(line.id)}
                          className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Remove split line"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                      <div className="md:col-span-6">
                        <COAAccountSelector
                          label="Target COA Account"
                          value={line.accountCode}
                          onChange={(acc) =>
                            handleUpdateDebitLine(line.id, {
                              accountId: acc.id,
                              accountCode: acc.code,
                              accountName: acc.name,
                            })
                          }
                          suggestedCodes={["1410-01", "1400-01", "6000-04", "6000-08", "8000-07", "8000-30"]}
                          placeholder="Select debit account..."
                          required
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Amount (ETB) *
                        </label>
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
                            className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        {debitLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleAutoFillDebit(idx)}
                            className="mt-1 text-[10px] font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="size-3" /> Auto-fill remainder
                          </button>
                        )}
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Line Memo / Purpose
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Inward transport cost"
                          value={line.description}
                          onChange={(e) => handleUpdateDebitLine(line.id, { description: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: CREDIT SPLIT LINES (Bank / Cash / Accounts Payable) */}
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-blue-500" />
                    Credit Account Split (Funding Bank / Cash / AP Liability)
                  </h3>
                  <p className="text-[11px] font-medium text-zinc-500">
                    Source of payment disbursement (e.g. Bank Account, Petty Cash) or Trade Payable liability.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCreditLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5 text-blue-600" /> Add Credit Line
                </button>
              </div>

              <div className="space-y-3">
                {creditLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black font-mono bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                          CR #{idx + 1}
                        </span>
                        <span>Credit Disbursement</span>
                      </span>
                      {creditLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCreditLine(line.id)}
                          className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Remove split line"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                      <div className="md:col-span-6">
                        <COAAccountSelector
                          label="Funding / Liability Account"
                          value={line.accountCode}
                          onChange={(acc) =>
                            handleUpdateCreditLine(line.id, {
                              accountId: acc.id,
                              accountCode: acc.code,
                              accountName: acc.name,
                            })
                          }
                          suggestedCodes={["1000-02-26", "1000-01-01", "1000-02-01", "1000-02-14", "2100-06"]}
                          placeholder="Select credit account..."
                          required
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Amount (ETB) *
                        </label>
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
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        {creditLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleAutoFillCredit(idx)}
                            className="mt-1 text-[10px] font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="size-3" /> Auto-fill remainder
                          </button>
                        )}
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Disbursement Note
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CBE online transfer"
                          value={line.description}
                          onChange={(e) => handleUpdateCreditLine(line.id, { description: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: REAL-TIME VALIDATION & BALANCE CARD */}
            <div
              className={`rounded-2xl p-4 border transition-colors ${
                isBalanced
                  ? "bg-emerald-50/70 border-emerald-200"
                  : "bg-rose-50/70 border-rose-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isBalanced ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {isBalanced ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <AlertTriangle className="size-5" />
                    )}
                  </div>
                  <div>
                    <h4
                      className={`text-xs font-black uppercase tracking-wider ${
                        isBalanced ? "text-emerald-950" : "text-rose-950"
                      }`}
                    >
                      {isBalanced ? "Double-Entry Ledger Balanced" : "Double-Entry Ledger Unbalanced"}
                    </h4>
                    <p
                      className={`text-xs font-medium ${
                        isBalanced ? "text-emerald-800" : "text-rose-800"
                      }`}
                    >
                      {isBalanced
                        ? `Debits and credits are perfectly balanced with ETB 0.00 difference.`
                        : `Debits and credits must be equal. Currently out of balance by ETB ${difference.toFixed(2)}.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono font-bold bg-white/80 px-4 py-2 rounded-xl border border-zinc-200 shrink-0">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">TOTAL DEBITS</span>
                    <span className="text-zinc-950 font-black">
                      ETB {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-zinc-200" />
                  <div>
                    <span className="text-zinc-500 text-[10px] block">TOTAL CREDITS</span>
                    <span className="text-zinc-950 font-black">
                      ETB {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {!matchesPoTotal && isBalanced && (
                <div className="mt-2.5 pt-2.5 border-t border-emerald-200/60 text-[11px] font-semibold text-emerald-900 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-600" />
                  Note: The total split amount (ETB {totalDebits.toLocaleString()}) differs from the original PO amount (ETB {poTotal.toLocaleString()}). This is permitted if adjusting for landed freight or supplier adjustments.
                </div>
              )}
            </div>

            {/* Section 4: Audit Notes */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Finance Re-allocation / Split Audit Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Reclassified freight & bag costs separately for landed cost tracking"
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium outline-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isBalanced || isSaving}
                className={`px-5 py-2 rounded-full text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                  isBalanced && !isSaving
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200"
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                }`}
              >
                {isSaving ? (
                  <LoadingDots color="bg-white" size="sm" />
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Save & Post GL Distribution
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default PurchaseOrderGLSplitModal
