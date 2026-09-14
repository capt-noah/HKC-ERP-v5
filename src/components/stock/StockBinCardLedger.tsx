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
    let raw = [...(product.binCardEntries || [])]

    // If no explicit bin card movement records exist yet, synthesize from batch records or initial stock
    if (raw.length === 0) {
      if (Array.isArray(product.batches) && product.batches.length > 0) {
        raw = product.batches.map((b, idx) => ({
          id: `batch-${product.id}-${idx}`,
          type: "entry",
          date: b.mfgDate || product.manufacturingDate || (product as any).created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          batchNo: b.batchNo || `BATCH-00${idx + 1}`,
          qtyReceived: Number(b.qty || 0),
          qtyIssued: 0,
          balance: Number(b.qty || 0),
          unitPrice: Number(b.unitPrice || product.unitCost || 0),
          mfgDate: b.mfgDate || product.manufacturingDate,
          expiryDate: b.expiry || product.expiry || "",
          party: product.supplierName || product.supplier || "Supplier Inbound Delivery",
          remark: b.notes || "Initial Batch Registration",
          createdAt: (product as any).created_at || new Date().toISOString(),
        }))
      } else if (Number(product.quantity || product.totalQuantity || 0) > 0 || product.batch) {
        raw = [{
          id: `init-${product.id}`,
          type: "entry",
          date: product.manufacturingDate || product.entryDate || (product as any).created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          batchNo: product.batch || "BATCH-INITIAL",
          qtyReceived: Number(product.quantity || product.totalQuantity || 0),
          qtyIssued: 0,
          balance: Number(product.quantity || product.totalQuantity || 0),
          unitPrice: Number(product.unitCost || product.costPrice || 0),
          mfgDate: product.manufacturingDate,
          expiryDate: product.expiry || "",
          party: product.supplierName || product.supplier || "Initial Inbound Stock",
          remark: "Initial Stock Registration",
          createdAt: (product as any).created_at || new Date().toISOString(),
        }]
      }
    }

    raw.sort((a, b) => {
      const timeA = new Date(a.date && a.date !== "—" ? a.date : 0).getTime()
      const timeB = new Date(b.date && b.date !== "—" ? b.date : 0).getTime()
      if (timeA !== timeB) return timeA - timeB
      const aIsEntry = a.type === "entry" || Number(a.qtyReceived || 0) > 0
      const bIsEntry = b.type === "entry" || Number(b.qtyReceived || 0) > 0
      if (aIsEntry && !bIsEntry) return -1
      if (!aIsEntry && bIsEntry) return 1
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
  }, [product.binCardEntries, product.batches, product.quantity, product.totalQuantity, product.batch, product.manufacturingDate, product.entryDate, product.expiry, product.supplierName, product.supplier, product.unitCost, product.costPrice, product.id])

  const totalReceived = entries.reduce((sum, e) => sum + Number(e.qtyReceived || 0), 0)
  const totalIssued = entries.reduce((sum, e) => sum + Number(e.qtyIssued || 0), 0)
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance : product.quantity
  const netPharmaVal = entries.length > 0
    ? (currentBalance <= 0 ? 0 : Math.max(0, Math.round(entries.reduce((sum, rec) => {
        const isQuarantine = rec.type === "quarantine"
        const isEntry = !isQuarantine && rec.type !== "reject" && (rec.type === "entry" || Number(rec.qtyReceived || 0) > 0)
        const isDeduct = isQuarantine || rec.type === "leave" || rec.type === "reject" || Number(rec.qtyIssued || 0) > 0
        const inQty = Number(rec.qtyReceived || 0)
        const outQty = Number(rec.qtyIssued || 0)
        const matchingBatch = (product.batches || []).find((b) => (b.batchNo || "").toUpperCase() === (rec.batchNo || "").toUpperCase())
        const batchCost = Number(matchingBatch?.unitPrice || (matchingBatch as any)?.unit_cost || product.unitCost || 0)
        const rowPrice = Number(
          rec.unitPrice != null && Number(rec.unitPrice) > 0
            ? rec.unitPrice
            : isQuarantine
            ? batchCost
            : rec.type === "leave"
            ? (product.sellingPrice || (product as any).selling_price || product.unitCost || 0)
            : batchCost || (product.unitCost || 0)
        )
        return sum + (isEntry ? inQty * rowPrice : isDeduct ? -(outQty * rowPrice) : 0)
      }, 0) * 100) / 100))
    : (Number(product.totalStockValue || 0) > 0 ? Number(product.totalStockValue) : Number(currentBalance || 0) * Number(product.unitCost || 0))

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
                <th rowSpan={2} className="py-2.5 px-4 text-right border-r border-zinc-200 text-emerald-800">Total Value (ETB)</th>
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
                const isQuarantine = rec.type === "quarantine"
                const isEntry = !isQuarantine && rec.type !== "reject" && (rec.type === "entry" || Number(rec.qtyReceived || 0) > 0)
                const isLeave = !isQuarantine && (rec.type === "leave" || Number(rec.qtyIssued || 0) > 0)
                const isDeduct = isQuarantine || isLeave || rec.type === "reject"
                const matchingBatch = (product.batches || []).find((b) => (b.batchNo || "").toUpperCase() === (rec.batchNo || "").toUpperCase())
                const batchCost = Number(matchingBatch?.unitPrice || (matchingBatch as any)?.unit_cost || product.unitCost || 0)
                const rowPrice = Number(
                  rec.unitPrice != null && Number(rec.unitPrice) > 0
                    ? rec.unitPrice
                    : isQuarantine
                    ? batchCost
                    : isLeave
                    ? (product.sellingPrice || (product as any).selling_price || product.unitCost || 0)
                    : batchCost || (product.unitCost || 0)
                )
                const inQty = Number(rec.qtyReceived || 0)
                const outQty = Number(rec.qtyIssued || 0)
                const totalValue = isEntry ? (inQty * rowPrice) : isDeduct ? -(outQty * rowPrice) : 0

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
                    <td className={`py-2.5 px-4 text-right font-mono font-bold border-r border-zinc-100 ${rec.qtyIssued > 0 ? (rec.type === "quarantine" ? "text-amber-800 font-black" : "text-rose-700 font-black") : "text-zinc-400"}`}>
                      {rec.qtyIssued > 0 ? `-${rec.qtyIssued.toLocaleString()}` : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-950 bg-black/[0.02] border-r border-zinc-100">
                      {rec.balance.toLocaleString()}
                    </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-800 border-r border-zinc-100">
                    {rowPrice > 0
                      ? `ETB ${rowPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-black whitespace-nowrap border-r border-zinc-100">
                    {totalValue > 0 ? (
                      <span className="text-emerald-700">
                        +ETB {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : totalValue < 0 ? (
                      <span className={isQuarantine ? "text-amber-800" : "text-rose-700"}>
                        -ETB {Math.abs(totalValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-zinc-300 font-normal">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-zinc-600 border-r border-zinc-100">{rec.mfgDate || "-"}</td>
                  <td className="py-2.5 px-4 font-mono text-zinc-600 border-r border-zinc-100">{rec.expiryDate || "-"}</td>
                  <td className="py-2.5 px-4 font-semibold text-zinc-800 border-r border-zinc-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {rec.type === "quarantine" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                          QUARANTINE
                        </span>
                      )}
                      <span>{rec.party || "-"}</span>
                    </div>
                  </td>
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
                <td className="py-2.5 px-4 text-right uppercase text-[10px] font-black text-zinc-600 border-r border-zinc-200">
                  Net Stock Value:
                </td>
                <td className="py-2.5 px-4 text-right font-black text-emerald-800 border-r border-zinc-200">
                  ETB {netPharmaVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
