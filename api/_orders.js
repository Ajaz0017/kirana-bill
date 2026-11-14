// Order helpers shared by api/public.js (customers) and api/shops.js (owners).
// The "_" prefix keeps Vercel from exposing this file as its own endpoint.

export const STATUSES = ['new', 'ready', 'done', 'cancelled'] // stored as 0..3
export const KEEP_DAYS = 90 // orders older than this are deleted (free database)

const CODE_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789' // no 0/o/1/l: easy to read aloud
export function orderCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

// Items are stored compactly: [name, qty, unit, ratePaise, rateUnit, amountPaise]
export const packItem = (i) => [i.name, i.qty, i.unit, Math.round(i.rate * 100), i.rateUnit, Math.round(i.amount * 100)]
export const unpackItem = ([name, qty, unit, ratePaise, rateUnit, amountPaise]) => ({
  name,
  qty,
  unit,
  rate: ratePaise / 100,
  rateUnit,
  amount: amountPaise / 100,
})

export const ORDER_COLS = `code, cust_name, cust_mobile, delivery, address, note, items, total_paise, status, bill_id, created_at`

export const orderOut = (r) => ({
  code: r.code,
  customer: { name: r.cust_name, mobile: r.cust_mobile, delivery: r.delivery, address: r.address, note: r.note },
  items: (typeof r.items === 'string' ? JSON.parse(r.items) : r.items).map(unpackItem),
  total: r.total_paise / 100,
  status: STATUSES[r.status] ?? 'new',
  billId: r.bill_id ?? null,
  createdAt: r.created_at,
})

/** Indian mobile -> WhatsApp's form ("98765 43210" / "+91…" -> "9198…"), or null */
export function waNumber(mobile) {
  const d = String(mobile ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (d.length === 10) return `91${d}`
  if (d.length === 12 && d.startsWith('91')) return d
  return null
}
