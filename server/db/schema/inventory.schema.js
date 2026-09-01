import { mysqlTable, varchar, timestamp, json } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

export const warehouses = mysqlTable("warehouses", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const inventoryProducts = mysqlTable("inventory_products", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const stockMovements = mysqlTable("stock_movements", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const storeTransfers = mysqlTable("store_transfers", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Drizzle Relations
export const warehousesRelations = relations(warehouses, ({ many }) => ({
  products: many(inventoryProducts),
  stockMovements: many(stockMovements),
  storeTransfers: many(storeTransfers),
}))

export const inventoryProductsRelations = relations(inventoryProducts, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [inventoryProducts.id],
    references: [warehouses.id],
  }),
  stockMovements: many(stockMovements),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(inventoryProducts, {
    fields: [stockMovements.id],
    references: [inventoryProducts.id],
  }),
}))
