import fs from "fs";
import { pool } from "../db/client.js";

const TABLES_TO_KEEP = [
  "users",
  "chart_of_accounts",
  "gl_account_mappings",
  "tax_rules",
  "company_settings",
  "warehouses",
  "leave_types",
];

const TABLES_TO_WIPE = [
  "attendance_records",
  "customers",
  "employees",
  "expenses",
  "export_products",
  "export_warehouse_movements",
  "hkc_doc_records",
  "invoices",
  "journal_entries",
  "journal_entry_lines",
  "leave_requests",
  "payments",
  "payroll_periods",
  "payroll_records",
  "pharma_product_batches",
  "pharma_products",
  "processing_services",
  "purchase_orders",
  "recurring_expense_schedules",
  "sales_issue_items",
  "sales_issues",
  "sales_orders",
  "shipment_documents",
  "stock_movements",
  "store_transfer_items",
  "store_transfers",
  "suppliers",
  "user_activity_logs",
  "vehicles",
  "inventory_products",
];

async function main() {
  console.log("==================================================================");
  console.log("   HKC-ERP v5: DATABASE CLEANSE & INVENTORY IMPORT TOOL          ");
  console.log("==================================================================");

  // 1. Verify tables to keep
  console.log("\n[1/5] Verifying critical tables before cleanse...");
  for (const table of TABLES_TO_KEEP) {
    try {
      const [rows] = await pool.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
      console.log(`  ✓ Protected: \`${table}\` (${rows[0].cnt} rows preserved)`);
    } catch (err) {
      console.warn(`  ! Notice: table \`${table}\` might not exist yet:`, err.message);
    }
  }

  // 2. Wipe operational data
  console.log("\n[2/5] Wiping operational/test tables...");
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of TABLES_TO_WIPE) {
    try {
      await pool.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`  ✓ Cleared table: \`${table}\``);
    } catch (err) {
      if (err.code === "ER_NO_SUCH_TABLE") {
        console.log(`  - Table \`${table}\` does not exist (will create if needed).`);
      } else {
        console.warn(`  ! Could not truncate \`${table}\`:`, err.message);
      }
    }
  }
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  // 3. Ensure `inventory_products` table exists
  console.log("\n[3/5] Ensuring \`inventory_products\` table exists...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`inventory_products\` (
      \`id\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`payload\` json NOT NULL,
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("  ✓ \`inventory_products\` table ready.");

  // 4. Import from Desktop SQL file
  const dumpPath = "/Users/Noah/Desktop/hkc_trading_inventory.sql";
  console.log(`\n[4/5] Importing data from ${dumpPath}...`);
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at: ${dumpPath}`);
  }

  const sqlContent = fs.readFileSync(dumpPath, "utf-8");

  // Parse lines to extract each row (id, payload, created_at, updated_at)
  const lines = sqlContent.split("\n");
  const rawItems = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("('P-") || trimmed.startsWith("(\"P-")) {
      const jsonStart = trimmed.indexOf("'{");
      const jsonEnd = trimmed.lastIndexOf("}'");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const idMatch = trimmed.match(/^\('([^']+)'/);
        const prodId = idMatch ? idMatch[1] : null;
        const rawJson = trimmed.slice(jsonStart + 1, jsonEnd + 1);
        const unescaped = rawJson.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        
        try {
          const parsed = JSON.parse(unescaped);
          rawItems.push({ id: prodId || parsed.id, payload: parsed });
        } catch (e) {
          console.error("  ! JSON parse failure on product:", prodId, e.message);
        }
      }
    }
  }

  console.log(`  ✓ Extracted ${rawItems.length} inventory products from dump.`);

  // Insert into inventory_products
  let insertedCount = 0;
  for (const item of rawItems) {
    await pool.query(
      `INSERT INTO \`inventory_products\` (\`id\`, \`payload\`) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE \`payload\` = VALUES(\`payload\`)`,
      [item.id, JSON.stringify(item.payload)]
    );
    insertedCount++;
  }
  console.log(`  ✓ Inserted ${insertedCount} rows into \`inventory_products\`.`);

  // 5. Populate relational dual architecture (pharma_products & pharma_product_batches)
  console.log("\n[5/5] Populating relational \`pharma_products\` and \`pharma_product_batches\`...");

  // Update warehouses table to align with the real warehouse codes in inventory
  await pool.query(`
    INSERT INTO \`warehouses\` (\`id\`, \`name\`, \`code\`, \`warehouse_type\`, \`location\`)
    VALUES 
      ('WH1', 'WH1 - Ethiopia Agricultural Export Hub', 'WH1-AGRI-EXP', 'EXPORT_WH', 'Modjo Export Terminal, Ethiopia'),
      ('WH2', 'WH2 - Veterinary Import Hub (alem bank)', 'WH2-VET-ALEM', 'PHARMA_WH', 'Alem Bank Hub, Addis Ababa, Ethiopia'),
      ('WH3', 'WH3 - Veterinary Import Hub (LEBU)', 'WH3-VET-LEBU', 'PHARMA_WH', 'Lebu Commercial Center, Addis Ababa, Ethiopia')
    ON DUPLICATE KEY UPDATE
      \`name\` = VALUES(\`name\`),
      \`code\` = VALUES(\`code\`),
      \`warehouse_type\` = VALUES(\`warehouse_type\`),
      \`location\` = VALUES(\`location\`);
  `);
  console.log("  ✓ Warehouses metadata synchronized.");

  let pharmaCount = 0;
  let batchCount = 0;

  for (const item of rawItems) {
    const p = item.payload;
    const isWh2 = String(p.warehouse).toUpperCase().includes("WH2") || String(p.warehouseName).toUpperCase().includes("WH2");
    const warehouseId = isWh2 ? "WH2" : "WH3";

    const qty = Number(p.quantity) || 0;
    const unitCost = Number(p.unitCost) || 0;
    const sellingPrice = Number(p.sellingPrice) || 0;
    const totalVal = Number(p.totalStockValue) || (qty * unitCost);

    await pool.query(
      `
      INSERT INTO \`pharma_products\` (
        \`id\`, \`sku\`, \`name\`, \`generic_name\`, \`category\`, \`sub_category\`,
        \`warehouse_id\`, \`storage_condition\`, \`unit\`, \`quantity_per_pack\`,
        \`number_of_cartons\`, \`quantity\`, \`quantity_sold\`, \`total_quantity\`,
        \`unit_cost\`, \`selling_price\`, \`total_stock_value\`, \`reorder_level\`,
        \`min_stock_level\`, \`shelf_life_months\`, \`status\`, \`description\`,
        \`supplier_id\`, \`supplier_name\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`sku\` = VALUES(\`sku\`),
        \`name\` = VALUES(\`name\`),
        \`warehouse_id\` = VALUES(\`warehouse_id\`),
        \`quantity\` = VALUES(\`quantity\`),
        \`unit_cost\` = VALUES(\`unit_cost\`),
        \`selling_price\` = VALUES(\`selling_price\`),
        \`total_stock_value\` = VALUES(\`total_stock_value\`),
        \`unit\` = VALUES(\`unit\`),
        \`status\` = VALUES(\`status\`);
    `,
      [
        p.id,
        p.sku || null,
        p.name,
        p.name,
        p.category || "Veterinary Medicine",
        null,
        warehouseId,
        "Room Temperature (15-25°C)",
        p.unit || "Box",
        Number(p.quantityPerPack) || 1,
        Number(p.numberOfCartons) || 0,
        qty,
        Number(p.quantitySold) || 0,
        Number(p.totalQuantity) || qty,
        unitCost,
        sellingPrice,
        totalVal,
        Number(p.reorderLevel) || 0,
        Number(p.minStockLevel) || 0,
        Number(p.shelfLifeMonths) || 36,
        p.status || "In Stock",
        p.description || p.name,
        null,
        p.supplierName || null,
      ]
    );
    pharmaCount++;

    // Insert batches
    const batchesArr = Array.isArray(p.batches) ? p.batches : [];
    if (batchesArr.length > 0) {
      for (const b of batchesArr) {
        const batchId = `batch-${p.id}-${b.batchNo || "B01"}`;
        await pool.query(
          `
          INSERT INTO \`pharma_product_batches\` (
            \`id\`, \`product_id\`, \`warehouse_id\`, \`batch_no\`, \`mfg_date\`,
            \`expiry_date\`, \`quantity\`, \`unit_cost\`, \`qa_status\`, \`notes\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            \`quantity\` = VALUES(\`quantity\`),
            \`expiry_date\` = VALUES(\`expiry_date\`),
            \`qa_status\` = VALUES(\`qa_status\`);
        `,
          [
            batchId,
            p.id,
            warehouseId,
            b.batchNo || p.batch || "BATCH-001",
            p.manufacturingDate || null,
            b.expiry || p.expiry || "2029-12-31",
            Number(b.qty) || qty,
            unitCost,
            b.status || "Released",
            `Initial batch for ${p.name}`,
          ]
        );
        batchCount++;
      }
    } else {
      // Create fallback batch if none in array
      const batchId = `batch-${p.id}-init`;
      await pool.query(
        `
        INSERT INTO \`pharma_product_batches\` (
          \`id\`, \`product_id\`, \`warehouse_id\`, \`batch_no\`, \`mfg_date\`,
          \`expiry_date\`, \`quantity\`, \`unit_cost\`, \`qa_status\`, \`notes\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`quantity\` = VALUES(\`quantity\`),
          \`expiry_date\` = VALUES(\`expiry_date\`);
      `,
        [
          batchId,
          p.id,
          warehouseId,
          p.batch || "INITIAL-STOCK",
          p.manufacturingDate || null,
          p.expiry || "2029-12-31",
          qty,
          unitCost,
          "Released",
          `Initial registration stock for ${p.name}`,
        ]
      );
      batchCount++;
    }
  }

  console.log(`  ✓ Inserted ${pharmaCount} rows into \`pharma_products\`.`);
  console.log(`  ✓ Inserted ${batchCount} rows into \`pharma_product_batches\`.`);

  console.log("\n==================================================================");
  console.log("   CLEANSE & IMPORT COMPLETED SUCCESSFULLY!                       ");
  console.log("==================================================================");

  // Final summary
  console.log("\n--- DATABASE POST-CLEANSE STATUS ---");
  const [allTables] = await pool.query("SHOW TABLES");
  for (const t of allTables.map(t => Object.values(t)[0])) {
    const [c] = await pool.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    console.log(`  ${t.padEnd(30)}: ${c[0].cnt} rows`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error during cleanse & import:", err);
  process.exit(1);
});
