import { useState, useMemo, useRef, useEffect } from "react"
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
  Receipt,
  RotateCw,
  AlertCircle,
} from "lucide-react"
import { FloatingNav } from "@/components/FloatingNav"
import { SubPageNav } from "@/components/SubPageNav"
import { navSections, getSectionChildren } from "@/lib/nav-config"
import { useErpStore, type PurchaseOrder, type PurchaseOrderAttachment } from "@/lib/erpStore"
import { useFinanceStore } from "@/lib/financeStore"
import { useFeedback } from "@/context/FeedbackContext"
import { DataTable } from "@/components/DataTable"
import { type TableColumn } from "@/components/ResizableTable"
import { EditModalHeader } from "@/components/EditModalHeader"
import { RecordDeleteModal } from "@/components/RecordDeleteModal"
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal"
import { numberToBirrWords } from "@/lib/numberToWords"
import PurchaseOrderPrintModal from "@/components/purchase/PurchaseOrderPrintModal"
import PurchaseOrderGLSplitModal from "@/components/purchase/PurchaseOrderGLSplitModal"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { uploadFile, uploadFilesConcurrently } from "@/lib/fileUpload"
import COAAccountSelector from "@/components/finance/COAAccountSelector"
import PurchaseCOASplitSection, { type SplitLineItem } from "@/components/purchase/PurchaseCOASplitSection"
import { 
  PURCHASE_OPERATIONAL_CATEGORIES, 
  resolvePurchaseAccountsFromMatrix 
} from "@/lib/purchaseAccountDefaults"

export default function PurchaseOrders() {
  const { showToast } = useFeedback()
  const erp = useErpStore()
  const financeStore = useFinanceStore()
  const isLoading = erp.isLoading()

  const purchaseOrders = erp.getPurchaseOrders()
  const suppliers = erp.getSuppliers()

  // Filter & Search State
  const [filterTab, setFilterTab] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null)
  const [deletingPo, setDeletingPo] = useState<PurchaseOrder | null>(null)
  const [printingPo, setPrintingPo] = useState<PurchaseOrder | null>(null)
  const [splitPo, setSplitPo] = useState<PurchaseOrder | null>(null)
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false)
  const [isSavingEditVoucher, setIsSavingEditVoucher] = useState(false)

  // Installment Payment Modal State
  const [payingPo, setPayingPo] = useState<PurchaseOrder | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0])
  const [payBank, setPayBank] = useState("1000-02-26")
  const [payMethod, setPayMethod] = useState("Bank Transfer")
  const [payRef, setPayRef] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [payAdviceFile, setPayAdviceFile] = useState<File | null>(null)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  // Document Preview State
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewName, setPreviewName] = useState("")

  // Voucher Form State
  const [voucherNo, setVoucherNo] = useState("")
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0])
  const [paidTo, setPaidTo] = useState("")
  const [reasonForPayment, setReasonForPayment] = useState("")
  const [operationalCategory, setOperationalCategory] = useState<string>("freight_transport")
  const [bankName, setBankName] = useState<string>("Commercial Bank of Ethiopia (CBE)")
  const [paymentMethod, setPaymentMethod] = useState<"Cheque" | "Bank Transfer" | "RTGS" | "Cash">("Cheque")
  const [chequeNo, setChequeNo] = useState("")
  const [paidAmount, setPaidAmount] = useState<number | "">("")
  const [paymentType, setPaymentType] = useState<"Cash" | "Credit">("Cash")
  const [status, setStatus] = useState<"PAID" | "DRAFT">("PAID")

  // Multiline COA Debit & Credit state for Create & Edit Voucher modals
  const [modalDebitLines, setModalDebitLines] = useState<SplitLineItem[]>([])
  const [modalCreditLines, setModalCreditLines] = useState<SplitLineItem[]>([])

  // Combobox Dropdown States & Refs
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const supplierRef = useRef<HTMLDivElement>(null)

  // Dedicated Payment Advice (Optional)
  const [paymentAdvice, setPaymentAdvice] = useState<PurchaseOrderAttachment | null>(null)
  const [isUploadingPaymentAdvice, setIsUploadingPaymentAdvice] = useState(false)

  // Optional Supporting Attachments
  interface FailedSupportingUpload {
    id: string
    file: File
    error: string
  }
  const [attachments, setAttachments] = useState<PurchaseOrderAttachment[]>([])
  const [isUploadingSupporting, setIsUploadingSupporting] = useState(false)
  const [supportingUploadStatus, setSupportingUploadStatus] = useState("")
  const [failedSupportingUploads, setFailedSupportingUploads] = useState<FailedSupportingUpload[]>([])
  const [retryingSupportingId, setRetryingSupportingId] = useState<string | null>(null)

  // Load ERP inventory, sales data, and finance data on mount / page refresh
  useEffect(() => {
    void erp.loadInventoryData()
    void erp.loadSalesData()
    void financeStore.loadFromApi()
  }, [])

  // Close supplier dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Table Columns
  const defaultColWidths: Record<string, number> = {
    voucherNo: 160,
    date: 100,
    paidTo: 170,
    coaAccounts: 180,
    bankName: 150,
    paymentMethod: 110,
    chequeNo: 120,
    amount: 140,
    adviceStatus: 125,
    supportingStatus: 130,
    status: 160,
    _actions: 270,
  }

  const columns: TableColumn[] = [
    { key: "voucherNo", label: "Voucher / PO Ref", align: "left" },
    { key: "date", label: "Date", align: "left" },
    { key: "paidTo", label: "Supplier / Paid To", align: "left" },
    { key: "coaAccounts", label: "COA Routing", align: "left" },
    { key: "bankName", label: "Bank / Source", align: "left" },
    { key: "paymentMethod", label: "Method", align: "left" },
    { key: "chequeNo", label: "Cheque / Ref", align: "left" },
    { key: "amount", label: "Amount (ETB)", align: "right" },
    { key: "adviceStatus", label: "Payment Advice", align: "center", noSort: true },
    { key: "supportingStatus", label: "Supporting Docs", align: "center", noSort: true },
    { key: "status", label: "Status / Settlement", align: "center" },
    { key: "_actions", label: "Action", align: "center", noSort: true },
  ]

  // Filtered List
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const isCredit = (po.paymentType || po.payment_type) === "Credit"
      const totalVal = Number(po.amount || 0)
      const paidVal = isCredit ? Number(po.amountPaid ?? po.amount_paid ?? 0) : totalVal
      const dueVal = isCredit ? (typeof po.balanceDue === "number" ? po.balanceDue : Math.max(0, totalVal - paidVal)) : 0
      const isSettled = !isCredit ? (po.status === "PAID" || po.status === "COMPLETED") : (dueVal <= 0.01 || po.settlementStatus === "Fully Settled")

      // Filter tab
      if (filterTab === "PAID" && !isSettled) return false
      if (filterTab === "CREDIT" && (!isCredit || isSettled)) return false
      if (filterTab === "DRAFT" && po.status !== "DRAFT") return false

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchVoucher = (po.voucherNo || po.poNumber || "").toLowerCase().includes(query)
        const matchPaidTo = (po.paidTo || po.supplier || "").toLowerCase().includes(query)
        const matchReason = (po.reasonForPayment || po.category || "").toLowerCase().includes(query)
        const matchCheque = (po.chequeNo || "").toLowerCase().includes(query)
        const matchBank = (po.bankName || po.creditAccountName || "").toLowerCase().includes(query)
        const matchMethod = (po.paymentMethod || "").toLowerCase().includes(query)
        const matchDebitCoa = (po.targetAccountCode || po.targetAccountName || "").toLowerCase().includes(query)
        const matchCreditCoa = (po.creditAccountCode || po.creditAccountName || "").toLowerCase().includes(query)
        if (!matchVoucher && !matchPaidTo && !matchReason && !matchCheque && !matchBank && !matchMethod && !matchDebitCoa && !matchCreditCoa) return false
      }

      return true
    })
  }, [purchaseOrders, filterTab, searchQuery])

  // Dynamic Purchase Categories strictly matching the 31 operational expense accounts
  const purchaseCategoryOptions = useMemo(() => {
    const list: Array<{ id: string; label: string; ruleKey?: string; defaultCode?: string }> = [
      ...PURCHASE_OPERATIONAL_CATEGORIES,
    ]
    const existingIds = new Set(list.map((c) => c.id.toLowerCase()))
    const existingLabels = new Set(list.map((c) => c.label.toLowerCase().trim()))

    const glMappings = financeStore.getGlMappings()
    for (const m of glMappings) {
      if (m.category === "Purchase" || m.category === "Purchasing & AP") {
        const code = m.account_code || ""
        // Strictly exclude legacy inventory/stock and AP clearing codes
        if (
          code.startsWith("1400") ||
          code.startsWith("1410") ||
          code.startsWith("2100") ||
          code.startsWith("1000") ||
          code.startsWith("1100")
        ) {
          continue
        }
        if (
          m.id.startsWith("purchase_export_") ||
          m.id === "purchase_pharma_stock" ||
          m.id.startsWith("ap_") ||
          m.id.startsWith("po_grni_")
        ) {
          continue
        }

        const normId = (m.id || "").toLowerCase()
        const normLabel = (m.label || "").toLowerCase().trim()
        if (normLabel && !existingLabels.has(normLabel)) {
          list.push({
            id: m.id,
            label: m.label,
            ruleKey: m.id,
            defaultCode: m.account_code,
          })
          existingIds.add(normId)
          existingLabels.add(normLabel)
        }
      }
    }
    return list
  }, [financeStore])

  // Handle Payment Type Toggle
  const handlePaymentTypeChange = (newType: "Cash" | "Credit") => {
    setPaymentType(newType)
    const { creditAccount } = resolvePurchaseAccountsFromMatrix(operationalCategory, newType, financeStore)
    if (newType === "Cash") setBankName(creditAccount.name)

    setModalCreditLines((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: prev[0]?.id || `cr-init-${Date.now()}`,
            accountId: creditAccount.id,
            accountCode: creditAccount.code,
            accountName: creditAccount.name,
            description: newType === "Cash" ? "Bank Disbursement" : "Supplier Credit Settlement",
            amount: Number(paidAmount) || 0,
          },
        ]
      }
      return prev.map((l, idx) =>
        idx === 0
          ? {
              ...l,
              accountId: creditAccount.id,
              accountCode: creditAccount.code,
              accountName: creditAccount.name,
            }
          : l
      )
    })
  }

  // Handle Amount Change with auto single-line sync
  const handlePaidAmountChange = (val: number | "") => {
    setPaidAmount(val)
    const num = Number(val) || 0
    if (modalDebitLines.length === 1) {
      setModalDebitLines((prev) => prev.map((l) => ({ ...l, amount: num })))
    }
    if (modalCreditLines.length === 1) {
      setModalCreditLines((prev) => prev.map((l) => ({ ...l, amount: num })))
    }
  }

  // Handle Category Change with auto default sync
  const handleCategoryChange = (newCat: string) => {
    setOperationalCategory(newCat)
    const { debitAccount, normalPosting, categoryLabel } = resolvePurchaseAccountsFromMatrix(newCat, paymentType, financeStore)
    const effectiveDesc = categoryLabel || "Procurement Purchase"

    if (normalPosting === "Credit") {
      setModalCreditLines((prev) => {
        if (prev.length <= 1) {
          return [
            {
              id: prev[0]?.id || `cr-init-${Date.now()}`,
              accountId: debitAccount.id,
              accountCode: debitAccount.code,
              accountName: debitAccount.name,
              description: reasonForPayment.trim() || effectiveDesc,
              amount: Number(paidAmount) || 0,
            },
          ]
        }
        return prev.map((l, idx) =>
          idx === 0
            ? {
                ...l,
                accountId: debitAccount.id,
                accountCode: debitAccount.code,
                accountName: debitAccount.name,
                description: l.description === "Payment Disbursement" || !l.description ? effectiveDesc : l.description,
              }
            : l
        )
      })
    } else {
      setModalDebitLines((prev) => {
        if (prev.length <= 1) {
          return [
            {
              id: prev[0]?.id || `dr-init-${Date.now()}`,
              accountId: debitAccount.id,
              accountCode: debitAccount.code,
              accountName: debitAccount.name,
              description: reasonForPayment.trim() || effectiveDesc,
              amount: Number(paidAmount) || 0,
            },
          ]
        }
        return prev.map((l, idx) =>
          idx === 0
            ? {
                ...l,
                accountId: debitAccount.id,
                accountCode: debitAccount.code,
                accountName: debitAccount.name,
                description: l.description === "Procurement Purchase" || !l.description ? effectiveDesc : l.description,
              }
            : l
        )
      })
    }
  }

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setVoucherNo(`PV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`)
    setVoucherDate(new Date().toISOString().split("T")[0])
    setPaidTo("")
    setReasonForPayment("")
    const initialCategory = purchaseCategoryOptions[0]?.id || "freight_transport"
    setOperationalCategory(initialCategory)
    setPaymentMethod("Cheque")
    setChequeNo("")
    setPaidAmount("")
    setPaymentType("Cash")
    setStatus("PAID")
    setPaymentAdvice(null)
    setAttachments([])
    setFailedSupportingUploads([])
    setRetryingSupportingId(null)
    setEditingPo(null)

    // Initialize COA debit & credit split
    const { debitAccount, creditAccount } = resolvePurchaseAccountsFromMatrix(initialCategory, "Cash", financeStore)
    setBankName(creditAccount.name)
    setModalDebitLines([
      {
        id: `dr-init-${Date.now()}`,
        accountId: debitAccount.id,
        accountCode: debitAccount.code,
        accountName: debitAccount.name,
        description: "Procurement Purchase",
        amount: 0,
      },
    ])
    setModalCreditLines([
      {
        id: `cr-init-${Date.now()}`,
        accountId: creditAccount.id,
        accountCode: creditAccount.code,
        accountName: creditAccount.name,
        description: "Payment Disbursement",
        amount: 0,
      },
    ])

    setIsCreateModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (po: PurchaseOrder) => {
    setEditingPo(po)
    setVoucherNo(po.voucherNo || po.poNumber)
    setVoucherDate(po.date || new Date().toISOString().split("T")[0])
    setPaidTo(po.paidTo || po.supplier || "")
    setReasonForPayment(po.reasonForPayment || po.category || "")

    // Extract Debit Account
    const drRow = po.accountEntries?.find((e) => Number(e.debit) > 0)
    const drCode = drRow?.accountCode || po.targetAccountCode || "1410-01"
    const drName = drRow?.accountName || po.targetAccountName || "Stock of Green Mung"
    const drId = drRow?.accountId || po.targetAccountId || drCode

    // Extract Credit Account
    const crRow = po.accountEntries?.find((e) => Number(e.credit) > 0)
    const isCreditPo = (po.paymentType || po.payment_type) === "Credit"
    const crCode = crRow?.accountCode || po.creditAccountCode || (isCreditPo ? "2100-06" : "1000-02-26")
    const crName = crRow?.accountName || po.creditAccountName || po.bankName || (isCreditPo ? "Other Accruals & Payables" : "CBE ECB - 1000006734589")
    const crId = crRow?.accountId || po.creditAccountId || crCode

    setBankName(po.bankName || crName)
    setPaymentMethod((po.paymentMethod as any) || "Cheque")
    setChequeNo(po.chequeNo || "")
    setPaidAmount(po.amount || "")
    setPaymentType(isCreditPo ? "Credit" : "Cash")
    setStatus((po.status === "PAID" || po.status === "COMPLETED") ? "PAID" : "DRAFT")

    const numPoAmount = Number(po.amount || 0)
    if (Array.isArray(po.accountEntries) && po.accountEntries.length > 0) {
      const drs = po.accountEntries.filter((e) => Number(e.debit) > 0)
      const crs = po.accountEntries.filter((e) => Number(e.credit) > 0)
      setModalDebitLines(
        drs.length > 0
          ? drs.map((e, idx) => ({
              id: e.id || `dr-${idx}-${Date.now()}`,
              accountId: e.accountId || e.accountCode,
              accountCode: e.accountCode,
              accountName: e.accountName || (e as any).account_name || "Purchase Allocation",
              description: e.description || po.reasonForPayment || "Purchase Allocation",
              amount: Number(e.debit) || 0,
            }))
          : [
              {
                id: `dr-init-${Date.now()}`,
                accountId: po.targetAccountId || po.targetAccountCode || "1410-01",
                accountCode: po.targetAccountCode || "1410-01",
                accountName: po.targetAccountName || "Stock of Green Mung",
                description: po.reasonForPayment || "Purchase Allocation",
                amount: numPoAmount,
              },
            ]
      )
      setModalCreditLines(
        crs.length > 0
          ? crs.map((e, idx) => ({
              id: e.id || `cr-${idx}-${Date.now()}`,
              accountId: e.accountId || e.accountCode,
              accountCode: e.accountCode,
              accountName: e.accountName || (e as any).account_name || (isCreditPo ? "Supplier Credit Settlement" : "Payment Disbursement"),
              description: e.description || (isCreditPo ? "Supplier Credit Settlement" : "Payment Disbursement"),
              amount: Number(e.credit) || 0,
            }))
          : [
              {
                id: `cr-init-${Date.now()}`,
                accountId: po.creditAccountId || po.creditAccountCode || (isCreditPo ? "2100-06" : "1000-02-26"),
                accountCode: po.creditAccountCode || (isCreditPo ? "2100-06" : "1000-02-26"),
                accountName: po.creditAccountName || (isCreditPo ? "Other Accruals & Payables" : "CBE ECB - 1000006734589"),
                description: isCreditPo ? "Supplier Credit Settlement" : "Payment Disbursement",
                amount: numPoAmount,
              },
            ]
      )
    } else {
      setModalDebitLines([
        {
          id: `dr-init-${Date.now()}`,
          accountId: drId,
          accountCode: drCode,
          accountName: drName,
          description: po.reasonForPayment || "Purchase Allocation",
          amount: numPoAmount,
        },
      ])
      setModalCreditLines([
        {
          id: `cr-init-${Date.now()}`,
          accountId: crId,
          accountCode: crCode,
          accountName: crName,
          description: isCreditPo ? "Supplier Credit Settlement" : "Payment Disbursement",
          amount: numPoAmount,
        },
      ])
    }

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
    setFailedSupportingUploads([])
    setRetryingSupportingId(null)

    setIsEditModalOpen(true)
  }

  // Open Installment Payment Modal
  const openRecordPayment = (po: PurchaseOrder) => {
    const isCredit = (po.paymentType || po.payment_type) === "Credit"
    const totalVal = Number(po.amount || 0)
    const paidVal = isCredit ? Number(po.amountPaid ?? po.amount_paid ?? 0) : totalVal
    const dueVal = Number(Math.max(0, totalVal - paidVal).toFixed(2))

    setPayingPo(po)
    setPayAmount(dueVal > 0 ? String(dueVal) : "")
    setPayDate(new Date().toISOString().split("T")[0])
    setPayBank(po.creditAccountCode || "1000-02-26")
    setPayMethod("Bank Transfer")
    setPayRef(`PAY-PO-${Date.now().toString().slice(-4)}`)
    setPayNotes("")
    setPayAdviceFile(null)
  }

  // Submit Installment Payment
  const handleRecordInstallmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingPo || isSubmittingPayment) return
    const numAmount = parseFloat(payAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Invalid Amount", "warning", "Please enter a valid payment amount.")
      return
    }

    const totalVal = Number(payingPo.amount || 0)
    const alreadyPaid = Number(payingPo.amountPaid ?? payingPo.amount_paid ?? 0)
    const currentDue = Number(Math.max(0, totalVal - alreadyPaid).toFixed(2))

    if (numAmount > currentDue + 0.01) {
      showToast("Overpayment Notice", "warning", `Payment amount (ETB ${numAmount.toLocaleString()}) cannot exceed remaining balance due (ETB ${currentDue.toLocaleString()}).`)
      return
    }

    setIsSubmittingPayment(true)
    try {
      let stagedSlipUrl = ""
      let stagedSlipName = ""
      if (payAdviceFile) {
        try {
          const uploadRes = await uploadFile(payAdviceFile, "purchase_orders")
          stagedSlipName = uploadRes.originalName
          stagedSlipUrl = uploadRes.url
        } catch (uploadErr: any) {
          showToast("Upload Failed", "warning", uploadErr.message || "Failed to upload payment advice receipt. Please retry.")
          setIsSubmittingPayment(false)
          return
        }
      }

      // Record in Finance Store (Accounts Payable GL Double Entry)
      financeStore.recordPayment({
        direction: "Made",
        linked_invoice_id: `INV-PO-${payingPo.id}`,
        purchase_order_id: payingPo.id,
        supplier_name: payingPo.paidTo || payingPo.supplier,
        amount: numAmount,
        currency: "ETB",
        date: payDate,
        method: payMethod,
        bank_account_code: payBank,
        reference: payRef || `PAY-PO-${Date.now().toString().slice(-4)}`,
        payment_advice_url: stagedSlipUrl || undefined,
        payment_advice_filename: stagedSlipName || undefined,
        notes: payNotes,
      })

      // Record in ERP Store
      erp.recordPurchaseOrderInstallment(payingPo.id, {
        amount: numAmount,
        date: payDate,
        bankAccountCode: payBank,
        reference: payRef || `PAY-PO-${Date.now().toString().slice(-4)}`,
        paymentAdviceUrl: stagedSlipUrl || undefined,
        paymentAdviceFilename: stagedSlipName || undefined,
        notes: payNotes,
      })

      const newDue = Number(Math.max(0, currentDue - numAmount).toFixed(2))
      showToast(
        "Payment Recorded",
        "success",
        `Installment of ETB ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} paid to ${payingPo.paidTo || payingPo.supplier}. Remaining: ETB ${newDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
      )
      setPayingPo(null)
    } catch (err) {
      showToast("Payment Failed", "warning", "Could not record supplier payment installment.")
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  // Payment Advice Upload Handler
  const handlePaymentAdviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingPaymentAdvice(true)
      const res = await uploadFile(file, "purchase_orders")
      const newAdvice: PurchaseOrderAttachment = {
        id: `adv-${Date.now()}`,
        name: res.originalName || file.name,
        size: file.size,
        url: res.url,
        uploadedAt: new Date().toISOString(),
      }
      setPaymentAdvice(newAdvice)
      showToast("Payment Slip Attached", "success", `${file.name} uploaded successfully.`)
    } catch (err: any) {
      console.warn("Payment advice upload failed:", err)
      showToast("Upload Error", "warning", err.message || "Failed to upload payment advice file.")
    } finally {
      setIsUploadingPaymentAdvice(false)
      e.target.value = ""
    }
  }

  // Supporting Files Upload Handler with Strictly Sequential (One-by-One) Processing & Progressive Commits
  const handleSupportingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileList = Array.from(files)

    setIsUploadingSupporting(true)
    setSupportingUploadStatus(`Uploading 1 of ${fileList.length} (${fileList[0].name})...`)

    let successCount = 0
    let failCount = 0

    try {
      await uploadFilesConcurrently(
        fileList,
        "purchase_orders",
        {
          maxConcurrency: 1, // Strictly one by one
          onProgress: (completed, total, currentName) => {
            const nextIdx = Math.min(total, completed + 1)
            setSupportingUploadStatus(`Uploading ${nextIdx} of ${total}: ${currentName}...`)
          },
          onFileSuccess: (res, file) => {
            successCount++
            const newAtt: PurchaseOrderAttachment = {
              id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: res.originalName || file.name,
              size: res.size || file.size,
              url: res.url,
              uploadedAt: new Date().toISOString(),
            }
            setAttachments((prev) => [...prev, newAtt])
          },
          onFileError: (err, file) => {
            failCount++
            const failedId = `fail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            setFailedSupportingUploads((prev) => [
              ...prev,
              {
                id: failedId,
                file,
                error: err.message || "Failed to upload file to server.",
              },
            ])
          },
        }
      )

      if (successCount > 0 && failCount === 0) {
        showToast("Files Attached", "success", `${successCount} supporting file(s) uploaded successfully.`)
      } else if (successCount > 0 && failCount > 0) {
        showToast("Partial Upload", "warning", `${successCount} file(s) attached. ${failCount} file(s) failed and can be retried.`)
      }
    } catch (err: any) {
      if (successCount === 0) {
        showToast("Upload Error", "warning", err.message || "Failed to upload supporting files.")
      }
    } finally {
      setIsUploadingSupporting(false)
      setSupportingUploadStatus("")
      e.target.value = ""
    }
  }

  // Retry an individual failed supporting file upload
  const handleRetrySupportingFile = async (failedId: string) => {
    const item = failedSupportingUploads.find((f) => f.id === failedId)
    if (!item) return

    setRetryingSupportingId(failedId)
    try {
      const res = await uploadFile(item.file, "purchase_orders")
      const newAtt: PurchaseOrderAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: res.originalName || item.file.name,
        size: res.size || item.file.size,
        url: res.url,
        uploadedAt: new Date().toISOString(),
      }
      setAttachments((prev) => [...prev, newAtt])
      setFailedSupportingUploads((prev) => prev.filter((f) => f.id !== failedId))
      showToast("File Uploaded", "success", `${item.file.name} uploaded and attached.`)
    } catch (err: any) {
      console.warn("Retry failed:", err)
      setFailedSupportingUploads((prev) =>
        prev.map((f) => (f.id === failedId ? { ...f, error: err.message || "Retry failed. Server still unreachable." } : f))
      )
      showToast("Retry Failed", "warning", err.message || "Retry failed. Please check network.")
    } finally {
      setRetryingSupportingId(null)
    }
  }

  const handleDismissFailedSupportingFile = (failedId: string) => {
    setFailedSupportingUploads((prev) => prev.filter((f) => f.id !== failedId))
  }

  const handleRemoveSupportingAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // Save Create Voucher
  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingVoucher) return

    if (!voucherNo.trim()) {
      showToast("Missing Information", "warning", "Please enter Purchase Voucher number.")
      return
    }

    if (!paidTo.trim()) {
      showToast("Missing Information", "warning", "Please enter Supplier / Vendor name.")
      return
    }

    const numericAmount = Number(paidAmount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast("Invalid Amount", "warning", "Please enter a valid purchase amount.")
      return
    }

    if (paymentType === "Cash" && !paymentAdvice) {
      showToast("Payment Advice Required", "warning", "Payment Advice receipt is mandatory for Cash purchases. Please upload a receipt or slip before submitting.")
      return
    }

    const isCredit = paymentType === "Credit"
    const amountInWords = numberToBirrWords(numericAmount)

    const catObj = purchaseCategoryOptions.find((c) => c.id === operationalCategory || c.label === operationalCategory || c.ruleKey === operationalCategory)
    const effectiveDesc = reasonForPayment.trim() || catObj?.label || "Procurement Purchase"

    // Validate COA split balance
    const totalDr = Math.round(modalDebitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
    const totalCr = Math.round(modalCreditLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
    const diff = Math.round(Math.abs(totalDr - totalCr) * 100) / 100
    if (diff >= 0.01 || Math.abs(totalDr - numericAmount) >= 0.01) {
      showToast(
        "COA Split Unbalanced",
        "warning",
        `Total debits (ETB ${totalDr.toLocaleString()}) must equal total credits (ETB ${totalCr.toLocaleString()}) and match purchase amount (ETB ${numericAmount.toLocaleString()}). Difference is ETB ${diff.toFixed(2)}.`
      )
      return
    }

    const firstDr = modalDebitLines[0]
    const firstCr = modalCreditLines[0]

    const accountEntries = [
      ...modalDebitLines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description.trim() || effectiveDesc,
        debit: Number(l.amount),
        credit: 0,
      })),
      ...modalCreditLines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description.trim() || (isCredit ? "Supplier Credit Settlement" : "Payment Disbursement"),
        debit: 0,
        credit: Number(l.amount),
      })),
    ]

    const newPo: PurchaseOrder = {
      id: `PO-${Date.now().toString().slice(-4)}`,
      poNumber: voucherNo.trim(),
      voucherNo: voucherNo.trim(),
      date: voucherDate,
      paidTo: paidTo.trim(),
      supplier: paidTo.trim(),
      reasonForPayment: effectiveDesc,
      category: catObj?.label || operationalCategory,
      bankName: firstCr.accountName,
      paymentMethod,
      chequeNo: chequeNo.trim(),
      amount: numericAmount,
      amountPaid: isCredit ? 0 : numericAmount,
      amount_paid: isCredit ? 0 : numericAmount,
      balanceDue: isCredit ? numericAmount : 0,
      balance_due: isCredit ? numericAmount : 0,
      settlementStatus: isCredit ? "Unpaid" : "Fully Settled",
      settlement_status: isCredit ? "Unpaid" : "Fully Settled",
      paymentType,
      payment_type: paymentType,
      targetAccountId: firstDr.accountId,
      targetAccountCode: firstDr.accountCode,
      targetAccountName: firstDr.accountName,
      creditAccountId: firstCr.accountId,
      creditAccountCode: firstCr.accountCode,
      creditAccountName: firstCr.accountName,
      accountEntries,
      amountInWords,
      currency: "ETB",
      status: isCredit ? "PAID" : status,
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
        isCredit
          ? `Purchase Credit Voucher ${voucherNo} for ${paidTo} created.`
          : `Payment Voucher ${voucherNo} registered and posted to GL.`
      )
      setIsCreateModalOpen(false)
    } catch (err) {
      showToast("Create Failed", "warning", "Could not create payment voucher.")
    } finally {
      setIsSubmittingVoucher(false)
    }
  }

  // Save Edit Voucher
  const handleSaveEditVoucher = async (e: React.FormEvent) => {
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

    const numericAmount = Number(paidAmount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast("Invalid Amount", "warning", "Please enter a valid amount.")
      return
    }

    if (paymentType === "Cash" && !paymentAdvice) {
      showToast("Payment Advice Required", "warning", "Payment Advice receipt is mandatory for Cash purchases. Please upload a receipt or slip before saving.")
      return
    }

    const isCredit = paymentType === "Credit"
    const amountInWords = numberToBirrWords(numericAmount)
    const prevPaid = isCredit ? Number(editingPo.amountPaid ?? editingPo.amount_paid ?? 0) : numericAmount
    const newDue = isCredit ? Number(Math.max(0, numericAmount - prevPaid).toFixed(2)) : 0
    const settlement = isCredit ? (newDue <= 0.01 ? "Fully Settled" : (prevPaid > 0 ? "Ongoing" : "Unpaid")) : "Fully Settled"

    // Validate COA split balance
    const totalDr = Math.round(modalDebitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
    const totalCr = Math.round(modalCreditLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100
    const diff = Math.round(Math.abs(totalDr - totalCr) * 100) / 100
    if (diff >= 0.01 || Math.abs(totalDr - numericAmount) >= 0.01) {
      showToast(
        "COA Split Unbalanced",
        "warning",
        `Total debits (ETB ${totalDr.toLocaleString()}) must equal total credits (ETB ${totalCr.toLocaleString()}) and match purchase amount (ETB ${numericAmount.toLocaleString()}). Difference is ETB ${diff.toFixed(2)}.`
      )
      return
    }

    const firstDr = modalDebitLines[0]
    const firstCr = modalCreditLines[0]

    const accountEntries = [
      ...modalDebitLines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description.trim() || reasonForPayment.trim() || "Procurement / Purchase",
        debit: Number(l.amount),
        credit: 0,
      })),
      ...modalCreditLines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description.trim() || (isCredit ? "Supplier Credit Settlement" : "Payment Disbursement"),
        debit: 0,
        credit: Number(l.amount),
      })),
    ]

    try {
      setIsSavingEditVoucher(true)
      erp.updatePurchaseOrder(editingPo.id, {
        voucherNo: voucherNo.trim(),
        poNumber: voucherNo.trim(),
        date: voucherDate,
        paidTo: paidTo.trim(),
        supplier: paidTo.trim(),
        reasonForPayment: reasonForPayment.trim(),
        bankName: (firstCr.accountName || bankName || "").trim(),
        paymentMethod,
        chequeNo: chequeNo.trim(),
        amount: numericAmount,
        amountPaid: prevPaid,
        amount_paid: prevPaid,
        balanceDue: newDue,
        balance_due: newDue,
        settlementStatus: settlement,
        settlement_status: settlement,
        paymentType,
        payment_type: paymentType,
        targetAccountId: firstDr.accountId,
        targetAccountCode: firstDr.accountCode,
        targetAccountName: firstDr.accountName,
        creditAccountId: firstCr.accountId,
        creditAccountCode: firstCr.accountCode,
        creditAccountName: firstCr.accountName,
        accountEntries,
        amountInWords,
        status: isCredit ? (settlement === "Fully Settled" ? "PAID" : "PAID") : status,
        paymentAdviceAttachment: paymentAdvice,
        attachments,
      })

      // Bidirectional sync: sync JE-PO and linked Purchase Invoice GL distribution
      try {
        const poInvId = `INV-PO-${editingPo.id}`
        const matchingPoInv = financeStore.getInvoices().find(
          (i) => i.id === poInvId || i.purchase_order_id === editingPo.id || (editingPo.voucherNo && i.voucher_no === editingPo.voucherNo)
        )
        const poRevLines = accountEntries.map((e, idx) => ({
          id: e.id || `po-line-${idx}-${Date.now()}`,
          account_id: e.accountId || e.accountCode,
          account_code: e.accountCode || e.accountId,
          account_name: e.accountName,
          description: e.description || (Number(e.debit) > 0 ? "Procurement Goods / Stock Allocation" : "Supplier Settlement / AP"),
          debit: Number(e.debit) || 0,
          credit: Number(e.credit) || 0,
          party_type: "Supplier" as const,
          party_name: paidTo.trim(),
        }))

        if (matchingPoInv) {
          await financeStore.updateInvoiceGLDistribution(matchingPoInv.id, {
            revenueLines: poRevLines as any,
            notes: `Updated from Purchase Voucher Edit (${voucherNo.trim()})`,
          })
        } else {
          await financeStore.syncCrossModule()
        }
      } catch (syncErr) {
        console.warn("Live finance sync warning for PO:", syncErr)
      }

      showToast(
        "Voucher Updated",
        "success",
        `Purchase voucher ${voucherNo} details updated.`
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

      <div className="max-w-[98%] mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Top Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-black tracking-tight">Purchase Orders & Vouchers</h1>
            </div>
            <p className="text-xs font-semibold text-zinc-500 max-w-xl leading-relaxed mt-1">
              Manage procurement payment vouchers, vendor credit payables, partial credit installments, bank details, and attachments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubPageNav items={getSectionChildren("/sales")} />
          </div>
        </div>

        {/* PURCHASE ORDERS REGISTER */}
        <DataTable<PurchaseOrder>
          title="Purchases & Payment Vouchers Register"
          subtitle={`Total: ${filteredPurchaseOrders.length} records`}
          columns={columns}
          data={filteredPurchaseOrders}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search voucher no, supplier, bank, method, cheque ref..."
          filters={[
            {
              value: filterTab,
              onChange: setFilterTab,
              ariaLabel: "Filter by Status",
              options: [
                { value: "ALL", label: "All Purchases" },
                { value: "PAID", label: "Paid / Settled" },
                { value: "CREDIT", label: "Credit (Unpaid & Ongoing)" },
                { value: "DRAFT", label: "Draft" },
              ],
            },
          ]}
          actions={[
            {
              label: "New Purchase Voucher",
              onClick: handleOpenCreateModal,
              icon: <Plus className="size-4" />,
              variant: "primary",
            },
          ]}
          onReload={async () => {
            await erp.reloadFromApi()
          }}
          isReloading={isLoading}
          reloadTooltip="Reload purchase orders from server"
          defaultWidths={defaultColWidths}
          keyExtractor={(po) => po.id}
          renderRow={(po: PurchaseOrder, colWidths: Record<string, number>) => {
            const isCredit = (po.paymentType || po.payment_type) === "Credit"
            const totalVal = Number(po.amount || 0)
            const paidVal = isCredit ? Number(po.amountPaid ?? po.amount_paid ?? 0) : totalVal
            const dueVal = isCredit ? (typeof po.balanceDue === "number" ? po.balanceDue : Math.max(0, totalVal - paidVal)) : 0
            const pct = totalVal > 0 ? Math.min(100, Math.round((paidVal / totalVal) * 100)) : 0

            return (
              <>
                {/* Voucher ID */}
                <td style={{ width: `${colWidths.voucherNo}px` }} className="py-4 px-4 font-mono font-black text-xs text-zinc-950 overflow-hidden">
                  <div className="flex flex-col">
                    <span className="truncate">{po.voucherNo || po.poNumber}</span>
                    {isCredit && (
                      <span className="text-[10px] font-sans font-bold text-amber-700">
                        Credit
                      </span>
                    )}
                  </div>
                </td>

                {/* Date */}
                <td style={{ width: `${colWidths.date}px` }} className="py-4 px-4 text-xs font-semibold text-zinc-600 overflow-hidden">
                  <div>{po.date}</div>
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

                {/* COA Routing */}
                <td style={{ width: `${colWidths.coaAccounts}px` }} className="py-4 px-4 overflow-hidden">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate" title={`Debit: ${po.targetAccountName || po.targetAccountCode || "1410-01"}`}>
                        <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          DR
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-900 truncate">
                          {po.targetAccountCode || "1410-01"}
                        </span>
                      </div>
                      {Array.isArray(po.accountEntries) && po.accountEntries.length > 2 && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 shrink-0" title={`${po.accountEntries.length} split GL lines`}>
                          Split ({po.accountEntries.length})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0" title={`Credit: ${po.creditAccountName || po.creditAccountCode || (isCredit ? "2100-06" : "1000-02-26")}`}>
                      <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                        CR
                      </span>
                      <span className="font-mono text-xs font-bold text-zinc-900 truncate">
                        {po.creditAccountCode || (isCredit ? "2100-06" : "1000-02-26")}
                      </span>
                    </div>
                  </div>
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
                  {isCredit && dueVal > 0 && (
                    <div className="text-[10px] font-bold text-rose-600">
                      Due: ETB {dueVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
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
                  ) : po.installmentPayments?.some((ip) => ip.paymentAdviceUrl) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const slip = po.installmentPayments?.find((ip) => ip.paymentAdviceUrl)
                        if (slip?.paymentAdviceUrl) {
                          setPreviewUrl(slip.paymentAdviceUrl)
                          setPreviewName(slip.paymentAdviceFilename || "Payment Slip")
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition-colors cursor-pointer"
                      title="Preview Installment Payment Slip"
                    >
                      <FileCheck className="size-3 text-emerald-700" /> Slip ({po.installmentPayments.filter((ip) => ip.paymentAdviceUrl).length})
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

                {/* Status / Settlement */}
                <td style={{ width: `${colWidths.status}px` }} className="py-4 px-2 text-center overflow-hidden">
                  {!isCredit ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      po.status === "PAID" || po.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}>
                      {po.status === "PAID" || po.status === "COMPLETED" ? "Cash • Paid" : "Draft"}
                    </span>
                  ) : dueVal <= 0.01 || po.settlementStatus === "Fully Settled" ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Fully Settled (100%)
                    </span>
                  ) : paidVal > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                        Credit • Ongoing ({pct}%)
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500">
                        Paid: {paidVal.toLocaleString()} • Due: {dueVal.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                        Credit • Unpaid (0%)
                      </span>
                      <span className="text-[9px] font-mono text-rose-600 font-bold">
                        Due: ETB {dueVal.toLocaleString()}
                      </span>
                    </div>
                  )}
                </td>

                {/* Actions */}
                <td style={{ width: `${colWidths._actions}px` }} className="py-4 px-2 text-center whitespace-nowrap overflow-hidden">
                  <div className="flex items-center justify-center gap-1.5 flex-nowrap" onClick={(e) => e.stopPropagation()}>
                    {isCredit && dueVal > 0 && (
                      <button
                        type="button"
                        onClick={() => openRecordPayment(po)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] transition-all border border-emerald-200/80 active:scale-95 shadow-2xs cursor-pointer"
                        title="Record Supplier Payment Installment"
                      >
                        <Receipt className="size-3 text-emerald-700" /> Pay
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(po)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                      title="Edit Voucher"
                    >
                      <Pencil className="size-3 text-zinc-700" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintingPo(po)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all border border-zinc-200/80 active:scale-95 shadow-2xs cursor-pointer"
                      title="Export Payment Voucher"
                    >
                      <Download className="size-3 text-zinc-700" /> Export
                    </button>
                  </div>
                </td>
              </>
            )
          }}
        />
      </div>

      {/* MODAL: RECORD SUPPLIER PAYMENT INSTALLMENT */}
      {payingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setPayingPo(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <div
            className="relative z-10 bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto"
          >
              <div className="flex items-start justify-between mb-4 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-zinc-950 flex items-center gap-2">
                    <Receipt className="size-5 text-emerald-600" />
                    Pay Supplier Credit
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Record installment payment for voucher <span className="font-mono font-bold text-zinc-900">{payingPo.voucherNo || payingPo.poNumber}</span>
                  </p>
                </div>
                <button
                  onClick={() => setPayingPo(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Outstanding Summary Card */}
              {(() => {
                const totalVal = Number(payingPo.amount || 0)
                const paidVal = Number(payingPo.amountPaid ?? payingPo.amount_paid ?? 0)
                const dueVal = Number(Math.max(0, totalVal - paidVal).toFixed(2))

                return (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-amber-900 uppercase">Supplier / Payee</p>
                      <p className="text-sm font-black text-amber-950">{payingPo.paidTo || payingPo.supplier}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-amber-900 uppercase">Remaining Due</p>
                      <p className="text-base font-mono font-black text-rose-700">
                        ETB {dueVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )
              })()}

              <form onSubmit={handleRecordInstallmentSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Payment Amount (ETB) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Enter installment amount..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {Number(payAmount) > 0 && (
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1 italic">
                      {numberToBirrWords(Number(payAmount))}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Method *</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="RTGS">RTGS</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <COAAccountSelector
                      label="Disbursing Bank / Cash Account"
                      value={payBank}
                      onChange={(acc) => setPayBank(acc.code)}
                      suggestedCodes={["1000-02-26", "1000-01-01", "1000-02-01", "1000-02-14", "1000-02-17"]}
                      placeholder="Select bank/cash..."
                      helperText="Funding ledger account"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Reference / Cheque No *</label>
                    <input
                      type="text"
                      required
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="e.g. TXN-109249"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Proof of Payment / Bank Slip (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPayAdviceFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-800 hover:file:bg-zinc-200 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Notes / Remarks</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. 1st installment paid via CBE online"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    disabled={isSubmittingPayment}
                    onClick={() => setPayingPo(null)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {isSubmittingPayment ? <LoadingDots color="bg-white" size="sm" /> : "Post Supplier Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* MODAL: CREATE CHEQUE PAYMENT VOUCHER */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsCreateModalOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          />

          <div 
            className="relative z-10 bg-white rounded-3xl p-6 max-w-4xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[90vh]"
          >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-950 mb-0.5">Create Purchase Order / Voucher</h2>
                  <p className="text-xs font-semibold text-zinc-500">Record a purchase or vendor credit. Accounting COA and funding accounts are automatically mapped from the Finance Matrix.</p>
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
                  {/* Row 1: Voucher No (4 cols), Date (4 cols), Payment Method (4 cols) */}
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Voucher / PO Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PV-2026-0043"
                      value={voucherNo}
                      onChange={(e) => setVoucherNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none font-mono"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Purchase Date *</label>
                    <input
                      type="date"
                      required
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Method *</label>
                    <select
                      value={paymentType}
                      onChange={(e) => handlePaymentTypeChange(e.target.value as "Cash" | "Credit")}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>

                  {/* Row 2: Paid To / Supplier (6 cols), Purchase Category (6 cols) */}
                  <div className="md:col-span-6 relative" ref={supplierRef}>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Supplier / Paid To *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Search or type supplier name..."
                        value={paidTo}
                        onFocus={() => setShowSupplierDropdown(true)}
                        onChange={(e) => {
                          setPaidTo(e.target.value)
                          setShowSupplierDropdown(true)
                        }}
                        className="w-full pl-3 pr-8 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSupplierDropdown((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>

                    {showSupplierDropdown && suppliers.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-zinc-50">
                        {suppliers.filter((s) => (s.name || "").toLowerCase().includes(paidTo.toLowerCase())).map((supp) => (
                          <button
                            key={supp.id}
                            type="button"
                            onClick={() => {
                              setPaidTo(supp.name)
                              setShowSupplierDropdown(false)
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span>{supp.name}</span>
                            {paidTo === supp.name && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Purchase Category *</label>
                    <select
                      value={operationalCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                    >
                      {purchaseCategoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Row 3: Reason / Purpose (6 cols), Total Amount (6 cols) */}
                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Reason for Payment / Description (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 500 Quintals Green Mung from Girma Trading"
                      value={reasonForPayment}
                      onChange={(e) => setReasonForPayment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium outline-none"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      {paymentType === "Credit" ? "Total Credit Amount (ETB) *" : "Purchase Amount (ETB) *"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={paidAmount}
                      onChange={(e) => handlePaidAmountChange(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {Number(paidAmount) > 0 && (
                      <div className="mt-1 text-[10px] text-emerald-800 font-semibold italic truncate">
                        {numberToBirrWords(Number(paidAmount))}
                      </div>
                    )}
                  </div>

                  {/* Row 4: Payment Instrument (6 cols), Cheque / Ref (6 cols) */}
                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Payment Instrument *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="RTGS">RTGS</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      {paymentType === "Credit" ? "Supplier Invoice / PO Ref" : "Cheque / Transfer Reference No"}
                    </label>
                    <input
                      type="text"
                      placeholder={paymentType === "Credit" ? "e.g. SUP-INV-00421" : "e.g. CHQ-009823 or TXN-98421098"}
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold font-mono outline-none"
                    />
                  </div>
                </div>

                {/* COA Multi-Account Debit & Credit Split Section */}
                <PurchaseCOASplitSection
                  paymentType={paymentType}
                  totalAmount={Number(paidAmount) || 0}
                  debitLines={modalDebitLines}
                  creditLines={modalCreditLines}
                  onDebitLinesChange={setModalDebitLines}
                  onCreditLinesChange={setModalCreditLines}
                />

                {/* ORDER DOCUMENTATION & ATTACHMENTS */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block">
                        Order Documentation & Payment Advice {paymentType === "Cash" ? "(Required for Cash *)" : "(Optional for Credit)"}
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-500 block mt-0.5">
                        {paymentType === "Cash"
                          ? "Payment Advice receipt is mandatory for Cash purchases. Supporting trade docs are optional."
                          : "Payment Advice is optional for credit purchases and can also be attached when recording installments."}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                    {/* Payment Advice Dropzone */}
                    <div className="p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                          <FileCheck className="size-3.5 text-emerald-600" /> Payment Advice Receipt {paymentType === "Cash" && <span className="text-rose-600">*</span>}
                        </span>
                        {paymentAdvice ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            Attached
                          </span>
                        ) : paymentType === "Cash" ? (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            Required for Cash *
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                            Optional for Credit
                          </span>
                        )}
                      </div>

                      {paymentAdvice ? (
                        <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                          <div className="truncate pr-2">
                            <div className="text-xs font-bold text-zinc-900 truncate">{paymentAdvice.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {(paymentAdvice.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewUrl(paymentAdvice.url)
                                setPreviewName(paymentAdvice.name)
                              }}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Preview"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentAdvice(null)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed border-zinc-300 hover:border-zinc-500 rounded-xl p-3 text-center transition-colors bg-zinc-50/50">
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
                            <div className="size-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                              <Upload className="size-3.5" />
                            </div>
                            <span className="text-xs font-bold text-zinc-800">
                              Upload Bank Deposit Slip / Cheque Advice
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              PDF, PNG, JPG up to 15MB
                            </span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Supporting Documents (Bills, Proformas, Invoices) */}
                    <div className="p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                          <Paperclip className="size-3.5 text-zinc-600" /> Supporting Documents (Bills/Contracts)
                        </span>
                        {attachments.length > 0 ? (
                          <span className="text-[9px] font-black bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full border border-zinc-200">
                            {attachments.length} attached
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                            Optional
                          </span>
                        )}
                      </div>

                      <div className="border border-dashed border-zinc-300 hover:border-zinc-500 rounded-xl p-3 text-center transition-colors bg-zinc-50/50">
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
                          <div className="size-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                            <Upload className="size-3.5" />
                          </div>
                          <span className="text-xs font-bold text-zinc-800">
                            Click to attach Vendor Proformas / Bills
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            Multiple files supported (PDF, PNG, JPG)
                          </span>
                        </label>
                      </div>

                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                          {attachments.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] font-medium text-zinc-800"
                            >
                              <Paperclip className="size-3 text-zinc-400 shrink-0" />
                              <span className="truncate max-w-[130px] font-semibold">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewUrl(file.url)
                                  setPreviewName(file.name)
                                }}
                                className="text-blue-600 hover:text-blue-800 p-0.5 cursor-pointer"
                                title="Preview"
                              >
                                <Eye className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSupportingAttachment(file.id)}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                                title="Remove"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload Progress Indicator */}
                      {isUploadingSupporting && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                          <LoadingDots color="bg-emerald-600" size="sm" />
                          <span className="truncate">{supportingUploadStatus || "Uploading files one by one..."}</span>
                        </div>
                      )}

                      {/* Failed Supporting Uploads with Retry / Dismiss */}
                      {failedSupportingUploads.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="size-3 text-rose-600" />
                            Failed Uploads ({failedSupportingUploads.length})
                          </div>
                          {failedSupportingUploads.map((failedItem) => (
                            <div
                              key={failedItem.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold block truncate">{failedItem.file.name}</span>
                                <span className="text-[10px] text-rose-600 block truncate">{failedItem.error}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={isUploadingSupporting || retryingSupportingId === failedItem.id}
                                  onClick={() => handleRetrySupportingFile(failedItem.id)}
                                  className="px-2 py-1 bg-white hover:bg-rose-100 border border-rose-300 rounded text-[11px] font-bold text-rose-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {retryingSupportingId === failedItem.id ? (
                                    <LoadingDots color="bg-rose-600" size="sm" />
                                  ) : (
                                    <>
                                      <RotateCw className="size-3" />
                                      Retry
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismissFailedSupportingFile(failedItem.id)}
                                  className="p-1 hover:bg-rose-100 rounded text-rose-500 hover:text-rose-700 cursor-pointer"
                                  title="Dismiss"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                  <button 
                    type="button" 
                    disabled={isSubmittingVoucher || isUploadingSupporting || isUploadingPaymentAdvice || retryingSupportingId !== null}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingVoucher || isUploadingSupporting || isUploadingPaymentAdvice || retryingSupportingId !== null}
                    className="min-w-[150px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer gap-2"
                  >
                    {isSubmittingVoucher ? (
                      <LoadingDots color="bg-white" size="sm" />
                    ) : isUploadingSupporting || isUploadingPaymentAdvice || retryingSupportingId !== null ? (
                      <>
                        <LoadingDots color="bg-white" size="sm" />
                        <span>{supportingUploadStatus || (retryingSupportingId ? "Retrying file..." : "Uploading file...")}</span>
                      </>
                    ) : (
                      paymentType === "Credit" ? "Create Credit Purchase" : "Create Cheque Voucher"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* MODAL: EDIT PAYMENT VOUCHER */}
      {isEditModalOpen && editingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsEditModalOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          />

          <div 
            className="relative z-10 bg-white rounded-3xl p-6 max-w-4xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[90vh]"
          >
              {/* Header with 3-Dot Options Dropdown */}
              <EditModalHeader
                title={`Edit Purchase Voucher (${voucherNo})`}
                subtitle="Update payee, reason, bank details, payment method, advice slip, and supporting attachments."
                onClose={() => setIsEditModalOpen(false)}
                onRequestDelete={() => setDeletingPo(editingPo)}
                deleteLabel="Delete Payment Voucher"
              />

              {/* Credit Settlement Overview Card */}
              {editingPo && paymentType === "Credit" && (() => {
                const totalAmt = Number(editingPo.amount || 0)
                const paidAmt = Number(editingPo.amountPaid ?? editingPo.amount_paid ?? 0)
                const dueAmt = Number(Math.max(0, totalAmt - paidAmt).toFixed(2))
                const pct = totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0

                // Collect installments from both ERP and FinanceStore
                const fromErp = (editingPo.installmentPayments || []).map((p) => ({
                  id: p.id,
                  amount: p.amount,
                  date: p.date,
                  reference: p.reference,
                  paymentAdviceUrl: p.paymentAdviceUrl,
                  paymentAdviceFilename: p.paymentAdviceFilename,
                }))
                const fromFinance = financeStore.getPaymentsForPurchaseOrder(editingPo.id, editingPo.voucherNo).map((p) => ({
                  id: p.id,
                  amount: p.amount,
                  date: p.date,
                  reference: p.reference,
                  paymentAdviceUrl: p.payment_advice_url,
                  paymentAdviceFilename: p.payment_advice_filename,
                }))
                const combinedInstallments = [...fromErp]
                fromFinance.forEach((fp) => {
                  if (!combinedInstallments.some((cp) => cp.id === fp.id || (cp.reference && fp.reference && cp.reference === fp.reference))) {
                    combinedInstallments.push(fp)
                  }
                })

                return (
                  <div className="mb-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Credit Settlement Overview</span>
                        <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2 mt-0.5">
                          <span>Payable Balance</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            dueAmt <= 0 ? "bg-emerald-100 text-emerald-800" : paidAmt > 0 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {dueAmt <= 0 ? "Fully Settled (100%)" : paidAmt > 0 ? `Ongoing (${pct}%)` : "Unpaid (0%)"}
                          </span>
                        </h4>
                      </div>
                      {dueAmt > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditModalOpen(false)
                            openRecordPayment(editingPo)
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto transition-colors"
                        >
                          <Receipt className="size-3.5" /> Record Installment
                        </button>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${dueAmt <= 0 ? "bg-emerald-600" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Payable</span>
                        <span className="font-mono text-xs font-black text-zinc-900">ETB {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase block">Total Paid ({pct}%)</span>
                        <span className="font-mono text-xs font-black text-emerald-700">ETB {paidAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                        <span className="text-[10px] font-bold text-rose-600 uppercase block">Remaining Due</span>
                        <span className="font-mono text-xs font-black text-rose-700">ETB {dueAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Payment Installments Timeline */}
                    {combinedInstallments.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/80">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block mb-2">Recorded Installment History ({combinedInstallments.length}):</span>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {combinedInstallments.map((p, idx) => (
                            <div key={p.id || idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-zinc-200">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-black bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                                  #{idx + 1}
                                </span>
                                <span className="font-bold text-zinc-800">{p.date}</span>
                                <span className="text-zinc-500 font-mono text-[11px]">({p.reference})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-black text-emerald-700">ETB {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                {p.paymentAdviceUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewUrl(p.paymentAdviceUrl!)
                                      setPreviewName(p.paymentAdviceFilename || "Payment Slip")
                                    }}
                                    className="text-emerald-700 font-bold hover:underline text-[11px] cursor-pointer"
                                  >
                                    View Slip ↗
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              <form onSubmit={handleSaveEditVoucher} className="space-y-4">
                {/* Top Section Fields */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Row 1: Voucher No (4 cols), Date (4 cols), Payment Method (4 cols) */}
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Voucher / PO Number *</label>
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
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Method *</label>
                    <select
                      value={paymentType}
                      onChange={(e) => handlePaymentTypeChange(e.target.value as "Cash" | "Credit")}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>

                  {/* Row 2: Paid To / Supplier (6 cols), Reason / Category (6 cols) */}
                  <div className="md:col-span-6 relative" ref={supplierRef}>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Supplier / Paid To *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Search or type supplier name..."
                        value={paidTo}
                        onFocus={() => setShowSupplierDropdown(true)}
                        onChange={(e) => {
                          setPaidTo(e.target.value)
                          setShowSupplierDropdown(true)
                        }}
                        className="w-full pl-3 pr-8 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSupplierDropdown((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>

                    {showSupplierDropdown && suppliers.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-zinc-50">
                        {suppliers.filter((s) => (s.name || "").toLowerCase().includes(paidTo.toLowerCase())).map((supp) => (
                          <button
                            key={supp.id}
                            type="button"
                            onClick={() => {
                              setPaidTo(supp.name)
                              setShowSupplierDropdown(false)
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span>{supp.name}</span>
                            {paidTo === supp.name && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Reason for Payment / Category *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Warehouse Rent / Raw Materials / Maintenance"
                      value={reasonForPayment}
                      onChange={(e) => setReasonForPayment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none"
                    />
                  </div>

                  {/* Row 3: Total Amount, Payment Instrument, Ref/Cheque */}
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      {paymentType === "Credit" ? "Total Credit Amount (ETB) *" : "Amount Paid in figure (ETB) *"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={paidAmount}
                      onChange={(e) => handlePaidAmountChange(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none"
                    />
                    {Number(paidAmount) > 0 && (
                      <div className="mt-1 text-[10px] text-emerald-800 font-semibold italic truncate">
                        {numberToBirrWords(Number(paidAmount))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Payment Instrument *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="Cheque">Cheque</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="RTGS">RTGS</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      {paymentType === "Credit" ? "Supplier Invoice / PO Ref" : (paymentMethod === "Cheque" ? "Cheque Number *" : `${paymentMethod} Ref *`)}
                    </label>
                    <input
                      type="text"
                      required={paymentType === "Cash"}
                      placeholder={paymentType === "Credit" ? "e.g. SUP-INV-00421" : (paymentMethod === "Cheque" ? "e.g. CHQ-009823" : "e.g. TXN-98421098")}
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold font-mono outline-none"
                    />
                  </div>
                </div>

                {/* COA Multi-Account Debit & Credit Split Section */}
                <PurchaseCOASplitSection
                  paymentType={paymentType}
                  totalAmount={Number(paidAmount) || 0}
                  debitLines={modalDebitLines}
                  creditLines={modalCreditLines}
                  onDebitLinesChange={setModalDebitLines}
                  onCreditLinesChange={setModalCreditLines}
                />

                {/* ORDER DOCUMENTATION & PAYMENT ADVICE ATTACHMENTS */}
                <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-900 block">
                        Order Documentation & Payment Advice
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-500 block mt-0.5">
                        {paymentType === "Cash"
                          ? "Payment Advice receipt is mandatory for Cash purchases. Supporting trade docs are optional."
                          : "Payment Advice can be attached during installment payouts. Supporting vendor bills are optional."}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                    {/* Payment Advice Dropzone */}
                    <div className="p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                          <FileCheck className="size-3.5 text-emerald-600" /> Payment Advice Receipt {paymentType === "Cash" && <span className="text-rose-600">*</span>}
                        </span>
                        {paymentAdvice ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            Attached
                          </span>
                        ) : paymentType === "Cash" ? (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            Required for Cash *
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                            Optional for Credit
                          </span>
                        )}
                      </div>

                      {paymentAdvice ? (
                        <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                          <div className="truncate pr-2">
                            <div className="text-xs font-bold text-zinc-900 truncate">{paymentAdvice.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {(paymentAdvice.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewUrl(paymentAdvice.url)
                                setPreviewName(paymentAdvice.name)
                              }}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Preview"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentAdvice(null)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed border-zinc-300 hover:border-zinc-500 rounded-xl p-3 text-center transition-colors bg-zinc-50/50">
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
                            <div className="size-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                              <Upload className="size-3.5" />
                            </div>
                            <span className="text-xs font-bold text-zinc-800">
                              Upload Bank Deposit Slip / Cheque Advice
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              PDF, PNG, JPG up to 15MB
                            </span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Supporting Documents */}
                    <div className="p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                          <Paperclip className="size-3.5 text-zinc-600" /> Supporting Documents (Bills/Contracts)
                        </span>
                        {attachments.length > 0 ? (
                          <span className="text-[9px] font-black bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full border border-zinc-200">
                            {attachments.length} attached
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                            Optional
                          </span>
                        )}
                      </div>

                      <div className="border border-dashed border-zinc-300 hover:border-zinc-500 rounded-xl p-3 text-center transition-colors bg-zinc-50/50">
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
                          <div className="size-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                            <Upload className="size-3.5" />
                          </div>
                          <span className="text-xs font-bold text-zinc-800">
                            Click to attach Vendor Proformas / Bills
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            Multiple files supported (PDF, PNG, JPG)
                          </span>
                        </label>
                      </div>

                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                          {attachments.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] font-medium text-zinc-800"
                            >
                              <Paperclip className="size-3 text-zinc-400 shrink-0" />
                              <span className="truncate max-w-[130px] font-semibold">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewUrl(file.url)
                                  setPreviewName(file.name)
                                }}
                                className="text-blue-600 hover:text-blue-800 p-0.5 cursor-pointer"
                                title="Preview"
                              >
                                <Eye className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSupportingAttachment(file.id)}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                                title="Remove"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload Progress Indicator */}
                      {isUploadingSupporting && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                          <LoadingDots color="bg-emerald-600" size="sm" />
                          <span className="truncate">{supportingUploadStatus || "Uploading files one by one..."}</span>
                        </div>
                      )}

                      {/* Failed Supporting Uploads with Retry / Dismiss */}
                      {failedSupportingUploads.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="size-3 text-rose-600" />
                            Failed Uploads ({failedSupportingUploads.length})
                          </div>
                          {failedSupportingUploads.map((failedItem) => (
                            <div
                              key={failedItem.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold block truncate">{failedItem.file.name}</span>
                                <span className="text-[10px] text-rose-600 block truncate">{failedItem.error}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={isUploadingSupporting || retryingSupportingId === failedItem.id}
                                  onClick={() => handleRetrySupportingFile(failedItem.id)}
                                  className="px-2 py-1 bg-white hover:bg-rose-100 border border-rose-300 rounded text-[11px] font-bold text-rose-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {retryingSupportingId === failedItem.id ? (
                                    <LoadingDots color="bg-rose-600" size="sm" />
                                  ) : (
                                    <>
                                      <RotateCw className="size-3" />
                                      Retry
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismissFailedSupportingFile(failedItem.id)}
                                  className="p-1 hover:bg-rose-100 rounded text-rose-500 hover:text-rose-700 cursor-pointer"
                                  title="Dismiss"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                  <button 
                    type="button" 
                    disabled={isSavingEditVoucher || isUploadingSupporting || isUploadingPaymentAdvice || retryingSupportingId !== null}
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingEditVoucher || isUploadingSupporting || isUploadingPaymentAdvice || retryingSupportingId !== null}
                    className="min-w-[150px] inline-flex items-center justify-center px-5 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer gap-2"
                  >
                    {isSavingEditVoucher ? (
                      <LoadingDots color="bg-white" size="sm" />
                    ) : isUploadingSupporting || isUploadingPaymentAdvice || retryingSupportingId !== null ? (
                      <>
                        <LoadingDots color="bg-white" size="sm" />
                        <span>{supportingUploadStatus || (retryingSupportingId ? "Retrying file..." : "Uploading file...")}</span>
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* RECORD DELETE CONFIRMATION MODAL */}
      <RecordDeleteModal
        isOpen={!!deletingPo}
        onClose={() => setDeletingPo(null)}
        onConfirmDelete={handleConfirmDelete}
        title="Delete Cheque Payment Voucher"
        recordId={deletingPo?.id}
        recordName={deletingPo?.voucherNo || deletingPo?.poNumber || "this voucher"}
        resourceType="purchase_orders"
        description="This action will permanently delete this cheque payment voucher."
        onRequestSubmitted={() => setDeletingPo(null)}
      />

      {/* PRINTABLE OFFICIAL VOUCHER SLIP MODAL */}
      <PurchaseOrderPrintModal
        isOpen={!!printingPo}
        po={printingPo}
        onClose={() => setPrintingPo(null)}
      />

      {/* FINANCE GL DISTRIBUTION & MULTI-LINE SPLIT MODAL */}
      <PurchaseOrderGLSplitModal
        isOpen={!!splitPo}
        purchaseOrder={splitPo}
        onClose={() => setSplitPo(null)}
        onSaveSuccess={() => {
          showToast("GL Updated", "success", "General ledger distribution updated successfully.")
        }}
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
