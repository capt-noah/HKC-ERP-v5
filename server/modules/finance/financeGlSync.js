import { withTransaction } from "../../db/transactionHelper.js"
import { pool } from "../../db/client.js"

/**
 * Synchronize and persist Invoice GL Distribution atomically.
 * Deletes previous journal entry lines for the target entry, inserts replacement lines,
 * and updates both invoices.gl_distribution and sales_issues.account_entries.
 */
export async function syncInvoiceGLDistribution(invoiceId, payload) {
  const { revenueLines = [], cogsLines = [], notes = "", salesIssueId = null } = payload

  // 1. Double entry validation for revenueLines
  const revDebits = Math.round(revenueLines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100
  const revCredits = Math.round(revenueLines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100
  if (Math.abs(revDebits - revCredits) > 0.01) {
    return {
      status: 400,
      body: { error: `Revenue distribution is unbalanced: Debits (${revDebits.toFixed(2)}) != Credits (${revCredits.toFixed(2)})` }
    }
  }

  // 2. Double entry validation for cogsLines
  if (Array.isArray(cogsLines) && cogsLines.length > 0) {
    const cogsDebits = Math.round(cogsLines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100
    const cogsCredits = Math.round(cogsLines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100
    if (Math.abs(cogsDebits - cogsCredits) > 0.01) {
      return {
        status: 400,
        body: { error: `COGS distribution is unbalanced: Debits (${cogsDebits.toFixed(2)}) != Credits (${cogsCredits.toFixed(2)})` }
      }
    }
  }

  return await withTransaction(async (conn) => {
    // 3. Find invoice
    const [invRows] = await conn.query(
      "SELECT * FROM invoices WHERE id = ? OR invoice_number = ? LIMIT 1",
      [String(invoiceId), String(invoiceId)]
    )
    if (invRows.length === 0) {
      return { status: 404, body: { error: `Invoice ${invoiceId} not found` } }
    }
    const inv = invRows[0]
    const cleanInvId = inv.id
    const isPurchase = inv.invoice_type === "Purchase" || Boolean(inv.purchase_order_id)

    // 4. Determine canonical & matching Primary JE IDs
    const canonicalPrimaryJeId = isPurchase
      ? (inv.purchase_order_id ? `JE-PO-${inv.purchase_order_id}` : `JE-PO-${inv.invoice_number}`)
      : (inv.sales_issue_id ? `JE-SALE-${inv.sales_issue_id}` : `JE-SALE-${inv.invoice_number}`)

    const primaryTargetJeIds = new Set([
      canonicalPrimaryJeId,
      `JE-SALE-${cleanInvId}`,
      `JE-SALE-${inv.invoice_number}`,
      `JE-PO-${cleanInvId}`,
      `JE-PO-${inv.invoice_number}`,
    ])
    if (inv.sales_issue_id) primaryTargetJeIds.add(`JE-SALE-${inv.sales_issue_id}`)
    if (inv.purchase_order_id) primaryTargetJeIds.add(`JE-PO-${inv.purchase_order_id}`)

    // 5. Determine canonical & matching COGS JE IDs
    const canonicalCogsJeId = inv.sales_issue_id ? `JE-COGS-${inv.sales_issue_id}` : `JE-COGS-${inv.invoice_number}`
    const cogsTargetJeIds = new Set([
      canonicalCogsJeId,
      `JE-COGS-${cleanInvId}`,
      `JE-COGS-${inv.invoice_number}`,
    ])
    if (inv.sales_issue_id) cogsTargetJeIds.add(`JE-COGS-${inv.sales_issue_id}`)

    // 6. Delete old journal_entry_lines for primary (and cogs only if cogsLines provided)
    const allJeIdsToDelete = [...primaryTargetJeIds]
    if (Array.isArray(cogsLines) && cogsLines.length > 0) {
      allJeIdsToDelete.push(...cogsTargetJeIds)
    }
    if (allJeIdsToDelete.length > 0) {
      await conn.query(
        "DELETE FROM journal_entry_lines WHERE journal_entry_id IN (?)",
        [allJeIdsToDelete]
      )
    }

    // 7. Load chart of accounts for fast code/name resolution
    const [coaRows] = await conn.query("SELECT id, code, name FROM chart_of_accounts")
    const coaMap = new Map()
    for (const row of coaRows) {
      coaMap.set(row.id, row)
      if (row.code) coaMap.set(row.code, row)
    }

    // 8. Ensure primary JE header exists or is updated
    const entryDate = inv.issue_date || new Date().toISOString().slice(0, 10)
    const primaryDesc = isPurchase
      ? `Purchase Invoice ${inv.invoice_number} for ${inv.customer_name || "Supplier"}`
      : `Sales Invoice ${inv.invoice_number} for ${inv.customer_name || "Customer"}`
    const primarySourceType = isPurchase ? "Purchase Invoice" : "Sales Invoice"
    const primarySourceId = isPurchase ? (inv.purchase_order_id || inv.invoice_number) : (inv.sales_issue_id || inv.invoice_number)

    await conn.query(
      `INSERT INTO journal_entries (id, entry_number, entry_date, description, source_type, source_id, created_by, currency, exchange_rate, posting_status, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, 'Finance GL Split Tool', ?, 1.0, 'Posted', ?)
       ON DUPLICATE KEY UPDATE entry_date = VALUES(entry_date), description = VALUES(description), total_amount = VALUES(total_amount)`,
      [canonicalPrimaryJeId, inv.invoice_number, entryDate, primaryDesc, primarySourceType, primarySourceId, inv.currency || "ETB", revCredits]
    )

    // 9. Insert new primary lines
    for (let i = 0; i < revenueLines.length; i++) {
      const l = revenueLines[i]
      const lineId = l.id || `JEL-${canonicalPrimaryJeId}-${i + 1}-${Date.now().toString().slice(-4)}`
      const accKey = l.account_id || l.accountId || l.account_code || l.accountCode
      const coa = coaMap.get(accKey) || coaMap.get(l.account_id)
      const accId = coa ? coa.id : accKey
      const accCode = coa ? coa.code : (l.account_code || l.accountCode || null)
      const accName = coa ? coa.name : (l.account_name || l.accountName || null)

      await conn.query(
        `INSERT INTO journal_entry_lines 
         (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, currency, exchange_rate_at_time, warehouse_id, party_type, party_id, party_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, ?, ?, ?, ?)`,
        [
          lineId,
          canonicalPrimaryJeId,
          accId,
          accCode,
          accName,
          l.description || primaryDesc,
          Math.round((Number(l.debit) || 0) * 100) / 100,
          Math.round((Number(l.credit) || 0) * 100) / 100,
          inv.currency || "ETB",
          inv.warehouse_id || null,
          l.party_type || (isPurchase ? "Supplier" : "Customer"),
          l.party_id || inv.customer_id || null,
          l.party_name || inv.customer_name || null,
        ]
      )
    }

    // 10. Ensure COGS JE header and lines if cogsLines present
    if (Array.isArray(cogsLines) && cogsLines.length > 0) {
      const cogsCredits = Math.round(cogsLines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100
      const cogsDesc = `Inventory cost for sales invoice ${inv.invoice_number}`

      await conn.query(
        `INSERT INTO journal_entries (id, entry_number, entry_date, description, source_type, source_id, created_by, currency, exchange_rate, posting_status, total_amount)
         VALUES (?, ?, ?, ?, 'Sales Issue', ?, 'Finance GL Split Tool', ?, 1.0, 'Posted', ?)
         ON DUPLICATE KEY UPDATE entry_date = VALUES(entry_date), description = VALUES(description), total_amount = VALUES(total_amount)`,
        [canonicalCogsJeId, inv.invoice_number, entryDate, cogsDesc, inv.sales_issue_id || inv.invoice_number, inv.currency || "ETB", cogsCredits]
      )

      for (let i = 0; i < cogsLines.length; i++) {
        const l = cogsLines[i]
        const lineId = l.id || `JEL-${canonicalCogsJeId}-${i + 1}-${Date.now().toString().slice(-4)}`
        const accKey = l.account_id || l.accountId || l.account_code || l.accountCode
        const coa = coaMap.get(accKey) || coaMap.get(l.account_id)
        const accId = coa ? coa.id : accKey
        const accCode = coa ? coa.code : (l.account_code || l.accountCode || null)
        const accName = coa ? coa.name : (l.account_name || l.accountName || null)

        await conn.query(
          `INSERT INTO journal_entry_lines 
           (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, currency, exchange_rate_at_time, warehouse_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, ?)`,
          [
            lineId,
            canonicalCogsJeId,
            accId,
            accCode,
            accName,
            l.description || cogsDesc,
            Math.round((Number(l.debit) || 0) * 100) / 100,
            Math.round((Number(l.credit) || 0) * 100) / 100,
            inv.currency || "ETB",
            inv.warehouse_id || null,
          ]
        )
      }
    }

    const existingGlDist = typeof inv.gl_distribution === "string" 
      ? JSON.parse(inv.gl_distribution || "{}") 
      : (inv.gl_distribution || {})
    const effectiveCogsLines = (Array.isArray(cogsLines) && cogsLines.length > 0)
      ? cogsLines
      : (existingGlDist.cogs_lines || [])

    // 11. Update invoices.gl_distribution
    const glDistObj = {
      revenue_lines: revenueLines,
      cogs_lines: effectiveCogsLines,
      notes,
      updated_at: new Date().toISOString(),
      updated_by: "Finance GL Split Tool",
    }
    await conn.query(
      "UPDATE invoices SET gl_distribution = ? WHERE id = ?",
      [JSON.stringify(glDistObj), cleanInvId]
    )

    // 12. Bidirectional sync with sales_issues if linked
    const targetSiId = salesIssueId || inv.sales_issue_id
    if (targetSiId) {
      const revDebitsLines = revenueLines.filter((l) => Number(l.debit) > 0)
      const revCreditsLines = revenueLines.filter((l) => Number(l.credit) > 0)
      const cogsDebitsLines = effectiveCogsLines.filter((l) => Number(l.debit) > 0)
      const cogsCreditsLines = effectiveCogsLines.filter((l) => Number(l.credit) > 0)

      const normalizedAccountEntries = {
        revenue_lines: revenueLines,
        cogs_lines: effectiveCogsLines,
        debit_lines: revDebitsLines.map((l) => ({
          id: l.id,
          accountId: l.account_id || l.accountId || l.account_code || l.accountCode,
          accountCode: l.account_code || l.accountCode || l.account_id || l.accountId,
          accountName: l.account_name || l.accountName,
          description: l.description,
          amount: Number(l.debit) || 0,
          debit: Number(l.debit) || 0,
          credit: 0,
        })),
        credit_lines: revCreditsLines.map((l) => ({
          id: l.id,
          accountId: l.account_id || l.accountId || l.account_code || l.accountCode,
          accountCode: l.account_code || l.accountCode || l.account_id || l.accountId,
          accountName: l.account_name || l.accountName,
          description: l.description,
          amount: Number(l.credit) || 0,
          debit: 0,
          credit: Number(l.credit) || 0,
        })),
        cogs_debit_lines: cogsDebitsLines.map((l) => ({
          id: l.id,
          accountId: l.account_id || l.accountId || l.account_code || l.accountCode,
          accountCode: l.account_code || l.accountCode || l.account_id || l.accountId,
          accountName: l.account_name || l.accountName,
          description: l.description,
          amount: Number(l.debit) || 0,
          debit: Number(l.debit) || 0,
          credit: 0,
        })),
        cogs_credit_lines: cogsCreditsLines.map((l) => ({
          id: l.id,
          accountId: l.account_id || l.accountId || l.account_code || l.accountCode,
          accountCode: l.account_code || l.accountCode || l.account_id || l.accountId,
          accountName: l.account_name || l.accountName,
          description: l.description,
          amount: Number(l.credit) || 0,
          debit: 0,
          credit: Number(l.credit) || 0,
        })),
        notes,
      }

      await conn.query(
        "UPDATE sales_issues SET account_entries = ? WHERE id = ?",
        [JSON.stringify(normalizedAccountEntries), targetSiId]
      )
    }

    return {
      status: 200,
      body: {
        ok: true,
        invoiceId: cleanInvId,
        primaryJeId: canonicalPrimaryJeId,
        cogsJeId: canonicalCogsJeId,
        revenueLinesCount: revenueLines.length,
        cogsLinesCount: cogsLines.length,
      }
    }
  })
}

/**
 * Save Beginning Balances atomically.
 * Deletes previous lines for JE-OPENING-BALANCES before inserting replacement lines.
 */
export async function saveBeginningBalances(payload) {
  const { asOfDate, balances = [], notes = "", created_by = "Finance Admin" } = payload

  const activeLines = balances.filter(
    (b) => Number(b.debit_amount) > 0 || Number(b.credit_amount) > 0
  )

  if (activeLines.length < 2) {
    return {
      status: 400,
      body: { error: "At least two non-zero accounts (Debit and Credit) are required to establish beginning balances." }
    }
  }

  const totalDebit = Math.round(activeLines.reduce((sum, l) => sum + (Number(l.debit_amount) || 0), 0) * 100) / 100
  const totalCredit = Math.round(activeLines.reduce((sum, l) => sum + (Number(l.credit_amount) || 0), 0) * 100) / 100
  const diff = Math.abs(totalDebit - totalCredit)

  if (diff > 0.01) {
    return {
      status: 400,
      body: {
        error: `Trial Balance Out of Balance: Total Debits (ETB ${totalDebit.toFixed(2)}) does not equal Total Credits (ETB ${totalCredit.toFixed(2)}). Difference: ETB ${diff.toFixed(2)}.`
      }
    }
  }

  const entryId = "JE-OPENING-BALANCES"
  const entryDescription = notes || "Beginning Balances - Peachtree / Sage 50 Cutover"

  return await withTransaction(async (conn) => {
    // 1. Delete previous lines for JE-OPENING-BALANCES
    await conn.query("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [entryId])

    // 2. Ensure header in journal_entries
    await conn.query(
      `INSERT INTO journal_entries (id, entry_number, entry_date, description, source_type, source_id, created_by, currency, exchange_rate, posting_status, total_amount)
       VALUES (?, 'CUTOVER-001', ?, ?, 'Beginning Balance', 'PEACHTREE-CUTOVER', ?, 'ETB', 1.0, 'Posted', ?)
       ON DUPLICATE KEY UPDATE entry_date = VALUES(entry_date), description = VALUES(description), total_amount = VALUES(total_amount)`,
      [entryId, asOfDate || "2026-01-01", entryDescription, created_by, totalCredit]
    )

    // 3. Load COA
    const [coaRows] = await conn.query("SELECT id, code, name FROM chart_of_accounts")
    const coaMap = new Map()
    for (const row of coaRows) {
      coaMap.set(row.id, row)
      if (row.code) coaMap.set(row.code, row)
    }

    // 4. Insert lines
    for (let idx = 0; idx < activeLines.length; idx++) {
      const b = activeLines[idx]
      const lineId = `JEL-OPENING-${idx + 1}-${Date.now().toString().slice(-4)}`
      const coa = coaMap.get(b.account_id)
      const accId = coa ? coa.id : b.account_id
      const accCode = coa ? coa.code : null
      const accName = coa ? coa.name : null

      await conn.query(
        `INSERT INTO journal_entry_lines 
         (id, journal_entry_id, account_id, account_code, account_name, description, debit_amount, credit_amount, currency, exchange_rate_at_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ETB', 1.0)`,
        [
          lineId,
          entryId,
          accId,
          accCode,
          accName,
          entryDescription,
          Math.round(Number(b.debit_amount) * 100) / 100,
          Math.round(Number(b.credit_amount) * 100) / 100,
        ]
      )
    }

    return {
      status: 200,
      body: {
        ok: true,
        entryId,
        count: activeLines.length,
        totalDebit,
        totalCredit,
      }
    }
  })
}
