import { pool } from "../db/client.js"

async function run() {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    console.log("--> Restoring ASHTYL 20% 100G (P-1791363313534) to pharma_products...")
    await conn.query(`
      INSERT INTO pharma_products (
        id, sku, name, generic_name, category, sub_category, warehouse_id, 
        batch_no, mfg_date, expiry_date, dosage_form, strength, shelf_number, 
        storage_condition, unit, quantity_per_pack, number_of_cartons, quantity, 
        quantity_sold, total_quantity, unit_cost, selling_price, total_stock_value, 
        reorder_level, min_stock_level, shelf_life_months, status, description, 
        supplier_id, supplier_name, created_at, updated_at
      ) VALUES (
        'P-1791363313534', 'ASH-ALG26143', 'ASHTYL 20% 100G', NULL, 'Veterinary Medicine', NULL, 'WH3-VET-LEBU',
        'ALG26143', '2026-05-01', '2029-04-01', NULL, NULL, NULL,
        NULL, 'Box', 12, 28, 1545.00,
        0.00, 1545.00, 3388.89, 3728.00, 5235835.05,
        0.00, 0.00, 35, 'In Stock', 'ASHTYL 20% 100G',
        NULL, NULL, '2026-10-07 08:55:14', '2026-10-07 09:01:14'
      )
      ON DUPLICATE KEY UPDATE
        quantity = 1545.00,
        total_quantity = 1545.00,
        unit_cost = 3388.89,
        selling_price = 3728.00,
        total_stock_value = 5235835.05,
        updated_at = NOW(3)
    `)

    console.log("--> Restoring 4 child batches to pharma_product_batches...")
    const batches = [
      {
        id: 'PB-P-1791363313534-1791363314565',
        batch_no: 'ALG26143',
        qty: 336.00,
        cost: 3388.89,
        price: 3728.00,
        notes: 'Initial Stock Registration',
        created_at: '2026-10-07 08:55:14',
      },
      {
        id: 'BAT-1791363547167-tbgl',
        batch_no: 'ALG26143',
        qty: 9.00,
        cost: 3388.89,
        price: 3728.00,
        notes: 'Stock Inbound',
        created_at: '2026-10-07 08:59:07',
      },
      {
        id: 'BAT-1791363650006-g2rh',
        batch_no: 'ALG26144',
        qty: 600.00,
        cost: 3388.89,
        price: 3728.00,
        notes: 'Stock Inbound',
        created_at: '2026-10-07 09:00:50',
      },
      {
        id: 'BAT-1791363673598-5622',
        batch_no: 'ALG26145',
        qty: 600.00,
        cost: 3388.89,
        price: 3728.00,
        notes: 'Stock Inbound',
        created_at: '2026-10-07 09:01:13',
      },
    ]

    for (const b of batches) {
      await conn.query(`
        INSERT INTO pharma_product_batches (
          id, product_id, warehouse_id, batch_no, mfg_date, expiry_date,
          quantity, unit_cost, selling_price, qa_status, notes, created_at, updated_at
        ) VALUES (
          ?, 'P-1791363313534', 'WH3-VET-LEBU', ?, '2026-05-01', '2029-04-01',
          ?, ?, ?, 'Released', ?, ?, ?
        )
        ON DUPLICATE KEY UPDATE
          quantity = VALUES(quantity),
          unit_cost = VALUES(unit_cost),
          selling_price = VALUES(selling_price),
          updated_at = NOW(3)
      `, [b.id, b.batch_no, b.qty, b.cost, b.price, b.notes, b.created_at, b.created_at])
    }

    console.log("--> Restoring 4 stock movements to stock_movements...")
    const movements = [
      {
        id: 'SM-INIT-P-1791363313534-1791363314566',
        qty: 336.00,
        bal: 336.00,
        batch_no: 'ALG26143',
        ref_id: 'ALG26143',
        notes: 'Initial Stock Deposit - Initial Stock Registration',
        party: 'Warehouse Officer',
        by: 'Warehouse Officer',
        mdate: '2026-05-01',
        cdate: '2026-10-07 08:55:14.555',
      },
      {
        id: 'BCE-1791363547167-dxvf',
        qty: 9.00,
        bal: 345.00,
        batch_no: 'ALG26143',
        ref_id: 'BCE-1791363547167-dxvf',
        notes: 'Initial Stock Deposit - Stock Inbound',
        party: 'Habtom',
        by: 'Habtom',
        mdate: '2026-10-07',
        cdate: '2026-10-07 08:59:07.088',
      },
      {
        id: 'BCE-1791363650006-35yy',
        qty: 600.00,
        bal: 945.00,
        batch_no: 'ALG26144',
        ref_id: 'BCE-1791363650006-35yy',
        notes: 'Initial Stock Deposit - Stock Inbound',
        party: 'Habtom',
        by: 'Habtom',
        mdate: '2026-10-07',
        cdate: '2026-10-07 09:00:50.620',
      },
      {
        id: 'BCE-1791363673598-t457',
        qty: 600.00,
        bal: 1545.00,
        batch_no: 'ALG26145',
        ref_id: 'BCE-1791363673598-t457',
        notes: 'Initial Stock Deposit - Stock Inbound',
        party: 'Habtom',
        by: 'Habtom',
        mdate: '2026-10-07',
        cdate: '2026-10-07 09:01:13.513',
      },
    ]

    for (const m of movements) {
      await conn.query(`
        INSERT INTO stock_movements (
          id, product_id, warehouse_id, movement_type, quantity, unit_cost,
          unit_price, selling_price, balance_after, batch_no, expiry_date, mfg_date,
          reference_type, reference_id, notes, party, performed_by, movement_date,
          created_at, updated_at
        ) VALUES (
          ?, 'P-1791363313534', 'WH3-VET-LEBU', 'RECEIPT', ?, 3388.89,
          3388.89, 3728.00, ?, ?, '2029-04-01', '2026-05-01',
          'STOCK_RECEIPT', ?, ?, ?, ?, ?,
          ?, ?
        )
        ON DUPLICATE KEY UPDATE
          quantity = VALUES(quantity),
          balance_after = VALUES(balance_after),
          updated_at = NOW(3)
      `, [m.id, m.qty, m.bal, m.batch_no, m.ref_id, m.notes, m.party, m.by, m.mdate, m.cdate, m.cdate])
    }

    console.log("--> Posting 4 balanced GL Journal Entries for ASHTYL 20% 100G intakes...")
    const glIntakes = [
      {
        jeId: 'JE-INTAKE-SM-INIT-P-1791363313534-1791363314566',
        qty: 336.00,
        batch_no: 'ALG26143',
        valuation: 1138667.04,
        date: '2026-05-01',
        cdate: '2026-10-07 08:55:14.555',
      },
      {
        jeId: 'JE-INTAKE-BCE-1791363547167-dxvf',
        qty: 9.00,
        batch_no: 'ALG26143',
        valuation: 30500.01,
        date: '2026-10-07',
        cdate: '2026-10-07 08:59:07.088',
      },
      {
        jeId: 'JE-INTAKE-BCE-1791363650006-35yy',
        qty: 600.00,
        batch_no: 'ALG26144',
        valuation: 2033334.00,
        date: '2026-10-07',
        cdate: '2026-10-07 09:00:50.620',
      },
      {
        jeId: 'JE-INTAKE-BCE-1791363673598-t457',
        qty: 600.00,
        batch_no: 'ALG26145',
        valuation: 2033334.00,
        date: '2026-10-07',
        cdate: '2026-10-07 09:01:13.513',
      },
    ]

    for (const gi of glIntakes) {
      const jePayload = {
        id: gi.jeId,
        entry_number: gi.jeId,
        entry_date: gi.date,
        description: `Stock Intake Valuation — ASHTYL 20% 100G [Batch: ${gi.batch_no}] (+${gi.qty} @ ETB 3388.89)`,
        source_type: 'Inventory',
        source_id: `STK-IN-${gi.batch_no}`,
        created_by: 'System Inventory Manager',
        currency: 'ETB',
        exchange_rate: 1,
        posting_status: 'POSTED',
        is_reversal_of: null,
        created_at: gi.cdate,
        updated_at: gi.cdate,
      }

      await conn.query(`
        INSERT INTO journal_entries (id, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)
      `, [gi.jeId, JSON.stringify(jePayload), gi.cdate, gi.cdate])

      // Line 1: Debit Stock Asset (1400-01)
      const debitLineId = `${gi.jeId}-DR`
      const debitPayload = {
        id: debitLineId,
        journal_entry_id: gi.jeId,
        account_id: '1400-01',
        account_code: '1400-01',
        account_name: 'STOCK OF VETERINARY DRUG',
        debit_amount: gi.valuation,
        credit_amount: 0,
        warehouse_id: 'WH3-VET-LEBU',
        currency: 'ETB',
        exchange_rate_at_time: 1,
        is_cleared: true,
        cleared_date: gi.date,
        description: jePayload.description,
        created_at: gi.cdate,
        updated_at: gi.cdate,
      }

      await conn.query(`
        INSERT INTO journal_entry_lines (id, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)
      `, [debitLineId, JSON.stringify(debitPayload), gi.cdate, gi.cdate])

      // Line 2: Credit Equity / Beginning Balance (3200)
      const creditLineId = `${gi.jeId}-CR`
      const creditPayload = {
        id: creditLineId,
        journal_entry_id: gi.jeId,
        account_id: '3200',
        account_code: '3200',
        account_name: 'RETAINED EARNINGS / OPENING EQUITY',
        debit_amount: 0,
        credit_amount: gi.valuation,
        warehouse_id: 'WH3-VET-LEBU',
        currency: 'ETB',
        exchange_rate_at_time: 1,
        is_cleared: true,
        cleared_date: gi.date,
        description: jePayload.description,
        created_at: gi.cdate,
        updated_at: gi.cdate,
      }

      await conn.query(`
        INSERT INTO journal_entry_lines (id, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)
      `, [creditLineId, JSON.stringify(creditPayload), gi.cdate, gi.cdate])
    }

    await conn.commit()
    console.log("==> Transaction committed successfully!")

    // Integrity Verifications
    const [pCount] = await conn.query("SELECT count(*) as count FROM pharma_products")
    const [expCount] = await conn.query("SELECT count(*) as count FROM export_products")
    const [bCount] = await conn.query("SELECT count(*) as count FROM pharma_product_batches")
    const [tb] = await conn.query(`
      SELECT 
        ROUND(SUM(CAST(payload->>'$.debit_amount' AS DECIMAL(15,2))), 2) as total_debit,
        ROUND(SUM(CAST(payload->>'$.credit_amount' AS DECIMAL(15,2))), 2) as total_credit,
        ROUND(SUM(CAST(payload->>'$.debit_amount' AS DECIMAL(15,2))) - SUM(CAST(payload->>'$.credit_amount' AS DECIMAL(15,2))), 2) as diff
      FROM journal_entry_lines
    `)

    console.log(`\n================ INTEGRITY REPORT ================`)
    console.log(`Pharma Products: ${pCount[0].count}`)
    console.log(`Export Products: ${expCount[0].count}`)
    console.log(`Total Products:  ${Number(pCount[0].count) + Number(expCount[0].count)} (Expected: 37)`)
    console.log(`Total Batches:   ${bCount[0].count} (Expected: 57)`)
    console.log(`Total Debits:    ETB ${tb[0].total_debit}`)
    console.log(`Total Credits:   ETB ${tb[0].total_credit}`)
    console.log(`Trial Balance Δ: ETB ${tb[0].diff} (Expected: 0.00)`)
    console.log(`==================================================\n`)

  } catch (err) {
    await conn.rollback()
    console.error("FAILED to restore ASHTYL:", err)
    process.exit(1)
  } finally {
    conn.release()
    await pool.end()
  }
}

run()
