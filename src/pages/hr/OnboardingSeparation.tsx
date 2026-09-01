import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  CheckCircle2, 
  X, 
  UserMinus, 
  ShieldCheck, 
  AlertCircle 
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useHRStore } from "@/lib/hrStore"
import { loadHRData, type Employee as HRApiEmployee } from "@/lib/hrApi"
import { useFeedback } from "@/context/FeedbackContext"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

export default function OnboardingSeparation() {
  const { showToast } = useFeedback()
  const store = useHRStore()

  const onboardings = store.getOnboardings()
  const separations = store.getSeparations()

  // Load employees from hrApi (production schema) instead of hrStore
  const [employees, setEmployees] = useState<HRApiEmployee[]>([])
  useEffect(() => {
    loadHRData().then((data) => setEmployees(data.employees)).catch(() => setEmployees([]))
  }, [])

  const [activeTab, setActiveTab] = useState<"Onboarding" | "Separation">("Onboarding")
  const [showInitiateSepModal, setShowInitiateSepModal] = useState(false)

  // New Separation Form State
  const [newSep, setNewSep] = useState({
    employeeId: "",
    resignationDate: new Date().toISOString().split("T")[0],
    exitDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    reason: "",
  })

  const handleToggleTask = (onboardingId: string, taskId: string) => {
    store.toggleOnboardingTask(onboardingId, taskId)
    showToast("Task Checklist Updated", "info", "Onboarding progress recalculating.")
  }

  const handleToggleClearance = (separationId: string, clearanceId: string) => {
    store.toggleSeparationClearance(separationId, clearanceId, "HR Manager")
    showToast("Exit Clearance Signed", "success", "Updated department sign-off status.")
  }

  const handleInitiateSeparation = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSep.employeeId || !newSep.reason) return

    const emp = employees.find((em) => em.id === newSep.employeeId)

    // Build a compatible separation record directly rather than relying on
    // hrStore's stale employee cache which uses the old schema.
    const sep = {
      id: `SEP-2026-${String(separations.length + 1).padStart(2, "0")}`,
      employeeId: newSep.employeeId,
      employeeName: emp?.full_name ?? "Employee",
      department: emp?.warehouse_id ?? "General",
      role: emp?.employment_type ?? "Staff",
      resignationDate: newSep.resignationDate,
      exitDate: newSep.exitDate,
      reason: newSep.reason,
      status: "Clearance Pending" as const,
      clearances: [
        { id: "C1", department: "IT" as const, cleared: false },
        { id: "C2", department: "Finance" as const, cleared: false },
        { id: "C3", department: "HR" as const, cleared: false },
        { id: "C4", department: "Department Head" as const, cleared: false },
      ],
      finalSettlementAmount: emp ? Number(emp.basic_salary) * 1.5 : 50000,
      settlementPaid: false,
    }

    // Directly push into store separations (hrStore handles persistence)
    store.initiateSeparationRecord(sep)

    showToast("Separation Initiated", "warning", "Created multi-department clearance workflow.")
    setShowInitiateSepModal(false)
    setNewSep({
      employeeId: "",
      resignationDate: new Date().toISOString().split("T")[0],
      exitDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      reason: "",
    })
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Header Block */}
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight mt-1">Onboarding & Separation</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Manage new hire IT/HR checklists and offboarding exit clearance workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/hr")} />
          </div>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div variants={fade} className="flex items-center justify-between border-b border-zinc-200/60 mb-6 pb-2">
          <div className="flex gap-2">
            {[
              { id: "Onboarding", label: `Employee Onboarding (${onboardings.length})` },
              { id: "Separation", label: `Exit Clearances (${separations.length})` },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="px-4 py-2 text-xs font-black relative tracking-tight transition-colors uppercase"
                >
                  <span className={isActive ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-700"}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="onb-sep-tabs"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-700"
                    />
                  )}
                </button>
              )
            })}
          </div>

          {activeTab === "Separation" && (
            <button
              onClick={() => setShowInitiateSepModal(true)}
              className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white rounded-full h-[38px] px-4 text-xs font-bold shadow-sm transition-all active:scale-95"
            >
              <UserMinus className="size-3.5" />
              <span>Initiate Separation</span>
            </button>
          )}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "Onboarding" && (
            <motion.div
              key="onboarding-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {onboardings.map((onb) => {
                const completedCount = onb.tasks.filter((t) => t.completed).length
                const progressPct = Math.round((completedCount / onb.tasks.length) * 100)

                return (
                  <GlassCard key={onb.id} className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-zinc-900">{onb.employeeName}</h3>
                          <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            onb.status === "Completed" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}>
                            {onb.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-green-700 mt-0.5">{onb.role} • {onb.department} Department</p>
                      </div>

                      <div className="w-full md:w-64">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="text-zinc-500">Onboarding Completion</span>
                          <span className="text-zinc-900">{progressPct}%</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-700 transition-all duration-300" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Task Checklist Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      {onb.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTask(onb.id, task.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                            task.completed ? "bg-emerald-50/50 border-emerald-200 text-emerald-950" : "bg-zinc-50/50 border-zinc-200 hover:border-zinc-300 text-zinc-900"
                          }`}
                        >
                          <div className={`mt-0.5 size-5 rounded-full border flex items-center justify-center shrink-0 ${
                            task.completed ? "bg-emerald-700 border-emerald-700 text-white" : "border-zinc-300 bg-white"
                          }`}>
                            {task.completed && <CheckCircle2 className="size-3.5" />}
                          </div>

                          <div className="flex-1">
                            <p className={`text-xs font-bold ${task.completed ? "line-through text-zinc-500" : "text-zinc-900"}`}>{task.title}</p>
                            <span className="text-[10px] text-zinc-400 font-mono">Category: {task.category} • Assigned: {task.assignedTo}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )
              })}
            </motion.div>
          )}

          {activeTab === "Separation" && (
            <motion.div
              key="separation-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {separations.map((sep) => {
                const allCleared = sep.clearances.every((c) => c.cleared)

                return (
                  <GlassCard key={sep.id} className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-zinc-900">{sep.employeeName}</h3>
                          <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            allCleared ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}>
                            {sep.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-zinc-500 mt-0.5">{sep.role} ({sep.department}) • Resigned: {sep.resignationDate} • Exit: {sep.exitDate}</p>
                        <p className="text-xs text-zinc-600 mt-2 font-medium italic">"{sep.reason}"</p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 block font-bold uppercase">Estimated Final Settlement</span>
                        <span className="text-lg font-black text-zinc-900 font-mono">ETB {sep.finalSettlementAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Department Clearances */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      {sep.clearances.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleToggleClearance(sep.id, c.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                            c.cleared ? "bg-emerald-50/50 border-emerald-200 text-emerald-950" : "bg-zinc-50/50 border-zinc-200 hover:border-zinc-300 text-zinc-900"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black">{c.department} Dept</span>
                            {c.cleared ? <ShieldCheck className="size-4 text-emerald-700" /> : <AlertCircle className="size-4 text-amber-500" />}
                          </div>

                          <p className="text-[10px] text-zinc-500 font-mono mt-2">
                            {c.cleared ? `Cleared by ${c.clearedBy || "Admin"}` : "Pending Clearance"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Initiate Separation Modal */}
      {showInitiateSepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-white/95 backdrop-blur-lg border border-black/10 rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowInitiateSepModal(false)} className="absolute right-5 top-5 p-1 text-gray-400 hover:text-black rounded-lg">
              <X className="size-5" />
            </button>
            <h3 className="text-xl font-black text-black tracking-tight mb-4">Initiate Employee Exit Clearance</h3>
            <form onSubmit={handleInitiateSeparation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Select Employee</label>
                <select value={newSep.employeeId} onChange={(e) => setNewSep({ ...newSep, employeeId: e.target.value })} className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none">
                  {employees.length === 0 && <option value="">Loading employees...</option>}
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.employment_type} - {e.warehouse_id})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Resignation Date</label>
                  <input required type="date" value={newSep.resignationDate} onChange={(e) => setNewSep({ ...newSep, resignationDate: e.target.value })} className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Exit Date</label>
                  <input required type="date" value={newSep.exitDate} onChange={(e) => setNewSep({ ...newSep, exitDate: e.target.value })} className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Reason for Separation</label>
                <textarea required rows={3} value={newSep.reason} onChange={(e) => setNewSep({ ...newSep, reason: e.target.value })} placeholder="Details regarding exit..." className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowInitiateSepModal(false)} className="flex-1 border border-black/10 text-black hover:bg-black/5 rounded-2xl py-3 text-sm font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-red-700 text-white hover:bg-red-800 rounded-2xl py-3 text-sm font-bold shadow-md">Initiate Clearance</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
