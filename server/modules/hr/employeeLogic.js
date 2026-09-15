import { pool } from "../../db/client.js"
import { unwrapRow } from "../../db/dbUtils.js"

export async function listEmployees(query = {}) {
  const [rows] = await pool.query("SELECT * FROM `employees` ORDER BY created_at DESC")
  let list = rows.map((r) => unwrapRow(r, "jsonb_document"))

  if (query.warehouse_id || query.warehouse) {
    const wh = String(query.warehouse_id || query.warehouse).trim()
    list = list.filter((e) => e.warehouse_id === wh || e.warehouse === wh)
  }
  if (query.status) {
    list = list.filter((e) => String(e.status).toLowerCase() === String(query.status).toLowerCase())
  }
  if (query.search) {
    const s = String(query.search).toLowerCase()
    list = list.filter((e) =>
      (e.full_name && e.full_name.toLowerCase().includes(s)) ||
      (e.employee_number && e.employee_number.toLowerCase().includes(s)) ||
      (e.email && e.email.toLowerCase().includes(s))
    )
  }

  return { status: 200, body: list }
}

export async function getEmployee(id) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Employee '${cleanId}' not found.` } }
  return { status: 200, body: unwrapRow(rows[0], "jsonb_document") }
}

export async function createEmployee(body = {}) {
  const empId = body.id || `EMP-${Date.now()}`
  const employeeNumber = body.employee_number || `HKC-${String(Date.now()).slice(-4)}`
  const record = {
    ...body,
    id: empId,
    employee_number: employeeNumber,
    status: body.status || "Active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "INSERT INTO `employees` (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))",
    [empId, JSON.stringify(record)]
  )

  const [rows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [empId])
  return { status: 201, body: unwrapRow(rows[0], "jsonb_document") }
}

export async function updateEmployee(id, updates = {}) {
  const cleanId = String(id).trim()
  const [rows] = await pool.query("SELECT * FROM `employees` WHERE id = ?", [cleanId])
  if (rows.length === 0) return { status: 404, body: { error: `Employee '${cleanId}' not found.` } }

  const current = unwrapRow(rows[0], "jsonb_document")
  const merged = {
    ...current,
    ...updates,
    id: cleanId,
    updated_at: new Date().toISOString(),
  }

  await pool.query(
    "UPDATE `employees` SET payload = ?, updated_at = NOW(3) WHERE id = ?",
    [JSON.stringify(merged), cleanId]
  )

  return { status: 200, body: merged }
}

export async function deleteEmployee(id) {
  const cleanId = String(id).trim()
  await pool.query("DELETE FROM `employees` WHERE id = ?", [cleanId])
  return { status: 200, body: { success: true, message: `Employee '${cleanId}' deleted.` } }
}
