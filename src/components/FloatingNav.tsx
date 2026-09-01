import { useState, useMemo, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  Bell,
  User,
  Check,
  Inbox,
  Clock,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  FileText,
  Package,
  DollarSign,
  Users as UsersIcon,
  ShoppingCart,
  LogOut,
  Sliders,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/authStore"
import { useErpStore } from "@/lib/erpStore"
import type { Role } from "@/lib/authStore"

const sectionRoleMapping: Record<string, Role[]> = {
  Sales: ["superadmin", "sales_manager"],
  "HKC Docs": ["superadmin", "hkc_docs_manager"],
  Inventory: ["superadmin", "inventory_admin"],
  Finance: ["superadmin", "finance_manager"],
  HR: ["superadmin", "hr_manager"],
  Admin: ["superadmin"],
}

const sectionIcons: Record<string, any> = {
  Sales: ShoppingCart,
  "HKC Docs": FileText,
  Inventory: Package,
  Finance: DollarSign,
  HR: UsersIcon,
  Admin: ShieldCheck,
}

export interface NavChild {
  label: string
  path: string
}

export interface NavSection {
  label: string
  path: string
  children?: NavChild[]
}

interface FloatingNavProps {
  brand: string
  brandIcon?: React.ReactNode
  sections: NavSection[]
  variant?: "light" | "dark"
  rightActions?: React.ReactNode
}

export function FloatingNav({
  brand,
  brandIcon,
  sections,
  variant = "light",
  rightActions,
}: FloatingNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isDark = variant === "dark"
  const [showNotifications, setShowNotifications] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const erp = useErpStore()
  const salesOrders = erp.getSalesOrders()

  // Close mobile drawer and notifications on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
    setShowNotifications(false)
  }, [location.pathname])

  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([])
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])

  const userRoles = user?.roles || ((user as any)?.role ? [(user as any).role] : [])
  const isSuperAdmin = userRoles.includes("superadmin")
  const userWarehouseIds = (user?.warehouse_ids || ((user as any)?.warehouse_id ? [(user as any).warehouse_id] : [])).map((id: string) => String(id).toUpperCase())

  // Dynamic notifications for Super Admin (e.g. pending sales orders)
  const notifications = useMemo(() => {
    if (!isSuperAdmin) return []
    const pendingOrders = salesOrders.filter((so) => (so.approvalStatus || "Pending") === "Pending")
    return pendingOrders
      .filter((so) => !dismissedNotificationIds.includes(so.id))
      .map((so) => ({
        id: so.id,
        title: `Sales Order Pending Approval: ${so.id}`,
        desc: `${so.customer} • ETB ${Number(so.amount || 0).toLocaleString()} (${so.paymentType || "Cash"}) awaiting Super Admin approval.`,
        time: so.date || "Today",
        type: "approval",
        icon: Clock,
        unread: !readNotificationIds.includes(so.id),
        orderId: so.id,
      }))
  }, [isSuperAdmin, salesOrders, dismissedNotificationIds, readNotificationIds])

  // WH1 access: true if superadmin, or if no specific warehouse restriction is set, or if WH1 is in assigned warehouses
  const hasWH1Access = isSuperAdmin || userWarehouseIds.length === 0 || userWarehouseIds.some(id => id.includes("WH1") || id.includes("WH-01") || id.includes("WH 1") || id.includes("WAREHOUSE 1"))

  const visibleSections = sections.filter((s) => {
    if (isSuperAdmin) return true
    const allowed = sectionRoleMapping[s.label]
    if (!allowed) return false
    return allowed.some((r) => userRoles.includes(r))
  })

  const unreadCount = notifications.filter((n) => n.unread).length

  const handleMarkAllRead = () => {
    setReadNotificationIds(notifications.map((n) => n.id))
  }

  const handleClearAll = () => {
    setDismissedNotificationIds(notifications.map((n) => n.id))
  }

  const handleToggleRead = (id: string) => {
    setReadNotificationIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleNotificationClick = (_orderId?: string) => {
    setShowNotifications(false)
    navigate("/admin?tab=approvals")
  }

  const activeSection =
    (sections.find(
      (s) =>
        s.path === location.pathname ||
        (s.children && s.children.some((c) => location.pathname === c.path))
    ) ||
    [...sections]
      .sort((a, b) => b.path.length - a.path.length)
      .find((s) => location.pathname.startsWith(s.path))) ?? sections[0]

  const visibleChildren = (activeSection?.children || []).filter((child) => {
    if (child.path === "/inventory/processing-services" && !hasWH1Access) {
      return false
    }
    return true
  })

  return (
    <>
      <div className="fixed top-3 sm:top-4 left-0 right-0 z-50 w-full px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-3 w-full max-w-[100%] mx-auto">
          {/* 1. Left Pill: Brand Logo */}
          <Link
            to="/"
            className={cn(
              "h-[44px] sm:h-[46px] flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 rounded-full border shadow-sm text-black shrink-0 transition-transform active:scale-95",
              isDark
                ? "glass-nav-dark border-white/10 text-white"
                : "glass-nav border-white/80 text-black"
            )}
          >
            {brandIcon ?? (
              <img
                src="/hkc_logo.png"
                alt="HKC Logo"
                className="h-6 sm:h-7 w-auto object-contain shrink-0"
              />
            )}
            <span className="font-bold text-xs sm:text-sm tracking-tight whitespace-nowrap text-green-700 dark:text-green-400">
              {brand === "HKC Trading ERP" ? "HKC Trading" : brand}
            </span>
          </Link>

          {/* Right Section containing Menu Pill & Controls Pill */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
            {/* 2. Middle Pill: Desktop Navigation Menu (hidden on < lg) */}
            {visibleSections.length > 1 ? (
              <div
                className={cn(
                  "hidden lg:flex h-[46px] items-center gap-1 p-1 rounded-full border shadow-sm overflow-x-auto no-scrollbar",
                  isDark
                    ? "glass-nav-dark border-white/10"
                    : "glass-nav border-white/80"
                )}
              >
                {visibleSections.map((section) => {
                  const isActive = activeSection?.label === section.label
                  return (
                    <Link
                      key={section.label}
                      to={section.path}
                      className={cn(
                        "h-[36px] flex items-center px-4 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap",
                        isActive
                          ? isDark
                            ? "bg-white text-black shadow-md font-bold scale-[1.03]"
                            : "bg-[#242427] text-white shadow-md font-bold scale-[1.03]"
                          : isDark
                            ? "text-zinc-400 hover:text-white hover:bg-white/5"
                            : "text-[#505054] hover:text-black hover:bg-black/5"
                      )}
                    >
                      {section.label}
                    </Link>
                  )
                })}
              </div>
            ) : visibleSections.length === 1 && visibleChildren.length > 1 ? (
              <div
                className={cn(
                  "hidden lg:flex h-[46px] items-center gap-1 p-1 rounded-full border shadow-sm overflow-x-auto no-scrollbar",
                  isDark
                    ? "glass-nav-dark border-white/10"
                    : "glass-nav border-white/80"
                )}
              >
                {visibleChildren.map((child) => {
                  const isChildActive = location.pathname === child.path
                  return (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={cn(
                        "h-[36px] flex items-center px-4 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap",
                        isChildActive
                          ? isDark
                            ? "bg-white text-black shadow-md font-bold scale-[1.03]"
                            : "bg-emerald-700 text-white shadow-md font-bold scale-[1.03]"
                          : isDark
                            ? "text-zinc-400 hover:text-white hover:bg-white/5"
                            : "text-zinc-600 hover:text-zinc-950 hover:bg-black/5"
                      )}
                    >
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            ) : null}

            {/* 3. Right Pill: Actions (Notification, User Profile, Mobile Hamburger) */}
            <div
              className={cn(
                "h-[44px] sm:h-[46px] flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 rounded-full border shadow-sm shrink-0",
                isDark
                  ? "glass-nav-dark border-white/10 text-white"
                  : "glass-nav border-white/80 text-black"
              )}
            >
              {rightActions ?? (
                <div className="flex items-center gap-1.5 sm:gap-2 relative">
                  {/* Notification Bell */}
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={cn(
                      "size-8 sm:size-9 rounded-full flex items-center justify-center transition-all duration-300 relative border hover:scale-105 active:scale-95 cursor-pointer",
                      showNotifications 
                        ? "bg-black text-white border-black" 
                        : isDark
                          ? "hover:bg-white/10 text-zinc-300 border-white/10"
                          : "hover:bg-black/5 text-[#505054] border-black/5 bg-white/40"
                    )}
                    title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
                  >
                    <Bell className="size-4 sm:size-[18px] relative z-10" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[17px] sm:min-w-[19px] h-[17px] sm:h-[19px] px-1 bg-red-600 text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md animate-pulse z-20">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Floating Card Popover */}
                  <AnimatePresence>
                    {showNotifications && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 cursor-default" 
                          onClick={() => setShowNotifications(false)} 
                        />
                        
                        <motion.div
                          initial={{ opacity: 0, y: 15, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="absolute right-0 top-11 z-50 w-72 sm:w-80 rounded-3xl border border-zinc-200/80 bg-white text-zinc-900 p-4 sm:p-5 shadow-2xl text-left overflow-hidden max-w-[calc(100vw-32px)]"
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3.5">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-[10px] font-black tracking-wider text-zinc-800 uppercase">Alert Center</h3>
                              {unreadCount > 0 && (
                                <span className="text-[10px] bg-green-700 text-white px-1.5 py-0.5 rounded-full font-black leading-none">
                                  {unreadCount} NEW
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {notifications.length > 0 && (
                                <>
                                  <button
                                    onClick={handleMarkAllRead}
                                    className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
                                    title="Mark all as read"
                                  >
                                    Mark all read
                                  </button>
                                  <span className="text-zinc-200">|</span>
                                  <button
                                    onClick={handleClearAll}
                                    className="text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                                    title="Clear all alerts"
                                  >
                                    Clear
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 max-h-[290px] overflow-y-auto pr-0.5">
                            {notifications.length > 0 ? (
                              notifications.map((n) => {
                                const IconComp = n.icon ?? Inbox
                                return (
                                  <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n.orderId)}
                                    className={cn(
                                      "flex items-start gap-3 p-3 rounded-2xl border transition-all text-left relative group cursor-pointer",
                                      n.unread
                                        ? "bg-amber-50/60 border-amber-200/70 hover:bg-amber-50"
                                        : "bg-transparent border-transparent opacity-85 hover:opacity-100 hover:bg-zinc-50"
                                    )}
                                  >
                                    <div className={cn(
                                      "size-8 rounded-full flex items-center justify-center shrink-0 border",
                                      n.type === "approval" && "bg-amber-100 text-amber-800 border-amber-200",
                                      n.type === "success" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                                      n.type === "info" && "bg-blue-50 text-blue-600 border-blue-100",
                                      n.type === "calendar" && "bg-purple-50 text-purple-600 border-purple-100"
                                    )}>
                                      <IconComp className="size-4" />
                                    </div>

                                    <div className="flex-1 min-w-0 pr-4">
                                      <h4 className="text-xs font-extrabold leading-tight tracking-tight text-zinc-900 flex items-center gap-1.5">
                                        {n.title}
                                        {n.unread && (
                                          <span className="size-1.5 rounded-full bg-amber-600 shrink-0 animate-pulse" />
                                        )}
                                      </h4>
                                      <p className="text-[10px] font-semibold text-zinc-600 leading-relaxed mt-0.5">
                                        {n.desc}
                                      </p>
                                      <span className="text-[9px] font-mono font-bold text-zinc-400 block mt-1">
                                        {n.time} • <span className="text-emerald-700 font-bold underline">Review in Approvals</span>
                                      </span>
                                    </div>

                                    <div className="absolute right-2.5 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleToggleRead(n.id)
                                        }}
                                        className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                                        title={n.unread ? "Mark as read" : "Mark as unread"}
                                      >
                                        <Check className={cn("size-3.5", !n.unread && "text-emerald-500")} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="size-11 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-100 mb-2.5">
                                  <Inbox className="size-5 text-zinc-400" />
                                </div>
                                <p className="text-xs font-black text-zinc-800 tracking-tight">Inbox Clean</p>
                                <p className="text-[10px] font-semibold text-zinc-400 mt-0.5">No alerts at this moment.</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

                  {/* Profile Avatar Button (hidden on mobile if drawer handles it or visible) */}
                  <button
                    onClick={() => navigate("/profile")}
                    className={cn(
                      "hidden sm:flex size-8 sm:size-9 rounded-full items-center justify-center border cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95",
                      location.pathname === "/profile"
                        ? isDark
                          ? "bg-emerald-700 text-white border-emerald-600 shadow-sm"
                          : "bg-emerald-700 text-white border-emerald-700 shadow-sm font-bold"
                        : isDark
                          ? "bg-green-700/20 text-green-400 border-green-700/30 hover:bg-emerald-700/30"
                          : "bg-[#e5e5ea] hover:bg-emerald-50 hover:text-emerald-700 text-[#1c1c1e] border-black/10"
                    )}
                    title="View Profile"
                  >
                    <User className="size-4 sm:size-[18px]" />
                  </button>

                  {/* Mobile Hamburger Toggle Button (< lg) */}
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className={cn(
                      "flex lg:hidden size-8 sm:size-9 rounded-full items-center justify-center border transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer",
                      isMobileMenuOpen
                        ? "bg-zinc-950 text-white border-zinc-950 shadow-md"
                        : "bg-black/5 text-zinc-800 border-black/5 hover:bg-black/10"
                    )}
                    aria-label="Toggle mobile menu"
                  >
                    {isMobileMenuOpen ? (
                      <X className="size-4 sm:size-5 stroke-[2.5]" />
                    ) : (
                      <Menu className="size-4 sm:size-5 stroke-[2.5]" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Sheet */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Dark Frosted Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm lg:hidden"
            />

            {/* Mobile Sheet Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[340px] sm:max-w-[380px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xl flex flex-col justify-between overflow-hidden border-l border-zinc-200 dark:border-zinc-800 lg:hidden"
            >
              {/* Top Section */}
              <div className="flex flex-col flex-1 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/hkc_logo.png"
                      alt="HKC Logo"
                      className="h-7 w-auto object-contain"
                    />
                    <div>
                      <h2 className="text-sm font-black tracking-tight text-zinc-950 dark:text-white">HKC Trading ERP</h2>
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Mobile Portal</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* User Info Card */}
                {user && (
                  <div className="p-4 mx-4 mt-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-full bg-zinc-950 text-white flex items-center justify-center font-black text-xs shrink-0">
                        {user.fullname ? user.fullname.substring(0, 2).toUpperCase() : "US"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs text-zinc-900 dark:text-white truncate">
                          {user.fullname || user.username}
                        </p>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 mt-0.5">
                          {userRoles[0]?.replace("_", " ") || "Staff"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        navigate("/profile")
                      }}
                      className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors"
                      title="Profile settings"
                    >
                      <Sliders className="size-4" />
                    </button>
                  </div>
                )}

                {/* Navigation Modules Section */}
                <div className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-3 pb-1 block">
                    ERP Modules
                  </span>

                  {visibleSections.map((section) => {
                    const isSecActive = activeSection?.label === section.label
                    const IconComp = sectionIcons[section.label] || Package
                    const sectionChildren = section.children || []

                    return (
                      <div key={section.label} className="space-y-1">
                        <Link
                          to={section.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all",
                            isSecActive
                              ? "bg-zinc-950 text-white shadow-sm font-black"
                              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-7 rounded-xl flex items-center justify-center",
                              isSecActive ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400"
                            )}>
                              <IconComp className="size-4" />
                            </div>
                            <span>{section.label}</span>
                          </div>
                          <ChevronRight className={cn("size-4 opacity-50", isSecActive && "opacity-100 text-white")} />
                        </Link>

                        {/* Nested Subpages for Active Module */}
                        {isSecActive && sectionChildren.length > 1 && (
                          <div className="pl-10 pr-2 py-1 space-y-1 border-l-2 border-zinc-200 dark:border-zinc-800 ml-5 my-1">
                            {sectionChildren.map((child) => {
                              const isChildActive = location.pathname === child.path
                              return (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className={cn(
                                    "block py-2 px-3 rounded-xl text-[11px] font-bold transition-colors",
                                    isChildActive
                                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-extrabold border border-emerald-200/80 dark:border-emerald-800/50"
                                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                                  )}
                                >
                                  {child.label}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bottom Quick Actions (Sign Out & Profile) */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    navigate("/profile")
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-zinc-50 active:scale-95 transition-all"
                >
                  <User className="size-3.5 text-zinc-500" /> Account Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    logout()
                    navigate("/login")
                  }}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-2xs hover:bg-rose-100 active:scale-95 transition-all"
                >
                  <LogOut className="size-3.5 text-rose-600" /> Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
