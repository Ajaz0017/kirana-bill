import { AnimatePresence, motion } from 'motion/react'
import { useSyncExternalStore } from 'react'
import { LockKeyhole, ReceiptIndianRupee, Settings, WifiOff } from 'lucide-react'
import { useBillStore } from './store/useBillStore'
import Stepper from './components/Stepper'
import ItemsPage from './pages/ItemsPage'
import DetailsPage from './pages/DetailsPage'
import BillPreview from './pages/BillPreview'
import SettingsPage from './pages/SettingsPage'

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

const subscribeOnline = (cb) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine)

export default function App() {
  const online = useOnline()
  const storedStep = useBillStore((s) => s.step)
  const dir = useBillStore((s) => s.dir)
  const hasItems = useBillStore((s) => s.items.length > 0)
  // Details/Bill make no sense without items (e.g. a stale persisted step)
  const step = hasItems ? storedStep : 0
  const settingsOpen = useBillStore((s) => s.settingsOpen)
  const { openSettings } = useBillStore.getState()
  const Page = settingsOpen ? SettingsPage : PAGES[step]
  const pageKey = settingsOpen ? 'settings' : step

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* Soft animated backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
        <div className="absolute -top-32 -left-24 size-96 animate-blob rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute top-1/3 -right-32 size-96 animate-blob rounded-full bg-indigo-300/40 blur-3xl [animation-delay:-6s]" />
        <div className="absolute -bottom-40 left-1/4 size-96 animate-blob rounded-full bg-fuchsia-200/40 blur-3xl [animation-delay:-12s]" />
      </div>

      <div className={`mx-auto px-4 pt-5 ${step === 2 && !settingsOpen ? 'max-w-[52rem]' : 'max-w-lg'} transition-[max-width] duration-500 print:max-w-none print:p-0`}>
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
              {online ? (
                <p className="text-xs text-zinc-500">Bill of Supply, seconds mein</p>
              ) : (
                <p className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <WifiOff className="size-3.5" /> Offline · scan nahi chalega
                </p>
              )}
            </div>
            {!settingsOpen && (
              <button type="button" onClick={openSettings} aria-label="Settings" title="Settings"
                className="grid size-10 place-items-center rounded-xl border border-zinc-200 bg-white/70 text-zinc-500 transition hover:text-violet-600">
                <Settings className="size-4.5" />
              </button>
            )}
            <button type="button" onClick={lock} aria-label="App lock karein" title="Lock"
              className="grid size-10 place-items-center rounded-xl border border-zinc-200 bg-white/70 text-zinc-500 transition hover:text-violet-600">
              <LockKeyhole className="size-4.5" />
            </button>
          </motion.div>
          {!settingsOpen && <Stepper />}
        </header>

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.main
            key={pageKey}
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
