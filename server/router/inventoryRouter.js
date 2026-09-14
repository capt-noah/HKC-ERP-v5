import { Router } from "express"
import { inventoryService } from "../modules/inventory/inventoryService.js"
import { authorizeRoles } from "../modules/auth/authMiddleware.js"

export const inventoryRouter = Router()

// Enforce RBAC: Only superadmin and inventory_admin can execute mutations on inventory routes
inventoryRouter.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return authorizeRoles("superadmin", "inventory_admin")(req, res, next)
  }
  next()
})

// ── 1. Products (Strict Route Scoping for Export Commodities vs Pharmaceuticals) ────
const exportProductRoutes = ["/export_products", "/export-products"]
const pharmaProductRoutes = ["/pharma_products", "/pharma-products"]
const generalProductRoutes = ["/inventory_products", "/inventory-products", "/inventory/products"]
const allProductRoutes = [...exportProductRoutes, ...pharmaProductRoutes, ...generalProductRoutes]

inventoryRouter.get(exportProductRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listProducts({ ...req.query, type: "EXPORT_WH" })
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(pharmaProductRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listProducts({ ...req.query, type: "PHARMA_WH" })
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(generalProductRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listProducts(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(exportProductRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.createProduct({ ...req.body, warehouse_type: "EXPORT_WH" })
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(pharmaProductRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.createProduct({ ...req.body, warehouse_type: "PHARMA_WH" })
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(generalProductRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.createProduct(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(allProductRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.getProduct(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.patch(allProductRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateProduct(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.put(allProductRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateProduct(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.delete(allProductRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.deleteProduct(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 2. Pharma Batches ────────────────────────────────────────────────────────
const batchRoutes = [
  "/pharma_product_batches",
  "/pharma-product-batches",
  "/inventory/batches",
  "/inventory-batches",
]

inventoryRouter.get(batchRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listBatches(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(batchRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.createBatch(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(batchRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.getBatch(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.patch(batchRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateBatch(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(batchRoutes.map((r) => `${r}/:id/transition`), async (req, res, next) => {
  try {
    const result = await inventoryService.transitionBatchStatus(req.params.id, req.body.status, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.delete(batchRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.deleteBatch(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 3. Stock Movements (Pharma) ──────────────────────────────────────────────
const stockMovementRoutes = [
  "/stock_movements",
  "/stock-movements",
  "/inventory/movements",
  "/inventory-movements",
]

inventoryRouter.get(stockMovementRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listMovements(req.query, "stock_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(stockMovementRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.recordMovement(req.body, "stock_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(stockMovementRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.getMovement(req.params.id, "stock_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.patch(stockMovementRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateMovement(req.params.id, req.body, "stock_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.delete(stockMovementRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.deleteMovement(req.params.id, "stock_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 4. Export Warehouse Movements (WH1) ──────────────────────────────────────
const exportMovementRoutes = [
  "/export_warehouse_movements",
  "/export-warehouse-movements",
  "/inventory/export-movements",
  "/inventory/export_warehouse_movements",
]

inventoryRouter.get(exportMovementRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listMovements(req.query, "export_warehouse_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(exportMovementRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.recordMovement(req.body, "export_warehouse_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(exportMovementRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.getMovement(req.params.id, "export_warehouse_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.patch(exportMovementRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateMovement(req.params.id, req.body, "export_warehouse_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.delete(exportMovementRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.deleteMovement(req.params.id, "export_warehouse_movements")
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 5. Store Transfers ───────────────────────────────────────────────────────
const transferRoutes = [
  "/store_transfers",
  "/store-transfers",
  "/inventory/transfers",
  "/inventory-transfers",
]

inventoryRouter.get(transferRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listTransfers(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(transferRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.createTransfer(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(transferRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.getTransfer(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.patch(transferRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateTransfer(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.delete(transferRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.deleteTransfer(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 6. Regulatory Quarantine Records ─────────────────────────────────────────
const quarantineRoutes = [
  "/quarantine_records",
  "/quarantine-records",
  "/inventory/quarantine",
  "/inventory-quarantine",
]

inventoryRouter.get(quarantineRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.listQuarantineRecords(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.post(quarantineRoutes, async (req, res, next) => {
  try {
    const result = await inventoryService.createQuarantineRecord(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.get(quarantineRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.getQuarantineRecord(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.patch(quarantineRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateQuarantineRecord(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.put(quarantineRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.updateQuarantineRecord(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

inventoryRouter.delete(quarantineRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await inventoryService.deleteQuarantineRecord(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})
