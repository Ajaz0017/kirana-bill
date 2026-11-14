import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Download, Search } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { COMMON_ITEMS } from '../constants'
import { nameKey } from '../utils/itemNames'
import { useBillStore } from '../store/useBillStore'

/**
 * Quick start for the rate list: tick names from the owner's own bills/scans (knownItems)
 * and the common catalog. They're added without a rate, to be filled in on the list.
 */
export default function ImportItemsSheet({ open, existing, onImport, onClose }) {
  const knownItems = useBillStore((s) => s.knownItems)
  const [picked, setPicked] = useState(() => new Set())
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const have = new Set(existing.map((i) => nameKey(i.name)))
    const seen = new Set()
    const fresh = (n) => {
      const k = nameKey(n)
      if (!k || have.has(k) || seen.has(k)) return false
      seen.add(k)
      return true
    }
    return [
      { title: 'Aapke bills aur scan se', names: knownItems.filter(fresh) },
      { title: 'Common kirana items', names: COMMON_ITEMS.filter(fresh) },
    ]
  }, [knownItems, existing])

  const q = query.trim().toLowerCase()
  const shown = groups.map((g) => ({ ...g, names: q ? g.names.filter((n) => n.toLowerCase().includes(q)) : g.names })).filter((g) => g.names.length)
  const toggle = (n) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  const allShown = shown.flatMap((g) => g.names)
  const allPicked = allShown.length > 0 && allShown.every((n) => picked.has(n))

  const done = () => {
    onImport([...picked])
    setPicked(new Set())
    setQuery('')
  }

  return (
    <BottomSheet
      open={open}
      title="Items import karein"
      onClose={onClose}
      footer={
        <motion.button whileTap={{ scale: 0.97 }} type="button" disabled={!picked.size} onClick={done} className="btn-primary w-full py-3.5 text-base">
          <Download className="size-5" /> {picked.size || ''} items jodein
        </motion.button>
      }
    >
      <div className="space-y-3 pb-2">
        <p className="text-sm text-zinc-500">Naam chunein, rate baad mein list mein bharein. Unit "kg" lagega, badal sakte hain.</p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
          <input type="search" className="field pl-10" placeholder="Dhoondhein" aria-label="Items dhoondhein" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {allShown.length > 0 && (
          <button type="button" className="text-sm font-semibold text-violet-700"
            onClick={() => setPicked((p) => {
              const next = new Set(p)
              allShown.forEach((n) => (allPicked ? next.delete(n) : next.add(n)))
              return next
            })}>
            {allPicked ? 'Sab hatayein' : `Sab chunein (${allShown.length})`}
          </button>
        )}
        {shown.map((g) => (
          <section key={g.title}>
            <p className="field-label">{g.title}</p>
            <div className="flex flex-wrap gap-2">
              {g.names.map((n) => {
                const on = picked.has(n)
                return (
                  <button key={n} type="button" aria-pressed={on} onClick={() => toggle(n)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? 'border-violet-600 bg-violet-600 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-violet-300'}`}>
                    {n}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        {!shown.length && <p className="py-6 text-center text-sm text-zinc-500">{q ? 'Kuch nahi mila' : 'Saare items pehle se list mein hain'}</p>}
      </div>
    </BottomSheet>
  )
}
