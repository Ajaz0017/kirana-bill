const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const inr = (n) => inrFormatter.format(Number(n) || 0)

export const round = (n, places = 2) => {
  const f = 10 ** places
  return Math.round((n + Number.EPSILON) * f) / f
}

// 0.250 -> "0.25", 2 -> "2"
export const fmtQty = (n) => (n === '' || n == null ? '' : String(round(Number(n), 3)))

// Local date as YYYY-MM-DD (toISOString would shift to UTC)
export const todayISO = () => new Date().toLocaleDateString('en-CA')

// "2026-10-14" -> "14-Oct-2026"
export const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-')
}

// "2026-10-14" -> "14 October 2026"
export const fmtDateLong = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Keep only a valid decimal number while typing
export const cleanDecimal = (v) => {
  const s = v.replace(/[^\d.]/g, '')
  const [int, ...rest] = s.split('.')
  return rest.length ? `${int}.${rest.join('')}` : int
}
