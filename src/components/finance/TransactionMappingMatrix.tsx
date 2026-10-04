import { useState, useMemo } from "react"
import {
  Plus,
  Pencil,
  Lock,
  Trash2,
  Building,
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
import COAAccountSelector from "@/components/finance/COAAccountSelector"

const CATEGORY_OPTIONS = [
  "All Categories",
  "Sales & Revenue",
  "Purchasing & AP",
  "Inventory & COGS",
  "Payroll & HR",
  "Taxes & Statutory",
  "Cash & Bank Accounts",
  "Custom Rules",
] as const

const CATEGORY_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  "Sales & Revenue": { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  "Purchasing & AP": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  "Inventory & COGS": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
  "Payroll & HR": { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  "Taxes & Statutory": { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
  "Expenses & Taxes": { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
  "Cash & Bank Accounts": { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
  "Banking & Treasury": { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
  "Custom Rules": { bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-200" },
}

const getScopeBadge = (mapping: GlAccountMapping) => {
  const scope = mapping.warehouse_scope || "ALL"
  const itemType = mapping.item_type || "ALL"

  if (scope === "EXPORT") {
    let cropLabel = "Export (WH1)"
    if (itemType === "GREEN_MUNG") cropLabel = "WH1 Export • Green Mung"
    else if (itemType === "SESAME") cropLabel = "WH1 Export • Sesame Seed"
    else if (itemType === "SOYA") cropLabel = "WH1 Export • Soya Bean"
    return { label: cropLabel, bg: "bg-amber-100 text-amber-900 border-amber-300" }
  }
  if (scope === "IMPORT" || itemType === "VET_PHARMA") {
    return { label: "WH2/WH3 • Vet Pharma", bg: "bg-purple-100 text-purple-900 border-purple-300" }
  }
  return { label: "All Operations", bg: "bg-zinc-100 text-zinc-700 border-zinc-200" }
}

const mappingColumns: TableColumn[] = [
  { key: "label", label: "Business Transaction / Event", align: "left" },
  { key: "category", label: "Category", align: "left" },
  { key: "scope", label: "Operational Scope", align: "left" },
  { key: "normal_posting", label: "Normal Posting", align: "center" },
  { key: "account_code", label: "Assigned General Ledger Account", align: "left" },
  { key: "is_system_default", label: "Rule Type", align: "center" },
  { key: "_actions", label: "Actions", align: "center", noSort: true },
]

const defaultColWidths: Record<string, number> = {
  label: 280,
  category: 140,
  scope: 170,
  normal_posting: 120,
  account_code: 280,
  is_system_default: 120,
  _actions: 90,
}

export default function TransactionMappingMatrix() {
  const store = useFinanceStore()
  const { showToast, confirm } = useFeedback()

  const mappings = store.getGlMappings()
  const accounts = store.getAccounts()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories")
  const [statusFilter, setStatusFilter] = useState<"all" | "system" | "custom">("all")
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "IMPORT" | "EXPORT">("ALL")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<GlAccountMapping | null>(null)
  const [editAccountId, setEditAccountId] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editWarehouseScope, setEditWarehouseScope] = useState<"ALL" | "IMPORT" | "EXPORT">("ALL")
  const [editItemType, setEditItemType] = useState<"ALL" | "GREEN_MUNG" | "SESAME" | "SOYA" | "VET_PHARMA">("ALL")
  const [editMultiAccounts, setEditMultiAccounts] = useState<GlAccountMapping["multi_accounts"]>([])
  const [enableMultiAccountsInEdit, setEnableMultiAccountsInEdit] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Filtered rules
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      if (selectedCategory !== "All Categories" && m.category !== selectedCategory) {
        return false
      }

      if (statusFilter === "system" && !m.is_system_default) return false
      if (statusFilter === "custom" && m.is_system_default) return false

      if (scopeFilter !== "ALL" && m.warehouse_scope && m.warehouse_scope !== scopeFilter && m.warehouse_scope !== "ALL") {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesLabel = (m.label || "").toLowerCase().includes(q)
        const matchesDesc = (m.description || "").toLowerCase().includes(q)
        const matchesCode = (m.account_code || "").toLowerCase().includes(q)
        const matchesName = (m.account_name || "").toLowerCase().includes(q)
        const matchesCat = (m.category || "").toLowerCase().includes(q)
        const matchesKey = (m.id || "").toLowerCase().includes(q)
        if (!matchesLabel && !matchesDesc && !matchesCode && !matchesName && !matchesCat && !matchesKey) {
          return false
        }
      }

      return true
    })
  }, [mappings, selectedCategory, statusFilter, scopeFilter, searchQuery])

  // Resizable table hook
  const table = useResizableTable(mappingColumns, filteredMappings, defaultColWidths)
  const sortedMappings = table.sorted()
  const total = sortedMappings.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const paginatedMappings = sortedMappings.slice((page - 1) * pageSize, page * pageSize)

  // Open Edit Modal
  const openEdit = (rule: GlAccountMapping) => {
    setEditingRule(rule)
    setEditAccountId(rule.account_id || rule.account_code)
    setEditLabel(rule.label)
    setEditDescription(rule.description || "")
    setEditWarehouseScope(rule.warehouse_scope || "ALL")
    setEditItemType(rule.item_type || "ALL")
    const pool = rule.multi_accounts || []
    setEditMultiAccounts(pool)
    setEnableMultiAccountsInEdit(pool.length > 1)
  }

  const closeEdit = () => {
    setEditingRule(null)
    setIsSaving(false)
  }

  // Save changes from Edit Modal
  const handleSaveEdit = async () => {
    if (!editingRule) return
    const selectedAcc = accounts.find((a) => a.id === editAccountId || a.code === editAccountId)
    if (!selectedAcc) {
      showToast("Validation Error", "warning", "Please select a valid Chart of Accounts ledger.")
      return
    }

    setIsSaving(true)
    try {
      const multiAccountsToSave = enableMultiAccountsInEdit && editMultiAccounts && editMultiAccounts.length > 0
        ? editMultiAccounts
        : [
            {
              account_id: selectedAcc.id,
              account_code: selectedAcc.code,
              account_name: selectedAcc.name,
              is_default: true,
            },
          ]

      const success = await store.updateGlMapping(editingRule.id, selectedAcc.id, {
        label: !editingRule.is_system_default && editLabel.trim() ? editLabel.trim() : editingRule.label,
        description: editDescription.trim(),
        warehouse_scope: editWarehouseScope,
        item_type: editWarehouseScope === "EXPORT" ? editItemType : (editWarehouseScope === "IMPORT" ? "VET_PHARMA" : "ALL"),
        multi_accounts: multiAccountsToSave,
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
      <GlassCard className="p-0 overflow-hidden border border-white/65 shadow-md">
        <div className="px-6 pt-6">
          <FinanceTableToolbar
            title="Transaction Mappings"
            subtitle={`${filteredMappings.length} posting rules linking business operations to General Ledger Chart of Accounts`}
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
              {
                value: scopeFilter,
                onChange: (val) => {
                  setScopeFilter(val as any)
                  setPage(1)
                },
                ariaLabel: "Filter by warehouse scope",
                options: [
                  { value: "ALL", label: "All Scopes" },
                  { value: "IMPORT", label: "Import Scope" },
                  { value: "EXPORT", label: "Export Scope (WH1)" },
                ],
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
                  const scope = getScopeBadge(rule)
                  const hasMulti = Boolean(rule.multi_accounts && rule.multi_accounts.length > 1)

                  return (
                    <tr
                      key={rule.id}
                      className="border-b border-zinc-150/40 hover:bg-zinc-50/60 transition-colors text-xs"
                    >
                      {/* Column 1: Business Transaction / Event */}
                      <td style={{ width: `${table.colWidths.label}px` }} className="px-3 py-3 align-middle">
                        <span className="font-bold text-zinc-950 text-xs truncate block" title={rule.label}>
                          {rule.label}
                        </span>
                      </td>

                      {/* Column 2: Category */}
                      <td style={{ width: `${table.colWidths.category}px` }} className="px-3 py-3 align-middle">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {rule.category}
                        </span>
                      </td>

                      {/* Column 3: Operational Scope */}
                      <td style={{ width: `${table.colWidths.scope}px` }} className="px-3 py-3 align-middle">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${scope.bg}`}
                        >
                          {scope.label}
                        </span>
                      </td>

                      {/* Column 4: Normal Posting */}
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

                      {/* Column 5: Assigned Peachtree Account */}
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
                          {hasMulti && (
                            <span className="text-[10px] font-bold text-zinc-500">
                              +{rule.multi_accounts!.length - 1} settlement accounts in pool
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 6: Rule Type / Status */}
                      <td style={{ width: `${table.colWidths.is_system_default}px` }} className="px-3 py-3 text-center align-middle">
                        {!rule.is_system_default ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-200">
                            Custom
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200">
                            System Core
                          </span>
                        )}
                      </td>

                      {/* Column 7: Actions */}
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

        {/* Pagination Footer */}
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

      {/* EDIT GL MAPPING MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <BodyScrollLock />
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeEdit}
          />
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200"
          >
            <EditModalHeader
              title="Edit Transaction Mapping"
              subtitle={editingRule.label}
              onClose={closeEdit}
              onRequestDelete={!editingRule.is_system_default ? () => handleDeleteRule(editingRule) : undefined}
              deleteLabel="Delete Custom Rule"
            />

            <div className="space-y-4">
              {/* Context Metadata Banner */}
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/90 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-700">Posting Configuration</span>
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
                  Rule Name
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

              {/* Warehouse Scope & Commodity Selection */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Building className="size-4 text-zinc-600" />
                  <span className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                    Operational Scope
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Warehouse Scope
                    </label>
                    <select
                      value={editWarehouseScope}
                      onChange={(e) => setEditWarehouseScope(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                    >
                      <option value="ALL">All Warehouses</option>
                      <option value="IMPORT">Import Warehouse (WH2/WH3 - Pharma)</option>
                      <option value="EXPORT">Export Warehouse (WH1 - Crops)</option>
                    </select>
                  </div>

                  {editWarehouseScope === "EXPORT" && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Commodity / Crop Type
                      </label>
                      <select
                        value={editItemType}
                        onChange={(e) => setEditItemType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                      >
                        <option value="ALL">All Export Commodities</option>
                        <option value="GREEN_MUNG">Green Mung Bean</option>
                        <option value="SESAME">Reddish Sesame Seed</option>
                        <option value="SOYA">Soya Bean</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary Target Account Selection */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-black text-zinc-900">
                  Target General Ledger Account
                </label>
                <COAAccountSelector
                  value={editAccountId}
                  onChange={(acc) => setEditAccountId(acc.id || acc.code)}
                  placeholder="Select General Ledger account..."
                  required
                />
              </div>

              {/* Multi-Account Pool Management */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-zinc-900 block">
                      Multi-Account Settlement Pool
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Configure multiple bank/cash accounts for user selection during settlements.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableMultiAccountsInEdit}
                      onChange={(e) => {
                        setEnableMultiAccountsInEdit(e.target.checked)
                        if (e.target.checked && (!editMultiAccounts || editMultiAccounts.length === 0)) {
                          const primaryAcc = accounts.find((a) => a.id === editAccountId || a.code === editAccountId)
                          if (primaryAcc) {
                            setEditMultiAccounts([
                              {
                                account_id: primaryAcc.id,
                                account_code: primaryAcc.code,
                                account_name: primaryAcc.name,
                                is_default: true,
                              },
                            ])
                          }
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {enableMultiAccountsInEdit && (
                  <div className="space-y-2 pt-2 border-t border-zinc-200">
                    <COAAccountSelector
                      value=""
                      onChange={(acc) => {
                        if (!editMultiAccounts?.some((m) => m.account_code === acc.code)) {
                          setEditMultiAccounts((prev) => [
                            ...(prev || []),
                            {
                              account_id: acc.id,
                              account_code: acc.code,
                              account_name: acc.name,
                              is_default: (prev || []).length === 0,
                            },
                          ])
                        }
                      }}
                      placeholder="Add account to pool..."
                      compact
                    />

                    <div className="space-y-1.5">
                      {(editMultiAccounts || []).map((ma) => (
                        <div
                          key={ma.account_code}
                          className="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <code className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                              {ma.account_code}
                            </code>
                            <span className="font-bold text-zinc-900">{ma.account_name}</span>
                            {ma.is_default && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-white">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {!ma.is_default && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditMultiAccounts((prev) =>
                                    (prev || []).map((m) => ({
                                      ...m,
                                      is_default: m.account_code === ma.account_code,
                                    }))
                                  )
                                }}
                                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 px-1.5 py-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                              >
                                Set Default
                              </button>
                            )}
                            {(editMultiAccounts || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditMultiAccounts((prev) =>
                                    (prev || []).filter((m) => m.account_code !== ma.account_code)
                                  )
                                }}
                                className="text-zinc-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description & Operational Notes */}
              <div>
                <label className="block text-xs font-black text-zinc-900 mb-1.5">
                  Description / Operational Notes
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Explain what business event triggers this posting..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
                />
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
                  className="h-10 min-w-[90px] inline-flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed px-5 text-xs font-black text-white transition-colors cursor-pointer shadow-sm"
                >
                  {isSaving ? <LoadingDots color="bg-white" size="sm" /> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
