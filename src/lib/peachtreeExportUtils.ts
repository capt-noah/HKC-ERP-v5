/**
 * PEACHTREE (SAGE 50 ACCOUNTING) & EXCEL EXPORT ENGINE
 * Modular, optimized formatters producing exact Peachtree import layouts and styled Excel workbooks.
 */

import type { JournalEntry, JournalEntryLine, AccountItem, Invoice, FixedAsset } from "./financeStore"
import type { PurchaseOrder } from "./erpStore"

export type ExportFormat = "PEACHTREE_CSV" | "PEACHTREE_EXCEL" | "AUDIT_EXCEL"

export interface DateFilterOptions {
  startDate?: string | null
  endDate?: string | null
  dateRangeType?: string
}

/**
 * Trigger browser file download
 */
export function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Escapes values for standard RFC 4180 CSV
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return ""
  const str = String(val)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generates Microsoft Excel XML SpreadsheetML format (.xls / .xlsx readable)
 */
function generateExcelXml(title: string, headers: string[], rows: (string | number)[][], sheetName = "Sheet1"): string {
  const sanitize = (val: any) => {
    if (val === null || val === undefined) return ""
    return String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="DataCell">
   <Font ss:FontName="Calibri" ss:Size="10"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumCell">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/>
   <Alignment ss:Horizontal="Right"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitize(sheetName)}">
  <Table>
   <Row ss:Height="24">
    <Cell ss:StyleID="TitleStyle"><Data ss:Type="String">${sanitize(title)}</Data></Cell>
   </Row>
   <Row ss:Height="8"><Cell><Data ss:Type="String"></Data></Cell></Row>
   <Row ss:Height="20">
    ${headers.map((h) => `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${sanitize(h)}</Data></Cell>`).join("")}
   </Row>`

  for (const row of rows) {
    xml += `
   <Row ss:Height="18">
    ${row
      .map((val) => {
        const isNum = typeof val === "number"
        return `<Cell ss:StyleID="${isNum ? "NumCell" : "DataCell"}"><Data ss:Type="${isNum ? "Number" : "String"}">${sanitize(
          val
        )}</Data></Cell>`
      })
      .join("")}
   </Row>`
  }

  xml += `
  </Table>
 </Worksheet>
</Workbook>`

  return xml
}

/**
 * Filter helper by date range
 */
export function isDateInRange(dateStr?: string | null, filter?: DateFilterOptions): boolean {
  if (!dateStr || !filter) return true
  if (filter.startDate && dateStr < filter.startDate) return false
  if (filter.endDate && dateStr > filter.endDate) return false
  return true
}

export const FINANCE_DATE_FILTER_OPTIONS = [
  { value: "ALL", label: "All Time" },
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "THIS_YEAR", label: "This Year" },
  { value: "CUSTOM", label: "Custom Range" },
]

export function getDateFilterBounds(preset: string, customStart?: string, customEnd?: string): DateFilterOptions {
  if (!preset || preset === "ALL") return {}
  const today = new Date()
  const formatDate = (d: Date) => d.toISOString().split("T")[0]

  if (preset === "TODAY") {
    const todayStr = formatDate(today)
    return { startDate: todayStr, endDate: todayStr }
  }
  if (preset === "THIS_WEEK") {
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday
    const monday = new Date(today.setDate(diff))
    return { startDate: formatDate(monday), endDate: formatDate(new Date()) }
  }
  if (preset === "THIS_MONTH") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return { startDate: formatDate(firstDay), endDate: formatDate(today) }
  }
  if (preset === "LAST_MONTH") {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    return { startDate: formatDate(firstDay), endDate: formatDate(lastDay) }
  }
  if (preset === "THIS_YEAR") {
    const firstDay = new Date(today.getFullYear(), 0, 1)
    return { startDate: formatDate(firstDay), endDate: formatDate(today) }
  }
  if (preset === "CUSTOM") {
    return {
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
    }
  }
  return {}
}

export function isDateInPreset(dateStr?: string | null, preset = "ALL", customStart?: string, customEnd?: string): boolean {
  if (!dateStr || preset === "ALL") return true
  const bounds = getDateFilterBounds(preset, customStart, customEnd)
  return isDateInRange(dateStr, bounds)
}

// ------------------------------------------------------------------------------
// 1. GENERAL JOURNAL ENTRIES EXPORT (Peachtree General Ledger > General Journal)
// ------------------------------------------------------------------------------

export function exportPeachtreeGeneralJournal(
  entries: JournalEntry[],
  lines: JournalEntryLine[],
  accounts: AccountItem[],
  options?: { format?: ExportFormat; filter?: DateFilterOptions; filenameSuffix?: string }
) {
  const format = options?.format ?? "PEACHTREE_CSV"
  const filteredEntries = entries.filter((e) => isDateInRange(e.entry_date, options?.filter))
  const entryIdSet = new Set(filteredEntries.map((e) => e.id))
  const filteredLines = lines.filter((l) => entryIdSet.has(l.journal_entry_id))

  const headers = [
    "Date",
    "Reverse",
    "Reference",
    "Account ID",
    "Account Description",
    "Description",
    "Amount",
    "Debit Amount",
    "Credit Amount",
    "Job ID",
    "Party Reference",
  ]

  const rows: (string | number)[][] = []

  for (const entry of filteredEntries) {
    const entryLines = filteredLines.filter((l) => l.journal_entry_id === entry.id)
    for (const l of entryLines) {
      const acc = accounts.find((a) => a.id === l.account_id || a.code === l.account_id)
      const debit = Number(l.debit_amount) || 0
      const credit = Number(l.credit_amount) || 0
      // Signed amount: Positive for Debit, Negative for Credit in Peachtree
      const signedAmount = debit > 0 ? debit : -credit

      rows.push([
        entry.entry_date,
        entry.is_reversal_of ? "TRUE" : "FALSE",
        entry.id,
        acc ? acc.code : l.account_id,
        acc ? acc.name : "",
        entry.description,
        signedAmount,
        debit,
        credit,
        l.warehouse_id || "",
        l.party_name || "",
      ])
    }
  }

  const baseName = `HKC_GeneralJournal_${options?.filenameSuffix || new Date().toISOString().split("T")[0]}`

  if (format === "PEACHTREE_CSV") {
    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\r\n")
    triggerDownload(`${baseName}.csv`, csvContent, "text/csv;charset=utf-8;")
  } else {
    const xmlContent = generateExcelXml("HKC Trading - General Journal", headers, rows, "GeneralJournal")
    triggerDownload(`${baseName}.xls`, xmlContent, "application/vnd.ms-excel")
  }
}

// ------------------------------------------------------------------------------
// 2. CASH DISBURSEMENTS / CHEQUE VOUCHERS (Peachtree AP > Cash Disbursements)
// ------------------------------------------------------------------------------

export function exportPeachtreeDisbursements(
  purchaseOrders: PurchaseOrder[],
  _accounts?: AccountItem[],
  options?: { format?: ExportFormat; filter?: DateFilterOptions; filenameSuffix?: string }
) {
  const format = options?.format ?? "PEACHTREE_CSV"
  const filtered = purchaseOrders.filter((po) => isDateInRange(po.date, options?.filter))

  const headers = [
    "Vendor Name",
    "Check Number",
    "Voucher ID",
    "Date",
    "Cash Account ID",
    "Expense/Asset Account ID",
    "Description",
    "Amount",
    "Currency",
    "Status",
  ]

  const rows: (string | number)[][] = []

  for (const po of filtered) {
    const primaryRow = po.accountEntries?.[0]
    const debitAccCode = primaryRow?.accountCode || po.targetAccountCode || "5000"

    rows.push([
      po.paidTo || po.supplier || "Vendor",
      po.chequeNo || po.voucherNo || po.poNumber,
      po.voucherNo || po.poNumber,
      po.date || "",
      "1010",
      debitAccCode,
      po.reasonForPayment || "Procurement Disbursement",
      Number(po.amount) || 0,
      po.currency || "ETB",
      po.status,
    ])
  }

  const baseName = `HKC_CashDisbursements_${options?.filenameSuffix || new Date().toISOString().split("T")[0]}`

  if (format === "PEACHTREE_CSV") {
    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\r\n")
    triggerDownload(`${baseName}.csv`, csvContent, "text/csv;charset=utf-8;")
  } else {
    const xmlContent = generateExcelXml("HKC Trading - Cash Disbursements & Cheques", headers, rows, "Disbursements")
    triggerDownload(`${baseName}.xls`, xmlContent, "application/vnd.ms-excel")
  }
}

// ------------------------------------------------------------------------------
// 3. SALES INVOICES (Peachtree AR > Sales Journal)
// ------------------------------------------------------------------------------

export function exportPeachtreeSalesInvoices(
  invoices: Invoice[],
  options?: { format?: ExportFormat; filter?: DateFilterOptions; filenameSuffix?: string }
) {
  const format = options?.format ?? "PEACHTREE_CSV"
  const filtered = invoices.filter((i) => isDateInRange(i.issue_date, options?.filter))

  const headers = [
    "Customer Name",
    "Invoice Number",
    "Date",
    "Due Date",
    "AR Account",
    "Sales Account",
    "Item Description",
    "Quantity",
    "Unit Price",
    "Line Total",
    "Invoice Total",
    "Amount Paid",
    "Balance Due",
    "Status",
  ]

  const rows: (string | number)[][] = []

  for (const inv of filtered) {
    if (inv.line_items && inv.line_items.length > 0) {
      for (const item of inv.line_items) {
        rows.push([
          inv.customer_name || "",
          inv.invoice_number || inv.id,
          inv.issue_date,
          inv.due_date || "",
          "1200",
          "4100",
          item.description || "Commodity Export",
          Number(item.quantity) || 1,
          Number(item.unit_price) || Number(inv.total),
          Number(item.line_total) || Number(inv.total),
          Number(inv.total),
          Number(inv.amount_paid) || 0,
          Number(inv.balance_due) || 0,
          inv.status,
        ])
      }
    } else {
      rows.push([
        inv.customer_name || "",
        inv.invoice_number || inv.id,
        inv.issue_date,
        inv.due_date || "",
        "1200",
        "4100",
        "General Sales Invoice",
        1,
        Number(inv.total),
        Number(inv.total),
        Number(inv.total),
        Number(inv.amount_paid) || 0,
        Number(inv.balance_due) || 0,
        inv.status,
      ])
    }
  }

  const baseName = `HKC_SalesJournal_${options?.filenameSuffix || new Date().toISOString().split("T")[0]}`

  if (format === "PEACHTREE_CSV") {
    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\r\n")
    triggerDownload(`${baseName}.csv`, csvContent, "text/csv;charset=utf-8;")
  } else {
    const xmlContent = generateExcelXml("HKC Trading - Sales Invoices", headers, rows, "SalesInvoices")
    triggerDownload(`${baseName}.xls`, xmlContent, "application/vnd.ms-excel")
  }
}

// ------------------------------------------------------------------------------
// 4. CHART OF ACCOUNTS MASTER (Peachtree GL > Chart of Accounts)
// ------------------------------------------------------------------------------

export function exportPeachtreeChartOfAccounts(
  accounts: AccountItem[],
  options?: { format?: ExportFormat; filenameSuffix?: string; balances?: Record<string, number> }
) {
  const format = options?.format ?? "PEACHTREE_CSV"

  const peachtreeTypeMap: Record<string, string> = {
    Asset: "Cash",
    Liability: "Other Current Liabilities",
    Equity: "Equity",
    Revenue: "Income",
    Expense: "Expenses",
  }

  const headers = [
    "Account ID",
    "Account Description",
    "Debit Amt",
    "Credit Amt",
    "Account Type",
    "Active?",
    "Current Bal",
    "Last FYE Bal",
    "Debit Adj",
    "Credit Adj",
    "End Bal",
    "Reference",
  ]

  const balances = options?.balances || {}

  const rows: (string | number)[][] = accounts.map((acc) => {
    const netBal = balances[acc.id] || balances[acc.code] || 0
    const debitAmt = netBal > 0 ? netBal.toFixed(2) : ""
    const creditAmt = netBal < 0 ? Math.abs(netBal).toFixed(2) : ""
    const pType = acc.peachtree_type || peachtreeTypeMap[acc.account_type] || acc.account_type

    return [
      acc.code,
      acc.name,
      debitAmt,
      creditAmt,
      pType,
      acc.is_active !== false ? "Yes" : "No",
      netBal !== 0 ? netBal.toFixed(2) : "",
      "",
      "",
      "",
      netBal !== 0 ? netBal.toFixed(2) : "",
      "",
    ]
  })

  const baseName = `HKC_ChartOfAccounts_${options?.filenameSuffix || new Date().toISOString().split("T")[0]}`

  if (format === "PEACHTREE_CSV") {
    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\r\n")
    triggerDownload(`${baseName}.csv`, csvContent, "text/csv;charset=utf-8;")
  } else {
    const xmlContent = generateExcelXml("HKC Trading - Chart of Accounts", headers, rows, "ChartOfAccounts")
    triggerDownload(`${baseName}.xls`, xmlContent, "application/vnd.ms-excel")
  }
}

// ------------------------------------------------------------------------------
// 5. PAYROLL JOURNAL EXPORT (Peachtree Payroll > Payroll Journal)
// ------------------------------------------------------------------------------

export function exportPeachtreePayroll(
  payrollRuns: any[],
  options?: { format?: ExportFormat; filter?: DateFilterOptions; filenameSuffix?: string }
) {
  const format = options?.format ?? "PEACHTREE_CSV"
  const filtered = payrollRuns.filter((r) => isDateInRange(r.period_end || r.period_start, options?.filter))

  const headers = [
    "Payroll Run ID",
    "Period Label",
    "Period End Date",
    "Employee ID",
    "Employee Name",
    "Gross Salary",
    "Income Tax Withheld",
    "Pension Employee (7%)",
    "Pension Employer (11%)",
    "Total Deductions",
    "Net Pay Disbursed",
    "Cash Account",
    "Salary Expense Account",
  ]

  const rows: (string | number)[][] = []

  for (const run of filtered) {
    if (Array.isArray(run.employees)) {
      for (const emp of run.employees) {
        rows.push([
          run.id,
          run.period_label || "",
          run.period_end || "",
          emp.employee_id || "",
          emp.employee_name || "",
          Number(emp.gross_salary) || 0,
          Number(emp.income_tax) || 0,
          Number(emp.employee_pension) || 0,
          Number(emp.employer_pension) || 0,
          Number(emp.total_deductions) || 0,
          Number(emp.net_pay) || 0,
          "1010",
          "5200",
        ])
      }
    } else {
      rows.push([
        run.id,
        run.period_label || "",
        run.period_end || "",
        "ALL",
        "Consolidated Payroll",
        Number(run.total_gross) || 0,
        Number(run.total_tax) || 0,
        Number(run.total_pension) || 0,
        0,
        Number(run.total_deductions) || 0,
        Number(run.total_net) || 0,
        "1010",
        "5200",
      ])
    }
  }

  const baseName = `HKC_PayrollJournal_${options?.filenameSuffix || new Date().toISOString().split("T")[0]}`

  if (format === "PEACHTREE_CSV") {
    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\r\n")
    triggerDownload(`${baseName}.csv`, csvContent, "text/csv;charset=utf-8;")
  } else {
    const xmlContent = generateExcelXml("HKC Trading - Payroll Journal", headers, rows, "PayrollJournal")
    triggerDownload(`${baseName}.xls`, xmlContent, "application/vnd.ms-excel")
  }
}

// ------------------------------------------------------------------------------
// 6. FIXED ASSETS EXPORT (Peachtree Fixed Assets Schedule)
// ------------------------------------------------------------------------------

export function exportPeachtreeFixedAssets(
  assets: FixedAsset[],
  options?: { format?: ExportFormat; filenameSuffix?: string }
) {
  const format = options?.format ?? "PEACHTREE_CSV"

  const headers = [
    "Asset ID",
    "Asset Name",
    "Category",
    "Purchase Date",
    "Purchase Cost (ETB)",
    "Useful Life (Years)",
    "Salvage Value (ETB)",
    "Monthly Depreciation (ETB)",
    "Accumulated Depreciation (ETB)",
    "Net Book Value (ETB)",
    "Asset Account",
    "Depreciation Expense Account",
  ]

  const rows: (string | number)[][] = assets.map((a) => {
    const cost = Number(a.cost) || 0
    const accum = Number(a.accumulatedDepreciation) || 0
    const usefulYears = Number(a.usefulLifeYears) || 5
    const monthlyDepr = usefulYears > 0 ? Math.round(((cost - (Number(a.salvageValue) || 0)) / (usefulYears * 12)) * 100) / 100 : 0
    return [
      a.id,
      a.name,
      a.category,
      a.purchaseDate || "",
      cost,
      usefulYears,
      Number(a.salvageValue) || 0,
      monthlyDepr,
      accum,
      cost - accum,
      a.asset_account_id || "1700",
      a.depreciation_expense_account_id || "5300",
    ]
  })

  const baseName = `HKC_FixedAssets_${options?.filenameSuffix || new Date().toISOString().split("T")[0]}`

  if (format === "PEACHTREE_CSV") {
    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\r\n")
    triggerDownload(`${baseName}.csv`, csvContent, "text/csv;charset=utf-8;")
  } else {
    const xmlContent = generateExcelXml("HKC Trading - Fixed Assets & Depreciation", headers, rows, "FixedAssets")
    triggerDownload(`${baseName}.xls`, xmlContent, "application/vnd.ms-excel")
  }
}
