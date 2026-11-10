// POST   /api/auth { mode: 'login' | 'signup', email, password, name?, code? } -> sets the session cookie
// GET    /api/auth          -> { user } for the logged-in browser, or { user: null, signupNeedsCode }
// DELETE /api/auth          -> log this browser out
import { createSession, getSession, hashPassword, isConfigured, safeEqual, sessionCookie, verifyPassword } from './_auth.js'
import { fail, httpError, sql } from './_db.js'

// Best-effort brute-force brake. Serverless instances don't share memory, so this slows an
// attacker down rather than stopping one.
const MAX_FAILS = 5
const LOCK_MS = 5 * 60 * 1000
const fails = new Map() // ip|email -> { count, until }

const clientIp = (request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A hash of nothing, so a login for an unknown email takes as long as one for a real account
let dummyHash = null

export async function POST(request) {
  const env = process.env
  try {
    if (!isConfigured(env)) throw httpError(500, 'Server pe AUTH_SECRET set nahi hai')
    const body = (await request.json().catch(() => null)) ?? {}
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    if (!EMAIL_RE.test(email) || email.length > 200) throw httpError(400, 'Sahi email daalein')

    const q = await sql()

    if (body.mode === 'signup') {
      if (env.SIGNUP_CODE && !safeEqual(String(body.code ?? '').trim(), env.SIGNUP_CODE.trim())) {
        await wait(800)
        throw httpError(403, 'Signup code galat hai')
      }
      const name = String(body.name ?? '').trim().slice(0, 80)
      if (!name) throw httpError(400, 'Apna naam daalein')
      if (password.length < 8) throw httpError(400, 'Password kam se kam 8 akshar ka rakhein')
      if (password.length > 200) throw httpError(400, 'Password bahut lamba hai')
      const rows = await q`
        insert into users (email, name, pass_hash) values (${email}, ${name}, ${await hashPassword(password)})
        on conflict (email) do nothing
        returning id, email, name`
      if (!rows.length) throw httpError(409, 'Is email se account pehle se hai, login karein')
      return loggedIn(request, env, rows[0])
    }

    const key = `${clientIp(request)}|${email}`
    const entry = fails.get(key)
    if (entry && entry.until > Date.now()) {
      throw httpError(429, `Bahut baar galat password. ${Math.ceil((entry.until - Date.now()) / 60000)} minute baad try karein`)
    }
    const [user] = await q`select id, email, name, pass_hash from users where email = ${email}`
    dummyHash ??= await hashPassword('')
    const ok = await verifyPassword(password, user?.pass_hash ?? dummyHash)
    if (!user || !ok) {
      const count = (entry?.count ?? 0) + 1
      fails.set(key, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 })
      await wait(600)
      throw httpError(401, 'Email ya password galat hai')
    }
    fails.delete(key)
    return loggedIn(request, env, user)
  } catch (e) {
    return fail(e)
  }
}

async function loggedIn(request, env, user) {
  return Response.json(
    { user: { id: Number(user.id), email: user.email, name: user.name } },
    { headers: { 'set-cookie': sessionCookie(request, await createSession(env, user.id)) } },
  )
}

export async function GET(request) {
  const env = process.env
  try {
    const session = await getSession(request, env)
    if (!session) return Response.json({ user: null, signupNeedsCode: !!env.SIGNUP_CODE })
    const q = await sql()
    const [user] = await q`select id, email, name from users where id = ${session.userId}`
    // Account gone (e.g. deleted from the database): drop the stale cookie
    if (!user) return Response.json({ user: null }, { headers: { 'set-cookie': sessionCookie(request, null) } })
    return Response.json({ user: { id: Number(user.id), email: user.email, name: user.name } })
  } catch (e) {
    return fail(e)
  }
}

export async function DELETE(request) {
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(request, null) } })
}
