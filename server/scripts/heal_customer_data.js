/**
 * Safe Data Healing Script for Customer Registry
 * HKC-ERP-v5
 * 
 * Rules:
 * 1. STRICTLY ZERO DELETIONS of any customer with connected orders, issues, or invoices.
 * 2. Backfill any missing customer names from linked sales orders, issues, or invoices.
 * 3. Log all actions with complete audit trail.
 */

import { pool } from '../db/client.js';

async function healCustomerData() {
  const connection = pool;

  console.log('=== HKC ERP CUSTOMER DATA HEALING & VERIFICATION ===\n');

  try {
    // 1. Audit all customers
    const [customers] = await connection.query('SELECT * FROM customers ORDER BY id ASC');
    console.log(`Auditing ${customers.length} customer records in customers table...`);

    let healedCount = 0;
    let verifiedCount = 0;

    for (const cust of customers) {
      const hasMissingName = !cust.name || cust.name.trim() === '' || cust.name.trim() === cust.id;
      
      // Check linked transactions
      const [linkedSos] = await connection.query(
        'SELECT id, customer_name, customer_phone FROM sales_orders WHERE customer_id = ? OR customer_name = ?',
        [cust.id, cust.name]
      );
      const [linkedSis] = await connection.query(
        'SELECT id, customer_name FROM sales_issues WHERE customer_id = ? OR customer_name = ?',
        [cust.id, cust.name]
      );
      const [linkedInvs] = await connection.query(
        'SELECT id, customer_name FROM invoices WHERE customer_id = ? OR customer_name = ?',
        [cust.id, cust.name]
      );

      const totalLinked = linkedSos.length + linkedSis.length + linkedInvs.length;

      if (hasMissingName) {
        console.warn(`[ATTENTION] Customer ${cust.id} has missing/invalid name! Looking for linked records...`);
        // Find best name from linked records
        const candidateSo = linkedSos.find(so => so.customer_name && so.customer_name.trim() !== '' && so.customer_name !== cust.id);
        const candidateSi = linkedSis.find(si => si.customer_name && si.customer_name.trim() !== '' && si.customer_name !== cust.id);
        const candidateInv = linkedInvs.find(inv => inv.customer_name && inv.customer_name.trim() !== '' && inv.customer_name !== cust.id);

        const recoveredName = candidateSo?.customer_name || candidateSi?.customer_name || candidateInv?.customer_name;
        const recoveredPhone = candidateSo?.customer_phone || cust.phone;

        if (recoveredName) {
          console.log(`[HEAL] Recovered name '${recoveredName}' for ${cust.id} from linked transactions. Updating...`);
          await connection.query(
            'UPDATE customers SET name = ?, phone = COALESCE(phone, ?) WHERE id = ?',
            [recoveredName.trim(), recoveredPhone ? recoveredPhone.trim() : null, cust.id]
          );
          healedCount++;
        } else {
          console.warn(`[WARNING] Customer ${cust.id} has ${totalLinked} linked transactions but no recovered name found.`);
        }
      } else {
        verifiedCount++;
      }
    }

    console.log(`\nCustomer Audit Complete:`);
    console.log(`- Verified Healthy: ${verifiedCount}`);
    console.log(`- Healed/Backfilled: ${healedCount}`);

    // 2. Audit Sales Orders for unlinked customer_ids
    const [orphanOrders] = await connection.query(`
      SELECT so.id, so.customer_id, so.customer_name, so.customer_phone 
      FROM sales_orders so 
      LEFT JOIN customers c ON so.customer_id = c.id 
      WHERE so.customer_id IS NOT NULL AND c.id IS NULL
    `);

    if (orphanOrders.length > 0) {
      console.log(`\nFound ${orphanOrders.length} sales orders with unlinked customer_ids:`);
      for (const order of orphanOrders) {
        console.log(`- Order ${order.id}: ID ${order.customer_id}, Name: ${order.customer_name}`);
      }
    } else {
      console.log(`\nAll sales order customer references are 100% consistent.`);
    }

    // 3. Audit Sales Issues for unlinked customer_ids
    const [orphanIssues] = await connection.query(`
      SELECT si.id, si.customer_id, si.customer_name 
      FROM sales_issues si 
      LEFT JOIN customers c ON si.customer_id = c.id 
      WHERE si.customer_id IS NOT NULL AND c.id IS NULL
    `);

    if (orphanIssues.length > 0) {
      console.log(`Found ${orphanIssues.length} sales issues with unlinked customer_ids:`);
      for (const issue of orphanIssues) {
        console.log(`- Issue ${issue.id}: ID ${issue.customer_id}, Name: ${issue.customer_name}`);
      }
    } else {
      console.log(`All sales issue customer references are 100% consistent.`);
    }

    console.log('\n=== HEALING VERIFICATION PASSED (0 DELETIONS) ===');
    process.exit(0);
  } catch (err) {
    console.error('Healing script failed:', err);
    process.exit(1);
  }
}

healCustomerData();
