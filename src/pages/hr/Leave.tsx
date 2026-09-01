import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Ban, Check, FileText, Pencil, X } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { HRPageSkeleton } from "@/components/HRSkeleton"
import { SubPageNav } from "@/components/SubPageNav"
import { HRTableToolbar, ResizableTableHeader, type TableColumn, useColumnWidths, useTableSort } from "@/components/HRTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useFeedback } from "@/context/FeedbackContext"
import { getSectionChildren, navSections } from "@/lib/nav-config"
import { LEAVE_STATUSES, LEAVE_TYPES, hrApi, leaveDays, loadHRData, makeId, type Employee, type LeaveRequest } from "@/lib/hrApi"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }
const today = new Date().toISOString().slice(0, 10)
const documentExtensions = [".pdf", ".docx", ".png"]
const documentMimeTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png"]

function isAllowedDocumentName(value: string) {
  const name = value.trim().toLowerCase()
  return !name || documentExtensions.some((extension) => name.endsWith(extension))
}
const blankLeave = (employee?: Employee): Omit<LeaveRequest, "id"> => ({
  employee_id: employee?.id || "",
  leave_type: "Annual Leave",
  start_date: today,
  end_date: today,
  number_of_days: 1,
  reason: "",
  document_path: "",
  status: "Pending",
  notes: "",
})

export default function Leave() {
  const { showToast } = useFeedback()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [type, setType] = useState("All")
  const [status, setStatus] = useState("All")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [editing, setEditing] = useState<LeaveRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Omit<LeaveRequest, "id">>(blankLeave())

  const refresh = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await loadHRData()
      setEmployees(data.employees)
      setRequests(data.leaves)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave requests.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((request) => {
      const employee = employeeById.get(request.employee_id)
      const matchesSearch = !query || [employee?.full_name, employee?.employee_number, request.reason].some((value) => String(value || "").toLowerCase().includes(query))
      const matchesDate = (!from || request.end_date >= from) && (!to || request.start_date <= to)
      return matchesSearch && matchesDate && (type === "All" || request.leave_type === type) && (status === "All" || request.status === status)
    })
  }, [employeeById, from, requests, search, status, to, type])

  const { sortKey, sortDir, handleSort, handleClearSort, sortItems } = useTableSort()
  const sorted = sortItems(filtered)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [search, type, status, from, to, filtered.length])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const displayedLeaves = sorted.slice((page - 1) * pageSize, page * pageSize)

  const columns: TableColumn[] = [
    { key: "employee", label: "Employee", initialWidth: 220 },
    { key: "leave_type", label: "Leave Type", initialWidth: 150 },
    { key: "start_date", label: "Start Date", initialWidth: 130 },
    { key: "end_date", label: "End Date", initialWidth: 130 },
    { key: "number_of_days", label: "Days", align: "right", initialWidth: 90 },
    { key: "status", label: "Status", align: "center", initialWidth: 130 },
    { key: "reason", label: "Reason", initialWidth: 240 },
    { key: "actions", label: "Actions", align: "right", sortable: false, initialWidth: 170 },
  ]
  const { colWidths, handleResizeStart } = useColumnWidths(Object.fromEntries(columns.map((col) => [col.key, col.initialWidth || 130])))

  const openNew = () => {
    setEditing(null)
    setForm(blankLeave(employees[0]))
    setShowForm(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!employeeById.has(form.employee_id)) return showToast("Leave Not Saved", "warning", "Employee must exist.")
    const days = leaveDays(form.start_date, form.end_date)
    if (days < 1) return showToast("Leave Not Saved", "warning", "End date cannot be before start date.")
    if (!isAllowedDocumentName(form.document_path)) return showToast("Leave Not Saved", "warning", "Supporting document must be a PDF, DOCX, or PNG file.")
    const overlaps = requests.some((request) => request.id !== editing?.id && request.employee_id === form.employee_id && request.status === "Approved" && form.status === "Approved" && request.start_date <= form.end_date && request.end_date >= form.start_date)
    if (overlaps) return showToast("Leave Not Saved", "warning", "Approved leave cannot overlap another approved leave for this employee.")
    try {
      const payload = { ...form, number_of_days: days }
      if (editing) await hrApi.updateLeave(editing.id, payload)
      else await hrApi.createLeave({ id: makeId("LR"), ...payload })
      showToast("Leave Request Saved", "success", "Leave request has been recorded successfully.")
      setShowForm(false)
      await refresh()
    } catch (err) {
      showToast("Leave Save Failed", "warning", err instanceof Error ? err.message : "Could not save the leave request.")
    }
  }

  const changeStatus = async (request: LeaveRequest, nextStatus: string) => {
    try {
      await hrApi.updateLeave(request.id, { status: nextStatus })
      if (nextStatus === "Approved") {
        await hrApi.updateEmployee(request.employee_id, { status: "On Leave" })
      } else if (nextStatus === "Rejected" || nextStatus === "Cancelled") {
        const emp = employeeById.get(request.employee_id)
        if (emp && emp.status === "On Leave") {
          await hrApi.updateEmployee(request.employee_id, { status: "Active" })
        }
      }
      showToast("Leave Status Updated", "success", `Request changed to ${nextStatus}.`)
      await refresh()
    } catch (err) {
      showToast("Status Update Failed", "warning", err instanceof Error ? err.message : "Could not update leave request.")
    }
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div><h1 className="text-3xl font-black text-black tracking-tight mt-1">Leave Requests</h1><p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">Leave records, approvals, and date-range filtering.</p></div>
          <SubPageNav items={getSectionChildren("/hr")} />
        </motion.div>
        {error && <GlassCard className="p-5 mb-5 text-sm font-bold text-rose-700 border-rose-200 bg-rose-50">{error}</GlassCard>}
        {loading ? (
          <HRPageSkeleton rows={7} cards={4} />
        ) : (
        <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
          <HRTableToolbar
            title="Leave Requests"
            subtitle={`${sorted.length} leave records`}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search employee or reason..."
            filters={[
              { value: type, onChange: setType, options: ["All", ...LEAVE_TYPES].map((item) => ({ value: item, label: item })) },
              { value: status, onChange: setStatus, options: ["All", ...LEAVE_STATUSES].map((item) => ({ value: item, label: item })) },
            ]}
            actions={[{ label: "Add Leave Request", onClick: openNew }]}
            secondary={<div className="flex flex-wrap gap-2"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-full bg-black/[0.04] px-3.5 py-2 text-xs font-bold outline-none" /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-full bg-black/[0.04] px-3.5 py-2 text-xs font-bold outline-none" /></div>}
          />
          <TableScrollWrapper>
            <table className="w-full text-left border-collapse table-fixed">
              <ResizableTableHeader columns={columns} colWidths={colWidths} onResizeStart={handleResizeStart} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onClearSort={handleClearSort} />
              <tbody className="divide-y divide-black/5 text-xs">
                {!loading && sorted.length === 0 ? <tr><td colSpan={8} className="py-12 text-center text-zinc-400 font-medium">No leave requests have been recorded yet.</td></tr> : displayedLeaves.map((request) => {
                  const employee = employeeById.get(request.employee_id)
                  return <tr key={request.id} className="hover:bg-black/[0.02] transition-colors">
                    <Cell width={colWidths.employee}>{employee ? `${employee.full_name} (${employee.employee_number})` : "Unknown employee"}</Cell>
                    <Cell width={colWidths.leave_type}>{request.leave_type}</Cell>
                    <Cell width={colWidths.start_date}>{request.start_date}</Cell>
                    <Cell width={colWidths.end_date}>{request.end_date}</Cell>
                    <Cell width={colWidths.number_of_days} align="right">{request.number_of_days}</Cell>
                    <Cell width={colWidths.status} align="center">{request.status}</Cell>
                    <Cell width={colWidths.reason}>{request.reason || "-"}</Cell>
                    <Cell width={colWidths.actions} align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {request.status === "Pending" && (
                          <>
                            <button type="button" onClick={() => { setEditing(request); setForm({ ...request }); setShowForm(true) }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer" title="Edit Draft"><Pencil className="size-3 text-zinc-700" /> Edit</button>
                            <button type="button" onClick={() => changeStatus(request, "Approved")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-2xs cursor-pointer" title="Approve Leave"><Check className="size-3 text-emerald-700" /> Approve</button>
                          </>
                        )}
                        {request.status !== "Cancelled" && (
                          <button type="button" onClick={() => changeStatus(request, "Cancelled")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] transition-all border border-rose-200/80 active:scale-95 shadow-2xs cursor-pointer" title="Cancel Leave"><Ban className="size-3 text-rose-600" /> Cancel</button>
                        )}
                      </div>
                    </Cell>
                  </tr>
                })}
              </tbody>
            </table>
          </TableScrollWrapper>

          {!loading && sorted.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-black/5 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
              <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                <span>
                  Showing {Math.min((page - 1) * pageSize + 1, sorted.length)} to {Math.min(page * pageSize, sorted.length)} of {sorted.length} entries
                </span>
                <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                  <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                >
                  Previous
                </button>
                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </GlassCard>
        )}
      </motion.div>
      {showForm && <LeaveForm form={form} setForm={setForm} employees={employees} onClose={() => setShowForm(false)} onSubmit={save} />}
    </div>
  )
}

function Cell({ width, align = "left", children }: { width: number; align?: "left" | "right" | "center"; children: React.ReactNode }) {
  return <td style={{ width }} className={`py-3.5 px-3.5 truncate font-medium text-zinc-700 ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}>{children}</td>
}

function LeaveForm({ form, setForm, employees, onClose, onSubmit }: { form: Omit<LeaveRequest, "id">; setForm: (form: Omit<LeaveRequest, "id">) => void; employees: Employee[]; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const set = (key: keyof Omit<LeaveRequest, "id">, value: string | number) => setForm({ ...form, [key]: value, number_of_days: key === "start_date" || key === "end_date" ? leaveDays(key === "start_date" ? String(value) : form.start_date, key === "end_date" ? String(value) : form.end_date) : form.number_of_days })
  const handleDocument = (file: File | undefined) => {
    if (!file) return
    const name = file.name.trim()
    const lowerName = name.toLowerCase()
    const validExtension = documentExtensions.some((extension) => lowerName.endsWith(extension))
    const validMime = !file.type || documentMimeTypes.includes(file.type)
    if (!validExtension || !validMime) {
      window.alert("Supporting document must be a PDF, DOCX, or PNG file.")
      return
    }
    set("document_path", name)
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-3xl bg-white rounded-3xl p-6 shadow-2xl border border-black/10"><div className="flex items-center justify-between mb-5"><h3 className="text-lg font-black">Leave Request</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X className="size-5" /></button></div><form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Employee<select required value={form.employee_id} onChange={(event) => set("employee_id", event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold outline-none"><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_number})</option>)}</select></label>
    <Select label="Leave Type" value={form.leave_type} options={LEAVE_TYPES} onChange={(value) => set("leave_type", value)} />
    <Input label="Start Date" type="date" value={form.start_date} onChange={(value) => set("start_date", value)} required />
    <Input label="End Date" type="date" value={form.end_date} onChange={(value) => set("end_date", value)} required />
    <Input label="Number of Days" type="number" value={form.number_of_days} onChange={(value) => set("number_of_days", Number(value))} required />
    <Select label="Status" value={form.status} options={LEAVE_STATUSES} onChange={(value) => set("status", value)} />
    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Supporting Document
      <div className="mt-1 rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-3">
        <div className="flex min-h-10 items-center gap-3">
          <span className="size-9 rounded-lg bg-white border border-black/10 flex items-center justify-center text-zinc-500"><FileText className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-zinc-900">{form.document_path || "No document selected"}</p>
            <p className="text-[10px] font-semibold text-zinc-500">PDF, DOCX, or PNG only.</p>
          </div>
        </div>
        <input type="file" accept=".pdf,.docx,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png" onChange={(event) => handleDocument(event.target.files?.[0])} className="mt-3 w-full text-[10px] font-bold text-zinc-600 file:mr-2 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-white" />
      </div>
    </label>
    <Input label="Reason" value={form.reason} onChange={(value) => set("reason", value)} required />
    <Input label="Notes" value={form.notes} onChange={(value) => set("notes", value)} />
    <div className="md:col-span-2 flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-full bg-black/5 text-xs font-bold">Cancel</button><button type="submit" className="px-5 py-2 rounded-full bg-black text-white text-xs font-bold">Save Leave Request</button></div>
  </form></motion.div></div>
}

function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold outline-none" /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold outline-none">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}
