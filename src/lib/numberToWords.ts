/**
 * Converts a numeric amount into standard English currency words for Ethiopian Birr.
 * Example: 250000.50 -> "Two Hundred Fifty Thousand Ethiopian Birr and Fifty Cents Only"
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
]

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
]

function convertGroup(num: number): string {
  let str = ""
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + " Hundred "
    num %= 100
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + " "
    num %= 10
  }
  if (num > 0) {
    str += ONES[num] + " "
  }
  return str.trim()
}

export function numberToBirrWords(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return "Zero Ethiopian Birr Only"
  }

  const absAmount = Math.abs(amount)
  const birr = Math.floor(absAmount)
  const cents = Math.round((absAmount - birr) * 100)

  let words = ""

  if (birr === 0) {
    words = "Zero"
  } else {
    const billions = Math.floor(birr / 1000000000)
    const millions = Math.floor((birr % 1000000000) / 1000000)
    const thousands = Math.floor((birr % 1000000) / 1000)
    const remainder = birr % 1000

    if (billions > 0) {
      words += convertGroup(billions) + " Billion "
    }
    if (millions > 0) {
      words += convertGroup(millions) + " Million "
    }
    if (thousands > 0) {
      words += convertGroup(thousands) + " Thousand "
    }
    if (remainder > 0) {
      words += convertGroup(remainder) + " "
    }
  }

  words = words.trim() + " Ethiopian Birr"

  if (cents > 0) {
    words += ` and ${convertGroup(cents)} Cents`
  }

  return words + " Only"
}
