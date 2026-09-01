import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileSpreadsheet, Info, X } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { HRPageSkeleton } from "@/components/HRSkeleton"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import {
  HRTableToolbar,
  ResizableTableHeader,
  useTableSort,
  useColumnWidths,
  type TableColumn,
} from "@/components/HRTable"
import {
  LEAVE_TYPES,
  hrApi,
  initials,
  leaveDays,
  loadHRData,
  makeId,
  type AttendanceRecord,
  type Employee,
  type LeaveRequest,
} from "@/lib/hrApi"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

const CYCLE_DAYS = 14
const CYCLE_START = "2026-07-01"

function cycleDate(dayIndex: number) {
  const d = new Date(`${CYCLE_START}T00:00:00`)
  d.setDate(d.getDate() + dayIndex)
  return d.toISOString().split("T")[0]
}

function statusColor(status: string) {
  if (status === "Present") return "bg-green-700 border-green-700 text-white"
  if (status === "Absent") return "border border-red-200 text-red-500"
  if (status === "On Leave" || status === "Half Day") return "border border-blue-200 bg-blue-50/20 text-blue-500"
  if (status === "Late") return "border border-amber-200 bg-amber-50/20 text-amber-600"
  return "border border-zinc-200 text-zinc-400"
}

function statusLabel(status: string) {
  if (status === "Present") return "P"
  if (status === "Absent") return "A"
  if (status === "On Leave") return "L"
  if (status === "Half Day") return "H"
  if (status === "Late") return "T"
  return "-"
}

export default function AttendanceLeave() {
  const { showToast } = useFeedback()
  const [activeTab, setActiveTab] = useState<"Attendance" | "Leave">("Attendance")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Leave filters
  const [leaveSearch, setLeaveSearch] = useState("")
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("All")
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("All")

  // Apply leave modal
  const [showApplyLeave, setShowApplyLeave] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    leave_type: "Annual Leave",
    start_date: "",
    end_date: "",
    reason: "",
  })
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await loadHRData()
      setEmployees(data.employees)
      setAttendance(data.attendance)
      setLeaves(data.leaves)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  // Build a map: employeeId → dayIndex → AttendanceRecord
  const attendanceMap = useMemo(() => {
    const map = new Map<string, Map<number, AttendanceRecord>>()
    for (const rec of attendance) {
      const dayIndex = Array.from({ length: CYCLE_DAYS }, (_, i) => i).find(
        (i) => cycleDate(i) === rec.attendance_date
      )
      if (dayIndex === undefined) continue
      if (!map.has(rec.employee_id)) map.set(rec.employee_id, new Map())
      map.get(rec.employee_id)!.set(dayIndex, rec)
    }
    return map
  }, [attendance])

  const toggleDay = async (emp: Employee, dayIndex: number) => {
    const existing = attendanceMap.get(emp.id)?.get(dayIndex)
    const cycle: AttendanceRecord["status"][] = ["Present", "Absent", "On Leave"]
    const currentStatus = existing?.status ?? "Absent"
    const nextIndex = (cycle.indexOf(currentStatus as any) + 1) % cycle.length
    const nextStatus = cycle[nextIndex]

    try {
      if (existing) {
        await hrApi.updateAttendance(existing.id, { status: nextStatus })
      } else {
        await hrApi.createAttendance({
          id: makeId("ATT"),
          employee_id: emp.id,
          attendance_date: cycleDate(dayIndex),
          check_in_time: "",
          check_out_time: "",
          status: nextStatus,
          hours_worked: 0,
          overtime_hours: 0,
          warehouse_id: emp.warehouse_id,
          notes: "",
        })
      }
      await refresh()
    } catch (err) {
      showToast("Attendance Error", "warning", err instanceof Error ? err.message : "Could not update attendance.")
    }
  }

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
      showToast("Missing Fields", "warning", "All fields are required.")
      return
    }
    const days = leaveDays(leaveForm.start_date, leaveForm.end_date)
    if (days <= 0) {
      showToast("Invalid Dates", "warning", "End date must be after start date.")
      return
    }
    setSaving(true)
    try {
      await hrApi.createLeave({
        id: makeId("LVE"),
        employee_id: leaveForm.employee_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        number_of_days: days,
        reason: leaveForm.reason,
        document_path: "",
        status: "Pending",
        notes: "",
      })
      showToast("Leave Submitted", "success", `Leave request submitted for ${days} day(s).`)
      setShowApplyLeave(false)
      setLeaveForm({ employee_id: "", leave_type: "Annual Leave", start_date: "", end_date: "", reason: "" })
      await refresh()
    } catch (err) {
      showToast("Submit Failed", "warning", err instanceof Error ? err.message : "Could not submit leave request.")
    } finally {
      setSaving(false)
    }
  }

  const handleLeaveStatus = async (leave: LeaveRequest, status: "Approved" | "Rejected") => {
    try {
      await hrApi.updateLeave(leave.id, { status })
      showToast(`Leave ${status}`, status === "Approved" ? "success" : "warning",
        `${employees.find(e => e.id === leave.employee_id)?.full_name ?? leave.employee_id}'s leave request ${status.toLowerCase()}.`)
      await refresh()
    } catch (err) {
      showToast("Update Failed", "warning", err instanceof Error ? err.message : "Could not update leave status.")
    }
  }

  // Attendance stats
  const totalCells = employees.length * CYCLE_DAYS
  const presentCount = attendance.filter(r => r.status === "Present").length
  const absentCount = attendance.filter(r => r.status === "Absent").length
  const leaveCount = attendance.filter(r => r.status === "On Leave").length
  const presentPct = totalCells > 0 ? (presentCount / totalCells) * 100 : 0

  // Leave table
  const filteredLeaves = useMemo(() => {
    const q = leaveSearch.trim().toLowerCase()
    return leaves.filter(l => {
      const emp = employees.find(e => e.id === l.employee_id)
      const matchSearch = !q || [emp?.full_name, l.leave_type, l.reason, l.id].some(v => String(v ?? "").toLowerCase().includes(q))
      const matchType = leaveTypeFilter === "All" || l.leave_type === leaveTypeFilter
      const matchStatus = leaveStatusFilter === "All" || l.status === leaveStatusFilter
      return matchSearch && matchType && matchStatus
    })
  }, [leaves, employees, leaveSearch, leaveTypeFilter, leaveStatusFilter])

  const { sortKey, sortDir, handleSort, handleClearSort, sortItems } = useTableSort()
  const sortedLeaves = sortItems(filteredLeaves)

  const leaveColumns: TableColumn[] = [
    { key: "employee", label: "Employee", initialWidth: 200 },
    { key: "leave_type", label: "Leave Type", initialWidth: 140 },
    { key: "range", label: "Date Range", initialWidth: 180 },
    { key: "days", label: "Days", align: "center", initialWidth: 80 },
    { key: "reason", label: "Reason", initialWidth: 220 },
    { key: "status", label: "Status", align: "center", initialWidth: 120 },
    { key: "actions", label: "Actions", align: "right", sortable: false, initialWidth: 170 },
  ]
  const { colWidths, handleResizeStart } = useColumnWidths(
    Object.fromEntries(leaveColumns.map(c => [c.key, c.initialWidth ?? 130]))
  )

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <motion.div variants={stagger} initial="hidden" animate="visible"
        className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">

        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Attendance & Leave</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">Track team attendance and manage leave approvals.</p>
          </div>
          <SubPageNav items={getSectionChildren("/hr")} />
        </motion.div>

        {error && <GlassCard className="p-5 mb-5 text-sm font-bold text-rose-700 border-rose-200 bg-rose-50">{error}</GlassCard>}

        {loading ? <HRPageSkeleton rows={6} cards={4} /> : (
          <>
            {/* Tab bar */}
            <motion.div variants={fade} className="flex items-center justify-between border-b border-zinc-200/60 mb-6 pb-px">
              <div className="flex gap-2">
                {[
                  { id: "Attendance", label: "Team Attendance" },
                  { id: "Leave", label: `Leave Requests (${leaves.filter(l => l.status === "Pending").length})` },
                ].map(tab => {
                  const isActive = activeTab === tab.id
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as "Attendance" | "Leave")}
                      className="px-4 py-2.5 text-xs font-black relative tracking-tight transition-colors uppercase">
                      <span className={isActive ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-700"}>{tab.label}</span>
                      {isActive && <motion.div layoutId="attendance-tabs" className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-700" />}
                    </button>
                  )
                })}
              </div>
              <span className="text-[10px] font-mono font-black text-zinc-400 uppercase hidden sm:block">
                Cycle: Jul 1 – Jul {CYCLE_DAYS}, 2026
              </span>
            </motion.div>

            <AnimatePresence mode="wait">
              {/* ATTENDANCE TAB */}
              {activeTab === "Attendance" && (
                <motion.div key="att" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6">

                  {/* Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      ["Avg Presence", `${presentPct.toFixed(1)}%`],
                      ["Active Employees", `${employees.length}`],
                      ["Present Mandays", `${presentCount}`],
                      ["Leave / Absent", `${leaveCount} / ${absentCount}`],
                    ].map(([label, value]) => (
                      <GlassCard key={label} className="p-5">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">{label}</span>
                        <span className="text-xl font-black text-zinc-900 block mt-1">{value}</span>
                      </GlassCard>
                    ))}
                  </div>

                  {/* Grid */}
                  <GlassCard className="p-6 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-zinc-100 mb-6 gap-3">
                      <div>
                        <h3 className="text-xs font-black tracking-tight text-zinc-900 uppercase">Interactive Team Attendance Grid</h3>
                        <p className="text-[10px] font-semibold text-zinc-400 mt-0.5">Click cells to cycle: Present → Absent → On Leave.</p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap shrink-0">
                        <button onClick={() => showToast("Exporting Timecards", "info", "Compiling spreadsheet...")}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold">
                          <FileSpreadsheet className="size-3.5" /> Export Sheet
                        </button>
                        <div className="flex items-center gap-3 text-[10px] font-semibold text-zinc-500">
                          <span className="flex items-center gap-1"><span className="size-3 rounded bg-green-700 inline-block" /> Present</span>
                          <span className="flex items-center gap-1"><span className="size-3 rounded border border-red-300 inline-block" /> Absent</span>
                          <span className="flex items-center gap-1"><span className="size-3 rounded border border-blue-300 bg-blue-50/50 inline-block" /> On Leave</span>
                        </div>
                      </div>
                    </div>

                    {employees.length === 0 ? (
                      <p className="text-xs font-semibold text-zinc-400 text-center py-12">No employees loaded. Add employees in the Employees tab first.</p>
                    ) : (
                      <div className="overflow-x-auto table-scrollbar-x" data-table-scroll>
                        <div className="min-w-[820px] space-y-4">
                          {/* Day headers */}
                          <div className="grid items-center text-center" style={{ gridTemplateColumns: "200px repeat(14, 1fr)" }}>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider text-left">Employee</span>
                            {Array.from({ length: CYCLE_DAYS }, (_, i) => (
                              <span key={i} className="font-mono text-[10px] font-bold text-zinc-400">Jul {i + 1}</span>
                            ))}
                          </div>

                          {/* Employee rows */}
                          <div className="divide-y divide-zinc-100">
                            {employees.map(emp => (
                              <div key={emp.id} className="grid items-center py-3 hover:bg-zinc-50/50 rounded-xl px-1"
                                style={{ gridTemplateColumns: "200px repeat(14, 1fr)" }}>
                                <div className="flex items-center gap-2 pr-3 min-w-0">
                                  <div className="size-8 rounded-full bg-zinc-950 text-white flex items-center justify-center font-black text-[10px] shrink-0">
                                    {initials(emp.full_name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-zinc-900 truncate">{emp.full_name}</p>
                                    <p className="text-[10px] text-zinc-400 font-semibold truncate">{emp.warehouse_id}</p>
                                  </div>
                                </div>
                                {Array.from({ length: CYCLE_DAYS }, (_, i) => {
                                  const rec = attendanceMap.get(emp.id)?.get(i)
                                  const status = rec?.status ?? "Absent"
                                  return (
                                    <button key={i} onClick={() => toggleDay(emp, i)}
                                      title={`${emp.full_name} — Jul ${i + 1} (${status})`}
                                      className={`size-7 rounded-xl flex items-center justify-center text-[9px] font-black mx-auto transition-all active:scale-95 ${statusColor(status)}`}>
                                      {statusLabel(status)}
                                    </button>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 mt-6 flex items-start gap-2.5">
                      <Info className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-semibold text-zinc-500 leading-normal">
                        Attendance records are automatically updated. Each cell click records the status for that employee and day. Absence deductions can be reviewed in the Payroll module.
                      </p>
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {/* LEAVE TAB */}
              {activeTab === "Leave" && (
                <motion.div key="leave" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
                    <HRTableToolbar
                      title="Leave Applications"
                      subtitle={`${sortedLeaves.length} leave requests`}
                      searchValue={leaveSearch}
                      onSearchChange={setLeaveSearch}
                      searchPlaceholder="Search employee, type, reason..."
                      filters={[
                        { value: leaveTypeFilter, onChange: setLeaveTypeFilter,
                          options: ["All", ...LEAVE_TYPES].map(v => ({ value: v, label: v })) },
                        { value: leaveStatusFilter, onChange: setLeaveStatusFilter,
                          options: ["All", "Pending", "Approved", "Rejected", "Cancelled"].map(v => ({ value: v, label: v })) },
                      ]}
                      actions={[{ label: "Apply Leave", onClick: () => setShowApplyLeave(true) }]}
                    />
                    <div className="overflow-x-auto table-scrollbar-x" data-table-scroll>
                      <table className="w-full text-left border-collapse table-fixed">
                        <ResizableTableHeader columns={leaveColumns} colWidths={colWidths}
                          onResizeStart={handleResizeStart} sortKey={sortKey} sortDir={sortDir}
                          onSort={handleSort} onClearSort={handleClearSort} />
                        <tbody className="divide-y divide-black/5 text-xs">
                          {sortedLeaves.length === 0 ? (
                            <tr><td colSpan={7} className="py-12 text-center text-zinc-400 font-medium">No leave requests found.</td></tr>
                          ) : sortedLeaves.map(leave => {
                            const emp = employees.find(e => e.id === leave.employee_id)
                            return (
                              <tr key={leave.id} className="hover:bg-black/[0.02] transition-colors">
                                <td style={{ width: colWidths.employee }} className="py-3.5 px-3.5 truncate">
                                  <div className="flex items-center gap-2">
                                    <div className="size-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-black text-[10px] shrink-0">
                                      {initials(emp?.full_name ?? "?")}
                                    </div>
                                    <span className="truncate font-bold text-zinc-900">{emp?.full_name ?? leave.employee_id}</span>
                                  </div>
                                </td>
                                <td style={{ width: colWidths.leave_type }} className="py-3.5 px-3.5 truncate font-semibold text-zinc-700">{leave.leave_type}</td>
                                <td style={{ width: colWidths.range }} className="py-3.5 px-3.5 font-mono text-zinc-600 truncate">{leave.start_date} → {leave.end_date}</td>
                                <td style={{ width: colWidths.days }} className="py-3.5 px-3.5 text-center font-mono font-black text-zinc-900">{leave.number_of_days}</td>
                                <td style={{ width: colWidths.reason }} className="py-3.5 px-3.5 truncate text-zinc-500">"{leave.reason}"</td>
                                <td style={{ width: colWidths.status }} className="py-3.5 px-3.5 text-center">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border
                                    ${leave.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                      leave.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                    <span className={`size-1.5 rounded-full ${leave.status === "Approved" ? "bg-emerald-500" : leave.status === "Rejected" ? "bg-rose-500" : "bg-amber-500"}`} />
                                    {leave.status}
                                  </span>
                                </td>
                                <td style={{ width: colWidths.actions }} className="py-3.5 px-3.5 text-right whitespace-nowrap overflow-hidden">
                                  {leave.status === "Pending" ? (
                                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => handleLeaveStatus(leave, "Approved")}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-2xs cursor-pointer"
                                        title="Approve Leave"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleLeaveStatus(leave, "Rejected")}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] transition-all border border-rose-200/80 active:scale-95 shadow-2xs cursor-pointer"
                                        title="Reject Leave"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="inline-block px-2.5 py-1 rounded-xl text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200/80">Audited</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>

      {/* Apply Leave Modal */}
      <AnimatePresence>
        {showApplyLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-black/10">
              <div className="flex items-center justify-between pb-4 border-b border-black/5 mb-4">
                <h3 className="text-sm font-black uppercase">Submit Leave Application</h3>
                <button onClick={() => setShowApplyLeave(false)} className="p-1 rounded-full hover:bg-black/5 text-zinc-400">
                  <X className="size-4" />
                </button>
              </div>
              <form onSubmit={submitLeave} className="space-y-4">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Employee
                  <select required value={leaveForm.employee_id}
                    onChange={e => setLeaveForm(f => ({ ...f, employee_id: e.target.value }))}
                    className="mt-1 w-full bg-black/[0.03] border border-black/5 rounded-xl px-3 py-2 text-xs font-bold text-black outline-none">
                    <option value="">Select employee...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_number})</option>)}
                  </select>
                </label>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Leave Type
                  <select value={leaveForm.leave_type}
                    onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                    className="mt-1 w-full bg-black/[0.03] border border-black/5 rounded-xl px-3 py-2 text-xs font-bold text-black outline-none">
                    {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Start Date
                    <input required type="date" value={leaveForm.start_date}
                      onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                      className="mt-1 w-full bg-black/[0.03] border border-black/5 rounded-xl px-3 py-2 text-xs font-bold text-black outline-none" />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    End Date
                    <input required type="date" value={leaveForm.end_date}
                      onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                      className="mt-1 w-full bg-black/[0.03] border border-black/5 rounded-xl px-3 py-2 text-xs font-bold text-black outline-none" />
                  </label>
                </div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Reason
                  <textarea required rows={3} value={leaveForm.reason}
                    onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="Reason for leave..."
                    className="mt-1 w-full bg-black/[0.03] border border-black/5 rounded-xl px-3 py-2 text-xs font-semibold text-black outline-none resize-none" />
                </label>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowApplyLeave(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-zinc-500 hover:bg-black/5">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="px-5 py-2 rounded-full bg-black hover:bg-zinc-800 text-white text-xs font-bold shadow-xs disabled:opacity-50">
                    {saving ? "Submitting..." : "Submit Application"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
