import { pool } from "./client.js"

/**
 * Execute a callback inside an atomic MySQL transaction.
 * @param {Function} callback (conn) => Promise<any>
 * @returns {Promise<any>}
 */
export async function withTransaction(callback) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await callback(conn)
    await conn.commit()
    return result
  } catch (err) {
    try {
      await conn.rollback()
    } catch (rollbackErr) {
      console.error("[TRANSACTION ROLLBACK ERROR]:", rollbackErr)
    }
    throw err
  } finally {
    conn.release()
  }
}
