import { createResource, deleteResource, loadResource, updateResource, API_BASE } from "./apiPersistence"
import { sortNewestFirst } from "./utils"

export const WAREHOUSE_OPTIONS = ["Warehouse 1", "Warehouse 2", "Warehouse 3", "Head Office", "Not Assigned"] as const
export const EMPLOYMENT_TYPES = ["Permanent", "Temporary", "Contract", "Probation", "Intern", "Part-Time"] as const
export const EMPLOYEE_STATUSES = ["Active", "Inactive", "On Leave", "Suspended", "Resigned", "Terminated"] as const
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Half Day", "On Leave", "Holiday", "Weekend"] as const
export const LEAVE_TYPES = ["Annual Leave", "Sick Leave", "Emergency Leave", "Maternity Leave", "Paternity Leave", "Unpaid Leave", "Other"] as const
export const LEAVE_STATUSES = ["Draft", "Pending", "Approved", "Rejected", "Cancelled"] as const
export const PAYROLL_PERIOD_STATUSES = ["Draft", "Prepared", "Approved", "Paid"] as const
export const PAYMENT_STATUSES = ["Pending", "Approved", "Paid"] as const

export interface Employee {
  id: string
  employee_number: string
  full_name: string
  phone: string
  email: string
  address: string
  date_of_birth: string
  gender: string
  warehouse_id: string
  employment_type: string
  start_date: string
  basic_salary: number
  payment_method: string
  bank_account: string
  emergency_contact_name: string
  emergency_contact_phone: string
  national_id_image: string
  status: string
  created_at?: string
  updated_at?: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  attendance_date: string
  check_in_time: string
  check_out_time: string
  status: string
  hours_worked: number
  overtime_hours: number
  warehouse_id: string
  notes: string
  locked_by_payroll?: boolean
  created_at?: string
  updated_at?: string
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  number_of_days: number
  reason: string
  document_path: string
  status: string
  notes: string
  created_at?: string
  updated_at?: string
}

export interface PayrollPeriod {
  id: string
  name: string
  month: number
  year: number
  start_date: string
  end_date: string
  status: string
  created_at?: string
  updated_at?: string
}

export interface PayrollRecord {
  id: string
  payroll_period_id: string
  employee_id: string
  basic_salary: number
  taxable_allowances?: number
  non_taxable_allowances?: number
  allowances: number
  overtime_pay: number
  bonus: number
  other_earnings: number
  tax: number
  pension: number
  absence_deduction: number
  loan_deduction: number
  other_deductions: number
  gross_pay: number
  total_deductions: number
  net_pay: number
  payment_status: string
  notes: string
  created_at?: string
  updated_at?: string
}

export interface HRData {
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
  payrollPeriods: PayrollPeriod[]
  payrollRecords: PayrollRecord[]
}

export const emptyEmployee: Omit<Employee, "id"> = {
  employee_number: "",
  full_name: "",
  phone: "",
  email: "",
  address: "",
  date_of_birth: "",
  gender: "",
  warehouse_id: "Not Assigned",
  employment_type: "Permanent",
  start_date: "",
  basic_salary: 0,
  payment_method: "",
  bank_account: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  national_id_image: "",
  status: "Active",
}

function normalizeEmployee(row: Partial<Employee> & Record<string, unknown>): Employee {
  const id = String(row.id || row.employee_number || row.employeeId || makeId("EMP"))
  const fullName = String(row.full_name || row.name || row.fullname || "")
  const employeeNumber = String(row.employee_number || row.employeeId || row.id || id)
  return {
    id,
    employee_number: employeeNumber,
    full_name: fullName || "Employee",
    phone: String(row.phone || ""),
    email: String(row.email || ""),
    address: String(row.address || ""),
    date_of_birth: String(row.date_of_birth || row.dateOfBirth || ""),
    gender: String(row.gender || ""),
    warehouse_id: String(row.warehouse_id || row.warehouse || row.department || "Not Assigned"),
    employment_type: String(row.employment_type || row.employmentType || row.role || "Permanent"),
    start_date: String(row.start_date || row.startDate || row.joinDate || ""),
    basic_salary: Number(row.basic_salary ?? row.salary ?? 0),
    payment_method: String(row.payment_method || row.paymentMethod || ""),
    bank_account: String(row.bank_account || row.bankAccount || ""),
    emergency_contact_name: String(row.emergency_contact_name || row.emergencyContactName || ""),
    emergency_contact_phone: String(row.emergency_contact_phone || row.emergencyContactPhone || ""),
    national_id_image: String(row.national_id_image || ""),
    status: String(row.status || "Active"),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function normalizeAttendance(row: Partial<AttendanceRecord> & Record<string, unknown>): AttendanceRecord {
  const checkIn = String(row.check_in_time || row.checkIn || "")
  const checkOut = String(row.check_out_time || row.checkOut || "")
  const hoursWorked = row.hours_worked !== undefined && row.hours_worked !== null 
    ? Number(row.hours_worked) 
    : calculateHours(checkIn, checkOut)
  return {
    id: String(row.id || makeId("ATT")),
    employee_id: String(row.employee_id || row.employeeId || ""),
    attendance_date: String(row.attendance_date || row.date || ""),
    check_in_time: checkIn,
    check_out_time: checkOut,
    status: String(row.status || "Present"),
    hours_worked: hoursWorked,
    overtime_hours: Number(row.overtime_hours ?? row.overtimeHours ?? 0),
    warehouse_id: String(row.warehouse_id || row.warehouse || "Head Office"),
    notes: String(row.notes || ""),
    locked_by_payroll: Boolean(row.locked_by_payroll),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function normalizeLeave(row: Partial<LeaveRequest> & Record<string, unknown>): LeaveRequest {
  const startDate = String(row.start_date || row.startDate || "")
  const endDate = String(row.end_date || row.endDate || "")
  const numDays = row.number_of_days !== undefined && row.number_of_days !== null
    ? Number(row.number_of_days)
    : (row.totalDays !== undefined && row.totalDays !== null ? Number(row.totalDays) : leaveDays(startDate, endDate))
  return {
    id: String(row.id || makeId("LR")),
    employee_id: String(row.employee_id || row.employeeId || ""),
    leave_type: String(row.leave_type || row.type || "Annual Leave"),
    start_date: startDate,
    end_date: endDate,
    number_of_days: numDays || 1,
    reason: String(row.reason || ""),
    document_path: String(row.document_path || ""),
    status: String(row.status || "Pending"),
    notes: String(row.notes || ""),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function normalizePayrollPeriod(row: Partial<PayrollPeriod> & Record<string, unknown>): PayrollPeriod {
  return {
    id: String(row.id || makeId("PER")),
    name: String(row.name || "Payroll Period"),
    month: Number(row.month || 1),
    year: Number(row.year || new Date().getFullYear()),
    start_date: String(row.start_date || row.startDate || ""),
    end_date: String(row.end_date || row.endDate || ""),
    status: String(row.status || "Draft"),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function normalizePayrollRecord(row: Partial<PayrollRecord> & Record<string, unknown>): PayrollRecord {
  const basicSalary = Number(row.basic_salary ?? row.salary ?? 0)
  const taxableAllowances = row.taxable_allowances !== undefined && row.taxable_allowances !== null
    ? Number(row.taxable_allowances)
    : Number(row.allowances ?? 0)
  const nonTaxableAllowances = Number(row.non_taxable_allowances ?? 0)
  const totalAllowances = Number(row.allowances ?? (taxableAllowances + nonTaxableAllowances))

  const overtimePay = Number(row.overtime_pay ?? 0)
  const bonus = Number(row.bonus ?? 0)
  const otherEarnings = Number(row.other_earnings ?? 0)
  const tax = Number(row.tax ?? 0)
  const pension = Number(row.pension ?? 0)
  const absenceDeduction = Number(row.absence_deduction ?? 0)
  const loanDeduction = Number(row.loan_deduction ?? 0)
  const otherDeductions = Number(row.other_deductions ?? 0)
  const grossPay = row.gross_pay !== undefined && row.gross_pay !== null
    ? Number(row.gross_pay)
    : (basicSalary + totalAllowances + overtimePay + bonus + otherEarnings)
  const totalDeductions = row.total_deductions !== undefined && row.total_deductions !== null
    ? Number(row.total_deductions)
    : (tax + pension + absenceDeduction + loanDeduction + otherDeductions)
  const netPay = row.net_pay !== undefined && row.net_pay !== null
    ? Number(row.net_pay)
    : (grossPay - totalDeductions)

  return {
    id: String(row.id || makeId("PAY")),
    payroll_period_id: String(row.payroll_period_id || row.payrollPeriodId || ""),
    employee_id: String(row.employee_id || row.employeeId || ""),
    basic_salary: basicSalary,
    taxable_allowances: taxableAllowances,
    non_taxable_allowances: nonTaxableAllowances,
    allowances: totalAllowances,
    overtime_pay: overtimePay,
    bonus,
    other_earnings: otherEarnings,
    tax,
    pension,
    absence_deduction: absenceDeduction,
    loan_deduction: loanDeduction,
    other_deductions: otherDeductions,
    gross_pay: grossPay,
    total_deductions: totalDeductions,
    net_pay: netPay,
    payment_status: String(row.payment_status || row.status || "Pending"),
    notes: String(row.notes || ""),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "HR"
}

export function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function calculateHours(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0
  const [inHour, inMinute] = checkIn.split(":").map(Number)
  const [outHour, outMinute] = checkOut.split(":").map(Number)
  const minutes = outHour * 60 + outMinute - (inHour * 60 + inMinute)
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0
}

export function leaveDays(start: string, end: string) {
  if (!start || !end) return 0
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 0
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
}

export function calculatePayroll(record: Omit<PayrollRecord, "gross_pay" | "total_deductions" | "net_pay">): PayrollRecord {
  const taxableAllowances = Number(record.taxable_allowances ?? record.allowances ?? 0)
  const nonTaxableAllowances = Number(record.non_taxable_allowances ?? 0)
  const totalAllowances = Number(record.allowances ?? (taxableAllowances + nonTaxableAllowances))
  const gross_pay = Number(record.basic_salary || 0) + totalAllowances + Number(record.overtime_pay || 0) + Number(record.bonus || 0) + Number(record.other_earnings || 0)
  const total_deductions = Number(record.tax || 0) + Number(record.pension || 0) + Number(record.absence_deduction || 0) + Number(record.loan_deduction || 0) + Number(record.other_deductions || 0)
  return { ...record, allowances: totalAllowances, taxable_allowances: taxableAllowances, non_taxable_allowances: nonTaxableAllowances, gross_pay, total_deductions, net_pay: gross_pay - total_deductions }
}

function improveHRResourceError(error: unknown, resource: string, label: string) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes(resource) || message.includes("Could not find the table") || message.includes("schema cache")) {
    return new Error(`${label} cannot be saved because public.${resource} is missing or not exposed in Database. Run server/hr_module.schema.sql in the Database SQL editor, then restart the local API server.`)
  }
  return error instanceof Error ? error : new Error(message)
}

async function createHRResource<T extends { id?: string }>(resource: string, label: string, item: T) {
  try {
    return await createResource<T>(resource, item)
  } catch (error) {
    throw improveHRResourceError(error, resource, label)
  }
}

async function updateHRResource<T extends { id?: string }>(resource: string, label: string, id: string, item: Partial<T>) {
  try {
    return await updateResource<T>(resource, id, item)
  } catch (error) {
    throw improveHRResourceError(error, resource, label)
  }
}

function normalizeDuplicateValue(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

export function employeeDuplicateKey(employee: Pick<Employee, "full_name" | "phone" | "email" | "date_of_birth" | "gender" | "warehouse_id" | "employment_type" | "start_date" | "basic_salary" | "bank_account" | "emergency_contact_name" | "emergency_contact_phone">) {
  return [
    employee.full_name,
    employee.phone,
    employee.email,
    employee.date_of_birth,
    employee.gender,
    employee.warehouse_id,
    employee.employment_type,
    employee.start_date,
    Number(employee.basic_salary || 0).toFixed(2),
    employee.bank_account,
    employee.emergency_contact_name,
    employee.emergency_contact_phone,
  ].map(normalizeDuplicateValue).join("|")
}

async function loadOptionalResource<T>(resource: string): Promise<T[]> {
  try {
    return await loadResource<T>(resource)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("Unknown resource") || message.includes("does not exist") || message.includes("Could not find the table")) {
      console.warn(`HR resource '${resource}' is not available yet. Returning an empty list until the API/schema is updated.`)
      return []
    }
    throw error
  }
}

export async function loadHRData(): Promise<HRData> {
  const [employees, attendance, leaves, payrollPeriods, payrollRecords] = await Promise.all([
    loadResource<Partial<Employee> & Record<string, unknown>>("employees"),
    loadOptionalResource<Partial<AttendanceRecord> & Record<string, unknown>>("attendance_records"),
    loadOptionalResource<Partial<LeaveRequest> & Record<string, unknown>>("leave_requests"),
    loadOptionalResource<Partial<PayrollPeriod> & Record<string, unknown>>("payroll_periods"),
    loadOptionalResource<Partial<PayrollRecord> & Record<string, unknown>>("payroll_records"),
  ])

  return {
    employees: sortNewestFirst(employees.map(normalizeEmployee).filter((e) => e.full_name && e.id)),
    attendance: sortNewestFirst(attendance.map(normalizeAttendance).filter((a) => a.id)),
    leaves: sortNewestFirst(leaves.map(normalizeLeave).filter((l) => l.id)),
    payrollPeriods: sortNewestFirst(payrollPeriods.map(normalizePayrollPeriod).filter((p) => p.name)),
    payrollRecords: sortNewestFirst(payrollRecords.map(normalizePayrollRecord).filter((r) => r.id)),
  }
}

export const hrApi = {
  createEmployee: (employee: Employee) => createResource<Employee>("employees", employee),
  updateEmployee: (id: string, employee: Partial<Employee>) => updateResource<Employee>("employees", id, employee),
  createAttendance: (record: AttendanceRecord) => createHRResource<AttendanceRecord>("attendance_records", "Attendance records", record),
  updateAttendance: (id: string, record: Partial<AttendanceRecord>) => updateHRResource<AttendanceRecord>("attendance_records", "Attendance records", id, record),
  deleteAttendance: (id: string) => deleteResource("attendance_records", id),
  createLeave: (request: LeaveRequest) => createResource<LeaveRequest>("leave_requests", request),
  updateLeave: (id: string, request: Partial<LeaveRequest>) => updateResource<LeaveRequest>("leave_requests", id, request),
  createPayrollPeriod: (period: PayrollPeriod) => createResource<PayrollPeriod>("payroll_periods", period),
  updatePayrollPeriod: (id: string, period: Partial<PayrollPeriod>) => updateResource<PayrollPeriod>("payroll_periods", id, period),
  deletePayrollPeriod: (id: string) => deleteResource("payroll_periods", id),
  createPayrollRecord: (record: PayrollRecord) => createResource<PayrollRecord>("payroll_records", record),
  updatePayrollRecord: (id: string, record: Partial<PayrollRecord>) => updateResource<PayrollRecord>("payroll_records", id, record),
  deletePayrollRecord: (id: string) => deleteResource("payroll_records", id),
  payPayrollRecord: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/payroll-records/${encodeURIComponent(id)}/pay`, { method: "POST" })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error || "Could not post payroll payment.")
    return body
  },
}
