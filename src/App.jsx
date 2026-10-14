import { AnimatePresence, motion } from 'motion/react'
import { LockKeyhole, ReceiptIndianRupee } from 'lucide-react'
import { useBillStore } from './store/useBillStore'
import Stepper from './components/Stepper'
import ItemsPage from './pages/ItemsPage'
import DetailsPage from './pages/DetailsPage'
import BillPreview from './pages/BillPreview'

const PAGES = [ItemsPage, DetailsPage, BillPreview]

const slide = {
  enter: (dir) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir * -48, opacity: 0 }),
}

// Drops the PIN session cookie; the bill draft stays saved on this device
const lock = async () => {
  await fetch('/api/auth', { method: 'DELETE' }).catch(() => {})
  location.replace('/lock.html')
}

export default function App() {
  const storedStep = useBillStore((s) => s.step)
  const dir = useBillStore((s) => s.dir)
  const hasItems = useBillStore((s) => s.items.length > 0)
  // Details/Bill make no sense without items (e.g. a stale persisted step)
  const step = hasItems ? storedStep : 0
  const Page = PAGES[step]

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* Soft animated backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
        <div className="absolute -top-32 -left-24 size-96 animate-blob rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute top-1/3 -right-32 size-96 animate-blob rounded-full bg-indigo-300/40 blur-3xl [animation-delay:-6s]" />
        <div className="absolute -bottom-40 left-1/4 size-96 animate-blob rounded-full bg-fuchsia-200/40 blur-3xl [animation-delay:-12s]" />
      </div>

      <div className={`mx-auto px-4 pt-5 ${step === 2 ? 'max-w-[52rem]' : 'max-w-lg'} transition-[max-width] duration-500 print:max-w-none print:p-0`}>
        <header className="mb-5 space-y-4 print:hidden">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <motion.span
              whileHover={{ rotate: -8, scale: 1.05 }}
              className="grid size-11 place-items-center rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30"
            >
              <ReceiptIndianRupee className="size-6" />
            </motion.span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg leading-tight font-extrabold">Kirana Bill</h1>
              <p className="text-xs text-zinc-500">Bill of Supply, seconds mein</p>
            </div>
            <button type="button" onClick={lock} aria-label="App lock karein" title="Lock"
              className="grid size-10 place-items-center rounded-xl border border-zinc-200 bg-white/70 text-zinc-500 transition hover:text-violet-600">
              <LockKeyhole className="size-4.5" />
            </button>
          </motion.div>
          <Stepper />
        </header>

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.main
            key={step}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Page />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}
