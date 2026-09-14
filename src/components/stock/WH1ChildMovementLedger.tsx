import { ArrowDownLeft, ArrowUpRight, MinusCircle, Edit3 } from "lucide-react"
import type { Product, WH1Entry, BinCardMovementEntry } from "@/lib/erpStore"

interface WH1ChildMovementLedgerProps {
  product: Product
  onEditEntry?: (product: Product, entry: WH1Entry) => void
}

interface UnifiedWH1Row {
  id: string
  type: "entry" | "leave" | "reject"
  date: string
  voucherNo: string
  party: string
  plateNumber: string
  qtyIn: number
  qtyOut: number
  balance: number
  unitPrice: number
  totalValue: number
  remark: string
  rawEntry?: WH1Entry
  rawBinEntry?: BinCardMovementEntry
}

export default function WH1ChildMovementLedger({
  product,
  onEditEntry,
}: WH1ChildMovementLedgerProps) {
  // Build unified transaction list from binCardEntries (canonical ledger) or wh1Entries
  const rows: UnifiedWH1Row[] = (() => {
    const wh1Entries = product.wh1Entries || []
    const binEntries = product.binCardEntries || []

    let rawList: UnifiedWH1Row[] = []

    if (binEntries.length > 0) {
      rawList = binEntries.map((rec, idx) => {
        const isReject = rec.type === "reject"
        const isEntry = !isReject && (rec.type === "entry" || (Number(rec.qtyReceived || 0) > 0 && Number(rec.qtyIssued || 0) === 0))
        const isLeave = !isReject && !isEntry
        const qtyIn = isReject || isLeave ? 0 : Number(rec.qtyReceived || 0)
        const qtyOut = Number(rec.qtyIssued || 0)

        const matchingWH1 = wh1Entries.find(
          (w) => (w.voucherNo && rec.voucherNo && w.voucherNo === rec.voucherNo) || w.entryId === rec.id
        )

        const rawEntry: WH1Entry | undefined = isEntry
          ? matchingWH1 || {
              entryId: rec.id || `wh1e-${idx}`,
              voucherNo: rec.voucherNo || "",
              customer: rec.party || product.customer || "Supplier Arrival",
              plateNumber: rec.plateNumber || product.plateNumber || "",
              entryDate: rec.date || "",
              quantityReceived: qtyIn,
              quantityRemaining: qtyIn,
              unitPrice: Number(rec.unitPrice || product.unitCost || 0),
              notes: rec.remark || "",
            }
          : undefined

        const unitPrice = isEntry
          ? Number(rec.unitPrice || matchingWH1?.unitPrice || product.unitCost || 0)
          : isReject
          ? Number(rec.unitPrice || matchingWH1?.unitPrice || product.unitCost || 0)
          : Number(rec.unitPrice || product.sellingPrice || (product as any).selling_price || product.unitCost || 0)
        const totalValue = isEntry ? (qtyIn * unitPrice) : -(qtyOut * unitPrice)

        return {
          id: rec.id || `bin-${idx}`,
          type: isReject ? ("reject" as const) : isEntry ? ("entry" as const) : ("leave" as const),
          date: rec.date || "—",
          voucherNo: rec.voucherNo || (rec.batchNo?.startsWith("GRV-") ? rec.batchNo.slice(4) : rec.batchNo || "—"),
          party: rec.party || (isReject ? "Cleaning Loss Deduction" : isEntry ? "Supplier Arrival" : "Customer Dispatch"),
          plateNumber: rec.plateNumber || matchingWH1?.plateNumber || product.plateNumber || "—",
          qtyIn,
          qtyOut,
          balance: 0,
          unitPrice,
          totalValue,
          remark: rec.remark || "",
          rawEntry,
          rawBinEntry: rec,
        }
      })
    } else if (wh1Entries.length > 0) {
      rawList = wh1Entries.map((e, idx) => {
        const eAny = e as any
        const isReject = eAny.type === "reject" || Boolean(eAny.isReject)
        const isLeave = eAny.type === "leave" || (Number(eAny.quantityIssued || 0) > 0 && Number(e.quantityReceived || 0) === 0)
        const qtyIn = isReject || isLeave ? 0 : Number(e.quantityReceived || 0)
        const qtyOut = isReject ? Number(eAny.rejectQuantity || eAny.quantityIssued || e.quantityReceived || 0) : isLeave ? Number(eAny.quantityIssued || 0) : 0
        const unitPrice = isLeave
          ? Number(e.unitPrice || product.sellingPrice || (product as any).selling_price || product.unitCost || 0)
          : Number(e.unitPrice || product.unitCost || 0)
        const totalValue = isReject || isLeave ? -(qtyOut * unitPrice) : (qtyIn * unitPrice)

        return {
          id: e.entryId || `wh1e-${idx}`,
          type: isReject ? ("reject" as const) : isLeave ? ("leave" as const) : ("entry" as const),
          date: e.entryDate || eAny.date || product.entryDate || "—",
          voucherNo: e.voucherNo ? (e.voucherNo.startsWith("No.") ? e.voucherNo : `No. ${e.voucherNo}`) : "—",
          party: e.customer || eAny.supplier || eAny.party || (isReject ? "Cleaning Rejection" : isLeave ? "Customer Dispatch" : "Supplier Arrival"),
          plateNumber: e.plateNumber || product.plateNumber || "—",
          qtyIn,
          qtyOut,
          balance: 0,
          unitPrice,
          totalValue,
          remark: e.notes || eAny.remark || "",
          rawEntry: e,
        }
      })
    } else if (Number(product.quantity || product.totalQuantity || 0) > 0) {
      const initQty = Number(product.totalQuantity || product.quantity || 0)
      const unitPrice = Number(product.unitCost || 0)
      rawList = [
        {
          id: `wh1-init-${product.id}`,
          type: "entry" as const,
          date: product.entryDate || product.createdDate || (product as any).created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          voucherNo: product.voucherNo || "—",
          party: product.customer || product.supplierName || "Supplier Inbound Arrival",
          plateNumber: product.plateNumber || "—",
          qtyIn: initQty,
          qtyOut: 0,
          balance: initQty,
          unitPrice,
          totalValue: initQty * unitPrice,
          remark: "Initial Stock Registration",
          rawEntry: {
            entryId: `wh1-init-${product.id}`,
            voucherNo: product.voucherNo || "",
            customer: product.customer || product.supplierName || "Supplier Inbound Arrival",
            plateNumber: product.plateNumber || "",
            entryDate: product.entryDate || "",
            quantityReceived: initQty,
            quantityRemaining: initQty,
            unitPrice,
            notes: "Initial Stock Registration",
          },
        },
      ]
    }

    // Sort chronologically
    rawList.sort((a, b) => {
      const timeA = new Date(a.date && a.date !== "—" ? a.date : 0).getTime()
      const timeB = new Date(b.date && b.date !== "—" ? b.date : 0).getTime()
      if (timeA !== timeB) return timeA - timeB
      if (a.type === "entry" && b.type !== "entry") return -1
      if (a.type !== "entry" && b.type === "entry") return 1
      return 0
    })

    // Compute dynamic sequential running balance
    let runningBal = 0
    return rawList.map((row) => {
      runningBal += row.qtyIn - row.qtyOut
      return {
        ...row,
        balance: runningBal,
      }
    })
  })()

  const totalIn = rows.reduce((sum, r) => sum + r.qtyIn, 0)
  const totalOut = rows.reduce((sum, r) => sum + r.qtyOut, 0)
  const finalBalance = rows.length > 0 ? rows[rows.length - 1].balance : product.quantity
  const netStockVal = rows.length > 0
    ? (finalBalance <= 0 ? 0 : Math.max(0, Math.round(rows.reduce((sum, r) => sum + Number(r.totalValue || 0), 0) * 100) / 100))
    : (Number(product.totalStockValue || 0) > 0 ? Number(product.totalStockValue) : Number(finalBalance || 0) * Number(product.unitCost || 0))

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
      {rows.length === 0 ? (
        <div className="text-zinc-400 text-xs py-5 px-6 text-center font-medium">
          No stock records found. Click &quot;+ Add&quot; on the parent row to record an incoming truckload arrival.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-semibold">
            <thead>
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Voucher / Ref</th>
                <th className="py-3 px-4">Customer / Supplier</th>
                <th className="py-3 px-4">Truck Plate</th>
                <th className="py-3 px-4 text-right text-emerald-700">Qty In (+)</th>
                <th className="py-3 px-4 text-right text-rose-700">Qty Out / Loss (-)</th>
                <th className="py-3 px-4 text-right text-zinc-950 bg-zinc-100/50">Running Balance</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right text-emerald-800">Total Value (ETB)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {rows.map((row) => {
                const isEntry = row.type === "entry"
                const isReject = row.type === "reject"

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors border-b border-zinc-100/80 ${
                      isEntry
                        ? "border-l-[3px] border-l-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/40"
                        : isReject
                        ? "border-l-[3px] border-l-rose-600 bg-rose-50/30 hover:bg-rose-50/50"
                        : "border-l-[3px] border-l-amber-500 bg-amber-50/20 hover:bg-amber-50/40"
                    }`}
                  >
                    {/* Directional Visual Micro-Pill */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {isEntry ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-2xs">
                          <ArrowDownLeft className="size-3 text-emerald-600" /> Entry
                        </span>
                      ) : isReject ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                          <MinusCircle className="size-3 text-rose-600" /> Reject Loss
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200/60 shadow-2xs">
                          <ArrowUpRight className="size-3 text-amber-600" /> Leave
                        </span>
                      )}
                    </td>

                    {/* Date: Entry Date for inbound, Leave Date for outbound */}
                    <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-zinc-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 text-[9px] font-sans font-medium uppercase">
                          {isEntry ? "In:" : "Out:"}
                        </span>
                        <span>{row.date}</span>
                      </div>
                    </td>

                    {/* Voucher / FS No */}
                    <td className="py-2.5 px-4 font-mono font-bold whitespace-nowrap">
                      {isEntry ? (
                        <span className="text-rose-700">
                          {row.voucherNo && row.voucherNo !== "—" && row.voucherNo !== "N/A"
                            ? (row.voucherNo.startsWith("No.") ? row.voucherNo : `No. ${row.voucherNo}`)
                            : "—"}
                        </span>
                      ) : (
                        <span className="text-zinc-900 font-black">
                          {(() => {
                            if (!row.voucherNo || row.voucherNo === "—" || row.voucherNo === "N/A") {
                              const match = row.remark?.match(/(FS-[A-Z0-9-]+|SO-[A-Z0-9-]+)/i)
                              return match ? match[1] : "—"
                            }
                            return row.voucherNo.startsWith("FS-") ? row.voucherNo : `FS-${row.voucherNo}`
                          })()}
                        </span>
                      )}
                    </td>

                    {/* Customer / Supplier */}
                    <td className="py-2.5 px-4 font-bold text-zinc-900 max-w-[150px] truncate" title={row.party}>
                      {row.party}
                    </td>

                    {/* Plate No */}
                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                      {row.plateNumber && row.plateNumber !== "—" ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/80 font-bold text-zinc-700">
                          {row.plateNumber}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Qty In */}
                    <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                      {row.qtyIn > 0 ? `+${row.qtyIn.toLocaleString()}` : <span className="text-zinc-300 font-normal">—</span>}
                    </td>

                    {/* Qty Out */}
                    <td className="py-2.5 px-4 text-right font-mono font-black text-amber-800 whitespace-nowrap">
                      {row.qtyOut > 0 ? `-${row.qtyOut.toLocaleString()}` : <span className="text-zinc-300 font-normal">—</span>}
                    </td>

                    {/* Running Balance */}
                    <td className="py-2.5 px-4 text-right font-mono font-black text-zinc-950 bg-zinc-50/60 whitespace-nowrap">
                      {row.balance.toLocaleString()} <span className="text-[10px] text-zinc-400 font-normal">{product.unit}</span>
                    </td>

                    {/* Unit Price */}
                    <td className="py-2.5 px-4 text-right font-mono text-zinc-700 whitespace-nowrap">
                      {row.unitPrice > 0 ? `ETB ${row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </td>

                    {/* Total Value (ETB) */}
                    <td className="py-2.5 px-4 text-right font-mono font-black whitespace-nowrap">
                      {row.totalValue > 0 ? (
                        <span className="text-emerald-700">
                          +ETB {row.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : row.totalValue < 0 ? (
                        <span className={isReject ? "text-rose-700" : "text-amber-800"}>
                          -ETB {Math.abs(row.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-zinc-300 font-normal">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {isEntry && row.rawEntry && onEditEntry && (
                          <button
                            type="button"
                            onClick={() => onEditEntry(product, row.rawEntry!)}
                            className="px-2 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            title="Edit Entry Details"
                          >
                            <Edit3 className="size-3 text-zinc-500" /> Edit
                          </button>
                        )}
                        {!isEntry && (
                          <span className="text-[10px] text-zinc-400 italic">Dispatched</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-100 border-t-2 border-zinc-200 text-xs font-mono font-bold text-zinc-950">
                <td colSpan={5} className="py-2.5 px-4 text-right uppercase text-[10px] font-black border-r border-zinc-200">
                  Total Movement Summary:
                </td>
                <td className="py-2.5 px-4 text-right text-emerald-800 border-r border-zinc-200">
                  +{totalIn.toLocaleString()}
                </td>
                <td className="py-2.5 px-4 text-right text-amber-900 border-r border-zinc-200">
                  -{totalOut.toLocaleString()}
                </td>
                <td className="py-2.5 px-4 text-right font-black bg-zinc-200 border-r border-zinc-200">
                  {finalBalance.toLocaleString()} {product.unit}
                </td>
                <td className="py-2.5 px-4 text-right uppercase text-[10px] font-black text-zinc-600 border-r border-zinc-200">
                  Net Stock Value:
                </td>
                <td className="py-2.5 px-4 text-right font-black text-emerald-800 border-r border-zinc-200">
                  ETB {netStockVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-4 text-zinc-500 font-sans italic text-[10px] text-center">
                  {product.warehouseName || product.warehouse}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
