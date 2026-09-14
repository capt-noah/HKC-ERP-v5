const jsonb = { storage: "jsonb_document" }

export const resources = {
  // Inventory (Dedicated Relational Tables)
  warehouses: { table: "warehouses", module: "inventory", storage: "relational" },
  export_products: { table: "export_products", module: "inventory", storage: "relational" },
  pharma_products: { table: "pharma_products", module: "inventory", storage: "relational" },
  pharma_product_batches: { table: "pharma_product_batches", module: "inventory", storage: "relational" },
  stock_movements: { table: "stock_movements", module: "inventory", storage: "relational" },
  store_transfers: { table: "store_transfers", module: "inventory", storage: "relational" },
  store_transfer_items: { table: "store_transfer_items", module: "inventory", storage: "relational" },
  export_warehouse_movements: { table: "export_warehouse_movements", module: "inventory", storage: "relational" },

  // Sales & Purchasing (7)
  sales_orders: { table: "sales_orders", module: "sales", ...jsonb },
  purchase_orders: { table: "purchase_orders", module: "sales", storage: "relational" },
  sales_issues: { table: "sales_issues", module: "sales", storage: "relational" },
  sales_issue_items: { table: "sales_issue_items", module: "sales", storage: "relational" },
  customers: { table: "customers", module: "sales", ...jsonb },
  suppliers: { table: "suppliers", module: "sales", ...jsonb },
  processing_services: { table: "processing_services", module: "sales", storage: "relational" },
  shipment_documents: { table: "shipment_documents", module: "sales", storage: "relational" },
  hkc_doc_records: { table: "hkc_doc_records", module: "sales", ...jsonb },

  // Finance & GL (11)
  chart_of_accounts: { table: "chart_of_accounts", module: "finance", storage: "relational" },
  gl_account_mappings: { table: "gl_account_mappings", module: "finance", storage: "relational" },
  journal_entries: { table: "journal_entries", module: "finance", ...jsonb },
  journal_entry_lines: { table: "journal_entry_lines", module: "finance", ...jsonb },
  invoices: { table: "invoices", module: "finance", ...jsonb },
  payments: { table: "payments", module: "finance", ...jsonb },
  expenses: { table: "expenses", module: "finance", ...jsonb },
  recurring_expense_schedules: { table: "recurring_expense_schedules", module: "finance", ...jsonb },
  vehicles: { table: "vehicles", module: "finance", ...jsonb },
  company_settings: { table: "company_settings", module: "finance", ...jsonb },
  tax_rules: { table: "tax_rules", module: "finance", ...jsonb },

  // HR & Payroll (6)
  employees: { table: "employees", module: "hr", ...jsonb },
  attendance_records: { table: "attendance_records", module: "hr", ...jsonb },
  payroll_periods: { table: "payroll_periods", module: "hr", ...jsonb },
  payroll_records: { table: "payroll_records", module: "hr", ...jsonb },
  leave_types: { table: "leave_types", module: "hr", ...jsonb },
  leave_requests: { table: "leave_requests", module: "hr", ...jsonb },

  // Admin & Security (3)
  users: { table: "users", module: "admin", storage: "relational" },
  user_activity_logs: { table: "user_activity_logs", module: "admin", storage: "relational" },
  user_sessions: { table: "user_sessions", module: "admin", storage: "relational" },
}

export function getResource(name) {
  return resources[name] || null
}

export function listResources() {
  return Object.entries(resources).map(([name, value]) => ({ name, ...value }))
}
