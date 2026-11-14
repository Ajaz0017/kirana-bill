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
import { loadMyShop } from './utils/shopSync'
import { listenForInstall } from './store/useInstall'

resetScrollLock()
listenForInstall()

// Who is logged in decides whose shop details and draft are loaded, so find out before rendering
async function boot() {
  const user = await loadUser()
  if (!user) return goToLogin()
  useSession.getState().setUser(user)
  await hydrateForUser(user.id)
  startSync()
  loadMyShop().catch(() => {}) // shop details + rate list from the cloud (e.g. on a new phone)
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
