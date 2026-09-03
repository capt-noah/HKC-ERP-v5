import { useState, useEffect } from "react"
import { deleteResource, loadResource, persistResources } from "./apiPersistence"
import { useAuthStore } from "./authStore"
import { validateJournalVoucher } from "../core/finance/ledgerEngine"
import { sortNewestFirst } from "./utils"
import { COMPANY_CHART_OF_ACCOUNTS, DEFAULT_COMPANY_SETTINGS_COA } from "./companyCOA"
import {
  type TaxRule,
  type TaxSchedule,
  type TaxLineDetail,
  type TaxCalculationResult,
  INITIAL_TAX_RULES,
  INITIAL_TAX_SCHEDULES,
  calculateMultiTax,
  resolveAutoTaxScheduleId,
} from "./taxEngine"

export type { TaxRule, TaxSchedule, TaxLineDetail, TaxCalculationResult }
export { calculateMultiTax, resolveAutoTaxScheduleId }

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

export interface JournalEntry {
  id: string
  entry_date: string
  description: string
  source_type:
    | "Sales Invoice"
    | "Purchase Invoice"
    | "Payment Voucher"
    | "Payment"
    | "Payroll Run"
    | "Payroll Accrual"
    | "Payroll Payment"
    | "Exchange Revaluation"
    | "Warehouse Transfer"
    | "Manual Adjustment"
    | "Recurring Expense"
    | "Round Off"
    | "Reversal"
  source_id: string | null
  created_by: string
  currency: string
  exchange_rate: number
  is_reversal_of: string | null
}

export interface JournalEntryLine {
  id: string
  journal_entry_id: string
  account_id: string
  debit_amount: number
  credit_amount: number
  currency: string
  exchange_rate_at_time: number
  warehouse_id: string | null
  party_type?: "Customer" | "Supplier" | "Employee" | null
  party_id?: string | null
  party_name?: string | null
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Invoice {
  id: string
  invoice_number: string
  sales_order_id?: string
  sales_issue_id?: string
  fs_no?: string
  customer_name: string
  issue_date: string
  due_date: string
  currency: string
  line_items: InvoiceLineItem[]
  subtotal: number
  tax_amount: number
  tax_rate?: number
  discount_amount?: number
  payment_terms?: string
  notes?: string
  attachments?: any[]
  total: number
  amount_paid: number
  balance_due: number
  settlement_status?: "Unpaid" | "Ongoing" | "Fully Settled"
  status: "Draft" | "Sent" | "Paid" | "Partially Paid" | "Overdue" | "Void" | "Cancelled"
}

export interface Payment {
  id: string
  direction: "Received" | "Made"
  linked_invoice_id: string | null
  sales_issue_id?: string | null
  sales_order_id?: string | null
  customer_id?: string | null
  customer_name?: string | null
  amount: number
  currency: string
  date: string
  method: string
  bank_account_code?: string
  reference: string
  payment_advice_url?: string
  payment_advice_filename?: string
  installment_no?: number
  notes?: string
}

export interface RecurringExpenseSchedule {
  id: string
  expense_type: "Office Rent" | "Warehouse Rent" | "Petty Cash" | "Vehicle Cost" | "Software & SaaS" | "Other"
  amount: number
  currency: string
  frequency: "Monthly" | "Quarterly" | "Annually"
  next_due_date: string
  linked_resource_id: string | null
  cost_center?: string
  auto_generate: boolean
  status: "Active" | "Paused"
}

export interface OneOffExpense {
  id: string
  merchant: string
  category: string
  date: string
  employee: string
  amount: number
  currency: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  cost_center?: string
  gl_account_id?: string
  receipt_ref?: string
  tax_amount?: number
}

export interface VehicleMaintenance {
  date: string
  description: string
  amount: number
}

export interface Vehicle {
  id: string
  registration_number: string
  type: string
  assigned_warehouse: string
  driver_name: string
  maintenance_cost_history: VehicleMaintenance[]
  status: "Active" | "In Repair" | "Retired"
}

export interface AccountingPeriod {
  id: string
  period_label: string
  start_date: string
  end_date: string
  is_closed: boolean
}

export interface CompanySettings {
  company_name: string
  base_currency: string
  exchange_rates: Record<string, number>
  unrealized_exchange_gain_loss_account_id: string
  payroll_expense_account_id: string
  payroll_payable_account_id: string
  tax_payable_account_id: string
  cash_account_id?: string
  processing_rate_per_quintal?: number
  base_storage_rate_per_quintal_day?: number
  storage_increment_per_month?: number
  max_storage_month_cap?: number
  tin_number?: string
  address?: string
  contact_email?: string
  contact_phone?: string
  fiscal_year_start?: string
  storage_free_days?: number
  default_reorder_level?: number
  prevent_negative_stock?: boolean
  auto_delivery_notes?: boolean
  default_payment_terms?: string
  default_inventory_account_id?: string
  default_revenue_account_id?: string
  default_cogs_account_id?: string
  default_damage_account_id?: string
  default_cash_account_id?: string
  pension_employee_rate?: number
  pension_employer_rate?: number
  pension_expat_exempt?: boolean
  tax_brackets_config?: { min: number; max: number | null; ratePercent: number; deductible: number }[]
}

const emptyCompanySettings: CompanySettings = {
  company_name: "HKC Trading PLC",
  base_currency: "ETB",
  exchange_rates: { USD: 58.50, EUR: 63.20 },
  unrealized_exchange_gain_loss_account_id: "",
  payroll_expense_account_id: DEFAULT_COMPANY_SETTINGS_COA.payroll_expense_account_id,
  payroll_payable_account_id: DEFAULT_COMPANY_SETTINGS_COA.income_tax_payable_account_id,
  tax_payable_account_id: DEFAULT_COMPANY_SETTINGS_COA.tax_payable_account_id,
  processing_rate_per_quintal: 150,
  base_storage_rate_per_quintal_day: 1.25,
  storage_increment_per_month: 0.25,
  max_storage_month_cap: 4,
  tin_number: "0012345678",
  address: "Bole Subcity, Woreda 03, Addis Ababa, Ethiopia",
  contact_email: "info@hkctrading.com",
  contact_phone: "+251 11 662 4580",
  fiscal_year_start: "July",
  storage_free_days: 7,
  default_reorder_level: 50,
  prevent_negative_stock: true,
  auto_delivery_notes: true,
  default_payment_terms: "Net 30 Days",
  default_inventory_account_id: DEFAULT_COMPANY_SETTINGS_COA.inventory_account_id,
  default_revenue_account_id: DEFAULT_COMPANY_SETTINGS_COA.sales_account_id,
  default_cogs_account_id: DEFAULT_COMPANY_SETTINGS_COA.cogs_account_id,
  default_damage_account_id: "6000-22",
  default_cash_account_id: DEFAULT_COMPANY_SETTINGS_COA.cash_account_id,
  pension_employee_rate: 7,
  pension_employer_rate: 11,
  pension_expat_exempt: true,
}

export interface PayrollDeduction {
  type: string
  amount: number
}

export interface PayrollEmployee {
  employee_id: string
  employee_name: string
  gross_pay: number
  deductions: PayrollDeduction[]
  net_pay: number
}

export interface PayrollRun {
  id: string
  period_label: string
  period_start: string
  period_end: string
  status: "Draft" | "Accrued" | "Paid"
  employees: PayrollEmployee[]
  total_gross: number
  total_deductions: number
  total_net: number
  accrual_journal_entry_id: string | null
  payment_journal_entry_id: string | null
}

export interface Revaluation {
  id: string
  revaluation_date: string
  currency: string
  target_account_id: string
  original_balance: number
  current_rate: number
  new_balance_in_base: number
  unrealized_gain_loss: number
  journal_entry_id: string | null
  status: "Draft" | "Posted" | "Cancelled"
}


export interface DepreciationScheduleItem {
  id: string
  depreciation_date: string
  depreciation_amount: number
  journal_entry_id: string | null
  status: "Pending" | "Posted"
}

export interface FixedAsset {
  id: string
  name: string
  category: "Vehicles" | "Machinery" | "IT Hardware" | "Buildings" | "Office Equipment"
  purchaseDate: string
  depreciationStartDate: string
  cost: number
  salvageValue: number
  usefulLifeYears: number
  accumulatedDepreciation: number
  status: "Draft" | "Active" | "Disposed" | "Fully Depreciated"
  depreciation_schedule: DepreciationScheduleItem[]
  asset_account_id: string
  depreciation_expense_account_id: string
  accumulated_depreciation_account_id: string
  location?: string
  serialNumber?: string
}

export function helperGenerateDeprSchedule(
  cost: number,
  salvage: number,
  lifeYears: number,
  startDateStr: string,
  accumulatedDepreciation: number
): DepreciationScheduleItem[] {
  const schedule: DepreciationScheduleItem[] = []
  const totalMonths = lifeYears * 12
  const deprPerMonth = Math.round(((cost - salvage) / totalMonths) * 100) / 100
  let currentDate = new Date(startDateStr)
  if (isNaN(currentDate.getTime())) {
    currentDate = new Date()
  }
  
  const postedCount = deprPerMonth > 0 ? Math.round(accumulatedDepreciation / deprPerMonth) : 0
  
  for (let i = 1; i <= totalMonths; i++) {
    const dateStr = currentDate.toISOString().split("T")[0]
    schedule.push({
      id: `DEP-SCH-${i}`,
      depreciation_date: dateStr,
      depreciation_amount: deprPerMonth,
      journal_entry_id: i <= postedCount ? "JE-SYSTEM-PREV" : null,
      status: i <= postedCount ? "Posted" : "Pending",
    })
    // Increment month safely
    currentDate.setMonth(currentDate.getMonth() + 1)
  }
  return schedule
}

// Finance starts empty and is hydrated exclusively from the Finance API.
class FinanceStore {
  private accounts: AccountItem[] = []
  private entries: JournalEntry[] = []
  private lines: JournalEntryLine[] = []
  private invoices: Invoice[] = []
  private payments: Payment[] = []
  private recurringSchedules: RecurringExpenseSchedule[] = []
  private expenses: OneOffExpense[] = []
  private vehicles: Vehicle[] = []
  private periods: AccountingPeriod[] = []
  private companySettings: CompanySettings = emptyCompanySettings
  private payrollRuns: PayrollRun[] = []
  private revaluations: Revaluation[] = []
  private fixedAssets: FixedAsset[] = []
  private taxRules: TaxRule[] = []
  private taxSchedules: TaxSchedule[] = []

  private listeners = new Set<() => void>()
  private _isLoading = false
  private _loadError: string | null = null
  private _isLoaded = false
  private _loadInProgress = false

  constructor() {
    // Eager constructor load removed to prevent firing 19+ requests on import/startup
  }

  public isLoaded(): boolean {
    return this._isLoaded
  }

  private clearFinanceState() {
    this.accounts = []
    this.entries = []
    this.lines = []
    this.invoices = []
    this.payments = []
    this.recurringSchedules = []
    this.expenses = []
    this.vehicles = []
    this.periods = []
    this.companySettings = emptyCompanySettings
    this.payrollRuns = []
    this.revaluations = []
    this.fixedAssets = []
    this.taxRules = []
    this.taxSchedules = []
  }

  public async loadFromApi(force = false) {
    const user = useAuthStore.getState().user
    const roles = user?.roles || []
    const isAuthorized = roles.includes("finance_manager") || roles.includes("superadmin")

    if (!useAuthStore.getState().token || !isAuthorized) {
      this._isLoading = false
      return
    }

    if (this._isLoaded && !force) return
    if (this._loadInProgress) return

    this._loadInProgress = true
    this._isLoading = true
    this._loadError = null
    this.listeners.forEach((l) => l())
    try {
      const [
        accounts,
        entries,
        lines,
        invoices,
        payments,
        recurringSchedules,
        expenses,
        vehicles,
        companySettingsRows,
        taxRules,
      ] = await Promise.all([
        loadResource<AccountItem>("chart_of_accounts").catch(() => []),
        loadResource<JournalEntry>("journal_entries").catch(() => []),
        loadResource<JournalEntryLine>("journal_entry_lines").catch(() => []),
        loadResource<Invoice>("invoices").catch(() => []),
        loadResource<Payment>("payments").catch(() => []),
        loadResource<RecurringExpenseSchedule>("recurring_expense_schedules").catch(() => []),
        loadResource<OneOffExpense>("expenses").catch(() => []),
        loadResource<Vehicle>("vehicles").catch(() => []),
        loadResource<CompanySettings & { id?: string }>("company_settings").catch(() => []),
        loadResource<TaxRule>("tax_rules").catch(() => []),
      ])

      if (!Array.isArray(accounts) || accounts.length === 0 || accounts.some((a) => a.id?.startsWith("ACC-1000") || a.code === "1010")) {
        this.accounts = COMPANY_CHART_OF_ACCOUNTS
        void persistResources([{ resource: "chart_of_accounts", items: COMPANY_CHART_OF_ACCOUNTS }])
      } else {
        this.accounts = accounts
      }

      this.entries = sortNewestFirst(entries.map((e: any) => ({
        ...e,
        entry_number: e.entry_number || e.id,
        posting_status: e.posting_status || "POSTED",
        source_type: e.source_type || "MANUAL",
        currency: e.currency || "ETB",
      })))
      this.lines = lines.map((l: any) => ({
        ...l,
        debit_amount: Number(l.debit_amount ?? l.debit ?? 0),
        credit_amount: Number(l.credit_amount ?? l.credit ?? 0),
        currency: l.currency || "ETB",
        exchange_rate_at_time: Number(l.exchange_rate_at_time || 1.0),
      }))
      this.invoices = sortNewestFirst(invoices.map((inv: any) => {
        const rawItems = Array.isArray(inv.line_items) ? inv.line_items : []
        const line_items: InvoiceLineItem[] = rawItems.map((li: any) => {
          const qty = Number(li.quantity || li.qty || 1)
          const up = Number(li.unit_price ?? li.price ?? 0)
          const tot = Number(li.line_total ?? li.total ?? (qty * up))
          return {
            description: li.description || li.name || "Item",
            quantity: qty,
            unit_price: up,
            line_total: tot,
          }
        })
        const totalVal = Number(inv.total ?? inv.total_amount ?? inv.amount ?? (line_items.length > 0 ? line_items.reduce((s, i) => s + i.line_total, 0) : 0))
        const subtotalVal = Number(inv.subtotal ?? (line_items.length > 0 ? line_items.reduce((s, i) => s + i.line_total, 0) : totalVal))
        const amountPaid = Number(inv.amount_paid || 0)
        const balanceDue = Number(inv.balance_due !== undefined ? inv.balance_due : Math.max(0, totalVal - amountPaid))
        const isPaid = (inv.status || "").toLowerCase() === "paid" || (totalVal > 0 && balanceDue <= 0)
        return {
          ...inv,
          customer_name: inv.customer_name || inv.customer || "Customer",
          line_items: line_items.length > 0 ? line_items : [{ description: `Invoice ${inv.invoice_number || inv.id}`, quantity: 1, unit_price: totalVal, line_total: totalVal }],
          subtotal: subtotalVal,
          total: totalVal,
          total_amount: totalVal,
          amount_paid: amountPaid,
          balance_due: balanceDue,
          status: isPaid ? "Paid" : (amountPaid > 0 ? "Partially Paid" : (inv.status || "Sent")),
          settlement_status: isPaid ? "Fully Settled" : (amountPaid > 0 ? "Ongoing" : "Unpaid"),
        }
      }))
      this.payments = sortNewestFirst(payments)
      this.recurringSchedules = sortNewestFirst(recurringSchedules)
      this.expenses = sortNewestFirst(expenses.map((exp: any) => ({
        ...exp,
        amount: Number(exp.amount ?? 0),
        status: exp.status || "Approved",
      })))
      this.vehicles = sortNewestFirst(vehicles)
      const { id: _settingsId, ...companySettings } = companySettingsRows[0] || { id: "default", ...emptyCompanySettings }
      this.companySettings = companySettings as CompanySettings
      if (Array.isArray(taxRules) && taxRules.length > 0 && !taxRules.some((t: any) => t.id === "TAX-01" || t.id === "TAX-001")) {
        this.taxRules = sortNewestFirst(taxRules.map((t: any) => ({
          ...t,
          id: t.id,
          name: t.name || "Tax Rule",
          ratePercent: Number(t.ratePercent ?? t.rate ?? 0),
          type: t.type || "VAT/GST",
          accountCode: t.accountCode ?? t.gl_account_code ?? "2000-05",
          isInclusive: Boolean(t.isInclusive ?? t.is_inclusive ?? false),
          isDeduction: Boolean(t.isDeduction ?? t.is_deduction ?? false),
          appliesTo: t.appliesTo || t.applies_to || "BOTH",
          description: t.description || "",
          is_active: t.is_active !== false,
        })))
      } else {
        this.taxRules = INITIAL_TAX_RULES
        void persistResources([{ resource: "tax_rules", items: INITIAL_TAX_RULES }])
      }

      this.taxSchedules = INITIAL_TAX_SCHEDULES

      // Trigger cross-module live finance sync
      await this.syncCrossModule()

      this._isLoaded = true
      this._loadError = null
    } catch (error) {
      console.error("Failed to load finance data from Database.", error)
      this.clearFinanceState()
      const msg = error instanceof Error ? error.message : "Could not connect to the server. Finance data is unavailable."
      if (/token|expired|jwt/i.test(msg)) {
        this._loadError = null
      } else {
        this._loadError = msg
      }
      this._isLoaded = true
    } finally {
      this._isLoading = false
      this.notify()
    }
  }

  /**
   * Cross-Module Live Finance Sync Engine
   */
  public async syncCrossModule(customSalesIssues?: any[], customPurchaseOrders?: any[]) {
    try {
      const [fetchedSI, fetchedSO, fetchedPO, fetchedPR, fetchedCust, fetchedPS] = await Promise.all([
        loadResource<any>("sales_issues").catch(() => []),
        loadResource<any>("sales_orders").catch(() => []),
        loadResource<any>("purchase_orders").catch(() => []),
        loadResource<any>("payroll_records").catch(() => []),
        loadResource<any>("customers").catch(() => []),
        loadResource<any>("processing_services").catch(() => []),
      ])

      const salesIssues = customSalesIssues || fetchedSI
      const purchaseOrders = customPurchaseOrders || fetchedPO
      const payrollRecords = fetchedPR

      const custMap = new Map((fetchedCust || []).map((c: any) => [c.id, (c.payload ? c.payload.name : c.name) || c.id]))
      const soMap = new Map((fetchedSO || []).map((so: any) => [so.id, so.payload ? { ...so.payload, ...so } : so]))

      let hasNewSync = false

      // Helper: look up a specific account by code. Returns null if not found.
      const acc = (code: string) => this.accounts.find((a) => a.code === code) ?? null

          // A. Sync Sales Issues → Sales Revenue & COGS GL Entries and Invoices
          salesIssues.forEach((si: any) => {
            const rawItems = Array.isArray(si.items) && si.items.length > 0 ? si.items : []
            const lineItems: InvoiceLineItem[] = rawItems.length > 0
              ? rawItems.map((i: any) => {
                  const qty = Number(i.quantity || i.qty || 1)
                  const unitPrice = Number(i.unit_price ?? i.price ?? 0)
                  const lineTotal = Number(i.amount || (qty * unitPrice))
                  return {
                    description: i.item_name || i.name || "Issued Item",
                    quantity: qty,
                    unit_price: unitPrice,
                    line_total: lineTotal,
                  }
                })
              : [{ description: `Sales Issue ${si.fs_no || si.id}`, quantity: 1, unit_price: Number(si.total_amount || 0), line_total: Number(si.total_amount || 0) }]

            const matchedOrder = soMap.get(si.sales_order_id || si.reference_no)
            const matchedCustName = custMap.get(si.customer_id) || matchedOrder?.customer || (si.customer_name && si.customer_name !== "Customer" ? si.customer_name : null) || si.customer || "Customer"

            const subtotal = Number(si.subtotal_amount || si.subtotal || lineItems.reduce((sum, item) => sum + item.line_total, 0))
            const isWh1 = (si.warehouse_id || matchedOrder?.warehouse || "").toString().toUpperCase().startsWith("WH1")
            const vatAmount = Number(si.tax_amount !== undefined ? si.tax_amount : (si.vat_amount !== undefined ? si.vat_amount : (isWh1 ? 0 : Math.round(subtotal * 0.15))))
            const taxRate = Number(si.vat_rate !== undefined ? si.vat_rate : (vatAmount > 0 && subtotal > 0 ? Math.round((vatAmount / subtotal) * 100) : (isWh1 ? 0 : 15)))
            const discountAmount = Number(si.discount_amount || 0)
            const whtAmount = Number(si.wht_amount || 0)
            const invoiceTotal = Number(si.total_amount || (subtotal + vatAmount - discountAmount))
            const netReceivableDue = Math.max(0, invoiceTotal - whtAmount)

            const isCredit = (si.payment_type || si.paymentType || si.payment_method || si.paymentMethod || "").toString().toLowerCase().includes("credit")
            const isCash = !isCredit
            const isPosted = (si.status || "").toLowerCase() === "posted"

            // ── GL journal entries (only for posted records with valid total) ──
            if (isPosted && invoiceTotal > 0) {
              const saleJeId = `JE-SALE-${si.id}`
              const cogsJeId = `JE-COGS-${si.id}`

              // Sale Revenue entry
              const hasSaleEntry = this.entries.some((e) => e.id === saleJeId)
              const hasSaleLines = this.lines.some((l) => l.journal_entry_id === saleJeId)

              if (!hasSaleEntry || !hasSaleLines) {
                this.entries = this.entries.filter((e) => e.id !== saleJeId)
                this.lines = this.lines.filter((l) => l.journal_entry_id !== saleJeId)

                const debitAcc = isCredit
                  ? (acc("1300-03") || acc("1200-03") || acc("1100-03") || this.accounts.find((a) => a.account_type === "Asset" && !a.is_group))
                  : (acc("1000-02-26") || acc("1000-01-01") || acc("1000") || this.accounts.find((a) => a.account_type === "Asset" && !a.is_group))
                const revenueAcc = acc("4000-01-01") || acc("4000-03-02") || acc("4000") || this.accounts.find((a) => a.account_type === "Revenue" && !a.is_group)
                const vatAcc = acc("2000-05") || this.accounts.find((a) => a.account_type === "Liability" && !a.is_group)
                const whtAssetAcc = acc("1320-06-01") || this.accounts.find((a) => a.account_type === "Asset" && !a.is_group)

                if (debitAcc && revenueAcc) {
                  this.entries.push({
                    id: saleJeId,
                    entry_date: si.sale_date || new Date().toISOString().split("T")[0],
                    source_type: "Sales Invoice",
                    source_id: si.id,
                    created_by: "System Synced",
                    currency: "ETB",
                    exchange_rate: 1.0,
                    description: `Sales Issue ${si.fs_no || si.id} — ${si.customer_name || "Customer"}${whtAmount > 0 ? " (WHT applied)" : ""}`,
                    is_reversal_of: null,
                  })

                  const newSaleLines: JournalEntryLine[] = []
                  let lineIdx = 1

                  // 1. Debit Net Receivable or Cash
                  newSaleLines.push({
                    id: `${saleJeId}-${lineIdx++}`,
                    journal_entry_id: saleJeId,
                    account_id: debitAcc.id,
                    debit_amount: netReceivableDue,
                    credit_amount: 0,
                    currency: "ETB",
                    exchange_rate_at_time: 1.0,
                    warehouse_id: si.warehouse_id || null,
                    party_type: "Customer",
                    party_id: si.customer_id || null,
                    party_name: si.customer_name || null,
                  })

                  // 2. Debit Withholding Tax Asset (if client withheld tax)
                  if (whtAmount > 0 && whtAssetAcc) {
                    newSaleLines.push({
                      id: `${saleJeId}-${lineIdx++}`,
                      journal_entry_id: saleJeId,
                      account_id: whtAssetAcc.id,
                      debit_amount: whtAmount,
                      credit_amount: 0,
                      currency: "ETB",
                      exchange_rate_at_time: 1.0,
                      warehouse_id: si.warehouse_id || null,
                      party_type: "Customer",
                      party_id: si.customer_id || null,
                      party_name: si.customer_name || null,
                    })
                  }

                  // 3. Credit Base Sales Revenue (Subtotal net of discount)
                  const baseRevenue = Math.max(0, subtotal - discountAmount)
                  newSaleLines.push({
                    id: `${saleJeId}-${lineIdx++}`,
                    journal_entry_id: saleJeId,
                    account_id: revenueAcc.id,
                    debit_amount: 0,
                    credit_amount: baseRevenue,
                    currency: "ETB",
                    exchange_rate_at_time: 1.0,
                    warehouse_id: si.warehouse_id || null,
                    party_type: "Customer",
                    party_id: si.customer_id || null,
                    party_name: si.customer_name || null,
                  })

                  // 4. Credit Output VAT Payable (if VAT charged)
                  if (vatAmount > 0 && vatAcc) {
                    newSaleLines.push({
                      id: `${saleJeId}-${lineIdx++}`,
                      journal_entry_id: saleJeId,
                      account_id: vatAcc.id,
                      debit_amount: 0,
                      credit_amount: vatAmount,
                      currency: "ETB",
                      exchange_rate_at_time: 1.0,
                      warehouse_id: si.warehouse_id || null,
                      party_type: "Customer",
                      party_id: si.customer_id || null,
                      party_name: si.customer_name || null,
                    })
                  }

                  this.lines.push(...newSaleLines)
                  hasNewSync = true
                }
              }

              // COGS entry
              const hasCogsEntry = this.entries.some((e) => e.id === cogsJeId)
              const hasCogsLines = this.lines.some((l) => l.journal_entry_id === cogsJeId)

              if (!hasCogsEntry || !hasCogsLines) {
                this.entries = this.entries.filter((e) => e.id !== cogsJeId)
                this.lines = this.lines.filter((l) => l.journal_entry_id !== cogsJeId)

                const debitAcc = acc("6000-04") || acc("6000") || this.accounts.find((a) => a.account_type === "Expense" && !a.is_group)  // Cost of Sales
                const creditAcc = acc("1410-01") || acc("1410-03") || acc("1410") || this.accounts.find((a) => a.account_type === "Asset" && !a.is_group) // Inventory Asset
                const estimatedCost = Math.round(subtotal * 0.7)

                if (debitAcc && creditAcc) {
                  this.entries.push({
                    id: cogsJeId,
                    entry_date: si.sale_date || new Date().toISOString().split("T")[0],
                    source_type: "Sales Invoice",
                    source_id: si.id,
                    created_by: "System Synced",
                    currency: "ETB",
                    exchange_rate: 1.0,
                    description: `COGS — Sales Issue ${si.fs_no || si.id}`,
                    is_reversal_of: null,
                  })
                  this.lines.push(
                    { id: `${cogsJeId}-1`, journal_entry_id: cogsJeId, account_id: debitAcc.id, debit_amount: estimatedCost, credit_amount: 0, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: si.warehouse_id || null },
                    { id: `${cogsJeId}-2`, journal_entry_id: cogsJeId, account_id: creditAcc.id, debit_amount: 0, credit_amount: estimatedCost, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: si.warehouse_id || null }
                  )
                  hasNewSync = true
                }
              }
            }

            // ── Invoices record sync ──
            const invId = `INV-SI-${si.id}`
            const isMatchingInvoice = (inv: Invoice) => {
              if (inv.id === invId || inv.sales_issue_id === si.id || inv.id === si.id) return true
              if (si.fs_no && (inv.fs_no === si.fs_no || inv.invoice_number === `INV-${si.fs_no}` || inv.invoice_number?.includes(si.fs_no))) return true
              if (si.reference_no && (inv.sales_order_id === si.reference_no || inv.id === `INV-SO-${si.reference_no}` || inv.invoice_number === si.reference_no || inv.invoice_number?.includes(si.reference_no))) return true
              if (inv.customer_name?.toLowerCase() === si.customer_name?.toLowerCase() && (Math.abs((inv.total || 0) - invoiceTotal) < 0.01 || Math.abs((inv.subtotal || 0) - subtotal) < 0.01) && invoiceTotal > 0) return true
              return false
            }

            const existingInvIdx = this.invoices.findIndex(isMatchingInvoice)

            const paymentsForThisIssue = this.payments.filter((p) => (p.sales_issue_id && p.sales_issue_id === si.id) || p.linked_invoice_id === invId || (si.fs_no && p.reference?.includes(si.fs_no)) || (si.reference_no && p.reference?.includes(si.reference_no)))
            const totalPaidFromPayments = paymentsForThisIssue.reduce((s, p) => s + Number(p.amount || 0), 0)
            const actualAmountPaid = isCash ? invoiceTotal : Math.max(Number(si.amount_paid || 0), totalPaidFromPayments)
            const actualBalanceDue = isCash ? 0 : Math.max(0, invoiceTotal - actualAmountPaid)
            const isFullyPaid = invoiceTotal > 0 && actualBalanceDue <= 0 && (isCash || actualAmountPaid > 0)
            const actualStatus: Invoice["status"] = isFullyPaid ? "Paid" : (actualAmountPaid > 0 ? "Partially Paid" : "Sent")
            const actualSettlement: Invoice["settlement_status"] = isFullyPaid ? "Fully Settled" : (actualAmountPaid > 0 ? "Ongoing" : "Unpaid")

            const mappedInvoice: Invoice = {
              id: invId,
              invoice_number: `INV-${si.fs_no || si.reference_no || si.id}`,
              customer_name: matchedCustName,
              issue_date: si.sale_date || new Date().toISOString().split("T")[0],
              due_date: si.sale_date || new Date().toISOString().split("T")[0],
              currency: "ETB",
              line_items: lineItems,
              subtotal: subtotal,
              tax_amount: vatAmount,
              tax_rate: taxRate,
              discount_amount: discountAmount,
              payment_terms: isCash ? "Cash" : "Credit (Net 30)",
              total: invoiceTotal,
              amount_paid: actualAmountPaid,
              balance_due: actualBalanceDue,
              status: actualStatus,
              settlement_status: actualSettlement,
              sales_issue_id: si.id,
              sales_order_id: si.reference_no || undefined,
              fs_no: si.fs_no,
            }

            if (existingInvIdx >= 0) {
              const current = this.invoices[existingInvIdx]
              const merged: Invoice = {
                ...current,
                ...mappedInvoice,
                id: current.id || invId,
                invoice_number: current.invoice_number || mappedInvoice.invoice_number,
                subtotal: mappedInvoice.subtotal,
                tax_amount: mappedInvoice.tax_amount,
                tax_rate: mappedInvoice.tax_rate,
                discount_amount: mappedInvoice.discount_amount,
                total: mappedInvoice.total,
                amount_paid: actualAmountPaid,
                balance_due: actualBalanceDue,
                status: actualStatus,
                settlement_status: actualSettlement,
                payment_terms: mappedInvoice.payment_terms,
                sales_issue_id: si.id,
                fs_no: si.fs_no,
              }
              // Update in place and remove any remaining stale duplicates for this issue
              this.invoices = this.invoices.filter((inv, idx) => idx === existingInvIdx || !isMatchingInvoice(inv))
              const updatedIdx = this.invoices.findIndex((inv) => inv.id === merged.id)
              if (updatedIdx >= 0) {
                this.invoices[updatedIdx] = merged
              } else {
                this.invoices.push(merged)
              }
            } else {
              this.invoices.push(mappedInvoice)
            }
          })

          // B. Sync Purchase Orders → Inventory & AP GL Entries
          purchaseOrders.forEach((po: any, idx: number) => {
            const jeId = `JE-PO-${po.id || idx + 1}`
            const poAmt = Number(po.amount || po.total_amount || 0)
            if (poAmt <= 0) return  // Skip zero or undefined amounts — never fabricate

            const hasPoEntry = this.entries.some((e) => e.id === jeId || e.source_id === po.id)
            const hasPoLines = this.lines.some((l) => l.journal_entry_id === jeId)

            if (!hasPoEntry || !hasPoLines) {
              this.entries = this.entries.filter((e) => e.id !== jeId && e.source_id !== po.id)
              this.lines = this.lines.filter((l) => l.journal_entry_id !== jeId)

              const stockAcc = acc("1410-01") || acc("1410-03") || acc("1100-03") || this.accounts.find((a) => a.account_type === "Asset" && !a.is_group) // Inventory Asset / Advance
              const apAcc = acc("2100-06") || acc("1000-02-26") || this.accounts.find((a) => a.account_type === "Liability" && !a.is_group) // Other Accruals / AP

              if (!stockAcc || !apAcc) {
                console.warn(`[FinanceSync] Missing accounts for PO ${po.id} — skipping.`)
              } else {
                this.entries.push({
                  id: jeId,
                  entry_date: po.date || new Date().toISOString().split("T")[0],
                  source_type: "Purchase Invoice",
                  source_id: po.id,
                  created_by: "System Synced",
                  currency: "ETB",
                  exchange_rate: 1.0,
                  description: `Purchase Order ${po.id} — ${po.supplier || "Supplier"}`,
                  is_reversal_of: null,
                })
                this.lines.push(
                  { id: `${jeId}-1`, journal_entry_id: jeId, account_id: stockAcc.id, debit_amount: poAmt, credit_amount: 0, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: null },
                  { id: `${jeId}-2`, journal_entry_id: jeId, account_id: apAcc.id, debit_amount: 0, credit_amount: poAmt, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: null, party_type: "Supplier", party_id: po.supplierId || null, party_name: po.supplier || null }
                )
                hasNewSync = true
              }
            }
          })

          // C. Sync Expenses → Expense & Cash GL Entries
          this.expenses.forEach((ec: any, idx: number) => {
            const expId = ec.id || `EXP-${idx + 1}`
            const jeId = `JE-EXP-${expId}`
            const expAmt = Number(ec.amount || 0)
            if (expAmt <= 0 || ec.status === "REJECTED") return  // Skip zero or rejected expenses

            const hasExpEntry = this.entries.some((e) => e.id === jeId || e.source_id === expId)
            const hasExpLines = this.lines.some((l) => l.journal_entry_id === jeId)

            if (!hasExpEntry || !hasExpLines) {
              this.entries = this.entries.filter((e) => e.id !== jeId && e.source_id !== expId)
              this.lines = this.lines.filter((l) => l.journal_entry_id !== jeId)

              const expAcc = acc("8000-30") || acc("8000-01") || this.accounts.find((a) => a.account_type === "Expense" && !a.is_group) // Miscellaneous / Expenses
              const cashAcc = acc("1000-01-01") || acc("1000-02-26") || acc("1000") || this.accounts.find((a) => a.account_type === "Asset" && !a.is_group) // Cash/Bank

              if (!expAcc || !cashAcc) {
                console.warn(`[FinanceSync] Missing accounts for Expense ${expId} — skipping.`)
              } else {
                this.entries.push({
                  id: jeId,
                  entry_date: ec.date || new Date().toISOString().split("T")[0],
                  source_type: "Payment Voucher",
                  source_id: expId,
                  created_by: ec.employee || ec.employee_name || "System Synced",
                  currency: "ETB",
                  exchange_rate: 1.0,
                  description: `Expense ${expId} — ${ec.merchant || ec.category || "Vendor"} (${ec.employee || "Employee"})`,
                  is_reversal_of: null,
                })
                this.lines.push(
                  { id: `${jeId}-1`, journal_entry_id: jeId, account_id: expAcc.id, debit_amount: expAmt, credit_amount: 0, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: null },
                  { id: `${jeId}-2`, journal_entry_id: jeId, account_id: cashAcc.id, debit_amount: 0, credit_amount: expAmt, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: null, party_type: null, party_id: null, party_name: ec.merchant || null }
                )
                hasNewSync = true
              }
            }
          })

          // D. Sync Payroll Records → Salary Expense & Cash GL Entries
          payrollRecords.forEach((pr: any, idx: number) => {
            const jeId = `JE-PAY-${pr.id || idx + 1}`
            const payAmt = Number(pr.net_salary || pr.net_pay || pr.amount || 0)
            if (payAmt <= 0) return  // Skip zero or undefined amounts — never fabricate

            const hasPayEntry = this.entries.some((e) => e.id === jeId || e.source_id === pr.id)
            const hasPayLines = this.lines.some((l) => l.journal_entry_id === jeId)

            if (!hasPayEntry || !hasPayLines) {
              this.entries = this.entries.filter((e) => e.id !== jeId && e.source_id !== pr.id)
              this.lines = this.lines.filter((l) => l.journal_entry_id !== jeId)

              const salaryAcc = acc("8000-01") || acc("6000-01") || this.accounts.find((a) => a.account_type === "Expense" && !a.is_group) // Salary & Wage
              const cashAcc = acc("1000-02-26") || acc("1000-01-01") || acc("1000") || this.accounts.find((a) => a.account_type === "Asset" && !a.is_group)   // Bank/Cash

              if (!salaryAcc || !cashAcc) {
                console.warn(`[FinanceSync] Missing accounts for Payroll Record ${pr.id} — skipping.`)
              } else {
                this.entries.push({
                  id: jeId,
                  entry_date: pr.payment_date || new Date().toISOString().split("T")[0],
                  source_type: "Payroll Payment",
                  source_id: pr.id,
                  created_by: "System Synced",
                  currency: "ETB",
                  exchange_rate: 1.0,
                  description: `Payroll — ${pr.employee_name || "Employee"}`,
                  is_reversal_of: null,
                })
                this.lines.push(
                  { id: `${jeId}-1`, journal_entry_id: jeId, account_id: salaryAcc.id, debit_amount: payAmt, credit_amount: 0, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: null },
                  { id: `${jeId}-2`, journal_entry_id: jeId, account_id: cashAcc.id, debit_amount: 0, credit_amount: payAmt, currency: "ETB", exchange_rate_at_time: 1.0, warehouse_id: null, party_type: "Employee", party_id: pr.employee_id || null, party_name: pr.employee_name || null }
                )
              }
            }
          });

          // E. Sync Processing Services → Invoices & Service Revenue
          (fetchedPS || []).forEach((ps: any) => {
            const agreedPrice = Number(ps.locked_total_fee || ps.agreed_price || 0)
            if (agreedPrice <= 0) return
            const isDelivered = (ps.status || "").toString().toLowerCase() === "delivered"
            const invId = `INV-PS-${ps.id}`
            const clientName = ps.client_company_name || ps.clientName || custMap.get(ps.customer_id) || "Client Company"
            const refNum = ps.reference_number || ps.id

            const existingInvIdx = this.invoices.findIndex((inv) => inv.id === invId || inv.invoice_number === invId || inv.sales_order_id === ps.id)
            const paymentsForThisPS = this.payments.filter((p) => p.linked_invoice_id === invId || (p.reference && p.reference.includes(refNum)))
            const totalPaidFromPayments = paymentsForThisPS.reduce((s, p) => s + Number(p.amount || 0), 0)
            const actualAmountPaid = totalPaidFromPayments
            const actualBalanceDue = Math.max(0, agreedPrice - actualAmountPaid)
            const isFullyPaid = agreedPrice > 0 && actualBalanceDue <= 0 && actualAmountPaid > 0
            const actualStatus: Invoice["status"] = isFullyPaid ? "Paid" : (actualAmountPaid > 0 ? "Partially Paid" : (isDelivered ? "Sent" : "Draft"))
            const actualSettlement: Invoice["settlement_status"] = isFullyPaid ? "Fully Settled" : (actualAmountPaid > 0 ? "Ongoing" : "Unpaid")

            const mappedPSInvoice: Invoice = {
              id: invId,
              invoice_number: invId,
              customer_name: clientName,
              issue_date: ps.delivered_at ? ps.delivered_at.split("T")[0] : (ps.entry_date || new Date().toISOString().split("T")[0]),
              due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              currency: ps.currency || "ETB",
              line_items: [
                {
                  description: `Toll processing & storage fee for ${ps.goods_description || "Agricultural Commodity"} (${ps.quantity || 1} ${ps.uom || "Quintal"})`,
                  quantity: Number(ps.quantity || 1),
                  unit_price: Number(agreedPrice) / Number(ps.quantity || 1),
                  line_total: Number(agreedPrice),
                }
              ],
              subtotal: Number(agreedPrice),
              tax_amount: 0,
              tax_rate: 0,
              discount_amount: 0,
              total: Number(agreedPrice),
              amount_paid: actualAmountPaid,
              balance_due: actualBalanceDue,
              status: actualStatus,
              settlement_status: actualSettlement,
              payment_terms: "Credit (Net 30)",
              sales_order_id: ps.id,
              fs_no: refNum,
            }

            if (existingInvIdx >= 0) {
              this.invoices[existingInvIdx] = {
                ...this.invoices[existingInvIdx],
                ...mappedPSInvoice,
                amount_paid: actualAmountPaid,
                balance_due: actualBalanceDue,
                status: actualStatus,
                settlement_status: actualSettlement,
              }
            } else {
              this.invoices.push(mappedPSInvoice)
            }
          })

          if (hasNewSync) {
            this.saveToApi().catch((err) => console.error("[FinanceSync] Failed to persist synced GL records:", err))
            this.notify()
          }
      } catch (syncErr) {
        console.error("[FinanceSync] Cross-module sync error (GL not modified):", syncErr)
      }
    }

  private saveToApi() {
    return persistResources([
      { resource: "chart_of_accounts", items: this.accounts },
      { resource: "journal_entries", items: this.entries },
      { resource: "journal_entry_lines", items: this.lines },
      { resource: "invoices", items: this.invoices },
      { resource: "payments", items: this.payments },
      { resource: "recurring_expense_schedules", items: this.recurringSchedules },
      { resource: "expenses", items: this.expenses },
      { resource: "vehicles", items: this.vehicles },
      { resource: "company_settings", items: [{ id: "default", ...this.companySettings }] },
      { resource: "tax_rules", items: this.taxRules },
    ])
  }

  public async reloadFromApi() {
    await this.loadFromApi()
  }

  public isLoading(): boolean {
    return this._isLoading
  }

  public getLoadError(): string | null {
    return this._loadError
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    void this.saveToApi().catch((error) => {
      console.error("Failed to persist finance data to Database.", error)
      void this.loadFromApi()
    })
    this.listeners.forEach((l) => l())
  }

  // --- Getters ---
  public getAccounts(): AccountItem[] {
    return [...this.accounts]
  }

  public getJournalEntries(): JournalEntry[] {
    return [...this.entries]
  }

  public getJournalEntryLines(): JournalEntryLine[] {
    return [...this.lines]
  }

  public getInvoices(): Invoice[] {
    const seen = new Set<string>()
    const unique: Invoice[] = []
    for (const inv of this.invoices) {
      const key = (inv.sales_issue_id || inv.invoice_number || inv.id).trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(inv)
      }
    }
    return unique
  }

  public getPayments(): Payment[] {
    return [...this.payments]
  }

  public getRecurringSchedules(): RecurringExpenseSchedule[] {
    return [...this.recurringSchedules]
  }

  public getOneOffExpenses(): OneOffExpense[] {
    return [...this.expenses]
  }

  public getVehicles(): Vehicle[] {
    return [...this.vehicles]
  }

  public getAccountingPeriods(): AccountingPeriod[] {
    return [...this.periods]
  }

  public getCompanySettings(): CompanySettings {
    return { ...this.companySettings }
  }

  public updateCompanySettings(partial: Partial<CompanySettings>) {
    this.companySettings = {
      ...this.companySettings,
      ...partial,
    }
    this.saveToApi()
    this.listeners.forEach((l) => l())
  }

  public getPayrollRuns(): PayrollRun[] {
    return [...this.payrollRuns]
  }

  public getRevaluations(): Revaluation[] {
    return [...this.revaluations]
  }

  // --- Company Settings Actions ---
  public updateExchangeRate(currency: string, rate: number) {
    this.companySettings = {
      ...this.companySettings,
      exchange_rates: {
        ...this.companySettings.exchange_rates,
        [currency]: rate,
      },
    }
    this.notify()
  }

  // --- Chart of Accounts Actions ---
  public getNextSuggestedAccountCode(parentCodeOrId?: string | null, accountType?: string): string {
    const parent = parentCodeOrId
      ? this.accounts.find((a) => a.id === parentCodeOrId || a.code === parentCodeOrId || `ACC-${a.code}` === parentCodeOrId)
      : null

    if (parent) {
      // Find all direct children
      const children = this.accounts.filter(
        (a) => a.parent_account_id === parent.id || a.parent_account_id === parent.code || a.parent_account_id === `ACC-${parent.code}`
      )

      if (children.length > 0) {
        // Check for hyphenated suffix pattern e.g. "6000-01", "6000-22", "8000-30"
        const suffixNumbers: number[] = []
        for (const child of children) {
          const parts = child.code.split("-")
          const lastPart = parts[parts.length - 1]
          const num = parseInt(lastPart, 10)
          if (!isNaN(num)) suffixNumbers.push(num)
        }

        if (suffixNumbers.length > 0) {
          const maxSuffix = Math.max(...suffixNumbers)
          const nextSuffix = String(maxSuffix + 1).padStart(2, "0")
          return `${parent.code}-${nextSuffix}`
        }
      }

      // Default first child suffix
      if (parent.code.includes("-")) {
        return `${parent.code}-01`
      }
      return `${parent.code}-01`
    }

    const type = accountType || "Asset"
    if (type === "COGS" || type === "Cost of Sales") {
      const existing = this.accounts.filter((a) => a.code.startsWith("6000-") || a.code.startsWith("6"))
      if (existing.length > 0) {
        const lastPartNums = existing.map((a) => parseInt(a.code.split("-").pop() || "0", 10)).filter((n) => !isNaN(n))
        const maxNum = lastPartNums.length > 0 ? Math.max(...lastPartNums) : 0
        return `6000-${String(maxNum + 1).padStart(2, "0")}`
      }
      return "6000-01"
    }

    if (type === "AdminExpense" || type === "Expenses") {
      const existing = this.accounts.filter((a) => a.code.startsWith("8000-") || a.code.startsWith("8"))
      if (existing.length > 0) {
        const lastPartNums = existing.map((a) => parseInt(a.code.split("-").pop() || "0", 10)).filter((n) => !isNaN(n))
        const maxNum = lastPartNums.length > 0 ? Math.max(...lastPartNums) : 0
        return `8000-${String(maxNum + 1).padStart(2, "0")}`
      }
      return "8000-01"
    }

    const typeRange: Record<string, { prefix: string; start: number }> = {
      Asset: { prefix: "1", start: 1900 },
      Liability: { prefix: "2", start: 2200 },
      Equity: { prefix: "3", start: 3300 },
      Revenue: { prefix: "4", start: 4300 },
      Expense: { prefix: "8", start: 8100 },
    }

    const range = typeRange[type] || { prefix: "1", start: 1900 }
    return String(range.start)
  }

  public getPostableAccounts(accountType?: AccountItem["account_type"]): AccountItem[] {
    return this.accounts.filter((a) => {
      if (a.is_active === false) return false
      if (a.is_group === true) return false
      if (accountType && a.account_type !== accountType) return false
      return true
    })
  }

  public addAccount(account: Omit<AccountItem, "id">): { success: boolean; error?: string; account?: AccountItem } {
    if (this.accounts.some((a) => a.code.toLowerCase() === account.code.toLowerCase())) {
      return { success: false, error: `Account code "${account.code}" already exists in Chart of Accounts.` }
    }

    let normalizedParentId: string | null = null
    if (account.parent_account_id) {
      const parentAcc = this.accounts.find(
        (a) => a.id === account.parent_account_id || a.code === account.parent_account_id || `ACC-${a.code}` === account.parent_account_id
      )
      if (parentAcc) {
        normalizedParentId = parentAcc.id
        if (!parentAcc.is_group) {
          this.accounts = this.accounts.map((a) => (a.id === parentAcc.id ? { ...a, is_group: true } : a))
        }
      } else {
        normalizedParentId = account.parent_account_id.startsWith("ACC-")
          ? account.parent_account_id
          : `ACC-${account.parent_account_id}`
      }
    }

    const newAcc: AccountItem = {
      ...account,
      id: `ACC-${account.code}`,
      parent_account_id: normalizedParentId,
    }
    this.accounts = [newAcc, ...this.accounts]
    persistResources([{ resource: "chart_of_accounts", items: this.accounts }])
    this.notify()
    return { success: true, account: newAcc }
  }

  public toggleAccountActive(id: string) {
    this.accounts = this.accounts.map((acc) =>
      acc.id === id || acc.code === id ? { ...acc, is_active: !acc.is_active } : acc
    )
    this.notify()
  }

  public toggleLockPeriod(periodId: string) {
    this.periods = this.periods.map((p) => (p.id === periodId ? { ...p, is_closed: !p.is_closed } : p))
    this.notify()
  }

  // --- Posting Journal Entry Rules ---
  public postJournalEntry(
    entryData: Omit<JournalEntry, "id" | "is_reversal_of"> & { is_reversal_of?: string | null },
    rawLines: Array<{
      account_id: string
      debit_amount: number
      credit_amount: number
      warehouse_id?: string | null
      party_type?: "Customer" | "Supplier" | "Employee" | null
      party_id?: string | null
      party_name?: string | null
    }>
  ): { success: boolean; error?: string; entry?: JournalEntry; autoRounded?: boolean; roundOffAmount?: number } {
    // 0. Locked Accounting Period Validation
    const entryDate = entryData.entry_date
    const closedPeriod = this.periods.find(
      (p) => p.is_closed && entryDate >= p.start_date && entryDate <= p.end_date
    )
    if (closedPeriod) {
      return {
        success: false,
        error: `Posting rejected: The transaction date (${entryDate}) falls inside a locked/closed accounting period (${closedPeriod.period_label}).`,
      }
    }

    // 1. Data-layer check: Reject if any selected account is inactive
    for (const line of rawLines) {
      const acc = this.accounts.find((a) => a.id === line.account_id || a.code === line.account_id)
      if (!acc) {
        return { success: false, error: `Account "${line.account_id}" does not exist in Chart of Accounts.` }
      }
      if (!acc.is_active) {
        return { success: false, error: `Posting rejected: Account "${acc.code} - ${acc.name}" is disabled.` }
      }

      // 2. HARD RULE ENFORCEMENT: Reject creating any line against Receivable, Payable, or Payroll Payable account without party reference
      const accCode = acc.code
      const accName = acc.name.toLowerCase()
      const isReceivable = accCode === "1200" || accName.includes("receivable")
      const isPayable = accCode === "2000" || accName.includes("payable")
      const isPayrollPayable = accCode === "2100" || accCode === "2210" || accName.includes("payroll")

      if ((isReceivable || isPayable || isPayrollPayable) && !line.party_id && !line.party_name) {
        return {
          success: false,
          error: `Posting rejected: Account "${acc.code} - ${acc.name}" requires a Party Reference (Customer, Supplier, or Employee).`,
        }
      }
    }

    // 3. Round amounts to 2 decimal places before comparing
    let totalDebit = rawLines.reduce((sum, l) => sum + Math.round(l.debit_amount * 100) / 100, 0)
    let totalCredit = rawLines.reduce((sum, l) => sum + Math.round(l.credit_amount * 100) / 100, 0)

    totalDebit = Math.round(totalDebit * 100) / 100
    totalCredit = Math.round(totalCredit * 100) / 100

    const diff = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100
    let autoRounded = false
    let roundOffAmount = 0

    const finalLines = [...rawLines]

    // 4. Round off vs Imbalance tolerance
    if (diff > 0.01) {
      return {
        success: false,
        error: `Imbalance detected: Total Debits (${totalDebit.toFixed(2)} ${entryData.currency}) do not equal Total Credits (${totalCredit.toFixed(2)} ${entryData.currency}). Imbalance of ${diff.toFixed(2)} ${entryData.currency}.`,
      }
    } else if (diff > 0 && diff <= 0.01) {
      // Auto-add balancing line to Round Off account (acc-5990 / code 5990)
      autoRounded = true
      roundOffAmount = diff
      const roundOffAcc = this.accounts.find((a) => a.code === "5990" || a.id === "acc-5990") || this.accounts[0]
      if (totalDebit < totalCredit) {
        finalLines.push({
          account_id: roundOffAcc.id,
          debit_amount: diff,
          credit_amount: 0,
          warehouse_id: null,
        })
      } else {
        finalLines.push({
          account_id: roundOffAcc.id,
          debit_amount: 0,
          credit_amount: diff,
          warehouse_id: null,
        })
      }
    }

    // Generate Entry ID safely by checking max numeric suffix and avoiding duplicates
    let maxJeNum = 0
    const currentYear = new Date().getFullYear()
    for (const ent of this.entries) {
      if (ent.id) {
        const match = ent.id.match(/\d+$/)
        if (match) {
          const val = parseInt(match[0], 10)
          if (!isNaN(val) && val > maxJeNum) {
            maxJeNum = val
          }
        }
      }
    }
    let nextJeNum = Math.max(maxJeNum + 1, this.entries.length + 1)
    let newEntryId = `JE-${currentYear}-${String(nextJeNum).padStart(3, "0")}`
    while (this.entries.some((e) => e.id === newEntryId)) {
      nextJeNum++
      newEntryId = `JE-${currentYear}-${String(nextJeNum).padStart(3, "0")}`
    }

    const newEntry: JournalEntry = {
      id: newEntryId,
      entry_date: entryData.entry_date,
      description: entryData.description,
      source_type: entryData.source_type,
      source_id: entryData.source_id ?? null,
      created_by: entryData.created_by,
      currency: entryData.currency,
      exchange_rate: entryData.exchange_rate,
      is_reversal_of: entryData.is_reversal_of ?? null,
    }

    const createdLines: JournalEntryLine[] = finalLines.map((fl, idx) => ({
      id: `JEL-${Date.now()}-${idx}`,
      journal_entry_id: newEntryId,
      account_id: fl.account_id,
      debit_amount: Math.round(fl.debit_amount * 100) / 100,
      credit_amount: Math.round(fl.credit_amount * 100) / 100,
      currency: entryData.currency,
      exchange_rate_at_time: entryData.exchange_rate,
      warehouse_id: fl.warehouse_id ?? null,
      party_type: fl.party_type ?? null,
      party_id: fl.party_id ?? null,
      party_name: fl.party_name ?? null,
    }))

    this.entries = [newEntry, ...this.entries]
    this.lines = [...createdLines, ...this.lines]

    this.notify()
    return { success: true, entry: newEntry, autoRounded, roundOffAmount }
  }

  public validateVoucher(lines: any[]) {
    return validateJournalVoucher(lines)
  }

  // --- Reversal Action ---
  public reverseJournalEntry(
    targetEntryId: string,
    targetLineId?: string
  ): { success: boolean; reversalEntry?: JournalEntry; error?: string } {
    const originalEntry = this.entries.find((e) => e.id === targetEntryId)
    if (!originalEntry) {
      return { success: false, error: "Original journal entry not found." }
    }

    const originalLines = this.lines.filter((l) => l.journal_entry_id === targetEntryId)
    if (originalLines.length === 0) {
      return { success: false, error: "Original journal entry lines not found." }
    }

    let linesToReverse = originalLines
    if (targetLineId) {
      linesToReverse = originalLines.filter((l) => l.id === targetLineId)
      if (linesToReverse.length === 0) {
        return { success: false, error: "Target line not found for partial reversal." }
      }
    }

    // Build swapped lines preserving party references
    const reversedRawLines = linesToReverse.map((l) => ({
      account_id: l.account_id,
      debit_amount: l.credit_amount, // SWAPPED
      credit_amount: l.debit_amount, // SWAPPED
      warehouse_id: l.warehouse_id,
      party_type: l.party_type,
      party_id: l.party_id,
      party_name: l.party_name,
    }))

    const desc = targetLineId
      ? `Partial Reversal of ${originalEntry.id} line ${targetLineId}`
      : `Reversal of Entry ${originalEntry.id}: ${originalEntry.description}`

    const result = this.postJournalEntry(
      {
        entry_date: new Date().toISOString().split("T")[0],
        description: desc,
        source_type: "Reversal",
        source_id: originalEntry.id,
        created_by: "System Auditor",
        currency: originalEntry.currency,
        exchange_rate: originalEntry.exchange_rate,
        is_reversal_of: originalEntry.id,
      },
      reversedRawLines
    )

    if (result.success && result.entry) {
      return { success: true, reversalEntry: result.entry }
    }
    return { success: false, error: result.error || "Failed to post reversal entry." }
  }

  // --- Delete Journal Entry Action ---
  public deleteJournalEntry(entryId: string): { success: boolean } {
    this.entries = this.entries.filter((e) => e.id !== entryId)
    this.lines = this.lines.filter((l) => l.journal_entry_id !== entryId)
    this.notify()
    return { success: true }
  }

  public deleteJournalEntriesBySource(sourceType: string, sourceId: string): { success: boolean } {
    const matchingEntries = this.entries.filter((e) => e.source_type === sourceType && e.source_id === sourceId)
    const matchingIds = new Set(matchingEntries.map((e) => e.id))
    this.entries = this.entries.filter((e) => !matchingIds.has(e.id))
    this.lines = this.lines.filter((l) => !matchingIds.has(l.journal_entry_id))
    this.notify()
    return { success: true }
  }

  // --- Invoice & Payment Actions ---
  public createInvoice(invoiceData: Omit<Invoice, "id" | "amount_paid" | "balance_due">): Invoice {
    const newId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const subtotal = invoiceData.line_items.reduce((s, item) => s + item.line_total, 0)
    const discount = invoiceData.discount_amount || 0
    const netSubtotal = Math.max(0, subtotal - discount)
    const tax = invoiceData.tax_amount || 0
    const total = netSubtotal + tax

    const newInv: Invoice = {
      id: newId,
      invoice_number: invoiceData.invoice_number,
      sales_order_id: invoiceData.sales_order_id,
      customer_name: invoiceData.customer_name,
      issue_date: invoiceData.issue_date,
      due_date: invoiceData.due_date,
      currency: invoiceData.currency,
      line_items: invoiceData.line_items,
      subtotal,
      tax_amount: tax,
      tax_rate: invoiceData.tax_rate !== undefined ? invoiceData.tax_rate : (netSubtotal > 0 && tax > 0 ? Math.round((tax / netSubtotal) * 100) : 0),
      discount_amount: discount,
      payment_terms: invoiceData.payment_terms || "Net 30",
      total,
      amount_paid: 0,
      balance_due: total,
      status: invoiceData.status || "Sent",
    }

    this.invoices = [newInv, ...this.invoices]

    // Post corresponding journal entry if not Draft
    if (newInv.status !== "Draft") {
      const arAcc = this.accounts.find((a) => a.code === "1200") || this.accounts[0]
      const salesAcc = this.accounts.find((a) => a.code === "4000") || this.accounts[0]
      const taxAcc = this.accounts.find((a) => a.code === "2210") || this.accounts[0]

      const arAccId = arAcc?.id || "acc-1200"
      const salesAccId = salesAcc?.id || "acc-4000"
      const taxAccId = taxAcc?.id || salesAccId

      const rawLines: Array<{ account_id: string; debit_amount: number; credit_amount: number; party_type?: any; party_id?: string; party_name?: string }> = [
        {
          account_id: arAccId,
          debit_amount: total,
          credit_amount: 0,
          party_type: "Customer",
          party_id: `CUST-${invoiceData.customer_name.replace(/\s+/g, "").toUpperCase()}`,
          party_name: invoiceData.customer_name,
        },
        {
          account_id: salesAccId,
          debit_amount: 0,
          credit_amount: netSubtotal,
        },
      ]

      if (tax > 0) {
        rawLines.push({
          account_id: taxAccId,
          debit_amount: 0,
          credit_amount: tax,
        })
      }

      this.postJournalEntry(
        {
          entry_date: invoiceData.issue_date,
          description: `Sales Invoice ${invoiceData.invoice_number} for ${invoiceData.customer_name}`,
          source_type: "Sales Invoice",
          source_id: invoiceData.invoice_number,
          created_by: "Billing System",
          currency: invoiceData.currency,
          exchange_rate: 1.0,
        },
        rawLines
      )
    }

    this.notify()
    return newInv
  }

  public updateInvoiceFromSalesOrder(so: { id: string; customer: string; items: Array<{ name: string; qty: number; unit: string; unitPrice: number; total: number }>; amount: number; invoiceIds?: string[] }) {
    const lineItems = (so.items || []).map((i) => ({
      description: `${i.name} (${i.qty} ${i.unit})`,
      quantity: i.qty,
      unit_price: i.unitPrice,
      line_total: i.total,
    }))

    const subtotal = so.amount

    this.invoices = this.invoices.map((inv) => {
      const isMatch = (inv.sales_order_id && inv.sales_order_id === so.id) ||
                      (so.invoiceIds && (so.invoiceIds.includes(inv.id) || so.invoiceIds.includes(inv.invoice_number))) ||
                      inv.invoice_number.includes(so.id) || inv.id.includes(so.id)

      if (isMatch) {
        const taxRate = (inv.tax_amount && inv.subtotal > 0) ? (inv.tax_amount / inv.subtotal) : 0.15
        const tax = Math.round(subtotal * taxRate * 100) / 100
        const total = subtotal + tax
        const newBal = Math.max(0, total - inv.amount_paid)

        // Update corresponding Journal Entry lines if found
        const je = this.entries.find((e) => e.source_id === inv.invoice_number || e.source_id === inv.id || e.source_id === so.id)
        if (je) {
          this.lines = this.lines.map((l) => {
            if (l.journal_entry_id !== je.id) return l
            if (l.debit_amount > 0) return { ...l, debit_amount: total, party_name: so.customer }
            if (l.credit_amount === inv.subtotal) return { ...l, credit_amount: subtotal }
            if (l.credit_amount === inv.tax_amount) return { ...l, credit_amount: tax }
            return { ...l, credit_amount: subtotal }
          })
        }

        return {
          ...inv,
          sales_order_id: so.id,
          customer_name: so.customer,
          line_items: lineItems,
          subtotal,
          tax_amount: tax,
          total,
          balance_due: newBal,
        }
      }
      return inv
    })

    this.notify()
  }

  public cancelInvoice(invoiceId: string) {
    const inv = this.invoices.find((i) => i.id === invoiceId || i.invoice_number === invoiceId)
    if (!inv) return

    this.invoices = this.invoices.map((i) => (i.id === inv.id ? { ...i, status: "Cancelled" as const, balance_due: 0 } : i))

    // Reverse any posted entry for this invoice — pass only the entry ID (no targetLineId)
    const relatedEntry = this.entries.find((e) => e.source_id === inv.invoice_number || e.source_id === inv.id)
    if (relatedEntry) {
      this.reverseJournalEntry(relatedEntry.id)
    }

    this.notify()
  }

  public updateInvoice(id: string, updates: Partial<Invoice>): Invoice | null {
    let updated: Invoice | null = null
    this.invoices = this.invoices.map((inv) => {
      if (inv.id === id || inv.invoice_number === id) {
        updated = { ...inv, ...updates }
        return updated
      }
      return inv
    })
    if (updated) {
      persistResources([{ resource: "invoices", items: this.invoices }])
      this.notify()
    }
    return updated
  }

  public deleteInvoice(id: string) {
    this.invoices = this.invoices.filter((i) => i.id !== id && i.invoice_number !== id)
    void deleteResource("invoices", id)
    this.notify()
  }

  public getPaymentsForInvoice(invoiceId: string, salesIssueId?: string, fsNo?: string): Payment[] {
    if (!invoiceId && !salesIssueId && !fsNo) return []
    return this.payments.filter((p) => {
      const matchInv = invoiceId && p.linked_invoice_id && (p.linked_invoice_id === invoiceId || p.linked_invoice_id === `INV-SI-${invoiceId}` || p.linked_invoice_id.includes(invoiceId))
      const matchSi = salesIssueId && (p.sales_issue_id === salesIssueId || p.linked_invoice_id === `INV-SI-${salesIssueId}` || p.reference?.includes(salesIssueId))
      const matchFs = fsNo && p.reference?.includes(fsNo)
      return Boolean(matchInv || matchSi || matchFs)
    })
  }

  public getPaymentsForSalesIssue(salesIssueId: string, fsNo?: string, referenceNo?: string): Payment[] {
    if (!salesIssueId && !fsNo && !referenceNo) return []
    const cleanId = (salesIssueId || "").trim()
    const cleanFs = (fsNo || "").trim()
    const cleanRef = (referenceNo || "").trim()

    return this.payments.filter((p) => {
      if (cleanId && (p.sales_issue_id === cleanId || p.linked_invoice_id === cleanId || p.linked_invoice_id === `INV-SI-${cleanId}` || p.linked_invoice_id === `INV-${cleanId}` || p.reference?.includes(cleanId))) {
        return true
      }
      if (cleanFs && (p.sales_issue_id === cleanFs || p.linked_invoice_id?.includes(cleanFs) || p.reference?.includes(cleanFs))) {
        return true
      }
      if (cleanRef && (p.sales_order_id === cleanRef || p.linked_invoice_id?.includes(cleanRef) || p.reference?.includes(cleanRef))) {
        return true
      }
      return false
    })
  }

  public getPaymentsForSalesOrder(salesOrderId: string): Payment[] {
    return this.payments.filter((p) => p.sales_order_id === salesOrderId || p.reference.includes(salesOrderId))
  }

  public recordPayment(paymentData: {
    linked_invoice_id: string | null
    sales_issue_id?: string | null
    sales_order_id?: string | null
    customer_id?: string | null
    customer_name?: string | null
    amount: number
    currency?: string
    date: string
    method?: string
    bank_account_code?: string
    reference: string
    payment_advice_url?: string
    payment_advice_filename?: string
    notes?: string
    direction?: "Received" | "Made"
  }): { payment: Payment; invoice?: Invoice } {
    const payId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const existingForInvoice = paymentData.linked_invoice_id
      ? this.payments.filter((p) => p.linked_invoice_id === paymentData.linked_invoice_id)
      : []
    const installmentNo = existingForInvoice.length + 1

    const newPayment: Payment = {
      id: payId,
      direction: paymentData.direction || "Received",
      linked_invoice_id: paymentData.linked_invoice_id,
      sales_issue_id: paymentData.sales_issue_id || null,
      sales_order_id: paymentData.sales_order_id || null,
      customer_id: paymentData.customer_id || null,
      customer_name: paymentData.customer_name || null,
      amount: paymentData.amount,
      currency: paymentData.currency || "ETB",
      date: paymentData.date,
      method: paymentData.method || "Bank Transfer",
      bank_account_code: paymentData.bank_account_code || "1000-02-26",
      reference: paymentData.reference,
      payment_advice_url: paymentData.payment_advice_url,
      payment_advice_filename: paymentData.payment_advice_filename,
      installment_no: installmentNo,
      notes: paymentData.notes,
    }

    this.payments = [newPayment, ...this.payments]

    let updatedInv: Invoice | undefined

    if (paymentData.linked_invoice_id || paymentData.sales_issue_id || paymentData.sales_order_id) {
      let custName = paymentData.customer_name || "Customer"
      this.invoices = this.invoices.map((inv) => {
        const matchesLinkedId = paymentData.linked_invoice_id && (inv.id === paymentData.linked_invoice_id || inv.invoice_number === paymentData.linked_invoice_id)
        const matchesSalesIssue = paymentData.sales_issue_id && (inv.sales_issue_id === paymentData.sales_issue_id || inv.id === `INV-SI-${paymentData.sales_issue_id}` || (inv.fs_no && paymentData.sales_issue_id.includes(inv.fs_no)))
        const matchesSalesOrder = paymentData.sales_order_id && (inv.sales_order_id === paymentData.sales_order_id || inv.invoice_number?.includes(paymentData.sales_order_id))

        if (matchesLinkedId || matchesSalesIssue || matchesSalesOrder) {
          custName = inv.customer_name
          const newPaid = Number((inv.amount_paid + paymentData.amount).toFixed(2))
          const newBal = Number(Math.max(0, inv.total - newPaid).toFixed(2))
          let newStatus: Invoice["status"] = inv.status
          let newSettlement: Invoice["settlement_status"] = "Ongoing"

          if (newBal <= 0) {
            newStatus = "Paid"
            newSettlement = "Fully Settled"
          } else if (newPaid > 0) {
            newStatus = "Partially Paid"
            newSettlement = "Ongoing"
          } else {
            newSettlement = "Unpaid"
          }

          updatedInv = {
            ...inv,
            amount_paid: newPaid,
            balance_due: newBal,
            status: newStatus,
            settlement_status: newSettlement,
          }
          return updatedInv
        }
        return inv
      })

      // Post corresponding Journal Entry with accurate Bank and Accounts Receivable accounts
      const bankCode = paymentData.bank_account_code || "1000-02-26"
      const bankAcc =
        this.accounts.find((a) => a.code === bankCode || a.id === bankCode) ||
        this.accounts.find((a) => a.code === "1000-02-26") ||
        this.accounts.find((a) => a.code === "1000") ||
        this.accounts[0]

      const arAcc =
        this.accounts.find((a) => a.code === "1300-03") ||
        this.accounts.find((a) => a.code === "1300") ||
        this.accounts.find((a) => a.code === "1200") ||
        this.accounts[0]

      const bankAccId = bankAcc?.id || "acc-1000"
      const arAccId = arAcc?.id || "acc-1300-03"

      this.postJournalEntry(
        {
          entry_date: paymentData.date,
          description: `Credit payment installment #${installmentNo} (${paymentData.reference}) for Invoice ${paymentData.linked_invoice_id} [Bank: ${bankAcc?.name || bankCode}]`,
          source_type: "Payment",
          source_id: payId,
          created_by: "Cashier",
          currency: paymentData.currency || "ETB",
          exchange_rate: 1.0,
        },
        [
          { account_id: bankAccId, debit_amount: paymentData.amount, credit_amount: 0 },
          {
            account_id: arAccId,
            debit_amount: 0,
            credit_amount: paymentData.amount,
            party_type: "Customer",
            party_id: `CUST-${custName.replace(/\s+/g, "").toUpperCase()}`,
            party_name: custName,
          },
        ]
      )
    }

    persistResources([
      { resource: "payments", items: this.payments },
      { resource: "invoices", items: this.invoices },
    ])
    this.notify()
    return { payment: newPayment, invoice: updatedInv }
  }

  // --- Expenses Actions ---
  public addOneOffExpense(exp: Omit<OneOffExpense, "id">): OneOffExpense {
    const newExp: OneOffExpense = {
      ...exp,
      id: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
    }
    this.expenses = [newExp, ...this.expenses]
    this.notify()
    return newExp
  }

  public approveOneOffExpense(id: string) {
    this.expenses = this.expenses.map((e) => {
      if (e.id === id) {
        const approved = { ...e, status: "APPROVED" as const }
        
        let targetAcc = e.gl_account_id ? this.accounts.find(a => a.id === e.gl_account_id || a.code === e.gl_account_id) : null
        if (!targetAcc) {
          if (e.category === "Office Rent" || e.category === "Rent") {
            targetAcc = this.accounts.find((a) => a.code === "5100") || this.accounts[0]
          } else if (e.category === "Vehicle Cost" || e.category === "Fleet") {
            targetAcc = this.accounts.find((a) => a.code === "5400") || this.accounts[0]
          } else if (e.category === "Software & SaaS" || e.category === "Infrastructure" || e.category === "Utilities") {
            targetAcc = this.accounts.find((a) => a.code === "5200") || this.accounts[0]
          } else {
            targetAcc = this.accounts.find((a) => a.code === "5300") || this.accounts.find((a) => a.code === "5200") || this.accounts[0]
          }
        }

        const cashAcc = this.accounts.find((a) => a.code === "1000") || this.accounts[0]
        const taxAcc = this.accounts.find((a) => a.code === "2210") || this.accounts[0]
        
        const taxVal = e.tax_amount || 0
        const netExp = Math.max(0, e.amount - taxVal)

        const rawLines: Array<{ account_id: string; debit_amount: number; credit_amount: number; party_type?: any; party_id?: string; party_name?: string }> = [
          { account_id: targetAcc.id, debit_amount: netExp, credit_amount: 0 },
        ]

        if (taxVal > 0) {
          rawLines.push({ account_id: taxAcc.id, debit_amount: taxVal, credit_amount: 0 })
        }

        rawLines.push({ account_id: cashAcc.id, debit_amount: 0, credit_amount: e.amount })

        this.postJournalEntry(
          {
            entry_date: e.date,
            description: `Expense claim approval: ${e.merchant} (${e.category}${e.cost_center ? " - " + e.cost_center : ""})`,
            source_type: "Purchase Invoice",
            source_id: e.id,
            created_by: "Finance Auditor",
            currency: e.currency,
            exchange_rate: 1.0,
          },
          rawLines
        )
        return approved
      }
      return e
    })
    this.notify()
  }

  public rejectOneOffExpense(id: string) {
    this.expenses = this.expenses.map((e) => (e.id === id ? { ...e, status: "REJECTED" as const } : e))
    this.notify()
  }

  public addRecurringSchedule(sch: Omit<RecurringExpenseSchedule, "id">): RecurringExpenseSchedule {
    const newSch: RecurringExpenseSchedule = {
      ...sch,
      id: `SCH-${new Date().getFullYear()}-${String(this.recurringSchedules.length + 1).padStart(3, "0")}`,
    }
    this.recurringSchedules = [newSch, ...this.recurringSchedules]
    this.notify()
    return newSch
  }

  public toggleRecurringScheduleStatus(id: string) {
    this.recurringSchedules = this.recurringSchedules.map((s) =>
      s.id === id ? { ...s, status: s.status === "Active" ? "Paused" : "Active" } : s
    )
    this.notify()
  }

  public generateDueExpenses(): number {
    let count = 0
    this.recurringSchedules.forEach((sch) => {
      if (sch.status === "Active" && sch.auto_generate) {
        this.addOneOffExpense({
          merchant: `${sch.expense_type} (${sch.linked_resource_id || "Overhead"})`,
          category: sch.expense_type,
          date: sch.next_due_date,
          employee: "System Scheduler",
          amount: sch.amount,
          currency: sch.currency,
          cost_center: sch.cost_center || "CC-100 Corporate HQ",
          status: "PENDING",
        })
        count++
      }
    })
    this.notify()
    return count
  }

  // --- Payroll Actions ---
  public postPayrollAccrual(runId: string): { success: boolean; error?: string; entryId?: string } {
    const run = this.payrollRuns.find((r) => r.id === runId)
    if (!run) return { success: false, error: "Payroll run not found." }
    if (run.status !== "Draft") return { success: false, error: `Payroll run is already ${run.status}.` }

    const expenseAcc =
      this.accounts.find((a) => a.id === this.companySettings.payroll_expense_account_id || a.code === "5010") ||
      this.accounts.find((a) => a.code === "5000") ||
      this.accounts[0]

    const taxAcc =
      this.accounts.find((a) => a.id === this.companySettings.tax_payable_account_id || a.code === "2210") ||
      this.accounts.find((a) => a.code === "2200") ||
      this.accounts[0]

    const payableAcc =
      this.accounts.find((a) => a.id === this.companySettings.payroll_payable_account_id || a.code === "2100") ||
      this.accounts[0]

    // Construct raw lines
    // 1. Debit Salaries & Wages Expense for total gross
    const rawLines: Array<{
      account_id: string
      debit_amount: number
      credit_amount: number
      party_type?: "Customer" | "Supplier" | "Employee" | null
      party_id?: string | null
      party_name?: string | null
    }> = [
      {
        account_id: expenseAcc.id,
        debit_amount: run.total_gross,
        credit_amount: 0,
      },
    ]

    // 2. Credit Tax Payable for total deductions
    if (run.total_deductions > 0) {
      rawLines.push({
        account_id: taxAcc.id,
        debit_amount: 0,
        credit_amount: run.total_deductions,
        party_type: "Supplier",
        party_id: "TAX-AUTHORITY",
        party_name: "Revenue Customs Authority",
      })
    }

    // 3. Credit Accrued Payroll for EACH employee individually (party tracking rule)
    run.employees.forEach((emp) => {
      rawLines.push({
        account_id: payableAcc.id,
        debit_amount: 0,
        credit_amount: emp.net_pay,
        party_type: "Employee",
        party_id: emp.employee_id,
        party_name: emp.employee_name,
      })
    })

    const postRes = this.postJournalEntry(
      {
        entry_date: run.period_end,
        description: `Payroll Accrual for ${run.period_label} (Gross: ETB ${run.total_gross.toLocaleString()})`,
        source_type: "Payroll Accrual",
        source_id: run.id,
        created_by: "HR Payroll Admin",
        currency: "ETB",
        exchange_rate: 1.0,
      },
      rawLines
    )

    if (!postRes.success || !postRes.entry) {
      return { success: false, error: postRes.error || "Failed to post payroll accrual journal entry." }
    }

    // Update payroll run status
    this.payrollRuns = this.payrollRuns.map((r) =>
      r.id === runId
        ? {
            ...r,
            status: "Accrued",
            accrual_journal_entry_id: postRes.entry!.id,
          }
        : r
    )

    this.notify()
    return { success: true, entryId: postRes.entry.id }
  }

  public postPayrollPayment(runId: string): { success: boolean; error?: string; entryId?: string } {
    const run = this.payrollRuns.find((r) => r.id === runId)
    if (!run) return { success: false, error: "Payroll run not found." }
    if (run.status !== "Accrued") return { success: false, error: "Payroll run must be in 'Accrued' status before payment disbursement." }

    const payableAcc =
      this.accounts.find((a) => a.id === this.companySettings.payroll_payable_account_id || a.code === "2100") ||
      this.accounts[0]

    const cashAcc = this.accounts.find((a) => a.code === "1000") || this.accounts[0]

    // Construct raw lines:
    // Debit lines per employee against Accrued Payroll (2100)
    const rawLines: Array<{
      account_id: string
      debit_amount: number
      credit_amount: number
      party_type?: "Customer" | "Supplier" | "Employee" | null
      party_id?: string | null
      party_name?: string | null
    }> = []

    run.employees.forEach((emp) => {
      rawLines.push({
        account_id: payableAcc.id,
        debit_amount: emp.net_pay,
        credit_amount: 0,
        party_type: "Employee",
        party_id: emp.employee_id,
        party_name: emp.employee_name,
      })
    })

    // Credit Cash & Bank for total net pay
    rawLines.push({
      account_id: cashAcc.id,
      debit_amount: 0,
      credit_amount: run.total_net,
    })

    const postRes = this.postJournalEntry(
      {
        entry_date: new Date().toISOString().split("T")[0],
        description: `Payroll Payment Disbursement for ${run.period_label} (Net: ETB ${run.total_net.toLocaleString()})`,
        source_type: "Payroll Payment",
        source_id: run.id,
        created_by: "Finance Disburser",
        currency: "ETB",
        exchange_rate: 1.0,
      },
      rawLines
    )

    if (!postRes.success || !postRes.entry) {
      return { success: false, error: postRes.error || "Failed to post payroll payment journal entry." }
    }

    // Update payroll run status
    this.payrollRuns = this.payrollRuns.map((r) =>
      r.id === runId
        ? {
            ...r,
            status: "Paid",
            payment_journal_entry_id: postRes.entry!.id,
          }
        : r
    )

    this.notify()
    return { success: true, entryId: postRes.entry.id }
  }

  // --- Multi-Currency Revaluation Actions ---
  public createRevaluation(data: {
    currency: string
    target_account_id: string
    original_balance: number
    current_rate: number
    revaluation_date: string
  }): { success: boolean; error?: string; revaluation?: Revaluation } {
    // Check if unrealized exchange gain/loss account exists and is active
    const gainLossAccId = this.companySettings.unrealized_exchange_gain_loss_account_id
    const gainLossAcc = this.accounts.find((a) => a.id === gainLossAccId || a.code === "5995")
    if (!gainLossAcc) {
      return {
        success: false,
        error: "Unrealized Exchange Gain/Loss account is not defined in Company Settings or Chart of Accounts.",
      }
    }
    if (!gainLossAcc.is_active) {
      return {
        success: false,
        error: `Account "${gainLossAcc.code} - ${gainLossAcc.name}" is disabled. Revaluation cannot be initiated.`,
      }
    }

    const newBalanceInBase = Math.round(data.original_balance * data.current_rate * 100) / 100
    const oldRate = this.companySettings.exchange_rates[data.currency]
    if (!oldRate) {
      return { success: false, error: `No persisted exchange rate is configured for ${data.currency}.` }
    }
    const oldBalanceInBase = Math.round(data.original_balance * oldRate * 100) / 100
    const unrealizedGainLoss = Math.round((newBalanceInBase - oldBalanceInBase) * 100) / 100

    let maxRevNum = 0
    const currentYear = new Date().getFullYear()
    for (const r of this.revaluations) {
      if (r.id) {
        const match = r.id.match(/\d+$/)
        if (match) {
          const val = parseInt(match[0], 10)
          if (!isNaN(val) && val > maxRevNum) maxRevNum = val
        }
      }
    }
    let nextRevNum = Math.max(maxRevNum + 1, this.revaluations.length + 1)
    let revId = `REV-${currentYear}-${String(nextRevNum).padStart(3, "0")}`
    while (this.revaluations.some((r) => r.id === revId)) {
      nextRevNum++
      revId = `REV-${currentYear}-${String(nextRevNum).padStart(3, "0")}`
    }

    const newRev: Revaluation = {
      id: revId,
      revaluation_date: data.revaluation_date,
      currency: data.currency,
      target_account_id: data.target_account_id,
      original_balance: data.original_balance,
      current_rate: data.current_rate,
      new_balance_in_base: newBalanceInBase,
      unrealized_gain_loss: unrealizedGainLoss,
      journal_entry_id: null,
      status: "Draft", // Always starts as Draft!
    }

    this.revaluations = [newRev, ...this.revaluations]
    this.notify()

    return { success: true, revaluation: newRev }
  }

  public postRevaluation(revaluationId: string): { success: boolean; error?: string; entryId?: string } {
    const rev = this.revaluations.find((r) => r.id === revaluationId)
    if (!rev) return { success: false, error: "Revaluation record not found." }
    if (rev.status !== "Draft") return { success: false, error: `Revaluation is already ${rev.status}.` }

    // Check gain/loss account
    const gainLossAccId = this.companySettings.unrealized_exchange_gain_loss_account_id
    const gainLossAcc = this.accounts.find((a) => a.id === gainLossAccId || a.code === "5995")
    if (!gainLossAcc || !gainLossAcc.is_active) {
      return {
        success: false,
        error: "Unrealized Exchange Gain/Loss account is missing or disabled in Chart of Accounts.",
      }
    }

    const targetAcc = this.accounts.find((a) => a.id === rev.target_account_id || a.code === rev.target_account_id)
    if (!targetAcc || !targetAcc.is_active) {
      return { success: false, error: "Target asset/liability account is missing or disabled." }
    }

    const absAmount = Math.abs(rev.unrealized_gain_loss)
    if (absAmount === 0) {
      return { success: false, error: "Revaluation gain/loss amount is zero. Nothing to post." }
    }

    let rawLines: Array<{ account_id: string; debit_amount: number; credit_amount: number }> = []

    if (rev.unrealized_gain_loss > 0) {
      // Unrealized Gain: Debit Target Account, Credit Gain/Loss Account
      rawLines = [
        { account_id: targetAcc.id, debit_amount: absAmount, credit_amount: 0 },
        { account_id: gainLossAcc.id, debit_amount: 0, credit_amount: absAmount },
      ]
    } else {
      // Unrealized Loss: Credit Target Account, Debit Gain/Loss Account
      rawLines = [
        { account_id: gainLossAcc.id, debit_amount: absAmount, credit_amount: 0 },
        { account_id: targetAcc.id, debit_amount: 0, credit_amount: absAmount },
      ]
    }

    const postRes = this.postJournalEntry(
      {
        entry_date: rev.revaluation_date,
        description: `Multi-Currency Exchange Revaluation for ${rev.currency} (${rev.original_balance} @ ${rev.current_rate} ETB/${rev.currency})`,
        source_type: "Exchange Revaluation",
        source_id: rev.id,
        created_by: "Treasury Auditor",
        currency: "ETB",
        exchange_rate: 1.0,
      },
      rawLines
    )

    if (!postRes.success || !postRes.entry) {
      return { success: false, error: postRes.error || "Failed to post exchange revaluation entry." }
    }

    // Update revaluation status
    this.revaluations = this.revaluations.map((r) =>
      r.id === revaluationId
        ? {
            ...r,
            status: "Posted",
            journal_entry_id: postRes.entry!.id,
          }
        : r
    )

    // Also update exchange rate in company settings
    this.updateExchangeRate(rev.currency, rev.current_rate)

    this.notify()
    return { success: true, entryId: postRes.entry.id }
  }

  public cancelRevaluation(revaluationId: string) {
    this.revaluations = this.revaluations.map((r) => (r.id === revaluationId ? { ...r, status: "Cancelled" } : r))
    this.notify()
  }

  // --- Vehicle Actions ---
  public addVehicle(v: Omit<Vehicle, "id">): Vehicle {
    let maxVehNum = 0
    for (const veh of this.vehicles) {
      if (veh.id) {
        const match = veh.id.match(/\d+$/)
        if (match) {
          const val = parseInt(match[0], 10)
          if (!isNaN(val) && val > maxVehNum) maxVehNum = val
        }
      }
    }
    let nextVehNum = Math.max(maxVehNum + 1, this.vehicles.length + 1)
    let vehId = `VEH-${String(nextVehNum).padStart(3, "0")}`
    while (this.vehicles.some((veh) => veh.id === vehId)) {
      nextVehNum++
      vehId = `VEH-${String(nextVehNum).padStart(3, "0")}`
    }

    const newV: Vehicle = {
      ...v,
      id: vehId,
    }
    this.vehicles = [newV, ...this.vehicles]
    this.notify()
    return newV
  }

  public addVehicleMaintenance(vehicleId: string, maintenance: VehicleMaintenance) {
    const veh = this.vehicles.find((v) => v.id === vehicleId)
    this.vehicles = this.vehicles.map((v) => {
      if (v.id === vehicleId) {
        return {
          ...v,
          maintenance_cost_history: [maintenance, ...v.maintenance_cost_history],
        }
      }
      return v
    })

    // Post GL entry for vehicle repair & fleet expense
    const fleetAcc = this.accounts.find((a) => a.code === "5400") || this.accounts[0]
    const cashAcc = this.accounts.find((a) => a.code === "1000") || this.accounts[0]

    this.postJournalEntry(
      {
        entry_date: maintenance.date,
        description: `Fleet Vehicle Repair: ${veh?.registration_number || vehicleId} - ${maintenance.description}`,
        source_type: "Manual Adjustment",
        source_id: vehicleId,
        created_by: "Fleet Auditor",
        currency: "ETB",
        exchange_rate: 1.0,
      },
      [
        { account_id: fleetAcc.id, debit_amount: maintenance.amount, credit_amount: 0 },
        { account_id: cashAcc.id, debit_amount: 0, credit_amount: maintenance.amount },
      ]
    )

    this.notify()
  }

  // --- Trial Balance Calculation ---
  public getTrialBalance(): {
    rows: Array<{
      account_id: string
      code: string
      name: string
      account_type: string
      debit_sum: number
      credit_sum: number
      net_balance: number
    }>
    totalDebits: number
    totalCredits: number
    isBalanced: boolean
  } {
    const accountMap = new Map<
      string,
      { code: string; name: string; account_type: string; debit_sum: number; credit_sum: number }
    >()

    // Initialize map with active accounts
    this.accounts.forEach((acc) => {
      accountMap.set(acc.id, {
        code: acc.code,
        name: acc.name,
        account_type: acc.account_type,
        debit_sum: 0,
        credit_sum: 0,
      })
    })

    // Sum lines
    this.lines.forEach((line) => {
      let acc = accountMap.get(line.account_id)
      if (!acc) {
        const matched = this.accounts.find((a) => a.code === line.account_id || a.id === line.account_id)
        if (matched) {
          acc = accountMap.get(matched.id)
        }
      }
      if (acc) {
        acc.debit_sum += line.debit_amount
        acc.credit_sum += line.credit_amount
      }
    })

    const rows = Array.from(accountMap.entries()).map(([id, val]) => ({
      account_id: id,
      code: val.code,
      name: val.name,
      account_type: val.account_type,
      debit_sum: Math.round(val.debit_sum * 100) / 100,
      credit_sum: Math.round(val.credit_sum * 100) / 100,
      net_balance: Math.round((val.debit_sum - val.credit_sum) * 100) / 100,
    }))

    const totalDebits = Math.round(rows.reduce((sum, r) => sum + r.debit_sum, 0) * 100) / 100
    const totalCredits = Math.round(rows.reduce((sum, r) => sum + r.credit_sum, 0) * 100) / 100
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

    return { rows, totalDebits, totalCredits, isBalanced }
  }

  // --- Account Updates ---
  public updateAccount(id: string, updated: Partial<AccountItem>): { success: boolean; error?: string } {
    const accIndex = this.accounts.findIndex((a) => a.id === id || a.code === id)
    if (accIndex === -1) return { success: false, error: "Account not found." }

    // If changing code, verify uniqueness
    if (updated.code && updated.code.toLowerCase() !== this.accounts[accIndex].code.toLowerCase()) {
      if (this.accounts.some((a) => a.code.toLowerCase() === updated.code?.toLowerCase() && a.id !== id && a.code !== id)) {
        return { success: false, error: `Account code "${updated.code}" already exists.` }
      }
    }

    let normalizedParentId = updated.parent_account_id
    if (updated.parent_account_id !== undefined) {
      if (updated.parent_account_id) {
        const parentAcc = this.accounts.find(
          (a) => a.id === updated.parent_account_id || a.code === updated.parent_account_id || `ACC-${a.code}` === updated.parent_account_id
        )
        if (parentAcc) {
          normalizedParentId = parentAcc.id
          if (!parentAcc.is_group) {
            this.accounts = this.accounts.map((a) => (a.id === parentAcc.id ? { ...a, is_group: true } : a))
          }
        } else {
          normalizedParentId = updated.parent_account_id.startsWith("ACC-")
            ? updated.parent_account_id
            : `ACC-${updated.parent_account_id}`
        }
      } else {
        normalizedParentId = null
      }
    }

    this.accounts = this.accounts.map((a) =>
      a.id === id || a.code === id
        ? {
            ...a,
            ...updated,
            ...(normalizedParentId !== undefined ? { parent_account_id: normalizedParentId } : {}),
            ...(updated.code ? { id: `ACC-${updated.code}` } : {}),
          }
        : a
    )
    this.notify()
    return { success: true }
  }

  public deleteAccount(id: string): { success: boolean; error?: string } {
    // Prevent deletion if account is referenced in journal entry lines
    const isReferenced = this.lines.some((l) => l.account_id === id || l.account_id === `ACC-${id}`)
    if (isReferenced) {
      return { success: false, error: "Cannot delete account: it has transactions posted against it." }
    }
    // Prevent deletion if it has children
    const hasChildren = this.accounts.some((a) => a.parent_account_id === id || a.parent_account_id === this.accounts.find(x => x.id === id)?.code)
    if (hasChildren) {
      return { success: false, error: "Cannot delete account: it has sub-accounts." }
    }
    this.accounts = this.accounts.filter((a) => a.id !== id && a.code !== id)
    void deleteResource("chart_of_accounts", id)
    this.notify()
    return { success: true }
  }

  // --- Fixed Assets Actions ---
  public getFixedAssets(): FixedAsset[] {
    return [...this.fixedAssets]
  }

  public addFixedAsset(asset: Omit<FixedAsset, "id" | "depreciation_schedule" | "accumulatedDepreciation" | "status">): FixedAsset {
    const newId = `AST-${String(this.fixedAssets.length + 1).padStart(3, "0")}`
    const newAsset: FixedAsset = {
      ...asset,
      id: newId,
      status: "Draft",
      accumulatedDepreciation: 0,
      depreciation_schedule: helperGenerateDeprSchedule(
        asset.cost,
        asset.salvageValue,
        asset.usefulLifeYears,
        asset.depreciationStartDate,
        0
      ),
    }
    this.fixedAssets = [newAsset, ...this.fixedAssets]
    this.notify()
    return newAsset
  }

  public updateFixedAsset(id: string, updated: Partial<FixedAsset>) {
    this.fixedAssets = this.fixedAssets.map((asset) => {
      if (asset.id === id) {
        const merged = { ...asset, ...updated }
        // If cost, salvage, useful life, or start date changes, regenerate schedule
        if (
          (updated.cost !== undefined ||
            updated.salvageValue !== undefined ||
            updated.usefulLifeYears !== undefined ||
            updated.depreciationStartDate !== undefined) &&
          asset.status !== "Disposed"
        ) {
          merged.depreciation_schedule = helperGenerateDeprSchedule(
            merged.cost,
            merged.salvageValue,
            merged.usefulLifeYears,
            merged.depreciationStartDate,
            merged.accumulatedDepreciation
          )
        }
        return merged
      }
      return asset
    })
    this.notify()
  }

  public deleteFixedAsset(id: string): { success: boolean; error?: string } {
    const asset = this.fixedAssets.find((a) => a.id === id)
    if (!asset) return { success: false, error: "Asset not found." }
    if (asset.status === "Active" && asset.accumulatedDepreciation > 0) {
      return { success: false, error: "Cannot delete asset: it has posted depreciation history." }
    }
    this.fixedAssets = this.fixedAssets.filter((a) => a.id !== id)
    void deleteResource("fixed_assets", id)
    this.notify()
    return { success: true }
  }

  public postDepreciationEntry(assetId: string, scheduleItemId: string): { success: boolean; error?: string } {
    const assetIndex = this.fixedAssets.findIndex((a) => a.id === assetId)
    if (assetIndex === -1) return { success: false, error: "Asset not found." }

    const asset = this.fixedAssets[assetIndex]
    const schedItem = asset.depreciation_schedule.find((s) => s.id === scheduleItemId)
    if (!schedItem) return { success: false, error: "Schedule line not found." }
    if (schedItem.status === "Posted") return { success: false, error: "Depreciation is already posted." }

    // Find accounts
    const depExpenseAcc = this.accounts.find((a) => a.code === asset.depreciation_expense_account_id || a.id === asset.depreciation_expense_account_id || a.code === "6500")
    const accumDepAcc = this.accounts.find((a) => a.code === asset.accumulated_depreciation_account_id || a.id === asset.accumulated_depreciation_account_id || a.code === "1510")

    if (!depExpenseAcc || !depExpenseAcc.is_active) {
      return { success: false, error: "Depreciation expense account is missing or disabled." }
    }
    if (!accumDepAcc || !accumDepAcc.is_active) {
      return { success: false, error: "Accumulated depreciation account is missing or disabled." }
    }

    // Post Journal Entry
    const postRes = this.postJournalEntry(
      {
        entry_date: schedItem.depreciation_date,
        description: `Depreciation Posting for Asset: ${asset.name} (${asset.id})`,
        source_type: "Manual Adjustment",
        source_id: asset.id,
        created_by: "Asset Manager",
        currency: "ETB",
        exchange_rate: 1.0,
      },
      [
        { account_id: depExpenseAcc.id, debit_amount: schedItem.depreciation_amount, credit_amount: 0 },
        { account_id: accumDepAcc.id, debit_amount: 0, credit_amount: schedItem.depreciation_amount },
      ]
    )

    if (!postRes.success || !postRes.entry) {
      return { success: false, error: postRes.error || "Failed to post journal entry." }
    }

    // Update asset
    const newAccum = Math.round((asset.accumulatedDepreciation + schedItem.depreciation_amount) * 100) / 100
    const fullyDepr = newAccum >= asset.cost - asset.salvageValue

    this.fixedAssets = this.fixedAssets.map((ast) => {
      if (ast.id === assetId) {
        const updatedSchedule = ast.depreciation_schedule.map((item) =>
          item.id === scheduleItemId
            ? { ...item, status: "Posted" as const, journal_entry_id: postRes.entry!.id }
            : item
        )
        return {
          ...ast,
          accumulatedDepreciation: newAccum,
          status: fullyDepr ? ("Fully Depreciated" as const) : ("Active" as const),
          depreciation_schedule: updatedSchedule,
        }
      }
      return ast
    })

    this.notify()
    return { success: true }
  }

  public disposeFixedAsset(assetId: string, salesAmount: number, cashAccountCode: string): { success: boolean; error?: string } {
    const asset = this.fixedAssets.find((a) => a.id === assetId)
    if (!asset) return { success: false, error: "Asset not found." }
    if (asset.status === "Disposed") return { success: false, error: "Asset is already disposed." }

    const assetAcc = this.accounts.find((a) => a.code === asset.asset_account_id || a.id === asset.asset_account_id)
    const accumAcc = this.accounts.find((a) => a.code === asset.accumulated_depreciation_account_id || a.id === asset.accumulated_depreciation_account_id)
    const cashAcc = this.accounts.find((a) => a.code === cashAccountCode || a.id === cashAccountCode)
    const lossAcc = this.accounts.find((a) => a.code === "6550" || a.id === "acc-6550") || this.accounts[0]

    if (!assetAcc || !accumAcc || !cashAcc) {
      return { success: false, error: "Required accounts (Asset, Accumulated Depr, or Cash/Bank) are missing." }
    }

    const netBookValue = Math.round((asset.cost - asset.accumulatedDepreciation) * 100) / 100
    const gainLoss = Math.round((salesAmount - netBookValue) * 100) / 100

    const rawLines: any[] = [
      { account_id: cashAcc.id, debit_amount: salesAmount, credit_amount: 0 },
      { account_id: accumAcc.id, debit_amount: asset.accumulatedDepreciation, credit_amount: 0 },
      { account_id: assetAcc.id, debit_amount: 0, credit_amount: asset.cost },
    ]

    if (gainLoss > 0) {
      // Credit Gain/Loss account (Revenue)
      rawLines.push({ account_id: lossAcc.id, debit_amount: 0, credit_amount: gainLoss })
    } else if (gainLoss < 0) {
      // Debit Gain/Loss account (Expense)
      rawLines.push({ account_id: lossAcc.id, debit_amount: Math.abs(gainLoss), credit_amount: 0 })
    }

    const postRes = this.postJournalEntry(
      {
        entry_date: new Date().toISOString().split("T")[0],
        description: `Disposal of Fixed Asset: ${asset.name} (${asset.id}). Sold for ETB ${salesAmount.toLocaleString()}`,
        source_type: "Manual Adjustment",
        source_id: asset.id,
        created_by: "Asset Manager",
        currency: "ETB",
        exchange_rate: 1.0,
      },
      rawLines
    )

    if (!postRes.success) {
      return { success: false, error: postRes.error }
    }

    this.fixedAssets = this.fixedAssets.map((ast) =>
      ast.id === assetId ? { ...ast, status: "Disposed" as const } : ast
    )
    this.notify()
    return { success: true }
  }

  // --- Tax Rules Actions ---
  public getTaxRules(): TaxRule[] {
    return [...this.taxRules]
  }

  public getDefaultVatRate(): number {
    const vatRule = this.taxRules.find((t) => t.type === "VAT/GST" && Number(t.ratePercent || 0) > 0) || this.taxRules.find((t) => t.type === "VAT/GST")
    return vatRule ? Number(vatRule.ratePercent) : 15
  }

  public addTaxRule(rule: Partial<TaxRule> & { name: string; ratePercent: number }): TaxRule {
    const newId = `TAX-${String(this.taxRules.length + 1).padStart(2, "0")}`
    const ratePercent = Number(rule.ratePercent || 0)
    const newRule: TaxRule = {
      id: newId,
      name: rule.name,
      ratePercent,
      type: rule.type || "VAT/GST",
      accountCode: rule.accountCode || "2000-05",
      isInclusive: Boolean(rule.isInclusive),
      isDeduction: Boolean(rule.isDeduction),
      appliesTo: rule.appliesTo || "BOTH",
      description: rule.description || "",
      is_active: rule.is_active !== false,
    }
    this.taxRules = [newRule, ...this.taxRules]
    persistResources([{ resource: "tax_rules", items: this.taxRules }])
    this.notify()
    return newRule
  }

  public updateTaxRule(id: string, updated: Partial<TaxRule>) {
    this.taxRules = this.taxRules.map((t) => {
      if (t.id !== id) return t
      const ratePercent = updated.ratePercent !== undefined ? Number(updated.ratePercent) : t.ratePercent
      return {
        ...t,
        ...updated,
        ratePercent,
        rate: ratePercent,
        accountCode: updated.accountCode !== undefined ? updated.accountCode : t.accountCode,
        gl_account_code: updated.accountCode !== undefined ? updated.accountCode : t.accountCode,
        isInclusive: updated.isInclusive !== undefined ? updated.isInclusive : t.isInclusive,
        is_inclusive: updated.isInclusive !== undefined ? updated.isInclusive : t.isInclusive,
      } as any
    })
    persistResources([{ resource: "tax_rules", items: this.taxRules }])
    this.notify()
  }

  public deleteTaxRule(id: string): { success: boolean; error?: string } {
    this.taxRules = this.taxRules.filter((t) => t.id !== id)
    void deleteResource("tax_rules", id)
    persistResources([{ resource: "tax_rules", items: this.taxRules }])
    this.notify()
    return { success: true }
  }

  // --- Tax Schedules (Multi-Tax Bundles) Actions ---
  public getTaxSchedules(): TaxSchedule[] {
    return [...this.taxSchedules]
  }

  public addTaxSchedule(schedule: Omit<TaxSchedule, "id">): TaxSchedule {
    const newId = `SCH-${String(this.taxSchedules.length + 1).padStart(2, "0")}`
    const newSchedule: TaxSchedule = { ...schedule, id: newId }
    this.taxSchedules = [newSchedule, ...this.taxSchedules]
    persistResources([{ resource: "tax_schedules", items: this.taxSchedules }])
    this.notify()
    return newSchedule
  }

  public updateTaxSchedule(id: string, updated: Partial<TaxSchedule>) {
    this.taxSchedules = this.taxSchedules.map((s) => (s.id === id ? { ...s, ...updated } : s))
    persistResources([{ resource: "tax_schedules", items: this.taxSchedules }])
    this.notify()
  }

  public deleteTaxSchedule(id: string): { success: boolean; error?: string } {
    this.taxSchedules = this.taxSchedules.filter((s) => s.id !== id)
    void deleteResource("tax_schedules", id)
    persistResources([{ resource: "tax_schedules", items: this.taxSchedules }])
    this.notify()
    return { success: true }
  }

  // --- Accounting Periods Actions ---
  public addAccountingPeriod(p: Omit<AccountingPeriod, "id">): AccountingPeriod {
    const newId = `PRD-${String(this.periods.length + 1).padStart(3, "0")}`
    const newPeriod = { ...p, id: newId }
    this.periods = [newPeriod, ...this.periods]
    this.notify()
    return newPeriod
  }

  public updateAccountingPeriod(id: string, updated: Partial<AccountingPeriod>) {
    this.periods = this.periods.map((p) => (p.id === id ? { ...p, ...updated } : p))
    this.notify()
  }

  public deleteAccountingPeriod(id: string) {
    this.periods = this.periods.filter((p) => p.id !== id)
    void deleteResource("accounting_periods", id)
    this.notify()
  }

  // --- Fiscal Year / Period Closing Voucher ---
  public closeAccountingPeriod(periodId: string, retainedEarningsAccCode: string): { success: boolean; error?: string } {
    const period = this.periods.find((p) => p.id === periodId)
    if (!period) return { success: false, error: "Accounting period not found." }
    if (period.is_closed) return { success: false, error: "Period is already closed." }

    // 1. Calculate trial balance
    const tb = this.getTrialBalance().rows
    // 2. Filter for Revenue (4xxx) and Expense (5xxx, 6xxx) accounts
    const plRows = tb.filter((r) => r.account_type === "Revenue" || r.account_type === "Expense")
    const closingLines: any[] = []
    let totalClosingDebit = 0
    let totalClosingCredit = 0

    plRows.forEach((r) => {
      if (r.net_balance > 0) {
        // Debit is higher (typically expense). Credit it to zero out.
        closingLines.push({
          account_id: r.account_id,
          debit_amount: 0,
          credit_amount: r.net_balance,
        })
        totalClosingCredit += r.net_balance
      } else if (r.net_balance < 0) {
        // Credit is higher (typically revenue). Debit it to zero out.
        const amt = Math.abs(r.net_balance)
        closingLines.push({
          account_id: r.account_id,
          debit_amount: amt,
          credit_amount: 0,
        })
        totalClosingDebit += amt
      }
    })

    if (closingLines.length === 0) {
      // No revenues/expenses to roll over. Just lock the period.
      this.periods = this.periods.map((p) => (p.id === periodId ? { ...p, is_closed: true } : p))
      this.notify()
      return { success: true }
    }

    const diff = totalClosingDebit - totalClosingCredit
    const retainedEarningsAcc =
      this.accounts.find((a) => a.code === retainedEarningsAccCode || a.id === retainedEarningsAccCode) ||
      this.accounts.find((a) => a.code === "3000") ||
      this.accounts[0]

    if (Math.abs(diff) > 0.001) {
      if (diff > 0) {
        // Net Profit (Revenue > Expense): Credit Retained Earnings
        closingLines.push({
          account_id: retainedEarningsAcc.id,
          debit_amount: 0,
          credit_amount: Math.round(diff * 100) / 100,
        })
      } else {
        // Net Loss (Expense > Revenue): Debit Retained Earnings
        closingLines.push({
          account_id: retainedEarningsAcc.id,
          debit_amount: Math.round(Math.abs(diff) * 100) / 100,
          credit_amount: 0,
        })
      }
    }

    // Post Journal Entry (We temporarily skip locked check for this entry by posting it before we lock)
    const postRes = this.postJournalEntry(
      {
        entry_date: period.end_date,
        description: `Period Closing Voucher for ${period.period_label} - Retained Earnings Rollover`,
        source_type: "Manual Adjustment",
        source_id: period.id,
        created_by: "System Year-End Process",
        currency: "ETB",
        exchange_rate: 1.0,
      },
      closingLines
    )

    if (!postRes.success) {
      return { success: false, error: postRes.error }
    }

    // Lock the period now
    this.periods = this.periods.map((p) => (p.id === periodId ? { ...p, is_closed: true } : p))
    this.notify()
    return { success: true }
  }

  // --- Expense, Schedule, and Vehicle CRUD ---
  public updateOneOffExpense(id: string, updated: Partial<OneOffExpense>) {
    this.expenses = this.expenses.map((e) => (e.id === id ? { ...e, ...updated } : e))
    this.notify()
  }

  public deleteOneOffExpense(id: string) {
    this.expenses = this.expenses.filter((e) => e.id !== id)
    void deleteResource("expenses", id)
    this.notify()
  }

  public updateRecurringSchedule(id: string, updated: Partial<RecurringExpenseSchedule>) {
    this.recurringSchedules = this.recurringSchedules.map((s) => (s.id === id ? { ...s, ...updated } : s))
    this.notify()
  }

  public deleteRecurringSchedule(id: string) {
    this.recurringSchedules = this.recurringSchedules.filter((s) => s.id !== id)
    void deleteResource("recurring_expense_schedules", id)
    this.notify()
  }

  public updateVehicle(id: string, updated: Partial<Vehicle>) {
    this.vehicles = this.vehicles.map((v) => (v.id === id ? { ...v, ...updated } : v))
    this.notify()
  }

  public deleteVehicle(id: string) {
    this.vehicles = this.vehicles.filter((v) => v.id !== id)
    void deleteResource("vehicles", id)
    this.notify()
  }

  public clearAllTestingData() {
    this.invoices = []
    this.entries = []
    this.lines = []
    this.payments = []
    this.recurringSchedules = []
    this.expenses = []
    this.notify()
  }
}

export const financeStore = new FinanceStore()

export function useFinanceStore() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const unsubscribe = financeStore.subscribe(() => {
      setTick((t) => t + 1)
    })
    const refresh = () => void financeStore.reloadFromApi()
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    return () => {
      unsubscribe()
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  // Return the store directly — pages call store.isLoading() / store.getLoadError()
  // for error-state awareness without requiring call-site changes.
  return financeStore
}
