import { create } from 'zustand'

// "Install the app" support: Chrome/Edge/Android hand us a prompt we can show from a button.
// iPhone Safari never does (there it's Share → Add to Home Screen).
export const useInstall = create(() => ({
  prompt: null, // the saved beforeinstallprompt event
  installed: typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches,
}))

/** Call once at startup, before anything awaits: the browser may fire the event right away */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we offer it from Profile instead of the browser's own banner
    useInstall.setState({ prompt: e })
  })
  window.addEventListener('appinstalled', () => useInstall.setState({ prompt: null, installed: true }))
}

/** Shows the browser's install dialog; resolves true if the app got installed */
export async function installApp() {
  const { prompt } = useInstall.getState()
  if (!prompt) return false
  prompt.prompt()
  const { outcome } = await prompt.userChoice
  useInstall.setState({ prompt: null })
  return outcome === 'accepted'
}
