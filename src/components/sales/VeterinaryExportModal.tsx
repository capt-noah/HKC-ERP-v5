import { useState, useMemo, useEffect } from "react"
import {
  FileSpreadsheet,
  Download,
  X,
  Calendar,
} from "lucide-react"
import { useFeedback } from "@/context/FeedbackContext"
import type { Product, Customer } from "@/lib/erpStore"
import { listSalesIssues, type SalesIssue } from "@/lib/salesIssuesApi"
import {
  getImportWarehouseProducts,
  exportComprehensiveVeterinaryWorkbook,
} from "@/lib/veterinaryExcelExport"

export interface VeterinaryExportModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  salesIssues?: SalesIssue[]
  customers: Customer[]
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export default function VeterinaryExportModal({
  isOpen,
  onClose,
  products,
  salesIssues,
  customers,
}: VeterinaryExportModalProps) {
  const { showToast } = useFeedback()
  const [isExporting, setIsExporting] = useState(false)
  const [allLoadedSalesIssues, setAllLoadedSalesIssues] = useState<SalesIssue[]>(salesIssues || [])

  const currentYear = new Date().getFullYear()

  // Period mode: "THIS_YEAR" | "LAST_YEAR" | "CUSTOM"
  const [periodPreset, setPeriodPreset] = useState<"THIS_YEAR" | "LAST_YEAR" | "CUSTOM">("THIS_YEAR")

  // Custom month/year picker state
  const [startMonth, setStartMonth] = useState("July")
  const [startYear, setStartYear] = useState(String(currentYear - 1))
  const [endMonth, setEndMonth] = useState("July")
  const [endYear, setEndYear] = useState(String(currentYear))

  // Prefetch sales issues if not fully loaded
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    if (!salesIssues || salesIssues.length <= 25) {
      listSalesIssues(new URLSearchParams({ pageSize: "10000" }))
        .then((res) => {
          if (isMounted && res && Array.isArray(res.rows) && res.rows.length > 0) {
            setAllLoadedSalesIssues(res.rows)
          }
        })
        .catch((err) => {
          console.warn("[VeterinaryExportModal] Failed to prefetch sales issues:", err)
        })
    } else {
      setAllLoadedSalesIssues(salesIssues)
    }
    return () => {
      isMounted = false
    }
  }, [isOpen, salesIssues])

  const importProducts = useMemo(() => getImportWarehouseProducts(products), [products])

  // Compute effective reporting period string
  const effectivePeriodLabel = useMemo(() => {
    if (periodPreset === "THIS_YEAR") {
      return `JULY, ${currentYear - 1} TO JULY ${currentYear} YEAR`
    }
    if (periodPreset === "LAST_YEAR") {
      return `JULY, ${currentYear - 2} TO JULY ${currentYear - 1} YEAR`
    }
    return `${startMonth.toUpperCase()}, ${startYear} TO ${endMonth.toUpperCase()} ${endYear} YEAR`
  }, [periodPreset, currentYear, startMonth, startYear, endMonth, endYear])

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportComprehensiveVeterinaryWorkbook(importProducts, allLoadedSalesIssues, customers, {
        fiscalPeriod: effectivePeriodLabel,
      })
      showToast("Regulatory Export Downloaded", "success", `Exported Excel workbook with Annual Summary and ${importProducts.length} product sheets.`)
      onClose()
    } catch (err: any) {
      showToast("Export Failed", "warning", err?.message || "Failed to generate Excel report.")
    } finally {
      setIsExporting(false)
    }
  }

  // Available year options for custom picker
  const yearOptions = Array.from({ length: 10 }, (_, i) => String(currentYear - 5 + i))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-2xs">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950 dark:text-white tracking-tight">
                Regulatory Export
              </h3>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Official Ethiopian regulatory workbook (.xlsx)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Date Range Selector */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-2.5">
              Report Period
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Option 1: This Year */}
              <button
                type="button"
                onClick={() => setPeriodPreset("THIS_YEAR")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  periodPreset === "THIS_YEAR"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 shadow-2xs ring-1 ring-emerald-500/20"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>This Year</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                  {currentYear - 1}–{currentYear}
                </span>
              </button>

              {/* Option 2: Last Year */}
              <button
                type="button"
                onClick={() => setPeriodPreset("LAST_YEAR")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  periodPreset === "LAST_YEAR"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 shadow-2xs ring-1 ring-emerald-500/20"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>Last Year</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                  {currentYear - 2}–{currentYear - 1}
                </span>
              </button>

              {/* Option 3: Custom Period */}
              <button
                type="button"
                onClick={() => setPeriodPreset("CUSTOM")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  periodPreset === "CUSTOM"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 shadow-2xs ring-1 ring-emerald-500/20"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>Custom Range</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                  Month / Year
                </span>
              </button>
            </div>

            {/* Custom Month/Year Picker */}
            {periodPreset === "CUSTOM" && (
              <div className="mt-3.5 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-3">
                  {/* From Month / Year */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                      From
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
                      >
                        {MONTH_NAMES.map((m) => (
                          <option key={m} value={m}>{m.slice(0, 3)}</option>
                        ))}
                      </select>
                      <select
                        value={startYear}
                        onChange={(e) => setStartYear(e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* To Month / Year */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                      To
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={endMonth}
                        onChange={(e) => setEndMonth(e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
                      >
                        {MONTH_NAMES.map((m) => (
                          <option key={m} value={m}>{m.slice(0, 3)}</option>
                        ))}
                      </select>
                      <select
                        value={endYear}
                        onChange={(e) => setEndYear(e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-medium text-zinc-500 text-center pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                  Header Banner: <span className="font-bold text-zinc-800 dark:text-zinc-200">{effectivePeriodLabel}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="size-4" />
            <span>{isExporting ? "Generating..." : "Download Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
