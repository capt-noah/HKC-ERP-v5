/**
 * HKC TRADING PLC - AUTHENTIC CHART OF ACCOUNTS (COA) MASTER
 * Direct 1:1 mapping of company's Peachtree / Sage 50 General Ledger setup.
 */

export interface AccountItem {
  id: string
  code: string
  name: string
  account_type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
  peachtree_type?: string
  parent_account_id: string | null
  is_active: boolean
  is_group?: boolean
}

export const COMPANY_CHART_OF_ACCOUNTS: AccountItem[] = [
  // ── CASH & BANKS (1000 series) ──
  { id: "1000", code: "1000", name: "CASH", account_type: "Asset", peachtree_type: "Cash", parent_account_id: null, is_active: true, is_group: true },
  { id: "1000-01-01", code: "1000-01-01", name: "PETTY CASH-HEAD OFFICE", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-10", code: "1000-02-10", name: "ABAY_TAB_AC_1722015651591011", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-13", code: "1000-02-13", name: "AIB_GFB_AC_01304807538500", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-17", code: "1000-02-17", name: "BOA_RDB_35292853", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-20", code: "1000-02-20", name: "OIB_DRB_1074/3834909/001/3001/", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-21", code: "1000-02-21", name: "BOA_FIB_40467351/104878358", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-26", code: "1000-02-26", name: "CBE_ECB_AC_1000465135224", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-29", code: "1000-02-29", name: "UNB_RDB_ECX_1737116287486015", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-31", code: "1000-02-31", name: "UNB_RDB_ECX_1737116287486015 (Sec)", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-33", code: "1000-02-33", name: "CBO_CATB_AC_1059900010301", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },
  { id: "1000-02-41", code: "1000-02-41", name: "AHADU", account_type: "Asset", peachtree_type: "Cash", parent_account_id: "1000", is_active: true, is_group: false },

  // ── RECEIVABLES & CURRENT ASSETS (1100–1320 series) ──
  { id: "1100-03", code: "1100-03", name: "PURCHASE ADVANCE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1101-03", code: "1101-03", name: "NIGUSE ABERA", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1101-04", code: "1101-04", name: "LIYEW MENGISTE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1200-03", code: "1200-03", name: "PRE-PAIED INSURANCE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1200-06", code: "1200-06", name: "ESL CONTAINER DEPOSIT", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1300-03", code: "1300-03", name: "VET MEDICEN SALES RECIVABLE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1300-08", code: "1300-08", name: "SUNDARY RECEIVABLE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1310", code: "1310", name: "OWNER RECEIVABLE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1320-06-01", code: "1320-06-01", name: "WITHOLD TAX RECIVABLE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },
  { id: "1320-06-02", code: "1320-06-02", name: "VAT RECIVABLE", account_type: "Asset", peachtree_type: "Accounts Receivable", parent_account_id: null, is_active: true, is_group: false },

  // ── INVENTORY & GOODS IN TRANSIT (1410–1500 series) ──
  { id: "1410-01", code: "1410-01", name: "STOCK OF GREEN MUNG", account_type: "Asset", peachtree_type: "Inventory", parent_account_id: null, is_active: true, is_group: false },
  { id: "1410-03", code: "1410-03", name: "STOCK OF REDISH SESAME SEED", account_type: "Asset", peachtree_type: "Inventory", parent_account_id: null, is_active: true, is_group: false },
  { id: "1500-09", code: "1500-09", name: "GIT LC- TF260852143701 $171600", account_type: "Asset", peachtree_type: "Inventory", parent_account_id: null, is_active: true, is_group: false },
  { id: "1500-10", code: "1500-10", name: "GIT LC101ILSN260920003 $299999", account_type: "Asset", peachtree_type: "Inventory", parent_account_id: null, is_active: true, is_group: false },

  // ── OTHER ASSETS / CAPITAL WIP (1800 series) ──
  { id: "1800-01", code: "1800-01", name: "CIP (FARM LAND PREPARATION )", account_type: "Asset", peachtree_type: "Other Assets", parent_account_id: null, is_active: true, is_group: false },

  // ── CURRENT LIABILITIES & TAXES (2000–2100 series) ──
  { id: "2000-02", code: "2000-02", name: "INCOME TAX PAYABLE", account_type: "Liability", peachtree_type: "Other Current Liabilities", parent_account_id: null, is_active: true, is_group: false },
  { id: "2000-03", code: "2000-03", name: "PENSION TAX PAYABLE", account_type: "Liability", peachtree_type: "Other Current Liabilities", parent_account_id: null, is_active: true, is_group: false },
  { id: "2000-04", code: "2000-04", name: "WHT PAYABLE", account_type: "Liability", peachtree_type: "Other Current Liabilities", parent_account_id: null, is_active: true, is_group: false },
  { id: "2000-05", code: "2000-05", name: "VAT PAYABLE", account_type: "Liability", peachtree_type: "Other Current Liabilities", parent_account_id: null, is_active: true, is_group: false },
  { id: "2100-06", code: "2100-06", name: "OTHER ACCRUALS", account_type: "Liability", peachtree_type: "Other Current Liabilities", parent_account_id: null, is_active: true, is_group: false },

  // ── EQUITY (3000 series) ──
  { id: "3000", code: "3000", name: "SHARE CAPITAL", account_type: "Equity", peachtree_type: "Equity", parent_account_id: null, is_active: true, is_group: false },
  { id: "3200", code: "3200", name: "RETAINED EARNINGS", account_type: "Equity", peachtree_type: "Equity", parent_account_id: null, is_active: true, is_group: false },

  // ── INCOME & REVENUE (4000 series) ──
  { id: "4000-01-01", code: "4000-01-01", name: "SALES OF VETERINARY DRUG", account_type: "Revenue", peachtree_type: "Income", parent_account_id: null, is_active: true, is_group: false },
  { id: "4000-03-02", code: "4000-03-02", name: "CLEANING SERVICE", account_type: "Revenue", peachtree_type: "Income", parent_account_id: null, is_active: true, is_group: false },
  { id: "4000-03-03", code: "4000-03-03", name: "STORAGE", account_type: "Revenue", peachtree_type: "Income", parent_account_id: null, is_active: true, is_group: false },
  { id: "4200", code: "4200", name: "OTHER INCOME", account_type: "Revenue", peachtree_type: "Income", parent_account_id: null, is_active: true, is_group: false },

  // ── COST OF SALES (6000 series) ──
  { id: "6000", code: "6000", name: "SELLING AND DISTRIBUTION", account_type: "Expense", peachtree_type: "Cost of Sales", parent_account_id: null, is_active: true, is_group: true },
  { id: "6000-01", code: "6000-01", name: "SALARY AND BENEFIT", account_type: "Expense", peachtree_type: "Cost of Sales", parent_account_id: "6000", is_active: true, is_group: false },
  { id: "6000-02", code: "6000-02", name: "OVER TIME", account_type: "Expense", peachtree_type: "Cost of Sales", parent_account_id: "6000", is_active: true, is_group: false },
  { id: "6000-04", code: "6000-04", name: "PACKING AND BAGING", account_type: "Expense", peachtree_type: "Cost of Sales", parent_account_id: "6000", is_active: true, is_group: false },
  { id: "6000-08", code: "6000-08", name: "TRANSPORT COST", account_type: "Expense", peachtree_type: "Cost of Sales", parent_account_id: "6000", is_active: true, is_group: false },
  { id: "6000-10", code: "6000-10", name: "LOADING UNLOADING", account_type: "Expense", peachtree_type: "Cost of Sales", parent_account_id: "6000", is_active: true, is_group: false },
  { id: "6000-22", code: "6000-22", name: "OTHER", account_type: "Expense", peachtree_type: "Cost of Sales", parent_account_id: "6000", is_active: true, is_group: false },

  // ── ADMINISTRATIVE & GENERAL EXPENSES (8000 series) ──
  { id: "8000", code: "8000", name: "ADMINISTRATIVE & GENERAL EXPENSES", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: null, is_active: true, is_group: true },
  { id: "8000-01", code: "8000-01", name: "SALARY AND WAGE", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-02", code: "8000-02", name: "TRANSPORT ALLOWANCE", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-06", code: "8000-06", name: "PENSION CONTRIBUTION", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-07", code: "8000-07", name: "STATIONERY, PRINTING & OFF SUP", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-08", code: "8000-08", name: "OFFICE RENT", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-09", code: "8000-09", name: "TELEPHONE AND INTERNET", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-16", code: "8000-16", name: "INSURANCE", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-18", code: "8000-18", name: "AUDIT FEE & PROFFESSIONAL FEE", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-25", code: "8000-25", name: "BANK SERVICE CHARGE", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-28", code: "8000-28", name: "PENALITY", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
  { id: "8000-30", code: "8000-30", name: "MICELLANOUS", account_type: "Expense", peachtree_type: "Expenses", parent_account_id: "8000", is_active: true, is_group: false },
]

export const DEFAULT_COMPANY_SETTINGS_COA = {
  cash_account_id: "1000-01-01",
  primary_bank_account_id: "1000-02-26",
  ar_account_id: "1300-03",
  inventory_account_id: "1410-01",
  ap_account_id: "2100-06",
  tax_payable_account_id: "2000-05",
  wht_payable_account_id: "2000-04",
  income_tax_payable_account_id: "2000-02",
  pension_payable_account_id: "2000-03",
  retained_earnings_account_id: "3200",
  share_capital_account_id: "3000",
  sales_account_id: "4000-01-01",
  cogs_account_id: "6000",
  payroll_expense_account_id: "8000-01",
}

export interface GlAccountMapping {
  id: string
  label: string
  category: "Sales & Revenue" | "Purchasing & AP" | "Inventory & COGS" | "Payroll & HR" | "Expenses & Taxes" | "Banking & Treasury" | "Custom" | string
  account_id: string
  account_code: string
  account_name: string
  normal_posting: "Debit" | "Credit"
  is_system_default: boolean
  description?: string
  updated_by?: string
  created_at?: string
  updated_at?: string
}

export const DEFAULT_GL_ACCOUNT_MAPPINGS: GlAccountMapping[] = [
  // ── SALES & REVENUE (6 rules) ──
  {
    id: "sales_credit_ar",
    label: "Trade Accounts Receivable (Credit Invoicing)",
    category: "Sales & Revenue",
    account_id: "1300-03",
    account_code: "1300-03",
    account_name: "VET MEDICEN SALES RECIVABLE",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Customer balance due debited upon issuing a credit sales invoice.",
  },
  {
    id: "sales_cash_clearing",
    label: "Cash / Bank (Direct Cash Sales)",
    category: "Sales & Revenue",
    account_id: "1000-02-26",
    account_code: "1000-02-26",
    account_name: "CBE_ECB_AC_1000465135224",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Operating bank/cash account debited upon immediate cash sales issue.",
  },
  {
    id: "sales_revenue_domestic",
    label: "Domestic Commercial Sales Revenue",
    category: "Sales & Revenue",
    account_id: "4000-01-01",
    account_code: "4000-01-01",
    account_name: "SALES OF VETERINARY DRUG",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Operating sales revenue recognized from domestic product sales.",
  },
  {
    id: "sales_revenue_services",
    label: "Service Revenue (Cleaning & Storage)",
    category: "Sales & Revenue",
    account_id: "4000-03-02",
    account_code: "4000-03-02",
    account_name: "CLEANING SERVICE",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Revenue earned from warehouse grain cleaning, handling, and storage.",
  },
  {
    id: "sales_vat_output",
    label: "VAT Output Payable (15%)",
    category: "Sales & Revenue",
    account_id: "2000-05",
    account_code: "2000-05",
    account_name: "VAT PAYABLE",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Value Added Tax collected from customers, payable to tax authorities.",
  },
  {
    id: "sales_wht_withheld",
    label: "Withholding Tax Receivable Asset (Client Withheld)",
    category: "Sales & Revenue",
    account_id: "1320-06-01",
    account_code: "1320-06-01",
    account_name: "WITHOLD TAX RECIVABLE",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Tax withheld by clients (2% or 30%), claimable against annual corporate tax.",
  },

  // ── PURCHASING & ACCOUNTS PAYABLE (4 rules) ──
  {
    id: "po_grni_inventory",
    label: "Inventory Stock-In-Hand (PO Goods Receipt / GRN)",
    category: "Purchasing & AP",
    account_id: "1410-01",
    account_code: "1410-01",
    account_name: "STOCK OF GREEN MUNG",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Inventory asset debited when warehouse procurement receiving voucher is logged.",
  },
  {
    id: "po_grni_clearing",
    label: "Goods Received Not Invoiced / Other Accruals",
    category: "Purchasing & AP",
    account_id: "2100-06",
    account_code: "2100-06",
    account_name: "OTHER ACCRUALS",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Clearing accrual liability credited on GRN and debited upon vendor bill receipt.",
  },
  {
    id: "ap_trade_payable",
    label: "Trade Accounts Payable (Supplier Bills)",
    category: "Purchasing & AP",
    account_id: "2100-06",
    account_code: "2100-06",
    account_name: "OTHER ACCRUALS",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Supplier liability credited upon recording vendor purchase bill.",
  },
  {
    id: "ap_advance_prepayment",
    label: "Supplier Advance & Prepayment Asset",
    category: "Purchasing & AP",
    account_id: "1100-03",
    account_code: "1100-03",
    account_name: "PURCHASE ADVANCE",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Cash prepayments issued to suppliers prior to goods receipt.",
  },

  // ── CUSTOMER & SUPPLIER PAYMENTS (3 rules) ──
  {
    id: "customer_receipt_bank",
    label: "Customer Receipt Default Bank Account",
    category: "Banking & Treasury",
    account_id: "1000-02-26",
    account_code: "1000-02-26",
    account_name: "CBE_ECB_AC_1000465135224",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Default bank account receiving customer settlement funds.",
  },
  {
    id: "supplier_payment_ap",
    label: "Supplier Payment (AP Clearing Debit)",
    category: "Purchasing & AP",
    account_id: "2100-06",
    account_code: "2100-06",
    account_name: "OTHER ACCRUALS",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Clearing supplier liability upon issuing an AP payment voucher.",
  },
  {
    id: "supplier_payment_bank",
    label: "Supplier Payment Disbursing Bank Account",
    category: "Banking & Treasury",
    account_id: "1000-02-26",
    account_code: "1000-02-26",
    account_name: "CBE_ECB_AC_1000465135224",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Default corporate bank account used to disburse supplier payments.",
  },

  // ── INVENTORY & LOGISTICS (4 rules) ──
  {
    id: "inventory_stock_in_hand",
    label: "Commodity Stock In Hand Asset",
    category: "Inventory & COGS",
    account_id: "1410-01",
    account_code: "1410-01",
    account_name: "STOCK OF GREEN MUNG",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Core balance sheet inventory asset representing warehouse commodities.",
  },
  {
    id: "cogs_stock_fulfillment",
    label: "Cost of Goods Sold (Delivery Notes / Stock Fulfillment)",
    category: "Inventory & COGS",
    account_id: "6000-04",
    account_code: "6000-04",
    account_name: "PACKING AND BAGING",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Cost of sales recognized upon dispatching customer delivery note.",
  },
  {
    id: "stock_shrinkage_loss",
    label: "Physical Inventory Shrinkage / Count Loss",
    category: "Inventory & COGS",
    account_id: "6000-22",
    account_code: "6000-22",
    account_name: "OTHER",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Write-off expense debited when physical count reveals negative variance.",
  },
  {
    id: "stock_adjustment_gain",
    label: "Physical Inventory Surplus / Count Gain",
    category: "Inventory & COGS",
    account_id: "4200",
    account_code: "4200",
    account_name: "OTHER INCOME",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Gain recognized when physical audit count reveals positive stock surplus.",
  },

  // ── EXPENSES & WITHHOLDING TAX (4 rules) ──
  {
    id: "expense_default_debit",
    label: "Default General / Administrative Expense",
    category: "Expenses & Taxes",
    account_id: "8000-30",
    account_code: "8000-30",
    account_name: "MICELLANOUS",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Fallback operating expense account for operational payment vouchers.",
  },
  {
    id: "expense_vat_input",
    label: "VAT Input / Receivable Asset (15%)",
    category: "Expenses & Taxes",
    account_id: "1320-06-02",
    account_code: "1320-06-02",
    account_name: "VAT RECIVABLE",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Input VAT paid on business purchases, claimable against output VAT.",
  },
  {
    id: "expense_wht_payable",
    label: "Withholding Tax Payable (Deducted from Vendors)",
    category: "Expenses & Taxes",
    account_id: "2000-04",
    account_code: "2000-04",
    account_name: "WHT PAYABLE",
    normal_posting: "Credit",
    is_system_default: true,
    description: "2% or 30% tax withheld from suppliers, payable to tax authority.",
  },
  {
    id: "expense_default_payment",
    label: "Default Petty Cash / Expense Disbursing Account",
    category: "Expenses & Taxes",
    account_id: "1000-01-01",
    account_code: "1000-01-01",
    account_name: "PETTY CASH-HEAD OFFICE",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Cash account credited for head office petty cash and minor expenses.",
  },

  // ── PAYROLL & HUMAN RESOURCES (4 rules) ──
  {
    id: "payroll_gross_salary_expense",
    label: "Gross Salaries & Wages Expense",
    category: "Payroll & HR",
    account_id: "8000-01",
    account_code: "8000-01",
    account_name: "SALARY AND WAGE",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Total gross compensation debited on monthly payroll accrual run.",
  },
  {
    id: "payroll_income_tax_payable",
    label: "Employee Income Tax (PAYE) Payable",
    category: "Payroll & HR",
    account_id: "2000-02",
    account_code: "2000-02",
    account_name: "INCOME TAX PAYABLE",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Personal income tax withheld from employee payroll, payable to government.",
  },
  {
    id: "payroll_pension_payable",
    label: "Pension Contribution Payable (7% + 11%)",
    category: "Payroll & HR",
    account_id: "2000-03",
    account_code: "2000-03",
    account_name: "PENSION TAX PAYABLE",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Mandatory employee (7%) and employer (11%) pension contributions payable.",
  },
  {
    id: "payroll_accrued_clearing",
    label: "Accrued Net Payroll Payable",
    category: "Payroll & HR",
    account_id: "2100-06",
    account_code: "2100-06",
    account_name: "OTHER ACCRUALS",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Net salary liability credited on accrual, cleared upon payroll bank transfer.",
  },

  // ── BANK RECONCILIATION & FX (3 rules) ──
  {
    id: "bank_service_charge_expense",
    label: "Bank Service Charges & Fees",
    category: "Banking & Treasury",
    account_id: "8000-25",
    account_code: "8000-25",
    account_name: "BANK SERVICE CHARGE",
    normal_posting: "Debit",
    is_system_default: true,
    description: "Bank ledger fee debited during monthly bank statement reconciliation.",
  },
  {
    id: "bank_interest_income",
    label: "Bank Interest Income Earned",
    category: "Banking & Treasury",
    account_id: "4200",
    account_code: "4200",
    account_name: "OTHER INCOME",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Interest income credited during monthly bank statement reconciliation.",
  },
  {
    id: "fx_unrealized_gain_loss",
    label: "Unrealized Foreign Exchange Gain / Loss",
    category: "Banking & Treasury",
    account_id: "4200",
    account_code: "4200",
    account_name: "OTHER INCOME",
    normal_posting: "Credit",
    is_system_default: true,
    description: "Variance account for foreign currency bank account revaluations.",
  },
]

