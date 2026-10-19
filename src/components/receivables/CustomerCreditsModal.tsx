import React, { useEffect } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { X, Receipt, Calendar } from "lucide-react"

export interface CustomerCreditItem {
  id: string
  fs_no: string
  reference_no?: string
  sale_date?: string
  customer_name: string
  payment_type?: string
  calculatedTotal: number
  calculatedPaid: number
  calculatedDue: number
  percentPaid: number
  effectiveSettlement: "Unpaid" | "Ongoing" | "Paid"
  sales_issue_id?: string
}

export interface CustomerReceivableGroup {
  customer_name: string
  customer_id?: string
  totalAmount: number
  totalPaid: number
  totalDue: number
  percentPaid: number
  creditCount: number
  unpaidCount: number
  ongoingCount: number
  latestDate: string
  effectiveSettlement: "Unpaid" | "Ongoing"
  records: CustomerCreditItem[]
}

interface CustomerCreditsModalProps {
  isOpen: boolean
  onClose: () => void
  group: CustomerReceivableGroup | null
}

function money(val: number) {
  return Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d?: string | null) {
  if (!d) return "—"
  try {
    const raw = d.includes("T") ? d.split("T")[0] : d.split(" ")[0]
    const [y, m, day] = raw.split("-")
    if (y && m && day) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const idx = parseInt(m, 10) - 1
      if (idx >= 0 && idx < 12) return `${monthNames[idx]} ${parseInt(day, 10)}, ${y}`
    }
    return raw
  } catch {
    return d
  }
}

export const CustomerCreditsModal: React.FC<CustomerCreditsModalProps> = ({
  isOpen,
  onClose,
  group,
}) => {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    const prevOverflow = document.body.style.overflow === "hidden" ? "" : document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow || ""
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !group) return null

  const handlePaySalesIssue = (record: CustomerCreditItem) => {
    const payTarget =
      record.sales_issue_id ||
      record.fs_no ||
      (record.id ? record.id.replace(/^INV-(SI-)?/, "") : "")
    const searchTarget = record.fs_no || record.customer_name
    navigate(`/sales/sales-issued?search=${encodeURIComponent(searchTarget)}&payId=${encodeURIComponent(payTarget)}`)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50/40 via-white to-zinc-50">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <Receipt className="size-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-zinc-950 tracking-tight">
                  {group.customer_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  {group.creditCount} Credit Transaction{group.creditCount > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Outstanding customer credit breakdown & settlement history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 transition cursor-pointer"
            title="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Summary Banner */}
        <div className="p-4 sm:p-5 bg-zinc-50/70 border-b border-zinc-100 grid grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-2xl border border-zinc-200/80 shadow-2xs">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Due (AR)</p>
            <p className="text-base sm:text-lg font-black text-rose-600 tracking-tight font-mono mt-0.5">
              ETB {money(group.totalDue)}
            </p>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-zinc-200/80 shadow-2xs">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Invoiced</p>
            <p className="text-base sm:text-lg font-black text-zinc-950 tracking-tight font-mono mt-0.5">
              ETB {money(group.totalAmount)}
            </p>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-zinc-200/80 shadow-2xs">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Paid</p>
            <p className="text-base sm:text-lg font-black text-emerald-600 tracking-tight font-mono mt-0.5">
              ETB {money(group.totalPaid)}
            </p>
          </div>
        </div>

        {/* Scrollable Records List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Itemized Credit Records ({group.records.length})
            </span>
            <span className="text-[11px] text-zinc-400">Click any credit record to record payment installment</span>
          </div>

          {group.records.map((rec) => {
            const isUnpaid = rec.effectiveSettlement === "Unpaid" || rec.calculatedPaid <= 0
            return (
              <div
                key={rec.id}
                onClick={() => handlePaySalesIssue(rec)}
                className="group p-4 rounded-2xl bg-white border border-zinc-200/90 hover:border-emerald-500/40 hover:bg-emerald-50/20 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-zinc-900 group-hover:text-emerald-700 transition-colors">
                      {rec.fs_no ? (rec.fs_no.startsWith("FS-") ? rec.fs_no : `FS-${rec.fs_no}`) : rec.id}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        isUnpaid
                          ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}
                    >
                      {isUnpaid ? "Unpaid" : "Ongoing / Partial"}
                    </span>
                    {rec.payment_type && (
                      <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                        {rec.payment_type}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                    {rec.sale_date && (
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="size-3 text-zinc-400" />
                        {formatDate(rec.sale_date)}
                      </span>
                    )}
                    {rec.reference_no && (
                      <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                        Ref: {rec.reference_no}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                  <div className="text-left sm:text-right">
                    <span className="text-sm font-black font-mono text-rose-600 block">
                      ETB {money(rec.calculatedDue)}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400 block">
                      of ETB {money(rec.calculatedTotal)}
                      {rec.calculatedPaid > 0 && ` (Paid ETB ${money(rec.calculatedPaid)})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 group-hover:bg-emerald-700 group-hover:text-white group-hover:border-emerald-700 transition-all text-xs font-black shrink-0">
                    <Receipt className="size-3.5" />
                    <span>Pay</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between text-xs text-zinc-500">
          <span>{group.creditCount} total sales issue record(s)</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white font-bold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
