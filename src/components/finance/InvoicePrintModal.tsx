import { motion } from "framer-motion"
import { Printer, Download, X } from "lucide-react"
import type { Invoice } from "@/lib/financeStore"
import {
  printInvoiceDocument,
  exportInvoiceToExcel,
  numberToWords,
  type PrintInvoiceOptions,
} from "@/lib/exportUtils"

interface InvoicePrintModalProps {
  isOpen: boolean
  invoice: Invoice | null
  onClose: () => void
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvoicePrintModal({
  isOpen,
  invoice,
  onClose,
}: InvoicePrintModalProps) {
  if (!isOpen || !invoice) return null

  const total = Number(invoice.total || 0)
  const subtotal = Number(invoice.subtotal || total)
  const taxAmount = Number(invoice.tax_amount || 0)
  const discountAmount = Number(invoice.discount_amount || 0)
  const amountPaid = Number(invoice.amount_paid || 0)
  const balanceDue = Number(invoice.balance_due ?? Math.max(0, total - amountPaid))
  const currency = invoice.currency || "ETB"
  const isPaid = invoice.status === "Paid" || balanceDue === 0

  const lineItems = (invoice.line_items || []).map((item) => ({
    description: item.description || "Invoice Item",
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unit_price || 0),
    lineTotal: Number(item.line_total || (item.quantity || 1) * (item.unit_price || 0)),
  }))

  const taxRate = invoice.tax_rate !== undefined
    ? invoice.tax_rate
    : (subtotal > 0 && taxAmount > 0 ? Math.round((taxAmount / Math.max(1, subtotal - discountAmount)) * 100) : (taxAmount > 0 ? 15 : 0))

  const printOptions: PrintInvoiceOptions = {
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    currency,
    paymentTerms: invoice.payment_terms || "Net 30",
    status: isPaid ? "Paid" : invoice.status,
    lineItems,
    subtotal,
    taxAmount,
    taxRate,
    discountAmount,
    total,
    amountPaid,
    balanceDue,
    amountInWords: numberToWords(total),
    company: {
      name: "Habtom Kebede Veterinary Drug Import",
      address: "Addis Ababa, Ethiopia",
      phone: "+251 911 12 21 02 / +251 944 73 92 22",
      tin: "0002847591",
    },
  }

  const handlePrint = () => {
    printInvoiceDocument(printOptions)
  }

  const handleExportExcel = () => {
    exportInvoiceToExcel(printOptions)
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 my-8 space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:rounded-none max-h-[90vh] overflow-y-auto text-zinc-900"
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 print:hidden">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Export Sales Invoice</h3>
            <p className="text-xs font-semibold text-zinc-500">Official Sales Invoice • {invoice.invoice_number}</p>
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
                Habtom Kebede Veterinary Drug Import
              </h2>
              <div className="text-xs font-semibold text-zinc-600 mt-1 leading-relaxed">
                Addis Ababa, Ethiopia<br />
                Telephone: +251 911 12 21 02 • TIN: 0002847591
              </div>
            </div>

            <div className="md:text-right">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Invoice Number</div>
                <div className="text-xs font-mono font-black text-zinc-950 mt-0.5">{invoice.invoice_number}</div>
              </div>
              <div className="mt-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Payment Status</div>
                <div className={`text-xs font-black uppercase mt-0.5 ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>
                  {isPaid ? "Paid" : "Unpaid"}
                </div>
              </div>
            </div>
          </div>

          {/* Title Banner */}
          <div className="my-4 py-2 bg-zinc-100 border border-zinc-950 text-center rounded-lg">
            <h1 className="text-sm font-black uppercase tracking-wider text-zinc-950">Sales Invoice</h1>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="border border-zinc-200 bg-white p-3 rounded-xl">
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-1 mb-2">
                Billed To
              </div>
              <dl className="text-xs space-y-1">
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Customer:</dt><dd className="font-black text-zinc-950">{invoice.customer_name}</dd></div>
              </dl>
            </div>

            <div className="border border-zinc-200 bg-white p-3 rounded-xl">
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-1 mb-2">
                Invoice Details
              </div>
              <dl className="text-xs space-y-1">
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Issue Date:</dt><dd className="font-mono font-bold text-zinc-950">{invoice.issue_date}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500 font-bold">Currency:</dt><dd className="font-bold text-zinc-800">{currency}</dd></div>
              </dl>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 border-b border-zinc-950 text-[10px] font-black uppercase text-zinc-700">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Total ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2 px-3 font-mono text-zinc-500">{index + 1}</td>
                    <td className="py-2 px-3 font-black text-zinc-950">{item.description}</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-zinc-950">{item.quantity.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono text-zinc-700">{money(item.unitPrice)}</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-zinc-950">{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lower Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 items-start">
            <div className="border border-zinc-200 bg-white p-3.5 rounded-xl">
              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Amount in Words
              </div>
              <div className="text-xs font-black text-zinc-950">{printOptions.amountInWords}</div>
            </div>

            <div className="border border-zinc-950 bg-white rounded-xl overflow-hidden text-xs">
              <div className="flex justify-between p-2 border-b border-zinc-100"><span className="text-zinc-600 font-bold">Subtotal</span><strong className="font-mono">{money(subtotal)}</strong></div>
              {discountAmount > 0 && <div className="flex justify-between p-2 border-b border-zinc-100"><span className="text-zinc-600 font-bold">Discount</span><strong className="font-mono text-emerald-700">-{money(discountAmount)}</strong></div>}
              <div className="flex justify-between p-2 border-b border-zinc-100"><span className="text-zinc-600 font-bold">Tax (VAT {taxRate}%)</span><strong className="font-mono">{money(taxAmount)}</strong></div>
              <div className="flex justify-between p-2.5 bg-zinc-950 text-white font-black text-sm"><span>Total Receivable</span><strong className="font-mono">{currency} {money(total)}</strong></div>
              <div className="flex justify-between p-2 border-b border-zinc-100 text-emerald-700 font-bold"><span>Amount Paid</span><strong className="font-mono">{currency} {money(amountPaid)}</strong></div>
              <div className={`flex justify-between p-2 font-black text-xs ${balanceDue > 0 ? "text-red-700 bg-red-50/50" : "text-emerald-700"}`}><span>Balance</span><strong className="font-mono">{currency} {money(balanceDue)}</strong></div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
