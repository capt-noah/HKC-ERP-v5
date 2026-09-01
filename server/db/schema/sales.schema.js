import { mysqlTable, varchar, text, decimal, timestamp, json, date } from "drizzle-orm/mysql-core"
import { relations } from "drizzle-orm"

// Document Tables
export const customers = mysqlTable("customers", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const suppliers = mysqlTable("suppliers", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const salesOrders = mysqlTable("sales_orders", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const hkcDocRecords = mysqlTable("hkc_doc_records", {
  id: varchar("id", { length: 191 }).primaryKey(),
  payload: json("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Relational Tables
export const salesIssues = mysqlTable("sales_issues", {
  id: varchar("id", { length: 191 }).primaryKey(),
  salesOrderId: varchar("sales_order_id", { length: 191 }),
  issueNumber: varchar("issue_number", { length: 191 }).notNull(),
  customerId: varchar("customer_id", { length: 191 }),
  issueDate: date("issue_date").notNull(),
  status: varchar("status", { length: 50 }).default("Draft").notNull(),
  totalAmount: decimal("total_amount", { precision: 18, scale: 2 }).default("0").notNull(),
  subtotalAmount: decimal("subtotal_amount", { precision: 18, scale: 2 }).default("0").notNull(),
  taxAmount: decimal("tax_amount", { precision: 18, scale: 2 }).default("0").notNull(),
  paymentStatus: varchar("payment_status", { length: 50 }).default("Unpaid").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const salesIssueItems = mysqlTable("sales_issue_items", {
  id: varchar("id", { length: 191 }).primaryKey(),
  salesIssueId: varchar("sales_issue_id", { length: 191 })
    .notNull()
    .references(() => salesIssues.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 191 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("1").notNull(),
  unitPrice: decimal("unit_price", { precision: 18, scale: 2 }).default("0").notNull(),
  totalPrice: decimal("total_price", { precision: 18, scale: 2 }).default("0").notNull(),
  batchNumber: varchar("batch_number", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const processingServices = mysqlTable("processing_services", {
  id: varchar("id", { length: 191 }).primaryKey(),
  referenceNumber: varchar("reference_number", { length: 191 }),
  clientCompanyName: varchar("client_company_name", { length: 255 }),
  customerId: varchar("customer_id", { length: 191 }),
  goodsDescription: text("goods_description"),
  quantity: decimal("quantity", { precision: 18, scale: 2 }).default("1"),
  uom: varchar("uom", { length: 50 }).default("Quintal"),
  entryDate: varchar("entry_date", { length: 50 }),
  agreedPrice: decimal("agreed_price", { precision: 18, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).default("ETB"),
  status: varchar("status", { length: 50 }).default("Received"),
  statusHistory: json("status_history"),
  assignedTo: varchar("assigned_to", { length: 191 }),
  invoiceId: varchar("invoice_id", { length: 191 }),
  notes: text("notes"),
  contractUrl: text("contract_url"),
  contractFileName: varchar("contract_file_name", { length: 255 }),
  lockedProcessingRate: decimal("locked_processing_rate", { precision: 18, scale: 2 }),
  lockedProcessingFee: decimal("locked_processing_fee", { precision: 18, scale: 2 }),
  lockedStorageFee: decimal("locked_storage_fee", { precision: 18, scale: 2 }),
  lockedTotalFee: decimal("locked_total_fee", { precision: 18, scale: 2 }),
  processedAt: timestamp("processed_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const shipmentDocuments = mysqlTable("shipment_documents", {
  id: varchar("id", { length: 191 }).primaryKey(),
  recordId: varchar("record_id", { length: 191 }).notNull(),
  recordType: varchar("record_type", { length: 100 }).default("purchase_order").notNull(),
  documentType: varchar("document_type", { length: 100 }).default("Other").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: decimal("file_size", { precision: 18, scale: 2 }).default("1024"),
  fileUrl: text("file_url"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: varchar("uploaded_by", { length: 191 }).default("Current User"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Drizzle Relations
export const salesIssuesRelations = relations(salesIssues, ({ many }) => ({
  items: many(salesIssueItems),
}))

export const salesIssueItemsRelations = relations(salesIssueItems, ({ one }) => ({
  salesIssue: one(salesIssues, {
    fields: [salesIssueItems.salesIssueId],
    references: [salesIssues.id],
  }),
}))
