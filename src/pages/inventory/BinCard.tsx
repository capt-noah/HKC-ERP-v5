import { useState, useEffect, useMemo } from "react"
import { Plus } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { SubPageNav } from "@/components/SubPageNav"
import { GlassCard } from "@/components/GlassCard"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, type Product } from "@/lib/erpStore"
import { 
  fetchBinCards, 
  createBinCard, 
  updateBinCard, 
  deleteBinCard, 
  type BinCard as BinCardType, 
  type BinCardEntry 
} from "@/lib/binCardApi"
import BinCardTable from "@/components/binCard/BinCardTable"
import BinCardHeaderModal from "@/components/binCard/BinCardHeaderModal"
import BinCardEntryModal from "@/components/binCard/BinCardEntryModal"
import BinCardPrintModal from "@/components/binCard/BinCardPrintModal"

export default function BinCard() {
  const erp = useErpStore()
  const products: Product[] = erp.getProducts()

  // State
  const [cards, setCards] = useState<BinCardType[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Search & Batch filter
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>("ALL")

  // Modals
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState<boolean>(false)
  const [editingCard, setEditingCard] = useState<BinCardType | null>(null)

  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false)
  const [targetCardForEntry, setTargetCardForEntry] = useState<BinCardType | null>(null)
  const [editingEntry, setEditingEntry] = useState<BinCardEntry | null>(null)

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false)
  const [printCard, setPrintCard] = useState<BinCardType | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await fetchBinCards()
      setCards(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Action Handlers
  const handleOpenAddCard = () => {
    setEditingCard(null)
    setIsHeaderModalOpen(true)
  }

  const handleOpenEditCard = (card: BinCardType) => {
    setEditingCard(card)
    setIsHeaderModalOpen(true)
  }

  const handleSaveCardHeader = async (data: Partial<BinCardType>) => {
    if (editingCard) {
      const updated = await updateBinCard(editingCard.id, data)
      setCards(prev => prev.map(c => c.id === editingCard.id ? updated : c))
    } else {
      const created = await createBinCard({
        cardNo: data.cardNo || "BC-2026-001",
        productId: data.productId,
        description: data.description || "Veterinary Drug Item",
        dosage: data.dosage || "100ml Vial",
        unit: data.unit || "Vial",
        shelfNo: data.shelfNo || "Shelf A-01",
        entries: []
      })
      setCards(prev => [...prev, created])
    }
    setIsHeaderModalOpen(false)
  }

  const handleDeleteCard = async (id: string) => {
    await deleteBinCard(id)
    setCards(prev => prev.filter(c => c.id !== id))
    setIsHeaderModalOpen(false)
  }

  // Entry Handlers
  const handleOpenAddEntry = (card: BinCardType) => {
    setTargetCardForEntry(card)
    setEditingEntry(null)
    setIsEntryModalOpen(true)
  }

  const handleOpenEditEntry = (card: BinCardType, entry: BinCardEntry) => {
    setTargetCardForEntry(card)
    setEditingEntry(entry)
    setIsEntryModalOpen(true)
  }

  const handleSaveEntry = async (entryData: Omit<BinCardEntry, "id" | "balance">) => {
    if (!targetCardForEntry) return
    const currentEntries = targetCardForEntry.entries || []
    let updatedEntries: BinCardEntry[] = []

    if (editingEntry) {
      updatedEntries = currentEntries.map(e => e.id === editingEntry.id ? { ...entryData, id: editingEntry.id, balance: 0 } : e)
    } else {
      const newEntry: BinCardEntry = {
        ...entryData,
        id: `e-${Date.now()}`,
        balance: 0
      }
      updatedEntries = [...currentEntries, newEntry]
    }

    const updatedCard = await updateBinCard(targetCardForEntry.id, { entries: updatedEntries })
    setCards(prev => prev.map(c => c.id === targetCardForEntry.id ? updatedCard : c))
    setIsEntryModalOpen(false)
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!targetCardForEntry) return
    const updatedEntries = (targetCardForEntry.entries || []).filter(e => e.id !== entryId)
    const updatedCard = await updateBinCard(targetCardForEntry.id, { entries: updatedEntries })
    setCards(prev => prev.map(c => c.id === targetCardForEntry.id ? updatedCard : c))
    setIsEntryModalOpen(false)
  }

  // Print Handler
  const handleOpenPrintModal = (card: BinCardType) => {
    setPrintCard(card)
    setIsPrintModalOpen(true)
  }

  // Batch options across all cards
  const allBatches = useMemo(() => {
    return Array.from(new Set(cards.flatMap(c => (c.entries || []).map(e => e.batchNo)))).filter(Boolean)
  }, [cards])

  const batchFilterOptions = useMemo(() => {
    return [
      { label: `All Batches (${allBatches.length})`, value: "ALL" },
      ...allBatches.map(b => ({ label: `Batch ${b}`, value: b }))
    ]
  }, [allBatches])

  return (
    <div className="min-h-screen page-gradient">
      {/* 1. Global Floating Nav */}
      <FloatingNav brand="HKC Trading" sections={navSections} />

      <div className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        
        {/* 2. Header Section (Title on left, SubPageNav positioned on RIGHT!) */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Bin Card</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Manage veterinary drug stock movement ledgers, shelf bin records, and official import stock cards.
            </p>
          </div>
          
          {/* Sub-Navigation Tabs positioned on the RIGHT side */}
          <div className="flex flex-wrap items-center gap-3 self-end md:self-start">
            <SubPageNav items={getSectionChildren("/inventory")} />
          </div>
        </div>

        {/* 3. GlassCard Master Table Wrapper (Matching Stock Register WH1) */}
        <GlassCard className="flex flex-col overflow-hidden p-0 border border-white/65 shadow-md">
          <div className="px-6 pt-6">
            <FinanceTableToolbar
              title="Bin Stock Register"
              subtitle={`Total: ${cards.length} bin cards registered`}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search card no, item description, batch..."
              filters={[
                {
                  value: selectedBatchFilter,
                  onChange: setSelectedBatchFilter,
                  ariaLabel: "Filter by Batch",
                  options: batchFilterOptions,
                },
              ]}
              actions={[
                {
                  label: "Add Bin Card",
                  onClick: handleOpenAddCard,
                  icon: <Plus className="size-4" />,
                  variant: "primary",
                },
              ]}
            />
          </div>

          {/* Expandable Resizable Bin Card Table */}
          <BinCardTable
            cards={cards}
            isLoading={isLoading}
            searchQuery={searchQuery}
            selectedBatchFilter={selectedBatchFilter}
            onAddEntry={handleOpenAddEntry}
            onEditCard={handleOpenEditCard}
            onPrintCard={handleOpenPrintModal}
            onEditEntry={handleOpenEditEntry}
          />
        </GlassCard>

      </div>

      {/* 4. Modals */}
      <BinCardHeaderModal
        isOpen={isHeaderModalOpen}
        card={editingCard}
        products={products}
        onClose={() => setIsHeaderModalOpen(false)}
        onSave={handleSaveCardHeader}
        onDelete={handleDeleteCard}
      />

      <BinCardEntryModal
        isOpen={isEntryModalOpen}
        cardTitle={targetCardForEntry ? `${targetCardForEntry.cardNo} - ${targetCardForEntry.description}` : ""}
        unit={targetCardForEntry?.unit || "Units"}
        entry={editingEntry}
        onClose={() => setIsEntryModalOpen(false)}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />

      <BinCardPrintModal
        isOpen={isPrintModalOpen}
        card={printCard}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  )
}
