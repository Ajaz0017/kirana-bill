import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bike, Check, CheckCheck, ChevronDown, ClipboardList, FilePlus2, LoaderCircle, MessageCircle, Phone, ReceiptText, RefreshCw, RotateCcw, Store, X,
} from 'lucide-react'
import { useBillStore } from '../../store/useBillStore'
import { showToast } from '../../store/useToast'
import ConfirmDialog from '../../components/ConfirmDialog'
import NotifySetting from '../../components/NotifySetting'
import { api } from '../../utils/api'
import { fmtQty, inr } from '../../utils/format'
import { shopLink } from '../../utils/shopRates'

const FILTERS = [
  { key: 'new', label: 'Naye' },
  { key: 'ready', label: 'Taiyaar' },
  { key: 'done', label: 'De diya' },
  { key: 'all', label: 'Sab' },
]
const STATUS = {
  new: { text: 'Naya', cls: 'bg-amber-100 text-amber-800' },
  ready: { text: 'Taiyaar', cls: 'bg-sky-100 text-sky-800' },
  done: { text: 'De diya', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { text: 'Cancel', cls: 'bg-zinc-100 text-zinc-500' },
}
const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'abhi'
  if (m < 60) return `${m} min pehle`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ghante pehle`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function OrderCard({ order, busy, onStatus, onBill, onOpenBill }) {
  const [open, setOpen] = useState(order.status === 'new')
  const c = order.customer
  const st = STATUS[order.status]
  const summary = order.items.map((i) => `${i.name} ${fmtQty(i.qty)} ${i.unit}`).join(', ')

  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold">{c.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.text}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
            {c.delivery ? <Bike className="size-3.5" /> : <Store className="size-3.5" />}
            {c.delivery ? 'Delivery' : 'Pickup'} · {ago(order.createdAt)} · #{order.code}
          </span>
          {!open && <span className="mt-1 block truncate text-xs text-zinc-500">{summary}</span>}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-extrabold tabular-nums">₹{inr(order.total)}</span>
          <span className="block text-xs text-zinc-500">{order.items.length} items</span>
        </span>
        <ChevronDown className={`mt-1 size-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-zinc-100 px-4 pt-3 pb-4">
              {(c.delivery || c.note) && (
                <div className="space-y-1 rounded-xl bg-zinc-50 px-3 py-2 text-sm">
                  {c.delivery && <p><b>Pata:</b> {c.address}</p>}
                  {c.note && <p><b>Note:</b> {c.note}</p>}
                </div>
              )}
              <ul className="divide-y divide-zinc-100 text-sm">
                {order.items.map((i, k) => (
                  <li key={k} className="flex items-baseline gap-2 py-1.5">
                    <span className="min-w-0 flex-1 font-medium">{i.name}</span>
                    <span className="text-xs whitespace-nowrap text-zinc-500">{fmtQty(i.qty)} {i.unit} × {inr(i.rate)}/{i.rateUnit}</span>
                    <span className="w-16 text-right font-semibold tabular-nums">₹{inr(i.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <a href={`tel:${c.mobile}`} className="btn-ghost flex-1 py-2.5"><Phone className="size-4" /> Call</a>
                <a href={`https://wa.me/91${c.mobile}`} target="_blank" rel="noopener" className="btn-ghost flex-1 py-2.5 text-[#1c9a4b]">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </div>
              {/* Bill only when the owner asks for it; one order, one bill */}
              {order.billId ? (
                <button type="button" onClick={() => onOpenBill(order)} className="btn w-full border border-emerald-200 bg-emerald-50 py-3 text-emerald-800">
                  <CheckCheck className="size-4" /> Bill ban gaya · dekhein
                </button>
              ) : (
                order.status !== 'cancelled' && (
                  <button type="button" onClick={() => onBill(order)} className="btn-primary w-full py-3">
                    <FilePlus2 className="size-4" /> Bill banayein
                  </button>
                )
              )}
              <div className="flex gap-2">
                {order.status === 'new' && (
                  <button type="button" disabled={busy} onClick={() => onStatus(order, 'ready')} className="btn-ghost flex-1 py-2.5">
                    <Check className="size-4" /> Taiyaar hai
                  </button>
                )}
                {(order.status === 'new' || order.status === 'ready') && (
                  <button type="button" disabled={busy} onClick={() => onStatus(order, 'done')} className="btn-ghost flex-1 py-2.5">
                    <CheckCheck className="size-4" /> De diya
                  </button>
                )}
                {order.status === 'new' || order.status === 'ready' ? (
                  <button type="button" disabled={busy} onClick={() => onStatus(order, 'cancelled')} aria-label="Order cancel karein" className="btn-ghost px-3 py-2.5 text-rose-600">
                    <X className="size-4" />
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => onStatus(order, 'new')} className="btn-ghost flex-1 py-2.5">
                    <RotateCcw className="size-4" /> Wapas naya
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

// Online orders from the public shop page. Bills are made only when the owner taps "Bill banayein".
export default function Orders() {
  const shopMeta = useBillStore((s) => s.shopMeta)
  const ordersOn = useBillStore((s) => s.shopInfo.ordersOn)
  const { loadOrder, setViewing, setTab, setShopTab } = useBillStore.getState()
  const [filter, setFilter] = useState('new')
  const [list, setList] = useState({ orders: [], hasMore: false, status: 'loading', error: '', newCount: 0 })
  const [busyCode, setBusyCode] = useState(null)
  const [confirm, setConfirm] = useState(null) // order waiting for "replace the current bill?"
  const seq = useRef(0)

  const apply = useCallback((data, offset) => {
    useBillStore.setState({ newOrders: data.newCount })
    setList((l) => ({ orders: offset ? [...l.orders, ...data.orders] : data.orders, hasMore: data.hasMore, status: 'idle', error: '', newCount: data.newCount }))
  }, [])

  // Buttons (refresh, "aur orders", after a status change)
  const load = useCallback(async (f, offset = 0, silent = false) => {
    const id = ++seq.current
    if (!silent) setList((l) => ({ ...l, status: offset ? 'more' : 'loading', error: '' }))
    try {
      const data = await api(`/api/shops?orders=${f}&offset=${offset}`)
      if (id === seq.current) apply(data, offset)
    } catch (e) {
      if (id === seq.current) setList((l) => ({ ...l, status: 'idle', error: e.message }))
    }
  }, [apply])

  // Load on open / filter change, then quietly refresh every minute while this page is open
  useEffect(() => {
    let live = true
    const run = () => {
      const id = ++seq.current
      api(`/api/shops?orders=${filter}&offset=0`)
        .then((data) => live && id === seq.current && apply(data, 0))
        .catch((e) => live && id === seq.current && setList((l) => ({ ...l, status: 'idle', error: e.message })))
    }
    run()
    const t = setInterval(() => document.visibilityState === 'visible' && run(), 60_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [filter, apply])

  const setStatus = async (order, status) => {
    setBusyCode(order.code)
    try {
      const { order: updated } = await api(`/api/shops?order=${order.code}`, { method: 'PATCH', body: { status } })
      setList((l) => ({
        ...l,
        orders: filter === 'all' || filter === updated.status ? l.orders.map((o) => (o.code === updated.code ? updated : o)) : l.orders.filter((o) => o.code !== updated.code),
      }))
      showToast({ ready: 'Taiyaar mark kiya', done: 'De diya mark kiya', cancelled: 'Order cancel kiya', new: 'Wapas naya' }[status])
      load(filter, 0, true)
    } catch (e) {
      showToast(e.message, true)
    } finally {
      setBusyCode(null)
    }
  }

  const startBill = (order) => {
    loadOrder(order)
    showToast(`Order #${order.code} ka bill: items check karke aage badhein`)
  }
  const askBill = (order) => {
    const s = useBillStore.getState()
    if (s.items.length && s.draftOrder !== order.code) setConfirm(order)
    else startBill(order)
  }
  const openBill = async (order) => {
    try {
      const { bill } = await api(`/api/bills?id=${encodeURIComponent(order.billId)}`)
      setTab('bills')
      setViewing(bill)
    } catch (e) {
      showToast(e.status === 404 ? 'Bill history mein nahi mila (delete ho gaya?)' : e.message, true)
    }
  }

  if (!shopMeta) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><ClipboardList className="size-7" /></span>
        <p className="font-bold">Pehle apni shop save karein</p>
        <p className="text-sm text-zinc-500">Meri Shop mein rate list banakar Public karein aur "Online order lena" chalu karein.</p>
        <button type="button" onClick={() => setShopTab('mine')} className="btn-primary">Meri Shop</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {shopMeta.isPublic && ordersOn && <NotifySetting />}
      {!(shopMeta.isPublic && ordersOn) && (
        <button type="button" onClick={() => setShopTab('mine')}
          className="flex w-full items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-sm font-medium text-amber-800">
          <span className="flex-1">Online order band hai. Meri Shop → "Dukaan, UPI, Public, Online order" mein Public + "Online order lena" chalu karke Save karein.</span>
        </button>
      )}
      {shopMeta.isPublic && (
        <button type="button" onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: 'Rate list', url: shopLink(shopMeta.slug) })
            else {
              await navigator.clipboard.writeText(shopLink(shopMeta.slug))
              showToast('Link copy ho gaya')
            }
          } catch {
            // share sheet closed
          }
        }} className="w-full truncate rounded-xl bg-white/70 px-3 py-2 text-left text-xs text-zinc-500">
          Customers ka link: <span className="font-semibold text-violet-700">{shopLink(shopMeta.slug)}</span>
        </button>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button key={f.key} type="button" aria-pressed={on} onClick={() => {
              if (on) return
              setList((l) => ({ ...l, orders: [], status: 'loading', error: '' }))
              setFilter(f.key)
            }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-violet-600 bg-violet-600 text-white' : 'border-zinc-200 bg-white text-zinc-600'}`}>
              {f.label}
              {f.key === 'new' && list.newCount > 0 && <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-white/25' : 'bg-amber-100 text-amber-800'}`}>{list.newCount}</span>}
            </button>
          )
        })}
        <button type="button" onClick={() => load(filter)} aria-label="Orders refresh karein" className="ml-auto grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500">
          <RefreshCw className={`size-4 ${list.status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {list.status === 'loading' && !list.orders.length ? (
        <ul className="space-y-2">{[0, 1, 2].map((i) => <li key={i} className="card h-20 animate-pulse" />)}</ul>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {list.orders.map((o) => (
              <OrderCard key={o.code} order={o} busy={busyCode === o.code} onStatus={setStatus} onBill={askBill} onOpenBill={openBill} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {list.error && (
        <div className="card space-y-3 p-5 text-center">
          <p className="text-sm font-medium text-rose-600">{list.error}</p>
          <button type="button" onClick={() => load(filter)} className="btn-ghost mx-auto"><RefreshCw className="size-4" /> Dobara try karein</button>
        </div>
      )}
      {list.status === 'idle' && !list.error && !list.orders.length && (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><ReceiptText className="size-7" /></span>
          <p className="font-bold">{filter === 'new' ? 'Koi naya order nahi' : 'Yahan koi order nahi'}</p>
          <p className="text-sm text-zinc-500">Customer rate list se order bhejenge to yahan dikhega. 90 din purane order apne aap hat jaate hain.</p>
        </div>
      )}
      {list.hasMore && (
        <button type="button" onClick={() => load(filter, list.orders.length)} disabled={list.status === 'more'} className="btn-ghost w-full py-3">
          {list.status === 'more' && <LoaderCircle className="size-4 animate-spin" />} Aur orders
        </button>
      )}

      <ConfirmDialog
        open={!!confirm}
        icon={FilePlus2}
        title="Abhi wala bill hat jayega"
        message={`Home pe ek adhoora bill (#${useBillStore.getState().details.invoiceNo}) bana hua hai. Agar woh preview tak pahuncha tha to history mein save hai.`}
        confirmLabel="Haan, order ka bill"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          startBill(confirm)
          setConfirm(null)
        }}
      />
    </div>
  )
}
