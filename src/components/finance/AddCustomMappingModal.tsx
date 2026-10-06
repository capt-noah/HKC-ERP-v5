import React, { useState, useMemo } from "react"
import { X, Trash2, Building } from "lucide-react"
import { useFinanceStore, type AccountItem } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"
import { LoadingDots } from "@/components/ui/LoadingDots"
import COAAccountSelector from "@/components/finance/COAAccountSelector"

interface AddCustomMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (ruleId: string) => void
}

const CATEGORY_DEFINITIONS = [
  {
    id: "Sales & Revenue",
    name: "Sales & Revenue",
    events: [
      { key: "sales_cash_clearing", label: "Direct Cash", defaultSide: "Debit" as const, defaultCode: "1000-02-26" },
      { key: "sales_credit_ar", label: "Import Receivable", defaultSide: "Debit" as const, defaultCode: "1300-03" },
      { key: "sales_credit_ar_export", label: "Export Receivable", defaultSide: "Debit" as const, defaultCode: "1300-01" },
      { key: "sales_revenue_domestic", label: "Import Sales", defaultSide: "Credit" as const, defaultCode: "4000-01-01" },
      { key: "sales_revenue_export", label: "Export Sales", defaultSide: "Credit" as const, defaultCode: "4000-02-01" },
      { key: "sales_revenue_services", label: "Cleaning Service", defaultSide: "Credit" as const, defaultCode: "4000-03-02" },
    ],
  },
  {
    id: "Purchase",
    name: "Purchase",
    events: [
      // Attached Operational Expenses (8101..8401 series)
      { key: "purchase_freight_transport", label: "Freight and Transport", defaultSide: "Debit" as const, defaultCode: "8101-004" },
      { key: "purchase_transit_service", label: "Transit Service", defaultSide: "Debit" as const, defaultCode: "8101-005" },
      { key: "purchase_inspection_cert", label: "Inspection, Certificate and OT", defaultSide: "Debit" as const, defaultCode: "8101-008" },
      { key: "purchase_commission", label: "Commission", defaultSide: "Debit" as const, defaultCode: "8101-009" },
      { key: "purchase_plomb_labour", label: "Plomb, BL. Labour & Others", defaultSide: "Debit" as const, defaultCode: "8101-010" },
      { key: "purchase_salary_wage", label: "Salary and Wage", defaultSide: "Debit" as const, defaultCode: "8201-001" },
      { key: "purchase_transport_allowance", label: "Transport Allowance", defaultSide: "Debit" as const, defaultCode: "8201-002" },
      { key: "purchase_bonus", label: "Bonus", defaultSide: "Debit" as const, defaultCode: "8201-003" },
      { key: "purchase_overtime", label: "Over Time", defaultSide: "Debit" as const, defaultCode: "8201-004" },
      { key: "purchase_stationery_supplies", label: "Stationery, Printing & Off Sup", defaultSide: "Debit" as const, defaultCode: "8201-006" },
      { key: "purchase_office_rent", label: "Office Rent", defaultSide: "Debit" as const, defaultCode: "8201-009" },
      { key: "purchase_telephone_internet", label: "Telephone and Internet", defaultSide: "Debit" as const, defaultCode: "8201-010" },
      { key: "purchase_perdiem_travel", label: "Per-Diem and Traveling", defaultSide: "Debit" as const, defaultCode: "8201-011" },
      { key: "purchase_loading_unloading", label: "Loading / Unloading", defaultSide: "Debit" as const, defaultCode: "8201-012" },
      { key: "purchase_fuel_lubricants", label: "Fuel and Lubricants", defaultSide: "Debit" as const, defaultCode: "8201-013" },
      { key: "purchase_postage_photocopy", label: "Postage and Photocopy", defaultSide: "Debit" as const, defaultCode: "8201-014" },
      { key: "purchase_repair_maintenance", label: "Repair and Maintenance", defaultSide: "Debit" as const, defaultCode: "8201-015" },
      { key: "purchase_utility", label: "Utility", defaultSide: "Debit" as const, defaultCode: "8201-016" },
      { key: "purchase_registration_license", label: "Registration and License", defaultSide: "Debit" as const, defaultCode: "8201-017" },
      { key: "purchase_insurance", label: "Insurance", defaultSide: "Debit" as const, defaultCode: "8201-018" },
      { key: "purchase_depreciation", label: "Depreciation Expense", defaultSide: "Debit" as const, defaultCode: "8201-020" },
      { key: "purchase_membership_registration", label: "Membership & Registration Annu", defaultSide: "Debit" as const, defaultCode: "8201-024" },
      { key: "purchase_audit_professional", label: "Audit Fee & Professional Fee", defaultSide: "Debit" as const, defaultCode: "8201-025" },
      { key: "purchase_education_tuition", label: "Education and Tuition Fee", defaultSide: "Debit" as const, defaultCode: "8201-026" },
      { key: "purchase_donation", label: "Donation", defaultSide: "Debit" as const, defaultCode: "8201-050" },
      { key: "purchase_entertainment", label: "Entertainment", defaultSide: "Debit" as const, defaultCode: "8201-051" },
      { key: "purchase_miscellaneous", label: "Miscellaneous", defaultSide: "Debit" as const, defaultCode: "8201-100" },
      { key: "purchase_bank_service_charge", label: "Bank Service Charge", defaultSide: "Debit" as const, defaultCode: "8301-001" },
      { key: "purchase_stamp_duty", label: "Stamp Duty", defaultSide: "Debit" as const, defaultCode: "8301-002" },
      { key: "purchase_interest_expense", label: "Interest Expense", defaultSide: "Debit" as const, defaultCode: "8301-003" },
      { key: "purchase_penalty", label: "Penalty", defaultSide: "Debit" as const, defaultCode: "8401-001" },
    ],
  },
  {
    id: "Inventory & COGS",
    name: "Inventory & COGS",
    events: [
      { key: "inventory_stock_pharma", label: "Import Stock", defaultSide: "Debit" as const, defaultCode: "1400-01" },
      { key: "inventory_stock_in_hand", label: "Export Stock", defaultSide: "Debit" as const, defaultCode: "1410-01" },
      { key: "cogs_stock_fulfillment", label: "Cost of Veterinary", defaultSide: "Debit" as const, defaultCode: "5000-01" },
      { key: "cogs_sesame_fulfillment", label: "Cost of Sesame Seed", defaultSide: "Debit" as const, defaultCode: "5010-03" },
      { key: "cogs_export_fulfillment", label: "Cost of Green Mung", defaultSide: "Debit" as const, defaultCode: "5010-01" },
      { key: "cogs_soya_fulfillment", label: "Cost of Soya Bean", defaultSide: "Debit" as const, defaultCode: "5010-02" },
      { key: "cogs_white_sesame_fulfillment", label: "Cost of White Sesame Seed", defaultSide: "Debit" as const, defaultCode: "5010-04" },
      { key: "cogs_export_other_fulfillment", label: "Cost of Other Export Crops", defaultSide: "Debit" as const, defaultCode: "5010-05" },
    ],
  },
  {
    id: "Tax",
    name: "Tax",
    events: [
      { key: "tax_vat_zero", label: "Zero-Tax (0%)", defaultSide: "Credit" as const, defaultCode: "2000-05" },
      { key: "sales_vat_output", label: "Standard VAT (15%)", defaultSide: "Credit" as const, defaultCode: "2000-05" },
      { key: "expense_vat_input", label: "Input VAT (15%)", defaultSide: "Debit" as const, defaultCode: "1320-06-02" },
      { key: "sales_wht_withheld", label: "Withholding Tax Receivable (2%/30%)", defaultSide: "Debit" as const, defaultCode: "1320-06-01" },
      { key: "expense_wht_payable", label: "Withholding Tax Payable (2%/30%)", defaultSide: "Credit" as const, defaultCode: "2000-04" },
      { key: "tax_tot_payable", label: "Turnover Tax TOT (2%)", defaultSide: "Credit" as const, defaultCode: "2000-05" },
      { key: "tax_tot_10_payable", label: "Turnover Tax TOT (10%)", defaultSide: "Credit" as const, defaultCode: "2000-05" },
      { key: "tax_income_tax_payable", label: "Employment Income Tax (PAYE)", defaultSide: "Credit" as const, defaultCode: "2000-02" },
    ],
  },
  {
    id: "Payroll & HR",
    name: "Payroll & HR",
    events: [
      { key: "payroll_gross_salary_expense", label: "Gross Salaries & Wages Expense", defaultSide: "Debit" as const, defaultCode: "8000-01" },
      { key: "payroll_transport_allowance", label: "Staff Transport Allowance Expense", defaultSide: "Debit" as const, defaultCode: "8000-02" },
      { key: "payroll_employer_pension", label: "Employer Pension Contribution (11% Expense)", defaultSide: "Debit" as const, defaultCode: "8000-06" },
      { key: "payroll_pension_payable", label: "Total Pension Contribution (18% Payable)", defaultSide: "Credit" as const, defaultCode: "2000-03" },
      { key: "payroll_accrued_clearing", label: "Accrued Net Payroll Clearing", defaultSide: "Credit" as const, defaultCode: "2100-06" },
      { key: "custom_payroll_event", label: "Other Payroll / Compensation Event", defaultSide: "Debit" as const, defaultCode: "8000-01" },
    ],
  },
  {
    id: "Cash & Bank Accounts",
    name: "Cash & Bank Accounts",
    events: [
      { key: "customer_receipt_bank", label: "Customer Receipts Primary Bank Account", defaultSide: "Debit" as const, defaultCode: "1000-02-26" },
      { key: "bank_service_charge_expense", label: "Bank Service Charges & Fees", defaultSide: "Debit" as const, defaultCode: "8000-25" },
      { key: "bank_interest_income", label: "Bank Interest Income Earned", defaultSide: "Credit" as const, defaultCode: "4200" },
      { key: "custom_banking_event", label: "Other Operating Cash & Bank Event", defaultSide: "Debit" as const, defaultCode: "1000-02-26" },
    ],
  },
  {
    id: "Custom Rules",
    name: "Custom Rules",
    events: [
      { key: "custom_general_rule", label: "Custom Business Operational Rule", defaultSide: "Debit" as const, defaultCode: "1000-02-26" },
    ],
  },
]

export default function AddCustomMappingModal({ isOpen, onClose, onSuccess }: AddCustomMappingModalProps) {
  const store = useFinanceStore()
  const { showToast } = useFeedback()
  const accounts = store.getAccounts()

  const [category, setCategory] = useState("Sales & Revenue")
  const [selectedEventKey, setSelectedEventKey] = useState("sales_cash_clearing")
  const [customEventLabel, setCustomEventLabel] = useState("")
  const [warehouseScope, setWarehouseScope] = useState<"ALL" | "IMPORT" | "EXPORT">("ALL")
  const [itemType, setItemType] = useState<"ALL" | "GREEN_MUNG" | "SESAME" | "SOYA" | "VET_PHARMA">("ALL")
  const [normalPosting, setNormalPosting] = useState<"Debit" | "Credit">("Debit")
  const [primaryAccountCode, setPrimaryAccountCode] = useState("1000-02-26")

  // Multi-account pool state (for multiple bank/cash accounts)
  const [enableMultiAccounts, setEnableMultiAccounts] = useState(false)
  const [multiAccountsList, setMultiAccountsList] = useState<
    { account_id: string; account_code: string; account_name: string; is_default: boolean }[]
  >([])

  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const rawTaxRules = store.getTaxRules()

  // Current category definition with dynamic tax rules from DB
  const currentCategoryDef = useMemo(() => {
    const base = CATEGORY_DEFINITIONS.find((c) => c.id === category) || CATEGORY_DEFINITIONS[0]
    if (category === "Tax" || category === "Taxes & Statutory") {
      const dynamicTaxEvents = (rawTaxRules || [])
        .filter((tr) => tr && tr.is_active && !["TAX-001", "TAX-002", "TAX-003"].includes(tr.id || ""))
        .map((tr) => ({
          key: `tax_${String(tr.id || "").toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          label: `${tr.name || "Tax Rule"} (${tr.accountCode || ""})`,
          defaultSide: (tr.isDeduction && tr.appliesTo !== "PURCHASES" ? "Debit" : "Credit") as "Debit" | "Credit",
          defaultCode: tr.accountCode || "2000-05",
        }))

      return {
        ...base,
        events: [
          ...base.events,
          ...dynamicTaxEvents,
        ],
      }
    }
    return base
  }, [category, rawTaxRules])

  // Handle Category Change
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat)
    let eventsList = (CATEGORY_DEFINITIONS.find((c) => c.id === newCat) || CATEGORY_DEFINITIONS[0]).events
    if (newCat === "Tax" || newCat === "Taxes & Statutory") {
      const dynamicTaxEvents = (rawTaxRules || [])
        .filter((tr) => tr && tr.is_active && !["TAX-001", "TAX-002", "TAX-003"].includes(tr.id || ""))
        .map((tr) => ({
          key: `tax_${String(tr.id || "").toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          label: `${tr.name || "Tax Rule"} (${tr.accountCode || ""})`,
          defaultSide: (tr.isDeduction && tr.appliesTo !== "PURCHASES" ? "Debit" : "Credit") as "Debit" | "Credit",
          defaultCode: tr.accountCode || "2000-05",
        }))
      eventsList = [
        ...eventsList,
        ...dynamicTaxEvents,
      ]
    }
    if (eventsList.length > 0) {
      const firstEvent = eventsList[0]
      setSelectedEventKey(firstEvent.key)
      setNormalPosting(firstEvent.defaultSide)
      setPrimaryAccountCode(firstEvent.defaultCode)
      setCustomEventLabel(firstEvent.label)
    }
  }

  // Handle Event Change
  const handleEventChange = (newEventKey: string) => {
    setSelectedEventKey(newEventKey)
    const ev = currentCategoryDef.events.find((e) => e.key === newEventKey)
    if (ev) {
      setNormalPosting(ev.defaultSide)
      setPrimaryAccountCode(ev.defaultCode)
      setCustomEventLabel(ev.label)
    }
  }

  // Add account to multi-account pool
  const handleAddMultiAccount = (acc: AccountItem) => {
    if (multiAccountsList.some((m) => m.account_id === acc.id || m.account_code === acc.code)) return
    setMultiAccountsList((prev) => [
      ...prev,
      {
        account_id: acc.id,
        account_code: acc.code,
        account_name: acc.name,
        is_default: prev.length === 0,
      },
    ])
  }

  const handleRemoveMultiAccount = (accCode: string) => {
    setMultiAccountsList((prev) => {
      const next = prev.filter((m) => m.account_code !== accCode)
      if (next.length > 0 && !next.some((m) => m.is_default)) {
        next[0].is_default = true
      }
      return next
    })
  }

  const handleSetDefaultMultiAccount = (accCode: string) => {
    setMultiAccountsList((prev) =>
      prev.map((m) => ({
        ...m,
        is_default: m.account_code === accCode,
      }))
    )
  }

  if (!isOpen) return null

  const isExportWarehouse = warehouseScope === "EXPORT"
  const isImportWarehouse = warehouseScope === "IMPORT"

  const finalRuleLabel =
    category === "Custom Rules" || selectedEventKey.startsWith("custom_")
      ? customEventLabel.trim() || "Custom Transaction Rule"
      : currentCategoryDef.events.find((e) => e.key === selectedEventKey)?.label || customEventLabel || "Transaction Rule"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!finalRuleLabel.trim()) {
      showToast("Validation Error", "warning", "Please specify a descriptive rule name.")
      return
    }

    const primaryAcc = accounts.find((a) => a.code === primaryAccountCode || a.id === primaryAccountCode)
    if (!primaryAcc) {
      showToast("Validation Error", "warning", "Please select a valid Chart of Accounts target.")
      return
    }

    setIsSubmitting(true)
    try {
      const multiAccountsToSave = enableMultiAccounts && multiAccountsList.length > 0
        ? multiAccountsList
        : [
            {
              account_id: primaryAcc.id,
              account_code: primaryAcc.code,
              account_name: primaryAcc.name,
              is_default: true,
            },
          ]

      const created = await store.addGlMapping({
        id: selectedEventKey && !selectedEventKey.startsWith("custom_") ? selectedEventKey : undefined,
        label: finalRuleLabel,
        category,
        account_id: primaryAcc.id,
        normal_posting: normalPosting,
        warehouse_scope: warehouseScope,
        item_type: isExportWarehouse ? itemType : (isImportWarehouse ? "VET_PHARMA" : "ALL"),
        multi_accounts: multiAccountsToSave,
        description: description.trim(),
      })

      if (created) {
        showToast("Mapping Rule Saved", "success", `Rule "${created.label}" is active and linked to [${primaryAcc.code}] ${primaryAcc.name}.`)
        onSuccess(created.id)
        onClose()
      } else {
        showToast("Save Failed", "warning", "Could not save the mapping rule.")
      }
    } catch (err) {
      showToast("Error", "warning", err instanceof Error ? err.message : "Failed to add mapping rule.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <BodyScrollLock />
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 pb-3 border-b border-zinc-100">
          <div>
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">
              Add Transaction Mapping Rule
            </h2>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">
              Connect operational transactions directly to Chart of Accounts ledgers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Category & Event Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-zinc-900 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              >
                {CATEGORY_DEFINITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-900 mb-1.5">
                Type
              </label>
              <select
                value={selectedEventKey}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              >
                {currentCategoryDef.events.map((ev) => (
                  <option key={ev.key} value={ev.key}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* If custom event, show text input */}
          {(category === "Custom Rules" || selectedEventKey.startsWith("custom_")) && (
            <div>
              <label className="block text-xs font-black text-zinc-900 mb-1.5">
                Custom Event Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customEventLabel}
                onChange={(e) => setCustomEventLabel(e.target.value)}
                placeholder="e.g. Special Coffee Export Revenue"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
            </div>
          )}

          {/* 2. Warehouse & Commodity Scope */}
          <div className="p-3.5 rounded-2xl bg-zinc-50/70 border border-zinc-200 space-y-3">
            <div className="flex items-center gap-1.5">
              <Building className="size-4 text-zinc-600" />
              <span className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                Operational Scope
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Warehouse Scope
                </label>
                <select
                  value={warehouseScope}
                  onChange={(e) => setWarehouseScope(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="ALL">All Warehouses</option>
                  <option value="IMPORT">Import Warehouse (WH2/WH3 - Pharma)</option>
                  <option value="EXPORT">Export Warehouse (WH1 - Crops)</option>
                </select>
              </div>

              {isExportWarehouse && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Commodity / Crop Type
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="ALL">All Export Commodities</option>
                    <option value="GREEN_MUNG">Green Mung Bean</option>
                    <option value="SESAME">Reddish Sesame Seed</option>
                    <option value="SOYA">Soya Bean</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 3. Normal Posting Side */}
          <div>
            <label className="block text-xs font-black text-zinc-900 mb-1.5">
              Normal Posting
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNormalPosting("Debit")}
                className={`py-2 px-3 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                  normalPosting === "Debit"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                Debit (+)
              </button>
              <button
                type="button"
                onClick={() => setNormalPosting("Credit")}
                className={`py-2 px-3 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                  normalPosting === "Credit"
                    ? "bg-blue-50 text-blue-800 border-blue-300 shadow-2xs"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                Credit (-)
              </button>
            </div>
          </div>

          {/* 4. Primary Target Account */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-black text-zinc-900">
              Assigned Chart of Accounts Target <span className="text-rose-500">*</span>
            </label>
            <COAAccountSelector
              value={primaryAccountCode}
              onChange={(acc) => {
                setPrimaryAccountCode(acc.code)
                if (multiAccountsList.length === 0) {
                  setMultiAccountsList([
                    {
                      account_id: acc.id,
                      account_code: acc.code,
                      account_name: acc.name,
                      is_default: true,
                    },
                  ])
                }
              }}
              placeholder="Search and select COA account..."
              required
            />
          </div>

          {/* 5. Optional Multi-Account Pool (for Cash/Bank Settlement) */}
          <div className="p-3.5 rounded-2xl bg-zinc-50/70 border border-zinc-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-zinc-900 block">
                  Multi-Account Settlement Pool
                </span>
                <span className="text-[11px] text-zinc-500">
                  Allow mapping multiple bank/cash accounts (e.g. CBE, Awash, Abay, BoA, Petty Cash) to this rule.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableMultiAccounts}
                  onChange={(e) => {
                    setEnableMultiAccounts(e.target.checked)
                    if (e.target.checked && multiAccountsList.length === 0) {
                      const primaryAcc = accounts.find((a) => a.code === primaryAccountCode || a.id === primaryAccountCode)
                      if (primaryAcc) {
                        setMultiAccountsList([
                          {
                            account_id: primaryAcc.id,
                            account_code: primaryAcc.code,
                            account_name: primaryAcc.name,
                            is_default: true,
                          },
                        ])
                      }
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {enableMultiAccounts && (
              <div className="space-y-2 pt-2 border-t border-zinc-200">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <COAAccountSelector
                      value=""
                      onChange={(acc) => handleAddMultiAccount(acc)}
                      placeholder="Add another account to pool (e.g. Awash Bank)..."
                      compact
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  {multiAccountsList.map((ma) => (
                    <div
                      key={ma.account_code}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {ma.account_code}
                        </code>
                        <span className="font-bold text-zinc-900">{ma.account_name}</span>
                        {ma.is_default && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-white">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!ma.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultMultiAccount(ma.account_code)}
                            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 px-1.5 py-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                          >
                            Set Default
                          </button>
                        )}
                        {multiAccountsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMultiAccount(ma.account_code)}
                            className="text-zinc-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Description / Notes */}
          <div>
            <label className="block text-xs font-black text-zinc-900 mb-1.5">
              Description / Memo (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain how this posting rule is used..."
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
            />
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-black hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !primaryAccountCode}
              className="h-10 min-w-[90px] inline-flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed px-5 text-xs font-black text-white transition-colors cursor-pointer shadow-sm"
            >
              {isSubmitting ? <LoadingDots color="bg-white" size="sm" /> : "Save Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
