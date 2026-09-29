import { pool } from "../../db/client.js"
import { withTransaction } from "../../db/transactionHelper.js"
import { getTableColumns, normalizeBodyToDbColumns, sanitizeSqlValue, unwrapRow } from "../../db/dbUtils.js"
import { getLocalDateString } from "../../utils/dateUtils.js"
import { isExportWarehouse } from "../../utils/warehouseUtils.js"

export async function listProducts(query = {}) {
  const warehouse = query.warehouse || query.warehouse_id || query.warehouseId
  const typeFilter = query.type || query.warehouse_type || query.warehouseType
  const items = []
  const isExplicitExport = warehouse && warehouse !== "ALL" ? await isExportWarehouse(warehouse) : null

  const shouldFetchExport =
    typeFilter === "EXPORT_WH" || typeFilter === "AGRICULTURAL_EXPORT" ||
    (!typeFilter && (!warehouse || warehouse === "ALL" || isExplicitExport === true))

  const shouldFetchPharma =
    typeFilter === "PHARMA_WH" ||
    (!typeFilter && (!warehouse || warehouse === "ALL" || isExplicitExport === false))

  if (shouldFetchExport) {
    let sql = "SELECT * FROM `export_products`"
    const params = []
    if (warehouse && warehouse !== "ALL") {
      sql += " WHERE warehouse_id = ?"
      params.push(warehouse)
    }
    sql += " ORDER BY created_at DESC"
    const [rows] = await pool.query(sql, params)
    for (const r of rows) {
      items.push({ ...unwrapRow(r, "relational"), isExport: true, warehouseType: "AGRICULTURAL_EXPORT" })
    }
  }

  if (shouldFetchPharma) {
    let sql = "SELECT * FROM `pharma_products`"
    const params = []
    if (warehouse && warehouse !== "ALL") {
      sql += " WHERE warehouse_id = ?"
      params.push(warehouse)
    }
    sql += " ORDER BY created_at DESC"
    const [rows] = await pool.query(sql, params)
    for (const r of rows) {
      items.push({ ...unwrapRow(r, "relational"), isExport: false, warehouseType: "PHARMA_WH" })
    }
  }

  return { status: 200, body: items }
}

function hydrateExportProduct(productRow, movements = []) {
  const unwrapped = unwrapRow(productRow, "relational")
  const grvMovements = movements.filter((m) => {
    const mType = (m.movement_type || m.movementType || m.type || "").toUpperCase()
    return mType === "GRV_ENTRY" || mType === "ENTRY"
  })

  unwrapped.wh1Entries = grvMovements.map((m) => {
    const r = unwrapRow(m, "relational")
    return {
      ...r,
      id: r.id,
      entryId: r.id,
      voucherNo: r.voucherNo || r.voucher_no || undefined,
      entryDate: r.movementDate || r.movement_date || getLocalDateString(),
      customer: r.partyName || r.party_name || undefined,
      plateNumber: r.plateNumber || r.plate_number || undefined,
      quantity: Number(r.grossQuantity ?? r.gross_quantity ?? 0),
      quantityReceived: Number(r.grossQuantity ?? r.gross_quantity ?? 0),
      rejectQuantity: Number(r.rejectQuantity ?? r.reject_quantity ?? 0),
      quantityRemaining: Number(r.netQuantity ?? r.net_quantity ?? 0),
      unitPrice: Number(r.unitPrice ?? r.unit_price ?? 0),
      notes: r.reason || undefined,
    }
  })

  unwrapped.binCardEntries = movements.map((m) => {
    const r = unwrapRow(m, "relational")
    const mType = (r.movementType || r.movement_type || r.type || "").toUpperCase()
    const isReject = mType === "REJECT_DEDUCTION" || mType === "REJECT" || (r.reason && /reject|loss|cleaning/i.test(r.reason))
    const isEntry = !isReject && (mType === "GRV_ENTRY" || mType === "ENTRY")
    const isLeave = !isReject && !isEntry

    const qtyReceived = isEntry ? Number(r.grossQuantity || r.netQuantity || 0) : 0
    const qtyIssued = isReject ? Number(r.rejectQuantity || r.grossQuantity || 0) : isEntry ? 0 : Math.abs(Number(r.netQuantity || r.grossQuantity || 0))

    return {
      id: r.id,
      type: isReject ? "reject" : isEntry ? "entry" : "leave",
      date: r.movementDate || r.movement_date || getLocalDateString(),
      batchNo: r.batchNo || (r.voucherNo ? `GRV-${r.voucherNo}` : "COMMODITY-WH1"),
      voucherNo: r.voucherNo || r.voucher_no || undefined,
      plateNumber: r.plateNumber || r.plate_number || undefined,
      qtyReceived,
      qtyIssued,
      balance: Number(unwrapped.quantity || 0),
      expiryDate: "",
      party: r.partyName || (isReject ? "Cleaning Loss Deduction" : isEntry ? "Supplier Arrival" : "Customer Dispatch"),
      unitPrice: Number(r.unit_price ?? r.unitPrice ?? r.unit_cost ?? r.unitCost ?? 0),
      sellingPrice: !isReject && !isEntry && (r.sellingPrice != null || r.selling_price != null) ? Number(r.sellingPrice ?? r.selling_price) : undefined,
      remark: r.reason || (isReject ? "Reject / Cleaning Loss" : isEntry ? "Goods Receipt Voucher" : "Customer Dispatch"),
      reason: r.reason || undefined,
      createdAt: r.createdAt,
    }
  })

  unwrapped.isExport = true
  unwrapped.warehouseType = "EXPORT_WH"
  return unwrapped
}

export async function getProduct(id) {
  const cleanId = String(id).trim()
  
  // 1. Try export_products
  const [expRows] = await pool.query("SELECT * FROM `export_products` WHERE id = ?", [cleanId])
  if (expRows.length > 0) {
    const [movements] = await pool.query(
      "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? ORDER BY created_at ASC",
      [cleanId]
    )
    return { status: 200, body: hydrateExportProduct(expRows[0], movements) }
  }

  // 2. Try pharma_products
  const [phmRows] = await pool.query("SELECT * FROM `pharma_products` WHERE id = ?", [cleanId])
  if (phmRows.length > 0) {
    const prod = unwrapRow(phmRows[0], "relational")
    const [batches] = await pool.query(
      "SELECT * FROM `pharma_product_batches` WHERE product_id = ? ORDER BY created_at ASC",
      [cleanId]
    )
    const [movements] = await pool.query(
      "SELECT * FROM `stock_movements` WHERE product_id = ? ORDER BY created_at ASC",
      [cleanId]
    )
    prod.batches = batches.map((b) => unwrapRow(b, "relational"))
    prod.binCardEntries = movements.map((m) => unwrapRow(m, "relational"))
    prod.isExport = false
    prod.warehouseType = "PHARMA_WH"
    return { status: 200, body: prod }
  }

  return { status: 404, body: { error: `Product '${cleanId}' not found.` } }
}

export async function createProduct(body = {}) {
  if (!body.name && !body.description) {
    return { status: 400, body: { error: "Product name is required." } }
  }

  const warehouseId = body.warehouse_id || body.warehouse || body.warehouseId
  if (!warehouseId) {
    return { status: 400, body: { error: "Warehouse ID (warehouse_id) is required." } }
  }

  const isExport =
    body.warehouse_type === "EXPORT_WH" || body.warehouse_type === "AGRICULTURAL_EXPORT"
      ? true
      : body.warehouse_type === "PHARMA_WH"
      ? false
      : await isExportWarehouse(warehouseId)
  const targetTable = isExport ? "export_products" : "pharma_products"

  const prodId = body.id || (isExport ? `EXP-${Date.now()}` : `P-${Date.now()}`)
  const validCols = await getTableColumns(targetTable)
  const normalized = normalizeBodyToDbColumns({ ...body, id: prodId, warehouse_id: warehouseId }, validCols)

  // Compute totalStockValue & validate non-negative values
  const qty = Number(normalized.quantity ?? normalized.total_quantity ?? 0)
  const unitCost = Number(normalized.unit_cost ?? body.unitPrice ?? body.price ?? 0)
  const sellingPrice = Number(normalized.selling_price ?? body.sellingPrice ?? unitCost)

  if (qty < 0) {
    return { status: 400, body: { error: "Product quantity cannot be negative." } }
  }
  if (unitCost < 0) {
    return { status: 400, body: { error: "Product unit cost cannot be negative." } }
  }
  if (sellingPrice < 0) {
    return { status: 400, body: { error: "Product selling price cannot be negative." } }
  }

  normalized.quantity = qty
  normalized.total_quantity = Number(normalized.total_quantity ?? qty)
  normalized.unit_cost = unitCost
  normalized.selling_price = sellingPrice
  normalized.total_stock_value = Math.round(qty * unitCost * 100) / 100

  // Ensure default dates
  const todayStr = getLocalDateString()
  const todayYear = new Date().getFullYear()
  const defaultExpiryStr = `${todayYear + 2}-12-31`
  if (!isExport) {
    if (!normalized.mfg_date) normalized.mfg_date = body.manufacturingDate || body.mfgDate || todayStr
    if (!normalized.expiry_date) normalized.expiry_date = body.expiryDate || body.expiry || defaultExpiryStr
    if (body.batch || body.batchNo || body.batch_no || normalized.batch_no) {
      normalized.batch_no = body.batch || body.batchNo || body.batch_no || normalized.batch_no
    }
  }

  return await withTransaction(async (conn) => {
    const insertCols = Object.keys(normalized).filter((k) => k !== "created_at" && k !== "updated_at" && (!validCols || validCols.has(k)))
    const placeholders = insertCols.map(() => "?").join(", ")
    const values = insertCols.map((k) => sanitizeSqlValue(normalized[k]))

    await conn.query(
      `INSERT INTO \`${targetTable}\` (\`${insertCols.join("`, `")}\`) VALUES (${placeholders})`,
      values
    )

    // Dependent records creation
    if (isExport) {
      if (qty > 0) {
        const clientEntry = Array.isArray(body.wh1Entries) && body.wh1Entries.length > 0 ? body.wh1Entries[0] : null
        const movementId = clientEntry?.entryId || clientEntry?.id || body.movement_id || body.movementId || body.entryId || `EWM-INIT-${prodId}-${Date.now()}`
        const voucherNo = clientEntry?.voucherNo || body.voucher_no || body.voucherNo || normalized.voucher_no || null
        const plateNumber = clientEntry?.plateNumber || body.plate_number || body.plateNumber || body.truck_plate || body.truckPlate || normalized.plate_number || null
        const partyName = clientEntry?.customer || body.party_name || body.supplier_name || body.supplierName || body.driver_name || body.driverName || body.customer || normalized.supplier_name || "Supplier Arrival"
        const entryUnitPrice = (clientEntry?.unitPrice != null && Number(clientEntry.unitPrice) >= 0) ? Number(clientEntry.unitPrice) : unitCost
        const entryReason = clientEntry?.notes || body.reason || body.notes || "Initial Stock Registration"
        const entryDate = clientEntry?.entryDate || body.entryDate || todayStr
        const batchNo = voucherNo ? `GRV-${voucherNo}` : "COMMODITY-WH1"
        await conn.query(
          `INSERT INTO export_warehouse_movements (
            id, warehouse_id, product_id, movement_type, voucher_no, batch_no,
            party_name, plate_number, gross_quantity, reject_quantity, net_quantity,
            uom, unit_price, movement_date, reason, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            movementId,
            warehouseId,
            prodId,
            "GRV_ENTRY",
            voucherNo,
            batchNo,
            partyName,
            plateNumber,
            qty,
            0,
            qty,
            normalized.unit || "Quintal",
            entryUnitPrice,
            entryDate,
            entryReason,
            body.createdBy || body.performedBy || "Warehouse Officer",
          ]
        )
      }
    } else {
      if (qty > 0) {
        const batchNo = normalized.batch_no || body.batch || body.batchNo || "BATCH-01"
        const batchId = `PB-${prodId}-${Date.now()}`
        await conn.query(
          `INSERT INTO pharma_product_batches (
            id, product_id, warehouse_id, batch_no, mfg_date, expiry_date, quantity, unit_cost, qa_status, location, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            batchId,
            prodId,
            warehouseId,
            batchNo,
            normalized.mfg_date || todayStr,
            normalized.expiry_date || defaultExpiryStr,
            qty,
            unitCost,
            "Released",
            normalized.shelf_number || null,
            "Initial Stock Registration",
          ]
        )

        const movementId = `SM-INIT-${prodId}-${Date.now()}`
        await conn.query(
          `INSERT INTO stock_movements (
            id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price, selling_price,
            balance_after, batch_no, mfg_date, expiry_date, reference_type, reference_id, notes, party, performed_by, movement_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            movementId,
            prodId,
            warehouseId,
            "RECEIPT",
            qty,
            unitCost,
            unitCost,
            sellingPrice,
            qty,
            batchNo,
            normalized.mfg_date || todayStr,
            normalized.expiry_date || null,
            "STOCK_RECEIPT",
            batchNo,
            "Initial Stock Registration",
            body.supplierName || body.supplier_name || body.party || "Initial Stock Deposit",
            body.performedBy || body.createdBy || "Warehouse Officer",
            normalized.mfg_date || todayStr,
          ]
        )
      }
    }

    const [createdRows] = await conn.query(`SELECT * FROM \`${targetTable}\` WHERE id = ?`, [prodId])
    const unwrapped = unwrapRow(createdRows[0], "relational")

    // Attach hydrated dependent child records directly in the response
    if (isExport) {
      const [movements] = await conn.query(
        "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? ORDER BY created_at ASC",
        [prodId]
      )
      return {
        status: 201,
        body: hydrateExportProduct(createdRows[0], movements),
      }
    } else {
      const [batches] = await conn.query(
        "SELECT * FROM `pharma_product_batches` WHERE product_id = ? ORDER BY created_at ASC",
        [prodId]
      )
      const [movements] = await conn.query(
        "SELECT * FROM `stock_movements` WHERE product_id = ? ORDER BY created_at ASC",
        [prodId]
      )
      unwrapped.batches = batches.map((b) => unwrapRow(b, "relational"))
      unwrapped.binCardEntries = movements.map((m) => unwrapRow(m, "relational"))
    }

    return {
      status: 201,
      body: {
        ...unwrapped,
        isExport,
        warehouseType: isExport ? "EXPORT_WH" : "PHARMA_WH",
      },
    }
  })
}

export async function updateProduct(id, updates = {}) {
  const cleanId = String(id).trim()

  // Determine which table the product resides in
  let targetTable = null
  const [phmRows] = await pool.query("SELECT * FROM `pharma_products` WHERE id = ?", [cleanId])
  if (phmRows.length > 0) {
    targetTable = "pharma_products"
  } else {
    const [expRows] = await pool.query("SELECT * FROM `export_products` WHERE id = ?", [cleanId])
    if (expRows.length > 0) {
      targetTable = "export_products"
    }
  }

  if (!targetTable) {
    return { status: 404, body: { error: `Product '${cleanId}' not found.` } }
  }

  const isExport = targetTable === "export_products"
  const validCols = await getTableColumns(targetTable)
  const normalized = normalizeBodyToDbColumns(updates, validCols)

  return await withTransaction(async (conn) => {
    // 1. Fetch current product state
    const [currRows] = await conn.query(`SELECT * FROM \`${targetTable}\` WHERE id = ?`, [cleanId])
    const current = currRows[0]

    // Determine incoming unit cost or price
    const incomingCost = updates.unitCost ?? updates.unit_cost ?? updates.unitPrice ?? updates.price ?? normalized.unit_cost
    if (incomingCost !== undefined && Number(incomingCost) < 0) {
      return { status: 400, body: { error: "Unit cost cannot be negative." } }
    }
    if (normalized.quantity !== undefined && Number(normalized.quantity) < 0) {
      return { status: 400, body: { error: "Quantity cannot be negative." } }
    }
    if (normalized.selling_price !== undefined && Number(normalized.selling_price) < 0) {
      return { status: 400, body: { error: "Selling price cannot be negative." } }
    }
    if (updates.sellingPrice !== undefined && Number(updates.sellingPrice) < 0) {
      return { status: 400, body: { error: "Selling price cannot be negative." } }
    }

    const newUnitCost = incomingCost !== undefined ? Number(incomingCost) : Number(current.unit_cost || 0)
    const newQuantity = normalized.quantity !== undefined ? Number(normalized.quantity) : Number(current.quantity || 0)
    const newStockValue =
      updates.total_stock_value !== undefined
        ? Number(updates.total_stock_value)
        : updates.totalStockValue !== undefined
        ? Number(updates.totalStockValue)
        : Math.round(newQuantity * newUnitCost * 100) / 100

    normalized.unit_cost = newUnitCost
    normalized.total_stock_value = newStockValue
    if (normalized.selling_price === undefined && updates.sellingPrice !== undefined) {
      normalized.selling_price = Number(updates.sellingPrice)
    }

    // 3. Update parent product table
    const updateCols = Object.keys(normalized).filter(
      (k) => k !== "id" && k !== "created_at" && (!validCols || validCols.has(k))
    )

    if (updateCols.length > 0) {
      const setClauses = updateCols.map((c) => `\`${c}\` = ?`).join(", ")
      const setValues = updateCols.map((k) => sanitizeSqlValue(normalized[k]))
      setValues.push(cleanId)
      await conn.query(`UPDATE \`${targetTable}\` SET ${setClauses}, updated_at = NOW(3) WHERE id = ?`, setValues)
    }

    // 4. CASCADE ATOMIC SYNCHRONIZATION TO DEPENDENT CHILD RECORDS (Single batch only)
    if (!isExport) {
      const [existingBatches] = await conn.query(
        "SELECT id FROM `pharma_product_batches` WHERE product_id = ?",
        [cleanId]
      )

      if (existingBatches.length <= 1) {
        const syncBatchClauses = []
        const syncBatchVals = []

        if (incomingCost !== undefined && incomingCost !== null) {
          syncBatchClauses.push("unit_cost = ?")
          syncBatchVals.push(newUnitCost)
        }
        if (normalized.batch_no && String(normalized.batch_no).trim() !== "") {
          syncBatchClauses.push("batch_no = ?")
          syncBatchVals.push(normalized.batch_no)
        }
        if (normalized.mfg_date && String(normalized.mfg_date).trim() !== "") {
          syncBatchClauses.push("mfg_date = ?")
          syncBatchVals.push(normalized.mfg_date)
        }
        if (normalized.expiry_date && String(normalized.expiry_date).trim() !== "") {
          syncBatchClauses.push("expiry_date = ?")
          syncBatchVals.push(normalized.expiry_date)
        }

        if (syncBatchClauses.length > 0) {
          syncBatchVals.push(cleanId)
          await conn.query(
            `UPDATE pharma_product_batches SET ${syncBatchClauses.join(", ")}, updated_at = NOW(3) WHERE product_id = ?`,
            syncBatchVals
          )
        }

        // Synchronize initial RECEIPT movements in stock_movements
        const syncSmClauses = []
        const syncSmVals = []

        if (incomingCost !== undefined && incomingCost !== null) {
          syncSmClauses.push("unit_price = ?", "unit_cost = ?")
          syncSmVals.push(newUnitCost, newUnitCost)
        }
        if (normalized.batch_no && String(normalized.batch_no).trim() !== "") {
          syncSmClauses.push("batch_no = ?")
          syncSmVals.push(normalized.batch_no)
        }
        if (normalized.expiry_date && String(normalized.expiry_date).trim() !== "") {
          syncSmClauses.push("expiry_date = ?")
          syncSmVals.push(normalized.expiry_date)
        }
        if (normalized.mfg_date && String(normalized.mfg_date).trim() !== "") {
          syncSmClauses.push("mfg_date = ?")
          syncSmVals.push(normalized.mfg_date)
        }
        if (normalized.selling_price !== undefined) {
          syncSmClauses.push("selling_price = ?")
          syncSmVals.push(Number(normalized.selling_price))
        }

        if (syncSmClauses.length > 0) {
          syncSmVals.push(cleanId)
          await conn.query(
            `UPDATE stock_movements SET ${syncSmClauses.join(", ")}, updated_at = NOW(3) WHERE product_id = ? AND (movement_type = 'RECEIPT' OR reference_type = 'STOCK_RECEIPT')`,
            syncSmVals
          )
        }
      }
    }

    // 5. Return the fresh updated product with hydrated child arrays
    const [updatedRows] = await conn.query(`SELECT * FROM \`${targetTable}\` WHERE id = ?`, [cleanId])
    
    if (isExport) {
      const [movements] = await conn.query(
        "SELECT * FROM `export_warehouse_movements` WHERE product_id = ? ORDER BY created_at ASC",
        [cleanId]
      )
      return {
        status: 200,
        body: hydrateExportProduct(updatedRows[0], movements),
      }
    } else {
      const unwrapped = unwrapRow(updatedRows[0], "relational")
      const [batches] = await conn.query(
        "SELECT * FROM `pharma_product_batches` WHERE product_id = ? ORDER BY created_at ASC",
        [cleanId]
      )
      const [movements] = await conn.query(
        "SELECT * FROM `stock_movements` WHERE product_id = ? ORDER BY created_at ASC",
        [cleanId]
      )
      unwrapped.batches = batches.map((b) => unwrapRow(b, "relational"))
      unwrapped.binCardEntries = movements.map((m) => unwrapRow(m, "relational"))
      return {
        status: 200,
        body: {
          ...unwrapped,
          isExport: false,
          warehouseType: "PHARMA_WH",
        },
      }
    }
  })
}

export async function deleteProduct(id) {
  const cleanId = String(id).trim()

  return await withTransaction(async (conn) => {
    // 1. Clean up export movements if export product
    await conn.query("DELETE FROM export_warehouse_movements WHERE product_id = ?", [cleanId])
    await conn.query("DELETE FROM export_products WHERE id = ?", [cleanId])

    // 2. Clean up pharma batches, movements, store transfers, and quarantine records if pharma product
    await conn.query("DELETE FROM quarantine_records WHERE product_id = ?", [cleanId])
    await conn.query("DELETE FROM store_transfer_items WHERE product_id = ?", [cleanId])
    await conn.query("DELETE FROM stock_movements WHERE product_id = ?", [cleanId])
    await conn.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [cleanId])
    await conn.query("DELETE FROM pharma_products WHERE id = ?", [cleanId])

    return { status: 200, body: { success: true, message: `Product ${cleanId} deleted cleanly.` } }
  })
}
