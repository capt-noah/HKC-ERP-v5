import { pool } from "../db/client.js"

async function reconcileAshiverRecords() {
  console.log("=== STARTING ASHIVER 5 RECONCILIATION & LOCAL DB SYNC ===")
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Purge Ghost & Orphan Journal Entries and Lines from Desktop attempts
    console.log("1. Purging ghost and duplicate journal entries...")
    const ghostJEIds = [
      "JE-2026-1790857518029",
      "JE-2026-1790857518030",
      "JE-2026-1790857518031",
      "JE-2026-1790857518032",
      "JE-2026-1790857518033",
      "JE-2026-1790857518034",
      "JE-2026-1790857518035",
      "JE-2026-1790857518036",
    ]
    await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE 'JEL-179135%'")
    for (const jeId of ghostJEIds) {
      await conn.query("DELETE FROM journal_entry_lines WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.journal_entry_id')) = ?", [jeId])
      await conn.query("DELETE FROM journal_entries WHERE id = ?", [jeId])
    }

    // 2. Purge test Penicillin records if present
    console.log("2. Purging test Penicillin records...")
    await conn.query("DELETE FROM stock_movements WHERE product_id = 'P-1791352808054'")
    await conn.query("DELETE FROM pharma_product_batches WHERE product_id = 'P-1791352808054'")
    await conn.query("DELETE FROM pharma_products WHERE id = 'P-1791352808054'")
    await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE '%PEN%' OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source_id')) LIKE '%PEN%'")
    await conn.query("DELETE FROM journal_entries WHERE id LIKE '%PEN%' OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source_id')) LIKE '%PEN%'")

    // 3. Purge conflicting / fragmented Ashiver records in WH3
    console.log("3. Purging fragmented Ashiver products and stray batches...")
    const strayProdIds = ["P-1791355747403", "P-1791352826780", "P-1791355648019", "P-1791354752900"]
    for (const pid of strayProdIds) {
      await conn.query("DELETE FROM stock_movements WHERE product_id = ?", [pid])
      await conn.query("DELETE FROM pharma_product_batches WHERE product_id = ?", [pid])
      await conn.query("DELETE FROM pharma_products WHERE id = ?", [pid])
    }
    // Idempotency: delete any previously created clean intake JEs
    await conn.query("DELETE FROM journal_entry_lines WHERE id IN ('JE-INTAKE-WH3-ALT26087-DR', 'JE-INTAKE-WH3-ALT26087-CR', 'JE-INTAKE-WH3-ALT26115-DR', 'JE-INTAKE-WH3-ALT26115-CR')")
    await conn.query("DELETE FROM journal_entries WHERE id IN ('JE-INTAKE-WH3-ALT26087', 'JE-INTAKE-WH3-ALT26115')")

    // 4. Insert Unified Parent Product: ASHIVER 5 at WH3-VET-LEBU
    console.log("4. Inserting unified ASHIVER 5 product...")
    const productId = "P-1791354752900"
    const now = new Date().toISOString()
    const productPayload = {
      id: productId,
      name: "ASHIVER 5",
      sku: "ASH-ALT26087",
      category: "Veterinary Medicine",
      warehouse_id: "WH3-VET-LEBU",
      warehouse: "WH3-VET-LEBU",
      batch_no: "ALT26087",
      mfg_date: "2026-05-01",
      manufacturingDate: "2026-05-01",
      expiry_date: "2030-04-01",
      expiry: "2030-04-01",
      unit: "Box",
      quantity_per_pack: 100,
      number_of_cartons: 50,
      quantity: 5000.00,
      total_quantity: 5000.00,
      quantity_sold: 0.00,
      unit_cost: 189.38,
      selling_price: 208.00,
      total_stock_value: 946900.00,
      status: "In Stock",
      shelf_life_months: 47,
      description: "ASHIVER 5 - 50 Cartons (5,000 Boxes)",
      batches: [
        {
          id: `PB-${productId}-ALT26087`,
          batchNo: "ALT26087",
          qty: 3957.00,
          unitPrice: 189.38,
          costPrice: 189.38,
          sellingPrice: 208.00,
          mfgDate: "2026-05-01",
          expiry: "2030-04-01",
          status: "Released",
          notes: "Batch 1: 39 ctns + 57 loose boxes"
        },
        {
          id: `PB-${productId}-ALT26115`,
          batchNo: "ALT26115",
          qty: 1043.00,
          unitPrice: 189.38,
          costPrice: 189.38,
          sellingPrice: 208.00,
          mfgDate: "2026-06-01",
          expiry: "2030-05-01",
          status: "Released",
          notes: "Batch 2: 10 ctns + 43 loose boxes"
        }
      ],
      binCardEntries: [
        {
          id: "SM-WH3-ALT26087",
          type: "entry",
          date: "2026-05-01",
          batchNo: "ALT26087",
          qtyReceived: 3957.00,
          qtyIssued: 0,
          balance: 3957.00,
          mfgDate: "2026-05-01",
          expiryDate: "2030-04-01",
          party: "Initial Stock Deposit",
          unitPrice: 189.38,
          sellingPrice: 208.00,
          remark: "Intake Receipt: Batch ALT26087 (+3957 boxes)",
          createdAt: "2026-05-01T08:00:00.000Z"
        },
        {
          id: "SM-WH3-ALT26115",
          type: "entry",
          date: "2026-06-01",
          batchNo: "ALT26115",
          qtyReceived: 1043.00,
          qtyIssued: 0,
          balance: 5000.00,
          mfgDate: "2026-06-01",
          expiryDate: "2030-05-01",
          party: "Intake Batch Receipt",
          unitPrice: 189.38,
          sellingPrice: 208.00,
          remark: "Intake Receipt: Batch ALT26115 (+1043 boxes)",
          createdAt: "2026-06-01T08:00:00.000Z"
        }
      ]
    }

    await conn.query(
      `INSERT INTO pharma_products (
        id, sku, name, category, warehouse_id, batch_no, mfg_date, expiry_date,
        unit, quantity_per_pack, number_of_cartons, quantity, total_quantity,
        quantity_sold, unit_cost, selling_price, total_stock_value,
        shelf_life_months, status, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        productPayload.sku,
        productPayload.name,
        productPayload.category,
        productPayload.warehouse_id,
        productPayload.batch_no,
        productPayload.mfg_date,
        productPayload.expiry_date,
        productPayload.unit,
        productPayload.quantity_per_pack,
        productPayload.number_of_cartons,
        productPayload.quantity,
        productPayload.total_quantity,
        productPayload.quantity_sold,
        productPayload.unit_cost,
        productPayload.selling_price,
        productPayload.total_stock_value,
        productPayload.shelf_life_months,
        productPayload.status,
        productPayload.description,
        "2026-05-01 08:00:00",
        now.slice(0, 19).replace("T", " ")
      ]
    )

    // 5. Insert the 2 batches into pharma_product_batches
    console.log("5. Inserting batches into pharma_product_batches...")
    await conn.query(
      `INSERT INTO pharma_product_batches (
        id, product_id, warehouse_id, batch_no, mfg_date, expiry_date,
        quantity, unit_cost, selling_price, qa_status, location, notes, created_at, updated_at
      ) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `PB-${productId}-ALT26087`, productId, "WH3-VET-LEBU", "ALT26087", "2026-05-01", "2030-04-01",
        3957.00, 189.38, 208.00, "Released", "WH3-LEBU", "Batch 1: 39 ctns + 57 loose boxes", "2026-05-01 08:00:00", now.slice(0, 19).replace("T", " "),

        `PB-${productId}-ALT26115`, productId, "WH3-VET-LEBU", "ALT26115", "2026-06-01", "2030-05-01",
        1043.00, 189.38, 208.00, "Released", "WH3-LEBU", "Batch 2: 10 ctns + 43 loose boxes", "2026-06-01 08:00:00", now.slice(0, 19).replace("T", " ")
      ]
    )

    // 6. Insert the 2 stock movements into stock_movements
    console.log("6. Inserting movements into stock_movements...")
    await conn.query(
      `INSERT INTO stock_movements (
        id, product_id, warehouse_id, movement_type, quantity, unit_cost, unit_price,
        selling_price, balance_after, batch_no, expiry_date, mfg_date,
        reference_type, reference_id, notes, party, movement_date, created_at, updated_at
      ) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "SM-WH3-ALT26087", productId, "WH3-VET-LEBU", "RECEIPT", 3957.00, 189.38, 189.38,
        208.00, 3957.00, "ALT26087", "2030-04-01", "2026-05-01",
        "STOCK_RECEIPT", "GRV-ALT26087", "Intake Receipt: Batch ALT26087 (+3957 boxes)", "Initial Stock Deposit", "2026-05-01", "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000",

        "SM-WH3-ALT26115", productId, "WH3-VET-LEBU", "RECEIPT", 1043.00, 189.38, 189.38,
        208.00, 5000.00, "ALT26115", "2030-05-01", "2026-06-01",
        "STOCK_RECEIPT", "GRV-ALT26115", "Intake Receipt: Batch ALT26115 (+1043 boxes)", "Intake Batch Receipt", "2026-06-01", "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
      ]
    )

    // 7. Insert Chronological Balanced Journal Entries
    console.log("7. Posting balanced chronological journal entries...")
    const val1 = 749376.66
    const val2 = 197523.34

    // JE 1 (2026-05-01)
    const je1Payload = {
      id: "JE-INTAKE-WH3-ALT26087",
      entry_number: "JE-INTAKE-WH3-ALT26087",
      currency: "ETB",
      source_id: `PB-${productId}-ALT26087`,
      source_type: "Inventory Intake",
      entry_date: "2026-05-01",
      created_at: "2026-05-01T08:00:00.000Z",
      created_by: "System Initializer",
      updated_at: now,
      description: "Inventory Stock Intake & Valuation — ASHIVER 5 [WH3] (Batch: ALT26087, Qty: 3957 @ ETB 189.38)",
      total_amount: val1,
      exchange_rate: 1,
      posting_status: "POSTED",
      is_cleared: true,
      cleared_date: "2026-05-01"
    }

    const je1LineDr = {
      id: "JE-INTAKE-WH3-ALT26087-DR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26087",
      account_id: "1400-01",
      account_code: "1400-01",
      account_name: "STOCK OF VETERINARY DRUG",
      debit_amount: val1,
      credit_amount: 0,
      currency: "ETB",
      description: "Inventory Stock Intake Asset Debit — ASHIVER 5 (Batch: ALT26087, 3957 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-05-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-05-01",
      exchange_rate_at_time: 1
    }

    const je1LineCr = {
      id: "JE-INTAKE-WH3-ALT26087-CR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26087",
      account_id: "3000-01",
      account_code: "3000-01",
      account_name: "HABTOM KEBEDE'S CAPITAL",
      debit_amount: 0,
      credit_amount: val1,
      currency: "ETB",
      description: "Contributed Capital Intake Credit — ASHIVER 5 (Batch: ALT26087, 3957 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-05-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-05-01",
      exchange_rate_at_time: 1
    }

    await conn.query("INSERT INTO journal_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      "JE-INTAKE-WH3-ALT26087", JSON.stringify(je1Payload), "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je1LineDr.id, JSON.stringify(je1LineDr), "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je1LineCr.id, JSON.stringify(je1LineCr), "2026-05-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])

    // JE 2 (2026-06-01)
    const je2Payload = {
      id: "JE-INTAKE-WH3-ALT26115",
      entry_number: "JE-INTAKE-WH3-ALT26115",
      currency: "ETB",
      source_id: `PB-${productId}-ALT26115`,
      source_type: "Inventory Intake",
      entry_date: "2026-06-01",
      created_at: "2026-06-01T08:00:00.000Z",
      created_by: "System Initializer",
      updated_at: now,
      description: "Inventory Stock Intake & Valuation — ASHIVER 5 [WH3] (Batch: ALT26115, Qty: 1043 @ ETB 189.38)",
      total_amount: val2,
      exchange_rate: 1,
      posting_status: "POSTED",
      is_cleared: true,
      cleared_date: "2026-06-01"
    }

    const je2LineDr = {
      id: "JE-INTAKE-WH3-ALT26115-DR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26115",
      account_id: "1400-01",
      account_code: "1400-01",
      account_name: "STOCK OF VETERINARY DRUG",
      debit_amount: val2,
      credit_amount: 0,
      currency: "ETB",
      description: "Inventory Stock Intake Asset Debit — ASHIVER 5 (Batch: ALT26115, 1043 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-06-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-06-01",
      exchange_rate_at_time: 1
    }

    const je2LineCr = {
      id: "JE-INTAKE-WH3-ALT26115-CR",
      journal_entry_id: "JE-INTAKE-WH3-ALT26115",
      account_id: "3000-01",
      account_code: "3000-01",
      account_name: "HABTOM KEBEDE'S CAPITAL",
      debit_amount: 0,
      credit_amount: val2,
      currency: "ETB",
      description: "Contributed Capital Intake Credit — ASHIVER 5 (Batch: ALT26115, 1043 Boxes)",
      warehouse_id: "WH3-VET-LEBU",
      created_at: "2026-06-01T08:00:00.000Z",
      updated_at: now,
      is_cleared: true,
      cleared_date: "2026-06-01",
      exchange_rate_at_time: 1
    }

    await conn.query("INSERT INTO journal_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      "JE-INTAKE-WH3-ALT26115", JSON.stringify(je2Payload), "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je2LineDr.id, JSON.stringify(je2LineDr), "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])
    await conn.query("INSERT INTO journal_entry_lines (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)", [
      je2LineCr.id, JSON.stringify(je2LineCr), "2026-06-01 08:00:00.000", now.slice(0, 19).replace("T", " ") + ".000"
    ])

    await conn.commit()
    console.log("=== RECONCILIATION COMMITTED SUCCESSFULLY ===")
  } catch (err) {
    await conn.rollback()
    console.error("FAILED, ROLLED BACK:", err)
    throw err
  } finally {
    conn.release()
  }
}

reconcileAshiverRecords()
  .then(() => {
    console.log("ASHIVER 5 reconciliation complete.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Error running reconciliation:", err)
    process.exit(1)
  })
