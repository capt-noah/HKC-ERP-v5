import { financeStore } from "./financeStore"
import { COMPANY_CHART_OF_ACCOUNTS, DEFAULT_GL_ACCOUNT_MAPPINGS } from "./companyCOA"

export interface PurchaseOperationalCategory {
  id: string
  label: string
  ruleKey: string
  defaultCode: string
  description: string
}

export const PURCHASE_OPERATIONAL_CATEGORIES: PurchaseOperationalCategory[] = [
  // ── Logistics & Port Operations ──
  {
    id: "freight_transport",
    label: "Freight and Transport",
    ruleKey: "purchase_freight_transport",
    defaultCode: "8101-004",
    description: "Inward freight, haulage, and transport services",
  },
  {
    id: "transit_service",
    label: "Transit Service",
    ruleKey: "purchase_transit_service",
    defaultCode: "8101-005",
    description: "Customs transit and forwarding services",
  },
  {
    id: "inspection_certificate",
    label: "Inspection, Certificate and OT",
    ruleKey: "purchase_inspection_cert",
    defaultCode: "8101-008",
    description: "Quality inspection, certifications, and overtime fees",
  },
  {
    id: "commission",
    label: "Commission",
    ruleKey: "purchase_commission",
    defaultCode: "8101-009",
    description: "Brokerage, agent commissions, and sourcing fees",
  },
  {
    id: "plomb_labour",
    label: "Plomb, BL. Labour & Others",
    ruleKey: "purchase_plomb_labour",
    defaultCode: "8101-010",
    description: "Port sealing (plomb), bill of lading, and port labour fees",
  },

  // ── Personnel & Labour Expenses ──
  {
    id: "salary_wage",
    label: "Salary and Wage",
    ruleKey: "purchase_salary_wage",
    defaultCode: "8201-001",
    description: "Operational salaries, contractor compensation, and wages",
  },
  {
    id: "transport_allowance",
    label: "Transport Allowance",
    ruleKey: "purchase_transport_allowance",
    defaultCode: "8201-002",
    description: "Staff transport allowances and daily commute support",
  },
  {
    id: "bonus",
    label: "Bonus",
    ruleKey: "purchase_bonus",
    defaultCode: "8201-003",
    description: "Performance bonuses and incentives",
  },
  {
    id: "overtime",
    label: "Over Time",
    ruleKey: "purchase_overtime",
    defaultCode: "8201-004",
    description: "Overtime compensation and shift differential pay",
  },
  {
    id: "perdiem_travel",
    label: "Per-Diem and Traveling",
    ruleKey: "purchase_perdiem_travel",
    defaultCode: "8201-011",
    description: "Field travel per-diem, lodging, and transport tickets",
  },
  {
    id: "loading_unloading",
    label: "Loading / Unloading",
    ruleKey: "purchase_loading_unloading",
    defaultCode: "8201-012",
    description: "Warehouse manual handling, bagging, and stacking labour",
  },

  // ── Office, Admin & Facilities ──
  {
    id: "stationery_supplies",
    label: "Stationery, Printing & Off Sup",
    ruleKey: "purchase_stationery_supplies",
    defaultCode: "8201-006",
    description: "Stationery, toner, printed forms, and office supplies",
  },
  {
    id: "office_rent",
    label: "Office Rent",
    ruleKey: "purchase_office_rent",
    defaultCode: "8201-009",
    description: "Office, branch, and storage facility leases",
  },
  {
    id: "telephone_internet",
    label: "Telephone and Internet",
    ruleKey: "purchase_telephone_internet",
    defaultCode: "8201-010",
    description: "Telecom, fiber internet, and communication bills",
  },
  {
    id: "fuel_lubricants",
    label: "Fuel and Lubricants",
    ruleKey: "purchase_fuel_lubricants",
    defaultCode: "8201-013",
    description: "Generator fuel, vehicle diesel, oils, and lubricants",
  },
  {
    id: "postage_photocopy",
    label: "Postage and Photocopy",
    ruleKey: "purchase_postage_photocopy",
    defaultCode: "8201-014",
    description: "Courier, postal stamps, and photocopying expenses",
  },
  {
    id: "repair_maintenance",
    label: "Repair and Maintenance",
    ruleKey: "purchase_repair_maintenance",
    defaultCode: "8201-015",
    description: "Machinery, vehicle, warehouse, and office repairs",
  },
  {
    id: "utility",
    label: "Utility",
    ruleKey: "purchase_utility",
    defaultCode: "8201-016",
    description: "Electricity, municipal water, and utility services",
  },
  {
    id: "registration_license",
    label: "Registration and License",
    ruleKey: "purchase_registration_license",
    defaultCode: "8201-017",
    description: "Commercial registration, renewals, and export licenses",
  },
  {
    id: "insurance",
    label: "Insurance",
    ruleKey: "purchase_insurance",
    defaultCode: "8201-018",
    description: "Transit, warehouse fire/theft, and vehicle insurance",
  },
  {
    id: "depreciation",
    label: "Depreciation Expense",
    ruleKey: "purchase_depreciation",
    defaultCode: "8201-020",
    description: "Periodic asset depreciation allocations",
  },
  {
    id: "membership_registration",
    label: "Membership & Registration Annu",
    ruleKey: "purchase_membership_registration",
    defaultCode: "8201-024",
    description: "Trade association, chamber of commerce, and annual dues",
  },
  {
    id: "audit_professional",
    label: "Audit Fee & Professional Fee",
    ruleKey: "purchase_audit_professional",
    defaultCode: "8201-025",
    description: "External audit, legal, accounting, and advisory fees",
  },
  {
    id: "education_tuition",
    label: "Education and Tuition Fee",
    ruleKey: "purchase_education_tuition",
    defaultCode: "8201-026",
    description: "Staff development, certifications, and training programs",
  },
  {
    id: "donation",
    label: "Donation",
    ruleKey: "purchase_donation",
    defaultCode: "8201-050",
    description: "Community CSR contributions and charitable donations",
  },
  {
    id: "entertainment",
    label: "Entertainment",
    ruleKey: "purchase_entertainment",
    defaultCode: "8201-051",
    description: "Client business hospitality and meetings",
  },
  {
    id: "miscellaneous",
    label: "Miscellaneous",
    ruleKey: "purchase_miscellaneous",
    defaultCode: "8201-100",
    description: "Sundry and unclassified operating purchases",
  },

  // ── Financial & Banking ──
  {
    id: "bank_service_charge",
    label: "Bank Service Charge",
    ruleKey: "purchase_bank_service_charge",
    defaultCode: "8301-001",
    description: "Bank transfer fees, Swift charges, and ledger charges",
  },
  {
    id: "stamp_duty",
    label: "Stamp Duty",
    ruleKey: "purchase_stamp_duty",
    defaultCode: "8301-002",
    description: "Government stamp duties and official contract stamps",
  },
  {
    id: "interest_expense",
    label: "Interest Expense",
    ruleKey: "purchase_interest_expense",
    defaultCode: "8301-003",
    description: "Bank loan interest, overdraft, and financing costs",
  },
  {
    id: "penalty",
    label: "Penalty",
    ruleKey: "purchase_penalty",
    defaultCode: "8401-001",
    description: "Statutory penalties, fines, and late compliance fees",
  },
]

export interface ResolvedPurchaseAccounts {
  debitAccount: {
    id: string
    code: string
    name: string
  }
  creditAccount: {
    id: string
    code: string
    name: string
  }
  normalPosting?: "Debit" | "Credit"
  categoryLabel?: string
}

/**
 * Resolves debit (asset/expense) and credit (bank or AP) accounts from the
 * Finance Transaction Mapping Matrix dynamically. If finance settings are modified
 * by the Finance Team, this automatically routes new purchases to the updated COA account.
 * Also performs exact and fuzzy COA account name matching to support custom rules.
 */
export function resolvePurchaseAccountsFromMatrix(
  categoryIdOrLabel: string,
  paymentType: "Cash" | "Credit",
  storeInstance = financeStore
): ResolvedPurchaseAccounts {
  const norm = (categoryIdOrLabel || "").trim().toLowerCase()
  const cleanNorm = norm.replace(/[^a-z0-9]/g, "")

  const glMappings = typeof storeInstance.getGlMappings === "function" ? storeInstance.getGlMappings() : []
  const accounts = typeof storeInstance.getAccounts === "function" ? storeInstance.getAccounts() : []

  // 1. Find matching category in PURCHASE_OPERATIONAL_CATEGORIES first
  const category = PURCHASE_OPERATIONAL_CATEGORIES.find((c) => {
    const cId = c.id.toLowerCase()
    const cLabel = c.label.toLowerCase()
    const cRule = c.ruleKey.toLowerCase()
    const cCode = c.defaultCode.toLowerCase()

    return (
      cId === norm ||
      cId.replace(/[^a-z0-9]/g, "") === cleanNorm ||
      cLabel === norm ||
      cLabel.replace(/[^a-z0-9]/g, "") === cleanNorm ||
      cRule === norm ||
      cRule.replace(/[^a-z0-9]/g, "") === cleanNorm ||
      cCode === norm ||
      (cleanNorm.length >= 4 && (cLabel.replace(/[^a-z0-9]/g, "").includes(cleanNorm) || cleanNorm.includes(cLabel.replace(/[^a-z0-9]/g, ""))))
    )
  })

  // 2. Check active user glMappings (highest priority: matches category ruleKey, ID, label, or exact name)
  let matchedMapping = glMappings.find((m) => {
    if (category && (m.id === category.ruleKey || m.id === category.id)) {
      return true
    }
    return false
  })

  if (!matchedMapping) {
    matchedMapping = glMappings.find((m) => {
      const mId = (m.id || "").toLowerCase()
      const mLabel = (m.label || "").toLowerCase()
      const mAccName = (m.account_name || "").toLowerCase()
      const mAccCode = (m.account_code || "").toLowerCase()
      const isPurchase = m.category === "Purchase"

      // If category is Purchase, prioritize rules in Purchase category
      if (category && !isPurchase) return false

      return (
        mId === norm ||
        mId.replace(/[^a-z0-9]/g, "") === cleanNorm ||
        mLabel === norm ||
        mLabel.replace(/[^a-z0-9]/g, "") === cleanNorm ||
        mAccName === norm ||
        mAccName.replace(/[^a-z0-9]/g, "") === cleanNorm ||
        mAccCode === norm
      )
    })
  }

  // 3. Check DEFAULT_GL_ACCOUNT_MAPPINGS
  if (!matchedMapping) {
    matchedMapping = DEFAULT_GL_ACCOUNT_MAPPINGS.find((m) => {
      if (category && (m.id === category.ruleKey || m.id === category.id)) {
        return true
      }
      return false
    })
  }

  if (!matchedMapping) {
    matchedMapping = DEFAULT_GL_ACCOUNT_MAPPINGS.find((m) => {
      const mId = (m.id || "").toLowerCase()
      const mLabel = (m.label || "").toLowerCase()
      const mAccName = (m.account_name || "").toLowerCase()
      const mAccCode = (m.account_code || "").toLowerCase()
      const isPurchase = m.category === "Purchase"

      if (category && !isPurchase) return false

      return (
        mId === norm ||
        mId.replace(/[^a-z0-9]/g, "") === cleanNorm ||
        mLabel === norm ||
        mLabel.replace(/[^a-z0-9]/g, "") === cleanNorm ||
        mAccName === norm ||
        mAccName.replace(/[^a-z0-9]/g, "") === cleanNorm ||
        mAccCode === norm
      )
    })
  }

  // Resolve Debit Account
  let resolvedDebitAcc: { id: string; code: string; name: string } | null = null

  if (matchedMapping) {
    const acc =
      accounts.find((a) => (a.id === matchedMapping!.account_id || a.code === matchedMapping!.account_code || a.id === matchedMapping!.account_code) && a.is_active) ||
      COMPANY_CHART_OF_ACCOUNTS.find((a) => (a.id === matchedMapping!.account_id || a.code === matchedMapping!.account_code || a.id === matchedMapping!.account_code) && a.is_active !== false)

    if (acc) {
      resolvedDebitAcc = { id: acc.id, code: acc.code, name: acc.name }
    }
  }

  // If category matched from the 31 operational list, use store mapping or its default account
  if (!resolvedDebitAcc && category) {
    const debitAcc = storeInstance.getMappedAccount(category.ruleKey, category.defaultCode)
    if (debitAcc && debitAcc.code !== "1000") {
      resolvedDebitAcc = { id: debitAcc.id, code: debitAcc.code, name: debitAcc.name }
    } else {
      const coaAcc = accounts.find((a) => a.code === category.defaultCode && a.is_active) ||
                     COMPANY_CHART_OF_ACCOUNTS.find((a) => a.code === category.defaultCode)
      if (coaAcc) {
        resolvedDebitAcc = { id: coaAcc.id, code: coaAcc.code, name: coaAcc.name }
      }
    }
  }

  // 4. Direct COA account name matching as fallback for custom categories
  if (!resolvedDebitAcc) {
    let directCoaAcc = accounts.find((a) => {
      if (!a.is_active) return false
      const aName = (a.name || "").toLowerCase().trim()
      const aCode = (a.code || "").toLowerCase().trim()
      const aId = (a.id || "").toLowerCase().trim()
      const cleanAName = aName.replace(/[^a-z0-9]/g, "")

      return (
        aName === norm ||
        cleanAName === cleanNorm ||
        aCode === norm ||
        aId === norm ||
        (cleanNorm.length >= 6 && cleanAName === cleanNorm)
      )
    })

    if (!directCoaAcc) {
      directCoaAcc = COMPANY_CHART_OF_ACCOUNTS.find((a) => {
        if (a.is_active === false) return false
        const aName = (a.name || "").toLowerCase().trim()
        const aCode = (a.code || "").toLowerCase().trim()
        const aId = (a.id || "").toLowerCase().trim()
        const cleanAName = aName.replace(/[^a-z0-9]/g, "")

        return (
          aName === norm ||
          cleanAName === cleanNorm ||
          aCode === norm ||
          aId === norm ||
          (cleanNorm.length >= 6 && cleanAName === cleanNorm)
        )
      }) as any
    }

    if (directCoaAcc) {
      resolvedDebitAcc = { id: directCoaAcc.id, code: directCoaAcc.code, name: directCoaAcc.name }
    }
  }

  if (!resolvedDebitAcc) {
    const fallbackCategory = PURCHASE_OPERATIONAL_CATEGORIES[0]
    const debitAcc = storeInstance.getMappedAccount(fallbackCategory.ruleKey, fallbackCategory.defaultCode)
    resolvedDebitAcc = {
      id: debitAcc?.id || "8101-004",
      code: debitAcc?.code || "8101-004",
      name: debitAcc?.name || "FREIGHT AND TRANSPORT",
    }
  }

  // Resolve Credit Account (Cash/Bank vs Supplier Accounts Payable)
  const creditAcc = paymentType === "Credit"
    ? storeInstance.getMappedAccount("ap_trade_payable", "2100-06")
    : storeInstance.getMappedAccount("supplier_payment_bank", "1000-02-26")

  const normalPosting = matchedMapping?.normal_posting || (resolvedDebitAcc.code.startsWith("2100") ? "Credit" : "Debit")
  const categoryLabel = matchedMapping?.label || category?.label || resolvedDebitAcc?.name || categoryIdOrLabel

  return {
    debitAccount: resolvedDebitAcc,
    creditAccount: {
      id: creditAcc.id,
      code: creditAcc.code,
      name: creditAcc.name,
    },
    normalPosting,
    categoryLabel,
  }
}
