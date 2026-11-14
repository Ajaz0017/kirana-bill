import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Globe, LineChart, Link2, Lock, MapPin, Pencil, Phone, RefreshCw, Search, Store } from 'lucide-react'
import { useBillStore } from '../../store/useBillStore'
import { showToast } from '../../store/useToast'
import RateGraphSheet from '../../components/RateGraphSheet'
import RateListShare from '../../components/RateListShare'
import { api } from '../../utils/api'
import { inr } from '../../utils/format'
import { agoText, groupByCategory, shopLink, slabSummary } from '../../utils/shopRates'

// A shop opened from the public list or a shared link: read-only rate list (edit only from "Meri Shop")
export default function ShopView({ slug }) {
  const { closeShop, setShopTab } = useBillStore.getState()
  const [state, setState] = useState({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [graph, setGraph] = useState({ open: false, item: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    api(`/api/shops?slug=${encodeURIComponent(slug)}`)
      .then((d) => live && setState({ status: 'done', ...d }))
      .catch((e) => live && setState({ status: 'error', error: e.message, notFound: e.status === 404 }))
    return () => {
      live = false
    }
  }, [slug, attempt])

  const back = (
    <button type="button" onClick={closeShop} aria-label="Wapas" className="btn-ghost size-10 shrink-0 p-0">
      <ArrowLeft className="size-4" />
    </button>
  )

  if (state.status === 'loading') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">{back}<div className="h-6 w-40 animate-pulse rounded-lg bg-zinc-200" /></div>
        <div className="card h-28 animate-pulse" />
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">{back}<h2 className="text-lg font-bold">Shop</h2></div>
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-zinc-100 text-zinc-500"><Lock className="size-7" /></span>
          <p className="font-bold">{state.notFound ? 'Ye shop nahi mili' : 'Shop khul nahi payi'}</p>
          <p className="text-sm text-zinc-500">{state.notFound ? 'Shop private ho gayi hai ya link galat hai.' : state.error}</p>
          {!state.notFound && (
            <button type="button" onClick={() => {
              setState({ status: 'loading' })
              setAttempt((a) => a + 1)
            }} className="btn-ghost"><RefreshCw className="size-4" /> Dobara try karein</button>
          )}
        </div>
      </div>
    )
  }

  const { shop, items } = state
  const q = query.trim().toLowerCase()
  const groups = groupByCategory(q ? items.filter((i) => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)) : items)
  const lastChange = items.reduce((m, i) => (i.changedDay != null && i.changedDay > m ? i.changedDay : m), -Infinity)

  const shareLink = async () => {
    const url = shopLink(shop.slug)
    try {
      if (navigator.share) await navigator.share({ title: shop.name, text: `${shop.name} ki rate list`, url })
      else {
        await navigator.clipboard.writeText(url)
        showToast('Link copy ho gaya')
      }
    } catch {
      // share sheet closed
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {back}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{shop.name}</h2>
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            {shop.isPublic ? <><Globe className="size-3.5" /> Public</> : <><Lock className="size-3.5" /> Private, sirf aapko dikhti hai</>}
            {Number.isFinite(lastChange) && ` · rate ${agoText(lastChange)} update`}
          </p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Store className="size-6" /></span>
          <div className="min-w-0 flex-1 text-sm">
            {(shop.address || shop.city) && (
              <p className="flex gap-1.5 text-zinc-600"><MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" /> {[shop.address, shop.city].filter(Boolean).join(', ')}</p>
            )}
            {shop.mobile && (
              <a href={`tel:${shop.mobile}`} className="mt-1 flex items-center gap-1.5 font-semibold text-violet-700"><Phone className="size-4" /> {shop.mobile}</a>
            )}
            <p className="mt-1 text-zinc-500">{items.length} items</p>
          </div>
        </div>
        <div className="flex gap-2">
          {shop.isPublic && (
            <button type="button" onClick={shareLink} className="btn-ghost flex-1 py-2.5"><Link2 className="size-4" /> Link share</button>
          )}
          {shop.isOwner && (
            <button type="button" onClick={() => setShopTab('mine')} className="btn-primary flex-1 py-2.5"><Pencil className="size-4" /> Edit karein</button>
          )}
        </div>
      </motion.div>

      <div className="card space-y-3 p-4">
        {items.length > 8 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
            <input type="search" className="field pl-10" placeholder="Item dhoondhein" aria-label="Items dhoondhein" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
        {groups.map(({ category, items: list }) => (
          <div key={category || '_'}>
            {(groups.length > 1 || category) && <p className="field-label mt-1 mb-0">{category || 'Baaki items'}</p>}
            <ul className="divide-y divide-zinc-100">
              {list.map((item) => {
                const out = !item.inStock
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => setGraph({ open: true, item })} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={`truncate font-semibold ${out ? 'text-zinc-400 line-through' : ''}`}>{item.name}</span>
                          <LineChart className="size-3.5 shrink-0 text-violet-400" aria-hidden />
                        </span>
                        {item.slabs?.length > 1 && (
                          <span className="mt-0.5 block text-xs font-medium text-violet-700">{slabSummary(item)}</span>
                        )}
                        <span className="block truncate text-xs text-zinc-500">
                          {out ? <span className="font-semibold text-amber-700">Stock mein nahi</span> : `rate ${agoText(item.changedDay)} badla`}
                        </span>
                      </span>
                      <span className={`shrink-0 text-right font-extrabold tabular-nums ${out ? 'text-zinc-400' : ''}`}>
                        ₹{inr(item.rate)}<span className="text-xs font-semibold text-zinc-500">/{item.unit}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {!items.length && <p className="py-4 text-center text-sm text-zinc-500">Is shop mein abhi koi item nahi</p>}
        {items.length > 0 && !groups.length && <p className="py-3 text-center text-sm text-zinc-500">Kuch nahi mila</p>}
      </div>

      {items.length > 0 && (
        <div className="card space-y-2 p-4">
          <p className="text-sm font-bold">Rate list download</p>
          <RateListShare shop={shop} items={items} />
        </div>
      )}

      <RateGraphSheet open={graph.open} item={graph.item} onClose={() => setGraph((g) => ({ ...g, open: false }))} />
    </div>
  )
}
