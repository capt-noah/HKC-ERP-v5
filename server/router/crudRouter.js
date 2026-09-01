import { Router } from "express"
import { getResource, listResources } from "../db/resourceRegistry.js"
import { crudService } from "../modules/common/crudService.js"
import { validateStrongPassword, sanitizeUser } from "../modules/auth/authUtils.js"
import bcrypt from "bcrypt"

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

  // Cross-module READ permissions for ERP operational flow
  if (req.method === "GET") {
    const resName = req.params.resource

    // Company settings and tax rules readable by all logged-in staff
    if (resName === "company_settings" || resName === "tax_rules") {
      isAllowed = true
    }

    // Warehouses and inventory products readable by sales, finance, and inventory admins
    if (resName === "warehouses" || resName === "inventory_products") {
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

    // Sales orders, sales issues, and processing services readable by finance manager for invoicing & AR
    if (resName === "sales_orders" || resName === "sales_issues" || resName === "processing_services") {
      if (userRoles.includes("finance_manager")) {
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

crudRouter.patch("/:resource/:id", async (req, res, next) => {
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
