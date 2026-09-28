import { pool } from "../db/client.js"

// Authentic batch metadata matching each pharma product
const PHARMA_BATCHES_DATA = [
  {
    productId: "P-1788854908608",
    batchNo: "ALT26025",
    mfgDate: "2026-01-01",
    expiryDate: "2029-12-01",
    qty: 3500.0,
  },
  {
    productId: "P-1788857345432",
    batchNo: "251032",
    mfgDate: "2025-10-01",
    expiryDate: "2028-10-01",
    qty: 2320.0,
  },
  {
    productId: "P-1788857446192",
    batchNo: "260512",
    mfgDate: "2026-05-01",
    expiryDate: "2029-05-01",
    qty: 21200.0,
  },
  {
    productId: "P-1788858054417",
    batchNo: "251036",
    mfgDate: "2025-10-01",
    expiryDate: "2028-10-01",
    qty: 6560.0,
  },
  {
    productId: "P-1788858377681",
    batchNo: "251034",
    mfgDate: "2025-10-01",
    expiryDate: "2028-10-01",
    qty: 2610.0,
  },
  {
    productId: "P-1788858567873",
    batchNo: "251035",
    mfgDate: "2025-10-01",
    expiryDate: "2028-10-01",
    qty: 2310.0,
  },
  {
    productId: "P-1788859087961",
    batchNo: "AA12423",
    mfgDate: "2024-12-01",
    expiryDate: "2027-11-01",
    qty: 240.0,
  },
  {
    productId: "P-1788859302545",
    batchNo: "ALT25356",
    mfgDate: "2025-06-01",
    expiryDate: "2029-05-01",
    qty: 400.0,
  },
  {
    productId: "P-1788859513561",
    batchNo: "ALI25077",
    mfgDate: "2025-04-01",
    expiryDate: "2027-01-01",
    qty: 600.0,
  },
  {
    productId: "P-1788859675153",
    batchNo: "D260392U",
    mfgDate: "2026-03-01",
    expiryDate: "2029-03-01",
    qty: 3980.0,
  },
  {
    productId: "P-1788860002713",
    batchNo: "ALT26022",
    mfgDate: "2026-01-01",
    expiryDate: "2029-12-01",
    qty: 240.0,
  },
  {
    productId: "P-1788860199689",
    batchNo: "ALL260448",
    mfgDate: "2026-04-01",
    expiryDate: "2029-03-01",
    qty: 1100.0,
  },
  {
    productId: "P-1788860444633",
    batchNo: "ALG26111",
    mfgDate: "2026-03-01",
    expiryDate: "2029-02-01",
    qty: 2772.0,
  },
  {
    productId: "P-1788860782033",
    batchNo: "ALT25393",
    mfgDate: "2025-07-01",
    expiryDate: "2029-06-01",
    qty: 660.0,
  },
  {
    productId: "P-1788861003705",
    batchNo: "ALG26109",
    mfgDate: "2026-03-01",
    expiryDate: "2029-02-01",
    qty: 1512.0,
  },
  {
    productId: "P-1788919771878",
    batchNo: "ALL26041",
    mfgDate: "2026-04-01",
    expiryDate: "2029-03-01",
    qty: 1500.0,
  },
  {
    productId: "P-1788920432213",
    batchNo: "ALI26027",
    mfgDate: "2026-04-01",
    expiryDate: "2029-03-01",
    qty: 400.0,
  },
  {
    productId: "P-1788920639771",
    batchNo: "260504",
    mfgDate: "2026-05-01",
    expiryDate: "2029-05-01",
    qty: 60000.0,
  },
  {
    productId: "P-1788920860228",
    batchNo: "260516",
    mfgDate: "2026-05-01",
    expiryDate: "2029-05-01",
    qty: 7500.0,
  },
  {
    productId: "P-1788921168285",
    batchNo: "260509",
    mfgDate: "2026-05-01",
    expiryDate: "2029-05-01",
    qty: 105500.0,
  },
  {
    productId: "P-1788921387242",
    batchNo: "260511",
    mfgDate: "2026-05-01",
    expiryDate: "2029-05-01",
    qty: 40080.0,
  },
  {
    productId: "P-1788921559264",
    batchNo: "260514",
    mfgDate: "2026-05-01",
    expiryDate: "2031-05-01",
    qty: 93000.0,
  },
]

async function seedInitialChildBatches() {
  console.log("================================================================================")
  console.log("       SEEDING INITIAL CHILD BATCHES & LINKING PARENT INVENTORY RECORDS         ")
  console.log("================================================================================\n")

  const conn = await pool.getConnection()
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")

    // 1. Fetch current pharma products
    const [pharmaProducts] = await conn.query("SELECT * FROM pharma_products")
    console.log(`Found ${pharmaProducts.length} pharma products in catalog.`)

    // Clear any residual child batches or movements
    await conn.query("TRUNCATE TABLE pharma_product_batches")
    await conn.query("TRUNCATE TABLE stock_movements")
    await conn.query("TRUNCATE TABLE export_warehouse_movements")

    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ")
    const todayDate = new Date().toISOString().slice(0, 10)

    console.log("\n1. Populating pharma_product_batches, stock_movements, and updating pharma_products...")

    for (const prod of pharmaProducts) {
      const match = PHARMA_BATCHES_DATA.find((b) => b.productId === prod.id)
      const batchNo = match?.batchNo || `BAT-${prod.sku.replace(/[^A-Za-z0-9]/g, "")}`
      const mfgDate = match?.mfgDate || "2026-01-01"
      const expiryDate = match?.expiryDate || "2029-01-01"
      const quantity = match?.qty ?? 500.0
      const unitCost = Number(prod.unit_cost || 0)
      const sellingPrice = Number(prod.selling_price || unitCost || 0)
      const totalStockVal = Math.round(quantity * unitCost * 100) / 100
      const cartons = prod.quantity_per_pack > 0 ? Math.floor(quantity / prod.quantity_per_pack) : 0
      const batchId = `batch-${prod.id}-${batchNo}`
      const movementId = `SM-INIT-${prod.id}`

      // A. Insert child batch record
      await conn.query(
        `INSERT INTO pharma_product_batches (
          id, product_id, warehouse_id, batch_no, mfg_date, expiry_date,
          quantity, unit_cost, qa_status, location, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          prod.id,
          prod.warehouse_id || "WH2",
          batchNo,
          mfgDate,
          expiryDate,
          quantity,
          unitCost,
          "Released",
          prod.shelf_number || "Shelf A-1",
          `Initial batch for ${prod.name}`,
          nowStr,
          nowStr,
        ]
      )

      // B. Insert stock movement record (bin card entry)
      await conn.query(
        `INSERT INTO stock_movements (
          id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price, selling_price,
          balance_after, batch_no, expiry_date, mfg_date, reference_type, reference_id,
          notes, party, performed_by, movement_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementId,
          prod.id,
          prod.warehouse_id || "WH2",
          "RECEIPT",
          quantity,
          unitCost,
          unitCost,
          sellingPrice,
          quantity,
          batchNo,
          expiryDate,
          mfgDate,
          "GRV_ENTRY",
          "INIT-001",
          "Initial Stock Registration",
          "Initial Stock Deposit",
          "System Admin",
          todayDate,
          nowStr,
          nowStr,
        ]
      )

      // C. Update parent product record in lockstep
      await conn.query(
        `UPDATE pharma_products SET
          quantity = ?,
          quantity_sold = 0.00,
          total_quantity = ?,
          number_of_cartons = ?,
          total_stock_value = ?,
          batch_no = ?,
          mfg_date = ?,
          expiry_date = ?,
          status = 'In Stock',
          updated_at = ?
        WHERE id = ?`,
        [
          quantity,
          quantity,
          cartons,
          totalStockVal,
          batchNo,
          mfgDate,
          expiryDate,
          nowStr,
          prod.id,
        ]
      )

      console.log(`  ✓ Seeded [${prod.sku}] ${prod.name}: ${quantity} ${prod.unit} (Batch: ${batchNo}, Expiry: ${expiryDate}, Value: ${totalStockVal} ETB)`)
    }

    // 2. Export Products (GREEN MUNG in WH1-AGRI-EXP)
    console.log("\n2. Populating export_warehouse_movements and updating export_products...")
    const [exportProducts] = await conn.query("SELECT * FROM export_products")
    for (const exp of exportProducts) {
      const expQty = 500.0
      const expUnitCost = 1200.0
      const expSelling = 1450.0
      const expStockVal = expQty * expUnitCost
      const expMovementId = `EWM-INIT-${exp.id}`
      const voucherNo = "1323"
      const batchNo = `GRV-${voucherNo}`

      // A. Insert child movement into export_warehouse_movements
      await conn.query(
        `INSERT INTO export_warehouse_movements (
          id, warehouse_id, product_id, movement_type, voucher_no, batch_no,
          party_name, plate_number, gross_quantity, reject_quantity, net_quantity,
          uom, unit_price, selling_price, movement_date, reason, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          expMovementId,
          exp.warehouse_id || "WH1-AGRI-EXP",
          exp.id,
          "GRV_ENTRY",
          voucherNo,
          batchNo,
          "Initial Harvest Intake",
          "ET-3-12844",
          expQty,
          0.0,
          expQty,
          exp.unit || "Quintal",
          expUnitCost,
          expSelling,
          todayDate,
          "Initial Stock Registration",
          "Warehouse Officer",
          nowStr,
          nowStr,
        ]
      )

      // B. Update parent export_products
      await conn.query(
        `UPDATE export_products SET
          quantity = ?,
          quantity_sold = 0.00,
          total_quantity = ?,
          unit_cost = ?,
          selling_price = ?,
          total_stock_value = ?,
          voucher_no = ?,
          status = 'In Stock',
          updated_at = ?
        WHERE id = ?`,
        [
          expQty,
          expQty,
          expUnitCost,
          expSelling,
          expStockVal,
          voucherNo,
          nowStr,
          exp.id,
        ]
      )

      console.log(`  ✓ Seeded export commodity [${exp.sku}] ${exp.name}: ${expQty} ${exp.unit} (Voucher: ${voucherNo}, Value: ${expStockVal} ETB)`)
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1")

    console.log("\n================================================================================")
    console.log("                        POST-SEED AUDIT VERIFICATION                            ")
    console.log("================================================================================\n")

    const [batchCount] = await conn.query("SELECT COUNT(*) as c FROM pharma_product_batches")
    const [movCount] = await conn.query("SELECT COUNT(*) as c FROM stock_movements")
    const [expMovCount] = await conn.query("SELECT COUNT(*) as c FROM export_warehouse_movements")
    const [pharmaInStock] = await conn.query("SELECT COUNT(*) as c FROM pharma_products WHERE status = 'In Stock' AND quantity > 0")
    const [expInStock] = await conn.query("SELECT COUNT(*) as c FROM export_products WHERE status = 'In Stock' AND quantity > 0")

    console.log(`Pharma Product Batches created: ${batchCount[0].c}`)
    console.log(`Stock Movements created:         ${movCount[0].c}`)
    console.log(`Export Movements created:        ${expMovCount[0].c}`)
    console.log(`Pharma Products In-Stock:        ${pharmaInStock[0].c} / ${pharmaProducts.length}`)
    console.log(`Export Products In-Stock:        ${expInStock[0].c} / ${exportProducts.length}`)

    console.log("\n✅ Child records and parent stock successfully populated!")
  } catch (err) {
    console.error("❌ Error seeding child batches:", err)
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

seedInitialChildBatches().catch((err) => {
  console.error(err)
  process.exit(1)
})
