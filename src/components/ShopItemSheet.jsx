import { useState } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { COMMON_ITEMS, UNITS } from '../constants'
import { cleanDecimal, fmtQty, inr } from '../utils/format'
import { convertQty, mainRate, unitFamily } from '../utils/units'
import { useBillStore } from '../store/useBillStore'

const MAX_SLABS = 6

// Slab rows as typed: row 0 is "everything below the next slab"; others start at qty + unit
const slabRowsFrom = (item) =>
  item.slabs.map((s, i) => {
    if (i === 0) return { qty: '', qtyUnit: item.unit, rate: String(s.rate) }
    const small = unitFamily(item.unit)[1]
    const inSmall = small !== item.unit && s.min < 1
    return { qty: fmtQty(inSmall ? convertQty(s.min, item.unit, small) : s.min), qtyUnit: inSmall ? small : item.unit, rate: String(s.rate) }
  })

const toForm = (item, prefillName = '') => ({
  name: item?.name ?? prefillName,
  unit: item?.unit ?? 'kg',
  rate: item && Number(item.rate) > 0 ? String(item.rate) : '',
  category: item?.category ?? '',
  inStock: item?.inStock !== false,
  useSlabs: item?.slabs?.length > 1,
  slabs: item?.slabs?.length > 1 ? slabRowsFrom(item) : [],
})

/** Typed rows -> sorted [{ min, rate }] in the item's unit, or an error message */
function readSlabs(rows, unit) {
  const slabs = []
  for (const [i, r] of rows.entries()) {
    const rate = parseFloat(r.rate)
    if (!(rate > 0)) return { error: 'Har qty ka rate daalein' }
    if (i === 0) {
      slabs.push({ min: 0, rate })
      continue
    }
    const min = convertQty(parseFloat(r.qty), r.qtyUnit, unit)
    if (!(min > 0)) return { error: 'Har rate ke saath qty daalein' }
    slabs.push({ min: Math.round(min * 1000) / 1000, rate })
  }
  slabs.sort((a, b) => a.min - b.min)
  if (slabs.some((s, i) => i > 0 && s.min === slabs[i - 1].min)) return { error: 'Do rate ek hi qty ke hain' }
  if (slabs.length < 2) return { error: 'Kam se kam ek aur qty ka rate jodein' }
  return { slabs }
}

function ItemFields({ editing, prefillName, items, onSave, onDelete }) {
  const knownItems = useBillStore((s) => s.knownItems)
  const [form, setForm] = useState(() => toForm(editing, prefillName))
  const [error, setError] = useState('')
  const shake = useAnimationControls()
  const categories = [...new Set(items.map((i) => i.category?.trim()).filter(Boolean))].sort()
  const names = [...new Set([...knownItems, ...COMMON_ITEMS])]
  const family = unitFamily(form.unit)
  const set = (patch) => {
    setError('')
    setForm((f) => ({ ...f, ...patch }))
  }
  const setUnit = (unit) =>
    // Slab qty units must convert to the item's unit (kg item: kg/gm; pcs item: pcs)
    set({ unit, slabs: form.slabs.map((r) => (unitFamily(unit).includes(r.qtyUnit) ? r : { ...r, qtyUnit: unit })) })
  const setRow = (i, patch) => set({ slabs: form.slabs.map((r, k) => (k === i ? { ...r, ...patch } : r)) })
  const toggleSlabs = (on) =>
    set({
      useSlabs: on,
      // Start with today's rate for small qty, plus one empty bigger-qty row
      slabs: on && !form.slabs.length ? [{ qty: '', qtyUnit: form.unit, rate: form.rate }, { qty: '', qtyUnit: form.unit, rate: '' }] : form.slabs,
    })

  const parsed = form.useSlabs ? readSlabs(form.slabs, form.unit) : null
  const preview = parsed?.slabs ? mainRate(parsed.slabs) : null

  const submit = (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const dup = items.some((i) => i.id !== editing?.id && i.name.trim().toLowerCase() === name.toLowerCase() && i.unit === form.unit)
    const problem = !name
      ? 'Item ka naam likhein'
      : dup
        ? `${name} (${form.unit}) pehle se list mein hai`
        : form.useSlabs
          ? parsed.error ?? ''
          : !(parseFloat(form.rate) > 0)
            ? 'Rate daalein'
            : ''
    if (problem) {
      setError(problem)
      shake.start({ x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.4 } })
      return
    }
    onSave({
      name,
      unit: form.unit,
      // With slabs, the main rate (1 unit) is what lists, auto-fill and the graph use
      rate: form.useSlabs ? mainRate(parsed.slabs) : form.rate,
      slabs: form.useSlabs ? parsed.slabs : [],
      category: form.category.trim(),
      inStock: form.inStock,
    })
  }

  return (
    <motion.form id="shop-item-form" animate={shake} onSubmit={submit} noValidate className="space-y-3 pb-2">
      <div>
        <label className="field-label" htmlFor="si-name">Item</label>
        <input id="si-name" className="field" list="si-names" autoComplete="off" placeholder="e.g. Chawal" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <datalist id="si-names">
          {names.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="si-unit">Rate kis unit ka</label>
          <select id="si-unit" className="field appearance-none" value={form.unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>per {u}</option>)}
          </select>
        </div>
        {!form.useSlabs && (
          <div>
            <label className="field-label" htmlFor="si-rate">Rate / {form.unit}</label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-semibold text-zinc-400">₹</span>
              <input id="si-rate" className="field pl-8 font-bold" inputMode="decimal" placeholder="0" value={form.rate} onChange={(e) => set({ rate: cleanDecimal(e.target.value) })} />
            </div>
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 px-3.5 py-3">
        <span>
          <span className="block text-sm font-semibold">Qty ke hisaab se alag rate</span>
          <span className="block text-xs text-zinc-500">Jaise 5 kg pe ₹65, 250 g pe ₹70/kg</span>
        </span>
        <input type="checkbox" className="size-5 accent-violet-600" checked={form.useSlabs} onChange={(e) => toggleSlabs(e.target.checked)} />
      </label>

      {form.useSlabs && (
        <div className="space-y-2 rounded-2xl bg-violet-50/60 p-3">
          {form.slabs.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              {i === 0 ? (
                <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-600">Sabse kam qty pe</span>
              ) : (
                <>
                  <input className="field w-18 shrink-0 px-2.5 py-2" inputMode="decimal" placeholder="Qty" aria-label={`Slab ${i + 1} qty`}
                    value={r.qty} onChange={(e) => setRow(i, { qty: cleanDecimal(e.target.value) })} />
                  {family.length > 1 ? (
                    <select className="field w-18 shrink-0 appearance-none px-2.5 py-2" aria-label={`Slab ${i + 1} unit`} value={r.qtyUnit} onChange={(e) => setRow(i, { qtyUnit: e.target.value })}>
                      {family.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <span className="w-10 shrink-0 text-sm text-zinc-500">{form.unit}</span>
                  )}
                  <span className="min-w-0 flex-1 text-xs text-zinc-500">ya zyada</span>
                </>
              )}
              <div className="relative w-24 shrink-0">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm font-semibold text-zinc-400">₹</span>
                <input className="field py-2 pr-2 pl-6 text-right font-bold" inputMode="decimal" placeholder={`/${form.unit}`} aria-label={`Slab ${i + 1} rate`}
                  value={r.rate} onChange={(e) => setRow(i, { rate: cleanDecimal(e.target.value) })} />
              </div>
              {i > 0 ? (
                <button type="button" onClick={() => set({ slabs: form.slabs.filter((_, k) => k !== i) })} aria-label={`Slab ${i + 1} hatayein`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-white hover:text-rose-600">
                  <X className="size-4" />
                </button>
              ) : (
                <span className="size-8 shrink-0" />
              )}
            </div>
          ))}
          {form.slabs.length < MAX_SLABS && (
            <button type="button" onClick={() => set({ slabs: [...form.slabs, { qty: '', qtyUnit: form.unit, rate: '' }] })} className="text-sm font-semibold text-violet-700">
              + Aur qty ka rate
            </button>
          )}
          <p className="text-xs text-zinc-500">
            Rate har baar per {form.unit} hai. Customer jitni qty le, usse kam ya barabar wali sabse badi qty ka rate lagega.
            {preview != null && <> 1 {form.unit} ka rate: <b>₹{inr(preview)}</b> (list aur graph mein yahi dikhega).</>}
          </p>
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="si-cat">Category (optional)</label>
        <input id="si-cat" className="field" list="si-cats" autoComplete="off" placeholder="e.g. Anaaj, Masale, Tel" value={form.category} onChange={(e) => set({ category: e.target.value })} />
        <datalist id="si-cats">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 px-3.5 py-3">
        <span>
          <span className="block text-sm font-semibold">Stock mein hai</span>
          <span className="block text-xs text-zinc-500">Band karein to "abhi nahi hai" dikhega</span>
        </span>
        <input type="checkbox" className="size-5 accent-violet-600" checked={form.inStock} onChange={(e) => set({ inStock: e.target.checked })} />
      </label>
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      {editing && (
        <button type="button" onClick={onDelete} className="btn w-full border border-rose-100 bg-white py-3 text-rose-600 hover:bg-rose-50">
          <Trash2 className="size-4" /> List se hatayein
        </button>
      )}
    </motion.form>
  )
}

/**
 * Add or edit one item of the own shop's rate list. editing: item | null; formKey resets the form;
 * prefillName starts a new item with that name (e.g. what was typed in the search box).
 */
export default function ShopItemSheet({ open, editing, prefillName, formKey, items, onSave, onDelete, onClose }) {
  return (
    <BottomSheet
      open={open}
      title={editing ? 'Item badlein' : 'Naya item'}
      onClose={onClose}
      footer={
        <motion.button whileTap={{ scale: 0.97 }} type="submit" form="shop-item-form" className="btn-primary w-full py-3.5 text-base">
          {editing ? <Check className="size-5" /> : <Plus className="size-5" />} {editing ? 'Theek hai' : 'List mein jodein'}
        </motion.button>
      }
    >
      <ItemFields key={formKey} editing={editing} prefillName={prefillName} items={items} onSave={onSave} onDelete={onDelete} />
    </BottomSheet>
  )
}
