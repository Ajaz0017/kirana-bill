import { nameKey } from './itemNames'
import { inr, round } from './format'
import { convertQty, fmtSlabQty, sameFamily, slabRate } from './units'

// Rate history dates are day numbers: days since 1 Jan 2025, India time (same as api/shops.js)
const EPOCH = Date.UTC(2025, 0, 1)
const IST_MS = 330 * 60 * 1000
const DAY_MS = 86_400_000

export const todayDay = () => Math.floor((Date.now() + IST_MS - EPOCH) / DAY_MS)

/** Day number -> "14 Nov 2026" (or other toLocaleDateString options) */
export const fmtDay = (day, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(EPOCH + day * DAY_MS).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts })

/** "aaj" / "kal" / "5 din pehle" / "3 mahine pehle" */
export function agoText(day) {
  if (day == null) return ''
  const d = todayDay() - day
  if (d <= 0) return 'aaj'
  if (d === 1) return 'kal'
  if (d < 30) return `${d} din pehle`
  if (d < 365) return `${Math.floor(d / 30)} mahine pehle`
  return `${Math.floor(d / 365)} saal pehle`
}

/**
 * The own shop's item for a bill item name (spelling-insensitive). Prefers the same unit,
 * then items in stock. Only items with a rate count.
 */
export function findShopItem(shopItems, name, unit) {
  const key = nameKey(name)
  if (!key) return null
  const matches = shopItems.filter((i) => Number(i.rate) > 0 && nameKey(i.name) === key)
  if (!matches.length) return null
  const score = (i) => (unit && i.unit === unit ? 2 : 0) + (i.inStock !== false ? 1 : 0)
  return matches.reduce((best, i) => (score(i) > score(best) ? i : best))
}

/**
 * Scan rows with no rate get the shop's rate for that qty (slab), quoted per the shop item's
 * unit: 250 gm of a kg item -> ₹70/kg. Units that don't convert (pcs vs kg) are left alone.
 */
export function applyShopRates(rows, shopItems) {
  if (!shopItems.length) return rows
  return rows.map((row) => {
    if (parseFloat(row.rate) > 0) return row
    const item = findShopItem(shopItems, row.name, row.unit)
    if (!item || !sameFamily(item.unit, row.unit)) return row
    const qtyIn = convertQty(parseFloat(row.qty), row.unit, item.unit)
    const rate = slabRate(item, qtyIn)
    const amount = parseFloat(row.amount) > 0 ? row.amount : qtyIn > 0 ? round(qtyIn * rate) : row.amount
    return { ...row, rate, rateUnit: item.unit, amount, shopRate: true }
  })
}

/** "5 kg+ ₹65 · 1 kg+ ₹66 · 250 g+ ₹70 · kam ₹80" (biggest qty first), or '' for a single rate */
export function slabSummary(item) {
  if (!(item?.slabs?.length > 1)) return ''
  return [...item.slabs]
    .reverse()
    .map((s) => (s.min > 0 ? `${fmtSlabQty(s.min, item.unit)}+ ₹${inr(s.rate)}` : `kam ₹${inr(s.rate)}`))
    .join(' · ')
}

/** Rate list grouped by category, categories A-Z with uncategorised last */
export function groupByCategory(items) {
  const groups = new Map()
  for (const item of items) {
    const cat = item.category?.trim() || ''
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat).push(item)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([category, list]) => ({ category, items: list.sort((x, y) => x.name.localeCompare(y.name)) }))
}

export const shopLink = (slug) => `${location.origin}/?shop=${encodeURIComponent(slug)}`
