import { mysqlTable, varchar, timestamp, json } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

export const companySettings = mysqlTable("company_settings", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const chartOfAccounts = mysqlTable("chart_of_accounts", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
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
