import { useEffect, useState } from 'react'

// "Mere orders": the customer's own orders, remembered on this phone only (no login).
// Each record: { code, slug, shopName, total, itemCount, createdAt, cart, waUrl }
// cart = itemId -> { qty, unit } (for "order again"); waUrl = the WhatsApp message, to send again.
const KEY = 'kb_orders'
const MAX = 50
const KEEP_MS = 90 * 86_400_000 // the server deletes orders after 90 days too

const fresh = (list) => list.filter((o) => Date.now() - new Date(o.createdAt) < KEEP_MS).slice(0, MAX)

export function readOrders() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(list) ? fresh(list) : []
  } catch {
    return []
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(fresh(list)))
  } catch {
    // storage full / blocked: the list just won't grow
  }
}

export const addOrder = (order) => save([order, ...readOrders().filter((o) => o.code !== order.code)])
export const removeOrder = (code) => save(readOrders().filter((o) => o.code !== code))

/** Latest status of these orders from the server: code -> { status, total } (missing = not found) */
export async function fetchStatuses(codes) {
  if (!codes.length) return {}
  const res = await fetch(`/api/public?orders=${codes.map(encodeURIComponent).join(',')}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Status nahi mila')
  return Object.fromEntries(data.orders.map((o) => [o.code, o]))
}

// Customer-facing words for the owner's order statuses
export const STATUS_TEXT = {
  new: { text: 'Bheja', hint: 'Dukaan ke jawab ka intezaar', cls: 'bg-amber-100 text-amber-800' },
  ready: { text: 'Taiyaar hai', hint: 'Dukaan ne order taiyaar kar diya', cls: 'bg-sky-100 text-sky-800' },
  done: { text: 'De diya', hint: 'Order mil gaya', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { text: 'Cancel', hint: 'Dukaan ne order cancel kiya', cls: 'bg-zinc-100 text-zinc-500' },
  gone: { text: 'Purana', hint: 'Dukaan ki list mein ab nahi (90 din se purana)', cls: 'bg-zinc-100 text-zinc-500' },
}

/** Keeps the status of these codes fresh: now and every minute while the page is open */
export function useStatuses(codes) {
  const key = codes.join(',')
  const [state, setState] = useState({ key: '', statuses: {}, error: '' })
  useEffect(() => {
    if (!key) return
    let live = true
    const run = () =>
      fetchStatuses(key.split(','))
        .then((found) => {
          if (!live) return
          // A code the server doesn't know any more is an old (deleted) order
          const statuses = Object.fromEntries(key.split(',').map((c) => [c, found[c]?.status ?? 'gone']))
          setState({ key, statuses, error: '' })
        })
        .catch((e) => live && setState((s) => ({ ...s, key, error: e.message === 'Failed to fetch' ? 'Internet check karein' : e.message })))
    run()
    const t = setInterval(() => document.visibilityState === 'visible' && run(), 60_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [key])
  return state.key === key ? state : { statuses: {}, error: '' }
}
