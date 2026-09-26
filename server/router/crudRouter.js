import { Router } from "express"
import { getResource, listResources } from "../db/resourceRegistry.js"
import { crudService } from "../modules/common/crudService.js"
import { validateStrongPassword, sanitizeUser } from "../modules/auth/authUtils.js"
import bcrypt from "bcryptjs"

export const crudRouter = Router()

// Module-level RBAC middleware
crudRouter.use("/:resource", (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next()
  }

  const resource = getResource(req.params.resource)
  if (!resource) {
    return next()
  }

  const user = req.user
  if (!user) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" })
  }

  const userRoles = user.roles || (user.role ? [user.role] : [])
  if (userRoles.includes("superadmin")) {
    return next()
  }

  const mod = resource.module
  let isAllowed = false

  if (mod === "inventory" && userRoles.includes("inventory_admin")) isAllowed = true
  if (mod === "sales" && (userRoles.includes("sales_manager") || userRoles.includes("hkc_docs_manager"))) isAllowed = true
  if (mod === "finance" && userRoles.includes("finance_manager")) isAllowed = true
  if (mod === "hr" && userRoles.includes("hr_manager")) isAllowed = true
  if (mod === "admin" && userRoles.includes("superadmin")) isAllowed = true

  // Allow all authenticated users to read and update their own user profile
  if (req.params.resource === "users") {
    if (req.method === "GET") isAllowed = true
    if ((req.method === "PATCH" || req.method === "PUT") && req.params.id === user.id) isAllowed = true
  }

  // Allow all authenticated users to read and record activity logs in user_activity_logs
  if (req.params.resource === "user_activity_logs") {
    if (req.method === "POST" || req.method === "GET") {
      isAllowed = true
    }
  }

  // Allow sales manager and finance manager to record customer payments
  if (req.params.resource === "payments" && userRoles.some((r) => ["sales_manager", "hkc_docs_manager", "finance_manager"].includes(r))) {
    isAllowed = true
  }

  // Allow inventory admin, sales manager, and finance manager to create and update suppliers, customers, purchase orders, and documentation
  if (
    ["suppliers", "customers", "purchase_orders", "hkc_doc_records", "shipment_documents"].includes(req.params.resource) &&
    userRoles.some((r) => ["inventory_admin", "sales_manager", "hkc_docs_manager", "finance_manager"].includes(r))
  ) {
    isAllowed = true
  }

  // Cross-module READ permissions for ERP operational flow
  if (req.method === "GET") {
    const resName = req.params.resource

    // Company settings, Chart of Accounts, tax rules, and GL mappings readable by all logged-in staff
    if (
      resName === "company_settings" ||
      resName === "tax_rules" ||
      resName === "accounts" ||
      resName === "chart_of_accounts" ||
      resName === "gl_account_mappings"
    ) {
      isAllowed = true
    }

    // Invoices and payments readable by sales, finance, docs, and inventory managers
    if (resName === "invoices" || resName === "payments") {
      if (userRoles.some((r) => ["sales_manager", "hkc_docs_manager", "finance_manager", "inventory_admin"].includes(r))) {
        isAllowed = true
      }
    }

    // Warehouses, products, movements, and transfers readable by sales, finance, and inventory admins
    if (
      resName === "warehouses" ||
      resName === "export_products" ||
      resName === "pharma_products" ||
      resName === "pharma_product_batches" ||
      resName === "export_warehouse_movements" ||
      resName === "stock_movements" ||
      resName === "store_transfers" ||
      resName === "store_transfer_items" ||
      resName === "quarantine_records"
    ) {
      if (userRoles.some((r) => ["sales_manager", "hkc_docs_manager", "finance_manager", "inventory_admin"].includes(r))) {
        isAllowed = true
      }
    }

    // Customers and suppliers readable by sales, finance, and inventory admins
    if (resName === "customers" || resName === "suppliers" || resName === "purchase_orders") {
      if (userRoles.some((r) => ["sales_manager", "hkc_docs_manager", "finance_manager", "inventory_admin"].includes(r))) {
        isAllowed = true
      }
    }

    // Sales orders, sales issues, shipments, HKC compliance docs, and processing services readable by sales, docs, finance, and inventory admins
    if (
      resName === "sales_orders" ||
      resName === "sales_issues" ||
      resName === "sales_issue_items" ||
      resName === "processing_services" ||
      resName === "shipment_documents" ||
      resName === "hkc_doc_records"
    ) {
      if (userRoles.some((r) => ["sales_manager", "hkc_docs_manager", "finance_manager", "inventory_admin"].includes(r))) {
        isAllowed = true
      }
    }
  }

  if (!isAllowed) {
    return res.status(403).json({
      error: `Forbidden: role [${userRoles.join(", ")}] cannot access [${mod}] resource '${req.params.resource}'.`,
      code: "FORBIDDEN",
    })
  }

  next()
})

crudRouter.get("/:resource", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource)
    if (!resource) {
      res.status(404).json({
        error: `Unknown resource '${req.params.resource}'.`,
        availableResources: listResources().map((item) => item.name),
      })
      return
    }
    const result = await crudService.list({ resource, query: req.query, headers: req.headers })
    if (result.headers?.["Content-Range"]) {
      res.setHeader("Content-Range", result.headers["Content-Range"])
    }

    let responseBody = result.body
    if (req.params.resource === "users" && Array.isArray(responseBody)) {
      responseBody = responseBody.map(sanitizeUser)
    }

    // If non-superadmin queries user_activity_logs, scope the response strictly to their own activities
    if (req.params.resource === "user_activity_logs" && Array.isArray(responseBody)) {
      const user = req.user
      const userRoles = user?.roles || (user?.role ? [user.role] : [])
      if (!userRoles.includes("superadmin") && user) {
        responseBody = responseBody.filter(
          (log) =>
            log.user_id === user.id ||
            log.username === user.username ||
            (log.user_id && user.id && String(log.user_id).toLowerCase() === String(user.id).toLowerCase()) ||
            (log.username && user.username && String(log.username).toLowerCase() === String(user.username).toLowerCase())
        )
      }
    }

    res.status(result.status).json(responseBody)
  } catch (err) {
    next(err)
  }
})

crudRouter.put("/:resource", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource)
    if (!resource) {
      res.status(404).json({ error: `Unknown resource '${req.params.resource}'.` })
      return
    }
    const result = await crudService.replace({ resource, body: req.body, headers: req.headers })
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

crudRouter.post("/:resource", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource)
    if (!resource) {
      res.status(404).json({ error: `Unknown resource '${req.params.resource}'.` })
      return
    }

    let body = req.body
    if (req.params.resource === "users") {
      if (body.password) {
        const passCheck = validateStrongPassword(body.password)
        if (!passCheck.valid) {
          return res.status(400).json({ error: passCheck.error })
        }
        const password_hash = await bcrypt.hash(body.password, 10)
        body = { ...body, password_hash }
        delete body.password
      }
      if (Array.isArray(body.roles) && body.roles.length > 0) {
        body.role = body.roles[0]
      }
    }

    if (req.params.resource === "user_activity_logs") {
      const user = req.user
      if (user) {
        if (!body.user_id && user.id) {
          body.user_id = user.id
        }
        if (!body.username && (user.username || user.fullname)) {
          body.username = user.username || user.fullname
        }
        if (!body.fullname && user.fullname) {
          body.fullname = user.fullname
        }
      }
    }

    const result = await crudService.create({ resource, body, headers: req.headers })
    const responseBody = req.params.resource === "users" ? sanitizeUser(result.body) : result.body
    res.status(result.status).json(responseBody)
  } catch (err) {
    next(err)
  }
})

crudRouter.get("/:resource/:id", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource)
    if (!resource) {
      res.status(404).json({ error: `Unknown resource '${req.params.resource}'.` })
      return
    }
    const result = await crudService.get({ resource, id: req.params.id, query: req.query, headers: req.headers })
    const responseBody = req.params.resource === "users" ? sanitizeUser(result.body) : result.body
    res.status(result.status).json(responseBody)
  } catch (err) {
    next(err)
  }
})

crudRouter.route("/:resource/:id")
  .patch(async (req, res, next) => {
    try {
      const resource = getResource(req.params.resource)
      if (!resource) {
        res.status(404).json({ error: `Unknown resource '${req.params.resource}'.` })
        return
      }

      let body = req.body
      if (req.params.resource === "users") {
        if (body && body.password) {
          const passCheck = validateStrongPassword(body.password)
          if (!passCheck.valid) {
            return res.status(400).json({ error: passCheck.error })
          }
          const password_hash = await bcrypt.hash(body.password, 10)
          body = { ...body, password_hash }
          delete body.password
        }
        if (body && Array.isArray(body.roles) && body.roles.length > 0) {
          body.role = body.roles[0]
        }
      }

      const result = await crudService.update({ resource, id: req.params.id, body, headers: req.headers })
      const responseBody = req.params.resource === "users" ? sanitizeUser(result.body) : result.body
      res.status(result.status).json(responseBody)
    } catch (err) {
      next(err)
    }
  })
  .put(async (req, res, next) => {
    try {
      const resource = getResource(req.params.resource)
      if (!resource) {
        res.status(404).json({ error: `Unknown resource '${req.params.resource}'.` })
        return
      }

      const result = await crudService.update({ resource, id: req.params.id, body: req.body, headers: req.headers })
      const responseBody = req.params.resource === "users" ? sanitizeUser(result.body) : result.body
      res.status(result.status).json(responseBody)
    } catch (err) {
      next(err)
    }
  })

crudRouter.delete("/:resource/:id", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource)
    if (!resource) {
      res.status(404).json({ error: `Unknown resource '${req.params.resource}'.` })
      return
    }
    const result = await crudService.delete({ resource, id: req.params.id, headers: req.headers })
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})
