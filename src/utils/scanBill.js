import { UNITS } from '../constants'
import { imageToDataURL } from './image'
import { inr, round } from './format'
import { createNameMatcher } from './itemNames'
import { CATALOG_NAMES } from '../data/catalog'

// What the AI might write -> the app's units
const UNIT_ALIASES = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', किलो: 'kg',
  g: 'gm', gm: 'gm', gms: 'gm', gram: 'gm', grams: 'gm', ग्राम: 'gm',
  l: 'ltr', lt: 'ltr', ltr: 'ltr', litre: 'ltr', liter: 'ltr', लीटर: 'ltr',
  ml: 'ml',
  pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs', nos: 'pcs', no: 'pcs', पीस: 'pcs',
  pkt: 'pkt', packet: 'pkt', pack: 'pkt', पैकेट: 'pkt',
  dozen: 'dozen', dz: 'dozen', दर्जन: 'dozen',
  box: 'box',
}
const toUnit = (u) => UNIT_ALIASES[u] ?? (UNITS.includes(u) ? u : 'pcs')

const MAX_HINTS = 200

/**
 * Photo -> compressed JPEG -> /api/scan -> rows ready for the review sheet.
 * `known` (names this shop sells) and `fixes` (owner's past corrections) steer and clean item names.
 */
export async function scanBill(file, { known = [], fixes = {} } = {}) {
  // ~1600px is plenty for handwriting and keeps the upload around 200–400 KB
  const dataUrl = await imageToDataURL(file, 1600, 'image/jpeg', 0.8)
  let res
  try {
    res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image: dataUrl.split(',')[1],
        mimeType: 'image/jpeg',
        // The shop's own spellings first, then the catalog, so the AI picks familiar names
        hints: [...new Set([...known, ...CATALOG_NAMES])].slice(0, MAX_HINTS),
      }),
    })
  } catch {
    throw new Error('Internet nahi chal raha, check karke dobara try karein')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && data.locked) {
    // PIN session expired: back to the lock screen (the bill draft stays in localStorage)
    location.replace('/lock.html')
    throw new Error('PIN dobara daalein')
  }
  if (!res.ok) throw new Error(data.error || 'Scan nahi ho paya, dobara try karein')

  const matchName = createNameMatcher({ known, fixes })
  const rows = data.items.map((it, i) => {
    const { name, changed } = matchName(it.name)
    const amount = it.amount ?? (it.qty && it.rate ? round(it.qty * it.rate) : null)
    // Double-check the model's arithmetic ourselves
    const mismatch = it.qty && it.rate && amount && Math.abs(it.qty * it.rate - amount) > 1
    return {
      key: `${Date.now()}-${i}`,
      name,
      suggested: name, // what we proposed; differs from the final name if the owner edits it
      scannedName: it.name, // what the AI actually read, shown when we corrected it
      autoFixed: changed,
      qty: it.qty ?? '',
      unit: toUnit(it.unit),
      rate: it.rate ?? '',
      amount: amount ?? '',
      uncertain: it.uncertain || !amount || !!mismatch,
    }
  })
  // The total written on the paper is a free cross-check: a mismatch usually means a missed line
  const notes = [...(data.notes ?? [])]
  const sum = rows.reduce((t, r) => t + (Number(r.amount) || 0), 0)
  if (data.billTotal && Math.abs(sum - data.billTotal) > 1) {
    notes.unshift(`Bill pe total ₹${inr(data.billTotal)} likha hai, par scan ke items ka jod ₹${inr(sum)} hai. Koi item chhoot gaya ya galat padha ho sakta hai.`)
  }
  return { rows, notes, photo: dataUrl }
}
