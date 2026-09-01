# HKC-ERP-v5: MySQL & Drizzle ORM Architecture Documentation

## 1. Overview & Architectural Shift

**HKC-ERP-v5** transitions the database layer from PostgreSQL / Supabase PostgREST to a high-performance, self-contained **MySQL 8+ (or MariaDB)** engine powered by **Drizzle ORM (`drizzle-orm/mysql-core` + `mysql2`)**.

### Key Architectural Advantages
1. **Self-Contained & Independent**: No cloud vendor lock-in or PostgREST proxies. The Express backend connects directly to MySQL via optimized TCP connection pooling (`mysql2/promise`).
2. **Type-Safe Drizzle ORM**: 100% compile-time type safety across all 31 business tables with Drizzle schema relations.
3. **Hybrid Schema Strategy**:
   - **Structured Relational Core**: Tables requiring strict relational integrity, foreign keys, or financial calculations (`users`, `sales_issues`, `sales_issue_items`, `processing_services`, `shipment_documents`, `user_activity_logs`) use strongly typed relational columns with MySQL `decimal(18, 2)`, `date`, `varchar(191)`, and foreign key cascades.
   - **Document Payload Tables**: Rapidly evolving ERP master data (`inventory_products`, `warehouses`, `customers`, `invoices`, `journal_entries`, `employees`) use MySQL native `json` data types with indexed `id varchar(191)` primary keys for maximum flexibility and indexing performance.

---

## 2. Table Catalog (31 Production Tables)

| Module | Table Name | Storage Strategy | Key Columns & Descriptions |
| :--- | :--- | :--- | :--- |
| **Admin & Security** | `users` | Relational | `id` (PK, varchar 191), `username` (unique), `password_hash`, `role`, `is_active`, `created_at`, `updated_at` |
| | `user_activity_logs` | Relational | `id` (PK), `user_id` (FK &rarr; `users.id`), `username`, `action`, `module`, `entity_type`, `entity_id`, `details` (json), `created_at` |
| **Inventory** | `warehouses` | JSON Document | `id` (PK), `payload` (JSON), timestamps |
| | `inventory_products`| JSON Document | `id` (PK), `payload` (JSON with stock breakdown, batches, UOM), timestamps |
| | `stock_movements` | JSON Document | `id` (PK), `payload` (JSON with transaction history, bins), timestamps |
| | `store_transfers` | JSON Document | `id` (PK), `payload` (JSON with dispatch/receipt items), timestamps |
| **Sales & CRM** | `customers` | JSON Document | `id` (PK), `payload` (JSON with Bank Permits, Trade Licenses, TIN, VAT), timestamps |
| | `suppliers` | JSON Document | `id` (PK), `payload` (JSON with supplier contact & credit details), timestamps |
| | `sales_orders` | JSON Document | `id` (PK), `payload` (JSON with line items, WH gating, approval status), timestamps |
| | `purchase_orders` | JSON Document | `id` (PK), `payload` (JSON with shipment terms, proforma details), timestamps |
| | `hkc_doc_records` | JSON Document | `id` (PK), `payload` (JSON with trade attachments & scans), timestamps |
| | `sales_issues` | Relational | `id` (PK), `sales_order_id`, `issue_number`, `customer_id`, `issue_date`, `status`, `total_amount` (decimal 18,2), `payment_status`, `payment_method`, timestamps |
| | `sales_issue_items` | Relational | `id` (PK), `sales_issue_id` (FK &rarr; `sales_issues.id`), `product_id`, `quantity` (decimal 18,2), `unit_price`, `total_price`, `batch_number`, timestamps |
| | `processing_services`| Relational | `id` (PK), `reference_number`, `client_company_name`, `quantity`, `uom`, `agreed_price`, `status`, `status_history` (JSON), fee breakdowns, timestamps |
| | `shipment_documents`| Relational | `id` (PK), `record_id`, `record_type`, `document_type`, `file_name`, `file_size`, `file_url`, timestamps |
| **Finance & GL** | `company_settings` | JSON Document | `id` (PK), `payload` (JSON with tax rates, currencies, fiscal years), timestamps |
| | `chart_of_accounts`| JSON Document | `id` (PK), `payload` (JSON with account numbers, types, opening balances), timestamps |
| | `journal_entries` | JSON Document | `id` (PK), `payload` (JSON with double-entry debits/credits), timestamps |
| | `journal_entry_lines`| JSON Document | `id` (PK), `payload` (JSON with subledger splits), timestamps |
| | `invoices` | JSON Document | `id` (PK), `payload` (JSON with AR/AP line items, payment schedule), timestamps |
| | `payments` | JSON Document | `id` (PK), `payload` (JSON with transaction reference, bank slip, allocation), timestamps |
| | `expenses` | JSON Document | `id` (PK), `payload` (JSON with cost center, receipts), timestamps |
| | `recurring_expense_schedules` | JSON Document | `id` (PK), `payload` (JSON with cron schedule & amounts), timestamps |
| | `vehicles` | JSON Document | `id` (PK), `payload` (JSON with fleet logistics & asset value), timestamps |
| | `tax_rules` | JSON Document | `id` (PK), `payload` (JSON with Ethiopian VAT / Withholding thresholds), timestamps |
| **HR & Payroll** | `employees` | JSON Document | `id` (PK), `payload` (JSON with personal, salary, department info), timestamps |
| | `attendance_records`| JSON Document | `id` (PK), `payload` (JSON with punch logs & overtime), timestamps |
| | `payroll_periods` | JSON Document | `id` (PK), `payload` (JSON with pay cycle cutoff & approval status), timestamps |
| | `payroll_records` | JSON Document | `id` (PK), `payload` (JSON with gross pay, tax deductions, net payout), timestamps |
| | `leave_types` | JSON Document | `id` (PK), `payload` (JSON with annual quota, paid/unpaid policies), timestamps |
| | `leave_requests` | JSON Document | `id` (PK), `payload` (JSON with leave balance, approval chain), timestamps |

---

## 3. Directory Layout

```
HKC-ERP-v5/
├── dist/                          # Production Vite bundle
├── docs/
│   └── DATABASE_ARCHITECTURE.md   # Complete MySQL & Drizzle Architecture Guide
├── server/
│   ├── config.js                  # MySQL Connection & Server Environment Config
│   ├── index.js                   # Express App & Master Router Mount
│   ├── logger.js                  # Request logging middleware
│   ├── db/
│   │   ├── client.js              # MySQL2 Connection Pool & Drizzle DB Instance
│   │   ├── drizzleCrud.js         # Native MySQL Drizzle CRUD Service
│   │   ├── resourceRegistry.js    # Master Resource & Route Registry
│   │   ├── migrations/            # Generated MySQL DDL Migrations
│   │   │   └── 0000_remarkable_banshee.sql
│   │   └── schema/                # Drizzle MySQL Schemas
│   │       ├── index.js           # Master Schema Entrypoint
│   │       ├── admin.schema.js    # Users & Activity Logs
│   │       ├── inventory.schema.js# Warehouses, Products, Stock Movements
│   │       ├── sales.schema.js    # Sales Orders, Issues, Processing Services
│   │       ├── finance.schema.js  # GL, Invoices, COA, Payments, Taxes
│   │       └── hr.schema.js       # Employees, Payroll, Attendance, Leaves
│   ├── modules/
│   │   ├── auth/                  # JWT Authentication & Passwords
│   │   ├── common/                # Audit Activity Logger & Shared Helpers
│   │   ├── finance/               # Ledger & Finance Services
│   │   ├── hr/                    # Payroll & HR Services
│   │   ├── inventory/             # Stock Engines
│   │   └── sales/                 # Order Compliance & Issue Fulfillment
│   └── router/                    # Express Router Endpoints
├── src/                           # React 19 Frontend (Vite + TailwindCSS + Zustand)
├── tests/
│   └── test-mysql-drizzle.mjs     # 41-Point Schema & Drizzle Verification Suite
├── drizzle.config.ts              # Drizzle Kit MySQL Config
├── package.json                   # Dependencies (mysql2, drizzle-orm)
└── seedAuth.js                    # Admin user seeding script for MySQL
```

---

## 4. Configuration & Environment Variables

Create a `.env` file in the project root:

```env
# MySQL Connection String
DATABASE_URL=mysql://root:password@localhost:3306/hkc_erp_v5

# Or Individual Connection Parameters
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=hkc_erp_v5

# Express API Server
PORT=1000
SERVER_HOST=0.0.0.0
JWT_SECRET=your_super_secret_jwt_key_here

# Frontend API URL
VITE_API_URL=http://localhost:1000
```

---

## 5. Running Migrations & CLI Commands

### Generate New Migrations
```bash
npm run db:generate
```
Reads schemas from `server/db/schema/index.js` and outputs MySQL DDL files in `server/db/migrations/`.

### Push Schema Directly to Database
```bash
npm run db:push
```
Applies schema definitions directly to the connected MySQL instance.

### Open Drizzle Studio UI
```bash
npm run db:studio
```
Launches a visual database browser for inspecting and editing MySQL records.

### Seed Initial Super Admin
```bash
npm run seed:auth
```
Creates default admin credentials: `Username: admin | Password: SuperadminPassword1!`.

### Run Verification Test Suite
```bash
node tests/test-mysql-drizzle.mjs
```

---

## 6. Deployment Guide

### Option A: Plesk / cPanel / Ubuntu VPS (Single Server)
1. Install **Node.js 20+** and **MySQL 8.0+**.
2. Create a database `hkc_erp_v5` and grant full privileges to your DB user.
3. Build the frontend:
   ```bash
   npm run build
   ```
4. Run migrations:
   ```bash
   npm run db:push
   npm run seed:auth
   ```
5. Start the server via PM2 or Passenger:
   ```bash
   node server/index.js
   ```

### Option B: Cloud Split Deployment (Vercel Frontend + Render / Railway Backend + AWS RDS / PlanetScale MySQL)
1. Provision a MySQL database instance (e.g. AWS RDS or PlanetScale).
2. Deploy the `server/` directory to **Render** or **Railway** with `DATABASE_URL` and `JWT_SECRET`.
3. Deploy the frontend to **Vercel** with `VITE_API_URL=https://your-backend-api.onrender.com`.
