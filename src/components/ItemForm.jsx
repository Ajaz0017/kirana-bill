import { useRef, useState } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { COMMON_ITEMS, UNITS } from '../constants'
import { cleanDecimal, fmtQty, inr, round } from '../utils/format'
import { useBillStore } from '../store/useBillStore'
import { findShopItem } from '../utils/shopRates'
import { convertQty, fmtSlabQty, lineAmount, sameFamily, slabAt, slabForAmount, slabRate, unitFamily } from '../utils/units'

// rateUnit: the unit the rate is quoted in (250 gm @ ₹70/kg). auto: id of the shop item whose
// rate (and qty slabs) fill the rate automatically; null once the owner types a rate themselves.
const toForm = (item) => ({
  name: item?.name ?? '',
  qty: item ? fmtQty(item.qty) : '',
  unit: item?.unit ?? 'kg',
  rateUnit: item?.rateUnit ?? item?.unit ?? 'kg',
  rate: item?.rate ? String(item.rate) : '',
  amount: item ? String(item.amount) : '',
  auto: null,
})

/**
 * One edit -> the next form state. Qty × Rate = Amount, with qty converted into the rate's unit.
 * A shop item picks its rate from the qty slab; typing an amount picks the slab that fits it.
 */
function nextForm(f, field, value, shopItems) {
  const next = { ...f, [field]: value }
  if (field === 'name') {
    const item = findShopItem(shopItems, value, f.unit)
    next.auto = item?.id ?? null
    if (item) {
      next.rateUnit = item.unit
      if (!sameFamily(item.unit, next.unit)) next.unit = item.unit
    }
  }
  if (field === 'unit' && !sameFamily(value, next.rateUnit)) {
    // A kg rate can't price pcs: the rate follows the new unit and stops being automatic
    next.rateUnit = value
    next.auto = null
  }
  if (field === 'rate' || field === 'rateUnit') next.auto = null

  const item = next.auto ? shopItems.find((i) => i.id === next.auto) : null
  if (field === 'amount') {
    const amount = parseFloat(value)
    if (!(amount > 0)) return next
    const fit = item ? slabForAmount(item, amount) : parseFloat(next.rate) > 0 ? { rate: parseFloat(next.rate), qty: amount / parseFloat(next.rate) } : null
    if (fit) {
      next.rate = String(fit.rate)
      next.qty = fmtQty(convertQty(fit.qty, next.rateUnit, next.unit))
    }
    return next
  }
  if (item) next.rate = String(slabRate(item, convertQty(parseFloat(next.qty), next.unit, next.rateUnit)))
  const amount = lineAmount(next.qty, next.unit, next.rate, next.rateUnit)
  if (amount != null) next.amount = String(amount)
  return next
}

// "250 g+ slab: ₹70/kg · 1 kg+ pe ₹66/kg" under the item name
function ShopHint({ item, form, auto, onUseShopRate }) {
  const qtyIn = convertQty(parseFloat(form.qty), form.unit, item.unit)
  const at = slabAt(item, qtyIn)
  const out = item.inStock === false
  return (
    <p className={`mt-1.5 text-xs font-medium ${out ? 'text-amber-700' : 'text-violet-700'}`}>
      {at ? (
        <>
          {at.slab.min > 0 ? `${fmtSlabQty(at.slab.min, item.unit)}+ slab` : 'Kam qty ka rate'}: ₹{inr(at.slab.rate)}/{item.unit}
          {at.next && ` · ${fmtSlabQty(at.next.min, item.unit)}+ pe ₹${inr(at.next.rate)}/${item.unit}`}
        </>
      ) : (
        <>Shop ka rate: ₹{inr(item.rate)}/{item.unit}</>
      )}
      {out && ' · rate list mein "abhi nahi hai" mark hai'}
      {!auto && (
        <button type="button" onClick={onUseShopRate} className="ml-1.5 font-semibold underline underline-offset-2">
          Shop ka rate lagayein
        </button>
      )}
    </p>
  )
}

export default function ItemForm({ id, editing, onSubmit }) {
  const knownItems = useBillStore((s) => s.knownItems)
  const shopItems = useBillStore((s) => s.shopItems)
  // The shop's rate list first, then names used before, then the common catalog
  const suggestions = [...new Set([...shopItems.map((i) => i.name), ...knownItems, ...COMMON_ITEMS])]
  const [form, setForm] = useState(() => toForm(editing))
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  const shake = useAnimationControls()

  const change = (field, raw) => {
    const value = field === 'name' || field === 'unit' || field === 'rateUnit' ? raw : cleanDecimal(raw)
    setError('')
    setForm((f) => nextForm(f, field, value, shopItems))
  }

  const shopMatch = findShopItem(shopItems, form.name, form.unit)
  const rateUnits = unitFamily(form.unit)

  const submit = (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    const problem = !form.name.trim()
      ? 'Item ka naam likhein'
      : !(amount > 0)
        ? 'Amount ya Qty × Rate daalein'
        : ''
    if (problem) {
      setError(problem)
      shake.start({ x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.4 } })
      return
    }
    // "Add & Next" keeps the sheet open for quick entry of the next item
    const keepOpen = !editing && e.nativeEvent.submitter?.value === 'next'
    onSubmit(
      {
        name: form.name.trim(),
        qty: parseFloat(form.qty) || '',
        unit: form.unit,
        rate: parseFloat(form.rate) || '',
        rateUnit: form.rateUnit,
        amount: round(amount),
      },
      keepOpen,
    )
    if (keepOpen) {
      setForm((f) => ({ ...toForm(null), unit: f.unit, rateUnit: f.rateUnit }))
      nameRef.current?.focus()
    }
  }

  return (
    <motion.form id={id} animate={shake} onSubmit={submit} noValidate>

      <label className="field-label" htmlFor="item-name">Item</label>
      <input
        id="item-name"
        ref={nameRef}
        className="field"
        list="common-items"
        placeholder="e.g. Daal Arhar"
        autoComplete="off"
        value={form.name}
        onChange={(e) => change('name', e.target.value)}
      />
      <datalist id="common-items">
        {suggestions.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {shopMatch && sameFamily(shopMatch.unit, form.unit) && (
        <ShopHint item={shopMatch} form={form} auto={form.auto === shopMatch.id} onUseShopRate={() => change('name', form.name)} />
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className="field-label" htmlFor="item-qty">Qty</label>
          <input id="item-qty" className="field" inputMode="decimal" placeholder="0"
            value={form.qty} onChange={(e) => change('qty', e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="item-unit">Unit</label>
          <select id="item-unit" className="field appearance-none" value={form.unit}
            onChange={(e) => change('unit', e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          {/* gm/kg and ml/ltr: the rate can be per the bigger unit (250 gm @ ₹70/kg) */}
          <div className="mb-1.5 flex items-baseline gap-1">
            <label className="field-label mb-0" htmlFor="item-rate">Rate/</label>
            {rateUnits.length > 1 ? (
              <select aria-label="Rate kis unit ka" value={form.rateUnit} onChange={(e) => change('rateUnit', e.target.value)}
                className="-my-1 rounded-md bg-violet-50 px-1 py-0.5 text-xs font-bold text-violet-700 uppercase outline-none">
                {rateUnits.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : (
              <span className="field-label mb-0">{form.rateUnit}</span>
            )}
          </div>
          <input id="item-rate" className="field" inputMode="decimal" placeholder="₹0"
            value={form.rate} onChange={(e) => change('rate', e.target.value)} />
        </div>
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="item-amount">Amount</label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-semibold text-zinc-400">₹</span>
          <input id="item-amount" className="field pl-8 text-lg font-bold" inputMode="decimal" placeholder="0.00"
            value={form.amount} onChange={(e) => change('amount', e.target.value)} />
        </div>
      </div>

      <motion.p
        initial={false}
        animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }}
        className="overflow-hidden text-sm font-medium text-rose-600"
      >
        <span className="block pt-2">{error}</span>
      </motion.p>
    </motion.form>
  )
}
