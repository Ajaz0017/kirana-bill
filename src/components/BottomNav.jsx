import { motion } from 'motion/react'
import { House, ReceiptText, Settings, Store, UserRound } from 'lucide-react'
import { useBillStore } from '../store/useBillStore'

const ITEMS = [
  { tab: 'home', label: 'Home', icon: House },
  { tab: 'bills', label: 'Bills', icon: ReceiptText },
  { tab: 'shops', label: 'Shops', icon: Store },
  { tab: 'settings', label: 'Settings', icon: Settings },
  { tab: 'profile', label: 'Profile', icon: UserRound },
]

// App-wide tabs, fixed to the bottom edge (page action bars sit just above it)
export default function BottomNav() {
  const tab = useBillStore((s) => s.tab)
  const pending = useBillStore((s) => Object.keys(s.pendingBills).length)
  const shopUnsaved = useBillStore((s) => s.shopDirty)
  const setTab = useBillStore((s) => s.setTab)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl print:hidden"
    >
      <div className="mx-auto flex h-(--nav-h) max-w-lg items-stretch px-2">
        {ITEMS.map(({ tab: t, label, icon: Icon }) => {
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                active ? 'text-violet-700' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span className="relative grid h-8 w-14 place-items-center">
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-violet-100"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative size-5" strokeWidth={active ? 2.4 : 2} />
                {t === 'bills' && pending > 0 && (
                  <span className="absolute top-0 right-2 size-2.5 rounded-full bg-amber-500 ring-2 ring-white" title={`${pending} bill sync baaki`} />
                )}
                {t === 'shops' && shopUnsaved && (
                  <span className="absolute top-0 right-2 size-2.5 rounded-full bg-amber-500 ring-2 ring-white" title="Shop save baaki" />
                )}
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
