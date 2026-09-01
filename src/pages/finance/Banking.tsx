import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Landmark,
  ArrowRightLeft,
  CheckCircle2,
  Download,
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

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { visible: { transition: { staggerChildren: 0.05 } } }

interface BankStatementLine {
  id: string
  date: string
  reference: string
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

  const [activeTab, setActiveTab] = useState<"BankRecon" | "Reconciliation">("BankRecon")
  const [clearedLineIds, setClearedLineIds] = useState<Set<string>>(new Set())
  const [bankSearch, setBankSearch] = useState("")
  const [bankDateFilter, setBankDateFilter] = useState("ALL")
  const [bankCustomStart, setBankCustomStart] = useState("")
  const [bankCustomEnd, setBankCustomEnd] = useState("")
  const [bankStatusFilter, setBankStatusFilter] = useState("ALL")
  const [bankTypeFilter, setBankTypeFilter] = useState("ALL")
  const [allocSearch, setAllocSearch] = useState("")

  const invoices = store.getInvoices()
  const accounts = store.getAccounts()
  const entries = store.getJournalEntries()
  const lines = store.getJournalEntryLines()
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  const bankLines: BankStatementLine[] = lines.flatMap((line) => {
    const account = accountById.get(line.account_id)
    const entry = entryById.get(line.journal_entry_id)
    if (!account || !entry || account.account_type !== "Asset" || !(account.peachtree_type === "Cash" || account.code.startsWith("1000") || /cash|bank|cbe|boa|aib|abay|unb|cbo|ahadu|oib/i.test(account.name))) return []
    const amount = line.debit_amount || line.credit_amount
    if (!amount) return []
    return [{ id: line.id, date: entry.entry_date, reference: entry.source_id || entry.id, payee: line.party_name || entry.description, type: line.debit_amount > 0 ? "Deposit" : "Withdrawal", amount, isCleared: clearedLineIds.has(line.id), clearedDate: clearedLineIds.has(line.id) ? new Date().toISOString().slice(0, 10) : undefined }]
  })

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

  const openInvoices = invoices.filter((inv) => {
    if (inv.balance_due <= 0) return false
    if (!allocSearch.trim()) return true
    const q = allocSearch.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q)
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

  const handleClearBankLine = (id: string) => {
    setClearedLineIds((previous) => new Set(previous).add(id))
    showToast("Transaction Cleared", "success", "Bank statement line successfully matched and cleared against general ledger.")
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
            <h1 className="text-3xl font-black text-black tracking-tight">Banking & Treasury Management</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Reconcile bank statements and match customer payments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SubPageNav items={getSectionChildren("/finance")} />
          </div>
        </motion.div>

        {/* Tab Selection Bar */}
        <motion.div variants={fade} className="flex border-b border-zinc-200/60 mb-6 pb-px items-center justify-between overflow-x-auto scrollbar-none">
          <div className="flex gap-1 min-w-max">
            {[
              { id: "BankRecon", label: "Bank Reconciliation", icon: Landmark },
              { id: "Reconciliation", label: "Payment & Account Allocation", icon: ArrowRightLeft },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black relative tracking-tight transition-colors uppercase whitespace-nowrap"
                >
                  <Icon className={`size-3.5 ${isActive ? "text-emerald-600" : "text-zinc-400"}`} />
                  <span className={isActive ? "text-zinc-950 font-black" : "text-zinc-400 hover:text-zinc-700"}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="banking-tabs"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "BankRecon" && (
            <motion.div
              key="bank-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
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
                            width={colWidths[col.key] ?? 140}
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
                                {!isCleared && (
                                  <button
                                    onClick={() => handleClearBankLine(line.id)}
                                    className="text-[11px] font-bold text-white bg-black hover:bg-zinc-800 px-3 py-1 rounded-full transition-all"
                                  >
                                    Clear Transaction
                                  </button>
                                )}
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
          )}

          {activeTab === "Reconciliation" && (
            <motion.div
              key="recon-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <GlassCard className="flex flex-col">
                <FinanceTableToolbar
                  title="Payment Reconciliation & Invoice Allocation"
                  subtitle="Match unallocated customer deposits against open AR invoices."
                  searchValue={allocSearch}
                  onSearchChange={setAllocSearch}
                  searchPlaceholder="Search invoice #, customer..."
                />
              </GlassCard>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassCard className="p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Unallocated Receipts</h4>
                  <div className="flex flex-col gap-2 text-xs">
                    {store.getPayments().filter((payment) => payment.direction === "Received" && !payment.linked_invoice_id).length === 0 ? <p className="py-4 text-center text-zinc-400">No unallocated receipts.</p> : store.getPayments().filter((payment) => payment.direction === "Received" && !payment.linked_invoice_id).map((payment) => <div key={payment.id} className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200/60 flex justify-between items-center"><div><div className="font-bold text-zinc-900">{payment.reference}</div><div className="text-[10px] text-zinc-400">Received {payment.date} via {payment.method}</div></div><span className="font-mono font-bold text-emerald-700">ETB {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>)}
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Open Outstanding Invoices</h4>
                  <div className="flex flex-col gap-2 text-xs max-h-[350px] overflow-y-auto">
                    {openInvoices.map((inv) => (
                      <div key={inv.id} className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200/60 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-zinc-900">{inv.invoice_number} | {inv.customer_name}</div>
                          <div className="text-[10px] text-zinc-400">Due {inv.due_date} • Balance: ETB {inv.balance_due.toLocaleString()}</div>
                        </div>
                        <button
                          onClick={() => showToast("Payment Allocated", "success", `Allocated receipt against invoice ${inv.invoice_number}.`)}
                          className="px-3 py-1 rounded-full bg-black text-white text-[10px] font-bold hover:bg-zinc-800 transition-all"
                        >
                          Allocate
                        </button>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
