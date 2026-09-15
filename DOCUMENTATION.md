# HKC Trading ERP v5 — Comprehensive System, Architecture & Design Documentation

Welcome to the definitive system, modules, design, and modular architecture documentation for **HKC Trading ERP v5**. This document serves as the single source of truth for UI/UX styling, full-stack architecture, business engines, MySQL database schemas, and page-by-page component patterns.

---

## 🎨 Design Philosophy & Theme System

HKC Trading is built around an **iOS 26-inspired Glassmorphism** visual language. It values generous negative space, sophisticated typography pairing, subtle background organic motion, and responsive layout dynamics over standard block dashboards.

### 1. Typography Selection
- **Primary / Display UI Font:** `Outfit` (sans-serif) paired with `Inter` to provide a premium, modern, tech-forward aesthetic.
- **Data / Code Font:** `JetBrains Mono` for financial ledgers, numbers, batch tags, codes, and system readouts.
- **Configuration (Tailwind CSS v4 inline config inside `src/index.css`):**
  ```css
  --font-sans: "Outfit", "Inter", ui-sans-serif, system-ui, sans-serif;
  ```

### 2. Color Space (OKLCH)
Modern high-gamut `oklch()` color definitions ensure smooth gradient rendering and outstanding contrast in both light and dark modes. The brand color is an organic forest green (hue 145).

| Variable Name | Light Mode (OKLCH) | Dark Mode (OKLCH) |
| :--- | :--- | :--- |
| `--background` | `oklch(0.99 0 0)` | `oklch(0.1 0 0)` |
| `--foreground` | `oklch(0.1 0 0)` | `oklch(0.99 0 0)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.14 0 0)` |
| `--primary` | `oklch(0.48 0.16 145)` (Organic Forest Green) | `oklch(0.68 0.16 145)` (Vibrant Mint Green) |
| `--secondary` | `oklch(0.96 0 0)` | `oklch(0.2 0 0)` |
| `--accent` | `oklch(0.96 0.02 145)` (Soft Tint Green) | `oklch(0.22 0.06 145)` (Deep Muted Green) |
| `--destructive` | `oklch(0.15 0 0)` | `oklch(0.99 0 0)` |
| `--border` | `oklch(0.9 0 0)` | `oklch(1 0 0 / 10%)` |

---

## 💎 Custom Classes & Special Visual Styles

### 1. iOS 26 Glass Card (`.glass-card`)
A translucent container styled with saturation filters, fine borders, and depth overlays:
- **Light Mode:** `rgba(255, 255, 255, 0.35)` background, `blur(40px) saturate(240%)`, `1px solid rgba(255, 255, 255, 0.65)` border, subtle bottom shadow + top-inset white highlight.
- **Dark Mode (`.dark .glass-card`):** `rgba(20, 20, 22, 0.38)` background, `blur(40px) saturate(240%)`, `1px solid rgba(255, 255, 255, 0.06)` border, beveled inset highlight with safe dark occlusion shadow.

### 2. Organic Page Gradients (`.page-gradient` & `.page-gradient-dark`)
- **Light Theme Gradient:** White/grey canvas with subtle green aura points (`rgba(34, 197, 94, 0.08)` and `rgba(34, 197, 94, 0.04)`), layered with a radial-pattern dot grid layout (`opacity: 0.15`, space `24px`) and a rotating cosmic vector circle (`animation: slow-spin 120s linear infinite`).
- **Dark Theme Gradient:** Dark charcoal canvas (`#09090b` through `#18181b`) with delicate glowing organic green accents (`rgba(34, 197, 94, 0.06)`) and blueprint grid overlay.

---

## 🗺️ Application Architecture & Complete Routes

The client routing tree (`src/App.tsx`) is structured across six main functional areas:

```text
/ (Role-Based Redirect) ──► /sales | /inventory | /finance | /hr | /admin | /sales/hkc-docs

/sales ───────────────────► /sales (Sales Revenue Analytics & Conversion Pipeline)
                            ├── /sales/sales-issued (Sales Issues & Stock Release Vouchers)
                            │   └── /sales/sales-issued/:id/attachment (Credit Sales Attachment)
                            ├── /sales/sales-orders (Sales Orders & Order Fulfillment)
                            ├── /sales/purchase-orders (Purchase Orders & Supplier Procurement)
                            └── /sales/hkc-docs (Centralized Trade & Compliance Documentation)

/inventory ───────────────► /inventory (Inventory & Storage Operations Dashboard)
                            ├── /inventory/stock (Stock Registry, Batches & Store Transfers)
                            │   └── /inventory/stock/add-item (Stock Item Registration)
                            └── /inventory/processing-services (Warehouse 1 Toll Processing Contracts)

/finance ─────────────────► /finance (Treasury Dashboard, Receivables & Cash Position)
                            ├── /finance/ledger (General Ledger, Journal Entries, COA, Fiscal Periods)
                            ├── /finance/invoices (Accounts Receivable Invoicing Engine)
                            ├── /finance/expenses (Expense Ledger, Recurring Schedules & Fleet)
                            ├── /finance/banking (Bank Accounts & Statement Reconciliations)
                            ├── /finance/taxes (Ethiopian Tax Rules: 15% VAT, 2%/10% TOT, WHT)
                            ├── /finance/reports (General Ledger, Trial Balance, Balance Sheet, P&L)
                            └── /finance/export (Financial Data Export Center)

/hr ──────────────────────► /hr (HR Department Overview & Team KPIs)
                            ├── /hr/employees (Staff Directory & Personnel Profiles)
                            ├── /hr/attendance (Daily Biometric & Manual Attendance Matrix)
                            ├── /hr/leave (Leave Balances & Time-Off Approvals)
                            └── /hr/payroll (Monthly Ethiopian Payroll & Payslips)

/admin ───────────────────► /admin (Module Control Center & Audit Trail)
                            ├── /admin/users (User Accounts & Role Permissions)
                            ├── /admin/partners (Customer & Supplier Master Registry)
                            └── /admin/settings (System Configurations & Company Profile)

/profile ─────────────────► /profile (Active User Profile & Security)
/login ───────────────────► /login (Authentication)
```

---

## 🧱 Master Modular Full-Stack Architecture

Business logic is organized into clean layers: frontend state stores (`src/lib/`), headless domain engines (`src/core/`), Express REST routers (`server/router/`), domain backend services (`server/modules/`), and a MySQL database abstraction layer (`server/db/`).

```text
HKC-ERP-v5/
├── server/
│   ├── config.js                       # Environment & Port configuration
│   ├── index.js                        # Express 5 entrypoint with middleware and logging
│   ├── logger.js                       # Request & error logging subsystem
│   ├── db/
│   │   ├── client.js                   # MySQL 2 connection pool (`mysql2/promise`)
│   │   ├── resourceRegistry.js         # Master registry mapping all 38 tables and storage modes
│   │   ├── drizzleCrud.js              # Universal MySQL CRUD query engine
│   │   └── schema/                     # Drizzle ORM schemas (Relational & JSON)
│   ├── modules/
│   │   ├── auth/                       # JWT auth, RBAC authorization, password hashing
│   │   ├── inventory/                  # Product valuation, truckload FIFO, batch allocation
│   │   ├── sales/                      # Sales issues, purchase orders, document compliance
│   │   ├── finance/                    # General ledger, payroll accounting, COA mappings
│   │   └── hr/                         # Employee lifecycle, attendance, payroll calculations
│   └── router/
│       ├── authRouter.js               # /api/auth endpoints (login, logout, me, refresh)
│       ├── inventoryRouter.js          # /api/inventory, products, stock movements
│       ├── salesRouter.js              # /api/sales-issues, /api/purchase-orders, /api/sales-orders
│       ├── financeRouter.js            # /api/payroll-records/:id/pay, /api/journal-entries
│       ├── hrRouter.js                 # /api/employees, /api/attendance-records, /api/payroll-periods
│       └── crudRouter.js               # Universal /api/:resource REST router for all 38 tables
│
├── src/
│   ├── lib/
│   │   ├── erpStore.ts                 # Inventory, Sales, and Procurement Zustand store
│   │   ├── financeStore.ts             # Finance, Ledger, Invoicing, and Treasury Zustand store
│   │   ├── authStore.ts                # Session state, tokens, and RBAC helpers
│   │   ├── warehouses.ts               # Warehouse metadata and helper functions
│   │   └── nav-config.ts               # Top-level and subpage navigation definitions
│   ├── core/                           # Headless pure calculation engines
│   │   ├── finance/                    # Ledger balance validator, tax math, financial statement generator
│   │   ├── inventory/                  # FIFO depletion, reorder triggers, transfer validator
│   │   ├── sales/                      # Order pipeline status transitions
│   │   └── hr/                         # Ethiopian progressive tax tiers & pension math
│   ├── components/                     # Reusable glassmorphic UI components
│   └── pages/                          # Routed domain pages
```

---

## 💾 Database Architecture (MySQL 8 — 38 Tables)

The system persists state directly into MySQL 8 (`hkc_trading`) using a hybrid strategy: normalized relational tables for high-frequency queries and joins, alongside JSON document storage for flexible schemas.

### Relational Tables
1. `warehouses` — Warehouse directory (WH1 Export, WH2 India Pharma, WH3 China Pharma).
2. `export_products` — Agricultural export commodity catalog (WH1).
3. `export_warehouse_movements` — Inbound truckloads (GRV) and outbound dispatches for WH1.
4. `pharma_products` — Veterinary & pharmaceutical medicines catalog (WH2 & WH3).
5. `pharma_product_batches` — Product batch lots with manufacturing, expiry, and QA status.
6. `quarantine_records` — Regulatory hold and quarantine registry.
7. `stock_movements` — Bin card movements for pharmaceutical warehouses.
8. `store_transfers` — Inter-warehouse inventory transfers.
9. `store_transfer_items` — Itemized transfer lines.
10. `purchase_orders` — Supplier purchase orders with attachments and payment terms.
11. `sales_issues` — Official Sales Issue vouchers (FS numbers).
12. `sales_issue_items` — Itemized sales issue lines with batch attribution.
13. `processing_services` — WH1 sesame / pulse cleaning and processing contracts.
14. `shipment_documents` — BOL, customs, trade license, and payment advice attachments.
15. `gl_account_mappings` — Automatic GL account posting mapping rules.
16. `users` — User accounts with role arrays and hashed passwords.
17. `user_activity_logs` — System audit trail for create, update, delete, and post actions.
18. `user_sessions` — Active login sessions and expiry tracking.

### JSON Document Tables
19. `sales_orders` — Customer sales order contracts.
20. `customers` — Client directory.
21. `suppliers` — Vendor directory.
22. `hkc_doc_records` — Export trade documentation registry.
23. `chart_of_accounts` — Master Chart of Accounts (COA).
24. `journal_entries` — General Ledger journal entries.
25. `journal_entry_lines` — Double-entry debit/credit line items.
26. `invoices` — Accounts Receivable sales invoices.
27. `payments` — Cash/bank collections and disbursements.
28. `expenses` — Operating and administrative expenses.
29. `recurring_expense_schedules` — Recurring expense schedules.
30. `vehicles` — Fleet and vehicle expense management.
31. `company_settings` — Company profile, currencies, fiscal year config.
32. `tax_rules` — VAT (15%), TOT (2%/10%), Withholding rules.
33. `employees` — Employee profiles and contract details.
34. `attendance_records` — Daily biometric and manual attendance logs.
35. `payroll_periods` — Monthly payroll cycles.
36. `payroll_records` — Employee monthly payslips.
37. `leave_types` — Annual, sick, maternity leave policies.
38. `leave_requests` — Employee leave applications and approval status.

> ⚠️ **Monolith Table Note**: `inventory_products` was the legacy v3/v4 monolith table and is not used in v5. Product data routes exclusively through `export_products` and `pharma_products`.

---

## ⚡ Core Domain Rules & Business Logic

### 1. WH1 Agricultural Export Hub (`WH1-AGRI-EXP`)
- **Sub-Entry Independent Pricing (Zero Homogenization)**: Inbound child truckloads (`wh1Entries`) maintain their distinct unit acquisition costs (e.g. Truck 1: 100 Qtl @ 200 ETB, Truck 2: 100 Qtl @ 350 ETB). Editing or adding a sub-entry never averages or homogenizes other sub-entry prices.
- **Valuation Deduction strictly at COGS (Acquisition Cost)**: Outbound dispatches and sales issues deduct warehouse asset valuation (`totalStockValue`) strictly at acquisition cost / FIFO, preventing artificially deflated or negative stock valuations when goods are sold at a markup.

### 2. WH2 & WH3 Pharmaceutical Import Hubs (`WH2-VET-IND`, `WH3-VET-CHN`)
- **Batch Tracking & QA Approvals**: Batches track `batch_no`, `mfg_date`, `expiry_date`, `quantity`, `unit_cost`, and `qa_status` (`Released`, `Quarantined`, `Rejected`).
- **Batch-Specific Quarantine Cost Deduction**: Placing items into quarantine looks up the targeted batch's exact acquisition unit price and deducts the inventory asset value based on that exact cost.

### 3. Toll Processing Services (`/inventory/processing-services`)
- **No Ownership / Asset Transfer**: Customer raw agricultural goods brought in for toll processing are **never** recorded as WH1 inventory assets and **never** generate COGS.
- **3-Stage Pipeline**: Standardized progression: **`Received`** $\rightarrow$ **`Processed`** $\rightarrow$ **`Delivered`**.
- **Automated Service Revenue**: Transitioning an order to `Delivered` automatically generates an AR Invoice and posts a GL Journal Entry: **DEBIT 1200 Accounts Receivable / CREDIT 4002 Service Processing Revenue**.

### 4. Real-Time Finance & General Ledger Integration
All business operations sync directly with `src/lib/financeStore.ts`:
- **Sales Issues**: Post to General Ledger as `JE-SI-xxxx` (**Debit 1200 AR, Credit 4000 Sales Revenue, Credit 2210 Tax Liability**).
- **Purchase Orders**: Post as Procurement GL Accrual Entries (`JE-PO-xxxx`) (**Debit 1010 Inventory Asset, Credit 2000 Accounts Payable**).
- **Processing Services**: Post as Service Revenue (`JE-PROC-xxxx`) (**Debit 1200 AR, Credit 4002 Service Revenue**).
- **Payroll**: Monthly disbursement runs post to General Ledger as `JE-PAY-xxxx` (**Debit 5000 Salary Expense, Credit 2300 Payroll Payable, Credit 2210 Withholding Tax Payable**).

### 5. Ethiopian Payroll & Tax Engine
- **Income Tax Calculation**: Computes progressive Ethiopian income tax brackets (0% up to 600 ETB, progressing to 35% above 10,900 ETB).
- **Pension Contributions**: Automatically calculates 7% Employee Pension deduction and 11% Employer Pension contribution.

---

## 🔒 Security, RBAC & Audit Trails

- **JWT + Session Store**: Stateful session tokens verified against the MySQL `user_sessions` table with automatic inactivity warnings.
- **Multi-Warehouse Scoping**: Users with the `inventory_admin` role are constrained to their assigned `warehouse_ids`.
- **System Audit Logging**: Every state-modifying API request (POST, PUT, PATCH, DELETE) is logged in `user_activity_logs` and monitored in the Admin Control Center (`/admin`).
