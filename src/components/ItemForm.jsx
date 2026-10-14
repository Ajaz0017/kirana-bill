import { useRef, useState } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { COMMON_ITEMS, UNITS } from '../constants'
import { cleanDecimal, fmtQty, round } from '../utils/format'

const toForm = (item) => ({
  name: item?.name ?? '',
  qty: item ? fmtQty(item.qty) : '',
  unit: item?.unit ?? 'kg',
  rate: item?.rate ? String(item.rate) : '',
  amount: item ? String(item.amount) : '',
})

/**
 * Qty × Rate = Amount. Editing qty/rate recalculates amount;
 * editing amount (with a rate present) recalculates qty.
 */
export default function ItemForm({ id, editing, onSubmit }) {
  const [form, setForm] = useState(() => toForm(editing))
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  const shake = useAnimationControls()

  const change = (field, raw) => {
    const value = field === 'name' || field === 'unit' ? raw : cleanDecimal(raw)
    setError('')
    setForm((f) => {
      const next = { ...f, [field]: value }
      const qty = parseFloat(next.qty)
      const rate = parseFloat(next.rate)
      const amount = parseFloat(next.amount)
      if ((field === 'qty' || field === 'rate') && qty > 0 && rate > 0) {
        next.amount = String(round(qty * rate))
      } else if (field === 'amount' && rate > 0 && amount > 0) {
        next.qty = fmtQty(amount / rate)
      }
      return next
    })
  }

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
        amount: round(amount),
      },
      keepOpen,
    )
    if (keepOpen) {
      setForm((f) => ({ ...toForm(null), unit: f.unit }))
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
        {COMMON_ITEMS.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

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
          <label className="field-label" htmlFor="item-rate">Rate/{form.unit}</label>
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
