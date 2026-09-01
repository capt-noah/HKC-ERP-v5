# Authorization Guide: Roles, Routes, and User Administration

This document describes the role-based access control (RBAC), routing guards, database schema changes, and user management rules implemented in the ERP system. Please review these specifications before making changes to authentication, scoping, or user authorization flows.

---

## 1. Access Control Roles

The single `sales_hr_manager` role has been split into two independent access roles to isolate sales operations from HR management.

### Active Roles List
* **`superadmin`**: Full system access. Bypasses warehouse scopes and has access to all modules, including the Admin dashboard.
* **`sales_manager`**: Access to the Sales Dashboard, issued credit sales, sales orders, purchase orders, and quotations.
* **`hr_manager`**: Access to the HR Dashboard, employee directory, attendance registers, leave requests, and payroll modules.
* **`inventory_admin`**: Access to product stock registers, reports, and stock transfer movements. Heavily constrained by assigned warehouse scopes.
* **`finance_manager`**: Access to accounting period ledgers, invoices, payment logs, fixed assets, and tax regulations.
* **`hkc_docs_manager`**: Access to trade documents, checklists, and sales registers.

---

## 2. Multi-Warehouse Scoping (`warehouse_ids`)

### Database Migration
The `public.users` table column `warehouse_id` (single string value) was dropped and replaced with `warehouse_ids` (`text[]` array).
* Users with the `inventory_admin` role can be assigned to multiple operating warehouses (e.g., `["WH1-AGRI-EXP", "WH2-VET-IND"]`).
* If an inventory admin is assigned to one or more warehouses, they will only see data (products, stock items, and movements) belonging to those warehouses.
* **Superadmins** bypass this check and see all data.

### Warehouse ID/Code Resolver
To prevent mismatch issues (some parts of the database reference warehouses by ID like `"WH1"`, while others use codes like `"WH1-AGRI-EXP"`), the frontend uses a resolver to map inputs to both matching IDs and codes:
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
Always use `resolvedWarehouseIds` when filtering lists or checking user access on the client.

---

## 3. Router Guards & Navigation Mappings

### Client-Side Routes (`App.tsx`)
Routes are guarded in [`src/App.tsx`](file:///Users/menelikalemayehu/Documents/HKC-ERP-V4/src/App.tsx) using the `<ProtectedRoute>` component by specifying `allowedRoles`:
```tsx
// Sales guarded for sales_manager, hkc_docs_manager and superadmin
<Route path="/sales" element={<ProtectedRoute allowedRoles={["superadmin", "sales_manager", "hkc_docs_manager"]}><SalesDashboard /></ProtectedRoute>} />

// HR guarded for hr_manager and superadmin
<Route path="/hr" element={<ProtectedRoute allowedRoles={["superadmin", "hr_manager"]}><HRDashboard /></ProtectedRoute>} />
```

### Menu Filtering (`FloatingNav.tsx`)
Top navigation menus are filtered in [`src/components/FloatingNav.tsx`](file:///Users/menelikalemayehu/Documents/HKC-ERP-V4/src/components/FloatingNav.tsx) using the `sectionRoleMapping` rules:
```typescript
const sectionRoleMapping: Record<string, Role[]> = {
  Sales: ["superadmin", "sales_manager", "hkc_docs_manager"],
  "HKC Docs": ["superadmin", "sales_manager", "hkc_docs_manager"],
  Inventory: ["superadmin", "inventory_admin"],
  Finance: ["superadmin", "finance_manager"],
  HR: ["superadmin", "hr_manager"],
  Admin: ["superadmin"],
}
```

---

## 4. User Administration UI & Security

### Checkbox Constraints & Confirmations
In [`src/pages/admin/UserManagement.tsx`](file:///Users/menelikalemayehu/Documents/HKC-ERP-V4/src/pages/admin/UserManagement.tsx):
* Checking the **Super Admin** role displays a confirmation prompt: *"You have selected super admin this will give full access are you sure?"*
* If checked, all other role checkbox inputs are disabled.

### Password Strength Check
* **Password Visibility**: Visibility toggle ("eye" icon) has been added to password fields inside both creation and edit dialogs.
* **Password Strength Check**: Real-time strength estimation is displayed via a progress bar (Red = Weak, Yellow = Medium, Green = Strong). 
* **Submit Constraint**: Form submission is disabled unless the password meets `"Strong"` criteria (minimum 10 characters combining uppercase, lowercase, numbers, and special symbols).
* **Backend Hashing**: Any password changes sent to the general PATCH `/api/users/:id` endpoint are intercepted in the router and hashed using `bcrypt` before being stored.

---

## 5. Activity Logger & Control Center Audit Trail

### Database Table
The `public.user_activity_logs` table records state-modifying actions in the database:
* **Columns**: `id` (uuid), `user_id` (uuid references users), `username` (text), `fullname` (text), `action` (text), `resource` (text), `details` (jsonb), `created_at` (timestamptz).

### Backend Middleware & Auth Hook
* **Automatic Logging**: The Express `activityLoggerMiddleware` in [`server/modules/common/activityLogger.js`](file:///Users/menelikalemayehu/Documents/HKC-ERP-V4/server/modules/common/activityLogger.js) intercepts POST, PUT, PATCH, and DELETE requests on the API, parsing the resource and specific action, logging details (path, IP address, and changed items).
* **Manual Logging**: Logins are manually recorded in the user login controller [`authController.js`](file:///Users/menelikalemayehu/Documents/HKC-ERP-V4/server/modules/auth/authController.js).
* **Security Guard**: The route `/api/user_activity_logs` is protected by `authorizeRoles("superadmin")` to prevent unauthorized access.

### Control Center Dashboard
The Control Center page at [`src/pages/ControlCenter.tsx`](file:///Users/menelikalemayehu/Documents/HKC-ERP-V4/src/pages/ControlCenter.tsx) is split into two tabs:
1. **System Overview**: Displays core totals (revenue, inventory value, low stock count, employee count) and recent transactions.
2. **Audit Activity Logs**: Displays the database audit logs. Superadmins can filter logs dynamically by:
   * Operator User
   * Affected Module / Resource
   * Action Type (Create, Update, Delete, Login, etc.)
   * Date Timeframe (Today, Yesterday, Last 7/30 days)
   * Free-text search
* **View Module Redirection**: Logs include a **View Module** navigation shortcut mapping the resource name to its respective client-side route.

