import {
  drizzleListRows,
  drizzleGetRow,
  drizzleCreateRow,
  drizzleUpdateRow,
  drizzleDeleteRow,
} from "../../db/drizzleCrud.js"
import { getResource } from "../../db/resourceRegistry.js"
import {
  generateProcessingServiceRevenueJournalEntry,
  validateProcessingServiceOrder,
  VALID_PROCESSING_STAGES,
} from "./processingServicesLogic.js"

export async function listProcessingServices(query = {}) {
  try {
    const resource = getResource("processing_services")
    const apiQuery = {}
    if (query.status) {
      apiQuery.status = `eq.${query.status}`
    }
    const res = await drizzleListRows({ resource, query: apiQuery })
    return res
  } catch (err) {
    console.error("[DRIZZLE PS LIST ERROR]:", err.message)
    return { status: 500, body: { error: "Failed to list processing services", message: err.message } }
  }
}

export async function getProcessingService(id) {
  try {
    const resource = getResource("processing_services")
    const res = await drizzleGetRow({ resource, id })
    return res
  } catch (err) {
    console.error(`[DRIZZLE PS GET ERROR] ${id}:`, err.message)
    return { status: 500, body: { error: `Failed to get processing service '${id}'`, message: err.message } }
  }
}

export async function createProcessingService(input) {
  const errors = validateProcessingServiceOrder(input)
  if (errors.length > 0) {
    return { status: 400, body: { error: "Validation failed", details: errors } }
  }

  const id = input?.id || `PS-${Date.now().toString().slice(-5)}`
  const referenceNumber = input?.reference_number || input?.referenceNumber || id
  const clientCompanyName = input?.client_company_name || input?.customer_name || input?.clientName || "Client Company"

  const doc = {
    id,
    reference_number: referenceNumber,
    client_company_name: clientCompanyName,
    customer_id: input?.customer_id || null,
    goods_description: input?.goods_description || "Raw Agricultural Commodity",
    quantity: String(Number(input?.quantity || 1)),
    uom: input?.uom || "Quintal",
    entry_date: input?.entry_date || input?.entryDate || new Date().toISOString().split("T")[0],
    agreed_price: String(Number(input?.agreed_price || input?.agreedPrice || 0)),
    currency: input?.currency || "ETB",
    status: "Received",
    status_history: [
      { stage: "Received", timestamp: new Date().toISOString() },
    ],
    assigned_to: input?.assigned_to || input?.assignedTo || null,
    invoice_id: null,
    notes: input?.notes || "",
    contract_url: input?.contract_url || null,
    contract_file_name: input?.contract_file_name || null,
    locked_processing_rate: input?.locked_processing_rate ? String(input.locked_processing_rate) : null,
    locked_processing_fee: input?.locked_processing_fee ? String(input.locked_processing_fee) : null,
    locked_storage_fee: input?.locked_storage_fee ? String(input.locked_storage_fee) : null,
    locked_total_fee: input?.locked_total_fee ? String(input.locked_total_fee) : null,
    processed_at: input?.processed_at ? new Date(input.processed_at).toISOString() : null,
    delivered_at: input?.delivered_at ? new Date(input.delivered_at).toISOString() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  try {
    const resource = getResource("processing_services")
    const res = await drizzleCreateRow({ resource, body: doc })
    return res
  } catch (err) {
    console.error("[DRIZZLE PS CREATE ERROR]:", err.message)
    return { status: 500, body: { error: "Failed to create processing service", message: err.message } }
  }
}

export async function updateProcessingService(input, id) {
  const getRes = await getProcessingService(id)
  if (getRes.status >= 400 || !getRes.body) {
    return { status: 404, body: { error: `Processing service '${id}' not found.` } }
  }

  const patchFields = {
    updated_at: new Date().toISOString(),
  }

  if (input.reference_number || input.referenceNumber) patchFields.reference_number = input.reference_number || input.referenceNumber
  if (input.client_company_name || input.customer_name || input.clientName) patchFields.client_company_name = input.client_company_name || input.customer_name || input.clientName
  if (input.customer_id) patchFields.customer_id = input.customer_id
  if (input.goods_description) patchFields.goods_description = input.goods_description
  if (input.quantity !== undefined) patchFields.quantity = String(Number(input.quantity))
  if (input.uom) patchFields.uom = input.uom
  if (input.entry_date || input.entryDate) patchFields.entry_date = input.entry_date || input.entryDate
  if (input.agreed_price !== undefined || input.agreedPrice !== undefined) patchFields.agreed_price = String(Number(input.agreed_price ?? input.agreedPrice))
  if (input.currency) patchFields.currency = input.currency
  if (input.status) patchFields.status = input.status
  if (input.status_history || input.statusHistory) patchFields.status_history = input.status_history || input.statusHistory
  if (input.assigned_to || input.assignedTo) patchFields.assigned_to = input.assigned_to || input.assignedTo
  if (input.notes !== undefined) patchFields.notes = input.notes
  if (input.contract_url !== undefined) patchFields.contract_url = input.contract_url
  if (input.contract_file_name !== undefined) patchFields.contract_file_name = input.contract_file_name

  try {
    const resource = getResource("processing_services")
    const res = await drizzleUpdateRow({ resource, id, body: patchFields })
    return res
  } catch (err) {
    console.error(`[DRIZZLE PS UPDATE ERROR] ${id}:`, err.message)
    return { status: 500, body: { error: "Failed to update processing service", message: err.message } }
  }
}

export async function transitionProcessingServiceStage(id, targetStage, extraData = {}) {
  if (!VALID_PROCESSING_STAGES.includes(targetStage)) {
    return { status: 400, body: { error: `Invalid stage '${targetStage}'. Must be one of: ${VALID_PROCESSING_STAGES.join(", ")}` } }
  }

  const getRes = await getProcessingService(id)
  if (getRes.status >= 400 || !getRes.body) {
    return { status: 404, body: { error: `Processing service '${id}' not found.` } }
  }

  const existing = getRes.body
  const history = Array.isArray(existing.status_history || existing.statusHistory)
    ? [...(existing.status_history || existing.statusHistory)]
    : []
  history.push({ stage: targetStage, timestamp: new Date().toISOString() })

  let invoiceId = existing.invoice_id || existing.invoiceId
  let journalEntry = null

  // Rate locking parameters
  let lockedProcessingRate = existing.locked_processing_rate ?? existing.lockedProcessingRate ?? null
  let lockedProcessingFee = existing.locked_processing_fee ?? existing.lockedProcessingFee ?? null
  let lockedStorageFee = existing.locked_storage_fee ?? existing.lockedStorageFee ?? null
  let lockedTotalFee = existing.locked_total_fee ?? existing.lockedTotalFee ?? null
  let processedAt = existing.processed_at || existing.processedAt ? (existing.processed_at || existing.processedAt) : null
  let deliveredAt = existing.delivered_at || existing.deliveredAt ? (existing.delivered_at || existing.deliveredAt) : null
  let agreedPrice = Number(existing.agreed_price || existing.agreedPrice || 0)

  if (targetStage === "Processed") {
    if (!processedAt) processedAt = new Date().toISOString()
    if (extraData.processingRate !== undefined && extraData.processingRate !== null) {
      lockedProcessingRate = Number(extraData.processingRate)
    }
    if (extraData.processingFee !== undefined && extraData.processingFee !== null) {
      lockedProcessingFee = Number(extraData.processingFee)
    } else if (lockedProcessingRate !== null) {
      lockedProcessingFee = Number(existing.quantity || 0) * lockedProcessingRate
    }
  }

  if (targetStage === "Delivered") {
    if (!deliveredAt) deliveredAt = extraData.deliveryDate ? new Date(extraData.deliveryDate).toISOString() : new Date().toISOString()
    if (extraData.storageFee !== undefined && extraData.storageFee !== null) {
      lockedStorageFee = Number(extraData.storageFee)
    }
    if (extraData.totalFee !== undefined && extraData.totalFee !== null) {
      lockedTotalFee = Number(extraData.totalFee)
    } else {
      lockedTotalFee = (Number(lockedProcessingFee) || 0) + (Number(lockedStorageFee) || 0)
    }
    if (lockedTotalFee > 0) {
      agreedPrice = Number(lockedTotalFee)
    }
  }

  // AUTOMATED REVENUE RECOGNITION WHEN STAGE REACHES 'Delivered'
  if (targetStage === "Delivered" && !invoiceId) {
    invoiceId = `INV-PS-${id}`
    journalEntry = generateProcessingServiceRevenueJournalEntry({ ...existing, id, agreed_price: agreedPrice })

    // Save invoice via Drizzle CRUD
    try {
      const clientName = existing.client_company_name || existing.clientCompanyName || "Client Company"
      const refNum = existing.reference_number || existing.referenceNumber || id
      const invoicePayload = {
        id: invoiceId,
        invoice_number: invoiceId,
        customer_name: clientName,
        customer: clientName,
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        line_items: [
          {
            description: `Toll processing & storage fee for ${existing.goods_description || existing.goodsDescription} (${existing.quantity} ${existing.uom})`,
            quantity: Number(existing.quantity || 1),
            qty: Number(existing.quantity || 1),
            unit_price: Number(agreedPrice || 0) / Number(existing.quantity || 1),
            line_total: Number(agreedPrice || 0),
            total: Number(agreedPrice || 0),
          }
        ],
        subtotal: Number(agreedPrice || 0),
        tax_amount: 0,
        tax_rate: 0,
        discount_amount: 0,
        total: Number(agreedPrice || 0),
        total_amount: Number(agreedPrice || 0),
        amount_paid: 0,
        balance_due: Number(agreedPrice || 0),
        status: "Unpaid",
        settlement_status: "Unpaid",
        payment_terms: "Credit (Net 30)",
        currency: "ETB",
        sales_order_id: id,
        fs_no: refNum,
      }

      const invResource = getResource("invoices")
      await drizzleCreateRow({ resource: invResource, body: invoicePayload })
    } catch (err) {
      console.warn("Failed to persist service invoice via Drizzle:", err.message)
    }

    // Save journal entry & lines via Drizzle CRUD
    try {
      const jeResource = getResource("journal_entries")
      const jelResource = getResource("journal_entry_lines")

      await drizzleCreateRow({
        resource: jeResource,
        body: {
          id: journalEntry.id,
          entry_number: journalEntry.id,
          entry_date: journalEntry.date,
          description: journalEntry.description,
          source_type: journalEntry.sourceType,
          source_id: journalEntry.sourceId,
          created_by: journalEntry.createdBy,
          currency: "ETB",
          exchange_rate: 1.0,
          posting_status: "POSTED",
        },
      })

      for (let idx = 0; idx < journalEntry.lines.length; idx++) {
        const l = journalEntry.lines[idx]
        const lineId = `${journalEntry.id}-${idx + 1}`
        await drizzleCreateRow({
          resource: jelResource,
          body: {
            id: lineId,
            journal_entry_id: journalEntry.id,
            account_id: l.accountId === "1200" ? "ACC-1200" : l.accountId === "4002" ? "ACC-4002" : l.accountId,
            debit_amount: l.debitAmount,
            credit_amount: l.creditAmount,
            currency: "ETB",
            exchange_rate_at_time: 1.0,
            warehouse_id: "WH1",
            party_type: l.accountId === "1200" ? "Customer" : null,
            party_id: l.party_id || null,
            party_name: l.party_name || null,
          },
        })
      }
    } catch (err) {
      console.warn("Failed to persist service journal entry via Drizzle:", err.message)
    }
  }

  const patchBody = {
    status: targetStage,
    status_history: history,
    invoice_id: invoiceId,
    locked_processing_rate: lockedProcessingRate ? String(lockedProcessingRate) : null,
    locked_processing_fee: lockedProcessingFee ? String(lockedProcessingFee) : null,
    locked_storage_fee: lockedStorageFee ? String(lockedStorageFee) : null,
    locked_total_fee: lockedTotalFee ? String(lockedTotalFee) : null,
    processed_at: processedAt,
    delivered_at: deliveredAt,
    agreed_price: String(agreedPrice),
    updated_at: new Date().toISOString(),
  }

  try {
    const resource = getResource("processing_services")
    const updateRes = await drizzleUpdateRow({ resource, id, body: patchBody })

    return {
      status: 200,
      body: {
        ...(updateRes.body || existing),
        ok: true,
        journalEntry,
      },
    }
  } catch (err) {
    console.error(`[DRIZZLE PS TRANSITION ERROR] ${id}:`, err.message)
    return { status: 500, body: { error: "Failed to transition stage via Drizzle", message: err.message } }
  }
}

export async function deleteProcessingService(id) {
  try {
    const resource = getResource("processing_services")
    return await drizzleDeleteRow({ resource, id })
  } catch (err) {
    console.error(`[DRIZZLE PS DELETE ERROR] ${id}:`, err.message)
    return { status: 500, body: { error: "Failed to delete processing service", message: err.message } }
  }
}
