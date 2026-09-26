import { drizzleCreateRow } from "../../db/drizzleCrud.js"
import { getResource } from "../../db/resourceRegistry.js"
import { pool } from "../../db/client.js"
import { unwrapRow } from "../../db/dbUtils.js"
import crypto from "node:crypto"


/**
 * Normalizes request paths to extract clean resource names and action types.
 */
export function parseRequestAction(method, path) {
  // Strip query parameters and clean trailing slash
  const cleanPath = path.split("?")[0].replace(/^\/api\//, "").replace(/\/$/, "")
  const segments = cleanPath.split("/")

  if (segments.length === 0 || segments[0] === "") {
    return { resource: "unknown", action: method }
  }

  // Normalize resource name: e.g. "sales-issues" -> "sales_issues"
  const rawResource = segments[0]
  const resource = rawResource.replace(/-/g, "_")

  let action = ""
  if (method === "POST") {
    if (segments.length > 2) {
      // e.g. /api/sales-issues/123/post -> "Post"
      const subAction = segments[segments.length - 1]
      action = subAction.charAt(0).toUpperCase() + subAction.slice(1).replace(/-/g, " ")
    } else if (segments.length === 2 && ["assign", "upload-contract", "transition"].includes(segments[1])) {
      action = segments[1].charAt(0).toUpperCase() + segments[1].slice(1).replace(/-/g, " ")
    } else {
      action = "Create"
    }
  } else if (method === "PATCH" || method === "PUT") {
    action = "Update"
  } else if (method === "DELETE") {
    action = "Delete"
  } else {
    action = method
  }

  return { resource, action }
}

/**
 * Generates an intuitive, business-friendly operation type and descriptive narrative
 * for what the salesperson, inventory officer, HR officer, or administrator did.
 */
export function generateActivitySummary({ method, resource, action, body = {}, details = {} }) {
  const normResource = (resource || "").toLowerCase().replace(/-/g, "_")
  const normAction = (action || "").toLowerCase()
  const b = typeof body === "object" && body !== null ? body : {}

  // 1. Sales Orders (Ordered)
  if (normResource === "sales_orders") {
    const orderNo = b.order_number || b.id || details.itemId || ""
    const customer = b.customer_name || b.customer || b.company_name || ""
    const amt = b.total_amount ? `${Number(b.total_amount).toLocaleString()} ETB` : ""
    if (method === "POST") {
      return {
        activityType: "Ordered",
        description: `Created Sales Order ${orderNo ? `#${orderNo}` : ""}${customer ? ` for ${customer}` : ""}${amt ? ` (${amt})` : ""}`.trim(),
        targetName: customer || orderNo,
      }
    }
    if (method === "PATCH" || method === "PUT") {
      return {
        activityType: "Edited Order",
        description: `Updated Sales Order ${orderNo ? `#${orderNo}` : ""}${customer ? ` (${customer})` : ""}`.trim(),
        targetName: customer || orderNo,
      }
    }
    if (method === "DELETE") {
      return {
        activityType: "Cancelled Order",
        description: `Cancelled Sales Order ${orderNo ? `#${orderNo}` : ""}`.trim(),
        targetName: orderNo,
      }
    }
  }

  // 2. Purchase Orders (Purchased / Ordered)
  if (normResource === "purchase_orders") {
    const poNo = b.po_number || b.id || details.itemId || ""
    const supplier = b.supplier_name || b.supplier || ""
    const amt = b.total_amount ? `${Number(b.total_amount).toLocaleString()} ETB` : ""
    if (method === "POST") {
      return {
        activityType: "Purchase Order",
        description: `Created Purchase Order ${poNo ? `#${poNo}` : ""}${supplier ? ` from ${supplier}` : ""}${amt ? ` (${amt})` : ""}`.trim(),
        targetName: supplier || poNo,
      }
    }
    if (method === "PATCH" || method === "PUT") {
      return {
        activityType: "Edited PO",
        description: `Updated Purchase Order ${poNo ? `#${poNo}` : ""}`.trim(),
        targetName: poNo,
      }
    }
  }

  // 3. Sales Issues (Issued Goods / Dispatch)
  if (normResource === "sales_issues" || normResource === "sales_issue_items") {
    const issueNo = b.issue_number || b.id || details.itemId || ""
    const customer = b.customer_name || b.customer || ""
    const wh = b.warehouse || b.warehouse_id || ""
    if (normAction.includes("post") || normAction.includes("dispatch")) {
      return {
        activityType: "Issued Goods",
        description: `Dispatched & posted Sales Issue ${issueNo ? `#${issueNo}` : ""}${customer ? ` to ${customer}` : ""}${wh ? ` from ${wh}` : ""}`.trim(),
        targetName: customer || issueNo,
      }
    }
    if (method === "POST") {
      return {
        activityType: "Issued Goods",
        description: `Issued Sales Goods ${issueNo ? `#${issueNo}` : ""}${customer ? ` to ${customer}` : ""}${wh ? ` from ${wh}` : ""}`.trim(),
        targetName: customer || issueNo,
      }
    }
    if (method === "PATCH" || method === "PUT") {
      return {
        activityType: "Edited Issue",
        description: `Updated Sales Issue ${issueNo ? `#${issueNo}` : ""}`.trim(),
        targetName: issueNo,
      }
    }
  }

  // 4. Invoices & Payments (Sale / Invoice / Receipt)
  if (normResource === "invoices") {
    const invNo = b.invoice_number || b.id || details.itemId || ""
    const customer = b.customer_name || b.customer || ""
    const amt = b.total_amount ? `${Number(b.total_amount).toLocaleString()} ETB` : ""
    if (method === "POST") {
      return {
        activityType: "Sale / Invoice",
        description: `Issued Customer Invoice ${invNo ? `#${invNo}` : ""}${customer ? ` for ${customer}` : ""}${amt ? ` (${amt})` : ""}`.trim(),
        targetName: customer || invNo,
      }
    }
    return {
      activityType: "Edited Invoice",
      description: `Updated Invoice ${invNo ? `#${invNo}` : ""}`.trim(),
      targetName: invNo,
    }
  }

  if (normResource === "payments") {
    const payNo = b.payment_number || b.id || details.itemId || ""
    const amt = b.amount ? `${Number(b.amount).toLocaleString()} ETB` : ""
    const method_name = b.payment_method || ""
    if (method === "POST") {
      return {
        activityType: "Sale Payment",
        description: `Recorded Sale Payment ${payNo ? `#${payNo}` : ""}${amt ? `: ${amt}` : ""}${method_name ? ` via ${method_name}` : ""}`.trim(),
        targetName: payNo,
      }
    }
    return {
      activityType: "Edited Payment",
      description: `Updated Payment Record ${payNo ? `#${payNo}` : ""}`.trim(),
      targetName: payNo,
    }
  }

  // 5. Stock & Inventory (Stock Intake, Movements, Product Registry, Transfers)
  if (normResource === "stock_movements" || normResource === "export_warehouse_movements") {
    const pName = b.product_name || b.product_id || ""
    const qty = b.quantity ? `${b.quantity} units` : ""
    const moveType = b.type || b.movement_type || "Movement"
    const wh = b.warehouse || b.warehouse_id || ""
    return {
      activityType: "Stock Movement",
      description: `Recorded Stock ${moveType}${pName ? ` for ${pName}` : ""}${qty ? ` (${qty})` : ""}${wh ? ` at ${wh}` : ""}`.trim(),
      targetName: pName,
    }
  }

  if (normResource === "store_transfers" || normResource === "store_transfer_items") {
    const transNo = b.transfer_number || b.id || details.itemId || ""
    const fromWh = b.from_warehouse || ""
    const toWh = b.to_warehouse || ""
    if (method === "POST") {
      return {
        activityType: "Stock Transfer",
        description: `Initiated Store Transfer ${transNo ? `#${transNo}` : ""}${fromWh && toWh ? ` (${fromWh} → ${toWh})` : ""}`.trim(),
        targetName: transNo,
      }
    }
    return {
      activityType: "Edited Transfer",
      description: `Updated Store Transfer ${transNo ? `#${transNo}` : ""}`.trim(),
      targetName: transNo,
    }
  }

  if (normResource.includes("product")) {
    const pName = b.name || b.code || details.itemId || ""
    const qty = b.quantity !== undefined ? `${b.quantity} qty` : ""
    const wh = b.warehouse || b.warehouse_id || ""
    if (method === "POST") {
      return {
        activityType: "Registered Product",
        description: `Registered product into stock: ${pName}${qty ? ` (${qty})` : ""}${wh ? ` at ${wh}` : ""}`.trim(),
        targetName: pName,
      }
    }
    if (method === "PATCH" || method === "PUT") {
      return {
        activityType: "Edited Stock",
        description: `Updated stock / pricing for ${pName}${wh ? ` at ${wh}` : ""}`.trim(),
        targetName: pName,
      }
    }
    if (method === "DELETE") {
      return {
        activityType: "Deleted Stock",
        description: `Removed product ${pName} from inventory`.trim(),
        targetName: pName,
      }
    }
  }

  // 6. Registrations & Customer / Supplier / Partner Directories
  if (normResource === "customers") {
    const cName = b.name || b.company_name || details.itemId || ""
    if (method === "POST") {
      return {
        activityType: "Registered Customer",
        description: `Registered new customer: ${cName}`.trim(),
        targetName: cName,
      }
    }
    return {
      activityType: "Edited Customer",
      description: `Updated customer profile: ${cName}`.trim(),
      targetName: cName,
    }
  }

  if (normResource === "suppliers") {
    const sName = b.name || b.company_name || details.itemId || ""
    if (method === "POST") {
      return {
        activityType: "Registered Supplier",
        description: `Registered new supplier: ${sName}`.trim(),
        targetName: sName,
      }
    }
    return {
      activityType: "Edited Supplier",
      description: `Updated supplier profile: ${sName}`.trim(),
      targetName: sName,
    }
  }

  if (normResource === "partners") {
    const pName = b.name || b.company_name || details.itemId || ""
    if (method === "POST") {
      return {
        activityType: "Registered Partner",
        description: `Registered partner directory: ${pName}`.trim(),
        targetName: pName,
      }
    }
    return {
      activityType: "Edited Partner",
      description: `Updated partner profile: ${pName}`.trim(),
      targetName: pName,
    }
  }

  // 7. HR & Personnel
  if (normResource === "employees") {
    const empName = b.full_name || b.employee_number || details.itemId || ""
    const wh = b.warehouse_id || ""
    if (method === "POST") {
      return {
        activityType: "Registered Employee",
        description: `Registered new employee: ${empName}${wh ? ` (${wh})` : ""}`.trim(),
        targetName: empName,
      }
    }
    return {
      activityType: "Edited Employee",
      description: `Updated employee record for ${empName}`.trim(),
      targetName: empName,
    }
  }

  if (normResource === "payroll_records" || normResource === "payroll_periods") {
    const month = b.month || ""
    const year = b.year || ""
    return {
      activityType: "Processed Payroll",
      description: `Processed payroll records${month || year ? ` for ${month} ${year}` : ""}`.trim(),
      targetName: `${month} ${year}`.trim(),
    }
  }

  if (normResource === "leave_requests") {
    const lType = b.leave_type || "Leave"
    const emp = b.employee_name || b.employee_id || ""
    if (method === "POST") {
      return {
        activityType: "Leave Request",
        description: `Submitted ${lType} request${emp ? ` for ${emp}` : ""}`.trim(),
        targetName: emp,
      }
    }
    return {
      activityType: "Updated Leave",
      description: `Updated / Approved ${lType} request${emp ? ` for ${emp}` : ""}`.trim(),
      targetName: emp,
    }
  }

  if (normResource === "attendance_records") {
    const attDate = b.attendance_date || ""
    return {
      activityType: "Attendance Log",
      description: `Saved daily attendance log${attDate ? ` for ${attDate}` : ""}`.trim(),
      targetName: attDate,
    }
  }

  // 8. Finance, GL & Expenses
  if (normResource === "expenses") {
    const cat = b.category || b.description || ""
    const amt = b.amount ? `${Number(b.amount).toLocaleString()} ETB` : ""
    if (method === "POST") {
      return {
        activityType: "Recorded Expense",
        description: `Recorded expense claim: ${cat}${amt ? ` (${amt})` : ""}`.trim(),
        targetName: cat,
      }
    }
    return {
      activityType: "Edited Expense",
      description: `Updated expense claim: ${cat}`.trim(),
      targetName: cat,
    }
  }

  if (normResource === "journal_entries" || normResource === "journal_entry_lines") {
    const ref = b.reference || b.entry_number || details.itemId || ""
    return {
      activityType: "Journal Entry",
      description: `Posted General Journal entry ${ref ? `#${ref}` : ""}`.trim(),
      targetName: ref,
    }
  }

  // 9. Admin & Security
  if (normResource === "users") {
    const uName = b.username || details.itemId || ""
    if (method === "POST") {
      return {
        activityType: "Registered User",
        description: `Created user account @${uName}`.trim(),
        targetName: `@${uName}`,
      }
    }
    return {
      activityType: "Edited User",
      description: `Updated user account @${uName}`.trim(),
      targetName: `@${uName}`,
    }
  }

  if (normResource === "auth") {
    return {
      activityType: "Authentication",
      description: `User authenticated & logged into system`.trim(),
    }
  }

  // Fallback
  const fallbackVerb = method === "POST" ? "Created" : method === "PATCH" || method === "PUT" ? "Updated" : method === "DELETE" ? "Deleted" : action
  return {
    activityType: fallbackVerb,
    description: `${fallbackVerb} ${normResource.replace(/_/g, " ")}${details.itemId ? ` #${details.itemId}` : ""}`.trim(),
    targetName: details.itemId || "",
  }
}

/**
 * Log activity helper writing resiliently through Drizzle CRUD.
 */
export async function logActivity(userId, username, fullname, action, resource, details = {}) {
  try {
    const id = `LOG-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`
    const logResource = getResource("user_activity_logs")
    const actionLabel = details.activityType || action || "Activity"
    await drizzleCreateRow({
      resource: logResource,
      body: {
        id,
        user_id: userId || null,
        username: username || "system",
        fullname: fullname || details.fullname || null,
        action: actionLabel,
        resource: resource || "system",
        module: resource || "system",
        entity_type: details.entityType || resource || null,
        entity_id: details.itemId || null,
        details: { fullname, ...details },
        created_at: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error("[ACTIVITY LOGGER ERROR] Failed to write log via Drizzle:", err.message)
  }
}

/**
 * Express middleware to automatically log mutating API operations.
 */
export function activityLoggerMiddleware(req, res, next) {
  // Only log state-modifying HTTP methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next()
  }

  // Skip login endpoint (handled manually in login controller)
  if (req.originalUrl.includes("/api/auth/login")) {
    return next()
  }

  // Explicit skip flag
  if (req.headers["x-skip-activity-log"] === "true" || req.headers["x-sync-init"] === "true") {
    return next()
  }

  const onFinish = async () => {
    res.removeListener("finish", onFinish)
    res.removeListener("close", onFinish)

    // Log only successful transactions for authenticated users
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const { resource, action } = parseRequestAction(req.method, req.originalUrl || req.url)

      // Skip logging logs themselves to prevent recursion
      if (resource === "user_activity_logs") {
        return
      }

      // Populate details metadata
      const details = {
        path: req.originalUrl || req.url,
        ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1").split(",")[0].trim(),
      }

      // If an ID is present in the path, extract it
      const idMatch = (req.originalUrl || req.url).match(/\/api\/[^/]+\/([^/?#]+)/)
      if (idMatch && idMatch[1] && !["assign", "rules", "batches", "officers"].includes(idMatch[1])) {
        details.itemId = idMatch[1]
      }

      // Filter out automated bulk resource synchronizations (e.g. initial loads of chart_of_accounts, tax_rules, gl_mappings)
      if (
        Array.isArray(req.body) &&
        !details.itemId &&
        ["chart_of_accounts", "tax_rules", "gl_account_mappings", "tax_types"].includes(resource)
      ) {
        return
      }

      let bodyToUse = typeof req.body === "object" && req.body !== null ? { ...req.body } : {}

      // If employee resource is updated without full_name in body, look up full_name from database
      if (resource === "employees" && details.itemId && !bodyToUse.full_name && !bodyToUse.fullname) {
        try {
          const [rows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [details.itemId])
          if (rows && rows.length > 0) {
            const emp = unwrapRow(rows[0], "jsonb_document")
            if (emp?.full_name || emp?.fullname) {
              bodyToUse.full_name = emp.full_name || emp.fullname
            }
          }
        } catch {
          // ignore error
        }
      }

      const fullname = req.user.fullname || req.user.username || ""

      // Generate business-oriented operation description
      const summary = generateActivitySummary({
        method: req.method,
        resource,
        action,
        body: bodyToUse,
        details,
      })

      details.activityType = summary.activityType
      details.description = summary.description
      if (summary.targetName) details.targetName = summary.targetName

      logActivity(req.user.id, req.user.username, fullname, summary.activityType || action, resource, details).catch(err =>
        console.error("[AUTO LOG ERROR]", err.message)
      )
    }
  }

  res.on("finish", onFinish)
  res.on("close", onFinish)

  next()
}

