import { mysqlTable, varchar, timestamp, json, boolean, decimal, text, date, int } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

export const companySettings = mysqlTable("company_settings", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const chartOfAccounts = mysqlTable("chart_of_accounts", {
  id: varchar("id", { length: 191 }).primaryKey(),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 191 }),
  accountType: varchar("account_type", { length: 50 }),
  peachtreeType: varchar("peachtree_type", { length: 100 }),
  parentAccountId: varchar("parent_account_id", { length: 191 }),
  isGroup: boolean("is_group").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const glAccountMappings = mysqlTable("gl_account_mappings", {
  id: varchar("id", { length: 191 }).primaryKey(),
  label: varchar("label", { length: 191 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  accountId: varchar("account_id", { length: 191 }).notNull(),
  accountCode: varchar("account_code", { length: 50 }).notNull(),
  accountName: varchar("account_name", { length: 191 }).notNull(),
  normalPosting: varchar("normal_posting", { length: 10 }).notNull().default("Debit"),
  isSystemDefault: boolean("is_system_default").default(false).notNull(),
  description: varchar("description", { length: 255 }),
  multiAccounts: json("multi_accounts"),
  updatedBy: varchar("updated_by", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const journalEntries = mysqlTable("journal_entries", {
  id: varchar("id", { length: 191 }).primaryKey(),
  entryNumber: varchar("entry_number", { length: 100 }),
  entryDate: varchar("entry_date", { length: 50 }).notNull(),
  description: text("description"),
  sourceType: varchar("source_type", { length: 50 }).default("MANUAL").notNull(),
  sourceId: varchar("source_id", { length: 191 }),
  createdBy: varchar("created_by", { length: 191 }),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  postingStatus: varchar("posting_status", { length: 50 }).default("POSTED").notNull(),
  totalAmount: decimal("total_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  isReversalOf: varchar("is_reversal_of", { length: 191 }),
  autoReverse: boolean("auto_reverse").default(false).notNull(),
  reversalDate: varchar("reversal_date", { length: 50 }),
  reversedById: varchar("reversed_by_id", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const journalEntryLines = mysqlTable("journal_entry_lines", {
  id: varchar("id", { length: 191 }).primaryKey(),
  journalEntryId: varchar("journal_entry_id", { length: 191 }).notNull(),
  accountId: varchar("account_id", { length: 191 }).notNull(),
  accountCode: varchar("account_code", { length: 50 }),
  accountName: varchar("account_name", { length: 255 }),
  description: text("description"),
  debitAmount: decimal("debit_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  creditAmount: decimal("credit_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  warehouseId: varchar("warehouse_id", { length: 191 }),
  partyId: varchar("party_id", { length: 191 }),
  partyType: varchar("party_type", { length: 50 }),
  partyName: varchar("party_name", { length: 255 }),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  exchangeRateAtTime: decimal("exchange_rate_at_time", { precision: 18, scale: 6 }).default("1.000000").notNull(),
  isCleared: boolean("is_cleared").default(false).notNull(),
  clearedDate: varchar("cleared_date", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const invoices = mysqlTable("invoices", {
  id: varchar("id", { length: 191 }).primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).default("").notNull(),
  fsNo: varchar("fs_no", { length: 100 }),
  salesIssueId: varchar("sales_issue_id", { length: 191 }),
  salesOrderId: varchar("sales_order_id", { length: 191 }),
  customerId: varchar("customer_id", { length: 191 }),
  customerName: varchar("customer_name", { length: 255 }).default("").notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  status: varchar("status", { length: 50 }).default("Draft").notNull(),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  settlementStatus: varchar("settlement_status", { length: 50 }).default("Unsettled").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  subtotal: decimal("subtotal", { precision: 18, scale: 2 }).default("0.00").notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0.00").notNull(),
  taxAmount: decimal("tax_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  discountAmount: decimal("discount_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  totalAmount: decimal("total_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  amountPaid: decimal("amount_paid", { precision: 18, scale: 2 }).default("0.00").notNull(),
  balanceDue: decimal("balance_due", { precision: 18, scale: 2 }).default("0.00").notNull(),
  lineItems: json("line_items"),
  glDistribution: json("gl_distribution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 191 }).primaryKey(),
  direction: varchar("direction", { length: 50 }).default("Received").notNull(),
  linkedInvoiceId: varchar("linked_invoice_id", { length: 191 }),
  salesIssueId: varchar("sales_issue_id", { length: 191 }),
  salesOrderId: varchar("sales_order_id", { length: 191 }),
  purchaseOrderId: varchar("purchase_order_id", { length: 191 }),
  customerId: varchar("customer_id", { length: 191 }),
  customerName: varchar("customer_name", { length: 255 }),
  supplierId: varchar("supplier_id", { length: 191 }),
  supplierName: varchar("supplier_name", { length: 255 }),
  amount: decimal("amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  date: date("date").notNull(),
  method: varchar("method", { length: 50 }).default("Bank Transfer").notNull(),
  bankAccountCode: varchar("bank_account_code", { length: 50 }),
  reference: varchar("reference", { length: 191 }),
  paymentAdviceUrl: text("payment_advice_url"),
  paymentAdviceFilename: varchar("payment_advice_filename", { length: 255 }),
  installmentNo: int("installment_no"),
  warehouseId: varchar("warehouse_id", { length: 191 }),
  arAccountCode: varchar("ar_account_code", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const expenses = mysqlTable("expenses", {
  id: varchar("id", { length: 191 }).primaryKey(),
  merchant: varchar("merchant", { length: 255 }).default("").notNull(),
  category: varchar("category", { length: 100 }).default("Office Expense").notNull(),
  date: date("date").notNull(),
  employee: varchar("employee", { length: 191 }),
  amount: decimal("amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(),
  costCenter: varchar("cost_center", { length: 100 }),
  glAccountId: varchar("gl_account_id", { length: 191 }),
  paymentAccountId: varchar("payment_account_id", { length: 191 }),
  paymentMethod: varchar("payment_method", { length: 50 }).default("Cash").notNull(),
  receiptRef: varchar("receipt_ref", { length: 191 }),
  chequeNo: varchar("cheque_no", { length: 191 }),
  applyVat: boolean("apply_vat").default(false).notNull(),
  taxAmount: decimal("tax_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  applyWht: boolean("apply_wht").default(false).notNull(),
  whtAmount: decimal("wht_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
  whtRate: decimal("wht_rate", { precision: 5, scale: 2 }),
  netDisbursed: decimal("net_disbursed", { precision: 18, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const taxRules = mysqlTable("tax_rules", {
  id: varchar("id", { length: 191 }).primaryKey(),
  name: varchar("name", { length: 191 }).default("").notNull(),
  ratePercent: decimal("rate_percent", { precision: 5, scale: 2 }).default("0.00").notNull(),
  type: varchar("type", { length: 100 }).default("VAT/GST").notNull(),
  appliesTo: varchar("applies_to", { length: 50 }).default("BOTH").notNull(),
  glAccountCode: varchar("gl_account_code", { length: 50 }),
  description: text("description"),
  isDeduction: boolean("is_deduction").default(false).notNull(),
  isInclusive: boolean("is_inclusive").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Drizzle Relations
export const chartOfAccountsRelations = relations(chartOfAccounts, ({ many }) => ({
  journalLines: many(journalEntryLines),
}))

export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalEntryLines),
}))

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(chartOfAccounts, {
    fields: [journalEntryLines.accountId],
    references: [chartOfAccounts.id],
  }),
}))

export const invoicesRelations = relations(invoices, ({ many }) => ({
  payments: many(payments),
}))
