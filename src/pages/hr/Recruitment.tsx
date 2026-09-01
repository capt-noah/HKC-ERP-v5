import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, 
  Plus, 
  X, 
  Star, 
  UserPlus
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useHRStore } from "@/lib/hrStore"
import { hrApi, makeId } from "@/lib/hrApi"
import { useFeedback } from "@/context/FeedbackContext"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

export default function Recruitment() {
  const { showToast } = useFeedback()
  const store = useHRStore()

  const openings = store.getJobOpenings()
  const applicants = store.getJobApplicants()

  const [activeTab, setActiveTab] = useState<"Openings" | "Applicants">("Openings")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDept, setSelectedDept] = useState("All")

  // Modals
  const [showAddOpeningModal, setShowAddOpeningModal] = useState(false)
  const [showAddApplicantModal, setShowAddApplicantModal] = useState(false)

  // New Job Opening State
  const [newOpening, setNewOpening] = useState({
    title: "",
    department: "Tech",
    designation: "Senior Frontend Engineer",
    vacancies: "1",
    location: "Addis Ababa HQ",
    type: "Full-Time" as const,
    description: "",
  })

  // New Job Applicant State
  const [newApplicant, setNewApplicant] = useState({
    jobOpeningId: openings[0]?.id || "",
    jobTitle: openings[0]?.title || "",
    applicantName: "",
    email: "",
    phone: "",
    rating: 3,
    notes: "",
  })

  const departments = ["All", ...Array.from(new Set(openings.map((o) => o.department)))]

  const filteredOpenings = openings.filter((o) => {
    const matchesSearch = o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = selectedDept === "All" || o.department === selectedDept
    return matchesSearch && matchesDept
  })

  const filteredApplicants = applicants.filter((a) => {
    return a.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           a.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
           a.email.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleCreateOpening = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOpening.title || !newOpening.description) return

    store.addJobOpening({
      title: newOpening.title,
      department: newOpening.department,
      designation: newOpening.designation,
      vacancies: parseInt(newOpening.vacancies, 10) || 1,
      location: newOpening.location,
      type: newOpening.type,
      description: newOpening.description,
    })

    showToast("Job Opening Created", "success", `Published opening for ${newOpening.title}.`)
    setShowAddOpeningModal(false)
    setNewOpening({
      title: "",
      department: "Tech",
      designation: "Senior Frontend Engineer",
      vacancies: "1",
      location: "Addis Ababa HQ",
      type: "Full-Time",
      description: "",
    })
  }

  const handleCreateApplicant = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newApplicant.applicantName || !newApplicant.email) return

    const targetJob = openings.find((o) => o.id === newApplicant.jobOpeningId)

    store.addApplicant({
      jobOpeningId: newApplicant.jobOpeningId,
      jobTitle: targetJob ? targetJob.title : newApplicant.jobTitle,
      applicantName: newApplicant.applicantName,
      email: newApplicant.email,
      phone: newApplicant.phone,
      rating: newApplicant.rating,
      notes: newApplicant.notes,
    })

    showToast("Applicant Logged", "success", `Registered ${newApplicant.applicantName} for recruitment review.`)
    setShowAddApplicantModal(false)
    setNewApplicant({
      jobOpeningId: openings[0]?.id || "",
      jobTitle: openings[0]?.title || "",
      applicantName: "",
      email: "",
      phone: "",
      rating: 3,
      notes: "",
    })
  }

  const handleStageChange = async (applicantId: string, stage: any) => {
    store.updateApplicantStage(applicantId, stage)
    if (stage === "Hired") {
      const app = store.getJobApplicants().find((a) => a.id === applicantId)
      const job = app ? store.getJobOpenings().find((j) => j.id === app.jobOpeningId) : null
      if (app) {
        try {
          const id = makeId("EMP")
          await hrApi.createEmployee({
            id,
            employee_number: id,
            full_name: app.applicantName,
            phone: app.phone || "",
            email: app.email || "",
            address: "",
            date_of_birth: "",
            gender: "",
            warehouse_id: "Not Assigned",
            employment_type: "Probation",
            start_date: new Date().toISOString().split("T")[0],
            basic_salary: 0,
            payment_method: "",
            bank_account: "",
            emergency_contact_name: "",
            emergency_contact_phone: "",
            national_id_image: "",
            status: "Active",
          })
          showToast(
            "Candidate Hired!",
            "success",
            `Employee profile for ${app.applicantName} created for ${job?.title || "position"} via hrApi. Onboarding process launched.`
          )
        } catch (err) {
          showToast(
            "Employee Save Failed",
            "warning",
            err instanceof Error ? err.message : "Applicant stage updated but employee record could not be saved."
          )
        }
      }
    } else {
      showToast("Applicant Stage Updated", "info", `Moved applicant stage to ${stage}.`)
    }
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Header Block */}
        <motion.div variants={fade} className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight mt-1">Recruitment & Hiring</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Open position requisitions, applicant stages, interview scheduling, and hiring pipeline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/hr")} />
          </div>
        </motion.div>

        {/* Tab Switcher & Controls */}
        <motion.div variants={fade} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200/60 mb-6 pb-2 gap-4">
          <div className="flex gap-2">
            {[
              { id: "Openings", label: `Job Openings (${openings.length})` },
              { id: "Applicants", label: `Candidates Pipeline (${applicants.length})` },
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
                      layoutId="recruitment-tabs"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-700"
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-[38px] px-3.5 rounded-full glass-nav hover:bg-white/50 text-xs font-semibold text-black outline-none border-none cursor-pointer"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <div className="relative flex items-center h-[38px] px-3.5 rounded-full glass-nav hover:bg-white/50 focus-within:bg-white/80 transition-all w-48">
              <Search className="size-3.5 text-gray-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent border-none text-xs font-semibold text-black outline-none w-full"
              />
            </div>

            {activeTab === "Openings" && (
              <button
                onClick={() => setShowAddOpeningModal(true)}
                className="flex items-center gap-1.5 bg-black hover:bg-zinc-800 text-white rounded-full h-[38px] px-4 text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus className="size-3.5" />
                <span>New Job Opening</span>
              </button>
            )}

            {activeTab === "Applicants" && (
              <button
                onClick={() => setShowAddApplicantModal(true)}
                className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white rounded-full h-[38px] px-4 text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
              >
                <UserPlus className="size-3.5" />
                <span>Add Candidate</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "Openings" && (
            <motion.div
              key="openings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filteredOpenings.map((job) => {
                const jobApps = applicants.filter((a) => a.jobOpeningId === job.id)
                return (
                  <GlassCard key={job.id} className="p-6 flex flex-col justify-between" whileHover={{ y: -2 }}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold text-zinc-400">{job.id}</span>
                        <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          job.status === "Open" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                        }`}>
                          {job.status}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-zinc-900 leading-snug">{job.title}</h3>
                      <p className="text-xs font-bold text-green-700 mt-1">{job.department} Department • {job.location}</p>

                      <p className="text-xs text-zinc-600 line-clamp-2 mt-3 leading-relaxed">
                        {job.description}
                      </p>
                    </div>

                    <div className="border-t border-zinc-100 pt-4 mt-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Vacancies</span>
                        <span className="text-sm font-black text-zinc-900">{job.vacancies} Positions</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Applicants</span>
                        <span className="text-sm font-black text-green-700">{jobApps.length} Candidates</span>
                      </div>
                    </div>
                  </GlassCard>
                )
              })}
            </motion.div>
          )}

          {activeTab === "Applicants" && (
            <motion.div
              key="applicants-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <GlassCard className="p-0 overflow-hidden border border-black/5 shadow-xs">
                {/* Table Toolbar Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-black/[0.02] border-b border-black/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-black uppercase tracking-wider">Candidate Pipeline Directory</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-black/5 text-zinc-700 font-mono">
                      {filteredApplicants.length} Candidates
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">
                    Applicant evaluation stages and interview track
                  </p>
                </div>

                <div className="overflow-x-auto table-scrollbar-x" data-table-scroll>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-black/10 bg-black/[0.03] text-[11px] text-zinc-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Candidate & Contact</th>
                        <th className="py-3.5 px-4">Target Job Opening</th>
                        <th className="py-3.5 px-4">Rating</th>
                        <th className="py-3.5 px-4 text-center">Pipeline Stage</th>
                        <th className="py-3.5 px-4 text-right">Stage Advancement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 text-xs">
                      {filteredApplicants.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-zinc-400 font-medium">
                            No candidates found matching filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredApplicants.map((app) => (
                          <tr key={app.id} className="hover:bg-black/[0.02] transition-colors">
                            <td className="py-3.5 px-4">
                              <div>
                                <p className="text-xs font-bold text-black">{app.applicantName}</p>
                                <p className="text-[10px] text-zinc-400 font-mono font-semibold">{app.email} • {app.phone}</p>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/5 text-zinc-900">
                                {app.jobTitle}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1 text-amber-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`size-3.5 ${i < app.rating ? "fill-amber-400 text-amber-400" : "text-zinc-200"}`} />
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex justify-center">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                  app.stage === "Hired" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                                  app.stage === "Offered" ? "bg-blue-50 text-blue-800 border-blue-200" :
                                  app.stage === "Interview" ? "bg-purple-50 text-purple-800 border-purple-200" :
                                  app.stage === "Rejected" ? "bg-rose-50 text-rose-800 border-rose-200" :
                                  "bg-zinc-100 text-zinc-700 border-zinc-200"
                                }`}>
                                  <span className={`size-1.5 rounded-full ${
                                    app.stage === "Hired" ? "bg-emerald-500" :
                                    app.stage === "Offered" ? "bg-blue-500" :
                                    app.stage === "Interview" ? "bg-purple-500" :
                                    app.stage === "Rejected" ? "bg-rose-500" : "bg-zinc-400"
                                  }`} />
                                  {app.stage}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1 overflow-x-auto">
                                {["Applied", "Screening", "Interview", "Offered", "Hired", "Rejected"].map((st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleStageChange(app.id, st as any)}
                                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-xl transition-all border cursor-pointer active:scale-95 shadow-2xs ${
                                      app.stage === st
                                        ? "bg-zinc-950 text-white border-zinc-950 shadow-xs"
                                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200/80"
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Add Opening Modal */}
      {showAddOpeningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-white/95 backdrop-blur-lg border border-black/10 rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowAddOpeningModal(false)} className="absolute right-5 top-5 p-1 text-gray-400 hover:text-black rounded-lg">
              <X className="size-5" />
            </button>
            <h3 className="text-xl font-black text-black tracking-tight mb-4">Create Job Opening</h3>
            <form onSubmit={handleCreateOpening} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Position Title</label>
                <input required type="text" value={newOpening.title} onChange={(e) => setNewOpening({ ...newOpening, title: e.target.value })} placeholder="e.g. Senior Trade Specialist" className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Department</label>
                  <select value={newOpening.department} onChange={(e) => setNewOpening({ ...newOpening, department: e.target.value })} className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none">
                    <option value="Tech">Tech</option>
                    <option value="Product">Product</option>
                    <option value="HR">HR</option>
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Vacancies</label>
                  <input required type="number" min="1" value={newOpening.vacancies} onChange={(e) => setNewOpening({ ...newOpening, vacancies: e.target.value })} className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Job Description</label>
                <textarea required rows={3} value={newOpening.description} onChange={(e) => setNewOpening({ ...newOpening, description: e.target.value })} placeholder="Responsibilities & skill requirements..." className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowAddOpeningModal(false)} className="flex-1 border border-black/10 text-black hover:bg-black/5 rounded-2xl py-3 text-sm font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-black text-white hover:bg-zinc-800 rounded-2xl py-3 text-sm font-bold shadow-md">Publish Opening</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAddApplicantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-white/95 backdrop-blur-lg border border-black/10 rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowAddApplicantModal(false)} className="absolute right-5 top-5 p-1 text-gray-400 hover:text-black rounded-lg">
              <X className="size-5" />
            </button>
            <h3 className="text-xl font-black text-black tracking-tight mb-4">Register Candidate Application</h3>
            <form onSubmit={handleCreateApplicant} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target Job Opening</label>
                <select value={newApplicant.jobOpeningId} onChange={(e) => setNewApplicant({ ...newApplicant, jobOpeningId: e.target.value })} className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none">
                  {openings.map((o) => (
                    <option key={o.id} value={o.id}>{o.title} ({o.department})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Candidate Full Name</label>
                <input required type="text" value={newApplicant.applicantName} onChange={(e) => setNewApplicant({ ...newApplicant, applicantName: e.target.value })} placeholder="e.g. Samuel Bekele" className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                  <input required type="email" value={newApplicant.email} onChange={(e) => setNewApplicant({ ...newApplicant, email: e.target.value })} placeholder="samuel@gmail.com" className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
                  <input required type="text" value={newApplicant.phone} onChange={(e) => setNewApplicant({ ...newApplicant, phone: e.target.value })} placeholder="+251 91 222 3344" className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none" />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowAddApplicantModal(false)} className="flex-1 border border-black/10 text-black hover:bg-black/5 rounded-2xl py-3 text-sm font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-green-700 text-white hover:bg-green-800 rounded-2xl py-3 text-sm font-bold shadow-md">Register Candidate</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
