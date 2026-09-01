import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react"
import { GlassCard } from "@/components/GlassCard"
import { useErpStore } from "@/lib/erpStore"
import { financeStore } from "@/lib/financeStore"
import { getSalesIssue, type SalesIssue, type SalesIssueItem } from "@/lib/salesIssuesApi"
import { API_BASE } from "@/lib/apiPersistence"
import {
  printSalesIssueDocument,
  exportSalesIssueToExcel,
  type PrintSalesIssueOptions,
} from "@/lib/exportUtils"

type AttachmentIssue = SalesIssue & {
  station?: string
  store?: string
  vat_amount?: number
  vat?: number
  discount_amount?: number
  discount?: number
  updated_at?: string
}

type CompanyProfile = {
  company_name?: string
  name?: string
  address?: string
  telephone?: string
  phone?: string
  tin?: string
  tin_number?: string
}

type CustomerRecord = {
  id: string
  name: string
  tin?: string
  tinNumber?: string
  address?: string
  region?: string
  country?: string
  accountNumber?: string
  account_no?: string
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value?: string) {
  if (!value) return "-"
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value))
}

const smallNumbers = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
]

const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function chunkToWords(value: number): string {
  if (value < 20) return smallNumbers[value]
  if (value < 100) {
    const ten = Math.floor(value / 10)
    const rest = value % 10
    return rest ? `${tens[ten]} ${smallNumbers[rest]}` : tens[ten]
  }
  const hundred = Math.floor(value / 100)
  const rest = value % 100
  return rest ? `${smallNumbers[hundred]} Hundred ${chunkToWords(rest)}` : `${smallNumbers[hundred]} Hundred`
}

function numberToWords(value: number): string {
  const whole = Math.max(0, Math.round(value))
  if (whole === 0) return "Zero Birr Only"
  const groups = [
    { value: 1_000_000_000, label: "Billion" },
    { value: 1_000_000, label: "Million" },
    { value: 1_000, label: "Thousand" },
    { value: 1, label: "" },
  ]
  let remainder = whole
  const words: string[] = []
  for (const group of groups) {
    const amount = Math.floor(remainder / group.value)
    if (amount) {
      words.push(`${chunkToWords(amount)}${group.label ? ` ${group.label}` : ""}`)
      remainder %= group.value
    }
  }
  return `${words.join(" ")} Birr Only`
}

function lineTotal(item: SalesIssueItem) {
  return Number(item.quantity || 0) * Number(item.unit_price || 0)
}

async function loadCompanyProfile() {
  const response = await fetch(`${API_BASE}/api/company_settings`)
  if (!response.ok) return null
  const body = await response.json()
  return Array.isArray(body) ? (body[0] as CompanyProfile | undefined) ?? null : null
}

export default function CreditSalesAttachment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const erp = useErpStore()
  const [issue, setIssue] = useState<AttachmentIssue | null>(() => (location.state as { issue?: AttachmentIssue } | null)?.issue ?? null)
  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!id) return
      setLoading(true)
      setError("")
      try {
        const detail = await getSalesIssue(id)
        if (!cancelled) setIssue(detail as AttachmentIssue)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the selected sales issue.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    loadCompanyProfile()
      .then((profile) => {
        if (!cancelled) setCompany(profile)
      })
      .catch(() => {
        if (!cancelled) setCompany(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const customers = erp.getCustomers() as CustomerRecord[]
  const warehouses = erp.getWarehouses()
  const products = erp.getProducts()
  const customer = customers.find((entry) => entry.id === issue?.customer_id || entry.name === issue?.customer_name)
  const warehouse = warehouses.find((entry) => entry.id === issue?.warehouse_id || entry.code === issue?.warehouse_id)

  const rows = issue?.items ?? []
  const companyName = company?.company_name || company?.name
  const companyPhone = company?.telephone || company?.phone
  const companyTin = company?.tin || company?.tin_number
  const subtotal = rows.reduce((sum, item) => sum + lineTotal(item), 0)
  const vat = Number(issue?.vat_amount ?? issue?.vat ?? 0)
  const discount = Number(issue?.discount_amount ?? issue?.discount ?? 0)
  const grandTotal = subtotal + vat - discount

  const printOptions: PrintSalesIssueOptions = {
    fsNo: issue?.fs_no || "",
    referenceNo: issue?.reference_no || "",
    saleDate: issue?.sale_date || "",
    customerName: issue?.customer_name || "",
    tin: customer?.tin || (customer as any)?.tinNumber || "",
    address: customer?.address || [customer?.region, customer?.country].filter(Boolean).join(", ") || "",
    accountNo: customer?.accountNumber || (customer as any)?.account_no || issue?.customer_id || "",
    station: (issue as any)?.station || warehouse?.location || "Headquarters Store",
    store: (issue as any)?.store || warehouse?.name || issue?.warehouse_id || "WH1",
    paymentType: issue?.payment_type || "Cash",
    items: rows.map((item) => {
      const product = products.find((p) => p.id === item.item_id || p.name === item.item_name)
      return {
        id: item.id,
        itemName: item.item_name || product?.name || item.item_id || "Product",
        batchNo: item.batch_no || product?.batch || "BATCH-MAIN",
        packagingUnit: item.packaging_unit || product?.unit || ((issue?.warehouse_id || "").toUpperCase().includes("WH1") ? "Quintal" : "Box"),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        amount: Number(item.amount || item.quantity * item.unit_price || 0),
      }
    }),
    subtotal,
    vat,
    discount,
    grandTotal,
    amountInWords: numberToWords(grandTotal),
    company: {
      name: companyName || "Habtom Kebede Veterinary Drug Import",
      address: company?.address || "Addis Ababa, Ethiopia",
      phone: companyPhone || "+251 911 12 21 02",
      tin: companyTin || "0002847591",
    },
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 print:bg-white">
      <div className="print:hidden sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Generated from Sales Issue</p>
            <h1 className="text-lg font-black tracking-tight">Credit Sales Attachment</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => printSalesIssueDocument(printOptions)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-950 px-4 text-xs font-black uppercase tracking-wide text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <Printer className="size-4" /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={() => exportSalesIssueToExcel(printOptions)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black uppercase tracking-wide text-zinc-800 hover:bg-zinc-50 transition-all cursor-pointer"
            >
              <Download className="size-4" /> Export Excel
            </button>
            <button
              type="button"
              onClick={() => navigate("/sales/sales-issued")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 transition-all cursor-pointer"
            >
              <ArrowLeft className="size-4" /> Back to Sales Issue
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">
        {error && (
          <GlassCard className="print:hidden mb-4 border border-amber-200 bg-amber-50/90 p-4 text-xs font-bold text-amber-800">
            {error}
          </GlassCard>
        )}

        {!issue ? (
          <GlassCard className="print:hidden p-8 text-center">
            <RefreshCw className={`mx-auto size-6 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
            <p className="mt-3 text-sm font-black text-zinc-700">{loading ? "Loading sales issue attachment..." : "No sales issue selected."}</p>
          </GlassCard>
        ) : (
          <section className="credit-attachment-sheet bg-white text-zinc-950 shadow-2xl print:shadow-none">
            <header className="credit-attachment-header">
              <div>
                {companyName && <h2>{companyName}</h2>}
                {company?.address && <p>{company.address}</p>}
                {companyPhone && <p>Telephone: {companyPhone}</p>}
                {companyTin && <p>TIN Number: {companyTin}</p>}
                <div className="mt-3">
                  <p className="credit-attachment-label">Document Number</p>
                  <p className="credit-attachment-docno">CSA-{issue.fs_no || issue.reference_no}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="credit-attachment-label">Reference Number</p>
                <p className="credit-attachment-docno">{issue.reference_no || "-"}</p>
                <p className="credit-attachment-label mt-3">FS Number</p>
                <p className="credit-attachment-docno">{issue.fs_no || "-"}</p>
              </div>
            </header>

            <div className="credit-attachment-title">
              <h1>Credit Sales Attachment</h1>
            </div>

            <section className="credit-attachment-info-grid">
              <div>
                <p className="credit-attachment-section-title">Bill To</p>
                <dl>
                  <div><dt>Customer Name</dt><dd>{issue.customer_name}</dd></div>
                  <div><dt>TIN</dt><dd>{customer?.tin || customer?.tinNumber || "-"}</dd></div>
                  <div><dt>Address</dt><dd>{customer?.address || [customer?.region, customer?.country].filter(Boolean).join(", ") || "-"}</dd></div>
                  <div><dt>A/C Number</dt><dd>{customer?.accountNumber || customer?.account_no || issue.customer_id}</dd></div>
                </dl>
              </div>
              <div>
                <p className="credit-attachment-section-title">Sales Issue</p>
                <dl>
                  <div><dt>Date</dt><dd>{formatDate(issue.sale_date)}</dd></div>
                  <div><dt>Reference</dt><dd>{issue.reference_no || "-"}</dd></div>
                  <div><dt>FS Number</dt><dd>{issue.fs_no || "-"}</dd></div>
                  <div><dt>Station</dt><dd>{issue.station || warehouse?.location || "-"}</dd></div>
                  <div><dt>Store</dt><dd>{issue.store || warehouse?.name || issue.warehouse_id}</dd></div>
                </dl>
              </div>
            </section>

            <table className="credit-attachment-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => {
                  const product = products.find((entry) => entry.id === item.item_id || entry.name === item.item_name)
                  return (
                    <tr key={item.id || `${item.item_id}-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.item_name || item.item_id}</strong>
                        <span>Batch No {item.batch_no || item.batch_id || "-"}</span>
                      </td>
                      <td>{item.packaging_unit || product?.unit || ""}</td>
                      <td className="text-right">{Number(item.quantity || 0).toLocaleString()}</td>
                      <td className="text-right">{money(item.unit_price)}</td>
                      <td className="text-right font-black">{money(lineTotal(item))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <section className="credit-attachment-lower">
              <div className="credit-attachment-payment">
                <p className="credit-attachment-section-title">Payment Terms / Method</p>
                <div className="flex items-center gap-8 my-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center size-4 border-2 border-black rounded-[2px] text-[11px] font-black leading-none ${issue.payment_type === "Cash" ? "bg-black text-white" : "bg-white text-transparent"}`}>
                      ✓
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-black">Cash</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center size-4 border-2 border-black rounded-[2px] text-[11px] font-black leading-none ${issue.payment_type === "Credit" ? "bg-black text-white" : "bg-white text-transparent"}`}>
                      ✓
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-black">Credit</span>
                  </div>
                </div>
                <p className="credit-attachment-label mt-4">Amount In Words</p>
                <p className="credit-attachment-words">{numberToWords(grandTotal)}</p>
              </div>

              <div className="credit-attachment-totals">
                <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                <div><span>VAT</span><strong>{money(vat)}</strong></div>
                {discount > 0 && <div><span>Discount</span><strong>{money(discount)}</strong></div>}
                <div className="grand"><span>Grand Total</span><strong>{money(grandTotal)}</strong></div>
                {issue.payment_type === "Credit" && (
                  (() => {
                    const payments = financeStore.getPaymentsForSalesIssue(issue.id)
                    const paidAmount = payments.reduce((s, p) => s + p.amount, 0) || Number(issue.amount_paid || 0)
                    const balanceDue = Number(Math.max(0, grandTotal - paidAmount).toFixed(2))
                    return (
                      <>
                        <div className="text-emerald-800"><span>Paid to Date</span><strong>{money(paidAmount)}</strong></div>
                        <div className="text-rose-800 font-black border-t border-zinc-300 pt-1"><span>Remaining Due</span><strong>{money(balanceDue)}</strong></div>
                      </>
                    )
                  })()
                )}
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  )
}
