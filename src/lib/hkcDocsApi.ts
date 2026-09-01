import { loadResource, createResource, updateResource, deleteResource } from "./apiPersistence"
import type { HkcDocRecord } from "./erpStore"
import { sortNewestFirst } from "./utils"

export async function loadHkcDocRecords(): Promise<HkcDocRecord[]> {
  try {
    const records = await loadResource<HkcDocRecord>("hkc_doc_records")
    return sortNewestFirst(records)
  } catch (err) {
    console.error("loadHkcDocRecords error:", err)
    return []
  }
}

export async function createHkcDocRecord(record: Omit<HkcDocRecord, "id" | "createdAt" | "updatedAt">): Promise<HkcDocRecord> {
  const now = new Date().toISOString()
  const payload: HkcDocRecord = {
    ...record,
    id: `HKCD-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  }
  return await createResource<HkcDocRecord>("hkc_doc_records", payload)
}

export async function updateHkcDocRecord(id: string, patch: Partial<HkcDocRecord>): Promise<HkcDocRecord> {
  const updatePayload = {
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  return await updateResource<HkcDocRecord>("hkc_doc_records", id, updatePayload)
}

export async function deleteHkcDocRecord(id: string): Promise<void> {
  await deleteResource("hkc_doc_records", id)
}
