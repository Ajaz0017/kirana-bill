import { todayISO } from './format'

const APP = 'kirana-bill'
const VERSION = 1

/** Everything worth keeping if the phone is lost or the browser data is cleared */
export function makeBackupFile(state) {
  const payload = {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      shopInfo: state.shopInfo,
      lastInvoiceNo: state.lastInvoiceNo,
      knownItems: state.knownItems,
      nameFixes: state.nameFixes,
      draft: state.items.length ? { items: state.items, details: state.details } : null,
    },
  }
  const name = `${APP}-backup-${todayISO()}.json`
  return new File([JSON.stringify(payload, null, 2)], name, { type: 'application/json' })
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

/** Parses and sanity-checks a backup file; throws a user-facing message if it isn't one of ours */
export async function readBackupFile(file) {
  let payload
  try {
    payload = JSON.parse(await file.text())
  } catch {
    throw new Error('Yeh backup file nahi hai (JSON padha nahi gaya)')
  }
  if (payload?.app !== APP || !isObj(payload.data)) throw new Error('Yeh Kirana Bill ki backup file nahi hai')
  if (payload.version > VERSION) throw new Error('Yeh backup app ke naye version ka hai, pehle app update karein')

  const d = payload.data
  return {
    exportedAt: payload.exportedAt,
    data: {
      shopInfo: isObj(d.shopInfo) ? d.shopInfo : {},
      lastInvoiceNo: Number.isFinite(d.lastInvoiceNo) ? d.lastInvoiceNo : undefined,
      knownItems: Array.isArray(d.knownItems) ? d.knownItems.filter((n) => typeof n === 'string') : [],
      nameFixes: isObj(d.nameFixes) ? d.nameFixes : {},
      draft: isObj(d.draft) && Array.isArray(d.draft.items) && isObj(d.draft.details) ? d.draft : null,
    },
  }
}
