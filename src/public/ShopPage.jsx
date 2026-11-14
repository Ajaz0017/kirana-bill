import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowRight, Check, CheckCircle2, ClipboardList, ExternalLink, History, LoaderCircle, MapPin, MessageCircle, Minus, Phone, Plus, RefreshCw, Search, ShoppingBag,
  Store, Trash2, TriangleAlert, X,
} from 'lucide-react'
import BottomSheet from '../components/BottomSheet'
import Toast from '../components/Toast'
import { cleanDecimal, fmtQty, inr, round } from '../utils/format'
import { groupByCategory, slabSummary } from '../utils/shopRates'
import { convertQty, fmtSlabQty, slabAt, slabRate, unitFamily } from '../utils/units'
import { addOrder, readOrders, STATUS_TEXT, useStatuses } from './myOrders'
import { StatusChip } from './MyOrdersPage'

// ---- Phone storage (per shop): cart, last order, and the customer's own details
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked: the cart just won't survive a reload
  }
}

/** Price of one cart line from the current rate list (same rule the server uses) */
function priceLine(item, { qty, unit }) {
  const qtyIn = convertQty(Number(qty), unit, item.unit)
  if (!(qtyIn > 0)) return null
  const rate = slabRate(item, qtyIn)
  return { rate, amount: round(qtyIn * rate) }
}

// Quick qty choices: loose goods by weight/volume, everything else by count
// (small amounts in gm / ml, so the order reads "250 gm" rather than "0.25 kg")
const presetsFor = (unit) =>
  unit === 'kg' ? [[250, 'gm'], [500, 'gm'], [1, 'kg'], [2, 'kg'], [5, 'kg']]
    : unit === 'ltr' ? [[500, 'ml'], [1, 'ltr'], [2, 'ltr'], [5, 'ltr']]
      : unit === 'gm' ? [[100, 'gm'], [250, 'gm'], [500, 'gm']]
        : unit === 'ml' ? [[100, 'ml'], [250, 'ml'], [500, 'ml']]
          : [[1, unit], [2, unit], [5, unit], [10, unit]]
const presetLabel = (qty, unit) => (unit === 'gm' ? `${qty} g` : `${qty} ${unit}`)

// "How much?" for one item, with the live price (qty slabs apply)
function QtySheet({ item, line, open, onSave, onRemove, onClose }) {
  const [qty, setQty] = useState(line ? fmtQty(line.qty) : '')
  const [unit, setUnit] = useState(line?.unit ?? item?.unit ?? 'kg')
  if (!item) return null
  const family = unitFamily(item.unit)
  const price = priceLine(item, { qty, unit })
  const at = slabAt(item, convertQty(Number(qty), unit, item.unit))
  const step = (d) => setQty((q) => fmtQty(Math.max(0, round((Number(q) || 0) + d, 3))))
  const stepBy = unit === 'gm' || unit === 'ml' ? 50 : unit === 'kg' || unit === 'ltr' ? 0.5 : 1

  return (
    <BottomSheet
      open={open}
      title={item.name}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {line && (
            <button type="button" onClick={onRemove} aria-label="Cart se hatayein" className="btn-ghost px-4 py-3.5 text-rose-600">
              <Trash2 className="size-5" />
            </button>
          )}
          <motion.button whileTap={{ scale: 0.97 }} type="button" disabled={!price} onClick={() => onSave({ qty: Number(qty), unit })}
            className="btn-primary flex-1 py-3.5 text-base">
            <ShoppingBag className="size-5" /> {line ? 'Update karein' : 'Cart mein daalein'} {price && `· ₹${inr(price.amount)}`}
          </motion.button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-sm text-zinc-500">
          ₹{inr(item.rate)}/{item.unit}
          {item.slabs?.length > 1 && <span className="mt-0.5 block text-xs font-medium text-violet-700">{slabSummary(item)} (per {item.unit})</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {presetsFor(item.unit).map(([q, u]) => {
            const on = Number(qty) === q && unit === u
            return (
              <button key={`${q}${u}`} type="button" onClick={() => (setQty(String(q)), setUnit(u))}
                className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${on ? 'border-violet-600 bg-violet-600 text-white' : 'border-zinc-200 bg-white hover:border-violet-300'}`}>
                {presetLabel(q, u)}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-stepBy)} aria-label="Kam karein" className="btn-ghost size-12 shrink-0 p-0"><Minus className="size-5" /></button>
          <input className="field min-w-0 text-center text-lg font-bold" inputMode="decimal" placeholder="Kitna?" aria-label="Qty"
            value={qty} onChange={(e) => setQty(cleanDecimal(e.target.value))} />
          {family.length > 1 ? (
            <select className="field w-20 shrink-0 appearance-none text-center font-semibold" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {family.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : (
            <span className="w-12 shrink-0 text-center font-semibold text-zinc-500">{unit}</span>
          )}
          <button type="button" onClick={() => step(stepBy)} aria-label="Zyada karein" className="btn-ghost size-12 shrink-0 p-0"><Plus className="size-5" /></button>
        </div>
        {price ? (
          <p className="rounded-2xl bg-violet-50 px-4 py-3 text-sm">
            <span className="font-bold">₹{inr(price.amount)}</span>
            <span className="text-zinc-600"> · ₹{inr(price.rate)}/{item.unit} ke rate se</span>
            {at?.next && <span className="mt-0.5 block text-xs text-violet-700">{fmtSlabQty(at.next.min, item.unit)} ya zyada lene pe ₹{inr(at.next.rate)}/{item.unit}</span>}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Kitna chahiye, upar chunein ya likhein</p>
        )}
      </div>
    </BottomSheet>
  )
}

const MOBILE_RE = /^[6-9]\d{9}$/
const cleanMobile = (v) => v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')

// Cart review + customer details + "send on WhatsApp"
function CheckoutSheet({ open, shop, lines, total, onEdit, onRemove, onClose, onPlaced }) {
  const [form, setForm] = useState(() => ({
    ...read('kb_customer', { name: '', mobile: '', delivery: false, address: '' }),
    delivery: false, // Ghar pe delivery abhi band hai (neeche form mein commented); sirf "dukaan se lunga"
  }))
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('') // honeypot: people never see it
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => {
    setError('')
    setForm((f) => ({ ...f, ...patch }))
  }
  const errors = {
    name: !form.name.trim(),
    mobile: !MOBILE_RE.test(cleanMobile(form.mobile)),
    address: form.delivery && !form.address.trim(),
  }
  const belowMin = shop.minOrder > 0 && total < shop.minOrder

  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    if (Object.values(errors).some(Boolean) || belowMin || !lines.length) return
    // Opened right away (still inside the tap) so browsers don't block it as a popup
    const wa = window.open('', '_blank')
    setBusy(true)
    try {
      const res = await fetch('/api/public?order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: shop.slug,
          website,
          customer: { name: form.name.trim(), mobile: cleanMobile(form.mobile), delivery: form.delivery, address: form.address.trim(), note: note.trim() },
          items: lines.map((l) => ({ id: l.item.id, qty: l.qty, unit: l.unit })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Order nahi bheja ja saka, dobara try karein')
      write('kb_customer', { name: form.name.trim(), mobile: cleanMobile(form.mobile), delivery: form.delivery, address: form.address.trim() })
      const waUrl = `https://wa.me/${data.waNumber}?text=${encodeURIComponent(data.waText)}`
      if (wa) wa.location.href = waUrl
      onPlaced({ ...data, waUrl })
      setNote('')
    } catch (err) {
      wa?.close()
      setError(err.message === 'Failed to fetch' ? 'Internet check karke dobara try karein' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const fieldCls = (bad) => `field ${touched && bad ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15' : ''}`

  return (
    <BottomSheet
      open={open}
      title="Aapka order"
      onClose={onClose}
      footer={
        <button type="submit" form="checkout-form" disabled={busy || !lines.length} className="btn-whatsapp w-full py-3.5 text-base">
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : <MessageCircle className="size-5" />} WhatsApp pe order bhejein · ₹{inr(total)}
        </button>
      }
    >
      <form id="checkout-form" onSubmit={submit} noValidate className="space-y-4 pb-2">
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
          {lines.map((l) => (
            <li key={l.item.id} className="flex items-center gap-2 px-3 py-2.5">
              <button type="button" onClick={() => onEdit(l.item)} className="min-w-0 flex-1 text-left">
                <span className="block truncate font-semibold">{l.item.name}</span>
                <span className="block text-xs text-zinc-500">{fmtQty(l.qty)} {l.unit} × ₹{inr(l.rate)}/{l.item.unit}</span>
              </button>
              <span className="font-bold tabular-nums">₹{inr(l.amount)}</span>
              <button type="button" onClick={() => onRemove(l.item)} aria-label={`${l.item.name} hatayein`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600">
                <X className="size-4" />
              </button>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2.5 font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">₹{inr(total)}</span>
          </li>
        </ul>
        {belowMin && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
            <TriangleAlert className="size-4" /> Minimum order ₹{inr(shop.minOrder)} ka hai, ₹{inr(shop.minOrder - total)} ka aur jodiye
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="c-name">Aapka naam</label>
            <input id="c-name" className={fieldCls(errors.name)} autoComplete="name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} />
          </div>
          <div>
            <label className="field-label" htmlFor="c-mobile">Mobile</label>
            <input id="c-mobile" className={fieldCls(errors.mobile)} type="tel" inputMode="tel" autoComplete="tel" placeholder="10 ank ka number"
              value={form.mobile} onChange={(e) => set({ mobile: e.target.value })} maxLength={14} />
          </div>
          {/* Ghar pe delivery: abhi ke liye band (future mein dekhenge). Wapas chalu karne ke liye ye block
              uncomment karein aur upar useState mein `delivery: false` wali line hata dein.
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Saaman kaise lenge">
            {[
              { value: false, title: 'Dukaan se lunga', text: 'Khud aake le jayenge' },
              { value: true, title: 'Ghar pe delivery', text: 'Pata likhna hoga' },
            ].map(({ value, title, text }) => {
              const on = form.delivery === value
              return (
                <button key={title} type="button" role="radio" aria-checked={on} onClick={() => set({ delivery: value })}
                  className={`rounded-2xl border-2 p-3 text-left transition ${on ? 'border-violet-600 bg-violet-50' : 'border-zinc-200 bg-white'}`}>
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="block text-xs text-zinc-500">{text}</span>
                </button>
              )
            })}
          </div>
          {form.delivery && (
            <div>
              <label className="field-label" htmlFor="c-address">Pata</label>
              <textarea id="c-address" rows={2} className={`${fieldCls(errors.address)} resize-none`} autoComplete="street-address" placeholder="Ghar no., gali, mohalla"
                value={form.address} onChange={(e) => set({ address: e.target.value })} maxLength={300} />
            </div>
          )}
          */}
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Saaman dukaan se le jaana hoga (abhi ghar pe delivery nahi)</p>
          <div>
            <label className="field-label" htmlFor="c-note">Note (optional)</label>
            <input id="c-note" className="field" placeholder="Jaise: shaam 6 baje tak chahiye" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </div>
          {/* Honeypot: hidden from people, bots fill it in */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        </div>

        {touched && Object.values(errors).some(Boolean) && <p className="text-sm font-medium text-rose-600">Laal wale khane sahi se bharein</p>}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <p className="text-xs text-zinc-500">
          WhatsApp mein order ka message taiyaar milega, wahan <b>Send</b> zaroor dabayein. Rate dukaan pe badal sakte hain; final bill dukaan banayegi.
        </p>
      </form>
    </BottomSheet>
  )
}

function Placed({ placed, shop, onNew }) {
  const { statuses } = useStatuses([placed.code])
  const status = statuses[placed.code]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4 p-6 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-9" /></span>
      <div>
        <p className="text-xl font-extrabold">Order save ho gaya</p>
        <p className="mt-1 text-sm text-zinc-500">Order #{placed.code} · ₹{inr(placed.total)} · {shop.name}</p>
        <p className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <StatusChip status={status} /> {status && STATUS_TEXT[status].hint}
        </p>
      </div>
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        WhatsApp mein message bhejna zaroori hai, tabhi dukaan ko order milega. Agar WhatsApp nahi khula, neeche dabayein.
      </p>
      <a href={placed.waUrl} target="_blank" rel="noopener" className="btn-whatsapp w-full py-3.5 text-base">
        <MessageCircle className="size-5" /> WhatsApp pe bhejein
      </a>
      <div className="flex gap-2">
        <a href="/orders" className="btn-ghost flex-1 py-3"><ExternalLink className="size-4" /> Mere orders</a>
        <button type="button" onClick={onNew} className="btn-ghost flex-1 py-3"><ShoppingBag className="size-4" /> Naya order</button>
      </div>
    </motion.div>
  )
}

export default function ShopPage({ slug }) {
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [cart, setCartState] = useState(() => read(`kb_cart:${slug}`, {})) // itemId -> { qty, unit }
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [qtyFor, setQtyFor] = useState({ open: false, item: null, key: 0 })
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [placed, setPlaced] = useState(null)
  const [toast, setToast] = useState(null)
  const lastOrder = read(`kb_last:${slug}`, null)
  const myOrderCount = readOrders().filter((o) => o.slug === slug).length
  const clearToast = useCallback(() => setToast(null), [])

  const setCart = (fn) =>
    setCartState((c) => {
      const next = typeof fn === 'function' ? fn(c) : fn
      write(`kb_cart:${slug}`, next)
      return next
    })

  useEffect(() => {
    let live = true
    fetch(`/api/public?shop=${encodeURIComponent(slug)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw Object.assign(new Error(data.error || 'Shop nahi khul payi'), { status: r.status })
        return data
      })
      .then((d) => {
        if (!live) return
        document.title = `${d.shop.name} · Rate list`
        setState({ status: 'done', ...d })
        // Came from "Dobara order" on Mere orders: the cart was filled there
        if (new URLSearchParams(location.search).has('again')) {
          history.replaceState(null, '', location.pathname)
          setToast({ id: Date.now(), text: 'Pichhle order ke items cart mein, aaj ke rate se' })
        }
      })
      .catch((e) => live && setState({ status: 'error', error: e.message === 'Failed to fetch' ? 'Internet check karein' : e.message, notFound: e.status === 404 }))
    return () => {
      live = false
    }
  }, [slug, attempt])

  const items = useMemo(() => (state.status === 'done' ? state.items : []), [state])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  // Cart lines priced from today's rate list; items that left the list (or went out of stock) drop out
  const lines = Object.entries(cart)
    .map(([id, l]) => {
      const item = byId.get(id)
      const price = item?.inStock && priceLine(item, l)
      return price ? { item, qty: l.qty, unit: l.unit, ...price } : null
    })
    .filter(Boolean)
  const total = round(lines.reduce((s, l) => s + l.amount, 0))

  if (state.status === 'loading') {
    return (
      <div className="space-y-3">
        <div className="h-36 animate-pulse rounded-3xl bg-violet-200/60" />
        <div className="card h-12 animate-pulse" />
        <div className="card h-80 animate-pulse" />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="card mt-10 flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-zinc-100 text-zinc-500"><Store className="size-7" /></span>
        <p className="font-bold">{state.notFound ? 'Ye dukaan nahi mili' : 'Rate list khul nahi payi'}</p>
        <p className="text-sm text-zinc-500">{state.notFound ? 'Dukaan ne rate list band kar di hai ya link galat hai.' : state.error}</p>
        {!state.notFound && (
          <button type="button" onClick={() => (setState({ status: 'loading' }), setAttempt((a) => a + 1))} className="btn-ghost">
            <RefreshCw className="size-4" /> Dobara try karein
          </button>
        )}
      </div>
    )
  }

  const { shop } = state
  const canOrder = shop.ordersOn && !shop.closed
  const categories = [...new Set(items.map((i) => i.category?.trim()).filter(Boolean))].sort()
  const q = query.trim().toLowerCase()
  const groups = groupByCategory(items.filter((i) => (!category || i.category?.trim() === category) && (!q || i.name.toLowerCase().includes(q))))

  const openQty = (item) => setQtyFor((s) => ({ open: true, item, key: s.key + 1 }))
  const saveLine = (item, line) => {
    setCart((c) => ({ ...c, [item.id]: line }))
    setQtyFor((s) => ({ ...s, open: false }))
  }
  const removeLine = (item) => {
    setCart((c) => {
      const next = { ...c }
      delete next[item.id]
      return next
    })
    setQtyFor((s) => ({ ...s, open: false }))
  }
  const repeatLast = () => {
    const usable = Object.fromEntries(Object.entries(lastOrder).filter(([id]) => byId.get(id)?.inStock))
    setCart(usable)
    setToast({ id: Date.now(), text: `${Object.keys(usable).length} items cart mein, aaj ke rate se` })
  }
  const onPlaced = (data) => {
    write(`kb_last:${slug}`, cart)
    addOrder({
      code: data.code,
      slug,
      shopName: shop.name,
      total: data.total,
      itemCount: lines.length,
      createdAt: new Date().toISOString(),
      cart,
      waUrl: data.waUrl,
    })
    setCart({})
    setCheckoutOpen(false)
    setPlaced(data)
    window.scrollTo(0, 0)
  }

  return (
    <div className="space-y-4">
      {/* Shop */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-linear-to-br from-violet-600 to-indigo-600 p-5 text-white shadow-lg shadow-violet-600/25">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">Rate list</p>
        <h1 className="mt-1 text-2xl leading-tight font-extrabold">{shop.name}</h1>
        {(shop.address || shop.city) && (
          <p className="mt-1.5 flex gap-1.5 text-sm text-white/85"><MapPin className="mt-0.5 size-4 shrink-0" /> {[shop.address, shop.city].filter(Boolean).join(', ')}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${canOrder ? 'bg-emerald-400/25 text-white' : 'bg-white/15 text-white/85'}`}>
            {shop.closed ? 'Dukaan abhi band hai' : shop.ordersOn ? '● Online order chalu' : 'Sirf rate list'}
          </span>
          {shop.mobile && (
            <a href={`tel:${shop.mobile}`} className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold"><Phone className="size-3.5" /> {shop.mobile}</a>
          )}
          {myOrderCount > 0 && (
            <a href="/orders" className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-violet-700">
              <ClipboardList className="size-3.5" /> Mere orders ({myOrderCount})
            </a>
          )}
        </div>
      </motion.div>

      {placed ? (
        <Placed placed={placed} shop={shop} onNew={() => setPlaced(null)} />
      ) : (
        <>
          {canOrder && (
            <p className="px-1 text-sm text-zinc-600">
              Item ke <b className="text-violet-700">+</b> pe tap karke order banayein. Order WhatsApp pe dukaan ko jayega.
              {shop.minOrder > 0 && <> Minimum order ₹{inr(shop.minOrder)}.</>}
            </p>
          )}
          {canOrder && lastOrder && !lines.length && Object.keys(lastOrder).some((id) => byId.get(id)?.inStock) && (
            <button type="button" onClick={repeatLast} className="card flex w-full items-center gap-3 p-3 text-left">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-600"><History className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Pichhla order dobara</span>
                <span className="block text-xs text-zinc-500">Wahi items, aaj ke rate se</span>
              </span>
              <ArrowRight className="size-4 text-zinc-400" />
            </button>
          )}

          <div className="sticky top-0 z-20 -mx-4 space-y-2 bg-zinc-50/85 px-4 py-2 backdrop-blur-md">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
              <input type="search" className="field pr-10 pl-10" placeholder={`${items.length} items mein dhoondhein`} aria-label="Items dhoondhein"
                value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Search saaf karein"
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 hover:text-zinc-700">
                  <X className="size-4" />
                </button>
              )}
            </div>
            {categories.length > 0 && (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {['', ...categories].map((c) => {
                  const on = category === c
                  return (
                    <button key={c || '_all'} type="button" aria-pressed={on} onClick={() => setCategory(c)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${on ? 'border-violet-600 bg-violet-600 text-white' : 'border-zinc-200 bg-white text-zinc-600'}`}>
                      {c || 'Sab'}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card p-4">
            {groups.map(({ category: cat, items: list }) => (
              <div key={cat || '_'}>
                {(groups.length > 1 || cat) && !category && <p className="field-label mt-2 mb-0">{cat || 'Baaki items'}</p>}
                <ul className="divide-y divide-zinc-100">
                  {list.map((item) => {
                    const out = !item.inStock
                    const inCart = lines.find((l) => l.item.id === item.id)
                    return (
                      <li key={item.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold ${out ? 'text-zinc-400 line-through' : ''}`}>{item.name}</p>
                          {item.slabs?.length > 1 && <p className="text-xs font-medium text-violet-700">{slabSummary(item)}</p>}
                          {out && <p className="text-xs font-semibold text-amber-700">Stock mein nahi</p>}
                        </div>
                        <p className={`shrink-0 text-right font-extrabold tabular-nums ${out ? 'text-zinc-400' : ''}`}>
                          ₹{inr(item.rate)}<span className="text-xs font-semibold text-zinc-500">/{item.unit}</span>
                        </p>
                        {canOrder &&
                          (inCart ? (
                            <button type="button" onClick={() => openQty(item)} aria-label={`${item.name}: ${fmtQty(inCart.qty)} ${inCart.unit}, badlein`}
                              className="shrink-0 rounded-xl bg-violet-600 px-2.5 py-1.5 text-center text-white">
                              <span className="flex items-center gap-1 text-xs font-bold"><Check className="size-3.5" />{fmtQty(inCart.qty)} {inCart.unit}</span>
                              <span className="block text-[11px] text-white/80">₹{inr(inCart.amount)}</span>
                            </button>
                          ) : (
                            <button type="button" disabled={out} onClick={() => openQty(item)} aria-label={`${item.name} cart mein daalein`}
                              className="grid size-10 shrink-0 place-items-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 transition hover:bg-violet-100 disabled:opacity-30">
                              <Plus className="size-5" />
                            </button>
                          ))}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {!items.length && <p className="py-6 text-center text-sm text-zinc-500">Is dukaan ne abhi rate list mein items nahi daale</p>}
            {items.length > 0 && !groups.length && <p className="py-6 text-center text-sm text-zinc-500">Kuch nahi mila</p>}
          </div>
          {!canOrder && (
            <p className="px-1 text-center text-xs text-zinc-500">
              {shop.closed ? 'Dukaan abhi band hai, isliye online order nahi.' : 'Ye dukaan abhi online order nahi le rahi.'} Order ke liye dukaan pe call karein.
            </p>
          )}
          <p className="text-center text-xs text-zinc-400">Rate dukaan pe badal sakte hain · Kirana Bill</p>
        </>
      )}

      {/* Cart bar */}
      {canOrder && !placed && lines.length > 0 && (
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setCheckoutOpen(true)}
            className="mx-auto flex w-full max-w-lg items-center gap-3 rounded-2xl bg-linear-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-left text-white shadow-xl shadow-violet-600/30">
            <ShoppingBag className="size-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-white/80">{lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
              <span className="block text-lg leading-tight font-extrabold tabular-nums">₹{inr(total)}</span>
            </span>
            <span className="flex items-center gap-1 font-bold">Order karein <ArrowRight className="size-4" /></span>
          </button>
        </motion.div>
      )}

      <QtySheet key={qtyFor.key} open={qtyFor.open} item={qtyFor.item} line={qtyFor.item ? cart[qtyFor.item.id] : null}
        onSave={(line) => saveLine(qtyFor.item, line)} onRemove={() => removeLine(qtyFor.item)} onClose={() => setQtyFor((s) => ({ ...s, open: false }))} />
      <CheckoutSheet open={checkoutOpen} shop={shop} lines={lines} total={total} onEdit={(item) => openQty(item)} onRemove={(item) => removeLine(item)}
        onClose={() => setCheckoutOpen(false)} onPlaced={onPlaced} />
      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}
