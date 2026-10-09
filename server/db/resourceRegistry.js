const jsonb = { storage: "jsonb_document" }
const relational = { storage: "relational" }

export const resources = {
  // Inventory (9 Relational Tables)
  warehouses: { table: "warehouses", module: "inventory", ...relational },
  export_products: { table: "export_products", module: "inventory", ...relational },
  export_warehouse_movements: { table: "export_warehouse_movements", module: "inventory", ...relational },
  pharma_products: { table: "pharma_products", module: "inventory", ...relational },
  pharma_product_batches: { table: "pharma_product_batches", module: "inventory", ...relational },
  quarantine_records: { table: "quarantine_records", module: "inventory", ...relational },
  stock_movements: { table: "stock_movements", module: "inventory", ...relational },
  store_transfers: { table: "store_transfers", module: "inventory", ...relational },
  store_transfer_items: { table: "store_transfer_items", module: "inventory", ...relational },

  // Sales & Purchasing (9 Relational Tables)
  sales_orders: { table: "sales_orders", module: "sales", ...relational },
  purchase_orders: { table: "purchase_orders", module: "sales", ...relational },
  sales_issues: { table: "sales_issues", module: "sales", ...relational },
  sales_issue_items: { table: "sales_issue_items", module: "sales", ...relational },
  customers: { table: "customers", module: "sales", ...relational },
  suppliers: { table: "suppliers", module: "sales", ...relational },
  processing_services: { table: "processing_services", module: "sales", ...relational },

  // HKC Export & Shipment Documentation (2 Relational Tables)
  shipment_documents: { table: "shipment_documents", module: "hkc_docs", ...relational },
  hkc_doc_records: { table: "hkc_doc_records", module: "hkc_docs", ...relational },

  // Finance & GL (9 Relational Tables + 1 Config Singleton)
  chart_of_accounts: { table: "chart_of_accounts", module: "finance", ...relational },
  gl_account_mappings: { table: "gl_account_mappings", module: "finance", ...relational },
  journal_entries: { table: "journal_entries", module: "finance", ...relational },
  journal_entry_lines: { table: "journal_entry_lines", module: "finance", ...relational },
  invoices: { table: "invoices", module: "finance", ...relational },
  payments: { table: "payments", module: "finance", ...relational },
  expenses: { table: "expenses", module: "finance", ...relational },
  tax_rules: { table: "tax_rules", module: "finance", ...relational },
  company_settings: { table: "company_settings", module: "finance", ...jsonb },

  // HR & Payroll (5 Relational Tables)
  employees: { table: "employees", module: "hr", ...relational },
  attendance_records: { table: "attendance_records", module: "hr", ...relational },
  payroll_periods: { table: "payroll_periods", module: "hr", ...relational },
  payroll_records: { table: "payroll_records", module: "hr", ...relational },
  leave_requests: { table: "leave_requests", module: "hr", ...relational },

  // Admin & Security (4 Relational Tables)
  users: { table: "users", module: "admin", ...relational },
  user_activity_logs: { table: "user_activity_logs", module: "admin", ...relational },
  user_sessions: { table: "user_sessions", module: "admin", ...relational },
  deletion_requests: { table: "deletion_requests", module: "admin", ...relational },
}

export function getResource(name) {
  return resources[name] || null
}

export function listResources() {
  return Object.entries(resources).map(([name, value]) => ({ name, ...value }))
}
