import { useBillStore } from '../store/useBillStore'
import { api } from './api'

const isUpload = (v) => typeof v === 'string' && v.startsWith('data:')

/**
 * The draft as it goes to history. Uploaded stamp/signature images are big and the same on every
 * bill, so they're stored as 'shop' and filled back in from the shop settings when viewed.
 */
export function snapshotBill(s = useBillStore.getState()) {
  const { stamp, signature } = s.shopInfo
  return {
    id: s.draftId,
    items: s.items,
    details: s.details,
    shopInfo: { ...s.shopInfo, stamp: isUpload(stamp) ? 'shop' : stamp, signature: isUpload(signature) ? 'shop' : signature },
  }
}

/** Saved bill's shop details, ready for BillTable */
export function resolveShop(saved = {}, current = useBillStore.getState().shopInfo) {
  return {
    ...saved,
    stamp: saved.stamp === 'shop' ? current.stamp : (saved.stamp ?? 'default'),
    signature: saved.signature === 'shop' ? current.signature : (saved.signature ?? 'default'),
  }
}

const pending = () => useBillStore.getState().pendingBills

let running = null

/** Sends every queued bill. Resolves when the queue has been tried once; never throws. */
export function flushPending() {
  running ??= (async () => {
    const tried = new Set()
    let bill
    // Re-read each round: bills queued while this runs are sent too
    while ((bill = Object.values(pending()).find((b) => !tried.has(b)))) {
      tried.add(bill)
      try {
        await api('/api/bills', { method: 'POST', body: bill })
        useBillStore.getState().unqueueBill(bill.id, bill)
      } catch (e) {
        // Offline / server down / logged out: keep everything for the next try
        if (!e.status || e.status >= 500 || e.status === 401 || e.status === 429) break
        // The server will never accept this one (bad data, too big): don't block the rest
        console.warn('Bill dropped from sync queue:', e.message)
        useBillStore.getState().unqueueBill(bill.id, bill)
      }
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** Save the current draft to history. Resolves true once it's on the server, false if it's queued. */
export async function saveDraft() {
  const s = useBillStore.getState()
  if (!s.items.length) return false
  const bill = snapshotBill(s)
  s.queueBill(bill)
  await running // a flush already in progress may have read the queue before this bill joined
  await flushPending()
  return !pending()[bill.id]
}

let started = false
/** Retry queued bills now and whenever the phone comes back online */
export function startSync() {
  if (started) return
  started = true
  window.addEventListener('online', () => flushPending())
  flushPending()
}
