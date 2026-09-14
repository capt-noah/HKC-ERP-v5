import { pool } from "../db/client.js"

let warehouseCache = null
let lastFetch = 0
const CACHE_TTL_MS = 10000 // 10s TTL, refreshes automatically

export function invalidateWarehouseCache() {
  warehouseCache = null
  lastFetch = 0
}

export async function getAllWarehouses(force = false, conn = null) {
  const now = Date.now()
  if (!force && warehouseCache && now - lastFetch < CACHE_TTL_MS) {
    return warehouseCache
  }
  const client = conn || pool
  try {
    const [rows] = await client.query("SELECT * FROM `warehouses`")
    warehouseCache = rows
    lastFetch = now
    return rows
  } catch (err) {
    console.error("[warehouseUtils] Failed to fetch warehouses from DB:", err?.message)
    if (warehouseCache) return warehouseCache
    return [
      { id: "WH1", code: "WH1-AGRI-EXP", name: "WH1 - Ethiopia Agricultural Export Hub", warehouse_type: "EXPORT_WH" },
      { id: "WH2", code: "WH2-VET-ALEM", name: "WH2 - Veterinary Import Hub (alem bank)", warehouse_type: "PHARMA_WH" },
      { id: "WH3", code: "WH3-VET-LEBU", name: "WH3 - Veterinary Import Hub (LEBU)", warehouse_type: "PHARMA_WH" },
    ]
  }
}

export async function resolveWarehouseType(warehouseIdOrCode, conn = null) {
  if (!warehouseIdOrCode) return "PHARMA_WH"
  const clean = String(warehouseIdOrCode).trim().toUpperCase()
  if (clean === "EXPORT_WH" || clean === "PHARMA_WH") return clean

  const warehouses = await getAllWarehouses(false, conn)
  const matched = warehouses.find((w) => {
    const wId = String(w.id || "").trim().toUpperCase()
    const wCode = String(w.code || "").trim().toUpperCase()
    const wName = String(w.name || "").trim().toUpperCase()
    return wId === clean || wCode === clean || wName === clean
  })

  if (matched) {
    const rawType = String(matched.warehouse_type || matched.type || "").toUpperCase()
    if (
      rawType === "EXPORT_WH" ||
      rawType.includes("EXPORT") ||
      rawType.includes("AGRI") ||
      rawType.includes("COMMODITY")
    ) {
      return "EXPORT_WH"
    }
    return "PHARMA_WH"
  }

  // Heuristic fallback for legacy or non-registered identifiers
  if (
    clean.includes("EXPORT") ||
    clean.includes("COMMODITY") ||
    clean.includes("AGRI") ||
    clean === "WH1" ||
    clean.startsWith("WH1-")
  ) {
    return "EXPORT_WH"
  }

  return "PHARMA_WH"
}

export async function isExportWarehouse(warehouseIdOrCode, conn = null) {
  return (await resolveWarehouseType(warehouseIdOrCode, conn)) === "EXPORT_WH"
}

export async function isPharmaWarehouse(warehouseIdOrCode, conn = null) {
  return (await resolveWarehouseType(warehouseIdOrCode, conn)) === "PHARMA_WH"
}

export async function getDefaultWarehouseForType(targetType = "PHARMA_WH", conn = null) {
  const warehouses = await getAllWarehouses(false, conn)
  const isTargetExport = targetType === "EXPORT_WH"
  for (const w of warehouses) {
    const rawType = String(w.warehouse_type || w.type || "").toUpperCase()
    const isWExport = rawType === "EXPORT_WH" || rawType.includes("EXPORT") || rawType.includes("AGRI")
    if (isTargetExport === isWExport) {
      return w.id || w.code
    }
  }
  return isTargetExport ? "WH1" : "WH2"
}
