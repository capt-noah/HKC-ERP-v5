import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Check, 
  X, 
  Truck, 
  Wrench, 
  ChevronDown, 
  ChevronRight,
  Play,
  Download,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore } from "@/lib/financeStore"
import type { Vehicle, RecurringExpenseSchedule } from "@/lib/financeStore"
import { exportToExcel } from "@/lib/exportUtils"
import { isDateInPreset } from "@/lib/peachtreeExportUtils"

import { Skeleton } from "@/components/ui/skeleton"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

export default function Expenses() {
  const { showToast } = useFeedback()
  const store = useFinanceStore()
  const isLoading = store.isLoading()

  const [activeTab, setActiveTab] = useState<"one-off" | "recurring" | "vehicles">("one-off")

  // One-off Expenses state
  const expenses = store.getOneOffExpenses()
  const [searchQuery, setSearchQuery] = useState("")
  const [expenseDateFilter, setExpenseDateFilter] = useState("ALL")
  const [expenseCustomStart, setExpenseCustomStart] = useState("")
  const [expenseCustomEnd, setExpenseCustomEnd] = useState("")
  const [filterCategory, setFilterCategory] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")

  // Log One-off expense form state
  const [merchant, setMerchant] = useState("")
  const [category, setCategory] = useState("Miscellaneous")
  const [costCenter, setCostCenter] = useState("CC-100 Corporate HQ")
  const [glAccount, setGlAccount] = useState("8000-30")
  const [employee, setEmployee] = useState("")
  const [amount, setAmount] = useState("")
  const [taxAmount, setTaxAmount] = useState("0")
  const [voucherRef, setVoucherRef] = useState("")
  const [showForm, setShowForm] = useState(false)

  // Recurring Schedule Creation Modal
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false)
  const [schExpenseType, setSchExpenseType] = useState<RecurringExpenseSchedule["expense_type"]>("Software & SaaS")
  const [schAmount, setSchAmount] = useState("")
  const [schFrequency, setSchFrequency] = useState<"Monthly" | "Quarterly" | "Annually">("Monthly")
  const [schDueDate, setSchDueDate] = useState(new Date().toISOString().split("T")[0])
  const [schResource, setSchResource] = useState("")
  const [schCostCenter, setSchCostCenter] = useState("CC-100 Corporate HQ")

  // Vehicles expanded history
  const [expandedVehicles, setExpandedVehicles] = useState<{ [id: string]: boolean }>({})

  // Log Maintenance modal state
  const [selectedVehicleForMaint, setSelectedVehicleForMaint] = useState<Vehicle | null>(null)
  const [maintDesc, setMaintDesc] = useState("")
  const [maintAmount, setMaintAmount] = useState("")

  // Edit One-Off Expense
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [editExpMerchant, setEditExpMerchant] = useState("")
  const [editExpEmployee, setEditExpEmployee] = useState("")
  const [editExpCategory, setEditExpCategory] = useState("")
  const [editExpAmount, setEditExpAmount] = useState("")

  // Edit Recurring Schedule
  const [showEditScheduleModal, setShowEditScheduleModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)
  const [editSchExpenseType, setEditSchExpenseType] = useState<RecurringExpenseSchedule["expense_type"]>("Software & SaaS")
  const [editSchAmount, setEditSchAmount] = useState("")
  const [editSchFrequency, setEditSchFrequency] = useState<"Monthly" | "Quarterly" | "Annually">("Monthly")
  const [editSchDueDate, setEditSchDueDate] = useState("")

  const [schSearch, setSchSearch] = useState("")
  const [schStatusFilter, setSchStatusFilter] = useState("ALL")
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("ALL")

  // Add Vehicle Modal
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false)
  const [newVehicleReg, setNewVehicleReg] = useState("")
  const [newVehicleType, setNewVehicleType] = useState("Delivery Truck")
  const [newVehicleDriver, setNewVehicleDriver] = useState("")
  const [newVehicleWarehouse, setNewVehicleWarehouse] = useState("Main Warehouse")

  // Calculate Executive Summary Metrics
  const totalApproved = expenses.filter((e) => e.status === "APPROVED").reduce((s, e) => s + e.amount, 0)
  const pendingCount = expenses.filter((e) => e.status === "PENDING").length
  const pendingValue = expenses.filter((e) => e.status === "PENDING").reduce((s, e) => s + e.amount, 0)
  const recurringMonthly = store.getRecurringSchedules().filter((s) => s.status === "Active").reduce((s, e) => s + e.amount, 0)
  const totalFleetCost = store.getVehicles().reduce((s, v) => s + v.maintenance_cost_history.reduce((ms, m) => ms + m.amount, 0), 0)

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()
    if (!merchant || !amount || !employee) return

    const amtVal = parseFloat(amount)
    const taxVal = parseFloat(taxAmount) || 0

    store.addOneOffExpense({
      merchant,
      category,
      cost_center: costCenter,
      gl_account_id: glAccount,
      date: new Date().toISOString().split("T")[0],
      employee,
      amount: amtVal,
      tax_amount: taxVal,
      currency: "ETB",
      receipt_ref: voucherRef || `VOUCH-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "PENDING",
    })

    setMerchant("")
    setEmployee("")
    setAmount("")
    setTaxAmount("0")
    setVoucherRef("")
    setShowForm(false)
    showToast("Expense Submitted", "info", `Claim for ${merchant} (${costCenter}) submitted for treasury audit.`)
  }

  const handleAddScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(schAmount)
    if (isNaN(amt) || amt <= 0) return

    store.addRecurringSchedule({
      expense_type: schExpenseType,
      amount: amt,
      currency: "ETB",
      frequency: schFrequency,
      next_due_date: schDueDate,
      linked_resource_id: schResource || "General Overhead",
      cost_center: schCostCenter,
      auto_generate: true,
      status: "Active",
    })

    setShowAddScheduleModal(false)
    setSchAmount("")
    setSchResource("")
    showToast("Schedule Created", "success", `Recurring schedule for ${schExpenseType} created!`)
  }

  const handleApprove = (id: string) => {
    store.approveOneOffExpense(id)
    showToast("Claim Approved", "success", `Expense claim ${id} approved & posted to General Ledger.`)
  }

  const handleReject = (id: string) => {
    store.rejectOneOffExpense(id)
    showToast("Claim Rejected", "warning", `Expense claim ${id} marked rejected.`)
  }

  // Generate due recurring expenses from saved schedules.
  const handleGenerateDueExpenses = () => {
    const generatedCount = store.generateDueExpenses()
    if (generatedCount > 0) {
      showToast(
        "Due Expenses Generated",
        "success",
        `Created ${generatedCount} pending expense claims from active recurring schedules requiring manager approval.`
      )
    } else {
      showToast("No Schedules Due", "info", "All active recurring expense schedules are current.")
    }
  }

  const toggleVehicleExpand = (id: string) => {
    setExpandedVehicles((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAddMaintenanceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVehicleForMaint || !maintDesc || !maintAmount) return

    store.addVehicleMaintenance(selectedVehicleForMaint.id, {
      date: new Date().toISOString().split("T")[0],
      description: maintDesc,
      amount: parseFloat(maintAmount),
    })

    setSelectedVehicleForMaint(null)
    setMaintDesc("")
    setMaintAmount("")
    showToast("Maintenance Logged", "success", `Logged service history for ${selectedVehicleForMaint.registration_number}.`)
  }

  const handleEditExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpense) return
    store.updateOneOffExpense(editingExpense.id, {
      merchant: editExpMerchant,
      employee: editExpEmployee,
      category: editExpCategory,
      amount: parseFloat(editExpAmount) || editingExpense.amount,
    })
    setShowEditExpenseModal(false)
    setEditingExpense(null)
    showToast("Expense Updated", "success", `Claim for ${editExpMerchant} has been updated.`)
  }

  const handleDeleteExpense = (id: string) => {
    if (confirm("Delete this expense claim? This cannot be undone.")) {
      store.deleteOneOffExpense(id)
      showToast("Expense Deleted", "info", `Expense claim ${id} has been removed.`)
    }
  }

  const handleEditScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSchedule) return
    store.updateRecurringSchedule(editingSchedule.id, {
      expense_type: editSchExpenseType,
      amount: parseFloat(editSchAmount) || editingSchedule.amount,
      frequency: editSchFrequency,
      next_due_date: editSchDueDate,
    })
    setShowEditScheduleModal(false)
    setEditingSchedule(null)
    showToast("Schedule Updated", "success", `Recurring schedule updated successfully.`)
  }

  const handleDeleteSchedule = (id: string) => {
    if (confirm("Delete this recurring schedule?")) {
      store.deleteRecurringSchedule(id)
      showToast("Schedule Deleted", "info", `Recurring schedule ${id} removed.`)
    }
  }

  const handleAddVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVehicleReg || !newVehicleDriver) return
    store.addVehicle({
      registration_number: newVehicleReg,
      type: newVehicleType as any,
      driver_name: newVehicleDriver,
      assigned_warehouse: newVehicleWarehouse,
      status: "Active",
      maintenance_cost_history: [],
    })
    setShowAddVehicleModal(false)
    setNewVehicleReg("")
    setNewVehicleDriver("")
    showToast("Vehicle Registered", "success", `Vehicle ${newVehicleReg} added to fleet registry.`)
  }

  const handleDeleteVehicle = (id: string, reg: string) => {
    if (confirm(`Remove vehicle ${reg} from fleet registry?`)) {
      store.deleteVehicle(id)
      showToast("Vehicle Removed", "info", `Vehicle ${reg} has been removed from the fleet.`)
    }
  }

  const filteredExpenses = expenses.filter((exp) => {
    if (!isDateInPreset((exp as any).date || (exp as any).created_at, expenseDateFilter, expenseCustomStart, expenseCustomEnd)) return false
    const q = (searchQuery || "").toLowerCase()
    const merchant = (exp.merchant || "").toLowerCase()
    const employee = (exp.employee || "").toLowerCase()
    const expId = (exp.id || "").toLowerCase()
    const matchesSearch = merchant.includes(q) || employee.includes(q) || expId.includes(q)
    const matchesCategory = filterCategory === "ALL" || exp.category === filterCategory
    const matchesStatus = filterStatus === "ALL" || exp.status === filterStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  const recurringSchedules = store.getRecurringSchedules()
  const vehicles = store.getVehicles()

  const filteredRecurringSchedules = recurringSchedules.filter((sch) => {
    const matchesStatus = schStatusFilter === "ALL" || sch.status === schStatusFilter
    if (!matchesStatus) return false
    if (!schSearch.trim()) return true
    const q = schSearch.toLowerCase()
    return (
      (sch.id || "").toLowerCase().includes(q) ||
      (sch.expense_type || "").toLowerCase().includes(q) ||
      ((sch.cost_center || "").toLowerCase().includes(q)) ||
      ((sch.linked_resource_id || "").toLowerCase().includes(q))
    )
  })

  const filteredVehicles = vehicles.filter((v) => {
    if (!vehicleSearch.trim()) return true
    const q = vehicleSearch.toLowerCase()
    return (
      (v.registration_number || "").toLowerCase().includes(q) ||
      (v.driver_name || "").toLowerCase().includes(q) ||
      (v.type || "").toLowerCase().includes(q) ||
      (v.assigned_warehouse || "").toLowerCase().includes(q)
    )
  })

  const expColumns: TableColumn[] = [{key:'id',label:'ID'},{key:'merchant',label:'Merchant/Vendor'},{key:'category',label:'Category'},{key:'employee',label:'Claimant'},{key:'date',label:'Date'},{key:'amount',label:'Amount',align:'right'},{key:'status',label:'Audit Status',align:'center'},{key:'_actions',label:'Treasury Actions',align:'right',noSort:true}]
  const expTable = useResizableTable(expColumns, filteredExpenses)

  const schColumns: TableColumn[] = [{key:'id',label:'Schedule ID'},{key:'expense_type',label:'Expense Type'},{key:'frequency',label:'Frequency'},{key:'cost_center',label:'Cost Center'},{key:'linked_resource_id',label:'Linked Resource'},{key:'next_due_date',label:'Next Due Date'},{key:'amount',label:'Recurring Amount',align:'right'},{key:'auto_generate',label:'Auto-Generate',align:'center'},{key:'status',label:'Status',align:'center'},{key:'_actions',label:'Actions',align:'right',noSort:true}]
  const schTable = useResizableTable(schColumns, filteredRecurringSchedules)

  const [expPage, setExpPage] = useState(1)
  const [expPageSize, setExpPageSize] = useState(10)
  const [schPage, setSchPage] = useState(1)
  const [schPageSize, setSchPageSize] = useState(10)

  useEffect(() => {
    setExpPage(1)
  }, [searchQuery, filterCategory, filterStatus, expenseDateFilter, filteredExpenses.length])

  useEffect(() => {
    setSchPage(1)
  }, [schSearch, schStatusFilter, filteredRecurringSchedules.length])

  const sortedExpenses = expTable.sorted()
  const totalExpPages = Math.max(1, Math.ceil(sortedExpenses.length / expPageSize))
  const displayedExpenses = sortedExpenses.slice((expPage - 1) * expPageSize, expPage * expPageSize)

  const sortedSchedules = schTable.sorted()
  const totalSchPages = Math.max(1, Math.ceil(sortedSchedules.length / schPageSize))
  const displayedSchedules = sortedSchedules.slice((schPage - 1) * schPageSize, schPage * schPageSize)

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      {store.getLoadError() && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-800 shadow-lg flex items-center gap-3">
            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            Server unavailable — expense data cannot be loaded. {store.getLoadError()}
          </div>
        </div>
      )}

      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Resources & Overhead Expenses</h1>
            <p className="text-sm text-gray-400 mt-1">Manage expense claims, cost centers, and fleet maintenance.</p>
          </div>
          <div className="flex items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </motion.div>

        {/* Expenses Executive Summary KPI Banner */}
        <motion.div variants={fade} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved Expenses YTD</span>
            {isLoading ? (
              <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-black font-mono mt-1">
                ETB {totalApproved.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            )}
            <span className="text-[10px] text-emerald-600 font-semibold mt-1">GL Journal Entries Posted</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Claims Audit</span>
            {isLoading ? (
              <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-amber-600 font-mono mt-1">
                {pendingCount} claims <span className="text-xs font-normal text-gray-500">(ETB {pendingValue.toLocaleString()})</span>
              </p>
            )}
            <span className="text-[10px] text-amber-600 font-semibold mt-1">Awaiting Treasury Manager Approval</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recurring Monthly Commitment</span>
            {isLoading ? (
              <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-black font-mono mt-1">
                ETB {recurringMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            )}
            <span className="text-[10px] text-gray-400 mt-1">Rent, Software & Retainers</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fleet Service History Total</span>
            {isLoading ? (
              <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-black font-mono mt-1">
                ETB {totalFleetCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            )}
            <span className="text-[10px] text-gray-400 mt-1">Logistics & Repairs (ACC-5400)</span>
          </GlassCard>
        </motion.div>

        {/* Tab Switcher Bar */}
        <motion.div variants={fade} className="flex items-center border-b border-black/10 mb-6">
          <div className="flex gap-2">
            {[
              { id: "one-off", label: "One-Off Expenses & Claims" },
              { id: "recurring", label: "Recurring Schedules" },
              { id: "vehicles", label: "Vehicle Registry & Maintenance" },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="px-4 py-2.5 text-xs font-black relative tracking-tight transition-colors uppercase"
                >
                  <span className={isActive ? "text-black" : "text-gray-400 hover:text-gray-700"}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div layoutId="expense-tabs" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
                  )}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Tab 1: One-off Expenses */}
        {activeTab === "one-off" && (
          <div className="grid grid-cols-1 gap-4">
            {/* Add Expense Form Collapse */}
            {showForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                <GlassCard className="p-6 border border-emerald-300/40 bg-emerald-50/[0.15]">
                  <h3 className="text-base font-bold text-black mb-4">Add Corporate Card or Employee Claim</h3>
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Merchant / Vendor</label>
                        <input
                          type="text"
                          value={merchant}
                          onChange={(e) => setMerchant(e.target.value)}
                          placeholder="e.g. AWS, Delta Air"
                          className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Claimant Employee</label>
                        <input
                          type="text"
                          value={employee}
                          onChange={(e) => setEmployee(e.target.value)}
                          placeholder="Employee name"
                          className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Cost Category</label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:border-black cursor-pointer font-bold"
                        >
                          <option value="Software & SaaS">Software & SaaS</option>
                          <option value="Infrastructure">Infrastructure</option>
                          <option value="Travel & Lodging">Travel & Lodging</option>
                          <option value="Meals & Entertaining">Meals & Entertaining</option>
                          <option value="Office Rent">Office Rent</option>
                          <option value="Vehicle Cost">Vehicle Cost</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Cost Center Allocation</label>
                        <select
                          value={costCenter}
                          onChange={(e) => setCostCenter(e.target.value)}
                          className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:border-black cursor-pointer font-bold"
                        >
                          <option value="CC-100 Corporate HQ">CC-100 Corporate HQ</option>
                          <option value="CC-200 Logistics & Warehouse">CC-200 Logistics & Warehouse</option>
                          <option value="CC-300 Sales & Field Ops">CC-300 Sales & Field Ops</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Expense GL Account</label>
                        <select
                          value={glAccount}
                          onChange={(e) => setGlAccount(e.target.value)}
                          className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none focus:border-black cursor-pointer"
                        >
                          {store.getAccounts().filter((a) => a.account_type === "Expense" && !a.is_group).length > 0
                            ? store.getAccounts().filter((a) => a.account_type === "Expense" && !a.is_group).map((acc) => (
                                <option key={acc.id} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))
                            : [
                                { code: "8000-08", name: "OFFICE RENT" },
                                { code: "8000-09", name: "TELEPHONE AND INTERNET" },
                                { code: "8000-07", name: "STATIONERY, PRINTING & OFF SUP" },
                                { code: "8000-16", name: "INSURANCE" },
                                { code: "8000-18", name: "AUDIT FEE & PROFFESSIONAL FEE" },
                                { code: "8000-25", name: "BANK SERVICE CHARGE" },
                                { code: "8000-28", name: "PENALITY" },
                                { code: "8000-30", name: "MICELLANOUS" },
                                { code: "6000-04", name: "PACKING AND BAGING" },
                                { code: "6000-08", name: "TRANSPORT COST" },
                                { code: "6000-10", name: "LOADING UNLOADING" },
                              ].map((acc) => (
                                <option key={acc.code} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Receipt / Voucher Ref</label>
                        <input
                          type="text"
                          value={voucherRef}
                          onChange={(e) => setVoucherRef(e.target.value)}
                          placeholder="e.g. REC-99201"
                          className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-sm font-mono text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Tax Reclaimable (15%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={taxAmount}
                          onChange={(e) => setTaxAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-sm font-mono text-black focus:outline-none focus:border-black"
                        />
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Total Amount (ETB)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 1500.00"
                            className="w-full bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-sm font-mono font-black text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                            required
                          />
                        </div>
                        <button type="submit" className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all self-end h-[38px] uppercase tracking-wider">
                          Submit Claim
                        </button>
                      </div>
                    </div>
                  </form>
                </GlassCard>
              </motion.div>
            )}

            {/* Main Expense Table Card */}
            <GlassCard transition={{ delay: 0.12, duration: 0.4, ease: "easeOut" }} className="flex flex-col">
              <FinanceTableToolbar
                title="Audit Expenses & Claims"
                subtitle="Claims requiring corporate treasury approval."
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search merchant, employee..."
                dateFilter={{
                  value: expenseDateFilter,
                  onChange: setExpenseDateFilter,
                  startDate: expenseCustomStart,
                  endDate: expenseCustomEnd,
                  onCustomDateChange: (start, end) => {
                    setExpenseCustomStart(start)
                    setExpenseCustomEnd(end)
                  },
                }}
                filters={[
                  {
                    value: filterCategory,
                    onChange: setFilterCategory,
                    ariaLabel: "Category filter",
                    options: [
                      { value: "ALL", label: "All Categories" },
                      { value: "Infrastructure", label: "Infrastructure" },
                      { value: "Travel & Lodging", label: "Travel & Lodging" },
                      { value: "Software & SaaS", label: "Software & SaaS" },
                      { value: "Meals & Entertaining", label: "Meals" },
                    ],
                  },
                  {
                    value: filterStatus,
                    onChange: setFilterStatus,
                    ariaLabel: "Status filter",
                    options: [
                      { value: "ALL", label: "All Status" },
                      { value: "APPROVED", label: "Approved" },
                      { value: "PENDING", label: "Pending" },
                      { value: "REJECTED", label: "Rejected" },
                    ],
                  },
                ]}
                actions={[
                  {
                    label: `Export (${filteredExpenses.length})`,
                    onClick: () => {
                      exportToExcel({
                        fileName: `HKC_Expenses_${new Date().toISOString().split("T")[0]}`,
                        title: "HKC Trading - Corporate Expense Claims",
                        headers: ["Expense ID", "Merchant / Payee", "Employee", "Category", "Cost Center", "GL Account", "Amount (ETB)", "Status"],
                        rows: filteredExpenses.map((e) => [
                          e.id || "",
                          e.merchant || "",
                          e.employee || "",
                          e.category || "",
                          e.cost_center || "HQ",
                          e.gl_account_id || "5200",
                          Number(e.amount) || 0,
                          e.status || "",
                        ]),
                      })
                      showToast("Expenses Exported", "success", `Exported ${filteredExpenses.length} expense claims to Excel.`)
                    },
                    icon: <Download className="size-3.5" />,
                    variant: "emeraldLight",
                  },
                  {
                    label: showForm ? "Close Form" : "Log Expense Claim",
                    onClick: () => setShowForm(!showForm),
                  },
                ]}
              />

              {/* Expense Table List */}
              <TableScrollWrapper>
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                      {expColumns.map(col => <ResizableTh key={col.key} col={col} width={expTable.colWidths[col.key] ?? 140} sortKey={expTable.sortKey} sortDir={expTable.sortDir} openMenuCol={expTable.openMenuCol} onResizeStart={expTable.handleResizeStart} onToggleMenu={expTable.toggleMenu} onSortAsc={expTable.setSortAsc} onSortDesc={expTable.setSortDesc} onClearSort={expTable.clearSort} />)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse text-xs">
                          <td className="py-3.5 pl-4"><Skeleton className="h-4 w-28 bg-zinc-200/80" /></td>
                          <td className="py-3.5"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
                          <td className="py-3.5"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
                          <td className="py-3.5"><Skeleton className="h-4 w-20 bg-zinc-200/80" /></td>
                          <td className="py-3.5 text-right"><Skeleton className="h-4 w-20 bg-zinc-200/80 ml-auto" /></td>
                          <td className="py-3.5 text-center"><Skeleton className="h-4 w-16 bg-zinc-200/80 mx-auto" /></td>
                          <td className="py-3.5 text-right pr-4"><Skeleton className="h-4 w-12 bg-zinc-200/80 ml-auto" /></td>
                        </tr>
                      ))
                    ) : sortedExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                          No expense entries match your filter.
                        </td>
                      </tr>
                    ) : (
                      displayedExpenses.map((exp) => (
                        <tr key={exp.id} className="text-sm hover:bg-black/[0.01]">
                          <td className="py-3.5 pl-2 font-mono text-xs font-bold text-gray-500">{exp.id}</td>
                          <td className="py-3.5 font-bold text-black">{exp.merchant}</td>
                          <td className="py-3.5 text-xs text-gray-500">
                            <span className="bg-black/[0.03] text-gray-700 px-2 py-0.5 rounded font-medium">{exp.category}</span>
                          </td>
                          <td className="py-3.5 text-gray-600 font-medium">{exp.employee}</td>
                          <td className="py-3.5 text-xs text-gray-400">{exp.date}</td>
                          <td className="py-3.5 text-right font-mono font-black text-black">
                            {exp.currency} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 text-center">
                            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                              exp.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : exp.status === "REJECTED"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                            }`}>
                              {exp.status}
                            </span>
                          </td>
                          <td className="py-3.5 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {exp.status === "PENDING" && (
                                <>
                                  <button
                                    onClick={() => handleApprove(exp.id)}
                                    className="size-7 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                                    title="Approve Claim"
                                  >
                                    <Check className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleReject(exp.id)}
                                    className="size-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                                    title="Reject Claim"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setEditingExpense(exp)
                                  setEditExpMerchant(exp.merchant)
                                  setEditExpEmployee(exp.employee)
                                  setEditExpCategory(exp.category)
                                  setEditExpAmount(String(exp.amount))
                                  setShowEditExpenseModal(true)
                                }}
                                className="size-7 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
                                title="Edit Claim"
                              >
                                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="size-7 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                                title="Delete Claim"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableScrollWrapper>

              {!isLoading && sortedExpenses.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-black/5 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                    <span>
                      Showing {Math.min((expPage - 1) * expPageSize + 1, sortedExpenses.length)} to {Math.min(expPage * expPageSize, sortedExpenses.length)} of {sortedExpenses.length} entries
                    </span>
                    <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                      <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                      <select
                        value={expPageSize}
                        onChange={(e) => {
                          setExpPageSize(Number(e.target.value))
                          setExpPage(1)
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
                      disabled={expPage === 1}
                      onClick={() => setExpPage((p) => Math.max(1, p - 1))}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                      Page {expPage} of {totalExpPages}
                    </span>
                    <button
                      type="button"
                      disabled={expPage >= totalExpPages}
                      onClick={() => setExpPage((p) => p + 1)}
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

        {/* Tab 2: Recurring Expenses */}
        {activeTab === "recurring" && (
          <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
            <FinanceTableToolbar
              title="Recurring Expense Schedules"
              subtitle="Manage automated and recurring expense templates"
              searchValue={schSearch}
              onSearchChange={setSchSearch}
              searchPlaceholder="Search schedule, expense type, cost center..."
              filters={[
                {
                  value: schStatusFilter,
                  onChange: setSchStatusFilter,
                  ariaLabel: "Schedule status filter",
                  options: [
                    { value: "ALL", label: "All Status" },
                    { value: "Active", label: "Active" },
                    { value: "Paused", label: "Paused" },
                  ],
                },
              ]}
              actions={[
                {
                  label: "Generate Due",
                  onClick: handleGenerateDueExpenses,
                  icon: <Play className="size-4" />,
                  variant: "emerald",
                },
                { label: "Add Schedule", onClick: () => setShowAddScheduleModal(true) },
              ]}
            />

            <TableScrollWrapper>
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                    {schColumns.map(col => <ResizableTh key={col.key} col={col} width={schTable.colWidths[col.key] ?? 140} sortKey={schTable.sortKey} sortDir={schTable.sortDir} openMenuCol={schTable.openMenuCol} onResizeStart={schTable.handleResizeStart} onToggleMenu={schTable.toggleMenu} onSortAsc={schTable.setSortAsc} onSortDesc={schTable.setSortDesc} onClearSort={schTable.clearSort} />)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={schColumns.length} className="text-center py-12 text-gray-400 text-sm">
                        No recurring expense schedules found.
                      </td>
                    </tr>
                  ) : (
                    displayedSchedules.map((sch) => (
                      <tr key={sch.id} className="text-sm hover:bg-black/[0.01]">
                        <td className="py-3.5 pl-2 font-mono text-xs font-bold text-gray-500">{sch.id}</td>
                        <td className="py-3.5 font-bold text-black">{sch.expense_type}</td>
                        <td className="py-3.5 text-xs text-gray-600 font-medium">{sch.frequency}</td>
                        <td className="py-3.5 text-xs text-gray-700 font-medium">{sch.cost_center || "CC-100 Corporate HQ"}</td>
                        <td className="py-3.5 text-xs font-mono text-gray-500">{sch.linked_resource_id || "Overhead General"}</td>
                        <td className="py-3.5 text-xs font-bold text-black">{sch.next_due_date}</td>
                        <td className="py-3.5 text-right font-mono font-black text-black">
                          {sch.currency} {sch.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sch.auto_generate ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                          }`}>
                            {sch.auto_generate ? "Auto" : "Manual"}
                          </span>
                        </td>
                        <td className="py-3.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sch.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                          }`}>
                            {sch.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                store.toggleRecurringScheduleStatus(sch.id)
                                showToast("Status Updated", "info", `Schedule ${sch.id} is now ${sch.status === "Active" ? "Paused" : "Active"}`)
                              }}
                              className="text-xs font-bold px-2.5 py-1 rounded-lg border border-black/10 hover:bg-black/5 text-black"
                            >
                              {sch.status === "Active" ? "Pause" : "Activate"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingSchedule(sch)
                                setEditSchExpenseType(sch.expense_type)
                                setEditSchAmount(String(sch.amount))
                                setEditSchFrequency(sch.frequency)
                                setEditSchDueDate(sch.next_due_date)
                                setShowEditScheduleModal(true)
                              }}
                              className="size-7 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
                              title="Edit Schedule"
                            >
                              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(sch.id)}
                              className="size-7 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                              title="Delete Schedule"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableScrollWrapper>
            {sortedSchedules.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-black/5 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                  <span>
                    Showing {Math.min((schPage - 1) * schPageSize + 1, sortedSchedules.length)} to {Math.min(schPage * schPageSize, sortedSchedules.length)} of {sortedSchedules.length} entries
                  </span>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                    <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                    <select
                      value={schPageSize}
                      onChange={(e) => {
                        setSchPageSize(Number(e.target.value))
                        setSchPage(1)
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
                    disabled={schPage === 1}
                    onClick={() => setSchPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                    Page {schPage} of {totalSchPages}
                  </span>
                  <button
                    type="button"
                    disabled={schPage >= totalSchPages}
                    onClick={() => setSchPage((p) => p + 1)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        )}

        {/* Tab 3: Vehicle Registry & Maintenance */}
        {activeTab === "vehicles" && (
          <div className="space-y-4">
            <GlassCard className="flex items-center justify-between p-4 mb-2">
              <div>
                <h3 className="font-semibold text-base text-black">Corporate Fleet Vehicle Registry</h3>
                <p className="text-xs text-gray-400">Track delivery trucks, refrigerated vans, and maintain repair logs.</p>
              </div>
              <div className="size-9 rounded-full bg-black/5 flex items-center justify-center">
                <Truck className="size-4 text-black" />
              </div>
            </GlassCard>

            <FinanceTableToolbar
              title="Fleet Vehicles"
              subtitle="Search and filter active fleet vehicles."
              searchValue={vehicleSearch}
              onSearchChange={setVehicleSearch}
              searchPlaceholder="Search registration, driver, type..."
              filters={[
                {
                  value: vehicleStatusFilter,
                  onChange: setVehicleStatusFilter,
                  ariaLabel: "Vehicle status filter",
                  options: [
                    { value: "ALL", label: "All Status" },
                    { value: "Active", label: "Active" },
                    { value: "In Repair", label: "In Repair" },
                    { value: "Decommissioned", label: "Decommissioned" },
                  ],
                },
              ]}
              actions={[
                {
                  label: "Add Vehicle",
                  onClick: () => setShowAddVehicleModal(true),
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-4">
              {filteredVehicles.map((v) => {
                const isExpanded = expandedVehicles[v.id]
                const totalMaint = v.maintenance_cost_history.reduce((s, m) => s + m.amount, 0)

                return (
                  <GlassCard key={v.id} className="p-5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleVehicleExpand(v.id)}
                          className="p-1 text-gray-400 hover:text-black hover:bg-black/5 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-black">{v.registration_number}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              v.status === "Active"
                                ? "bg-emerald-100 text-emerald-700"
                                : v.status === "In Repair"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-zinc-100 text-zinc-600"
                            }`}>
                              {v.status}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-500 mt-0.5">{v.type} • Driver: {v.driver_name}</p>
                          <p className="text-[10px] text-gray-400 font-medium">Assigned: {v.assigned_warehouse}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold text-gray-400 uppercase block">Total Maintenance Cost</span>
                          <span className="text-sm font-mono font-black text-black">
                            ETB {totalMaint.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedVehicleForMaint(v)}
                            className="px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-xs font-bold text-black flex items-center gap-1.5 transition-colors"
                          >
                            <Wrench className="size-3.5" /> Log Maintenance
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(v.id, v.registration_number)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 flex items-center gap-1.5 transition-colors"
                          >
                            <X className="size-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Maintenance History */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-black/5 bg-black/[0.01] rounded-xl p-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Service & Repair History</h4>
                        {v.maintenance_cost_history.length === 0 ? (
                          <p className="text-xs text-gray-400 italic py-2">No maintenance records logged for this vehicle.</p>
                        ) : (
                          <div className="space-y-2">
                            {v.maintenance_cost_history.map((m, i) => (
                              <div key={i} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-black/5">
                                <div>
                                  <span className="font-bold text-black">{m.description}</span>
                                  <span className="text-[10px] text-gray-400 block font-mono">{m.date}</span>
                                </div>
                                <span className="font-mono font-bold text-black">
                                  ETB {m.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </GlassCard>
                )
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Add Recurring Schedule Modal */}
      <AnimatePresence>
        {showAddScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddScheduleModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black uppercase text-black">Create Recurring Expense Schedule</h3>
                <button onClick={() => setShowAddScheduleModal(false)} className="text-gray-400 hover:text-black">
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleAddScheduleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Expense Type</label>
                  <select
                    value={schExpenseType}
                    onChange={(e) => setSchExpenseType(e.target.value as RecurringExpenseSchedule["expense_type"])}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  >
                    <option value="HQ Office Lease">HQ Office Lease</option>
                    <option value="Warehouse Space Lease">Warehouse Space Lease</option>
                    <option value="ERP SaaS Cloud License">ERP SaaS Cloud License</option>
                    <option value="Internet & Telecom Retainer">Internet & Telecom Retainer</option>
                    <option value="Security & Cleaning Retainer">Security & Cleaning Retainer</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Frequency</label>
                    <select
                      value={schFrequency}
                      onChange={(e) => setSchFrequency(e.target.value as any)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Amount (ETB)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={schAmount}
                      onChange={(e) => setSchAmount(e.target.value)}
                      placeholder="e.g. 120000"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cost Center</label>
                    <select
                      value={schCostCenter}
                      onChange={(e) => setSchCostCenter(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                    >
                      <option value="CC-100 Corporate HQ">CC-100 Corporate HQ</option>
                      <option value="CC-200 Logistics & Warehouse">CC-200 Logistics & Warehouse</option>
                      <option value="CC-300 Sales & Field Ops">CC-300 Sales & Field Ops</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Next Due Date</label>
                    <input
                      type="date"
                      value={schDueDate}
                      onChange={(e) => setSchDueDate(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Linked Contract / Vendor ID</label>
                  <input
                    type="text"
                    value={schResource}
                    onChange={(e) => setSchResource(e.target.value)}
                    placeholder="e.g. CON-88102 / Ethio Telecom"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddScheduleModal(false)}
                    className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-zinc-50 uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase shadow-lg shadow-black/10"
                  >
                    Save Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Maintenance Modal */}
      <AnimatePresence>
        {selectedVehicleForMaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVehicleForMaint(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black uppercase text-black">Log Maintenance ({selectedVehicleForMaint.registration_number})</h3>
                <button onClick={() => setSelectedVehicleForMaint(null)} className="text-gray-400 hover:text-black">
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleAddMaintenanceSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Service / Repair Description</label>
                  <input
                    type="text"
                    value={maintDesc}
                    onChange={(e) => setMaintDesc(e.target.value)}
                    placeholder="e.g. Engine tune up & filter replacement"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cost Amount (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maintAmount}
                    onChange={(e) => setMaintAmount(e.target.value)}
                    placeholder="e.g. 4500.00"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none"
                    required
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleForMaint(null)}
                    className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-zinc-50 uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase"
                  >
                    Save Maintenance Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Edit Expense Claim */}
      <AnimatePresence>
        {showEditExpenseModal && editingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-sm font-black uppercase text-black">Edit Expense Claim: {editingExpense.id}</h3>
                <button onClick={() => setShowEditExpenseModal(false)} className="text-gray-400 hover:text-black"><X className="size-4" /></button>
              </div>
              <form onSubmit={handleEditExpenseSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Merchant / Vendor</label>
                  <input type="text" value={editExpMerchant} onChange={(e) => setEditExpMerchant(e.target.value)} required
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Claimant Employee</label>
                  <input type="text" value={editExpEmployee} onChange={(e) => setEditExpEmployee(e.target.value)} required
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cost Category</label>
                  <select value={editExpCategory} onChange={(e) => setEditExpCategory(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none">
                    <option value="Software & SaaS">Software & SaaS</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Travel & Lodging">Travel & Lodging</option>
                    <option value="Meals & Entertaining">Meals & Entertaining</option>
                    <option value="Office Rent">Office Rent</option>
                    <option value="Vehicle Cost">Vehicle Cost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Amount (ETB)</label>
                  <input type="number" value={editExpAmount} onChange={(e) => setEditExpAmount(e.target.value)} required
                    step="0.01"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none" />
                </div>
                <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => setShowEditExpenseModal(false)}
                    className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-zinc-50 uppercase">Cancel</button>
                  <button type="submit"
                    className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Edit Recurring Schedule */}
      <AnimatePresence>
        {showEditScheduleModal && editingSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-sm font-black uppercase text-black">Edit Schedule: {editingSchedule.id}</h3>
                <button onClick={() => setShowEditScheduleModal(false)} className="text-gray-400 hover:text-black"><X className="size-4" /></button>
              </div>
              <form onSubmit={handleEditScheduleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Expense Type</label>
                  <select value={editSchExpenseType} onChange={(e) => setEditSchExpenseType(e.target.value as RecurringExpenseSchedule["expense_type"])}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none">
                    <option value="HQ Office Lease">HQ Office Lease</option>
                    <option value="Warehouse Space Lease">Warehouse Space Lease</option>
                    <option value="ERP SaaS Cloud License">ERP SaaS Cloud License</option>
                    <option value="Internet & Telecom Retainer">Internet & Telecom Retainer</option>
                    <option value="Security & Cleaning Retainer">Security & Cleaning Retainer</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Frequency</label>
                    <select value={editSchFrequency} onChange={(e) => setEditSchFrequency(e.target.value as any)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none">
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Amount (ETB)</label>
                    <input type="number" value={editSchAmount} onChange={(e) => setEditSchAmount(e.target.value)} required step="0.01"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Next Due Date</label>
                  <input type="date" value={editSchDueDate} onChange={(e) => setEditSchDueDate(e.target.value)} required
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none" />
                </div>
                <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => setShowEditScheduleModal(false)}
                    className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-zinc-50 uppercase">Cancel</button>
                  <button type="submit"
                    className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Register New Vehicle */}
      <AnimatePresence>
        {showAddVehicleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-sm font-black uppercase text-black">Register New Vehicle</h3>
                <button onClick={() => setShowAddVehicleModal(false)} className="text-gray-400 hover:text-black"><X className="size-4" /></button>
              </div>
              <form onSubmit={handleAddVehicleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Registration / Plate Number</label>
                  <input type="text" value={newVehicleReg} onChange={(e) => setNewVehicleReg(e.target.value)} required
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none"
                    placeholder="e.g. AA-000-ET" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Vehicle Type</label>
                  <select value={newVehicleType} onChange={(e) => setNewVehicleType(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none">
                    <option value="Delivery Truck">Delivery Truck</option>
                    <option value="Refrigerated Van">Refrigerated Van</option>
                    <option value="Pickup Truck">Pickup Truck</option>
                    <option value="Flatbed Truck">Flatbed Truck</option>
                    <option value="Company Car">Company Car</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Assigned Driver</label>
                  <input type="text" value={newVehicleDriver} onChange={(e) => setNewVehicleDriver(e.target.value)} required
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none"
                    placeholder="e.g. Dawit Haile" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Assigned Warehouse / Branch</label>
                  <select value={newVehicleWarehouse} onChange={(e) => setNewVehicleWarehouse(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none">
                    <option value="Main Warehouse">Main Warehouse</option>
                    <option value="Bole Logistics Hub">Bole Logistics Hub</option>
                    <option value="Merkato Distribution">Merkato Distribution</option>
                    <option value="Piassa Branch">Piassa Branch</option>
                  </select>
                </div>
                <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => setShowAddVehicleModal(false)}
                    className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-zinc-50 uppercase">Cancel</button>
                  <button type="submit"
                    className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase shadow-lg shadow-black/10">Register Vehicle</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
