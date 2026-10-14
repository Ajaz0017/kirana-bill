import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, CheckCheck, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { UNITS } from '../constants'
import { cleanDecimal, fmtQty, inr, round } from '../utils/format'
import BottomSheet from './BottomSheet'

const isValid = (r) => r.name.trim() && parseFloat(r.amount) > 0

// Same Qty × Rate = Amount rule as ItemForm
function recalc(row, field, raw) {
  const value = field === 'name' || field === 'unit' ? raw : cleanDecimal(raw)
  const next = { ...row, [field]: value, uncertain: false }
  const qty = parseFloat(next.qty)
  const rate = parseFloat(next.rate)
  const amount = parseFloat(next.amount)
  if ((field === 'qty' || field === 'rate') && qty > 0 && rate > 0) next.amount = String(round(qty * rate))
  else if (field === 'amount' && rate > 0 && amount > 0) next.qty = fmtQty(amount / rate)
  return next
}

const Row = ({ row, index, onChange, onRemove }) => {
  const set = (field) => (e) => onChange(recalc(row, field, e.target.value))
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
      className={`rounded-2xl border p-3 ${row.uncertain ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white'}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-500">{index + 1}</span>
        <input className="field py-2 font-semibold" value={row.name} onChange={set('name')} placeholder="Item ka naam" aria-label="Item" />
        <button type="button" onClick={onRemove} aria-label="Hatayein"
          className="grid size-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <input className="field px-2.5 py-2" inputMode="decimal" placeholder="Qty" aria-label="Qty" value={row.qty} onChange={set('qty')} />
        <select className="field appearance-none px-2.5 py-2" aria-label="Unit" value={row.unit} onChange={set('unit')}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <input className="field px-2.5 py-2" inputMode="decimal" placeholder="Rate" aria-label="Rate" value={row.rate} onChange={set('rate')} />
        <input className="field px-2.5 py-2 font-bold" inputMode="decimal" placeholder="₹" aria-label="Amount" value={row.amount} onChange={set('amount')} />
      </div>
      {row.uncertain && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <TriangleAlert className="size-3.5" /> Photo se check kar lein
        </p>
      )}
    </motion.li>
  )
}

/**
 * Review what the AI read before it lands in the bill.
 * `scan` is kept by the parent after closing so the sheet doesn't blank out mid-animation.
 * scan: { status: 'loading' | 'done' | 'error', photo, rows?, notes?, error? }
 */
export default function ScanReview({ open, scan, onClose, onRetake, onAddAll }) {
  const [rows, setRows] = useState(scan?.rows ?? [])
  // A new scan result replaces the editable rows
  const [shownRows, setShownRows] = useState(scan?.rows)
  if (scan?.rows !== shownRows) {
    setShownRows(scan?.rows)
    setRows(scan?.rows ?? [])
  }
  const [zoom, setZoom] = useState(false)
  const valid = rows.filter(isValid)
  const total = valid.reduce((s, r) => s + parseFloat(r.amount), 0)
  const done = scan?.status === 'done'

  return (
    <BottomSheet
      open={open}
      title={done ? `Scan se ${rows.length} items mile` : scan?.status === 'error' ? 'Scan nahi hua' : 'Bill padh rahe hain…'}
      onClose={onClose}
      footer={
        scan?.status !== 'loading' && (
          <div className="flex gap-3">
            <button type="button" onClick={onRetake} className="btn-ghost shrink-0 py-3.5 text-base">
              <Camera className="size-5" /> Dobara
            </button>
            {done && (
              <motion.button whileTap={{ scale: 0.97 }} type="button" disabled={!valid.length}
                onClick={() => onAddAll(valid)} className="btn-primary flex-1 py-3.5 text-base">
                <CheckCheck className="size-5" /> Add karein ({valid.length})
              </motion.button>
            )}
          </div>
        )
      }
    >
      {scan?.photo && (
        <button type="button" onClick={() => setZoom((z) => !z)} aria-label="Photo badi/chhoti karein"
          className="relative mb-3 block w-full overflow-hidden rounded-2xl bg-zinc-100">
          <img src={scan.photo} alt="Scan kiya hua bill"
            className={`w-full object-cover object-top transition-[max-height] duration-300 ${zoom ? 'max-h-[70dvh] object-contain' : 'max-h-28'}`} />
          {scan.status === 'loading' && (
            <div className="absolute inset-0 grid place-items-center bg-white/60 backdrop-blur-[1px]">
              <LoaderCircle className="size-8 animate-spin text-violet-600" />
            </div>
          )}
          {done && <span className="absolute right-2 bottom-2 rounded-full bg-zinc-900/70 px-2 py-0.5 text-[11px] font-medium text-white">{zoom ? 'Chhota karein' : 'Tap karke dekhein'}</span>}
        </button>
      )}

      {scan?.status === 'loading' && (
        <p className="py-6 text-center text-sm text-zinc-500">AI aapka bill padh raha hai, 5–15 second lagenge</p>
      )}

      {scan?.status === 'error' && (
        <p className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{scan.error}</p>
      )}

      {done && (
        <>
          {scan.notes?.length > 0 && (
            <ul className="mb-3 space-y-1 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
              {scan.notes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          )}
          {rows.length ? (
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {rows.map((row, i) => (
                  <Row key={row.key} row={row} index={i}
                    onChange={(next) => setRows((rs) => rs.map((r) => (r.key === row.key ? next : r)))}
                    onRemove={() => setRows((rs) => rs.filter((r) => r.key !== row.key))} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-zinc-500">Photo mein koi item nahi mila. Saaf, seedhi photo lein.</p>
          )}
          {rows.length > 0 && (
            <p className="mt-3 flex justify-between px-1 text-sm">
              <span className="text-zinc-500">
                {rows.length - valid.length > 0 && `${rows.length - valid.length} bina naam/amount ke chhoot jayenge`}
              </span>
              <span className="font-bold tabular-nums">₹{inr(total)}</span>
            </p>
          )}
        </>
      )}
    </BottomSheet>
  )
}
