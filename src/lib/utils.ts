import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensures records are sorted newest-first by default across all ERP tables.
 * Uses created_at / date timestamps if available, falling back to descending ID comparisons.
 */
export function sortNewestFirst<T>(items: T[]): T[] {
  if (!Array.isArray(items) || items.length <= 1) return items || []
  return [...items].sort((a: any, b: any) => {
    if (!a || !b) return 0
    const timeA = a.created_at || a.createdAt || a.date || a.entry_date || a.sale_date || a.issue_date || a.postingDate || a.start_date || a.timestamp
    const timeB = b.created_at || b.createdAt || b.date || b.entry_date || b.sale_date || b.issue_date || b.postingDate || b.start_date || b.timestamp
    if (timeA && timeB && timeA !== timeB) {
      const dateA = new Date(timeA).getTime()
      const dateB = new Date(timeB).getTime()
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA // newest first
      }
      if (typeof timeB === "string" && typeof timeA === "string") {
        const cmp = timeB.localeCompare(timeA)
        if (cmp !== 0) return cmp
      }
    }
    const idA = a.id ?? a.reference_number ?? a.employee_number ?? a.invoice_number ?? a.fs_no
    const idB = b.id ?? b.reference_number ?? b.employee_number ?? b.invoice_number ?? b.fs_no
    if (idA !== undefined && idB !== undefined && idA !== idB) {
      if (typeof idA === "number" && typeof idB === "number") {
        return idB - idA
      }
      return String(idB).localeCompare(String(idA), undefined, { numeric: true })
    }
    return 0
  })
}

