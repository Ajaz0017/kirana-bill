// Vercel Routing Middleware: nothing (app, JS bundle, stamp/signature images, APIs) is served
// until the browser has a valid login session. Logged-out visitors only ever see /login.html.
import { next } from '@vercel/functions'
import { isAuthed } from './api/_auth.js'

// Everything except the login screen, its endpoint, and the harmless install files (icons,
// manifest, service worker) that browsers fetch without cookies; keep in sync with vite.config.js
export const config = {
  matcher: ['/((?!login\\.html|api/auth|favicon\\.svg|manifest\\.webmanifest|icons/|sw\\.js|registerSW\\.js|workbox-).*)'],
}

export default async function middleware(request) {
  if (await isAuthed(request, process.env)) return next()

  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) {
    return Response.json({ error: 'Pehle login karein', loggedOut: true }, { status: 401 })
  }
  const login = new URL('/login.html', url)
  if (url.pathname !== '/') login.searchParams.set('next', url.pathname + url.search)
  return Response.redirect(login, 307)
}
