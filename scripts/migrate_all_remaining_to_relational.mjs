import { pool } from "../server/db/client.js"
import fs from "node:fs"
import path from "node:path"

async function migrateAllRemainingToRelational() {
  const conn = await pool.getConnection()
  try {
    console.log("=== STARTING FULL DATABASE TABLES MIGRATION TO RELATIONAL ===")

    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    // =========================================================================
    // STEP 1: DROP 4 PHANTOM / DEAD TABLES
    // =========================================================================
    console.log("\n--> STEP 1: Dropping 4 phantom / dead tables...")
    const phantomTables = [
      "bank_reconciliations",
      "vehicles",
      "recurring_expense_schedules",
      "leave_types",
    ]
    for (const tbl of phantomTables) {
      await conn.query(`DROP TABLE IF EXISTS \`${tbl}\``)
      console.log(`  ✓ Dropped phantom table: ${tbl}`)
    }

    // =========================================================================
    // STEP 2: DROP PAYLOAD COLUMN FROM RECENTLY MIGRATED TABLES
    // =========================================================================
    console.log("\n--> STEP 2: Dropping legacy payload column from journal & COA tables...")
    const cleanPayloadTables = ["journal_entries", "journal_entry_lines", "chart_of_accounts"]
    for (const tbl of cleanPayloadTables) {
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tbl}\` LIKE 'payload'`)
      if (cols.length > 0) {
        await conn.query(`ALTER TABLE \`${tbl}\` DROP COLUMN \`payload\``)
        console.log(`  ✓ Dropped payload column from ${tbl}`)
      }
    }

    // Helper: Add column if missing
    async function ensureColumn(table, colName, ddl) {
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [colName])
      if (cols.length === 0) {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` ${ddl}`)
        console.log(`  + Added ${table}.${colName}`)
      }
    }

    // Helper: Add index if missing
    async function ensureIndex(table, indexName, ddl) {
      const [indexes] = await conn.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName])
      if (indexes.length === 0) {
        await conn.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` ${ddl}`)
        console.log(`  + Added index ${indexName} on ${table}`)
      }
    }

    // =========================================================================
    // STEP 3: MIGRATE CUSTOMERS & RESTORE MISSING NAMES
    // =========================================================================
    console.log("\n--> STEP 3: Migrating customers table to relational...")
    await ensureColumn("customers", "name", "VARCHAR(255) NOT NULL DEFAULT ''")
    await ensureColumn("customers", "contact_person", "VARCHAR(191) NULL")
    await ensureColumn("customers", "phone", "VARCHAR(50) NULL")
    await ensureColumn("customers", "email", "VARCHAR(191) NULL")
    await ensureColumn("customers", "address", "TEXT NULL")
    await ensureColumn("customers", "country", "VARCHAR(100) NOT NULL DEFAULT 'Ethiopia'")
    await ensureColumn("customers", "region", "VARCHAR(100) NULL")
    await ensureColumn("customers", "tin", "VARCHAR(50) NULL")
    await ensureColumn("customers", "category", "VARCHAR(100) NULL")
    await ensureColumn("customers", "warehouse_target", "VARCHAR(100) NULL")
    await ensureColumn("customers", "credit_limit", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("customers", "trade_paper_url", "TEXT NULL")
    await ensureColumn("customers", "trade_paper_file_name", "VARCHAR(255) NULL")
    await ensureColumn("customers", "trade_paper_uploaded_at", "VARCHAR(50) NULL")
    await ensureColumn("customers", "default_tax_schedule_id", "VARCHAR(100) NULL")
    await ensureColumn("customers", "is_gov_agent", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureColumn("customers", "status", "VARCHAR(50) NOT NULL DEFAULT 'Active'")

    // Populate customers from payload if payload exists
    const [custPayloadCol] = await conn.query("SHOW COLUMNS FROM customers LIKE 'payload'")
    if (custPayloadCol.length > 0) {
      const [rawCusts] = await conn.query("SELECT id, payload FROM customers")
      for (const row of rawCusts) {
        if (!row.payload) continue
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
        await conn.query(
          `UPDATE customers SET
            name = COALESCE(?, name, ''),
            contact_person = ?,
            phone = ?,
            email = ?,
            address = ?,
            country = COALESCE(?, 'Ethiopia'),
            region = ?,
            tin = ?,
            category = ?,
            warehouse_target = ?,
            credit_limit = ?,
            trade_paper_url = ?,
            trade_paper_file_name = ?,
            trade_paper_uploaded_at = ?,
            default_tax_schedule_id = ?,
            is_gov_agent = ?,
            status = COALESCE(?, 'Active')
          WHERE id = ?`,
          [
            p.name || null,
            p.contactPerson || p.contact_person || null,
            p.phone || null,
            p.email || null,
            p.address || null,
            p.country || "Ethiopia",
            p.region || null,
            p.tin || null,
            p.category || null,
            p.warehouseTarget || p.warehouse_target || null,
            p.creditLimit || p.credit_limit || 0,
            p.tradePaperUrl || p.trade_paper_url || null,
            p.tradePaperFileName || p.trade_paper_file_name || null,
            p.tradePaperUploadedAt || p.trade_paper_uploaded_at || null,
            p.defaultTaxScheduleId || p.default_tax_schedule_id || null,
            p.isGovAgent ? 1 : 0,
            p.status || "Active",
            row.id,
          ]
        )
      }
    }

    // Auto-backfill missing customer names from sales_orders
    console.log("  --> Backfilling missing customer names from sales_orders...")
    const [soCols] = await conn.query("SHOW COLUMNS FROM sales_orders LIKE 'payload'")
    if (soCols.length > 0) {
      const [rawSos] = await conn.query("SELECT payload FROM sales_orders")
      for (const so of rawSos) {
        if (!so.payload) continue
        const p = typeof so.payload === "string" ? JSON.parse(so.payload) : so.payload
        if (p.customerId && p.customer) {
          await conn.query(
            `UPDATE customers SET 
              name = CASE WHEN (name IS NULL OR name = '') THEN ? ELSE name END,
              phone = CASE WHEN (phone IS NULL OR phone = '') THEN ? ELSE phone END,
              category = CASE WHEN (category IS NULL OR category = '') THEN ? ELSE category END
            WHERE id = ?`,
            [p.customer, p.customerPhone || null, p.customerGroup || null, p.customerId]
          )
        }
      }
    } else {
      const [rawSos] = await conn.query("SELECT customer_id, customer_name, customer_phone, customer_group FROM sales_orders")
      for (const so of rawSos) {
        if (so.customer_id && so.customer_name) {
          await conn.query(
            `UPDATE customers SET 
              name = CASE WHEN (name IS NULL OR name = '') THEN ? ELSE name END,
              phone = CASE WHEN (phone IS NULL OR phone = '') THEN ? ELSE phone END,
              category = CASE WHEN (category IS NULL OR category = '') THEN ? ELSE category END
            WHERE id = ?`,
            [so.customer_name, so.customer_phone || null, so.customer_group || null, so.customer_id]
          )
        }
      }
    }

    // Reconcile sales_issues customer_id to point to canonical CUST-XXXX IDs
    console.log("  --> Reconciling sales_issues.customer_id to canonical CUST-XXXX...")
    const [allCusts] = await conn.query("SELECT id, name FROM customers")
    for (const c of allCusts) {
      if (c.name) {
        await conn.query(
          "UPDATE sales_issues SET customer_id = ? WHERE (customer_id = ? OR customer_name = ?)",
          [c.id, c.name, c.name]
        )
      }
    }

    await ensureIndex("customers", "idx_customers_name", "(name)")
    await ensureIndex("customers", "idx_customers_phone", "(phone)")
    await ensureIndex("customers", "idx_customers_tin", "(tin)")
    await ensureIndex("customers", "idx_customers_status", "(status)")

    if (custPayloadCol.length > 0) {
      await conn.query("ALTER TABLE customers DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from customers")
    }

    // =========================================================================
    // STEP 4: MIGRATE SUPPLIERS
    // =========================================================================
    console.log("\n--> STEP 4: Migrating suppliers table to relational...")
    await ensureColumn("suppliers", "name", "VARCHAR(255) NOT NULL DEFAULT ''")
    await ensureColumn("suppliers", "country", "VARCHAR(100) NOT NULL DEFAULT 'Ethiopia'")
    await ensureColumn("suppliers", "city", "VARCHAR(100) NULL")
    await ensureColumn("suppliers", "contact_person", "VARCHAR(191) NULL")
    await ensureColumn("suppliers", "phone", "VARCHAR(50) NULL")
    await ensureColumn("suppliers", "email", "VARCHAR(191) NULL")
    await ensureColumn("suppliers", "address", "TEXT NULL")
    await ensureColumn("suppliers", "category", "VARCHAR(100) NULL")
    await ensureColumn("suppliers", "tax_id", "VARCHAR(50) NULL")
    await ensureColumn("suppliers", "tin", "VARCHAR(50) NULL")
    await ensureColumn("suppliers", "warehouse_target", "VARCHAR(100) NULL")
    await ensureColumn("suppliers", "rating", "VARCHAR(50) NULL")
    await ensureColumn("suppliers", "trade_paper_url", "TEXT NULL")
    await ensureColumn("suppliers", "trade_paper_file_name", "VARCHAR(255) NULL")
    await ensureColumn("suppliers", "default_tax_schedule_id", "VARCHAR(100) NULL")
    await ensureColumn("suppliers", "is_gov_agent", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureColumn("suppliers", "status", "VARCHAR(50) NOT NULL DEFAULT 'Active'")

    const [suppPayloadCol] = await conn.query("SHOW COLUMNS FROM suppliers LIKE 'payload'")
    if (suppPayloadCol.length > 0) {
      const [rawSupps] = await conn.query("SELECT id, payload FROM suppliers")
      for (const row of rawSupps) {
        if (!row.payload) continue
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
        await conn.query(
          `UPDATE suppliers SET
            name = COALESCE(?, name, ''),
            country = COALESCE(?, 'Ethiopia'),
            city = ?,
            contact_person = ?,
            phone = ?,
            email = ?,
            address = ?,
            category = ?,
            tax_id = ?,
            tin = ?,
            warehouse_target = ?,
            rating = ?,
            trade_paper_url = ?,
            trade_paper_file_name = ?,
            status = COALESCE(?, 'Active')
          WHERE id = ?`,
          [
            p.name || null,
            p.country || "Ethiopia",
            p.city || null,
            p.contactPerson || p.contact_person || null,
            p.phone || null,
            p.email || null,
            p.address || null,
            p.category || null,
            p.taxId || p.tax_id || null,
            p.tin || null,
            p.warehouseTarget || p.warehouse_target || null,
            p.rating || null,
            p.tradePaperUrl || p.trade_paper_url || null,
            p.tradePaperFileName || p.trade_paper_file_name || null,
            p.status || "Active",
            row.id,
          ]
        )
      }
    }

    await ensureIndex("suppliers", "idx_suppliers_name", "(name)")
    await ensureIndex("suppliers", "idx_suppliers_status", "(status)")

    if (suppPayloadCol.length > 0) {
      await conn.query("ALTER TABLE suppliers DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from suppliers")
    }

    // =========================================================================
    // STEP 5: MIGRATE SALES ORDERS
    // =========================================================================
    console.log("\n--> STEP 5: Migrating sales_orders table to relational...")
    await ensureColumn("sales_orders", "order_number", "VARCHAR(100) NULL")
    await ensureColumn("sales_orders", "order_date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("sales_orders", "customer_id", "VARCHAR(191) NULL")
    await ensureColumn("sales_orders", "customer_name", "VARCHAR(255) NOT NULL DEFAULT ''")
    await ensureColumn("sales_orders", "customer_phone", "VARCHAR(50) NULL")
    await ensureColumn("sales_orders", "customer_group", "VARCHAR(100) NULL")
    await ensureColumn("sales_orders", "warehouse_id", "VARCHAR(191) NOT NULL DEFAULT 'WH2'")
    await ensureColumn("sales_orders", "warehouse_name", "VARCHAR(255) NULL")
    await ensureColumn("sales_orders", "stage", "VARCHAR(50) NOT NULL DEFAULT 'Draft'")
    await ensureColumn("sales_orders", "amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("sales_orders", "billed_amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("sales_orders", "delivered_amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("sales_orders", "billing_status", "VARCHAR(50) NOT NULL DEFAULT 'Unbilled'")
    await ensureColumn("sales_orders", "delivery_status", "VARCHAR(50) NOT NULL DEFAULT 'Undelivered'")
    await ensureColumn("sales_orders", "payment_type", "VARCHAR(50) NOT NULL DEFAULT 'Cash'")
    await ensureColumn("sales_orders", "payment_terms", "VARCHAR(100) NULL")
    await ensureColumn("sales_orders", "approval_status", "VARCHAR(50) NOT NULL DEFAULT 'Pending'")
    await ensureColumn("sales_orders", "approved_by", "VARCHAR(191) NULL")
    await ensureColumn("sales_orders", "approved_at", "VARCHAR(50) NULL")
    await ensureColumn("sales_orders", "currency", "VARCHAR(10) NOT NULL DEFAULT 'ETB'")
    await ensureColumn("sales_orders", "urgent", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureColumn("sales_orders", "description", "TEXT NULL")
    await ensureColumn("sales_orders", "items", "JSON NULL")

    const [soPayloadCol] = await conn.query("SHOW COLUMNS FROM sales_orders LIKE 'payload'")
    if (soPayloadCol.length > 0) {
      const [rawOrders] = await conn.query("SELECT id, payload FROM sales_orders")
      for (const row of rawOrders) {
        if (!row.payload) continue
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
        await conn.query(
          `UPDATE sales_orders SET
            order_number = ?,
            order_date = ?,
            customer_id = ?,
            customer_name = ?,
            customer_phone = ?,
            customer_group = ?,
            warehouse_id = ?,
            warehouse_name = ?,
            stage = ?,
            amount = ?,
            billed_amount = ?,
            delivered_amount = ?,
            billing_status = ?,
            delivery_status = ?,
            payment_type = ?,
            payment_terms = ?,
            approval_status = ?,
            approved_by = ?,
            approved_at = ?,
            currency = ?,
            urgent = ?,
            description = ?,
            items = ?
          WHERE id = ?`,
          [
            p.id || row.id,
            p.date ? p.date.slice(0, 10) : "2026-01-01",
            p.customerId || null,
            p.customer || "",
            p.customerPhone || null,
            p.customerGroup || null,
            p.warehouse || "WH2",
            p.warehouseName || null,
            p.stage || "Draft",
            p.amount || 0,
            p.billedAmount || p.amount || 0,
            p.deliveredAmount || p.amount || 0,
            p.billingStatus || "Unbilled",
            p.deliveryStatus || "Undelivered",
            p.paymentType || "Cash",
            p.paymentTerms || null,
            p.approvalStatus || "Approved",
            p.approvedBy || null,
            p.approvedAt || null,
            p.currency || "ETB",
            p.urgent ? 1 : 0,
            p.desc || p.description || null,
            p.items ? JSON.stringify(p.items) : null,
            row.id,
          ]
        )
      }
    }

    await ensureIndex("sales_orders", "idx_so_date", "(order_date DESC)")
    await ensureIndex("sales_orders", "idx_so_customer", "(customer_id)")
    await ensureIndex("sales_orders", "idx_so_warehouse", "(warehouse_id)")
    await ensureIndex("sales_orders", "idx_so_stage", "(stage)")

    if (soPayloadCol.length > 0) {
      await conn.query("ALTER TABLE sales_orders DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from sales_orders")
    }

    // =========================================================================
    // STEP 6: MIGRATE INVOICES
    // =========================================================================
    console.log("\n--> STEP 6: Migrating invoices table to relational...")
    await ensureColumn("invoices", "invoice_number", "VARCHAR(100) NOT NULL DEFAULT ''")
    await ensureColumn("invoices", "fs_no", "VARCHAR(100) NULL")
    await ensureColumn("invoices", "sales_issue_id", "VARCHAR(191) NULL")
    await ensureColumn("invoices", "sales_order_id", "VARCHAR(191) NULL")
    await ensureColumn("invoices", "customer_id", "VARCHAR(191) NULL")
    await ensureColumn("invoices", "customer_name", "VARCHAR(255) NOT NULL DEFAULT ''")
    await ensureColumn("invoices", "issue_date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("invoices", "due_date", "DATE NULL")
    await ensureColumn("invoices", "status", "VARCHAR(50) NOT NULL DEFAULT 'Draft'")
    await ensureColumn("invoices", "payment_terms", "VARCHAR(100) NULL")
    await ensureColumn("invoices", "settlement_status", "VARCHAR(50) NOT NULL DEFAULT 'Unsettled'")
    await ensureColumn("invoices", "currency", "VARCHAR(10) NOT NULL DEFAULT 'ETB'")
    await ensureColumn("invoices", "subtotal", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("invoices", "tax_rate", "DECIMAL(5,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("invoices", "tax_amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("invoices", "discount_amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("invoices", "total_amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("invoices", "amount_paid", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("invoices", "balance_due", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("invoices", "line_items", "JSON NULL")
    await ensureColumn("invoices", "gl_distribution", "JSON NULL")

    const [invPayloadCol] = await conn.query("SHOW COLUMNS FROM invoices LIKE 'payload'")
    if (invPayloadCol.length > 0) {
      const [rawInvs] = await conn.query("SELECT id, payload FROM invoices")
      for (const row of rawInvs) {
        if (!row.payload) continue
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload

        // Lookup canonical customer_id from sales_orders
        let resolvedCustId = null
        if (p.sales_order_id) {
          const [soMatch] = await conn.query("SELECT customer_id FROM sales_orders WHERE id = ?", [p.sales_order_id])
          if (soMatch.length > 0) resolvedCustId = soMatch[0].customer_id
        }
        if (!resolvedCustId && p.customer_name) {
          const [cMatch] = await conn.query("SELECT id FROM customers WHERE name = ?", [p.customer_name])
          if (cMatch.length > 0) resolvedCustId = cMatch[0].id
        }

        await conn.query(
          `UPDATE invoices SET
            invoice_number = ?,
            fs_no = ?,
            sales_issue_id = ?,
            sales_order_id = ?,
            customer_id = ?,
            customer_name = ?,
            issue_date = ?,
            due_date = ?,
            status = ?,
            payment_terms = ?,
            settlement_status = ?,
            currency = ?,
            subtotal = ?,
            tax_rate = ?,
            tax_amount = ?,
            discount_amount = ?,
            total_amount = ?,
            amount_paid = ?,
            balance_due = ?,
            line_items = ?,
            gl_distribution = ?
          WHERE id = ?`,
          [
            p.invoice_number || p.id,
            p.fs_no || null,
            p.sales_issue_id || null,
            p.sales_order_id || null,
            resolvedCustId,
            p.customer_name || "",
            p.issue_date ? p.issue_date.slice(0, 10) : "2026-01-01",
            p.due_date ? p.due_date.slice(0, 10) : null,
            p.status || "Draft",
            p.payment_terms || "Cash",
            p.settlement_status || (p.status === "Paid" ? "Fully Settled" : "Unsettled"),
            p.currency || "ETB",
            p.subtotal || p.total_amount || p.total || 0,
            p.tax_rate || 0,
            p.tax_amount || 0,
            p.discount_amount || 0,
            p.total_amount || p.total || 0,
            p.amount_paid || 0,
            p.balance_due || 0,
            p.line_items ? JSON.stringify(p.line_items) : null,
            p.gl_distribution ? JSON.stringify(p.gl_distribution) : null,
            row.id,
          ]
        )
      }
    }

    await ensureIndex("invoices", "idx_inv_number", "(invoice_number)")
    await ensureIndex("invoices", "idx_inv_fs_no", "(fs_no)")
    await ensureIndex("invoices", "idx_inv_issue_id", "(sales_issue_id)")
    await ensureIndex("invoices", "idx_inv_customer", "(customer_name)")
    await ensureIndex("invoices", "idx_inv_due_date", "(due_date)")
    await ensureIndex("invoices", "idx_inv_status", "(status)")

    if (invPayloadCol.length > 0) {
      await conn.query("ALTER TABLE invoices DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from invoices")
    }

    // =========================================================================
    // STEP 7: MIGRATE TAX RULES
    // =========================================================================
    console.log("\n--> STEP 7: Migrating tax_rules table to relational...")
    await ensureColumn("tax_rules", "name", "VARCHAR(191) NOT NULL DEFAULT ''")
    await ensureColumn("tax_rules", "rate_percent", "DECIMAL(5,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("tax_rules", "type", "VARCHAR(100) NOT NULL DEFAULT 'VAT/GST'")
    await ensureColumn("tax_rules", "applies_to", "VARCHAR(50) NOT NULL DEFAULT 'BOTH'")
    await ensureColumn("tax_rules", "gl_account_code", "VARCHAR(50) NULL")
    await ensureColumn("tax_rules", "description", "TEXT NULL")
    await ensureColumn("tax_rules", "is_deduction", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureColumn("tax_rules", "is_inclusive", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureColumn("tax_rules", "is_active", "TINYINT(1) NOT NULL DEFAULT 1")

    const [taxPayloadCol] = await conn.query("SHOW COLUMNS FROM tax_rules LIKE 'payload'")
    if (taxPayloadCol.length > 0) {
      const [rawTaxes] = await conn.query("SELECT id, payload FROM tax_rules")
      for (const row of rawTaxes) {
        if (!row.payload) continue
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
        await conn.query(
          `UPDATE tax_rules SET
            name = ?,
            rate_percent = ?,
            type = ?,
            applies_to = ?,
            gl_account_code = ?,
            description = ?,
            is_deduction = ?,
            is_inclusive = ?,
            is_active = ?
          WHERE id = ?`,
          [
            p.name || row.id,
            p.ratePercent ?? p.rate ?? 0,
            p.type || "VAT/GST",
            p.appliesTo || p.applies_to || "BOTH",
            p.gl_account_code || p.accountCode || null,
            p.description || null,
            p.isDeduction ? 1 : 0,
            p.isInclusive ?? p.is_inclusive ? 1 : 0,
            p.is_active ?? true ? 1 : 0,
            row.id,
          ]
        )
      }
    }

    await ensureIndex("tax_rules", "idx_tax_type", "(type)")
    await ensureIndex("tax_rules", "idx_tax_active", "(is_active)")

    if (taxPayloadCol.length > 0) {
      await conn.query("ALTER TABLE tax_rules DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from tax_rules")
    }

    // =========================================================================
    // STEP 8: MIGRATE & RESTORE HKC_DOC_RECORDS
    // =========================================================================
    console.log("\n--> STEP 8: Upgrading hkc_doc_records to relational & restoring records...")
    await ensureColumn("hkc_doc_records", "shipment_id", "VARCHAR(100) NOT NULL DEFAULT ''")
    await ensureColumn("hkc_doc_records", "items_description", "TEXT NOT NULL")
    await ensureColumn("hkc_doc_records", "type", "VARCHAR(50) NOT NULL DEFAULT 'Import'")
    await ensureColumn("hkc_doc_records", "record_date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("hkc_doc_records", "attachments", "JSON NULL")

    const [hkcPayloadCol] = await conn.query("SHOW COLUMNS FROM hkc_doc_records LIKE 'payload'")
    if (hkcPayloadCol.length > 0) {
      await conn.query("ALTER TABLE hkc_doc_records DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from hkc_doc_records")
    }

    // Restore the 2 historical records from snapshot if table has 0 rows
    const [[{ count: hkcCount }]] = await conn.query("SELECT COUNT(*) as count FROM hkc_doc_records")
    if (hkcCount === 0) {
      const snapshotPath = path.resolve(
        process.cwd(),
        "server/db/backups/snapshot-2026-10-01T05-36-36-974Z/hkc_doc_records.json"
      )
      if (fs.existsSync(snapshotPath)) {
        const rawJson = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"))
        for (const item of rawJson) {
          const p = item.payload
          await conn.query(
            `INSERT INTO hkc_doc_records (id, shipment_id, items_description, type, record_date, attachments, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              shipment_id = VALUES(shipment_id),
              items_description = VALUES(items_description),
              type = VALUES(type),
              record_date = VALUES(record_date),
              attachments = VALUES(attachments)`,
            [
              item.id,
              p.shipmentId || "",
              p.itemsDescription || "",
              p.type || "Export",
              p.date ? p.date.slice(0, 10) : "2026-08-12",
              p.attachments ? JSON.stringify(p.attachments) : null,
              item.created_at ? new Date(item.created_at) : new Date(),
              item.updated_at ? new Date(item.updated_at) : new Date(),
            ]
          )
          console.log(`  ✓ Restored historical HKC doc record: ${item.id} (${p.shipmentId})`)
        }
      }
    }

    await ensureIndex("hkc_doc_records", "idx_hkc_docs_shipment", "(shipment_id)")
    await ensureIndex("hkc_doc_records", "idx_hkc_docs_date", "(record_date DESC)")
    await ensureIndex("hkc_doc_records", "idx_hkc_docs_type", "(type)")

    // =========================================================================
    // STEP 9: MIGRATE PAYMENTS & EXPENSES
    // =========================================================================
    console.log("\n--> STEP 9: Migrating payments & expenses tables to relational...")
    // Payments
    await ensureColumn("payments", "direction", "VARCHAR(50) NOT NULL DEFAULT 'Received'")
    await ensureColumn("payments", "linked_invoice_id", "VARCHAR(191) NULL")
    await ensureColumn("payments", "sales_issue_id", "VARCHAR(191) NULL")
    await ensureColumn("payments", "sales_order_id", "VARCHAR(191) NULL")
    await ensureColumn("payments", "purchase_order_id", "VARCHAR(191) NULL")
    await ensureColumn("payments", "customer_id", "VARCHAR(191) NULL")
    await ensureColumn("payments", "customer_name", "VARCHAR(255) NULL")
    await ensureColumn("payments", "supplier_id", "VARCHAR(191) NULL")
    await ensureColumn("payments", "supplier_name", "VARCHAR(255) NULL")
    await ensureColumn("payments", "amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payments", "currency", "VARCHAR(10) NOT NULL DEFAULT 'ETB'")
    await ensureColumn("payments", "date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("payments", "method", "VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer'")
    await ensureColumn("payments", "bank_account_code", "VARCHAR(50) NULL")
    await ensureColumn("payments", "reference", "VARCHAR(191) NULL")
    await ensureColumn("payments", "payment_advice_url", "TEXT NULL")
    await ensureColumn("payments", "payment_advice_filename", "VARCHAR(255) NULL")
    await ensureColumn("payments", "installment_no", "INT NULL")
    await ensureColumn("payments", "warehouse_id", "VARCHAR(191) NULL")
    await ensureColumn("payments", "ar_account_code", "VARCHAR(50) NULL")
    await ensureColumn("payments", "notes", "TEXT NULL")
    await ensureIndex("payments", "idx_pay_invoice", "(linked_invoice_id)")
    await ensureIndex("payments", "idx_pay_issue", "(sales_issue_id)")
    await ensureIndex("payments", "idx_pay_date", "(date DESC)")

    const [payPayloadCol] = await conn.query("SHOW COLUMNS FROM payments LIKE 'payload'")
    if (payPayloadCol.length > 0) {
      await conn.query("ALTER TABLE payments DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from payments")
    }

    // Expenses
    await ensureColumn("expenses", "merchant", "VARCHAR(255) NOT NULL DEFAULT ''")
    await ensureColumn("expenses", "category", "VARCHAR(100) NOT NULL DEFAULT 'Office Expense'")
    await ensureColumn("expenses", "date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("expenses", "employee", "VARCHAR(191) NULL")
    await ensureColumn("expenses", "amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("expenses", "currency", "VARCHAR(10) NOT NULL DEFAULT 'ETB'")
    await ensureColumn("expenses", "status", "VARCHAR(50) NOT NULL DEFAULT 'PENDING'")
    await ensureColumn("expenses", "cost_center", "VARCHAR(100) NULL")
    await ensureColumn("expenses", "gl_account_id", "VARCHAR(191) NULL")
    await ensureColumn("expenses", "payment_account_id", "VARCHAR(191) NULL")
    await ensureColumn("expenses", "payment_method", "VARCHAR(50) NOT NULL DEFAULT 'Cash'")
    await ensureColumn("expenses", "receipt_ref", "VARCHAR(191) NULL")
    await ensureColumn("expenses", "cheque_no", "VARCHAR(191) NULL")
    await ensureColumn("expenses", "apply_vat", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureColumn("expenses", "tax_amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("expenses", "apply_wht", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureColumn("expenses", "wht_amount", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("expenses", "wht_rate", "DECIMAL(5,2) NULL")
    await ensureColumn("expenses", "net_disbursed", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("expenses", "notes", "TEXT NULL")
    await ensureIndex("expenses", "idx_exp_date", "(date DESC)")
    await ensureIndex("expenses", "idx_exp_status", "(status)")

    const [expPayloadCol] = await conn.query("SHOW COLUMNS FROM expenses LIKE 'payload'")
    if (expPayloadCol.length > 0) {
      await conn.query("ALTER TABLE expenses DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from expenses")
    }

    // =========================================================================
    // STEP 10: MIGRATE EMPLOYEES & HR MODULE TABLES
    // =========================================================================
    console.log("\n--> STEP 10: Migrating employees & HR module tables to relational...")
    // Employees
    await ensureColumn("employees", "employee_number", "VARCHAR(100) NOT NULL DEFAULT ''")
    await ensureColumn("employees", "full_name", "VARCHAR(255) NOT NULL DEFAULT ''")
    await ensureColumn("employees", "phone", "VARCHAR(50) NULL")
    await ensureColumn("employees", "email", "VARCHAR(191) NULL")
    await ensureColumn("employees", "address", "TEXT NULL")
    await ensureColumn("employees", "date_of_birth", "VARCHAR(50) NULL")
    await ensureColumn("employees", "gender", "VARCHAR(50) NULL")
    await ensureColumn("employees", "warehouse_id", "VARCHAR(191) NULL")
    await ensureColumn("employees", "employment_type", "VARCHAR(50) NOT NULL DEFAULT 'Permanent'")
    await ensureColumn("employees", "start_date", "VARCHAR(50) NULL")
    await ensureColumn("employees", "basic_salary", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("employees", "payment_method", "VARCHAR(50) NULL")
    await ensureColumn("employees", "bank_account", "VARCHAR(100) NULL")
    await ensureColumn("employees", "emergency_contact_name", "VARCHAR(191) NULL")
    await ensureColumn("employees", "emergency_contact_phone", "VARCHAR(50) NULL")
    await ensureColumn("employees", "national_id_image", "TEXT NULL")
    await ensureColumn("employees", "status", "VARCHAR(50) NOT NULL DEFAULT 'Active'")
    await ensureIndex("employees", "idx_emp_number", "(employee_number)")
    await ensureIndex("employees", "idx_emp_name", "(full_name)")
    await ensureIndex("employees", "idx_emp_status", "(status)")

    const [empPayloadCol] = await conn.query("SHOW COLUMNS FROM employees LIKE 'payload'")
    if (empPayloadCol.length > 0) {
      await conn.query("ALTER TABLE employees DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from employees")
    }

    // Attendance
    await ensureColumn("attendance_records", "employee_id", "VARCHAR(191) NOT NULL DEFAULT ''")
    await ensureColumn("attendance_records", "attendance_date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("attendance_records", "check_in_time", "VARCHAR(50) NULL")
    await ensureColumn("attendance_records", "check_out_time", "VARCHAR(50) NULL")
    await ensureColumn("attendance_records", "status", "VARCHAR(50) NOT NULL DEFAULT 'Present'")
    await ensureColumn("attendance_records", "hours_worked", "DECIMAL(5,2) NOT NULL DEFAULT 8.00")
    await ensureColumn("attendance_records", "overtime_hours", "DECIMAL(5,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("attendance_records", "warehouse_id", "VARCHAR(191) NULL")
    await ensureColumn("attendance_records", "notes", "TEXT NULL")
    await ensureColumn("attendance_records", "locked_by_payroll", "TINYINT(1) NOT NULL DEFAULT 0")
    await ensureIndex("attendance_records", "idx_att_emp", "(employee_id)")
    await ensureIndex("attendance_records", "idx_att_date", "(attendance_date DESC)")

    const [attPayloadCol] = await conn.query("SHOW COLUMNS FROM attendance_records LIKE 'payload'")
    if (attPayloadCol.length > 0) {
      await conn.query("ALTER TABLE attendance_records DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from attendance_records")
    }

    // Leave Requests
    await ensureColumn("leave_requests", "employee_id", "VARCHAR(191) NOT NULL DEFAULT ''")
    await ensureColumn("leave_requests", "leave_type", "VARCHAR(100) NOT NULL DEFAULT 'Annual Leave'")
    await ensureColumn("leave_requests", "start_date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("leave_requests", "end_date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("leave_requests", "number_of_days", "INT NOT NULL DEFAULT 1")
    await ensureColumn("leave_requests", "reason", "TEXT NULL")
    await ensureColumn("leave_requests", "document_path", "TEXT NULL")
    await ensureColumn("leave_requests", "status", "VARCHAR(50) NOT NULL DEFAULT 'Pending'")
    await ensureColumn("leave_requests", "notes", "TEXT NULL")
    await ensureIndex("leave_requests", "idx_leave_emp", "(employee_id)")

    const [leavePayloadCol] = await conn.query("SHOW COLUMNS FROM leave_requests LIKE 'payload'")
    if (leavePayloadCol.length > 0) {
      await conn.query("ALTER TABLE leave_requests DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from leave_requests")
    }

    // Payroll Periods
    await ensureColumn("payroll_periods", "name", "VARCHAR(100) NOT NULL DEFAULT ''")
    await ensureColumn("payroll_periods", "month", "INT NOT NULL DEFAULT 1")
    await ensureColumn("payroll_periods", "year", "INT NOT NULL DEFAULT 2026")
    await ensureColumn("payroll_periods", "start_date", "DATE NOT NULL DEFAULT '2026-01-01'")
    await ensureColumn("payroll_periods", "end_date", "DATE NOT NULL DEFAULT '2026-01-31'")
    await ensureColumn("payroll_periods", "status", "VARCHAR(50) NOT NULL DEFAULT 'Draft'")
    await ensureIndex("payroll_periods", "idx_pp_year_month", "(year, month)")

    const [ppPayloadCol] = await conn.query("SHOW COLUMNS FROM payroll_periods LIKE 'payload'")
    if (ppPayloadCol.length > 0) {
      await conn.query("ALTER TABLE payroll_periods DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from payroll_periods")
    }

    // Payroll Records
    await ensureColumn("payroll_records", "payroll_period_id", "VARCHAR(191) NOT NULL DEFAULT ''")
    await ensureColumn("payroll_records", "employee_id", "VARCHAR(191) NOT NULL DEFAULT ''")
    await ensureColumn("payroll_records", "basic_salary", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "taxable_allowances", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "non_taxable_allowances", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "allowances", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "overtime_pay", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "bonus", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "other_earnings", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "tax", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "pension", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "absence_deduction", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "loan_deduction", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "other_deductions", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "gross_pay", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "total_deductions", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "net_pay", "DECIMAL(18,2) NOT NULL DEFAULT 0.00")
    await ensureColumn("payroll_records", "payment_status", "VARCHAR(50) NOT NULL DEFAULT 'Pending'")
    await ensureColumn("payroll_records", "notes", "TEXT NULL")
    await ensureIndex("payroll_records", "idx_pr_period", "(payroll_period_id)")
    await ensureIndex("payroll_records", "idx_pr_emp", "(employee_id)")

    const [prPayloadCol] = await conn.query("SHOW COLUMNS FROM payroll_records LIKE 'payload'")
    if (prPayloadCol.length > 0) {
      await conn.query("ALTER TABLE payroll_records DROP COLUMN payload")
      console.log("  ✓ Dropped payload column from payroll_records")
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")

    // =========================================================================
    // POST-MIGRATION AUDIT
    // =========================================================================
    console.log("\n=== POST-MIGRATION DATABASE AUDIT ===")
    const [allTables] = await conn.query("SHOW TABLES")
    const tableNames = allTables.map((r) => Object.values(r)[0])
    console.log(`Total Tables Remaining: ${tableNames.length} (Target: 35)`)

    let totalPayloadTables = 0
    for (const t of tableNames) {
      const [[{ count }]] = await conn.query(`SELECT COUNT(*) as count FROM \`${t}\``)
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${t}\` LIKE 'payload'`)
      const hasPayload = cols.length > 0
      if (hasPayload) totalPayloadTables++
      console.log(
        `  ${t.padEnd(28)} | Rows: ${String(count).padStart(5)} | Payload: ${hasPayload ? "YES (config)" : "NO (relational)"}`
      )
    }

    console.log(`\nTables with payload column: ${totalPayloadTables} (Expected: exactly 1 for company_settings)`)

    // Verify trial balance parity
    const [[tb]] = await conn.query(
      "SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM journal_entry_lines"
    )
    const diff = Math.abs(Number(tb.total_debit) - Number(tb.total_credit))
    console.log(`\nTrial Balance Parity: DR=${tb.total_debit}, CR=${tb.total_credit}, Diff=${diff.toFixed(2)} ETB`)

    // Verify customer names
    const [namedCusts] = await conn.query("SELECT id, name, phone FROM customers")
    console.log("\nCustomers Relational Status:")
    for (const c of namedCusts) {
      console.log(`  ${c.id}: ${c.name} (${c.phone || "no phone"})`)
    }

    // Verify restored HKC docs
    const [restoredDocs] = await conn.query("SELECT id, shipment_id, type, record_date FROM hkc_doc_records")
    console.log(`\nRestored HKC Docs (${restoredDocs.length} records):`)
    for (const d of restoredDocs) {
      console.log(`  ${d.id}: ${d.shipment_id} (${d.type}) on ${d.record_date}`)
    }

    console.log("\n=== FULL DATABASE TABLES MIGRATION COMPLETED SUCCESSFULLY ===")
  } catch (err) {
    console.error("Migration failed:", err)
    process.exit(1)
  } finally {
    conn.release()
    await pool.end()
  }
}

migrateAllRemainingToRelational()
