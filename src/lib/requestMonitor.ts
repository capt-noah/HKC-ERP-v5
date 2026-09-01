import { useAuthStore, type Role } from "./authStore"

export interface RequestMetric {
  id: string
  url: string
  resourceName: string
  method: string
  status: number
  durationMs: number
  timestamp: string
  roleStatus: "AUTHORIZED" | "UNAUTHORIZED_FOR_ROLE" | "UNAUTHENTICATED"
  userRoles: Role[]
  initiatedBy: string
}

type Listener = (metrics: RequestMetric[]) => void

const RESOURCE_MODULE_MAP: Record<string, string> = {
  warehouses: "inventory",
  inventory_products: "inventory",
  bin_cards: "inventory",
  stock_movements: "inventory",
  store_transfers: "inventory",

  sales_orders: "sales",
  customers: "sales",
  suppliers: "sales",
  sales_issues: "sales",
  processing_services: "sales",
  shipment_documents: "sales",
  hkc_doc_records: "sales",

  chart_of_accounts: "finance",
  journal_entries: "finance",
  journal_entry_lines: "finance",
  invoices: "finance",
  payments: "finance",
  expenses: "finance",
  recurring_expense_schedules: "finance",
  vehicles: "finance",
  company_settings: "finance",
  tax_rules: "finance",

  employees: "hr",
  attendance_records: "hr",
  payroll_periods: "hr",
  payroll_records: "hr",
  leave_types: "hr",
  leave_requests: "hr",

  users: "admin",
  user_activity_logs: "admin",
}

export function evaluateRoleScoping(resourceName: string, userRoles: Role[]): "AUTHORIZED" | "UNAUTHORIZED_FOR_ROLE" | "UNAUTHENTICATED" {
  if (!userRoles || userRoles.length === 0) return "UNAUTHENTICATED"
  if (userRoles.includes("superadmin")) return "AUTHORIZED"

  const mod = RESOURCE_MODULE_MAP[resourceName]
  if (!mod) return "AUTHORIZED"

  if (mod === "inventory" && userRoles.includes("inventory_admin")) return "AUTHORIZED"
  if (mod === "sales" && (userRoles.includes("sales_manager") || userRoles.includes("hkc_docs_manager"))) return "AUTHORIZED"
  if (mod === "finance" && userRoles.includes("finance_manager")) return "AUTHORIZED"
  if (mod === "hr" && userRoles.includes("hr_manager")) return "AUTHORIZED"
  if (mod === "admin" && userRoles.includes("superadmin")) return "AUTHORIZED"

  // Special cross-module allowances:
  // inventory_admin can read suppliers for GRN
  if (userRoles.includes("inventory_admin") && (resourceName === "suppliers" || resourceName === "purchase_orders")) {
    return "AUTHORIZED"
  }

  return "UNAUTHORIZED_FOR_ROLE"
}

class RequestMonitor {
  private metrics: RequestMetric[] = []
  private listeners = new Set<Listener>()
  private reloadRequestCount: number = 0

  constructor() {
    if (typeof window !== "undefined") {
      setTimeout(() => {
        this.logSummaryToConsole()
      }, 2500)
    }
  }

  public recordRequest(metric: Omit<RequestMetric, "id">) {
    const entry: RequestMetric = {
      ...metric,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }

    this.metrics.push(entry)
    this.reloadRequestCount++

    if (this.metrics.length > 100) {
      this.metrics.shift()
    }

    this.notify()
  }

  public getMetrics(): RequestMetric[] {
    return [...this.metrics]
  }

  public getReloadCount(): number {
    return this.reloadRequestCount
  }

  public clear() {
    this.metrics = []
    this.reloadRequestCount = 0
    this.notify()
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.metrics]))
  }

  public logSummaryToConsole() {
    if (typeof window === "undefined" || !import.meta.env.DEV) return
    const user = useAuthStore.getState().user
    const roles = user?.roles || []
    const total = this.metrics.length
    const unauthorized = this.metrics.filter((m) => m.roleStatus === "UNAUTHORIZED_FOR_ROLE").length
    const errors = this.metrics.filter((m) => m.status >= 400).length

    console.groupCollapsed(
      `%c[HKC Request Monitor]%c ${total} requests dispatched on reload for roles: [${roles.join(", ") || "none"}]`,
      "background: #047857; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
      "color: #10b981; font-weight: bold;"
    )
    console.log(`Total Requests: ${total} | Status Errors: ${errors} | Out-of-Role: ${unauthorized}`)
    console.table(
      this.metrics.map((m) => ({
        Method: m.method,
        Resource: m.resourceName,
        Status: m.status,
        "Duration (ms)": m.durationMs.toFixed(1),
        "Role Scoping": m.roleStatus,
      }))
    )
    console.groupEnd()
  }
}

export const requestMonitor = new RequestMonitor()
