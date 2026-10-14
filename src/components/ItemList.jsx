import { AnimatePresence, motion } from 'motion/react'
import { PackageOpen, Pencil, Trash2 } from 'lucide-react'
import { fmtQty, inr } from '../utils/format'

export default function ItemList({ items, onEdit, onDelete }) {
  if (!items.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center rounded-3xl border-2 border-dashed border-zinc-200 px-6 py-10 text-center"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-3 grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"
        >
          <PackageOpen className="size-7" />
        </motion.div>
        <p className="font-semibold text-zinc-700">Abhi koi item nahi hai</p>
        <p className="mt-1 text-sm text-zinc-500">Bill ki photo ke liye Scan bill, ya neeche + Item dabayein</p>
      </motion.div>
    )
  }

  return (
    <ul className="space-y-2.5">
      <AnimatePresence initial={false}>
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="card flex items-center gap-3 rounded-2xl p-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-500">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.name}</p>
              <p className="text-xs text-zinc-500">
                {item.qty ? `${fmtQty(item.qty)} ${item.unit}` : '—'}
                {item.rate ? ` × ₹${inr(item.rate)}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <p className="font-bold tabular-nums">₹{inr(item.amount)}</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => onEdit(item.id)} aria-label="Edit"
                  className="grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition active:scale-95 hover:bg-violet-50 hover:text-violet-600">
                  <Pencil className="size-4" />
                </button>
                <button type="button" onClick={() => onDelete(item.id)} aria-label="Delete"
                  className="grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition active:scale-95 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
