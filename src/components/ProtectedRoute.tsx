import { useEffect } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore, normalizeRole } from "@/lib/authStore"
import type { Role } from "@/lib/authStore"
import { erpStore } from "@/lib/erpStore"
import { financeStore } from "@/lib/financeStore"
import { hrStore } from "@/lib/hrStore"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()
  const authenticated = isAuthenticated()

  useEffect(() => {
    if (!authenticated || !user) return

    const roles = (user.roles || []).map(normalizeRole)
    const isSuper = roles.includes("superadmin")
    const pathname = location.pathname

    // Route-aware and role-scoped store loading
    if (pathname.startsWith("/inventory")) {
      if (isSuper || roles.includes("inventory")) {
        void erpStore.loadInventoryData()
      }
    } else if (pathname.startsWith("/sales")) {
      if (isSuper || roles.includes("sales") || roles.includes("hkc_docs")) {
        void erpStore.loadSalesData()
      }
    } else if (pathname.startsWith("/finance")) {
      if (isSuper || roles.includes("finance")) {
        void financeStore.loadFromApi()
      }
    } else if (pathname.startsWith("/hr")) {
      if (isSuper || roles.includes("hr")) {
        void hrStore.loadFromApi()
      }
    } else if (pathname.startsWith("/admin") || pathname === "/") {
      if (isSuper) {
        // Superadmin on overview/admin page: load domains lazily
        void erpStore.loadInventoryData()
        void erpStore.loadSalesData()
        void financeStore.loadFromApi()
        void hrStore.loadFromApi()
      } else {
        // Single-role users: load only their assigned domain
        if (roles.includes("inventory")) void erpStore.loadInventoryData()
        if (roles.includes("sales") || roles.includes("hkc_docs")) void erpStore.loadSalesData()
        if (roles.includes("finance")) void financeStore.loadFromApi()
        if (roles.includes("hr")) void hrStore.loadFromApi()
      }
    }
  }, [authenticated, user, location.pathname])

  if (!authenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userRoles = (user.roles || ((user as any).role ? [(user as any).role] : [])).map(normalizeRole)

  // Superadmin has access to everything
  if (userRoles.includes("superadmin")) {
    return <>{children}</>
  }

  if (allowedRoles && !allowedRoles.map(normalizeRole).some(r => userRoles.includes(r))) {
    // Redirect them to their home based on role if they try to access unauthorized page
    let homeRoute = "/"
    const firstRole = userRoles[0]
    switch (firstRole) {
      case "sales":
        homeRoute = "/sales"
        break
      case "hr":
        homeRoute = "/hr"
        break
      case "inventory":
        homeRoute = "/inventory"
        break
      case "finance":
        homeRoute = "/finance"
        break
      case "hkc_docs":
        homeRoute = "/sales/hkc-docs"
        break
    }
    return <Navigate to={homeRoute} replace />
  }

  return <>{children}</>
}
