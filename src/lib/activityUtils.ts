export interface UserActivityLog {
  id: string
  user_id: string | null
  username: string
  fullname?: string
  action: string
  resource: string
  module?: string
  entity_type?: string
  entity_id?: string
  details?: {
    path?: string
    ip?: string
    itemId?: string
    description?: string
    activityType?: string
    targetName?: string
    customer?: string
    customer_name?: string
    supplier?: string
    supplier_name?: string
    name?: string
    product?: string
    product_name?: string
    warehouse?: string
    total_amount?: number | string
    amount?: number | string
    quantity?: number | string
    category?: string
    full_name?: string
    employee_name?: string
    username?: string
    note?: string
    [key: string]: any
  }
  created_at: string
}

export interface EmployeeLookupItem {
  id: string
  full_name?: string
  fullname?: string
  name?: string
  first_name?: string
  last_name?: string
  employee_number?: string
}

export function isAutoSyncActivityLog(log: UserActivityLog): boolean {
  const res = (log.resource || log.module || "").toLowerCase().replace(/-/g, "_")
  const path = (log.details?.path || "").toLowerCase()
  const desc = (log.details?.description || "").toLowerCase()

  // Automated table seeding / bulk sync on initial load
  if (
    (res === "chart_of_accounts" || res === "tax_rules" || res === "gl_account_mappings" || res === "tax_types") &&
    (!log.entity_id && !log.details?.itemId) &&
    (path === "/api/chart_of_accounts" || path === "/api/tax_rules" || path === "/api/gl_account_mappings" || path === "/api/tax_types") &&
    (desc === "updated chart of accounts" || desc === "updated tax rules" || desc === "updated gl account mappings" || desc === "updated tax types" || !desc)
  ) {
    return true
  }

  return false
}

export function resolveActivityDetails(
  log: UserActivityLog,
  employees?: EmployeeLookupItem[]
): {
  activityType: string
  description: string
  targetName?: string
} {
  // Helper to replace any employee UUID with their full name
  const resolveEmpName = (text: string): string => {
    if (!text) return text
    let updated = text
    if (employees && employees.length > 0) {
      for (const emp of employees) {
        if (!emp) continue
        const empName =
          emp.full_name ||
          emp.fullname ||
          emp.name ||
          [emp.first_name, emp.last_name].filter(Boolean).join(" ") ||
          emp.employee_number
        if (!empName) continue

        if (emp.id) {
          const idStr = String(emp.id).trim()
          if (idStr && updated.includes(idStr)) {
            updated = updated.split(idStr).join(empName)
          }
        }
        if (emp.employee_number) {
          const numStr = String(emp.employee_number).trim()
          if (numStr && updated.includes(numStr)) {
            updated = updated.split(numStr).join(empName)
          }
        }
      }
    }
    return updated
  }

  // If already pre-computed and stored by backend
  if (log.details?.description && log.details?.activityType) {
    const rawDesc = log.details.description
    const rawTarget = log.details.targetName
    return {
      activityType: log.details.activityType,
      description: resolveEmpName(rawDesc),
      targetName: rawTarget ? resolveEmpName(rawTarget) : rawTarget,
    }
  }


  const rawAction = (log.action || "").trim()
  const rawResource = (log.resource || log.module || "").trim().toLowerCase().replace(/-/g, "_")
  const normAction = rawAction.toLowerCase()
  const d = log.details || {}
  const itemId = d.itemId || log.entity_id || ""

  // 1. Sales Orders (Ordered)
  if (rawResource === "sales_orders" || rawResource === "sales_order") {
    const cust = d.customer || d.customer_name || d.targetName || ""
    const amt = d.total_amount ? ` (${Number(d.total_amount).toLocaleString()} ETB)` : ""
    if (normAction.includes("create") || normAction.includes("order")) {
      return {
        activityType: "Ordered",
        description: `Created Sales Order ${itemId ? `#${itemId}` : ""}${cust ? ` for ${cust}` : ""}${amt}`.trim(),
        targetName: cust || itemId,
      }
    }
    if (normAction.includes("update") || normAction.includes("edit") || normAction.includes("patch")) {
      return {
        activityType: "Edited Order",
        description: `Updated Sales Order ${itemId ? `#${itemId}` : ""}${cust ? ` (${cust})` : ""}`.trim(),
        targetName: cust || itemId,
      }
    }
    if (normAction.includes("delete") || normAction.includes("cancel")) {
      return {
        activityType: "Cancelled Order",
        description: `Cancelled Sales Order ${itemId ? `#${itemId}` : ""}`.trim(),
        targetName: itemId,
      }
    }
  }

  // 2. Purchase Orders (Purchased)
  if (rawResource === "purchase_orders" || rawResource === "purchase_order") {
    const supp = d.supplier || d.supplier_name || d.targetName || ""
    const amt = d.total_amount ? ` (${Number(d.total_amount).toLocaleString()} ETB)` : ""
    if (normAction.includes("create") || normAction.includes("order")) {
      return {
        activityType: "Purchase Order",
        description: `Created Purchase Order ${itemId ? `#${itemId}` : ""}${supp ? ` from ${supp}` : ""}${amt}`.trim(),
        targetName: supp || itemId,
      }
    }
    return {
      activityType: "Edited PO",
      description: `Updated Purchase Order ${itemId ? `#${itemId}` : ""}`.trim(),
      targetName: itemId,
    }
  }

  // 3. Sales Issues (Issued Goods / Dispatch)
  if (rawResource === "sales_issues" || rawResource === "sales_issue" || rawResource === "sales_issue_items") {
    const cust = d.customer || d.customer_name || ""
    const wh = d.warehouse || ""
    if (normAction.includes("post") || normAction.includes("dispatch")) {
      return {
        activityType: "Issued Goods",
        description: `Dispatched & posted Sales Issue ${itemId ? `#${itemId}` : ""}${cust ? ` to ${cust}` : ""}${wh ? ` from ${wh}` : ""}`.trim(),
        targetName: cust || itemId,
      }
    }
    if (normAction.includes("create") || normAction.includes("issue")) {
      return {
        activityType: "Issued Goods",
        description: `Issued Sales Goods ${itemId ? `#${itemId}` : ""}${cust ? ` to ${cust}` : ""}${wh ? ` from ${wh}` : ""}`.trim(),
        targetName: cust || itemId,
      }
    }
    return {
      activityType: "Edited Issue",
      description: `Updated Sales Issue ${itemId ? `#${itemId}` : ""}`.trim(),
      targetName: itemId,
    }
  }

  // 4. Invoices & Payments (Sale / Invoice / Receipt)
  if (rawResource === "invoices" || rawResource === "invoice") {
    const cust = d.customer || d.customer_name || ""
    const amt = d.total_amount ? ` (${Number(d.total_amount).toLocaleString()} ETB)` : ""
    if (normAction.includes("create")) {
      return {
        activityType: "Sale / Invoice",
        description: `Issued Customer Invoice ${itemId ? `#${itemId}` : ""}${cust ? ` for ${cust}` : ""}${amt}`.trim(),
        targetName: cust || itemId,
      }
    }
    return {
      activityType: "Edited Invoice",
      description: `Updated Invoice ${itemId ? `#${itemId}` : ""}`.trim(),
      targetName: itemId,
    }
  }

  if (rawResource === "payments" || rawResource === "payment") {
    const amt = d.amount ? `: ${Number(d.amount).toLocaleString()} ETB` : ""
    if (normAction.includes("create")) {
      return {
        activityType: "Sale Payment",
        description: `Recorded Sale Payment ${itemId ? `#${itemId}` : ""}${amt}`.trim(),
        targetName: itemId,
      }
    }
    return {
      activityType: "Edited Payment",
      description: `Updated Payment Record ${itemId ? `#${itemId}` : ""}`.trim(),
      targetName: itemId,
    }
  }

  // 5. Stock & Inventory (Stock Intake, Movements, Product Registry, Transfers)
  if (rawResource === "stock_movements" || rawResource === "export_warehouse_movements") {
    const pName = d.product_name || d.product || ""
    const qty = d.quantity ? ` (${d.quantity} units)` : ""
    const wh = d.warehouse ? ` at ${d.warehouse}` : ""
    return {
      activityType: "Stock Movement",
      description: `Recorded Stock Movement${pName ? ` for ${pName}` : ""}${qty}${wh}`.trim(),
      targetName: pName,
    }
  }

  if (rawResource === "store_transfers" || rawResource === "store_transfer_items") {
    return {
      activityType: "Stock Transfer",
      description: `Store Transfer ${itemId ? `#${itemId}` : "movement between warehouses"}`.trim(),
      targetName: itemId,
    }
  }

  if (rawResource.includes("product") || rawResource === "inventory_products" || rawResource === "export_products" || rawResource === "pharma_products") {
    const pName = d.name || d.product_name || itemId || ""
    const wh = d.warehouse ? ` at ${d.warehouse}` : ""
    if (normAction.includes("create")) {
      return {
        activityType: "Registered Product",
        description: `Registered product into stock: ${pName}${wh}`.trim(),
        targetName: pName,
      }
    }
    if (normAction.includes("update") || normAction.includes("edit") || normAction.includes("patch") || normAction.includes("price")) {
      return {
        activityType: "Edited Stock",
        description: `Updated stock/pricing for ${pName}${wh}`.trim(),
        targetName: pName,
      }
    }
    if (normAction.includes("delete")) {
      return {
        activityType: "Deleted Stock",
        description: `Removed product ${pName} from inventory`.trim(),
        targetName: pName,
      }
    }
  }

  // 6. Customers, Suppliers, Partners
  if (rawResource === "customers" || rawResource === "customer") {
    const name = d.name || d.company_name || itemId || ""
    if (normAction.includes("create")) {
      return {
        activityType: "Registered Customer",
        description: `Registered new customer: ${name}`.trim(),
        targetName: name,
      }
    }
    return {
      activityType: "Edited Customer",
      description: `Updated customer profile: ${name}`.trim(),
      targetName: name,
    }
  }

  if (rawResource === "suppliers" || rawResource === "supplier") {
    const name = d.name || d.company_name || itemId || ""
    if (normAction.includes("create")) {
      return {
        activityType: "Registered Supplier",
        description: `Registered new supplier: ${name}`.trim(),
        targetName: name,
      }
    }
    return {
      activityType: "Edited Supplier",
      description: `Updated supplier profile: ${name}`.trim(),
      targetName: name,
    }
  }

  if (rawResource === "partners" || rawResource === "partner") {
    const name = d.name || d.company_name || itemId || ""
    if (normAction.includes("create")) {
      return {
        activityType: "Registered Partner",
        description: `Registered partner directory: ${name}`.trim(),
        targetName: name,
      }
    }
    return {
      activityType: "Edited Partner",
      description: `Updated partner profile: ${name}`.trim(),
      targetName: name,
    }
  }

  // 7. HR & Personnel
  if (rawResource === "employees" || rawResource === "employee") {
    let name = d.full_name || d.fullname || d.employee_name || itemId || ""
    name = resolveEmpName(name)
    if (normAction.includes("create")) {
      return {
        activityType: "Registered Employee",
        description: `Registered new employee: ${name}`.trim(),
        targetName: name,
      }
    }
    return {
      activityType: "Edited Employee",
      description: `Updated employee record for ${name}`.trim(),
      targetName: name,
    }
  }

  if (rawResource === "payroll_records" || rawResource === "payroll_periods") {
    return {
      activityType: "Processed Payroll",
      description: "Processed monthly payroll records",
    }
  }

  if (rawResource === "leave_requests" || rawResource === "leave_types") {
    return {
      activityType: "Leave Request",
      description: resolveEmpName(`Leave request ${itemId ? `#${itemId}` : "entry"}`),
    }
  }

  if (rawResource === "attendance_records") {
    return {
      activityType: "Attendance Log",
      description: "Saved employee daily attendance log",
    }
  }

  // 8. HKC Export Documentation & Shipments
  if (rawResource === "hkc_doc_records" || rawResource === "shipment_documents" || rawResource === "processing_services") {
    if (normAction.includes("create")) {
      return {
        activityType: "Export Dossier",
        description: `Created export compliance documentation ${itemId ? `#${itemId}` : ""}`.trim(),
        targetName: itemId,
      }
    }
    return {
      activityType: "Edited Dossier",
      description: `Updated export compliance documentation ${itemId ? `#${itemId}` : ""}`.trim(),
      targetName: itemId,
    }
  }

  // 9. Finance & Expenses
  if (rawResource === "expenses" || rawResource === "recurring_expense_schedules") {
    const cat = d.category || d.description || ""
    const amt = d.amount ? ` (${Number(d.amount).toLocaleString()} ETB)` : ""
    if (normAction.includes("create")) {
      return {
        activityType: "Recorded Expense",
        description: `Recorded expense claim: ${cat}${amt}`.trim(),
        targetName: cat,
      }
    }
    return {
      activityType: "Edited Expense",
      description: `Updated expense claim: ${cat}`.trim(),
      targetName: cat,
    }
  }

  if (rawResource === "journal_entries" || rawResource === "journal_entry_lines") {
    return {
      activityType: "Journal Entry",
      description: `Posted General Journal entry ${itemId ? `#${itemId}` : ""}`.trim(),
      targetName: itemId,
    }
  }

  // 10. Users & Security
  if (rawResource === "users") {
    const u = d.username || itemId || ""
    if (normAction.includes("create")) {
      return {
        activityType: "Registered User",
        description: `Created user account @${u}`.trim(),
        targetName: `@${u}`,
      }
    }
    return {
      activityType: "Edited User",
      description: `Updated user account @${u}`.trim(),
      targetName: `@${u}`,
    }
  }

  if (normAction.includes("password")) {
    return {
      activityType: "Security",
      description: "Changed user account security password",
    }
  }

  if (rawResource === "auth" || normAction.includes("login")) {
    return {
      activityType: "Authentication",
      description: "User authenticated & logged into system",
    }
  }

  if (normAction.includes("logout") || normAction.includes("sign out")) {
    return {
      activityType: "Authentication",
      description: "User logged out of HKC ERP session",
    }
  }

  // Fallback
  return {
    activityType: rawAction || "Activity",
    description: resolveEmpName(d.description || `${rawAction} on ${rawResource.replace(/_/g, " ")}${itemId ? ` #${itemId}` : ""}`),
    targetName: itemId ? resolveEmpName(itemId) : itemId,
  }
}

export function getActionBadgeStyle(activityType: string): string {
  const norm = (activityType || "").toLowerCase()
  if (norm.includes("order")) return "bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
  if (norm.includes("issue") || norm.includes("dispatch")) return "bg-sky-50 text-sky-800 border-sky-300/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
  if (norm.includes("sale") || norm.includes("invoice") || norm.includes("payment")) return "bg-emerald-50 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
  if (norm.includes("stock") || norm.includes("transfer")) return "bg-teal-50 text-teal-800 border-teal-300/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
  if (norm.includes("register") || norm.includes("create")) return "bg-indigo-50 text-indigo-800 border-indigo-300/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
  if (norm.includes("edit") || norm.includes("update")) return "bg-blue-50 text-blue-800 border-blue-300/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
  if (norm.includes("payroll") || norm.includes("expense") || norm.includes("journal")) return "bg-violet-50 text-violet-800 border-violet-300/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800"
  if (norm.includes("auth") || norm.includes("login") || norm.includes("security")) return "bg-purple-50 text-purple-800 border-purple-300/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
  if (norm.includes("cancel") || norm.includes("delete") || norm.includes("reject")) return "bg-rose-50 text-rose-800 border-rose-300/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
  return "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
}
