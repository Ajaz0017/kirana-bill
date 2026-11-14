import { motion } from 'motion/react'
import { Globe, Store } from 'lucide-react'
import { useBillStore } from '../store/useBillStore'
import MyShop from './shops/MyShop'
import PublicShops from './shops/PublicShops'
import ShopView from './shops/ShopView'

const SUBTABS = [
  { key: 'mine', label: 'Meri Shop', icon: Store },
  { key: 'public', label: 'Public shops', icon: Globe },
]

// Shops tab: own shop (edit) and other users' public shops (read-only)
export default function ShopsPage() {
  const shopTab = useBillStore((s) => s.shopTab)
  const shopView = useBillStore((s) => s.shopView)
  const setShopTab = useBillStore((s) => s.setShopTab)

  if (shopView) return <ShopView key={shopView} slug={shopView} />

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-lg font-bold">Shops</h2>
        <p className="text-xs text-zinc-500">Apni rate list banayein, ya doosri dukaanon ke rate dekhein</p>
      </div>
      <nav className="relative flex rounded-2xl border border-zinc-200/70 bg-white/70 p-1 shadow-sm backdrop-blur" aria-label="Shops">
        {SUBTABS.map(({ key, label, icon: Icon }) => {
          const active = shopTab === key
          return (
            <button key={key} type="button" onClick={() => setShopTab(key)} aria-current={active ? 'page' : undefined}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-800'}`}>
              {active && (
                <motion.span layoutId="shops-pill" className="absolute inset-0 -z-10 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-600/30"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <Icon className="size-4" /> {label}
            </button>
          )
        })}
      </nav>
      {shopTab === 'mine' ? <MyShop /> : <PublicShops />}
    </div>
  )
}
