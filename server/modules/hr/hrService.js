import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "./employeeLogic.js"

import {
  listAttendance,
  recordAttendance,
  bulkRecordAttendance,
  updateAttendance,
  deleteAttendance,
} from "./attendanceLogic.js"

import {
  listLeaves,
  getLeave,
  submitLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  deleteLeave,
  listLeaveTypes,
} from "./leaveLogic.js"

import {
  listPayrollPeriods,
  getPayrollPeriod,
  createPayrollPeriod,
  calculatePayrollForPeriod,
  approvePayrollPeriod,
  listPayrollRecords,
  getPayrollRecord,
  updatePayrollRecord,
} from "./payrollLogic.js"

export const hrService = {
  // Employee
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,

  // Attendance
  listAttendance,
  recordAttendance,
  logAttendance: recordAttendance,
  bulkRecordAttendance,
  updateAttendance,
  deleteAttendance,

  // Leave
  listLeaves,
  getLeave,
  submitLeave,
  createLeaveRequest: submitLeave,
  updateLeave,
  approveLeave,
  approveLeaveRequest: approveLeave,
  rejectLeave,
  deleteLeave,
  listLeaveTypes,

  // Payroll
  listPayrollPeriods,
  getPayrollPeriod,
  createPayrollPeriod,
  calculatePayrollForPeriod,
  calculatePayroll: calculatePayrollForPeriod,
  approvePayrollPeriod,
  listPayrollRecords,
  getPayrollRecord,
  updatePayrollRecord,
}

export default hrService
