import { pool } from "../db/client.js"

function normalizeWarehouse(raw) {
  if (!raw) return "WH1"
  const s = String(raw).trim()
  if (s === "WH1" || s.startsWith("WH1-") || s.toLowerCase().includes("exp")) return "WH1"
  if (s === "WH2" || s.startsWith("WH2-") || s.toLowerCase().includes("ind")) return "WH2"
  if (s === "WH3" || s.startsWith("WH3-") || s.toLowerCase().includes("chn")) return "WH3"
  return s
}

async function runMigration() {
  console.log("================================================================")
  console.log("   HKC-ERP v5: RELATIONAL INVENTORY SCHEMA MIGRATION            ")
  console.log("================================================================")

  const conn = await pool.getConnection()
  try {
    // ---------------------------------------------------------
    // 1. MIGRATE INVENTORY_PRODUCTS TABLE
    // ---------------------------------------------------------
    console.log("\n[1/3] Migrating 'inventory_products' to Relational Schema...")
    const [prodCols] = await conn.query("SHOW COLUMNS FROM inventory_products")
    const prodColNames = prodCols.map((c) => c.Field)

    if (prodColNames.includes("payload")) {
      console.log("-> Fetching existing JSON product payloads...")
      const [oldProds] = await conn.query("SELECT id, payload, created_at, updated_at FROM inventory_products")
      console.log(`-> Found ${oldProds.length} products to migrate.`)

      // Add relational columns
      const colsToAdd = [
        { name: "sku", def: "VARCHAR(100) NULL AFTER id" },
        { name: "name", def: "VARCHAR(255) NOT NULL DEFAULT '' AFTER sku" },
        { name: "category", def: "VARCHAR(100) NULL AFTER name" },
        { name: "sub_category", def: "VARCHAR(100) NULL AFTER category" },
        { name: "product_type", def: "VARCHAR(50) DEFAULT 'PHARMA' NOT NULL AFTER sub_category" },
        { name: "warehouse_id", def: "VARCHAR(191) NOT NULL DEFAULT 'WH1' AFTER product_type" },
        { name: "unit", def: "VARCHAR(50) NOT NULL DEFAULT 'Quintal' AFTER warehouse_id" },
        { name: "quantity", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER unit" },
        { name: "quantity_sold", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER quantity" },
        { name: "total_quantity", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER quantity_sold" },
        { name: "unit_cost", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER total_quantity" },
        { name: "selling_price", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER unit_cost" },
        { name: "total_stock_value", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER selling_price" },
        { name: "reorder_level", def: "DECIMAL(18, 2) DEFAULT 0.00 AFTER total_stock_value" },
        { name: "min_stock_level", def: "DECIMAL(18, 2) DEFAULT 0.00 AFTER reorder_level" },
        { name: "storage_condition", def: "VARCHAR(100) NULL AFTER min_stock_level" },
        { name: "status", def: "VARCHAR(50) DEFAULT 'In Stock' AFTER storage_condition" },
        { name: "description", def: "TEXT NULL AFTER status" },
        { name: "supplier_id", def: "VARCHAR(191) NULL AFTER description" },
        { name: "supplier_name", def: "VARCHAR(255) NULL AFTER supplier_id" },
        { name: "batches", def: "JSON NULL AFTER supplier_name" },
        { name: "wh1_entries", def: "JSON NULL AFTER batches" },
        { name: "bin_card_entries", def: "JSON NULL AFTER wh1_entries" },
      ]

      for (const col of colsToAdd) {
        if (!prodColNames.includes(col.name)) {
          console.log(`-> Adding column '${col.name}' to inventory_products...`)
          await conn.query(`ALTER TABLE inventory_products ADD COLUMN \`${col.name}\` ${col.def}`)
        }
      }

      // Populate relational data
      for (const r of oldProds) {
        let p = r.payload
        if (typeof p === "string") {
          try { p = JSON.parse(p) } catch { p = {} }
        }
        const whId = normalizeWarehouse(p.warehouse || p.warehouse_id)
        const isExport = whId === "WH1" || (p.unit || "").toLowerCase().includes("quintal") || (p.name || "").toLowerCase().includes("seed") || (p.name || "").toLowerCase().includes("coffee")
        const productType = isExport ? "EXPORT_COMMODITY" : "PHARMA"
        const qty = Number(p.quantity || 0)
        const qtySold = Number(p.quantitySold || p.quantity_sold || 0)
        const totalQty = Number(p.totalQuantity || p.total_quantity || (qty + qtySold))
        const unitCost = Number(p.unitCost || p.unit_cost || 0)
        const sellingPrice = Number(p.sellingPrice || p.selling_price || unitCost)
        const totalVal = Number(p.totalStockValue || p.total_stock_value || (qty * unitCost))

        await conn.query(
          `UPDATE inventory_products SET 
            sku = ?, name = ?, category = ?, sub_category = ?, product_type = ?,
            warehouse_id = ?, unit = ?, quantity = ?, quantity_sold = ?, total_quantity = ?,
            unit_cost = ?, selling_price = ?, total_stock_value = ?, reorder_level = ?, min_stock_level = ?,
            storage_condition = ?, status = ?, description = ?, supplier_id = ?, supplier_name = ?,
            batches = ?, wh1_entries = ?, bin_card_entries = ?
           WHERE id = ?`,
          [
            p.sku || null,
            p.name || "Unnamed Product",
            p.category || null,
            p.subCategory || p.sub_category || null,
            productType,
            whId,
            p.unit || (isExport ? "Quintal" : "Box"),
            qty,
            qtySold,
            totalQty,
            unitCost,
            sellingPrice,
            totalVal,
            Number(p.reorderLevel || p.reorder_level || 0),
            Number(p.minStockLevel || p.min_stock_level || 0),
            p.storageCondition || p.storage_condition || null,
            p.status || "In Stock",
            p.description || null,
            p.supplier || p.supplier_id || null,
            p.supplierName || p.supplier_name || null,
            JSON.stringify(p.batches || []),
            JSON.stringify(p.wh1Entries || p.wh1_entries || []),
            JSON.stringify(p.binCardEntries || p.bin_card_entries || []),
            r.id
          ]
        )
      }

      console.log("-> Dropping legacy 'payload' column from inventory_products...")
      await conn.query("ALTER TABLE inventory_products DROP COLUMN payload")

      // Add indexes
      try { await conn.query("CREATE INDEX idx_prod_warehouse ON inventory_products (warehouse_id)") } catch {}
      try { await conn.query("CREATE INDEX idx_prod_sku ON inventory_products (sku)") } catch {}
      try { await conn.query("CREATE INDEX idx_prod_category ON inventory_products (category)") } catch {}
      try { await conn.query("CREATE INDEX idx_prod_status ON inventory_products (status)") } catch {}
      console.log("✓ 'inventory_products' successfully normalized to relational schema.")
    } else {
      console.log("✓ 'inventory_products' already normalized.")
    }

    // ---------------------------------------------------------
    // 2. MIGRATE STOCK_MOVEMENTS TABLE
    // ---------------------------------------------------------
    console.log("\n[2/3] Migrating 'stock_movements' to Relational Schema...")
    const [movCols] = await conn.query("SHOW COLUMNS FROM stock_movements")
    const movColNames = movCols.map((c) => c.Field)

    if (movColNames.includes("payload")) {
      console.log("-> Fetching existing JSON stock movement payloads...")
      const [oldMovs] = await conn.query("SELECT id, payload, created_at, updated_at FROM stock_movements")
      console.log(`-> Found ${oldMovs.length} stock movements to migrate.`)

      // Add relational columns
      const colsToAdd = [
        { name: "product_id", def: "VARCHAR(191) NOT NULL DEFAULT '' AFTER id" },
        { name: "warehouse_id", def: "VARCHAR(191) NOT NULL DEFAULT 'WH1' AFTER product_id" },
        { name: "movement_type", def: "VARCHAR(50) NOT NULL DEFAULT 'INBOUND_RECEIPT' AFTER warehouse_id" },
        { name: "quantity", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER movement_type" },
        { name: "unit_cost", def: "DECIMAL(18, 2) DEFAULT 0.00 AFTER quantity" },
        { name: "balance_after", def: "DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER unit_cost" },
        { name: "batch_no", def: "VARCHAR(100) NULL AFTER balance_after" },
        { name: "expiry_date", def: "VARCHAR(50) NULL AFTER batch_no" },
        { name: "reference_type", def: "VARCHAR(50) NULL AFTER expiry_date" },
        { name: "reference_id", def: "VARCHAR(191) NULL AFTER reference_type" },
        { name: "notes", def: "TEXT NULL AFTER reference_id" },
        { name: "performed_by", def: "VARCHAR(191) NULL AFTER notes" },
        { name: "movement_date", def: "VARCHAR(50) NOT NULL DEFAULT '' AFTER performed_by" },
      ]

      for (const col of colsToAdd) {
        if (!movColNames.includes(col.name)) {
          console.log(`-> Adding column '${col.name}' to stock_movements...`)
          await conn.query(`ALTER TABLE stock_movements ADD COLUMN \`${col.name}\` ${col.def}`)
        }
      }

      // Populate relational data
      for (const r of oldMovs) {
        let p = r.payload
        if (typeof p === "string") {
          try { p = JSON.parse(p) } catch { p = {} }
        }
        const whId = normalizeWarehouse(p.toWarehouse || p.fromWarehouse || p.warehouse || p.warehouse_id)
        const dateStr = p.date || p.movementDate || p.movement_date || (r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))

        await conn.query(
          `UPDATE stock_movements SET 
            product_id = ?, warehouse_id = ?, movement_type = ?, quantity = ?,
            unit_cost = ?, balance_after = ?, batch_no = ?, expiry_date = ?,
            reference_type = ?, reference_id = ?, notes = ?, performed_by = ?, movement_date = ?
           WHERE id = ?`,
          [
            p.productId || p.product_id || p.itemId || p.item_id || "",
            whId,
            p.type || p.movementType || p.movement_type || "ADJUSTMENT",
            Number(p.qty || p.quantity || 0),
            Number(p.unitCost || p.unit_cost || 0),
            Number(p.balanceAfter || p.balance_after || 0),
            p.batchNo || p.batch_no || p.batch || null,
            p.expiryDate || p.expiry_date || p.expiry || null,
            p.referenceType || p.reference_type || (p.reference ? "REFERENCE" : null),
            p.reference || p.referenceId || p.reference_id || null,
            p.remarks || p.notes || p.reason || null,
            p.performedBy || p.performed_by || p.createdBy || p.created_by || null,
            dateStr,
            r.id
          ]
        )
      }

      console.log("-> Dropping legacy 'payload' column from stock_movements...")
      await conn.query("ALTER TABLE stock_movements DROP COLUMN payload")

      // Add indexes
      try { await conn.query("CREATE INDEX idx_mov_prod_date ON stock_movements (product_id, movement_date)") } catch {}
      try { await conn.query("CREATE INDEX idx_mov_wh_date ON stock_movements (warehouse_id, movement_date)") } catch {}
      try { await conn.query("CREATE INDEX idx_mov_ref ON stock_movements (reference_type, reference_id)") } catch {}
      console.log("✓ 'stock_movements' successfully normalized to relational schema.")
    } else {
      console.log("✓ 'stock_movements' already normalized.")
    }

    // ---------------------------------------------------------
    // 3. MIGRATE STORE_TRANSFERS & STORE_TRANSFER_ITEMS TABLES
    // ---------------------------------------------------------
    console.log("\n[3/3] Migrating 'store_transfers' to Relational Schema...")

    // Create child table store_transfer_items
    console.log("-> Creating child table 'store_transfer_items'...")
    await conn.query(`
      CREATE TABLE IF NOT EXISTS store_transfer_items (
        id VARCHAR(191) PRIMARY KEY,
        transfer_id VARCHAR(191) NOT NULL,
        product_id VARCHAR(191) NOT NULL,
        product_name VARCHAR(255) NULL,
        batch_no VARCHAR(100) NULL,
        quantity DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        uom VARCHAR(50) NULL,
        unit_cost DECIMAL(18, 2) DEFAULT 0.00,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_item_transfer (transfer_id),
        INDEX idx_item_product (product_id)
      )
    `)

    const [transCols] = await conn.query("SHOW COLUMNS FROM store_transfers")
    const transColNames = transCols.map((c) => c.Field)

    if (transColNames.includes("payload")) {
      console.log("-> Fetching existing JSON store transfer payloads...")
      const [oldTrans] = await conn.query("SELECT id, payload, created_at, updated_at FROM store_transfers")
      console.log(`-> Found ${oldTrans.length} store transfers to migrate.`)

      // Add relational columns
      const colsToAdd = [
        { name: "transfer_no", def: "VARCHAR(100) NOT NULL DEFAULT '' AFTER id" },
        { name: "from_warehouse_id", def: "VARCHAR(191) NOT NULL DEFAULT 'WH2' AFTER transfer_no" },
        { name: "to_warehouse_id", def: "VARCHAR(191) NOT NULL DEFAULT 'WH3' AFTER from_warehouse_id" },
        { name: "status", def: "VARCHAR(50) NOT NULL DEFAULT 'Draft' AFTER to_warehouse_id" },
        { name: "requested_by", def: "VARCHAR(191) NULL AFTER status" },
        { name: "approved_by", def: "VARCHAR(191) NULL AFTER requested_by" },
        { name: "request_date", def: "VARCHAR(50) NOT NULL DEFAULT '' AFTER approved_by" },
        { name: "completed_date", def: "VARCHAR(50) NULL AFTER request_date" },
        { name: "notes", def: "TEXT NULL AFTER completed_date" },
      ]

      for (const col of colsToAdd) {
        if (!transColNames.includes(col.name)) {
          console.log(`-> Adding column '${col.name}' to store_transfers...`)
          await conn.query(`ALTER TABLE store_transfers ADD COLUMN \`${col.name}\` ${col.def}`)
        }
      }

      // Populate relational data & line items
      for (const r of oldTrans) {
        let p = r.payload
        if (typeof p === "string") {
          try { p = JSON.parse(p) } catch { p = {} }
        }
        const fromWh = normalizeWarehouse(p.from_warehouse || p.fromWarehouse)
        const toWh = normalizeWarehouse(p.to_warehouse || p.toWarehouse)
        const dateStr = p.date || p.request_date || p.requestDate || (r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))

        await conn.query(
          `UPDATE store_transfers SET 
            transfer_no = ?, from_warehouse_id = ?, to_warehouse_id = ?, status = ?,
            requested_by = ?, approved_by = ?, request_date = ?, completed_date = ?, notes = ?
           WHERE id = ?`,
          [
            p.reference_number || p.transfer_no || p.transferNo || r.id,
            fromWh,
            toWh,
            p.status || "Completed",
            p.issued_by || p.requested_by || p.requestedBy || null,
            p.received_by || p.approved_by || p.approvedBy || null,
            dateStr,
            p.received_at || p.completed_date || p.completedDate || null,
            p.notes || p.remark || null,
            r.id
          ]
        )

        // Migrate line items into store_transfer_items
        const lineItems = p.line_items || p.items || []
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i]
          const itemId = `STI-${r.id}-${i + 1}`
          await conn.query(
            `INSERT INTO store_transfer_items 
             (id, transfer_id, product_id, product_name, batch_no, quantity, uom, unit_cost, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
            [
              itemId,
              r.id,
              item.productId || item.product_id || `ITEM-${i + 1}`,
              item.item || item.productName || item.product_name || null,
              item.batch_no || item.batchNo || null,
              Number(item.quantity || 0),
              item.UOM || item.uom || item.unit || "Unit",
              Number(item.unit_price || item.unitCost || item.unit_cost || 0),
              item.remark || item.notes || null
            ]
          )
        }
      }

      console.log("-> Dropping legacy 'payload' column from store_transfers...")
      await conn.query("ALTER TABLE store_transfers DROP COLUMN payload")

      // Add indexes
      try { await conn.query("CREATE INDEX idx_transfer_from ON store_transfers (from_warehouse_id)") } catch {}
      try { await conn.query("CREATE INDEX idx_transfer_to ON store_transfers (to_warehouse_id)") } catch {}
      try { await conn.query("CREATE INDEX idx_transfer_status ON store_transfers (status)") } catch {}
      console.log("✓ 'store_transfers' and 'store_transfer_items' successfully normalized to relational schema.")
    } else {
      console.log("✓ 'store_transfers' already normalized.")
    }

    console.log("\n================================================================")
    console.log("   ALL INVENTORY TABLES SUCCESSFULLY MIGRATED TO RELATIONAL!    ")
    console.log("================================================================\n")
  } catch (err) {
    console.error("Migration Error:", err)
    process.exit(1)
  } finally {
    conn.release()
  }
}

runMigration().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
