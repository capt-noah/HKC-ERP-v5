import { useEffect, useMemo, useRef, useState } from "react"
import {
  Eye,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  UserCheck,
  UserMinus,
  X,
  CheckCircle2,
  ShieldCheck,
  ZoomIn,
  Trash2,
  UploadCloud,
  ExternalLink,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { HRPageSkeleton } from "@/components/HRSkeleton"
import { SubPageNav } from "@/components/SubPageNav"
import { HRTableToolbar, ResizableTableHeader, type TableColumn, useColumnWidths, useTableSort } from "@/components/HRTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useFeedback } from "@/context/FeedbackContext"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getSectionChildren, navSections } from "@/lib/nav-config"
import { loadResource } from "@/lib/apiPersistence"
import { resolveWarehouseFullName, withOperatingWarehouses, getRegisteredWarehouses } from "@/lib/warehouses"
import type { Warehouse } from "@/lib/erpStore"
import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  employeeDuplicateKey,
  emptyEmployee,
  hrApi,
  initials,
  loadHRData,
  makeId,
  money,
  type AttendanceRecord,
  type Employee,
  type LeaveRequest,
  type PayrollRecord,
} from "@/lib/hrApi"
import { uploadFile, resolveFileUrl } from "@/lib/fileUpload"
import { cn } from "@/lib/utils"

type FormState = Omit<Employee, "id">

export default function Employees() {
  const { showToast, confirm } = useFeedback()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [payroll, setPayroll] = useState<PayrollRecord[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => getRegisteredWarehouses())
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
  const [showIdModalFor, setShowIdModalFor] = useState<Employee | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError("")
    try {
      const [data, whData] = await Promise.all([
        loadHRData(),
        loadResource<Warehouse>("warehouses").catch(() => []),
      ])
      setEmployees(data.employees)
      setAttendance(data.attendance)
      setLeaves(data.leaves)
      setPayroll(data.payrollRecords)
      setWarehouses(withOperatingWarehouses(whData || []))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const warehouseFilterOptions = useMemo(() => {
    const opts = [{ value: "All", label: "All Warehouses" }]
    const set = new Set<string>()
    const addOpt = (rawName?: string | null) => {
      if (!rawName) return
      const full = resolveWarehouseFullName(rawName, warehouses)
      const key = full.toLowerCase().trim()
      if (key && !set.has(key)) {
        set.add(key)
        opts.push({ value: full, label: full })
      }
    }
    warehouses.forEach((w) => addOpt(w.name || w.id))
    employees.forEach((emp) => {
      if (emp.warehouse_id) addOpt(emp.warehouse_id)
    })
    addOpt("Head Office")
    addOpt("Not Assigned")
    return opts
  }, [warehouses, employees])

  const warehouseFormOptions = useMemo(() => {
    const set = new Set<string>()
    const opts: string[] = []
    const addOpt = (rawName?: string | null) => {
      if (!rawName) return
      const full = resolveWarehouseFullName(rawName, warehouses)
      const key = full.toLowerCase().trim()
      if (key && !set.has(key)) {
        set.add(key)
        opts.push(full)
      }
    }
    warehouses.forEach((w) => addOpt(w.name || w.id))
    addOpt("Head Office")
    addOpt("Not Assigned")
    return opts
  }, [warehouses])

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees.filter((employee) => {
      const empWhFull = resolveWarehouseFullName(employee.warehouse_id, warehouses)
      const matchesSearch =
        !query ||
        [employee.employee_number, employee.full_name, employee.phone, employee.email, employee.warehouse_id, empWhFull].some(
          (value) => String(value || "").toLowerCase().includes(query)
        )
      const matchesStatus = status === "All" || employee.status === status
      const matchesWarehouse =
        warehouse === "All" ||
        employee.warehouse_id === warehouse ||
        empWhFull === warehouse ||
        empWhFull === resolveWarehouseFullName(warehouse, warehouses)
      const matchesType = employmentType === "All" || employee.employment_type === employmentType
      return matchesSearch && matchesStatus && matchesWarehouse && matchesType
    })
  }, [employees, employmentType, search, status, warehouse, warehouses])

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
    { key: "full_name", label: "Full Name", initialWidth: 220 },
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
    const payload: Employee = {
      id: editing?.id || employeeNumber,
      ...form,
      employee_number: employeeNumber,
      email: form.email.trim(),
      basic_salary: Number(form.basic_salary || 0),
      national_id_image: form.national_id_image ? form.national_id_image.trim() : "",
    }

    setSaving(true)
    try {
      let savedEmployee: Employee
      if (editing) {
        savedEmployee = await hrApi.updateEmployee(editing.id, payload)
        setEmployees((prev) =>
          prev.map((employee) =>
            employee.id === editing.id
              ? { ...employee, ...savedEmployee, ...payload, id: editing.id }
              : employee
          )
        )
        showToast("Employee Updated", "success", `${payload.full_name} was updated.`)
      } else {
        savedEmployee = await hrApi.createEmployee(payload)
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

  const reactivate = async (employee: Employee) => {
    try {
      await hrApi.updateEmployee(employee.id, { status: "Active" })
      showToast("Employee Reactivated", "success", `${employee.full_name} is now active.`)
      await refresh()
    } catch (err) {
      showToast("Reactivate Failed", "warning", err instanceof Error ? err.message : "Could not update employee status.")
    }
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <div className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight mt-1">Employees</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">Employee registration and personnel directory.</p>
          </div>
          <SubPageNav items={getSectionChildren("/hr")} />
        </div>

        {error && <GlassCard className="p-5 mb-5 text-sm font-bold text-rose-700 border-rose-200 bg-rose-50">{error}</GlassCard>}

        {loading ? (
          <HRPageSkeleton rows={7} cards={4} />
        ) : (
        <div>
          <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
            <HRTableToolbar
              title="Employees"
              subtitle={`${sortedEmployees.length} employee records`}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search name, phone, or email..."
              filters={[
                { value: status, onChange: setStatus, options: ["All", ...EMPLOYEE_STATUSES].map((item) => ({ value: item, label: item })) },
                { value: warehouse, onChange: setWarehouse, options: warehouseFilterOptions },
                { value: employmentType, onChange: setEmploymentType, options: ["All", ...EMPLOYMENT_TYPES].map((item) => ({ value: item, label: item })) },
              ]}
              actions={[{ label: "Add Employee", onClick: openAdd }]}
              onReload={refresh}
              isReloading={loading}
              reloadTooltip="Reload employee records from server"
            />
            <TableScrollWrapper>
              <table className="w-full text-left border-collapse table-fixed">
                <ResizableTableHeader columns={columns} colWidths={colWidths} onResizeStart={handleResizeStart} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onClearSort={handleClearSort} />
                <tbody className="divide-y divide-black/5 text-xs">
                  {!loading && sortedEmployees.length === 0 ? (
                    <tr><td colSpan={9} className="py-12 text-center text-zinc-400 font-medium">No employees have been registered yet.</td></tr>
                  ) : displayedEmployees.map((employee) => {
                    const hasIdImage = Boolean(employee.national_id_image && employee.national_id_image.trim())
                    return (
                      <tr key={employee.id} className="hover:bg-black/[0.02] transition-colors">
                        <Cell width={colWidths.full_name}>
                          <div className="flex items-center gap-2">
                            <span className="size-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                              {initials(employee.full_name)}
                            </span>
                            <span className="truncate font-bold text-zinc-900">{employee.full_name}</span>
                            {hasIdImage && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowIdModalFor(employee)
                                }}
                                className="inline-flex items-center text-emerald-600 hover:text-emerald-700 hover:scale-110 transition-transform cursor-pointer"
                                title="National ID Document Attached (Click to view)"
                              >
                                <ShieldCheck className="size-4" />
                              </button>
                            )}
                          </div>
                        </Cell>
                        <Cell width={colWidths.phone}>{employee.phone || "-"}</Cell>
                        <Cell width={colWidths.email}>{employee.email || "-"}</Cell>
                        <Cell width={colWidths.warehouse_id}>{resolveWarehouseFullName(employee.warehouse_id, warehouses)}</Cell>
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

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center size-7 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                                  title="More Employee Actions"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-1.5 z-50">
                                <DropdownMenuItem
                                  onClick={() => setShowIdModalFor(employee)}
                                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                                >
                                  <ShieldCheck className="size-3.5 text-emerald-600" /> View National ID
                                </DropdownMenuItem>
                                {employee.status === "Active" ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      confirm({
                                        title: "Deactivate Employee",
                                        message: `Are you sure you want to deactivate ${employee.full_name} (${employee.employee_number})? They will be marked Inactive and excluded from active payroll cycles.`,
                                        confirmLabel: "Deactivate Employee",
                                        isDestructive: true,
                                        onConfirm: () => deactivate(employee),
                                      })
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                                  >
                                    <UserMinus className="size-3.5" /> Deactivate Employee
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      confirm({
                                        title: "Reactivate Employee",
                                        message: `Are you sure you want to reactivate ${employee.full_name} (${employee.employee_number})? They will be marked Active again.`,
                                        confirmLabel: "Reactivate Employee",
                                        isDestructive: false,
                                        onConfirm: () => reactivate(employee),
                                      })
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl cursor-pointer"
                                  >
                                    <UserCheck className="size-3.5" /> Reactivate Employee
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Cell>
                      </tr>
                    )
                  })}
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
        </div>
        )}
      </div>

      {showForm && (
        <EmployeeForm
          form={form}
          setForm={setForm}
          title={editing ? "Edit Employee" : "Add Employee"}
          saving={saving}
          warehouseOptions={warehouseFormOptions}
          warehouses={warehouses}
          onClose={closeForm}
          onSubmit={saveEmployee}
        />
      )}

      {viewing && (
        <EmployeeDetails
          employee={viewing}
          attendance={attendance}
          leaves={leaves}
          payroll={payroll}
          warehouses={warehouses}
          onClose={() => setViewing(null)}
          onEdit={(emp) => {
            setViewing(null)
            openEdit(emp)
          }}
        />
      )}

      {/* Standalone National ID Preview Modal from Table List */}
      {showIdModalFor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-black/10">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 bg-zinc-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-black text-black">National ID Identification Document</h4>
                  <p className="truncate text-xs font-bold text-zinc-500">{showIdModalFor.full_name} ({showIdModalFor.employee_number})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showIdModalFor.national_id_image && (
                  <button
                    type="button"
                    onClick={() => window.open(resolveFileUrl(showIdModalFor.national_id_image), "_blank")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-zinc-100 text-black text-xs font-bold transition-colors cursor-pointer"
                    title="Open in new browser tab"
                  >
                    <ExternalLink className="size-3.5" /> Open Tab
                  </button>
                )}
                <button
                  onClick={() => setShowIdModalFor(null)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-zinc-500 hover:text-black transition-colors cursor-pointer"
                  aria-label="Close National ID preview"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-auto bg-zinc-100 p-6 flex items-center justify-center">
              {showIdModalFor.national_id_image ? (
                <img
                  src={resolveFileUrl(showIdModalFor.national_id_image)}
                  alt={`${showIdModalFor.full_name} National ID document`}
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-2xl bg-white object-contain shadow-md border border-black/10"
                />
              ) : (
                <div className="text-center py-16 px-4">
                  <ImagePlus className="size-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-zinc-700">No National ID Document Uploaded</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    This employee does not have a National ID document on file. You can upload one by editing the employee details.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const emp = showIdModalFor
                      setShowIdModalFor(null)
                      openEdit(emp)
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                  >
                    <Pencil className="size-3.5" /> Edit & Upload National ID
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

function EmployeeForm({
  form,
  setForm,
  title,
  saving,
  warehouseOptions,
  warehouses = [],
  onClose,
  onSubmit,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  title: string
  saving: boolean
  warehouseOptions: string[]
  warehouses?: Warehouse[]
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
}) {
  const [uploadingId, setUploadingId] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const field = (key: keyof FormState, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleNationalIdImage = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 15_000_000) {
      window.alert("National ID document must be 15 MB or smaller.")
      return
    }
    try {
      setUploadingId(true)
      const res = await uploadFile(file, "employees")
      setForm((prev) => ({ ...prev, national_id_image: res.url }))
    } catch (err) {
      console.warn("National ID image upload failed:", err)
      window.alert("Failed to upload National ID image. Please try again.")
    } finally {
      setUploadingId(false)
    }
  }

  const handleRemoveId = () => {
    setForm((prev) => ({ ...prev, national_id_image: "" }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto no-scrollbar bg-white rounded-3xl p-6 shadow-2xl border border-black/10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-black">{title}</h3>
          <button onClick={onClose} disabled={saving || uploadingId} className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-40 cursor-pointer"><X className="size-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Full Name" required value={form.full_name} onChange={(v) => field("full_name", v)} />
          <Input label="Phone" required value={form.phone} onChange={(v) => field("phone", v)} />
          <Input label="Email" type="email" value={form.email} onChange={(v) => field("email", v)} />
          <Input label="Address" required value={form.address} onChange={(v) => field("address", v)} />
          <Input label="Gender" required value={form.gender} onChange={(v) => field("gender", v)} />
          <Select
            label="Warehouse / Office"
            value={resolveWarehouseFullName(form.warehouse_id, warehouses) || form.warehouse_id}
            options={warehouseOptions}
            onChange={(v) => field("warehouse_id", v)}
          />
          <Select label="Employment Type" value={form.employment_type} options={EMPLOYMENT_TYPES} onChange={(v) => field("employment_type", v)} />
          <Select label="Status" value={form.status} options={EMPLOYEE_STATUSES} onChange={(v) => field("status", v)} />
          <Input label="Start Date" type="date" required value={form.start_date} onChange={(v) => field("start_date", v)} />
          <Input label="Gross Salary" type="number" required value={form.basic_salary} onChange={(v) => field("basic_salary", Number(v))} />
          <Input label="Bank Account" required value={form.bank_account} onChange={(v) => field("bank_account", v)} />
          <Input label="Emergency Contact Name" required value={form.emergency_contact_name} onChange={(v) => field("emergency_contact_name", v)} />
          <Input label="Emergency Contact Phone" required value={form.emergency_contact_phone} onChange={(v) => field("emergency_contact_phone", v)} />

          {/* National ID Document Upload / Attached View Section */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">
              National ID Document
            </label>
            <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-4 transition-all">
              {form.national_id_image ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      onClick={() => setPreviewOpen(true)}
                      className="group relative size-16 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white cursor-pointer shadow-xs"
                      title="Click to view full preview"
                    >
                      <img
                        src={resolveFileUrl(form.national_id_image)}
                        alt="National ID preview"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ZoomIn className="size-4" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                          <CheckCircle2 className="size-3" /> Document Attached
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-900 mt-1">National ID Image on file</p>
                      <p className="text-[11px] text-zinc-500 truncate">Saved with employee profile</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-zinc-50 text-black text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <Eye className="size-3.5 text-zinc-600" /> View Document
                    </button>
                    <button
                      type="button"
                      disabled={saving || uploadingId}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-zinc-50 text-black text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Pencil className="size-3.5 text-zinc-600" /> Replace
                    </button>
                    <button
                      type="button"
                      disabled={saving || uploadingId}
                      onClick={handleRemoveId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-14 shrink-0 rounded-xl bg-white border border-black/10 flex items-center justify-center text-zinc-400">
                      {uploadingId ? <LoadingDots color="bg-zinc-600" size="sm" /> : <ImagePlus className="size-6 text-zinc-400" />}
                    </div>
                    <div>
                      <span className="block text-xs font-black text-zinc-900">
                        {uploadingId ? "Uploading National ID Document..." : "Upload National ID Document"}
                      </span>
                      <span className="block text-[11px] font-semibold text-zinc-500">
                        PNG, JPG, JPEG, WEBP or PDF document (Max 15 MB)
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={saving || uploadingId}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {uploadingId ? <LoadingDots color="bg-white" size="sm" /> : <UploadCloud className="size-4" />}
                    {uploadingId ? "Uploading..." : "Choose National ID File"}
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                disabled={saving || uploadingId}
                onChange={(e) => handleNationalIdImage(e.target.files?.[0])}
                className="hidden"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || uploadingId}
              className="px-4 py-2 rounded-full bg-black/5 text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingId}
              className="inline-flex min-w-36 items-center justify-center gap-2 px-5 py-2 rounded-full bg-black text-white text-xs font-bold disabled:cursor-wait disabled:bg-zinc-700 disabled:opacity-60 transition-colors shadow-md cursor-pointer"
            >
              {saving ? <LoadingDots color="bg-white" size="sm" /> : uploadingId ? "Uploading ID..." : "Save Employee"}
            </button>
          </div>
        </form>
      </div>

      {/* Form In-Flight National ID Preview Modal */}
      {previewOpen && form.national_id_image && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-black/10">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 bg-zinc-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h4 className="truncate text-sm font-black text-black">National ID Preview</h4>
                  <p className="text-xs text-zinc-500 font-semibold">{form.full_name || "New Employee"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(resolveFileUrl(form.national_id_image), "_blank")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-zinc-100 text-black text-xs font-bold transition-colors cursor-pointer"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="size-3.5" /> Open Tab
                </button>
                <button onClick={() => setPreviewOpen(false)} className="p-1.5 rounded-xl hover:bg-black/5 text-zinc-500 hover:text-black transition-colors cursor-pointer">
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-zinc-100 p-6 flex items-center justify-center">
              <img
                src={resolveFileUrl(form.national_id_image)}
                alt="National ID document"
                className="mx-auto max-h-[70vh] w-auto max-w-full rounded-2xl bg-white object-contain shadow-md border border-black/10"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold text-black outline-none focus:border-emerald-700" /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold text-black outline-none focus:border-emerald-700">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function EmployeeDetails({
  employee,
  attendance,
  leaves,
  payroll,
  warehouses = [],
  onClose,
  onEdit,
}: {
  employee: Employee
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
  payroll: PayrollRecord[]
  warehouses?: Warehouse[]
  onClose: () => void
  onEdit?: (emp: Employee) => void
}) {
  const [showNationalId, setShowNationalId] = useState(false)
  const employeeAttendance = attendance.filter((record) => record.employee_id === employee.id)
  const employeeLeaves = leaves.filter((request) => request.employee_id === employee.id)
  const employeePayroll = payroll.filter((record) => record.employee_id === employee.id)
  const hasNationalId = Boolean(employee.national_id_image && employee.national_id_image.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto no-scrollbar bg-white rounded-3xl p-6 shadow-2xl border border-black/10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-xs font-black">
              {initials(employee.full_name)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-black leading-tight">{employee.full_name}</h3>
                <span className="text-[11px] font-bold font-mono text-zinc-500">({employee.employee_number})</span>
              </div>
              <p className="text-xs text-zinc-500">{employee.employment_type} • {employee.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNationalId(true)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs",
                hasNationalId
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200"
              )}
              title="View Employee National ID Document"
            >
              <Eye className="size-3.5" />
              View National ID
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><X className="size-5" /></button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4">
            <h4 className="text-xs font-black uppercase mb-3">Personal Information</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3 py-1 text-xs"><span className="font-bold text-zinc-500">Phone</span><span className="font-black text-zinc-900 text-right">{employee.phone || "-"}</span></div>
              <div className="flex justify-between gap-3 py-1 text-xs"><span className="font-bold text-zinc-500">Email</span><span className="font-black text-zinc-900 text-right">{employee.email || "-"}</span></div>
              <div className="flex justify-between gap-3 py-1 text-xs"><span className="font-bold text-zinc-500">Address</span><span className="font-black text-zinc-900 text-right">{employee.address || "-"}</span></div>
              <div className="flex justify-between gap-3 py-1 text-xs"><span className="font-bold text-zinc-500">Gender</span><span className="font-black text-zinc-900 text-right">{employee.gender || "-"}</span></div>
              <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-black/5 text-xs">
                <span className="font-bold text-zinc-500">National ID</span>
                {hasNationalId ? (
                  <button
                    type="button"
                    onClick={() => setShowNationalId(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-black transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    View National ID
                  </button>
                ) : (
                  <span className="text-zinc-400 italic text-[11px] font-semibold">Not uploaded</span>
                )}
              </div>
            </div>
          </div>

          <Detail title="Employment Information" rows={[["Warehouse / Office", resolveWarehouseFullName(employee.warehouse_id, warehouses)], ["Employment Type", employee.employment_type], ["Start Date", employee.start_date], ["Status", employee.status]]} />
          <Detail title="Salary Information" rows={[["Gross Salary", `ETB ${money(employee.basic_salary)}`], ["Bank Account", employee.bank_account], ["Emergency Contact", employee.emergency_contact_name], ["Emergency Phone", employee.emergency_contact_phone]]} />
        </div>

        <History title="Attendance History" empty="No attendance records exist for this employee." rows={employeeAttendance.map((record) => `${record.attendance_date} - ${record.status} (${record.hours_worked || 0} hrs)`)} />
        <History title="Leave History" empty="No leave records exist for this employee." rows={employeeLeaves.map((request) => `${request.leave_type}: ${request.start_date} to ${request.end_date} - ${request.status}`)} />
        <History title="Payroll History" empty="No payroll records exist for this employee." rows={employeePayroll.map((record) => `Net ETB ${money(record.net_pay)} - ${record.payment_status}`)} />
      </div>

      {/* Full-Screen National ID Document Viewer Modal */}
      {showNationalId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-black/10">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 bg-zinc-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-black text-black">National ID Identification Document</h4>
                  <p className="truncate text-xs font-bold text-zinc-500">{employee.full_name} ({employee.employee_number})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasNationalId && (
                  <button
                    type="button"
                    onClick={() => window.open(resolveFileUrl(employee.national_id_image), "_blank")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-zinc-100 text-black text-xs font-bold transition-colors cursor-pointer"
                    title="Open in new browser tab"
                  >
                    <ExternalLink className="size-3.5" /> Open Tab
                  </button>
                )}
                <button
                  onClick={() => setShowNationalId(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-zinc-500 hover:text-black transition-colors cursor-pointer"
                  aria-label="Close National ID preview"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-auto bg-zinc-100 p-6 flex items-center justify-center">
              {hasNationalId ? (
                <img
                  src={resolveFileUrl(employee.national_id_image)}
                  alt={`${employee.full_name} National ID document`}
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-2xl bg-white object-contain shadow-md border border-black/10"
                />
              ) : (
                <div className="text-center py-16 px-4">
                  <ImagePlus className="size-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-zinc-700">No National ID Document Uploaded</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    This employee does not have a National ID document on file. You can upload one by editing the employee details.
                  </p>
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNationalId(false)
                        onClose()
                        onEdit(employee)
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                    >
                      <Pencil className="size-3.5" /> Edit & Upload National ID
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4">
      <h4 className="text-xs font-black uppercase mb-3">{title}</h4>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 py-1.5 text-xs">
          <span className="font-bold text-zinc-500">{label}</span>
          <span className="font-black text-zinc-900 text-right">{value}</span>
        </div>
      ))}
    </div>
  )
}

function History({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return (
    <div className="mt-5">
      <h4 className="text-xs font-black uppercase mb-2">{title}</h4>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row} className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs font-bold text-zinc-700">
              {row}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs font-semibold text-zinc-400">{empty}</p>
      )}
    </div>
  )
}
