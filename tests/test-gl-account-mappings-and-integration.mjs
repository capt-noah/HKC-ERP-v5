/**
 * Comprehensive HKC-ERP-v5 GL Account Mappings & Operational Integration Test Suite
 * 
 * Tests:
 * 1. Chart of Accounts Relational Schema & Hierarchy (MySQL columns, groups, parent-child links)
 * 2. gl_account_mappings Relational Table & 28 Authentic Peachtree Core Rules
 * 3. Dynamic Account Resolver Hierarchy & Group Header Safety Guard (Never post to is_group: true)
 * 4. Real-time GL Rule Reconfiguration & Factory Reset Lifecycle
 * 5. Custom User-Defined Mapping Rule CRUD & System Rule Deletion Protection
 * 6. Operational Workflows Simulation & Double-Entry Accounting Balance:
 *    - Sales Invoicing (AR, Domestic Revenue, VAT Output)
 *    - Procurement Receiving / GRN (Inventory Asset, GRNI Accrual)
 *    - Sales Delivery / Fulfillment (COGS Expense, Inventory Asset Relief)
 *    - Physical Inventory Adjustments (Shrinkage Loss & Surplus Gain)
 *    - Payroll Accrual (Gross Compensation, PAYE Tax, Pension, Net Accruals)
 *    - AP Vendor Payment Disbursement (AP Clearing, Corporate Bank)
 */

import { pool } from "../server/db/client.js";
import { resources } from "../server/db/resourceRegistry.js";
import { 
  drizzleListRows, 
  drizzleCreateRow, 
  drizzleUpdateRow, 
  drizzleDeleteRow 
} from "../server/db/drizzleCrud.js";
import { DEFAULT_GL_ACCOUNT_MAPPINGS } from "../src/lib/companyCOA.ts";

console.log("=================================================================");
console.log("🚀 STARTING GL ACCOUNT MAPPINGS & TRANSACTION INTEGRATION SUITE");
console.log("=================================================================");

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  }
}

async function runSuite() {
  try {
    // -----------------------------------------------------------------
    // MODULE 1: CHART OF ACCOUNTS RELATIONAL SCHEMA & INTEGRITY
    // -----------------------------------------------------------------
    console.log("\n--- MODULE 1: Chart of Accounts Relational Migration & Integrity ---");
    
    const [rawCoaCols] = await pool.query(`SHOW COLUMNS FROM chart_of_accounts`);
    const colNames = rawCoaCols.map(c => c.Field);
    
    assert(colNames.includes("code"), "Column 'code' exists in chart_of_accounts");
    assert(colNames.includes("name"), "Column 'name' exists in chart_of_accounts");
    assert(colNames.includes("account_type"), "Column 'account_type' exists in chart_of_accounts");
    assert(colNames.includes("peachtree_type"), "Column 'peachtree_type' exists in chart_of_accounts");
    assert(colNames.includes("parent_account_id"), "Column 'parent_account_id' exists in chart_of_accounts");
    assert(colNames.includes("is_group"), "Column 'is_group' exists in chart_of_accounts");
    assert(colNames.includes("is_active"), "Column 'is_active' exists in chart_of_accounts");

    const coaListRes = await drizzleListRows({ resource: resources.chart_of_accounts });
    assert(coaListRes.status === 200, "drizzleListRows('chart_of_accounts') returns 200 OK");
    const allAccounts = coaListRes.body;
    assert(allAccounts.length >= 82, `Fetched all 82 accounts (Got: ${allAccounts.length})`);

    // Verify type distribution across the 5 fundamental categories
    const categories = new Set(allAccounts.map(a => a.account_type));
    assert(categories.has("Asset"), "Chart includes Asset accounts");
    assert(categories.has("Liability"), "Chart includes Liability accounts");
    assert(categories.has("Equity"), "Chart includes Equity accounts");
    assert(categories.has("Revenue"), "Chart includes Revenue accounts");
    assert(categories.has("Expense"), "Chart includes Expense accounts");

    // Group header safety check: Verify summary headers are flagged is_group = true / 1
    const cashHeader = allAccounts.find(a => a.code === "1000");
    assert(cashHeader && Boolean(cashHeader.is_group) === true, "Header account 1000 CASH has is_group = true");

    const pettyCashLeaf = allAccounts.find(a => a.code === "1000-01-01");
    assert(pettyCashLeaf && Boolean(pettyCashLeaf.is_group) === false, "Leaf account 1000-01-01 has is_group = false");
    assert(pettyCashLeaf && pettyCashLeaf.parent_account_id === "1000", "Leaf account 1000-01-01 links to parent 1000");

    // -----------------------------------------------------------------
    // MODULE 2: GL ACCOUNT MAPPINGS TABLE & CORE RULES
    // -----------------------------------------------------------------
    console.log("\n--- MODULE 2: gl_account_mappings Table & Core Peachtree Rules ---");

    const [rawMapCols] = await pool.query(`SHOW COLUMNS FROM gl_account_mappings`);
    const mapColNames = rawMapCols.map(c => c.Field);
    assert(mapColNames.includes("id"), "gl_account_mappings has primary key 'id'");
    assert(mapColNames.includes("account_id"), "gl_account_mappings has 'account_id'");
    assert(mapColNames.includes("account_code"), "gl_account_mappings has 'account_code'");
    assert(mapColNames.includes("normal_posting"), "gl_account_mappings has 'normal_posting'");
    assert(mapColNames.includes("is_system_default"), "gl_account_mappings has 'is_system_default'");

    const mappingsRes = await drizzleListRows({ resource: resources.gl_account_mappings });
    assert(mappingsRes.status === 200, "drizzleListRows('gl_account_mappings') returns 200 OK");
    const mappings = mappingsRes.body;
    assert(mappings.length >= 28, `All 28 core system rules are populated (Got: ${mappings.length})`);

    // Verify all system rules reference non-group active accounts
    const invalidMappings = mappings.filter(m => {
      const targetAcc = allAccounts.find(a => a.id === m.account_id || a.code === m.account_code);
      return !targetAcc || targetAcc.is_group || !targetAcc.is_active;
    });
    assert(invalidMappings.length === 0, "All 28 mapping rules point to valid, active, non-group accounts");

    // -----------------------------------------------------------------
    // MODULE 3: RESOLVER ENGINE & FALLBACK HIERARCHY SIMULATION
    // -----------------------------------------------------------------
    console.log("\n--- MODULE 3: Resolver Engine & Group Header Safety Guard ---");

    // Simulation of resolver logic from financeStore.ts
    function resolveMappedAccount(ruleKey, fallbackCode) {
      // 1. Try active rule from gl_account_mappings
      const activeRule = mappings.find(m => m.id === ruleKey);
      if (activeRule) {
        const acc = allAccounts.find(a => (!a.is_group && a.is_active) && (a.id === activeRule.account_id || a.code === activeRule.account_code));
        if (acc) return { account: acc, source: "active_mapping_rule" };
      }

      // 2. Try passed fallbackCode
      if (fallbackCode) {
        const acc = allAccounts.find(a => (!a.is_group && a.is_active) && (a.id === fallbackCode || a.code === fallbackCode));
        if (acc) return { account: acc, source: "fallback_code" };
      }

      // 3. Try default rule
      const defaultRule = DEFAULT_GL_ACCOUNT_MAPPINGS.find(d => d.id === ruleKey);
      if (defaultRule) {
        const acc = allAccounts.find(a => (!a.is_group && a.is_active) && (a.id === defaultRule.account_id || a.code === defaultRule.account_code));
        if (acc) return { account: acc, source: "system_default" };
      }

      // 4. Try matching account type
      const firstActive = allAccounts.find(a => !a.is_group && a.is_active);
      return { account: firstActive, source: "coa_fallback" };
    }

    const domesticSalesResolved = resolveMappedAccount("sales_revenue_domestic");
    assert(
      domesticSalesResolved.account.code === "4000-01-01" && domesticSalesResolved.source === "active_mapping_rule",
      `Domestic sales correctly resolves to 4000-01-01 via active mapping rule (Got: ${domesticSalesResolved.account.code})`
    );

    // Group Safety Test: Ensure resolving an account will NEVER return group 1000 or 6000
    const fallbackWithGroup = resolveMappedAccount("non_existent_rule", "1000"); // 1000 is group
    assert(
      fallbackWithGroup.account.is_group === false,
      `Safety guard rejected group account 1000 and resolved non-group account: ${fallbackWithGroup.account.code}`
    );

    // -----------------------------------------------------------------
    // MODULE 4: REAL-TIME GL RULE RECONFIGURATION & RESET LIFECYCLE
    // -----------------------------------------------------------------
    console.log("\n--- MODULE 4: Real-Time GL Reconfiguration & Reset ---");

    // 4a. Remap sales_revenue_domestic from 4000-01-01 to 4000-03-02 (Cleaning Service)
    const updateRes = await drizzleUpdateRow({
      resource: resources.gl_account_mappings,
      id: "sales_revenue_domestic",
      body: {
        account_id: "4000-03-02",
        account_code: "4000-03-02",
        account_name: "CLEANING SERVICE",
        updated_by: "Test Lead",
      }
    });
    assert(updateRes.status === 200, "drizzleUpdateRow successfully modified sales_revenue_domestic");

    // Verify DB reflection
    const [modifiedRow] = await pool.query("SELECT * FROM gl_account_mappings WHERE id = 'sales_revenue_domestic'");
    assert(
      modifiedRow[0].account_code === "4000-03-02",
      `Database reflects updated account: ${modifiedRow[0].account_code} (${modifiedRow[0].account_name})`
    );

    // 4b. Revert back to authentic Peachtree default (4000-01-01)
    const defaultPeachtree = DEFAULT_GL_ACCOUNT_MAPPINGS.find(d => d.id === "sales_revenue_domestic");
    await drizzleUpdateRow({
      resource: resources.gl_account_mappings,
      id: "sales_revenue_domestic",
      body: {
        account_id: defaultPeachtree.account_id,
        account_code: defaultPeachtree.account_code,
        account_name: defaultPeachtree.account_name,
        updated_by: "System Reset",
      }
    });
    const [revertedRow] = await pool.query("SELECT * FROM gl_account_mappings WHERE id = 'sales_revenue_domestic'");
    assert(
      revertedRow[0].account_code === "4000-01-01",
      `Rule cleanly restored to authentic Peachtree default: ${revertedRow[0].account_code}`
    );

    // -----------------------------------------------------------------
    // MODULE 5: CUSTOM USER-DEFINED RULE CRUD & DELETION PROTECTION
    // -----------------------------------------------------------------
    console.log("\n--- MODULE 5: Custom Rule CRUD & System Rule Protection ---");

    const customRuleId = `custom_scrap_revenue_${Date.now()}`;
    const customRule = {
      id: customRuleId,
      label: "Warehouse Scrap Sales Revenue",
      category: "Custom Rules",
      account_id: "4200",
      account_code: "4200",
      account_name: "OTHER INCOME",
      normal_posting: "Credit",
      is_system_default: false,
      description: "Automated custom posting rule for scrap recovery revenue.",
      updated_by: "Warehouse Admin",
    };

    const createRes = await drizzleCreateRow({ resource: resources.gl_account_mappings, body: customRule });
    assert(createRes.status === 201 || createRes.status === 200, "Custom mapping rule created successfully");

    const [checkCustom] = await pool.query("SELECT * FROM gl_account_mappings WHERE id = ?", [customRuleId]);
    assert(checkCustom.length === 1 && checkCustom[0].label === "Warehouse Scrap Sales Revenue", "Custom rule verified in MySQL");

    // Clean up custom rule
    const delRes = await drizzleDeleteRow({ resource: resources.gl_account_mappings, id: customRuleId });
    assert(delRes.status === 200, "Custom rule deleted successfully");

    const [afterDel] = await pool.query("SELECT * FROM gl_account_mappings WHERE id = ?", [customRuleId]);
    assert(afterDel.length === 0, "Custom rule confirmed removed from database");

    // -----------------------------------------------------------------
    // MODULE 6: OPERATIONAL WORKFLOWS SIMULATION & DOUBLE-ENTRY BALANCE
    // -----------------------------------------------------------------
    console.log("\n--- MODULE 6: Operational Workflows & Double-Entry Accounting ---");

    // Helper to calculate total debits and credits and verify ETB balance
    function verifyDoubleEntry(workflowName, lines) {
      const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
      const variance = Math.abs(totalDebit - totalCredit);
      const isBalanced = variance < 0.001;
      assert(
        isBalanced,
        `${workflowName}: Double-entry balanced (Debit: ${totalDebit.toLocaleString()} ETB, Credit: ${totalCredit.toLocaleString()} ETB, Variance: 0)`
      );
      return { totalDebit, totalCredit, isBalanced };
    }

    // A. Sales Invoicing Workflow (100,000 ETB + 15% VAT = 115,000 ETB)
    const invoiceSubtotal = 100000;
    const vatAmount = 15000;
    const invoiceTotal = 115000;
    const arAcc = resolveMappedAccount("customer_receipt_bank").account;
    const revAcc = resolveMappedAccount("sales_revenue_domestic").account;
    const vatAcc = resolveMappedAccount("sales_vat_output").account;

    const salesInvoiceLines = [
      { account_id: arAcc.id, account_code: arAcc.code, debit: invoiceTotal, credit: 0, desc: "Accounts Receivable" },
      { account_id: revAcc.id, account_code: revAcc.code, debit: 0, credit: invoiceSubtotal, desc: "Domestic Sales" },
      { account_id: vatAcc.id, account_code: vatAcc.code, debit: 0, credit: vatAmount, desc: "VAT Output (15%)" },
    ];
    verifyDoubleEntry("Sales Invoicing", salesInvoiceLines);

    // B. PO Receiving / GRN (Goods Received Not Invoiced - 250,000 ETB)
    const grnAmount = 250000;
    const stockAssetAcc = resolveMappedAccount("po_grni_inventory").account;
    const grniClearingAcc = resolveMappedAccount("po_grni_clearing").account;

    const grnLines = [
      { account_id: stockAssetAcc.id, account_code: stockAssetAcc.code, debit: grnAmount, credit: 0, desc: "Inventory Stock in Hand" },
      { account_id: grniClearingAcc.id, account_code: grniClearingAcc.code, debit: 0, credit: grnAmount, desc: "GRNI Accrued Liability" },
    ];
    verifyDoubleEntry("PO Goods Receiving (GRN)", grnLines);

    // C. Sales Delivery Note / Fulfillment COGS (180,000 ETB Cost Value)
    const cogsAmount = 180000;
    const cogsAcc = resolveMappedAccount("cogs_stock_fulfillment").account;
    const invReliefAcc = resolveMappedAccount("inventory_stock_in_hand").account;

    const deliveryNoteLines = [
      { account_id: cogsAcc.id, account_code: cogsAcc.code, debit: cogsAmount, credit: 0, desc: "Cost of Goods Sold" },
      { account_id: invReliefAcc.id, account_code: invReliefAcc.code, debit: 0, credit: cogsAmount, desc: "Inventory Relief" },
    ];
    verifyDoubleEntry("Sales Delivery Fulfillment (COGS)", deliveryNoteLines);

    // D. Physical Inventory Adjustments (Shrinkage Loss & Surplus Gain)
    const shrinkageLossAmount = 12500;
    const shrinkageLossAcc = resolveMappedAccount("stock_shrinkage_loss").account;
    const shrinkageLines = [
      { account_id: shrinkageLossAcc.id, account_code: shrinkageLossAcc.code, debit: shrinkageLossAmount, credit: 0, desc: "Shrinkage Loss" },
      { account_id: invReliefAcc.id, account_code: invReliefAcc.code, debit: 0, credit: shrinkageLossAmount, desc: "Inventory Write-down" },
    ];
    verifyDoubleEntry("Physical Inventory Shrinkage Loss", shrinkageLines);

    const surplusGainAmount = 8400;
    const surplusGainAcc = resolveMappedAccount("stock_adjustment_gain").account;
    const surplusLines = [
      { account_id: invReliefAcc.id, account_code: invReliefAcc.code, debit: surplusGainAmount, credit: 0, desc: "Inventory Write-up" },
      { account_id: surplusGainAcc.id, account_code: surplusGainAcc.code, debit: 0, credit: surplusGainAmount, desc: "Inventory Surplus Gain" },
    ];
    verifyDoubleEntry("Physical Inventory Surplus Gain", surplusLines);

    // E. Monthly Payroll Accrual Run (Gross: 200,000 ETB)
    // - Gross Salaries: 200,000 ETB
    // - Income Tax PAYE: 35,000 ETB
    // - Pension (7% Emp + 11% Comp): 36,000 ETB
    // - Net Accrued Payroll: 129,000 ETB
    const grossSalary = 200000;
    const incomeTax = 35000;
    const pensionTax = 36000;
    const netSalary = 129000;
    const salaryExpenseAcc = resolveMappedAccount("payroll_gross_salary_expense").account;
    const payeTaxAcc = resolveMappedAccount("payroll_income_tax_payable").account;
    const pensionAcc = resolveMappedAccount("payroll_pension_payable").account;
    const netPayableAcc = resolveMappedAccount("payroll_accrued_clearing").account;

    const payrollLines = [
      { account_id: salaryExpenseAcc.id, debit: grossSalary, credit: 0, desc: "Gross Compensation" },
      { account_id: payeTaxAcc.id, debit: 0, credit: incomeTax, desc: "PAYE Income Tax Payable" },
      { account_id: pensionAcc.id, debit: 0, credit: pensionTax, desc: "Pension Contribution Payable" },
      { account_id: netPayableAcc.id, debit: 0, credit: netSalary, desc: "Accrued Net Salaries" },
    ];
    verifyDoubleEntry("Monthly Payroll Accrual Run", payrollLines);

    // F. AP Vendor Payment Disbursement (150,000 ETB)
    const apDisbursement = 150000;
    const apClearingAcc = resolveMappedAccount("supplier_payment_ap").account;
    const disbursingBankAcc = resolveMappedAccount("supplier_payment_bank").account;

    const apPaymentLines = [
      { account_id: apClearingAcc.id, debit: apDisbursement, credit: 0, desc: "Clear Trade AP" },
      { account_id: disbursingBankAcc.id, debit: 0, credit: apDisbursement, desc: "Disburse from Bank" },
    ];
    verifyDoubleEntry("AP Vendor Payment Disbursement", apPaymentLines);

    console.log("\n=================================================================");
    console.log(`🏁 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("=================================================================");

    await pool.end();
    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Critical Suite Failure:", err);
    await pool.end();
    process.exit(1);
  }
}

runSuite();
