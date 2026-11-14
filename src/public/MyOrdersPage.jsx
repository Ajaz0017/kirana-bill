import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, MessageCircle, PackageSearch, RefreshCw, RotateCcw, Smartphone, Store, Trash2 } from 'lucide-react'
import { inr } from '../utils/format'
import { STATUS_TEXT, readOrders, removeOrder, useStatuses } from './myOrders'

const fmtWhen = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Live status chip for one order (statuses: code -> { status } from the server; undefined = still loading) */
export function StatusChip({ status }) {
  if (!status) return <span className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
  const st = STATUS_TEXT[status]
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${st.cls}`}>{st.text}</span>
}

// /orders: every order placed from this phone, newest first, with the shop's latest status
export default function MyOrdersPage() {
  const [orders, setOrders] = useState(readOrders)
  const { statuses, error } = useStatuses(orders.map((o) => o.code))

  const forget = (code) => {
    removeOrder(code)
    setOrders(readOrders())
  }
  // Same items into that shop's cart (today's rates; out-of-stock items drop out there)
  const orderAgain = (o) => {
    try {
      localStorage.setItem(`kb_cart:${o.slug}`, JSON.stringify(o.cart ?? {}))
    } catch {
      // storage blocked: the shop page opens with an empty cart
    }
    window.location.assign(`/s/${encodeURIComponent(o.slug)}?again=1`)
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-extrabold">Mere orders</h1>
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Smartphone className="size-3.5" /> Sirf is phone se kiye orders · pichhle 90 din
        </p>
      </div>

      {error && (
        <p className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
          Status abhi nahi dikh raha: {error}
          <button type="button" onClick={() => location.reload()} aria-label="Dobara try karein"><RefreshCw className="size-4" /></button>
        </p>
      )}

      {orders.length ? (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {orders.map((o) => {
              const status = statuses[o.code]
              const st = status && STATUS_TEXT[status]
              return (
                <motion.li key={o.code} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} className="card space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600"><Store className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold">{o.shopName}</p>
                        <StatusChip status={status} />
                      </div>
                      <p className="text-xs text-zinc-500">{fmtWhen(o.createdAt)} · {o.itemCount} items · #{o.code}</p>
                      {st && <p className="text-xs text-zinc-500">{st.hint}</p>}
                    </div>
                    <p className="shrink-0 font-extrabold tabular-nums">₹{inr(o.total)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status !== 'gone' && (
                      <a href={`/o/${o.code}`} className="btn-ghost flex-1 py-2.5"><ExternalLink className="size-4" /> Dekhein</a>
                    )}
                    <button type="button" onClick={() => orderAgain(o)} className="btn-ghost flex-1 py-2.5"><RotateCcw className="size-4" /> Dobara order</button>
                    {status === 'new' && o.waUrl && (
                      <a href={o.waUrl} target="_blank" rel="noopener" className="btn-ghost flex-1 py-2.5 text-[#1c9a4b]"><MessageCircle className="size-4" /> WhatsApp</a>
                    )}
                    <button type="button" onClick={() => forget(o.code)} aria-label={`Order #${o.code} list se hatayein`} className="btn-ghost px-3 py-2.5 text-zinc-400">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><PackageSearch className="size-7" /></span>
          <p className="font-bold">Is phone se abhi koi order nahi</p>
          <p className="text-sm text-zinc-500">Dukaan ki rate list (QR / link) se order karenge to yahan dikhega.</p>
        </div>
      )}
      <p className="text-center text-xs text-zinc-400">
        Phone badalne ya browser ka data saaf karne pe ye list nahi rahegi. Status dukaan badalti hai, har minute taaza.
      </p>
    </div>
  )
}
