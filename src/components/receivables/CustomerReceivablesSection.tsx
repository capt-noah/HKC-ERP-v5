import React, { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, X, Receipt, ArrowRight, RefreshCw, CheckCircle2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFinanceStore } from "@/lib/financeStore"
import { listSalesIssues } from "@/lib/salesIssuesApi"
import {
  CustomerCreditsModal,
  type CustomerCreditItem,
  type CustomerReceivableGroup,
} from "./CustomerCreditsModal"

interface CustomerReceivablesSectionProps {
  items?: CustomerCreditItem[]
  isLoading?: boolean
  maxHeight?: string
  showHeader?: boolean
  className?: string
  title?: string
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

export const CustomerReceivablesSection: React.FC<CustomerReceivablesSectionProps> = ({
  items: externalItems,
  isLoading: externalLoading,
  maxHeight = "max-h-[300px]",
  showHeader = true,
  className = "",
  title = "Customer Receivables",
}) => {
  const navigate = useNavigate()
  const financeStore = useFinanceStore()

  const [internalItems, setInternalItems] = useState<CustomerCreditItem[]>([])
  const [internalLoading, setInternalLoading] = useState<boolean>(false)
  const [financeVersion, setFinanceVersion] = useState<number>(0)

  const [filter, setFilter] = useState<"all" | "unpaid" | "ongoing">("all")
  const [search, setSearch] = useState<string>("")
  const [selectedGroup, setSelectedGroup] = useState<CustomerReceivableGroup | null>(null)

  // Listen to financeStore updates if no external items are provided
  useEffect(() => {
    if (externalItems !== undefined) return
    const unsub = financeStore.subscribe(() => {
      setFinanceVersion((v) => v + 1)
    })
    return () => unsub()
  }, [financeStore, externalItems])

  // Load internal items if not passed externally
  useEffect(() => {
    if (externalItems !== undefined) return

    let cancelled = false
    const loadData = async () => {
      setInternalLoading(true)
      try {
        const invoices = financeStore.getInvoices()
        let mappedList: CustomerCreditItem[] = []

        if (invoices.length > 0) {
          mappedList = invoices
            .filter((inv) => inv.status !== "Cancelled" && inv.status !== "Draft" && (inv.invoice_type || (inv.purchase_order_id ? "Purchase" : "Sales")) !== "Purchase")
            .map((inv) => {
              const total = Number(inv.total || inv.total_amount || 0)
              const paid = Number(inv.amount_paid || 0)
              const due = typeof inv.balance_due === "number" ? Math.max(0, inv.balance_due) : Math.max(0, total - paid)
              const percentPaid = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
              const isPaid = (inv.status || "").toLowerCase() === "paid" || due <= 0.01

              return {
                id: inv.id,
                fs_no: inv.fs_no || inv.invoice_number || inv.id,
                reference_no: inv.sales_order_id || inv.sales_issue_id || "",
                sale_date: inv.issue_date || "",
                customer_name: inv.customer_name || "Customer",
                payment_type: inv.payment_terms || "Credit",
                calculatedTotal: total,
                calculatedPaid: paid,
                calculatedDue: due,
                percentPaid,
                effectiveSettlement: (isPaid ? "Paid" : paid > 0 ? "Ongoing" : "Unpaid") as "Unpaid" | "Ongoing" | "Paid",
                sales_issue_id: inv.sales_issue_id,
              }
            })
            .filter((inv) => inv.calculatedDue > 0.01 && inv.effectiveSettlement !== "Paid")
        } else {
          const res = await listSalesIssues(new URLSearchParams({ limit: "100" }))
          const rows = Array.isArray(res) ? res : (res.rows || [])
          mappedList = rows
            .filter((si: any) => si.status !== "Cancelled")
            .map((si: any) => {
              const isCash = (si.payment_type || "Cash").toLowerCase() === "cash"
              const totalAmount = Number(si.total_amount || 0)
              const amountPaid = isCash ? totalAmount : Number(si.amount_paid || 0)
              const balanceDue = isCash ? 0 : (typeof si.balance_due === "number" ? Math.max(0, si.balance_due) : Math.max(0, totalAmount - amountPaid))
              const percentPaid = totalAmount > 0 ? Math.min(100, Math.round((amountPaid / totalAmount) * 100)) : (isCash ? 100 : 0)
              const isPaid = isCash || (totalAmount > 0 && amountPaid >= totalAmount) || balanceDue <= 0.01 || si.settlement_status === "Fully Settled"

              return {
                id: si.id,
                fs_no: si.fs_no || si.id,
                reference_no: si.reference_no || "",
                sale_date: si.sale_date || "",
                customer_name: si.customer_name || "Customer",
                payment_type: si.payment_type || "Credit",
                calculatedTotal: totalAmount,
                calculatedPaid: amountPaid,
                calculatedDue: balanceDue,
                percentPaid,
                effectiveSettlement: (isPaid ? "Paid" : amountPaid > 0 ? "Ongoing" : "Unpaid") as "Unpaid" | "Ongoing" | "Paid",
                sales_issue_id: si.id,
              }
            })
            .filter((si: any) => si.calculatedDue > 0.01 && si.effectiveSettlement !== "Paid")
        }

        if (!cancelled) {
          setInternalItems(mappedList)
        }
      } catch (err: any) {
        console.error("[CustomerReceivablesSection] loadData error:", err)
      } finally {
        if (!cancelled) setInternalLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [externalItems, financeStore, financeVersion])

  const allItems = externalItems !== undefined ? externalItems : internalItems
  const isLoading = externalLoading !== undefined ? externalLoading : internalLoading

  // 1. Group records by customer_name
  const customerGroups = useMemo(() => {
    const map = new Map<string, CustomerReceivableGroup>()

    for (const item of allItems) {
      if (item.calculatedDue <= 0.01 || item.effectiveSettlement === "Paid") continue

      const name = (item.customer_name || "Unknown Customer").trim()
      if (!map.has(name)) {
        map.set(name, {
          customer_name: name,
          totalAmount: 0,
          totalPaid: 0,
          totalDue: 0,
          percentPaid: 0,
          creditCount: 0,
          unpaidCount: 0,
          ongoingCount: 0,
          latestDate: item.sale_date || "",
          effectiveSettlement: "Unpaid",
          records: [],
        })
      }

      const g = map.get(name)!
      g.records.push(item)
      g.totalAmount += item.calculatedTotal
      g.totalPaid += item.calculatedPaid
      g.totalDue += item.calculatedDue
      g.creditCount += 1

      if (item.calculatedPaid > 0) {
        g.ongoingCount += 1
      } else {
        g.unpaidCount += 1
      }

      if (item.sale_date && (!g.latestDate || new Date(item.sale_date).getTime() > new Date(g.latestDate).getTime())) {
        g.latestDate = item.sale_date
      }
    }

    const groups = Array.from(map.values()).map((g) => {
      const pct = g.totalAmount > 0 ? Math.min(100, Math.round((g.totalPaid / g.totalAmount) * 100)) : 0
      return {
        ...g,
        percentPaid: pct,
        effectiveSettlement: (g.totalPaid > 0 ? "Ongoing" : "Unpaid") as "Unpaid" | "Ongoing",
      }
    })

    // Sort by largest cumulative outstanding credit first
    groups.sort((a, b) => b.totalDue - a.totalDue)
    return groups
  }, [allItems])

  // Summary Metrics
  const totalOutstanding = useMemo(
    () => customerGroups.reduce((sum, g) => sum + g.totalDue, 0),
    [customerGroups]
  )
  const totalUnpaidCustomers = useMemo(
    () => customerGroups.filter((g) => g.effectiveSettlement === "Unpaid").length,
    [customerGroups]
  )
  const totalOngoingCustomers = useMemo(
    () => customerGroups.filter((g) => g.effectiveSettlement === "Ongoing").length,
    [customerGroups]
  )

  // 2. Filter & Search
  const filteredGroups = useMemo(() => {
    return customerGroups.filter((g) => {
      if (filter === "unpaid" && g.effectiveSettlement !== "Unpaid") return false
      if (filter === "ongoing" && g.effectiveSettlement !== "Ongoing") return false

      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchName = g.customer_name.toLowerCase().includes(q)
        const matchRecord = g.records.some((r) => r.fs_no.toLowerCase().includes(q) || (r.reference_no && r.reference_no.toLowerCase().includes(q)))
        if (!matchName && !matchRecord) return false
      }

      return true
    })
  }, [customerGroups, filter, search])

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header if requested */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <Receipt className="size-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-zinc-950 tracking-tight flex items-center gap-1.5">
                {title}
                {customerGroups.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    {customerGroups.length} Customer{customerGroups.length > 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">Cumulative customer credit accounts (AR)</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/sales/sales-issued")}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-black/5 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Open in Sales Issued"
          >
            <span className="text-[11px] font-bold hidden sm:inline">View Issues</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {/* Total Metric Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/80 to-rose-50/80 border border-amber-200/50 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-amber-900/70 uppercase tracking-wider">Total Uncollected Credit</p>
          <p className="text-base sm:text-lg font-black text-amber-950 tracking-tight font-mono">
            ETB {money(totalOutstanding)}
          </p>
        </div>
        <div className="text-right flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
            {totalUnpaidCustomers} Unpaid
          </span>
          {totalOngoingCustomers > 0 && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
              {totalOngoingCustomers} Ongoing
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 p-1 bg-black/5 rounded-xl text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "flex-1 py-1 rounded-lg transition-all text-center cursor-pointer",
              filter === "all" ? "bg-white text-zinc-950 shadow-xs font-black" : "text-zinc-500 hover:text-zinc-950"
            )}
          >
            All ({customerGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unpaid")}
            className={cn(
              "flex-1 py-1 rounded-lg transition-all text-center cursor-pointer",
              filter === "unpaid" ? "bg-white text-rose-600 shadow-xs font-black" : "text-zinc-500 hover:text-zinc-950"
            )}
          >
            Unpaid ({totalUnpaidCustomers})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ongoing")}
            className={cn(
              "flex-1 py-1 rounded-lg transition-all text-center cursor-pointer",
              filter === "ongoing" ? "bg-white text-amber-600 shadow-xs font-black" : "text-zinc-500 hover:text-zinc-950"
            )}
          >
            Ongoing ({totalOngoingCustomers})
          </button>
        </div>

        {customerGroups.length > 2 && (
          <div className="relative flex items-center h-8 px-2.5 rounded-xl border border-black/5 bg-black/[0.02]">
            <Search className="size-3.5 text-zinc-400 mr-1.5 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, FS no..."
              className="bg-transparent border-none text-[11px] font-medium text-zinc-950 outline-none w-full placeholder:text-zinc-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-zinc-400 hover:text-zinc-950 cursor-pointer">
                <X className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Grouped Customer Cards */}
      <div className={cn("overflow-y-auto pr-1 space-y-2 scrollbar-thin", maxHeight)}>
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
            <RefreshCw className="size-4 animate-spin text-zinc-400" />
            Loading receivables...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-8 text-center px-4">
            {customerGroups.length === 0 ? (
              <div className="flex flex-col items-center">
                <div className="size-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
                  <CheckCircle2 className="size-5" />
                </div>
                <p className="text-xs font-bold text-zinc-950">All Customer Accounts Settled</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">No outstanding or partial customer balances.</p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No customers match your filter.</p>
            )}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isUnpaid = group.effectiveSettlement === "Unpaid"
            return (
              <div
                key={group.customer_name}
                onClick={() => setSelectedGroup(group)}
                className="group cursor-pointer p-3 rounded-2xl border border-zinc-200/80 bg-white hover:border-amber-500/40 hover:bg-amber-50/10 hover:shadow-xs transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-zinc-950 truncate group-hover:text-amber-700 transition-colors">
                      {group.customer_name}
                    </p>
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-zinc-100 text-zinc-600 shrink-0">
                      {group.creditCount} Credit{group.creditCount > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                    <span
                      className={cn(
                        "font-black px-1.5 py-0.2 rounded-full border text-[9px]",
                        isUnpaid
                          ? "bg-rose-50 text-rose-600 border-rose-200/60"
                          : "bg-amber-50 text-amber-600 border-amber-200/60"
                      )}
                    >
                      {isUnpaid ? "Unpaid" : "Partial"}
                    </span>
                    {group.latestDate && <span>Latest: {formatDate(group.latestDate)}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <span className="text-xs font-black font-mono text-rose-600 block">
                      ETB {money(group.totalDue)}
                    </span>
                    <span className="text-[9px] font-medium text-zinc-400 block">
                      {group.creditCount} invoice{group.creditCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <ChevronRight className="size-4 text-zinc-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Customer Credits Breakdown Modal */}
      <CustomerCreditsModal
        isOpen={Boolean(selectedGroup)}
        onClose={() => setSelectedGroup(null)}
        group={selectedGroup}
      />
    </div>
  )
}
