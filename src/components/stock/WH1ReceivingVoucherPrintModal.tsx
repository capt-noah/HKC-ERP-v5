import { motion } from "framer-motion"
import { Printer, Download, X, FileText } from "lucide-react"
import {
  printWH1ReceivingVoucherDocument,
  exportWH1ReceivingVoucherExcel,
} from "@/lib/exportUtils"
import type { Product, WH1Entry } from "@/lib/erpStore"

interface WH1ReceivingVoucherPrintModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
}

export default function WH1ReceivingVoucherPrintModal({
  isOpen,
  product,
  onClose,
}: WH1ReceivingVoucherPrintModalProps) {
  if (!isOpen || !product) return null

  const entries: WH1Entry[] = product.wh1Entries || []

  // Aggregate metadata for the parent product
  const voucherNo = product.voucherNo || entries.map(e => e.voucherNo).filter(Boolean).join(", ") || "—"
  const customer = product.customer || entries.map(e => e.customer).filter(Boolean).join(", ") || "—"
  const plateNumber = product.plateNumber || entries.map(e => e.plateNumber).filter(Boolean).join(", ") || "—"
  const date = product.entryDate || (entries.length > 0 ? entries[0].entryDate : new Date().toISOString().slice(0, 10))
  const warehouseName = product.warehouseName || product.warehouse || "WH1 - Commodity Store"

  // Render all data/entries for the parent product
  const itemsToRender = entries.length > 0
    ? entries.map((entry, idx) => ({
        itemNo: idx + 1,
        description: entries.length > 1 ? `${product.name} (Entry: ${entry.entryId})` : product.name,
        unit: product.unit,
        quantity: entry.quantityReceived,
        unitPrice: entry.unitPrice || product.unitCost || 0,
        totalPrice: (entry.quantityReceived || 0) * (entry.unitPrice || product.unitCost || 0),
        remarks: [
          entry.voucherNo ? `Voucher: ${entry.voucherNo}` : null,
          entry.customer ? `Customer: ${entry.customer}` : null,
          entry.plateNumber ? `Plate: ${entry.plateNumber}` : null,
          entry.notes || null,
        ].filter(Boolean).join(" | ") || "—",
      }))
    : [
        {
          itemNo: 1,
          description: product.name,
          unit: product.unit,
          quantity: product.quantity,
          unitPrice: product.unitCost || 0,
          totalPrice: (product.quantity || 0) * (product.unitCost || 0),
          remarks: product.description || "—",
        },
      ]

  const totalQuantity = itemsToRender.reduce((sum, i) => sum + Number(i.quantity || 0), 0)
  const totalValue = itemsToRender.reduce((sum, i) => sum + Number(i.totalPrice || 0), 0)

  const voucherOptions = {
    voucherNo,
    date,
    customer,
    plateNumber,
    warehouseName,
    items: itemsToRender,
    notes: product.description || "",
  }

  const handlePrintPdf = () => {
    printWH1ReceivingVoucherDocument(voucherOptions)
  }

  const handleExportExcel = () => {
    exportWH1ReceivingVoucherExcel(voucherOptions)
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
              Goods Receiving Voucher Preview
            </h3>
            <p className="text-xs font-semibold text-zinc-500">
              {product.name} &bull; <span className="font-mono text-emerald-700 font-bold">{product.sku}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="size-3.5" /> Print / PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Download className="size-3.5 text-zinc-500" /> Export Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors ml-2 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Document Body Preview */}
        <div className="overflow-y-auto pr-1 space-y-6 flex-1 text-xs">
          <div className="border border-zinc-200 rounded-2xl p-6 bg-zinc-50/50 space-y-6">
            {/* Header Preview with Logo */}
            <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3.5">
                <img src="/hkc_logo.png" alt="HKC Logo" className="h-12 w-auto object-contain" />
                <div>
                  <h4 className="text-base font-black uppercase text-zinc-900">Habtom Kebede Import & Export</h4>
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Commodity Storage & Processing Warehouse</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black uppercase tracking-wider text-zinc-800">Goods Receiving Voucher</div>
                <div className="text-lg font-black font-mono text-rose-700">No. {voucherNo}</div>
              </div>
            </div>

            {/* Metadata Preview Grid */}
            <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
              <div>
                <span className="text-[10px] uppercase font-black text-zinc-400 block">Customer</span>
                <span className="font-bold text-zinc-900 text-sm">{customer}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-black text-zinc-400 block">Plate Number</span>
                <span className="font-mono font-bold text-zinc-900 text-sm">{plateNumber}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950 text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-4">Item Description</th>
                    <th className="py-2.5 px-3 text-center">UoM</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4 text-right">Unit Price (ETB)</th>
                    <th className="py-2.5 px-4 text-right">Total Price (ETB)</th>
                    <th className="py-2.5 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {itemsToRender.map((item) => (
                    <tr key={item.itemNo} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 px-3 text-center font-bold text-zinc-400">{item.itemNo}</td>
                      <td className="py-2.5 px-4 font-bold text-zinc-900">{item.description}</td>
                      <td className="py-2.5 px-3 text-center uppercase font-bold text-zinc-600">{item.unit}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-900">{item.quantity.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-zinc-700">{item.unitPrice > 0 ? item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-800">{item.totalPrice > 0 ? item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
                      <td className="py-2.5 px-4 text-zinc-500">{item.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-zinc-200 font-bold text-xs">
              <div>Total Quantity: <span className="font-mono text-emerald-700 font-black">{totalQuantity.toLocaleString()} {product.unit}</span></div>
              <div>Total Value: <span className="font-mono text-zinc-950 font-black">{totalValue > 0 ? `ETB ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}</span></div>
            </div>

            {product.description && (
              <div className="text-xs text-zinc-500 bg-white p-3 rounded-xl border border-zinc-200">
                <strong>Description:</strong> {product.description}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
