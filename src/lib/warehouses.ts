import type { Warehouse, Product } from "./erpStore"

export const OPERATING_WAREHOUSES: Warehouse[] = [
  {
    id: "WH1",
    code: "WH1-AGRI-EXP",
    name: "WH1 - Ethiopia Agricultural Export Hub",
    type: "Export Hub",
    status: "Active",
    manager: "Abebe Kasahun",
    location: "Modjo Export Terminal, Ethiopia",
    targetMarkets: "Europe, Asia, USA",
    specialization: "Agricultural Commodities",
  },
  {
    id: "WH2",
    code: "WH2-VET-CENTRAL",
    name: "WH2 - Central Veterinary Hub",
    type: "Central Warehouse",
    status: "Active",
    manager: "Dr. Alemayehu Worku",
    location: "Addis Ababa Central, Ethiopia",
    targetMarkets: "Domestic & Regional Dist.",
    specialization: "Veterinary Drugs & Biologicals",
  },
  {
    id: "WH3",
    code: "WH3-VET-REGIONAL",
    name: "WH3 - Regional Veterinary Depot",
    type: "Regional Depot",
    status: "Active",
    manager: "Tigist Haile",
    location: "Bishoftu Regional Hub, Ethiopia",
    targetMarkets: "Oromia & Southern Regions",
    specialization: "Veterinary Supplies & Consumables",
  },
]

export function withOperatingWarehouses(warehouses: Warehouse[] = []): Warehouse[] {
  const byKey = new Map<string, Warehouse>()

  // Always seed with standard baseline operating warehouses
  for (const defaultWh of OPERATING_WAREHOUSES) {
    byKey.set(defaultWh.id, defaultWh)
  }

  // Merge any dynamic or custom warehouses from server/store
  for (const warehouse of warehouses || []) {
    if (!warehouse) continue
    const key = warehouse.id || warehouse.code
    if (key) {
      const existing = byKey.get(key) || byKey.get(warehouse.id) || byKey.get(warehouse.code)
      byKey.set(warehouse.id || key, { ...existing, ...warehouse })
    }
  }

  return Array.from(byKey.values())
}

export const isWH1 = (w?: string): boolean => {
  if (!w) return false
  const upper = String(w).toUpperCase()
  return upper.includes("WH1") || upper.includes("WH-01") || upper.includes("WH 1") || upper.includes("AGRI")
}

const KNOWN_MAP: Record<string, string[]> = {
  "wh1": ["WH1", "WH1-AGRI-EXP"],
  "wh1-agri-exp": ["WH1", "WH1-AGRI-EXP"],
  "wh2": ["WH2", "WH2-VET-IND", "WH2-VET-CENTRAL"],
  "wh2-vet-ind": ["WH2", "WH2-VET-IND", "WH2-VET-CENTRAL"],
  "wh2-vet-central": ["WH2", "WH2-VET-IND", "WH2-VET-CENTRAL"],
  "wh3": ["WH3", "WH3-VET-CHN", "WH3-VET-REGIONAL"],
  "wh3-vet-chn": ["WH3", "WH3-VET-CHN", "WH3-VET-REGIONAL"],
  "wh3-vet-regional": ["WH3", "WH3-VET-CHN", "WH3-VET-REGIONAL"],
}

export function resolveWarehouseScope(userWarehouseIds: string[], allWarehouses: Warehouse[] = []): string[] {
  if (!userWarehouseIds || userWarehouseIds.length === 0) {
    return []
  }

  const set = new Set<string>()

  for (const raw of userWarehouseIds) {
    if (!raw) continue
    const clean = String(raw).trim()
    const lower = clean.toLowerCase()
    set.add(clean)

    if (KNOWN_MAP[lower]) {
      KNOWN_MAP[lower].forEach((alias) => set.add(alias))
    }

    for (const w of allWarehouses) {
      if (
        w.id?.toLowerCase() === lower ||
        w.code?.toLowerCase() === lower ||
        w.name?.toLowerCase().includes(lower)
      ) {
        if (w.id) set.add(w.id)
        if (w.code) set.add(w.code)
      }
    }
  }

  return Array.from(set)
}

export function isWarehouseInScope(warehouseKey: string, scopeIds: string[]): boolean {
  if (!scopeIds || scopeIds.length === 0) return true
  const lower = (warehouseKey || "").trim().toLowerCase()
  return scopeIds.some((s) => s.toLowerCase() === lower || (KNOWN_MAP[lower] && KNOWN_MAP[lower].some(a => a.toLowerCase() === s.toLowerCase())))
}

export function isProductInWarehouseScope(product: Product, scopeIds: string[]): boolean {
  if (!scopeIds || scopeIds.length === 0) return true
  if (isWarehouseInScope(product.warehouse, scopeIds)) return true
  if (Array.isArray(product.stockBreakdown)) {
    return product.stockBreakdown.some((sb) => sb.qty > 0 && isWarehouseInScope(sb.warehouse, scopeIds))
  }
  return false
}
