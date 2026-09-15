import mysql from "mysql2/promise"
import crypto from "node:crypto"

function getMysqlPoolConfig() {
  const base = {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  }

  if (process.env.MYSQL_URL) {
    return { uri: process.env.MYSQL_URL, ...base }
  }

  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "hkc_erp",
    ...base,
  }
}

let pool = null

export function getMysqlPool() {
  if (!pool) {
    pool = mysql.createPool(getMysqlPoolConfig())
  }
  return pool
}

function documentId(body) {
  return body && typeof body === "object" && body.id ? String(body.id) : crypto.randomUUID()
}

function unwrapDocumentRow(row) {
  if (!row) return null
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {})
  return { id: row.id, ...payload }
}

function parseFilterValue(val) {
  if (typeof val !== "string") return { op: "=", value: val }
  if (val.startsWith("eq.")) return { op: "=", value: val.slice(3) }
  if (val.startsWith("neq.")) return { op: "!=", value: val.slice(4) }
  if (val.startsWith("gt.")) return { op: ">", value: val.slice(3) }
  if (val.startsWith("gte.")) return { op: ">=", value: val.slice(4) }
  if (val.startsWith("lt.")) return { op: "<", value: val.slice(3) }
  if (val.startsWith("lte.")) return { op: "<=", value: val.slice(4) }
  if (val.startsWith("like.")) return { op: "LIKE", value: val.slice(5) }
  if (val.startsWith("ilike.")) return { op: "LIKE", value: val.slice(6) }
  return { op: "=", value: val }
}

export async function listRowsMysql({ resource, query = {} }) {
  const p = getMysqlPool()
  const tableName = resource.table
  const isDocument = resource.storage === "jsonb_document"

  let sql = `SELECT * FROM \`${tableName}\``
  const whereClauses = []
  const params = []

  const reservedKeys = new Set([
    "limit",
    "offset",
    "order",
    "select",
    "range",
    "apikey",
    "page",
    "pageSize",
    "sort",
    "search",
    "batch",
    "q",
    "count",
  ])

  for (const [key, rawVal] of Object.entries(query)) {
    if (reservedKeys.has(key) || rawVal === undefined || rawVal === null || rawVal === "") continue

    const { op, value } = parseFilterValue(rawVal)

    if (isDocument && key !== "id" && key !== "created_at" && key !== "updated_at") {
      whereClauses.push(`JSON_UNQUOTE(JSON_EXTRACT(\`payload\`, '$.${key}')) ${op} ?`)
      params.push(String(value))
    } else {
      whereClauses.push(`\`${key}\` ${op} ?`)
      params.push(value)
    }
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(" AND ")
  }

  const orderParam = query.order || query.sort
  if (orderParam) {
    const [orderCol, orderDir] = String(orderParam).split(".")
    const dir = orderDir && orderDir.toLowerCase() === "asc" ? "ASC" : "DESC"
    if (isDocument && orderCol !== "id" && orderCol !== "created_at" && orderCol !== "updated_at") {
      sql += ` ORDER BY JSON_UNQUOTE(JSON_EXTRACT(\`payload\`, '$.${orderCol}')) ${dir}`
    } else {
      sql += ` ORDER BY \`${orderCol}\` ${dir}`
    }
  } else if (isDocument) {
    sql += ` ORDER BY \`created_at\` DESC`
  }

  const limitVal = query.pageSize ? parseInt(query.pageSize, 10) : query.limit ? parseInt(query.limit, 10) : null
  const offsetVal = query.offset
    ? parseInt(query.offset, 10)
    : query.page && limitVal
    ? (Math.max(1, parseInt(query.page, 10)) - 1) * limitVal
    : null

  if (limitVal !== null && !isNaN(limitVal)) {
    sql += ` LIMIT ?`
    params.push(limitVal)
  }
  if (offsetVal !== null && !isNaN(offsetVal)) {
    sql += ` OFFSET ?`
    params.push(offsetVal)
  }

  const [rows] = await p.query(sql, params)

  const formatted = isDocument
    ? rows.map(unwrapDocumentRow)
    : rows

  return {
    status: 200,
    headers: { "Content-Range": `0-${rows.length}/${rows.length}` },
    body: formatted,
  }
}

export async function getRowMysql({ resource, id }) {
  const p = getMysqlPool()
  const tableName = resource.table

  const [rows] = await p.query(`SELECT * FROM \`${tableName}\` WHERE \`id\` = ? LIMIT 1`, [String(id)])
  if (!rows || rows.length === 0) {
    return { status: 404, headers: {}, body: { error: `Record with id '${id}' not found in ${tableName}.` } }
  }

  const result = resource.storage === "jsonb_document"
    ? unwrapDocumentRow(rows[0])
    : rows[0]

  return { status: 200, headers: {}, body: result }
}

function formatMysqlValue(v) {
  if (v === undefined || v === null) return null
  if (v instanceof Date) return v
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        const pad = (n, len = 2) => String(n).padStart(len, "0")
        const y = d.getUTCFullYear()
        const m = pad(d.getUTCMonth() + 1)
        const dt = pad(d.getUTCDate())
        const h = pad(d.getUTCHours())
        const min = pad(d.getUTCMinutes())
        const s = pad(d.getUTCSeconds())
        const ms = pad(d.getUTCMilliseconds(), 3)
        return `${y}-${m}-${dt} ${h}:${min}:${s}.${ms}`
      }
    }
    return v
  }
  if (typeof v === "object") return JSON.stringify(v)
  return v
}

export async function createRowMysql({ resource, body }) {
  const p = getMysqlPool()
  const tableName = resource.table
  const id = documentId(body)

  if (resource.storage === "jsonb_document") {
    const payload = JSON.stringify({ ...body, id })
    await p.query(
      `INSERT INTO \`${tableName}\` (id, payload) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP(3)`,
      [id, payload]
    )
    return { status: 201, headers: {}, body: { id, ...body } }
  }

  const keys = Object.keys(body)
  const values = Object.values(body).map(formatMysqlValue)
  const cols = keys.map((k) => `\`${k}\``).join(", ")
  const placeholders = keys.map(() => "?").join(", ")
  const updateClause = keys.filter((k) => k !== "id").map((k) => `\`${k}\` = VALUES(\`${k}\`)`).join(", ")

  await p.query(
    `INSERT INTO \`${tableName}\` (${cols}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updateClause || "id=id"}`,
    values
  )
  return { status: 201, headers: {}, body }
}

export async function updateRowMysql({ resource, id, body }) {
  const p = getMysqlPool()
  const tableName = resource.table

  if (resource.storage === "jsonb_document") {
    const existing = await getRowMysql({ resource, id })
    const existingBody = existing.status === 200 ? existing.body : {}
    const updatedPayload = { ...existingBody, ...body, id: String(id) }

    await p.query(
      `UPDATE \`${tableName}\` SET \`payload\` = ? WHERE \`id\` = ?`,
      [JSON.stringify(updatedPayload), String(id)]
    )
    return { status: 200, headers: {}, body: updatedPayload }
  }

  const entries = Object.entries(body).filter(([k]) => k !== "id")
  if (entries.length === 0) {
    return { status: 200, headers: {}, body }
  }

  const setClause = entries.map(([k]) => `\`${k}\` = ?`).join(", ")
  const values = entries.map(([, v]) => formatMysqlValue(v))
  values.push(String(id))

  await p.query(`UPDATE \`${tableName}\` SET ${setClause} WHERE \`id\` = ?`, values)
  return { status: 200, headers: {}, body: { id, ...body } }
}

export async function deleteRowMysql({ resource, id }) {
  const p = getMysqlPool()
  const tableName = resource.table

  await p.query(`DELETE FROM \`${tableName}\` WHERE \`id\` = ?`, [String(id)])
  return { status: 200, headers: {}, body: { ok: true, id } }
}

const PROTECTED_TABLES = new Set([
  "chart_of_accounts",
  "journal_entries",
  "journal_entry_lines",
  "invoices",
  "payments",
  "tax_rules",
  "company_settings",
])

export async function replaceRowsMysql({ resource, body }) {
  if (!Array.isArray(body)) {
    return { status: 400, headers: {}, body: { error: "Request body must be an array." } }
  }

  const p = getMysqlPool()
  const tableName = resource.table

  if (body.length === 0) {
    if (PROTECTED_TABLES.has(tableName)) {
      return { status: 200, headers: {}, body: { ok: true, count: 0, skipped: "Protected table: empty wipe prevented" } }
    }
    await p.query(`DELETE FROM \`${tableName}\``)
    return { status: 200, headers: {}, body: { ok: true, count: 0 } }
  }

  for (const item of body) {
    const id = documentId(item)
    if (resource.storage === "jsonb_document") {
      const payload = JSON.stringify({ ...item, id })
      await p.query(
        `INSERT INTO \`${tableName}\` (id, payload) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP(3)`,
        [id, payload]
      )
    } else {
      const keys = Object.keys(item)
      const values = Object.values(item).map(formatMysqlValue)
      const cols = keys.map((k) => `\`${k}\``).join(", ")
      const placeholders = keys.map(() => "?").join(", ")
      const updateClause = keys.filter((k) => k !== "id").map((k) => `\`${k}\` = VALUES(\`${k}\`)`).join(", ")

      await p.query(
        `INSERT INTO \`${tableName}\` (${cols}) VALUES (${placeholders})
         ON DUPLICATE KEY UPDATE ${updateClause || "id=id"}`,
        values
      )
    }
  }

  return { status: 200, headers: {}, body: { ok: true, count: body.length } }
}
