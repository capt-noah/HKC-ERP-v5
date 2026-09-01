export interface ExcelExportOptions {
  fileName: string
  sheetName?: string
  title?: string
  subtitle?: string
  metadata?: Array<{ label: string; value: string }>
  headers: string[]
  rows: (string | number)[][]
}

export interface PrintBinCardOptions {
  cardNo: string
  description: string
  dosage: string
  unit: string
  shelfNo: string
  entries: Array<{
    date: string
    batchNo: string
    qtyReceived: number
    qtyIssued: number
    balance: number
    expiryDate: string
    party: string
    remark: string
  }>
}

/**
 * Modular Excel Export function (.xls / .xlsx XML format)
 * Opens natively in Microsoft Excel, Apple Numbers, and Google Sheets
 */
export function exportToExcel({
  fileName,
  sheetName = "Sheet1",
  title = "Habtom Kebede Veterinary Drug Import",
  subtitle,
  metadata = [],
  headers,
  rows,
}: ExcelExportOptions): void {
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
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="SubTitleStyle">
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#047857"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="MetaVal">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="DataCell">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumCell">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Alignment ss:Horizontal="Right"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitize(sheetName)}">
  <Table>`

  // 1. Company Title Header
  if (title) {
    xml += `
   <Row ss:Height="24">
    <Cell ss:StyleID="TitleStyle"><Data ss:Type="String">${sanitize(title)}</Data></Cell>
   </Row>`
  }

  // 2. Subtitle Header
  if (subtitle) {
    xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="SubTitleStyle"><Data ss:Type="String">${sanitize(subtitle)}</Data></Cell>
   </Row>`
  }

  // 3. Metadata Key-Values
  if (metadata.length > 0) {
    metadata.forEach(m => {
      xml += `
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">${sanitize(m.label)}:</Data></Cell>
    <Cell ss:StyleID="MetaVal"><Data ss:Type="String">${sanitize(m.value)}</Data></Cell>
   </Row>`
    })
    xml += `<Row></Row>` // Empty spacer row
  }

  // 4. Data Headers Row
  xml += `
   <Row ss:Height="22">`
  headers.forEach(h => {
    xml += `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${sanitize(h)}</Data></Cell>`
  })
  xml += `</Row>`

  // 5. Data Rows
  rows.forEach(r => {
    xml += `
   <Row>`
    r.forEach(cellVal => {
      const isNum = typeof cellVal === "number" && !isNaN(cellVal)
      const style = isNum ? "NumCell" : "DataCell"
      const dataType = isNum ? "Number" : "String"
      xml += `<Cell ss:StyleID="${style}"><Data ss:Type="${dataType}">${sanitize(cellVal)}</Data></Cell>`
    })
    xml += `</Row>`
  })

  xml += `
  </Table>
 </Worksheet>
</Workbook>`

  // Create Blob & Download
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" })
  const finalFileName = fileName.endsWith(".xls") || fileName.endsWith(".xlsx") ? fileName : `${fileName}.xls`
  
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = finalFileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

/**
 * Open clean, dedicated print document window for Bin Cards
 * Eliminates blank pages and website chrome PDF issues 100%
 */
export function printBinCardDocument(card: PrintBinCardOptions): void {
  const printWindow = window.open("", "_blank", "width=980,height=1000")
  if (!printWindow) {
    window.print()
    return
  }

  const totalReceived = card.entries.reduce((sum, e) => sum + e.qtyReceived, 0)
  const totalIssued = card.entries.reduce((sum, e) => sum + e.qtyIssued, 0)
  const currentBalance = card.entries.length > 0 ? card.entries[card.entries.length - 1].balance : 0
  const logoUrl = typeof window !== "undefined" && window.location?.origin ? `${window.location.origin}/hkc_logo.png` : "/hkc_logo.png"

  const rowsHtml = card.entries.length === 0
    ? `<tr><td colspan="8" style="padding:20px; text-align:center; color:#71717a; font-style:italic;">No transaction entries recorded on this bin card.</td></tr>`
    : card.entries.map(rec => `
        <tr style="border-bottom:1px solid #d4d4d8;">
          <td style="padding:8px 10px; font-weight:bold; font-family:monospace; border-right:1px solid #d4d4d8;">${rec.date}</td>
          <td style="padding:8px 10px; font-weight:bold; font-family:monospace; border-right:1px solid #d4d4d8;">${rec.batchNo}</td>
          <td style="padding:8px 10px; text-align:right; font-weight:bold; color:${rec.qtyReceived > 0 ? '#047857' : '#9ca3af'}; border-right:1px solid #d4d4d8;">${rec.qtyReceived > 0 ? '+' + rec.qtyReceived.toLocaleString() : '-'}</td>
          <td style="padding:8px 10px; text-align:right; font-weight:bold; color:${rec.qtyIssued > 0 ? '#b91c1c' : '#9ca3af'}; border-right:1px solid #d4d4d8;">${rec.qtyIssued > 0 ? '-' + rec.qtyIssued.toLocaleString() : '-'}</td>
          <td style="padding:8px 10px; text-align:right; font-weight:900; font-family:monospace; background:#f4f4f5; border-right:1px solid #d4d4d8;">${rec.balance.toLocaleString()}</td>
          <td style="padding:8px 10px; font-family:monospace; border-right:1px solid #d4d4d8;">${rec.expiryDate}</td>
          <td style="padding:8px 10px; border-right:1px solid #d4d4d8;">${rec.party}</td>
          <td style="padding:8px 10px; color:#52525b;">${rec.remark}</td>
        </tr>
      `).join("")

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BIN CARD - ${card.cardNo}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #09090b; margin: 0; padding: 24px; background: #ffffff; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #09090b; padding-bottom: 14px; margin-bottom: 18px; }
    .logo-container { display: flex; align-items: center; gap: 16px; }
    .logo { height: 65px; width: auto; object-fit: contain; }
    .company-name { font-size: 19px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: -0.3px; color: #09090b; }
    .contact-info { font-size: 11px; color: #475569; margin-top: 4px; font-weight: 600; }
    .card-no-badge { font-size: 14px; font-family: monospace; font-weight: 900; color: #09090b; text-align: right; }
    
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 11px; }
    .meta-label { font-size: 9px; text-transform: uppercase; font-weight: 800; color: #64748b; margin-bottom: 2px; }
    .meta-val { font-size: 12px; font-weight: 800; color: #0f172a; }
    .meta-shelf { font-size: 12px; font-weight: 900; color: #047857; font-family: monospace; }
    
    table.ledger-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #d4d4d8; border-radius: 8px; overflow: hidden; table-layout: fixed; }
    table.ledger-table th { background: #f4f4f5; font-size: 10px; text-transform: uppercase; font-weight: 900; color: #09090b; padding: 8px 10px; border-right: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
    table.ledger-table td { padding: 8px 10px; }
    table.ledger-table tfoot tr { background: #f4f4f5; font-weight: bold; border-top: 2px solid #d4d4d8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      <img src="${logoUrl}" class="logo" alt="HKC Logo" />
      <div>
        <h1 class="company-name">Habtom Kebede Veterinary Drug Import</h1>
        <div class="contact-info">Addis Ababa, Ethiopia &nbsp;|&nbsp; Phone: +251 911 12 21 02 / +251 944 73 92 22</div>
      </div>
    </div>
    <div class="card-no-badge">
      Card No: ${card.cardNo}
    </div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-label">Description / Name</div>
      <div class="meta-val">${card.description}</div>
    </div>
    <div>
      <div class="meta-label">Strength / Dosage</div>
      <div class="meta-val">${card.dosage}</div>
    </div>
    <div>
      <div class="meta-label">Unit of Measurement</div>
      <div class="meta-val">${card.unit}</div>
    </div>
    <div>
      <div class="meta-label">Shelf Number</div>
      <div class="meta-shelf">${card.shelfNo}</div>
    </div>
  </div>

  <table class="ledger-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 12%;">Date</th>
        <th rowspan="2" style="width: 14%;">Batch Number</th>
        <th colspan="3" style="text-align:center;">Quantity In</th>
        <th rowspan="2" style="width: 12%;">Expiry Date</th>
        <th rowspan="2" style="width: 20%;">Received / Issued To</th>
        <th rowspan="2" style="width: 16%;">Remark</th>
      </tr>
      <tr>
        <th style="width: 9%; text-align:right; color:#047857;">Received</th>
        <th style="width: 9%; text-align:right; color:#b91c1c;">Issued</th>
        <th style="width: 10%; text-align:right; background:#e4e4e7;">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right; font-weight:900; font-size:10px; text-transform:uppercase; border-right:1px solid #d4d4d8;">Total Ledger Summary:</td>
        <td style="text-align:right; color:#047857; font-weight:bold; border-right:1px solid #d4d4d8;">+${totalReceived.toLocaleString()}</td>
        <td style="text-align:right; color:#b91c1c; font-weight:bold; border-right:1px solid #d4d4d8;">-${totalIssued.toLocaleString()}</td>
        <td style="text-align:right; font-weight:900; background:#e4e4e7; border-right:1px solid #d4d4d8;">${currentBalance.toLocaleString()} ${card.unit}</td>
        <td colspan="3" style="font-size:10px; color:#71717a; font-style:italic;">Ledger verified & synchronized with Habtom Kebede Vet Stock Store</td>
      </tr>
    </tfoot>
  </table>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

export interface PrintSalesIssueOptions {
  fsNo: string
  referenceNo: string
  saleDate: string
  customerName: string
  tin?: string
  address?: string
  accountNo?: string
  station?: string
  store?: string
  paymentType: "Cash" | "Credit" | string
  items: Array<{
    id?: string
    itemName: string
    batchNo: string
    packagingUnit: string
    quantity: number
    unitPrice: number
    amount: number
  }>
  subtotal: number
  vat: number
  discount: number
  grandTotal: number
  amountInWords?: string
  company?: {
    name?: string
    address?: string
    phone?: string
    tin?: string
  }
}

const smallNumbers = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
]
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function chunkToWords(value: number): string {
  if (value < 20) return smallNumbers[value]
  if (value < 100) {
    const ten = Math.floor(value / 10)
    const rest = value % 10
    return rest ? `${tens[ten]} ${smallNumbers[rest]}` : tens[ten]
  }
  const hundred = Math.floor(value / 100)
  const rest = value % 100
  return rest ? `${smallNumbers[hundred]} Hundred ${chunkToWords(rest)}` : `${smallNumbers[hundred]} Hundred`
}

export function numberToWords(value: number): string {
  const whole = Math.max(0, Math.round(value))
  if (whole === 0) return "Zero Birr Only"
  const groups = [
    { value: 1_000_000_000, label: "Billion" },
    { value: 1_000_000, label: "Million" },
    { value: 1_000, label: "Thousand" },
    { value: 1, label: "" },
  ]
  let remainder = whole
  const words: string[] = []
  for (const group of groups) {
    const amount = Math.floor(remainder / group.value)
    if (amount) {
      words.push(`${chunkToWords(amount)}${group.label ? ` ${group.label}` : ""}`)
      remainder %= group.value
    }
  }
  return `${words.join(" ")} Birr Only`
}

/**
 * Open clean, dedicated print document window for Sales Issued / Credit Sales Attachment
 * Provides clean PDF print without browser chrome or page background clutter
 */
export function printSalesIssueDocument(issue: PrintSalesIssueOptions): void {
  const printWindow = window.open("", "_blank", "width=980,height=1000")
  if (!printWindow) {
    window.print()
    return
  }

  const logoUrl = typeof window !== "undefined" && window.location?.origin ? `${window.location.origin}/hkc_logo.png` : "/hkc_logo.png"
  const companyName = issue.company?.name || "Habtom Kebede Veterinary Drug Import"
  const companyAddress = issue.company?.address || "Addis Ababa, Ethiopia"
  const companyPhone = issue.company?.phone || "+251 911 12 21 02 / +251 944 73 92 22"
  const companyTin = issue.company?.tin || "0002847591"
  const grandTotal = Number(issue.grandTotal || 0)
  const vat = Number(issue.vat || 0)
  const discount = Number(issue.discount || 0)
  const subtotal = issue.subtotal !== undefined ? Number(issue.subtotal) : (grandTotal - vat + discount)
  const words = issue.amountInWords || numberToWords(grandTotal)

  const rowsHtml = issue.items.map((item, index) => `
    <tr style="border-bottom:1px solid #e4e4e7;">
      <td style="padding:7px 10px; font-size:11px; color:#52525b; border-right:1px solid #e4e4e7;">${index + 1}</td>
      <td style="padding:7px 10px; font-size:11px; border-right:1px solid #e4e4e7;">
        <strong style="display:block; color:#09090b;">${item.itemName}</strong>
        <span style="display:block; font-size:9.5px; color:#71717a; font-family:monospace; margin-top:2px;">Batch No: ${item.batchNo || "-"}</span>
      </td>
      <td style="padding:7px 10px; font-size:11px; border-right:1px solid #e4e4e7;">${item.packagingUnit || "Box"}</td>
      <td style="padding:7px 10px; text-align:right; font-size:11px; font-weight:bold; font-family:monospace; border-right:1px solid #e4e4e7;">${Number(item.quantity || 0).toLocaleString()}</td>
      <td style="padding:7px 10px; text-align:right; font-size:11px; font-family:monospace; border-right:1px solid #e4e4e7;">${Number(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:7px 10px; text-align:right; font-size:11px; font-weight:900; font-family:monospace;">${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  `).join("")

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Credit Sales Attachment - CSA-${issue.fsNo || issue.referenceNo}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #09090b; margin: 0; padding: 24px; background: #ffffff; }
    .header { display: grid; grid-template-columns: 1fr 0.72fr; gap: 16mm; border-bottom: 2px solid #09090b; padding-bottom: 14px; margin-bottom: 16px; }
    .logo-container { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
    .logo { height: 50px; width: auto; object-fit: contain; }
    .company-name { font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0; color: #09090b; }
    .contact-info { font-size: 11px; color: #475569; margin-top: 3px; font-weight: 600; line-height: 1.4; }
    .docno-label { font-size: 10px; text-transform: uppercase; font-weight: 900; color: #64748b; letter-spacing: 0.05em; }
    .docno-val { font-size: 13px; font-family: monospace; font-weight: 900; color: #09090b; margin-top: 2px; }
    
    .title-banner { margin: 12px 0 16px; border: 1.5px solid #09090b; background: #f4f4f5; padding: 10px; text-align: center; }
    .title-banner h1 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
    .info-box { border: 1px solid #d4d4d8; padding: 12px; }
    .box-title { margin: 0 0 8px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: #09090b; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px; }
    .info-row dt { color: #64748b; font-weight: 700; }
    .info-row dd { color: #09090b; font-weight: 800; text-align: right; margin: 0; }
    
    table.items-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #d4d4d8; table-layout: fixed; }
    table.items-table th { background: #f4f4f5; font-size: 10px; text-transform: uppercase; font-weight: 900; color: #09090b; padding: 8px 10px; border-right: 1px solid #d4d4d8; border-bottom: 1.5px solid #09090b; text-align: left; }
    table.items-table th.text-right { text-align: right; }
    
    .lower-section { display: grid; grid-template-columns: 1fr 65mm; gap: 14px; margin-top: 18px; align-items: start; }
    .payment-box { border: 1px solid #d4d4d8; padding: 12px; }
    .checkbox-group { display: flex; align-items: center; gap: 24px; margin: 10px 0 14px; }
    .checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .checkbox-square { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border: 2px solid #000000; border-radius: 2px; font-size: 11px; font-weight: 900; line-height: 1; }
    .checkbox-checked { background: #000000; color: #ffffff; }
    .checkbox-unchecked { background: #ffffff; color: transparent; }
    
    .totals-box { border: 1.5px solid #09090b; }
    .totals-row { display: flex; justify-content: space-between; padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #e4e4e7; }
    .totals-row.grand { background: #09090b; color: #ffffff; font-weight: 900; border-bottom: none; }
    .totals-row.grand span { color: #ffffff; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-container">
        <img src="${logoUrl}" class="logo" alt="HKC Logo" />
        <div>
          <h2 class="company-name">${companyName}</h2>
          <div class="contact-info">
            ${companyAddress}<br>
            Telephone: ${companyPhone} &nbsp;|&nbsp; TIN: ${companyTin}
          </div>
        </div>
      </div>
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e4e4e7;">
        <div class="docno-label">Document Number</div>
        <div class="docno-val">CSA-${issue.fsNo || issue.referenceNo}</div>
      </div>
    </div>
    <div style="text-align: right;">
      <div>
        <div class="docno-label">Reference Number</div>
        <div class="docno-val">${issue.referenceNo || "-"}</div>
      </div>
      <div style="margin-top: 12px;">
        <div class="docno-label">FS Number</div>
        <div class="docno-val">${issue.fsNo || "-"}</div>
      </div>
    </div>
  </div>

  <div class="title-banner">
    <h1>Credit Sales Attachment</h1>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="box-title">Bill To</div>
      <div class="info-row"><dt>Customer Name</dt><dd>${issue.customerName}</dd></div>
      <div class="info-row"><dt>TIN Number</dt><dd>${issue.tin || "-"}</dd></div>
      <div class="info-row"><dt>Address</dt><dd>${issue.address || "-"}</dd></div>
      <div class="info-row"><dt>A/C Number</dt><dd>${issue.accountNo || "-"}</dd></div>
    </div>
    <div class="info-box">
      <div class="box-title">Sales Issue Details</div>
      <div class="info-row"><dt>Sale Date</dt><dd>${issue.saleDate || "-"}</dd></div>
      <div class="info-row"><dt>Reference</dt><dd>${issue.referenceNo || "-"}</dd></div>
      <div class="info-row"><dt>FS Number</dt><dd>${issue.fsNo || "-"}</dd></div>
      <div class="info-row"><dt>Station</dt><dd>${issue.station || "-"}</dd></div>
      <div class="info-row"><dt>Store</dt><dd>${issue.store || "-"}</dd></div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 7%;">ID</th>
        <th style="width: 43%;">Description</th>
        <th style="width: 12%;">Unit</th>
        <th class="text-right" style="width: 12%;">Quantity</th>
        <th class="text-right" style="width: 13%;">Unit Price</th>
        <th class="text-right" style="width: 13%;">Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="lower-section">
    <div class="payment-box">
      <div class="box-title">Payment Terms / Method</div>
      <div class="checkbox-group">
        <div class="checkbox-item">
          <span class="checkbox-square ${issue.paymentType === "Cash" ? "checkbox-checked" : "checkbox-unchecked"}">✓</span>
          <span>Cash</span>
        </div>
        <div class="checkbox-item">
          <span class="checkbox-square ${issue.paymentType === "Credit" ? "checkbox-checked" : "checkbox-unchecked"}">✓</span>
          <span>Credit</span>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <div class="docno-label">Amount in Words</div>
        <div style="font-size: 12px; font-weight: 900; margin-top: 2px; line-height: 1.4;">${words}</div>
      </div>
    </div>

    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><strong>ETB ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      <div class="totals-row"><span>VAT</span><strong>ETB ${vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      ${discount > 0 ? `<div class="totals-row"><span>Discount</span><strong>ETB ${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>` : ""}
      <div class="totals-row grand"><span>Grand Total</span><strong>ETB ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

/**
 * Export Sales Issue as Excel Spreadsheet
 */
export function exportSalesIssueToExcel(issue: PrintSalesIssueOptions): void {
  const headers = ["ID", "Description", "Batch No", "Unit", "Quantity", "Unit Price (ETB)", "Line Total (ETB)"]
  const rows = issue.items.map((item, index) => [
    index + 1,
    item.itemName,
    item.batchNo || "-",
    item.packagingUnit || "-",
    item.quantity,
    item.unitPrice,
    item.amount,
  ])

  exportToExcel({
    fileName: `SalesIssue_${issue.fsNo || issue.referenceNo}_${issue.customerName.replace(/\s+/g, "_")}.xls`,
    title: issue.company?.name || "Habtom Kebede Veterinary Drug Import",
    subtitle: `CREDIT SALES ATTACHMENT - CSA-${issue.fsNo || issue.referenceNo}`,
    metadata: [
      { label: "Document Number", value: `CSA-${issue.fsNo || issue.referenceNo}` },
      { label: "Customer Name", value: issue.customerName },
      { label: "TIN Number", value: issue.tin || "-" },
      { label: "Sale Date", value: issue.saleDate || "-" },
      { label: "FS Number", value: issue.fsNo || "-" },
      { label: "Reference Number", value: issue.referenceNo || "-" },
      { label: "Payment Terms", value: issue.paymentType },
      { label: "Grand Total (ETB)", value: issue.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) },
    ],
    headers,
    rows,
  })
}

export interface PrintPurchaseOrderOptions {
  voucherNo: string
  date: string
  paidTo: string
  reasonForPayment?: string
  bankName?: string
  paymentMethod?: string
  chequeNo?: string
  amount: number
  amountInWords?: string
  status?: string
  accountEntries?: Array<{
    accountCode: string
    description?: string
    debit?: number
    credit?: number
  }>
  targetAccountCode?: string
  company?: {
    name?: string
    address?: string
    phone?: string
    tin?: string
  }
}

/**
 * Open clean, dedicated print document window for Cheque Payment Vouchers (Purchase Orders)
 */
export function printPurchaseOrderDocument(po: PrintPurchaseOrderOptions): void {
  const printWindow = window.open("", "_blank", "width=980,height=1000")
  if (!printWindow) {
    window.print()
    return
  }

  const companyName = po.company?.name || "HABTOM KEBEDE CHIMSA IMPORT & EXPORT"
  const words = po.amountInWords || numberToWords(po.amount)
  const entries = Array.isArray(po.accountEntries) && po.accountEntries.length > 0
    ? po.accountEntries
    : [{ accountCode: po.targetAccountCode || "1410", description: po.reasonForPayment || "Payment", debit: po.amount, credit: 0 }]

  const totalDebit = entries.reduce((s, r) => s + (Number(r.debit) || 0), 0)
  const totalCredit = entries.reduce((s, r) => s + (Number(r.credit) || 0), 0)

  const rowsHtml = entries.map(row => `
    <tr style="border-bottom:1px solid #d4d4d8;">
      <td style="padding:8px 10px; font-family:monospace; font-weight:bold; border-right:1px solid #d4d4d8;">${row.accountCode}</td>
      <td style="padding:8px 10px; border-right:1px solid #d4d4d8;">${row.description || po.reasonForPayment || "—"}</td>
      <td style="padding:8px 10px; text-align:right; font-family:monospace; font-weight:bold; border-right:1px solid #d4d4d8;">${row.debit && Number(row.debit) > 0 ? Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
      <td style="padding:8px 10px; text-align:right; font-family:monospace; font-weight:bold;">${row.credit && Number(row.credit) > 0 ? Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
    </tr>
  `).join("")

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Voucher - ${po.voucherNo}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #09090b; margin: 0; padding: 24px; background: #ffffff; }
    .header { text-align: center; border-bottom: 2px solid #09090b; padding-bottom: 12px; margin-bottom: 16px; }
    .company-title { font-size: 17px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: 0.02em; }
    .sub-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.08em; margin-top: 4px; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; font-size: 11px; margin-bottom: 14px; }
    .info-row { display: flex; align-items: baseline; gap: 8px; }
    .info-label { font-weight: 800; color: #64748b; font-size: 10px; text-transform: uppercase; shrink-0; }
    .info-val { font-weight: 800; color: #09090b; border-bottom: 1px solid #cbd5e1; flex: 1; padding-bottom: 2px; }
    .full-width { grid-column: span 2; }
    
    .words-box { font-size: 11px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; }
    .words-label { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .words-val { font-weight: 900; color: #0f172a; font-style: italic; }
    
    table.entries-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #d4d4d8; table-layout: fixed; }
    table.entries-table th { background: #f4f4f5; font-size: 10px; text-transform: uppercase; font-weight: 900; color: #09090b; padding: 8px 10px; border-right: 1px solid #d4d4d8; border-bottom: 1.5px solid #09090b; }
    table.entries-table tfoot td { background: #f4f4f5; font-weight: 900; border-top: 1.5px solid #09090b; padding: 8px 10px; }
    
    .signatures-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 28px; padding-top: 16px; border-top: 1px solid #e4e4e7; }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 1px solid #09090b; height: 36px; margin-bottom: 6px; }
    .sig-label { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="company-title">${companyName}</h1>
    <div class="sub-title">Cheque Payment Voucher</div>
  </div>

  <div class="info-grid">
    <div class="info-row"><span class="info-label">Voucher No:</span><span class="info-val font-mono">${po.voucherNo}</span></div>
    <div class="info-row"><span class="info-label">Date:</span><span class="info-val">${po.date}</span></div>
    <div class="info-row full-width"><span class="info-label">Paid To:</span><span class="info-val">${po.paidTo}</span></div>
    <div class="info-row full-width"><span class="info-label">Reason for Payment:</span><span class="info-val">${po.reasonForPayment || "—"}</span></div>
    <div class="info-row"><span class="info-label">Bank:</span><span class="info-val">${po.bankName || "Commercial Bank of Ethiopia (CBE)"}</span></div>
    <div class="info-row"><span class="info-label">Payment Method:</span><span class="info-val">${po.paymentMethod || "Cheque"}</span></div>
    <div class="info-row"><span class="info-label">Cheque / Ref No:</span><span class="info-val font-mono">${po.chequeNo || "—"}</span></div>
    <div class="info-row"><span class="info-label">Amount in Figure:</span><span class="info-val font-mono">ETB ${Number(po.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
  </div>

  <div class="words-box">
    <div class="words-label">Amount in Words</div>
    <div class="words-val">${words}</div>
  </div>

  <table class="entries-table">
    <thead>
      <tr>
        <th style="width: 18%; text-align:left;">Account No.</th>
        <th style="width: 46%; text-align:left;">Description</th>
        <th style="width: 18%; text-align:right;">Debit</th>
        <th style="width: 18%; text-align:right;">Credit</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right; font-size:10px; text-transform:uppercase; border-right:1px solid #d4d4d8;">Total Summary:</td>
        <td style="text-align:right; font-family:monospace; border-right:1px solid #d4d4d8;">ETB ${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-family:monospace;">ETB ${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>
  </table>

  <div class="signatures-grid">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Prepared By</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Checked By</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Approved By</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Received By</div></div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

/**
 * Export Cheque Payment Voucher / Purchase Order to Excel Spreadsheet
 */
export function exportPurchaseOrderToExcel(po: PrintPurchaseOrderOptions): void {
  const headers = ["Account No", "Description", "Debit (ETB)", "Credit (ETB)"]
  const entries = Array.isArray(po.accountEntries) && po.accountEntries.length > 0
    ? po.accountEntries
    : [{ accountCode: po.targetAccountCode || "1410", description: po.reasonForPayment || "Payment", debit: po.amount, credit: 0 }]

  const rows = entries.map(e => [
    e.accountCode,
    e.description || po.reasonForPayment || "-",
    e.debit || 0,
    e.credit || 0
  ])

  exportToExcel({
    fileName: `PaymentVoucher_${po.voucherNo}_${po.paidTo.replace(/\s+/g, "_")}.xls`,
    title: po.company?.name || "HABTOM KEBEDE CHIMSA IMPORT & EXPORT",
    subtitle: `CHEQUE PAYMENT VOUCHER - ${po.voucherNo}`,
    metadata: [
      { label: "Document Type", value: "Cheque Payment Voucher" },
      { label: "Voucher Number", value: po.voucherNo },
      { label: "Date", value: po.date },
      { label: "Paid To", value: po.paidTo },
      { label: "Reason for Payment", value: po.reasonForPayment || "-" },
      { label: "Bank", value: po.bankName || "Commercial Bank of Ethiopia (CBE)" },
      { label: "Payment Method", value: po.paymentMethod || "Cheque" },
      { label: "Cheque / Ref No", value: po.chequeNo || "-" },
      { label: "Amount (ETB)", value: Number(po.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
      { label: "Amount in Words", value: po.amountInWords || "-" },
    ],
    headers,
    rows,
  })
}

export interface PrintInvoiceOptions {
  invoiceNumber: string
  customerName: string
  issueDate: string
  dueDate: string
  currency: string
  paymentTerms?: string
  status: string
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  taxAmount: number
  taxRate?: number
  discountAmount: number
  total: number
  amountPaid: number
  balanceDue: number
  amountInWords?: string
  company?: {
    name?: string
    address?: string
    phone?: string
    tin?: string
  }
}

/**
 * Open clean, dedicated print document window for Sales Invoices
 */
export function printInvoiceDocument(inv: PrintInvoiceOptions): void {
  const printWindow = window.open("", "_blank", "width=980,height=1000")
  if (!printWindow) {
    window.print()
    return
  }

  const logoUrl = typeof window !== "undefined" && window.location?.origin ? `${window.location.origin}/hkc_logo.png` : "/hkc_logo.png"
  const companyName = inv.company?.name || "Habtom Kebede Veterinary Drug Import"
  const companyAddress = inv.company?.address || "Addis Ababa, Ethiopia"
  const companyPhone = inv.company?.phone || "+251 911 12 21 02 / +251 944 73 92 22"
  const companyTin = inv.company?.tin || "0002847591"
  const words = inv.amountInWords || numberToWords(inv.total)
  const isPaid = inv.status === "Paid" || inv.balanceDue === 0

  const rowsHtml = inv.lineItems.map((item, index) => `
    <tr style="border-bottom:1px solid #e4e4e7;">
      <td style="padding:7px 10px; font-size:11px; color:#52525b; border-right:1px solid #e4e4e7;">${index + 1}</td>
      <td style="padding:7px 10px; font-size:11px; border-right:1px solid #e4e4e7;">
        <strong style="color:#09090b;">${item.description}</strong>
      </td>
      <td style="padding:7px 10px; text-align:right; font-size:11px; font-family:monospace; font-weight:bold; border-right:1px solid #e4e4e7;">${Number(item.quantity || 1).toLocaleString()}</td>
      <td style="padding:7px 10px; text-align:right; font-size:11px; font-family:monospace; border-right:1px solid #e4e4e7;">${Number(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:7px 10px; text-align:right; font-size:11px; font-weight:900; font-family:monospace;">${Number(item.lineTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  `).join("")

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sales Invoice - ${inv.invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #09090b; margin: 0; padding: 24px; background: #ffffff; }
    .header { display: grid; grid-template-columns: 1fr 0.75fr; gap: 16mm; border-bottom: 2px solid #09090b; padding-bottom: 14px; margin-bottom: 16px; }
    .logo-container { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
    .logo { height: 50px; width: auto; object-fit: contain; }
    .company-name { font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0; color: #09090b; }
    .contact-info { font-size: 11px; color: #475569; margin-top: 3px; font-weight: 600; line-height: 1.4; }
    .docno-label { font-size: 10px; text-transform: uppercase; font-weight: 900; color: #64748b; letter-spacing: 0.05em; }
    .docno-val { font-size: 13px; font-family: monospace; font-weight: 900; color: #09090b; margin-top: 2px; }
    
    .title-banner { margin: 12px 0 16px; border: 1.5px solid #09090b; background: #f4f4f5; padding: 10px; text-align: center; }
    .title-banner h1 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
    .info-box { border: 1px solid #d4d4d8; padding: 12px; }
    .box-title { margin: 0 0 8px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: #09090b; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px; }
    .info-row dt { color: #64748b; font-weight: 700; }
    .info-row dd { color: #09090b; font-weight: 800; text-align: right; margin: 0; }
    
    table.items-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #d4d4d8; table-layout: fixed; }
    table.items-table th { background: #f4f4f5; font-size: 10px; text-transform: uppercase; font-weight: 900; color: #09090b; padding: 8px 10px; border-right: 1px solid #d4d4d8; border-bottom: 1.5px solid #09090b; text-align: left; }
    table.items-table th.text-right { text-align: right; }
    
    .lower-section { display: grid; grid-template-columns: 1fr 65mm; gap: 14px; margin-top: 18px; align-items: start; }
    .payment-box { border: 1px solid #d4d4d8; padding: 12px; }
    
    .totals-box { border: 1.5px solid #09090b; }
    .totals-row { display: flex; justify-content: space-between; padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #e4e4e7; }
    .totals-row.grand { background: #09090b; color: #ffffff; font-weight: 900; border-bottom: none; }
    .totals-row.grand span { color: #ffffff; }
    .totals-row.status-row { font-weight: 900; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-container">
        <img src="${logoUrl}" class="logo" alt="HKC Logo" />
        <div>
          <h2 class="company-name">${companyName}</h2>
          <div class="contact-info">
            ${companyAddress}<br>
            Telephone: ${companyPhone} &nbsp;|&nbsp; TIN: ${companyTin}
          </div>
        </div>
      </div>
    </div>
    <div style="text-align: right;">
      <div>
        <div class="docno-label">Invoice Number</div>
        <div class="docno-val">${inv.invoiceNumber}</div>
      </div>
      <div style="margin-top: 10px;">
        <div class="docno-label">Issue Date</div>
        <div class="docno-val">${inv.issueDate}</div>
      </div>
      <div style="margin-top: 10px;">
        <div class="docno-label">Payment Status</div>
        <div class="docno-val" style="color:${isPaid ? '#047857' : '#b91c1c'}; font-size: 12px;">${isPaid ? 'Paid' : 'Unpaid'}</div>
      </div>
    </div>
  </div>

  <div class="title-banner">
    <h1>Sales Invoice</h1>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="box-title">Billed To</div>
      <div class="info-row"><dt>Customer Name</dt><dd>${inv.customerName}</dd></div>
    </div>
    <div class="info-box">
      <div class="box-title">Invoice Details</div>
      <div class="info-row"><dt>Invoice Date</dt><dd>${inv.issueDate}</dd></div>
      <div class="info-row"><dt>Currency</dt><dd>${inv.currency}</dd></div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 7%;">#</th>
        <th style="width: 45%;">Item Description</th>
        <th class="text-right" style="width: 14%;">Quantity</th>
        <th class="text-right" style="width: 17%;">Unit Price (${inv.currency})</th>
        <th class="text-right" style="width: 17%;">Total (${inv.currency})</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="lower-section">
    <div class="payment-box">
      <div class="box-title">Amount in Words</div>
      <div style="font-size: 12px; font-weight: 900; margin-top: 4px; line-height: 1.4;">${words}</div>
    </div>

    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><strong>${inv.currency} ${inv.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      ${inv.discountAmount > 0 ? `<div class="totals-row"><span>Discount</span><strong>-${inv.currency} ${inv.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>` : ""}
      <div class="totals-row"><span>Tax (VAT ${inv.taxRate !== undefined ? inv.taxRate : (inv.subtotal > 0 && inv.taxAmount > 0 ? Math.round((inv.taxAmount / Math.max(1, inv.subtotal - inv.discountAmount)) * 100) : (inv.taxAmount > 0 ? 15 : 0))}%)</span><strong>${inv.currency} ${inv.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      <div class="totals-row grand"><span>Total Receivable</span><strong>${inv.currency} ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      <div class="totals-row" style="color: #047857;"><span>Amount Paid</span><strong>${inv.currency} ${inv.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      <div class="totals-row status-row" style="color: ${inv.balanceDue > 0 ? '#b91c1c' : '#047857'};"><span>Balance</span><strong>${inv.currency} ${inv.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

/**
 * Export Sales Invoice to Excel
 */
export function exportInvoiceToExcel(inv: PrintInvoiceOptions): void {
  const isPaid = inv.status === "Paid" || inv.balanceDue === 0
  const headers = ["#", "Item Description", "Quantity", `Unit Price (${inv.currency})`, `Line Total (${inv.currency})`]
  const rows = inv.lineItems.map((item, index) => [
    index + 1,
    item.description,
    item.quantity,
    item.unitPrice,
    item.lineTotal,
  ])

  exportToExcel({
    fileName: `Invoice_${inv.invoiceNumber}_${inv.customerName.replace(/\s+/g, "_")}.xls`,
    title: inv.company?.name || "Habtom Kebede Veterinary Drug Import",
    subtitle: `SALES INVOICE - ${inv.invoiceNumber}`,
    metadata: [
      { label: "Invoice Number", value: inv.invoiceNumber },
      { label: "Customer Name", value: inv.customerName },
      { label: "Issue Date", value: inv.issueDate },
      { label: "Payment Status", value: isPaid ? "Paid" : "Unpaid" },
      { label: "Total Amount", value: `${inv.currency} ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      { label: "Amount Paid", value: `${inv.currency} ${inv.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      { label: "Balance", value: `${inv.currency} ${inv.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    ],
    headers,
    rows,
  })
}

export interface PrintWH1ReceivingVoucherOptions {
  voucherNo: string
  date: string
  customer: string
  plateNumber: string
  warehouseName?: string
  items: Array<{
    itemNo: number
    description: string
    unit: string
    quantity: number
    unitPrice: number
    totalPrice: number
    remarks?: string
  }>
  notes?: string
}

/**
 * Print WH1 Goods Receiving Voucher (English Format)
 */
export function printWH1ReceivingVoucherDocument(v: PrintWH1ReceivingVoucherOptions): void {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    alert("Please allow pop-ups in your browser to print the Goods Receiving Voucher.")
    return
  }

  const logoUrl = typeof window !== "undefined" && window.location?.origin ? `${window.location.origin}/hkc_logo.png` : "/hkc_logo.png"
  const totalQuantity = v.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)
  const totalValue = v.items.reduce((sum, i) => sum + Number(i.totalPrice || 0), 0)

  const itemsRowsHtml = v.items.map((item) => `
    <tr>
      <td style="text-align: center; font-weight: 600;">${item.itemNo}</td>
      <td style="font-weight: 700; color: #0f172a;">${item.description}</td>
      <td style="text-align: center; text-transform: uppercase; font-weight: 600;">${item.unit}</td>
      <td style="text-align: right; font-family: monospace; font-weight: 700;">${item.quantity.toLocaleString()}</td>
      <td style="text-align: right; font-family: monospace;">${item.unitPrice > 0 ? item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
      <td style="text-align: right; font-family: monospace; font-weight: 700;">${item.totalPrice > 0 ? item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
      <td style="color: #64748b; font-size: 11px;">${item.remarks || "—"}</td>
    </tr>
  `).join("")

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receiving Voucher - ${v.voucherNo || "VOUCHER"}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; line-height: 1.4; padding: 10px; font-size: 12px; }
    .voucher-card { max-width: 800px; margin: 0 auto; border: 1.5px solid #0f172a; padding: 24px; border-radius: 8px; }
    .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .logo-img { height: 52px; width: auto; object-fit: contain; }
    .company-title { font-size: 20px; font-weight: 950; letter-spacing: -0.5px; color: #0f172a; text-transform: uppercase; }
    .company-sub { font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; }
    .voucher-badge { text-align: right; }
    .voucher-title { font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .voucher-no { font-size: 18px; font-weight: 900; font-family: monospace; color: #b91c1c; margin-top: 2px; }
    
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .meta-value { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 1px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #0f172a; color: #ffffff; font-weight: 800; text-transform: uppercase; font-size: 10px; padding: 8px 10px; letter-spacing: 0.5px; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    tr:last-child td { border-bottom: 2px solid #0f172a; }

    .totals-area { display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 10px 16px; border-radius: 6px; margin-bottom: 16px; font-weight: 800; font-size: 13px; }
  </style>
</head>
<body>
  <div class="voucher-card">
    <div class="header-row">
      <div class="header-left">
        <img src="${logoUrl}" alt="HKC Logo" class="logo-img" />
        <div>
          <div class="company-title">Habtom Kebede Import & Export</div>
          <div class="company-sub">Commodity Storage & Processing Warehouse</div>
        </div>
      </div>
      <div class="voucher-badge">
        <div class="voucher-title">Goods Receiving Voucher</div>
        <div class="voucher-no">No. ${v.voucherNo || "—"}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Customer</span>
        <span class="meta-value">${v.customer || "—"}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Plate Number</span>
        <span class="meta-value" style="font-family: monospace;">${v.plateNumber || "—"}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">#</th>
          <th>Item Description</th>
          <th style="width: 80px; text-align: center;">UoM</th>
          <th style="width: 100px; text-align: right;">Quantity</th>
          <th style="width: 110px; text-align: right;">Unit Price (ETB)</th>
          <th style="width: 120px; text-align: right;">Total Price (ETB)</th>
          <th style="width: 120px;">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div class="totals-area">
      <div>Total Items Received: <span style="color: #047857;">${totalQuantity.toLocaleString()}</span></div>
      <div>Total Value: <span style="color: #0f172a; font-family: monospace;">${totalValue > 0 ? `ETB ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}</span></div>
    </div>

    ${v.notes ? `<div style="font-size: 11px; color: #475569; margin-top: 12px;"><strong>Notes:</strong> ${v.notes}</div>` : ""}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

/**
 * Export WH1 Goods Receiving Voucher to Excel
 */
export function exportWH1ReceivingVoucherExcel(v: PrintWH1ReceivingVoucherOptions): void {
  const headers = ["#", "Item Description", "UoM", "Quantity", "Unit Price (ETB)", "Total Price (ETB)", "Remarks"]
  const rows = v.items.map((item) => [
    item.itemNo,
    item.description,
    item.unit,
    item.quantity,
    item.unitPrice > 0 ? item.unitPrice : "—",
    item.totalPrice > 0 ? item.totalPrice : "—",
    item.remarks || "—",
  ])

  exportToExcel({
    fileName: `Receiving_Voucher_${v.voucherNo || "WH1"}_${(v.customer || "Commodity").replace(/\s+/g, "_")}.xls`,
    title: "Habtom Kebede Import & Export",
    subtitle: `GOODS RECEIVING VOUCHER - No. ${v.voucherNo || "—"}`,
    metadata: [
      { label: "Voucher Number", value: v.voucherNo || "—" },
      { label: "Customer", value: v.customer || "—" },
      { label: "Plate Number", value: v.plateNumber || "—" },
    ],
    headers,
    rows,
  })
}

