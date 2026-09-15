import { inventoryService } from "../modules/inventory/inventoryService.js"
import { pool } from "../db/client.js"

async function runWh1EndToEndTests() {
  console.log("================================================================")
  console.log("   HKC-ERP v5: WH1 AGRICULTURAL EXPORT END-TO-END VERIFICATION  ")
  console.log("================================================================")

  let passed = 0
  let failed = 0

  function assert(cond, name, details = "") {
    if (cond) {
      console.log(`✅ [PASS] ${name}`)
      passed++
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ""}`)
      failed++
    }
  }

  const testProdId = `EXP-TEST-${Date.now()}`
  const conn = await pool.getConnection()

  try {
    // 1. Create Export Product with initial arrival entry (100 Quintals @ 2,000 ETB)
    console.log("\n--- TEST SUITE 1: Export Product Creation & Initial WH1 Entry ---")
    const createRes = await inventoryService.createProduct({
      id: testProdId,
      name: "Organic Red Sesame Grade A",
      description: "Organic Red Sesame Grade A",
      category: "Oilseeds",
      warehouse_id: "WH1",
      warehouse_type: "EXPORT_WH",
      quantity: 100,
      unit: "Quintal",
      unit_cost: 2000,
      selling_price: 2500,
      voucher_no: "GRV-1001",
      plate_number: "AA-3-98231",
      party_name: "Amhara Farmers Union",
    })

    assert(createRes.status === 201, "Product created successfully with status 201")
    assert(createRes.body.isExport === true, "Product is flagged as isExport === true")
    assert(createRes.body.wh1Entries?.length === 1, "Product has exactly 1 initial wh1Entry", `Length: ${createRes.body.wh1Entries?.length}`)
    
    const entry1 = createRes.body.wh1Entries[0]
    assert(entry1.quantityReceived === 100, "Entry 1 quantityReceived is 100")
    assert(entry1.unitPrice === 2000, "Entry 1 unitPrice is 2000 ETB")
    assert(entry1.entryId !== undefined, "Entry 1 has entryId populated")

    // 2. Add second sub-entry with a DIFFERENT unit acquisition price (50 Quintals @ 2,600 ETB)
    console.log("\n--- TEST SUITE 2: Multi-Price Sub-Entry Addition ---")
    const entry2Id = `EWM-SUB-${Date.now()}`
    const entry2Res = await inventoryService.recordMovement({
      id: entry2Id,
      warehouse_id: "WH1",
      product_id: testProdId,
      movement_type: "GRV_ENTRY",
      voucher_no: "GRV-1002",
      batch_no: "GRV-1002",
      party_name: "Tigray Agricultural Hub",
      plate_number: "TG-2-11442",
      gross_quantity: 50,
      reject_quantity: 0,
      net_quantity: 50,
      uom: "Quintal",
      unit_price: 2600,
      movement_date: "2026-09-15",
      reason: "Second Truckload Delivery",
    }, "export_warehouse_movements")

    assert(entry2Res.status === 201, "Second sub-entry recorded in export_warehouse_movements with status 201")

    // Update parent product quantity & weighted stock value (100 * 2000 + 50 * 2600 = 200,000 + 130,000 = 330,000 ETB / 150 = 2200 ETB/Quintal)
    const updateParentRes = await inventoryService.updateProduct(testProdId, {
      quantity: 150,
      unit_cost: 2200,
      total_stock_value: 330000,
    })

    assert(updateParentRes.status === 200, "Parent product updated with weighted unit cost and total stock value")

    // 3. ZERO HOMOGENIZATION VERIFICATION: Verify both sub-entries preserved their independent unit prices
    console.log("\n--- TEST SUITE 3: Zero Homogenization Verification ---")
    const getRes = await inventoryService.getProduct(testProdId)
    assert(getRes.status === 200, "Fetched updated product")
    assert(getRes.body.wh1Entries?.length === 2, "Product has exactly 2 sub-entries")

    const retrieved1 = getRes.body.wh1Entries.find((e) => e.voucherNo === "GRV-1001")
    const retrieved2 = getRes.body.wh1Entries.find((e) => e.voucherNo === "GRV-1002")

    assert(retrieved1?.unitPrice === 2000, "Sub-entry 1 preserved unitPrice of 2000 ETB (NOT overwritten to 2200)", `Actual: ${retrieved1?.unitPrice}`)
    assert(retrieved2?.unitPrice === 2600, "Sub-entry 2 preserved unitPrice of 2600 ETB (NOT overwritten to 2200)", `Actual: ${retrieved2?.unitPrice}`)

    // 4. Update individual sub-entry (update entry 1 unit price from 2000 -> 2100 ETB)
    console.log("\n--- TEST SUITE 4: Independent Sub-Entry Update ---")
    const updateEntry1Res = await inventoryService.updateMovement(entry1.id, {
      unit_price: 2100,
      plate_number: "AA-3-98231-MOD",
    }, "export_warehouse_movements")

    assert(updateEntry1Res.status === 200, "Updated sub-entry 1 movement successfully")

    const recheckRes = await inventoryService.getProduct(testProdId)
    const recheck1 = recheckRes.body.wh1Entries.find((e) => e.voucherNo === "GRV-1001")
    const recheck2 = recheckRes.body.wh1Entries.find((e) => e.voucherNo === "GRV-1002")

    assert(recheck1?.unitPrice === 2100, "Sub-entry 1 unitPrice updated to 2100 ETB", `Actual: ${recheck1?.unitPrice}`)
    assert(recheck1?.plateNumber === "AA-3-98231-MOD", "Sub-entry 1 plate updated")
    assert(recheck2?.unitPrice === 2600, "Sub-entry 2 unitPrice remained completely intact at 2600 ETB", `Actual: ${recheck2?.unitPrice}`)

    // 5. Outbound dispatch (Leave) at commercial selling price (e.g. 40 Quintals sold @ 3,500 ETB)
    console.log("\n--- TEST SUITE 5: Outbound Dispatch at Selling Price ---")
    const dispatchId = `EWM-DISP-${Date.now()}`
    const dispatchRes = await inventoryService.recordMovement({
      id: dispatchId,
      warehouse_id: "WH1",
      product_id: testProdId,
      movement_type: "OUTBOUND_DISPATCH",
      voucher_no: "FS-9901",
      batch_no: "COMMODITY-WH1",
      party_name: "Overseas Buyer Corp",
      gross_quantity: 40,
      reject_quantity: 0,
      net_quantity: -40,
      uom: "Quintal",
      unit_price: 2100, // COGS deduction
      selling_price: 3500, // Invoiced commercial value
      movement_date: "2026-09-15",
      reason: "Export Dispatch Shipment",
    }, "export_warehouse_movements")

    assert(dispatchRes.status === 201, "Outbound dispatch movement recorded")

    // Update remaining net quantity in MySQL on entry 1 (100 - 40 = 60 remaining)
    await inventoryService.updateMovement(entry1.id, {
      net_quantity: 60,
    }, "export_warehouse_movements")

    // 6. Reject / Cleaning Loss Deduction (e.g. 5 Quintals cleaning loss from Entry 1)
    console.log("\n--- TEST SUITE 6: Reject / Cleaning Loss Deduction ---")
    const rejectId = `EWM-REJ-${Date.now()}`
    const rejectRes = await inventoryService.recordMovement({
      id: rejectId,
      warehouse_id: "WH1",
      product_id: testProdId,
      movement_type: "REJECT_DEDUCTION",
      voucher_no: "REJ-881",
      batch_no: entry1.id,
      party_name: "WH1 Quality Control Cleaning Line",
      gross_quantity: 0,
      reject_quantity: 5,
      net_quantity: 5, // recordMovement decrements export_products quantity by net_quantity
      uom: "Quintal",
      unit_price: 2100,
      movement_date: "2026-09-15",
      reason: "Foreign Matter Rejection",
    }, "export_warehouse_movements")

    assert(rejectRes.status === 201, "Reject deduction recorded")

    // Deduct entry 1 remaining quantity (60 - 5 = 55 remaining, reject: 5)
    await inventoryService.updateMovement(entry1.id, {
      net_quantity: 55,
      reject_quantity: 5,
    }, "export_warehouse_movements")

    // 7. Verify binCardEntries vs wh1Entries separation & Reload Fidelity
    console.log("\n--- TEST SUITE 7: Ledger Hydration & Reload Fidelity ---")
    const finalGetRes = await inventoryService.getProduct(testProdId)
    const finalProd = finalGetRes.body

    assert(finalProd.wh1Entries?.length === 2, "wh1Entries has exactly 2 receipt entries (No ghost rejects or leaves in wh1Entries)")
    assert(finalProd.binCardEntries?.length === 4, "binCardEntries has all 4 movements (2 arrivals, 1 dispatch, 1 reject)")

    const finalEntry1 = finalProd.wh1Entries.find((e) => e.voucherNo === "GRV-1001")
    assert(finalEntry1?.quantityReceived === 100, "Entry 1 gross received is 100")
    assert(finalEntry1?.quantityRemaining === 55, "Entry 1 net remaining is 55", `Actual: ${finalEntry1?.quantityRemaining}`)
    assert(finalEntry1?.rejectQuantity === 5, "Entry 1 reject quantity is 5", `Actual: ${finalEntry1?.rejectQuantity}`)
    assert(finalEntry1?.unitPrice === 2100, "Entry 1 unitPrice is 2100 ETB")

    const finalEntry2 = finalProd.wh1Entries.find((e) => e.voucherNo === "GRV-1002")
    assert(finalEntry2?.quantityReceived === 50, "Entry 2 gross received is 50")
    assert(finalEntry2?.quantityRemaining === 50, "Entry 2 net remaining is 50")
    assert(finalEntry2?.unitPrice === 2600, "Entry 2 unitPrice is 2600 ETB")

    // 8. Sub-entry Deletion Verification
    console.log("\n--- TEST SUITE 8: Sub-Entry Deletion ---")
    const delRes = await inventoryService.deleteMovement(entry2Id, "export_warehouse_movements")
    assert(delRes.status === 200, "Deleted sub-entry 2 from export_warehouse_movements")

    const postDelRes = await inventoryService.getProduct(testProdId)
    assert(postDelRes.body.wh1Entries?.length === 1, "wh1Entries has exactly 1 entry remaining after delete")
    assert(postDelRes.body.wh1Entries[0].voucherNo === "GRV-1001", "Remaining entry is GRV-1001")

    // 9. Clean up test product
    await inventoryService.deleteProduct(testProdId)
    console.log("\n--- Cleaned up test records cleanly ---")

  } finally {
    conn.release()
  }

  console.log("\n================================================================")
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
  console.log("================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runWh1EndToEndTests().catch((err) => {
  console.error("FATAL in WH1 test suite:", err)
  process.exit(1)
})
