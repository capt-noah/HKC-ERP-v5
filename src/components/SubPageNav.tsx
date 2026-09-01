import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/authStore"
import type { Role } from "@/lib/authStore"
import type { NavChild } from "@/components/FloatingNav"
import { navSections } from "@/lib/nav-config"

interface SubPageNavProps {
  items: NavChild[]
  variant?: "light" | "dark"
}

const sectionRoleMapping: Record<string, Role[]> = {
  Sales: ["superadmin", "sales_manager"],
  "HKC Docs": ["superadmin", "hkc_docs_manager"],
  Inventory: ["superadmin", "inventory_admin"],
  Finance: ["superadmin", "finance_manager"],
  HR: ["superadmin", "hr_manager"],
  Admin: ["superadmin"],
}

export function SubPageNav({ items, variant = "light" }: SubPageNavProps) {
  const location = useLocation()
  const isDark = variant === "dark"
  const { user } = useAuthStore()

  const userRoles = user?.roles || ((user as any)?.role ? [(user as any).role] : [])
  const isSuperAdmin = userRoles.includes("superadmin")

  const visibleSections = navSections.filter((s) => {
    if (isSuperAdmin) return true
    const allowed = sectionRoleMapping[s.label]
    if (!allowed) return false
    return allowed.some((r) => userRoles.includes(r))
  })

  // If user only has 1 assigned module, sub-pages are already in the top FloatingNav!
  if (visibleSections.length <= 1) {
    return null
  }

  const userWarehouseIds = (user?.warehouse_ids || ((user as any)?.warehouse_id ? [(user as any).warehouse_id] : [])).map((id: string) => String(id).toUpperCase())
  const hasWH1Access = isSuperAdmin || userWarehouseIds.length === 0 || userWarehouseIds.some(id => id.includes("WH1") || id.includes("WH-01") || id.includes("WH 1") || id.includes("WAREHOUSE 1"))

  const visibleItems = items.filter(item => {
    if (item.path === "/inventory/processing-services" && !hasWH1Access) return false
    return true
  })

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar overscroll-x-contain max-w-full py-1 -my-1">
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95",
              isActive
                ? "bg-green-700 text-white font-bold shadow-sm"
                : isDark
                  ? "glass-card-dark text-zinc-300 hover:text-white"
                  : "glass-card text-zinc-600 hover:text-zinc-950"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
