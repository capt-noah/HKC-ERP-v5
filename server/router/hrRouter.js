import { Router } from "express"
import { hrService } from "../modules/hr/hrService.js"
import { authorizeRoles } from "../modules/auth/authMiddleware.js"

export const hrRouter = Router()

const hrAllPaths = [
  "/employees",
  "/hr/employees",
  "/attendance_records",
  "/attendance-records",
  "/hr/attendance_records",
  "/hr/attendance-records",
  "/hr/attendance",
  "/leave_requests",
  "/leave-requests",
  "/hr/leave_requests",
  "/hr/leave-requests",
  "/hr/leaves",
  "/leave_types",
  "/leave-types",
  "/hr/leave_types",
  "/hr/leave-types",
  "/payroll_periods",
  "/payroll-periods",
  "/hr/payroll_periods",
  "/hr/payroll-periods",
  "/hr/payroll",
  "/payroll_records",
  "/payroll-records",
  "/hr/payroll_records",
  "/hr/payroll-records",
]

// All HR routes are strictly confidential to superadmin and hr_manager
hrRouter.use(hrAllPaths, authorizeRoles("superadmin", "hr_manager"))


// ── 1. Employees ─────────────────────────────────────────────────────────────
const employeeRoutes = ["/employees", "/hr/employees"]

hrRouter.get(employeeRoutes, async (req, res, next) => {
  try {
    const result = await hrService.listEmployees(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(employeeRoutes, async (req, res, next) => {
  try {
    const result = await hrService.createEmployee(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.get(employeeRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.getEmployee(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.patch(employeeRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.updateEmployee(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.delete(employeeRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.deleteEmployee(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 2. Attendance Records ────────────────────────────────────────────────────
const attendanceRoutes = [
  "/attendance_records",
  "/attendance-records",
  "/hr/attendance_records",
  "/hr/attendance-records",
  "/hr/attendance",
]

hrRouter.get(attendanceRoutes, async (req, res, next) => {
  try {
    const result = await hrService.listAttendance(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(attendanceRoutes, async (req, res, next) => {
  try {
    const result = await hrService.recordAttendance(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(attendanceRoutes.map((r) => `${r}/bulk`), async (req, res, next) => {
  try {
    const result = await hrService.bulkRecordAttendance(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.get(attendanceRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.updateAttendance(req.params.id, {})
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.patch(attendanceRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.updateAttendance(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.delete(attendanceRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.deleteAttendance(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 3. Leave Requests & Types ────────────────────────────────────────────────
const leaveRoutes = [
  "/leave_requests",
  "/leave-requests",
  "/hr/leave_requests",
  "/hr/leave-requests",
  "/hr/leaves",
]

hrRouter.get(leaveRoutes, async (req, res, next) => {
  try {
    const result = await hrService.listLeaves(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(leaveRoutes, async (req, res, next) => {
  try {
    const result = await hrService.submitLeave(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.get(leaveRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.getLeave(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.patch(leaveRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.updateLeave(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(leaveRoutes.map((r) => `${r}/:id/approve`), async (req, res, next) => {
  try {
    const result = await hrService.approveLeave(req.params.id, req.body.approved_by || req.user?.username)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(leaveRoutes.map((r) => `${r}/:id/reject`), async (req, res, next) => {
  try {
    const result = await hrService.rejectLeave(req.params.id, req.body.rejected_by || req.user?.username, req.body.reason)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.delete(leaveRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.deleteLeave(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.get(["/leave_types", "/leave-types", "/hr/leave_types", "/hr/leave-types"], async (req, res, next) => {
  try {
    const result = await hrService.listLeaveTypes()
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// ── 4. Payroll Periods & Records ─────────────────────────────────────────────
const periodRoutes = [
  "/payroll_periods",
  "/payroll-periods",
  "/hr/payroll_periods",
  "/hr/payroll-periods",
  "/hr/payroll",
]

hrRouter.get(periodRoutes, async (req, res, next) => {
  try {
    const result = await hrService.listPayrollPeriods()
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(periodRoutes, async (req, res, next) => {
  try {
    const result = await hrService.createPayrollPeriod(req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.get(periodRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.getPayrollPeriod(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(periodRoutes.map((r) => `${r}/:id/calculate`), async (req, res, next) => {
  try {
    const result = await hrService.calculatePayrollForPeriod(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.post(periodRoutes.map((r) => `${r}/:id/approve`), async (req, res, next) => {
  try {
    const result = await hrService.approvePayrollPeriod(req.params.id, req.body.approved_by || req.user?.username)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

const payrollRecordRoutes = [
  "/payroll_records",
  "/payroll-records",
  "/hr/payroll_records",
  "/hr/payroll-records",
]

hrRouter.get(payrollRecordRoutes, async (req, res, next) => {
  try {
    const result = await hrService.listPayrollRecords(req.query)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.get(payrollRecordRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.getPayrollRecord(req.params.id)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

hrRouter.patch(payrollRecordRoutes.map((r) => `${r}/:id`), async (req, res, next) => {
  try {
    const result = await hrService.updatePayrollRecord(req.params.id, req.body)
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})
