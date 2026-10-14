const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const twoDigits = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''))

const threeDigits = (n) => {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? ONES[h] + ' Hundred' : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ')
}

// Indian grouping: crore, lakh, thousand, hundred
export function numberToIndianWords(n) {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 1e7)
  const lakh = Math.floor((n % 1e7) / 1e5)
  const thousand = Math.floor((n % 1e5) / 1e3)
  const rest = n % 1e3

  const parts = []
  if (crore) parts.push(numberToIndianWords(crore) + ' Crore')
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh')
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand')
  if (rest) parts.push(threeDigits(rest))
  return parts.join(' ')
}

// 1250.5 -> "Rupees One Thousand Two Hundred Fifty and Fifty Paise Only"
export function amountInWords(amount) {
  const paiseTotal = Math.round((Number(amount) || 0) * 100)
  const rupees = Math.floor(paiseTotal / 100)
  const paise = paiseTotal % 100
  let words = 'Rupees ' + numberToIndianWords(rupees)
  if (paise) words += ' and ' + twoDigits(paise) + ' Paise'
  return words + ' Only'
}
