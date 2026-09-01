export interface AttendanceRecordInput {
  employeeId: string
  date: string
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HALF_DAY"
  checkIn?: string
  checkOut?: string
}

export interface AttendanceMatrixSummary {
  totalPresent: number
  totalAbsent: number
  totalLate: number
  totalLeave: number
  attendancePercentage: number
}

/**
 * Calculates monthly attendance percentage and matrix stats.
 */
export function evaluateAttendanceMatrix(records: AttendanceRecordInput[]): AttendanceMatrixSummary {
  let totalPresent = 0
  let totalAbsent = 0
  let totalLate = 0
  let totalLeave = 0

  records.forEach((rec) => {
    if (rec.status === "PRESENT") totalPresent++
    else if (rec.status === "ABSENT") totalAbsent++
    else if (rec.status === "LATE") totalLate++
    else if (rec.status === "LEAVE") totalLeave++
    else if (rec.status === "HALF_DAY") totalPresent += 0.5
  })

  const totalWorkingDays = records.length || 1
  const attendancePercentage = Math.round(((totalPresent + totalLate) / totalWorkingDays) * 100)

  return {
    totalPresent,
    totalAbsent,
    totalLate,
    totalLeave,
    attendancePercentage: Math.min(100, Math.max(0, attendancePercentage)),
  }
}
