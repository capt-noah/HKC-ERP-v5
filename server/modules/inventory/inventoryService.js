import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./inventoryProductLogic.js"

import {
  listBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  transitionBatchStatus,
} from "./inventoryBatchLogic.js"

import {
  listMovements,
  getMovement,
  recordMovement,
  updateMovement,
  deleteMovement,
} from "./inventoryMovementLogic.js"

import {
  listTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  deleteTransfer,
} from "./inventoryTransferLogic.js"

import {
  listQuarantineRecords,
  getQuarantineRecord,
  createQuarantineRecord,
  updateQuarantineRecord,
  deleteQuarantineRecord,
} from "./quarantineLogic.js"

export const inventoryService = {
  // Product Operations
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,

  // Batch Operations
  listBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  transitionBatchStatus,

  // Movement Operations
  listMovements,
  getMovement,
  recordMovement,
  updateMovement,
  deleteMovement,

  // Transfer Operations
  listTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  deleteTransfer,

  // Quarantine Operations
  listQuarantineRecords,
  getQuarantineRecord,
  createQuarantineRecord,
  updateQuarantineRecord,
  deleteQuarantineRecord,
}

export default inventoryService
