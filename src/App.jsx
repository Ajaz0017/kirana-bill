import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useSyncExternalStore } from 'react'
import { ReceiptIndianRupee, WifiOff } from 'lucide-react'
import { useBillStore } from './store/useBillStore'
import { useSession } from './store/useSession'
import { useToast } from './store/useToast'
import Stepper from './components/Stepper'
import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import ItemsPage from './pages/ItemsPage'
import DetailsPage from './pages/DetailsPage'
import BillPreview from './pages/BillPreview'
import SettingsPage from './pages/SettingsPage'

// Only needed on their own tabs, so they load separately (the service worker still caches them for offline)
const BillsPage = lazy(() => import('./pages/BillsPage'))
const ShopsPage = lazy(() => import('./pages/ShopsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

const STEPS = [ItemsPage, DetailsPage, BillPreview]
const TAB_PAGES = { bills: BillsPage, shops: ShopsPage, settings: SettingsPage, profile: ProfilePage }

const slide = {
  enter: (dir) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir * -48, opacity: 0 }),
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
  const tab = useBillStore((s) => s.tab)
  const storedStep = useBillStore((s) => s.step)
  const dir = useBillStore((s) => s.dir)
  const hasItems = useBillStore((s) => s.items.length > 0)
  const viewing = useBillStore((s) => !!s.viewing)
  const shopView = useBillStore((s) => s.shopView)
  const user = useSession((s) => s.user)
  const toast = useToast((s) => s.toast)
  const clearToast = useToast((s) => s.clear)
  const setTab = useBillStore((s) => s.setTab)

  // Details/Bill make no sense without items (e.g. a stale persisted step)
  const step = hasItems ? storedStep : 0
  const home = tab === 'home'
  const Page = home ? STEPS[step] : TAB_PAGES[tab]
  const pageKey = home ? `home-${step}` : tab === 'shops' && shopView ? `shop-${shopView}` : tab
  // The A4 bill gets more room on wide screens
  const wide = (home && step === 2) || (tab === 'bills' && viewing)

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* Soft animated backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
        <div className="absolute -top-32 -left-24 size-96 animate-blob rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute top-1/3 -right-32 size-96 animate-blob rounded-full bg-indigo-300/40 blur-3xl [animation-delay:-6s]" />
        <div className="absolute -bottom-40 left-1/4 size-96 animate-blob rounded-full bg-fuchsia-200/40 blur-3xl [animation-delay:-12s]" />
      </div>

      <div
        className={`mx-auto px-4 pt-5 pb-[calc(var(--nav-h)+env(safe-area-inset-bottom)+1rem)] ${wide ? 'max-w-[52rem]' : 'max-w-lg'} transition-[max-width] duration-500 print:max-w-none print:p-0`}
      >
        {/* Brand header + bill steps only on Home; other tabs start straight with their own title */}
        {home ? (
          <header className="mb-5 space-y-4 print:hidden">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <motion.span
                whileHover={{ rotate: -8, scale: 1.05 }}
                className="grid size-11 place-items-center rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30"
              >
                <ReceiptIndianRupee className="size-6" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg leading-tight font-extrabold">Kirana Bill</h1>
                {online ? (
                  <p className="truncate text-xs text-zinc-500">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</p>
                ) : (
                  <p className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <WifiOff className="size-3.5" /> Offline · scan aur sync nahi chalega
                  </p>
                )}
              </div>
              {user && (
                <button type="button" onClick={() => setTab('profile')} aria-label="Profile" title={user.email}
                  className="grid size-10 place-items-center rounded-xl border border-zinc-200 bg-white/70 font-bold text-violet-700 transition hover:border-violet-300">
                  {(user.name || user.email).trim().charAt(0).toUpperCase()}
                </button>
              )}
            </motion.div>
            <Stepper />
          </header>
        ) : (
          !online && (
            <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 print:hidden">
              <WifiOff className="size-3.5" /> Offline · save aur sync net aane pe hoga
            </p>
          )
        )}

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
            <Suspense fallback={<div className="card h-40 animate-pulse" />}>
              <Page />
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </div>

      <BottomNav />
      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}
