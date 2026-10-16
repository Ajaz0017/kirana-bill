import { CATALOG } from '../data/catalog.js'

/**
 * Loose "sounds the same" key for Hinglish spellings:
 * Aata/Atta -> "ata", Cheeni/Chini -> "chini", Aalu/Aloo -> "alu", Chawal/Chaval -> "chaval".
 */
export function nameKey(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFC')
    .replace(/़/g, '') // Devanagari nukta: ड़ == ड for matching
    .replace(/[^a-zऀ-ॿ]/g, '')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/ph/g, 'f')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/(.)\1+/g, '$1') // aa->a, tt->t, ll->l
}

// Same words in any order: "Arhar Daal" == "Daal Arhar"
const sortedKey = (s) => String(s).trim().split(/\s+/).map(nameKey).filter(Boolean).sort().join('')

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/**
 * Builds a matcher over the catalog + this shop's own item names.
 * `fixes` are the shop owner's past corrections (scanned key -> chosen name); they always win.
 */
export function createNameMatcher({ known = [], fixes = {} } = {}) {
  const exact = new Map() // key -> canonical name
  const sorted = new Map() // word-order-free key -> canonical name
  const add = (alias, canonical) => {
    const k = nameKey(alias)
    if (k && !exact.has(k)) exact.set(k, canonical)
    const sk = sortedKey(alias)
    if (sk && !sorted.has(sk)) sorted.set(sk, canonical)
  }
  // Shop's own names first: if they write "Arhar Dal", keep that rather than the catalog's spelling
  known.forEach((n) => add(n, n))
  CATALOG.forEach(([name, ...aliases]) => [name, ...aliases].forEach((a) => add(a, name)))
  const entries = [...exact.entries()]

  return function match(raw) {
    const name = String(raw ?? '').trim()
    const key = nameKey(name)
    if (!key) return { name, changed: false }
    if (fixes[key]) return { name: fixes[key], changed: fixes[key] !== name }
    if (exact.has(key)) return { name: exact.get(key), changed: exact.get(key) !== name }
    const sk = sortedKey(name)
    if (sorted.has(sk)) return { name: sorted.get(sk), changed: sorted.get(sk) !== name }

    // Typos: allow 1 edit for short names, 2 for longer; only accept a single clear winner
    if (key.length < 4) return { name, changed: false }
    const limit = key.length <= 5 ? 1 : 2
    let best = null
    let bestD = limit + 1
    let tie = false
    for (const [k, canonical] of entries) {
      const d = distance(key, k)
      if (d < bestD) [best, bestD, tie] = [canonical, d, false]
      else if (d === bestD && canonical !== best) tie = true
    }
    return best && !tie ? { name: best, changed: best !== name } : { name, changed: false }
  }
}
