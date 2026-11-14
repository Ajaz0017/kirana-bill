import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are self-hosted (not Google Fonts) so the PDF snapshot can embed them and the app works offline.
// Montserrat needs latin-ext for the ₹ sign.
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-500.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-600.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/montserrat/latin-800.css'
import '@fontsource/montserrat/latin-ext-500.css'
import '@fontsource/montserrat/latin-ext-600.css'
import '@fontsource/montserrat/latin-ext-700.css'
import '@fontsource/montserrat/latin-ext-800.css'
import '@fontsource/pt-serif/latin-400.css'
import '@fontsource/pt-serif/latin-400-italic.css'
import '@fontsource/pt-serif/latin-700.css'
import './index.css'
import App from './App.jsx'
import { resetScrollLock } from './utils/scrollLock'
import { goToLogin } from './utils/api'
import { loadUser, useSession } from './store/useSession'
import { hydrateForUser, useBillStore } from './store/useBillStore'
import { startSync } from './utils/billSync'
import { loadMyShop, watchNewOrders } from './utils/shopSync'
import { listenForInstall } from './store/useInstall'
import { registerSW } from 'virtual:pwa-register'

resetScrollLock()
listenForInstall()
// Offline support for the billing app (the public shop page doesn't register it)
registerSW({ immediate: true })

// Who is logged in decides whose shop details and draft are loaded, so find out before rendering
async function boot() {
  const user = await loadUser()
  if (!user) return goToLogin()
  useSession.getState().setUser(user)
  await hydrateForUser(user.id)
  startSync()
  // Shop details + rate list from the cloud (e.g. on a new phone), then the new-orders badge
  loadMyShop().catch(() => {}).finally(watchNewOrders)
  // Tapped a new-order notification: open Orders (the app was closed) ...
  const params = new URLSearchParams(location.search)
  if (params.get('open') === 'orders') {
    useBillStore.setState({ tab: 'shops', shopTab: 'orders', shopView: null })
    history.replaceState(null, '', '/')
  }
  // ... or the app was open: the service worker tells us
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'open-orders') useBillStore.setState({ tab: 'shops', shopTab: 'orders', shopView: null, viewing: null })
    if (e.data?.type === 'new-order') useBillStore.setState((s) => ({ newOrders: s.newOrders + 1 }))
  })
  // Shared shop link (/?shop=<slug>): open that shop, then tidy the address bar
  const sharedShop = new URLSearchParams(location.search).get('shop')
  if (sharedShop) {
    useBillStore.getState().openShop(sharedShop)
    history.replaceState(null, '', '/')
  }
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
boot()
