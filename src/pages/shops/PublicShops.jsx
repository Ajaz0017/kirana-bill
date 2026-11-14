import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, LoaderCircle, MapPin, RefreshCw, Search, Store, X } from 'lucide-react'
import { useBillStore } from '../../store/useBillStore'
import { api } from '../../utils/api'

const agoFromDate = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso)) / 86_400_000)
  return days <= 0 ? 'aaj' : days === 1 ? 'kal' : days < 30 ? `${days} din pehle` : `${Math.floor(days / 30)} mahine pehle`
}

// All public shops, recently updated first, searchable by name or city
export default function PublicShops() {
  const openShop = useBillStore((s) => s.openShop)
  const [query, setQuery] = useState('')
  const [list, setList] = useState({ shops: [], hasMore: false, status: 'loading', error: '' })
  const seq = useRef(0)

  const load = useCallback(async (q, offset = 0) => {
    const id = ++seq.current
    setList((l) => ({ ...l, status: offset ? 'more' : 'loading', error: '' }))
    try {
      const params = new URLSearchParams({ offset: String(offset) })
      if (q.trim()) params.set('q', q.trim())
      const data = await api(`/api/shops?${params}`)
      if (id !== seq.current) return
      setList((l) => ({ shops: offset ? [...l.shops, ...data.shops] : data.shops, hasMore: data.hasMore, status: 'idle', error: '' }))
    } catch (e) {
      if (id === seq.current) setList((l) => ({ ...l, status: 'idle', error: e.message }))
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(query), query ? 300 : 0)
    return () => clearTimeout(t)
  }, [query, load])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Shop ka naam ya shehar"
          aria-label="Shops dhoondhein" className="field pr-10 pl-10" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Search saaf karein"
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 hover:text-zinc-700">
            <X className="size-4" />
          </button>
        )}
      </div>

      {list.status === 'loading' && !list.shops.length ? (
        <ul className="space-y-2" aria-label="Load ho raha hai">
          {[0, 1, 2].map((i) => <li key={i} className="card h-18 animate-pulse" />)}
        </ul>
      ) : (
        <ul className="space-y-2">
          {list.shops.map((s, i) => (
            <motion.li key={s.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
              <button type="button" onClick={() => openShop(s.slug)} className="card flex w-full items-center gap-3 p-3 text-left">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                  <Store className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-bold">{s.name}</span>
                    {s.mine && <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">Aapki</span>}
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-zinc-500">
                    {s.city && <><MapPin className="size-3 shrink-0" /> {s.city} · </>}
                    {s.itemCount} items · {agoFromDate(s.updatedAt)} update
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-zinc-400" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      {list.error && (
        <div className="card space-y-3 p-5 text-center">
          <p className="text-sm font-medium text-rose-600">{list.error}</p>
          <button type="button" onClick={() => load(query)} className="btn-ghost mx-auto">
            <RefreshCw className="size-4" /> Dobara try karein
          </button>
        </div>
      )}

      {list.status === 'idle' && !list.error && !list.shops.length && (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><Store className="size-7" /></span>
          <div>
            <p className="font-bold">{query ? 'Koi shop nahi mili' : 'Abhi koi public shop nahi'}</p>
            <p className="mt-1 text-sm text-zinc-500">{query ? 'Doosra naam ya shehar try karein' : 'Apni shop Public karke sabse pehle dikhiye'}</p>
          </div>
        </div>
      )}

      {list.hasMore && (
        <button type="button" onClick={() => load(query, list.shops.length)} disabled={list.status === 'more'} className="btn-ghost w-full py-3">
          {list.status === 'more' && <LoaderCircle className="size-4 animate-spin" />} Aur shops dikhayein
        </button>
      )}
    </div>
  )
}
