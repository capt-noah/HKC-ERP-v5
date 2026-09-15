import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Search } from "lucide-react"
import { useFinanceStore } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import { BodyScrollLock } from "@/components/ui/BodyScrollLock"
import { LoadingDots } from "@/components/ui/LoadingDots"

interface AddCustomMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (ruleId: string) => void
}

const CATEGORIES = [
  "Sales & Revenue",
  "Purchasing & AP",
  "Inventory & COGS",
  "Payroll & HR",
  "Expenses & Taxes",
  "Banking & Treasury",
  "Custom Rules",
]

export default function AddCustomMappingModal({ isOpen, onClose, onSuccess }: AddCustomMappingModalProps) {
  const store = useFinanceStore()
  const { showToast } = useFeedback()
  const accounts = store.getAccounts().filter((a) => !a.is_group && a.is_active)

  const [label, setLabel] = useState("")
  const [category, setCategory] = useState("Custom Rules")
  const [normalPosting, setNormalPosting] = useState<"Debit" | "Credit">("Debit")
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [description, setDescription] = useState("")
  const [accountSearch, setAccountSearch] = useState("")
  const [accountTypeFilter, setAccountTypeFilter] = useState("All")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const filteredAccounts = accounts.filter((a) => {
    if (accountTypeFilter !== "All" && a.account_type !== accountTypeFilter) return false
    if (!accountSearch.trim()) return true
    const term = accountSearch.toLowerCase()
    return a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term) || a.account_type.toLowerCase().includes(term)
  })

  const selectedAcc = accounts.find((a) => a.id === selectedAccountId || a.code === selectedAccountId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) {
      showToast("Validation Error", "warning", "Please provide a descriptive rule name.")
      return
    }
    if (!selectedAccountId) {
      showToast("Validation Error", "warning", "Please select an account from the Chart of Accounts.")
      return
    }

    setIsSubmitting(true)
    try {
      const created = await store.addGlMapping({
        label: label.trim(),
        category,
        account_id: selectedAccountId,
        normal_posting: normalPosting,
        description: description.trim(),
      })

      if (created) {
        showToast("Mapping Rule Created", "success", `Successfully added rule "${created.label}".`)
        onSuccess(created.id)
        onClose()
      } else {
        showToast("Creation Failed", "warning", "Could not create the mapping rule.")
      }
    } catch (err) {
      showToast("Error", "warning", err instanceof Error ? err.message : "Failed to add mapping rule.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <BodyScrollLock />
        <motion.div
          className="absolute inset-0 bg-black/35 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto no-scrollbar rounded-3xl bg-white p-6 shadow-2xl"
        >
          {/* Header matching EditModalHeader style */}
          <div className="flex items-start justify-between mb-4 pb-2 border-b border-zinc-100">
            <div>
              <h2 className="text-xl font-black text-zinc-950 tracking-tight">
                Add Custom Mapping Rule
              </h2>
              <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                Define a custom operational transaction posting rule linking business events to the Chart of Accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors active:scale-95"
              title="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rule Label */}
            <div>
              <label className="block text-xs font-black text-zinc-900 mb-1.5">
                Rule Name / Business Event <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Special Coffee Export Revenue"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
            </div>

            {/* Category & Normal Posting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-zinc-900 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-900 mb-1.5">
                  Normal Posting
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNormalPosting("Debit")}
                    className={`py-2 px-3 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      normalPosting === "Debit"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    Debit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNormalPosting("Credit")}
                    className={`py-2 px-3 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      normalPosting === "Credit"
                        ? "bg-blue-50 text-blue-800 border-blue-300 shadow-2xs"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    Credit (-)
                  </button>
                </div>
              </div>
            </div>

            {/* Assigned Account Selection */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="block text-xs font-black text-zinc-900">
                Assigned General Ledger Account <span className="text-rose-500">*</span>
              </label>

              {selectedAcc ? (
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <code className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                      {selectedAcc.code}
                    </code>
                    <div>
                      <p className="text-xs font-black text-emerald-950">{selectedAcc.name}</p>
                      <span className="text-[10px] font-semibold text-emerald-700 uppercase">
                        {selectedAcc.account_type} {selectedAcc.peachtree_type ? `• ${selectedAcc.peachtree_type}` : ""}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                    <Check className="size-4" /> Selected
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 font-medium">
                  Select an account from the Chart of Accounts list below.
                </div>
              )}

              {/* Account Search & Filter */}
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="Search accounts by code, name, or type..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {["All", "Asset", "Liability", "Equity", "Revenue", "Expense"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAccountTypeFilter(type)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        accountTypeFilter === type
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                  {filteredAccounts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400 font-bold">
                      No accounts found matching &quot;{accountSearch}&quot;
                    </div>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const isSelected = acc.id === selectedAccountId
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setSelectedAccountId(acc.id)}
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

            {/* Description */}
            <div>
              <label className="block text-xs font-black text-zinc-900 mb-1.5">
                Description / Operational Note (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain why and when this account is used in operational workflows..."
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
              />
            </div>

            {/* Modal Footer matching Sales Issue */}
            <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-black hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedAccountId}
                className="h-10 min-w-[90px] inline-flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed px-5 text-xs font-black text-white transition-colors cursor-pointer"
              >
                {isSubmitting ? <LoadingDots color="bg-white" size="sm" /> : "Save Rule"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
