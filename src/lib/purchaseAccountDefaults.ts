import { financeStore } from "./financeStore"

export interface PurchaseOperationalCategory {
  id: string
  label: string
  ruleKey: string
  defaultCode: string
  description: string
}

export const PURCHASE_OPERATIONAL_CATEGORIES: PurchaseOperationalCategory[] = [
  {
    id: "export_commodities",
    label: "Export Commodities (Green Mung, Oilseeds, Pulses)",
    ruleKey: "purchase_export_commodity",
    defaultCode: "1410-01",
    description: "WH1 export inventory crops & pulses",
  },
  {
    id: "pharma_stock",
    label: "Veterinary Medicines & Supplies",
    ruleKey: "purchase_pharma_stock",
    defaultCode: "1400-01",
    description: "WH2/WH3 veterinary pharmaceuticals & vaccines",
  },
  {
    id: "packaging_bags",
    label: "Packaging & Bags (PP Bags, Liners)",
    ruleKey: "purchase_packaging_bags",
    defaultCode: "6000-04",
    description: "Export bag procurement, stitching, & packaging material",
  },
  {
    id: "transport_freight",
    label: "Inward Transport & Freight Logistics",
    ruleKey: "purchase_transport_freight",
    defaultCode: "6000-08",
    description: "Trucking, freight, transport, & haulage to warehouse",
  },
  {
    id: "office_supplies",
    label: "Office & Warehouse Supplies",
    ruleKey: "purchase_office_supplies",
    defaultCode: "8000-07",
    description: "Stationery, warehouse consumables, & admin supplies",
  },
  {
    id: "general_procurement",
    label: "General Procurement & Miscellaneous",
    ruleKey: "purchase_general_misc",
    defaultCode: "8000-30",
    description: "Operating procurement, utilities, & sundry business items",
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
}

/**
 * Resolves debit (asset/expense) and credit (bank or AP) accounts from the
 * Finance Transaction Mapping Matrix dynamically. If finance settings are modified
 * by the Finance Team, this automatically routes new purchases to the updated COA account.
 */
export function resolvePurchaseAccountsFromMatrix(
  categoryIdOrLabel: string,
  paymentType: "Cash" | "Credit",
  storeInstance = financeStore
): ResolvedPurchaseAccounts {
  // Find matching category by ID or label
  const category = PURCHASE_OPERATIONAL_CATEGORIES.find(
    (c) => c.id === categoryIdOrLabel || c.label === categoryIdOrLabel || categoryIdOrLabel.toLowerCase().includes(c.id.replace("_", " "))
  ) || PURCHASE_OPERATIONAL_CATEGORIES[0]

  // Resolve Debit Account (Inventory / Asset / Cost / Expense)
  const debitAcc = storeInstance.getMappedAccount(category.ruleKey, category.defaultCode)

  // Resolve Credit Account (Cash/Bank vs Supplier Accounts Payable)
  const creditAcc = paymentType === "Credit"
    ? storeInstance.getMappedAccount("purchase_ap_credit", "2100-06")
    : storeInstance.getMappedAccount("purchase_cash_bank", "1000-02-26")

  return {
    debitAccount: {
      id: debitAcc.id,
      code: debitAcc.code,
      name: debitAcc.name,
    },
    creditAccount: {
      id: creditAcc.id,
      code: creditAcc.code,
      name: creditAcc.name,
    },
  }
}
