import { motion } from 'motion/react'
import { FileText, ShoppingBasket, UserRound } from 'lucide-react'
import { useBillStore } from '../store/useBillStore'

const STEPS = [
  { label: 'Items', icon: ShoppingBasket },
  { label: 'Details', icon: UserRound },
  { label: 'Bill', icon: FileText },
]

export default function Stepper() {
  const step = useBillStore((s) => s.step)
  const goTo = useBillStore((s) => s.goTo)
  const hasItems = useBillStore((s) => s.items.length > 0)

  return (
    <nav className="relative flex rounded-2xl border border-zinc-200/70 bg-white/70 p-1 shadow-sm backdrop-blur">
      {STEPS.map(({ label, icon: Icon }, i) => {
        const active = step === i
        const disabled = i > 0 && !hasItems
        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => goTo(i)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
              active ? 'text-white' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {active && (
              <motion.span
                layoutId="step-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-600/30"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="size-4" />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
