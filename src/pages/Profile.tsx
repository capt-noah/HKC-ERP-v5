import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import {
  User,
  ShieldCheck,
  Check,
  LogOut,
  Briefcase,
  Mail,
  Calendar,
  Lock,
  Loader2,
  ArrowLeft,
  BadgeCheck,
  Sparkles,
  Warehouse,
  Eye,
  EyeOff,
  KeyRound,
  X,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { GlassCard } from "@/components/GlassCard"
import { useAuthStore, type Role } from "@/lib/authStore"
import { useErpStore, type Warehouse as WarehouseType } from "@/lib/erpStore"
import { useFeedback } from "@/context/FeedbackContext"
import { loadResource, API_BASE } from "@/lib/apiPersistence"
import { cn } from "@/lib/utils"

interface PasswordStrength {
  score: number
  label: "Weak" | "Medium" | "Strong"
  color: string
  width: string
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "Weak", color: "bg-red-500", width: "0%" }
  }

  const hasLength = password.length >= 10
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)

  const passedCriteria = [hasLength, hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length

  // All 5 criteria (length >= 10, lower, upper, number, special symbol) MUST be met for Strong / Green
  if (hasLength && hasLower && hasUpper && hasNumber && hasSpecial) {
    return { score: 5, label: "Strong", color: "bg-green-600", width: "100%" }
  }

  if (passedCriteria >= 3) {
    return { score: passedCriteria, label: "Medium", color: "bg-yellow-500", width: `${passedCriteria * 20}%` }
  }

  return { score: passedCriteria, label: "Weak", color: "bg-red-500", width: `${Math.max(passedCriteria * 20, 20)}%` }
}

interface UserAccount {
  id: string
  username: string
  fullname: string
  roles: Role[]
  status: "active" | "suspended"
  warehouse_ids?: string[]
  warehouse_id?: string | null
  employee_id?: string | null
  created_at?: string
  updated_at?: string
}

interface LinkedEmployee {
  id: string
  employee_number?: string
  full_name: string
  email?: string
  phone?: string
  department?: string
  designation?: string
  date_of_joining?: string
  employment_type?: string
  status?: string
}

const roleDescriptions: Record<Role, { title: string; desc: string; color: string; capabilities: string[] }> = {
  superadmin: {
    title: "Super Administrator",
    desc: "Complete system governance, role access management, database integrity, and system-wide configuration.",
    color: "bg-emerald-900/10 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200",
    capabilities: [
      "Full Control Center Access",
      "User Accounts & Permissions",
      "Business Partners Registry",
      "System Settings & Auditing",
      "Cross-Module Oversight (Sales, Inventory, Finance, HR)",
    ],
  },
  sales_manager: {
    title: "Sales",
    desc: "Manages the entire sales pipeline from orders and quotations to warehouse dispatch and client shipments.",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    capabilities: [
      "Sales Order Processing & Contract Creation",
      "Purchase Orders Management",
      "Sales Issuance & Warehouse Picking Lists",
      "Customer Invoicing & Credit Attachments",
      "Client Registry & Ledger Verification",
    ],
  },
  inventory_admin: {
    title: "Inventory",
    desc: "Oversees multi-location stock movements, bin cards, batch tracking, and commodity transfers.",
    color: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300",
    capabilities: [
      "Multi-Warehouse Stock Ledger & Bin Cards",
      "Goods Receiving & Batch Tracking",
      "Inter-Store Stock Transfers",
      "Toll Processing Goods & Dispatches",
      "Stock Valuation & Reorder Alerts",
    ],
  },
  finance_manager: {
    title: "Finance",
    desc: "Maintains financial compliance, chart of accounts, journal entries, tax filings, and ledger reports.",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    capabilities: [
      "General Ledger & Journal Entries",
      "Chart of Accounts Management",
      "Invoice Billing & Payment Receipts",
      "Banking & Petty Cash Reconciliation",
      "Financial Statements & Peachtree Exports",
    ],
  },
  hr_manager: {
    title: "HR",
    desc: "Administers employee records, monthly payroll calculations, attendance tracking, and leave workflows.",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    capabilities: [
      "Employee Directory & Personnel Files",
      "Monthly Payroll Generation & Payslips",
      "Daily Attendance Tracking",
      "Leave Requests & Approvals",
      "Onboarding & Separation Workflows",
    ],
  },
  hkc_docs_manager: {
    title: "HKC Export Docs",
    desc: "Compiles specialized export/import documentation, customs clearances, and regulatory certificates.",
    color: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300",
    capabilities: [
      "Customs Export & Import Dossiers",
      "Shipping Compliance Documentation",
      "Certificate of Origin Management",
      "Digital Document Archive & Attachments",
    ],
  },
}

export default function Profile() {
  const navigate = useNavigate()
  const erp = useErpStore()
  const { user: authUser, logout, token } = useAuthStore()
  const { showToast, confirm } = useFeedback()

  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<UserAccount | null>(null)
  const [linkedEmployee, setLinkedEmployee] = useState<LinkedEmployee | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState("")
  const [savingName, setSavingName] = useState(false)

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        if (!authUser?.id) return

        // 1. Fetch user's own profile safely via /api/auth/me
        let current: any = authUser
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token || useAuthStore.getState().token}`,
            },
          })
          if (res.ok) {
            const data = await res.json()
            if (data?.id) current = data
          }
        } catch (err) {
          console.warn("Could not load /api/auth/me, using stored auth state:", err)
        }

        setProfileData(current)
        setNewName(current.fullname || authUser.fullname || "")

        // 2. Fetch linked employee details if employee_id is set
        if (current.employee_id) {
          try {
            const employees = await loadResource<LinkedEmployee>("employees")
            const emp = employees.find((e) => e.id === current.employee_id)
            if (emp) setLinkedEmployee(emp)
          } catch {}
        }

        // 3. Fetch warehouses from API for warehouse-operating roles
        try {
          const whData = await loadResource<WarehouseType>("warehouses")
          if (Array.isArray(whData) && whData.length > 0) {
            setWarehouses(whData)
          } else {
            setWarehouses(erp.getWarehouses())
          }
        } catch {
          setWarehouses(erp.getWarehouses())
        }
      } catch (err) {
        console.error("Failed to load profile:", err)
      } finally {
        setTimeout(() => setLoading(false), 200)
      }
    }

    loadProfile()
  }, [authUser, token, erp])

  const userRoles: Role[] = profileData?.roles || authUser?.roles || []
  const isSuperAdmin = userRoles.includes("superadmin")

  // Check whether this user operates or is assigned to warehouses
  const hasWarehouseAccess =
    isSuperAdmin ||
    userRoles.includes("inventory_admin") ||
    Boolean(profileData?.warehouse_id) ||
    Boolean(profileData?.warehouse_ids && profileData.warehouse_ids.length > 0) ||
    Boolean((authUser as any)?.warehouse_id) ||
    Boolean(authUser?.warehouse_ids && authUser.warehouse_ids.length > 0)

  // Filter the operational warehouses specifically relevant for this user
  const userAssignedWarehouses = useMemo(() => {
    const fallbackWarehouses: WarehouseType[] = [
      { id: "WH1", code: "WH1-AGRI-EXP", name: "WH1 - Ethiopia Agricultural Export Hub", type: "Export Hub", status: "Active", manager: "Abebe Kasahun", location: "Modjo Export Terminal, Ethiopia", targetMarkets: "Europe, Asia, USA", specialization: "Agricultural Commodities" },
      { id: "WH2", code: "WH2-VET-IND", name: "WH2 - Veterinary Import Hub (India)", type: "Import & Distribution Hub", status: "Active", manager: "Sintayehu Kebede", location: "Kaliti Industrial Zone, Addis Ababa, Ethiopia", targetMarkets: "Ethiopian Dairy Farms, Pastoralist Cooperatives", specialization: "Veterinary Pharmaceuticals & Livestock Injectables" },
      { id: "WH3", code: "WH3-VET-CHN", name: "WH3 - Veterinary Import Hub (China)", type: "Import & Distribution Hub", status: "Active", manager: "Tigist Haile", location: "Bishoftu Vet Park, Oromia, Ethiopia", targetMarkets: "Poultry Farms, Veterinary Clinics", specialization: "Veterinary Soluble Powders & Vaccines" }
    ]

    const sourceWarehouses = warehouses && warehouses.length > 0 ? warehouses : fallbackWarehouses

    if (isSuperAdmin) {
      return sourceWarehouses
    }

    const rawIds = (profileData?.warehouse_ids || authUser?.warehouse_ids || []).concat(
      profileData?.warehouse_id || (authUser as any)?.warehouse_id ? [profileData?.warehouse_id || (authUser as any)?.warehouse_id] : []
    ).filter(Boolean)

    if (rawIds.length > 0) {
      const matches = sourceWarehouses.filter((w) => {
        return rawIds.some((uid) => {
          const u = String(uid).toUpperCase().trim()
          const wid = String(w.id || "").toUpperCase().trim()
          const wcode = String(w.code || "").toUpperCase().trim()
          return wid === u || wcode === u || wcode.includes(u) || u.includes(wid)
        })
      })
      if (matches.length > 0) return matches
    }

    // Default for inventory administrator without explicit warehouse restriction: all facility locations
    if (userRoles.includes("inventory_admin")) {
      return sourceWarehouses
    }

    return []
  }, [warehouses, isSuperAdmin, profileData, authUser, userRoles])


  const handleSaveName = async () => {
    if (!newName.trim()) return
    setSavingName(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || useAuthStore.getState().token}`,
        },
        body: JSON.stringify({ fullname: newName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update name.")
      }

      setProfileData((prev) => (prev ? { ...prev, fullname: newName.trim() } : null))
      setIsEditingName(false)
      showToast("Display name updated.", "success")
    } catch (err: any) {
      showToast(err?.message || "Failed to update name.", "warning")
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword.trim()) {
      showToast("Current Password Required", "warning", "Please enter your current account password.")
      return
    }
    if (newPassword.length < 10) {
      showToast("Password Too Short", "warning", "New password must be at least 10 characters long.")
      return
    }
    const strength = getPasswordStrength(newPassword)
    if (strength.label !== "Strong") {
      showToast("Weak Password", "warning", "Password must be strong. Add uppercase, lowercase, numbers, and special symbols (min 10 chars).")
      return
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords Mismatch", "warning", "New password and confirm password do not match.")
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || useAuthStore.getState().token}`,
        },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.")
      }

      showToast("Password Updated Successfully", "success", "Your new password has been securely saved to the database.")
      setShowPasswordModal(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setShowCurrentPassword(false)
      setShowNewPassword(false)
    } catch (err: any) {
      showToast("Password Update Failed", "warning", err.message || "Could not change password.")
    } finally {
      setSavingPassword(false)
    }
  }

  const handleLogoutConfirm = () => {
    confirm({
      title: "Log Out",
      message: "Are you sure you want to log out of your session?",
      confirmLabel: "Log Out",
      cancelLabel: "Stay Logged In",
      isDestructive: true,
      onConfirm: () => {
        logout()
        navigate("/login")
      },
    })
  }

  const userInitials = (profileData?.fullname || authUser?.fullname || profileData?.username || "HK")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  // Collect all unique capabilities across user's assigned roles
  const allCapabilities = Array.from(
    new Set(userRoles.flatMap((r) => roleDescriptions[r]?.capabilities || []))
  )

  return (
    <div className="min-h-screen page-gradient select-none font-sans text-zinc-900 dark:text-zinc-100 relative pb-20">
      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-8 md:pt-10">
        {/* Stylized Glass Back Button */}
        <div className="mb-6 flex items-center justify-start">
          <button
            onClick={() => navigate(-1)}
            className="h-10 px-4 rounded-2xl bg-white/80 hover:bg-white border border-white/90 shadow-sm shadow-emerald-950/5 hover:shadow-md text-xs font-bold text-zinc-800 hover:text-emerald-800 flex items-center gap-2.5 transition-all duration-200 active:scale-95 cursor-pointer backdrop-blur-md group"
          >
            <ArrowLeft className="size-4 text-emerald-700 group-hover:-translate-x-1 transition-transform" />
            <span>Back</span>
          </button>
        </div>

        {loading ? (
          /* ========================================================================= */
          /* LOADING SKELETON STATE                                                    */
          /* ========================================================================= */
          <div className="space-y-6 animate-pulse">
            {/* Hero Card Skeleton */}
            <div className="p-8 rounded-3xl bg-white/70 border border-white/80 shadow-md">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="size-24 rounded-3xl bg-zinc-200/80 shrink-0" />
                <div className="flex-1 space-y-3 w-full text-center sm:text-left">
                  <div className="h-7 bg-zinc-200/80 rounded-xl w-48 mx-auto sm:mx-0" />
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                    <div className="h-6 bg-zinc-200/60 rounded-full w-24" />
                    <div className="h-6 bg-zinc-200/60 rounded-full w-32" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-10 w-28 bg-zinc-200/80 rounded-xl" />
                  <div className="h-10 w-28 bg-zinc-200/80 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Grid Skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-white/70 border border-white/80 shadow-md space-y-4">
                <div className="h-5 bg-zinc-200/80 rounded-lg w-36" />
                <div className="space-y-3 pt-2">
                  <div className="h-10 bg-zinc-100 rounded-xl" />
                  <div className="h-10 bg-zinc-100 rounded-xl" />
                </div>
              </div>
              <div className="p-6 rounded-3xl bg-white/70 border border-white/80 shadow-md space-y-4">
                <div className="h-5 bg-zinc-200/80 rounded-lg w-40" />
                <div className="space-y-3 pt-2">
                  <div className="h-16 bg-zinc-100 rounded-xl" />
                  <div className="h-16 bg-zinc-100 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* LOADED PROFILE CONTENT                                                    */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* 1. Profile Hero Glass Card */}
            <GlassCard className="p-6 md:p-8 rounded-3xl border border-white/80 shadow-xl bg-white/75 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                {/* Avatar with emerald gradient ring */}
                <div className="relative group shrink-0">
                  <div className="size-22 md:size-24 rounded-3xl bg-gradient-to-tr from-emerald-800 via-emerald-700 to-emerald-500 text-white font-black text-2xl md:text-3xl flex items-center justify-center shadow-lg shadow-emerald-950/15 border-2 border-white">
                    {userInitials}
                  </div>
                </div>

                {/* Name & Role Badges */}
                <div className="flex-1 text-center sm:text-left space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-emerald-500 bg-white text-base font-bold focus:outline-none ring-2 ring-emerald-500/20"
                          placeholder="Your Full Name"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={savingName}
                          className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-all cursor-pointer"
                        >
                          {savingName ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-950">
                          {profileData?.fullname || authUser?.fullname || "HKC System User"}
                        </h1>
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 hover:bg-emerald-100 transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Role Tags */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5">
                    {userRoles.map((role) => (
                      <span
                        key={role}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border shadow-2xs",
                          roleDescriptions[role]?.color || "bg-emerald-50 text-emerald-800 border-emerald-200"
                        )}
                      >
                        {roleDescriptions[role]?.title || role}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-600 text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Lock className="size-4" />
                    <span>Change Password</span>
                  </button>
                  <button
                    onClick={handleLogoutConfirm}
                    className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* 2. Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Account Details & Linked Employee */}
              <div className="space-y-6 lg:col-span-1">
                {/* Account Details Card */}
                <GlassCard className="p-6 rounded-3xl border border-white/80 shadow-md bg-white/75">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                      <User className="size-4 text-emerald-700" />
                      <span>Account Profile</span>
                    </h3>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/70 hover:bg-emerald-100 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock className="size-3" />
                      <span>Change Password</span>
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-zinc-400 font-bold uppercase text-[10px] block mb-0.5">Username</span>
                      <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 font-bold text-zinc-800">
                        {profileData?.username || authUser?.username}
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400 font-bold uppercase text-[10px] block mb-0.5">Account Status</span>
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                        <Check className="size-3.5 text-emerald-600" />
                        <span>Active Account</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400 font-bold uppercase text-[10px] block mb-0.5">Account Created</span>
                      <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-zinc-700 font-medium flex items-center gap-2">
                        <Calendar className="size-3.5 text-zinc-400" />
                        <span>{profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString() : "System Default"}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Linked Employee Information (if available) */}
                {linkedEmployee && (
                  <GlassCard className="p-6 rounded-3xl border border-white/80 shadow-md bg-white/75">
                    <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Briefcase className="size-4 text-emerald-700" />
                      <span>HR Record Details</span>
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-zinc-400 font-bold uppercase text-[10px] block mb-0.5">Employee ID</span>
                        <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 font-mono font-bold text-zinc-800">
                          {linkedEmployee.employee_number || linkedEmployee.id.slice(0, 8)}
                        </div>
                      </div>

                      {linkedEmployee.designation && (
                        <div>
                          <span className="text-zinc-400 font-bold uppercase text-[10px] block mb-0.5">Designation</span>
                          <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 font-bold text-zinc-800">
                            {linkedEmployee.designation}
                          </div>
                        </div>
                      )}

                      {linkedEmployee.department && (
                        <div>
                          <span className="text-zinc-400 font-bold uppercase text-[10px] block mb-0.5">Department</span>
                          <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 font-bold text-zinc-800">
                            {linkedEmployee.department}
                          </div>
                        </div>
                      )}

                      {linkedEmployee.email && (
                        <div>
                          <span className="text-zinc-400 font-bold uppercase text-[10px] block mb-0.5">Work Email</span>
                          <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-zinc-700 flex items-center gap-2">
                            <Mail className="size-3.5 text-zinc-400" />
                            <span>{linkedEmployee.email}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                )}
              </div>

              {/* Right Column: Roles, Permissions, Capabilities & Conditional Warehouses */}
              <div className="space-y-6 lg:col-span-2">
                {/* System Roles & Scope Card */}
                <GlassCard className="p-6 rounded-3xl border border-white/80 shadow-md bg-white/75">
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-700" />
                    <span>Assigned Security Roles & Scope</span>
                  </h3>

                  <div className="space-y-3">
                    {userRoles.map((role) => {
                      const info = roleDescriptions[role] || {
                        title: role,
                        desc: "Standard access rights.",
                        color: "bg-emerald-50 text-emerald-800 border-emerald-200",
                      }
                      return (
                        <div
                          key={role}
                          className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider border", info.color)}>
                                {info.title}
                              </span>
                              {role === "superadmin" && (
                                <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                                  Full Root Permissions
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 max-w-lg leading-relaxed pt-1">
                              {info.desc}
                            </p>
                          </div>
                          <BadgeCheck className="size-5 text-emerald-600 shrink-0 hidden sm:block" />
                        </div>
                      )
                    })}
                  </div>

                  {/* Module Access Matrix */}
                  <div className="mt-6 border-t border-zinc-100 pt-5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
                      Module Access Permissions
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      {[
                        { label: "Sales & Orders", allowed: isSuperAdmin || userRoles.includes("sales_manager") },
                        { label: "Inventory & Stocks", allowed: isSuperAdmin || userRoles.includes("inventory_admin") },
                        { label: "Finance & Ledger", allowed: isSuperAdmin || userRoles.includes("finance_manager") },
                        { label: "HR & Payroll", allowed: isSuperAdmin || userRoles.includes("hr_manager") },
                        { label: "HKC Export Docs", allowed: isSuperAdmin || userRoles.includes("hkc_docs_manager") },
                        { label: "Admin Control Center", allowed: isSuperAdmin },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={cn(
                            "p-3 rounded-xl border flex items-center justify-between transition-all",
                            item.allowed
                              ? "bg-emerald-50/60 border-emerald-200 text-emerald-900 font-bold"
                              : "bg-zinc-50 border-zinc-200/60 text-zinc-400 font-medium opacity-60"
                          )}
                        >
                          <span>{item.label}</span>
                          {item.allowed ? (
                            <Check className="size-4 text-emerald-600" />
                          ) : (
                            <Lock className="size-3.5 text-zinc-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* Conditional Operational Warehouses Card (ONLY for users who operate or are assigned to warehouses) */}
                {hasWarehouseAccess && (
                  <GlassCard className="p-6 rounded-3xl border border-white/80 shadow-md bg-white/75">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                        <Warehouse className="size-4 text-emerald-700" />
                        <span>Operational Warehouses</span>
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {isSuperAdmin ? `All Facilities (${userAssignedWarehouses.length})` : `Assigned Facilities (${userAssignedWarehouses.length})`}
                      </span>
                    </div>

                    {userAssignedWarehouses.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {userAssignedWarehouses.map((wh) => (
                          <div
                            key={wh.id || wh.code}
                            className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex flex-col justify-between gap-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                                  <Warehouse className="size-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-zinc-900">{wh.name}</h4>
                                  <span className="text-[10px] font-mono font-bold text-emerald-700">Code: {wh.code || wh.id}</span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                                {wh.status || "Active"}
                              </span>
                            </div>

                            {(wh.location || wh.specialization || wh.type) && (
                              <div className="pt-2 border-t border-zinc-100 text-[11px] text-zinc-500 space-y-0.5">
                                {wh.location && <p className="truncate font-medium">📍 {wh.location}</p>}
                                {wh.specialization && <p className="truncate text-zinc-400">🏷️ {wh.specialization}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                        No specific warehouse assigned. Contact an administrator to allocate stock locations.
                      </div>
                    )}
                  </GlassCard>
                )}

                {/* Role Capabilities Overview Card */}
                <GlassCard className="p-6 rounded-3xl border border-white/80 shadow-md bg-white/75">
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-700" />
                    <span>Authorized Operations & Capabilities</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {allCapabilities.map((cap) => (
                      <div
                        key={cap}
                        className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center gap-2.5 text-xs"
                      >
                        <span className="size-2 rounded-full bg-emerald-600 shrink-0" />
                        <span className="font-bold text-zinc-800">{cap}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* CHANGE PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white/95 dark:bg-zinc-900/95 border border-white/80 shadow-2xl backdrop-blur-xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-black/5">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/70 shadow-2xs">
                  <KeyRound className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-950 dark:text-white">Change Password</h3>
                  <p className="text-[11px] font-bold text-zinc-500">Update your account login credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false)
                  setCurrentPassword("")
                  setNewPassword("")
                  setConfirmPassword("")
                }}
                className="p-1.5 rounded-full hover:bg-black/5 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 pt-4">
              {/* Current Password */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-4 pr-11 py-3 text-xs font-semibold text-black dark:text-white outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 10 characters"
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-4 pr-11 py-3 text-xs font-semibold text-black dark:text-white outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-xs font-semibold text-black dark:text-white outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
              </div>

              {/* Password Strength Progress Bar */}
              {newPassword && (
                <div className="space-y-1.5 px-0.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                    <span className="text-zinc-500">Password Strength</span>
                    <span className={
                      getPasswordStrength(newPassword).label === "Weak" ? "text-red-500" :
                      getPasswordStrength(newPassword).label === "Medium" ? "text-yellow-600" : "text-emerald-700"
                    }>
                      {getPasswordStrength(newPassword).label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-black/[0.05] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-300", getPasswordStrength(newPassword).color)}
                      style={{ width: getPasswordStrength(newPassword).width }}
                    />
                  </div>
                  {getPasswordStrength(newPassword).label !== "Strong" && (
                    <p className="text-[10px] font-semibold text-red-500 leading-normal">
                      Password must be strong. Add uppercase, lowercase, numbers, and special symbols (min 10 chars).
                    </p>
                  )}
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                  }}
                  className="px-4 py-2.5 rounded-2xl border border-black/10 text-xs font-bold text-zinc-700 hover:bg-black/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword || (newPassword !== "" && getPasswordStrength(newPassword).label !== "Strong")}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-950/10 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {savingPassword ? <Loader2 className="size-4 animate-spin" /> : "Update Password"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
