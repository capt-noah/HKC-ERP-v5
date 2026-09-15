import { pool } from "../db/client.js"

export const CORE_SYSTEM_GL_MAPPINGS = [
  // ── SALES & REVENUE (6 rules) ──
  {
    id: "sales_credit_ar",
    label: "Trade Accounts Receivable (Credit Invoicing)",
    category: "Sales & Revenue",
    defaultCode: "1300-03",
    defaultName: "VET MEDICEN SALES RECIVABLE",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Customer balance due debited upon issuing a credit sales invoice.",
  },
  {
    id: "sales_cash_clearing",
    label: "Cash / Bank (Direct Cash Sales)",
    category: "Sales & Revenue",
    defaultCode: "1000-02-26",
    defaultName: "CBE_ECB_AC_1000465135224",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Operating bank/cash account debited upon immediate cash sales issue.",
  },
  {
    id: "sales_revenue_domestic",
    label: "Domestic Commercial Sales Revenue",
    category: "Sales & Revenue",
    defaultCode: "4000-01-01",
    defaultName: "SALES OF VETERINARY DRUG",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Operating sales revenue recognized from domestic product sales.",
  },
  {
    id: "sales_revenue_services",
    label: "Service Revenue (Cleaning & Storage)",
    category: "Sales & Revenue",
    defaultCode: "4000-03-02",
    defaultName: "CLEANING SERVICE",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Revenue earned from warehouse grain cleaning, handling, and storage.",
  },
  {
    id: "sales_vat_output",
    label: "VAT Output Payable (15%)",
    category: "Sales & Revenue",
    defaultCode: "2000-05",
    defaultName: "VAT PAYABLE",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Value Added Tax collected from customers, payable to tax authorities.",
  },
  {
    id: "sales_wht_withheld",
    label: "Withholding Tax Receivable Asset (Client Withheld)",
    category: "Sales & Revenue",
    defaultCode: "1320-06-01",
    defaultName: "WITHOLD TAX RECIVABLE",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Tax withheld by clients (2% or 30%), claimable against annual corporate tax.",
  },

  // ── PURCHASING & ACCOUNTS PAYABLE (4 rules) ──
  {
    id: "po_grni_inventory",
    label: "Inventory Stock-In-Hand (PO Goods Receipt / GRN)",
    category: "Purchasing & AP",
    defaultCode: "1410-01",
    defaultName: "STOCK OF GREEN MUNG",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Inventory asset debited when warehouse procurement receiving voucher is logged.",
  },
  {
    id: "po_grni_clearing",
    label: "Goods Received Not Invoiced / Other Accruals",
    category: "Purchasing & AP",
    defaultCode: "2100-06",
    defaultName: "OTHER ACCRUALS",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Clearing accrual liability credited on GRN and debited upon vendor bill receipt.",
  },
  {
    id: "ap_trade_payable",
    label: "Trade Accounts Payable (Supplier Bills)",
    category: "Purchasing & AP",
    defaultCode: "2100-06",
    defaultName: "OTHER ACCRUALS",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Supplier liability credited upon recording vendor purchase bill.",
  },
  {
    id: "ap_advance_prepayment",
    label: "Supplier Advance & Prepayment Asset",
    category: "Purchasing & AP",
    defaultCode: "1100-03",
    defaultName: "PURCHASE ADVANCE",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Cash prepayments issued to suppliers prior to goods receipt.",
  },

  // ── CUSTOMER & SUPPLIER PAYMENTS (3 rules) ──
  {
    id: "customer_receipt_bank",
    label: "Customer Receipt Default Bank Account",
    category: "Banking & Treasury",
    defaultCode: "1000-02-26",
    defaultName: "CBE_ECB_AC_1000465135224",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Default bank account receiving customer settlement funds.",
  },
  {
    id: "supplier_payment_ap",
    label: "Supplier Payment (AP Clearing Debit)",
    category: "Purchasing & AP",
    defaultCode: "2100-06",
    defaultName: "OTHER ACCRUALS",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Clearing supplier liability upon issuing an AP payment voucher.",
  },
  {
    id: "supplier_payment_bank",
    label: "Supplier Payment Disbursing Bank Account",
    category: "Banking & Treasury",
    defaultCode: "1000-02-26",
    defaultName: "CBE_ECB_AC_1000465135224",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Default corporate bank account used to disburse supplier payments.",
  },

  // ── INVENTORY & LOGISTICS (4 rules) ──
  {
    id: "inventory_stock_in_hand",
    label: "Commodity Stock In Hand Asset",
    category: "Inventory & COGS",
    defaultCode: "1410-01",
    defaultName: "STOCK OF GREEN MUNG",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Core balance sheet inventory asset representing warehouse commodities.",
  },
  {
    id: "cogs_stock_fulfillment",
    label: "Cost of Goods Sold (Delivery Notes / Stock Fulfillment)",
    category: "Inventory & COGS",
    defaultCode: "6000-04",
    defaultName: "PACKING AND BAGING",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Cost of sales recognized upon dispatching customer delivery note.",
  },
  {
    id: "stock_shrinkage_loss",
    label: "Physical Inventory Shrinkage / Count Loss",
    category: "Inventory & COGS",
    defaultCode: "6000-22",
    defaultName: "OTHER",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Write-off expense debited when physical count reveals negative variance.",
  },
  {
    id: "stock_adjustment_gain",
    label: "Physical Inventory Surplus / Count Gain",
    category: "Inventory & COGS",
    defaultCode: "4200",
    defaultName: "OTHER INCOME",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Gain recognized when physical audit count reveals positive stock surplus.",
  },

  // ── EXPENSES & WITHHOLDING TAX (4 rules) ──
  {
    id: "expense_default_debit",
    label: "Default General / Administrative Expense",
    category: "Expenses & Taxes",
    defaultCode: "8000-30",
    defaultName: "MICELLANOUS",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Fallback operating expense account for operational payment vouchers.",
  },
  {
    id: "expense_vat_input",
    label: "VAT Input / Receivable Asset (15%)",
    category: "Expenses & Taxes",
    defaultCode: "1320-06-02",
    defaultName: "VAT RECIVABLE",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Input VAT paid on business purchases, claimable against output VAT.",
  },
  {
    id: "expense_wht_payable",
    label: "Withholding Tax Payable (Deducted from Vendors)",
    category: "Expenses & Taxes",
    defaultCode: "2000-04",
    defaultName: "WHT PAYABLE",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "2% or 30% tax withheld from suppliers, payable to tax authority.",
  },
  {
    id: "expense_default_payment",
    label: "Default Petty Cash / Expense Disbursing Account",
    category: "Expenses & Taxes",
    defaultCode: "1000-01-01",
    defaultName: "PETTY CASH-HEAD OFFICE",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Cash account credited for head office petty cash and minor expenses.",
  },

  // ── PAYROLL & HUMAN RESOURCES (4 rules) ──
  {
    id: "payroll_gross_salary_expense",
    label: "Gross Salaries & Wages Expense",
    category: "Payroll & HR",
    defaultCode: "8000-01",
    defaultName: "SALARY AND WAGE",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Total gross compensation debited on monthly payroll accrual run.",
  },
  {
    id: "payroll_income_tax_payable",
    label: "Employee Income Tax (PAYE) Payable",
    category: "Payroll & HR",
    defaultCode: "2000-02",
    defaultName: "INCOME TAX PAYABLE",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Personal income tax withheld from employee payroll, payable to government.",
  },
  {
    id: "payroll_pension_payable",
    label: "Pension Contribution Payable (7% + 11%)",
    category: "Payroll & HR",
    defaultCode: "2000-03",
    defaultName: "PENSION TAX PAYABLE",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Mandatory employee (7%) and employer (11%) pension contributions payable.",
  },
  {
    id: "payroll_accrued_clearing",
    label: "Accrued Net Payroll Payable",
    category: "Payroll & HR",
    defaultCode: "2100-06",
    defaultName: "OTHER ACCRUALS",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Net salary liability credited on accrual, cleared upon payroll bank transfer.",
  },

  // ── BANK RECONCILIATION & FX (3 rules) ──
  {
    id: "bank_service_charge_expense",
    label: "Bank Service Charges & Fees",
    category: "Banking & Treasury",
    defaultCode: "8000-25",
    defaultName: "BANK SERVICE CHARGE",
    normalPosting: "Debit",
    isSystemDefault: true,
    description: "Bank ledger fee debited during monthly bank statement reconciliation.",
  },
  {
    id: "bank_interest_income",
    label: "Bank Interest Income Earned",
    category: "Banking & Treasury",
    defaultCode: "4200",
    defaultName: "OTHER INCOME",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Interest income credited during monthly bank statement reconciliation.",
  },
  {
    id: "fx_unrealized_gain_loss",
    label: "Unrealized Foreign Exchange Gain / Loss",
    category: "Banking & Treasury",
    defaultCode: "4200",
    defaultName: "OTHER INCOME",
    normalPosting: "Credit",
    isSystemDefault: true,
    description: "Variance account for foreign currency bank account revaluations.",
  },
]

export async function seedGLAccountMappings() {
  console.log("==================================================================")
  console.log("   HKC-ERP v5: GL ACCOUNT MAPPINGS TABLE & SEEDING               ")
  console.log("==================================================================")

  // 1. Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`gl_account_mappings\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`label\` VARCHAR(191) NOT NULL,
      \`category\` VARCHAR(50) NOT NULL,
      \`account_id\` VARCHAR(191) NOT NULL,
      \`account_code\` VARCHAR(50) NOT NULL,
      \`account_name\` VARCHAR(191) NOT NULL,
      \`normal_posting\` VARCHAR(10) NOT NULL DEFAULT 'Debit',
      \`is_system_default\` TINYINT(1) NOT NULL DEFAULT 0,
      \`description\` VARCHAR(255) NULL,
      \`updated_by\` VARCHAR(191) NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_mapping_category\` (\`category\`),
      KEY \`idx_mapping_account_id\` (\`account_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log("✅ Table `gl_account_mappings` ensured.")

  // 2. Fetch all Chart of Accounts records to resolve account IDs and names
  const [coaRows] = await pool.query("SELECT id, code, name, is_group FROM chart_of_accounts")
  const coaMap = new Map()
  coaRows.forEach((r) => {
    coaMap.set(r.code, r)
    coaMap.set(r.id, r)
  })

  // 3. Check legacy settings from company_settings.payload
  let legacySettings = {}
  try {
    const [csRows] = await pool.query("SELECT payload FROM company_settings WHERE id = 'default'")
    if (csRows.length > 0 && csRows[0].payload) {
      legacySettings = typeof csRows[0].payload === "string" ? JSON.parse(csRows[0].payload) : csRows[0].payload
    }
  } catch (csErr) {
    console.warn("Notice: could not read company_settings:", csErr.message)
  }

  // 4. Seed or update core mappings
  console.log(`\nSeeding ${CORE_SYSTEM_GL_MAPPINGS.length} core system mapping rules...`)
  let seededCount = 0

  for (const rule of CORE_SYSTEM_GL_MAPPINGS) {
    // Check if legacy settings has a customized override
    let targetCode = rule.defaultCode
    let targetName = rule.defaultName

    if (rule.id === "inventory_stock_in_hand" && legacySettings.default_inventory_account_id) {
      targetCode = legacySettings.default_inventory_account_id
    } else if (rule.id === "sales_revenue_domestic" && legacySettings.default_revenue_account_id) {
      targetCode = legacySettings.default_revenue_account_id
    } else if (rule.id === "cogs_stock_fulfillment" && legacySettings.default_cogs_account_id) {
      targetCode = legacySettings.default_cogs_account_id
    } else if (rule.id === "payroll_gross_salary_expense" && legacySettings.payroll_expense_account_id) {
      targetCode = legacySettings.payroll_expense_account_id
    } else if (rule.id === "payroll_income_tax_payable" && legacySettings.tax_payable_account_id) {
      targetCode = legacySettings.tax_payable_account_id
    } else if (rule.id === "expense_default_payment" && legacySettings.default_cash_account_id) {
      targetCode = legacySettings.default_cash_account_id
    }

    // Resolve COA item
    let coaItem = coaMap.get(targetCode)
    if (coaItem && Boolean(coaItem.is_group)) {
      targetCode = rule.defaultCode
      targetName = rule.defaultName
      coaItem = coaMap.get(targetCode)
    }

    const accountId = coaItem ? coaItem.id : targetCode
    const accountCode = coaItem ? coaItem.code : targetCode
    const accountName = coaItem ? coaItem.name : targetName

    await pool.query(
      `
      INSERT INTO \`gl_account_mappings\` (
        \`id\`, \`label\`, \`category\`, \`account_id\`, \`account_code\`, \`account_name\`,
        \`normal_posting\`, \`is_system_default\`, \`description\`, \`updated_by\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`label\` = VALUES(\`label\`),
        \`category\` = VALUES(\`category\`),
        \`account_id\` = VALUES(\`account_id\`),
        \`account_code\` = VALUES(\`account_code\`),
        \`account_name\` = VALUES(\`account_name\`),
        \`normal_posting\` = VALUES(\`normal_posting\`),
        \`is_system_default\` = VALUES(\`is_system_default\`),
        \`description\` = VALUES(\`description\`);
    `,
      [
        rule.id,
        rule.label,
        rule.category,
        accountId,
        accountCode,
        accountName,
        rule.normalPosting,
        rule.isSystemDefault ? 1 : 0,
        rule.description,
        "System Initializer",
      ]
    )
    seededCount++
  }

  console.log(`✅ ${seededCount} core GL account mapping rules initialized in database.`)

  // 5. Query summary
  const [mappingsInDb] = await pool.query("SELECT id, label, category, account_code, account_name, normal_posting FROM gl_account_mappings")
  console.log(`Total mapping rules in database: ${mappingsInDb.length}\n`)
}

// Run if called directly
if (process.argv[1]?.endsWith("seedGLMappings.js")) {
  seedGLAccountMappings()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Seeding failed:", err)
      pool.end()
      process.exit(1)
    })
}
