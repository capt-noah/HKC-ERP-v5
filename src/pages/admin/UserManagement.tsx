import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Search, Plus, Filter, X, ShieldCheck, UserCheck, Trash2, Users, UserX, Edit, Eye, EyeOff } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { cn, sortNewestFirst } from "@/lib/utils"
import { useFeedback } from "@/context/FeedbackContext"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { Skeleton } from "@/components/ui/skeleton"
import { loadResource, updateResource, deleteResource, API_BASE } from "@/lib/apiPersistence"
import type { Role } from "@/lib/authStore"

export interface UserAccount {
  id: string
  username: string
  fullname: string
  roles: Role[]
  status: "active" | "suspended"
  warehouse_id?: string | null
  warehouse_ids?: string[]
  employee_id: string | null
  created_at?: string
  updated_at?: string
}

interface Warehouse {
  id: string
  name: string
  code: string
}

interface Employee {
  id: string
  full_name: string
  email: string
  status: string
}

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  sales_manager: "Sales Manager",
  hr_manager: "HR Manager",
  inventory_admin: "Inventory Admin",
  finance_manager: "Finance Manager",
  hkc_docs_manager: "HKC Docs Specialist",
}

const avatarBgPresets = [
  "bg-emerald-500/15 text-emerald-700 border border-emerald-500/20",
  "bg-blue-500/15 text-blue-700 border border-blue-500/20",
  "bg-amber-500/15 text-amber-700 border border-amber-500/20",
  "bg-purple-500/15 text-purple-700 border border-purple-500/20",
  "bg-rose-500/15 text-rose-700 border border-rose-500/20",
  "bg-cyan-500/15 text-cyan-700 border border-cyan-500/20",
]

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
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 10) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  const finalScore = Math.min(score, 5)

  if (password.length < 8 || finalScore <= 3) {
    return { score: finalScore, label: "Weak", color: "bg-red-500", width: "33%" }
  }
  if (password.length >= 8 && finalScore === 4) {
    return { score: finalScore, label: "Medium", color: "bg-yellow-500", width: "66%" }
  }
  return { score: finalScore, label: "Strong", color: "bg-green-600", width: "100%" }
}

function UserTableSkeleton() {
  return (
    <div className="overflow-x-auto animate-pulse">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
            <th className="py-4 px-4"><Skeleton className="h-3 w-20 bg-zinc-200/70 rounded-full" /></th>
            <th className="py-4 px-4"><Skeleton className="h-3 w-28 bg-zinc-200/70 rounded-full" /></th>
            <th className="py-4 px-4"><Skeleton className="h-3 w-32 bg-zinc-200/70 rounded-full" /></th>
            <th className="py-4 px-4 text-center"><Skeleton className="h-3 w-16 bg-zinc-200/70 rounded-full mx-auto" /></th>
            <th className="py-4 px-4 text-right"><Skeleton className="h-3 w-20 bg-zinc-200/70 rounded-full ml-auto" /></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {Array.from({ length: 6 }).map((_, idx) => (
            <tr key={idx} className="border-b border-zinc-100/60">
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-2xl bg-zinc-200/80 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32 bg-zinc-200/80 rounded-md" />
                    <Skeleton className="h-3 w-20 bg-zinc-150/60 rounded-md" />
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-24 bg-zinc-200/70 rounded-full" />
                  <Skeleton className="h-5 w-20 bg-zinc-200/70 rounded-full hidden sm:inline-block" />
                </div>
              </td>
              <td className="py-4 px-4">
                <Skeleton className="h-4 w-36 bg-zinc-200/70 rounded-md" />
              </td>
              <td className="py-4 px-4 text-center">
                <Skeleton className="h-6 w-20 bg-zinc-200/70 rounded-full mx-auto" />
              </td>
              <td className="py-4 px-4 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Skeleton className="h-7 w-20 bg-zinc-200/80 rounded-xl" />
                  <Skeleton className="h-7 w-16 bg-zinc-200/80 rounded-xl" />
                  <Skeleton className="h-7 w-16 bg-zinc-200/80 rounded-xl" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const { showToast, confirm } = useFeedback()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("All")
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // New user form state
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    fullname: "",
    roles: [] as Role[],
    status: "active" as UserAccount["status"],
    employee_id: "",
    warehouse_ids: [] as string[],
  })

  // Edit user form state
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [showEditingUserPassword, setShowEditingUserPassword] = useState(false)
  const [editPassword, setEditPassword] = useState("")

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [usersData, employeesData, warehousesData] = await Promise.all([
        loadResource<UserAccount>("users"),
        loadResource<any>("employees"),
        loadResource<any>("warehouses"),
      ])
      setUsers(sortNewestFirst(usersData))
      setEmployees(sortNewestFirst(employeesData))
      setWarehouses(sortNewestFirst(warehousesData))
    } catch (err: any) {
      console.error(err)
      showToast("Error loading user management data", "warning")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.username || !newUser.password || newUser.roles.length === 0) {
      showToast("Username, password, and at least one role are required.", "warning")
      return
    }

    const strength = getPasswordStrength(newUser.password)
    if (strength.label !== "Strong") {
      showToast("Password must be strong.", "warning")
      return
    }

    // Determine fullname from employee selection if linked
    let finalFullname = newUser.fullname
    if (newUser.employee_id) {
      const matchedEmp = employees.find(emp => emp.id === newUser.employee_id)
      if (matchedEmp) {
        finalFullname = matchedEmp.full_name
      }
    }

    setActionLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          roles: newUser.roles,
          status: newUser.status,
          fullname: finalFullname,
          employee_id: newUser.employee_id || null,
          warehouse_ids: newUser.roles.includes("inventory_admin") ? newUser.warehouse_ids : [],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create user account.")
      }

      showToast("User Created Successfully", "success", `${newUser.username} has been added.`)
      setShowAddModal(false)
      setShowNewUserPassword(false)
      // Reset form
      setNewUser({
        username: "",
        password: "",
        fullname: "",
        roles: [],
        status: "active",
        employee_id: "",
        warehouse_ids: [],
      })
      fetchAllData()
    } catch (err: any) {
      showToast(err.message, "warning")
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser || editingUser.roles.length === 0) {
      showToast("At least one role is required.", "warning")
      return
    }

    if (editPassword) {
      const strength = getPasswordStrength(editPassword)
      if (strength.label !== "Strong") {
        showToast("Password must be strong.", "warning")
        return
      }
    }

    setActionLoading(true)
    try {
      const updateData: any = {
        fullname: editingUser.fullname,
        roles: editingUser.roles,
        status: editingUser.status,
        employee_id: editingUser.employee_id || null,
        warehouse_ids: editingUser.roles.includes("inventory_admin") ? editingUser.warehouse_ids || [] : [],
      }
      if (editPassword) {
        updateData.password = editPassword
      }

      await updateResource<UserAccount>("users", editingUser.id, updateData)

      showToast("User Updated Successfully", "success", `${editingUser.username}'s settings have been saved.`)
      setShowEditModal(false)
      setEditingUser(null)
      setEditPassword("")
      setShowEditingUserPassword(false)
      fetchAllData()
    } catch (err: any) {
      showToast(err.message, "warning")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = (id: string, username: string) => {
    confirm({
      title: "Delete System Account",
      message: `Are you absolutely sure you want to permanently delete the system credentials for ${username}?`,
      confirmLabel: "Delete User",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteResource("users", id)
          showToast("User Deleted Successfully", "warning", `${username} has been removed.`)
          fetchAllData()
        } catch (err: any) {
          showToast(err.message, "warning")
        }
      }
    })
  }

  const handleToggleStatus = (user: UserAccount) => {
    const nextStatus = user.status === "active" ? "suspended" : "active"

    confirm({
      title: nextStatus === "suspended" ? "Suspend Account" : "Activate Account",
      message: `Do you want to ${nextStatus === "suspended" ? "suspend" : "reactivate"} system access privileges for ${user.fullname || user.username}?`,
      confirmLabel: nextStatus === "suspended" ? "Suspend" : "Activate",
      isDestructive: nextStatus === "suspended",
      onConfirm: async () => {
        try {
          await updateResource<UserAccount>("users", user.id, { status: nextStatus })
          showToast(
            `Account ${nextStatus === "active" ? "Activated" : "Suspended"}`,
            nextStatus === "active" ? "success" : "warning",
            `System access has been updated.`
          )
          fetchAllData()
        } catch (err: any) {
          showToast(err.message, "warning")
        }
      }
    })
  }

  // Filter Calculation
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullname.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole =
      selectedRoleFilter === "All" ||
      user.roles.includes(selectedRoleFilter as Role)

    const matchesStatus =
      selectedStatusFilter === "All" ||
      user.status === selectedStatusFilter.toLowerCase()

    return matchesSearch && matchesRole && matchesStatus
  })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, selectedRoleFilter, selectedStatusFilter, filteredUsers.length])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const displayedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-3 sm:px-6 pt-20 sm:pt-24 pb-12">
        {/* Header Block */}
        <motion.div variants={fade} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">User Management</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage user accounts, warehouse scopes, and authorization access levels.</p>
          </div>

          <div className="shrink-0">
            <SubPageNav items={getSectionChildren("/admin")} />
          </div>
        </motion.div>

        {/* Controls Row */}
        <motion.div variants={fade} className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 mb-6 flex-wrap">
          {/* Search */}
          <div className="relative flex items-center h-[38px] sm:h-[40px] px-3.5 rounded-full glass-card border border-black/5 hover:bg-white/50 focus-within:bg-white/80 transition-all flex-1 min-w-[140px] sm:w-48 sm:flex-none">
            <Search className="size-3.5 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="bg-transparent border-none text-xs font-semibold text-black outline-none w-full"
            />
          </div>

          {/* Role Filter */}
          <div className="relative flex items-center h-[38px] sm:h-[40px] px-3.5 rounded-full glass-card border border-black/5 hover:bg-white/50 transition-all shrink-0">
            <ShieldCheck className="size-3.5 text-gray-400 mr-2 shrink-0" />
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-black outline-none pr-4 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_auto] bg-[right_center] bg-no-repeat"
            >
              <option value="All">All Roles</option>
              {Object.keys(roleLabels).map(role => (
                <option key={role} value={role}>{roleLabels[role as Role]}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative flex items-center h-[38px] sm:h-[40px] px-3.5 rounded-full glass-card border border-black/5 hover:bg-white/50 transition-all shrink-0">
            <Filter className="size-3.5 text-gray-400 mr-2 shrink-0" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-black outline-none pr-4 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_auto] bg-[right_center] bg-no-repeat"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white rounded-full h-[38px] sm:h-[40px] px-4 text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add User</span>
          </button>
        </motion.div>

        {/* User Table Grid */}
        <motion.div variants={fade}>
          <GlassCard>
            {loading ? (
              <UserTableSkeleton />
            ) : (
              <TableScrollWrapper>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                      <th className="py-4 px-4">User</th>
                      <th className="py-4 px-4">Assigned Roles</th>
                      <th className="py-4 px-4">Scope (Warehouse)</th>
                      <th className="py-4 px-4 text-center">Status</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                          No system user profiles found matching filters.
                        </td>
                      </tr>
                    ) : (
                      displayedUsers.map((user, idx) => {
                        const randomPreset = avatarBgPresets[idx % avatarBgPresets.length]
                        const initials = getInitials(user.fullname || user.username)

                        // Check warehouse names if assigned
                        const whIds = user.warehouse_ids || (user.warehouse_id ? [user.warehouse_id] : [])
                        const whDisplay = whIds.length > 0
                          ? whIds
                              .map(id => warehouses.find(w => w.id === id || w.code === id)?.name || id)
                              .join(", ")
                          : "HQ & All Warehouses"

                        return (
                          <tr key={user.id} className="hover:bg-black/[0.01] transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "size-9 rounded-2xl flex items-center justify-center font-black text-xs shadow-xs",
                                  randomPreset
                                )}>
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-bold text-black text-sm flex items-center gap-2">
                                    {user.fullname || user.username}
                                  </div>
                                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                                    @{user.username}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-wrap gap-1.5 max-w-sm">
                                {user.roles.map(r => (
                                  <span
                                    key={r}
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200/80 flex items-center gap-1 shadow-2xs"
                                  >
                                    <span className="size-1.5 rounded-full bg-zinc-400" />
                                    {roleLabels[r] || r}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-xs font-semibold text-zinc-600">
                                {whDisplay}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block",
                                user.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              )}>
                                {user.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right whitespace-nowrap overflow-hidden">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(user)}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-extrabold text-[11px] transition-all border active:scale-95 shadow-2xs cursor-pointer",
                                    user.status === "active"
                                      ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/80"
                                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/80"
                                  )}
                                  title={user.status === "active" ? "Suspend Access" : "Activate Access"}
                                >
                                  {user.status === "active" ? (
                                    <>
                                      <UserX className="size-3 text-amber-700" /> Suspend
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="size-3 text-emerald-700" /> Activate
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUser(user)
                                    setEditPassword("")
                                    setShowEditingUserPassword(false)
                                    setShowEditModal(true)
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                                  title="Edit Roles"
                                >
                                  <Edit className="size-3 text-zinc-700" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] transition-all border border-rose-200/80 active:scale-95 shadow-2xs cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 className="size-3 text-rose-600" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </TableScrollWrapper>
            )}

            {!loading && filteredUsers.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-black/5 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                  <span>
                    Showing {Math.min((page - 1) * pageSize + 1, filteredUsers.length)} to {Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length} entries
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
      </motion.div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white/95 backdrop-blur-lg border border-black/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-5 top-5 p-1 text-gray-400 hover:text-black rounded-lg transition-colors"
            >
              <X className="size-5" />
            </button>

            <h3 className="text-xl font-black text-black tracking-tight mb-4 flex items-center gap-2">
              <Users className="size-5 text-green-700" />
              <span>Create User Account</span>
            </h3>

            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              {/* Employee Link Selector */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Link to Employee</label>
                <select
                  value={newUser.employee_id}
                  onChange={(e) => {
                    const empId = e.target.value
                    const matchedEmp = employees.find(emp => emp.id === empId)
                    setNewUser({
                      ...newUser,
                      employee_id: empId,
                      fullname: matchedEmp ? matchedEmp.full_name : "",
                    })
                  }}
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3.5 text-sm font-semibold text-black outline-none focus:border-green-700 focus:bg-white transition-colors"
                >
                  <option value="">-- Create Manual User (No Employee Link) --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.email || "No Email"})</option>
                  ))}
                </select>
              </div>

              {/* Full name (shown only if manual user creation) */}
              {!newUser.employee_id && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.fullname}
                    onChange={(e) => setNewUser({ ...newUser, fullname: e.target.value })}
                    placeholder="e.g. David Kassa"
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-green-700 focus:bg-white transition-colors"
                  />
                </div>
              )}

              {/* Login Username */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Username (For Login)</label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="e.g. david.kassa"
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-green-700 focus:bg-white transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? "text" : "password"}
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Password"
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-4 pr-12 py-3 text-sm font-semibold text-black outline-none focus:border-green-700 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black rounded-lg transition-colors"
                  >
                    {showNewUserPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {newUser.password && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                      <span className="text-gray-400">Password Strength</span>
                      <span className={
                        getPasswordStrength(newUser.password).label === "Weak" ? "text-red-500" :
                        getPasswordStrength(newUser.password).label === "Medium" ? "text-yellow-600" : "text-green-600"
                      }>
                        {getPasswordStrength(newUser.password).label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-black/[0.05] rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-300", getPasswordStrength(newUser.password).color)}
                        style={{ width: getPasswordStrength(newUser.password).width }}
                      />
                    </div>
                    {getPasswordStrength(newUser.password).label !== "Strong" && (
                      <p className="text-[10px] font-semibold text-red-500 leading-normal">
                        Password must be strong. Add uppercase, lowercase, numbers, and special symbols (min 10 chars).
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Multiple Roles Selector Checkboxes */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Assign Access Roles</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-black/[0.01] p-3 rounded-2xl border border-black/5">
                  {Object.keys(roleLabels).map((rKey) => {
                    const role = rKey as Role
                    const isChecked = newUser.roles.includes(role)
                    const isSuperadminChecked = newUser.roles.includes("superadmin")
                    const isDisabled = role !== "superadmin" && isSuperadminChecked

                    return (
                      <label 
                        key={role} 
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.02] cursor-pointer",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isChecked) {
                              setNewUser({ ...newUser, roles: newUser.roles.filter(r => r !== role) })
                            } else {
                              if (role === "superadmin") {
                                confirm({
                                  title: "Assign Super Admin Role",
                                  message: "You have selected super admin this will give full access are you sure?",
                                  confirmLabel: "Yes, Assign",
                                  cancelLabel: "Cancel",
                                  onConfirm: () => {
                                    setNewUser({ ...newUser, roles: ["superadmin"] })
                                  }
                                })
                              } else {
                                setNewUser({ ...newUser, roles: [...newUser.roles, role] })
                              }
                            }
                          }}
                          className="accent-green-700 size-4 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-semibold text-black">{roleLabels[role]}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Warehouse Selection (Conditional on inventory_admin role) */}
              {newUser.roles.includes("inventory_admin") && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Assigned Warehouse Scopes</label>
                  <div className="grid grid-cols-1 gap-2 bg-black/[0.01] p-3 rounded-2xl border border-black/5">
                    {warehouses.map((wh) => {
                      const val = wh.code || wh.id
                      const isChecked = newUser.warehouse_ids?.includes(wh.id) || newUser.warehouse_ids?.includes(wh.code)
                      return (
                        <label key={wh.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.02] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setNewUser({ ...newUser, warehouse_ids: (newUser.warehouse_ids || []).filter(id => id !== wh.id && id !== wh.code) })
                              } else {
                                setNewUser({ ...newUser, warehouse_ids: [...(newUser.warehouse_ids || []), val] })
                              }
                            }}
                            className="accent-green-700 size-4 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-black">{wh.name} ({wh.code})</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}



              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-bold hover:bg-black/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || getPasswordStrength(newUser.password).label !== "Strong"}
                  className="min-w-[110px] flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full bg-green-700 hover:bg-green-800 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <LoadingDots color="bg-white" size="sm" /> : "Save User"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white/95 backdrop-blur-lg border border-black/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <button
              onClick={() => {
                setShowEditModal(false)
                setEditingUser(null)
              }}
              className="absolute right-5 top-5 p-1 text-gray-400 hover:text-black rounded-lg transition-colors"
            >
              <X className="size-5" />
            </button>

            <h3 className="text-xl font-black text-black tracking-tight mb-4 flex items-center gap-2">
              <Users className="size-5 text-green-700" />
              <span>Modify User Authorization</span>
            </h3>

            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullname}
                  onChange={(e) => setEditingUser({ ...editingUser, fullname: e.target.value })}
                  placeholder="Full name"
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-3 text-sm font-semibold text-black outline-none focus:border-green-700 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Username</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.username}
                  className="w-full bg-black/[0.04] border border-black/5 text-gray-400 rounded-2xl px-4 py-3 text-sm font-semibold outline-none cursor-not-allowed"
                />
              </div>

              {/* Multiple Roles Selector Checkboxes */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Modify Assigned Roles</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-black/[0.01] p-3 rounded-2xl border border-black/5">
                  {Object.keys(roleLabels).map((rKey) => {
                    const role = rKey as Role
                    const isChecked = editingUser.roles.includes(role)
                    const isSuperadminChecked = editingUser.roles.includes("superadmin")
                    const isDisabled = role !== "superadmin" && isSuperadminChecked

                    return (
                      <label 
                        key={role} 
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.02] cursor-pointer",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isChecked) {
                              setEditingUser({ ...editingUser, roles: editingUser.roles.filter(r => r !== role) })
                            } else {
                              if (role === "superadmin") {
                                confirm({
                                  title: "Assign Super Admin Role",
                                  message: "You have selected super admin this will give full access are you sure?",
                                  confirmLabel: "Yes, Assign",
                                  cancelLabel: "Cancel",
                                  onConfirm: () => {
                                    setEditingUser({ ...editingUser, roles: ["superadmin"] })
                                  }
                                })
                              } else {
                                setEditingUser({ ...editingUser, roles: [...editingUser.roles, role] })
                              }
                            }
                          }}
                          className="accent-green-700 size-4 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-semibold text-black">{roleLabels[role]}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Warehouse Selection (Conditional on inventory_admin role) */}
              {editingUser.roles.includes("inventory_admin") && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Assigned Warehouse Scopes</label>
                  <div className="grid grid-cols-1 gap-2 bg-black/[0.01] p-3 rounded-2xl border border-black/5">
                    {warehouses.map((wh) => {
                      const val = wh.code || wh.id
                      const isChecked = editingUser.warehouse_ids?.includes(wh.id) || editingUser.warehouse_ids?.includes(wh.code) || editingUser.warehouse_id === wh.id || editingUser.warehouse_id === wh.code
                      return (
                        <label key={wh.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.02] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const currentIds = editingUser.warehouse_ids || (editingUser.warehouse_id ? [editingUser.warehouse_id] : [])
                              if (isChecked) {
                                setEditingUser({ 
                                  ...editingUser, 
                                  warehouse_ids: currentIds.filter(id => id !== wh.id && id !== wh.code),
                                  warehouse_id: null
                                })
                              } else {
                                setEditingUser({ 
                                  ...editingUser, 
                                  warehouse_ids: [...currentIds, val],
                                  warehouse_id: null
                                })
                              }
                            }}
                            className="accent-green-700 size-4 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-black">{wh.name} ({wh.code})</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Reset Password */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reset Password (Optional)</label>
                <div className="relative">
                  <input
                    type={showEditingUserPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="w-full bg-black/[0.02] border border-black/10 rounded-2xl pl-4 pr-12 py-3 text-sm font-semibold text-black outline-none focus:border-green-700 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditingUserPassword(!showEditingUserPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black rounded-lg transition-colors"
                  >
                    {showEditingUserPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {editPassword && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                      <span className="text-gray-400">Password Strength</span>
                      <span className={
                        getPasswordStrength(editPassword).label === "Weak" ? "text-red-500" :
                        getPasswordStrength(editPassword).label === "Medium" ? "text-yellow-600" : "text-green-600"
                      }>
                        {getPasswordStrength(editPassword).label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-black/[0.05] rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-300", getPasswordStrength(editPassword).color)}
                        style={{ width: getPasswordStrength(editPassword).width }}
                      />
                    </div>
                    {getPasswordStrength(editPassword).label !== "Strong" && (
                      <p className="text-[10px] font-semibold text-red-500 leading-normal">
                        Password must be strong. Add uppercase, lowercase, numbers, and special symbols (min 10 chars).
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Security Status */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Security Status</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["active", "suspended"] as UserAccount["status"][]).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, status })}
                      className={cn(
                        "py-2.5 rounded-2xl text-xs font-bold transition-all border capitalize",
                        editingUser.status === status
                          ? "bg-green-700 text-white border-transparent shadow-md"
                          : "bg-black/[0.02] border-black/10 text-gray-500 hover:bg-black/[0.04]"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingUser(null)
                  }}
                  className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-bold hover:bg-black/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || (editPassword !== "" && getPasswordStrength(editPassword).label !== "Strong")}
                  className="min-w-[125px] flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full bg-green-700 hover:bg-green-800 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <LoadingDots color="bg-white" size="sm" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
