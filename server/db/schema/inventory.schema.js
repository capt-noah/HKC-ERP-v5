import { mysqlTable, varchar, timestamp, decimal, text, int } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

export const warehouses = mysqlTable("warehouses", {
  id: varchar("id", { length: 191 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  location: varchar("location", { length: 255 }),
  warehouseType: varchar("warehouse_type", { length: 50 }).default("PHARMA_WH").notNull(),
  type: varchar("type", { length: 100 }),
  manager: varchar("manager", { length: 255 }),
  specialization: varchar("specialization", { length: 255 }),
  targetMarkets: varchar("target_markets", { length: 255 }),
  status: varchar("status", { length: 50 }).default("Active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Dedicated Export Commodities Table (WH1, WH4-DIRE-EXP, etc.)
export const exportProducts = mysqlTable("export_products", {
  id: varchar("id", { length: 191 }).primaryKey(),
  sku: varchar("sku", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  commodityType: varchar("commodity_type", { length: 100 }),
  category: varchar("category", { length: 100 }).default("Agricultural Commodity"),
  warehouseId: varchar("warehouse_id", { length: 191 }).notNull(),
  cropYear: varchar("crop_year", { length: 50 }),
  grade: varchar("grade", { length: 50 }),
  origin: varchar("origin", { length: 100 }),
  moistureContent: decimal("moisture_content", { precision: 5, scale: 2 }),
  cleanYieldPct: decimal("clean_yield_pct", { precision: 5, scale: 2 }),
  unit: varchar("unit", { length: 50 }).default("Quintal").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  quantitySold: decimal("quantity_sold", { precision: 18, scale: 2 }).default("0").notNull(),
  totalQuantity: decimal("total_quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  unitCost: decimal("unit_cost", { precision: 18, scale: 2 }).default("0").notNull(),
  sellingPrice: decimal("selling_price", { precision: 18, scale: 2 }).default("0").notNull(),
  totalStockValue: decimal("total_stock_value", { precision: 18, scale: 2 }).default("0").notNull(),
  reorderLevel: decimal("reorder_level", { precision: 18, scale: 2 }).default("0"),
  minStockLevel: decimal("min_stock_level", { precision: 18, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("In Stock"),
  description: text("description"),
  supplierId: varchar("supplier_id", { length: 191 }),
  supplierName: varchar("supplier_name", { length: 255 }),
  voucherNo: varchar("voucher_no", { length: 100 }),
  plateNumber: varchar("plate_number", { length: 100 }),
  driverName: varchar("driver_name", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Dedicated Pharmaceutical Products Table (WH2, WH3, WH5-HAW-VET, etc.)
export const pharmaProducts = mysqlTable("pharma_products", {
  id: varchar("id", { length: 191 }).primaryKey(),
  sku: varchar("sku", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  genericName: varchar("generic_name", { length: 255 }),
  category: varchar("category", { length: 100 }),
  subCategory: varchar("sub_category", { length: 100 }),
  warehouseId: varchar("warehouse_id", { length: 191 }).notNull(),
  batchNo: varchar("batch_no", { length: 100 }),
  mfgDate: varchar("mfg_date", { length: 50 }),
  expiryDate: varchar("expiry_date", { length: 50 }),
  dosageForm: varchar("dosage_form", { length: 100 }),
  strength: varchar("strength", { length: 100 }),
  shelfNumber: varchar("shelf_number", { length: 100 }),
  storageCondition: varchar("storage_condition", { length: 100 }),
  unit: varchar("unit", { length: 50 }).default("Box").notNull(),
  quantityPerPack: int("quantity_per_pack").default(1),
  numberOfCartons: int("number_of_cartons").default(0),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  quantitySold: decimal("quantity_sold", { precision: 18, scale: 2 }).default("0").notNull(),
  totalQuantity: decimal("total_quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  unitCost: decimal("unit_cost", { precision: 18, scale: 2 }).default("0").notNull(),
  sellingPrice: decimal("selling_price", { precision: 18, scale: 2 }).default("0").notNull(),
  totalStockValue: decimal("total_stock_value", { precision: 18, scale: 2 }).default("0").notNull(),
  reorderLevel: decimal("reorder_level", { precision: 18, scale: 2 }).default("0"),
  minStockLevel: decimal("min_stock_level", { precision: 18, scale: 2 }).default("0"),
  shelfLifeMonths: int("shelf_life_months"),
  status: varchar("status", { length: 50 }).default("In Stock"),
  description: text("description"),
  supplierId: varchar("supplier_id", { length: 191 }),
  supplierName: varchar("supplier_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Dedicated Pharma Batch Lots Table
export const pharmaProductBatches = mysqlTable("pharma_product_batches", {
  id: varchar("id", { length: 191 }).primaryKey(),
  productId: varchar("product_id", { length: 191 }).notNull(),
  warehouseId: varchar("warehouse_id", { length: 191 }).notNull(),
  batchNo: varchar("batch_no", { length: 100 }).notNull(),
  mfgDate: varchar("mfg_date", { length: 50 }),
  expiryDate: varchar("expiry_date", { length: 50 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  unitCost: decimal("unit_cost", { precision: 18, scale: 2 }).default("0"),
  qaStatus: varchar("qa_status", { length: 50 }).default("Released").notNull(),
  location: varchar("location", { length: 100 }),
  notes: varchar("notes", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const stockMovements = mysqlTable("stock_movements", {
  id: varchar("id", { length: 191 }).primaryKey(),
  productId: varchar("product_id", { length: 191 }).notNull(),
  warehouseId: varchar("warehouse_id", { length: 191 }).notNull(),
  movementType: varchar("movement_type", { length: 50 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  unitCost: decimal("unit_cost", { precision: 18, scale: 2 }).default("0"),
  unitPrice: decimal("unit_price", { precision: 18, scale: 2 }).default("0"),
  balanceAfter: decimal("balance_after", { precision: 18, scale: 2 }).default("0").notNull(),
  batchNo: varchar("batch_no", { length: 100 }),
  expiryDate: varchar("expiry_date", { length: 50 }),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: varchar("reference_id", { length: 191 }),
  notes: text("notes"),
  performedBy: varchar("performed_by", { length: 191 }),
  movementDate: varchar("movement_date", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const storeTransfers = mysqlTable("store_transfers", {
  id: varchar("id", { length: 191 }).primaryKey(),
  transferNo: varchar("transfer_no", { length: 100 }).notNull(),
  fromWarehouseId: varchar("from_warehouse_id", { length: 191 }).notNull(),
  toWarehouseId: varchar("to_warehouse_id", { length: 191 }).notNull(),
  status: varchar("status", { length: 50 }).default("Draft").notNull(),
  requestedBy: varchar("requested_by", { length: 191 }),
  approvedBy: varchar("approved_by", { length: 191 }),
  requestDate: varchar("request_date", { length: 50 }).notNull(),
  completedDate: varchar("completed_date", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const storeTransferItems = mysqlTable("store_transfer_items", {
  id: varchar("id", { length: 191 }).primaryKey(),
  transferId: varchar("transfer_id", { length: 191 }).notNull(),
  productId: varchar("product_id", { length: 191 }).notNull(),
  productName: varchar("product_name", { length: 255 }),
  batchNo: varchar("batch_no", { length: 100 }),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  uom: varchar("uom", { length: 50 }),
  unitCost: decimal("unit_cost", { precision: 18, scale: 2 }).default("0"),
  notes: varchar("notes", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const exportWarehouseMovements = mysqlTable("export_warehouse_movements", {
  id: varchar("id", { length: 191 }).primaryKey(),
  warehouseId: varchar("warehouse_id", { length: 191 }).notNull(),
  productId: varchar("product_id", { length: 191 }).notNull(),
  movementType: varchar("movement_type", { length: 50 }).notNull(),
  voucherNo: varchar("voucher_no", { length: 100 }),
  batchNo: varchar("batch_no", { length: 100 }),
  partyName: varchar("party_name", { length: 255 }),
  plateNumber: varchar("plate_number", { length: 100 }),
  grossQuantity: decimal("gross_quantity", { precision: 18, scale: 2 }).default("0"),
  rejectQuantity: decimal("reject_quantity", { precision: 18, scale: 2 }).default("0"),
  netQuantity: decimal("net_quantity", { precision: 18, scale: 2 }).default("0"),
  uom: varchar("uom", { length: 50 }).default("Quintal"),
  unitPrice: decimal("unit_price", { precision: 18, scale: 2 }).default("0"),
  sellingPrice: decimal("selling_price", { precision: 18, scale: 2 }),
  movementDate: varchar("movement_date", { length: 50 }),
  reason: text("reason"),
  createdBy: varchar("created_by", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const quarantineRecords = mysqlTable("quarantine_records", {
  id: varchar("id", { length: 191 }).primaryKey(),
  warehouseId: varchar("warehouse_id", { length: 191 }).notNull(),
  productId: varchar("product_id", { length: 191 }).notNull(),
  productName: varchar("product_name", { length: 255 }),
  sku: varchar("sku", { length: 100 }),
  batchNo: varchar("batch_no", { length: 100 }),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("0").notNull(),
  unit: varchar("unit", { length: 50 }).default("Box"),
  quarantineDate: varchar("quarantine_date", { length: 50 }).notNull(),
  proposedReleaseDate: varchar("proposed_release_date", { length: 50 }),
  status: varchar("status", { length: 50 }).default("Quarantined").notNull(),
  reason: varchar("reason", { length: 255 }),
  nameEntered: varchar("name_entered", { length: 191 }),
  binCardEntryId: varchar("bin_card_entry_id", { length: 191 }),
  disposalNotes: text("disposal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Drizzle Relations
export const warehousesRelations = relations(warehouses, ({ many }) => ({
  exportProducts: many(exportProducts),
  pharmaProducts: many(pharmaProducts),
  stockMovements: many(stockMovements),
  storeTransfersFrom: many(storeTransfers, { relationName: "fromWarehouse" }),
  storeTransfersTo: many(storeTransfers, { relationName: "toWarehouse" }),
  exportMovements: many(exportWarehouseMovements),
}))

export const exportProductsRelations = relations(exportProducts, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [exportProducts.warehouseId],
    references: [warehouses.id],
  }),
  movements: many(exportWarehouseMovements),
}))

export const pharmaProductsRelations = relations(pharmaProducts, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [pharmaProducts.warehouseId],
    references: [warehouses.id],
  }),
  batches: many(pharmaProductBatches),
  stockMovements: many(stockMovements),
  transferItems: many(storeTransferItems),
}))

export const pharmaProductBatchesRelations = relations(pharmaProductBatches, ({ one }) => ({
  product: one(pharmaProducts, {
    fields: [pharmaProductBatches.productId],
    references: [pharmaProducts.id],
  }),
  warehouse: one(warehouses, {
    fields: [pharmaProductBatches.warehouseId],
    references: [warehouses.id],
  }),
}))

export const exportWarehouseMovementsRelations = relations(exportWarehouseMovements, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [exportWarehouseMovements.warehouseId],
    references: [warehouses.id],
  }),
  product: one(exportProducts, {
    fields: [exportWarehouseMovements.productId],
    references: [exportProducts.id],
  }),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  pharmaProduct: one(pharmaProducts, {
    fields: [stockMovements.productId],
    references: [pharmaProducts.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
}))

export const storeTransfersRelations = relations(storeTransfers, ({ one, many }) => ({
  fromWarehouse: one(warehouses, {
    fields: [storeTransfers.fromWarehouseId],
    references: [warehouses.id],
    relationName: "fromWarehouse",
  }),
  toWarehouse: one(warehouses, {
    fields: [storeTransfers.toWarehouseId],
    references: [warehouses.id],
    relationName: "toWarehouse",
  }),
  items: many(storeTransferItems),
}))

export const storeTransferItemsRelations = relations(storeTransferItems, ({ one }) => ({
  transfer: one(storeTransfers, {
    fields: [storeTransferItems.transferId],
    references: [storeTransfers.id],
  }),
  pharmaProduct: one(pharmaProducts, {
    fields: [storeTransferItems.productId],
    references: [pharmaProducts.id],
  }),
}))
