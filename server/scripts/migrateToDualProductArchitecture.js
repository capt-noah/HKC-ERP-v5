import { pool } from "../db/client.js"

export async function migrateToDualProductArchitecture() {
  console.log("==================================================================")
  console.log("   HKC-ERP v5: DUAL PRODUCT ARCHITECTURE DATABASE MIGRATION       ")
  console.log("==================================================================")

  // 1. Create export_products table
  console.log("\n[1/5] Creating \`export_products\` table...")
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`export_products\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`sku\` VARCHAR(100),
      \`name\` VARCHAR(255) NOT NULL,
      \`commodity_type\` VARCHAR(100),
      \`category\` VARCHAR(100) DEFAULT 'Agricultural Commodity',
      \`warehouse_id\` VARCHAR(191) NOT NULL,
      \`crop_year\` VARCHAR(50),
      \`grade\` VARCHAR(50),
      \`origin\` VARCHAR(100),
      \`moisture_content\` DECIMAL(5, 2),
      \`clean_yield_pct\` DECIMAL(5, 2),
      \`unit\` VARCHAR(50) NOT NULL DEFAULT 'Quintal',
      \`quantity\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`quantity_sold\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`total_quantity\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`unit_cost\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`selling_price\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`total_stock_value\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`reorder_level\` DECIMAL(18, 2) DEFAULT 0.00,
      \`min_stock_level\` DECIMAL(18, 2) DEFAULT 0.00,
      \`status\` VARCHAR(50) DEFAULT 'In Stock',
      \`description\` TEXT,
      \`supplier_id\` VARCHAR(191),
      \`supplier_name\` VARCHAR(255),
      \`voucher_no\` VARCHAR(100),
      \`plate_number\` VARCHAR(100),
      \`driver_name\` VARCHAR(191),
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX \`idx_exp_prod_wh\` (\`warehouse_id\`),
      INDEX \`idx_exp_prod_commodity\` (\`commodity_type\`),
      INDEX \`idx_exp_prod_sku\` (\`sku\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log("✅ \`export_products\` table created/verified.")

  // 2. Create pharma_products table
  console.log("\n[2/5] Creating \`pharma_products\` table...")
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`pharma_products\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`sku\` VARCHAR(100),
      \`name\` VARCHAR(255) NOT NULL,
      \`generic_name\` VARCHAR(255),
      \`category\` VARCHAR(100),
      \`sub_category\` VARCHAR(100),
      \`warehouse_id\` VARCHAR(191) NOT NULL,
      \`dosage_form\` VARCHAR(100),
      \`strength\` VARCHAR(100),
      \`shelf_number\` VARCHAR(100),
      \`storage_condition\` VARCHAR(100),
      \`unit\` VARCHAR(50) NOT NULL DEFAULT 'Box',
      \`quantity_per_pack\` INT DEFAULT 1,
      \`number_of_cartons\` INT DEFAULT 0,
      \`quantity\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`quantity_sold\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`total_quantity\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`unit_cost\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`selling_price\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`total_stock_value\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`reorder_level\` DECIMAL(18, 2) DEFAULT 0.00,
      \`min_stock_level\` DECIMAL(18, 2) DEFAULT 0.00,
      \`shelf_life_months\` INT,
      \`status\` VARCHAR(50) DEFAULT 'In Stock',
      \`description\` TEXT,
      \`supplier_id\` VARCHAR(191),
      \`supplier_name\` VARCHAR(255),
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX \`idx_pharma_prod_wh\` (\`warehouse_id\`),
      INDEX \`idx_pharma_prod_category\` (\`category\`),
      INDEX \`idx_pharma_prod_sku\` (\`sku\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log("✅ \`pharma_products\` table created/verified.")

  // 3. Create pharma_product_batches table
  console.log("\n[3/5] Creating \`pharma_product_batches\` table...")
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`pharma_product_batches\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`product_id\` VARCHAR(191) NOT NULL,
      \`warehouse_id\` VARCHAR(191) NOT NULL,
      \`batch_no\` VARCHAR(100) NOT NULL,
      \`mfg_date\` VARCHAR(50),
      \`expiry_date\` VARCHAR(50) NOT NULL,
      \`quantity\` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
      \`unit_cost\` DECIMAL(18, 2) DEFAULT 0.00,
      \`qa_status\` VARCHAR(50) NOT NULL DEFAULT 'Released',
      \`location\` VARCHAR(100),
      \`notes\` VARCHAR(255),
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX \`idx_batch_prod\` (\`product_id\`),
      INDEX \`idx_batch_wh\` (\`warehouse_id\`),
      INDEX \`idx_batch_expiry\` (\`expiry_date\`),
      INDEX \`idx_batch_status\` (\`qa_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log("✅ \`pharma_product_batches\` table created/verified.")

  // 4. Truncate export_warehouse_movements (remove orphaned records without inventory products)
  console.log("\n[4/5] Clearing orphaned data from \`export_warehouse_movements\`...")
  await pool.query("TRUNCATE TABLE \`export_warehouse_movements\`")
  console.log("✅ \`export_warehouse_movements\` truncated and reset.")

  // 5. Migrate existing data from inventory_products into dedicated tables
  console.log("\n[5/5] Migrating existing items from \`inventory_products\` into dedicated tables...")
  const [existingProducts] = await pool.query("SELECT * FROM \`inventory_products\`")

  for (const prod of existingProducts) {
    const isExport =
      prod.product_type === "EXPORT_COMMODITY" ||
      String(prod.warehouse_id).toUpperCase() === "WH1" ||
      String(prod.warehouse_id).toUpperCase().includes("EXPORT")

    if (isExport) {
      console.log(` -> Migrating Export Product: ${prod.name} (${prod.id}) to \`export_products\``)
      await pool.query(
        `
        INSERT INTO \`export_products\` (
          id, sku, name, commodity_type, category, warehouse_id, crop_year, grade, origin,
          unit, quantity, quantity_sold, total_quantity, unit_cost, selling_price,
          total_stock_value, reorder_level, min_stock_level, status, description,
          supplier_id, supplier_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          quantity = VALUES(quantity),
          unit_cost = VALUES(unit_cost),
          total_stock_value = VALUES(total_stock_value),
          updated_at = VALUES(updated_at)
      `,
        [
          prod.id,
          prod.sku || null,
          prod.name,
          prod.category || "Sesame",
          prod.category || "Agricultural Commodity",
          prod.warehouse_id,
          "2025/2026",
          "Grade 1",
          "Humera",
          prod.unit || "Quintal",
          prod.quantity || 0,
          prod.quantity_sold || 0,
          prod.total_quantity || prod.quantity || 0,
          prod.unit_cost || 0,
          prod.selling_price || 0,
          prod.total_stock_value || 0,
          prod.reorder_level || 0,
          prod.min_stock_level || 0,
          prod.status || "In Stock",
          prod.description || null,
          prod.supplier_id || null,
          prod.supplier_name || null,
          prod.created_at || new Date(),
          prod.updated_at || new Date(),
        ]
      )
    } else {
      console.log(` -> Migrating Pharma Product: ${prod.name} (${prod.id}) to \`pharma_products\``)
      await pool.query(
        `
        INSERT INTO \`pharma_products\` (
          id, sku, name, generic_name, category, sub_category, warehouse_id,
          storage_condition, unit, quantity, quantity_sold, total_quantity,
          unit_cost, selling_price, total_stock_value, reorder_level, min_stock_level,
          status, description, supplier_id, supplier_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          quantity = VALUES(quantity),
          unit_cost = VALUES(unit_cost),
          total_stock_value = VALUES(total_stock_value),
          updated_at = VALUES(updated_at)
      `,
        [
          prod.id,
          prod.sku || null,
          prod.name,
          prod.name,
          prod.category || "Veterinary Medicine",
          prod.sub_category || null,
          prod.warehouse_id,
          prod.storage_condition || "Room Temperature",
          prod.unit || "Box",
          prod.quantity || 0,
          prod.quantity_sold || 0,
          prod.total_quantity || prod.quantity || 0,
          prod.unit_cost || 0,
          prod.selling_price || 0,
          prod.total_stock_value || 0,
          prod.reorder_level || 0,
          prod.min_stock_level || 0,
          prod.status || "In Stock",
          prod.description || null,
          prod.supplier_id || null,
          prod.supplier_name || null,
          prod.created_at || new Date(),
          prod.updated_at || new Date(),
        ]
      )

      // Migrate any embedded batches from json column into pharma_product_batches table
      if (prod.batches) {
        let batchesArr = []
        try {
          batchesArr = typeof prod.batches === "string" ? JSON.parse(prod.batches) : prod.batches
        } catch {}

        if (Array.isArray(batchesArr)) {
          for (const b of batchesArr) {
            const batchId = b.id || `batch-${prod.id}-${b.batchNo || b.batch_no || Date.now()}`
            console.log(`    -> Migrating Batch: ${b.batchNo || b.batch_no} (${b.qty || b.quantity} units)`)
            await pool.query(
              `
              INSERT INTO \`pharma_product_batches\` (
                id, product_id, warehouse_id, batch_no, mfg_date, expiry_date, quantity, unit_cost, qa_status, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                quantity = VALUES(quantity),
                expiry_date = VALUES(expiry_date)
            `,
              [
                batchId,
                prod.id,
                prod.warehouse_id,
                b.batchNo || b.batch_no || "BATCH-001",
                b.mfgDate || b.mfg_date || null,
                b.expiryDate || b.expiry_date || b.expiry || "2027-12-31",
                b.qty || b.quantity || 0,
                b.unitPrice || b.unit_price || prod.unit_cost || 0,
                b.status || "Released",
                b.notes || null,
              ]
            )
          }
        }
      }
    }
  }

  console.log("\n==================================================================")
  console.log("   MIGRATION COMPLETED SUCCESSFULLY!                              ")
  console.log("==================================================================")
}

if (process.argv[1]?.includes("migrateToDualProductArchitecture")) {
  migrateToDualProductArchitecture()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err)
      process.exit(1)
    })
}
