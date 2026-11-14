import { SHOP_CLOUD_FIELDS, useBillStore } from '../store/useBillStore'
import { api } from './api'

// An item is priced by its single rate, or by qty slabs that all have a rate
export const hasRate = (i) => (i.slabs?.length > 1 ? i.slabs.every((s) => parseFloat(s.rate) > 0) : parseFloat(i.rate) > 0)

/**
 * Fetch the own shop. The server copy replaces the phone's unless the phone has unsaved edits
 * (then only the saved-state info is refreshed, and the edits wait for Save).
 */
export async function loadMyShop() {
  const data = await api('/api/shops?mine=1')
  const s = useBillStore.getState()
  if (!s.shopDirty) s.applyCloudShop(data)
  else if (data.shop) useBillStore.setState({ shopMeta: { slug: data.shop.slug, isPublic: data.shop.isPublic } })
  return data
}

/** Number of new online orders, for the badges; checked now and every minute while the app is open */
export function watchNewOrders() {
  const check = async () => {
    const s = useBillStore.getState()
    if (!s.shopMeta || !navigator.onLine || document.visibilityState !== 'visible') return
    try {
      const { newCount } = await api('/api/shops?orders=count')
      useBillStore.setState({ newOrders: newCount })
    } catch {
      // offline / server busy: keep the last count
    }
  }
  check()
  setInterval(check, 60_000)
  document.addEventListener('visibilitychange', check)
}

/** An online order's bill reached history: mark the order so it isn't billed twice */
export async function linkOrderToBill(code, billId) {
  try {
    await api(`/api/shops?order=${encodeURIComponent(code)}`, { method: 'PATCH', body: { billId } })
  } catch {
    // not fatal: the bill itself is saved; the order just won't show "Bill ban gaya"
  }
}

/** Problems that block saving, in words for the owner (empty = ok) */
export function shopProblems(s = useBillStore.getState()) {
  const problems = []
  if (!s.shopInfo.name.trim()) problems.push('Shop ka naam daalein')
  const noRate = s.shopItems.filter((i) => !hasRate(i)).length
  if (noRate) problems.push(`${noRate} item${noRate > 1 ? 's' : ''} ka rate baaki hai`)
  return problems
}

/** Send details + Private/Public + the whole rate list. Throws a user-facing Error. */
export async function saveMyShop() {
  const s = useBillStore.getState()
  const problems = shopProblems(s)
  if (problems.length) throw new Error(problems[0])
  const shop = Object.fromEntries(SHOP_CLOUD_FIELDS.map((k) => [k, s.shopInfo[k] ?? '']))
  const data = await api('/api/shops', {
    method: 'PUT',
    body: {
      shop: { ...shop, isPublic: s.shopPublic },
      items: s.shopItems.map(({ id, name, unit, rate, category, inStock, slabs }) => ({
        id,
        name: name.trim(),
        unit,
        rate: parseFloat(rate),
        slabs: slabs?.length > 1 ? slabs.map((x) => ({ min: Number(x.min), rate: parseFloat(x.rate) })) : [],
        category: (category ?? '').trim(),
        inStock: inStock !== false,
      })),
    },
  })
  useBillStore.getState().applyCloudShop(data)
  return data
}
