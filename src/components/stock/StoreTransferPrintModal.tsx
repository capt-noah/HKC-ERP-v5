import { motion } from "framer-motion"
import { Printer, Download, X, FileText, AlertTriangle, Clock } from "lucide-react"
import { printStoreTransferDocument, exportStoreTransferExcel } from "@/lib/exportUtils"
import type { Transfer } from "@/lib/erpStore"

interface StoreTransferPrintModalProps {
  isOpen: boolean
  transfer: Transfer | null
  onClose: () => void
}

export default function StoreTransferPrintModal({
  isOpen,
  transfer,
  onClose,
}: StoreTransferPrintModalProps) {
  if (!isOpen || !transfer) return null

  const lineItems = Array.isArray(transfer.line_items)
    ? transfer.line_items
    : Array.isArray((transfer as any).items)
    ? (transfer as any).items
    : []

  const totalQty = transfer.total_quantity || lineItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0)

  const transferOptions = {
    referenceNumber: transfer.reference_number,
    date: transfer.date,
    fromWarehouse: transfer.from_warehouse,
    toWarehouse: transfer.to_warehouse,
    status: transfer.status,
    issuedBy: transfer.issued_by,
    issuedAt: transfer.issued_at,
    issuedSignature: transfer.issued_signature,
    receivedBy: transfer.received_by,
    receivedAt: transfer.received_at,
    receivedSignature: transfer.received_signature,
    discrepancyRemark: transfer.discrepancy_remark,
    lineItems: lineItems.map((line: any, idx: number) => ({
      line_no: line.line_no || idx + 1,
      productId: line.productId,
      item: line.item || (line as any).productName || (line as any).product_name || "Medicine",
      UOM: line.UOM || (line as any).uom || "Pieces",
      batch_no: line.batch_no || (line as any).batchNo || "Standard Lot",
      expiry: line.expiry || (line as any).expiryDate || "",
      quantity: Number(line.quantity || 0),
      unit_price: Number(line.unit_price || (line as any).unitCost || 0),
      remark: line.remark || (line as any).notes || "",
    })),
    totalQuantity: totalQty,
  }

  const handlePrintPdf = () => {
    printStoreTransferDocument(transferOptions)
  }

  const handleExportExcel = () => {
    exportStoreTransferExcel(transferOptions)
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 my-8 space-y-6 max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 shrink-0">
          <div>
            <h3 className="text-xl font-black text-zinc-950 flex items-center gap-2">
              <FileText className="size-5 text-emerald-600" />
              Material Transfer Note Document Preview
            </h3>
            <p className="text-xs font-semibold text-zinc-500">
              Ref: <span className="font-mono text-zinc-900 font-bold">{transfer.reference_number}</span> &bull; {transfer.from_warehouse} &rarr; {transfer.to_warehouse}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Download className="size-3.5 text-emerald-700" /> Export Excel
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-black text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Printer className="size-3.5 text-white" /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet Preview */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="border border-zinc-200 rounded-2xl p-6 bg-white space-y-6 shadow-xs font-sans text-xs">
            {/* Letterhead Header */}
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/hkc_logo.png"
                  alt="HKC Logo"
                  className="h-14 w-auto object-contain"
                />
                <div>
                  <h1 className="text-base font-black text-zinc-950 tracking-tight leading-tight">
                    Habtom Kebede Veterinary Drug Import
                  </h1>
                  <p className="text-[11px] font-semibold text-zinc-600">
                    Addis Ababa, Ethiopia &bull; Tel: +251 911 12 21 02 / +251 944 73 92 22
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-emerald-700 uppercase tracking-wider block">MATERIAL TRANSFER NOTE</span>
                <span className="font-mono text-xs font-bold text-zinc-900">{transfer.reference_number}</span>
              </div>
            </div>

            {/* Movement Route Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200 text-xs font-semibold">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block mb-0.5">Origin Store (Sender)</span>
                <span className="text-xs font-black text-zinc-900">{transfer.from_warehouse}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block mb-0.5">Destination Store (Receiver)</span>
                <span className="text-xs font-black text-zinc-900">{transfer.to_warehouse}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block mb-0.5">Transfer Date & Status</span>
                <span className="text-xs font-mono font-bold text-zinc-900">{transfer.date}</span>
                <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase border border-zinc-200 bg-white">
                  {transfer.status}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto border border-zinc-200 rounded-xl">
              <table className="w-full text-left border-collapse text-[11px] font-medium">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-700">
                    <th className="p-2.5 text-center w-12 border-r border-zinc-200">No.</th>
                    <th className="p-2.5 border-r border-zinc-200">Item Description</th>
                    <th className="p-2.5 text-center border-r border-zinc-200">Batch / Lot No.</th>
                    <th className="p-2.5 text-center border-r border-zinc-200">UOM</th>
                    <th className="p-2.5 text-right border-r border-zinc-200">Transfer Qty</th>
                    <th className="p-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-bold text-zinc-800">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-zinc-400 font-semibold italic">
                        No line items recorded on this transfer note.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((line: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-mono text-zinc-400 text-center border-r border-zinc-200">{line.line_no || idx + 1}</td>
                        <td className="p-2.5 text-zinc-900 border-r border-zinc-200">{line.item}</td>
                        <td className="p-2.5 text-center font-mono border-r border-zinc-200">{line.batch_no || "Standard Lot"}</td>
                        <td className="p-2.5 text-center text-zinc-500 border-r border-zinc-200">{line.UOM || "Pieces"}</td>
                        <td className="p-2.5 text-right font-mono font-black text-zinc-950 bg-black/[0.02] border-r border-zinc-200">
                          {Number(line.quantity || 0).toLocaleString()}
                        </td>
                        <td className="p-2.5 text-zinc-500 font-normal">
                          {line.remark || (line.expiry ? `Exp: ${line.expiry}` : "—")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-950 text-white font-black text-xs">
                    <td colSpan={4} className="p-3 text-right uppercase text-[10px] tracking-wider text-zinc-300">
                      Total Validated Quantity:
                    </td>
                    <td className="p-3 text-right font-mono text-sm">
                      {totalQty.toLocaleString()} Units
                    </td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Two-Party Sign-off Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Issuance Sign-off */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">1. Origin Issuance Sign-off</span>
                <div className="text-xs space-y-1 font-semibold">
                  <p><span className="text-zinc-400">Date:</span> {transfer.issued_at || transfer.date}</p>
                  <p><span className="text-zinc-400">Dispatcher:</span> <strong className="text-zinc-900">{transfer.issued_by || "Store Manager"}</strong></p>
                  <div className="pt-1">
                    <span className="font-serif italic text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                      {transfer.issued_signature || transfer.issued_by || "Authorized"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt Sign-off */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">2. Receiver Verification Sign-off</span>
                {transfer.status === "Received" ? (
                  <div className="text-xs space-y-1 font-semibold">
                    <p><span className="text-zinc-400">Date:</span> {transfer.received_at || transfer.date}</p>
                    <p><span className="text-zinc-400">Verified By:</span> <strong className="text-zinc-900">{transfer.received_by}</strong></p>
                    <div className="pt-1">
                      <span className="font-serif italic text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                        {transfer.received_signature || transfer.received_by || "Verified"}
                      </span>
                    </div>
                  </div>
                ) : transfer.status === "Discrepancy" ? (
                  <div className="text-xs space-y-1 font-semibold text-amber-700">
                    <p className="flex items-center gap-1 font-black"><AlertTriangle className="size-3.5" /> Discrepancy Flagged</p>
                    <p className="text-zinc-500 font-medium text-[11px]">Remark: {transfer.discrepancy_remark}</p>
                  </div>
                ) : (
                  <div className="text-zinc-400 py-3 text-center flex items-center justify-center gap-1.5 font-bold">
                    <Clock className="size-4" /> Pending arrival & receipt at {transfer.to_warehouse}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
