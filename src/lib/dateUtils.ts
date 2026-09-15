/**
 * Timezone-Safe Date Utility for HKC-ERP
 * 
 * Avoids the classic `new Date().toISOString().slice(0, 10)` off-by-one day bug
 * in positive UTC timezones (such as East Africa / Ethiopia UTC+3) where midnight-to-3AM
 * calls convert to previous UTC calendar day.
 */

/**
 * Returns the current (or supplied) date in YYYY-MM-DD format strictly using local calendar date numbers.
 */
export function getLocalDateString(d: Date | string | number = new Date()): string {
  const dateObj = typeof d === "string" || typeof d === "number" ? new Date(d) : d
  if (isNaN(dateObj.getTime())) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, "0")
  const day = String(dateObj.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Formats a YYYY-MM-DD string into human-readable display (e.g. "Sep 14, 2026")
 * without parsing as UTC midnight to avoid day shifting.
 */
export function formatLocalDateDisplay(dateStr?: string | null): string {
  if (!dateStr || dateStr === "—" || dateStr === "N/A") return "—"
  
  // If in YYYY-MM-DD format, parse parts directly to prevent timezone shift
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, y, m, d] = match
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthName = months[parseInt(m, 10) - 1] || m
    return `${monthName} ${parseInt(d, 10)}, ${y}`
  }

  const parsed = new Date(dateStr)
  if (isNaN(parsed.getTime())) return String(dateStr)
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

/**
 * Returns an accurate ISO timestamp with local timezone offset preserved or UTC.
 */
export function getLocalTimestamp(): string {
  return new Date().toISOString()
}
