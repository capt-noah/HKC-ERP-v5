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
  sellingPrice?: number
  remark: string
  createdAt?: string
  rawEntry?: WH1Entry
  rawBinEntry?: BinCardMovementEntry
}

export default function WH1ChildMovementLedger({
  product,
  onEditEntry,
}: WH1ChildMovementLedgerProps) {
  // Build unified transaction list by combining BOTH inbound arrival entries, outbound leaves, and reject losses
  const rows: UnifiedWH1Row[] = (() => {
    const wh1Entries = product.wh1Entries || []
    const binEntries = product.binCardEntries || []
    const inboundIds = new Set(wh1Entries.map((e) => e.entryId || e.id).filter(Boolean))

    // 1. Inbound truckload entries from wh1Entries (Single source of truth for receipts)
    const inboundRows: UnifiedWH1Row[] = wh1Entries.map((e, idx) => {
      const qtyIn = Number(e.quantityReceived || e.quantity || 0)
      return {
        id: e.entryId || e.id || `wh1e-${idx}`,
        type: "entry" as const,
        date: e.entryDate || product.entryDate || "—",
        voucherNo: e.voucherNo ? (e.voucherNo.startsWith("No.") ? e.voucherNo : `No. ${e.voucherNo}`) : "—",
        party: e.customer || product.customer || "Supplier Arrival",
        plateNumber: e.plateNumber || product.plateNumber || "—",
        qtyIn,
        qtyOut: 0,
        balance: 0,
        unitPrice: Number(e.unitPrice ?? product.unitCost ?? 0),
        sellingPrice: undefined,
        remark: e.notes || "",
        createdAt: e.createdAt,
        rawEntry: e,
      }
    })

    // 2. Outbound leave entries and reject losses from binCardEntries (strictly non-entry rows)
    const nonEntryBinRows: UnifiedWH1Row[] = binEntries
      .filter((rec) => {
        if (rec.id && inboundIds.has(rec.id)) return false
        const mType = (rec.type as string || "").toLowerCase()
        const isReject = mType === "reject" || (rec.remark && /reject|loss|cleaning/i.test(rec.remark))
        const isEntry = !isReject && (mType === "entry" || (Number(rec.qtyReceived || 0) > 0 && Number(rec.qtyIssued || 0) === 0))
        return !isEntry
      })
      .map((rec, idx) => {
        const mType = (rec.type as string || "").toLowerCase()
        const isReject = mType === "reject" || (rec.remark && /reject|loss|cleaning/i.test(rec.remark))
        const qtyOut = Number(rec.qtyIssued || 0)
        const effectiveUnitPrice = Number(rec.unitPrice || product.unitCost || 0)
        const effectiveSellingPrice = rec.sellingPrice != null ? Number(rec.sellingPrice) : undefined

        return {
          id: rec.id || `bin-${idx}`,
          type: isReject ? ("reject" as const) : ("leave" as const),
          date: rec.date || "—",
          voucherNo: rec.voucherNo || (rec.batchNo?.startsWith("GRV-") ? rec.batchNo.slice(4) : rec.batchNo || "—"),
          party: rec.party || (isReject ? "Cleaning Loss Deduction" : "Customer Dispatch"),
          plateNumber: rec.plateNumber || "—",
          qtyIn: 0,
          qtyOut,
          balance: 0,
          unitPrice: effectiveUnitPrice,
          sellingPrice: !isReject ? effectiveSellingPrice : undefined,
          remark: rec.remark || (isReject ? "Reject / Cleaning Loss" : "Outbound Dispatch"),
          createdAt: rec.createdAt,
          rawBinEntry: rec,
        }
      })

    // Combine: Chronologically ordered stock movement transactions (pure chronological ascending)
    const allRows = [...inboundRows, ...nonEntryBinRows]

    allRows.sort((a, b) => {
      const timeA = new Date(a.createdAt || (a.date && a.date !== "—" ? a.date : 0)).getTime()
      const timeB = new Date(b.createdAt || (b.date && b.date !== "—" ? b.date : 0)).getTime()
      if (timeA !== timeB) return timeA - timeB
      return 0
    })

    // 3. Compute dynamic sequential running balance
    let runningBal = 0
    return allRows.map((row) => {
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

  const totalInvoicedSalesValue = rows
    .filter((r) => r.type === "leave" && r.sellingPrice && r.sellingPrice > 0)
    .reduce((sum, r) => sum + (r.qtyOut * (r.sellingPrice || 0)), 0)

  const netRemainingStockValue = Array.isArray(product.wh1Entries) && product.wh1Entries.length > 0
    ? product.wh1Entries.reduce((sum, e) => sum + (Number(e.quantityRemaining || 0) * Number(e.unitPrice || product.unitCost || 0)), 0)
    : finalBalance * Number(product.unitCost || 0)

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
                <th className="py-3 px-4 text-right text-indigo-950">Unit Cost (ETB)</th>
                <th className="py-3 px-4 text-right text-blue-900">Selling Price / Value (ETB)</th>
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

                    {/* Unit Cost (ETB) */}
                    <td className="py-2.5 px-4 text-right font-mono text-zinc-800 whitespace-nowrap">
                      {row.unitPrice > 0 ? (
                        <div>
                          <div className="font-bold">
                            ETB {row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-sans">
                            {isEntry
                              ? `Cost: ETB ${(row.qtyIn * row.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : isReject
                              ? `Loss: ETB ${(row.qtyOut * row.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `COGS: ETB ${(row.qtyOut * row.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Selling Price / Value (ETB) */}
                    <td className="py-2.5 px-4 text-right font-mono text-blue-950 whitespace-nowrap">
                      {row.sellingPrice && row.sellingPrice > 0 ? (
                        <div>
                          <div className="font-extrabold text-blue-700">
                            ETB {row.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-blue-600/80 font-sans font-semibold">
                            Invoiced: ETB {(row.qtyOut * row.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
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
                <td className="py-2.5 px-4 text-right font-black text-indigo-900 border-r border-zinc-200">
                  <div className="text-[9px] uppercase tracking-wider text-indigo-600 font-sans font-semibold">Net Stock Value</div>
                  <div>ETB {netRemainingStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </td>
                <td className="py-2.5 px-4 text-right font-black text-blue-900 border-r border-zinc-200">
                  <div className="text-[9px] uppercase tracking-wider text-blue-600 font-sans font-semibold">Total Invoiced Sales</div>
                  <div>ETB {totalInvoicedSalesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </td>
                <td className="py-2.5 px-4 text-center text-zinc-500 font-sans italic text-[10px]">
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
