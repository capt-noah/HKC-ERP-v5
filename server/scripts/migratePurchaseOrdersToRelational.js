import { pool } from "../db/client.js"

async function runMigration() {
  console.log("================================================================")
  console.log("   HKC-ERP v5: RELATIONAL PURCHASE ORDERS SCHEMA MIGRATION       ")
  console.log("================================================================")

  const conn = await pool.getConnection()
  try {
    console.log("\nChecking 'purchase_orders' table structure...")
    
    // Check if table exists
    const [tables] = await conn.query("SHOW TABLES LIKE 'purchase_orders'")
    if (tables.length === 0) {
      console.log("-> 'purchase_orders' table does not exist. Creating relational table...")
      await conn.query(`
        CREATE TABLE \`purchase_orders\` (
          \`id\` varchar(191) NOT NULL PRIMARY KEY,
          \`po_number\` varchar(191) NOT NULL,
          \`voucher_no\` varchar(191) NULL,
          \`date\` varchar(50) NOT NULL,
          \`paid_to\` varchar(255) NOT NULL,
          \`supplier\` varchar(255) NOT NULL,
          \`supplier_id\` varchar(191) NULL,
          \`reason_for_payment\` text NULL,
          \`bank_name\` varchar(191) NULL,
          \`payment_method\` varchar(50) NOT NULL DEFAULT 'Cheque',
          \`cheque_no\` varchar(191) NULL,
          \`amount\` decimal(18, 2) NOT NULL DEFAULT 0.00,
          \`amount_paid\` decimal(18, 2) NOT NULL DEFAULT 0.00,
          \`balance_due\` decimal(18, 2) NOT NULL DEFAULT 0.00,
          \`payment_type\` varchar(50) NOT NULL DEFAULT 'Cash',
          \`payment_terms\` varchar(50) NULL,
          \`due_date\` varchar(50) NULL,
          \`status\` varchar(50) NOT NULL DEFAULT 'PAID',
          \`settlement_status\` varchar(50) NOT NULL DEFAULT 'Fully Settled',
          \`currency\` varchar(10) NOT NULL DEFAULT 'ETB',
          \`amount_in_words\` text NULL,
          \`category\` varchar(100) NULL,
          \`payment_advice_attachment\` json NULL,
          \`attachments\` json NULL,
          \`installment_payments\` json NULL,
          \`items\` json NULL,
          \`account_entries\` json NULL,
          \`prepared_by\` varchar(191) NULL,
          \`approved_by\` varchar(191) NULL,
          \`paid_by\` varchar(191) NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)
      console.log("✅ 'purchase_orders' table created successfully as relational.")
      return
    }

    const [cols] = await conn.query("SHOW COLUMNS FROM purchase_orders")
    const colNames = cols.map((c) => c.Field)

    const colsToAdd = [
      { name: "po_number", def: "VARCHAR(191) NOT NULL DEFAULT '' AFTER id" },
      { name: "voucher_no", def: "VARCHAR(191) NULL AFTER po_number" },
      { name: "date", def: "VARCHAR(50) NOT NULL DEFAULT '' AFTER voucher_no" },
      { name: "paid_to", def: "VARCHAR(255) NOT NULL DEFAULT '' AFTER date" },
      { name: "supplier", def: "VARCHAR(255) NOT NULL DEFAULT '' AFTER paid_to" },
      { name: "supplier_id", def: "VARCHAR(191) NULL AFTER supplier" },
      { name: "reason_for_payment", def: "TEXT NULL AFTER supplier_id" },
      { name: "bank_name", def: "VARCHAR(191) NULL AFTER reason_for_payment" },
      { name: "payment_method", def: "VARCHAR(50) NOT NULL DEFAULT 'Cheque' AFTER bank_name" },
      { name: "cheque_no", def: "VARCHAR(191) NULL AFTER payment_method" },
      { name: "amount", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER cheque_no" },
      { name: "amount_paid", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER amount" },
      { name: "balance_due", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER amount_paid" },
      { name: "payment_type", def: "VARCHAR(50) NOT NULL DEFAULT 'Cash' AFTER balance_due" },
      { name: "payment_terms", def: "VARCHAR(50) NULL AFTER payment_type" },
      { name: "due_date", def: "VARCHAR(50) NULL AFTER payment_terms" },
      { name: "status", def: "VARCHAR(50) NOT NULL DEFAULT 'PAID' AFTER due_date" },
      { name: "settlement_status", def: "VARCHAR(50) NOT NULL DEFAULT 'Fully Settled' AFTER status" },
      { name: "currency", def: "VARCHAR(10) NOT NULL DEFAULT 'ETB' AFTER settlement_status" },
      { name: "amount_in_words", def: "TEXT NULL AFTER currency" },
      { name: "category", def: "VARCHAR(100) NULL AFTER amount_in_words" },
      { name: "payment_advice_attachment", def: "JSON NULL AFTER category" },
      { name: "attachments", def: "JSON NULL AFTER payment_advice_attachment" },
      { name: "installment_payments", def: "JSON NULL AFTER attachments" },
      { name: "items", def: "JSON NULL AFTER installment_payments" },
      { name: "account_entries", def: "JSON NULL AFTER items" },
      { name: "prepared_by", def: "VARCHAR(191) NULL AFTER account_entries" },
      { name: "approved_by", def: "VARCHAR(191) NULL AFTER prepared_by" },
      { name: "paid_by", def: "VARCHAR(191) NULL AFTER approved_by" },
    ]

    for (const col of colsToAdd) {
      if (!colNames.includes(col.name)) {
        console.log(`-> Adding column '${col.name}' to purchase_orders...`)
        await conn.query(`ALTER TABLE purchase_orders ADD COLUMN \`${col.name}\` ${col.def}`)
      }
    }

    if (colNames.includes("payload")) {
      console.log("-> Fetching existing JSON payloads to backfill relational columns...")
      const [oldRows] = await conn.query("SELECT id, payload FROM purchase_orders WHERE payload IS NOT NULL")
      console.log(`-> Found ${oldRows.length} purchase orders to backfill.`)

      for (const r of oldRows) {
        let p = r.payload
        if (typeof p === "string") {
          try { p = JSON.parse(p) } catch { p = {} }
        }
        if (p && typeof p === "object" && p.payload && typeof p.payload === "object" && !Array.isArray(p.payload)) {
          p = { ...p, ...p.payload }
        }

        const poNumber = p.poNumber || p.po_number || p.voucherNo || p.voucher_no || r.id
        const voucherNo = p.voucherNo || p.voucher_no || poNumber
        const dateStr = p.date || new Date().toISOString().split("T")[0]
        const paidTo = p.paidTo || p.paid_to || p.supplier || p.supplierName || "Supplier"
        const supplier = p.supplier || p.supplierName || paidTo
        const supplierId = p.supplierId || p.supplier_id || null
        const reason = p.reasonForPayment || p.reason_for_payment || p.category || null
        const bankName = p.bankName || p.bank_name || null
        const paymentMethod = p.paymentMethod || p.payment_method || "Cheque"
        const chequeNo = p.chequeNo || p.cheque_no || null
        const amount = Number(p.amount || 0)
        const isCredit = (p.paymentType || p.payment_type) === "Credit"
        const amountPaid = isCredit ? Number(p.amountPaid ?? p.amount_paid ?? 0) : amount
        const balanceDue = isCredit ? Number(p.balanceDue ?? p.balance_due ?? Math.max(0, amount - amountPaid)) : 0
        const paymentType = isCredit ? "Credit" : "Cash"
        const paymentTerms = isCredit ? (p.paymentTerms || p.payment_terms || "Net 30") : null
        const dueDate = isCredit ? (p.dueDate || p.due_date || null) : null
        const status = p.status || "PAID"
        const settlementStatus = isCredit ? (balanceDue <= 0.01 ? "Fully Settled" : (amountPaid > 0 ? "Ongoing" : "Unpaid")) : "Fully Settled"
        const currency = p.currency || "ETB"
        const amountInWords = p.amountInWords || p.amount_in_words || null
        const category = p.category || null
        const paymentAdvice = p.paymentAdviceAttachment || p.payment_advice_attachment || null
        const attachments = p.attachments || null
        const installmentPayments = p.installmentPayments || p.installment_payments || null
        const items = p.items || null
        const accountEntries = p.accountEntries || p.account_entries || null
        const preparedBy = p.preparedBy || p.prepared_by || null
        const approvedBy = p.approvedBy || p.approved_by || null
        const paidBy = p.paidBy || p.paid_by || null

        await conn.query(
          `UPDATE purchase_orders SET
            po_number = ?, voucher_no = ?, date = ?, paid_to = ?, supplier = ?, supplier_id = ?,
            reason_for_payment = ?, bank_name = ?, payment_method = ?, cheque_no = ?, amount = ?,
            amount_paid = ?, balance_due = ?, payment_type = ?, payment_terms = ?, due_date = ?,
            status = ?, settlement_status = ?, currency = ?, amount_in_words = ?, category = ?,
            payment_advice_attachment = ?, attachments = ?, installment_payments = ?, items = ?,
            account_entries = ?, prepared_by = ?, approved_by = ?, paid_by = ?
           WHERE id = ?`,
          [
            poNumber,
            voucherNo,
            dateStr,
            paidTo,
            supplier,
            supplierId,
            reason,
            bankName,
            paymentMethod,
            chequeNo,
            amount,
            amountPaid,
            balanceDue,
            paymentType,
            paymentTerms,
            dueDate,
            status,
            settlementStatus,
            currency,
            amountInWords,
            category,
            paymentAdvice ? JSON.stringify(paymentAdvice) : null,
            attachments ? JSON.stringify(attachments) : null,
            installmentPayments ? JSON.stringify(installmentPayments) : null,
            items ? JSON.stringify(items) : null,
            accountEntries ? JSON.stringify(accountEntries) : null,
            preparedBy,
            approvedBy,
            paidBy,
            r.id,
          ]
        )
      }
      console.log("✅ Backfill completed successfully.")

      // Drop legacy payload column
      try {
        await conn.query("ALTER TABLE purchase_orders DROP COLUMN payload")
        console.log("-> Dropped legacy 'payload' column from purchase_orders.")
      } catch (dropErr) {
        console.warn("Notice: could not drop payload column:", dropErr.message)
      }
    }

    console.log("\n================================================================")
    console.log("🎉 PURCHASE ORDERS RELATIONAL MIGRATION COMPLETED SUCCESSFULLY!")
    console.log("================================================================")
  } catch (err) {
    console.error("❌ Migration failed:", err)
    throw err
  } finally {
    conn.release()
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
