import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Save, UserCheck, UserX } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { HRPageSkeleton } from "@/components/HRSkeleton"
import { SubPageNav } from "@/components/SubPageNav"
import { HRTableToolbar } from "@/components/HRTable"
import { useFeedback } from "@/context/FeedbackContext"
import { getSectionChildren, navSections } from "@/lib/nav-config"
import { WAREHOUSE_OPTIONS, hrApi, initials, loadHRData, makeId, type AttendanceRecord, type Employee } from "@/lib/hrApi"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }
const today = new Date().toISOString().slice(0, 10)

type AttendanceDraft = Pick<AttendanceRecord, "status" | "notes">

function blankDraft(): AttendanceDraft {
  return { status: "Present", notes: "" }
}

export default function Attendance() {
  const { showToast } = useFeedback()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [date, setDate] = useState(today)
  const [search, setSearch] = useState("")
  const [warehouse, setWarehouse] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({})
  const [savingId, setSavingId] = useState("")

  const refresh = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await loadHRData()
      setEmployees(data.employees)
      setRecords(data.attendance)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const recordsByEmployee = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()
    for (const record of records) {
      if (record.attendance_date === date) map.set(record.employee_id, record)
    }
    return map
  }, [date, records])

  const employeeRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees.filter((employee) => {
      const saved = recordsByEmployee.get(employee.id)
      const draft = drafts[employee.id]
      const rowStatus = draft?.status || saved?.status || "Present"
      const matchesSearch =
        !query ||
        [employee.full_name, employee.employee_number, employee.phone, employee.email].some((value) =>
          String(value || "").toLowerCase().includes(query)
        )
      return (
        matchesSearch &&
        (warehouse === "All" || employee.warehouse_id === warehouse) &&
        (statusFilter === "All" || rowStatus === statusFilter)
      )
    })
  }, [drafts, employees, recordsByEmployee, search, statusFilter, warehouse])

  const getDraft = (employee: Employee) => {
    const saved = recordsByEmployee.get(employee.id)
    return (
      drafts[employee.id] || {
        status: saved?.status === "Absent" ? "Absent" : "Present",
        notes: saved?.notes || "",
      }
    )
  }

  const setDraft = (employeeId: string, patch: Partial<AttendanceDraft>) => {
    setDrafts((prev) => ({ ...prev, [employeeId]: { ...(prev[employeeId] || blankDraft()), ...patch } }))
  }

  const saveAttendance = async (employee: Employee) => {
    const draft = getDraft(employee)
    const existing = recordsByEmployee.get(employee.id)
    const hours = draft.status === "Present" ? 8 : 0
    const payload = {
      employee_id: employee.id,
      attendance_date: date,
      check_in_time: "",
      check_out_time: "",
      status: draft.status,
      hours_worked: hours,
      overtime_hours: 0,
      warehouse_id: employee.warehouse_id,
      notes: draft.notes || "",
      locked_by_payroll: existing?.locked_by_payroll || false,
    }

    setSavingId(employee.id)
    try {
      if (existing) {
        const saved = await hrApi.updateAttendance(existing.id, payload)
        setRecords((prev) =>
          prev.map((record) =>
            record.id === existing.id ? { ...record, ...saved, ...payload, id: existing.id } : record
          )
        )
      } else {
        const saved = await hrApi.createAttendance({ id: makeId("ATT"), ...payload })
        setRecords((prev) => [{ ...payload, ...saved, id: saved.id || makeId("ATT") }, ...prev])
      }
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[employee.id]
        return next
      })
      showToast("Attendance Saved", "success", `${employee.full_name}'s attendance marked as ${draft.status}.`)
    } catch (err) {
      showToast("Attendance Save Failed", "warning", err instanceof Error ? err.message : "Failed to save attendance.")
    } finally {
      setSavingId("")
    }
  }

  const [isSavingAll, setIsSavingAll] = useState(false)

  const saveAllAttendance = async () => {
    if (employeeRows.length === 0) return
    setIsSavingAll(true)
    try {
      await Promise.all(
        employeeRows.map(async (employee) => {
          const draft = getDraft(employee)
          const existing = recordsByEmployee.get(employee.id)
          const hours = draft.status === "Present" ? 8 : 0
          const payload = {
            employee_id: employee.id,
            attendance_date: date,
            check_in_time: "",
            check_out_time: "",
            status: draft.status,
            hours_worked: hours,
            overtime_hours: 0,
            warehouse_id: employee.warehouse_id,
            notes: draft.notes || "",
            locked_by_payroll: existing?.locked_by_payroll || false,
          }
          if (existing) {
            await hrApi.updateAttendance(existing.id, payload)
          } else {
            await hrApi.createAttendance({ id: makeId("ATT"), ...payload })
          }
        })
      )
      setDrafts({})
      showToast("Attendance Saved", "success", `Attendance for ${employeeRows.length} employee(s) saved for ${date}.`)
      await refresh()
    } catch (err) {
      showToast("Attendance Save Failed", "warning", err instanceof Error ? err.message : "Failed to batch save attendance.")
    } finally {
      setIsSavingAll(false)
    }
  }

  const markAllPresent = () => {
    const next: Record<string, AttendanceDraft> = { ...drafts }
    for (const employee of employeeRows) {
      next[employee.id] = { ...(next[employee.id] || blankDraft()), status: "Present" }
    }
    setDrafts(next)
    showToast("Batch Action", "info", "All filtered employees set to Present. Click 'Save All to DB' to commit.")
  }

  const markAllAbsent = () => {
    const next: Record<string, AttendanceDraft> = { ...drafts }
    for (const employee of employeeRows) {
      next[employee.id] = { ...(next[employee.id] || blankDraft()), status: "Absent" }
    }
    setDrafts(next)
    showToast("Batch Action", "info", "All filtered employees set to Absent. Click 'Save All to DB' to commit.")
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight mt-1">Attendance</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Daily attendance tracking with simple Present and Absent status management.
            </p>
          </div>
          <SubPageNav items={getSectionChildren("/hr")} />
        </motion.div>

        {error && <GlassCard className="p-5 mb-5 text-sm font-bold text-rose-700 border-rose-200 bg-rose-50">{error}</GlassCard>}

        {loading ? (
          <HRPageSkeleton rows={7} cards={4} />
        ) : (
          <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
            <HRTableToolbar
              title="Daily Attendance Matrix"
              subtitle={`${employeeRows.length} employees for ${date}`}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search employee..."
              filters={[
                {
                  value: warehouse,
                  onChange: setWarehouse,
                  options: ["All", ...WAREHOUSE_OPTIONS].map((item) => ({ value: item, label: item })),
                },
                {
                  value: statusFilter,
                  onChange: setStatusFilter,
                  options: ["All", "Present", "Absent"].map((item) => ({ value: item, label: item })),
                },
              ]}
              actions={[
                { label: isSavingAll ? "Saving..." : "Save All to DB", onClick: saveAllAttendance, variant: "primary" },
                { label: "Mark All Present", onClick: markAllPresent, variant: "secondary" },
                { label: "Mark All Absent", onClick: markAllAbsent, variant: "secondary" },
              ]}
              secondary={
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="rounded-xl border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 outline-none shadow-2xs"
                />
              }
            />
            <div className="overflow-x-auto table-scrollbar-x" data-table-scroll>
              <div className="min-w-[700px] divide-y divide-black/5">
                <div className="grid grid-cols-[300px_180px_minmax(180px,_1fr)_120px] gap-3 bg-black/[0.03] px-5 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  <span>Employee</span>
                  <span>Attendance Status</span>
                  <span>Notes</span>
                  <span className="text-right">Action</span>
                </div>

                {employeeRows.length === 0 ? (
                  <div className="px-5 py-12 text-center text-xs font-semibold text-zinc-400">
                    No employees match this attendance view.
                  </div>
                ) : (
                  employeeRows.map((employee) => {
                    const draft = getDraft(employee)
                    const isSaving = savingId === employee.id
                    const isPresent = draft.status === "Present"

                    return (
                      <div
                        key={employee.id}
                        className="grid grid-cols-[300px_180px_minmax(180px,_1fr)_120px] items-center gap-3 px-5 py-3.5 text-xs hover:bg-black/[0.02] transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="size-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                            {initials(employee.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-black text-zinc-950">{employee.full_name}</p>
                            <p className="truncate text-[10px] font-bold text-zinc-400">
                              {employee.employee_number} • {employee.warehouse_id}
                            </p>
                          </div>
                        </div>

                        {/* Status Toggle Buttons: Present / Absent */}
                        <div className="inline-flex rounded-xl bg-black/[0.04] p-1 gap-1 w-fit">
                          <button
                            type="button"
                            onClick={() => setDraft(employee.id, { status: "Present" })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                              isPresent
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-zinc-600 hover:bg-white/80"
                            }`}
                          >
                            <UserCheck className="size-3.5" />
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraft(employee.id, { status: "Absent" })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                              !isPresent
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-zinc-600 hover:bg-white/80"
                            }`}
                          >
                            <UserX className="size-3.5" />
                            Absent
                          </button>
                        </div>

                        {/* Notes Input */}
                        <input
                          value={draft.notes}
                          onChange={(event) => setDraft(employee.id, { notes: event.target.value })}
                          placeholder="Optional remarks..."
                          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-black"
                        />

                        {/* Save Button */}
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => saveAttendance(employee)}
                            disabled={isSaving}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-[11px] transition-all active:scale-95 shadow-2xs disabled:opacity-50 cursor-pointer"
                          >
                            {isSaving ? (
                              <span className="size-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            ) : (
                              <Save className="size-3 text-white" />
                            )}
                            Save
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </GlassCard>
        )}
      </motion.div>
    </div>
  )
}
