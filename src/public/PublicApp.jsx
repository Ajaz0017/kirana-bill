import { Store } from 'lucide-react'
import ShopPage from './ShopPage'
import OrderPage from './OrderPage'
import MyOrdersPage from './MyOrdersPage'

// /s/<slug> = a shop's rate list (and ordering); /o/<code> = one placed order; /orders = this phone's orders
export default function PublicApp() {
  const [, kind, key] = location.pathname.match(/^\/([so])\/([^/]+)\/?$/) ?? []
  const page =
    location.pathname.replace(/\/$/, '') === '/orders' ? <MyOrdersPage />
      : kind === 's' ? <ShopPage slug={decodeURIComponent(key)} />
        : kind === 'o' ? <OrderPage code={decodeURIComponent(key)} /> : null

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
        <div className="absolute -top-32 -left-24 size-96 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-32 size-96 rounded-full bg-indigo-300/30 blur-3xl" />
      </div>
      <div className="mx-auto max-w-lg px-4 pt-5 pb-32">
        {page ?? (
          <div className="card mt-10 flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><Store className="size-7" /></span>
            <p className="font-bold">Ye link sahi nahi hai</p>
            <p className="text-sm text-zinc-500">Dukaan se naya QR / link maangiye.</p>
          </div>
        )}
      </div>
    </div>
  )
}
