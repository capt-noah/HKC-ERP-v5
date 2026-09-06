import { useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, 
  X, 
  Pencil, 
  Upload, 
  Paperclip, 
  Eye, 
  Download,
  Check,
  ChevronDown,
  FileCheck,
  Building2
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, type PurchaseOrder, type PurchaseOrderAttachment } from "@/lib/erpStore"
import { useFeedback } from "@/context/FeedbackContext"
import { DataTable } from "@/components/DataTable"
import { type TableColumn } from "@/components/ResizableTable"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { numberToBirrWords } from "@/lib/numberToWords"
import PurchaseOrderPrintModal from "@/components/purchase/PurchaseOrderPrintModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { ETHIOPIAN_BANKS } from "@/lib/ethiopianBanks"

const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

export default function PurchaseOrders() {
  const { showToast } = useFeedback()
  const erp = useErpStore()
  const isLoading = erp.isLoading()

  const purchaseOrders = erp.getPurchaseOrders()

  // Filter & Search State
  const [filterTab, setFilterTab] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null)
  const [deletingPo, setDeletingPo] = useState<PurchaseOrder | null>(null)
  const [printingPo, setPrintingPo] = useState<PurchaseOrder | null>(null)
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false)
  const [isSavingEditVoucher, setIsSavingEditVoucher] = useState(false)

  // Document Preview State
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewName, setPreviewName] = useState("")

  // Voucher Form State
  const [voucherNo, setVoucherNo] = useState("")
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0])
  const [paidTo, setPaidTo] = useState("")
  const [reasonForPayment, setReasonForPayment] = useState("")
  const [bankName, setBankName] = useState<string>("Commercial Bank of Ethiopia (CBE)")
  const [paymentMethod, setPaymentMethod] = useState<"Cheque" | "Bank Transfer" | "RTGS">("Cheque")
  const [chequeNo, setChequeNo] = useState("")
  const [paidAmount, setPaidAmount] = useState<number | "">("")
  const [status, setStatus] = useState<"PAID" | "DRAFT">("PAID")

  // Combobox Dropdown States & Refs
  const [showCreateBankDropdown, setShowCreateBankDropdown] = useState(false)
  const [showEditBankDropdown, setShowEditBankDropdown] = useState(false)
  const createBankRef = useRef<HTMLDivElement>(null)
  const editBankRef = useRef<HTMLDivElement>(null)

  // Dedicated Payment Advice (Mandatory for PAID status)
  const [paymentAdvice, setPaymentAdvice] = useState<PurchaseOrderAttachment | null>(null)

  // Optional Supporting Attachments
  const [attachments, setAttachments] = useState<PurchaseOrderAttachment[]>([])

  // Close bank dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createBankRef.current && !createBankRef.current.contains(e.target as Node)) {
        setShowCreateBankDropdown(false)
      }
      if (editBankRef.current && !editBankRef.current.contains(e.target as Node)) {
        setShowEditBankDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Table Columns
  const defaultColWidths: Record<string, number> = {
    voucherNo: 175,
    date: 105,
    paidTo: 180,
    bankName: 170,
    paymentMethod: 120,
    chequeNo: 130,
    amount: 145,
    adviceStatus: 135,
    supportingStatus: 140,
    status: 100,
    _actions: 140,
  }

  const columns: TableColumn[] = [
    { key: "voucherNo", label: "Cheque Payment Voucher", align: "left" },
    { key: "date", label: "Date", align: "left" },
    { key: "paidTo", label: "Paid To", align: "left" },
    { key: "bankName", label: "Bank", align: "left" },
    { key: "paymentMethod", label: "Method", align: "left" },
    { key: "chequeNo", label: "Cheque / Ref", align: "left" },
    { key: "amount", label: "Amount (ETB)", align: "right" },
    { key: "adviceStatus", label: "Payment Advice", align: "center", noSort: true },
    { key: "supportingStatus", label: "Supporting Docs", align: "center", noSort: true },
    { key: "status", label: "Status", align: "center" },
    { key: "_actions", label: "Action", align: "center", noSort: true },
  ]

  // Filtered List
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // Filter tab
      if (filterTab === "PAID" && po.status !== "PAID" && po.status !== "COMPLETED") return false
      if (filterTab === "DRAFT" && (po.status === "PAID" || po.status === "COMPLETED")) return false

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchVoucher = (po.voucherNo || po.poNumber || "").toLowerCase().includes(query)
        const matchPaidTo = (po.paidTo || po.supplier || "").toLowerCase().includes(query)
        const matchReason = (po.reasonForPayment || po.category || "").toLowerCase().includes(query)
        const matchCheque = (po.chequeNo || "").toLowerCase().includes(query)
        const matchBank = (po.bankName || "").toLowerCase().includes(query)
        const matchMethod = (po.paymentMethod || "").toLowerCase().includes(query)
        if (!matchVoucher && !matchPaidTo && !matchReason && !matchCheque && !matchBank && !matchMethod) return false
      }

      return true
    })
  }, [purchaseOrders, filterTab, searchQuery])

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setVoucherNo("")
    setVoucherDate(new Date().toISOString().split("T")[0])
    setPaidTo("")
    setReasonForPayment("")
    setBankName("Commercial Bank of Ethiopia (CBE)")
    setPaymentMethod("Cheque")
    setChequeNo("")
    setPaidAmount("")
    setStatus("PAID")
    setPaymentAdvice(null)
    setAttachments([])
    setEditingPo(null)
    setIsCreateModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (po: PurchaseOrder) => {
    setEditingPo(po)
    setVoucherNo(po.voucherNo || po.poNumber)
    setVoucherDate(po.date || new Date().toISOString().split("T")[0])
    setPaidTo(po.paidTo || po.supplier || "")
    setReasonForPayment(po.reasonForPayment || po.category || "")
    setBankName(po.bankName || "Commercial Bank of Ethiopia (CBE)")
    setPaymentMethod((po.paymentMethod as any) || "Cheque")
    setChequeNo(po.chequeNo || "")
    setPaidAmount(po.amount || "")
    setStatus((po.status === "PAID" || po.status === "COMPLETED") ? "PAID" : "DRAFT")

    // Process payment advice
    if (po.paymentAdviceAttachment) {
      setPaymentAdvice(po.paymentAdviceAttachment)
    } else {
      setPaymentAdvice(null)
    }

    // Process optional attachments
    if (Array.isArray(po.attachments)) {
      const parsedAttachments: PurchaseOrderAttachment[] = po.attachments.map((att, idx) => {
        if (typeof att === "string") {
          return {
            id: `att-${idx}`,
            name: `Attachment ${idx + 1}`,
            size: 102400,
            url: att,
            uploadedAt: new Date().toISOString(),
          }
        }
        return att
      })
      setAttachments(parsedAttachments)
    } else {
      setAttachments([])
    }

    setIsEditModalOpen(true)
  }

  // Payment Advice Upload Handler
  const handlePaymentAdviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const newAdvice: PurchaseOrderAttachment = {
        id: `adv-${Date.now()}`,
        name: file.name,
        size: file.size,
        url: event.target?.result as string,
        uploadedAt: new Date().toISOString(),
      }
      setPaymentAdvice(newAdvice)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  // Supporting Files Upload Handler
  const handleSupportingFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const newAttachment: PurchaseOrderAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          url: event.target?.result as string,
          uploadedAt: new Date().toISOString(),
        }
        setAttachments((prev) => [...prev, newAttachment])
      }
      reader.readAsDataURL(file)
    })

    e.target.value = ""
  }

  const handleRemoveSupportingAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // Save Create Voucher
  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingVoucher) return

    if (!voucherNo.trim()) {
      showToast("Missing Information", "warning", "Please enter Cheque Payment Voucher number.")
      return
    }

    if (!paidTo.trim()) {
      showToast("Missing Information", "warning", "Please enter Paid To.")
      return
    }

    if (!bankName.trim()) {
      showToast("Missing Information", "warning", "Please select or enter the issuing Bank.")
      return
    }

    const numericAmount = Number(paidAmount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast("Invalid Amount", "warning", "Please enter a valid paid amount.")
      return
    }

    if (status === "PAID" && !paymentAdvice) {
      showToast("Payment Advice Required", "warning", "Please attach the Payment Advice document before saving a Paid voucher.")
      return
    }

    const amountInWords = numberToBirrWords(numericAmount)

    const newPo: PurchaseOrder = {
      id: `PO-${Date.now().toString().slice(-4)}`,
      poNumber: voucherNo.trim(),
      voucherNo: voucherNo.trim(),
      date: voucherDate,
      paidTo: paidTo.trim(),
      supplier: paidTo.trim(),
      reasonForPayment: reasonForPayment.trim(),
      bankName: bankName.trim(),
      paymentMethod,
      chequeNo: chequeNo.trim(),
      amount: numericAmount,
      amountInWords,
      currency: "ETB",
      status,
      statusColor: status === "PAID" ? "bg-emerald-500" : "bg-amber-500",
      paymentAdviceAttachment: paymentAdvice,
      attachments,
    }
    try {
      setIsSubmittingVoucher(true)
      erp.addPurchaseOrder(newPo)
      showToast(
        "Voucher Created",
        "success",
        status === "PAID"
          ? `Cheque Payment Voucher ${voucherNo} has been registered and posted.`
          : `Cheque Payment Voucher ${voucherNo} saved as Draft.`
      )
      setIsCreateModalOpen(false)
    } catch (err) {
      showToast("Create Failed", "warning", "Could not create cheque payment voucher.")
    } finally {
      setIsSubmittingVoucher(false)
    }
  }

  // Save Edit Voucher
  const handleSaveEditVoucher = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPo || isSavingEditVoucher) return

    if (!voucherNo.trim()) {
      showToast("Missing Information", "warning", "Please enter Cheque Payment Voucher number.")
      return
    }

    if (!paidTo.trim()) {
      showToast("Missing Information", "warning", "Please enter Paid To.")
      return
    }

    if (!bankName.trim()) {
      showToast("Missing Information", "warning", "Please select or enter the issuing Bank.")
      return
    }

    const numericAmount = Number(paidAmount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast("Invalid Amount", "warning", "Please enter a valid paid amount.")
      return
    }

    if (status === "PAID" && !paymentAdvice) {
      showToast("Payment Advice Required", "warning", "Please attach the Payment Advice document before saving a Paid voucher.")
      return
    }

    const amountInWords = numberToBirrWords(numericAmount)

    try {
      setIsSavingEditVoucher(true)
      erp.updatePurchaseOrder(editingPo.id, {
        voucherNo: voucherNo.trim(),
        poNumber: voucherNo.trim(),
        date: voucherDate,
        paidTo: paidTo.trim(),
        supplier: paidTo.trim(),
        reasonForPayment: reasonForPayment.trim(),
        bankName: bankName.trim(),
        paymentMethod,
        chequeNo: chequeNo.trim(),
        amount: numericAmount,
        amountInWords,
        status,
        statusColor: status === "PAID" ? "bg-emerald-500" : "bg-amber-500",
        paymentAdviceAttachment: paymentAdvice,
        attachments,
      })
      showToast(
        "Voucher Updated",
        "success",
        status === "PAID"
          ? `Cheque Payment Voucher ${voucherNo} updated and posted.`
          : `Cheque Payment Voucher ${voucherNo} updated.`
      )
      setIsEditModalOpen(false)
    } catch (err) {
      showToast("Update Failed", "warning", "Could not update payment voucher.")
    } finally {
      setIsSavingEditVoucher(false)
    }
  }

  // Delete Voucher
  const handleConfirmDelete = () => {
    if (!deletingPo) return
    erp.deletePurchaseOrder(deletingPo.id)
    showToast("Voucher Deleted", "success", `Payment voucher ${deletingPo.voucherNo || deletingPo.poNumber} has been removed.`)
    setDeletingPo(null)
    setIsEditModalOpen(false)
  }

  return (
    <div className="min-h-screen page-gradient">
      <FloatingNav brand="HKC Trading ERP" sections={navSections} />

      <motion.div variants={fade} initial="hidden" animate="visible" className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Top Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-black tracking-tight">Purchase Orders & Cheque Vouchers</h1>
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Manage procurement payment vouchers, bank details, payment advices, and supporting documents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("/sales")} />
          </div>
        </div>

        {/* PURCHASE ORDERS REGISTER */}
        <DataTable<PurchaseOrder>
          title="Cheque Payment Vouchers Register"
          subtitle={`Total: ${filteredPurchaseOrders.length} cheque payment vouchers`}
          columns={columns}
          data={filteredPurchaseOrders}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search voucher no, paid to, bank, method, cheque ref..."
          filters={[
            {
              value: filterTab,
              onChange: setFilterTab,
              ariaLabel: "Filter by Status",
              options: [
                { value: "ALL", label: "All Vouchers" },
                { value: "PAID", label: "Paid" },
                { value: "DRAFT", label: "Draft" },
              ],
            },
          ]}
          actions={[
            {
              label: "New Cheque Voucher",
              onClick: handleOpenCreateModal,
              icon: <Plus className="size-4" />,
              variant: "primary",
            },
          ]}
          defaultWidths={defaultColWidths}
          keyExtractor={(po) => po.id}
          renderRow={(po: PurchaseOrder, colWidths: Record<string, number>) => (
            <>
              {/* Voucher ID */}
              <td style={{ width: `${colWidths.voucherNo}px` }} className="py-4 px-4 font-mono font-black text-xs text-zinc-950 overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{po.voucherNo || po.poNumber}</span>
                </div>
              </td>

              {/* Date */}
              <td style={{ width: `${colWidths.date}px` }} className="py-4 px-4 text-xs font-semibold text-zinc-600 overflow-hidden">
                {po.date}
              </td>

              {/* Paid To */}
              <td style={{ width: `${colWidths.paidTo}px` }} className="py-4 px-4 overflow-hidden">
                <div className="font-black text-zinc-950 text-xs truncate" title={po.paidTo || po.supplier}>
                  {po.paidTo || po.supplier}
                </div>
                {po.reasonForPayment && (
                  <div className="text-[11px] font-medium text-zinc-500 truncate" title={po.reasonForPayment}>
                    {po.reasonForPayment}
                  </div>
                )}
              </td>

              {/* Bank */}
              <td style={{ width: `${colWidths.bankName}px` }} className="py-4 px-4 overflow-hidden">
                <span className="text-xs font-bold text-zinc-800 truncate block" title={po.bankName || "Commercial Bank of Ethiopia (CBE)"}>
                  {po.bankName || "Commercial Bank of Ethiopia (CBE)"}
                </span>
              </td>

              {/* Payment Method */}
              <td style={{ width: `${colWidths.paymentMethod}px` }} className="py-4 px-4 overflow-hidden">
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-zinc-100 text-zinc-800 border border-zinc-200">
                  {po.paymentMethod || "Cheque"}
                </span>
              </td>

              {/* Cheque / Ref No. */}
              <td style={{ width: `${colWidths.chequeNo}px` }} className="py-4 px-4 overflow-hidden">
                <span className="font-mono text-xs font-bold text-zinc-700">
                  {po.chequeNo || "—"}
                </span>
              </td>

              {/* Paid Amount */}
              <td style={{ width: `${colWidths.amount}px` }} className="py-4 px-4 text-right font-mono text-xs overflow-hidden">
                <div className="font-black text-zinc-950">
                  ETB {Number(po.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </td>

              {/* Payment Advice Status */}
              <td style={{ width: `${colWidths.adviceStatus}px` }} className="py-4 px-4 text-center overflow-hidden">
                {po.paymentAdviceAttachment ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewUrl(po.paymentAdviceAttachment!.url)
                      setPreviewName(po.paymentAdviceAttachment!.name)
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition-colors cursor-pointer"
                    title="Preview Payment Advice"
                  >
                    <FileCheck className="size-3 text-emerald-700" /> Attached
                  </button>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
                    None
                  </span>
                )}
              </td>

              {/* Supporting Documents Status */}
              <td style={{ width: `${colWidths.supportingStatus}px` }} className="py-4 px-4 text-center overflow-hidden">
                {Array.isArray(po.attachments) && po.attachments.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Paperclip className="size-3 text-emerald-700" /> Attached ({po.attachments.length})
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-400 border border-zinc-200">
                    None
                  </span>
                )}
              </td>

              {/* Status */}
              <td style={{ width: `${colWidths.status}px` }} className="py-4 px-4 text-center overflow-hidden">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  po.status === "PAID" || po.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-amber-100 text-amber-900 border border-amber-200"
                }`}>
                  {po.status === "PAID" || po.status === "COMPLETED" ? "Paid" : "Draft"}
                </span>
              </td>

              {/* Actions */}
              <td style={{ width: `${colWidths._actions}px` }} className="py-4 px-4 text-center whitespace-nowrap overflow-hidden">
                <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(po)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                    title="Edit Voucher"
                  >
                    <Pencil className="size-3 text-zinc-700" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintingPo(po)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                    title="Export Payment Voucher"
                  >
                    <Download className="size-3 text-zinc-700" /> Export
                  </button>
                </div>
              </td>
            </>
          )}
        />
      </motion.div>

      {/* MODAL: CREATE CHEQUE PAYMENT VOUCHER */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 bg-white rounded-3xl p-6 max-w-4xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-950 mb-0.5">Create Cheque Payment Voucher</h2>
                  <p className="text-xs font-semibold text-zinc-500">Record a cheque payment voucher with Ethiopian issuing bank, payment method, advice slip, and supporting attachments.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                  title="Close modal"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleCreateVoucher} className="space-y-4">
                {/* Top Section Fields */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Row 1: Cheque Payment Voucher No (4 cols), Date (4 cols), Status (4 cols) */}
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Cheque Payment Voucher *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 00004375"
                      value={voucherNo}
                      onChange={(e) => setVoucherNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none font-mono"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "PAID" | "DRAFT")}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    >
                      <option value="PAID">Paid (Post to GL)</option>
                      <option value="DRAFT">Draft</option>
                    </select>
                  </div>

                  {/* Row 2: Paid To (6 cols), Reason for Payment (6 cols) */}
                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Paid To *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Oil Ethiopia NOC / Addis Transport"
                      value={paidTo}
                      onChange={(e) => setPaidTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Reason for Payment *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Warehouse Rent / Fleet Fuel & Maintenance"
                      value={reasonForPayment}
                      onChange={(e) => setReasonForPayment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                {/* BANK & PAYMENT DETAILS (Replaces Account Distribution Section) */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/70 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-xs text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-zinc-600" />
                        Bank & Payment Information
                      </h4>
                      <p className="text-[10px] text-zinc-500">Select issuing bank in Ethiopia, payment method, amount paid, and cheque/ref number.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Bank Selection (Combobox: Searchable Dropdown + Typed Input) */}
                    <div className="md:col-span-6 relative" ref={createBankRef}>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Bank (Which Bank) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Search or type bank name..."
                          value={bankName}
                          onFocus={() => setShowCreateBankDropdown(true)}
                          onChange={(e) => {
                            setBankName(e.target.value)
                            setShowCreateBankDropdown(true)
                          }}
                          className="w-full pl-3 pr-8 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreateBankDropdown((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>

                      {/* Matching Ethiopian Banks Dropdown */}
                      {showCreateBankDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-zinc-50">
                          {ETHIOPIAN_BANKS.filter((b) =>
                            b.toLowerCase().includes((bankName || "").toLowerCase())
                          ).map((bank) => (
                            <button
                              key={bank}
                              type="button"
                              onClick={() => {
                                setBankName(bank)
                                setShowCreateBankDropdown(false)
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span>{bank}</span>
                              {bankName === bank && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                            </button>
                          ))}
                          {ETHIOPIAN_BANKS.filter((b) =>
                            b.toLowerCase().includes((bankName || "").toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-xs text-zinc-400 italic">
                              Custom bank name "{bankName}" will be used.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment Method Dropdown */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Payment Method *
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="Cheque">Cheque</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="RTGS">RTGS</option>
                      </select>
                    </div>

                    {/* Amount Paid in figure */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Amount Paid in figure (ETB) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none"
                      />
                      {Number(paidAmount) > 0 && (
                        <div className="mt-1 text-[11px] text-emerald-800 font-semibold italic truncate">
                          {numberToBirrWords(Number(paidAmount))}
                        </div>
                      )}
                    </div>

                    {/* Cheque / Reference Number */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        {paymentMethod === "Cheque" ? "Cheque Number *" : `${paymentMethod} Reference Number *`}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={paymentMethod === "Cheque" ? "e.g. CHQ-009823" : "e.g. TXN-98421098"}
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* DEDICATED PAYMENT ADVICE ATTACHMENT (MANDATORY) */}
                <div className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-xs text-emerald-950 uppercase tracking-wider">
                          Payment Advice Attachment
                        </h4>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                          Mandatory for Paid
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-700">Attach bank confirmation, transfer advice slip, or scanned cheque.</p>
                    </div>
                  </div>

                  {paymentAdvice ? (
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <FileCheck className="size-4" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-zinc-900 truncate">{paymentAdvice.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono font-medium">
                            {(paymentAdvice.size / 1024).toFixed(1)} KB • Uploaded {new Date(paymentAdvice.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(paymentAdvice.url)
                            setPreviewName(paymentAdvice.name)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold cursor-pointer"
                        >
                          <Eye className="size-3.5" /> Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentAdvice(null)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                          title="Remove Advice"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-4 text-center transition-colors bg-white/90">
                      <input
                        type="file"
                        id="create-payment-advice-upload"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handlePaymentAdviceUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="create-payment-advice-upload"
                        className="cursor-pointer flex flex-col items-center justify-center gap-1"
                      >
                        <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                          <Upload className="size-4" />
                        </div>
                        <span className="text-xs font-bold text-emerald-950">
                          Click to upload Payment Advice (Receipt / Cheque Slip / Transfer Confirmation)
                        </span>
                        <span className="text-[10px] text-emerald-700">
                          PDF, PNG, JPG up to 15MB
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* SUPPORTING ATTACHMENTS SECTION (OPTIONAL) */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-xs text-zinc-900 uppercase tracking-wider">
                          Supporting Documents
                        </h4>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
                          Optional
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">Attach proforma invoices, supplier bills, delivery slips, or contracts.</p>
                    </div>
                    {attachments.length > 0 && (
                      <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                        {attachments.length} file{attachments.length === 1 ? "" : "s"} attached
                      </span>
                    )}
                  </div>

                  <div className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 rounded-2xl p-4 text-center transition-colors bg-white">
                    <input
                      type="file"
                      id="create-voucher-attachment"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleSupportingFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="create-voucher-attachment"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1"
                    >
                      <div className="size-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                        <Upload className="size-4" />
                      </div>
                      <span className="text-xs font-bold text-zinc-800">
                        Click to upload or drag & drop optional supporting files
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        Proformas, bills, delivery slips, invoices (PNG, JPG, PDF up to 10MB)
                      </span>
                    </label>
                  </div>

                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-zinc-200 text-[11px] font-semibold text-zinc-800 shadow-2xs"
                        >
                          <Paperclip className="size-3 text-zinc-500 shrink-0" />
                          <span className="truncate max-w-[160px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewUrl(file.url)
                              setPreviewName(file.name)
                            }}
                            className="text-blue-600 hover:text-blue-800 p-0.5 cursor-pointer"
                            title="Preview file"
                          >
                            <Eye className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSupportingAttachment(file.id)}
                            className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                            title="Remove file"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                  <button 
                    type="button" 
                    disabled={isSubmittingVoucher}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingVoucher}
                    className="min-w-[150px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {isSubmittingVoucher ? <LoadingDots color="bg-white" size="sm" /> : "Create Cheque Voucher"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT PAYMENT VOUCHER */}
      <AnimatePresence>
        {isEditModalOpen && editingPo && (
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
              className="relative z-10 bg-white rounded-3xl p-6 max-w-4xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[90vh]"
            >
              {/* Header with 3-Dot Options Dropdown */}
              <EditModalHeader
                title={`Edit Cheque Payment Voucher (${voucherNo})`}
                subtitle="Update payee, reason, bank details, payment method, advice slip, and supporting attachments."
                onClose={() => setIsEditModalOpen(false)}
                onRequestDelete={() => setDeletingPo(editingPo)}
                deleteLabel="Delete Payment Voucher"
              />

              <form onSubmit={handleSaveEditVoucher} className="space-y-4">
                {/* Top Section Fields */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Row 1: Voucher No (4 cols), Date (4 cols), Status (4 cols) */}
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Cheque Payment Voucher *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 00004375"
                      value={voucherNo}
                      onChange={(e) => setVoucherNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none font-mono"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "PAID" | "DRAFT")}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    >
                      <option value="PAID">Paid (Post to GL)</option>
                      <option value="DRAFT">Draft</option>
                    </select>
                  </div>

                  {/* Row 2: Paid To (6 cols), Reason for Payment (6 cols) */}
                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Paid To *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Oil Ethiopia NOC"
                      value={paidTo}
                      onChange={(e) => setPaidTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Reason for Payment *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Warehouse Rent / Fleet Fuel & Maintenance"
                      value={reasonForPayment}
                      onChange={(e) => setReasonForPayment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                {/* BANK & PAYMENT DETAILS (Replaces Account Distribution Section) */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/70 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-xs text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-zinc-600" />
                        Bank & Payment Information
                      </h4>
                      <p className="text-[10px] text-zinc-500">Select issuing bank in Ethiopia, payment method, amount paid, and cheque/ref number.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Bank Selection (Combobox: Searchable Dropdown + Typed Input) */}
                    <div className="md:col-span-6 relative" ref={editBankRef}>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Bank (Which Bank) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Search or type bank name..."
                          value={bankName}
                          onFocus={() => setShowEditBankDropdown(true)}
                          onChange={(e) => {
                            setBankName(e.target.value)
                            setShowEditBankDropdown(true)
                          }}
                          className="w-full pl-3 pr-8 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditBankDropdown((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>

                      {/* Matching Ethiopian Banks Dropdown */}
                      {showEditBankDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-zinc-50">
                          {ETHIOPIAN_BANKS.filter((b) =>
                            b.toLowerCase().includes((bankName || "").toLowerCase())
                          ).map((bank) => (
                            <button
                              key={bank}
                              type="button"
                              onClick={() => {
                                setBankName(bank)
                                setShowEditBankDropdown(false)
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span>{bank}</span>
                              {bankName === bank && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                            </button>
                          ))}
                          {ETHIOPIAN_BANKS.filter((b) =>
                            b.toLowerCase().includes((bankName || "").toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-xs text-zinc-400 italic">
                              Custom bank name "{bankName}" will be used.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment Method Dropdown */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Payment Method *
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="Cheque">Cheque</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="RTGS">RTGS</option>
                      </select>
                    </div>

                    {/* Amount Paid in figure */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Amount Paid in figure (ETB) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none"
                      />
                      {Number(paidAmount) > 0 && (
                        <div className="mt-1 text-[11px] text-emerald-800 font-semibold italic truncate">
                          {numberToBirrWords(Number(paidAmount))}
                        </div>
                      )}
                    </div>

                    {/* Cheque / Reference Number */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        {paymentMethod === "Cheque" ? "Cheque Number *" : `${paymentMethod} Reference Number *`}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={paymentMethod === "Cheque" ? "e.g. CHQ-009823" : "e.g. TXN-98421098"}
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* DEDICATED PAYMENT ADVICE ATTACHMENT (MANDATORY) */}
                <div className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-xs text-emerald-950 uppercase tracking-wider">
                          Payment Advice Attachment
                        </h4>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                          Mandatory for Paid
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-700">Attach bank confirmation, transfer advice slip, or scanned cheque.</p>
                    </div>
                  </div>

                  {paymentAdvice ? (
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <FileCheck className="size-4" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-zinc-900 truncate">{paymentAdvice.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono font-medium">
                            {(paymentAdvice.size / 1024).toFixed(1)} KB • Uploaded {new Date(paymentAdvice.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(paymentAdvice.url)
                            setPreviewName(paymentAdvice.name)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold cursor-pointer"
                        >
                          <Eye className="size-3.5" /> Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentAdvice(null)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                          title="Remove Advice"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-4 text-center transition-colors bg-white/90">
                      <input
                        type="file"
                        id="edit-payment-advice-upload"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handlePaymentAdviceUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="edit-payment-advice-upload"
                        className="cursor-pointer flex flex-col items-center justify-center gap-1"
                      >
                        <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                          <Upload className="size-4" />
                        </div>
                        <span className="text-xs font-bold text-emerald-950">
                          Click to upload Payment Advice (Receipt / Cheque Slip / Transfer Confirmation)
                        </span>
                        <span className="text-[10px] text-emerald-700">
                          PDF, PNG, JPG up to 15MB
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* SUPPORTING ATTACHMENTS SECTION (OPTIONAL) */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-xs text-zinc-900 uppercase tracking-wider">
                          Supporting Documents
                        </h4>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
                          Optional
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">Attach proforma invoices, supplier bills, delivery slips, or contracts.</p>
                    </div>
                    {attachments.length > 0 && (
                      <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                        {attachments.length} file{attachments.length === 1 ? "" : "s"} attached
                      </span>
                    )}
                  </div>

                  <div className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 rounded-2xl p-4 text-center transition-colors bg-white">
                    <input
                      type="file"
                      id="edit-voucher-attachment"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleSupportingFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="edit-voucher-attachment"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1"
                    >
                      <div className="size-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                        <Upload className="size-4" />
                      </div>
                      <span className="text-xs font-bold text-zinc-800">
                        Click to upload or drag & drop optional supporting files
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        Proformas, bills, delivery slips, invoices (PNG, JPG, PDF up to 10MB)
                      </span>
                    </label>
                  </div>

                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-zinc-200 text-[11px] font-semibold text-zinc-800 shadow-2xs"
                        >
                          <Paperclip className="size-3 text-zinc-500 shrink-0" />
                          <span className="truncate max-w-[160px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewUrl(file.url)
                              setPreviewName(file.name)
                            }}
                            className="text-blue-600 hover:text-blue-800 p-0.5 cursor-pointer"
                            title="Preview file"
                          >
                            <Eye className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSupportingAttachment(file.id)}
                            className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                            title="Remove file"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                  <button 
                    type="button" 
                    disabled={isSavingEditVoucher}
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingEditVoucher}
                    className="min-w-[150px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {isSavingEditVoucher ? <LoadingDots color="bg-white" size="sm" /> : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD DELETE CONFIRMATION MODAL */}
      <RecordDeleteModal
        isOpen={!!deletingPo}
        onClose={() => setDeletingPo(null)}
        onConfirmDelete={handleConfirmDelete}
        title="Delete Cheque Payment Voucher"
        recordName={deletingPo?.voucherNo || deletingPo?.poNumber || "this voucher"}
        description="This action will permanently delete this cheque payment voucher."
      />

      {/* PRINTABLE OFFICIAL VOUCHER SLIP MODAL */}
      <PurchaseOrderPrintModal
        isOpen={!!printingPo}
        po={printingPo}
        onClose={() => setPrintingPo(null)}
      />

      {/* DOCUMENT / FILE PREVIEW MODAL */}
      <DocumentPreviewModal
        isOpen={!!previewUrl}
        onClose={() => {
          setPreviewUrl("")
          setPreviewName("")
        }}
        fileUrl={previewUrl}
        fileName={previewName}
      />
    </div>
  )
}
