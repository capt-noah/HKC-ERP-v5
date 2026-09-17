import type { Warehouse, Product, WarehouseType } from "./erpStore"

export type { WarehouseType }

export const OPERATING_WAREHOUSES: Warehouse[] = [
  {
    id: "WH1",
    code: "WH1-AGRI-EXP",
    name: "WH1 - Ethiopia Agricultural Export Hub",
    warehouse_type: "EXPORT_WH",
    type: "Export Hub",
    status: "Active",
    manager: "Abebe Kasahun",
    location: "Modjo Export Terminal, Ethiopia",
    targetMarkets: "Europe, Asia, USA",
    specialization: "Agricultural Commodities",
  },
  {
    id: "WH2",
    code: "WH2-VET-ALEM",
    name: "WH2 - Alemgena Veterinary Hub",
    warehouse_type: "PHARMA_WH",
    type: "Central Warehouse",
    status: "Active",
    manager: "Dr. Alemayehu Worku",
    location: "Addis Ababa Central, Ethiopia",
    targetMarkets: "Domestic & Regional Dist.",
    specialization: "Veterinary Drugs & Biologicals",
  },
  {
    id: "WH3",
    code: "WH3-VET-LEBU",
    name: "WH3 - Lebu Veterinary Depot",
    warehouse_type: "PHARMA_WH",
    type: "Regional Depot",
    status: "Active",
    manager: "Tigist Haile",
    location: "Bishoftu Regional Hub, Ethiopia",
    targetMarkets: "Oromia & Southern Regions",
    specialization: "Veterinary Supplies & Consumables",
  },
]


let registeredDynamicWarehouses: Warehouse[] = []

export function registerDynamicWarehouses(warehouses: Warehouse[] = []) {
  if (Array.isArray(warehouses) && warehouses.length > 0) {
    registeredDynamicWarehouses = warehouses
  }
}

export function getRegisteredWarehouses(): Warehouse[] {
  return registeredDynamicWarehouses
}

export function withOperatingWarehouses(warehouses: Warehouse[] = []): Warehouse[] {
  const byKey = new Map<string, Warehouse>()

  // Always seed with standard baseline operating warehouses
  for (const defaultWh of OPERATING_WAREHOUSES) {
    byKey.set(defaultWh.id, { ...defaultWh })
  }

  // Merge any dynamically registered warehouses from erpStore/server
  const combined = [...registeredDynamicWarehouses, ...(warehouses || [])]

  for (const warehouse of combined) {
    if (!warehouse) continue
    const key = warehouse.id || warehouse.code
    if (key) {
      const existing = byKey.get(key) || byKey.get(warehouse.id) || byKey.get(warehouse.code)
      const mergedWh: Warehouse = {
        ...existing,
        ...warehouse,
        manager:
          warehouse.manager !== undefined && warehouse.manager !== null
            ? warehouse.manager
            : existing?.manager || "Unassigned",
        specialization: warehouse.specialization || existing?.specialization,
        targetMarkets: warehouse.targetMarkets || existing?.targetMarkets,
        status: warehouse.status || existing?.status || "Active",
        warehouse_type:
          warehouse.warehouse_type ||
          existing?.warehouse_type ||
          (warehouse.type?.toUpperCase().includes("EXPORT") ? "EXPORT_WH" : "PHARMA_WH"),
      }
      byKey.set(warehouse.id || key, mergedWh)
    }
  }

  return Array.from(byKey.values())
}

/**
 * Resolves the operational type of a warehouse ('EXPORT_WH' or 'PHARMA_WH').
 * Works with Warehouse objects, warehouse IDs, warehouse codes, or names.
 */
export function getWarehouseType(
  warehouseOrId?: Warehouse | string | null,
  allWarehouses: Warehouse[] = []
): WarehouseType {
  if (!warehouseOrId) return "PHARMA_WH"

  // 1. If it's a Warehouse object with explicit warehouse_type
  if (typeof warehouseOrId === "object") {
    if (warehouseOrId.warehouse_type === "EXPORT_WH" || warehouseOrId.warehouse_type === "PHARMA_WH") {
      return warehouseOrId.warehouse_type
    }
    const rawType = (warehouseOrId.type || "").toUpperCase()
    if (rawType.includes("EXPORT") || rawType.includes("AGRI") || rawType.includes("COMMODITY")) {
      return "EXPORT_WH"
    }
    const candidateId = warehouseOrId.id || warehouseOrId.code
    return getWarehouseType(candidateId, allWarehouses)
  }

  const str = String(warehouseOrId).trim()
  const upper = str.toUpperCase()

  // 2. Direct exact matches
  if (upper === "EXPORT_WH") return "EXPORT_WH"
  if (upper === "PHARMA_WH") return "PHARMA_WH"

  // 3. Search in allWarehouses list (including user-created custom warehouses)
  const pool = withOperatingWarehouses(allWarehouses)
  const matched = pool.find(
    (w) =>
      w.id?.toLowerCase() === str.toLowerCase() ||
      w.code?.toLowerCase() === str.toLowerCase() ||
      w.name?.toLowerCase() === str.toLowerCase()
  )
  if (matched?.warehouse_type) {
    return matched.warehouse_type
  }

  // 4. Heuristic / Fallback matching for legacy strings
  if (
    upper.includes("EXPORT") ||
    upper.includes("AGRI") ||
    upper.includes("WH1") ||
    upper.includes("WH-01") ||
    upper.includes("WH 1")
  ) {
    return "EXPORT_WH"
  }

  return "PHARMA_WH"
}

export function isExportWarehouse(
  warehouseOrId?: Warehouse | string | null,
  allWarehouses: Warehouse[] = []
): boolean {
  return getWarehouseType(warehouseOrId, allWarehouses) === "EXPORT_WH"
}

export function isPharmaWarehouse(
  warehouseOrId?: Warehouse | string | null,
  allWarehouses: Warehouse[] = []
): boolean {
  return getWarehouseType(warehouseOrId, allWarehouses) === "PHARMA_WH"
}

// Backward compatibility alias:
export const isWH1 = (w?: string | Warehouse, allWarehouses: Warehouse[] = []): boolean => {
  return isExportWarehouse(w, allWarehouses)
}

const KNOWN_MAP: Record<string, string[]> = {
  "wh1": ["WH1", "WH1-AGRI-EXP"],
  "wh1-agri-exp": ["WH1", "WH1-AGRI-EXP"],
  "wh2": ["WH2", "WH2-VET-IND", "WH2-VET-CENTRAL", "WH2-VET-ALEM"],
  "wh2-vet-ind": ["WH2", "WH2-VET-IND", "WH2-VET-CENTRAL", "WH2-VET-ALEM"],
  "wh2-vet-central": ["WH2", "WH2-VET-IND", "WH2-VET-CENTRAL", "WH2-VET-ALEM"],
  "wh2-vet-alem": ["WH2", "WH2-VET-IND", "WH2-VET-CENTRAL", "WH2-VET-ALEM"],
  "wh3": ["WH3", "WH3-VET-CHN", "WH3-VET-REGIONAL", "WH3-VET-LEBU"],
  "wh3-vet-chn": ["WH3", "WH3-VET-CHN", "WH3-VET-REGIONAL", "WH3-VET-LEBU"],
  "wh3-vet-regional": ["WH3", "WH3-VET-CHN", "WH3-VET-REGIONAL", "WH3-VET-LEBU"],
  "wh3-vet-lebu": ["WH3", "WH3-VET-CHN", "WH3-VET-REGIONAL", "WH3-VET-LEBU"],
}

export function matchesWarehouse(w1?: string | null, w2?: string | null): boolean {
  if (!w1 || !w2) return false
  const s1 = String(w1).trim().toLowerCase()
  const s2 = String(w2).trim().toLowerCase()
  if (s1 === s2) return true

  const aliases1 = KNOWN_MAP[s1] ? [s1, ...KNOWN_MAP[s1].map((a) => a.toLowerCase())] : [s1]
  const aliases2 = KNOWN_MAP[s2] ? [s2, ...KNOWN_MAP[s2].map((a) => a.toLowerCase())] : [s2]
  return aliases1.some((a) => aliases2.includes(a))
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
  return scopeIds.some((s) => s.toLowerCase() === lower || (KNOWN_MAP[lower] && KNOWN_MAP[lower].some((a) => a.toLowerCase() === s.toLowerCase())))
}

export function isProductInWarehouseScope(product: Product, scopeIds: string[]): boolean {
  if (!scopeIds || scopeIds.length === 0) return true
  if (isWarehouseInScope(product.warehouse, scopeIds)) return true
  if (Array.isArray(product.stockBreakdown)) {
    return product.stockBreakdown.some((sb) => sb.qty > 0 && isWarehouseInScope(sb.warehouse, scopeIds))
  }
  return false
}

export function getUserPermittedWarehouses(
  user?: { roles?: string[]; role?: string; warehouse_ids?: string[] } | null,
  allWarehouses: Warehouse[] = []
): Warehouse[] {
  const list = withOperatingWarehouses(allWarehouses)
  if (!user) return list

  const roles = user.roles || (user.role ? [user.role] : [])
  if (roles.includes("superadmin")) return list

  const userWhIds = user.warehouse_ids || []
  if (userWhIds.length > 0) {
    const scope = resolveWarehouseScope(userWhIds, list)
    const filtered = list.filter((w) => isWarehouseInScope(w.id, scope) || isWarehouseInScope(w.code, scope))
    if (filtered.length > 0) return filtered
  }

  return list
}

