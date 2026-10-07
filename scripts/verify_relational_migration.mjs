import mysql from "mysql2/promise"

async function verify() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: "habtom",
    password: "DMka6&jn0*Wsdfo0",
    database: "hkc_trading",
  })

  console.log("=== RUNNING POST-MIGRATION VALIDATION SUITE ===")

  try {
    // 1. Check Row Counts
    const [[{ count: jeCount }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entries")
    const [[{ count: jelCount }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entry_lines")
    const [[{ count: coaCount }]] = await conn.query("SELECT COUNT(*) as count FROM chart_of_accounts")
    console.log(`[CHECK 1] Row counts: JE=${jeCount}, JEL=${jelCount}, COA=${coaCount}`)
    if (jeCount !== 85 || jelCount !== 170 || coaCount !== 280) {
      throw new Error(`Row counts mismatch! JE: ${jeCount}, JEL: ${jelCount}, COA: ${coaCount}`)
    }

    // 2. Check Trial Balance
    const [[{ total_debit, total_credit }]] = await conn.query(`
      SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM journal_entry_lines
    `)
    const diff = Math.abs(Number(total_debit) - Number(total_credit))
    console.log(`[CHECK 2] Trial Balance: DR=${Number(total_debit).toFixed(2)}, CR=${Number(total_credit).toFixed(2)}, Discrepancy=${diff.toFixed(2)} ETB`)
    if (diff > 0.001) throw new Error(`Discrepancy detected: ${diff}`)

    // 3. Check Cascade Atomicity
    console.log("[CHECK 3] Testing foreign key ON DELETE CASCADE atomicity...")
    const testJeId = "TEST-JE-CASCADE-VERIFY"
    await conn.query(`
      INSERT INTO journal_entries (id, entry_number, entry_date, description, source_type, total_amount)
      VALUES (?, ?, '2026-10-07', 'Test cascade entry', 'MANUAL', 100.00)
    `, [testJeId, testJeId])

    await conn.query(`
      INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit_amount, credit_amount)
      VALUES (?, ?, '1000', 100.00, 0.00), (?, ?, '1000', 0.00, 100.00)
    `, [`${testJeId}-DR`, testJeId, `${testJeId}-CR`, testJeId])

    const [[{ count: linesInserted }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entry_lines WHERE journal_entry_id = ?", [testJeId])
    if (linesInserted !== 2) throw new Error("Failed to insert test lines")

    // Delete parent
    await conn.query("DELETE FROM journal_entries WHERE id = ?", [testJeId])
    const [[{ count: linesRemaining }]] = await conn.query("SELECT COUNT(*) as count FROM journal_entry_lines WHERE journal_entry_id = ?", [testJeId])
    console.log(`  Lines remaining after deleting parent JE: ${linesRemaining} (expected: 0)`)
    if (linesRemaining !== 0) throw new Error("Foreign key cascade failed: child lines still exist!")

    // 4. Check COA Relational Update
    console.log("[CHECK 4] Testing Chart of Accounts relational update...")
    const [accRow] = await conn.query("SELECT name FROM chart_of_accounts WHERE id = '1000'")
    const originalName = accRow[0].name
    await conn.query("UPDATE chart_of_accounts SET name = ? WHERE id = '1000'", [`${originalName} - VERIFY`])
    const [updatedRow] = await conn.query("SELECT name FROM chart_of_accounts WHERE id = '1000'")
    if (updatedRow[0].name !== `${originalName} - VERIFY`) throw new Error("COA relational update failed!")
    // Revert
    await conn.query("UPDATE chart_of_accounts SET name = ? WHERE id = '1000'", [originalName])
    console.log("  COA relational update verified and reverted cleanly.")

    console.log("\n=== ALL VALIDATION CHECKS PASSED WITH 100% SUCCESS ===")
  } finally {
    await conn.end()
  }
}

verify().catch((err) => {
  console.error("Verification failed:", err)
  process.exit(1)
})
