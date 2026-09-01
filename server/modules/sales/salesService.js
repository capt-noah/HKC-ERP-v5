import {
  cancelSalesIssue,
  createSalesIssue,
  deleteSalesIssue,
  getAvailableBatches,
  getSalesIssue,
  listSalesIssues,
  postSalesIssue,
} from "./salesIssues.js"
import {
  assignOfficer,
  deleteShipmentDoc,
  listAssignedOfficers,
  listShipmentDocRules,
  listShipmentDocs,
  saveShipmentDoc,
} from "./shipmentDocuments.js"
import {
  createProcessingService,
  deleteProcessingService,
  getProcessingService,
  listProcessingServices,
  transitionProcessingServiceStage,
  updateProcessingService,
} from "./processingServices.js"

export const salesService = {
  list: listSalesIssues,
  get: getSalesIssue,
  create: createSalesIssue,
  update: (body, id) => createSalesIssue(body, id),
  delete: deleteSalesIssue,
  post: postSalesIssue,
  cancel: cancelSalesIssue,
  getBatches: getAvailableBatches,
  listShipmentDocRules,
  listShipmentDocs,
  saveShipmentDoc,
  deleteShipmentDoc,
  listAssignedOfficers,
  assignOfficer,
  listProcessingServices,
  getProcessingService,
  createProcessingService,
  updateProcessingService,
  deleteProcessingService,
  transitionProcessingServiceStage,
}
