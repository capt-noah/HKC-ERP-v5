import ExcelJS from "exceljs"
import type { Product, Customer } from "./erpStore"
import type { SalesIssue } from "./salesIssuesApi"
import { isExportWarehouse } from "./warehouses"

export interface VeterinaryExportOptions {
  fiscalPeriod?: string // e.g. "JULY 8, 2024 TO JULY 7, 2025" or "JULY, 2025 TO JULY 2026 YEAR"
  startDate?: string
  endDate?: string
  companyName?: string
}

/**
 * Sanitize Excel worksheet name (max 31 chars, no invalid characters \ / ? * [ ])
 */
export function sanitizeSheetName(name: string): string {
  const cleaned = (name || "Product").replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim()
  return cleaned.slice(0, 31) || "Product"
}

/**
 * Format date nicely (DD/MM/YYYY or original DD/MM/YYYY)
 */
function formatDateLabel(val?: string | null): string {
  if (!val || typeof val !== "string") return "—"
  const clean = val.includes("T") ? val.split("T")[0] : val.split(" ")[0]
  const parts = clean.split("-")
  if (parts.length === 3 && parts[0].length === 4 && parts[1] && parts[2]) {
    // YYYY-MM-DD -> DD/MM/YYYY
    const d = parts[2].padStart(2, "0")
    const m = parts[1].padStart(2, "0")
    const y = parts[0]
    return `${d}/${m}/${y}`
  }
  return clean || "—"
}

/**
 * Determine packaging factor (pcs per carton/box) for a product
 */
export function getProductPackagingFactor(prod: Product): number {
  if (prod.quantityPerPack && prod.quantityPerPack > 0) {
    return prod.quantityPerPack
  }
  const explicitCartons = Number(prod.numberOfCartons || (prod as any).number_of_cartons || 0)
  const totalQty = Number(prod.totalQuantity || prod.quantity || 0)
  if (explicitCartons > 0 && totalQty > 0) {
    const factor = Math.round(totalQty / explicitCartons)
    if (factor > 0) return factor
  }
  // Standard defaults by product name heuristic if known
  const lowerName = (prod.name || "").toLowerCase()
  if (lowerName.includes("ashiver inj") || lowerName.includes("ashiver 1%")) return 120
  if (lowerName.includes("fasinash")) return 330
  if (lowerName.includes("ashitetra 2000")) return 60
  if (lowerName.includes("flukazash")) return 50
  if (lowerName.includes("astrisul") || lowerName.includes("ashitraz")) return 12
  if (lowerName.includes("diminashish")) return 100
  if (lowerName.includes("ashialben 2500") || lowerName.includes("albentong 2500")) return 50
  return 1
}

/**
 * Filter products to strictly Import Warehouse (Veterinary/Pharma) items
 */
export function getImportWarehouseProducts(products: Product[]): Product[] {
  return (products || []).filter((p) => !isExportWarehouse(p.warehouse || ""))
}

// Reusable styling helpers for ExcelJS
const NAVY_COLOR = "FF1F4E78"
const SUB_NAVY_COLOR = "FF2B579A"
const LIGHT_BLUE_COLOR = "FFD9E1F2"
const SOFT_GRAY_COLOR = "FFF2F5F9"
const BORDER_GRAY = "FFD4D4D8"
const BORDER_DARK = "FF000000"

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_GRAY } },
  left: { style: "thin", color: { argb: BORDER_GRAY } },
  bottom: { style: "thin", color: { argb: BORDER_GRAY } },
  right: { style: "thin", color: { argb: BORDER_GRAY } },
}

const headerBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_DARK } },
  left: { style: "thin", color: { argb: BORDER_DARK } },
  bottom: { style: "thin", color: { argb: BORDER_DARK } },
  right: { style: "thin", color: { argb: BORDER_DARK } },
}

/**
 * Build Sheet 1: "Products imported per annum"
 * Exact 1:1 format matching the official regulatory template
 */
export function buildAnnualImportedWorksheet(
  workbook: ExcelJS.Workbook,
  products: Product[],
  options: VeterinaryExportOptions = {}
): ExcelJS.Worksheet {
  const importProds = getImportWarehouseProducts(products)
  const currentYear = new Date().getFullYear()
  const periodLabel = options.fiscalPeriod || `JULY 8, ${currentYear - 1} TO JULY 7, ${currentYear}`
  const subPeriodLabel = `For The Period of July, ${currentYear - 1} to July, ${currentYear}`

  const ws = workbook.addWorksheet("Products imported per annum", {
    views: [{ showGridLines: true }],
  })

  // 8 Columns (A to H) matching exact reference file
  ws.columns = [
    { key: "sn", width: 8 },
    { key: "name", width: 32 },
    { key: "date", width: 16 },
    { key: "ref", width: 26 },
    { key: "batch", width: 18 },
    { key: "unit", width: 12 },
    { key: "qty", width: 16 },
    { key: "remark", width: 20 },
  ]

  // Row 1: Merged A1:H1 Banner Header
  ws.mergeCells("A1:H1")
  const row1 = ws.getRow(1)
  row1.height = 36
  const cellA1 = ws.getCell("A1")
  cellA1.value = `ANNUAL IMPORTED Veterinary Products\nfor THE PERIOD of ${periodLabel.toUpperCase()}`
  cellA1.font = { name: "Times New Roman", size: 12, bold: true, color: { argb: "FFFFFFFF" } }
  cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellA1.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  cellA1.border = headerBorder

  // Row 2: Merged B2:H2 Section Header
  ws.mergeCells("B2:H2")
  const row2 = ws.getRow(2)
  row2.height = 24
  const cellB2 = ws.getCell("B2")
  cellB2.value = "Annual Imported Veterinary Products "
  cellB2.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellB2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellB2.alignment = { horizontal: "center", vertical: "middle" }
  cellB2.border = headerBorder

  // Row 3: Merged B3:H3 Sub-Period Header
  ws.mergeCells("B3:H3")
  const row3 = ws.getRow(3)
  row3.height = 22
  const cellB3 = ws.getCell("B3")
  cellB3.value = `For The Period of ${subPeriodLabel}`
  cellB3.font = { name: "Times New Roman", size: 10, bold: true, color: { argb: NAVY_COLOR } }
  cellB3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE_COLOR } }
  cellB3.alignment = { horizontal: "center", vertical: "middle" }
  cellB3.border = headerBorder

  // Merged A2:A4 for "S.N" Header
  ws.mergeCells("A2:A4")
  const cellA2 = ws.getCell("A2")
  cellA2.value = "S.N"
  cellA2.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellA2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellA2.alignment = { horizontal: "center", vertical: "middle" }
  cellA2.border = headerBorder

  // Row 4: Column Sub-Headers
  const row4 = ws.getRow(4)
  row4.height = 24
  const subHeaders = [
    "",
    "Product name ",
    "Date of import ",
    "Referance number/LPCO ",
    "Bach number",
    "Unit",
    "Quantity",
    "Remark",
  ]

  subHeaders.forEach((sh, idx) => {
    if (idx === 0) return // A4 is covered by A2:A4
    const cell = row4.getCell(idx + 1)
    cell.value = sh
    cell.font = { name: "Times New Roman", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = headerBorder
  })

  let snCounter = 1
  let currentRowNum = 5

  importProds.forEach((prod) => {
    const batches = Array.isArray(prod.batches) && prod.batches.length > 0
      ? prod.batches
      : [{
          batchNo: prod.batch || "Standard Lot",
          qty: prod.totalQuantity || prod.quantity || 0,
          mfgDate: prod.manufacturingDate || prod.entryDate || "",
          expiry: prod.expiry || "",
          voucherNo: prod.voucherNo || "",
        }]

    batches.forEach((b: any, bIdx: number) => {
      const isFirstBatch = bIdx === 0
      const batchQty = Number(b.qty || 0)
      const refNo = b.voucherNo || prod.voucherNo || "VDFACA/25/948/PI1"
      const mfg = b.mfgDate || prod.manufacturingDate || prod.entryDate || ""

      const row = ws.getRow(currentRowNum)
      row.height = 20

      // Col 1: S.N
      const c1 = row.getCell(1)
      c1.value = isFirstBatch ? snCounter : ""
      c1.alignment = { horizontal: "center", vertical: "middle" }
      c1.border = thinBorder

      // Col 2: Product name
      const c2 = row.getCell(2)
      c2.value = prod.name
      c2.alignment = { horizontal: "left", vertical: "middle" }
      c2.border = thinBorder

      // Col 3: Date of import
      const c3 = row.getCell(3)
      c3.value = formatDateLabel(mfg || prod.createdDate)
      c3.alignment = { horizontal: "center", vertical: "middle" }
      c3.border = thinBorder

      // Col 4: Reference No
      const c4 = row.getCell(4)
      c4.value = refNo
      c4.alignment = { horizontal: "center", vertical: "middle" }
      c4.border = thinBorder

      // Col 5: Batch number
      const c5 = row.getCell(5)
      c5.value = b.batchNo || prod.batch || "—"
      c5.alignment = { horizontal: "center", vertical: "middle" }
      c5.border = thinBorder

      // Col 6: Unit
      const c6 = row.getCell(6)
      c6.value = prod.unit || "Box"
      c6.alignment = { horizontal: "center", vertical: "middle" }
      c6.border = thinBorder

      // Col 7: Quantity
      const c7 = row.getCell(7)
      c7.value = batchQty
      c7.numFmt = "#,##0"
      c7.alignment = { horizontal: "right", vertical: "middle" }
      c7.border = thinBorder

      // Col 8: Remark
      const c8 = row.getCell(8)
      c8.value = prod.description !== prod.name ? prod.description || "" : ""
      c8.alignment = { horizontal: "left", vertical: "middle" }
      c8.border = thinBorder

      currentRowNum++
    })

    snCounter++
  })

  return ws
}

/**
 * Movement Entry type for Ledger generation
 */
interface LedgerMovementEntry {
  type: "IN" | "OUT"
  date: string
  batchNo: string
  mfgDate?: string
  expiryDate?: string
  unit: string
  qtyReceived: number
  customerName?: string
  address?: string
  phone?: string
  tin?: string
  invoiceNo?: string
  qtySold: number
  remark?: string
}

/**
 * Build Single Product Movement & Sales Ledger Worksheet
 * Exact 1:1 format matching the official regulatory template
 */
export function buildProductLedgerWorksheet(
  workbook: ExcelJS.Workbook,
  product: Product,
  salesIssues: SalesIssue[],
  customers: Customer[],
  options: VeterinaryExportOptions = {},
  sheetNameOverride?: string
): ExcelJS.Worksheet {
  const currentYear = new Date().getFullYear()
  const periodLabel = options.fiscalPeriod || `JULY, ${currentYear - 1} TO JULY ${currentYear} YEAR`
  const sheetTitle = sanitizeSheetName(sheetNameOverride || product.name)

  const ws = workbook.addWorksheet(sheetTitle, {
    views: [{ showGridLines: true }],
  })

  // 18 Columns (A to R) matching standard Ethiopian regulatory dual-sided ledger
  ws.columns = [
    { key: "sn", width: 6 },
    { key: "inDate", width: 14 },
    { key: "inBatch", width: 16 },
    { key: "inMfg", width: 13 },
    { key: "inExp", width: 13 },
    { key: "inUnit", width: 10 },
    { key: "inQty", width: 16 },
    { key: "outCust", width: 28 },
    { key: "outAddr", width: 20 },
    { key: "outPhone", width: 15 },
    { key: "outTin", width: 16 },
    { key: "outDate", width: 14 },
    { key: "outBatch", width: 16 },
    { key: "outInv", width: 16 },
    { key: "outUnit", width: 10 },
    { key: "outQty", width: 16 },
    { key: "balance", width: 16 },
    { key: "remark", width: 14 },
  ]

  // Assemble Stock In Batches
  const inEntries: LedgerMovementEntry[] = []
  const batches = Array.isArray(product.batches) && product.batches.length > 0
    ? product.batches
    : [{
        batchNo: product.batch || "Standard Lot",
        qty: product.totalQuantity || product.quantity || 0,
        mfgDate: product.manufacturingDate || product.entryDate || "",
        expiry: product.expiry || "",
      }]

  batches.forEach((b: any) => {
    inEntries.push({
      type: "IN",
      date: b.mfgDate || product.entryDate || product.createdDate || "",
      batchNo: b.batchNo || product.batch || "—",
      mfgDate: b.mfgDate || product.manufacturingDate || "",
      expiryDate: b.expiry || product.expiry || "",
      unit: product.unit || "Box",
      qtyReceived: Number(b.qty || 0),
      qtySold: 0,
      remark: "",
    })
  })

  // Assemble Stock Out Sales
  const outEntries: LedgerMovementEntry[] = []
  const matchingSales = (salesIssues || []).filter((si) => {
    if (!si.items || si.items.length === 0) return false
    return si.items.some(
      (item) =>
        item.item_id === product.id ||
        (item.item_name && item.item_name.trim().toLowerCase() === product.name.trim().toLowerCase())
    )
  })

  const customerMap = new Map<string, Customer>()
  customers.forEach((c) => {
    if (c.id) customerMap.set(c.id.toLowerCase(), c)
    if (c.name) customerMap.set(c.name.trim().toLowerCase(), c)
  })

  matchingSales.forEach((si) => {
    const cust = customerMap.get((si.customer_id || "").toLowerCase()) ||
                 customerMap.get((si.customer_name || "").trim().toLowerCase())

    const matchingItems = (si.items || []).filter(
      (item) =>
        item.item_id === product.id ||
        (item.item_name && item.item_name.trim().toLowerCase() === product.name.trim().toLowerCase())
    )

    matchingItems.forEach((it) => {
      outEntries.push({
        type: "OUT",
        date: si.sale_date || "",
        batchNo: it.batch_no || product.batch || "",
        unit: it.packaging_unit || product.unit || "Box",
        qtyReceived: 0,
        customerName: si.customer_name || "Walk-in Customer",
        address: cust?.address || cust?.region || cust?.country || "",
        phone: cust?.phone || "",
        tin: cust?.tin || "",
        invoiceNo: si.fs_no || si.reference_no || "",
        qtySold: Number(it.quantity || 0),
        remark: "",
      })
    })
  })

  // Row 1: Header Banner (A1:R1 Merged)
  ws.mergeCells("A1:R1")
  const row1 = ws.getRow(1)
  row1.height = 26
  const cellA1 = ws.getCell("A1")
  cellA1.value = `ANNUALY SALES OF IMPORTED VETERINARY DRUGS BY HABTOM KEBEDE FROM  ${periodLabel.toUpperCase()}`
  cellA1.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellA1.alignment = { horizontal: "center", vertical: "middle" }
  cellA1.border = headerBorder

  // Row 2: Product Name (A2:R2 Merged)
  ws.mergeCells("A2:R2")
  const row2 = ws.getRow(2)
  row2.height = 24
  const cellA2 = ws.getCell("A2")
  cellA2.value = `Product name:${product.name}`
  cellA2.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellA2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellA2.alignment = { horizontal: "left", vertical: "middle" }
  cellA2.border = headerBorder

  // Row 3 & 4: Dual-Level Table Headers
  const row3 = ws.getRow(3)
  row3.height = 22

  // A3:A4 Merged for "S.N"
  ws.mergeCells("A3:A4")
  const cellA3 = ws.getCell("A3")
  cellA3.value = "S.N"
  cellA3.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellA3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellA3.alignment = { horizontal: "center", vertical: "middle" }
  cellA3.border = headerBorder

  // B3:G3 Merged for "Stock In"
  ws.mergeCells("B3:G3")
  const cellB3 = ws.getCell("B3")
  cellB3.value = "Stock In"
  cellB3.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellB3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellB3.alignment = { horizontal: "center", vertical: "middle" }
  cellB3.border = headerBorder
  for (let c = 3; c <= 7; c++) row3.getCell(c).border = headerBorder

  // H3:P3 Merged for "Stock Out"
  ws.mergeCells("H3:P3")
  const cellH3 = ws.getCell("H3")
  cellH3.value = "Stock Out"
  cellH3.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellH3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellH3.alignment = { horizontal: "center", vertical: "middle" }
  cellH3.border = headerBorder
  for (let c = 9; c <= 16; c++) row3.getCell(c).border = headerBorder

  // Q3:Q4 Merged for "Total Balance"
  ws.mergeCells("Q3:Q4")
  const cellQ3 = ws.getCell("Q3")
  cellQ3.value = "Total Balance"
  cellQ3.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellQ3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellQ3.alignment = { horizontal: "center", vertical: "middle" }
  cellQ3.border = headerBorder

  // R3:R4 Merged for "Remark"
  ws.mergeCells("R3:R4")
  const cellR3 = ws.getCell("R3")
  cellR3.value = "Remark"
  cellR3.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
  cellR3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_COLOR } }
  cellR3.alignment = { horizontal: "center", vertical: "middle" }
  cellR3.border = headerBorder

  // Row 4: Column Sub-Headers
  const row4 = ws.getRow(4)
  row4.height = 24
  const subHeaders = [
    "",
    "Date of receipt",
    "Bach Number",
    "Man. date",
    "Expire date",
    "Unit",
    "Quantity Received",
    "Customer name",
    "Address",
    "Phone Number",
    "TIN  No.",
    "Date of sales",
    "Bach Number",
    "Invoice No.",
    "Unit",
    "Quantity sold",
    "",
    "",
  ]

  subHeaders.forEach((sh, idx) => {
    if (idx === 0 || idx === 16 || idx === 17) return // Covered by 2-row merges
    const cell = row4.getCell(idx + 1)
    cell.value = sh
    cell.font = { name: "Times New Roman", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUB_NAVY_COLOR } }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = headerBorder
  })

  let runningBalance = 0
  let sn = 1
  let currentRowNum = 5

  // 1. Output Stock In Lines First (Batches)
  inEntries.forEach((entry, idx) => {
    runningBalance += entry.qtyReceived

    const row = ws.getRow(currentRowNum)
    row.height = 20

    // Col 1: S.N
    const c1 = row.getCell(1)
    c1.value = sn
    c1.alignment = { horizontal: "center", vertical: "middle" }
    c1.border = thinBorder

    // Col 2: Date of receipt
    const c2 = row.getCell(2)
    c2.value = formatDateLabel(entry.date)
    c2.alignment = { horizontal: "center", vertical: "middle" }
    c2.border = thinBorder

    // Col 3: Batch Number
    const c3 = row.getCell(3)
    c3.value = entry.batchNo
    c3.alignment = { horizontal: "center", vertical: "middle" }
    c3.border = thinBorder

    // Col 4: MFG Date
    const c4 = row.getCell(4)
    c4.value = formatDateLabel(entry.mfgDate)
    c4.alignment = { horizontal: "center", vertical: "middle" }
    c4.border = thinBorder

    // Col 5: EXP Date
    const c5 = row.getCell(5)
    c5.value = formatDateLabel(entry.expiryDate)
    c5.alignment = { horizontal: "center", vertical: "middle" }
    c5.border = thinBorder

    // Col 6: Unit
    const c6 = row.getCell(6)
    c6.value = entry.unit
    c6.alignment = { horizontal: "center", vertical: "middle" }
    c6.border = thinBorder

    // Col 7: Quantity Received
    const c7 = row.getCell(7)
    c7.value = entry.qtyReceived
    c7.numFmt = "#,##0"
    c7.alignment = { horizontal: "right", vertical: "middle" }
    c7.border = thinBorder

    // Cols 8..16: Empty Stock Out columns
    for (let c = 8; c <= 16; c++) {
      const cell = row.getCell(c)
      cell.value = null
      cell.border = thinBorder
    }

    // Col 17: Cumulative Total Balance
    const c17 = row.getCell(17)
    c17.value = idx === 0
      ? { formula: "G5-P5", result: runningBalance }
      : { formula: `Q${currentRowNum - 1}+G${currentRowNum}`, result: runningBalance }
    c17.numFmt = "#,##0"
    c17.font = { bold: true }
    c17.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT_GRAY_COLOR } }
    c17.alignment = { horizontal: "right", vertical: "middle" }
    c17.border = headerBorder

    // Col 18: Remark
    const c18 = row.getCell(18)
    c18.value = entry.remark || ""
    c18.alignment = { horizontal: "left", vertical: "middle" }
    c18.border = thinBorder

    sn++
    currentRowNum++
  })

  // 2. Output Stock Out Lines (Sales Issued)
  outEntries.forEach((entry) => {
    runningBalance -= entry.qtySold

    const row = ws.getRow(currentRowNum)
    row.height = 20

    // Col 1: S.N
    const c1 = row.getCell(1)
    c1.value = sn
    c1.alignment = { horizontal: "center", vertical: "middle" }
    c1.border = thinBorder

    // Cols 2..7: Empty Stock In columns
    for (let c = 2; c <= 7; c++) {
      const cell = row.getCell(c)
      cell.value = null
      cell.border = thinBorder
    }

    // Col 8: Customer name
    const c8 = row.getCell(8)
    c8.value = entry.customerName
    c8.alignment = { horizontal: "left", vertical: "middle" }
    c8.border = thinBorder

    // Col 9: Address
    const c9 = row.getCell(9)
    c9.value = entry.address || ""
    c9.alignment = { horizontal: "left", vertical: "middle" }
    c9.border = thinBorder

    // Col 10: Phone Number
    const c10 = row.getCell(10)
    c10.value = entry.phone ? String(entry.phone) : ""
    c10.alignment = { horizontal: "center", vertical: "middle" }
    c10.border = thinBorder

    // Col 11: TIN No (Preserved with leading zeroes as string)
    const c11 = row.getCell(11)
    c11.value = entry.tin ? String(entry.tin) : ""
    c11.alignment = { horizontal: "center", vertical: "middle" }
    c11.border = thinBorder

    // Col 12: Date of sales
    const c12 = row.getCell(12)
    c12.value = formatDateLabel(entry.date)
    c12.alignment = { horizontal: "center", vertical: "middle" }
    c12.border = thinBorder

    // Col 13: Batch Number
    const c13 = row.getCell(13)
    c13.value = entry.batchNo || ""
    c13.alignment = { horizontal: "center", vertical: "middle" }
    c13.border = thinBorder

    // Col 14: Invoice No
    const c14 = row.getCell(14)
    c14.value = entry.invoiceNo || ""
    c14.alignment = { horizontal: "center", vertical: "middle" }
    c14.border = thinBorder

    // Col 15: Unit
    const c15 = row.getCell(15)
    c15.value = entry.unit
    c15.alignment = { horizontal: "center", vertical: "middle" }
    c15.border = thinBorder

    // Col 16: Quantity sold
    const c16 = row.getCell(16)
    c16.value = entry.qtySold
    c16.numFmt = "#,##0"
    c16.alignment = { horizontal: "right", vertical: "middle" }
    c16.border = thinBorder

    // Col 17: Cumulative Total Balance (Formula)
    const c17 = row.getCell(17)
    c17.value = { formula: `Q${currentRowNum - 1}-P${currentRowNum}`, result: runningBalance }
    c17.numFmt = "#,##0"
    c17.font = { bold: true }
    c17.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT_GRAY_COLOR } }
    c17.alignment = { horizontal: "right", vertical: "middle" }
    c17.border = headerBorder

    // Col 18: Remark
    const c18 = row.getCell(18)
    c18.value = entry.remark || ""
    c18.alignment = { horizontal: "left", vertical: "middle" }
    c18.border = thinBorder

    sn++
    currentRowNum++
  })

  return ws
}

/**
 * Trigger browser file download from ExcelJS Workbook (.xlsx)
 */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const cleanFileName = fileName.endsWith(".xlsx")
    ? fileName
    : `${fileName.replace(/\.xls$/, "")}.xlsx`

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = cleanFileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export Single Product Movement & Sales Ledger (.xlsx)
 */
export async function exportSingleProductSalesLedger(
  product: Product,
  salesIssues: SalesIssue[],
  customers: Customer[],
  options: VeterinaryExportOptions = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HKC Trading"
  workbook.lastModifiedBy = "HKC ERP"
  workbook.created = new Date()

  buildProductLedgerWorksheet(workbook, product, salesIssues, customers, options)

  const currentYear = new Date().getFullYear()
  const cleanName = product.name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
  const fileName = `Sales_Ledger_${cleanName}_${currentYear - 1}_${currentYear}.xlsx`
  await downloadWorkbook(workbook, fileName)
}

/**
 * Export Combined Multi-Tab Comprehensive Workbook (.xlsx):
 * Tab 1: Products imported per annum (Official Annual Imported Summary)
 * Tabs 2..N: Individual Product Movement & Sales Ledger for each active veterinary product
 * (No dashboard page included)
 */
export async function exportComprehensiveVeterinaryWorkbook(
  products: Product[],
  salesIssues: SalesIssue[],
  customers: Customer[],
  options: VeterinaryExportOptions = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "HKC Trading"
  workbook.lastModifiedBy = "HKC ERP"
  workbook.created = new Date()

  const importProds = getImportWarehouseProducts(products)

  // 1. Tab 1: Products imported per annum (Annual Imported Summary)
  buildAnnualImportedWorksheet(workbook, importProds, options)

  // 2. Tabs 2..N: Product Ledger Worksheets
  const usedSheetNames = new Set<string>(["products imported per annum", "annual imported veterinary products"])
  importProds.forEach((p) => {
    const rawName = sanitizeSheetName(p.name)
    let uniqueName = rawName
    let counter = 2
    while (usedSheetNames.has(uniqueName.toLowerCase())) {
      const base = rawName.slice(0, 26).trim()
      uniqueName = `${base} (${counter})`
      counter++
    }
    usedSheetNames.add(uniqueName.toLowerCase())
    buildProductLedgerWorksheet(workbook, p, salesIssues, customers, options, uniqueName)
  })

  const currentYear = new Date().getFullYear()
  const fileName = `HKC_Veterinary_Regulatory_Distribution_${currentYear - 1}_${currentYear}.xlsx`
  await downloadWorkbook(workbook, fileName)
}
