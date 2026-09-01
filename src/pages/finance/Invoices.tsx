import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, 
  Search, 
  Download, 
  X, 
  Upload, 
  Paperclip, 
  Eye, 
  FileText,
  Receipt,
  CheckCircle2,
  ArrowRight
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { GlassCard } from "@/components/GlassCard"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useFeedback } from "@/context/FeedbackContext"
import { useFinanceStore, calculateMultiTax, type Invoice, type InvoiceLineItem } from "@/lib/financeStore"
import { isDateInPreset } from "@/lib/peachtreeExportUtils"
import { FinanceDateFilter } from "@/components/FinanceTableToolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import InvoicePrintModal from "@/components/finance/InvoicePrintModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import {
  type ShipmentDocAttachment,
  savePaymentAdvice,
  fetchTradeAndAdviceDocs,
} from "@/lib/tradeDocumentService"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

export type InvoiceAttachment = ShipmentDocAttachment

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Invoices() {
  const { showToast } = useFeedback()
  const store = useFinanceStore()
  const invoices = store.getInvoices()
  const isLoading = store.isLoading()
  const bankAccounts = store.getAccounts().filter((a) => !a.is_group && (a.code.startsWith("1000") || a.account_type === "Asset"))

  // Top Level Search and Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [filterDateRange, setFilterDateRange] = useState<string>("ALL")
  const [invCustomStart, setInvCustomStart] = useState<string>("")
  const [invCustomEnd, setInvCustomEnd] = useState<string>("")

  // Currently selected preview invoice
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Attachments State for Active Invoice
  const [invoiceAttachments, setInvoiceAttachments] = useState<InvoiceAttachment[]>([])
  const [isAttachmentsLoading, setIsAttachmentsLoading] = useState(false)
  const [previewDocUrl, setPreviewDocUrl] = useState("")
  const [previewDocName, setPreviewDocName] = useState("")

  // Export / Print Modal State
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null)

  // Edit / Record Payment Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null)
  const [editCustName, setEditCustName] = useState("")
  const [editPayAmount, setEditPayAmount] = useState("")
  const [editPayDate, setEditPayDate] = useState(new Date().toISOString().split("T")[0])
  const [editPayBank, setEditPayBank] = useState("1000-02-26")
  const [editPayRef, setEditPayRef] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editAdviceFile, setEditAdviceFile] = useState<File | null>(null)

  // Create Invoice Slide-In Drawer State
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [custName, setCustName] = useState("")
  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDueObj = new Date()
  defaultDueObj.setDate(defaultDueObj.getDate() + 30)
  const defaultDueStr = defaultDueObj.toISOString().split("T")[0]

  const [invNumber, setInvNumber] = useState(`INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`)
  const [issueDate, setIssueDate] = useState(todayStr)
  const [dueDate, setDueDate] = useState(defaultDueStr)
  const [currency] = useState("ETB")
  const [newItems, setNewItems] = useState<InvoiceLineItem[]>([
    { description: "", quantity: 1, unit_price: 0, line_total: 0 }
  ])
  const taxRules = store.getTaxRules()
  const taxSchedules = store.getTaxSchedules()
  const [selectedTaxScheduleId, setSelectedTaxScheduleId] = useState("SCH-DOM-VAT")
  const [paymentTerms, setPaymentTerms] = useState("Credit")
  const [discountVal, setDiscountVal] = useState("0")

  // Filter helper
  const getFilteredInvoices = (status: string, search: string, datePreset: string, customStart?: string, customEnd?: string) => {
    return invoices.filter((inv) => {
      const isPaid = inv.status === "Paid" || Number(inv.balance_due ?? 0) <= 0
      const isPartiallyPaid = !isPaid && Number(inv.amount_paid || 0) > 0
      const matchStatus =
        status === "ALL" ||
        (status === "PAID" && isPaid) ||
        (status === "UNPAID" && !isPaid) ||
        (status === "PARTIAL" && isPartiallyPaid)

      const q = search.toLowerCase().trim()
      const matchSearch =
        !q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_name.toLowerCase().includes(q)

      const matchDate = isDateInPreset(inv.issue_date, datePreset, customStart, customEnd)
      return matchStatus && matchSearch && matchDate
    })
  }

  const filteredInvoices = useMemo(() => {
    return getFilteredInvoices(filterStatus, searchQuery, filterDateRange, invCustomStart, invCustomEnd)
  }, [invoices, filterStatus, searchQuery, filterDateRange, invCustomStart, invCustomEnd])

  const handleFilterStatusChange = (newStatus: string) => {
    setFilterStatus(newStatus)
    const matches = getFilteredInvoices(newStatus, searchQuery, filterDateRange, invCustomStart, invCustomEnd)
    setSelectedInvoice(matches[0] || null)
  }

  const handleSearchChange = (newSearch: string) => {
    setSearchQuery(newSearch)
    const matches = getFilteredInvoices(filterStatus, newSearch, filterDateRange, invCustomStart, invCustomEnd)
    setSelectedInvoice(matches[0] || null)
  }

  const handleDateFilterChange = (newDateFilter: string) => {
    setFilterDateRange(newDateFilter)
    const matches = getFilteredInvoices(filterStatus, searchQuery, newDateFilter, invCustomStart, invCustomEnd)
    setSelectedInvoice(matches[0] || null)
  }

  const handleCustomStartChange = (start: string) => {
    setInvCustomStart(start)
    const matches = getFilteredInvoices(filterStatus, searchQuery, filterDateRange, start, invCustomEnd)
    setSelectedInvoice(matches[0] || null)
  }

  const handleCustomEndChange = (end: string) => {
    setInvCustomEnd(end)
    const matches = getFilteredInvoices(filterStatus, searchQuery, filterDateRange, invCustomStart, end)
    setSelectedInvoice(matches[0] || null)
  }

  // Determine active invoice for preview
  const liveSelectedInvoice = selectedInvoice ? invoices.find((inv) => inv.id === selectedInvoice.id) || null : null
  const isSelectedInFiltered = liveSelectedInvoice ? filteredInvoices.some((inv) => inv.id === liveSelectedInvoice.id) : false
  const activeInvoice = isSelectedInFiltered ? liveSelectedInvoice : (filteredInvoices.length > 0 ? filteredInvoices[0] : null)
  const isSelectedInvoicePaid = activeInvoice ? (activeInvoice.status === "Paid" || Number(activeInvoice.balance_due ?? 0) <= 0) : false

  // Fetch Attachments for Active Invoice
  useEffect(() => {
    if (!activeInvoice) {
      setInvoiceAttachments([])
      setIsAttachmentsLoading(false)
      return
    }

    setInvoiceAttachments([])
    setIsAttachmentsLoading(true)

    let cancelled = false
    const invId = activeInvoice.id
    const siId = activeInvoice.sales_issue_id || ""
    const soId = activeInvoice.sales_order_id || ""
    const fsNo = activeInvoice.fs_no || ""

    fetchTradeAndAdviceDocs({
      invoiceId: invId,
      salesIssueId: siId,
      salesOrderId: soId,
      fsNo: fsNo,
      customerName: activeInvoice.customer_name,
    })
      .then((res) => {
        if (!cancelled) {
          setInvoiceAttachments(res.allDocs || [])
        }
      })
      .catch(() => {
        if (!cancelled) setInvoiceAttachments([])
      })
      .finally(() => {
        if (!cancelled) setIsAttachmentsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeInvoice?.id, activeInvoice?.amount_paid])

  // Aggregates
  const totalReceivables = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (inv.total || 0), 0)
  }, [invoices])

  const totalCollected = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (inv.amount_paid || 0), 0)
  }, [invoices])

  const totalOutstandingDue = useMemo(() => {
    return invoices.reduce((acc, inv) => {
      const paid = inv.amount_paid || 0
      const total = inv.total || 0
      return acc + Math.max(0, total - paid)
    }, 0)
  }, [invoices])

  const activeCount = useMemo(() => {
    return invoices.filter((i) => (i.balance_due ?? i.total) > 0).length
  }, [invoices])

  // Add line item in creation form
  const handleAddLineItem = () => {
    setNewItems([...newItems, { description: "", quantity: 1, unit_price: 0, line_total: 0 }])
  }

  const handleUpdateItem = (index: number, field: keyof InvoiceLineItem, val: any) => {
    const updated = [...newItems]
    const item = { ...updated[index], [field]: val }
    if (field === "quantity" || field === "unit_price") {
      const q = parseFloat(field === "quantity" ? val : item.quantity) || 0
      const p = parseFloat(field === "unit_price" ? val : item.unit_price) || 0
      item.line_total = q * p
    }
    updated[index] = item
    setNewItems(updated)
  }

  const handleRemoveLineItem = (index: number) => {
    if (newItems.length > 1) {
      setNewItems(newItems.filter((_, i) => i !== index))
    }
  }

  const subtotalCalc = newItems.reduce((s, item) => s + (item.line_total || 0), 0)
  const discountCalc = parseFloat(discountVal) || 0
  const netSubtotalCalc = Math.max(0, subtotalCalc - discountCalc)
  
  const multiTaxCalc = useMemo(() => {
    return calculateMultiTax(netSubtotalCalc, taxRules, selectedTaxScheduleId)
  }, [netSubtotalCalc, taxRules, selectedTaxScheduleId])

  const taxCalc = multiTaxCalc.totalTaxAdded
  const totalCalc = multiTaxCalc.netTotal
  const taxRateNum = multiTaxCalc.totalTaxAdded > 0 && netSubtotalCalc > 0 ? Math.round((multiTaxCalc.totalTaxAdded / netSubtotalCalc) * 100) : 0

  const handleCreateInvoiceSubmit = (e: React.FormEvent, submitStatus: "Sent" | "Draft" = "Sent") => {
    e.preventDefault()
    if (!custName.trim() || newItems.length === 0) {
      showToast("Validation Error", "warning", "Please provide customer name and line items.")
      return
    }

    const created = store.createInvoice({
      invoice_number: invNumber,
      customer_name: custName,
      issue_date: issueDate,
      due_date: dueDate,
      currency,
      line_items: newItems,
      subtotal: subtotalCalc,
      tax_amount: taxCalc,
      tax_rate: taxRateNum,
      discount_amount: discountCalc,
      payment_terms: paymentTerms,
      total: totalCalc,
      status: submitStatus,
    })

    showToast("Invoice Created", "success", `Sales Invoice ${created.invoice_number} has been created.`)
    setShowCreateDrawer(false)
    setSelectedInvoice(created)
    setCustName("")
    setNewItems([{ description: "", quantity: 1, unit_price: 0, line_total: 0 }])
    setInvNumber(`INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`)
  }

  // Open Edit / Record Payment Modal
  const handleOpenEditModal = (inv: Invoice) => {
    setEditingInvoice(inv)
    setEditCustName(inv.customer_name)
    const paid = Number(inv.amount_paid || 0)
    const total = Number(inv.total || 0)
    const due = Number(Math.max(0, total - paid).toFixed(2))

    setEditPayAmount(due > 0 ? String(due) : "")
    setEditPayDate(new Date().toISOString().split("T")[0])
    setEditPayBank("1000-02-26")
    setEditPayRef(`PAY-${Date.now().toString().slice(-4)}`)
    setEditNotes(inv.notes || "")
    setEditAdviceFile(null)
    setIsEditModalOpen(true)
  }

  // Save Edit Modal & Record Partial Installment
  const handleSaveEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingInvoice) return

    const numPay = parseFloat(editPayAmount)
    const hasPayment = !isNaN(numPay) && numPay > 0
    const totalVal = Number(editingInvoice.total || 0)
    const alreadyPaid = Number(editingInvoice.amount_paid || 0)
    const currentDue = Number(Math.max(0, totalVal - alreadyPaid).toFixed(2))

    if (hasPayment && numPay > currentDue + 0.01) {
      showToast("Overpayment Notice", "warning", `Payment amount (ETB ${numPay.toLocaleString()}) exceeds remaining due (ETB ${currentDue.toLocaleString()}).`)
      return
    }

    setIsSavingEdit(true)
    try {
      let stagedSlipUrl = ""
      let stagedSlipName = ""

      if (editAdviceFile) {
        stagedSlipName = editAdviceFile.name
        stagedSlipUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(editAdviceFile)
        })

        try {
          await savePaymentAdvice({
            invoiceId: editingInvoice.id,
            salesIssueId: editingInvoice.sales_issue_id || undefined,
            salesOrderId: editingInvoice.sales_order_id || undefined,
            fsNo: editingInvoice.fs_no || undefined,
            fileName: stagedSlipName,
            fileUrl: stagedSlipUrl,
            uploadedBy: "Finance Officer",
          })
        } catch (err) {
          console.warn("Payment advice upload notice:", err)
        }
      }

      if (hasPayment) {
        store.recordPayment({
          linked_invoice_id: editingInvoice.id,
          sales_issue_id: editingInvoice.sales_issue_id,
          sales_order_id: editingInvoice.sales_order_id,
          customer_name: editCustName || editingInvoice.customer_name,
          amount: numPay,
          currency: editingInvoice.currency,
          date: editPayDate,
          method: "Bank Deposit",
          bank_account_code: editPayBank,
          reference: editPayRef || `PAY-${Date.now().toString().slice(-4)}`,
          payment_advice_url: stagedSlipUrl || undefined,
          payment_advice_filename: stagedSlipName || undefined,
          notes: editNotes,
          direction: "Received",
        })

        const newPaid = Number((alreadyPaid + numPay).toFixed(2))
        const newDue = Number(Math.max(0, totalVal - newPaid).toFixed(2))
        showToast(
          "Payment Recorded",
          "success",
          `Installment of ETB ${money(numPay)} recorded for ${editingInvoice.invoice_number}. Remaining: ETB ${money(newDue)}.`
        )
      } else {
        store.updateInvoice(editingInvoice.id, {
          customer_name: editCustName,
          notes: editNotes,
        })
        showToast("Invoice Updated", "success", `Invoice ${editingInvoice.invoice_number} details updated.`)
      }

      setIsEditModalOpen(false)
      setEditingInvoice(null)
    } catch (err) {
      showToast("Update Failed", "warning", "Failed to update invoice or record payment.")
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Delete Invoice
  const handleConfirmDeleteInvoice = () => {
    if (!deletingInvoice) return
    store.deleteInvoice(deletingInvoice.id)
    showToast("Invoice Deleted", "success", `Invoice ${deletingInvoice.invoice_number} removed.`)
    setDeletingInvoice(null)
    setIsEditModalOpen(false)
    setEditingInvoice(null)
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <main className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        <motion.div initial="hidden" animate="visible" variants={fade} className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Sales Invoices</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">Multi-tax accounting, partial credit installments, and real-time settlement.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("Finance")} />
          </div>
        </motion.div>

        {/* Top KPI Cards */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-black">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Billed</span>
            {isLoading ? (
              <Skeleton className="h-7 w-28 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-black font-mono mt-1">ETB {totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            )}
            <span className="text-[10px] text-gray-400 mt-0.5">Cumulative sales invoice totals</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-emerald-600">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Collected</span>
            {isLoading ? (
              <Skeleton className="h-7 w-28 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-emerald-700 font-mono mt-1">ETB {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            )}
            <span className="text-[10px] text-emerald-600 mt-0.5 font-bold">Payments deposited to banks</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-rose-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remaining Balance Due</span>
            {isLoading ? (
              <Skeleton className="h-7 w-28 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-rose-700 font-mono mt-1">ETB {totalOutstandingDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            )}
            <span className="text-[10px] text-rose-600 mt-0.5 font-bold">Active credit receivables</span>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-blue-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Unsettled Invoices</span>
            {isLoading ? (
              <Skeleton className="h-7 w-20 bg-zinc-200/80 my-1" />
            ) : (
              <p className="text-xl font-black text-blue-700 font-mono mt-1">{activeCount} invoices</p>
            )}
            <span className="text-[10px] text-zinc-400 mt-0.5">Unpaid or ongoing installments</span>
          </GlassCard>
        </motion.div>

        {/* Master-Detail Split Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Invoice Preview Section (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {activeInvoice ? (
              <GlassCard className="p-6 border border-black/5 shadow-md space-y-6">
                {/* Header Status & Numbers */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
                      Sales Invoice Details • Terms: {activeInvoice.payment_terms || "Credit"}
                    </span>
                    <h2 className="text-xl font-black text-black mt-0.5">
                      #{activeInvoice.invoice_number}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {(() => {
                      const totalVal = Number(activeInvoice.total ?? 0)
                      const paidVal = Number(activeInvoice.amount_paid ?? 0)
                      const dueVal = Number(activeInvoice.balance_due ?? Math.max(0, totalVal - paidVal))
                      const pct = totalVal > 0 ? Math.min(100, Math.round((paidVal / totalVal) * 100)) : 0
                      const isPaid = activeInvoice.status === "Paid" || dueVal <= 0

                      if (isPaid) {
                        return (
                          <span className="text-xs font-black uppercase px-3 py-1 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="size-3.5 text-emerald-700" /> Paid (100%)
                          </span>
                        )
                      }
                      if (paidVal > 0) {
                        return (
                          <span className="text-xs font-black uppercase px-3 py-1 rounded-full border bg-amber-100 text-amber-900 border-amber-200">
                            Ongoing ({pct}% Paid)
                          </span>
                        )
                      }
                      return (
                        <span className="text-xs font-black uppercase px-3 py-1 rounded-full border bg-rose-100 text-rose-800 border-rose-200">
                          Unpaid (0%)
                        </span>
                      )
                    })()}
                  </div>
                </div>

                {/* Billed To & Issue Date Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200/60 text-xs">
                  <div>
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Billed To</span>
                    <span className="font-bold text-zinc-950 mt-1 block">{activeInvoice.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Issue Date</span>
                    <span className="font-mono font-bold text-zinc-800 mt-1 block">{activeInvoice.issue_date}</span>
                  </div>
                </div>

                {/* Itemized Table */}
                <div>
                  <div className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider mb-2">Invoice Items & Charges</div>
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-100 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-600">
                        <tr>
                          <th className="py-2.5 px-3">Item Details</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(activeInvoice.line_items || []).map((item, i) => {
                          const q = Number(item.quantity ?? 1)
                          const p = Number(item.unit_price ?? 0)
                          const t = Number(item.line_total ?? q * p)
                          return (
                            <tr key={i}>
                              <td className="py-2.5 px-3 font-bold text-zinc-950">{item.description || "Invoice Item"}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-600">{q}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-zinc-600">{activeInvoice.currency} {p.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-zinc-950">{activeInvoice.currency} {t.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary & Settlement Progress */}
                {(() => {
                  const totalVal = Number(activeInvoice.total ?? 0)
                  const subtotalVal = Number(activeInvoice.subtotal ?? totalVal)
                  const taxVal = Number(activeInvoice.tax_amount ?? 0)
                  const discVal = Number(activeInvoice.discount_amount ?? 0)
                  const paidVal = Number(activeInvoice.amount_paid ?? 0)
                  const dueVal = Number(activeInvoice.balance_due ?? Math.max(0, totalVal - paidVal))
                  const pct = totalVal > 0 ? Math.min(100, Math.round((paidVal / totalVal) * 100)) : 0
                  const recordedTaxRate = activeInvoice.tax_rate !== undefined
                    ? activeInvoice.tax_rate
                    : (subtotalVal > 0 && taxVal > 0 ? Math.round((taxVal / Math.max(1, subtotalVal - discVal)) * 100) : (taxVal > 0 ? 15 : 0))

                  return (
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3 text-xs">
                      {/* Visual Settlement Progress Bar */}
                      <div className="space-y-1.5 pb-2 border-b border-zinc-200">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-zinc-600">Settlement Progress</span>
                          <span className="font-mono text-zinc-950">{pct}% Paid</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${dueVal <= 0 ? "bg-emerald-600" : "bg-blue-600"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-zinc-600"><span>Subtotal</span><span className="font-mono">{activeInvoice.currency} {subtotalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      {discVal > 0 && <div className="flex justify-between text-emerald-700 font-bold"><span>Discount Applied</span><span className="font-mono">-{activeInvoice.currency} {discVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                      <div className="flex justify-between text-zinc-600"><span>Tax (VAT {recordedTaxRate}%)</span><span className="font-mono">{activeInvoice.currency} {taxVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between font-black text-zinc-950 text-sm pt-2 border-t border-zinc-200"><span>Total Billed</span><span className="font-mono">{activeInvoice.currency} {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between font-bold text-emerald-700"><span>Cumulative Amount Paid</span><span className="font-mono">{activeInvoice.currency} {paidVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between font-black text-rose-700 text-sm"><span>Outstanding Balance Due</span><span className="font-mono">{activeInvoice.currency} {dueVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  )
                })()}

                {/* Recorded Installment Receipts History */}
                {(() => {
                  const invPayments = store.getPaymentsForInvoice(activeInvoice.id)
                  if (invPayments.length === 0) return null
                  return (
                    <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                        Recorded Installment Receipts ({invPayments.length})
                      </span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {invPayments.map((p, idx) => (
                          <div key={p.id || idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-zinc-200 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded">#{p.installment_no || idx + 1}</span>
                              <span className="font-bold text-zinc-800">{p.date}</span>
                              <span className="font-mono text-[11px] text-zinc-500">({p.reference})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-emerald-700">ETB {money(p.amount)}</span>
                              {p.payment_advice_url && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewDocUrl(p.payment_advice_url!)
                                    setPreviewDocName(p.payment_advice_filename || "Payment Slip")
                                  }}
                                  className="text-blue-600 font-bold hover:underline text-[11px]"
                                >
                                  Slip ↗
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Attached Supporting Documents & Payment Advice */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                      <Paperclip className="size-3.5" /> Attached Supporting Documents & Payment Advice
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">
                      {isAttachmentsLoading ? (
                        <Skeleton className="h-3 w-10 bg-zinc-200/80 rounded-full" />
                      ) : (
                        `${invoiceAttachments.length} ${invoiceAttachments.length === 1 ? "file" : "files"}`
                      )}
                    </span>
                  </div>

                  {isAttachmentsLoading ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Skeleton className="h-8 w-44 bg-zinc-200/80 rounded-xl" />
                      <Skeleton className="h-8 w-36 bg-zinc-200/80 rounded-xl" />
                    </div>
                  ) : invoiceAttachments.length === 0 ? (
                    <p className="text-xs text-zinc-400 font-medium italic">
                      No payment advice or supporting documents attached yet. Click "Record Payment" to attach payment slip.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {invoiceAttachments.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => {
                            setPreviewDocUrl(att.file_url)
                            setPreviewDocName(att.file_name)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <FileText className="size-3.5 text-zinc-500" />
                          <span className="truncate max-w-[160px]">{att.file_name}</span>
                          <Eye className="size-3 text-zinc-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/5">
                  {!isSelectedInvoicePaid && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeInvoice)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-[11px] transition-all shadow-sm cursor-pointer"
                      title="Record Payment Installment"
                    >
                      <Receipt className="size-3 text-white" /> Record Payment
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPrintingInvoice(activeInvoice)}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                    title="Export Sales Invoice"
                  >
                    <Download className="size-3 text-zinc-700" /> Export
                  </button>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="p-12 text-center text-gray-400 text-sm border border-black/5 flex flex-col items-center justify-center min-h-[500px] space-y-3">
                <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center text-gray-400">
                  <Search className="size-6 text-gray-400" />
                </div>
                <p className="font-bold text-gray-700 text-base">Nothing to show</p>
                <p className="text-xs text-gray-400 max-w-sm">There are no invoices to display for the "{filterStatus}" filter.</p>
              </GlassCard>
            )}
          </div>

          {/* RIGHT COLUMN: Master Invoices List (4 cols / 33%) */}
          <GlassCard className="lg:col-span-4 p-5 border border-black/5 shadow-sm flex flex-col space-y-3 sticky top-24 max-h-[calc(100vh-120px)]">
            <div className="flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
              <h3 className="font-bold text-base text-black">Invoices List</h3>
              <button
                type="button"
                onClick={() => setShowCreateDrawer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black text-white text-xs font-bold hover:bg-zinc-800 shadow-md transition-all uppercase tracking-wider h-[32px] cursor-pointer"
              >
                <Plus className="size-3.5" /> Create Invoice
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search invoice or customer..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full bg-white/90 border border-black/5 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-black focus:outline-none h-[34px] shadow-2xs"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => handleFilterStatusChange(e.target.value)}
                className="bg-white/90 border border-black/5 rounded-xl px-2 py-1.5 text-[11px] font-bold text-zinc-900 focus:outline-none h-[34px] cursor-pointer shadow-2xs"
              >
                <option value="ALL">All</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Ongoing</option>
                <option value="UNPAID">Unpaid</option>
              </select>

              <FinanceDateFilter
                value={filterDateRange}
                onChange={handleDateFilterChange}
                startDate={invCustomStart}
                endDate={invCustomEnd}
                onCustomDateChange={(start, end) => {
                  handleCustomStartChange(start)
                  handleCustomEndChange(end)
                }}
              />
            </div>

            {/* Scrollable Invoices Cards Stack */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin max-h-[calc(100vh-230px)] min-h-[480px]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="p-3.5 rounded-2xl bg-white/60 border border-black/5 space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24 bg-zinc-200/80" />
                      <Skeleton className="h-4 w-16 bg-zinc-200/80" />
                    </div>
                    <Skeleton className="h-5 w-40 bg-zinc-200/80" />
                    <Skeleton className="h-3 w-32 bg-zinc-200/80" />
                  </div>
                ))
              ) : filteredInvoices.length === 0 ? (
                <div className="p-8 text-center bg-white/50 backdrop-blur-xs rounded-2xl border border-black/5 text-gray-400 text-xs font-medium space-y-2">
                  <Search className="size-5 mx-auto text-gray-300" />
                  <p className="font-semibold text-gray-600">Nothing to show</p>
                  <p className="text-[11px] text-gray-400">No invoices match the selected filter criteria.</p>
                </div>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = activeInvoice?.id === inv.id
                  const totalAmt = Number(inv.total || 0)
                  const paidAmt = Number(inv.amount_paid || 0)
                  const dueAmt = Number(inv.balance_due ?? Math.max(0, totalAmt - paidAmt))
                  const pct = totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0
                  const isPaid = inv.status === "Paid" || dueAmt <= 0
                  const isOngoing = !isPaid && paidAmt > 0

                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className={`p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border ${
                        isSelected
                          ? "bg-[#1c1c1f] text-white border-black/10 shadow-xl shadow-black/10 scale-[1.01]"
                          : "bg-white/80 hover:bg-white text-black border-black/5 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-gray-400">
                          #{inv.invoice_number}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            isSelected
                              ? "bg-[#27272a] text-white border border-white/10"
                              : isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : isOngoing
                              ? "bg-amber-100 text-amber-900"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isPaid ? "Paid" : isOngoing ? `Ongoing (${pct}%)` : "Unpaid"}
                        </span>
                      </div>

                      <h4 className={`text-sm font-black mt-1.5 tracking-tight truncate ${isSelected ? "text-white" : "text-black"}`}>
                        {inv.customer_name}
                      </h4>

                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-gray-400 text-[10px]">
                          Due: ETB {money(dueAmt)}
                        </span>
                        <span className={`font-mono font-black text-xs ${isSelected ? "text-[#10b981]" : "text-black"}`}>
                          ETB {money(totalAmt)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </GlassCard>
        </div>
      </main>

      {/* MODAL: EDIT INVOICE & RECORD PARTIAL INSTALLMENT */}
      <AnimatePresence>
        {isEditModalOpen && editingInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative z-10 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <EditModalHeader
                title="Record Payment Installment"
                subtitle={`Invoice ${editingInvoice.invoice_number} • ${editingInvoice.customer_name}`}
                onRequestDelete={() => setDeletingInvoice(editingInvoice)}
                onClose={() => setIsEditModalOpen(false)}
                deleteLabel="Delete"
              />

              {(() => {
                const totalAmt = Number(editingInvoice.total || 0)
                const paidAmt = Number(editingInvoice.amount_paid || 0)
                const dueAmt = Number(Math.max(0, totalAmt - paidAmt).toFixed(2))
                const currentInputAmt = parseFloat(editPayAmount) || 0
                const newRemaining = Number(Math.max(0, dueAmt - currentInputAmt).toFixed(2))
                const newPct = totalAmt > 0 ? Math.min(100, Math.round(((paidAmt + currentInputAmt) / totalAmt) * 100)) : 0

                return (
                  <form onSubmit={handleSaveEditInvoice} className="space-y-4 text-xs">
                    {/* Financial Summary KPI Block */}
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Invoiced</span>
                          <span className="font-mono text-xs font-black text-zinc-900">ETB {money(totalAmt)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase block">Already Paid</span>
                          <span className="font-mono text-xs font-black text-emerald-700">ETB {money(paidAmt)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                          <span className="text-[10px] font-bold text-rose-600 uppercase block">Current Due</span>
                          <span className="font-mono text-xs font-black text-rose-700">ETB {money(dueAmt)}</span>
                        </div>
                      </div>

                      {/* Live Readout */}
                      <div className="pt-2 border-t border-zinc-200 flex items-center justify-between font-bold">
                        <span className="text-zinc-600">Remaining after this payment:</span>
                        <span className={`font-mono text-sm font-black ${newRemaining <= 0 ? "text-emerald-700" : "text-zinc-900"}`}>
                          ETB {money(newRemaining)} ({newPct}%)
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-bold text-zinc-700">Installment Payment Amount (ETB) *</label>
                        <button
                          type="button"
                          onClick={() => setEditPayAmount(String(dueAmt))}
                          className="text-[11px] font-black text-blue-700 hover:underline cursor-pointer"
                        >
                          Pay Full Due (ETB {money(dueAmt)})
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={dueAmt}
                        value={editPayAmount}
                        onChange={(e) => setEditPayAmount(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-sm font-black text-zinc-900 outline-none"
                        placeholder="e.g. 25000"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-zinc-700 mb-1 block">Payment Date</label>
                        <input
                          type="date"
                          value={editPayDate}
                          onChange={(e) => setEditPayDate(e.target.value)}
                          className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-zinc-700 mb-1 block">Deposit Bank Account</label>
                        <select
                          value={editPayBank}
                          onChange={(e) => setEditPayBank(e.target.value)}
                          className="w-full p-2 rounded-xl border border-zinc-200 bg-zinc-50 font-semibold cursor-pointer"
                        >
                          {bankAccounts.map((a) => (
                            <option key={a.id} value={a.code}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Bank Transaction / Slip Reference No</label>
                      <input
                        type="text"
                        value={editPayRef}
                        onChange={(e) => setEditPayRef(e.target.value)}
                        placeholder="e.g. CBE-TXN-12849"
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono font-bold"
                      />
                    </div>

                    {/* Payment Advice Receipt Attachment */}
                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Attach Payment Advice Receipt</label>
                      <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-zinc-300 hover:border-zinc-400 rounded-xl cursor-pointer bg-zinc-50/60 hover:bg-zinc-50 transition-colors">
                        <Upload className="size-4 text-zinc-400 mb-1" />
                        <span className="text-xs font-bold text-zinc-700">
                          {editAdviceFile ? editAdviceFile.name : "Choose bank slip (PDF, PNG, JPG)"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setEditAdviceFile(e.target.files[0])
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="font-bold text-zinc-700 mb-1 block">Notes / Remarks</label>
                      <textarea
                        rows={2}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Optional billing or payment installment remarks..."
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium resize-none"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2 border-t border-zinc-100">
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSavingEdit ? <LoadingDots color="bg-white" size="sm" /> : <>Save & Record <ArrowRight className="size-3.5" /></>}
                      </button>
                    </div>
                  </form>
                )
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <RecordDeleteModal
        isOpen={!!deletingInvoice}
        title="Delete Sales Invoice"
        description={`Are you sure you want to delete invoice ${deletingInvoice?.invoice_number}? This cannot be undone.`}
        onClose={() => setDeletingInvoice(null)}
        onConfirmDelete={handleConfirmDeleteInvoice}
      />

      {/* Document preview modal */}
      <DocumentPreviewModal
        isOpen={!!previewDocUrl}
        onClose={() => setPreviewDocUrl("")}
        fileUrl={previewDocUrl}
        fileName={previewDocName}
      />

      {/* Export / Print Modal */}
      <InvoicePrintModal
        isOpen={!!printingInvoice}
        invoice={printingInvoice}
        onClose={() => setPrintingInvoice(null)}
      />

      {/* Create Invoice Slide-Over Drawer */}
      <AnimatePresence>
        {showCreateDrawer && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateDrawer(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl border-l border-zinc-200 overflow-y-auto"
            >
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">New Document</span>
                    <h2 className="text-xl font-black text-black">Create Sales Invoice</h2>
                  </div>
                  <button
                    onClick={() => setShowCreateDrawer(false)}
                    className="p-1.5 rounded-full hover:bg-zinc-100 text-gray-400 hover:text-black transition-colors cursor-pointer"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <form className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={invNumber}
                        onChange={(e) => setInvNumber(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Customer Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Corporation"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-bold text-black focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Issue Date</label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-bold text-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-bold text-black focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tax Schedule</label>
                      <select
                        value={selectedTaxScheduleId}
                        onChange={(e) => setSelectedTaxScheduleId(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-bold text-black focus:outline-none cursor-pointer"
                      >
                        {taxSchedules.map((sch) => (
                          <option key={sch.id} value={sch.id}>
                            {sch.name} ({sch.appliesTo})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Payment Terms</label>
                      <select
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-bold text-black focus:outline-none cursor-pointer"
                      >
                        <option value="Credit">Credit (Installment)</option>
                        <option value="Immediate">Immediate Cash</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 15">Net 15 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Discount Amount</label>
                      <input
                        type="number"
                        min="0"
                        value={discountVal}
                        onChange={(e) => setDiscountVal(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-black focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Dynamic Line Items */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Line Items</label>
                      <button
                        type="button"
                        onClick={handleAddLineItem}
                        className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="size-3" /> Add Item
                      </button>
                    </div>

                    <div className="space-y-2">
                      {newItems.map((item, idx) => (
                        <div key={idx} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                          <input
                            type="text"
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(idx, "description", e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold text-black focus:outline-none"
                          />
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                              className="w-20 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-black focus:outline-none"
                            />
                            <input
                              type="number"
                              placeholder="Unit Price"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateItem(idx, "unit_price", e.target.value)}
                              className="flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-black focus:outline-none"
                            />
                            <span className="text-xs font-mono font-bold text-black w-24 text-right">
                              ETB {item.line_total.toFixed(2)}
                            </span>
                            {newItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="text-gray-400 hover:text-red-500 cursor-pointer"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calculations readout */}
                  <div className="p-3 rounded-xl bg-black/[0.02] border border-black/5 text-xs space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Gross Line Subtotal</span>
                      <span className="font-mono">{currency} {subtotalCalc.toFixed(2)}</span>
                    </div>
                    {discountCalc > 0 && (
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>Discount</span>
                        <span className="font-mono">-{currency} {discountCalc.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-500">
                      <span>Tax Amount ({taxRateNum}%)</span>
                      <span className="font-mono">{currency} {taxCalc.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black text-black pt-1 border-t border-black/5 text-sm">
                      <span>Total Payable</span>
                      <span className="font-mono">{currency} {totalCalc.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleCreateInvoiceSubmit(e, "Draft")}
                      className="px-3 py-2.5 border border-zinc-300 hover:bg-zinc-100 rounded-xl text-xs font-bold text-black uppercase cursor-pointer"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateDrawer(false)}
                      className="px-3 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-gray-500 uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleCreateInvoiceSubmit(e, "Sent")}
                      className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase shadow-lg shadow-black/10 cursor-pointer"
                    >
                      Issue & Post Invoice
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
