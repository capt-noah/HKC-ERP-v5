import { ArrowDownLeft, ArrowUpRight, Printer, Edit3 } from "lucide-react"
import type { Product, WH1Entry, BinCardMovementEntry } from "@/lib/erpStore"

interface WH1ChildMovementLedgerProps {
  product: Product
  onEditEntry?: (product: Product, entry: WH1Entry) => void
  onPrintGRV?: (product: Product, entry?: WH1Entry) => void
}

interface UnifiedWH1Row {
  id: string
  type: "entry" | "leave"
  date: string
  voucherNo: string
  party: string
  plateNumber: string
  qtyIn: number
  qtyOut: number
  balance: number
  unitPrice: number
  remark: string
  rawEntry?: WH1Entry
  rawBinEntry?: BinCardMovementEntry
}

export default function WH1ChildMovementLedger({
  product,
  onEditEntry,
  onPrintGRV,
}: WH1ChildMovementLedgerProps) {
  // Build unified transaction list from binCardEntries or wh1Entries
  const rows: UnifiedWH1Row[] = (() => {
    const binEntries = product.binCardEntries || []
    const wh1Entries = product.wh1Entries || []

    if (binEntries.length > 0) {
      let runningBal = 0
      return binEntries.map((rec, idx) => {
        const isEntry = Number(rec.qtyReceived || 0) > 0 || rec.type === "entry"
        const qtyIn = Number(rec.qtyReceived || 0)
        const qtyOut = Number(rec.qtyIssued || 0)
        runningBal = rec.balance !== undefined && rec.balance !== null ? Number(rec.balance) : runningBal + qtyIn - qtyOut

        // Attempt to find matching wh1Entry for editing/printing
        const matchingWH1 = wh1Entries.find(
          (w) => (w.voucherNo && rec.voucherNo && w.voucherNo === rec.voucherNo) || w.entryId === rec.id
        ) || wh1Entries[idx]

        return {
          id: rec.id || `row-${idx}`,
          type: isEntry ? "entry" : "leave",
          date: rec.date || "—",
          voucherNo: rec.voucherNo || (rec.batchNo?.startsWith("GRV-") ? rec.batchNo.slice(4) : rec.batchNo || "—"),
          party: rec.party || (isEntry ? "Supplier Arrival" : "Customer Dispatch"),
          plateNumber: rec.plateNumber || (matchingWH1?.plateNumber || "—"),
          qtyIn,
          qtyOut,
          balance: runningBal,
          unitPrice: Number(rec.unitPrice || product.unitCost || 0),
          remark: rec.remark || "",
          rawEntry: matchingWH1,
          rawBinEntry: rec,
        }
      })
    }

    // Fallback: If only wh1Entries exist (pre-existing test data)
    let runningBal = 0
    return wh1Entries.map((e, idx) => {
      const qtyIn = Number(e.quantityReceived || 0)
      runningBal += qtyIn
      return {
        id: e.entryId || `entry-${idx}`,
        type: "entry" as const,
        date: e.entryDate || product.entryDate || "—",
        voucherNo: e.voucherNo ? `No. ${e.voucherNo}` : "—",
        party: e.customer || "Supplier Arrival",
        plateNumber: e.plateNumber || "—",
        qtyIn,
        qtyOut: 0,
        balance: runningBal,
        unitPrice: Number(e.unitPrice || product.unitCost || 0),
        remark: e.notes || "",
        rawEntry: e,
      }
    })
  })()

  const totalIn = rows.reduce((sum, r) => sum + r.qtyIn, 0)
  const totalOut = rows.reduce((sum, r) => sum + r.qtyOut, 0)
  const finalBalance = rows.length > 0 ? rows[rows.length - 1].balance : product.quantity

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
                <th className="py-3 px-4 text-right text-amber-800">Qty Out (-)</th>
                <th className="py-3 px-4 text-right text-zinc-950 bg-zinc-100/50">Running Balance</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {rows.map((row) => {
                const isEntry = row.type === "entry"

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors border-b border-zinc-100/80 ${
                      isEntry
                        ? "border-l-[3px] border-l-emerald-500 hover:bg-emerald-50/20"
                        : "border-l-[3px] border-l-amber-500 hover:bg-amber-50/20"
                    }`}
                  >
                    {/* Directional Visual Micro-Pill */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {isEntry ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-2xs">
                          <ArrowDownLeft className="size-3 text-emerald-600" /> Entry
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
                          {row.voucherNo ? (row.voucherNo.startsWith("No.") ? row.voucherNo : `No. ${row.voucherNo}`) : "—"}
                        </span>
                      ) : (
                        <span className="text-zinc-900 font-black">
                          {row.voucherNo ? (row.voucherNo.startsWith("FS-") ? row.voucherNo : `FS-${row.voucherNo}`) : "—"}
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

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {isEntry && row.rawEntry && (
                          <>
                            {onPrintGRV && (
                              <button
                                type="button"
                                onClick={() => onPrintGRV(product, row.rawEntry)}
                                className="px-2 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                title="Print Receiving Voucher"
                              >
                                <Printer className="size-3 text-zinc-500" /> GRV
                              </button>
                            )}
                            {onEditEntry && (
                              <button
                                type="button"
                                onClick={() => onEditEntry(product, row.rawEntry!)}
                                className="px-2 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                title="Edit Entry Details"
                              >
                                <Edit3 className="size-3 text-zinc-500" /> Edit
                              </button>
                            )}
                          </>
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
                <td colSpan={2} className="py-2.5 px-4 text-zinc-500 font-sans italic text-[10px]">
                  Warehouse: {product.warehouseName || product.warehouse}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
