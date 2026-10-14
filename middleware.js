// Vercel Routing Middleware: nothing (app, JS bundle, stamp/signature images, APIs) is served
// until the browser has a valid PIN session. Locked visitors only ever see /lock.html.
import { next } from '@vercel/functions'
import { isAuthed } from './api/_auth.js'

// Everything except the lock screen, its PIN endpoint and the favicon
export const config = {
  matcher: ['/((?!lock\\.html|api/auth|favicon\\.svg).*)'],
}

export default async function middleware(request) {
  if (await isAuthed(request, process.env)) return next()

  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) {
    return Response.json({ error: 'PIN se unlock karein', locked: true }, { status: 401 })
  }
  const lock = new URL('/lock.html', url)
  if (url.pathname !== '/') lock.searchParams.set('next', url.pathname + url.search)
  return Response.redirect(lock, 307)
}
