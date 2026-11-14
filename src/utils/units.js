import { round } from './format.js'

// Units that convert into each other (factor = how many of the small unit make one)
const FAMILIES = [
  { units: { kg: 1000, gm: 1 }, small: 'gm', big: 'kg' },
  { units: { ltr: 1000, ml: 1 }, small: 'ml', big: 'ltr' },
]
const familyOf = (unit) => FAMILIES.find((f) => unit in f.units)

/** Units a rate quoted per `unit` can price (kg -> [kg, gm]; pcs -> [pcs]) */
export const unitFamily = (unit) => {
  const f = familyOf(unit)
  return f ? [f.big, f.small] : [unit]
}

export const sameFamily = (a, b) => a === b || (!!familyOf(a) && familyOf(a) === familyOf(b))

/** qty in `from` -> qty in `to` (250 gm -> 0.25 kg); null if they don't convert */
export function convertQty(qty, from, to) {
  const n = Number(qty)
  if (!Number.isFinite(n)) return null
  if (from === to) return n
  const f = familyOf(from)
  if (!f || familyOf(to) !== f) return null
  return (n * f.units[from]) / f.units[to]
}

/** Bill line amount: qty (in its unit) × rate (per rateUnit) */
export function lineAmount(qty, unit, rate, rateUnit = unit) {
  const q = convertQty(qty, unit, rateUnit)
  const r = Number(rate)
  return q > 0 && r > 0 ? round(q * r) : null
}

/** Slab start for people: 0.25 kg -> "250 g", 5 kg -> "5 kg", 12 pcs -> "12 pcs" */
export function fmtSlabQty(min, unit) {
  const f = familyOf(unit)
  if (f && unit === f.big && min < 1) return `${round(min * 1000, 0)} ${f.small === 'gm' ? 'g' : 'ml'}`
  if (unit === 'gm') return `${round(min, 0)} g`
  return `${round(min, 3)} ${unit}`
}

/**
 * Rate for a quantity under a shop item's slabs (qty in the item's own unit).
 * Each slab means "this much or more"; the first slab (min 0) covers everything below.
 * No slabs, or no qty yet: the item's main rate.
 */
export function slabRate(item, qty) {
  const slabs = item?.slabs
  if (!slabs?.length) return Number(item?.rate) || 0
  const q = Number(qty)
  if (!(q > 0)) return Number(item.rate) || slabs[0].rate
  let rate = slabs[0].rate
  for (const s of slabs) if (q + 1e-9 >= s.min) rate = s.rate
  return rate
}

/** The slab a quantity falls in, and the next one up (for "1 kg+ pe ₹66" hints) */
export function slabAt(item, qty) {
  const slabs = item?.slabs
  if (!slabs?.length) return null
  const q = Number(qty) > 0 ? Number(qty) : 1
  let i = 0
  slabs.forEach((s, k) => {
    if (q + 1e-9 >= s.min) i = k
  })
  return { slab: slabs[i], next: slabs[i + 1] ?? null }
}

/**
 * "₹20 ka de do": which slab fits an amount? Tries the biggest slab first; the first one where
 * amount ÷ rate reaches that slab's start wins. Returns { rate, qty } with qty in the item's unit.
 */
export function slabForAmount(item, amount) {
  const a = Number(amount)
  const slabs = item?.slabs
  if (!(a > 0)) return null
  if (!slabs?.length) return Number(item.rate) > 0 ? { rate: Number(item.rate), qty: a / Number(item.rate) } : null
  for (let i = slabs.length - 1; i >= 0; i--) {
    const qty = a / slabs[i].rate
    if (i === 0 || qty + 1e-9 >= slabs[i].min) return { rate: slabs[i].rate, qty }
  }
  return null
}

/** Main rate of a slab list = the rate for 1 unit (shown in lists, tracked in the rate graph) */
export function mainRate(slabs) {
  let rate = slabs[0]?.rate ?? 0
  for (const s of slabs) if (s.min <= 1 + 1e-9) rate = s.rate
  return rate
}
