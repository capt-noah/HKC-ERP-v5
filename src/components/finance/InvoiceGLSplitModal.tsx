import React, { useState, useEffect, useRef } from "react"
import { X, Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRightLeft, Sparkles, Layers, Box } from "lucide-react"
import { useFinanceStore, type Invoice, type InvoiceGLDistributionLine } from "@/lib/financeStore"
import { erpStore } from "@/lib/erpStore"
import { useFeedback } from "@/context/FeedbackContext"
import COAAccountSelector from "@/components/finance/COAAccountSelector"
import { LoadingDots } from "@/components/ui/LoadingDots"
import { resolveCommodityAccounts } from "@/lib/commodityAccounts"

interface InvoiceGLSplitModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: Invoice | null
  onSaveSuccess?: () => void
}

interface SplitLineItem {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  description: string
  amount: number
  partyType?: "Customer" | "Supplier" | "Employee" | null
  partyId?: string | null
  partyName?: string | null
}

export const InvoiceGLSplitModal: React.FC<InvoiceGLSplitModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onSaveSuccess,
}) => {
  const { showToast } = useFeedback()
  const financeStore = useFinanceStore()
  const accounts = financeStore.getAccounts()

  const [activeTab, setActiveTab] = useState<"revenue" | "cogs">("revenue")

  // Section A: Revenue & Settlement
  const [revDebitLines, setRevDebitLines] = useState<SplitLineItem[]>([])
  const [revCreditLines, setRevCreditLines] = useState<SplitLineItem[]>([])

  // Section B: Inventory & COGS
  const [hasCogsSection, setHasCogsSection] = useState(false)
  const [cogsDebitLines, setCogsDebitLines] = useState<SplitLineItem[]>([])
  const [cogsCreditLines, setCogsCreditLines] = useState<SplitLineItem[]>([])

  const [auditNote, setAuditNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const isPurchase = invoice ? (invoice.invoice_type === "Purchase" || Boolean(invoice.purchase_order_id)) : false
  const isServiceInvoice = invoice
    ? ((invoice as any).issue_type === "PROCESSING_SERVICE" ||
       String(invoice.warehouse_id || "").toUpperCase().includes("PROCESSING") ||
       String(invoice.id || "").startsWith("INV-PS-") ||
       invoice.line_items?.some((item: any) =>
         (item.description || "").toLowerCase().includes("processing") ||
         (item.description || "").toLowerCase().includes("cleaning") ||
         (item.item_name || "").toLowerCase().includes("processing") ||
         (item.item_name || "").toLowerCase().includes("cleaning")
       ))
    : false
  const loadedInvoiceIdRef = useRef<string | null>(null)

  // Initialize state on invoice change
  useEffect(() => {
    if (!isOpen || !invoice) {
      loadedInvoiceIdRef.current = null
      return
    }

    if (loadedInvoiceIdRef.current === invoice.id) {
      return
    }
    loadedInvoiceIdRef.current = invoice.id

    const invTotal = Number(invoice.total_amount ?? invoice.total ?? 0)
    const invTax = Number(invoice.tax_amount || 0)
    const invSubtotal = Number(invoice.subtotal ?? (invTax > 0 ? Math.max(0, invTotal - invTax) : invTotal))

    const isPurchase = invoice.invoice_type === "Purchase" || Boolean(invoice.purchase_order_id)
    const isCredit = (invoice.payment_terms || "").toLowerCase().includes("credit") || Number(invoice.balance_due || 0) > 0
    const isExportWh =
      String(invoice.warehouse_id || "").toUpperCase().startsWith("WH1") ||
      String(invoice.warehouse_id || "").toUpperCase().includes("EXP") ||
      String(invoice.warehouse_id || "").toUpperCase().includes("PROCESSING")
    const firstItem = invoice.line_items?.[0]?.description?.toUpperCase() || ""
    const isExportCrop =
      firstItem.includes("MUNG") ||
      firstItem.includes("SOYA") ||
      firstItem.includes("SESAME") ||
      firstItem.includes("BEAN")
    const isExport = isExportWh || isExportCrop

    const liveAccounts = financeStore.getAccounts()

    const resolveAcc = (idOrCode?: string) => {
      if (!idOrCode) return null
      const clean = String(idOrCode).trim()
      const unPrefixed = clean.replace(/^ACC-/, "")
      return (
        liveAccounts.find(
          (a) =>
            a.id === clean ||
            a.code === clean ||
            a.code === unPrefixed ||
            a.id === `ACC-${clean}` ||
            a.id === unPrefixed
        ) || null
      )
    }

    // Check existing saved distribution or live journal entries
    const existingDist = invoice.gl_distribution
    const { salesLines, cogsLines } = financeStore.getInvoiceJournalEntries(invoice)

    // 1. REVENUE / PROCUREMENT SECTION - DEBITS
    const distRev = (existingDist?.revenue_lines as any[]) || []
    const rawSalesLines = (salesLines as any[]) || []
    const distCogs = (existingDist?.cogs_lines as any[]) || []
    const rawCogsLines = (cogsLines as any[]) || []

    if (distRev.length > 0 && distRev.some((l: any) => Number(l.debit || (l.amount && l.id?.startsWith("dr-"))) > 0)) {
      setRevDebitLines(
        distRev
          .filter((l: any) => Number(l.debit || (l.amount && l.id?.startsWith("dr-"))) > 0)
          .map((l: any, idx: number) => {
            const acc = resolveAcc(l.account_code || l.accountId || l.account_id || l.accountCode || l.code)
            return {
              id: l.id || `dr-rev-${idx}-${Date.now()}`,
              accountId: acc?.id || l.accountId || l.account_id || l.accountCode || l.account_code || "1300-03",
              accountCode: acc?.code || l.accountCode || l.account_code || l.accountId || l.account_id || "1300-03",
              accountName: acc?.name || l.accountName || l.account_name || "Account " + (acc?.code || l.accountCode || l.account_code),
              description: l.description || (isPurchase ? "Procurement Goods / Expense" : "Customer Settlement"),
              amount: Number(l.debit || l.debit_amount || l.amount) || 0,
              partyType: l.party_type ?? (isPurchase ? "Supplier" : "Customer"),
              partyId: l.party_id ?? null,
              partyName: l.party_name ?? (invoice.supplier_name || invoice.customer_name),
            }
          })
      )
    } else if (rawSalesLines.length > 0 && rawSalesLines.some((l: any) => Number(l.debit_amount || (l.amount && (l.id?.startsWith("dr-") || l.debit))) > 0)) {
      setRevDebitLines(
        rawSalesLines
          .filter((l: any) => Number(l.debit_amount || (l.amount && (l.id?.startsWith("dr-") || l.debit))) > 0)
          .map((l: any, idx: number) => {
            const acc = resolveAcc(l.account_id || l.accountId || l.accountCode || l.account_code)
            return {
              id: l.id || `dr-rev-${idx}-${Date.now()}`,
              accountId: acc?.id || l.account_id || l.accountId,
              accountCode: acc?.code || l.account_id || l.accountId,
              accountName: acc?.name || l.account_name || l.accountName || "Account " + (acc?.code || l.account_id),
              description: isPurchase ? "Procurement Goods / Expense" : "Customer Settlement / Receivables",
              amount: Number(l.debit_amount || l.amount || l.debit) || 0,
              partyType: l.party_type ?? (isPurchase ? "Supplier" : "Customer"),
              partyId: l.party_id ?? null,
              partyName: l.party_name ?? (invoice.supplier_name || invoice.customer_name),
            }
          })
      )
    } else {
      if (isPurchase) {
        const defaultDrAcc = financeStore.getMappedAccount(
          isExport ? "inventory_stock_in_hand" : "inventory_pharma_stock",
          isExport ? "1410-01" : "1400-01",
          { warehouseId: invoice.warehouse_id, itemName: firstItem }
        )
        setRevDebitLines([
          {
            id: `dr-rev-init-${Date.now()}`,
            accountId: defaultDrAcc?.id || (isExport ? "1410-01" : "1400-01"),
            accountCode: defaultDrAcc?.code || (isExport ? "1410-01" : "1400-01"),
            accountName: defaultDrAcc?.name || (isExport ? "STOCK OF GREEN MUNG" : "STOCK OF VETERINARY DRUG"),
            description: invoice.notes || `Procurement Allocation (${invoice.supplier_name || invoice.customer_name || "Supplier"})`,
            amount: invTotal,
            partyType: "Supplier",
            partyId: invoice.supplier_name ? `SUPP-${invoice.supplier_name.replace(/\s+/g, "").toUpperCase()}` : null,
            partyName: invoice.supplier_name || invoice.customer_name || "Supplier",
          },
        ])
      } else {
        // Default: AR account for total invoice amount
        let defaultArAcc: any = null
        if (isServiceInvoice) {
          defaultArAcc = isCredit
            ? liveAccounts.find((a) => a.code === "1300-05") || { id: "1300-05", code: "1300-05", name: "Cleaning Service Receivable" }
            : liveAccounts.find((a) => a.code === "1000-02-26") || { id: "1000-02-26", code: "1000-02-26", name: "CBE Bank Operating" }
        } else {
          defaultArAcc = financeStore.getMappedAccount(
            isExport ? "sales_credit_ar_export" : "sales_credit_ar",
            isExport ? "1300-01" : "1300-03",
            { warehouseId: invoice.warehouse_id }
          )
        }
        const custName = invoice.customer_name || "Customer"
        setRevDebitLines([
          {
            id: `dr-rev-init-${Date.now()}`,
            accountId: defaultArAcc?.id || (isServiceInvoice ? (isCredit ? "1300-05" : "1000-02-26") : (isExport ? "1300-01" : "1300-03")),
            accountCode: defaultArAcc?.code || (isServiceInvoice ? (isCredit ? "1300-05" : "1000-02-26") : (isExport ? "1300-01" : "1300-03")),
            accountName: defaultArAcc?.name || (isServiceInvoice ? (isCredit ? "Cleaning Service Receivable" : "CBE Bank Operating") : (isExport ? "EXPORT SALES RECIVEABLE" : "VET MEDICEN SALES RECIVABLE")),
            description: `Customer Invoice Due (${custName})`,
            amount: invTotal,
            partyType: "Customer",
            partyId: `CUST-${custName.replace(/\s+/g, "").toUpperCase()}`,
            partyName: custName,
          },
        ])
      }
    }

    // 2. REVENUE / SETTLEMENT SECTION - CREDITS
    if (distRev.length > 0 && distRev.some((l: any) => Number(l.credit || (l.amount && l.id?.startsWith("cr-"))) > 0)) {
      setRevCreditLines(
        distRev
          .filter((l: any) => Number(l.credit || (l.amount && l.id?.startsWith("cr-"))) > 0)
          .map((l: any, idx: number) => {
            const acc = resolveAcc(l.account_code || l.accountId || l.account_id || l.accountCode || l.code)
            return {
              id: l.id || `cr-rev-${idx}-${Date.now()}`,
              accountId: acc?.id || l.accountId || l.account_id || l.accountCode || l.account_code || "4000-01-01",
              accountCode: acc?.code || l.accountCode || l.account_code || l.accountId || l.account_id || "4000-01-01",
              accountName: acc?.name || l.accountName || l.account_name || "Account " + (acc?.code || l.accountCode || l.account_code),
              description: l.description || (isPurchase ? "Supplier Settlement / Bank" : "Sales Revenue Recognition"),
              amount: Number(l.credit || l.credit_amount || l.amount) || 0,
            }
          })
      )
    } else if (rawSalesLines.length > 0 && rawSalesLines.some((l: any) => Number(l.credit_amount || (l.amount && (l.id?.startsWith("cr-") || l.credit))) > 0)) {
      setRevCreditLines(
        rawSalesLines
          .filter((l: any) => Number(l.credit_amount || (l.amount && (l.id?.startsWith("cr-") || l.credit))) > 0)
          .map((l: any, idx: number) => {
            const acc = resolveAcc(l.account_id || l.accountId || l.accountCode || l.account_code)
            return {
              id: l.id || `cr-rev-${idx}-${Date.now()}`,
              accountId: acc?.id || l.account_id || l.accountId,
              accountCode: acc?.code || l.account_id || l.accountId,
              accountName: acc?.name || l.account_name || l.accountName || "Account " + (acc?.code || l.account_id),
              description: acc?.name || (isPurchase ? "Supplier Settlement / Bank" : "Sales Revenue"),
              amount: Number(l.credit_amount || l.amount || l.credit) || 0,
            }
          })
      )
    } else {
      if (isPurchase) {
        const defaultCrAcc = isCredit
          ? financeStore.getMappedAccount("ap_trade_payable", "2100-06")
          : financeStore.getMappedAccount("supplier_payment_bank", "1000-02-26")
        setRevCreditLines([
          {
            id: `cr-rev-init-${Date.now()}`,
            accountId: defaultCrAcc?.id || (isCredit ? "2100-06" : "1000-02-26"),
            accountCode: defaultCrAcc?.code || (isCredit ? "2100-06" : "1000-02-26"),
            accountName: defaultCrAcc?.name || (isCredit ? "Other Accruals & Payables" : "CBE Bank Operating"),
            description: isCredit ? "Supplier Credit Settlement" : "Bank Disbursement",
            amount: invTotal,
          },
        ])
      } else {
        // Default: Sales Revenue for Subtotal, and VAT for Tax (if applicable)
        let defaultRevAcc: any = null
        if (isServiceInvoice) {
          defaultRevAcc = liveAccounts.find((a) => a.code === "4000-03-02") || { id: "4000-03-02", code: "4000-03-02", name: "Cleaning and Grading Service Revenue" }
        } else {
          defaultRevAcc = financeStore.getMappedAccount(
            isExport ? "sales_revenue_export" : "sales_revenue_domestic",
            isExport ? "4000-02-01" : "4000-01-01",
            { warehouseId: invoice.warehouse_id, itemName: firstItem }
          )
        }
        const vatAcc = financeStore.getMappedAccount("sales_vat_output", "2000-05")

        const initialCredits: SplitLineItem[] = [
          {
            id: `cr-rev-init-1-${Date.now()}`,
            accountId: defaultRevAcc?.id || (isServiceInvoice ? "4000-03-02" : (isExport ? "4000-02-01" : "4000-01-01")),
            accountCode: defaultRevAcc?.code || (isServiceInvoice ? "4000-03-02" : (isExport ? "4000-02-01" : "4000-01-01")),
            accountName: defaultRevAcc?.name || (isServiceInvoice ? "Cleaning and Grading Service Revenue" : (isExport ? "Revenue - Export Commodities" : "Sales Revenue")),
            description: isServiceInvoice ? "Cleaning & Processing Service Revenue" : "Operating Sales Revenue",
            amount: invSubtotal,
          },
        ]

        if (invTax > 0 && vatAcc) {
          initialCredits.push({
            id: `cr-rev-init-2-${Date.now()}`,
            accountId: vatAcc.id,
            accountCode: vatAcc.code,
            accountName: vatAcc.name,
            description: "VAT Output Payable (15%)",
            amount: invTax,
          })
        }

        setRevCreditLines(initialCredits)
      }
    }

    // 3. COGS & INVENTORY SECTION (Only for physical goods Sales, NOT for Purchases or Service Invoices)
    if (isPurchase || isServiceInvoice) {
      setHasCogsSection(false)
      setCogsDebitLines([])
      setCogsCreditLines([])
    } else {
      const hasExistingCogs = (distCogs.length > 0) || rawCogsLines.length > 0
      setHasCogsSection(hasExistingCogs)

      if (distCogs.length > 0) {
        setCogsDebitLines(
          distCogs
            .filter((l: any) => Number(l.debit || (l.amount && l.id?.startsWith("dr-"))) > 0)
            .map((l: any, idx: number) => {
              const acc = resolveAcc(l.account_code || l.accountId || l.account_id || l.accountCode || l.code)
              return {
                id: l.id || `dr-cogs-${idx}-${Date.now()}`,
                accountId: acc?.id || l.accountId || l.account_id || "5000-01",
                accountCode: acc?.code || l.accountCode || l.account_code || "5000-01",
                accountName: acc?.name || l.accountName || l.account_name || "Account " + (acc?.code || l.accountCode || l.account_code || l.account_id),
                description: l.description || "Cost of Goods Sold",
                amount: Number(l.debit || l.debit_amount || l.amount) || 0,
              }
            })
        )
        setCogsCreditLines(
          distCogs
            .filter((l: any) => Number(l.credit || (l.amount && l.id?.startsWith("cr-"))) > 0)
            .map((l: any, idx: number) => {
              const acc = resolveAcc(l.account_code || l.accountId || l.account_id || l.accountCode || l.code)
              return {
                id: l.id || `cr-cogs-${idx}-${Date.now()}`,
                accountId: acc?.id || l.accountId || l.account_id || "1400-01",
                accountCode: acc?.code || l.accountCode || l.account_code || "1400-01",
                accountName: acc?.name || l.accountName || l.account_name || "Account " + (acc?.code || l.accountCode || l.account_code || l.account_id),
                description: l.description || "Inventory Asset Derecognition",
                amount: Number(l.credit || l.credit_amount || l.amount) || 0,
              }
            })
        )
      } else if (rawCogsLines.length > 0) {
        setCogsDebitLines(
          rawCogsLines
            .filter((l: any) => Number(l.debit_amount || (l.amount && (l.id?.startsWith("dr-") || l.debit))) > 0)
            .map((l: any, idx: number) => {
              const acc = resolveAcc(l.account_id || l.accountId || l.accountCode || l.account_code)
              return {
                id: l.id || `dr-cogs-${idx}-${Date.now()}`,
                accountId: acc?.id || l.account_id || "5000-01",
                accountCode: acc?.code || l.account_id || "5000-01",
                accountName: acc?.name || "Account " + (acc?.code || l.account_id),
                description: "Cost of Goods Sold Expense",
                amount: Number(l.debit_amount || l.amount || l.debit) || 0,
              }
            })
        )
        setCogsCreditLines(
          rawCogsLines
            .filter((l: any) => Number(l.credit_amount || (l.amount && (l.id?.startsWith("cr-") || l.credit))) > 0)
            .map((l: any, idx: number) => {
              const acc = resolveAcc(l.account_id || l.accountId || l.accountCode || l.account_code)
              return {
                id: l.id || `cr-cogs-${idx}-${Date.now()}`,
                accountId: acc?.id || l.account_id || "1400-01",
                accountCode: acc?.code || l.account_id || "1400-01",
                accountName: acc?.name || "Account " + (acc?.code || l.account_id),
                description: "Inventory Asset Derecognition",
                amount: Number(l.credit_amount || l.amount || l.credit) || 0,
              }
            })
        )
      } else {
        const firstItemDesc = invoice.line_items?.[0]?.description || ""
        const commSet = isExport ? resolveCommodityAccounts(firstItemDesc) : null
        const defaultCogsCode = isExport ? (commSet?.cogsCode || "5010-01") : "5000-01"
        const defaultStockCode = isExport ? (commSet?.inventoryCode || "1410-01") : "1400-01"
        const defaultCogsName = isExport ? (commSet?.cogsName || "Cost of Goods Export") : "Cost of Goods Sold"
        const defaultStockName = isExport ? (commSet?.inventoryName || "Stock of Export Crop") : "Inventory Stock"

        const defaultCogsAcc = liveAccounts.find((a) => a.code === defaultCogsCode) || liveAccounts.find((a) => a.code === "5000-01")
        const defaultStockAcc = liveAccounts.find((a) => a.code === defaultStockCode) || liveAccounts.find((a) => a.code === "1400-01")

        let defaultCogsTotal = 0
        if (Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
          const prods = erpStore.getProducts()
          for (const item of invoice.line_items) {
            const qty = Number(item.quantity || 1)
            const prod = prods.find((p) => p.id === (item as any).item_id || p.id === (item as any).product_id || p.name === item.description || p.sku === item.description)
            let unitCost = 0
            if ((item as any).unit_cost && Number((item as any).unit_cost) > 0) {
              unitCost = Number((item as any).unit_cost)
            } else if ((item as any).cost_price && Number((item as any).cost_price) > 0) {
              unitCost = Number((item as any).cost_price)
            } else if (prod?.unitCost && Number(prod.unitCost) > 0) {
              unitCost = Number(prod.unitCost)
            } else if (prod?.valuationRate && Number(prod.valuationRate) > 0) {
              unitCost = Number(prod.valuationRate)
            }
            defaultCogsTotal += qty * unitCost
          }
        }
        defaultCogsTotal = Math.round(defaultCogsTotal * 100) / 100

        setCogsDebitLines([
          {
            id: `dr-cogs-init-${Date.now()}`,
            accountId: defaultCogsAcc?.id || defaultCogsCode,
            accountCode: defaultCogsAcc?.code || defaultCogsCode,
            accountName: defaultCogsAcc?.name || defaultCogsName,
            description: "Inventory Cost of Goods Sold",
            amount: defaultCogsTotal,
          },
        ])
        setCogsCreditLines([
          {
            id: `cr-cogs-init-${Date.now()}`,
            accountId: defaultStockAcc?.id || defaultStockCode,
            accountCode: defaultStockAcc?.code || defaultStockCode,
            accountName: defaultStockAcc?.name || defaultStockName,
            description: "Inventory Stock In Hand Derecognition",
            amount: defaultCogsTotal,
          },
        ])
      }
    }

    setAuditNote(existingDist?.notes || "")
  }, [isOpen, invoice?.id])

  if (!isOpen || !invoice) return null

  const invTotal = Number(invoice.total_amount ?? invoice.total ?? 0)

  // Section A Balance
  const revTotalDebits = Math.round(revDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const revTotalCredits = Math.round(revCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const revDiff = Math.round(Math.abs(revTotalDebits - revTotalCredits) * 100) / 100
  const isRevBalanced = revDiff < 0.01 && revTotalDebits > 0
  const matchesInvTotal = Math.round(Math.abs(revTotalDebits - invTotal) * 100) / 100 < 0.01

  // Section B Balance
  const cogsTotalDebits = Math.round(cogsDebitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const cogsTotalCredits = Math.round(cogsCreditLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
  const cogsDiff = Math.round(Math.abs(cogsTotalDebits - cogsTotalCredits) * 100) / 100
  const isCogsBalanced = isPurchase || isServiceInvoice || !hasCogsSection || (cogsDiff < 0.01 && cogsTotalDebits >= 0)

  // Overall validation
  const canSave = isRevBalanced && isCogsBalanced

  // --- Handlers for Revenue Section ---
  const handleAddRevDebit = () => {
    const defaultAcc = isPurchase
      ? accounts.find((a) => a.code === "1410-01") || accounts.find((a) => a.code === "1400-01") || accounts[0]
      : accounts.find((a) => a.code === "1000-02-26") || accounts[0]
    const pName = isPurchase ? (invoice.supplier_name || invoice.customer_name || "Supplier") : (invoice.customer_name || "Customer")
    const pId = isPurchase
      ? (invoice.supplier_name ? `SUPP-${invoice.supplier_name.replace(/\s+/g, "").toUpperCase()}` : null)
      : (invoice.customer_name ? `CUST-${invoice.customer_name.replace(/\s+/g, "").toUpperCase()}` : null)

    setRevDebitLines((prev) => [
      ...prev,
      {
        id: `dr-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || (isPurchase ? "1410-01" : "1000-02-26"),
        accountCode: defaultAcc?.code || (isPurchase ? "1410-01" : "1000-02-26"),
        accountName: defaultAcc?.name || (isPurchase ? "STOCK OF GREEN MUNG" : "CBE Bank Operating"),
        description: isPurchase ? "Procurement Stock / Expense" : "Direct Settlement / Bank Receipt",
        amount: Math.max(0, Math.round((revTotalCredits - revTotalDebits) * 100) / 100),
        partyType: isPurchase ? "Supplier" : "Customer",
        partyId: pId,
        partyName: pName,
      },
    ])
  }

  const handleRemoveRevDebit = (id: string) => {
    if (revDebitLines.length <= 1) return
    setRevDebitLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleUpdateRevDebit = (id: string, updates: Partial<SplitLineItem>) => {
    setRevDebitLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillRevDebit = (idx: number) => {
    const currentSumWithout = revDebitLines
      .filter((_, i) => i !== idx)
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((revTotalCredits - currentSumWithout) * 100) / 100)
    setRevDebitLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, amount: remainder } : l))
    )
  }

  const handleAddRevCredit = () => {
    const defaultAcc = isPurchase
      ? accounts.find((a) => a.code === "2100-06") || accounts.find((a) => a.code === "1000-02-26") || accounts[0]
      : accounts.find((a) => a.code === "4000-03-02") || accounts.find((a) => a.code === "4000-01-01") || accounts[0]
    const pName = isPurchase ? (invoice.supplier_name || invoice.customer_name || "Supplier") : (invoice.customer_name || "Customer")
    const pId = isPurchase
      ? (invoice.supplier_name ? `SUPP-${invoice.supplier_name.replace(/\s+/g, "").toUpperCase()}` : null)
      : (invoice.customer_name ? `CUST-${invoice.customer_name.replace(/\s+/g, "").toUpperCase()}` : null)

    setRevCreditLines((prev) => [
      ...prev,
      {
        id: `cr-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || (isPurchase ? "2100-06" : "4000-03-02"),
        accountCode: defaultAcc?.code || (isPurchase ? "2100-06" : "4000-03-02"),
        accountName: defaultAcc?.name || (isPurchase ? "Other Accruals & Payables" : "Service / Additional Revenue"),
        description: isPurchase ? "Supplier Credit Settlement" : "Additional Revenue Line",
        amount: Math.max(0, Math.round((revTotalDebits - revTotalCredits) * 100) / 100),
        partyType: isPurchase ? "Supplier" : "Customer",
        partyId: pId,
        partyName: pName,
      },
    ])
  }

  const handleRemoveRevCredit = (id: string) => {
    if (revCreditLines.length <= 1) return
    setRevCreditLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleUpdateRevCredit = (id: string, updates: Partial<SplitLineItem>) => {
    setRevCreditLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAutoFillRevCredit = (idx: number) => {
    const currentSumWithout = revCreditLines
      .filter((_, i) => i !== idx)
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const remainder = Math.max(0, Math.round((revTotalDebits - currentSumWithout) * 100) / 100)
    setRevCreditLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, amount: remainder } : l))
    )
  }

  // --- Handlers for COGS Section ---
  const handleAddCogsDebit = () => {
    const defaultAcc = accounts.find((a) => a.code === "5000-01") || accounts[0]
    setCogsDebitLines((prev) => [
      ...prev,
      {
        id: `dr-cogs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || "5000-01",
        accountCode: defaultAcc?.code || "5000-01",
        accountName: defaultAcc?.name || "Cost of Veterinary Drug",
        description: "Cost of Sales Line",
        amount: Math.max(0, Math.round((cogsTotalCredits - cogsTotalDebits) * 100) / 100),
      },
    ])
  }

  const handleRemoveCogsDebit = (id: string) => {
    if (cogsDebitLines.length <= 1) return
    setCogsDebitLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleUpdateCogsDebit = (id: string, updates: Partial<SplitLineItem>) => {
    setCogsDebitLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const handleAddCogsCredit = () => {
    const defaultAcc = accounts.find((a) => a.code === "1400-01") || accounts[0]
    setCogsCreditLines((prev) => [
      ...prev,
      {
        id: `cr-cogs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: defaultAcc?.id || "1400-01",
        accountCode: defaultAcc?.code || "1400-01",
        accountName: defaultAcc?.name || "Stock of Veterinary Drug",
        description: "Stock Inventory Derecognition",
        amount: Math.max(0, Math.round((cogsTotalDebits - cogsTotalCredits) * 100) / 100),
      },
    ])
  }

  const handleRemoveCogsCredit = (id: string) => {
    if (cogsCreditLines.length <= 1) return
    setCogsCreditLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleUpdateCogsCredit = (id: string, updates: Partial<SplitLineItem>) => {
    setCogsCreditLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  // --- Save Handler ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return

    if (!isRevBalanced) {
      showToast(
        "Revenue Split Unbalanced",
        "warning",
        `Section A Debits (ETB ${revTotalDebits.toLocaleString()}) must equal Credits (ETB ${revTotalCredits.toLocaleString()}). Difference: ETB ${revDiff.toFixed(2)}.`
      )
      return
    }

    if (!isPurchase && !isServiceInvoice && hasCogsSection && !isCogsBalanced) {
      showToast(
        "COGS Split Unbalanced",
        "warning",
        `Section B Cost Debits (ETB ${cogsTotalDebits.toLocaleString()}) must equal Credits (ETB ${cogsTotalCredits.toLocaleString()}). Difference: ETB ${cogsDiff.toFixed(2)}.`
      )
      return
    }

    setIsSaving(true)
    try {
      const partyDisplayName = isPurchase ? (invoice.supplier_name || invoice.customer_name || "Supplier") : (invoice.customer_name || "Customer")
      const partyDefId = isPurchase
        ? (invoice.supplier_name ? `SUPP-${invoice.supplier_name.replace(/\s+/g, "").toUpperCase()}` : `SUPP-DEFAULT`)
        : (invoice.customer_name ? `CUST-${invoice.customer_name.replace(/\s+/g, "").toUpperCase()}` : `CUST-DEFAULT`)

      const revenueLines: InvoiceGLDistributionLine[] = [
        ...revDebitLines.map((l) => ({
          id: l.id,
          account_id: l.accountId,
          account_code: l.accountCode,
          account_name: l.accountName,
          debit: Number(l.amount),
          credit: 0,
          description: l.description.trim() || (isPurchase ? "Procurement Goods / Stock Allocation" : "Customer Settlement"),
          party_type: (l.partyType ?? (isPurchase ? "Supplier" : "Customer")) as "Customer" | "Supplier" | "Employee",
          party_id: l.partyId ?? partyDefId,
          party_name: l.partyName ?? partyDisplayName,
        })),
        ...revCreditLines.map((l) => ({
          id: l.id,
          account_id: l.accountId,
          account_code: l.accountCode,
          account_name: l.accountName,
          debit: 0,
          credit: Number(l.amount),
          description: l.description.trim() || (isPurchase ? "Supplier Credit Settlement / Bank" : "Sales Revenue Recognition"),
          party_type: (l.partyType ?? (isPurchase ? "Supplier" : "Customer")) as "Customer" | "Supplier" | "Employee",
          party_id: l.partyId ?? partyDefId,
          party_name: l.partyName ?? partyDisplayName,
        })),
      ]

      let cogsLines: InvoiceGLDistributionLine[] | undefined = undefined
      if (!isPurchase && !isServiceInvoice && hasCogsSection && (cogsTotalDebits > 0 || cogsTotalCredits > 0)) {
        cogsLines = [
          ...cogsDebitLines.map((l) => ({
            id: l.id,
            account_id: l.accountId,
            account_code: l.accountCode,
            account_name: l.accountName,
            debit: Number(l.amount),
            credit: 0,
            description: l.description.trim() || "Cost of Goods Sold Expense",
          })),
          ...cogsCreditLines.map((l) => ({
            id: l.id,
            account_id: l.accountId,
            account_code: l.accountCode,
            account_name: l.accountName,
            debit: 0,
            credit: Number(l.amount),
            description: l.description.trim() || "Warehouse Inventory Asset Derecognition",
          })),
        ]
      } else if (isServiceInvoice) {
        cogsLines = []
      }

      const res = await financeStore.updateInvoiceGLDistribution(invoice.id, {
        revenueLines,
        cogsLines,
        notes: auditNote.trim() || undefined,
      })

      if (!res.success) {
        throw new Error(res.error || "Failed to update GL distribution")
      }

      showToast(
        "GL Distribution Saved & Synchronized",
        "success",
        `Invoice #${invoice.invoice_number} General Ledger distribution has been updated across ${revenueLines.length} revenue/settlement lines.`
      )

      if (onSaveSuccess) onSaveSuccess()
      onClose()
    } catch (err: any) {
      console.error("Save GL split error:", err)
      showToast("Save Failed", "warning", err.message || "Could not save GL distribution.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Modal Window */}
      <div
        className="relative z-10 bg-white rounded-3xl p-5 sm:p-6 max-w-5xl w-full shadow-2xl border border-zinc-200 overflow-y-auto no-scrollbar max-h-[92vh] flex flex-col"
      >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-zinc-100 text-zinc-900 border border-zinc-200 flex items-center gap-1">
                  <ArrowRightLeft className="size-3 text-zinc-700" />
                  Finance GL Distribution & Split
                </span>
                <span className="text-xs font-mono font-bold text-zinc-500">
                  {invoice.invoice_number}
                </span>
                {invoice.fs_no && (
                  <span className="text-[11px] font-mono font-semibold text-zinc-400">
                    FS: {invoice.fs_no}
                  </span>
                )}
                {invoice.warehouse_id && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    WH: {invoice.warehouse_id}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-zinc-950">
                Split & Map General Ledger Accounts
              </h2>
              <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                Customer: <span className="text-zinc-800 font-bold">{invoice.customer_name}</span> &bull; Invoice Total: <span className="font-mono font-black text-emerald-700">ETB {invTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 pt-3 pb-1 border-b border-zinc-100">
            <button
              type="button"
              onClick={() => setActiveTab("revenue")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "revenue"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              <Layers className="size-3.5" />
              {isPurchase ? "Section A: Procurement & Payables Split" : "Section A: Revenue & Receivables Split"}
              {isRevBalanced ? (
                <span className="size-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="size-2 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>

            {!isPurchase && !isServiceInvoice && (
              <button
                type="button"
                onClick={() => {
                  setHasCogsSection(true)
                  setActiveTab("cogs")
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "cogs"
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <Box className="size-3.5" />
                Section B: Inventory & COGS Cost Split
                {hasCogsSection && (
                  isCogsBalanced ? (
                    <span className="size-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="size-2 rounded-full bg-rose-400 animate-pulse" />
                  )
                )}
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5 pt-3">
            {/* ═════════ TAB 1: REVENUE & SETTLEMENT ═════════ */}
            {activeTab === "revenue" && (
              <div className="space-y-4">
                {/* 1. DEBITS */}
                <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        {isPurchase ? "Debit: Procurement Goods & Expense Accounts" : "Debit: Settlement & Accounts Receivable"}
                      </h3>
                      <p className="text-[11px] font-medium text-zinc-500">
                        {isPurchase ? "Choose which inventory or expense account(s) absorb the purchase value." : "Choose which account(s) receive the customer debt or direct funds (e.g. split between Trade AR and Bank Cash)."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRevDebit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5 text-emerald-600" /> Add Debit Line
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {revDebitLines.map((line, idx) => (
                      <div
                        key={line.id}
                        className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded">
                              DEBIT #{idx + 1}
                            </span>
                            <span className="text-[11px] text-zinc-700 font-bold">{isPurchase ? "Stock / Expense Account" : "Funding / Receivable Account"}</span>
                          </span>
                          {revDebitLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRevDebit(line.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Remove split line"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                          <div className="md:col-span-6">
                            <COAAccountSelector
                              label="Account"
                              value={line.accountCode}
                              onChange={(acc) =>
                                handleUpdateRevDebit(line.id, {
                                  accountId: acc.id,
                                  accountCode: acc.code,
                                  accountName: acc.name,
                                })
                              }
                              suggestedCodes={["1300-03", "1300-01", "1000-02-26", "1000-01-01", "1320-06-01"]}
                              placeholder="Select debit account..."
                              required
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Debit Amount (ETB) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              placeholder="0.00"
                              value={line.amount || ""}
                              onChange={(e) =>
                                handleUpdateRevDebit(line.id, {
                                  amount: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                            {revDebitLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleAutoFillRevDebit(idx)}
                                className="mt-1 text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles className="size-3 text-emerald-600" /> Auto-fill remainder
                              </button>
                            )}
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Line Memo
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 50% credit receivable"
                              value={line.description}
                              onChange={(e) => handleUpdateRevDebit(line.id, { description: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. CREDITS */}
                <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-blue-500" />
                        {isPurchase ? "Credit: Accounts Payable & Funding Sources" : "Credit: Sales Revenue & Tax Liability"}
                      </h3>
                      <p className="text-[11px] font-medium text-zinc-500">
                        {isPurchase ? "Distribute AP liabilities or direct bank/cash funding sources for this purchase." : "Distribute revenue among product categories, services (cleaning, storage, freight), and VAT output tax."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRevCredit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5 text-blue-600" /> Add Credit Line
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {revCreditLines.map((line, idx) => (
                      <div
                        key={line.id}
                        className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black font-mono bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded">
                              CREDIT #{idx + 1}
                            </span>
                            <span className="text-[11px] text-zinc-700 font-bold">{isPurchase ? "AP / Bank Disbursement Account" : "Revenue / Liability Account"}</span>
                          </span>
                          {revCreditLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRevCredit(line.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Remove split line"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                          <div className="md:col-span-6">
                            <COAAccountSelector
                              label="Account"
                              value={line.accountCode}
                              onChange={(acc) =>
                                handleUpdateRevCredit(line.id, {
                                  accountId: acc.id,
                                  accountCode: acc.code,
                                  accountName: acc.name,
                                })
                              }
                              suggestedCodes={[
                                "4000-01-01",
                                "4000-02-01",
                                "4000-02-02",
                                "4000-02-03",
                                "4000-02-04",
                                "4000-03-01",
                                "4000-03-02",
                                "4000-03-03",
                                "2000-05",
                              ]}
                              placeholder="Select revenue account..."
                              required
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Credit Amount (ETB) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              placeholder="0.00"
                              value={line.amount || ""}
                              onChange={(e) =>
                                handleUpdateRevCredit(line.id, {
                                  amount: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                            {revCreditLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleAutoFillRevCredit(idx)}
                                className="mt-1 text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles className="size-3 text-emerald-600" /> Auto-fill remainder
                              </button>
                            )}
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Line Memo
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Grain cleaning fee"
                              value={line.description}
                              onChange={(e) => handleUpdateRevCredit(line.id, { description: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section A Balance Bar */}
                <div className="bg-zinc-100/80 border border-zinc-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-zinc-500 text-[10px] block font-sans uppercase font-bold">Total Debits</span>
                      <span className="font-black text-zinc-900">
                        ETB {revTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="text-zinc-300 font-sans font-bold">/</span>
                    <div>
                      <span className="text-zinc-500 text-[10px] block font-sans uppercase font-bold">Total Credits</span>
                      <span className="font-black text-zinc-900">
                        ETB {revTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="text-zinc-300 font-sans font-bold">/</span>
                    <div>
                      <span className="text-zinc-500 text-[10px] block font-sans uppercase font-bold">Target Total</span>
                      <span className="font-black text-zinc-900">
                        ETB {invTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isRevBalanced && matchesInvTotal ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        Balanced with Invoice Total
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shadow-2xs">
                        <AlertTriangle className="size-3.5 text-rose-600" />
                        Diff: ETB {revDiff.toFixed(2)} {!matchesInvTotal ? "(Differs from Invoice Total)" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═════════ TAB 2: INVENTORY & COGS COST SPLIT ═════════ */}
            {!isPurchase && !isServiceInvoice && activeTab === "cogs" && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                  {isPurchase ? (
                    <span><strong>Inventory & Stock Allocation:</strong> This section controls warehouse inventory asset recognition (Debited) and clearing / in-transit allocations (Credited).</span>
                  ) : (
                    <span><strong>Cost of Goods Sold Derecognition:</strong> This section controls how inventory is taken off the balance sheet (Credited) and booked into Cost of Goods Sold expenses (Debited).</span>
                  )}
                </div>

                {/* 1. COGS / STOCK DEBITS */}
                <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-rose-500" />
                        {isPurchase ? "Debit: Warehouse Inventory Stock In Hand Asset" : "Debit: Cost of Goods Sold Expense"}
                      </h3>
                      <p className="text-[11px] font-medium text-zinc-500">
                        {isPurchase
                          ? "Inventory balance sheet asset account(s) charged for the received goods."
                          : "Expense account(s) charged for the cost value of products sold (e.g. 5000-01 Vet Drug or 5010-xx Export Commodities)."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCogsDebit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5 text-rose-600" /> {isPurchase ? "Add Stock Debit" : "Add COGS Debit"}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {cogsDebitLines.map((line, idx) => (
                      <div
                        key={line.id}
                        className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black font-mono bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded">
                              {isPurchase ? "STOCK DR" : "COGS DR"} #{idx + 1}
                            </span>
                            <span className="text-[11px] text-zinc-700 font-bold">{isPurchase ? "Inventory Stock Account" : "COGS Expense Account"}</span>
                          </span>
                          {cogsDebitLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCogsDebit(line.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Remove line"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                          <div className="md:col-span-6">
                            <COAAccountSelector
                              label="Account"
                              value={line.accountCode}
                              onChange={(acc) =>
                                handleUpdateCogsDebit(line.id, {
                                  accountId: acc.id,
                                  accountCode: acc.code,
                                  accountName: acc.name,
                                })
                              }
                              suggestedCodes={["5000-01", "5010-01", "5010-02", "5010-03", "5010-04", "1400-01", "1410-01"]}
                              placeholder="Select account..."
                              required
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              {isPurchase ? "Stock Value (ETB) *" : "Cost Amount (ETB) *"}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              placeholder="0.00"
                              value={line.amount || ""}
                              onChange={(e) =>
                                handleUpdateCogsDebit(line.id, {
                                  amount: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              {isPurchase ? "Stock Description" : "Cost Description"}
                            </label>
                            <input
                              type="text"
                              placeholder={isPurchase ? "e.g. Warehouse intake" : "e.g. Batch COGS"}
                              value={line.description}
                              onChange={(e) => handleUpdateCogsDebit(line.id, { description: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. INVENTORY CREDITS */}
                <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-amber-500" />
                        {isPurchase ? "Credit: Inventory Clearing / In-Transit Account" : "Credit: Warehouse Inventory Stock Asset"}
                      </h3>
                      <p className="text-[11px] font-medium text-zinc-500">
                        {isPurchase
                          ? "Clearing or in-transit contra account(s) relieved upon warehouse intake."
                          : "Inventory balance sheet asset account(s) being derecognized (e.g. 1400-01 Vet Drug or 1410-xx Export Stock)."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCogsCredit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5 text-amber-600" /> {isPurchase ? "Add Clearing Credit" : "Add Inventory Credit"}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {cogsCreditLines.map((line, idx) => (
                      <div
                        key={line.id}
                        className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black font-mono bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                              {isPurchase ? "CLEARING CR" : "STOCK CR"} #{idx + 1}
                            </span>
                            <span className="text-[11px] text-zinc-700 font-bold">{isPurchase ? "Clearing / Contra Account" : "Inventory Asset Account"}</span>
                          </span>
                          {cogsCreditLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCogsCredit(line.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Remove line"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                          <div className="md:col-span-6">
                            <COAAccountSelector
                              label="Account"
                              value={line.accountCode}
                              onChange={(acc) =>
                                handleUpdateCogsCredit(line.id, {
                                  accountId: acc.id,
                                  accountCode: acc.code,
                                  accountName: acc.name,
                                })
                              }
                              suggestedCodes={["1400-01", "1410-01", "1410-02", "1410-03", "1410-04", "1410-05"]}
                              placeholder="Select inventory stock account..."
                              required
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Stock Value (ETB) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              placeholder="0.00"
                              value={line.amount || ""}
                              onChange={(e) =>
                                handleUpdateCogsCredit(line.id, {
                                  amount: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-black text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-zinc-700 mb-1">
                              Inventory Description
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Stock fulfillment"
                              value={line.description}
                              onChange={(e) => handleUpdateCogsCredit(line.id, { description: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-800 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section B Balance Bar */}
                <div className="bg-zinc-100/80 border border-zinc-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-zinc-500 text-[10px] block font-sans uppercase font-bold">Total COGS Debits</span>
                      <span className="font-black text-zinc-900">
                        ETB {cogsTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="text-zinc-300 font-sans font-bold">/</span>
                    <div>
                      <span className="text-zinc-500 text-[10px] block font-sans uppercase font-bold">Total Stock Credits</span>
                      <span className="font-black text-zinc-900">
                        ETB {cogsTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCogsBalanced ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        COGS & Inventory Balanced
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shadow-2xs">
                        <AlertTriangle className="size-3.5 text-rose-600" />
                        Cost Diff: ETB {cogsDiff.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Audit Trail & Reason Note */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Finance Reason / Audit Note
              </label>
              <textarea
                rows={2}
                placeholder="Explain the transaction split rationale (e.g. Multi-commodity allocation, split payment 50% cash / 50% credit)..."
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-800 outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
              <div className="text-[11px] text-zinc-500 font-medium">
                Changes will immediately update the General Ledger journal entries and financial reports.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!canSave || isSaving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-zinc-900 hover:bg-black disabled:opacity-50 text-white font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <LoadingDots />
                      <span>Posting to General Ledger...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      <span>Save & Synchronize GL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
  )
}
