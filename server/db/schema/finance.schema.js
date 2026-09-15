import { mysqlTable, varchar, timestamp, json, boolean } from "drizzle-orm/mysql-core"
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
  payload: json("payload"),
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
  updatedBy: varchar("updated_by", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const journalEntries = mysqlTable("journal_entries", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const journalEntryLines = mysqlTable("journal_entry_lines", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const invoices = mysqlTable("invoices", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const expenses = mysqlTable("expenses", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const recurringExpenseSchedules = mysqlTable("recurring_expense_schedules", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const vehicles = mysqlTable("vehicles", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const taxRules = mysqlTable("tax_rules", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Drizzle Relations
export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalEntryLines),
}))

export const invoicesRelations = relations(invoices, ({ many }) => ({
  payments: many(payments),
}))
