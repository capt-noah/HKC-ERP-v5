export const VALID_PROCESSING_STAGES = [
  "Received",
  "Processed",
  "Delivered",
]

export function validateProcessingServiceOrder(input) {
  const errors = []
  if (!input?.client_company_name && !input?.customer_name && !input?.customer_id) {
    errors.push("Client / Customer name is required.")
  }
  if (!input?.goods_description) {
    errors.push("Goods description is required.")
  }
  if (Number(input?.quantity || 0) <= 0) {
    errors.push("Quantity must be greater than zero.")
  }
  if (Number(input?.agreed_price || 0) < 0) {
    errors.push("Agreed price cannot be negative.")
  }
  return errors
}

export function generateProcessingServiceRevenueJournalEntry(order) {
  const amount = Number(order.agreed_price || order.agreedPrice || 0)
  const clientName = order.client_company_name || order.customer_name || order.clientName || "Client Company"
  const orderId = order.id || order.reference_number || "PS-0001"

  return {
    id: `JE-PS-${orderId.replace(/[^a-zA-Z0-9]/g, "")}`,
    journalNumber: `JV-PS-${Date.now().toString().slice(-4)}`,
    date: new Date().toISOString().split("T")[0],
    reference: `Processing Fee - ${orderId} (${clientName})`,
    sourceType: "Service Revenue",
    sourceId: orderId,
    description: `Service revenue recognized for toll processing of ${order.goods_description} (${order.quantity} ${order.uom})`,
    status: "POSTED",
    createdBy: "System Automator",
    lines: [
      {
        id: `LINE-1-${Date.now()}`,
        accountId: "1200",
        accountName: "Accounts Receivable",
        debitAmount: amount,
        creditAmount: 0,
        memo: `AR Receivable for processing fee - ${clientName}`,
        party_id: order.customer_id || null,
        party_name: clientName,
      },
      {
        id: `LINE-2-${Date.now()}`,
        accountId: "4002",
        accountName: "Service Processing Revenue",
        debitAmount: 0,
        creditAmount: amount,
        memo: `Service fee earned at WH1 for processing ${order.goods_description}`,
        party_id: order.customer_id || null,
        party_name: clientName,
      },
    ],
  }
}
