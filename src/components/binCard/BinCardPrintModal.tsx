import { motion } from "framer-motion"
import { Printer, Download, X, MapPin, Phone } from "lucide-react"
import type { BinCard } from "@/lib/binCardApi"
import { exportToExcel, printBinCardDocument } from "@/lib/exportUtils"

interface BinCardPrintModalProps {
  isOpen: boolean
  card: BinCard | null
  onClose: () => void
}

export default function BinCardPrintModal({
  isOpen,
  card,
  onClose
}: BinCardPrintModalProps) {
  if (!isOpen || !card) return null

  const entries = card.entries || []
  const totalReceived = entries.reduce((sum, e) => sum + e.qtyReceived, 0)
  const totalIssued = entries.reduce((sum, e) => sum + e.qtyIssued, 0)
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0

  const handlePrint = () => {
    printBinCardDocument(card)
  }

  const handleExportExcel = () => {
    const headers = [
      "Date", 
      "Batch Number", 
      "Qty Received", 
      "Qty Issued", 
      "Balance", 
      "Expiry Date", 
      "Received From / Issued To", 
      "Remark"
    ]

    const rows = entries.map(e => [
      e.date,
      e.batchNo,
      e.qtyReceived,
      e.qtyIssued,
      e.balance,
      e.expiryDate,
      e.party,
      e.remark
    ])

    exportToExcel({
      fileName: `BinCard_${card.cardNo}_${card.description.replace(/\s+/g, "_")}.xls`,
      title: "Habtom Kebede Veterinary Drug Import",
      subtitle: `BIN STOCK CARD - ${card.cardNo}`,
      metadata: [
        { label: "Card No", value: card.cardNo },
        { label: "Description / Item Name", value: card.description },
        { label: "Strength / Dosage", value: card.dosage },
        { label: "Unit of Measurement", value: card.unit },
        { label: "Shelf Location No", value: card.shelfNo },
        { label: "Total Net Balance", value: `${currentBalance} ${card.unit}` }
      ],
      headers,
      rows
    })
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 my-8 space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:rounded-none"
      >
        {/* Actions & Close Bar (Hidden on Print) */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 print:hidden">
          <div>
            <h3 className="text-lg font-black text-zinc-950 dark:text-white">Printable Bin Card Form</h3>
            <p className="text-xs font-semibold text-zinc-500">Official document preview with logo & letterhead</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Printer className="size-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Download className="size-4" />
              Export Excel
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

        {/* ------------------------------------------------------------- */}
        {/* OFFICIAL PRINTABLE FORM (Letterhead + Logo)                   */}
        {/* ------------------------------------------------------------- */}
        <div id="printable-document-sheet" className="printable-document space-y-6 bg-white text-zinc-950 p-2 print:p-0">
          
          {/* Header Letterhead with Official Logo */}
          <div className="border-b-2 border-zinc-900 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-left">
              {/* Logo from /public/hkc_logo.png */}
              <img
                src="/hkc_logo.png"
                alt="Habtom Kebede Veterinary Drug Import Logo"
                className="h-16 w-auto object-contain shrink-0"
              />
              <div>
                <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">
                  Habtom Kebede Veterinary Drug Import
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 font-semibold mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-emerald-700 print:hidden" />
                    Addis Ababa, Ethiopia
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5 text-emerald-700 print:hidden" />
                    +251 911 12 21 02 / +251 944 73 92 22
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center sm:text-right shrink-0">
              <span className="text-xs font-mono font-bold text-zinc-950 block mt-1">
                Card No: {card.cardNo}
              </span>
            </div>
          </div>

          {/* Item Metadata Specifications Header Box */}
          <div className="bg-zinc-50 border border-zinc-300 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Description / Name</span>
              <span className="font-bold text-zinc-950 text-sm block">{card.description}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Strength / Dosage</span>
              <span className="font-bold text-zinc-950 text-sm block">{card.dosage}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Unit of Measurement</span>
              <span className="font-bold text-zinc-950 text-sm block">{card.unit}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Shelf Location No</span>
              <span className="font-mono font-black text-emerald-800 text-sm block">{card.shelfNo}</span>
            </div>
          </div>

          {/* Movement Ledger Table */}
          <div className="border border-zinc-300 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-zinc-100 text-zinc-950 font-black border-b border-zinc-300 uppercase tracking-wider text-[10px]">
                  <th rowSpan={2} className="p-2.5 border-r border-zinc-300">Date</th>
                  <th rowSpan={2} className="p-2.5 border-r border-zinc-300">Batch Number</th>
                  <th colSpan={3} className="p-2 text-center border-r border-b border-zinc-300 bg-zinc-200">
                    Quantity ({card.unit})
                  </th>
                  <th rowSpan={2} className="p-2.5 border-r border-zinc-300">Expiry Date</th>
                  <th rowSpan={2} className="p-2.5 border-r border-zinc-300">Received From / Issued To</th>
                  <th rowSpan={2} className="p-2.5">Remark</th>
                </tr>
                <tr className="bg-zinc-100 text-zinc-950 font-black border-b border-zinc-300 uppercase tracking-wider text-[9px]">
                  <th className="p-2 border-r border-zinc-300 text-center text-emerald-800">Received</th>
                  <th className="p-2 border-r border-zinc-300 text-center text-rose-800">Issued</th>
                  <th className="p-2 border-r border-zinc-300 text-center bg-zinc-200">Balance</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200 font-mono text-[11px]">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-zinc-500 font-sans italic">
                      No transaction entries recorded on this bin card.
                    </td>
                  </tr>
                ) : (
                  entries.map((rec) => (
                    <tr key={rec.id} className="hover:bg-zinc-50">
                      <td className="p-2.5 border-r border-zinc-200 font-bold">{rec.date}</td>
                      <td className="p-2.5 border-r border-zinc-200 font-bold">{rec.batchNo}</td>
                      <td className={`p-2.5 border-r border-zinc-200 text-center font-bold ${rec.qtyReceived > 0 ? "text-emerald-700 bg-emerald-50/50" : "text-zinc-400"}`}>
                        {rec.qtyReceived > 0 ? `+${rec.qtyReceived.toLocaleString()}` : "-"}
                      </td>
                      <td className={`p-2.5 border-r border-zinc-200 text-center font-bold ${rec.qtyIssued > 0 ? "text-rose-700 bg-rose-50/50" : "text-zinc-400"}`}>
                        {rec.qtyIssued > 0 ? `-${rec.qtyIssued.toLocaleString()}` : "-"}
                      </td>
                      <td className="p-2.5 border-r border-zinc-200 text-center font-black bg-zinc-100">
                        {rec.balance.toLocaleString()}
                      </td>
                      <td className="p-2.5 border-r border-zinc-200">{rec.expiryDate}</td>
                      <td className="p-2.5 border-r border-zinc-200 font-sans font-medium">{rec.party}</td>
                      <td className="p-2.5 font-sans text-zinc-600">{rec.remark}</td>
                    </tr>
                  ))
                )}
              </tbody>

              <tfoot>
                <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-mono font-bold text-xs text-zinc-950">
                  <td colSpan={2} className="p-2.5 text-right font-black uppercase text-[10px]">Total Ledger Summary:</td>
                  <td className="p-2.5 text-center text-emerald-800">+{totalReceived.toLocaleString()}</td>
                  <td className="p-2.5 text-center text-rose-800">-{totalIssued.toLocaleString()}</td>
                  <td className="p-2.5 text-center font-black bg-zinc-200">{currentBalance.toLocaleString()} {card.unit}</td>
                  <td colSpan={3} className="p-2.5 text-zinc-500 font-sans italic text-[10px]">
                    Ledger verified & synchronized with Habtom Kebede Vet Stock Store
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
