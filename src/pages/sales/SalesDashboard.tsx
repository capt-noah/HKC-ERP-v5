import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { DollarSign, FileText, PackageCheck, Truck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore } from "@/lib/erpStore"
import { listSalesIssues, type SalesIssue } from "@/lib/salesIssuesApi"
import { Skeleton } from "@/components/ui/skeleton"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MetricSkeleton() {
  return (
    <GlassCard className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3 w-24 bg-zinc-200/80" />
        <Skeleton className="size-9 rounded-xl bg-zinc-200/80" />
      </div>
      <Skeleton className="h-8 w-36 bg-zinc-200/80" />
      <div className="mt-3 border-t border-zinc-100 pt-2">
        <Skeleton className="h-3 w-28 bg-zinc-200/80" />
      </div>
    </GlassCard>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-150/40 bg-zinc-50/60 p-3.5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40 bg-zinc-200/80" />
        <Skeleton className="h-3 w-28 bg-zinc-200/80" />
      </div>
      <div className="space-y-2">
        <Skeleton className="ml-auto h-3 w-24 bg-zinc-200/80" />
        <Skeleton className="ml-auto h-2.5 w-14 bg-zinc-200/80" />
      </div>
    </div>
  )
}

export default function SalesDashboard() {
  const navigate = useNavigate()
  const erp = useErpStore()
  const salesOrders = erp.getSalesOrders()
  const quotations = erp.getQuotations()
  const [salesIssues, setSalesIssues] = useState<SalesIssue[]>([])
  const [salesLoading, setSalesLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "100", sort: "sale_date.desc" })
    setSalesLoading(true)
    listSalesIssues(params)
      .then((result: any) => {
        const rows = Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : []
        setSalesIssues(rows)
      })
      .catch(() => setSalesIssues([]))
      .finally(() => setSalesLoading(false))
  }, [])

  const safeIssues = Array.isArray(salesIssues) ? salesIssues : []
  const postedIssues = safeIssues.filter((issue) => issue?.status === "Posted")
  const draftIssues = safeIssues.filter((issue) => issue?.status === "Draft")
  const issuedAmount = postedIssues.reduce((sum, issue) => sum + Number(issue?.total_amount || 0), 0)
  const postedIssueCount = postedIssues.length
  const orderAmount = salesOrders.reduce((sum, order) => sum + Number(order?.amount || 0), 0)
  const quotationAmount = quotations.reduce((sum, quote) => sum + Number(quote?.amount || 0), 0)

  const recentActivity = useMemo(() => safeIssues.slice(0, 6), [safeIssues])
  const isLoading = erp.isLoading() || salesLoading

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <motion.main variants={stagger} initial="hidden" animate="visible" className="mx-auto max-w-[98%] px-4 pb-12 pt-24 md:px-6 lg:px-8">
        <motion.div variants={fade} className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-black">Sales Dashboard</h1>
            <p className="mt-1 max-w-xl text-xs font-semibold leading-relaxed text-zinc-500">
              Live sales totals from sales issues, orders, quotations, and dispatch notes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/sales")} />
          </div>
        </motion.div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />) : [
            { label: "Posted Sales", value: `ETB ${money(issuedAmount)}`, note: `${postedIssues.length.toLocaleString()} posted issues`, Icon: DollarSign },
            { label: "Issued Records", value: postedIssueCount.toLocaleString(), note: "Posted sales issue records", Icon: PackageCheck },
            { label: "Open Orders", value: `ETB ${money(orderAmount)}`, note: `${salesOrders.length.toLocaleString()} sales orders`, Icon: Truck },
            { label: "Quotations", value: `ETB ${money(quotationAmount)}`, note: `${quotations.length.toLocaleString()} quotations`, Icon: FileText },
          ].map((card, index) => {
            const Icon = card.Icon
            return (
              <GlassCard key={card.label} className="p-5" transition={{ delay: 0.05 * index, duration: 0.3 }}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{card.label}</span>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-black/5">
                    <Icon className="size-4 text-zinc-600" />
                  </div>
                </div>
                <p className="text-2xl font-black leading-none tracking-tight text-zinc-950">{card.value}</p>
                <div className="mt-3 border-t border-zinc-100 pt-2">
                  <span className="font-mono text-[9px] font-bold uppercase text-zinc-400">{card.note}</span>
                </div>
              </GlassCard>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <GlassCard className="p-6 lg:col-span-8">
            <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-tight text-zinc-900">Recent Sales Issues</h3>
                <p className="text-[11px] font-semibold text-zinc-400">Records from the sales issued register</p>
              </div>
              <button onClick={() => navigate("/sales/sales-issued")} className="rounded-xl bg-zinc-950 px-3 py-2 text-[10px] font-black uppercase text-white">
                Open Register
              </button>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => <RowSkeleton key={index} />)
              ) : recentActivity.length === 0 ? (
                <p className="py-16 text-center text-xs font-bold text-zinc-400">No sales issue records found.</p>
              ) : (
                recentActivity.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between rounded-2xl border border-zinc-150/40 bg-zinc-50/60 p-3.5">
                    <div>
                      <p className="text-xs font-black text-zinc-900">{issue.customer_name}</p>
                      <p className="mt-0.5 font-mono text-[10px] font-bold text-zinc-400">{issue.fs_no} · {issue.reference_no}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-black text-zinc-950">ETB {money(issue.total_amount)}</p>
                      <p className="mt-0.5 text-[9px] font-black uppercase text-zinc-400">{issue.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6 lg:col-span-4">
            <div className="mb-5 border-b border-zinc-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-tight text-zinc-900">Sales Work Queue</h3>
              <p className="text-[11px] font-semibold text-zinc-400">Live counts from sales records</p>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
                    <Skeleton className="h-3 w-32 bg-zinc-200/80" />
                    <Skeleton className="h-4 w-8 bg-zinc-200/80" />
                  </div>
                ))
              ) : [
                { label: "Draft Sales Issues", value: draftIssues.length },
                { label: "Sales Orders", value: salesOrders.length },
                { label: "Quotations", value: quotations.length },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
                  <span className="text-xs font-bold text-zinc-600">{row.label}</span>
                  <span className="font-mono text-sm font-black text-zinc-950">{row.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </motion.main>
    </div>
  )
}
