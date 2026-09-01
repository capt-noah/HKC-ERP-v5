import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Printer, Download, X } from "lucide-react"
import type { SalesIssue } from "@/lib/salesIssuesApi"
import { useErpStore } from "@/lib/erpStore"
import { API_BASE } from "@/lib/apiPersistence"
import {
  printSalesIssueDocument,
  exportSalesIssueToExcel,
  numberToWords,
  type PrintSalesIssueOptions,
} from "@/lib/exportUtils"

interface SalesIssuePrintModalProps {
  isOpen: boolean
  issue: SalesIssue | null
  onClose: () => void
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

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SalesIssuePrintModal({
  isOpen,
  issue,
  onClose,
}: SalesIssuePrintModalProps) {
  const erp = useErpStore()
  const [company, setCompany] = useState<CompanyProfile | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    fetch(`${API_BASE}/api/company_settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body) && body[0]) {
          setCompany(body[0])
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOpen])

  if (!isOpen || !issue) return null

  const customers = erp.getCustomers()
  const warehouses = erp.getWarehouses()
  const products = erp.getProducts()

  const customer = customers.find((c) => c.id === issue.customer_id || c.name === issue.customer_name)
  const warehouse = warehouses.find((w) => w.id === issue.warehouse_id || w.code === issue.warehouse_id)

  const items = (issue.items || []).map((item) => {
    const product = products.find((p) => p.id === item.item_id || p.name === item.item_name)
    return {
      id: item.id,
      itemName: item.item_name || product?.name || item.item_id || "Product",
      batchNo: item.batch_no || product?.batch || "BATCH-MAIN",
      packagingUnit: item.packaging_unit || product?.unit || ((issue.warehouse_id || "").toUpperCase().includes("WH1") ? "Quintal" : "Box"),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      amount: Number(item.amount || item.quantity * item.unit_price || 0),
    }
  })

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  const vat = Number((issue as any).vat_amount ?? (issue as any).vat ?? 0)
  const discount = Number((issue as any).discount_amount ?? (issue as any).discount ?? 0)
  const grandTotal = subtotal + vat - discount

  const printOptions: PrintSalesIssueOptions = {
    fsNo: issue.fs_no || "",
    referenceNo: issue.reference_no || "",
    saleDate: issue.sale_date || "",
    customerName: issue.customer_name || "",
    tin: (customer as any)?.tin || (customer as any)?.tinNumber || "",
    address: customer?.address || [customer?.region, customer?.country].filter(Boolean).join(", ") || "",
    accountNo: (customer as any)?.accountNumber || (customer as any)?.account_no || issue.customer_id || "",
    station: (issue as any).station || warehouse?.location || "Headquarters Store",
    store: (issue as any).store || warehouse?.name || issue.warehouse_id || "WH1",
    paymentType: issue.payment_type || "Cash",
    items,
    subtotal,
    vat,
    discount,
    grandTotal,
    amountInWords: numberToWords(grandTotal),
    company: {
      name: company?.company_name || company?.name || "Habtom Kebede Veterinary Drug Import",
      address: company?.address || "Addis Ababa, Ethiopia",
      phone: company?.telephone || company?.phone || "+251 911 12 21 02",
      tin: company?.tin || company?.tin_number || "0002847591",
    },
  }

  const handlePrint = () => {
    printSalesIssueDocument(printOptions)
  }

  const handleExportExcel = () => {
    exportSalesIssueToExcel(printOptions)
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 my-8 space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:rounded-none max-h-[90vh] overflow-y-auto"
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 print:hidden">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Export Sales Issue Voucher</h3>
            <p className="text-xs font-semibold text-zinc-500">Credit Sales Attachment • CSA-{issue.fs_no || issue.reference_no}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Printer className="size-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Download className="size-4" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 rounded-xl hover:bg-zinc-100 transition-all cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Preview */}
        <div className="border border-zinc-200 rounded-2xl p-6 bg-zinc-50/40">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b-2 border-zinc-950 pb-4">
            <div>
              <h2 className="text-base font-black uppercase text-zinc-950">
                {printOptions.company?.name}
              </h2>
              <div className="text-xs font-semibold text-zinc-600 mt-1 leading-relaxed">
                {printOptions.company?.address}<br />
                Telephone: {printOptions.company?.phone} • TIN: {printOptions.company?.tin}
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200">
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Document Number</div>
                <div className="text-xs font-mono font-black text-zinc-950 mt-0.5">
                  CSA-{issue.fs_no || issue.reference_no}
                </div>
              </div>
            </div>

            <div className="md:text-right">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Reference Number</div>
                <div className="text-xs font-mono font-black text-zinc-950 mt-0.5">{issue.reference_no || "-"}</div>
              </div>
              <div className="mt-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">FS Number</div>
                <div className="text-xs font-mono font-black text-zinc-950 mt-0.5">{issue.fs_no || "-"}</div>
              </div>
            </div>
          </div>

          {/* Title Banner */}
          <div className="my-4 py-2 bg-zinc-100 border border-zinc-950 text-center rounded-lg">
            <h1 className="text-sm font-black uppercase tracking-wider text-zinc-950">Credit Sales Attachment</h1>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="border border-zinc-200 bg-white p-3 rounded-xl">
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-1 mb-2">
                Bill To
              </div>
              <dl className="text-xs space-y-1">
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Customer:</dt><dd className="font-black text-zinc-950">{issue.customer_name}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">TIN Number:</dt><dd className="font-mono font-bold text-zinc-800">{(customer as any)?.tin || (customer as any)?.tinNumber || "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Address:</dt><dd className="font-bold text-zinc-800">{customer?.address || "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">A/C Number:</dt><dd className="font-mono font-bold text-zinc-800">{(customer as any)?.accountNumber || (customer as any)?.account_no || issue.customer_id || "-"}</dd></div>
              </dl>
            </div>

            <div className="border border-zinc-200 bg-white p-3 rounded-xl">
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-1 mb-2">
                Sales Issue Details
              </div>
              <dl className="text-xs space-y-1">
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Sale Date:</dt><dd className="font-mono font-bold text-zinc-950">{issue.sale_date || "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Reference:</dt><dd className="font-mono font-bold text-zinc-800">{issue.reference_no || "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">FS Number:</dt><dd className="font-mono font-bold text-zinc-800">{issue.fs_no || "-"}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Station / Store:</dt><dd className="font-bold text-zinc-800">{warehouse?.name || issue.warehouse_id}</dd></div>
              </dl>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 border-b border-zinc-950 text-[10px] font-black uppercase text-zinc-700">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2 px-3 font-mono text-zinc-500">{index + 1}</td>
                    <td className="py-2 px-3">
                      <span className="font-black text-zinc-950 block">{item.itemName}</span>
                      <span className="text-[10px] font-mono text-zinc-500">Batch: {item.batchNo}</span>
                    </td>
                    <td className="py-2 px-3 font-bold text-zinc-700">{item.packagingUnit}</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-zinc-950">{item.quantity.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono text-zinc-700">{money(item.unitPrice)}</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-zinc-950">{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lower Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 items-start">
            <div className="border border-zinc-200 bg-white p-3.5 rounded-xl">
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">
                Payment Terms / Method
              </div>
              <div className="flex items-center gap-6 my-2">
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
              <div className="mt-3 pt-2 border-t border-zinc-100">
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Amount in Words</div>
                <div className="text-xs font-black text-zinc-950 mt-0.5">{printOptions.amountInWords}</div>
              </div>
            </div>

            <div className="border border-zinc-950 bg-white rounded-xl overflow-hidden text-xs">
              <div className="flex justify-between p-2.5 border-b border-zinc-100"><span className="text-zinc-600 font-bold">Subtotal</span><strong className="font-mono">{money(subtotal)}</strong></div>
              <div className="flex justify-between p-2.5 border-b border-zinc-100"><span className="text-zinc-600 font-bold">VAT</span><strong className="font-mono">{money(vat)}</strong></div>
              {discount > 0 && <div className="flex justify-between p-2.5 border-b border-zinc-100"><span className="text-zinc-600 font-bold">Discount</span><strong className="font-mono">{money(discount)}</strong></div>}
              <div className="flex justify-between p-3 bg-zinc-950 text-white font-black text-sm"><span>Grand Total</span><strong className="font-mono">ETB {money(grandTotal)}</strong></div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
