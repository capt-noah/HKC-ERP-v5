import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Eye, ImagePlus, Pencil, UserMinus, X } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { HRPageSkeleton } from "@/components/HRSkeleton"
import { SubPageNav } from "@/components/SubPageNav"
import { HRTableToolbar, ResizableTableHeader, type TableColumn, useColumnWidths, useTableSort } from "@/components/HRTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useFeedback } from "@/context/FeedbackContext"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { getSectionChildren, navSections } from "@/lib/nav-config"
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, WAREHOUSE_OPTIONS, employeeDuplicateKey, emptyEmployee, hrApi, initials, loadHRData, makeId, money, type AttendanceRecord, type Employee, type LeaveRequest, type PayrollRecord } from "@/lib/hrApi"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

type FormState = Omit<Employee, "id">

export default function Employees() {
  const { showToast } = useFeedback()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [payroll, setPayroll] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("All")
  const [warehouse, setWarehouse] = useState("All")
  const [employmentType, setEmploymentType] = useState("All")
  const [editing, setEditing] = useState<Employee | null>(null)
  const [viewing, setViewing] = useState<Employee | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyEmployee)
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await loadHRData()
      setEmployees(data.employees)
      setAttendance(data.attendance)
      setLeaves(data.leaves)
      setPayroll(data.payrollRecords)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees.filter((employee) => {
      const matchesSearch = !query || [employee.employee_number, employee.full_name, employee.phone, employee.email].some((value) => String(value || "").toLowerCase().includes(query))
      const matchesStatus = status === "All" || employee.status === status
      const matchesWarehouse = warehouse === "All" || employee.warehouse_id === warehouse
      const matchesType = employmentType === "All" || employee.employment_type === employmentType
      return matchesSearch && matchesStatus && matchesWarehouse && matchesType
    })
  }, [employees, employmentType, search, status, warehouse])

  const { sortKey, sortDir, handleSort, handleClearSort, sortItems } = useTableSort()
  const sortedEmployees = sortItems(filteredEmployees)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [search, status, warehouse, employmentType, filteredEmployees.length])

  const totalPages = Math.max(1, Math.ceil(sortedEmployees.length / pageSize))
  const displayedEmployees = sortedEmployees.slice((page - 1) * pageSize, page * pageSize)

  const columns: TableColumn[] = [
    { key: "full_name", label: "Full Name", initialWidth: 200 },
    { key: "phone", label: "Phone", initialWidth: 140 },
    { key: "email", label: "Email", initialWidth: 200 },
    { key: "warehouse_id", label: "Office", initialWidth: 150 },
    { key: "employment_type", label: "Employment Type", initialWidth: 150 },
    { key: "start_date", label: "Start Date", initialWidth: 130 },
    { key: "basic_salary", label: "Gross Salary", align: "right", initialWidth: 140 },
    { key: "status", label: "Status", align: "center", initialWidth: 130 },
    { key: "actions", label: "Actions", align: "right", sortable: false, initialWidth: 200 },
  ]
  const { colWidths, handleResizeStart } = useColumnWidths(Object.fromEntries(columns.map((col) => [col.key, col.initialWidth || 130])))

  const openAdd = () => {
    setEditing(null)
    setForm(emptyEmployee)
    setShowForm(true)
  }

  const openEdit = (employee: Employee) => {
    setEditing(employee)
    setForm({ ...employee })
    setShowForm(true)
  }

  const closeForm = () => {
    if (saving) return
    setEditing(null)
    setForm(emptyEmployee)
    setShowForm(false)
  }

  const validate = () => {
    if (!form.full_name.trim()) return "Full name is required."
    if (!form.start_date) return "Start date is required."
    if (!form.warehouse_id) return "Office is required."
    if (!form.employment_type) return "Employment type is required."
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Email must be valid when provided."
    if (Number(form.basic_salary) < 0) return "Basic salary cannot be negative."
    const duplicateDetails = employees.find((employee) => employeeDuplicateKey(employee) === employeeDuplicateKey(form) && employee.id !== editing?.id)
    if (duplicateDetails) return `Duplicate employee details match ${duplicateDetails.full_name} (${duplicateDetails.employee_number}).`
    return ""
  }

  const saveEmployee = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      showToast("Employee Not Saved", "warning", validationError)
      return
    }
    const employeeNumber = editing?.employee_number || form.employee_number || makeId("EMP")
    const payload = { ...form, employee_number: employeeNumber, email: form.email.trim(), basic_salary: Number(form.basic_salary || 0) }
    setSaving(true)
    try {
      let savedEmployee: Employee
      if (editing) {
        savedEmployee = await hrApi.updateEmployee(editing.id, payload)
        setEmployees((prev) => prev.map((employee) => employee.id === editing.id ? { ...employee, ...savedEmployee, ...payload, id: editing.id } : employee))
        showToast("Employee Updated", "success", `${payload.full_name} was updated.`)
      } else {
        savedEmployee = await hrApi.createEmployee({ id: employeeNumber, ...payload })
        setEmployees((prev) => [{ ...payload, ...savedEmployee, id: savedEmployee.id || employeeNumber }, ...prev])
        showToast("Employee Registered", "success", `${payload.full_name} was registered successfully.`)
      }
      setEditing(null)
      setForm(emptyEmployee)
      setShowForm(false)
      void refresh()
    } catch (err) {
      showToast("Employee Save Failed", "warning", err instanceof Error ? err.message : "Could not save the employee record.")
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (employee: Employee) => {
    try {
      await hrApi.updateEmployee(employee.id, { status: "Inactive" })
      showToast("Employee Deactivated", "success", `${employee.full_name} is now inactive.`)
      await refresh()
    } catch (err) {
      showToast("Deactivate Failed", "warning", err instanceof Error ? err.message : "Could not update employee status.")
    }
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight mt-1">Employees</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">Employee registration and personnel directory.</p>
          </div>
          <SubPageNav items={getSectionChildren("/hr")} />
        </motion.div>

        {error && <GlassCard className="p-5 mb-5 text-sm font-bold text-rose-700 border-rose-200 bg-rose-50">{error}</GlassCard>}

        {loading ? (
          <HRPageSkeleton rows={7} cards={4} />
        ) : (
        <motion.div variants={fade}>
          <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
            <HRTableToolbar
              title="Employees"
              subtitle={`${sortedEmployees.length} employee records`}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search name, phone, or email..."
              filters={[
                { value: status, onChange: setStatus, options: ["All", ...EMPLOYEE_STATUSES].map((item) => ({ value: item, label: item })) },
                { value: warehouse, onChange: setWarehouse, options: ["All", ...WAREHOUSE_OPTIONS].map((item) => ({ value: item, label: item })) },
                { value: employmentType, onChange: setEmploymentType, options: ["All", ...EMPLOYMENT_TYPES].map((item) => ({ value: item, label: item })) },
              ]}
              actions={[{ label: "Add Employee", onClick: openAdd }]}
            />
            <TableScrollWrapper>
              <table className="w-full text-left border-collapse table-fixed">
                <ResizableTableHeader columns={columns} colWidths={colWidths} onResizeStart={handleResizeStart} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onClearSort={handleClearSort} />
                <tbody className="divide-y divide-black/5 text-xs">
                  {!loading && sortedEmployees.length === 0 ? (
                    <tr><td colSpan={9} className="py-12 text-center text-zinc-400 font-medium">No employees have been registered yet.</td></tr>
                  ) : displayedEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-black/[0.02] transition-colors">
                      <Cell width={colWidths.full_name}><div className="flex items-center gap-2"><span className="size-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black">{initials(employee.full_name)}</span><span className="truncate">{employee.full_name}</span></div></Cell>
                      <Cell width={colWidths.phone}>{employee.phone || "-"}</Cell>
                      <Cell width={colWidths.email}>{employee.email || "-"}</Cell>
                      <Cell width={colWidths.warehouse_id}>{employee.warehouse_id}</Cell>
                      <Cell width={colWidths.employment_type}>{employee.employment_type}</Cell>
                      <Cell width={colWidths.start_date}>{employee.start_date}</Cell>
                      <Cell width={colWidths.basic_salary} align="right">ETB {money(employee.basic_salary)}</Cell>
                      <Cell width={colWidths.status} align="center"><StatusPill status={employee.status} /></Cell>
                      <Cell width={colWidths.actions} align="right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setViewing(employee)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="View Employee Details"
                          >
                            <Eye className="size-3 text-zinc-700" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(employee)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="Edit Employee Details"
                          >
                            <Pencil className="size-3 text-zinc-700" /> Edit
                          </button>
                          {employee.status === "Active" && (
                            <button
                              type="button"
                              onClick={() => deactivate(employee)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] transition-all border border-rose-200/80 active:scale-95 shadow-2xs cursor-pointer"
                              title="Deactivate Employee"
                            >
                              <UserMinus className="size-3 text-rose-600" /> Deactivate
                            </button>
                          )}
                        </div>
                      </Cell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>

            {!loading && sortedEmployees.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-black/5 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                  <span>
                    Showing {Math.min((page - 1) * pageSize + 1, sortedEmployees.length)} to {Math.min(page * pageSize, sortedEmployees.length)} of {sortedEmployees.length} entries
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
        </motion.div>
        )}
      </motion.div>

      {showForm && (
        <EmployeeForm form={form} setForm={setForm} title={editing ? "Edit Employee" : "Add Employee"} saving={saving} onClose={closeForm} onSubmit={saveEmployee} />
      )}
      {viewing && <EmployeeDetails employee={viewing} attendance={attendance} leaves={leaves} payroll={payroll} onClose={() => setViewing(null)} />}
    </div>
  )
}

function Cell({ width, align = "left", children }: { width: number; align?: "left" | "right" | "center"; children: React.ReactNode }) {
  return <td style={{ width }} className={`py-3.5 px-3.5 truncate font-medium text-zinc-700 ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}>{children}</td>
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "Active" ? "bg-white text-zinc-900 border-emerald-200" : status === "On Leave" ? "bg-white text-zinc-900 border-blue-200" : "bg-white text-zinc-900 border-zinc-200"
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold uppercase ${tone}`}>{status}</span>
}

function EmployeeForm({ form, setForm, title, saving, onClose, onSubmit }: { form: FormState; setForm: (form: FormState) => void; title: string; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const field = (key: keyof FormState, value: string | number) => setForm({ ...form, [key]: value })
  const handleNationalIdImage = (file: File | undefined) => {
    if (!file) return
    if (file.size > 5_000_000) {
      window.alert("National ID image must be 5 MB or smaller.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const maxWidth = 640
        const scale = Math.min(1, maxWidth / image.width)
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72)
        if (dataUrl.length > 250_000) {
          window.alert("National ID image is still too large after compression. Please upload a smaller image.")
          return
        }
        field("national_id_image", dataUrl)
      }
      image.src = String(reader.result || "")
    }
    reader.readAsDataURL(file)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-5xl max-h-[90vh] overflow-y-auto no-scrollbar bg-white rounded-3xl p-6 shadow-2xl border border-black/10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-black">{title}</h3>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-40"><X className="size-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Full Name" required value={form.full_name} onChange={(v) => field("full_name", v)} />
          <Input label="Phone" required value={form.phone} onChange={(v) => field("phone", v)} />
          <Input label="Email" type="email" value={form.email} onChange={(v) => field("email", v)} />
          <Input label="Address" required value={form.address} onChange={(v) => field("address", v)} />
          <Input label="Gender" required value={form.gender} onChange={(v) => field("gender", v)} />
          <Select label="Office" value={form.warehouse_id} options={WAREHOUSE_OPTIONS} onChange={(v) => field("warehouse_id", v)} />
          <Select label="Employment Type" value={form.employment_type} options={EMPLOYMENT_TYPES} onChange={(v) => field("employment_type", v)} />
          <Select label="Status" value={form.status} options={EMPLOYEE_STATUSES} onChange={(v) => field("status", v)} />
          <Input label="Start Date" type="date" required value={form.start_date} onChange={(v) => field("start_date", v)} />
          <Input label="Gross Salary" type="number" required value={form.basic_salary} onChange={(v) => field("basic_salary", Number(v))} />
          <Input label="Bank Account" required value={form.bank_account} onChange={(v) => field("bank_account", v)} />
          <Input label="Emergency Contact Name" required value={form.emergency_contact_name} onChange={(v) => field("emergency_contact_name", v)} />
          <Input label="Emergency Contact Phone" required value={form.emergency_contact_phone} onChange={(v) => field("emergency_contact_phone", v)} />
          <label className="md:col-span-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">
            National ID
            <div className="mt-1 flex min-h-24 items-center gap-3 rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-white border border-black/10 flex items-center justify-center">
                {form.national_id_image ? (
                  <img src={form.national_id_image} alt="National ID preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="size-6 text-zinc-400" />
                )}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-zinc-900">National ID image</span>
                <span className="block text-[10px] font-semibold text-zinc-500">Upload the employee National ID image.</span>
                <input type="file" accept="image/*" disabled={saving} onChange={(event) => handleNationalIdImage(event.target.files?.[0])} className="mt-2 w-full text-[10px] font-bold text-zinc-600 file:mr-2 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-white disabled:opacity-50" />
              </div>
            </div>
          </label>
          <div className="md:col-span-3 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-full bg-black/5 text-xs font-bold disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex min-w-34 items-center justify-center gap-2 px-5 py-2 rounded-full bg-black text-white text-xs font-bold disabled:cursor-wait disabled:bg-zinc-700 disabled:opacity-60 transition-colors">
              {saving ? <LoadingDots color="bg-white" size="sm" /> : "Save Employee"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold text-black outline-none focus:border-emerald-700" /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold text-black outline-none focus:border-emerald-700">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function EmployeeDetails({ employee, attendance, leaves, payroll, onClose }: { employee: Employee; attendance: AttendanceRecord[]; leaves: LeaveRequest[]; payroll: PayrollRecord[]; onClose: () => void }) {
  const [showNationalId, setShowNationalId] = useState(false)
  const employeeAttendance = attendance.filter((record) => record.employee_id === employee.id)
  const employeeLeaves = leaves.filter((request) => request.employee_id === employee.id)
  const employeePayroll = payroll.filter((record) => record.employee_id === employee.id)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto no-scrollbar bg-white rounded-3xl p-6 shadow-2xl border border-black/10">
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-black text-black">{employee.full_name}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X className="size-5" /></button></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Detail title="Personal Information" rows={[["Phone", employee.phone], ["Email", employee.email || "-"], ["Address", employee.address], ["Gender", employee.gender], ["National ID", employee.national_id_image ? "Uploaded" : "Not uploaded"]]} />
          <Detail title="Employment Information" rows={[["Office", employee.warehouse_id], ["Employment Type", employee.employment_type], ["Start Date", employee.start_date], ["Status", employee.status]]} />
          <Detail title="Salary Information" rows={[["Gross Salary", `ETB ${money(employee.basic_salary)}`], ["Bank Account", employee.bank_account], ["Emergency Contact", employee.emergency_contact_name], ["Emergency Phone", employee.emergency_contact_phone]]} />
        </div>
        {employee.national_id_image && (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => setShowNationalId(true)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-black text-white transition-colors hover:bg-zinc-800">
              <Eye className="size-4" />
              View National ID
            </button>
          </div>
        )}
        <History title="Attendance History" empty="No attendance records exist for this employee." rows={employeeAttendance.map((record) => `${record.attendance_date} - ${record.status} (${record.hours_worked || 0} hrs)`)} />
        <History title="Leave History" empty="No leave records exist for this employee." rows={employeeLeaves.map((request) => `${request.leave_type}: ${request.start_date} to ${request.end_date} - ${request.status}`)} />
        <History title="Payroll History" empty="No payroll records exist for this employee." rows={employeePayroll.map((record) => `Net ETB ${money(record.net_pay)} - ${record.payment_status}`)} />
      </motion.div>
      {showNationalId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-black text-black">National ID Document</h4>
                <p className="truncate text-xs font-semibold text-zinc-500">{employee.full_name}</p>
              </div>
              <button onClick={() => setShowNationalId(false)} className="shrink-0 rounded-lg p-1.5 hover:bg-black/5" aria-label="Close National ID preview"><X className="size-5" /></button>
            </div>
            <div className="max-h-[72vh] overflow-auto bg-zinc-100 p-4">
              <img src={employee.national_id_image} alt={`${employee.full_name} National ID document`} className="mx-auto max-h-[68vh] w-auto max-w-full rounded-xl bg-white object-contain shadow-sm" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function Detail({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4"><h4 className="text-xs font-black uppercase mb-3">{title}</h4>{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-1.5 text-xs"><span className="font-bold text-zinc-500">{label}</span><span className="font-black text-zinc-900 text-right">{value}</span></div>)}</div>
}

function History({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return <div className="mt-5"><h4 className="text-xs font-black uppercase mb-2">{title}</h4>{rows.length ? <div className="space-y-2">{rows.map((row) => <div key={row} className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs font-bold text-zinc-700">{row}</div>)}</div> : <p className="text-xs font-semibold text-zinc-400">{empty}</p>}</div>
}
