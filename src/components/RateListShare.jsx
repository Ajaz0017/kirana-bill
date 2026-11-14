import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { FileDown, ImageDown, LoaderCircle, QrCode } from 'lucide-react'
import FileReadySheet from './FileReadySheet'
import { billToPdf, nodeToImage } from '../utils/pdf'
import { inr, todayISO, fmtDateLong } from '../utils/format'
import { groupByCategory, shopLink, slabSummary } from '../utils/shopRates'

const W = 794 // A4 width at 96dpi, same as the bill

const safeName = (s) => (s || 'Shop').trim().replace(/[^\wऀ-ॿ]+/g, '-').replace(/^-|-$/g, '')

// The printable rate list: in-stock items grouped by category, two columns on paper
function RateListPaper({ shop, items }) {
  const inStock = items.filter((i) => i.inStock !== false && Number(i.rate) > 0)
  const outCount = items.length - inStock.length
  const groups = groupByCategory(inStock)
  const link = shop.isPublic && shop.slug ? shopLink(shop.slug) : null
  return (
    <div style={{ width: W }} className="bg-white font-sans text-zinc-900">
      <div className="bg-linear-to-r from-violet-700 to-indigo-700 px-12 pt-10 pb-8 text-white">
        <p className="text-sm font-semibold tracking-[0.2em] uppercase opacity-80">Rate list</p>
        <h1 className="mt-1 text-4xl font-extrabold">{shop.name || 'Meri Shop'}</h1>
        <p className="mt-2 text-base opacity-90">{[shop.address, shop.city, shop.mobile && `📞 ${shop.mobile}`].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex items-center justify-between border-b border-zinc-200 px-12 py-4 text-sm text-zinc-500">
        <span>{fmtDateLong(todayISO())} ke rate</span>
        <span>{inStock.length} items</span>
      </div>
      <div className="columns-2 gap-10 px-12 py-6">
        {groups.map(({ category, items: list }) => (
          <section key={category || '_'} className="mb-5 break-inside-avoid-column">
            <h2 className="mb-1.5 border-b-2 border-violet-200 pb-1 text-sm font-bold tracking-wide text-violet-800 uppercase">
              {category || 'Baaki items'}
            </h2>
            {list.map((i) => (
              <div key={i.id} className="border-b border-dashed border-zinc-200 py-1.5 break-inside-avoid">
                <div className="flex items-baseline gap-2 text-[15px]">
                  <span className="min-w-0 flex-1 font-medium">{i.name}</span>
                  <span className="font-bold tabular-nums">₹{inr(i.rate)}</span>
                  <span className="w-12 text-right text-xs text-zinc-500">/{i.unit}</span>
                </div>
                {i.slabs?.length > 1 && <p className="mt-0.5 text-xs text-violet-800">{slabSummary(i)} (per {i.unit})</p>}
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="flex items-center gap-5 border-t border-zinc-200 px-12 py-6">
        {link && <QRCodeSVG value={link} size={88} level="M" marginSize={0} />}
        <div className="text-sm text-zinc-500">
          {link ? <p className="font-semibold text-zinc-700">Taaza rate dekhne ke liye QR scan karein</p> : null}
          {outCount > 0 && <p>{outCount === 1 ? '1 item abhi stock mein nahi hai' : `${outCount} items abhi stock mein nahi hain`}</p>}
          <p>Rate badal sakte hain · Kirana Bill</p>
        </div>
      </div>
    </div>
  )
}

// A4 poster for the shop counter: scan to open the shop's public rate list
function QrPoster({ shop }) {
  const link = shopLink(shop.slug)
  return (
    <div style={{ width: W, height: 1123 }} className="flex flex-col items-center bg-white px-16 pt-20 pb-14 text-center font-sans text-zinc-900">
      <p className="text-lg font-semibold tracking-[0.25em] text-violet-700 uppercase">Aaj ke rate</p>
      <h1 className="mt-3 text-5xl leading-tight font-extrabold">{shop.name}</h1>
      {(shop.address || shop.city) && <p className="mt-3 text-xl text-zinc-500">{[shop.address, shop.city].filter(Boolean).join(', ')}</p>}
      <div className="mt-12 rounded-[36px] border-[6px] border-violet-600 p-8">
        <QRCodeSVG value={link} size={400} level="M" marginSize={0} />
      </div>
      <p className="mt-10 text-3xl font-bold">Phone se QR scan karein</p>
      <p className="mt-2 text-xl text-zinc-500">Saare items ke taaza rate dekhein</p>
      <p className="mt-auto text-base break-all text-zinc-400">{link}</p>
    </div>
  )
}

/**
 * Buttons to make the rate list PDF / picture, and the QR poster (public shops only).
 * The paper is rendered off-screen only while a file is being made.
 */
export default function RateListShare({ shop, items }) {
  const [making, setMaking] = useState(null) // 'pdf' | 'image' | 'qr'
  const [result, setResult] = useState(null) // { file } | { error }
  const paperRef = useRef(null)
  const canPoster = shop.isPublic && !!shop.slug

  useEffect(() => {
    if (!making) return
    let live = true
    ;(async () => {
      try {
        await document.fonts?.ready
        // Let the off-screen paper (and its QR) paint once before the snapshot
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        const base = safeName(shop.name)
        const file =
          making === 'image'
            ? await nodeToImage(paperRef.current, `Rate-list-${base}.jpg`)
            : await billToPdf(paperRef.current, making === 'qr' ? `QR-poster-${base}.pdf` : `Rate-list-${base}.pdf`)
        if (live) setResult({ file })
      } catch (e) {
        console.error(e)
        if (live) setResult({ error: 'File nahi ban payi, dobara try karein' })
      } finally {
        if (live) setMaking(null)
      }
    })()
    return () => {
      live = false
    }
  }, [making, shop.name])

  const message = [
    `*${shop.name || 'Rate list'}* ki rate list`,
    canPoster && `Taaza rate: ${shopLink(shop.slug)}`,
  ]
    .filter(Boolean)
    .join('\n')
  const busy = (kind) => making === kind
  const hasRates = items.some((i) => i.inStock !== false && Number(i.rate) > 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!!making || !hasRates} onClick={() => setMaking('pdf')} className="btn-ghost py-3">
          {busy('pdf') ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF
        </button>
        <button type="button" disabled={!!making || !hasRates} onClick={() => setMaking('image')} className="btn-ghost py-3">
          {busy('image') ? <LoaderCircle className="size-4 animate-spin" /> : <ImageDown className="size-4" />} Image
        </button>
      </div>
      <button type="button" disabled={!!making || !canPoster} onClick={() => setMaking('qr')} className="btn-ghost w-full py-3">
        {busy('qr') ? <LoaderCircle className="size-4 animate-spin" /> : <QrCode className="size-4" />} Dukaan ke liye QR poster (A4)
      </button>
      {!canPoster && (
        <p className="text-xs text-zinc-500">
          QR poster Public shop ka banta hai, taaki scan karne wale rate dekh sakein. "Dukaan, UPI, Private/Public" mein Public chunke Save karein.
        </p>
      )}
      {!hasRates && <p className="text-xs text-zinc-500">Rate wale items jodne ke baad rate list ban payegi.</p>}

      {making &&
        createPortal(
          <div aria-hidden className="pointer-events-none fixed top-0 left-[-10000px]">
            <div ref={paperRef}>{making === 'qr' ? <QrPoster shop={shop} /> : <RateListPaper shop={shop} items={items} />}</div>
          </div>,
          document.body,
        )}

      <FileReadySheet state={result} title="Taiyaar hai" message={message} onClose={() => setResult(null)} />
    </>
  )
}
