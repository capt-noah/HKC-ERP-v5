import { mysqlTable, varchar, boolean, timestamp, json } from "drizzle-orm/mysql-core"
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
}))

export const userActivityLogsRelations = relations(userActivityLogs, ({ one }) => ({
  user: one(users, {
    fields: [userActivityLogs.userId],
    references: [users.id],
  }),
}))
