# HKC Trading - System, Modules & Design Documentation

Welcome to the comprehensive system, modules, design, and modular architecture documentation for **HKC Trading**. This document serves as the single source of truth for styling, architecture, headless engines, database schemas, logging systems, and page-by-page component patterns used across the application.

---

## 🎨 Design Philosophy & Theme System

HKC Trading is built around a distinct, high-end **Glassmorphism** visual language inspired by iOS 26 style ergonomics. It values generous negative space, sophisticated typography pairing, subtle background organic motion, and responsive layout dynamics over standard block-style dashboards.

### 1. Typography Selection
- **Primary / Display UI Font:** `Outfit` (sans-serif) paired with `Inter` to provide a premium, modern, tech-forward aesthetic.
- **Data / Code Font:** `JetBrains Mono` for technical data, code snippets, numbers, and system readouts.
- **Configuration (Tailwind CSS v4 inline config inside `src/index.css`):**
  ```css
  --font-sans: "Outfit", "Inter", ui-sans-serif, system-ui, sans-serif;
  ```

### 2. Color Space (OKLCH)
We utilize modern high-gamut `oklch()` color definitions to ensure smooth gradient rendering and outstanding contrast in both light and dark modes. The brand color is an organic forest green (hue 145).

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
A premium container styled with saturation filters, fine-border borders, and translucent background overlays.
- **Light Mode:**
  - Background: `rgba(255, 255, 255, 0.35)`
  - Backdrop Filter: `blur(40px) saturate(240%)`
  - Border: `1px solid rgba(255, 255, 255, 0.65)`
  - Shadow: Subtle bottom shadow + top-inset white highlight for bevel feeling.
- **Dark Mode (`.dark .glass-card`):**
  - Background: `rgba(20, 20, 22, 0.38)`
  - Backdrop Filter: `blur(40px) saturate(240%)`
  - Border: `1px solid rgba(255, 255, 255, 0.06)`
  - Shadow: Beveled inset highlight with safe dark occlusion shadow.

### 2. Premium Organic Page Gradients (`.page-gradient` & `.page-gradient-dark`)
A layered background that establishes a distinct brand atmosphere.
- **Light Theme Gradient:** Combines a clean white/grey canvas with subtle organic green accents:
  - Background radial gradients feature subtle green aura points (`rgba(34, 197, 94, 0.08)` and `rgba(34, 197, 94, 0.04)`) layered over a clean 135deg linear gradient sliding from `#ffffff` through `#f4f4f5` to `#e4e4e7`.
  - **Dotted Grid Overlay:** A high-end radial-pattern dot grid layout (`opacity: 0.15`, space `24px`) provides a clean structural blueprint aesthetic.
  - **Animated Line Circle:** A dashed rotating cosmic vector line circle (`animation: slow-spin 120s linear infinite`, size `500px x 500px`) sits off-screen at the top-right.
- **Dark Theme Gradient:** Swaps to a rich dark charcoal canvas (`#09090b` through `#18181b`) featuring delicate glowing organic green accents (`rgba(34, 197, 94, 0.06)` and `rgba(34, 197, 94, 0.02)`) with a white dot blueprint overlay (`opacity: 0.08`).

---

## 🗺️ Application Architecture & Routes

The system uses a full-screen layout split into five main operational domains:

```
/ (Root Redirect) ──► /sales
                      ├── /sales (Sales Revenue Analytics & Conversion Pipeline)
                      ├── /sales/purchase-orders (Purchase Orders & Supplier Procurement)
                      ├── /sales/sales-orders (Sales Orders & Order Fulfillment)
                      └── /sales/issued (Sales Issues & Stock Dispatch Vouchers)

/inventory ─────────► /inventory (Inventory & Storage Operations Dashboard)
                      ├── /inventory/reports (Inventory Movement & Valuation Analytics)
                      ├── /inventory/stock (Stock & Products Registry, Store Transfers)
                      └── /inventory/processing-services (Warehouse 1 Processing Services)

/finance ───────────► /finance (Overview Charts & Financial Ratios)
                      ├── /finance/ledger (General Ledger, Journal Entries, COA, Periods, Forex Revaluation)
                      ├── /finance/invoices (Invoicing Engine)
                      ├── /finance/expenses (Expense Ledger, Recurring Schedules & Fleet)
                      ├── /finance/banking (Bank Accounts & Reconciliations)
                      ├── /finance/assets (Fixed Assets Register & Depreciation Schedule)
                      ├── /finance/taxes (Tax Templates & Rates)
                      └── /finance/reports (Financial Statements, General Ledger & Trial Balance)

/hr ────────────────► /hr (Overview & Team KPIs)
                      ├── /hr/employees (Staff Roster)
                      ├── /hr/payroll (Disbursement Dashboard)
                      ├── /hr/attendance-leave (Attendance & Leave Matrix)
                      ├── /hr/recruitment (Recruitment & Talent Pipeline)
                      └── /hr/onboarding-separation (Onboarding & Separation Workflows)

/admin ─────────────► /admin (Module Control Center)
                      ├── /admin/users (Access Controls)
                      └── /admin/settings (System Configurations)
```

Navigation labels and child routes are defined in `src/lib/nav-config.ts`. All routed pages are registered in `src/App.tsx`.

---

## 🧱 Master Modular Full-Stack ERP Architecture ("Lego Blocks")

The application is structured according to the **Master Full-Stack Modular Architecture Plan**. Business logic is separated into standalone headless engines (`src/core/`), domain backend services (`server/modules/`), PostgREST client wrappers (`server/db/`), and Express sub-routers (`server/router/`).

```
server/
├── config.js                       (Environment & Port configuration)
├── index.js                        (Express Server Entrypoint with Request Logger)
├── logger.js                       (Production Request & Error Logging Subsystem)
├── README.md                       (Server documentation)
│
├── db/                             (Database Abstraction & SQL Schemas)
│   ├── supabaseClient.js           (PostgREST REST API Client abstraction)
│   ├── resourceRegistry.js         (50+ Entity Resource Definitions mapping tables and storage modes)
│   └── schemas/                    (Grouped SQL DDL Schemas & Seed Scripts)
│       ├── supabase.schema.sql
│       ├── sales_issues.schema.sql
│       ├── hr_module.schema.sql
│       └── finance_seed.sql
│
├── modules/                        (Domain Business Services)
│   ├── common/
│   │   └── crudService.js          (Generic Entity REST CRUD service)
│   ├── sales/
│   │   ├── salesService.js         (Sales domain service wrapper)
│   │   ├── salesIssues.js          (Sales Issue PostgREST service & RPC triggers)
│   │   ├── salesIssueLogic.js      (Pure batch allocation & FIFO stock logic)
│   │   └── salesIssueLogic.test.js (Unit test suite for sales issue logic)
│   ├── finance/
│   │   ├── financeService.js       (Finance RPC service wrapper)
│   │   └── payrollFinance.js       (Payroll RPC disbursement handler)
│   ├── inventory/
│   │   └── inventoryService.js     (Inter-warehouse stock audit service)
│   └── hr/
│       └── hrService.js            (Employee onboarding & attendance service)
│
└── router/                         (Modular Express Sub-Routers)
    ├── index.js                    (Master router mounting all domain sub-routers)
    ├── salesRouter.js              (Express router for /api/sales-issues & /api/sales_issues)
    ├── financeRouter.js            (Express router for /api/payroll-records/:id/pay)
    └── crudRouter.js               (Generic Express router for /api/:resource)

src/core/                           (Frontend Headless Pure Business Engines)
├── finance/
│   ├── ledgerEngine.ts             (Double-entry validation & party reference rules)
│   ├── reportGenerator.ts          (Trial Balance, Balance Sheet, Income Statement, Cash Flow math)
│   └── taxEngine.ts                (VAT 15% & WHT 2% calculations)
├── inventory/
│   ├── stockEngine.ts              (Multi-warehouse stock quantity evaluation & reorder alerts)
│   └── transferEngine.ts           (Store transfer validation)
├── sales/
│   └── orderPipeline.ts            (Quote & Sales Order stage progression)
└── hr/
    ├── payrollEngine.ts            (Ethiopian progressive tax & pension calculations)
    └── attendanceEngine.ts         (Attendance percentage & matrix evaluation)
```

---

## ⚡ Real-Time Cross-Module Finance Integration

The application features a **Real-Time Cross-Module Live Sync Engine** inside `src/lib/financeStore.ts`. When the application hydrates or when records are created in external modules, transactions automatically map to Finance records:

1. **Sales Issues (Dispatch Notes):** Automatically synced as AR Invoices (`invoices`) and posted to General Ledger (`JE-SI-xxxx`) with **Debit 1200 AR, Credit 4000 Sales Revenue, Credit 2210 Tax Liability**.
2. **Sales Orders:** Automatically synced as AR Invoices (`invoices`) and posted to General Ledger (`JE-SO-xxxx`).
3. **Purchase Orders:** Automatically posted as Procurement GL Accrual Entries (`JE-PO-xxxx`) with **Debit 1010 Inventory Asset, Credit 2000 Accounts Payable**.
4. **Expense Claims:** Automatically synced into `/finance/expenses` and posted to General Ledger (`JE-EXP-xxxx`).
5. **Payroll Records:** Automatically posted as Payroll Disbursement GL Entries (`JE-PAY-xxxx`).

---

## 📡 Server Request & Error Logging Subsystem

The Express server features a standard production logging module ([`server/logger.js`](file:///Users/Noah/Documents/React/HKC-ERP-v4/server/logger.js)):

- **Console Live Output (Render Dashboard):** Formats colorized HTTP request logs directly to `stdout` and `stderr` for live monitoring on Render.
- **Log File Persistence:** Automatically creates `server/logs/` and appends clean structured logs:
  - `server/logs/access.log`: Single-line standard access logs (`[TIMESTAMP] METHOD URL STATUS DURATIONms - IP`).
  - `server/logs/error.log`: Isolates HTTP 4xx/5xx errors and unhandled server exceptions with User-Agent and stack traces.

---

## 🏗️ Technical Architecture & Data Layer

**Stack:** React 19, TypeScript, Vite, React Router 7, Tailwind CSS v4, Framer Motion, Recharts, shadcn/ui primitives.

**Current persistence model:** All business modules hydrate from Supabase through the Node API. The browser must not seed Finance, Sales, Inventory, HR, or Admin records from local JSON files. Dashboards may show skeletons and empty states, but they must not invent records, balances, overdue amounts, warehouses, users, notifications, products, invoices, or payroll rows.

### Non-Negotiable Data Rules for Future Work

1. **Do not add business seed JSON back into `data/`.** The old JSON records were removed intentionally. If a page needs data, load it through `/api/:resource` and let Supabase be the source of truth.
2. **Do not hardcode fallback records in React components or stores.** Empty Supabase tables must render clean empty states with loading skeletons, not placeholder customers, invoices, HR employees, warehouses, stock items, or admin users.
3. **Use Glassmorphism Loading Skeletons (`Skeleton`).** All domain pages (Finance, Inventory, Sales, HR) must check `store.isLoading()` and render pulse skeleton states (`import { Skeleton } from "@/components/ui/skeleton"`) while hydrating from Supabase.
4. **Do not add default Supabase project credentials in code or docs.** Configure `SUPABASE_REST_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` through `.env` only. Never commit service-role keys, database passwords, or generated credential notes.
5. **Do not bypass the Node API from the browser for privileged writes.** The browser calls local app routes like `/api/invoices`; the Node server owns Supabase REST calls and keeps service-role credentials server-side.
6. **Atomic Bulk Upserts (`resolution=merge-duplicates`).** All resource batch replacements in `server/db/supabaseClient.js` issue an atomic single `POST` request with PostgREST `resolution=merge-duplicates` header to prevent multi-tab or concurrent user race conditions.
7. **Mandatory Party References on AR/AP/Payroll Accounts:** Any double-entry GL journal entry touching Accounts Receivable (`1200`), Accounts Payable (`2000`/`2100`), or Payroll Payable (`2210`/`2300`) must specify a party reference (`party_id` or `party_name`) for sub-ledger audit compliance.
8. **Finance screens are derived screens.** Cash position, reports, unpaid invoices, invoice timelines, banking, and GL views must derive from persisted invoices, payments, accounts, and journal-entry lines.
9. **When a persistence write fails, do not keep optimistic fake state.** Reload from Supabase or show a safe error state.

| Store / Context | Path | Scope |
| :--- | :--- | :--- |
| `useFinanceStore()` | `src/lib/financeStore.ts` | Finance module — COA, journal entries, invoices, payments, expenses, fixed assets, tax rules, accounting periods, forex revaluation |
| `useErpStore()` | `src/lib/erpStore.ts` | Sales & Inventory module — products, multi-warehouse tracking, stock movements audit log, inter-warehouse transfers, sales orders, purchase orders with GL accruals, customers, suppliers |
| `useFeedback()` | `src/context/FeedbackContext.tsx` | Global toasts and confirmation dialogs (wraps the app in `main.tsx`) |

---

## 🧭 Page-by-Page Deep Dive & Visualizations

### 🛍️ Sales Section

#### 1. Sales Dashboard (`/sales`)
- **Functional Purpose:** Offers top-line executive sales performance tracking, revenue growth charts, sales order pipeline metrics, and commercial contract execution. Data sourced from `useErpStore()`.
- **Contents (Data & States):**
  - **Commercial Sales KPIs:** Total Sales Revenue, Purchase Capital Commitments, Active Sales Orders, and Revenue Growth Rates.
  - **Revenue & Capital Trajectory:** Historical monthly sales revenue performance compared against procurement capital outflow.
  - **Pipeline Overview:** Active sales quotes, confirmed orders, and fulfillment conversions.
- **How it is Showed (Visualizations):**
  - **Interactive Area Charts:** Revenue vs. Purchase Capital curves rendered with Recharts API.
  - **Executive Metric Cards:** High-contrast glass cards with trend icons and quick action triggers.

#### 2. Purchase Orders (`/sales/purchase-orders`)
- **Functional Purpose:** Tracks incoming supply chain procurement orders, complete PO lifecycle (`DRAFT` → `IN TRANSIT` → `RECEIVED`), supplier delivery tracking, and automated GL asset accruals (`ACC-1010` Stock in Hand / `ACC-2000` Accounts Payable) via `useErpStore()`.
- **Contents (Data & States):**
  - **Procurement KPIs:** Draft POs, In Transit POs, Delayed POs.
  - **Purchase Order List:** Supplier partners, transit state (`DRAFT`, `IN TRANSIT`, `RECEIVED`), document dates, itemized procurement lines, total capital allocations, and billing status.
- **How it is Showed (Visualizations):**
  - **Split-Panel Workspace & Table View:** Journal-entry aligned sortable, resizable data table mode on the left with search and status filters, and a detailed document inspector view on the right with print capabilities.

#### 3. Sales Orders (`/sales/sales-orders`)
- **Functional Purpose:** Manages sales contracts, customer commitments, fulfillment, and invoicing. Enforces strict architectural separation of duties: Sales Orders represent sales contracts (0 stock deducted), while physical stock dispatch is exclusively executed on Sales Issued (`/sales/issued`). Unneeded Quotations and Delivery Notes tabs have been removed to keep the workspace 100% focused on sales contract execution.
- **Document Requirements & HKC Docs Sync:** Sales Orders enforce exactly two mandatory trade document attachments: **Trade License** and **Payment Advice** (the Business Permit requirement was removed to eliminate redundancy). The **Trade License** is inherited from the customer registry profile or uploaded directly, syncing back to the **Partner Registry** customer profile for future orders. The **Payment Advice** is strictly order-specific (for one transaction only) and is persisted under `shipment_documents` in the Supabase DB rather than stored on the default customer profile. A unified document resolution engine ensures consistent hydration across **Sales Orders**, **HKC Docs**, and the **Partner Registry**.
- **Table & Modal Action Standards:** Inline X/delete buttons and eye buttons are removed from table rows. Edit modal headers use `<EditModalHeader>` with a 3-dot (`···`) dropdown containing "Delete Record". Delete confirmation is handled by `<RecordDeleteModal>` configured at `z-[200]` to overlay open edit modals cleanly.

#### 4. Sales Issued & Warehouse Stock Dispatch (`/sales/issued`)
- **Functional Purpose:** Physical warehouse dispatch document module. Handles stock issue creation, consolidated multi-sales-order contract pulling, physical inventory deduction from product batches, COGS journal posting, and delivery note generation.
- **Key Architectural Rules & Engine Behaviors:**
  - **Single-Row Toolbar Alignment:** The table header, search input, status filters, and `+ Add Sales Issue` primary action button are positioned cleanly on a single row inside `<FinanceTableToolbar />`. Repetitive filters ("All Items", start date, end date, "Newest First") have been eliminated.
  - **1-Click Multi-Sales-Order Pull:** Interactive picker card displaying all pending Sales Orders (`deliveryStatus !== "Fully Delivered"`). Selecting multiple orders automatically aggregates customer info, warehouse location, contract line items, and quantities into the Sales Issue form state. Toggling an order off cleanly resets autofill state.
  - **Streamlined Item Grid:** Displays clean 6-column item selector, quantity, unit price, and total amount. Redundant item names, packaging units, available quantities, MFG dates, and expiry dates are omitted from the form grid. Batch dropdown displays clean batch numbers (`b.batch_no`).
  - **Exclusive Inventory Stock Deduction Rule:**
    - **Draft Sales Issue:** 0 stock deducted. Draft records can be edited (`PATCH /api/sales-issues/:id`), deleted, or cancelled at any time without affecting inventory balances.
    - **Posting Sales Issue (`POST /api/sales-issues/:id/post`):** The exclusive trigger that decrements physical warehouse stock (`quantity`), warehouse breakdown (`stockBreakdown`), and batch balances (`batches`) in `inventory_products` in Supabase DB, updates issue status to `Posted`, and posts COGS General Ledger journal entries.
    - Line items stored in `sales_issue_items` table with foreign key `sales_issue_id` (`id`, `sales_issue_id`, `item_id`, `item_name`, `batch_id`, `batch_no`, `quantity`, `unit_price`, `amount`).
  - **Stock Register Table Design System:** Uses `<GlassCard className="p-0 border border-white/65 shadow-md">`, `<FinanceTableToolbar />` with the `Add Sales Issue` primary action button positioned in the toolbar header, `useResizableTable`, and `<ResizableTh />` column resizers matching the core Stock Register (`/inventory/stock`).
- **Express Backend API Endpoints:**
  - `GET /api/sales-issues` – List sales issues with relational items join.
  - `POST /api/sales-issues` – Create draft sales issue in relational DB.
  - `GET /api/sales-issues/:id` – Fetch single sales issue header and line items.
  - `PATCH /api/sales-issues/:id` & `PUT /api/sales-issues/:id` – Update draft sales issue header and line items.
  - `DELETE /api/sales-issues/:id` – Delete draft sales issue and associated items.
  - `POST /api/sales-issues/:id/post` – Post sales issue and deduct physical stock from `inventory_products`.
  - `POST /api/sales-issues/:id/cancel` – Update status to Cancelled.

#### 5. Shipment Documents & Hard-Block Action Gates Engine (`src/lib/shipmentDocumentEngine.ts`)
- **Functional Purpose:** Shipment-level trade & compliance document checklist engine. Evaluates mandatory import/export paperwork (Purchase Orders require 5 documents; Sales Orders require 2: Trade License and Payment Advice; Processing Services require 1: Processing Contract).
- **Key Features & Behavior:**
  - **Shared Evaluation Engine:** Compares attached files against active compliance rules (`shipment_document_rules`) dynamically conditioned by supplier origin country, destination region, and record type.
  - **Piecemeal File Attachments (`<ShipmentDocChecklist />`):** Dedicated **Import Docs** tab on Purchase Orders and **Shipping Docs** tab on Sales Orders. Paperwork can be attached piecemeal as it arrives, even while records are in `DRAFT` status.
  - **Glass Status Badges:** Displays `Complete` (Green) or `Incomplete (N Missing)` (Amber) directly on Purchase Order and Sales Order list cards / rows.
  - **Hard-Block Action Gates:**
    - Intercepts **Mark as Received** on Purchase Orders. Blocked if required import documents are missing, triggering an alert naming the missing items.
    - Intercepts **Mark as Shipped** on Sales Orders. Blocked if required shipping documents are missing.
- **Backend Persistence API:**
  - `GET /api/shipment-documents/rules` – Fetch active compliance rules.
  - `GET /api/shipment-documents` – List attached documents for a record.
  - `POST /api/shipment-documents` – Upload and attach a shipment document.
  - `DELETE /api/shipment-documents/:id` – Delete an attached document.

---

### 🛡️ HKC Docs Top-Level Section (`/sales/hkc-docs`)

- **Functional Purpose:** Centralized trade documentation hub promoted to a top-level navbar section. Manages import/export legal compliance, customs declarations, shipping paperwork, processing contracts, and legal documentation verification.
- **Key Architectural Rules & Engine Behaviors:**
  - **Streamlined Table Layout:** Removed redundant columns (`Trade Route`, `Assigned Compliance Officer`), removed gate locked pill, removed repetitive document attachment section, and updated Manage Docs button to the website's light-green badge style (`bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80`).
  - **End-to-End Multi-Module Document Sync:** Hydrates shipment documents across Purchase Orders (5 required docs), Sales Orders (2 required docs: Trade License & Payment Advice), and Processing Services (Service Contract).
  - **Stock Register Table Design System:** Implements `<GlassCard className="p-0 border border-white/65 shadow-md">`, `<FinanceTableToolbar />`, `useResizableTable`, and `<ResizableTh />` column resizers matching the Stock Register (`/inventory/stock`).
  - **100% Full-Width Master Table & Centered Modal Dialog Inspector:** Master trade shipments register expands to 100% container width. Selecting any record opens a spacious, backdrop-blurred modal dialog centered on screen for verifying trade documents.
  - **Read-Only Scoped Inspection in POs & SOs:** Purchase Orders (`/sales/purchase-orders`) and Sales Orders (`/sales/sales-orders`) display read-only compliance checklists with a 1-click shortcut button: *"Open HKC Docs"*.
  - **Hard-Block Action Gate:** Goods Receipt and Stock Dispatch remain hard-blocked until mandatory trade paperwork is attached and verified in **HKC Docs**.
- **Express Backend API Endpoints:**
  - `GET /api/shipment-documents/officers` – List assigned compliance officers per shipment record.
  - `POST /api/shipment-documents/assign` – Assign or reassign a compliance officer to a shipment.

---

### 📦 Inventory Section

#### 1. Inventory Dashboard (`/inventory`)
- **Functional Purpose:** Offers real-time overview telemetry of warehouse performance, product allocations, batch QA approvals, and critical stock events.
- **Contents (Data & States):**
  - **Inventory KPIs:** Total SKUs (12,482), Low-Stock alerts (48), Near Expiry alerts (12), Open Stock Movements.
  - **Stock Allocation:** Category percentage breakdowns (*Medical Supplies*, *Food & Nutrition*, *General Goods*).
  - **Clean Stock Items View:** The **Current Stock Items** card displays saved stock records cleanly without inline X delete action buttons.

#### 2. Stock Register (`/inventory/stock`)
- **Functional Purpose:** Master catalog of active inventory products with SKU tracking, reorder levels, valuation rates, multi-warehouse distribution breakdowns, regulatory compliance documentation (Certificates of Analysis), inter-warehouse Store Transfers with GL voucher generation, and real-time automated Stock Movement Audit Logs.
- **In-Page Add Stock Modal & Warehouse 1 Form Layout:** Clicking `+ Add Item` triggers an in-page modal (`isAddModalOpen`) using the `max-w-5xl` Sales Order modal design language. Page redirects to `/inventory/stock/add-item` are eliminated, and redundant side cards ("Stock Value" and "Saved Fields") are removed to keep the creation form clean and spacious.
  - **Warehouse 1 Form Adaptations (Agro Products):** Selecting **Warehouse 1** dynamically adapts the form inputs:
    - UOM defaults to **Quintal** or **Ton**.
    - Displays **Entry Date** and **Leave Date** inputs.
    - Hides **Packaging Unit**, **Manufacturing Date**, **Expiry Date**, **Quantity Per Pack**, **Number of Cartons**, and **Total Calculated Quantity** inputs.
    - Renames **Unit of Price** to **Price** (which is explicitly optional, defaulting to 0).
  - **Standard Form Layout:** Other warehouses display standard fields (Packaging Unit, MFG/EXP dates, Quantity Per Pack, Number of Cartons, Total Calculated Quantity, and Unit Price).
- **Dynamic Columns & Warehouse 1 Layout:** Expiry and batch data are displayed in separate columns:
  - **Standard Columns:** Product & SKU, Primary Warehouse, Available Qty, Stock Value, Batch, Expiry Date, and Action.
  - **Warehouse 1 (Agro-specific) Columns:** When filtering the Stock Register table by Warehouse 1, columns dynamically switch to split **Batch**, **Entry Date**, and **Leave Date** into their own separate columns.
- **Store Transfers (`<StoreTransfersTab />`):** 
  - Rendered directly inside the **Store Transfer** tab (combining previous Transfers and History Ledgers into a single, clean status-filterable table).
  - Sliding panels are replaced with standard, centered pop-up modals matching the premium glassmorphism modal design patterns.
  - **Dynamic Warehouse Selection:** The "From Warehouse" (Origin) selector is unlocked and dynamically filtered to show only warehouses that hold inventory for the selected product. Selecting an item auto-fills its primary warehouse and UOM.
  - **Stock Verification Validation:** Displays an inline badge (`Avail: [qty]`) under the Quantity field and applies red border/shadow highlighting if the entered transfer quantity exceeds the selected origin warehouse's current stock. Transfer initiation is blocked with warning toasts if any item quantity exceeds available stock.
  - **Removed Controls:** Removed the top "Transfer Context" card and deleted the "Process Receipt" action button.
- **Contents (Data & States):**
  - **Active Products:** Product codes, SKUs, categories, warehouse allocations, reorder levels, valuation rates, physical stock, active batch tags, and expiry horizons.
  - **Store Transfers:** Material Transfer Note tracking ledger with issue/receipt workflows that automatically log stock movements and post double-entry GL journal vouchers (`ACC-1410`).
- **How it is Showed (Visualizations):**
  - **Registry Toggle Tabs:** Stock Register, Store Transfer, and Regulatory Docs.
  - **Interactive Quick Peek & Stock Adjuster:** Slide-in panel to adjust warehouse quantities, creating an automated stock movement audit log entry and double-entry accounting GL voucher.

#### 3. Warehouse 1 Processing Services / Toll Processing (`/inventory/processing-services`)
- **Functional Purpose:** Consolidated business line for Warehouse 1 toll processing (washing, sorting, milling, grading, and custom packaging) housed centrally under **Inventory** navigation. Clients bring their raw agricultural/industrial goods to WH1, pay a fee for processing, and the goods never become WH1 inventory.
- **Key Architectural Rules & Engine Behaviors:**
  - **No Ownership / Asset Transfer Rule:** Client goods sitting at WH1 for processing are **never recorded as WH1 Inventory Assets (Account 1010)** and **never generate Cost of Goods Sold (Account 5001)**.
  - **3-Stage Operational Pipeline:** Simplified to 3 clear, standardized stage progressions: **`Received`** ➔ **`Processed`** ➔ **`Delivered`**.
  - **Deferred Stage Checkbox Progression:** Checkboxes inside the Edit modal modify local status state without firing immediate HTTP requests and allow unselecting/reverting stages. Status changes and financial entries are committed only when the user explicitly clicks **"Save Order Changes"**.
  - **Automated Financial Service Revenue Recognition:** Advancing a service order to stage **`Delivered`** automatically generates an Accounts Receivable Invoice in `financeStore` for the `agreed_price` and posts a General Ledger Journal Entry: **DEBIT 1200 Accounts Receivable / CREDIT 4002 Service Processing Revenue** (separate from 4000 Sales Revenue).
  - **Unified Customer Combobox:** Creation and Edit forms feature a single unified customer combobox with live customer registry searching and free-text entry, matching the Sales Order modal pattern.
  - **Service Contract Attachment:** Supports PDF service contract upload (`POST /api/processing-services/:id/upload-contract`), linking contracts directly to the processing order record and syncing automatically into **HKC Docs**.
  - **Modal Layout Order & Action Rules:**
    - Modal layout follows strict ordered sections: **1. Details Form**, **2. Stage Progression Checkboxes**, **3. Document Attachment**.
    - Removed row `onClick` so clicking table rows does not trigger popups. Table Action column uses a light-green Edit button (`bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80`).
    - Edit modal header features `<EditModalHeader>` with 3-dot dropdown menu containing "Delete Service Order", triggering a top-level confirmation modal (`<RecordDeleteModal>` with `z-[200]`).
- **Express Backend API Endpoints:**
  - `GET /api/processing-services` – List processing service orders.
  - `POST /api/processing-services` – Create processing service order.
  - `PATCH /api/processing-services/:id` – Update processing service order details and stage.
  - `DELETE /api/processing-services/:id` – Delete processing service order.
  - `POST /api/processing-services/:id/upload-contract` – Upload service contract PDF.

---

### 💵 Finance Section

#### 1. Finance Overview (`/finance`)
- **Functional Purpose:** Treasury-focused executive dashboard for receivables health, cash position, and near-term billing schedule — driven live from `useFinanceStore()`.
- **Contents (Data & States):**
  - **Treasury KPIs:** Overdue AR Amount, Due This Month (open receivable balance), Cash Position (derived from GL cash account lines).
  - **Invoice Due Dates Timeline:** Horizontally scrollable cards for every non-void invoice sorted by due date, color-coded by status (Overdue, Paid, Open).
- **How it is Showed (Visualizations):**
  - **JetBrains Mono KPI Cards:** Three top-row glass cards for overdue, due-this-month, and cash position figures in ETB.
  - **Timeline Strip & Area Chart:** Invoice due-date pills plus revenue/expense dual-area chart with export button in header.

#### 2. General Ledger (`/finance/ledger`)
- **Functional Purpose:** Core double-entry general ledger engine — journal vouchers, chart of accounts, fiscal period locking, and forex revaluation. All data flows through `useFinanceStore()`.
- **Active Sub-Tabs (4):** *Journal Entries*, *Chart of Accounts*, *Accounting Periods*, *Forex Revaluation*.
- **Contents (Data & States):**
  - **Chart of Accounts (COA):** Standard 5-root hierarchical tree (1000 Assets, 2000 Liabilities, 3000 Equity, 4000 Revenue, 5000/6000 Expenses).
  - **Journal Entries (JE):** Double-entry posting ledger with source types (`Sales Invoice`, `Payment`, `Manual Adjustment`, `Reversal`, `Exchange Revaluation`, etc.), debit/credit lines, party tracking, and auto-balancing validation (`Total Debit == Total Credit`).

#### 3. Banking & Reconciliations (`/finance/banking`)
- **Functional Purpose:** Bank statement line reconciliation and payment allocation against open invoices.
- **Active Sub-Tabs (2):** *Bank Reconciliation*, *Payment & Account Allocation*.

#### 4. Fixed Assets Register (`/finance/assets`)
- **Functional Purpose:** Capital asset lifecycle — registration, straight-line depreciation posting, schedule tracking, edit, delete, and disposal with GL impact.

#### 5. Tax Templates & Rates (`/finance/taxes`)
- **Functional Purpose:** Configure tax rules linked to GL accounts for automatic invoice and expense tax computation.

#### 6. Financial Statements & Reports (`/finance/reports`)
- **Functional Purpose:** Enterprise financial reporting engine generating live account-wise General Ledger reports, trial balance worksheet, and standalone official financial statements (Balance Sheet, Profit & Loss, Cash Flow) directly from GL postings.
- **Active Sub-Tabs (5):** *General Ledger*, *Trial Balance*, *Balance Sheet*, *Profit & Loss*, *Cash Flow*.

#### 7. Invoices Engine (`/finance/invoices`)
- **Functional Purpose:** Full-lifecycle invoicing management for customer Accounts Receivable (AR) Invoices, integrated with tax templates, payment terms, discount structures, draft status handling, and automatic GL journal entry posting via `useFinanceStore()`.

#### 8. Expenses & Recurring Schedules (`/finance/expenses`)
- **Functional Purpose:** Handles employee expense claims with cost center allocation, operational vendor expenses, recurring expense schedules with status toggling, and corporate vehicle fleet maintenance with automated GL posting via `useFinanceStore()`.

---

### 👥 Human Resources Section

#### 1. HR Dashboard (`/hr`)
- **Functional Purpose:** Visualizes personnel metrics, interviews, weekly calendar schedules, and staff rosters.

#### 2. Employees Staff Roster (`/hr/employees`)
- **Functional Purpose:** Houses the official personnel directory, staff department assignments, and salary records.

#### 3. Payroll Disbursement (`/hr/payroll`)
- **Functional Purpose:** Manages monthly salary dispersals, tax withholdings, allowances, and payment states.

#### 4. Attendance & Leave Matrix (`/hr/attendance-leave`)
- **Functional Purpose:** Logs employee day-to-day attendance and vacation/sick leave approvals.

---

### ⚙️ Admin Section

#### 1. Admin Control Center (`/admin`)
- **Functional Purpose:** The primary administrative control deck tracking general revenue, system audit logs, and quick user accesses.

#### 2. User Management (`/admin/users`)
- **Functional Purpose:** Administers internal accounts, edits security privileges, and invites new users.

#### 3. System Settings (`/admin/settings`)
- **Functional Purpose:** Controls enterprise configurations, currency preferences, backup policies, and API keys.

---

## 🧱 Core Shared Components

1. **`FloatingNav` (`/src/components/FloatingNav.tsx`):** Fixed navigation bar with brand, menu navigation, and quick action pills.
2. **`SubPageNav` (`/src/components/SubPageNav.tsx`):** Local page submenu controller fed by `src/lib/nav-config.ts`.
3. **`GlassCard` (`/src/components/GlassCard.tsx`):** Modular glassmorphism card wrapper using Framer Motion.
4. **`HRTable` Utilities (`/src/components/HRTable.tsx`):** Shared tables, search toolbars, and sort hooks for HR pages.
5. **`ResizableTable` (`/src/components/ResizableTable.tsx`):** Shared column resizing and popover sorting hook for Finance tables.
6. **`FinanceTableToolbar` (`/src/components/FinanceTableToolbar.tsx`):** Standardized header toolbar for Finance tables.
7. **`FeedbackContext` (`/src/context/FeedbackContext.tsx`):** Global toast and confirmation dialog provider.

---

## 🛠️ Code Style & Design Guidelines for Developers

1. **Keep Imports Safe:** Always import motion properties from standard `"framer-motion"`.
2. **Never Overpopulate the Screen:** Respect negative space. Each dashboard card should have ample margins (`mb-6`, `gap-5`, `p-6`).
3. **Use the `GlassCard` Component:** Wrap cards in `<GlassCard>` to benefit from entry animations and backdrop filters.
4. **Icons:** Exclusively use the `lucide-react` library.
5. **Subpage Navigation Layout:** Sub-navigation pills must always be placed on the far right using `<SubPageNav />`.
6. **Use `useFeedback()` for toasts:** All user notifications use `FeedbackContext`.
7. **Concise Page Headers:** Keep page descriptions under main titles short and direct (5–10 words max).

---

## 🚀 Vercel Deployment Architecture

1. **SPA Client-Side Route Fallbacks:** `vercel.json` maps all SPA frontend subroutes (`/(.*)`) to `/index.html`, eliminating 404 errors when refreshing or directly navigating to subpages like `/sales/hkc-docs`, `/inventory/stock`, or `/finance/ledger`.
2. **Serverless API Bridge (`/api/index.js`):** Express backend API endpoints are bridged to Vercel Serverless Functions via [`/api/index.js`](file:///Users/Noah/Documents/React/HKC-ERP-v4/api/index.js). All requests to `/api/*` (e.g. `/api/processing-services`, `/api/shipment-documents`, `/api/products`, `/api/sales-issues`) are routed by `vercel.json` to `api/index.js`, executing full Express domain handlers and ensuring record creation works on Vercel out-of-the-box.
3. **API Base URL Resolution & Proxying:** Frontend API clients resolve `API_BASE = import.meta.env.VITE_API_URL ?? ""`. When `VITE_API_URL` is omitted, relative `/api/*` calls are used. In local development, the Vite dev server (`vite.config.ts`) proxies `/api` requests directly to `"http://localhost:1000"` (the local Node API server port), preventing request loopback issues when `VITE_API_URL` is configured to point to the dev server port.
