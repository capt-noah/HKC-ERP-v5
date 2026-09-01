# Implementation Plan: Shipment Documents on Purchase Orders & Sales Orders

> A third application of the same reusable pattern already built for batch documents: attached-vs-missing checklist, hard-block gate, shared attachment mechanism. This time scoped to the whole shipment (a Purchase Order for imports, a Sales Order for exports/deliveries) rather than an individual product batch — no new entity, added directly onto the existing records per your direction.

---

## 1. What This Covers vs. What Already Exists

| Level | Applies to | Example documents | Status |
|---|---|---|---|
| **Batch-level** | A specific product batch | Certificate of Analysis, product license | Already built |
| **Shipment-level (this plan)** | The whole Purchase Order (import) or Sales Order (export) | Bill of Lading, Commercial Invoice, Packing List, Certificate of Origin, Customs Declaration, Insurance Certificate | New |
| **Archive** | Freestanding company docs, not tied to a transaction | Contracts, correspondence, HR files | Already built |

A single container might hold several different products/batches — each of those has its own batch-level checklist, entirely separate from the one shipment-level checklist covering the container/transaction as a whole. Both need to be satisfied; neither substitutes for the other.

---

## 2. Data Model

### 2.1 Required document rules (extends the same pattern as batch rules)
```sql
shipment_document_rules
  id
  applies_to           -- 'purchase_order' | 'sales_order'
  origin_country        -- nullable; relevant for purchase_order (import) rules
  destination_region     -- nullable; relevant for sales_order (export/delivery) rules
  product_category       -- nullable = applies to all categories; or 'Medicine' | 'Food' | 'General'
  document_type
  is_required: true
```
One table, shared shape, distinguished by `applies_to` — keeps the configuration UI and the completeness logic consistent between import and export instead of building two parallel systems.

### 2.2 Attachments
Reuse the existing `files` table exactly as designed for batch/Finance/Archive attachments — just add two more values to `attached_to_type`: `'purchase_order'` and `'sales_order'`. No new attachment mechanism.

---

## 3. Completeness Computation

Given a Purchase Order: look up its supplier's origin country and the product categories among its line items → find matching `shipment_document_rules` where `applies_to = 'purchase_order'` → compare against attached files of matching `document_type` → return satisfied/missing lists, same shape as the batch-level function.

Given a Sales Order: same logic, using destination region and line-item product categories, `applies_to = 'sales_order'`.

**Recommendation: implement this as one shared function with a parameter for which side it's evaluating**, rather than two separate implementations — mirrors the "don't duplicate the completeness logic" principle already applied to the batch documents feature.

---

## 4. Where This Shows Up in the UI

### 4.1 Purchase Order detail — new "Import Docs" section/tab
- Same Attached/Missing split layout already used for batch documents — reuse the component, don't rebuild it.
- Upload action lets the user select a `document_type` from the scenario-relevant list and attach a file.
- A completeness badge ("Complete" / "Incomplete — N missing") shown both here and on the Purchase Orders list view, so it's visible without opening every record.

### 4.2 Sales Order detail — new "Shipping Docs" section/tab
- Identical pattern, mirrored for the export side.
- Same badge treatment on the Sales Orders list/kanban view.

### 4.3 Hard-block gates (per your direction)
- **Purchase Order "Received" action** — blocked if the Import Docs checklist is incomplete, with a clear message naming the specific missing document types.
- **Sales Order "Shipped" action** — blocked if the Shipping Docs checklist is incomplete, same message pattern.
- These are in addition to the existing batch-level export gate already built — a Sales Order shipment now needs both its shipment-level docs *and* every referenced batch's export docs complete before it can ship.

---

## 5. UX Recommendations (you asked — here's where I'd focus)

1. **Let documents be attached from the moment the scenario is known, not just at the final confirm step.** Real customs/shipping paperwork arrives piecemeal over days or weeks — someone should be able to start attaching the Commercial Invoice as soon as it exists, well before the container physically arrives or ships, rather than being forced into a single last-minute upload session. Show the checklist and allow uploads as soon as the PO/SO has enough info to know which rules apply (origin/destination + product category set) — even while the record is still in Draft.

2. **Surface the completeness badge on the list view, not just the detail page.** Someone scanning the Purchase Orders list should be able to spot "this one's missing docs" without opening each record individually — same principle as the batch list badge.

3. **Show *why* a document is required, not just that it is.** A small inline note next to each missing item (e.g., "Required for shipments from China") helps a Purchase role understand the rule rather than just hitting a wall — especially useful early on while the team is still learning which documents apply to which scenarios.

4. **Don't show an empty/ambiguous checklist before the scenario is determinable.** If a Purchase Order doesn't have a supplier/origin country set yet, show a prompt to complete that first rather than a checklist with nothing in it — avoids confusion about whether "no missing items" means "compliant" or "nothing's been evaluated yet."

5. **Reuse, don't duplicate, the visual language.** Same badge colors, same split-list layout, same upload component as batch documents — a user who's learned the pattern once (attached vs. missing, hard block on the relevant action) shouldn't have to learn a second, differently-styled version of the same idea for shipments.

---

## 6. Open Item to Confirm With the Client
The actual required-document list per scenario (origin country × product category for imports; destination × product category for exports) needs to be confirmed against their real customs/shipping requirements — same caveat as the batch-level checklist, this is illustrative structure, not a confirmed real list yet.
