export interface SalesOrderPipelineInput {
  orderId: string
  customerId: string
  items: { productId: string; name: string; qty: number; unitPrice: number; total: number }[]
}

export interface PipelineStageResult {
  nextStage: "Quote" | "Ordered" | "Shipped" | "Delivered" | "Invoiced"
  totalAmount: number
  itemCount: number
}

/**
 * Evaluates Sales Order progression through contract stages.
 */
export function processSalesOrderPipeline(input: SalesOrderPipelineInput, currentStage: string): PipelineStageResult {
  const totalAmount = input.items.reduce((sum, item) => sum + (item.total || item.qty * item.unitPrice), 0)
  const itemCount = input.items.reduce((sum, item) => sum + item.qty, 0)

  let nextStage: PipelineStageResult["nextStage"] = "Quote"

  if (currentStage === "Quote") {
    nextStage = "Ordered"
  } else if (currentStage === "Ordered") {
    nextStage = "Shipped"
  } else if (currentStage === "Shipped") {
    nextStage = "Delivered"
  } else if (currentStage === "Delivered") {
    nextStage = "Invoiced"
  }

  return {
    nextStage,
    totalAmount: Math.round(totalAmount * 100) / 100,
    itemCount,
  }
}
