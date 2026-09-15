# HKC ERP v5 — Comprehensive System Context & Architectural Guide

> **IMPORTANT**: This repository (`/Users/Noah/Documents/React/HKC-ERP-v5`) is the **sole active production codebase**. Legacy versions (e.g. `v4`) are completely abandoned. All features, bug fixes, database migrations, and business logic live here.

---

## 1. System Architecture & Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend UI** | React 19, TypeScript ~5.9, Vite 7, Tailwind CSS v4 | SPA with modular pages, responsive tables, modals, and real-time computation |
| **State Management** | Zustand (`erpStore.ts`, `financeStore.ts`, `authStore.ts`) | Reactive client stores with automated REST API synchronization |
| **Backend Server** | Node.js 22, Express 5 | Modular domain routers, RBAC authorization, Drizzle CRUD, connection pooling |
| **Database** | MySQL 8 (`hkc_trading`) | 38 tables (Relational tables + JSON document hybrid storage) |
| **Authentication** | JWT (HS256) + Argon2/Bcrypt + MySQL `user_sessions` | Stateful session verification, auto-expiry warning modal, multi-role RBAC |

---

## 2. Port & Proxy Architecture

- **Dev Mode (`npm run dev`)**:
  - Vite dev server runs on **port 1000** (`http://127.0.0.1:1000`).
  - Vite proxies all `/api/*` requests to Express backend running on **port 5000** (`http://127.0.0.1:5000` or `process.env.SERVER_PORT`).
  - *Safety Guard*: `vite.config.ts` prevents self-proxy loops if `PORT=1000` is defined in `.env`.
- **Backend Server (`npm run server` / `node server/index.js`)**:
  - Express runs on port 5000 in dev (or 1000 in standalone production/Plesk mode).
  - In production, Express statically serves the compiled `dist/` SPA with client-side catch-all routing.
- **MySQL Database Connection**:
  - Host: `127.0.0.1:3306`
  - Database: `hkc_trading`
  - User: `habtom`
  - Password: `DMka6&jn0*Wsdfo0`

---

## 3. Warehouse & Inventory Domain Rules

### A. WH1: Agricultural Export Hub (`WH1-AGRI-EXP`)
- **Dedicated Tables**: `export_products` & `export_warehouse_movements`.
- **Sub-Entry Independent Pricing (Zero Homogenization)**:
  - Inbound child truckloads/entries (`wh1Entries`) maintain their independent unit costs (e.g., Truck 1: 100 Qtl @ 200 ETB, Truck 2: 100 Qtl @ 350 ETB).
  - Editing or adding a sub-entry **never** averages or homogenizes other sub-entry prices.
- **Valuation Deduction strictly at COGS (Acquisition Cost)**:
  - When outbound dispatches or Sales Issues are recorded at higher selling prices (e.g., sold @ 500 ETB), the warehouse asset valuation (`totalStockValue`) is deducted **strictly at Acquisition Cost / COGS** (FIFO).
  - Prevents negative or artificially deflated stock valuations.
- **Ledger UI (`WH1ChildMovementLedger.tsx`)**:
  - Dedicated **Unit Cost (ETB)** and **Selling Price / Value (ETB)** columns.
  - Inbound entries display acquisition cost. Outbound dispatches display COGS in `Unit Cost` and invoiced price in `Selling Price / Value`.
  - Footer displays **Net Stock Value (ETB)** (at cost, matching parent table) and **Total Invoiced Sales (ETB)**.

### B. WH2 & WH3: Pharmaceutical Import Hubs (`WH2-VET-IND`, `WH3-VET-CHN`)
- **Dedicated Tables**: `pharma_products`, `pharma_product_batches`, `stock_movements`.
- **Batch Tracking**:
  - Batches track `batch_no`, `mfg_date`, `expiry_date`, `quantity`, `unit_cost`, and `qa_status` (`Released`, `Quarantined`, `Rejected`).
- **Batch-Specific Quarantine Cost Deduction**:
  - Placing items into quarantine looks up that targeted batch's exact acquisition unit price (`targetBatch.unitPrice` / `costPrice`) and deducts the inventory asset value based on that exact cost.
- **Ledger UI (`StockBinCardLedger.tsx`)**:
  - Features dedicated **Unit Cost (ETB)** and **Selling Price / Value (ETB)** columns alongside batch and expiry information.

---

## 4. Complete Database Architecture (38 Tables)

| Module | Table Name | Storage Mode | Purpose |
|---|---|---|---|
| **Inventory** | `warehouses` | Relational | Multi-warehouse registry (WH1 Export, WH2 India, WH3 China) |
| | `export_products` | Relational | Agricultural export commodity products |
| | `export_warehouse_movements` | Relational | Inbound truckloads (GRV) and outbound dispatches for WH1 |
| | `pharma_products` | Relational | Pharmaceutical and veterinary medicines catalog |
| | `pharma_product_batches` | Relational | Batch lots with manufacturing, expiry, and QA status |
| | `quarantine_records` | Relational | Regulatory hold and quarantine ledger |
| | `stock_movements` | Relational | Bin card stock movements for pharma warehouses |
| | `store_transfers` | Relational | Inter-warehouse inventory transfers |
| | `store_transfer_items` | Relational | Transfer itemized lines |
| **Sales** | `sales_orders` | JSON Document | Customer sales orders |
| | `purchase_orders` | Relational | Supplier purchase orders with attachments and payment terms |
| | `sales_issues` | Relational | Official Sales Issue vouchers (FS numbers) |
| | `sales_issue_items` | Relational | Itemized lines with batch attribution and quantities |
| | `customers` | JSON Document | Client directory |
| | `suppliers` | JSON Document | Vendor directory |
| | `processing_services` | Relational | Sesame / pulse cleaning and processing contracts |
| | `shipment_documents` | Relational | BOL, customs, packing list attachments |
| | `hkc_doc_records` | JSON Document | Export documentation tracking |
| **Finance** | `chart_of_accounts` | JSON Document | Master Chart of Accounts (COA) |
| | `gl_account_mappings` | Relational | Automatic GL account mapping rules |
| | `journal_entries` | JSON Document | General Ledger journal entries |
| | `journal_entry_lines` | JSON Document | Double-entry debit/credit line items |
| | `invoices` | JSON Document | Customer sales invoices |
| | `payments` | JSON Document | Cash/bank payments and collections |
| | `expenses` | JSON Document | Operating and administrative expenses |
| | `recurring_expense_schedules`| JSON Document | Recurring expense schedules |
| | `vehicles` | JSON Document | Fleet and vehicle management |
| | `company_settings` | JSON Document | Company profile, currencies, fiscal year config |
| | `tax_rules` | JSON Document | VAT (15%), TOT (2%/10%), Withholding rules |
| **HR & Payroll** | `employees` | JSON Document | Employee profiles and contracts |
| | `attendance_records` | JSON Document | Daily biometric and manual attendance |
| | `payroll_periods` | JSON Document | Monthly payroll cycles |
| | `payroll_records` | JSON Document | Employee payslips with tax and pension deductions |
| | `leave_types` | JSON Document | Annual, sick, maternity leave policies |
| | `leave_requests` | JSON Document | Employee leave approvals |
| **Admin** | `users` | Relational | User accounts with roles and hashed passwords |
| | `user_activity_logs` | Relational | Audit trail for create/update/delete actions |
| | `user_sessions` | Relational | Active login sessions and expiry tracking |

> ⚠️ **Note**: `inventory_products` was the legacy v3/v4 monolith table and **does not exist** in v5. Product queries always route through `export_products` and `pharma_products` via `inventoryService`.

---

## 5. Directory Structure & Key Files

```text
HKC-ERP-v5/
├── server/
│   ├── config.js                     # Environment & MySQL configuration
│   ├── index.js                      # Express master app & server initialization
│   ├── db/
│   │   ├── client.js                 # MySQL connection pool (`mysql2/promise`)
│   │   ├── resourceRegistry.js       # Master mapping of all 38 resources & storage types
│   │   ├── drizzleCrud.js            # Universal CRUD query engine for MySQL
│   │   └── schema/                   # Drizzle ORM schema definitions
│   ├── modules/
│   │   ├── auth/                     # JWT authentication, RBAC, session management
│   │   ├── inventory/                # Product, batch, movement, and quarantine logic
│   │   ├── sales/                    # Sales issues, PO/SO, processing services
│   │   ├── finance/                  # COA, journal entries, payroll accounting
│   │   └── hr/                       # Attendance, payroll, employee management
│   └── router/                       # Domain routers (auth, inventory, sales, finance, hr, crud)
│
├── src/
│   ├── lib/
│   │   ├── erpStore.ts               # Core Zustand store (Inventory, Sales, HR)
│   │   ├── financeStore.ts           # Finance Zustand store (COA, Ledger, Invoices)
│   │   ├── authStore.ts              # Authentication state & session checks
│   │   └── requestMonitor.ts         # Diagnostic request monitoring
│   ├── components/
│   │   ├── stock/
│   │   │   ├── WH1ChildMovementLedger.tsx   # WH1 Export child movement ledger & pricing
│   │   │   ├── StockBinCardLedger.tsx       # Pharma bin card ledger
│   │   │   └── QuarantineTab.tsx            # Quarantine management
│   │   └── auth/
│   │       └── SessionExpiryWarningModal.tsx # Inactivity warning modal
│   └── pages/
│       ├── inventory/StockProducts.tsx      # Main Inventory management page
│       ├── sales/SalesIssued.tsx            # Sales issue register
│       ├── SalesOrders.tsx                  # Sales order management
│       ├── PurchaseOrders.tsx               # Purchase order management
│       ├── finance/                         # Finance, Invoicing, Banking, Taxes
│       └── hr/                              # Employee, Payroll, Attendance
│
├── vite.config.ts                    # Vite config (port 1000 with safe proxy to 5000)
├── package.json                      # Dependencies and npm scripts
└── SYSTEM_CONTEXT_V5.md              # This document
```

---

## 6. Critical Developer Workflows & Commands

### Running Dev Environment:
```bash
# 1. Start Express Backend (Runs on port 5000)
npm run server

# 2. Start Vite Dev Server (In a separate terminal, runs on port 1000)
npm run dev
```

### Production Build & Verification:
```bash
# Run full TypeScript check and production bundle build
npm run build

# Run unit and end-to-end tests
node server/verifyMysqlComplete.js
```

### Resetting Admin Account:
```bash
# Seeds or resets superadmin account (admin / SuperadminPassword1!)
npm run admin:reset
```

---

## 7. Rules for Future Sessions & Agents

1. **Strictly Target `/Users/Noah/Documents/React/HKC-ERP-v5`**: Never create or modify files in `v4` or temporary scratch directories outside the project.
2. **Preserve Sub-Entry Independence**: Never re-introduce price homogenization on WH1 inbound truckloads or Pharma batches.
3. **Valuation at COGS**: Keep stock deduction at acquisition cost when dispatches or sales occur at different prices.
4. **All 38 Tables Active**: Keep `resourceRegistry.js` and `crudRouter.js` synchronized with all 38 tables in MySQL.
5. **No Infinite Loading Skeletons**: Keep `isInventoryLoading()` and `isSalesLoading()` defensive in `erpStore.ts` so empty states render cleanly.
