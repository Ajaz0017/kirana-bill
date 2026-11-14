import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import '../index.css'
import { resetScrollLock } from '../utils/scrollLock'
import PublicApp from './PublicApp'

resetScrollLock()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PublicApp />
  </StrictMode>,
)
