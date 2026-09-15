import { mysqlTable, varchar, boolean, timestamp, json, text } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

export const users = mysqlTable("users", {
  id: varchar("id", { length: 191 }).primaryKey(),
  username: varchar("username", { length: 191 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("viewer").notNull(),
  roles: json("roles"),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  fullname: varchar("fullname", { length: 191 }),
  firstName: varchar("first_name", { length: 191 }),
  lastName: varchar("last_name", { length: 191 }),
  warehouseIds: json("warehouse_ids"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userSessions = mysqlTable("user_sessions", {
  id: varchar("id", { length: 191 }).primaryKey(),
  userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  deviceType: varchar("device_type", { length: 50 }).default("desktop"),
  osName: varchar("os_name", { length: 50 }),
  browserName: varchar("browser_name", { length: 50 }),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userActivityLogs = mysqlTable("user_activity_logs", {
  id: varchar("id", { length: 191 }).primaryKey(),
  userId: varchar("user_id", { length: 191 }).references(() => users.id, { onDelete: "set null" }),
  username: varchar("username", { length: 191 }).notNull(),
  action: varchar("action", { length: 191 }).notNull(),
  module: varchar("module", { length: 191 }).notNull(),
  entityType: varchar("entity_type", { length: 191 }),
  entityId: varchar("entity_id", { length: 191 }),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  activityLogs: many(userActivityLogs),
  sessions: many(userSessions),
}))

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}))

export const userActivityLogsRelations = relations(userActivityLogs, ({ one }) => ({
  user: one(users, {
    fields: [userActivityLogs.userId],
    references: [users.id],
  }),
}))

