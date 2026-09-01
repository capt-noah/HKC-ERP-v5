import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus } from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { navSections } from "@/lib/nav-config"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import type { HkcDocRecord } from "@/lib/erpStore"
import { loadHkcDocRecords } from "@/lib/hkcDocsApi"
import HkcDocsTable from "@/components/hkcDocs/HkcDocsTable"
import HkcDocAddModal from "@/components/hkcDocs/HkcDocAddModal"
import HkcDocEditModal from "@/components/hkcDocs/HkcDocEditModal"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

export default function HkcDocs() {
  const [records, setRecords] = useState<HkcDocRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "Import" | "Export">("ALL")
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<HkcDocRecord | null>(null)

  const fetchRecords = async () => {
    setIsLoading(true)
    try {
      const data = await loadHkcDocRecords()
      setRecords(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchRecords()
  }, [])

  const handleSaveSuccess = (record: HkcDocRecord) => {
    // If it's a new record (not existing in state), add it; otherwise update it
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === record.id)
      if (exists) {
        return prev.map((r) => (r.id === record.id ? record : r))
      }
      return [record, ...prev]
    })
  }

  const handleDeleteSuccess = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div 
        variants={fade} 
        initial="hidden" 
        animate="visible" 
        className="max-w-[98%] mx-auto px-3 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">HKC Docs Control Center</h1>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Registry for tracking shipping documents, certificates, and license paperwork for import and export operations.
            </p>
          </div>
        </div>

        {/* Standalone Table Container */}
        <GlassCard className="flex flex-col overflow-hidden p-0 border border-white/65 shadow-md">
          <div className="px-4 sm:px-6 pt-4 sm:pt-6">
            <FinanceTableToolbar
              title="HKC Docs Register"
              subtitle={`Total: ${records.length} records in registry`}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search shipment ID, items description..."
              filters={[
                {
                  value: typeFilter,
                  onChange: (val) => setTypeFilter(val as any),
                  ariaLabel: "Filter by Type",
                  options: [
                    { value: "ALL", label: "All Shipments" },
                    { value: "Import", label: "Import Shipments" },
                    { value: "Export", label: "Export Shipments" },
                  ],
                },
              ]}
              actions={[
                {
                  label: "Add Record",
                  onClick: () => setIsAddModalOpen(true),
                  icon: <Plus className="size-4" />,
                  variant: "primary",
                },
              ]}
            />
          </div>

          <HkcDocsTable
            records={records}
            isLoading={isLoading}
            searchQuery={searchQuery}
            typeFilter={typeFilter}
            onEditRecord={setEditingRecord}
          />
        </GlassCard>

        {/* MODAL: ADD RECORD */}
        <AnimatePresence>
          {isAddModalOpen && (
            <HkcDocAddModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onSaveSuccess={handleSaveSuccess}
            />
          )}
        </AnimatePresence>

        {/* MODAL: EDIT RECORD */}
        <AnimatePresence>
          {editingRecord && (
            <HkcDocEditModal
              record={editingRecord}
              onClose={() => setEditingRecord(null)}
              onSaveSuccess={handleSaveSuccess}
              onDeleteSuccess={handleDeleteSuccess}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
