import { Router } from "express"
import { salesService } from "../modules/sales/salesService.js"

export const salesRouter = Router()

salesRouter.get(["/processing-services", "/processing_services"], async (req, res, next) => {
  try {
    const result = await salesService.listProcessingServices(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/processing-services", "/processing_services"], async (req, res, next) => {
  try {
    const result = await salesService.createProcessingService(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.get(["/processing-services/:id", "/processing_services/:id"], async (req, res, next) => {
  try {
    const result = await salesService.getProcessingService(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.patch(["/processing-services/:id", "/processing_services/:id"], async (req, res, next) => {
  try {
    const result = await salesService.updateProcessingService(req.body, req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/processing-services/:id/transition", "/processing_services/:id/transition"], async (req, res, next) => {
  try {
    const result = await salesService.transitionProcessingServiceStage(req.params.id, req.body.stage, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.delete(["/processing-services/:id", "/processing_services/:id"], async (req, res, next) => {
  try {
    const result = await salesService.deleteProcessingService(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/processing-services/:id/upload-contract", "/processing_services/:id/upload-contract"], async (req, res, next) => {
  try {
    // Accepts { contract_url, contract_file_name } in body (base64 data URL from client)
    const { contract_url, contract_file_name } = req.body
    if (!contract_url || !contract_file_name) {
      return res.status(400).json({ error: "contract_url and contract_file_name are required." })
    }
    const result = await salesService.updateProcessingService(
      { contract_url, contract_file_name },
      req.params.id
    )
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.get(["/shipment-documents/officers", "/shipment_documents/officers"], async (req, res, next) => {
  try {
    const result = await salesService.listAssignedOfficers()
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/shipment-documents/assign", "/shipment_documents/assign"], async (req, res, next) => {
  try {
    const result = await salesService.assignOfficer(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.get(["/shipment-documents/rules", "/shipment_documents/rules"], async (req, res, next) => {
  try {
    const result = await salesService.listShipmentDocRules(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.get(["/shipment-documents", "/shipment_documents"], async (req, res, next) => {
  try {
    const result = await salesService.listShipmentDocs(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/shipment-documents", "/shipment_documents"], async (req, res, next) => {
  try {
    const result = await salesService.saveShipmentDoc(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.delete(["/shipment-documents/:id", "/shipment_documents/:id"], async (req, res, next) => {
  try {
    const result = await salesService.deleteShipmentDoc(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.get(["/sales-issues/batches", "/sales_issues/batches"], async (req, res, next) => {
  try {
    const result = await salesService.getBatches(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.get(["/sales-issues", "/sales_issues"], async (req, res, next) => {
  try {
    const result = await salesService.list(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/sales-issues", "/sales_issues"], async (req, res, next) => {
  try {
    const result = await salesService.create(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.get(["/sales-issues/:id", "/sales_issues/:id"], async (req, res, next) => {
  try {
    const result = await salesService.get(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.patch(["/sales-issues/:id", "/sales_issues/:id"], async (req, res, next) => {
  try {
    const result = await salesService.update(req.body, req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.put(["/sales-issues/:id", "/sales_issues/:id"], async (req, res, next) => {
  try {
    const result = await salesService.update(req.body, req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.delete(["/sales-issues/:id", "/sales_issues/:id"], async (req, res, next) => {
  try {
    const result = await salesService.delete(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/sales-issues/:id/post", "/sales_issues/:id/post"], async (req, res, next) => {
  try {
    const result = await salesService.post(req.body, req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

salesRouter.post(["/sales-issues/:id/cancel", "/sales_issues/:id/cancel"], async (req, res, next) => {
  try {
    const result = await salesService.cancel(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})
