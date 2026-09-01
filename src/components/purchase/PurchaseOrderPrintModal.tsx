import { motion } from "framer-motion"
import { Printer, Download, X } from "lucide-react"
import type { PurchaseOrder } from "@/lib/erpStore"
import { numberToBirrWords } from "@/lib/numberToWords"
import {
  printPurchaseOrderDocument,
  exportPurchaseOrderToExcel,
  type PrintPurchaseOrderOptions,
} from "@/lib/exportUtils"

interface PurchaseOrderPrintModalProps {
  isOpen: boolean
  po: PurchaseOrder | null
  onClose: () => void
}

export default function PurchaseOrderPrintModal({
  isOpen,
  po,
  onClose,
}: PurchaseOrderPrintModalProps) {
  if (!isOpen || !po) return null

  const voucherNo = po.voucherNo || po.poNumber || "PV-000"
  const amountWords = po.amountInWords || numberToBirrWords(Number(po.amount || 0))
  const entries = Array.isArray(po.accountEntries) && po.accountEntries.length > 0
    ? po.accountEntries
    : [{ accountCode: po.targetAccountCode || "1410", description: po.reasonForPayment || "Payment", debit: po.amount, credit: 0 }]

  const totalDebit = entries.reduce((s, r) => s + (Number(r.debit) || 0), 0)
  const totalCredit = entries.reduce((s, r) => s + (Number(r.credit) || 0), 0)

  const printOptions: PrintPurchaseOrderOptions = {
    voucherNo,
    date: po.date || "",
    paidTo: po.paidTo || po.supplier || "",
    reasonForPayment: po.reasonForPayment || po.category || "",
    bankName: po.bankName || "Commercial Bank of Ethiopia (CBE)",
    paymentMethod: po.paymentMethod || "Cheque",
    chequeNo: po.chequeNo || "",
    amount: Number(po.amount || 0),
    amountInWords: amountWords,
    status: po.status || "PAID",
    accountEntries: entries,
    targetAccountCode: po.targetAccountCode || "1410",
    company: {
      name: "HABTOM KEBEDE CHIMSA IMPORT & EXPORT",
    },
  }

  const handlePrint = () => {
    printPurchaseOrderDocument(printOptions)
  }

  const handleExportExcel = () => {
    exportPurchaseOrderToExcel(printOptions)
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
            <h3 className="text-lg font-black text-zinc-950">Export Payment Voucher</h3>
            <p className="text-xs font-semibold text-zinc-500">Official Cheque Voucher Slip • {voucherNo}</p>
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
        <div className="border-2 border-zinc-900 rounded-2xl p-6 flex flex-col gap-5 bg-white">
          {/* Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-4">
            <h2 className="text-lg font-black uppercase tracking-wider text-zinc-950">
              HABTOM KEBEDE CHIMSA IMPORT & EXPORT
            </h2>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mt-0.5">
              CHEQUE PAYMENT VOUCHER
            </p>
          </div>

          {/* Top Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-500">Voucher No:</span>
              <span className="font-mono font-black text-zinc-950 border-b border-zinc-300 pb-0.5 flex-1">
                {voucherNo}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-500">Date:</span>
              <span className="font-semibold text-zinc-950 border-b border-zinc-300 pb-0.5 flex-1">
                {po.date}
              </span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <span className="font-bold text-zinc-500">Paid To:</span>
              <span className="font-bold text-zinc-950 border-b border-zinc-300 pb-0.5 flex-1">
                {po.paidTo || po.supplier}
              </span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <span className="font-bold text-zinc-500">Reason for Payment:</span>
              <span className="font-medium text-zinc-900 border-b border-zinc-300 pb-0.5 flex-1">
                {po.reasonForPayment || po.category || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-500">Bank:</span>
              <span className="font-semibold text-zinc-950 border-b border-zinc-300 pb-0.5 flex-1">
                {po.bankName || "Commercial Bank of Ethiopia (CBE)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-500">Payment Method:</span>
              <span className="font-semibold text-zinc-950 border-b border-zinc-300 pb-0.5 flex-1">
                {po.paymentMethod || "Cheque"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-500">Cheque / Ref No:</span>
              <span className="font-mono font-bold text-zinc-950 border-b border-zinc-300 pb-0.5 flex-1">
                {po.chequeNo || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-500">Amount in Figure:</span>
              <span className="font-mono font-black text-zinc-950 border-b border-zinc-300 pb-0.5 flex-1">
                ETB {Number(po.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Amount in words */}
          <div className="text-xs flex items-center gap-2 border-t border-b border-zinc-200 py-2.5 bg-zinc-50 px-3 rounded-lg">
            <span className="font-bold text-zinc-500 shrink-0">Amount in Words:</span>
            <span className="font-bold text-zinc-950 italic flex-1">
              {amountWords}
            </span>
          </div>

          {/* Account Entries Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-900">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-900 font-bold">
                  <th className="border-r border-zinc-900 py-2 px-3 text-left w-[130px]">Account No.</th>
                  <th className="border-r border-zinc-900 py-2 px-3 text-left">Description</th>
                  <th className="border-r border-zinc-900 py-2 px-3 text-right w-[130px]">Debit</th>
                  <th className="py-2 px-3 text-right w-[130px]">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {entries.map((row, idx) => (
                  <tr key={idx}>
                    <td className="border-r border-zinc-900 py-2 px-3 font-mono font-bold">{row.accountCode}</td>
                    <td className="border-r border-zinc-900 py-2 px-3">{row.description || po.reasonForPayment || "—"}</td>
                    <td className="border-r border-zinc-900 py-2 px-3 text-right font-mono font-semibold">
                      {row.debit && Number(row.debit) > 0 ? Number(row.debit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">
                      {row.credit && Number(row.credit) > 0 ? Number(row.credit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-100 font-black border-t-2 border-zinc-900">
                  <td colSpan={2} className="border-r border-zinc-900 py-2 px-3 text-right text-[10px] uppercase">
                    Total Summary:
                  </td>
                  <td className="border-r border-zinc-900 py-2 px-3 text-right font-mono">
                    ETB {totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    ETB {totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Attached Files List */}
          {Array.isArray(po.attachments) && po.attachments.length > 0 && (
            <div className="text-xs border border-zinc-200 rounded-xl p-3 bg-zinc-50/60">
              <span className="font-bold text-zinc-700 block mb-1">Attached Supporting Documents:</span>
              <div className="flex flex-wrap gap-2">
                {po.attachments.map((att, idx) => (
                  <span key={idx} className="font-medium text-zinc-600 bg-white px-2 py-0.5 rounded border border-zinc-200">
                    {typeof att === "string" ? `File ${idx + 1}` : att.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
