import { create } from 'zustand'
import { api } from '../utils/api'
import { disablePush } from '../utils/push'

// Last logged-in user, so the installed app still opens offline
const CACHE = 'kb_user'
const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE))
  } catch {
    return null
  }
}
const writeCache = (user) => {
  try {
    if (user) localStorage.setItem(CACHE, JSON.stringify(user))
    else localStorage.removeItem(CACHE)
  } catch {
    // storage blocked: only offline start is affected
  }
}

export const useSession = create((set) => ({
  user: null, // { id, email, name }
  setUser: (user) => {
    writeCache(user)
    set({ user })
  },
}))

/** Who is logged in: asks the server; falls back to the cached user when offline or the server is down. */
export async function loadUser() {
  try {
    const { user } = await api('/api/auth')
    writeCache(user)
    return user
  } catch (e) {
    return e.offline || e.status >= 500 ? readCache() : null
  }
}

export async function logout() {
  // This phone stops getting the shop's order notifications (the next account here shouldn't)
  await disablePush().catch(() => {})
  await fetch('/api/auth', { method: 'DELETE' }).catch(() => {})
  writeCache(null)
  location.replace('/login.html')
}
