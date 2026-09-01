import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CalendarClock, DollarSign, Users } from "lucide-react"
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { HRPageSkeleton } from "@/components/HRSkeleton"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { type HRData, loadHRData, money } from "@/lib/hrApi"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.06 } } }

const today = new Date().toISOString().slice(0, 10)

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "Not Set"
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function latest<T extends { created_at?: string; updated_at?: string }>(items: T[], limit = 3) {
  return [...items]
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
    .slice(0, limit)
}

export default function HRDashboard() {
  const [data, setData] = useState<HRData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    loadHRData()
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load HR data.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    const empty: HRData = { employees: [], attendance: [], leaves: [], payrollPeriods: [], payrollRecords: [] }
    const hr = data || empty
    const activeEmployees = hr.employees.filter((employee) => employee.status === "Active")
    const todayAttendance = hr.attendance.filter((record) => record.attendance_date === today)
    const approvedLeavesToday = hr.leaves.filter((request) => request.status === "Approved" && request.start_date <= today && request.end_date >= today)
    const currentPeriod = [...hr.payrollPeriods].sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`))[0]
    const currentPayroll = currentPeriod ? hr.payrollRecords.filter((record) => record.payroll_period_id === currentPeriod.id) : []

    return {
      totalEmployees: hr.employees.length,
      activeEmployees: activeEmployees.length,
      presentToday: todayAttendance.filter((record) => record.status === "Present" || record.status === "Late").length,
      absentToday: todayAttendance.filter((record) => record.status === "Absent").length,
      onLeaveToday: approvedLeavesToday.length + todayAttendance.filter((record) => record.status === "On Leave").length,
      pendingLeave: hr.leaves.filter((request) => request.status === "Pending").length,
      payrollTotal: currentPayroll.reduce((sum, record) => sum + Number(record.net_pay || 0), 0),
      pendingPayroll: currentPayroll.filter((record) => record.payment_status === "Pending").length,
      approvedPayroll: currentPayroll.filter((record) => record.payment_status === "Approved").length,
      paidPayroll: currentPayroll.filter((record) => record.payment_status === "Paid").length,
      attendanceByStatus: countBy(todayAttendance, (record) => record.status),
      employeesByWarehouse: countBy(hr.employees, (employee) => employee.warehouse_id),
      employeesByStatus: countBy(hr.employees, (employee) => employee.status),
      leaveByStatus: countBy(hr.leaves, (request) => request.status),
      payroll: {
        period: currentPeriod?.name || "No payroll period",
        status: currentPeriod?.status || "No status",
        gross: currentPayroll.reduce((sum, record) => sum + Number(record.gross_pay || 0), 0),
        deductions: currentPayroll.reduce((sum, record) => sum + Number(record.total_deductions || 0), 0),
        net: currentPayroll.reduce((sum, record) => sum + Number(record.net_pay || 0), 0),
      },
      recentEmployees: latest(hr.employees),
      recentAttendance: latest(hr.attendance),
      recentLeaves: latest(hr.leaves),
      recentPayroll: latest(hr.payrollRecords),
      activityGraph: [
        { label: "Employees", value: latest(hr.employees).length, total: hr.employees.length },
        { label: "Attendance", value: latest(hr.attendance).length, total: hr.attendance.length },
        { label: "Leave", value: latest(hr.leaves).length, total: hr.leaves.length },
        { label: "Payroll", value: latest(hr.payrollRecords).length, total: hr.payrollRecords.length },
      ],
    }
  }, [data])

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight mt-1">HR Dashboard</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">Workforce, attendance, leave, and payroll summary overview.</p>
          </div>
          <SubPageNav items={getSectionChildren("/hr")} />
        </motion.div>

        {error && <GlassCard className="p-5 mb-5 text-sm font-bold text-rose-700 border-rose-200 bg-rose-50">{error}</GlassCard>}
        {!data && !error ? (
          <HRPageSkeleton rows={5} cards={9} />
        ) : (
          <>

        <motion.div variants={fade} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-2mb-3">
              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
                <Users className="size-4 text-zinc-500" /> Workforce Overview
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Employees</span>
                <span className="text-xl font-black text-zinc-950 mt-1 block">{summary.totalEmployees}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Active</span>
                <span className="text-xl font-black text-emerald-600 mt-1 block">{summary.activeEmployees}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-2 mb-3">
              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
                <CalendarClock className="size-4 text-zinc-500" /> Today's Attendance & Leave
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              <div className="bg-black/[0.02] p-2 rounded-xl text-center">
                <span className="block text-[8px] font-black text-zinc-400 uppercase">Present</span>
                <span className="text-base font-black text-zinc-950 mt-0.5 block">{summary.presentToday}</span>
              </div>
              <div className="bg-black/[0.02] p-2 rounded-xl text-center">
                <span className="block text-[8px] font-black text-zinc-400 uppercase">Absent</span>
                <span className="text-base font-black text-rose-600 mt-0.5 block">{summary.absentToday}</span>
              </div>
              <div className="bg-black/[0.02] p-2 rounded-xl text-center">
                <span className="block text-[8px] font-black text-zinc-400 uppercase">On Leave</span>
                <span className="text-base font-black text-blue-600 mt-0.5 block">{summary.onLeaveToday}</span>
              </div>
              <div className="bg-black/[0.02] p-2 rounded-xl text-center">
                <span className="block text-[8px] font-black text-zinc-400 uppercase">Pending</span>
                <span className="text-base font-black text-amber-600 mt-0.5 block">{summary.pendingLeave}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-2 mb-3">
              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
                <DollarSign className="size-4 text-zinc-500" /> Payroll Workflow
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-black/[0.02] p-2.5 rounded-xl text-center">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-wider">Pending</span>
                <span className="text-base font-black text-amber-600 mt-0.5 block">{summary.pendingPayroll}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl text-center">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-wider">Approved</span>
                <span className="text-base font-black text-blue-600 mt-0.5 block">{summary.approvedPayroll}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl text-center">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-wider">Paid</span>
                <span className="text-base font-black text-emerald-600 mt-0.5 block">{summary.paidPayroll}</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SummaryCard title="Attendance Summary" rows={["Present", "Absent", "Late", "On Leave"].map((key) => [key, summary.attendanceByStatus[key] || 0])} empty="No attendance has been recorded for today." />
          <SummaryCard title="Employee Summary" rows={[...Object.entries(summary.employeesByWarehouse), ...Object.entries(summary.employeesByStatus)]} empty="No employees have been registered yet." />
          <SummaryCard title="Leave Summary" rows={["Pending", "Approved", "Rejected"].map((key) => [key, summary.leaveByStatus[key] || 0])} empty="No leave requests have been recorded yet." />
          <SummaryCard title="Payroll Summary" rows={[["Current payroll period", summary.payroll.period], ["Total gross salary", `ETB ${money(summary.payroll.gross)}`], ["Total deductions", `ETB ${money(summary.payroll.deductions)}`], ["Total net salary", `ETB ${money(summary.payroll.net)}`], ["Pending payroll", summary.pendingPayroll], ["Approved payroll", summary.approvedPayroll], ["Paid payroll", summary.paidPayroll], ["Payroll status", summary.payroll.status]]} empty="No payroll period has been created yet." />
        </div>

        <ActivityGraph
          employees={summary.recentEmployees.map((employee) => `${employee.full_name} (${employee.employee_number})`)}
          attendance={summary.recentAttendance.map((record) => `${record.attendance_date} - ${record.status}`)}
          leave={summary.recentLeaves.map((request) => `${request.leave_type} - ${request.status}`)}
          payroll={summary.recentPayroll.map((record) => `${record.payment_status} - ETB ${money(record.net_pay)}`)}
          graph={summary.activityGraph}
        />
          </>
        )}
      </motion.div>
    </div>
  )
}

function SummaryCard({ title, rows, empty }: { title: string; rows: Array<[string, string | number]>; empty: string }) {
  const hasValue = rows.some(([, value]) => Boolean(value) && value !== "No payroll period" && value !== "No status")
  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 mb-4">{title}</h3>
      {!hasValue ? (
        <p className="text-xs font-semibold text-zinc-400 py-6">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-3 py-2">
              <span className="text-xs font-bold text-zinc-600">{label}</span>
              <span className="text-xs font-black text-zinc-950">{value}</span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function ActivityGraph({
  employees,
  attendance,
  leave,
  payroll,
  graph,
}: {
  employees: string[]
  attendance: string[]
  leave: string[]
  payroll: string[]
  graph: Array<{ label: string; value: number; total: number }>
}) {
  const events = [
    ...employees.map((label) => ({ type: "Employees", label })),
    ...attendance.map((label) => ({ type: "Attendance", label })),
    ...leave.map((label) => ({ type: "Leave", label })),
    ...payroll.map((label) => ({ type: "Payroll", label })),
  ].slice(0, 8)
  const max = Math.max(...graph.map((item) => item.total), 1)
  const hasActivity = graph.some((item) => item.total > 0)
  const chartData = graph.map((item) => ({
    module: item.label,
    records: item.total,
    recent: item.value,
    share: Math.round((item.total / max) * 100),
  }))

  return (
    <GlassCard className="p-5 mt-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900">Recent HR Activity</h3>
          <p className="text-xs font-semibold text-zinc-500 mt-1">Activity distribution across recent HR records.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {graph.map((item) => (
            <div key={item.label} className="rounded-xl bg-black/[0.03] px-3 py-2">
              <span className="block text-[9px] font-black uppercase tracking-wider text-zinc-400">{item.label}</span>
              <span className="text-sm font-black text-zinc-950">{item.total}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,_1.4fr)_minmax(280px,_0.8fr)] gap-5">
        <div className="rounded-2xl border border-black/5 bg-white p-4 overflow-hidden">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 18, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="rgba(24,24,27,0.08)" vertical={false} />
                <XAxis dataKey="module" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "#71717a" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "#71717a" }} />
                <Tooltip
                  cursor={{ fill: "rgba(24,24,27,0.04)" }}
                  contentStyle={{ borderRadius: 14, border: "1px solid rgba(24,24,27,0.08)", boxShadow: "0 16px 40px rgba(24,24,27,0.12)" }}
                  formatter={(value, name) => [value, name === "records" ? "Total records" : "Recent records"]}
                />
                <Bar dataKey="records" radius={[8, 8, 2, 2]} fill="#18181b" barSize={38} />
                <Line type="monotone" dataKey="recent" stroke="#166534" strokeWidth={3} dot={{ r: 4, fill: "#166534", strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {!hasActivity && (
            <p className="text-xs font-semibold text-zinc-400 px-2 pb-2">No HR activity has been recorded yet.</p>
          )}
        </div>
          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4">
            <h4 className="text-xs font-black uppercase tracking-tight text-zinc-900 mb-3">Latest Records</h4>
            {events.length === 0 ? (
              <p className="text-xs font-semibold text-zinc-400">No recent HR records are available.</p>
            ) : (
              <div className="space-y-2">
                {events.map((event, index) => (
                  <div key={`${event.type}-${event.label}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-xs">
                    <span className="font-bold text-zinc-700 truncate">{event.label}</span>
                    <span className="shrink-0 rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-black uppercase text-white">{event.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </GlassCard>
  )
}
