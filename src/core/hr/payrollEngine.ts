/**
 * Ethiopian Payroll and Tax Calculation Engine
 * Compliant with:
 * - Income Tax: Proclamation No. 1395/2025
 * - Public Servants' Pension: Proclamation No. 1267/2022
 * - Private Organization Employees' Pension: Proclamation No. 1268/2022
 */

export interface TaxBracket {
  min: number
  max: number | null // null represents infinity / above threshold
  ratePercent: number
  deductible: number
}

export interface EthiopianPensionConfig {
  employeeRatePercent: number // Default: 7%
  employerRatePercent: number // Default: 11%
  expatExempt: boolean // Default: true
}

export interface EthiopianTaxConfig {
  pension: EthiopianPensionConfig
  brackets: TaxBracket[]
}

// Proclamation No. 1395/2025 Progressive Tax Brackets on Taxable Income Base
export const DEFAULT_ETHIOPIAN_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 2000, ratePercent: 0, deductible: 0 },
  { min: 2001, max: 4000, ratePercent: 15, deductible: 300 },
  { min: 4001, max: 7000, ratePercent: 20, deductible: 500 },
  { min: 7001, max: 10000, ratePercent: 25, deductible: 850 },
  { min: 10001, max: 14000, ratePercent: 30, deductible: 1350 },
  { min: 14001, max: null, ratePercent: 35, deductible: 2050 },
]

export const DEFAULT_ETHIOPIAN_PENSION_CONFIG: EthiopianPensionConfig = {
  employeeRatePercent: 7,
  employerRatePercent: 11,
  expatExempt: true,
}

export interface EthiopianPayrollBreakdown {
  employeeId: string
  employeeName: string
  grossBasicSalary: number
  totalAllowances: number
  grossSalary: number
  isExpat: boolean
  employeePension: number
  employerPension: number
  taxableIncomeBase: number
  incomeTaxDeducted: number
  totalEmployeeDeductions: number
  netTakeHomePay: number
  otherEarnings: number
  overtimePay: number
  bonus: number
  absenceDeduction: number
  loanDeduction: number
  otherDeductions: number
}

/**
 * Calculates Ethiopian Employment Income Tax based on Taxable Income Base.
 * Formula for quick math: (Taxable Income × Tax Rate) - Deductible
 */
export function calculateEthiopianIncomeTax(
  taxableIncomeBase: number,
  brackets: TaxBracket[] = DEFAULT_ETHIOPIAN_TAX_BRACKETS
): number {
  if (taxableIncomeBase <= 0) return 0

  for (const bracket of brackets) {
    const isAboveMin = taxableIncomeBase >= bracket.min
    const isBelowMax = bracket.max === null || taxableIncomeBase <= bracket.max
    if (isAboveMin && isBelowMax) {
      const tax = (taxableIncomeBase * (bracket.ratePercent / 100)) - bracket.deductible
      return Math.max(0, Math.round(tax * 100) / 100)
    }
  }

  // Fallback to top bracket if exceeded
  const topBracket = brackets[brackets.length - 1]
  if (topBracket) {
    const tax = (taxableIncomeBase * (topBracket.ratePercent / 100)) - topBracket.deductible
    return Math.max(0, Math.round(tax * 100) / 100)
  }

  return 0
}

/**
 * Core Ethiopian Payroll Calculation:
 * 1. Pension Calculation (Mandatory 7% employee, 11% employer for locals under Proc. 1267/2022 & 1268/2022)
 * 2. Taxable Income Base = (Gross Basic Salary + Taxable Allowances) - Employee Pension (7%)
 * 3. Income Tax under Proclamation No. 1395/2025
 * 4. Net Take-Home Pay
 */
export function calculateEthiopianPayroll(options: {
  employeeId?: string
  employeeName?: string
  basicSalary: number
  allowances?: number
  overtimePay?: number
  bonus?: number
  otherEarnings?: number
  absenceDeduction?: number
  loanDeduction?: number
  otherDeductions?: number
  isExpat?: boolean
  pensionConfig?: EthiopianPensionConfig
  taxBrackets?: TaxBracket[]
}): EthiopianPayrollBreakdown {
  const basicSalary = Number(options.basicSalary || 0)
  const allowances = Number(options.allowances || 0)
  const overtimePay = Number(options.overtimePay || 0)
  const bonus = Number(options.bonus || 0)
  const otherEarnings = Number(options.otherEarnings || 0)
  const absenceDeduction = Number(options.absenceDeduction || 0)
  const loanDeduction = Number(options.loanDeduction || 0)
  const otherDeductions = Number(options.otherDeductions || 0)
  const isExpat = Boolean(options.isExpat)

  const pensionConfig = options.pensionConfig || DEFAULT_ETHIOPIAN_PENSION_CONFIG
  const taxBrackets = options.taxBrackets || DEFAULT_ETHIOPIAN_TAX_BRACKETS

  // 1. Pension Calculation
  const isPensionApplicable = !isExpat || !pensionConfig.expatExempt
  const employeePension = isPensionApplicable
    ? Math.round((basicSalary * (pensionConfig.employeeRatePercent / 100)) * 100) / 100
    : 0
  const employerPension = isPensionApplicable
    ? Math.round((basicSalary * (pensionConfig.employerRatePercent / 100)) * 100) / 100
    : 0

  // 2. Taxable Income Base Formula: (Gross Monthly Basic Salary + Taxable Allowances) - Employee Pension Contribution (7%)
  const taxableIncomeBase = Math.max(0, Math.round(((basicSalary + allowances) - employeePension) * 100) / 100)

  // 3. Income Tax Calculation
  const incomeTaxDeducted = calculateEthiopianIncomeTax(taxableIncomeBase, taxBrackets)

  // 4. Gross and Net
  const grossSalary = Math.round((basicSalary + allowances + overtimePay + bonus + otherEarnings) * 100) / 100
  const totalEmployeeDeductions = Math.round(
    (employeePension + incomeTaxDeducted + absenceDeduction + loanDeduction + otherDeductions) * 100
  ) / 100
  const netTakeHomePay = Math.round((grossSalary - totalEmployeeDeductions) * 100) / 100

  return {
    employeeId: options.employeeId || "",
    employeeName: options.employeeName || "",
    grossBasicSalary: basicSalary,
    totalAllowances: allowances,
    grossSalary,
    isExpat,
    employeePension,
    employerPension,
    taxableIncomeBase,
    incomeTaxDeducted,
    totalEmployeeDeductions,
    netTakeHomePay,
    otherEarnings,
    overtimePay,
    bonus,
    absenceDeduction,
    loanDeduction,
    otherDeductions,
  }
}

/**
 * Backward compatible helper for HR and legacy stores
 */
export function calculatePayrollRecord(
  employeeId: string,
  employeeName: string,
  baseSalary: number,
  allowances = 0
) {
  const result = calculateEthiopianPayroll({
    employeeId,
    employeeName,
    basicSalary: baseSalary,
    allowances,
  })

  return {
    employeeId,
    employeeName,
    grossSalary: result.grossSalary,
    incomeTax: result.incomeTaxDeducted,
    pensionEmployee: result.employeePension,
    pensionCompany: result.employerPension,
    totalDeductions: result.totalEmployeeDeductions,
    netPay: result.netTakeHomePay,
  }
}

/**
 * Standard formatted Ethiopian Payroll Output Generator
 */
export function formatEthiopianPayrollSummary(data: EthiopianPayrollBreakdown): string {
  return [
    `* Gross Basic Salary: ${data.grossBasicSalary.toLocaleString()} ETB`,
    `* Total Allowances: ${data.totalAllowances.toLocaleString()} ETB`,
    `* Employee Pension (${DEFAULT_ETHIOPIAN_PENSION_CONFIG.employeeRatePercent}%): ${data.employeePension.toLocaleString()} ETB`,
    `* Employer Pension (${DEFAULT_ETHIOPIAN_PENSION_CONFIG.employerRatePercent}%): ${data.employerPension.toLocaleString()} ETB`,
    `* Taxable Income Base: ${data.taxableIncomeBase.toLocaleString()} ETB`,
    `* Income Tax Deducted: ${data.incomeTaxDeducted.toLocaleString()} ETB`,
    `* Total Employee Deductions: ${data.totalEmployeeDeductions.toLocaleString()} ETB`,
    `* Net Take-Home Pay: ${data.netTakeHomePay.toLocaleString()} ETB`,
  ].join("\n")
}
