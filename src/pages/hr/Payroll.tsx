import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { BadgeCheck, Ban, CheckCircle2, Eye, Pencil, Printer, X } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { HRPageSkeleton } from "@/components/HRSkeleton"
import { SubPageNav } from "@/components/SubPageNav"
import { HRTableToolbar, ResizableTableHeader, type TableColumn, useColumnWidths, useTableSort } from "@/components/HRTable"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { useFeedback } from "@/context/FeedbackContext"
import { financeStore } from "@/lib/financeStore"
import { getSectionChildren, navSections } from "@/lib/nav-config"
import { PAYMENT_STATUSES, PAYROLL_PERIOD_STATUSES, calculatePayroll, hrApi, loadHRData, makeId, money, type Employee, type PayrollPeriod, type PayrollRecord } from "@/lib/hrApi"
import { calculateEthiopianPayroll, DEFAULT_ETHIOPIAN_PENSION_CONFIG, DEFAULT_ETHIOPIAN_TAX_BRACKETS } from "@/core/hr/payrollEngine"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }
const now = new Date()
const blankPeriod = (): Omit<PayrollPeriod, "id"> => ({
  name: "",
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  start_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
  end_date: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  status: "Draft",
})

function blankRecord(employee: Employee, periodId: string): PayrollRecord {
  const s = financeStore.getCompanySettings()
  const pensionConfig = {
    employeeRatePercent: s.pension_employee_rate ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.employeeRatePercent,
    employerRatePercent: s.pension_employer_rate ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.employerRatePercent,
    expatExempt: s.pension_expat_exempt ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.expatExempt,
  }
  const taxBrackets = s.tax_brackets_config && s.tax_brackets_config.length > 0
    ? s.tax_brackets_config
    : DEFAULT_ETHIOPIAN_TAX_BRACKETS

  const ethiopian = calculateEthiopianPayroll({
    employeeId: employee.id,
    employeeName: employee.full_name,
    basicSalary: Number(employee.basic_salary || 0),
    allowances: 0,
    pensionConfig,
    taxBrackets,
  })

  return calculatePayroll({
    id: makeId("PAY"),
    payroll_period_id: periodId,
    employee_id: employee.id,
    basic_salary: Number(employee.basic_salary || 0),
    allowances: 0,
    overtime_pay: 0,
    bonus: 0,
    other_earnings: 0,
    tax: ethiopian.incomeTaxDeducted,
    pension: ethiopian.employeePension,
    absence_deduction: 0,
    loan_deduction: 0,
    other_deductions: 0,
    payment_status: "Pending",
    notes: "",
  })
}

export default function Payroll() {
  const { showToast } = useFeedback()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedPeriod, setSelectedPeriod] = useState("")
  const [search, setSearch] = useState("")
  const [payrollStatus, setPayrollStatus] = useState("All")
  const [paymentStatus, setPaymentStatus] = useState("All")
  const [warehouse, setWarehouse] = useState("All")
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodForm, setPeriodForm] = useState<Omit<PayrollPeriod, "id">>(blankPeriod())
  const [editing, setEditing] = useState<PayrollRecord | null>(null)
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await loadHRData()
      setEmployees(data.employees)
      setPeriods(data.payrollPeriods)
      setRecords(data.payrollRecords)
      setSelectedPeriod((current) => current || data.payrollPeriods[0]?.id || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payroll.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
  const periodById = useMemo(() => new Map(periods.map((period) => [period.id, period])), [periods])
  const currentPeriod = periods.find((period) => period.id === selectedPeriod)
  const currentRecords = useMemo(() => records.filter((record) => !selectedPeriod || record.payroll_period_id === selectedPeriod), [records, selectedPeriod])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return currentRecords.filter((record) => {
      const employee = employeeById.get(record.employee_id)
      const period = periodById.get(record.payroll_period_id)
      const matchesSearch = !query || [employee?.full_name, employee?.employee_number, period?.name, employee?.warehouse_id, employee?.status].some((value) => String(value || "").toLowerCase().includes(query))
      const matchesPayrollStatus = payrollStatus === "All" || period?.status === payrollStatus
      const matchesPaymentStatus = paymentStatus === "All" || record.payment_status === paymentStatus
      const matchesWarehouse = warehouse === "All" || employee?.warehouse_id === warehouse
      return matchesSearch && matchesPayrollStatus && matchesPaymentStatus && matchesWarehouse
    })
  }, [currentRecords, employeeById, periodById, payrollStatus, paymentStatus, search, warehouse])

  const totals = {
    employees: currentRecords.length,
    gross: currentRecords.reduce((sum, record) => sum + Number(record.gross_pay || 0), 0),
    deductions: currentRecords.reduce((sum, record) => sum + Number(record.total_deductions || 0), 0),
    net: currentRecords.reduce((sum, record) => sum + Number(record.net_pay || 0), 0),
    approved: currentRecords.filter((record) => record.payment_status === "Approved").length,
    paid: currentRecords.filter((record) => record.payment_status === "Paid").length,
    pending: currentRecords.filter((record) => record.payment_status === "Pending").length,
  }

  const { sortKey, sortDir, handleSort, handleClearSort, sortItems } = useTableSort()
  const sorted = sortItems(filtered)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [search, selectedPeriod, payrollStatus, paymentStatus, warehouse, filtered.length])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const displayedRecords = sorted.slice((page - 1) * pageSize, page * pageSize)

  const columns: TableColumn[] = [
    { key: "employee", label: "Employee", initialWidth: 220 },
    { key: "warehouse", label: "Warehouse", initialWidth: 150 },
    { key: "employment_status", label: "Employment Status", align: "center", initialWidth: 160 },
    { key: "basic_salary", label: "Gross Salary", align: "right", initialWidth: 140 },
    { key: "gross_pay", label: "Gross Pay", align: "right", initialWidth: 140 },
    { key: "total_deductions", label: "Total Deductions", align: "right", initialWidth: 160 },
    { key: "net_pay", label: "Net Pay", align: "right", initialWidth: 140 },
    { key: "payment_status", label: "Payment Status", align: "center", initialWidth: 130 },
    { key: "payroll_period_id", label: "Period", initialWidth: 140 },
    { key: "actions", label: "Actions", align: "right", sortable: false, initialWidth: 260 },
  ]
  const { colWidths, handleResizeStart } = useColumnWidths(Object.fromEntries(columns.map((col) => [col.key, col.initialWidth || 130])))

  const createPeriod = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!periodForm.name.trim()) return showToast("Period Not Saved", "warning", "Period name is required.")
    if (periods.some((period) => period.month === periodForm.month && period.year === periodForm.year && period.status !== "Cancelled")) {
      return showToast("Period Not Saved", "warning", "Only one active payroll period can exist for the same month and year.")
    }
    try {
      const period = await hrApi.createPayrollPeriod({ id: makeId("PER"), ...periodForm })
      setShowPeriodForm(false)
      setSelectedPeriod(period.id)
      showToast("Payroll Period Created", "success", `${period.name} was created successfully.`)
      await refresh()
    } catch (err) {
      showToast("Period Save Failed", "warning", err instanceof Error ? err.message : "Could not create the payroll period.")
    }
  }

  const loadActiveEmployees = async () => {
    if (!currentPeriod) return showToast("Payroll Period Required", "warning", "Create or select a payroll period first.")
    const activeEmployees = employees.filter((employee) => employee.status === "Active")
    const missing = activeEmployees.filter((employee) => !records.some((record) => record.payroll_period_id === currentPeriod.id && record.employee_id === employee.id))

    // Also check for pending records whose basic salary changed in the employee profile
    const pendingToUpdate = records.filter((record) => {
      if (record.payroll_period_id !== currentPeriod.id || record.payment_status !== "Pending") return false
      const emp = employeeById.get(record.employee_id)
      if (!emp) return false
      return Number(record.basic_salary || 0) !== Number(emp.basic_salary || 0)
    })

    try {
      const createPromises = missing.map((employee) => hrApi.createPayrollRecord(blankRecord(employee, currentPeriod.id)))
      
      const s = financeStore.getCompanySettings()
      const pensionConfig = {
        employeeRatePercent: s.pension_employee_rate ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.employeeRatePercent,
        employerRatePercent: s.pension_employer_rate ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.employerRatePercent,
        expatExempt: s.pension_expat_exempt ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.expatExempt,
      }
      const taxBrackets = s.tax_brackets_config && s.tax_brackets_config.length > 0
        ? s.tax_brackets_config
        : DEFAULT_ETHIOPIAN_TAX_BRACKETS

      const updatePromises = pendingToUpdate.map((record) => {
        const emp = employeeById.get(record.employee_id)!
        const newSalary = Number(emp.basic_salary || 0)
        const calculated = calculateEthiopianPayroll({
          basicSalary: newSalary,
          allowances: Number(record.allowances || 0),
          overtimePay: Number(record.overtime_pay || 0),
          bonus: Number(record.bonus || 0),
          otherEarnings: Number(record.other_earnings || 0),
          absenceDeduction: Number(record.absence_deduction || 0),
          loanDeduction: Number(record.loan_deduction || 0),
          otherDeductions: Number(record.other_deductions || 0),
          pensionConfig,
          taxBrackets,
        })

        return hrApi.updatePayrollRecord(record.id, {
          ...record,
          basic_salary: newSalary,
          pension: calculated.employeePension,
          tax: calculated.incomeTaxDeducted,
          gross_pay: calculated.grossSalary,
          total_deductions: calculated.totalEmployeeDeductions,
          net_pay: calculated.netTakeHomePay,
        })
      })

      await Promise.all([...createPromises, ...updatePromises])

      const msgs = []
      if (missing.length > 0) msgs.push(`${missing.length} active employees loaded`)
      if (pendingToUpdate.length > 0) msgs.push(`${pendingToUpdate.length} salaries updated from employee profiles`)
      if (msgs.length === 0) msgs.push("All payroll records and salaries are currently up to date")

      showToast("Payroll Updated", "success", msgs.join("; ") + ".")
      await refresh()
    } catch (err) {
      showToast("Payroll Update Failed", "warning", err instanceof Error ? err.message : "Could not update payroll records.")
    }
  }

  const updatePeriodStatus = async (nextStatus: string) => {
    if (!currentPeriod) return
    try {
      await hrApi.updatePayrollPeriod(currentPeriod.id, { status: nextStatus })
      showToast("Payroll Status Updated", "success", `Payroll period marked ${nextStatus}.`)
      await refresh()
    } catch (err) {
      showToast("Status Update Failed", "warning", err instanceof Error ? err.message : "Could not update payroll status.")
    }
  }

  const updateRecord = async (record: PayrollRecord, changes: Partial<PayrollRecord>) => {
    const period = periodById.get(record.payroll_period_id)
    const editable = record.payment_status === "Pending" && period?.status !== "Cancelled"
    if ("payment_status" in changes) {
      if (changes.payment_status === "Paid" && record.payment_status !== "Approved") return showToast("Approval Required", "warning", "Approve the payroll record before marking it paid.")
      if (changes.payment_status === "Approved" && record.payment_status !== "Pending") return showToast("Payroll Locked", "warning", "Only pending payroll records can be approved.")
      if (changes.payment_status === "Cancelled" && record.payment_status === "Paid") return showToast("Payroll Locked", "warning", "Paid payroll records cannot be cancelled.")
    } else if (!editable) {
      return showToast("Payroll Locked", "warning", "Only pending payroll records can be edited.")
    }
    const calculated = calculatePayroll({ ...record, ...changes })
    try {
      await hrApi.updatePayrollRecord(record.id, calculated)
      showToast("Payroll Record Updated", "success", "Payroll record was recalculated and saved.")
      setEditing(null)
      await refresh()
    } catch (err) {
      showToast("Payroll Update Failed", "warning", err instanceof Error ? err.message : "Could not update payroll record.")
    }
  }

  const transitionPaymentStatus = async (record: PayrollRecord, nextStatus: PayrollRecord["payment_status"]) => {
    const period = periodById.get(record.payroll_period_id)
    if (period?.status === "Cancelled" || record.payment_status === "Cancelled") {
      return showToast("Payroll Cancelled", "warning", "Cancelled payroll records cannot be updated or printed.")
    }
    if (nextStatus === "Approved" && record.payment_status !== "Pending") {
      return showToast("Payroll Not Editable", "warning", "Only pending payroll records can be approved.")
    }
    if (nextStatus === "Paid" && record.payment_status !== "Approved") {
      return showToast("Approval Required", "warning", "Approve the payroll record before marking it paid.")
    }
    if (nextStatus === "Cancelled" && record.payment_status === "Paid") {
      return showToast("Payroll Locked", "warning", "Paid payroll records cannot be cancelled.")
    }
    if (nextStatus === record.payment_status) return
    if (nextStatus === "Paid") {
      try {
        await hrApi.payPayrollRecord(record.id)
        showToast("Payroll Paid", "success", "Salary payment and its balanced Finance journal entry were posted.")
        await financeStore.reloadFromApi()
        await refresh()
      } catch (err) {
        showToast("Payroll Payment Failed", "warning", err instanceof Error ? err.message : "Could not post payroll payment.")
      }
      return
    }
    await updateRecord(record, { payment_status: nextStatus })
  }

  const printPayslip = (record: PayrollRecord) => {
    const period = periodById.get(record.payroll_period_id)
    if (record.payment_status === "Cancelled" || period?.status === "Cancelled") {
      return showToast("Payslip Unavailable", "warning", "Cancelled payroll records do not generate payslips.")
    }
    setPayslip(record)
    window.setTimeout(() => window.print(), 100)
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12 print:hidden">
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div><h1 className="text-3xl font-black text-black tracking-tight mt-1">Payroll</h1><p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">Manual earnings, deductions, totals, workflow, and payslips.</p></div>
          <SubPageNav items={getSectionChildren("/hr")} />
        </motion.div>
        {error && <GlassCard className="p-5 mb-5 text-sm font-bold text-rose-700 border-rose-200 bg-rose-50">{error}</GlassCard>}
        {loading ? (
          <HRPageSkeleton rows={7} cards={7} />
        ) : (
          <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-2 mb-3">
              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight">Payroll Financial Totals</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Gross Pay</span>
                <span className="text-base font-black text-zinc-950 mt-1 block">ETB {money(totals.gross)}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Deductions</span>
                <span className="text-base font-black text-rose-700 mt-1 block">ETB {money(totals.deductions)}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Net Pay</span>
                <span className="text-base font-black text-emerald-700 mt-1 block">ETB {money(totals.net)}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-2 mb-3">
              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight">Payroll Record Breakdown</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2 text-center">
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-wider">Employees</span>
                <span className="text-base font-black text-zinc-950 mt-0.5 block">{totals.employees}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-wider">Pending</span>
                <span className="text-base font-black text-amber-600 mt-0.5 block">{totals.pending}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-wider">Approved</span>
                <span className="text-base font-black text-blue-600 mt-0.5 block">{totals.approved}</span>
              </div>
              <div className="bg-black/[0.02] p-2.5 rounded-xl">
                <span className="block text-[8px] font-black text-zinc-400 uppercase tracking-wider">Paid</span>
                <span className="text-base font-black text-emerald-600 mt-0.5 block">{totals.paid}</span>
              </div>
            </div>
          </GlassCard>
        </div>
        <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
          <HRTableToolbar
            title="Payroll Records"
            subtitle={currentPeriod ? `${currentPeriod.name} - ${currentPeriod.status}` : "No payroll period has been created yet."}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search employee or period..."
            filters={[
              { value: selectedPeriod, onChange: setSelectedPeriod, options: periods.length ? periods.map((period) => ({ value: period.id, label: period.name })) : [{ value: "", label: "No Periods" }] },
              { value: payrollStatus, onChange: setPayrollStatus, options: ["All", ...PAYROLL_PERIOD_STATUSES].map((item) => ({ value: item, label: item })) },
              { value: paymentStatus, onChange: setPaymentStatus, options: ["All", ...PAYMENT_STATUSES].map((item) => ({ value: item, label: item })) },
              { value: warehouse, onChange: setWarehouse, options: ["All", ...Array.from(new Set(employees.map((employee) => employee.warehouse_id).filter(Boolean)))].map((item) => ({ value: item, label: item })) },
            ]}
            actions={[{ label: "Create Period", onClick: () => setShowPeriodForm(true), variant: "secondary" }, { label: "Load Active Employees", onClick: loadActiveEmployees }]}
            secondary={currentPeriod && <div className="flex flex-wrap gap-2">{PAYROLL_PERIOD_STATUSES.filter((item) => item !== currentPeriod.status).map((item) => <button key={item} onClick={() => updatePeriodStatus(item)} className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[10px] font-black uppercase text-zinc-700">{item}</button>)}</div>}
          />
          <TableScrollWrapper>
            <table className="w-full text-left border-collapse table-fixed">
              <ResizableTableHeader columns={columns} colWidths={colWidths} onResizeStart={handleResizeStart} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onClearSort={handleClearSort} />
              <tbody className="divide-y divide-black/5 text-xs">
                {!loading && sorted.length === 0 ? <tr><td colSpan={10} className="py-12 text-center text-zinc-400 font-medium">No payroll records have been created yet.</td></tr> : displayedRecords.map((record) => {
                  const employee = employeeById.get(record.employee_id)
                  const period = periodById.get(record.payroll_period_id)
                  const canApprove = record.payment_status === "Pending" && period?.status !== "Cancelled"
                  const canMarkPaid = record.payment_status === "Approved" && period?.status !== "Cancelled"
                  const canEdit = record.payment_status === "Pending" && period?.status !== "Cancelled"
                  const canPrint = record.payment_status !== "Cancelled" && period?.status !== "Cancelled"
                  return <tr key={record.id} className="hover:bg-black/[0.02] transition-colors">
                    <Cell width={colWidths.employee}>{employee ? `${employee.full_name} (${employee.employee_number})` : "Unknown employee"}</Cell>
                    <Cell width={colWidths.warehouse}>{employee?.warehouse_id || "-"}</Cell>
                    <Cell width={colWidths.employment_status} align="center">{employee?.status || "-"}</Cell>
                    <Cell width={colWidths.basic_salary} align="right">ETB {money(record.basic_salary)}</Cell>
                    <Cell width={colWidths.gross_pay} align="right">ETB {money(record.gross_pay)}</Cell>
                    <Cell width={colWidths.total_deductions} align="right">ETB {money(record.total_deductions)}</Cell>
                    <Cell width={colWidths.net_pay} align="right">ETB {money(record.net_pay)}</Cell>
                    <Cell width={colWidths.payment_status} align="center">{record.payment_status}</Cell>
                    <Cell width={colWidths.payroll_period_id}>{period?.name || record.payroll_period_id}</Cell>
                    <Cell width={colWidths.actions} align="right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setPayslip(record)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                          title="View Payslip"
                        >
                          <Eye className="size-3 text-zinc-700" /> View
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditing(record)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="Edit Draft"
                          >
                            <Pencil className="size-3 text-zinc-700" /> Edit
                          </button>
                        )}
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() => transitionPaymentStatus(record, "Approved")}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="Approve Payroll"
                          >
                            <BadgeCheck className="size-3 text-emerald-700" /> Approve
                          </button>
                        )}
                        {canMarkPaid && (
                          <button
                            type="button"
                            onClick={() => transitionPaymentStatus(record, "Paid")}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-extrabold text-[11px] transition-all active:scale-95 shadow-2xs cursor-pointer"
                            title="Mark as Paid"
                          >
                            <CheckCircle2 className="size-3 text-emerald-400" /> Paid
                          </button>
                        )}
                        {record.payment_status !== "Paid" && period?.status !== "Cancelled" && (
                          <button
                            type="button"
                            onClick={() => transitionPaymentStatus(record, "Cancelled")}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] transition-all border border-rose-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="Cancel Payroll"
                          >
                            <Ban className="size-3 text-rose-600" /> Cancel
                          </button>
                        )}
                        {canPrint && (
                          <button
                            type="button"
                            onClick={() => printPayslip(record)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="Print Payslip"
                          >
                            <Printer className="size-3 text-zinc-700" /> Print
                          </button>
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
          </>
        )}
      </motion.div>
      {showPeriodForm && <PeriodForm form={periodForm} setForm={setPeriodForm} onClose={() => setShowPeriodForm(false)} onSubmit={createPeriod} />}
      {editing && <PayrollRecordForm record={editing} employee={employeeById.get(editing.employee_id)} onClose={() => setEditing(null)} onSubmit={(changes) => updateRecord(editing, changes)} />}
      {payslip && <Payslip record={payslip} employee={employeeById.get(payslip.employee_id)} period={periods.find((period) => period.id === payslip.payroll_period_id)} onClose={() => setPayslip(null)} />}
    </div>
  )
}

function Cell({ width, align = "left", children }: { width: number; align?: "left" | "right" | "center"; children: React.ReactNode }) {
  return <td style={{ width }} className={`py-3.5 px-3.5 truncate font-medium text-zinc-700 ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}>{children}</td>
}

function PeriodForm({ form, setForm, onClose, onSubmit }: { form: Omit<PayrollPeriod, "id">; setForm: (form: Omit<PayrollPeriod, "id">) => void; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const set = (key: keyof Omit<PayrollPeriod, "id">, value: string | number) => setForm({ ...form, [key]: value })
  return <Modal title="Create Payroll Period" onClose={onClose}><form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Period Name" value={form.name} onChange={(value) => set("name", value)} required /><Input label="Month" type="number" value={form.month} onChange={(value) => set("month", Number(value))} required /><Input label="Year" type="number" value={form.year} onChange={(value) => set("year", Number(value))} required /><Input label="Start Date" type="date" value={form.start_date} onChange={(value) => set("start_date", value)} required /><Input label="End Date" type="date" value={form.end_date} onChange={(value) => set("end_date", value)} required /><Select label="Status" value={form.status} options={PAYROLL_PERIOD_STATUSES} onChange={(value) => set("status", value)} /><Actions onClose={onClose} label="Save Period" /></form></Modal>
}

function PayrollRecordForm({ record, employee, onClose, onSubmit }: { record: PayrollRecord; employee?: Employee; onClose: () => void; onSubmit: (changes: Partial<PayrollRecord>) => void }) {
  const s = financeStore.getCompanySettings()
  const pensionConfig = useMemo(() => ({
    employeeRatePercent: s.pension_employee_rate ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.employeeRatePercent,
    employerRatePercent: s.pension_employer_rate ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.employerRatePercent,
    expatExempt: s.pension_expat_exempt ?? DEFAULT_ETHIOPIAN_PENSION_CONFIG.expatExempt,
  }), [s])

  const taxBrackets = useMemo(() => (
    s.tax_brackets_config && s.tax_brackets_config.length > 0
      ? s.tax_brackets_config
      : DEFAULT_ETHIOPIAN_TAX_BRACKETS
  ), [s])

  // Initialize form with live Ethiopian calculations applied immediately
  const [form, setForm] = useState(() => {
    const initialCalculated = calculateEthiopianPayroll({
      basicSalary: Number(record.basic_salary || 0),
      allowances: Number(record.allowances || 0),
      overtimePay: Number(record.overtime_pay || 0),
      bonus: Number(record.bonus || 0),
      otherEarnings: Number(record.other_earnings || 0),
      absenceDeduction: Number(record.absence_deduction || 0),
      loanDeduction: Number(record.loan_deduction || 0),
      otherDeductions: Number(record.other_deductions || 0),
      pensionConfig,
      taxBrackets,
    })

    return {
      ...record,
      pension: initialCalculated.employeePension,
      tax: initialCalculated.incomeTaxDeducted,
      gross_pay: initialCalculated.grossSalary,
      total_deductions: initialCalculated.totalEmployeeDeductions,
      net_pay: initialCalculated.netTakeHomePay,
    }
  })

  // Compute live Ethiopian breakdown
  const ethiopian = useMemo(() => calculateEthiopianPayroll({
    basicSalary: Number(form.basic_salary || 0),
    allowances: Number(form.allowances || 0),
    overtimePay: Number(form.overtime_pay || 0),
    bonus: Number(form.bonus || 0),
    otherEarnings: Number(form.other_earnings || 0),
    absenceDeduction: Number(form.absence_deduction || 0),
    loanDeduction: Number(form.loan_deduction || 0),
    otherDeductions: Number(form.other_deductions || 0),
    pensionConfig,
    taxBrackets,
  }), [form.basic_salary, form.allowances, form.overtime_pay, form.bonus, form.other_earnings, form.absence_deduction, form.loan_deduction, form.other_deductions, pensionConfig, taxBrackets])

  const setField = (key: keyof PayrollRecord, value: string | number) => {
    const nextValue = typeof value === "number" ? value : Number(value) || 0
    const bSalary = key === "basic_salary" ? nextValue : Number(form.basic_salary || 0)
    const allow = key === "allowances" ? nextValue : Number(form.allowances || 0)
    const ot = key === "overtime_pay" ? nextValue : Number(form.overtime_pay || 0)
    const bon = key === "bonus" ? nextValue : Number(form.bonus || 0)
    const otherEarn = key === "other_earnings" ? nextValue : Number(form.other_earnings || 0)
    const absDed = key === "absence_deduction" ? nextValue : Number(form.absence_deduction || 0)
    const loanDed = key === "loan_deduction" ? nextValue : Number(form.loan_deduction || 0)
    const otherDed = key === "other_deductions" ? nextValue : Number(form.other_deductions || 0)

    const calculated = calculateEthiopianPayroll({
      basicSalary: bSalary,
      allowances: allow,
      overtimePay: ot,
      bonus: bon,
      otherEarnings: otherEarn,
      absenceDeduction: absDed,
      loanDeduction: loanDed,
      otherDeductions: otherDed,
      pensionConfig,
      taxBrackets,
    })

    setForm({
      ...form,
      [key]: value,
      basic_salary: bSalary,
      allowances: allow,
      overtime_pay: ot,
      bonus: bon,
      other_earnings: otherEarn,
      absence_deduction: absDed,
      loan_deduction: loanDed,
      other_deductions: otherDed,
      pension: calculated.employeePension,
      tax: calculated.incomeTaxDeducted,
      gross_pay: calculated.grossSalary,
      total_deductions: calculated.totalEmployeeDeductions,
      net_pay: calculated.netTakeHomePay,
    })
  }

  return (
    <Modal title="Edit Payroll Record" onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form) }} className="space-y-5">
        {/* Ethiopian Statutory Deduction Calculation Card */}
        <div className="p-4 rounded-2xl bg-zinc-950 text-white shadow-md">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Statutory Computation • Proclamation No. 1395/2025 &amp; No. 1268/2022
              </span>
              <p className="text-xs font-bold text-zinc-300">Live Ethiopian Tax &amp; Pension Breakdown (Auto-Calculated)</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Locked &amp; Auto-Calculated
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-white/[0.06] p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-zinc-400 font-sans font-bold">Gross Basic Salary</span>
              <span className="text-sm font-black text-white">{money(ethiopian.grossBasicSalary)} ETB</span>
            </div>
            <div className="bg-white/[0.06] p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-zinc-400 font-sans font-bold">Total Allowances</span>
              <span className="text-sm font-black text-white">{money(ethiopian.totalAllowances)} ETB</span>
            </div>
            <div className="bg-white/[0.06] p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-zinc-400 font-sans font-bold">Employee Pension ({pensionConfig.employeeRatePercent}%)</span>
              <span className="text-sm font-black text-amber-400">{money(ethiopian.employeePension)} ETB</span>
            </div>
            <div className="bg-white/[0.06] p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-zinc-400 font-sans font-bold">Employer Pension ({pensionConfig.employerRatePercent}%)</span>
              <span className="text-sm font-black text-amber-200">{money(ethiopian.employerPension)} ETB</span>
            </div>
            <div className="bg-white/[0.06] p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-zinc-400 font-sans font-bold">Taxable Income Base</span>
              <span className="text-sm font-black text-sky-400">{money(ethiopian.taxableIncomeBase)} ETB</span>
            </div>
            <div className="bg-white/[0.06] p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-zinc-400 font-sans font-bold">Income Tax Deducted</span>
              <span className="text-sm font-black text-rose-400">{money(ethiopian.incomeTaxDeducted)} ETB</span>
            </div>
            <div className="bg-white/[0.06] p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-zinc-400 font-sans font-bold">Total Deductions</span>
              <span className="text-sm font-black text-rose-300">{money(form.total_deductions)} ETB</span>
            </div>
            <div className="bg-emerald-600/30 border border-emerald-500/40 p-2.5 rounded-xl">
              <span className="block text-[9px] uppercase text-emerald-300 font-sans font-bold">Net Take-Home Pay</span>
              <span className="text-sm font-black text-emerald-400">{money(form.net_pay)} ETB</span>
            </div>
          </div>
        </div>

        {/* Employee Profile Salary Mismatch Notice */}
        {employee && Number(employee.basic_salary || 0) !== Number(form.basic_salary || 0) && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-amber-900">
            <div>
              <span className="font-black">Employee Profile Salary Updated:</span> Master employee record currently has <strong>ETB {money(employee.basic_salary)}</strong>, but this pending payroll record still has <strong>ETB {money(form.basic_salary)}</strong>.
            </div>
            <button
              type="button"
              onClick={() => setField("basic_salary", Number(employee.basic_salary || 0))}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shrink-0 transition-colors shadow-xs"
            >
              Sync Profile Salary (ETB {money(employee.basic_salary)})
            </button>
          </div>
        )}

        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Basic Salary (ETB)" type="number" value={form.basic_salary} onChange={(value) => setField("basic_salary", value)} />
          <Input label="Allowances (ETB)" type="number" value={form.allowances} onChange={(value) => setField("allowances", value)} />
          <Input label="Overtime Pay (ETB)" type="number" value={form.overtime_pay} onChange={(value) => setField("overtime_pay", value)} />
          <Input label="Bonus (ETB)" type="number" value={form.bonus} onChange={(value) => setField("bonus", value)} />
          <Input label="Other Earnings (ETB)" type="number" value={form.other_earnings} onChange={(value) => setField("other_earnings", value)} />
          <Input label="Absence Deduction (ETB)" type="number" value={form.absence_deduction} onChange={(value) => setField("absence_deduction", value)} />
          <Input label="Loan Deduction (ETB)" type="number" value={form.loan_deduction} onChange={(value) => setField("loan_deduction", value)} />
          <Input label="Other Deductions (ETB)" type="number" value={form.other_deductions} onChange={(value) => setField("other_deductions", value)} />

          {/* Automatic Read-Only Statutory Calculated Fields */}
          <ReadOnlyField label="Employee Pension (7% - Auto)" value={`ETB ${money(form.pension)}`} subtitle="Computed on Basic Salary" />
          <ReadOnlyField label="Income Tax (Auto - Proc. 1395/2025)" value={`ETB ${money(form.tax)}`} subtitle="Computed on Taxable Base" />
          <ReadOnlyField label="Gross Pay (Calculated)" value={`ETB ${money(form.gross_pay)}`} subtitle="Basic + Allowances + Extras" />
          <ReadOnlyField label="Total Deductions (Calculated)" value={`ETB ${money(form.total_deductions)}`} subtitle="Tax + Pension + Deductions" />
          <ReadOnlyField label="Net Pay (Take-Home)" value={`ETB ${money(form.net_pay)}`} subtitle="Gross Pay - Deductions" highlight />

          <Select label="Payment Status" value={form.payment_status} options={PAYMENT_STATUSES} onChange={(value) => setField("payment_status", value)} />
          <div className="md:col-span-2">
            <Input label="Notes / Remarks" value={form.notes} onChange={(value) => setField("notes", value)} />
          </div>
        </div>

        <Actions onClose={onClose} label="Save Payroll Record" />
      </form>
    </Modal>
  )
}

function ReadOnlyField({ label, value, subtitle, highlight = false }: { label: string; value: string; subtitle?: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border ${highlight ? "bg-emerald-50/80 border-emerald-200" : "bg-black/[0.03] border-black/10"}`}>
      <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`text-sm font-black font-mono mt-0.5 block ${highlight ? "text-emerald-700 font-bold text-base" : "text-zinc-950"}`}>{value}</span>
      {subtitle && <span className="block text-[9px] font-semibold text-zinc-400 mt-0.5">{subtitle}</span>}
    </div>
  )
}

function Payslip({ record, employee, period, onClose }: { record: PayrollRecord; employee?: Employee; period?: PayrollPeriod; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm print:static print:bg-white print:p-0"><motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-black/10 print:shadow-none print:border-0 print:rounded-none"><div className="flex items-center justify-between mb-5 print:hidden"><h3 className="text-lg font-black">Payslip</h3><div className="flex gap-2"><button onClick={() => window.print()} className="px-3 py-1.5 rounded-full bg-black text-white text-xs font-bold flex items-center gap-1"><Printer className="size-3.5" />Print</button><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X className="size-5" /></button></div></div>
    <div className="text-center border-b border-black/10 pb-4 mb-4"><h2 className="text-xl font-black">HKC Trading ERP</h2><p className="text-xs font-bold text-zinc-500">{period?.name || "Payroll period"} Payslip</p></div>
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Line label="Employee Number" value={employee?.employee_number || "-"} /><Line label="Employee Name" value={employee?.full_name || "-"} /><Line label="Warehouse" value={employee?.warehouse_id || "-"} /><Line label="Payment Status" value={record.payment_status} />
      <Line label="Basic Salary" value={`ETB ${money(record.basic_salary)}`} /><Line label="Allowances" value={`ETB ${money(record.allowances)}`} /><Line label="Overtime Pay" value={`ETB ${money(record.overtime_pay)}`} /><Line label="Bonus" value={`ETB ${money(record.bonus)}`} /><Line label="Other Earnings" value={`ETB ${money(record.other_earnings)}`} /><Line label="Gross Pay" value={`ETB ${money(record.gross_pay)}`} />
      <Line label="Tax" value={`ETB ${money(record.tax)}`} /><Line label="Pension" value={`ETB ${money(record.pension)}`} /><Line label="Absence Deduction" value={`ETB ${money(record.absence_deduction)}`} /><Line label="Loan Deduction" value={`ETB ${money(record.loan_deduction)}`} /><Line label="Other Deductions" value={`ETB ${money(record.other_deductions)}`} /><Line label="Total Deductions" value={`ETB ${money(record.total_deductions)}`} />
      <div className="col-span-2 rounded-2xl bg-black text-white p-4 flex items-center justify-between"><span className="text-sm font-black">Net Pay</span><span className="text-xl font-black">ETB {money(record.net_pay)}</span></div>
    </div>
  </motion.div></div>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto no-scrollbar bg-white rounded-3xl p-6 shadow-2xl border border-black/10"><div className="flex items-center justify-between mb-5"><h3 className="text-lg font-black">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X className="size-5" /></button></div>{children}</motion.div></div>
}

function Actions({ onClose, label }: { onClose: () => void; label: string }) {
  return <div className="md:col-span-3 flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-full bg-black/5 text-xs font-bold">Cancel</button><button type="submit" className="px-5 py-2 rounded-full bg-black text-white text-xs font-bold">{label}</button></div>
}

function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} readOnly={onChange.toString().includes("undefined")} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold outline-none read-only:bg-zinc-100" /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs font-bold outline-none">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-black/[0.03] px-3 py-2 flex justify-between gap-3"><span className="font-bold text-zinc-500">{label}</span><span className="font-black text-zinc-900 text-right">{value}</span></div>
}
