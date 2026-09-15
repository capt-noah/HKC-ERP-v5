/**
 * Server Timezone-Safe Date Utility for HKC-ERP
 */

export function getLocalDateString(d = new Date()) {
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

export function formatLocalDateDisplay(dateStr) {
  if (!dateStr || dateStr === "—" || dateStr === "N/A") return "—"
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, y, m, d] = match
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthName = months[parseInt(m, 10) - 1] || m
    return `${monthName} ${parseInt(d, 10)}, ${y}`
  }
  return String(dateStr)
}
