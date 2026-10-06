import mysql from "mysql2/promise";
import { COMPANY_CHART_OF_ACCOUNTS, DEFAULT_GL_ACCOUNT_MAPPINGS } from "../src/lib/companyCOA";

async function run() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading"
  });

  console.log("=== 1. INSERTING MISSING COA ACCOUNTS ===");
  const [existingAccounts]: any = await conn.query("SELECT id, code FROM chart_of_accounts");
  const existingCodes = new Set(existingAccounts.map((a: any) => a.code));
  const missingAccounts = COMPANY_CHART_OF_ACCOUNTS.filter(acc => !existingCodes.has(acc.code));

  for (const acc of missingAccounts) {
    const payload = JSON.stringify({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      peachtree_type: acc.peachtree_type,
      parent_account_id: acc.parent_account_id,
      is_group: acc.is_group ? 1 : 0,
      is_active: acc.is_active ? 1 : 0
    });

    await conn.query(
      `INSERT INTO chart_of_accounts (id, payload, code, name, account_type, peachtree_type, parent_account_id, is_group, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), name = VALUES(name), account_type = VALUES(account_type)`,
      [acc.id, payload, acc.code, acc.name, acc.account_type, acc.peachtree_type, acc.parent_account_id, acc.is_group ? 1 : 0, acc.is_active ? 1 : 0]
    );
    console.log(`Inserted account: [${acc.code}] ${acc.name}`);
  }

  console.log("\n=== 2. INSERTING/UPDATING 31 PURCHASE GL MAPPINGS ===");
  const purchaseMappings = DEFAULT_GL_ACCOUNT_MAPPINGS.filter(m => m.category === "Purchase");

  for (const m of purchaseMappings) {
    await conn.query(
      `INSERT INTO gl_account_mappings (id, label, category, account_id, account_code, account_name, normal_posting, is_system_default, description, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
         label = VALUES(label),
         category = VALUES(category),
         account_id = VALUES(account_id),
         account_code = VALUES(account_code),
         account_name = VALUES(account_name),
         normal_posting = VALUES(normal_posting),
         description = VALUES(description),
         updated_at = NOW()`,
      [
        m.id,
        m.label,
        m.category,
        m.account_id,
        m.account_code,
        m.account_name,
        m.normal_posting,
        m.is_system_default ? 1 : 0,
        m.description || "",
        "System Initializer"
      ]
    );
    console.log(`Synced mapping: ${m.id} -> [${m.account_code}] ${m.account_name} (Category: ${m.category})`);
  }

  // Ensure legacy stock/AP rules are NOT in category = 'Purchase'
  await conn.query(`
    UPDATE gl_account_mappings 
    SET category = 'Inventory & COGS' 
    WHERE category = 'Purchase' AND (account_code LIKE '1400%' OR account_code LIKE '1410%' OR id LIKE 'purchase_export_%' OR id = 'purchase_pharma_stock')
  `);

  await conn.query(`
    UPDATE gl_account_mappings 
    SET category = 'Purchasing & AP' 
    WHERE category = 'Purchase' AND (account_code LIKE '2100%' OR account_code LIKE '1100%' OR id = 'ap_trade_payable' OR id = 'po_grni_clearing')
  `);

  console.log("\n=== VERIFICATION ===");
  const [finalAccounts]: any = await conn.query("SELECT COUNT(*) as c FROM chart_of_accounts WHERE code LIKE '8101%' OR code LIKE '8201%' OR code LIKE '8301%' OR code LIKE '8401%'");
  console.log("8101..8401 accounts count in DB:", finalAccounts[0].c);

  const [finalMappings]: any = await conn.query("SELECT COUNT(*) as c FROM gl_account_mappings WHERE category = 'Purchase'");
  console.log("Purchase category mappings in DB:", finalMappings[0].c);

  const [listMappings]: any = await conn.query("SELECT id, label, category, account_code, account_name FROM gl_account_mappings WHERE category = 'Purchase' ORDER BY account_code");
  console.table(listMappings);

  await conn.end();
}

run().catch(console.error);
