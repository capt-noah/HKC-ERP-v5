import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2,
  Download,
  Check,
  RotateCcw,
  Eye,
  FileText,
  Paperclip,
  Building2,
  Receipt,
  X,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore } from "@/lib/financeStore"
import { useResizableTable, ResizableTh, type TableColumn } from "@/components/ResizableTable"
import { FinanceTableToolbar } from "@/components/FinanceTableToolbar"
import { exportToExcel } from "@/lib/exportUtils"
import { isDateInPreset } from "@/lib/peachtreeExportUtils"
import { Skeleton } from "@/components/ui/skeleton"
import { TableScrollWrapper } from "@/components/TableScrollWrapper"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { fetchTradeAndAdviceDocs, type ShipmentDocAttachment } from "@/lib/tradeDocumentService"

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

interface BankStatementLine {
  id: string
  journalEntryId: string
  accountId: string
  accountName: string
  accountCode: string
  date: string
  reference: string
  sourceType: string
  sourceId: string | null
  payee: string
  type: "Deposit" | "Withdrawal"
  amount: number
  isCleared: boolean
  clearedDate?: string
}

export default function Banking() {
  const { showToast } = useFeedback()
  const store = useFinanceStore()
  const isLoading = store.isLoading()

  const [clearedLineIds, setClearedLineIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("hkc_reconciled_bank_line_ids")
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [confirmingLine, setConfirmingLine] = useState<BankStatementLine | null>(null)
  const [viewingLine, setViewingLine] = useState<BankStatementLine | null>(null)
  const [viewingDocs, setViewingDocs] = useState<ShipmentDocAttachment[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [previewDocUrl, setPreviewDocUrl] = useState("")
  const [previewDocName, setPreviewDocName] = useState("")

  const [bankSearch, setBankSearch] = useState("")
  const [bankDateFilter, setBankDateFilter] = useState("ALL")
  const [bankCustomStart, setBankCustomStart] = useState("")
  const [bankCustomEnd, setBankCustomEnd] = useState("")
  const [bankStatusFilter, setBankStatusFilter] = useState("ALL")
  const [bankTypeFilter, setBankTypeFilter] = useState("ALL")

  const accounts = store.getAccounts()
  const entries = store.getJournalEntries()
  const lines = store.getJournalEntryLines()
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))

  // Hydrate local set from database journal_entry_lines so data persists across PCs & cache wipes
  useEffect(() => {
    const dbClearedIds = lines.filter((l) => l.is_cleared).map((l) => l.id)
    if (dbClearedIds.length > 0) {
      setClearedLineIds((prev) => {
        let hasNew = false
        const next = new Set(prev)
        dbClearedIds.forEach((id) => {
          if (!next.has(id)) {
            next.add(id)
            hasNew = true
          }
        })
        if (hasNew) {
          try {
            localStorage.setItem("hkc_reconciled_bank_line_ids", JSON.stringify(Array.from(next)))
          } catch {}
        }
        return next
      })
    }
  }, [lines])

  const bankLines: BankStatementLine[] = lines.flatMap((line) => {
    const account = accountById.get(line.account_id)
    const entry = entryById.get(line.journal_entry_id)
    if (!account || !entry || account.account_type !== "Asset" || !(account.peachtree_type === "Cash" || account.code.startsWith("1000") || /cash|bank|cbe|boa|aib|abay|unb|cbo|ahadu|oib/i.test(account.name))) return []
    const amount = line.debit_amount || line.credit_amount
    if (!amount) return []
    const isCleared = Boolean(line.is_cleared || clearedLineIds.has(line.id))
    return [{
      id: line.id,
      journalEntryId: entry.id,
      accountId: account.id,
      accountName: account.name,
      accountCode: account.code,
      date: entry.entry_date,
      reference: entry.source_id || entry.id,
      sourceType: entry.source_type || "General Ledger",
      sourceId: entry.source_id,
      payee: line.party_name || entry.description,
      type: line.debit_amount > 0 ? "Deposit" : "Withdrawal",
      amount,
      isCleared,
      clearedDate: line.cleared_date || (isCleared ? new Date().toISOString().slice(0, 10) : undefined),
    }]
  })

  // Lookups for the currently viewed line
  const viewingEntry = viewingLine ? entryById.get(viewingLine.journalEntryId) : null
  const viewingEntryLines = viewingLine
    ? lines.filter((l) => l.journal_entry_id === viewingLine.journalEntryId)
    : []

  const matchedInvoice = viewingLine
    ? store.getInvoices().find(
        (inv) =>
          (viewingLine.sourceId &&
            (inv.id === viewingLine.sourceId ||
              inv.sales_issue_id === viewingLine.sourceId ||
              inv.invoice_number === viewingLine.sourceId ||
              inv.fs_no === viewingLine.sourceId)) ||
          (viewingLine.reference &&
            (inv.id === viewingLine.reference ||
              inv.sales_issue_id === viewingLine.reference ||
              inv.invoice_number === viewingLine.reference ||
              inv.fs_no === viewingLine.reference))
      )
    : null

  const matchedExpense = viewingLine
    ? store.getOneOffExpenses().find(
        (exp) =>
          (viewingLine.sourceId && exp.id === viewingLine.sourceId) ||
          (viewingLine.reference &&
            (exp.id === viewingLine.reference ||
              exp.receipt_ref === viewingLine.reference ||
              exp.cheque_no === viewingLine.reference))
      )
    : null

  const matchedPayments = viewingLine
    ? store.getPayments().filter(
        (p) =>
          (viewingLine.sourceId &&
            (p.id === viewingLine.sourceId ||
              p.linked_invoice_id === viewingLine.sourceId ||
              p.sales_issue_id === viewingLine.sourceId ||
              p.reference?.includes(viewingLine.sourceId))) ||
          (viewingLine.reference &&
            (p.id === viewingLine.reference ||
              p.linked_invoice_id === viewingLine.reference ||
              p.sales_issue_id === viewingLine.reference ||
              p.reference?.includes(viewingLine.reference))) ||
          (matchedInvoice &&
            (p.linked_invoice_id === matchedInvoice.id ||
              p.sales_issue_id === matchedInvoice.sales_issue_id ||
              (matchedInvoice.fs_no && p.reference?.includes(matchedInvoice.fs_no))))
      )
    : []

  useEffect(() => {
    if (!viewingLine) {
      setViewingDocs([])
      return
    }
    let cancelled = false
    setIsLoadingDocs(true)

    const params: {
      customerId?: string
      customerName?: string
      salesOrderId?: string
      salesIssueId?: string
      invoiceId?: string
      fsNo?: string
    } = {}

    if (matchedInvoice) {
      params.invoiceId = matchedInvoice.id
      params.salesIssueId = matchedInvoice.sales_issue_id
      params.salesOrderId = matchedInvoice.sales_order_id
      params.fsNo = matchedInvoice.fs_no
      params.customerName = matchedInvoice.customer_name
    } else if (viewingLine.sourceId) {
      params.salesIssueId = viewingLine.sourceId
      params.invoiceId = viewingLine.sourceId
    }

    fetchTradeAndAdviceDocs(params)
      .then((res) => {
        if (cancelled) return
        const docs = [...(res.allDocs || [])]

        matchedPayments.forEach((p) => {
          if (p.payment_advice_url && !docs.some((d) => d.file_url === p.payment_advice_url)) {
            docs.push({
              id: p.id,
              record_id: p.linked_invoice_id || p.id,
              record_type: "invoice",
              document_type: "Payment Advice",
              file_name: p.payment_advice_filename || `Payment_Advice_${p.reference || p.id}.pdf`,
              file_url: p.payment_advice_url,
              file_size: 102400,
              uploaded_at: p.date,
              uploaded_by: "Cashier / Finance",
            })
          }
        })

        setViewingDocs(docs)
      })
      .catch(() => {
        if (!cancelled) setViewingDocs([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDocs(false)
      })

    return () => {
      cancelled = true
    }
  }, [viewingLine?.id, matchedInvoice?.id])

  const filteredBankLines = bankLines.filter((line) => {
    if (!isDateInPreset(line.date, bankDateFilter, bankCustomStart, bankCustomEnd)) return false
    if (bankStatusFilter === "CLEARED" && !line.isCleared) return false
    if (bankStatusFilter === "UNCLEARED" && line.isCleared) return false
    if (bankTypeFilter !== "ALL" && line.type !== bankTypeFilter) return false
    if (!bankSearch.trim()) return true
    const q = bankSearch.toLowerCase()
    return (
      line.reference.toLowerCase().includes(q) ||
      line.payee.toLowerCase().includes(q) ||
      line.date.includes(q)
    )
  })

  const columns: TableColumn[] = [
    {key:'date',label:'Statement Date'},
    {key:'reference',label:'Bank Reference'},
    {key:'payee',label:'Payee / Description'},
    {key:'type',label:'Type',align:'center'},
    {key:'amount',label:'Amount',align:'right'},
    {key:'isCleared',label:'Status',align:'center'},
    {key:'_actions',label:'Action',align:'right',noSort:true}
  ]

  const { colWidths, sortKey, sortDir, openMenuCol, handleResizeStart, toggleMenu, setSortAsc, setSortDesc, clearSort, sorted } = useResizableTable(columns, filteredBankLines)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [bankSearch, bankStatusFilter, bankTypeFilter, bankDateFilter, filteredBankLines.length])

  const sortedLines = sorted()
  const totalPages = Math.max(1, Math.ceil(sortedLines.length / pageSize))
  const displayedLines = sortedLines.slice((page - 1) * pageSize, page * pageSize)

  const handleConfirmClearSpecific = (line: BankStatementLine) => {
    const today = new Date().toISOString().slice(0, 10)
    // 1. Persist directly to MySQL database via financeStore
    store.setBankLineCleared(line.id, true, today)

    // 2. Also update local state & cache
    setClearedLineIds((prev) => {
      const next = new Set(prev).add(line.id)
      try {
        localStorage.setItem("hkc_reconciled_bank_line_ids", JSON.stringify(Array.from(next)))
      } catch (err) {
        console.error("Failed to save reconciled bank lines", err)
      }
      return next
    })
    showToast("Transaction Cleared", "success", `Bank transaction ${line.reference} cleared and saved to database.`)
    if (confirmingLine?.id === line.id) {
      setConfirmingLine(null)
    }
  }

  const handleConfirmClear = () => {
    if (!confirmingLine) return
    handleConfirmClearSpecific(confirmingLine)
  }

  const handleUnclearBankLine = (id: string, ref: string) => {
    // 1. Update directly in MySQL database via financeStore
    store.setBankLineCleared(id, false)

    // 2. Also update local state & cache
    setClearedLineIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      try {
        localStorage.setItem("hkc_reconciled_bank_line_ids", JSON.stringify(Array.from(next)))
      } catch (err) {
        console.error("Failed to save reconciled bank lines", err)
      }
      return next
    })
    showToast("Transaction Uncleared", "info", `Transaction ${ref} restored to uncleared state in database.`)
  }

  const cashBalance = bankLines.reduce((total, line) => total + (line.type === "Deposit" ? line.amount : -line.amount), 0)
  const clearedBalance = bankLines.filter((line) => line.isCleared).reduce((total, line) => total + (line.type === "Deposit" ? line.amount : -line.amount), 0)

  return (
    <div className="min-h-screen page-gradient text-black">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />
      {store.getLoadError() && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-800 shadow-lg flex items-center gap-3">
            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            Server unavailable — banking data cannot be loaded. {store.getLoadError()}
          </div>
        </div>
      )}

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12"
      >
        {/* Header */}
        <motion.div variants={fade} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Bank Reconciliation</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Reconcile bank statements against general ledger cash accounts and track cleared transactions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </motion.div>

        <motion.div variants={fade} className="flex flex-col gap-4">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-4">
                  <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">GL Cash Ledger Balance</div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <div className="text-xl font-black text-zinc-900 font-mono mt-1">ETB {cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  )}
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Statement Cleared Balance</div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <div className="text-xl font-black text-emerald-600 font-mono mt-1">ETB {clearedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  )}
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Uncleared Difference</div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-36 bg-zinc-200/80 my-1" />
                  ) : (
                    <div className="text-xl font-black text-amber-600 font-mono mt-1">ETB {(cashBalance - clearedBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  )}
                </GlassCard>
              </div>

              {/* Table */}
              <GlassCard className="flex flex-col">
                <FinanceTableToolbar
                  title="Bank Statement Lines"
                  subtitle={`${filteredBankLines.length} statement lines • match and clear against GL cash records`}
                  searchValue={bankSearch}
                  onSearchChange={setBankSearch}
                  searchPlaceholder="Search reference, payee, date..."
                  dateFilter={{
                    value: bankDateFilter,
                    onChange: setBankDateFilter,
                    startDate: bankCustomStart,
                    endDate: bankCustomEnd,
                    onCustomDateChange: (start, end) => {
                      setBankCustomStart(start)
                      setBankCustomEnd(end)
                    },
                  }}
                  filters={[
                    {
                      value: bankStatusFilter,
                      onChange: setBankStatusFilter,
                      ariaLabel: "Clearance status filter",
                      options: [
                        { value: "ALL", label: "All Status" },
                        { value: "CLEARED", label: "Cleared" },
                        { value: "UNCLEARED", label: "Uncleared" },
                      ],
                    },
                    {
                      value: bankTypeFilter,
                      onChange: setBankTypeFilter,
                      ariaLabel: "Transaction type filter",
                      options: [
                        { value: "ALL", label: "All Types" },
                        { value: "Deposit", label: "Deposits" },
                        { value: "Withdrawal", label: "Withdrawals" },
                      ],
                    },
                  ]}
                  actions={[
                    {
                      label: `Export (${filteredBankLines.length})`,
                      onClick: () => {
                        exportToExcel({
                          fileName: `HKC_Bank_Transactions_${new Date().toISOString().split("T")[0]}`,
                          title: "HKC Trading - Bank Statement Transactions",
                          headers: ["Date", "Reference", "Payee / Description", "Type", "Amount (ETB)", "Status", "Cleared Date"],
                          rows: filteredBankLines.map((l) => [
                            l.date,
                            l.reference,
                            l.payee,
                            l.type,
                            l.amount,
                            l.isCleared ? "Cleared" : "Uncleared",
                            l.clearedDate || "—",
                          ]),
                        })
                        showToast("Export Complete", "success", `Exported ${filteredBankLines.length} bank transactions to Excel.`)
                      },
                      icon: <Download className="size-3.5" />,
                      variant: "emeraldLight",
                    },
                  ]}
                />
                <TableScrollWrapper>
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-zinc-200/40 text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                        {columns.map(col => (
                          <ResizableTh
                            key={col.key}
                            col={col}
                            width={colWidths[col.key] ?? (col.key === '_actions' ? 165 : 140)}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            openMenuCol={openMenuCol}
                            onResizeStart={handleResizeStart}
                            onToggleMenu={toggleMenu}
                            onSortAsc={setSortAsc}
                            onSortDesc={setSortDesc}
                            onClearSort={clearSort}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs">
                      {isLoading ? (
                        Array.from({ length: 4 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse text-xs">
                            <td className="px-4 py-3"><Skeleton className="h-4 w-20 bg-zinc-200/80" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-24 bg-zinc-200/80" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-32 bg-zinc-200/80" /></td>
                            <td className="px-4 py-3"><Skeleton className="h-4 w-16 bg-zinc-200/80" /></td>
                            <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 bg-zinc-200/80 ml-auto" /></td>
                            <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-16 bg-zinc-200/80 mx-auto" /></td>
                            <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-12 bg-zinc-200/80 ml-auto" /></td>
                          </tr>
                        ))
                      ) : sortedLines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-16 text-zinc-400">
                            No bank statement lines match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        displayedLines.map((line) => {
                          const isCleared = clearedLineIds.has(line.id) || line.isCleared
                          return (
                            <tr key={line.id} className="hover:bg-zinc-50/60 transition-colors">
                              <td className="px-4 py-3 font-mono text-zinc-600">{line.date}</td>
                              <td className="px-4 py-3 font-mono font-bold text-zinc-900">{line.reference}</td>
                              <td className="px-4 py-3 font-semibold text-zinc-800">{line.payee}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  line.type === "Deposit" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                                }`}>
                                  {line.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                                ETB {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isCleared ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                                    <CheckCircle2 className="size-3" /> Cleared ({line.clearedDate || "Auto"})
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                                    Uncleared
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right pr-4">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingLine(line)}
                                    className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200/80 px-2.5 py-1 rounded-full transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                    title="View transaction details, linked invoices & attachments"
                                  >
                                    <Eye className="size-3 text-zinc-500" /> View
                                  </button>
                                  {!isCleared ? (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingLine(line)}
                                      className="text-[11px] font-bold text-white bg-black hover:bg-zinc-800 px-3 py-1 rounded-full transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Check className="size-3" /> Clear
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleUnclearBankLine(line.id, line.reference)}
                                      className="text-[10px] font-bold text-emerald-700 hover:text-zinc-800 bg-emerald-50 hover:bg-zinc-200/80 px-2.5 py-1 rounded-full transition-all cursor-pointer inline-flex items-center gap-1"
                                      title="Unmark as cleared"
                                    >
                                      <RotateCcw className="size-2.5" /> Unclear
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </TableScrollWrapper>

                {!isLoading && sortedLines.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-100 px-6 py-4 bg-white/40 dark:bg-white/[0.02] gap-3">
                    <div className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                      <span>
                        Showing {Math.min((page - 1) * pageSize + 1, sortedLines.length)} to {Math.min(page * pageSize, sortedLines.length)} of {sortedLines.length} entries
                      </span>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                        <span className="text-[11px] font-semibold text-zinc-400">Rows:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value))
                            setPage(1)
                          }}
                          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 px-2 font-mono">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
        </motion.div>
      </motion.div>

      {/* =========================================================================
          CONFIRMATION MODAL: CLEAR TRANSACTION (PEACHTREE BANK RECONCILIATION)
          ========================================================================= */}
      <AnimatePresence>
        {confirmingLine && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingLine(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-200 relative z-[151]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900">Clear Bank Transaction</h3>
                  <p className="text-xs text-zinc-500">Match statement item against General Ledger</p>
                </div>
              </div>

              {/* Light Green Highlight Details Card */}
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-4 space-y-2 mb-4 text-xs text-emerald-950 font-bold">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold">Bank Reference:</span>
                  <span className="font-mono">{confirmingLine.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold">Statement Date:</span>
                  <span className="font-mono">{confirmingLine.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold">Payee / Description:</span>
                  <span className="truncate max-w-[260px]">{confirmingLine.payee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold">Type & Movement:</span>
                  <span className={`uppercase font-mono ${confirmingLine.type === "Deposit" ? "text-emerald-700" : "text-zinc-800"}`}>
                    {confirmingLine.type}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-emerald-200/60 text-sm">
                  <span className="text-zinc-600 font-semibold">Reconciled Amount:</span>
                  <span className="font-mono font-black text-emerald-800">
                    ETB {confirmingLine.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-600 mb-6 leading-relaxed">
                Marking this transaction as <strong>Cleared</strong> confirms that this deposit or withdrawal has cleared through your bank statement and matches your book cash balance.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingLine(null)}
                  className="h-10 rounded-full border border-zinc-200 px-5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  className="h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-xs font-bold transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="size-3.5 stroke-[2.5]" /> Confirm & Clear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          VIEW & RECONCILE MODAL (WITH ATTACHED INVOICES, VOUCHERS & DOCUMENTS)
          ========================================================================= */}
      <AnimatePresence>
        {viewingLine && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingLine(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-zinc-200 relative z-[151] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                    <Building2 className="size-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-zinc-900">Bank Transaction Audit</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        clearedLineIds.has(viewingLine.id)
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {clearedLineIds.has(viewingLine.id) ? "Cleared" : "Uncleared"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      Ref: {viewingLine.reference} • Date: {viewingLine.date}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingLine(null)}
                  className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Highlight Summary Card */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-200/70 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800/70 tracking-wider block">Reconciled Amount</span>
                    <span className="text-base font-black text-zinc-950 font-mono">
                      ETB {viewingLine.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800/70 tracking-wider block">Movement</span>
                    <span className={`inline-flex items-center gap-1 font-bold text-xs ${
                      viewingLine.type === "Deposit" ? "text-emerald-700" : "text-zinc-800"
                    }`}>
                      {viewingLine.type === "Deposit" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                      {viewingLine.type}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-black uppercase text-emerald-800/70 tracking-wider block">GL Cash Account</span>
                    <span className="font-bold text-zinc-900 truncate block">
                      {viewingLine.accountCode} - {viewingLine.accountName}
                    </span>
                  </div>
                </div>

                {/* Originating Source Record (Invoice or Expense or Journal) */}
                {matchedInvoice && (
                  <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-emerald-700" />
                        <span className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                          Originating Sales Invoice #{matchedInvoice.invoice_number}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-600">
                        {matchedInvoice.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Customer</span>
                        <span className="font-bold text-zinc-900 truncate block">{matchedInvoice.customer_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Fiscal Sales No (FS No)</span>
                        <span className="font-mono font-bold text-zinc-800">{matchedInvoice.fs_no || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Payment Terms</span>
                        <span className="font-medium text-zinc-700">{matchedInvoice.payment_terms || "Credit"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Invoice Total</span>
                        <span className="font-mono font-bold text-zinc-900">ETB {Number(matchedInvoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 block">Total Collected</span>
                        <span className="font-mono font-bold text-emerald-700">ETB {Number(matchedInvoice.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-rose-600 block">Outstanding Balance</span>
                        <span className="font-mono font-bold text-rose-700">ETB {Number(matchedInvoice.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {matchedPayments.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/50">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Matched Installment Receipts ({matchedPayments.length})
                        </span>
                        <div className="space-y-1">
                          {matchedPayments.map((p, idx) => (
                            <div key={p.id || idx} className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-zinc-200/70">
                              <span className="text-zinc-600 font-medium">#{p.installment_no || idx + 1} • {p.date} • {p.method || "Bank"}</span>
                              <span className="font-mono font-bold text-emerald-700">ETB {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {matchedExpense && !matchedInvoice && (
                  <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-emerald-700" />
                        <span className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                          Originating Expense Voucher #{matchedExpense.id}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-600">
                        {matchedExpense.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Merchant / Vendor</span>
                        <span className="font-bold text-zinc-900 truncate block">{matchedExpense.merchant}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Expense Category</span>
                        <span className="font-medium text-zinc-800">{matchedExpense.category}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Requested / Handled By</span>
                        <span className="font-medium text-zinc-800">{matchedExpense.employee || "Finance"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Payment Method</span>
                        <span className="font-medium text-zinc-700">{matchedExpense.payment_method || "Bank Transfer"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Receipt / Cheque Ref</span>
                        <span className="font-mono font-bold text-zinc-800">{matchedExpense.cheque_no || matchedExpense.receipt_ref || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block">Disbursed Amount</span>
                        <span className="font-mono font-black text-zinc-900">ETB {Number(matchedExpense.net_disbursed || matchedExpense.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {!matchedInvoice && !matchedExpense && (
                  <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Originating GL Voucher</span>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-semibold">Source Type:</span>
                      <span className="font-bold text-zinc-900">{viewingLine.sourceType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-semibold">Description / Payee:</span>
                      <span className="font-medium text-zinc-800 text-right max-w-[280px] truncate">{viewingLine.payee}</span>
                    </div>
                    {viewingEntry?.created_by && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Posted By:</span>
                        <span className="font-medium text-zinc-700">{viewingEntry.created_by}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Attached Supporting Documents & Payment Slips */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                      <Paperclip className="size-3.5" /> Attached Invoices, Bank Advice & Payment Slips
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">
                      {isLoadingDocs ? (
                        <Skeleton className="h-3 w-10 bg-zinc-200/80 rounded-full" />
                      ) : (
                        `${viewingDocs.length} ${viewingDocs.length === 1 ? "document" : "documents"}`
                      )}
                    </span>
                  </div>

                  {isLoadingDocs ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Skeleton className="h-8 w-44 bg-zinc-200/80 rounded-xl" />
                      <Skeleton className="h-8 w-36 bg-zinc-200/80 rounded-xl" />
                    </div>
                  ) : viewingDocs.length === 0 ? (
                    <p className="text-xs text-zinc-400 font-medium italic">
                      No electronic payment slips or attachments found for reference {viewingLine.reference}.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {viewingDocs.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(att.file_url)
                            setPreviewDocName(att.file_name)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-zinc-800 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                        >
                          <FileText className="size-3.5 text-zinc-500 group-hover:text-emerald-700" />
                          <span className="truncate max-w-[170px]">{att.file_name}</span>
                          <Eye className="size-3 text-zinc-400 group-hover:text-emerald-700" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Double-Entry General Ledger Breakdown */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-2">
                    Double-Entry General Ledger Distribution
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase border-b border-zinc-200">
                          <th className="py-2 px-3">GL Account</th>
                          <th className="py-2 px-3">Party / Notes</th>
                          <th className="py-2 px-3 text-right">Debit (ETB)</th>
                          <th className="py-2 px-3 text-right">Credit (ETB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {viewingEntryLines.map((l) => {
                          const acc = accountById.get(l.account_id)
                          const isCurrentBankLine = l.id === viewingLine.id
                          return (
                            <tr key={l.id} className={isCurrentBankLine ? "bg-emerald-50/60 font-semibold" : ""}>
                              <td className="py-2 px-3">
                                <span className="font-mono text-zinc-500 mr-1.5">{acc?.code || l.account_id}</span>
                                <span className="text-zinc-800">{acc?.name || "Account"}</span>
                              </td>
                              <td className="py-2 px-3 text-zinc-600 truncate max-w-[140px]">
                                {l.party_name || "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">
                                {l.debit_amount > 0 ? l.debit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">
                                {l.credit_amount > 0 ? l.credit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                <button
                  type="button"
                  onClick={() => setViewingLine(null)}
                  className="h-9 rounded-full border border-zinc-200 px-5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <div>
                  {!clearedLineIds.has(viewingLine.id) ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleConfirmClearSpecific(viewingLine)
                      }}
                      className="h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-xs font-bold transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="size-3.5 stroke-[2.5]" /> Reconcile & Clear Transaction
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handleUnclearBankLine(viewingLine.id, viewingLine.reference)
                      }}
                      className="h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-5 text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="size-3" /> Mark as Uncleared
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDocUrl)}
        fileUrl={previewDocUrl}
        fileName={previewDocName}
        onClose={() => {
          setPreviewDocUrl("")
          setPreviewDocName("")
        }}
      />
    </div>
  )
}
