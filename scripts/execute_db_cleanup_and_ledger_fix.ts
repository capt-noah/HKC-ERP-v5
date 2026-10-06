import mysql from "mysql2/promise";

async function executeMigration() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading"
  });

  console.log("=== STEP 1: PURGING TEST SOYA BEAN RECORDS ===");
  const [soRes]: any = await conn.query("DELETE FROM sales_orders WHERE id = 'SO-590058'");
  console.log(`Deleted sales_orders (SO-590058): ${soRes.affectedRows} row(s)`);

  const [movRes]: any = await conn.query("DELETE FROM export_warehouse_movements WHERE id = 'WH1E-1791207544725'");
  console.log(`Deleted export_warehouse_movements (WH1E-1791207544725): ${movRes.affectedRows} row(s)`);

  const [prodRes]: any = await conn.query("DELETE FROM export_products WHERE id = 'P-1791207544725'");
  console.log(`Deleted export_products (P-1791207544725): ${prodRes.affectedRows} row(s)`);

  console.log("\n=== STEP 2: CLEANING UP REDUNDANT WASH LINES IN JOURNAL_ENTRY_LINES ===");
  // Remove duplicate/wash lines ending in -1 or -2 (the redundant 5010-05 wash lines)
  const [washRes]: any = await conn.query("DELETE FROM journal_entry_lines WHERE id LIKE '%-1' OR id LIKE '%-2'");
  console.log(`Deleted wash journal_entry_lines: ${washRes.affectedRows} row(s)`);

  console.log("\n=== STEP 3: CALCULATING EXACT STOCK VALUATION FOR OPENING/INTAKE JE ===");
  // Calculate total batch valuation remaining in warehouse
  const [batches]: any = await conn.query("SELECT * FROM pharma_product_batches");
  let remainingBatchValuation = 0;
  for (const b of batches) {
    remainingBatchValuation += Number(b.quantity || 0) * Number(b.unit_cost || 0);
  }

  // Calculate total COGS recorded on sales issues
  const [si]: any = await conn.query("SELECT * FROM sales_issues");
  let totalSiCogs = 0;
  for (const s of si) {
    const entries = typeof s.account_entries === "string" ? JSON.parse(s.account_entries) : s.account_entries;
    if (entries?.cogs_lines) {
      totalSiCogs += entries.cogs_lines.reduce((acc: number, l: any) => acc + Number(l.debit || 0), 0);
    }
  }

  const initialStockIntakeValue = Math.round((remainingBatchValuation + totalSiCogs) * 100) / 100;
  console.log(`Remaining physical batch value: ETB ${remainingBatchValuation.toFixed(2)}`);
  console.log(`Historical sales issue COGS:     ETB ${totalSiCogs.toFixed(2)}`);
  console.log(`Initial stock intake value:      ETB ${initialStockIntakeValue.toFixed(2)}`);

  console.log("\n=== STEP 4: POSTING OPENING / INTAKE JOURNAL ENTRY ===");
  const openingJeId = "JE-OPENING-STOCK-INTAKE";
  const openingDate = "2026-09-01";
  const openingDesc = "Initial Inventory Stock Intake & Warehouse Beginning Valuation";

  const jePayload = JSON.stringify({
    id: openingJeId,
    entry_number: openingJeId,
    entry_date: openingDate,
    description: openingDesc,
    source_type: "Beginning Balance",
    source_id: "OPENING-INTAKE-PHARMA",
    currency: "ETB",
    exchange_rate: 1.0,
    total_amount: initialStockIntakeValue,
    posting_status: "POSTED",
    created_by: "System Initializer",
    created_at: new Date(openingDate).toISOString(),
    updated_at: new Date().toISOString()
  });

  await conn.query(
    `INSERT INTO journal_entries (id, payload, created_at, updated_at)
     VALUES (?, ?, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
    [openingJeId, jePayload]
  );
  console.log(`Inserted/Updated Journal Entry: ${openingJeId}`);

  // Debit Line: 1400-01 (STOCK OF VETERINARY DRUG)
  const drLineId = `${openingJeId}-DR-1400-01`;
  const drPayload = JSON.stringify({
    id: drLineId,
    journal_entry_id: openingJeId,
    account_id: "1400-01",
    account_code: "1400-01",
    account_name: "STOCK OF VETERINARY DRUG",
    description: openingDesc,
    debit_amount: initialStockIntakeValue,
    credit_amount: 0,
    currency: "ETB",
    exchange_rate_at_time: 1.0,
    warehouse_id: "WH2",
    is_cleared: true,
    created_at: new Date(openingDate).toISOString(),
    updated_at: new Date().toISOString()
  });

  await conn.query(
    `INSERT INTO journal_entry_lines (id, payload, created_at, updated_at)
     VALUES (?, ?, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
    [drLineId, drPayload]
  );
  console.log(`Inserted/Updated Debit Line: ${drLineId} -> Debit 1400-01: ETB ${initialStockIntakeValue.toFixed(2)}`);

  // Credit Line: 3000-01 (HABTOM KEBEDE'S CAPITAL)
  const crLineId = `${openingJeId}-CR-3000-01`;
  const crPayload = JSON.stringify({
    id: crLineId,
    journal_entry_id: openingJeId,
    account_id: "3000-01",
    account_code: "3000-01",
    account_name: "HABTOM KEBEDE'S CAPITAL",
    description: openingDesc,
    debit_amount: 0,
    credit_amount: initialStockIntakeValue,
    currency: "ETB",
    exchange_rate_at_time: 1.0,
    warehouse_id: "WH2",
    is_cleared: true,
    created_at: new Date(openingDate).toISOString(),
    updated_at: new Date().toISOString()
  });

  await conn.query(
    `INSERT INTO journal_entry_lines (id, payload, created_at, updated_at)
     VALUES (?, ?, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
    [crLineId, crPayload]
  );
  console.log(`Inserted/Updated Credit Line: ${crLineId} -> Credit 3000-01: ETB ${initialStockIntakeValue.toFixed(2)}`);

  console.log("\n=== STEP 5: VERIFYING GENERAL LEDGER BALANCES ===");
  const [allLines]: any = await conn.query("SELECT id, payload FROM journal_entry_lines");
  const summary: Record<string, { debits: number, credits: number, count: number }> = {};
  let grandDebits = 0;
  let grandCredits = 0;

  for (const r of allLines) {
    const p = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
    const acc = p.account_id || p.account_code || "UNKNOWN";
    if (!summary[acc]) summary[acc] = { debits: 0, credits: 0, count: 0 };
    const d = Number(p.debit_amount || p.debit || 0);
    const c = Number(p.credit_amount || p.credit || 0);
    summary[acc].debits += d;
    summary[acc].credits += c;
    summary[acc].count++;
    grandDebits += d;
    grandCredits += c;
  }

  const [accounts]: any = await conn.query("SELECT id, code, name, account_type FROM chart_of_accounts");
  const accMap = new Map(accounts.map((a: any) => [a.code, a]));

  const rows = Object.entries(summary).map(([code, s]) => {
    const acc = accMap.get(code) as any;
    const isAssetOrExpense = acc ? (acc.account_type === "Asset" || acc.account_type === "Expense") : true;
    const netNormal = isAssetOrExpense ? (s.debits - s.credits) : (s.credits - s.debits);
    return {
      Code: code,
      Name: acc ? acc.name : "UNKNOWN",
      Type: acc ? acc.account_type : "-",
      TotalDebit: s.debits.toFixed(2),
      TotalCredit: s.credits.toFixed(2),
      NormalBalance: netNormal.toFixed(2),
      LinesCount: s.count
    };
  });

  console.table(rows);
  console.log(`Total Debits:  ETB ${grandDebits.toFixed(2)}`);
  console.log(`Total Credits: ETB ${grandCredits.toFixed(2)}`);
  console.log(`Imbalance:     ETB ${Math.abs(grandDebits - grandCredits).toFixed(2)}`);

  await conn.end();
}

executeMigration().catch(console.error);
