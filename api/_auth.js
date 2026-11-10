// Shared login-session helpers for middleware.js and the api/ files.
// The "_" prefix keeps Vercel from exposing this file as its own endpoint.
//
// AUTH_SECRET long random string used to sign the session cookie (e.g. `openssl rand -hex 32`).
//             Changing it logs every device out.
//
// Session = HttpOnly cookie "<userId>.<expiry>.<HMAC(AUTH_SECRET, userId.expiry)>".
// Checking it needs no database call, so middleware stays fast. JavaScript in the page can't read it.

export const COOKIE = 'kb_session'
const MAX_AGE_S = 30 * 24 * 60 * 60 // stay logged in for 30 days per device

const enc = new TextEncoder()
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export const isConfigured = (env) => !!env.AUTH_SECRET

async function sign(env, payload) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
}

// Constant-time compare so response timing doesn't leak how much of a value matched
export function safeEqual(a, b) {
  const x = enc.encode(String(a))
  const y = enc.encode(String(b))
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export async function createSession(env, userId) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + MAX_AGE_S}`
  return `${payload}.${await sign(env, payload)}`
}

/** -> { userId } for a valid, unexpired session cookie, else null */
export async function readSession(token, env) {
  if (!isConfigured(env) || typeof token !== 'string') return null
  const [uid, exp, sig] = token.split('.')
  if (!/^\d+$/.test(uid ?? '') || !exp || !sig || Number(exp) < Date.now() / 1000) return null
  return safeEqual(sig, await sign(env, `${uid}.${exp}`)) ? { userId: Number(uid) } : null
}

export function readCookie(request, name = COOKIE) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export const getSession = (request, env) => readSession(readCookie(request), env)
export const isAuthed = async (request, env) => !!(await getSession(request, env))

export const unauthorized = () => Response.json({ error: 'Pehle login karein', loggedOut: true }, { status: 401 })

// `Secure` only over https, so local http testing (phone on LAN) still works
export function sessionCookie(request, token) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return token
    ? `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`
    : `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

// ---- Passwords: PBKDF2-SHA512 (Web Crypto, no native modules). Stored as "pbkdf2$iter$salt$hash".
const ITERATIONS = 210_000

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return b64url(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-512', salt, iterations }, key, 256))
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${b64url(salt)}$${await derive(password, salt, ITERATIONS)}`
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored ?? '').split('$')
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false
  return safeEqual(hash, await derive(password, fromB64url(salt), Number(iter)))
}
