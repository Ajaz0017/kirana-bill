// Vercel Routing Middleware: the billing app and its APIs need a valid login session.
// Logged-out visitors only see /login.html, plus the public shop pages customers open from a
// QR code / link (/s/<slug>, /o/<code>) and the code those pages need. Images in /assets (the
// default stamp and signature) stay behind the login.
import { next } from '@vercel/functions'
import { isAuthed } from './api/_auth.js'

// Everything except the login screen, its endpoint, and the harmless install files (icons,
// manifest, service worker) that browsers fetch without cookies; keep in sync with vite.config.js
export const config = {
  matcher: ['/((?!login\\.html|api/auth|favicon\\.svg|manifest\\.webmanifest|icons/|sw\\.js|registerSW\\.js|push-sw\\.js|workbox-).*)'],
}

// Customers' pages: no login. Keep in sync with vite.config.js (local dev) and vercel.json rewrites.
export const isOpenPath = (path) =>
  path === '/shop.html' ||
  path.startsWith('/s/') ||
  path.startsWith('/o/') ||
  path === '/orders' ||
  path === '/api/public' ||
  /^\/assets\/[^/]+\.(?:js|css|woff2?)$/.test(path)

export default async function middleware(request) {
  const url = new URL(request.url)
  if (isOpenPath(url.pathname)) return next()
  if (await isAuthed(request, process.env)) return next()

  if (url.pathname.startsWith('/api/')) {
    return Response.json({ error: 'Pehle login karein', loggedOut: true }, { status: 401 })
  }
  const login = new URL('/login.html', url)
  if (url.pathname !== '/') login.searchParams.set('next', url.pathname + url.search)
  return Response.redirect(login, 307)
}
