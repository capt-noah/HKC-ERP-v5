import { useEffect } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "@/lib/authStore"
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

    const roles = user.roles || []
    const isSuper = roles.includes("superadmin")
    const pathname = location.pathname

    // Route-aware and role-scoped store loading
    if (pathname.startsWith("/inventory")) {
      if (isSuper || roles.includes("inventory_admin")) {
        void erpStore.loadInventoryData()
      }
    } else if (pathname.startsWith("/sales")) {
      if (isSuper || roles.includes("sales_manager") || roles.includes("hkc_docs_manager")) {
        void erpStore.loadSalesData()
      }
    } else if (pathname.startsWith("/finance")) {
      if (isSuper || roles.includes("finance_manager")) {
        void financeStore.loadFromApi()
      }
    } else if (pathname.startsWith("/hr")) {
      if (isSuper || roles.includes("hr_manager")) {
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
        if (roles.includes("inventory_admin")) void erpStore.loadInventoryData()
        if (roles.includes("sales_manager") || roles.includes("hkc_docs_manager")) void erpStore.loadSalesData()
        if (roles.includes("finance_manager")) void financeStore.loadFromApi()
        if (roles.includes("hr_manager")) void hrStore.loadFromApi()
      }
    }
  }, [authenticated, user, location.pathname])

  if (!authenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userRoles = user.roles || ((user as any).role ? [(user as any).role] : [])

  // Superadmin has access to everything
  if (userRoles.includes("superadmin")) {
    return <>{children}</>
  }

  if (allowedRoles && !allowedRoles.some(r => userRoles.includes(r))) {
    // Redirect them to their home based on role if they try to access unauthorized page
    let homeRoute = "/"
    const firstRole = userRoles[0]
    switch (firstRole) {
      case "sales_manager":
        homeRoute = "/sales"
        break
      case "hr_manager":
        homeRoute = "/hr"
        break
      case "inventory_admin":
        homeRoute = "/inventory"
        break
      case "finance_manager":
        homeRoute = "/finance"
        break
      case "hkc_docs_manager":
        homeRoute = "/sales/hkc-docs"
        break
    }
    return <Navigate to={homeRoute} replace />
  }

  return <>{children}</>
}
