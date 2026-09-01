import { motion } from "framer-motion"
import { Printer, Download, X } from "lucide-react"
import { exportToExcel, printBinCardDocument } from "@/lib/exportUtils"
import type { Product } from "@/lib/erpStore"

interface StockBinCardPrintModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
}

export default function StockBinCardPrintModal({
  isOpen,
  product,
  onClose
}: StockBinCardPrintModalProps) {
  if (!isOpen || !product) return null

  const entries = product.binCardEntries || []
  const totalReceived = entries.reduce((sum, e) => sum + Number(e.qtyReceived || 0), 0)
  const totalIssued = entries.reduce((sum, e) => sum + Number(e.qtyIssued || 0), 0)
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance : product.quantity

  const handlePrintPdf = () => {
    printBinCardDocument({
      cardNo: product.sku,
      description: product.name,
      dosage: product.dosage || "-",
      unit: product.unit,
      shelfNo: product.shelfNo || "-",
      entries: entries.map((e) => ({
        date: e.date,
        batchNo: e.batchNo,
        qtyReceived: e.qtyReceived,
        qtyIssued: e.qtyIssued,
        balance: e.balance,
        expiryDate: e.expiryDate || "-",
        party: e.party || "-",
        remark: e.remark || "-",
      }))
    })
  }

  const handleExportExcel = () => {
    exportToExcel({
      fileName: `Stock_Bin_Card_${product.sku || product.name.replace(/\s+/g, "_")}`,
      sheetName: "Bin Card",
      title: "Habtom Kebede Veterinary Drug Import",
      subtitle: `BIN STOCK CARD - ${product.name}`,
      metadata: [
        { label: "Card No / SKU", value: product.sku },
        { label: "Item Description", value: product.name },
        { label: "Strength / Dosage", value: product.dosage || "-" },
        { label: "Unit of Measurement", value: product.unit },
        { label: "Warehouse", value: product.warehouseName || product.warehouse },
        { label: "Shelf Location", value: product.shelfNo || "-" },
        { label: "Current Live Balance", value: `${currentBalance.toLocaleString()} ${product.unit}` }
      ],
      headers: [
        "Date",
        "Batch Number",
        "Quantity Received",
        "Quantity Issued",
        "Balance",
        "Expiry Date",
        "Received From / Issued To",
        "Remark / Reference"
      ],
      rows: entries.map((e) => [
        e.date,
        e.batchNo,
        e.qtyReceived > 0 ? e.qtyReceived : "-",
        e.qtyIssued > 0 ? e.qtyIssued : "-",
        e.balance,
        e.expiryDate || "-",
        e.party || "-",
        e.remark || "-"
      ])
    })
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
            <h3 className="text-xl font-black text-zinc-950">Bin Card Document Preview</h3>
            <p className="text-xs font-semibold text-zinc-500">
              {product.name} &bull; <span className="font-mono text-emerald-700 font-bold">{product.sku}</span>
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
                <span className="text-xs font-black text-zinc-900 uppercase tracking-wider block">BIN STOCK CARD</span>
                <span className="font-mono text-xs font-bold text-zinc-500">{product.sku}</span>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">Description</span>
                <span className="font-bold text-zinc-900">{product.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">Strength / Dosage</span>
                <span className="font-bold text-zinc-900">{product.dosage || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">Unit / Warehouse</span>
                <span className="font-bold text-zinc-900">{product.unit} ({product.warehouseName || product.warehouse})</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block">Shelf Number</span>
                <span className="font-bold text-zinc-900">{product.shelfNo || "-"}</span>
              </div>
            </div>

            {/* Movement Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] font-medium border border-zinc-300">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-300 text-[10px] font-black uppercase text-zinc-700">
                    <th rowSpan={2} className="p-2 border-r border-zinc-300">Date</th>
                    <th rowSpan={2} className="p-2 border-r border-zinc-300">Batch No</th>
                    <th colSpan={3} className="p-1 text-center border-r border-b border-zinc-300 bg-zinc-200/80 font-black">
                      Quantity ({product.unit})
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-zinc-300">Expiry</th>
                    <th rowSpan={2} className="p-2 border-r border-zinc-300">Party / Ref</th>
                    <th rowSpan={2} className="p-2">Remark</th>
                  </tr>
                  <tr className="bg-zinc-100 border-b border-zinc-300 text-[9px] font-black uppercase text-zinc-600">
                    <th className="p-1.5 border-r border-zinc-300 text-right text-emerald-800">In (+)</th>
                    <th className="p-1.5 border-r border-zinc-300 text-right text-rose-800">Out (-)</th>
                    <th className="p-1.5 border-r border-zinc-300 text-right font-black text-zinc-950">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-zinc-400 font-semibold italic">
                        No transactions registered on this bin card.
                      </td>
                    </tr>
                  ) : (
                    entries.map((e) => (
                      <tr key={e.id}>
                        <td className="p-2 font-mono text-[10px] font-bold border-r border-zinc-200">{e.date}</td>
                        <td className="p-2 font-mono text-zinc-900 font-bold border-r border-zinc-200">{e.batchNo}</td>
                        <td className="p-2 text-right font-mono text-emerald-700 font-bold border-r border-zinc-200">
                          {e.qtyReceived > 0 ? `+${e.qtyReceived.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2 text-right font-mono text-rose-700 font-bold border-r border-zinc-200">
                          {e.qtyIssued > 0 ? `-${e.qtyIssued.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2 text-right font-mono font-black text-zinc-950 bg-zinc-50 border-r border-zinc-200">
                          {e.balance.toLocaleString()}
                        </td>
                        <td className="p-2 font-mono border-r border-zinc-200">{e.expiryDate || "-"}</td>
                        <td className="p-2 font-semibold text-zinc-800 border-r border-zinc-200">{e.party || "-"}</td>
                        <td className="p-2 text-zinc-500">{e.remark || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 border-t-2 border-zinc-300 text-xs font-mono font-bold">
                    <td colSpan={2} className="p-2 text-right uppercase text-[10px] font-black border-r border-zinc-300">
                      Total Ledger Summary:
                    </td>
                    <td className="p-2 text-right text-emerald-800 border-r border-zinc-300">+{totalReceived.toLocaleString()}</td>
                    <td className="p-2 text-right text-rose-800 border-r border-zinc-300">-{totalIssued.toLocaleString()}</td>
                    <td className="p-2 text-right font-black bg-zinc-200 border-r border-zinc-300">{currentBalance.toLocaleString()}</td>
                    <td colSpan={3} className="p-2 text-zinc-500 font-sans italic text-[10px]">
                      Live Balance: {currentBalance.toLocaleString()} {product.unit}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
