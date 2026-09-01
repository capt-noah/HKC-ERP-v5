import { useEffect } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Toaster } from "sonner"
import { useAuthStore } from "@/lib/authStore"

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as any })
    if (document.body) document.body.scrollTop = 0
    if (document.documentElement) document.documentElement.scrollTop = 0
  }, [pathname])

  return null
}

import Login from "@/pages/auth/Login"
import SalesDashboard from "@/pages/sales/SalesDashboard"
import SalesIssued from "@/pages/sales/SalesIssued"
import HkcDocs from "@/pages/sales/HkcDocs"
import ProcessingServices from "@/pages/sales/ProcessingServices"
import CreditSalesAttachment from "@/pages/sales/CreditSalesAttachment"
import PurchaseOrders from "@/pages/PurchaseOrders"
import SalesOrders from "@/pages/SalesOrders"
import InventoryDashboard from "@/pages/inventory/InventoryDashboard"
import StockProducts from "@/pages/inventory/StockProducts"
import AddStockItem from "@/pages/inventory/AddStockItem"
import HRDashboard from "@/pages/HRDashboard"
import ControlCenter from "@/pages/ControlCenter"
import FinanceOverview from "@/pages/finance/FinanceOverview"
import Ledger from "@/pages/finance/Ledger"
import Invoices from "@/pages/finance/Invoices"
import Expenses from "@/pages/finance/Expenses"
import Banking from "@/pages/finance/Banking"
import Assets from "@/pages/finance/Assets"
import Taxes from "@/pages/finance/Taxes"
import FinancialReports from "@/pages/finance/FinancialReports"
import FinanceExport from "@/pages/finance/FinanceExport"
import Employees from "@/pages/hr/Employees"
import Payroll from "@/pages/hr/Payroll"
import Attendance from "@/pages/hr/Attendance"
import Leave from "@/pages/hr/Leave"
import UserManagement from "@/pages/admin/UserManagement"
import PartnersRegistry from "@/pages/admin/PartnersRegistry"
import AdminSettings from "@/pages/admin/AdminSettings"
import Profile from "@/pages/Profile"
import NotFound from "@/pages/NotFound"

function RoleHomeRedirect() {
  const user = useAuthStore((state) => state.user)
  const userRoles = user?.roles || ((user as any)?.role ? [(user as any).role] : [])
  const primaryRole = userRoles[0]

  switch (primaryRole) {
    case "superadmin":
      return <Navigate to="/admin" replace />
    case "sales_manager":
      return <Navigate to="/sales" replace />
    case "hr_manager":
      return <Navigate to="/hr" replace />
    case "inventory_admin":
      return <Navigate to="/inventory" replace />
    case "finance_manager":
      return <Navigate to="/finance" replace />
    case "hkc_docs_manager":
      return <Navigate to="/sales/hkc-docs" replace />
    default:
      return <Navigate to="/sales" replace />
  }
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoleHomeRedirect />
            </ProtectedRoute>
          }
        />

        {/* Sales section */}
        <Route path="/sales" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><SalesDashboard /></ProtectedRoute>} />
        <Route path="/sales/hkc-docs" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><HkcDocs /></ProtectedRoute>} />
        <Route path="/sales/processing-services" element={<Navigate to="/inventory/processing-services" replace />} />
        <Route path="/sales/sales-issued" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><SalesIssued /></ProtectedRoute>} />
        <Route path="/sales/sales-issued/:id/attachment" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><CreditSalesAttachment /></ProtectedRoute>} />
        <Route path="/sales/sales-orders" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><SalesOrders /></ProtectedRoute>} />
        <Route path="/sales/quotations" element={<Navigate to="/sales/sales-orders" replace />} />
        <Route path="/sales/delivery-notes" element={<Navigate to="/sales/sales-orders" replace />} />
        <Route path="/sales/purchase-orders" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><PurchaseOrders /></ProtectedRoute>} />

        {/* Inventory section */}
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><InventoryDashboard /></ProtectedRoute>} />
        <Route path="/inventory/stock" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><StockProducts /></ProtectedRoute>} />
        <Route path="/inventory/bin-card" element={<Navigate to="/inventory/stock" replace />} />
        <Route path="/inventory/processing-services" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><ProcessingServices /></ProtectedRoute>} />
        <Route path="/inventory/toll-processing" element={<Navigate to="/inventory/processing-services" replace />} />
        <Route path="/inventory/stock/add-item" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><AddStockItem /></ProtectedRoute>} />

        {/* Finance section */}
        <Route path="/finance" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><FinanceOverview /></ProtectedRoute>} />
        <Route path="/finance/ledger" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Ledger /></ProtectedRoute>} />
        <Route path="/finance/invoices" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Invoices /></ProtectedRoute>} />
        <Route path="/finance/expenses" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Expenses /></ProtectedRoute>} />
        <Route path="/finance/banking" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Banking /></ProtectedRoute>} />
        <Route path="/finance/assets" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Assets /></ProtectedRoute>} />
        <Route path="/finance/taxes" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Taxes /></ProtectedRoute>} />
        <Route path="/finance/reports" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><FinancialReports /></ProtectedRoute>} />
        <Route path="/finance/export" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><FinanceExport /></ProtectedRoute>} />

        {/* HR section */}
        <Route path="/hr" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><HRDashboard /></ProtectedRoute>} />
        <Route path="/hr/employees" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Employees /></ProtectedRoute>} />
        <Route path="/hr/attendance" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Attendance /></ProtectedRoute>} />
        <Route path="/hr/leave" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Leave /></ProtectedRoute>} />
        <Route path="/hr/payroll" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Payroll /></ProtectedRoute>} />
        <Route path="/hr/attendance-leave" element={<Navigate to="/hr/attendance" replace />} />
        <Route path="/hr/recruitment" element={<Navigate to="/hr" replace />} />
        <Route path="/hr/onboarding-separation" element={<Navigate to="/hr" replace />} />

        {/* Admin section */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["superadmin"]}><ControlCenter /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["superadmin"]}><UserManagement /></ProtectedRoute>} />
        <Route path="/admin/partners" element={<ProtectedRoute allowedRoles={["superadmin"]}><PartnersRegistry /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={["superadmin"]}><AdminSettings /></ProtectedRoute>} />

        {/* Profile section */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
