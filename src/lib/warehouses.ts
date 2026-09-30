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
    name: "WH2 - Veterinary Import Hub (alem bank)IND",
    warehouse_type: "PHARMA_WH",
    type: "Import & Distribution Hub",
    status: "Active",
    manager: "Dr. Alemayehu Worku",
    location: "Alem Bank Hub, Addis Ababa, Ethiopia",
    targetMarkets: "Domestic & Regional Dist.",
    specialization: "Veterinary Drugs & Biologicals",
  },
  {
    id: "WH3",
    code: "WH3-VET-LEBU",
    name: "WH3 - Veterinary Import Hub (LEBU)CHINA",
    warehouse_type: "PHARMA_WH",
    type: "Import & Distribution Hub",
    status: "Active",
    manager: "Tigist Haile",
    location: "Lebu Commercial Center, Addis Ababa, Ethiopia",
    targetMarkets: "Oromia & Southern Regions",
    specialization: "Veterinary Supplies & Consumables",
  },
]


// Try to initialize registered dynamic warehouses from browser localStorage cache immediately
let registeredDynamicWarehouses: Warehouse[] = (() => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const cached = localStorage.getItem("hkc_warehouses_cache")
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    }
  } catch {}
  return []
})()

export function registerDynamicWarehouses(warehouses: Warehouse[] = []) {
  if (Array.isArray(warehouses) && warehouses.length > 0) {
    const merged = withOperatingWarehouses(warehouses)
    registeredDynamicWarehouses = merged
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("hkc_warehouses_cache", JSON.stringify(merged))
      }
    } catch {}
  }
}

export function getRegisteredWarehouses(): Warehouse[] {
  if (registeredDynamicWarehouses.length === 0) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const cached = localStorage.getItem("hkc_warehouses_cache")
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            registeredDynamicWarehouses = withOperatingWarehouses(parsed)
            return registeredDynamicWarehouses
          }
        }
      }
    } catch {}
    return withOperatingWarehouses([])
  }
  return registeredDynamicWarehouses
}

export function getWarehouseCanonicalKey(w?: Warehouse | string | null): string {
  if (!w) return ""
  const str = typeof w === "string" ? w : `${w.id || ""} ${w.code || ""} ${w.name || ""}`
  const clean = str.trim().toUpperCase()

  if (/\bWH[-_\s]?0?1\b/i.test(clean) || clean.includes("AGRI-EXP") || clean.includes("MODJO") || clean.includes("ETHIOPIA AGRICULTURAL")) {
    return "WH1"
  }
  if (/\bWH[-_\s]?0?2\b/i.test(clean) || clean.includes("VET-ALEM") || clean.includes("ALEM BANK") || clean.includes("VET-IND") || clean.includes("VET-CENTRAL")) {
    return "WH2"
  }
  if (/\bWH[-_\s]?0?3\b/i.test(clean) || clean.includes("VET-LEBU") || clean.includes("LEBU") || clean.includes("VET-CHN") || clean.includes("VET-REGIONAL")) {
    return "WH3"
  }
  return typeof w === "string" ? (w.trim() || "") : (w.id || w.code || w.name || "")
}

export function withOperatingWarehouses(warehouses: Warehouse[] = []): Warehouse[] {
  const resultByKey = new Map<string, Warehouse>()

  // 1. Seed baseline default operating warehouses
  for (const base of OPERATING_WAREHOUSES) {
    if (base?.id) {
      const key = getWarehouseCanonicalKey(base) || base.id
      resultByKey.set(key, { ...base })
    }
  }

  // 2. Merge registered dynamic warehouses and incoming warehouses
  const inputList = [...(registeredDynamicWarehouses || []), ...(warehouses || [])]

  for (const incoming of inputList) {
    if (!incoming) continue
    const incomingKey = getWarehouseCanonicalKey(incoming) || incoming.id || incoming.code || incoming.name

    if (incomingKey && resultByKey.has(incomingKey)) {
      const existing = resultByKey.get(incomingKey)!
      const updated: Warehouse = {
        ...existing,
        ...incoming,
        id: incoming.id || existing.id || incomingKey,
        code: incoming.code || existing.code || incoming.id || incomingKey,
        name: incoming.name || existing.name || incomingKey,
        location: incoming.location !== undefined ? incoming.location : existing.location,
        type: incoming.type || existing.type,
        manager:
          incoming.manager !== undefined && incoming.manager !== null
            ? incoming.manager
            : existing.manager || "Unassigned",
        specialization: incoming.specialization || existing.specialization,
        targetMarkets: incoming.targetMarkets || existing.targetMarkets,
        status: incoming.status || existing.status || "Active",
        warehouse_type:
          incoming.warehouse_type ||
          existing.warehouse_type ||
          (incoming.type?.toUpperCase().includes("EXPORT") ? "EXPORT_WH" : "PHARMA_WH"),
      }
      resultByKey.set(incomingKey, updated)
    } else if (incomingKey) {
      const newId = incoming.id || incoming.code || incomingKey
      const newWh: Warehouse = {
        ...incoming,
        id: newId,
        code: incoming.code || newId,
        name: incoming.name || newId,
        location: incoming.location || "",
        type: incoming.type || (incoming.warehouse_type === "EXPORT_WH" ? "Export Hub" : "Pharmaceutical Hub"),
        manager: incoming.manager || "Unassigned",
        specialization: incoming.specialization || "",
        targetMarkets: incoming.targetMarkets || "",
        status: incoming.status || "Active",
        warehouse_type: incoming.warehouse_type || (incoming.type?.toUpperCase().includes("EXPORT") ? "EXPORT_WH" : "PHARMA_WH"),
      }
      resultByKey.set(incomingKey, newWh)
    }
  }

  const result = Array.from(resultByKey.values())
  if (result.length > 0) {
    registeredDynamicWarehouses = result
  }
  return result
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

export function resolveWarehouseFullName(warehouseOrId?: string | null, customList: Warehouse[] = []): string {
  if (!warehouseOrId) return "Not Assigned"
  const raw = String(warehouseOrId).trim()
  if (!raw || raw === "Not Assigned") return "Not Assigned"
  if (raw === "Head Office" || raw.toLowerCase() === "head office") return "Head Office"

  const pool = customList && customList.length > 0 ? withOperatingWarehouses(customList) : getRegisteredWarehouses()
  const canonicalKey = getWarehouseCanonicalKey(raw)

  // 1. Match by canonical key in registered dynamic warehouses
  if (canonicalKey)  {
    const matched = pool.find((w) => getWarehouseCanonicalKey(w) === canonicalKey)
    if (matched && matched.name) return matched.name
  }

  const lower = raw.toLowerCase()

  // 2. Direct search in customList or latest registered dynamic warehouses
  let found = pool.find(
    (w) =>
      w.id?.toLowerCase() === lower ||
      w.code?.toLowerCase() === lower ||
      w.name?.toLowerCase() === lower
  )

  if (!found) {
    found = pool.find(
      (w) => matchesWarehouse(w.id, raw) || matchesWarehouse(w.code, raw)
    )
  }

  if (found && found.name) {
    return found.name
  }

  return raw
}

export function resolveWarehouseCode(warehouseOrId?: string | null, customList: Warehouse[] = []): string {
  if (!warehouseOrId) return "—"
  const raw = String(warehouseOrId).trim()
  if (!raw || raw === "Not Assigned") return "—"
  if (raw === "Head Office" || raw.toLowerCase() === "head office") return "HQ"

  const pool = customList && customList.length > 0 ? withOperatingWarehouses(customList) : getRegisteredWarehouses()
  const canonicalKey = getWarehouseCanonicalKey(raw)

  if (canonicalKey) {
    const matched = pool.find((w) => getWarehouseCanonicalKey(w) === canonicalKey)
    if (matched && matched.code) return matched.code
    if (matched && matched.id) return matched.id
  }

  const lower = raw.toLowerCase()
  let found = pool.find(
    (w) =>
      w.id?.toLowerCase() === lower ||
      w.code?.toLowerCase() === lower ||
      w.name?.toLowerCase() === lower
  )

  if (!found) {
    found = pool.find(
      (w) => matchesWarehouse(w.id, raw) || matchesWarehouse(w.code, raw)
    )
  }

  if (found && found.code) {
    return found.code
  }
  if (found && found.id) {
    return found.id
  }

  return raw
}



