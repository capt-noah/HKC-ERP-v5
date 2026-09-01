/**
 * DYNAMIC MULTI-TAX CALCULATION ENGINE
 * Rule-based, zero-click automated tax determination & calculation matching Peachtree / Sage 50 architecture.
 */

export interface TaxRule {
  id: string
  name: string
  ratePercent: number
  type: "VAT/GST" | "Withholding Tax (TDS)" | "Turnover Tax (TOT)" | "Customs Duty" | "Exempt"
  accountCode: string          // e.g. "2000-05", "1320-06-01", "2000-04", "1320-06-02"
  isInclusive: boolean         // Whether price already includes tax
  isDeduction: boolean         // True for WHT (deducted from payout), False for VAT (added to total)
  appliesTo: "SALES" | "PURCHASES" | "BOTH"
  description?: string
  is_active: boolean
}

export interface TaxSchedule {
  id: string
  name: string
  taxRuleIds: string[]
  appliesTo: "SALES" | "PURCHASES" | "BOTH"
  isDefault?: boolean
  description?: string
}

export interface TaxLineDetail {
  ruleId: string
  ruleName: string
  ratePercent: number
  accountCode: string
  taxableAmount: number
  taxAmount: number
  isDeduction: boolean
  isInclusive: boolean
}

export interface TaxCalculationResult {
  subtotal: number
  taxLines: TaxLineDetail[]
  totalTaxAdded: number        // e.g. 15% VAT
  totalTaxDeducted: number     // e.g. 2% or 3% WHT
  netTotal: number             // subtotal + totalTaxAdded - totalTaxDeducted
}

export const INITIAL_TAX_RULES: TaxRule[] = [
  {
    id: "TAX-VAT-15",
    name: "Standard VAT (15%)",
    ratePercent: 15,
    type: "VAT/GST",
    accountCode: "2000-05",
    isInclusive: false,
    isDeduction: false,
    appliesTo: "BOTH",
    description: "Standard 15% Ethiopian Value Added Tax (Output VAT / Input VAT)",
    is_active: true,
  },
  {
    id: "TAX-WHT-2",
    name: "Withholding Tax (2% Services)",
    ratePercent: 2,
    type: "Withholding Tax (TDS)",
    accountCode: "1320-06-01",
    isInclusive: false,
    isDeduction: true,
    appliesTo: "BOTH",
    description: "2% Tax Deducted at Source for commercial service contracts",
    is_active: true,
  },
  {
    id: "TAX-WHT-3",
    name: "Withholding Tax (3% Goods/Rent)",
    ratePercent: 3,
    type: "Withholding Tax (TDS)",
    accountCode: "1320-06-01",
    isInclusive: false,
    isDeduction: true,
    appliesTo: "BOTH",
    description: "3% Withholding Tax asset deducted on goods supplies and rental",
    is_active: true,
  },
  {
    id: "TAX-TOT-2",
    name: "Turnover Tax (2% TOT)",
    ratePercent: 2,
    type: "Turnover Tax (TOT)",
    accountCode: "2000-05",
    isInclusive: false,
    isDeduction: false,
    appliesTo: "SALES",
    description: "2% Turnover Tax for non-VAT registered service transactions",
    is_active: true,
  },
  {
    id: "TAX-ZERO",
    name: "Zero-Rated / Export Exempt (0%)",
    ratePercent: 0,
    type: "Exempt",
    accountCode: "2000-05",
    isInclusive: false,
    isDeduction: false,
    appliesTo: "BOTH",
    description: "Zero-rated export commodities (Green Mung, Sesame) and exempt supplies",
    is_active: true,
  },
]

export const INITIAL_TAX_SCHEDULES: TaxSchedule[] = [
  {
    id: "SCH-DOM-VAT",
    name: "Standard Domestic Sale (15% VAT)",
    taxRuleIds: ["TAX-VAT-15"],
    appliesTo: "SALES",
    isDefault: true,
    description: "Standard 15% VAT for domestic commercial clients",
  },
  {
    id: "SCH-GOV-WHT-2",
    name: "Gov & Corp Agency (15% VAT + 2% WHT)",
    taxRuleIds: ["TAX-VAT-15", "TAX-WHT-2"],
    appliesTo: "SALES",
    isDefault: false,
    description: "15% VAT added and 2% Withholding Tax deducted at source by withholding agent",
  },
  {
    id: "SCH-GOV-WHT-3",
    name: "Gov Goods Supply (15% VAT + 3% WHT)",
    taxRuleIds: ["TAX-VAT-15", "TAX-WHT-3"],
    appliesTo: "SALES",
    isDefault: false,
    description: "15% VAT added and 3% Withholding Tax deducted on supplies to public bodies",
  },
  {
    id: "SCH-EXP-ZERO",
    name: "Export & Agri Commodity (0% Exempt)",
    taxRuleIds: ["TAX-ZERO"],
    appliesTo: "BOTH",
    isDefault: false,
    description: "0% Tax for international buyers and raw agricultural commodity trade",
  },
  {
    id: "SCH-PUR-WHT-2",
    name: "Purchase with 2% Supplier WHT",
    taxRuleIds: ["TAX-VAT-15", "TAX-WHT-2"],
    appliesTo: "PURCHASES",
    isDefault: true,
    description: "Standard purchase with 15% Input VAT and 2% WHT withheld from vendor payout",
  },
]

/**
 * Calculates itemized taxes and totals for a given subtotal amount based on active rules & selected schedule.
 */
export function calculateMultiTax(
  subtotal: number,
  allRules: TaxRule[],
  scheduleOrRuleIds?: TaxSchedule | string[] | string | null
): TaxCalculationResult {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0)
  if (safeSubtotal === 0 || !Array.isArray(allRules) || allRules.length === 0) {
    return {
      subtotal: safeSubtotal,
      taxLines: [],
      totalTaxAdded: 0,
      totalTaxDeducted: 0,
      netTotal: safeSubtotal,
    }
  }

  let activeRuleIds: string[] = []

  if (typeof scheduleOrRuleIds === "string") {
    if (scheduleOrRuleIds.startsWith("SCH-")) {
      const sch = INITIAL_TAX_SCHEDULES.find((s) => s.id === scheduleOrRuleIds)
      activeRuleIds = sch ? sch.taxRuleIds : ["TAX-VAT-15"]
    } else {
      activeRuleIds = [scheduleOrRuleIds]
    }
  } else if (Array.isArray(scheduleOrRuleIds)) {
    activeRuleIds = scheduleOrRuleIds
  } else if (scheduleOrRuleIds && typeof scheduleOrRuleIds === "object" && Array.isArray(scheduleOrRuleIds.taxRuleIds)) {
    activeRuleIds = scheduleOrRuleIds.taxRuleIds
  } else {
    // Default to Standard VAT 15%
    const defaultRule = allRules.find((r) => r.type === "VAT/GST" && r.ratePercent > 0) || allRules[0]
    activeRuleIds = defaultRule ? [defaultRule.id] : []
  }

  const resolvedRules = allRules.filter((r) => activeRuleIds.includes(r.id) && r.is_active !== false)

  let totalTaxAdded = 0
  let totalTaxDeducted = 0

  const taxLines: TaxLineDetail[] = resolvedRules.map((rule) => {
    const rate = Number(rule.ratePercent || 0)
    let taxAmount = 0

    if (rule.isInclusive) {
      taxAmount = Math.round((safeSubtotal - (safeSubtotal / (1 + rate / 100))) * 100) / 100
    } else {
      taxAmount = Math.round(((safeSubtotal * rate) / 100) * 100) / 100
    }

    if (rule.isDeduction) {
      totalTaxDeducted += taxAmount
    } else {
      totalTaxAdded += taxAmount
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ratePercent: rate,
      accountCode: rule.accountCode,
      taxableAmount: safeSubtotal,
      taxAmount,
      isDeduction: rule.isDeduction,
      isInclusive: rule.isInclusive,
    }
  })

  const netTotal = Math.max(0, safeSubtotal + totalTaxAdded - totalTaxDeducted)

  return {
    subtotal: safeSubtotal,
    taxLines,
    totalTaxAdded: Math.round(totalTaxAdded * 100) / 100,
    totalTaxDeducted: Math.round(totalTaxDeducted * 100) / 100,
    netTotal: Math.round(netTotal * 100) / 100,
  }
}

/**
 * Intelligent Zero-Click Resolution:
 * Auto-detects the matching tax schedule based on the customer/supplier and product item category.
 */
export function resolveAutoTaxScheduleId(
  party?: { name?: string; type?: string; tin?: string; defaultTaxScheduleId?: string; isGovAgent?: boolean } | null,
  product?: { name?: string; category?: string; defaultTaxScheduleId?: string } | null,
  transactionType: "SALES" | "PURCHASES" = "SALES"
): string {
  // 1. Explicit party override
  if (party?.defaultTaxScheduleId) return party.defaultTaxScheduleId

  // 2. Explicit product override
  if (product?.defaultTaxScheduleId) return product.defaultTaxScheduleId

  const partyName = (party?.name || "").toLowerCase()
  const prodName = (product?.name || "").toLowerCase()
  const prodCategory = (product?.category || "").toLowerCase()

  // 3. Export Agricultural Commodities -> Zero-Rated
  if (
    prodName.includes("mung") ||
    prodName.includes("sesame") ||
    prodCategory.includes("export") ||
    prodCategory.includes("agriculture") ||
    partyName.includes("export") ||
    partyName.includes("international")
  ) {
    return "SCH-EXP-ZERO"
  }

  // 4. Government / Public Enterprise / Withholding Agent -> 15% VAT + 2% WHT
  if (
    party?.isGovAgent ||
    partyName.includes("ministry") ||
    partyName.includes("bureau") ||
    partyName.includes("agency") ||
    partyName.includes("authority") ||
    partyName.includes("corporation") ||
    partyName.includes("telecom") ||
    partyName.includes("ethiopian airlines") ||
    partyName.includes("bank of") ||
    partyName.includes("commercial bank")
  ) {
    return transactionType === "SALES" ? "SCH-GOV-WHT-2" : "SCH-PUR-WHT-2"
  }

  // 5. Purchases with Supplier Withholding
  if (transactionType === "PURCHASES") {
    return "SCH-PUR-WHT-2"
  }

  // 6. Default to Standard Domestic VAT
  return "SCH-DOM-VAT"
}
