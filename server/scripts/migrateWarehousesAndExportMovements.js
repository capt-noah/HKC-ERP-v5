import { pool } from "../db/client.js"

async function runMigration() {
  console.log("=================================================================")
  console.log("  MIGRATION: WAREHOUSES RELATIONAL NORMALIZATION & EXPORT MOVEMENTS")
  console.log("=================================================================")

  const conn = await pool.getConnection()

  try {
    // -------------------------------------------------------------
    // 1. MIGRATE WAREHOUSES TABLE TO FIRST-CLASS RELATIONAL SCHEMA
    // -------------------------------------------------------------
    console.log("\n[1/4] Checking 'warehouses' table structure...")
    const [cols] = await conn.query("SHOW COLUMNS FROM warehouses")
    const colNames = cols.map((c) => c.Field)

    // Add relational columns if missing
    if (!colNames.includes("name")) {
      console.log("-> Adding column 'name' to warehouses...")
      await conn.query("ALTER TABLE warehouses ADD COLUMN name VARCHAR(255) NULL AFTER id")
    }
    if (!colNames.includes("code")) {
      console.log("-> Adding column 'code' to warehouses...")
      await conn.query("ALTER TABLE warehouses ADD COLUMN code VARCHAR(100) NULL AFTER name")
    }
    if (!colNames.includes("location")) {
      console.log("-> Adding column 'location' to warehouses...")
      await conn.query("ALTER TABLE warehouses ADD COLUMN location VARCHAR(255) NULL AFTER code")
    }
    if (!colNames.includes("warehouse_type")) {
      console.log("-> Adding column 'warehouse_type' to warehouses...")
      await conn.query("ALTER TABLE warehouses ADD COLUMN warehouse_type VARCHAR(50) NOT NULL DEFAULT 'PHARMA_WH' AFTER location")
    }
    if (!colNames.includes("type")) {
      console.log("-> Adding column 'type' to warehouses...")
      await conn.query("ALTER TABLE warehouses ADD COLUMN type VARCHAR(100) NULL AFTER warehouse_type")
    }

    // If payload column exists, migrate data into columns
    if (colNames.includes("payload")) {
      console.log("\n[2/4] Migrating JSON payload data into first-class columns...")
      const [rows] = await conn.query("SELECT id, payload FROM warehouses")
      for (const r of rows) {
        let p = r.payload
        if (typeof p === "string") {
          try {
            p = JSON.parse(p)
          } catch {
            p = {}
          }
        }
        const whName = p.name || r.id
        const whCode = p.code || r.id
        const whLoc = p.location || ""
        const isExport = r.id === "WH1" || (p.code && p.code.includes("EXP")) || p.warehouse_type === "EXPORT_WH"
        const whType = p.warehouse_type || (isExport ? "EXPORT_WH" : "PHARMA_WH")
        const whSubtype = p.type || (isExport ? "Export Hub" : "Pharmaceutical Hub")

        await conn.query(
          "UPDATE warehouses SET name = ?, code = ?, location = ?, warehouse_type = ?, type = ? WHERE id = ?",
          [whName, whCode, whLoc, whType, whSubtype, r.id]
        )
        console.log(`  ✓ Migrated warehouse '${r.id}': ${whName} (${whType})`)
      }

      console.log("-> Dropping legacy 'payload' column from warehouses...")
      await conn.query("ALTER TABLE warehouses DROP COLUMN payload")
      console.log("  ✓ Legacy 'payload' column successfully dropped.")
    } else {
      console.log("-> 'payload' column already dropped or does not exist.")
    }

    // Set NOT NULL on required columns
    await conn.query("ALTER TABLE warehouses MODIFY name VARCHAR(255) NOT NULL")
    await conn.query("ALTER TABLE warehouses MODIFY code VARCHAR(100) NOT NULL")

    // -------------------------------------------------------------
    // 2. CREATE SCALABLE EXPORT_WAREHOUSE_MOVEMENTS TABLE
    // -------------------------------------------------------------
    console.log("\n[3/4] Creating 'export_warehouse_movements' table...")
    await conn.query(`
      CREATE TABLE IF NOT EXISTS export_warehouse_movements (
        id VARCHAR(191) PRIMARY KEY,
        warehouse_id VARCHAR(191) NOT NULL,
        product_id VARCHAR(191) NOT NULL,
        movement_type VARCHAR(50) NOT NULL,
        voucher_no VARCHAR(100) NULL,
        batch_no VARCHAR(100) NULL,
        party_name VARCHAR(255) NULL,
        plate_number VARCHAR(100) NULL,
        gross_quantity DECIMAL(18, 2) DEFAULT 0,
        reject_quantity DECIMAL(18, 2) DEFAULT 0,
        net_quantity DECIMAL(18, 2) DEFAULT 0,
        uom VARCHAR(50) DEFAULT 'Quintal',
        unit_price DECIMAL(18, 2) DEFAULT 0,
        movement_date VARCHAR(50) NULL,
        reason TEXT NULL,
        created_by VARCHAR(191) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_ewm_wh (warehouse_id),
        INDEX idx_ewm_prod (product_id),
        INDEX idx_ewm_date (movement_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log("  ✓ 'export_warehouse_movements' table ready.")

    // -------------------------------------------------------------
    // 3. MIGRATE DATA FROM WH1_BATCH_MOVEMENTS IF IT EXISTS
    // -------------------------------------------------------------
    console.log("\n[4/4] Checking and migrating 'wh1_batch_movements' data...")
    const [wh1Tables] = await conn.query("SHOW TABLES LIKE 'wh1_batch_movements'")
    if (wh1Tables.length > 0) {
      const [oldRows] = await conn.query("SELECT * FROM wh1_batch_movements")
      console.log(`-> Found ${oldRows.length} rows in 'wh1_batch_movements' to migrate...`)

      for (const row of oldRows) {
        await conn.query(`
          INSERT INTO export_warehouse_movements (
            id, warehouse_id, product_id, movement_type, voucher_no, batch_no,
            party_name, plate_number, gross_quantity, reject_quantity, net_quantity,
            uom, unit_price, movement_date, reason, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
        `, [
          row.id,
          "WH1", // Default to WH1 for legacy records
          row.product_id,
          row.movement_type,
          row.voucher_no,
          row.batch_no,
          row.party_name,
          row.plate_number,
          row.gross_quantity,
          row.reject_quantity,
          row.net_quantity,
          row.uom,
          row.unit_price,
          row.movement_date,
          row.reason,
          row.created_by,
          row.created_at,
          row.updated_at
        ])
      }
      console.log(`  ✓ Successfully migrated ${oldRows.length} rows into 'export_warehouse_movements'.`)

      console.log("-> Dropping legacy 'wh1_batch_movements' table...")
      await conn.query("DROP TABLE wh1_batch_movements")
      console.log("  ✓ Legacy 'wh1_batch_movements' table dropped.")
    } else {
      console.log("-> 'wh1_batch_movements' table does not exist or has already been migrated.")
    }

    console.log("\n=================================================================")
    console.log("  MIGRATION COMPLETED SUCCESSFULLY!                              ")
    console.log("=================================================================")
  } catch (err) {
    console.error("Migration failed:", err)
    process.exit(1)
  } finally {
    conn.release()
    process.exit(0)
  }
}

runMigration()
