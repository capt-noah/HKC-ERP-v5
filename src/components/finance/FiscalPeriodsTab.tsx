import { useState, useMemo } from "react"
import {
  Lock,
  Unlock,
  Calendar,
  CalendarCheck,
  ShieldCheck,
  Clock,
  ArrowRight,
} from "lucide-react"
import { useFinanceStore } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import { GlassCard } from "@/components/GlassCard"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { cn } from "@/lib/utils"

export default function FiscalPeriodsTab() {
  const store = useFinanceStore()
  const { showToast, confirm } = useFeedback()

  const lockStatus = store.getPeriodLockStatus()
  const entries = store.getJournalEntries()
  const currentYear = new Date().getFullYear()

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

  // 12-Month Schedule Breakdown
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

  // Count protected entries
  const protectedVoucherCount = useMemo(() => {
    if (!lockStatus.locked_until_date) return 0
    return entries.filter((e) => e.entry_date <= lockStatus.locked_until_date!).length
  }, [entries, lockStatus.locked_until_date])

  const lockedPeriodsCount = monthlyPeriods.filter((p) => p.isLocked).length
  const openPeriodsCount = 12 - lockedPeriodsCount

  const handleLock = (targetDate?: string, customReason?: string) => {
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
          store.lockPeriod(effectiveDate, customReason || reason)
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
    <div className="flex flex-col gap-6">
      {/* 1. KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 rounded-3xl bg-white/80 border border-white/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Fiscal Year</span>
            <div className="text-2xl font-black text-zinc-950 font-mono mt-0.5">{currentYear}</div>
            <span className="text-[11px] text-zinc-500 font-medium">12 Accounting Periods</span>
          </div>
          <div className="size-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600">
            <Calendar className="size-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-3xl bg-white/80 border border-white/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Current Lock State</span>
            <div className={cn(
              "text-lg font-black mt-0.5 flex items-center gap-1.5",
              lockStatus.is_locked ? "text-amber-800" : "text-emerald-700"
            )}>
              {lockStatus.is_locked ? (
                <>
                  <Lock className="size-4 text-amber-700" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="size-4 text-emerald-600" />
                  <span>Open (No Lock)</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-zinc-500 font-medium truncate block max-w-[170px]">
              {lockStatus.is_locked ? `Through ${lockStatus.locked_until_date}` : "Backdating permitted"}
            </span>
          </div>
          <div className={cn(
            "size-11 rounded-2xl flex items-center justify-center",
            lockStatus.is_locked ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
          )}>
            {lockStatus.is_locked ? <Lock className="size-5" /> : <Unlock className="size-5" />}
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-3xl bg-white/80 border border-white/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Protected Vouchers</span>
            <div className="text-2xl font-black text-zinc-950 font-mono mt-0.5">{protectedVoucherCount}</div>
            <span className="text-[11px] text-zinc-500 font-medium">Immutable historical entries</span>
          </div>
          <div className="size-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="size-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-3xl bg-white/80 border border-white/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Open Periods</span>
            <div className="text-2xl font-black text-zinc-950 font-mono mt-0.5">{openPeriodsCount} <span className="text-xs font-normal text-zinc-400">/ 12</span></div>
            <span className="text-[11px] text-zinc-500 font-medium">{lockedPeriodsCount} closed & locked</span>
          </div>
          <div className="size-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Clock className="size-5" />
          </div>
        </GlassCard>
      </div>

      {/* 2. Lock & Closing Control Panel */}
      <GlassCard className="p-6 rounded-3xl bg-white/85 border border-white/90 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-black text-zinc-950 tracking-tight">Period Lock & Backdating Security</h3>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border",
                lockStatus.is_locked
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
              )}>
                {lockStatus.is_locked ? "Security Lock Active" : "Open for Adjustments"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-medium max-w-2xl leading-relaxed">
              Enforce strict accounting cutoff dates. When a period is locked, no journal vouchers, invoices, expenses, or inventory adjustments can be posted with effective dates on or prior to the cutoff date.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-400 mr-1">Quick Presets:</span>
            <button
              type="button"
              onClick={() => {
                setLockDate(defaultLockDate)
                handleLock(defaultLockDate, "Closed through end of previous month.")
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 active:scale-95 transition-all cursor-pointer"
            >
              End of Last Month
            </button>
            <button
              type="button"
              onClick={() => {
                const q1 = `${currentYear}-03-31`
                setLockDate(q1)
                handleLock(q1, "Q1 Accounting Closure.")
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 active:scale-95 transition-all cursor-pointer"
            >
              Q1 (Mar 31)
            </button>
            <button
              type="button"
              onClick={() => {
                const q2 = `${currentYear}-06-30`
                setLockDate(q2)
                handleLock(q2, "Q2 Accounting Closure.")
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 active:scale-95 transition-all cursor-pointer"
            >
              Q2 (Jun 30)
            </button>
            <button
              type="button"
              onClick={() => {
                const q3 = `${currentYear}-09-30`
                setLockDate(q3)
                handleLock(q3, "Q3 Accounting Closure.")
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 active:scale-95 transition-all cursor-pointer"
            >
              Q3 (Sep 30)
            </button>
          </div>
        </div>

        {/* Date Selector & Action Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-6 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Lock All Transactions On or Prior To:
            </label>
            <input
              type="date"
              value={lockDate}
              onChange={(e) => setLockDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Closing Reason / Audit Note:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Monthly accounting closing completed & signed off."
              className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing || !lockDate}
              onClick={() => handleLock()}
              className="flex-1 h-11 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Lock className="size-4" />
              <span>{isProcessing ? "Processing..." : "Lock Period"}</span>
            </button>

            {lockStatus.is_locked && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleUnlock}
                className="h-11 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-zinc-700 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                title="Remove lock and permit backdating"
              >
                <Unlock className="size-4" />
                <span>Unlock</span>
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* 3. 12-Month Period Schedule Table */}
      <GlassCard className="p-0 rounded-3xl bg-white/85 border border-white/90 shadow-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              <CalendarCheck className="size-4 text-emerald-700" />
              <span>Fiscal Year {currentYear} Monthly Periods</span>
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Review posted voucher volumes and lock states for each calendar period.
            </p>
          </div>
        </div>

        <TableScrollWrapper>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[10px] font-black uppercase tracking-wider text-zinc-500 select-none">
                <th className="py-3.5 px-6">Period</th>
                <th className="py-3.5 px-6">Month</th>
                <th className="py-3.5 px-6">Date Range</th>
                <th className="py-3.5 px-6 text-center">Posted Vouchers</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {monthlyPeriods.map((period) => (
                <tr
                  key={period.periodNumber}
                  className={cn(
                    "hover:bg-zinc-50/60 transition-colors",
                    period.isLocked ? "bg-amber-50/30" : "bg-white"
                  )}
                >
                  <td className="py-3.5 px-6 font-mono font-bold text-zinc-500">
                    Period {String(period.periodNumber).padStart(2, "0")}
                  </td>
                  <td className="py-3.5 px-6 font-black text-zinc-900">
                    {period.name} {currentYear}
                  </td>
                  <td className="py-3.5 px-6 font-mono text-zinc-600 text-[11px]">
                    {period.startDate} <span className="text-zinc-400">to</span> {period.endDate}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono",
                      period.jeCount > 0 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-zinc-100 text-zinc-400"
                    )}>
                      {period.jeCount} vouchers
                    </span>
                  </td>
                  <td className="py-3.5 px-6">
                    {period.isLocked ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                        <Lock className="size-3" />
                        <span>Closed & Locked</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Unlock className="size-3 text-emerald-600" />
                        <span>Open</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setLockDate(period.endDate)
                        handleLock(period.endDate, `Period ${period.periodNumber} (${period.name} ${currentYear}) closed.`)
                      }}
                      className={cn(
                        "px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1",
                        period.isLocked
                          ? "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                      )}
                    >
                      <span>{period.isLocked ? "Re-lock through" : "Lock through"}</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollWrapper>
      </GlassCard>
    </div>
  )
}
