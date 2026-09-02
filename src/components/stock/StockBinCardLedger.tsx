import { Edit3 } from "lucide-react"
import type { BinCardMovementEntry, Product } from "@/lib/erpStore"

interface StockBinCardLedgerProps {
  product: Product
  onEditEntry: (product: Product, entry: BinCardMovementEntry) => void
}

export default function StockBinCardLedger({
  product,
  onEditEntry
}: StockBinCardLedgerProps) {
  const entries = product.binCardEntries || []
  const totalReceived = entries.reduce((sum, e) => sum + Number(e.qtyReceived || 0), 0)
  const totalIssued = entries.reduce((sum, e) => sum + Number(e.qtyIssued || 0), 0)
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance : product.quantity

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
      {entries.length === 0 ? (
        <div className="text-zinc-400 text-xs py-4 px-6 text-center font-medium">
          No stock movement transactions recorded yet. Click &quot;+ Add&quot; on the parent row to record stock receipts or dispatches.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-semibold">
            <thead>
              {/* Grouped Header with Quantity In */}
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Date</th>
                <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Batch Number</th>
                <th colSpan={3} className="py-1.5 text-center border-r border-b border-zinc-200 bg-zinc-100/80 font-black text-zinc-800">
                  Quantity ({product.unit})
                </th>
                <th rowSpan={2} className="py-2.5 px-4 text-right border-r border-zinc-200">Unit Price</th>
                <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Mfg Date</th>
                <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Expiry Date</th>
                <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Received From / Issued To</th>
                <th rowSpan={2} className="py-2.5 px-4 border-r border-zinc-200">Remark</th>
                <th rowSpan={2} className="py-2.5 px-4 text-center">Actions</th>
              </tr>
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[9px] font-black uppercase tracking-wider text-zinc-500">
                <th className="py-2 px-4 border-r border-zinc-200 text-right text-emerald-700">Received</th>
                <th className="py-2 px-4 border-r border-zinc-200 text-right text-rose-700">Issued</th>
                <th className="py-2 px-4 border-r border-zinc-200 text-right bg-zinc-100/60 text-zinc-950">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {entries.map((rec) => (
                <tr key={rec.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-800 font-bold border-r border-zinc-100">{rec.date}</td>
                  <td className="py-2.5 px-4 font-mono text-zinc-950 font-bold border-r border-zinc-100">{rec.batchNo}</td>
                  <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-zinc-100 ${rec.qtyReceived > 0 ? "text-emerald-700 font-black" : "text-zinc-400"}`}>
                    {rec.qtyReceived > 0 ? `+${rec.qtyReceived.toLocaleString()}` : "-"}
                  </td>
                  <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-zinc-100 ${rec.qtyIssued > 0 ? "text-rose-700 font-black" : "text-zinc-400"}`}>
                    {rec.qtyIssued > 0 ? `-${rec.qtyIssued.toLocaleString()}` : "-"}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-950 bg-zinc-50 border-r border-zinc-100">
                    {rec.balance.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-800 border-r border-zinc-100">
                    {rec.unitPrice != null && Number(rec.unitPrice) > 0
                      ? `ETB ${Number(rec.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : product.unitCost
                        ? `ETB ${Number(product.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-zinc-600 border-r border-zinc-100">{rec.mfgDate || "-"}</td>
                  <td className="py-2.5 px-4 font-mono text-zinc-600 border-r border-zinc-100">{rec.expiryDate || "-"}</td>
                  <td className="py-2.5 px-4 font-semibold text-zinc-800 border-r border-zinc-100">{rec.party || "-"}</td>
                  <td className="py-2.5 px-4 text-zinc-500 max-w-xs truncate border-r border-zinc-100">{rec.remark || "-"}</td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onEditEntry(product, rec)}
                      className="px-2.5 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 text-[10px] font-extrabold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                      title="Edit sub-entry details"
                    >
                      <Edit3 className="size-3 text-zinc-500" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-100 border-t-2 border-zinc-200 text-xs font-mono font-bold text-zinc-950">
                <td colSpan={2} className="py-2.5 px-4 text-right uppercase text-[10px] font-black border-r border-zinc-200">
                  Total Ledger Summary:
                </td>
                <td className="py-2.5 px-4 text-right text-emerald-800 border-r border-zinc-200">+{totalReceived.toLocaleString()}</td>
                <td className="py-2.5 px-4 text-right text-rose-800 border-r border-zinc-200">-{totalIssued.toLocaleString()}</td>
                <td className="py-2.5 px-4 text-right font-black bg-zinc-200 border-r border-zinc-200">{currentBalance.toLocaleString()} {product.unit}</td>
                <td colSpan={5} className="py-2.5 px-4 text-zinc-500 font-sans italic text-[10px]">
                  Warehouse: {product.warehouseName || product.warehouse} &bull; Shelf: {product.shelfNo || "Unassigned"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
