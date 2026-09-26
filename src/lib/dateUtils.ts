/**
 * Timezone-Safe Date Utility for HKC-ERP
 * 
 * Avoids the classic `new Date().toISOString().slice(0, 10)` off-by-one day bug
 * in positive UTC timezones (such as East Africa / Ethiopia UTC+3) where midnight-to-3AM
 * calls convert to previous UTC calendar day.
 */

/**
 * Safely parses any date/timestamp representation (ISO string, SQL "YYYY-MM-DD HH:mm:ss",
 * milliseconds number, epoch timestamp) into a valid JavaScript Date object without
 * crashing or returning "Invalid Date" on mobile devices (iOS Safari / WebKit).
 * 
 * Automatically treats SQL datetime strings without timezone as UTC timestamps recorded by MySQL.
 */
export function parseSafeDate(val?: string | number | Date | null): Date | null {
  if (!val) return null
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val
  }
  if (typeof val === "number") {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }

  const str = String(val).trim()
  if (!str || str === "—" || str === "N/A" || str === "null" || str === "undefined") return null

  // Check if string is purely numeric epoch (e.g. "1790430641000")
  if (/^\d{10,15}$/.test(str)) {
    const d = new Date(Number(str))
    if (!isNaN(d.getTime())) return d
  }

  // Parse SQL Datetime "YYYY-MM-DD HH:mm:ss" or ISO with/without milliseconds and with/without timezone
  const sqlMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?)?(?:Z|([+-]\d{2}:?\d{2}))?$/)
  if (sqlMatch) {
    const [, y, m, d, h = "0", min = "0", s = "0", ms = "", tz] = sqlMatch
    if (tz) {
      // Explicit timezone offset given
      const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${min.padStart(2, "0")}:${s.padStart(2, "0")}${ms ? `.${ms}` : ""}${tz}`
      const dateObj = new Date(iso)
      if (!isNaN(dateObj.getTime())) return dateObj
    } else if (sqlMatch[4] !== undefined) {
      // Has time components, MySQL timestamp without timezone -> treat as UTC
      const parsedMs = ms ? parseInt(ms.slice(0, 3).padEnd(3, "0"), 10) : 0
      const utcMs = Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10),
        parseInt(s, 10),
        parsedMs
      )
      const dateObj = new Date(utcMs)
      if (!isNaN(dateObj.getTime())) return dateObj
    } else {
      // Date only: "YYYY-MM-DD"
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
      if (!isNaN(dateObj.getTime())) return dateObj
    }
  }

  // Fallback: replace spaces with T
  const safeIso = str.includes(" ") && !str.includes("T") ? str.replace(" ", "T") : str
  const dObj = new Date(safeIso)
  if (!isNaN(dObj.getTime())) return dObj

  return null
}

/**
 * Returns the current (or supplied) date in YYYY-MM-DD format strictly using local calendar date numbers.
 */
export function getLocalDateString(d: Date | string | number = new Date()): string {
  const dateObj = typeof d === "string" || typeof d === "number" ? parseSafeDate(d) || new Date(d) : d
  if (!dateObj || isNaN(dateObj.getTime())) {
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

  const parsed = parseSafeDate(dateStr)
  if (!parsed) return String(dateStr)
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

/**
 * Formats any timestamp / date into human-readable local date & time
 * (e.g. "Sep 26, 2026, 05:10:41 PM").
 * 
 * Works 100% reliably across all mobile devices (iOS/Safari, Android) and desktop browsers,
 * converting server UTC timestamps to user's local timezone.
 */
export function formatDateTimeDisplay(val?: string | number | Date | null): string {
  const d = parseSafeDate(val)
  if (!d) return "—"
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

/**
 * Returns an accurate ISO timestamp with local timezone offset preserved or UTC.
 */
export function getLocalTimestamp(): string {
  return new Date().toISOString()
}
