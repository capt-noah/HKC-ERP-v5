import { mysqlTable, varchar, timestamp, boolean, decimal, text, date, int } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

export const employees = mysqlTable("employees", {
  id: varchar("id", { length: 191 }).primaryKey(),
  employeeNumber: varchar("employee_number", { length: 100 }).default("").notNull(),
  fullName: varchar("full_name", { length: 255 }).default("").notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 191 }),
  address: text("address"),
  dateOfBirth: varchar("date_of_birth", { length: 50 }),
  gender: varchar("gender", { length: 50 }),
  warehouseId: varchar("warehouse_id", { length: 191 }),
  employmentType: varchar("employment_type", { length: 50 }).default("Permanent").notNull(),
  startDate: varchar("start_date", { length: 50 }),
  basicSalary: decimal("basic_salary", { precision: 18, scale: 2 }).default("0.00").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  bankAccount: varchar("bank_account", { length: 100 }),
  emergencyContactName: varchar("emergency_contact_name", { length: 191 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 50 }),
  nationalIdImage: text("national_id_image"),
  status: varchar("status", { length: 50 }).default("Active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const attendanceRecords = mysqlTable("attendance_records", {
  id: varchar("id", { length: 191 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 191 }).default("").notNull(),
  attendanceDate: date("attendance_date").notNull(),
  checkInTime: varchar("check_in_time", { length: 50 }),
  checkOutTime: varchar("check_out_time", { length: 50 }),
  status: varchar("status", { length: 50 }).default("Present").notNull(),
  hoursWorked: decimal("hours_worked", { precision: 5, scale: 2 }).default("8.00").notNull(),
  overtimeHours: decimal("overtime_hours", { precision: 5, scale: 2 }).default("0.00").notNull(),
  warehouseId: varchar("warehouse_id", { length: 191 }),
  notes: text("notes"),
  lockedByPayroll: boolean("locked_by_payroll").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const leaveRequests = mysqlTable("leave_requests", {
  id: varchar("id", { length: 191 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 191 }).default("").notNull(),
  leaveType: varchar("leave_type", { length: 100 }).default("Annual Leave").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  numberOfDays: int("number_of_days").default(1).notNull(),
  reason: text("reason"),
  documentPath: text("document_path"),
  status: varchar("status", { length: 50 }).default("Pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const payrollPeriods = mysqlTable("payroll_periods", {
  id: varchar("id", { length: 191 }).primaryKey(),
  name: varchar("name", { length: 100 }).default("").notNull(),
  month: int("month").default(1).notNull(),
  year: int("year").default(2026).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: varchar("status", { length: 50 }).default("Draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const payrollRecords = mysqlTable("payroll_records", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payrollPeriodId: varchar("payroll_period_id", { length: 191 }).default("").notNull(),
  employeeId: varchar("employee_id", { length: 191 }).default("").notNull(),
  basicSalary: decimal("basic_salary", { precision: 18, scale: 2 }).default("0.00").notNull(),
  taxableAllowances: decimal("taxable_allowances", { precision: 18, scale: 2 }).default("0.00").notNull(),
  nonTaxableAllowances: decimal("non_taxable_allowances", { precision: 18, scale: 2 }).default("0.00").notNull(),
  allowances: decimal("allowances", { precision: 18, scale: 2 }).default("0.00").notNull(),
  overtimePay: decimal("overtime_pay", { precision: 18, scale: 2 }).default("0.00").notNull(),
  bonus: decimal("bonus", { precision: 18, scale: 2 }).default("0.00").notNull(),
  otherEarnings: decimal("other_earnings", { precision: 18, scale: 2 }).default("0.00").notNull(),
  tax: decimal("tax", { precision: 18, scale: 2 }).default("0.00").notNull(),
  pension: decimal("pension", { precision: 18, scale: 2 }).default("0.00").notNull(),
  absenceDeduction: decimal("absence_deduction", { precision: 18, scale: 2 }).default("0.00").notNull(),
  loanDeduction: decimal("loan_deduction", { precision: 18, scale: 2 }).default("0.00").notNull(),
  otherDeductions: decimal("other_deductions", { precision: 18, scale: 2 }).default("0.00").notNull(),
  grossPay: decimal("gross_pay", { precision: 18, scale: 2 }).default("0.00").notNull(),
  totalDeductions: decimal("total_deductions", { precision: 18, scale: 2 }).default("0.00").notNull(),
  netPay: decimal("net_pay", { precision: 18, scale: 2 }).default("0.00").notNull(),
  paymentStatus: varchar("payment_status", { length: 50 }).default("Pending").notNull(),
  notes: text("notes"),
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
