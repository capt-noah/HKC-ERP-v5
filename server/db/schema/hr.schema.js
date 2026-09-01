import { mysqlTable, varchar, timestamp, json } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

export const employees = mysqlTable("employees", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const attendanceRecords = mysqlTable("attendance_records", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const payrollPeriods = mysqlTable("payroll_periods", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const payrollRecords = mysqlTable("payroll_records", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const leaveTypes = mysqlTable("leave_types", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const leaveRequests = mysqlTable("leave_requests", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Drizzle Relations
export const employeesRelations = relations(employees, ({ many }) => ({
  attendance: many(attendanceRecords),
  payrollRecords: many(payrollRecords),
  leaveRequests: many(leaveRequests),
}))

export const payrollPeriodsRelations = relations(payrollPeriods, ({ many }) => ({
  records: many(payrollRecords),
}))

export const leaveTypesRelations = relations(leaveTypes, ({ many }) => ({
  requests: many(leaveRequests),
}))
