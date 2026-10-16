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

resetScrollLock()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
