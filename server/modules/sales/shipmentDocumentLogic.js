export const DEFAULT_SHIPMENT_DOC_RULES = [
  // ── Import Rules (Purchase Orders) ──
  {
    id: "RULE-IMP-1",
    applies_to: "purchase_order",
    origin_country: null,
    destination_region: null,
    product_category: null,
    document_type: "Commercial Invoice",
    is_required: true,
    description: "Mandatory for all import shipments",
  },
  {
    id: "RULE-IMP-2",
    applies_to: "purchase_order",
    origin_country: null,
    destination_region: null,
    product_category: null,
    document_type: "Packing List",
    is_required: true,
    description: "Mandatory for all import shipments",
  },
  {
    id: "RULE-IMP-3",
    applies_to: "purchase_order",
    origin_country: null,
    destination_region: null,
    product_category: null,
    document_type: "Bill of Lading / Airway Bill",
    is_required: true,
    description: "Mandatory transport document for all import shipments",
  },
  {
    id: "RULE-IMP-4",
    applies_to: "purchase_order",
    origin_country: "China",
    destination_region: null,
    product_category: null,
    document_type: "Certificate of Origin",
    is_required: true,
    description: "Required for imports originating from China",
  },
  {
    id: "RULE-IMP-5",
    applies_to: "purchase_order",
    origin_country: "India",
    destination_region: null,
    product_category: null,
    document_type: "Certificate of Origin",
    is_required: true,
    description: "Required for imports originating from India",
  },
  {
    id: "RULE-IMP-6",
    applies_to: "purchase_order",
    origin_country: null,
    destination_region: null,
    product_category: "Medicine",
    document_type: "Certificate of Analysis (COA)",
    is_required: true,
    description: "Required for pharmaceutical and medical supplies",
  },

  // ── Sales Order Rules ──
  {
    id: "RULE-SO-1",
    applies_to: "sales_order",
    origin_country: null,
    destination_region: null,
    product_category: null,
    document_type: "Trade License",
    is_required: true,
    description: "Mandatory customer Trade License",
  },
  {
    id: "RULE-SO-2",
    applies_to: "sales_order",
    origin_country: null,
    destination_region: null,
    product_category: null,
    document_type: "Payment Advice",
    is_required: true,
    description: "Mandatory proof of payment receipt / advice at agreed contract price",
  },
]

export function evaluateShipmentDocs({ record, items = [], attachments = [], rules = DEFAULT_SHIPMENT_DOC_RULES, appliesTo = "purchase_order" }) {
  const activeRules = rules.filter((r) => r.applies_to === appliesTo && r.is_required)
  const originCountry = record?.origin_country || record?.originCountry || record?.supplierCountry || record?.origin || null
  const destinationRegion = record?.destination_region || record?.destinationRegion || record?.destination || null
  const rawWarehouse = String(record?.warehouse || record?.warehouse_id || record?.warehouseName || "").toUpperCase()
  const isWH1Record = rawWarehouse.includes("WH1") || rawWarehouse.includes("WH-01") || rawWarehouse.includes("WH 1") || rawWarehouse.includes("AGRI")
  const isCreditOrder = String(record?.payment_type || record?.paymentType || "").toLowerCase() === "credit"

  const categories = new Set(
    (items || []).map((i) => i.category || i.product_category || i.itemCategory || "").filter(Boolean)
  )

  const applicableRules = activeRules.filter((rule) => {
    // Waive Payment Advice on Credit sales orders
    if (appliesTo === "sales_order" && rule.document_type === "Payment Advice" && isCreditOrder) {
      return false
    }

    // Check origin country match
    if (rule.origin_country && originCountry) {
      if (rule.origin_country.toLowerCase() !== originCountry.toLowerCase()) {
        return false
      }
    }

    // Check destination region match
    if (rule.destination_region && destinationRegion) {
      if (rule.destination_region.toLowerCase() !== destinationRegion.toLowerCase()) {
        return false
      }
    }

    // Check category match
    if (rule.product_category) {
      if (categories.size > 0 && !categories.has(rule.product_category)) {
        return false
      }
    }

    return true
  })

  // Deduplicate required document types
  const requiredDocTypesMap = new Map()
  applicableRules.forEach((rule) => {
    let docType = rule.document_type
    let desc = rule.description || `Required for ${appliesTo.replace("_", " ")}`
    if (isWH1Record && docType === "Trade License") {
      docType = "Bank Permit"
      desc = "Mandatory banking permit for export commodities"
    }

    if (!requiredDocTypesMap.has(docType)) {
      requiredDocTypesMap.set(docType, desc)
    }
  })

  const attachedTypesMap = new Map()
  ;(attachments || []).forEach((file) => {
    if (file.document_type) {
      attachedTypesMap.set(file.document_type.toLowerCase().trim(), file)
    }
  })

  const satisfied = []
  const missing = []

  for (const [docType, reason] of requiredDocTypesMap.entries()) {
    let matchedFile = attachedTypesMap.get(docType.toLowerCase().trim())
    // For WH1 Bank Permit, also accept Trade License if present
    if (!matchedFile && isWH1Record && docType === "Bank Permit") {
      matchedFile = attachedTypesMap.get("trade license") || attachedTypesMap.get("trade paper")
    }
    // For Trade License, also accept Bank Permit
    if (!matchedFile && docType === "Trade License") {
      matchedFile = attachedTypesMap.get("bank permit") || attachedTypesMap.get("bank permit / advice")
    }

    if (matchedFile) {
      satisfied.push({ document_type: docType, file: matchedFile })
    } else {
      missing.push({ document_type: docType, reason })
    }
  }

  const totalRequired = requiredDocTypesMap.size
  const satisfiedCount = satisfied.length
  const missingCount = missing.length
  const isComplete = missingCount === 0

  return {
    isComplete,
    totalRequired,
    satisfiedCount,
    missingCount,
    satisfied,
    missing,
  }
}
