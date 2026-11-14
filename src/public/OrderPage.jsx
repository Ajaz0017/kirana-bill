import { useEffect, useRef, useState } from 'react'
import { FileDown, ImageDown, LoaderCircle, MapPin, Phone, RefreshCw, Store } from 'lucide-react'
import FileReadySheet from '../components/FileReadySheet'
import { billToPdf, nodeToImage } from '../utils/pdf'
import { fmtQty, inr } from '../utils/format'

const STATUS_TEXT = { new: 'Naya', ready: 'Taiyaar', done: 'De diya', cancelled: 'Cancel' }
const fmtWhen = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

// One order, opened from the link in the WhatsApp message (the random code is the key)
export default function OrderPage({ code }) {
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [making, setMaking] = useState(null) // 'pdf' | 'image'
  const [result, setResult] = useState(null)
  const paperRef = useRef(null)

  useEffect(() => {
    let live = true
    fetch(`/api/public?order=${encodeURIComponent(code)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw Object.assign(new Error(data.error || 'Order nahi khul paya'), { status: r.status })
        return data
      })
      .then((d) => {
        if (!live) return
        document.title = `Order #${d.order.code} · ${d.shop.name}`
        setState({ status: 'done', ...d })
      })
      .catch((e) => live && setState({ status: 'error', error: e.message === 'Failed to fetch' ? 'Internet check karein' : e.message, notFound: e.status === 404 }))
    return () => {
      live = false
    }
  }, [code, attempt])

  const make = async (kind) => {
    setMaking(kind)
    try {
      await document.fonts?.ready
      const name = `Order-${code}`
      setResult({ file: kind === 'pdf' ? await billToPdf(paperRef.current, `${name}.pdf`) : await nodeToImage(paperRef.current, `${name}.jpg`) })
    } catch (e) {
      console.error(e)
      setResult({ error: 'File nahi ban payi, dobara try karein' })
    } finally {
      setMaking(null)
    }
  }

  if (state.status === 'loading') return <div className="card h-96 animate-pulse" />
  if (state.status === 'error') {
    return (
      <div className="card mt-10 flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-zinc-100 text-zinc-500"><Store className="size-7" /></span>
        <p className="font-bold">{state.notFound ? 'Ye order nahi mila' : 'Order khul nahi paya'}</p>
        <p className="text-sm text-zinc-500">{state.notFound ? 'Link galat hai, ya order 90 din se purana ho gaya.' : state.error}</p>
        {!state.notFound && (
          <button type="button" onClick={() => (setState({ status: 'loading' }), setAttempt((a) => a + 1))} className="btn-ghost">
            <RefreshCw className="size-4" /> Dobara try karein
          </button>
        )}
      </div>
    )
  }

  const { order, shop } = state
  const c = order.customer

  return (
    <div className="space-y-4">
      {/* The card itself is what goes into the PDF / picture */}
      <div ref={paperRef} className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_-12px_rgb(76_29_149/0.25)]">
        <div className="bg-linear-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white">
          <p className="text-xs font-semibold text-white/75"><span className="tracking-[0.2em] uppercase">Order</span> #{order.code}</p>
          <p className="text-xl font-extrabold">{shop.name}</p>
          <p className="text-xs text-white/80">{fmtWhen(order.createdAt)} · {STATUS_TEXT[order.status]}</p>
        </div>
        <div className="space-y-1 border-b border-zinc-100 px-5 py-4 text-sm">
          <p className="font-bold">{c.name}</p>
          <p className="flex items-center gap-1.5 text-zinc-600"><Phone className="size-3.5" /> {c.mobile}</p>
          <p className="flex gap-1.5 text-zinc-600">
            <MapPin className="mt-0.5 size-3.5 shrink-0" /> {c.delivery ? `Ghar pe delivery: ${c.address}` : 'Dukaan se le jayenge'}
          </p>
          {c.note && <p className="text-zinc-600">Note: {c.note}</p>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="px-5 py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty × Rate</th>
              <th className="px-5 py-2 text-right font-semibold">₹</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, k) => (
              <tr key={k} className="border-t border-zinc-100">
                <td className="px-5 py-2 font-medium">{i.name}</td>
                <td className="py-2 text-right whitespace-nowrap text-zinc-600">{fmtQty(i.qty)} {i.unit} × {inr(i.rate)}/{i.rateUnit}</td>
                <td className="px-5 py-2 text-right font-semibold tabular-nums">{inr(i.amount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-200">
              <td colSpan={2} className="px-5 py-3 font-extrabold">Total</td>
              <td className="px-5 py-3 text-right text-base font-extrabold tabular-nums">₹{inr(order.total)}</td>
            </tr>
          </tbody>
        </table>
        <p className="px-5 pb-4 text-xs text-zinc-400">Online order · final bill dukaan banayegi · Kirana Bill</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!!making} onClick={() => make('pdf')} className="btn-ghost py-3">
          {making === 'pdf' ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF
        </button>
        <button type="button" disabled={!!making} onClick={() => make('image')} className="btn-ghost py-3">
          {making === 'image' ? <LoaderCircle className="size-4 animate-spin" /> : <ImageDown className="size-4" />} Image
        </button>
      </div>
      <a href={`/s/${encodeURIComponent(shop.slug)}`} className="btn-ghost w-full py-3"><Store className="size-4" /> {shop.name} ki rate list</a>

      <FileReadySheet state={result} title="Taiyaar hai" message={`${shop.name}: Order #${order.code}`} onClose={() => setResult(null)} />
    </div>
  )
}
