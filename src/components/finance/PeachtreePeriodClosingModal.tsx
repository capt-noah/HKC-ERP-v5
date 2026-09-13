import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Lock,
  Unlock,
  ShieldCheck,
  Calendar,
  CheckCircle2,
} from "lucide-react"
import { useFinanceStore } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"

interface PeachtreePeriodClosingModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PeachtreePeriodClosingModal: React.FC<PeachtreePeriodClosingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const store = useFinanceStore()
  const { showToast, confirm } = useFeedback()

  const lockStatus = store.getPeriodLockStatus()
  const entries = store.getJournalEntries()

  // Default lock date: last day of previous month
  const defaultLockDate = useMemo(() => {
    const now = new Date()
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 86400000)
    return lastOfPrevMonth.toISOString().slice(0, 10)
  }, [])

  const [lockDate, setLockDate] = useState<string>(lockStatus.locked_until_date || defaultLockDate)
  const [reason, setReason] = useState<string>(
    lockStatus.reason || "Monthly accounting period closed & bank reconciled."
  )
  const [isProcessing, setIsProcessing] = useState(false)

  // Current year monthly periods breakdown
  const currentYear = new Date().getFullYear()
  const monthlyPeriods = useMemo(() => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]

    return months.map((name, index) => {
      const monthNum = String(index + 1).padStart(2, "0")
      const startDate = `${currentYear}-${monthNum}-01`
      const lastDay = new Date(currentYear, index + 1, 0).getDate()
      const endDate = `${currentYear}-${monthNum}-${String(lastDay).padStart(2, "0")}`

      // Count entries in this period
      const jeCount = entries.filter((e) => e.entry_date >= startDate && e.entry_date <= endDate).length

      // Check if locked
      const isLocked = Boolean(
        lockStatus.locked_until_date && lockStatus.locked_until_date >= endDate
      )

      return {
        periodNumber: index + 1,
        name,
        startDate,
        endDate,
        jeCount,
        isLocked,
      }
    })
  }, [currentYear, entries, lockStatus.locked_until_date])

  if (!isOpen) return null

  const handleLock = (targetDate?: string) => {
    const effectiveDate = targetDate || lockDate
    if (!effectiveDate) {
      showToast("Select Date", "warning", "Please specify a valid lock date.")
      return
    }

    confirm({
      title: "Lock Accounting Period?",
      message: `Are you sure you want to lock the general ledger through ${effectiveDate}? Once locked, any attempt to post, edit, or backdate journal entries on or before this date will be blocked by system security rules.`,
      confirmLabel: "Lock Period Now",
      isDestructive: true,
      onConfirm: () => {
        setIsProcessing(true)
        try {
          store.lockPeriod(effectiveDate, reason)
          showToast(
            "Period Locked",
            "success",
            `All general ledger postings on or before ${effectiveDate} are now securely locked.`
          )
        } catch (err: any) {
          showToast("Error", "warning", err.message || "Failed to lock period.")
        } finally {
          setIsProcessing(false)
        }
      },
    })
  }

  const handleUnlock = () => {
    confirm({
      title: "Unlock Accounting Period?",
      message:
        "Unlocking the accounting period allows backdated postings and adjustments to historical records. Do you wish to proceed?",
      confirmLabel: "Unlock Periods",
      isDestructive: false,
      onConfirm: () => {
        setIsProcessing(true)
        try {
          store.unlockPeriod()
          showToast("Periods Unlocked", "info", "Fiscal lock has been removed. Historical entries can now be modified.")
        } catch (err: any) {
          showToast("Error", "warning", err.message || "Failed to unlock periods.")
        } finally {
          setIsProcessing(false)
        }
      },
    })
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-2xl ${
                  lockStatus.is_locked ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {lockStatus.is_locked ? <Lock className="size-5" /> : <Unlock className="size-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-zinc-900">Fiscal Period Lock & Closing</h2>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                    Peachtree Audit Guard
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Enforce accounting closure dates to prevent tampering or backdating of historical records.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status Banner */}
            {lockStatus.is_locked ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-200 text-amber-900 mt-0.5 sm:mt-0">
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-amber-900 block">
                      General Ledger Locked Through {lockStatus.locked_until_date}
                    </span>
                    <span className="text-xs text-amber-800 block mt-0.5 font-medium">
                      Reason: {lockStatus.reason || "Period closed"}
                    </span>
                    <span className="text-[10px] text-amber-700 block mt-1">
                      Any new voucher or retroactive posting with an entry date on or prior to this date is blocked.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100 shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
                >
                  <Unlock className="size-3.5" /> Unlock Period
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-200 text-emerald-900">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-emerald-900 block">
                      All Accounting Periods Are Currently Open
                    </span>
                    <span className="text-[11px] text-emerald-700 block font-medium">
                      Transactions may be posted to any date. Lock prior periods after monthly reconciliation.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Lock Control Form */}
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="size-4 text-zinc-600" />
                  Set Period Lock Date
                </h3>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      const d = new Date(now.getFullYear(), now.getMonth(), 0)
                      setLockDate(d.toISOString().slice(0, 10))
                    }}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold"
                  >
                    Last Month End
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      const qMonth = Math.floor(now.getMonth() / 3) * 3
                      const d = new Date(now.getFullYear(), qMonth, 0)
                      setLockDate(d.toISOString().slice(0, 10))
                    }}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold"
                  >
                    Prior Quarter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      setLockDate(`${now.getFullYear() - 1}-12-31`)
                    }}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold"
                  >
                    Prior Year End
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Lock Books Through (Inclusive)</label>
                  <input
                    type="date"
                    value={lockDate}
                    onChange={(e) => setLockDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Audit Closing Memo / Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Month-end close & bank reconciliation audited"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleLock()}
                  disabled={isProcessing || !lockDate}
                  className="px-5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-white font-black text-xs shadow-sm flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  {isProcessing ? <LoadingDots /> : <Lock className="size-3.5" />}
                  Lock Books Through {lockDate}
                </button>
              </div>
            </div>

            {/* Fiscal Periods Grid for Current Year */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                  Fiscal Year {currentYear} Periods
                </h3>
                <span className="text-[11px] text-zinc-500 font-medium">
                  Click &quot;Lock Through&quot; on any month to immediately close through that period end.
                </span>
              </div>

              <TableScrollWrapper>
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Period #</th>
                      <th className="px-4 py-2.5">Month</th>
                      <th className="px-4 py-2.5">Date Range</th>
                      <th className="px-4 py-2.5 text-center">Posted Vouchers</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {monthlyPeriods.map((p) => (
                      <tr key={p.periodNumber} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-zinc-500">P{p.periodNumber}</td>
                        <td className="px-4 py-2.5 font-bold text-zinc-900">{p.name}</td>
                        <td className="px-4 py-2.5 font-mono text-zinc-600 text-[11px]">
                          {p.startDate} to {p.endDate}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-zinc-800">
                          {p.jeCount}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              <Lock className="size-2.5 text-amber-700" /> Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="size-2.5 text-emerald-600" /> Open
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleLock(p.endDate)}
                            disabled={isProcessing || p.isLocked}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                              p.isLocked
                                ? "text-zinc-300 cursor-not-allowed"
                                : "bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 cursor-pointer shadow-2xs"
                            }`}
                          >
                            Lock Through {p.endDate}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScrollWrapper>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
