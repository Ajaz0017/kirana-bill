import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, TrendingDown, TrendingUp } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { api } from '../utils/api'
import { inr } from '../utils/format'
import { fmtDay, todayDay } from '../utils/shopRates'

// Chart geometry (SVG units; the SVG scales to the sheet width)
const VW = 340
const VH = 190
const PAD = { top: 16, right: 18, bottom: 26, left: 46 }
const LINE = '#7c3aed' // violet-600, the app's accent
const GRID = '#e4e4e7' // zinc-200, one step off the white surface
const MUTED = '#71717a' // zinc-500 for axis text

// Round tick values (₹1, 2, 5, 10, 20, 50 …) so the axis reads cleanly
function niceTicks(min, max, count = 4) {
  const span = max - min || Math.max(1, max * 0.1)
  const raw = span / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const lo = Math.floor((min - span * 0.15) / step) * step
  const hi = Math.ceil((max + span * 0.15) / step) * step
  const ticks = []
  for (let v = Math.max(0, lo); v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

/** Step line of one item's rate over time, with a crosshair tooltip */
function RateChart({ points, unit }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null) // index into points
  const today = todayDay()
  const first = points[0].day
  const x0 = Math.min(first, today - 1)
  const x1 = Math.max(today, points.at(-1).day)
  const rates = points.map((p) => p.rate)
  const ticks = niceTicks(Math.min(...rates), Math.max(...rates))
  const y0 = ticks[0]
  const y1 = ticks.at(-1)
  const sx = (d) => PAD.left + ((d - x0) / (x1 - x0)) * (VW - PAD.left - PAD.right)
  const sy = (v) => PAD.top + (1 - (v - y0) / (y1 - y0 || 1)) * (VH - PAD.top - PAD.bottom)
  const baseY = VH - PAD.bottom

  // Rate holds until the next change, and the last rate holds until today
  let line = `M${sx(points[0].day)},${sy(points[0].rate)}`
  points.forEach((p, i) => {
    if (i) line += `H${sx(p.day)}V${sy(p.rate)}`
  })
  line += `H${sx(x1)}`
  const area = `${line}V${baseY}H${sx(points[0].day)}Z`

  const pick = (e) => {
    const box = svgRef.current.getBoundingClientRect()
    const day = x0 + (((e.clientX - box.left) / box.width) * VW - PAD.left) / (VW - PAD.left - PAD.right) * (x1 - x0)
    let idx = 0
    points.forEach((p, i) => {
      if (p.day <= day) idx = i
    })
    setHover(idx)
  }

  const h = hover == null ? null : points[hover]
  const last = points.at(-1)
  const tipLeft = h ? Math.min(Math.max((sx(h.day) / VW) * 100, 18), 82) : 0

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Rate ka graph: ${fmtDay(first)} se aaj tak, abhi ₹${inr(last.rate)} per ${unit}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={VW - PAD.right} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.left - 6} y={sy(t)} dy="0.32em" textAnchor="end" fontSize="10" fill={MUTED}>
              ₹{t >= 10000 ? `${Math.round(t / 1000)}K` : t.toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={VH - 8} fontSize="10" fill={MUTED}>{fmtDay(x0, { month: 'short', year: '2-digit' })}</text>
        <text x={VW - PAD.right} y={VH - 8} textAnchor="end" fontSize="10" fill={MUTED}>Aaj</text>

        <path d={area} fill={LINE} fillOpacity="0.1" />
        <path d={line} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.day} cx={sx(p.day)} cy={sy(p.rate)} r={hover === i ? 5.5 : 4} fill={LINE} stroke="#fff" strokeWidth="2" />
        ))}

        {h && <line x1={sx(h.day)} x2={sx(h.day)} y1={PAD.top} y2={baseY} stroke={MUTED} strokeWidth="1" />}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl bg-zinc-900 px-2.5 py-1.5 text-center text-white shadow-lg"
          style={{ left: `${tipLeft}%` }}
        >
          <p className="text-sm font-bold tabular-nums">₹{inr(h.rate)}<span className="font-normal text-zinc-300">/{unit}</span></p>
          <p className="text-[11px] whitespace-nowrap text-zinc-300">{fmtDay(h.day)} se</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

/**
 * Rate history of one shop item. item: { id, name, unit } | null (kept by the parent after
 * closing so the sheet doesn't blank out mid-animation).
 */
export default function RateGraphSheet({ open, item, onClose }) {
  // The answer remembers which item it belongs to; anything else counts as still loading
  const [result, setResult] = useState({ item: null })
  const state = item && result.item === item ? result : { status: 'loading' }

  useEffect(() => {
    if (!open || !item) return
    let live = true
    api(`/api/shops?history=${encodeURIComponent(item.id)}`)
      .then((d) => live && setResult({ item, status: 'done', days: d.days, paise: d.paise }))
      .catch((e) => live && setResult({ item, status: 'error', error: e.message }))
    return () => {
      live = false
    }
  }, [open, item])

  const points = useMemo(
    () => (result.status === 'done' ? result.days.map((day, i) => ({ day, rate: result.paise[i] / 100 })) : []),
    [result],
  )
  const last = points.at(-1)
  const prev = points.at(-2)
  const diff = last && prev ? last.rate - prev.rate : 0
  const pct = prev ? (diff / prev.rate) * 100 : 0
  const rates = points.map((p) => p.rate)

  return (
    <BottomSheet open={open} title={item ? `${item.name} ka rate` : 'Rate'} onClose={onClose}>
      {state.status === 'loading' && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
          <LoaderCircle className="size-4 animate-spin" /> History aa rahi hai…
        </p>
      )}
      {state.status === 'error' && <p className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{state.error}</p>}
      {state.status === 'done' && last && (
        <div className="space-y-4 pb-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-zinc-500">Abhi ka rate</p>
              <p className="text-3xl font-extrabold tabular-nums">
                ₹{inr(last.rate)}<span className="text-base font-semibold text-zinc-500">/{item.unit}</span>
              </p>
              <p className="text-xs text-zinc-500">{fmtDay(last.day)} se</p>
            </div>
            {prev && (
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${diff > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {diff > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {diff > 0 ? '+' : '−'}₹{inr(Math.abs(diff))} ({diff > 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%)
              </span>
            )}
          </div>

          {points.length > 1 ? (
            <RateChart points={points} unit={item.unit} />
          ) : (
            <p className="rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">Rate abhi tak badla nahi hai. Badalte hi yahan graph banega.</p>
          )}

          {points.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Sabse kam" value={`₹${inr(Math.min(...rates))}`} />
              <Stat label="Sabse zyada" value={`₹${inr(Math.max(...rates))}`} />
              <Stat label="Kitni baar badla" value={points.length - 1} />
            </div>
          )}

          <div>
            <p className="field-label">Kab kya rate tha</p>
            <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
              {[...points].reverse().map((p, i, arr) => {
                const before = arr[i + 1]
                const d = before ? p.rate - before.rate : 0
                return (
                  <li key={p.day} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-zinc-600">{fmtDay(p.day)}</span>
                    <span className="flex items-center gap-2">
                      {before && d !== 0 && (
                        <span className={`text-xs font-semibold ${d > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {d > 0 ? '▲' : '▼'} ₹{inr(Math.abs(d))}
                        </span>
                      )}
                      <span className="font-bold tabular-nums">₹{inr(p.rate)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-zinc-400">Pichhle 2 saal ki history · ek din mein ek entry</p>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
