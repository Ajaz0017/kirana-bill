// POST   /api/auth { pin }  -> sets the session cookie if the PIN matches APP_PIN
// GET    /api/auth          -> { ok } whether this browser is unlocked
// DELETE /api/auth          -> lock this browser again
import { createSession, isAuthed, isConfigured, safeEqual, sessionCookie } from './_auth.js'

// Best-effort brute-force brake. Serverless instances don't share memory, so this slows an
// attacker down rather than stopping one: a 6+ digit PIN is the real protection.
const MAX_FAILS = 5
const LOCK_MS = 5 * 60 * 1000
const fails = new Map() // ip -> { count, until }

const clientIp = (request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function POST(request) {
  const env = process.env
  if (!isConfigured(env)) {
    return Response.json({ error: 'Server pe APP_PIN aur AUTH_SECRET set nahi hain' }, { status: 500 })
  }

  const ip = clientIp(request)
  const entry = fails.get(ip)
  if (entry && entry.until > Date.now()) {
    const mins = Math.ceil((entry.until - Date.now()) / 60000)
    return Response.json({ error: `Bahut baar galat PIN. ${mins} minute baad try karein` }, { status: 429 })
  }

  const { pin } = (await request.json().catch(() => null)) ?? {}
  if (!safeEqual(String(pin ?? '').trim(), String(env.APP_PIN).trim())) {
    const count = (entry?.count ?? 0) + 1
    fails.set(ip, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 })
    await wait(800) // makes guessing slow even within the limit
    const left = MAX_FAILS - count
    return Response.json(
      { error: left > 0 ? `Galat PIN. ${left} koshish baaki` : 'Bahut baar galat PIN. 5 minute baad try karein' },
      { status: 401 },
    )
  }

  fails.delete(ip)
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(request, await createSession(env)) } })
}

export async function GET(request) {
  return Response.json({ ok: await isAuthed(request, process.env) })
}

export async function DELETE(request) {
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(request, null) } })
}
