import { loadResource, createResource, updateResource, deleteResource } from "./apiPersistence"

export interface BinCardEntry {
  id: string
  date: string
  batchNo: string
  qtyReceived: number
  qtyIssued: number
  balance: number
  expiryDate: string
  party: string
  remark: string
}

export interface BinCard {
  id: string
  cardNo: string
  productId?: string
  description: string
  dosage: string
  unit: string
  shelfNo: string
  entries: BinCardEntry[]
  createdAt?: string
  updatedAt?: string
}

// Initial seed mock data for fallback
export const DEFAULT_BIN_CARDS: BinCard[] = [
  {
    id: "bc-1",
    cardNo: "BC-2026-0012",
    productId: "p1",
    description: "Oxytetracycline 20% LA Injection",
    dosage: "100ml Vial",
    unit: "Vial",
    shelfNo: "Shelf A-04",
    entries: [
      {
        id: "e-1",
        date: "2026-08-01",
        batchNo: "OXY-2026-01",
        qtyReceived: 500,
        qtyIssued: 0,
        balance: 500,
        expiryDate: "2028-07-31",
        party: "MedPharma Overseas Suppliers",
        remark: "Initial Import Stock Deposit - GRN#8821"
      },
      {
        id: "e-2",
        date: "2026-08-05",
        batchNo: "OXY-2026-01",
        qtyReceived: 0,
        qtyIssued: 120,
        balance: 380,
        expiryDate: "2028-07-31",
        party: "Addis Ababa Vet Clinic",
        remark: "Invoice #INV-2026-4401"
      },
      {
        id: "e-3",
        date: "2026-08-10",
        batchNo: "OXY-2026-02",
        qtyReceived: 200,
        qtyIssued: 0,
        balance: 580,
        expiryDate: "2028-11-15",
        party: "Global Health Pharma Ltd",
        remark: "Fresh Batch Delivery - GRN#8905"
      },
      {
        id: "e-4",
        date: "2026-08-14",
        batchNo: "OXY-2026-01",
        qtyReceived: 0,
        qtyIssued: 80,
        balance: 500,
        expiryDate: "2028-07-31",
        party: "Regional Livestock Bureau",
        remark: "Dispatch Order #DO-1092"
      }
    ]
  },
  {
    id: "bc-2",
    cardNo: "BC-2026-0045",
    productId: "p2",
    description: "Ivermectin 1% Solution",
    dosage: "50ml Bottle",
    unit: "Bottle",
    shelfNo: "Shelf B-02",
    entries: [
      {
        id: "e-201",
        date: "2026-08-02",
        batchNo: "IVM-2026-99",
        qtyReceived: 300,
        qtyIssued: 0,
        balance: 300,
        expiryDate: "2029-01-20",
        party: "East Africa Animal Care",
        remark: "Customs Cleared Deposit"
      },
      {
        id: "e-202",
        date: "2026-08-12",
        batchNo: "IVM-2026-99",
        qtyReceived: 0,
        qtyIssued: 45,
        balance: 255,
        expiryDate: "2029-01-20",
        party: "Bishoftu Poultry Farm",
        remark: "Invoice #INV-2026-4490"
      }
    ]
  }
]

export function recalculateCardBalances(entries: BinCardEntry[]): BinCardEntry[] {
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let currentBal = 0
  return sorted.map(e => {
    currentBal = currentBal + (e.qtyReceived || 0) - (e.qtyIssued || 0)
    return { ...e, balance: currentBal }
  })
}

export async function fetchBinCards(): Promise<BinCard[]> {
  try {
    const data = await loadResource<BinCard>("bin_cards")
    if (data && data.length > 0) {
      return data.map(card => ({
        ...card,
        entries: recalculateCardBalances(card.entries || [])
      }))
    }
    // Seed default cards if empty
    for (const card of DEFAULT_BIN_CARDS) {
      await createResource<BinCard>("bin_cards", card)
    }
    return DEFAULT_BIN_CARDS
  } catch (err) {
    console.error("fetchBinCards error:", err)
    return DEFAULT_BIN_CARDS
  }
}

export async function createBinCard(card: Omit<BinCard, "id" | "createdAt" | "updatedAt">): Promise<BinCard> {
  const now = new Date().toISOString()
  const payload: BinCard = {
    ...card,
    id: `bc-${Date.now()}`,
    entries: recalculateCardBalances(card.entries || []),
    createdAt: now,
    updatedAt: now,
  }
  return await createResource<BinCard>("bin_cards", payload)
}

export async function updateBinCard(id: string, patch: Partial<BinCard>): Promise<BinCard> {
  const updatePayload = {
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  if (updatePayload.entries) {
    updatePayload.entries = recalculateCardBalances(updatePayload.entries)
  }
  return await updateResource<BinCard>("bin_cards", id, updatePayload)
}

export async function deleteBinCard(id: string): Promise<void> {
  await deleteResource("bin_cards", id)
}
