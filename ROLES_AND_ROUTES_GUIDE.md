# Authorization Guide: Roles, Routes, and User Administration (v5)

This document describes the role-based access control (RBAC), routing guards, database schema specifications, and user management rules implemented in **HKC ERP v5**.

---

## 1. Access Control Roles

The system uses granular, role-based access control across five core operational departments and system administration:

### Active Roles List
* **`superadmin`**: Full system access. Bypasses all warehouse scopes and has unrestricted access to all modules, including the Admin Control Center, User Management, Partners Registry, and System Settings.
* **`sales_manager`**: Access to the Sales Dashboard (`/sales`), Sales Issued vouchers (`/sales/sales-issued`), Sales Orders (`/sales/sales-orders`), Purchase Orders (`/sales/purchase-orders`), and Trade Documents (`/sales/hkc-docs`).
* **`hkc_docs_manager`**: Access to trade documents (`/sales/hkc-docs`) and related sales order/purchase order paperwork registers.
* **`inventory_admin`**: Access to the Inventory Dashboard (`/inventory`), Stock Register (`/inventory/stock`), and Processing Services (`/inventory/processing-services`). Scoped strictly by assigned `warehouse_ids`.
* **`finance_manager`**: Access to the Finance Overview (`/finance`), General Ledger (`/finance/ledger`), Invoices (`/finance/invoices`), Expenses & Fleet (`/finance/expenses`), Banking & Reconciliations (`/finance/banking`), Taxes (`/finance/taxes`), Financial Reports (`/finance/reports`), and Finance Export Center (`/finance/export`).
* **`hr_manager`**: Access to the HR Dashboard (`/hr`), Employee Directory (`/hr/employees`), Attendance (`/hr/attendance`), Leave Management (`/hr/leave`), and Payroll (`/hr/payroll`).

---

## 2. Multi-Warehouse Scoping (`warehouse_ids`)

### Database Model (MySQL 8)
The `users` table stores warehouse assignments in the `warehouse_ids` column as a JSON array (or comma-separated string) of warehouse codes and IDs (e.g. `["WH1-AGRI-EXP", "WH2-VET-IND"]` or `["WH1", "WH2"]`).

* **Scoping Behavior**:
  * Users with the `inventory_admin` role only see data (products, stock items, store transfers, and bin card movements) belonging to their assigned warehouses.
  * **`superadmin`** bypasses all scoping filters and can view/manage all warehouses.

### Warehouse ID/Code Resolver
To prevent identifier mismatches (e.g. `"WH1"` vs `"WH1-AGRI-EXP"`), the frontend client resolves warehouse access dynamically:

```typescript
const resolvedWarehouseIds = useMemo(() => {
  const allWhs = erp.getWarehouses()
  const set = new Set<string>()
  userWarehouseIds.forEach(id => {
    set.add(id)
    const matched = allWhs.find(w => w.id === id || w.code === id)
    if (matched) {
      if (matched.id) set.add(matched.id)
      if (matched.code) set.add(matched.code)
    }
  })
  return Array.from(set)
}, [userWarehouseIds])
```

---

## 3. Router Guards & Navigation Mappings

### Client-Side Routes & Guards (`src/App.tsx`)
Routes are guarded in `src/App.tsx` using the `<ProtectedRoute allowedRoles={[...]}>` wrapper:

```tsx
{/* Role-Based Landing Redirect */}
<Route path="/" element={<ProtectedRoute><RoleHomeRedirect /></ProtectedRoute>} />

{/* Sales Section */}
<Route path="/sales" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><SalesDashboard /></ProtectedRoute>} />
<Route path="/sales/hkc-docs" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><HkcDocs /></ProtectedRoute>} />
<Route path="/sales/sales-issued" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><SalesIssued /></ProtectedRoute>} />
<Route path="/sales/sales-issued/:id/attachment" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><CreditSalesAttachment /></ProtectedRoute>} />
<Route path="/sales/sales-orders" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><SalesOrders /></ProtectedRoute>} />
<Route path="/sales/purchase-orders" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><PurchaseOrders /></ProtectedRoute>} />

{/* Inventory Section */}
<Route path="/inventory" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><InventoryDashboard /></ProtectedRoute>} />
<Route path="/inventory/stock" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><StockProducts /></ProtectedRoute>} />
<Route path="/inventory/stock/add-item" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><AddStockItem /></ProtectedRoute>} />
<Route path="/inventory/processing-services" element={<ProtectedRoute allowedRoles={["superadmin", "inventory_admin"]}><ProcessingServices /></ProtectedRoute>} />

{/* Finance Section */}
<Route path="/finance" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><FinanceOverview /></ProtectedRoute>} />
<Route path="/finance/ledger" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Ledger /></ProtectedRoute>} />
<Route path="/finance/invoices" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Invoices /></ProtectedRoute>} />
<Route path="/finance/expenses" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Expenses /></ProtectedRoute>} />
<Route path="/finance/banking" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Banking /></ProtectedRoute>} />
<Route path="/finance/taxes" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><Taxes /></ProtectedRoute>} />
<Route path="/finance/reports" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><FinancialReports /></ProtectedRoute>} />
<Route path="/finance/export" element={<ProtectedRoute allowedRoles={["superadmin", "finance_manager"]}><FinanceExport /></ProtectedRoute>} />

{/* HR Section */}
<Route path="/hr" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><HRDashboard /></ProtectedRoute>} />
<Route path="/hr/employees" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Employees /></ProtectedRoute>} />
<Route path="/hr/attendance" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Attendance /></ProtectedRoute>} />
<Route path="/hr/leave" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Leave /></ProtectedRoute>} />
<Route path="/hr/payroll" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><Payroll /></ProtectedRoute>} />

{/* Admin Section */}
<Route path="/admin" element={<ProtectedRoute allowedRoles={["superadmin"]}><ControlCenter /></ProtectedRoute>} />
<Route path="/admin/users" element={<ProtectedRoute allowedRoles={["superadmin"]}><UserManagement /></ProtectedRoute>} />
<Route path="/admin/partners" element={<ProtectedRoute allowedRoles={["superadmin"]}><PartnersRegistry /></ProtectedRoute>} />
<Route path="/admin/settings" element={<ProtectedRoute allowedRoles={["superadmin"]}><AdminSettings /></ProtectedRoute>} />

{/* User Profile */}
<Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
```

### Role-Based Home Redirection (`RoleHomeRedirect`)
When users authenticate and navigate to `/`, they are automatically routed to their department home:
* **`superadmin`** $\rightarrow$ `/admin`
* **`sales_manager`** $\rightarrow$ `/sales`
* **`hkc_docs_manager`** $\rightarrow$ `/sales/hkc-docs`
* **`inventory_admin`** $\rightarrow$ `/inventory`
* **`finance_manager`** $\rightarrow$ `/finance`
* **`hr_manager`** $\rightarrow$ `/hr`

### Top Menu Navigation Filtering (`src/components/FloatingNav.tsx`)
Top navigation items are dynamically filtered against the active user's roles:

```typescript
const sectionRoleMapping: Record<string, Role[]> = {
  Sales: ["superadmin", "sales_manager"],
  "HKC Docs": ["superadmin", "hkc_docs_manager"],
  Inventory: ["superadmin", "inventory_admin"],
  Finance: ["superadmin", "finance_manager"],
  HR: ["superadmin", "hr_manager"],
  Admin: ["superadmin"],
}
```

---

## 4. User Administration & Security UI (`src/pages/admin/UserManagement.tsx`)

1. **Super Admin Role Exclusivity**:
   - Checking the **Super Admin** role prompts a safety confirmation. When confirmed, all subordinate role checkboxes are automatically disabled and unchecked.
2. **Password Strength & Validation**:
   - Password fields feature an interactive visibility toggle.
   - Real-time strength calculation displays a visual progress bar (Weak $\rightarrow$ Medium $\rightarrow$ Strong).
   - Creation and updates enforce a minimum 10-character strong password (letters, uppercase, lowercase, numbers, and symbols).
3. **Backend Password Hashing**:
   - All password writes and resets are securely hashed using `bcrypt` / `argon2` before writing to the MySQL `users` table.

---

## 5. Activity Logger & Audit Trail (`src/pages/ControlCenter.tsx`)

### Database Model
The `user_activity_logs` table records state-modifying actions:
* **Columns**: `id`, `user_id`, `username`, `fullname`, `action` (Create / Update / Delete / Post / Login), `resource`, `details` (JSON payload with path, IP, diffs), `created_at`.

### Middleware Logging (`server/index.js` & `server/logger.js`)
* State mutations (POST, PUT, PATCH, DELETE) across `/api/*` endpoints are automatically captured by the Express logging middleware.
* User logins and token renewals are recorded via `server/modules/auth/authController.js`.
* Audit log viewing (`/api/user_activity_logs`) is restricted strictly to `superadmin`.

### Control Center Audit Dashboard
The Control Center (`/admin`) provides interactive filtering for `superadmin`:
* Filter by **User**, **Resource**, **Action Type**, and **Date Range**.
* **View Module** button provides direct navigation to the affected resource.
