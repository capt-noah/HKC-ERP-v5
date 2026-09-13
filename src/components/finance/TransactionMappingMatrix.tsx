import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Plus,
  Pencil,
  Lock,
  CheckCircle2,
  Check,
} from "lucide-react"
import { GlassCard } from "@/components/GlassCard"
import { useFinanceStore, type GlAccountMapping } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import AddCustomMappingModal from "@/components/finance/AddCustomMappingModal"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { EditModalHeader } from "@/components/EditModalHeader"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"
import { LoadingDots } from "@/components/ui/LoadingDots"

const CATEGORY_OPTIONS = [
  "All Categories",
  "Sales & Revenue",
  "Purchasing & AP",
  "Inventory & COGS",
  "Payroll & HR",
  "Expenses & Taxes",
  "Banking & Treasury",
  "Custom Rules",
] as const

const CATEGORY_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  "Sales & Revenue": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/50" },
  "Purchasing & AP": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800/50" },
  "Inventory & COGS": { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800/50" },
  "Payroll & HR": { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800/50" },
  "Expenses & Taxes": { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800/50" },
  "Banking & Treasury": { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800/50" },
  "Custom Rules": { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800/50" },
}

const mappingColumns: TableColumn[] = [
  { key: "label", label: "Business Transaction / Event", align: "left" },
  { key: "category", label: "Category", align: "left" },
  { key: "normal_posting", label: "Normal Posting", align: "center" },
  { key: "account_code", label: "Assigned Peachtree Account", align: "left" },
  { key: "is_system_default", label: "Rule Type", align: "center" },
  { key: "_actions", label: "Actions", align: "center", noSort: true },
]

const defaultColWidths: Record<string, number> = {
  label: 290,
  category: 150,
  normal_posting: 125,
  account_code: 280,
  is_system_default: 125,
  _actions: 100,
}

export default function TransactionMappingMatrix() {
  const store = useFinanceStore()
  const { showToast, confirm } = useFeedback()

  const mappings = store.getGlMappings()
  const accounts = store.getAccounts()
  const selectableAccounts = useMemo(
    () => accounts.filter((a) => !a.is_group && a.is_active),
    [accounts]
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories")
  const [statusFilter, setStatusFilter] = useState<"all" | "system" | "custom">("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<GlAccountMapping | null>(null)
  const [editAccountId, setEditAccountId] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editAccountSearch, setEditAccountSearch] = useState("")
  const [editAccountTypeFilter, setEditAccountTypeFilter] = useState<string>("All")
  const [isSaving, setIsSaving] = useState(false)

  // Filtered rules
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      if (selectedCategory !== "All Categories" && m.category !== selectedCategory) {
        return false
      }

      if (statusFilter === "system" && !m.is_system_default) return false
      if (statusFilter === "custom" && m.is_system_default) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesLabel = m.label.toLowerCase().includes(q)
        const matchesDesc = (m.description || "").toLowerCase().includes(q)
        const matchesCode = (m.account_code || "").toLowerCase().includes(q)
        const matchesName = (m.account_name || "").toLowerCase().includes(q)
        const matchesCat = m.category.toLowerCase().includes(q)
        const matchesKey = m.id.toLowerCase().includes(q)
        if (!matchesLabel && !matchesDesc && !matchesCode && !matchesName && !matchesCat && !matchesKey) {
          return false
        }
      }

      return true
    })
  }, [mappings, selectedCategory, statusFilter, searchQuery])

  // Resizable & sortable table hook
  const table = useResizableTable(mappingColumns, filteredMappings, defaultColWidths)
  const sortedMappings = table.sorted()
  const total = sortedMappings.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const paginatedMappings = sortedMappings.slice((page - 1) * pageSize, page * pageSize)

  // Open Edit Modal
  const openEdit = (rule: GlAccountMapping) => {
    setEditingRule(rule)
    setEditAccountId(rule.account_id)
    setEditLabel(rule.label)
    setEditDescription(rule.description || "")
    setEditAccountSearch("")
    setEditAccountTypeFilter("All")
  }

  const closeEdit = () => {
    setEditingRule(null)
    setIsSaving(false)
  }

  // Selected account in edit modal
  const modalSelectedAccount = useMemo(() => {
    if (!editAccountId) return null
    return accounts.find((a) => a.id === editAccountId || a.code === editAccountId) || null
  }, [accounts, editAccountId])

  // Filtered accounts for modal list
  const modalFilteredAccounts = useMemo(() => {
    return selectableAccounts.filter((acc) => {
      if (editAccountTypeFilter !== "All" && acc.account_type !== editAccountTypeFilter) {
        return false
      }
      if (editAccountSearch.trim()) {
        const q = editAccountSearch.toLowerCase()
        return (
          acc.code.toLowerCase().includes(q) ||
          acc.name.toLowerCase().includes(q) ||
          acc.account_type.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [selectableAccounts, editAccountTypeFilter, editAccountSearch])

  // Save changes from Edit Modal
  const handleSaveEdit = async () => {
    if (!editingRule) return
    const selectedAcc = selectableAccounts.find((a) => a.id === editAccountId || a.code === editAccountId)
    if (!selectedAcc) {
      showToast("Validation Error", "warning", "Please select an active, non-group General Ledger account.")
      return
    }

    setIsSaving(true)
    try {
      const success = await store.updateGlMapping(editingRule.id, selectedAcc.id, {
        label: !editingRule.is_system_default && editLabel.trim() ? editLabel.trim() : editingRule.label,
        description: editDescription.trim(),
        updatedBy: "Finance Officer",
      })

      if (success) {
        showToast("Mapping Updated", "success", `Rule "${editingRule.label}" is now linked to [${selectedAcc.code}] ${selectedAcc.name}.`)
        closeEdit()
      } else {
        showToast("Update Failed", "warning", "Failed to save mapping changes.")
      }
    } catch (err) {
      showToast("Update Failed", "warning", err instanceof Error ? err.message : "Failed to update mapping rule.")
    } finally {
      setIsSaving(false)
    }
  }

  // Delete custom rule
  const handleDeleteRule = (rule: GlAccountMapping) => {
    if (rule.is_system_default) {
      showToast("Action Prohibited", "warning", "System default accounting rules cannot be deleted.")
      return
    }

    confirm({
      title: "Delete Custom Mapping Rule",
      message: `Are you sure you want to delete custom rule "${rule.label}"? Any workflows depending on it will fall back to default general ledger accounts.`,
      confirmLabel: "Delete Rule",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const success = await store.deleteGlMapping(rule.id)
          if (success) {
            showToast("Rule Deleted", "success", `Custom rule "${rule.label}" has been removed.`)
            if (editingRule?.id === rule.id) {
              closeEdit()
            }
          }
        } catch {
          showToast("Delete Failed", "warning", "Failed to delete the custom mapping rule.")
        }
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Table Container matching Sales Issue page */}
      <GlassCard className="p-0 overflow-hidden border border-white/65 shadow-md">
        <div className="px-6 pt-6">
          <FinanceTableToolbar
            title="Transaction Mappings"
            subtitle={`${filteredMappings.length} posting rules linking business operations to Peachtree General Ledger`}
            searchValue={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val)
              setPage(1)
            }}
            searchPlaceholder="Search event, rule key, or account..."
            filters={[
              {
                value: statusFilter,
                onChange: (val) => {
                  setStatusFilter(val as any)
                  setPage(1)
                },
                ariaLabel: "Filter by rule type",
                options: [
                  { value: "all", label: "All Rules" },
                  { value: "system", label: "System Defaults" },
                  { value: "custom", label: "Custom Rules" },
                ],
              },
              {
                value: selectedCategory,
                onChange: (val) => {
                  setSelectedCategory(val)
                  setPage(1)
                },
                ariaLabel: "Filter by category",
                options: CATEGORY_OPTIONS.map((cat) => ({
                  value: cat,
                  label: cat,
                })),
              },
            ]}
            actions={[
              {
                label: "Add Custom Rule",
                onClick: () => setIsAddModalOpen(true),
                icon: <Plus className="size-4" />,
                variant: "emerald",
              },
            ]}
          />
        </div>

        <TableScrollWrapper>
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-black/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                {mappingColumns.map((col) => (
                  <ResizableTh
                    key={col.key}
                    col={col}
                    width={table.colWidths[col.key] || 120}
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    openMenuCol={table.openMenuCol}
                    onResizeStart={table.handleResizeStart}
                    onToggleMenu={table.toggleMenu}
                    onSortAsc={table.setSortAsc}
                    onSortDesc={table.setSortDesc}
                    onClearSort={table.clearSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {paginatedMappings.length === 0 ? (
                <tr>
                  <td colSpan={mappingColumns.length} className="py-16 text-center text-xs font-bold text-zinc-400">
                    No transaction mapping rules match your filters.
                  </td>
                </tr>
              ) : (
                paginatedMappings.map((rule) => {
                  const badge = CATEGORY_BADGES[rule.category] || CATEGORY_BADGES["Custom Rules"]

                  return (
                    <tr
                      key={rule.id}
                      className="border-b border-zinc-150/40 hover:bg-zinc-50/60 transition-colors text-xs"
                    >
                      {/* Column 1: Business Transaction / Event */}
                      <td style={{ width: `${table.colWidths.label}px` }} className="px-3 py-3 align-middle">
                        <div className="flex flex-col gap-0.5 truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-black text-zinc-950 text-xs truncate">
                              {rule.label}
                            </span>
                          </div>
                          {rule.description && (
                            <span className="text-[11px] text-zinc-500 truncate" title={rule.description}>
                              {rule.description}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-400 truncate">
                            Key: <code className="text-zinc-600">{rule.id}</code>
                          </span>
                        </div>
                      </td>

                      {/* Column 2: Category */}
                      <td style={{ width: `${table.colWidths.category}px` }} className="px-3 py-3 align-middle">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {rule.category}
                        </span>
                      </td>

                      {/* Column 3: Normal Posting */}
                      <td style={{ width: `${table.colWidths.normal_posting}px` }} className="px-3 py-3 text-center align-middle">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            rule.normal_posting === "Debit"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {rule.normal_posting}
                        </span>
                      </td>

                      {/* Column 4: Assigned Peachtree Account */}
                      <td style={{ width: `${table.colWidths.account_code}px` }} className="px-3 py-3 align-middle">
                        <div className="flex flex-col gap-0.5 truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <code className="font-mono font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] border border-emerald-200/80 shrink-0">
                              {rule.account_code}
                            </code>
                            <span className="font-bold text-zinc-800 text-xs truncate" title={rule.account_name}>
                              {rule.account_name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 5: Rule Type / Status */}
                      <td style={{ width: `${table.colWidths.is_system_default}px` }} className="px-3 py-3 text-center align-middle">
                        {!rule.is_system_default ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-200">
                            Custom
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200">
                            System Default
                          </span>
                        )}
                      </td>

                      {/* Column 6: Actions */}
                      <td style={{ width: `${table.colWidths._actions}px` }} className="py-3 px-2 text-center whitespace-nowrap overflow-hidden align-middle">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEdit(rule)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                            title="Edit GL Mapping"
                          >
                            <Pencil className="size-3 text-zinc-700" /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </TableScrollWrapper>

        {/* Pagination Footer matching Sales Issue */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 px-6 py-4 bg-white/40 gap-3">
          <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
            <span>
              Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
            </span>
            <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200">
              <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="bg-transparent text-xs font-bold text-zinc-700 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold disabled:opacity-30 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 text-xs font-bold text-zinc-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold disabled:opacity-30 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* EDIT GL MAPPING MODAL matching Sales Issue Edit Modal design */}
      <AnimatePresence>
        {editingRule && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <BodyScrollLock />
            <motion.div
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeEdit}
            />
            <motion.div
              className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <EditModalHeader
                title={`Edit GL Mapping (${editingRule.label})`}
                subtitle={
                  editingRule.is_system_default
                    ? "System core rule • Automated posting connection to Peachtree General Ledger"
                    : "User-defined custom transaction posting rule"
                }
                onClose={closeEdit}
                onRequestDelete={!editingRule.is_system_default ? () => handleDeleteRule(editingRule) : undefined}
                deleteLabel="Delete Custom Rule"
              />

              <div className="space-y-4">
                {/* Context Metadata Banner */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Rule Key:</span>
                    <code className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-zinc-200 text-zinc-800">
                      {editingRule.id}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        CATEGORY_BADGES[editingRule.category]?.bg || "bg-zinc-100"
                      } ${CATEGORY_BADGES[editingRule.category]?.text || "text-zinc-700"} ${
                        CATEGORY_BADGES[editingRule.category]?.border || "border-zinc-200"
                      }`}
                    >
                      {editingRule.category}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        editingRule.normal_posting === "Debit"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-blue-50 text-blue-800 border-blue-200"
                      }`}
                    >
                      {editingRule.normal_posting}
                    </span>
                  </div>
                </div>

                {/* Rule Label Field */}
                <div>
                  <label className="block text-xs font-black text-zinc-900 mb-1.5">
                    Rule Event Name
                  </label>
                  {editingRule.is_system_default ? (
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        value={editLabel}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-600 cursor-not-allowed pl-9"
                      />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-400 font-semibold mt-1 block">
                        System core rule event names are protected to preserve transaction automation.
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Descriptive transaction rule name..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  )}
                </div>

                {/* Description & Operational Notes */}
                <div>
                  <label className="block text-xs font-black text-zinc-900 mb-1.5">
                    Description & Operational Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Explain what business event triggers this posting..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  />
                </div>

                {/* General Ledger Target Account Selection */}
                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <label className="block text-xs font-black text-zinc-900">
                    Target General Ledger Account
                  </label>

                  {/* Currently Selected Account Banner */}
                  {modalSelectedAccount ? (
                    <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <code className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                          {modalSelectedAccount.code}
                        </code>
                        <div>
                          <p className="text-xs font-black text-emerald-950">{modalSelectedAccount.name}</p>
                          <span className="text-[10px] font-semibold text-emerald-700 uppercase">
                            {modalSelectedAccount.account_type} {modalSelectedAccount.peachtree_type ? `• ${modalSelectedAccount.peachtree_type}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-black">
                        <CheckCircle2 className="size-4 text-emerald-600" /> Selected
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-bold">
                      No account selected. Please pick an account from the list below.
                    </div>
                  )}

                  {/* Account Search & Filter */}
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                      <input
                        type="text"
                        value={editAccountSearch}
                        onChange={(e) => setEditAccountSearch(e.target.value)}
                        placeholder="Search accounts by code, name, or type..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                      />
                    </div>

                    {/* Account Type Filter Chips */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                      {["All", "Asset", "Liability", "Equity", "Revenue", "Expense"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEditAccountTypeFilter(type)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                            editAccountTypeFilter === type
                              ? "bg-zinc-900 text-white"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    {/* Selectable Accounts List (Only active, non-group leaf accounts) */}
                    <div className="max-h-52 overflow-y-auto divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                      {modalFilteredAccounts.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-400 font-bold">
                          No active accounts found matching &quot;{editAccountSearch}&quot;
                        </div>
                      ) : (
                        modalFilteredAccounts.map((acc) => {
                          const isSelected = acc.id === editAccountId || acc.code === editAccountId
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => setEditAccountId(acc.id)}
                              className={`w-full text-left p-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-50 font-bold text-emerald-900"
                                  : "hover:bg-zinc-50 text-zinc-800"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <code
                                  className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                    isSelected
                                      ? "bg-emerald-600 text-white"
                                      : "bg-zinc-100 text-zinc-700"
                                  }`}
                                >
                                  {acc.code}
                                </code>
                                <span className="truncate">{acc.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                                  {acc.account_type}
                                </span>
                                {isSelected && <Check className="size-3.5 text-emerald-600 stroke-[3]" />}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={closeEdit}
                    className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-black hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || !editAccountId}
                    onClick={handleSaveEdit}
                    className="h-10 min-w-[90px] inline-flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed px-5 text-xs font-black text-white transition-colors cursor-pointer"
                  >
                    {isSaving ? <LoadingDots color="bg-white" size="sm" /> : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD CUSTOM MAPPING MODAL */}
      <AddCustomMappingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setSelectedCategory("Custom Rules")
          setSearchQuery("")
        }}
      />
    </div>
  )
}
