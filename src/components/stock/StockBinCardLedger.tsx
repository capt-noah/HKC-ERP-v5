import { useMemo } from "react"
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
  const entries = useMemo(() => {
    const raw = [...(product.binCardEntries || [])]
    raw.sort((a, b) => {
      const timeA = new Date(a.createdAt || (a.date && a.date !== "—" ? a.date : 0)).getTime()
      const timeB = new Date(b.createdAt || (b.date && b.date !== "—" ? b.date : 0)).getTime()
      if (timeA !== timeB) return timeA - timeB
      return 0
    })

    let runningBal = 0
    return raw.map((rec) => {
      const inQty = Number(rec.qtyReceived || 0)
      const outQty = Number(rec.qtyIssued || 0)
      runningBal += inQty - outQty
      return {
        ...rec,
        balance: runningBal,
      }
    })
  }, [product.binCardEntries])

  const totalReceived = entries.reduce((sum, e) => sum + Number(e.qtyReceived || 0), 0)
  const totalIssued = entries.reduce((sum, e) => sum + Number(e.qtyIssued || 0), 0)
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance : product.quantity

  // Valuation totals: Invoiced Sales total vs Net Stock Asset Value at Cost
  const totalInvoicedSalesValue = entries
    .filter((e) => e.type !== "quarantine" && (e.type === "leave" || Number(e.qtyIssued || 0) > 0) && e.sellingPrice && Number(e.sellingPrice) > 0)
    .reduce((sum, e) => sum + (Number(e.qtyIssued || 0) * Number(e.sellingPrice || 0)), 0)

  const netRemainingStockValue = Array.isArray(product.batches) && product.batches.length > 0
    ? product.batches
        .filter((b) => b.status !== "Quarantined")
        .reduce((sum, b) => sum + (Number(b.qty || 0) * Number(b.unitPrice ?? (b as any).unit_cost ?? product.unitCost ?? 0)), 0)
    : product.totalStockValue != null && Number(product.totalStockValue) > 0
    ? Number(product.totalStockValue)
    : currentBalance * Number(product.unitCost || 0)

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
                <th rowSpan={2} className="py-2.5 px-4 text-right border-r border-zinc-200 text-indigo-950">Unit Cost (ETB)</th>
                <th rowSpan={2} className="py-2.5 px-4 text-right border-r border-zinc-200 text-blue-900">Selling Price / Value (ETB)</th>
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
              {entries.map((rec) => {
                const isQuarantine = rec.type === "quarantine" || (rec.party && rec.party.includes("Quarantine"))
                const isEntry = !isQuarantine && (rec.type === "entry" || Number(rec.qtyReceived || 0) > 0)
                const isLeave = !isQuarantine && (rec.type === "leave" || Number(rec.qtyIssued || 0) > 0)

                const rowBg = isQuarantine
                  ? "bg-amber-50/40 hover:bg-amber-50/70"
                  : isEntry
                  ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                  : isLeave
                  ? "bg-rose-50/30 hover:bg-rose-50/60"
                  : "hover:bg-zinc-50"

                return (
                  <tr key={rec.id} className={`${rowBg} transition-colors`}>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-800 font-bold border-r border-zinc-100">{rec.date}</td>
                    <td className="py-2.5 px-4 font-mono text-zinc-950 font-bold border-r border-zinc-100">{rec.batchNo}</td>
                    <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-zinc-100 ${rec.qtyReceived > 0 ? "text-emerald-700 font-black" : "text-zinc-400"}`}>
                      {rec.qtyReceived > 0 ? `+${rec.qtyReceived.toLocaleString()}` : "-"}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-zinc-100 ${rec.qtyIssued > 0 ? (isQuarantine ? "text-amber-800 font-black" : "text-rose-700 font-black") : "text-zinc-400"}`}>
                      {rec.qtyIssued > 0 ? `-${rec.qtyIssued.toLocaleString()}` : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-950 bg-black/[0.02] border-r border-zinc-100">
                      {rec.balance.toLocaleString()}
                    </td>
                    {/* Unit Cost (ETB) */}
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-800 border-r border-zinc-100 whitespace-nowrap">
                      {rec.unitPrice != null && Number(rec.unitPrice) > 0 ? (
                        <div>
                          <div>ETB {Number(rec.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className={`text-[9px] font-sans font-semibold ${isQuarantine ? "text-amber-700" : isLeave ? "text-rose-600" : "text-emerald-700"}`}>
                            {isQuarantine ? "Loss" : isLeave ? "COGS" : "Acq Cost"}
                          </div>
                        </div>
                      ) : product.unitCost ? (
                        <div>
                          <div>ETB {Number(product.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-[9px] font-sans font-semibold text-zinc-400">Default Cost</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    {/* Selling Price / Value (ETB) */}
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-950 border-r border-zinc-100 whitespace-nowrap">
                      {isLeave && rec.sellingPrice != null && Number(rec.sellingPrice) > 0 ? (
                        <div>
                          <div className="font-extrabold text-blue-700">
                            ETB {Number(rec.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-blue-600/80 font-sans font-semibold">
                            Invoiced: ETB {(Number(rec.qtyIssued || 0) * Number(rec.sellingPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-300 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-zinc-600 border-r border-zinc-100">{rec.mfgDate || "-"}</td>
                    <td className="py-2.5 px-4 font-mono text-zinc-600 border-r border-zinc-100">{rec.expiryDate || "-"}</td>
                    <td className="py-2.5 px-4 font-semibold text-zinc-800 border-r border-zinc-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isQuarantine && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                            QUARANTINE
                          </span>
                        )}
                        <span>{rec.party || "-"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-500 max-w-xs truncate border-r border-zinc-100">{rec.remark || "-"}</td>
                    <td className="py-2.5 px-4 text-center">
                      {isQuarantine ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-[10px] font-black tracking-wider shadow-2xs">
                          QA Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditEntry(product, rec)}
                          className="px-2.5 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 text-[10px] font-extrabold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                          title="Edit sub-entry details"
                        >
                          <Edit3 className="size-3 text-zinc-500" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-100 border-t-2 border-zinc-200 text-xs font-mono font-bold text-zinc-950">
                <td colSpan={2} className="py-2.5 px-4 text-right uppercase text-[10px] font-black border-r border-zinc-200">
                  Total Ledger Summary:
                </td>
                <td className="py-2.5 px-4 text-right text-emerald-800 border-r border-zinc-200">+{totalReceived.toLocaleString()}</td>
                <td className="py-2.5 px-4 text-right text-rose-800 border-r border-zinc-200">-{totalIssued.toLocaleString()}</td>
                <td className="py-2.5 px-4 text-right font-black bg-zinc-200 border-r border-zinc-200">{currentBalance.toLocaleString()} {product.unit}</td>
                <td className="py-2.5 px-4 text-right font-black text-indigo-900 border-r border-zinc-200">
                  <div className="text-[9px] uppercase tracking-wider text-indigo-600 font-sans font-semibold">Net Stock Value</div>
                  <div>ETB {netRemainingStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </td>
                <td className="py-2.5 px-4 text-right font-black text-blue-900 border-r border-zinc-200">
                  <div className="text-[9px] uppercase tracking-wider text-blue-600 font-sans font-semibold">Total Invoiced Sales</div>
                  <div>ETB {totalInvoicedSalesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </td>
                <td colSpan={4} className="py-2.5 px-4 text-zinc-500 font-sans italic text-[10px]">
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
