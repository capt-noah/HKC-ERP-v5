import { pool } from "../db/client.js";
import { resources } from "../db/resourceRegistry.js";
import { drizzleListRows, drizzleCreateRow, drizzleUpdateRow, drizzleDeleteRow } from "../db/drizzleCrud.js";

async function runTests() {
  console.log("=== STEP 1: TEST CHART OF ACCOUNTS RELATIONAL COLUMNS ===");
  const coaRes = await drizzleListRows({ resource: resources.chart_of_accounts });
  if (coaRes.status !== 200) {
    throw new Error(`Failed to list chart_of_accounts: ${JSON.stringify(coaRes.body)}`);
  }
  const coaRows = coaRes.body;
  console.log(`✓ Fetched ${coaRows.length} accounts from chart_of_accounts.`);

  if (coaRows.length < 80) {
    throw new Error(`Expected at least 80 accounts, got ${coaRows.length}`);
  }

  // Check sample account fields
  const cashAccount = coaRows.find((a) => a.code === "1000-01-01");
  if (!cashAccount) throw new Error("Missing petty cash account 1000-01-01");
  console.log(`✓ Account 1000-01-01 verified:`, {
    id: cashAccount.id,
    code: cashAccount.code,
    name: cashAccount.name,
    account_type: cashAccount.account_type,
    peachtree_type: cashAccount.peachtree_type,
    is_group: cashAccount.is_group,
    is_active: cashAccount.is_active,
  });

  const groupAccount = coaRows.find((a) => a.code === "1000");
  if (!groupAccount || !groupAccount.is_group) {
    throw new Error("Account 1000 should have is_group = 1 / true");
  }
  console.log(`✓ Group header account 1000 verified with is_group:`, Boolean(groupAccount.is_group));

  console.log("\n=== STEP 2: TEST GL_ACCOUNT_MAPPINGS TABLE & INITIAL SEED ===");
  const mapRes = await drizzleListRows({ resource: resources.gl_account_mappings });
  if (mapRes.status !== 200) {
    throw new Error(`Failed to list gl_account_mappings: ${JSON.stringify(mapRes.body)}`);
  }
  const mappings = mapRes.body;
  console.log(`✓ Fetched ${mappings.length} mapping rules from gl_account_mappings.`);

  if (mappings.length < 28) {
    throw new Error(`Expected at least 28 mapping rules, got ${mappings.length}`);
  }

  const salesRule = mappings.find((m) => m.id === "sales_revenue_domestic");
  if (!salesRule) throw new Error("Missing core rule: sales_revenue_domestic");
  console.log(`✓ sales_revenue_domestic rule:`, {
    id: salesRule.id,
    label: salesRule.label,
    account_code: salesRule.account_code,
    account_name: salesRule.account_name,
    normal_posting: salesRule.normal_posting,
    is_system_default: salesRule.is_system_default,
  });

  console.log("\n=== STEP 3: TEST GL MAPPING CRUD OPERATIONS ===");
  // 3a: Create custom rule
  const testRuleId = `test_custom_rule_${Date.now()}`;
  const newRule = {
    id: testRuleId,
    label: "Test Automated Scrap Revenue",
    category: "Custom Rules",
    account_id: "4200",
    account_code: "4200",
    account_name: "OTHER INCOME",
    normal_posting: "Credit",
    is_system_default: false,
    description: "Automated test mapping rule for verification.",
    updated_by: "Test Suite",
  };

  const insertRes = await drizzleCreateRow({ resource: resources.gl_account_mappings, body: newRule });
  if (insertRes.status >= 300) {
    throw new Error(`Insert failed: ${JSON.stringify(insertRes.body)}`);
  }
  console.log(`✓ Successfully inserted custom mapping rule:`, insertRes.body.id);

  // 3b: Query back to verify persistence
  const freshRes = await drizzleListRows({ resource: resources.gl_account_mappings });
  const freshMappings = freshRes.body;
  const found = freshMappings.find((m) => m.id === testRuleId);
  if (!found) throw new Error("Failed to find inserted custom rule in database");
  console.log(`✓ Verified persistence in DB: ${found.id} -> [${found.account_code}] ${found.account_name}`);

  // 3c: Update rule
  const updateRes = await drizzleUpdateRow({
    resource: resources.gl_account_mappings,
    id: testRuleId,
    body: {
      label: "Updated Automated Scrap Revenue",
      account_id: "4000-01-01",
      account_code: "4000-01-01",
      account_name: "SALES OF VETERINARY DRUG",
    },
  });
  if (updateRes.status >= 300) {
    throw new Error(`Update failed: ${JSON.stringify(updateRes.body)}`);
  }
  console.log(`✓ Successfully updated custom mapping rule:`, {
    id: updateRes.body.id,
    label: updateRes.body.label,
    account_code: updateRes.body.account_code,
  });

  // 3d: Delete custom rule
  const deleteRes = await drizzleDeleteRow({ resource: resources.gl_account_mappings, id: testRuleId });
  if (deleteRes.status >= 300) {
    throw new Error(`Delete failed: ${JSON.stringify(deleteRes.body)}`);
  }
  console.log(`✓ Successfully deleted custom mapping rule:`, testRuleId);

  // Confirm deleted
  const postDeleteRes = await drizzleListRows({ resource: resources.gl_account_mappings });
  if (postDeleteRes.body.some((m) => m.id === testRuleId)) {
    throw new Error("Rule was not deleted from database");
  }
  console.log(`✓ Confirmed rule no longer exists in database.`);

  console.log("\n=== ALL RELATIONAL MIGRATION & GL MAPPING TESTS PASSED! ===");
  await pool.end();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Test failed:", err);
  await pool.end();
  process.exit(1);
});
