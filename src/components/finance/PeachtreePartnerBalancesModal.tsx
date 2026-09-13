import React, { useState, useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import {
  X,
  Users,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
} from "lucide-react"
import { useFinanceStore, type PartnerBeginningBalanceItem } from "@/lib/financeStore"
import { useErpStore } from "@/lib/erpStore"
import { useFeedback } from "@/context/FeedbackContext"
import { LoadingDots } from "@/components/ui/LoadingDots"

interface PeachtreePartnerBalancesModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: "Customer" | "Supplier"
}

interface EditableBalanceRow {
  id: string
  partner_id: string
  partner_name: string
  invoice_number: string
  invoice_date: string
  due_date: string
  amount: string
  terms: string
  notes: string
}

export const PeachtreePartnerBalancesModal: React.FC<PeachtreePartnerBalancesModalProps> = ({
  isOpen,
  onClose,
  initialType = "Customer",
}) => {
  const { showToast, confirm } = useFeedback()
  const financeStore = useFinanceStore()
  const erpStore = useErpStore()

  const [partnerType, setPartnerType] = useState<"Customer" | "Supplier">(initialType)
  const [cutoverDate, setCutoverDate] = useState<string>(`${new Date().getFullYear()}-01-01`)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const customers = useMemo(() => erpStore.getCustomers(), [erpStore])
  const suppliers = useMemo(() => erpStore.getSuppliers(), [erpStore])

  const [rows, setRows] = useState<EditableBalanceRow[]>([])

  useEffect(() => {
    if (!isOpen) return
    setPartnerType(initialType)
  }, [isOpen, initialType])

  useEffect(() => {
    if (!isOpen) return
    const existing = financeStore.getPartnerBeginningBalances(partnerType)
    if (existing.length > 0) {
      setRows(
        existing.map((item, idx) => ({
          id: `row-${idx + 1}-${Date.now()}`,
          partner_id: item.partner_id,
          partner_name: item.partner_name,
          invoice_number: item.invoice_number,
          invoice_date: item.invoice_date,
          due_date: item.due_date,
          amount: String(item.amount),
          terms: item.terms || "Net 30 Days",
          notes: item.notes || "",
        }))
      )
      if (existing[0]?.invoice_date) {
        setCutoverDate(existing[0].invoice_date)
      }
    } else {
      const partnersList = partnerType === "Customer" ? customers : suppliers
      setRows([
        {
          id: `row-1-${Date.now()}`,
          partner_id: partnersList[0]?.id || "",
          partner_name: partnersList[0]?.name || "",
          invoice_number: partnerType === "Customer" ? "INV-HIST-001" : "BILL-HIST-001",
          invoice_date: cutoverDate,
          due_date: cutoverDate,
          amount: "",
          terms: "Net 30 Days",
          notes: "Cutover Beginning Balance",
        },
      ])
    }
  }, [isOpen, partnerType])

  const currentPartners = partnerType === "Customer" ? customers : suppliers
  const controlAccountCode = partnerType === "Customer" ? "1100" : "2000"
  const controlAccountName = partnerType === "Customer" ? "Accounts Receivable (1100)" : "Accounts Payable (2000)"

  const totalEntered = useMemo(() => {
    return rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  }, [rows])

  const glControlBalance = useMemo(() => {
    return financeStore.getControlAccountBalance(controlAccountCode)
  }, [financeStore, controlAccountCode, isOpen])

  const variance = Math.round(Math.abs(totalEntered - glControlBalance) * 100) / 100
  const isReconciled = variance <= 0.01

  const displayedRows = useMemo(() => {
    if (!searchQuery.trim()) return rows
    const q = searchQuery.toLowerCase().trim()
    return rows.filter(
      (r) =>
        r.partner_name.toLowerCase().includes(q) ||
        r.invoice_number.toLowerCase().includes(q) ||
        r.terms.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
    )
  }, [rows, searchQuery])

  const handleAddRow = () => {
    const defaultPartner = currentPartners[0]
    const nextNum = rows.length + 1
    const prefix = partnerType === "Customer" ? "INV-HIST" : "BILL-HIST"
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${nextNum}`,
        partner_id: defaultPartner?.id || "",
        partner_name: defaultPartner?.name || "",
        invoice_number: `${prefix}-${String(nextNum).padStart(3, "0")}`,
        invoice_date: cutoverDate,
        due_date: cutoverDate,
        amount: "",
        terms: "Net 30 Days",
        notes: "Cutover Beginning Balance",
      },
    ])
  }

  const handleUpdateRow = (id: string, field: keyof EditableBalanceRow, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        if (field === "partner_name") {
          const match = currentPartners.find((p) => p.name === value)
          return { ...row, partner_name: value, partner_id: match?.id || row.partner_id }
        }
        if (field === "amount") {
          const clean = value.replace(/[^0-9.]/g, "")
          return { ...row, amount: clean }
        }
        return { ...row, [field]: value }
      })
    )
  }

  const handleRemoveRow = (id: string, name: string) => {
    confirm({
      title: "Remove Row?",
      message: `Remove opening balance line for "${name || "this partner"}"?`,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        setRows((prev) => prev.filter((r) => r.id !== id))
        showToast("Row Removed", "info", "Balance row removed.")
      },
    })
  }

  const handleResetAll = () => {
    confirm({
      title: "Reset All Lines?",
      message: `Are you sure you want to clear all ${partnerType} opening balance lines?`,
      confirmLabel: "Reset All",
      cancelLabel: "Cancel",
      isDestructive: true,
      onConfirm: () => {
        setRows([])
        showToast("Cleared", "info", "All lines cleared.")
      },
    })
  }

  const handleDownloadTemplate = () => {
    const headers = ["Partner Name", "Invoice/Bill Number", "Date", "Due Date", "Terms", "Amount (ETB)", "Notes"]
    const sampleRows = currentPartners.slice(0, 3).map((p, idx) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${partnerType === "Customer" ? "INV-2025" : "BILL-2025"}-00${idx + 1}"`,
      cutoverDate,
      cutoverDate,
      '"Net 30 Days"',
      "50000.00",
      `"Historical ${partnerType} opening balance"`,
    ])

    const csvContent = [headers.join(","), ...sampleRows.map((r) => r.join(","))].join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `peachtree_${partnerType.toLowerCase()}_beginning_balances_template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast("Template Downloaded", "success", "Peachtree CSV template downloaded.")
  }

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      try {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
        if (lines.length < 2) {
          showToast("Import Failed", "warning", "CSV file contains no data rows.")
          return
        }

        const parsedRows: EditableBalanceRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",").map((s) => s.trim().replace(/^"|"$/g, ""))
          if (parts.length >= 6) {
            const partnerName = parts[0]
            const invNo = parts[1]
            const invDate = parts[2] || cutoverDate
            const dueDate = parts[3] || invDate
            const terms = parts[4] || "Net 30 Days"
            const amount = parts[5].replace(/[^0-9.]/g, "")
            const notes = parts[6] || ""

            if (partnerName && invNo && parseFloat(amount) > 0) {
              const match = currentPartners.find((p) => p.name.toLowerCase() === partnerName.toLowerCase())
              parsedRows.push({
                id: `import-${Date.now()}-${i}`,
                partner_id: match?.id || `PARTNER-${Date.now()}-${i}`,
                partner_name: match?.name || partnerName,
                invoice_number: invNo,
                invoice_date: invDate,
                due_date: dueDate,
                terms,
                amount,
                notes,
              })
            }
          }
        }

        if (parsedRows.length === 0) {
          showToast("No Valid Rows", "warning", "Could not find valid non-zero rows in the uploaded CSV.")
          return
        }

        setRows(parsedRows)
        showToast("Import Successful", "success", `Imported ${parsedRows.length} opening balances from CSV.`)
      } catch (err: any) {
        showToast("Parse Error", "warning", err.message || "Failed to parse CSV file.")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleSave = async () => {
    const validRows = rows.filter((r) => r.partner_name.trim() && r.invoice_number.trim() && parseFloat(r.amount) > 0)
    if (validRows.length === 0) {
      showToast("Validation Error", "warning", "Please enter at least one valid opening balance row.")
      return
    }

    setIsSaving(true)
    try {
      const payloadItems: PartnerBeginningBalanceItem[] = validRows.map((r) => ({
        partner_id: r.partner_id,
        partner_name: r.partner_name.trim(),
        partner_type: partnerType,
        invoice_number: r.invoice_number.trim(),
        invoice_date: r.invoice_date || cutoverDate,
        due_date: r.due_date || r.invoice_date || cutoverDate,
        amount: parseFloat(r.amount) || 0,
        terms: r.terms,
        notes: r.notes,
      }))

      const result = financeStore.savePartnerBeginningBalances(partnerType, payloadItems, cutoverDate)
      if (result.success) {
        showToast(
          "Balances Saved",
          "success",
          `Saved ${result.count} ${partnerType} beginning balances totaling ETB ${totalEntered.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
        )
        onClose()
      } else {
        showToast("Save Failed", "warning", result.error || "Could not save partner balances.")
      }
    } catch (err: any) {
      showToast("Error", "warning", err.message || "Failed to save partner balances.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-6xl max-h-[92vh] bg-white dark:bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col"
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <Users className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white">
                Maintain {partnerType === "Customer" ? "Customer" : "Vendor"} Beginning Balances
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Enter historical unpaid invoices/bills to establish A/R & A/P sub-ledger aging cutover.
              </p>
            </div>
          </div>

          {/* Type Switcher & Action Tools */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-zinc-200/70 dark:bg-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setPartnerType("Customer")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  partnerType === "Customer"
                    ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Customers (A/R)
              </button>
              <button
                type="button"
                onClick={() => setPartnerType("Supplier")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  partnerType === "Supplier"
                    ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Vendors (A/P)
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Download CSV template"
            >
              <Download className="size-3.5 text-zinc-500" />
              <span className="hidden sm:inline">CSV Template</span>
            </button>

            <label className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
              <Upload className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Import CSV</span>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvImport}
              />
            </label>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer ml-1"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                Cutover Date:
              </span>
              <input
                type="date"
                value={cutoverDate}
                onChange={(e) => setCutoverDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <Plus className="size-3.5" />
              <span>Add Line</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search partner, invoice #..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline px-2 py-0.5 cursor-pointer shrink-0"
              >
                Reset All
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 bg-zinc-50/40 dark:bg-zinc-950">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                <th className="py-2.5 px-3 min-w-[220px]">{partnerType} Name</th>
                <th className="py-2.5 px-3 w-36">Invoice / Bill #</th>
                <th className="py-2.5 px-3 w-32">Invoice Date</th>
                <th className="py-2.5 px-3 w-32">Due Date</th>
                <th className="py-2.5 px-3 w-32">Terms</th>
                <th className="py-2.5 px-3 w-36 text-right">Amount (ETB)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {displayedRows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 transition-colors">
                  {/* Partner Selector */}
                  <td className="py-2 px-3">
                    <select
                      value={row.partner_name}
                      onChange={(e) => handleUpdateRow(row.id, "partner_name", e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
                    >
                      {currentPartners.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Invoice / Bill # */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.invoice_number}
                      onChange={(e) => handleUpdateRow(row.id, "invoice_number", e.target.value)}
                      placeholder="INV-001"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500"
                    />
                  </td>

                  {/* Invoice Date */}
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      value={row.invoice_date}
                      onChange={(e) => handleUpdateRow(row.id, "invoice_date", e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 cursor-pointer"
                    />
                  </td>

                  {/* Due Date */}
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      value={row.due_date}
                      onChange={(e) => handleUpdateRow(row.id, "due_date", e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500 cursor-pointer"
                    />
                  </td>

                  {/* Terms */}
                  <td className="py-2 px-3">
                    <select
                      value={row.terms}
                      onChange={(e) => handleUpdateRow(row.id, "terms", e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none focus:border-emerald-500"
                    >
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Cash on Delivery">Cash on Delivery</option>
                      <option value="Net 15 Days">Net 15 Days</option>
                      <option value="Net 60 Days">Net 60 Days</option>
                      <option value="Due on Receipt">Due on Receipt</option>
                    </select>
                  </td>

                  {/* Amount */}
                  <td className="py-2 px-3 text-right">
                    <input
                      type="text"
                      value={row.amount}
                      onChange={(e) => handleUpdateRow(row.id, "amount", e.target.value)}
                      placeholder="0.00"
                      className="w-full text-right px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </td>

                  {/* Remove Row */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id, row.partner_name)}
                      className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {displayedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 font-semibold text-xs">
                    No balance entries found. Click &quot;Add Line&quot; or &quot;Import CSV&quot; to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Control Account Tie-Out Bar */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-white shrink-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Totals & Reconciliation Status */}
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Total Sub-Ledger Balances
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                  ETB {totalEntered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  GL Control: {controlAccountName}
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-purple-400">
                  ETB {glControlBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Status Indicator */}
              <div className="pl-2 border-l border-zinc-700">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Reconciliation Status
                </span>
                {isReconciled ? (
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                    <CheckCircle2 className="size-4" />
                    <span>In Perfect Balance with GL</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                    <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                    <span>Variance: ETB {variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vs GL</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || rows.length === 0}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black inline-flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer active:scale-95"
              >
                {isSaving ? (
                  <>
                    <LoadingDots color="bg-white" size="sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>Save {partnerType} Balances</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default PeachtreePartnerBalancesModal
