// Shared PIN-session helpers for middleware.js, api/auth.js and api/scan.js.
// The "_" prefix keeps Vercel from exposing this file as its own endpoint.
//
// APP_PIN     the PIN people type (server-only env var, never sent to the browser)
// AUTH_SECRET long random string used to sign the session cookie (e.g. `openssl rand -hex 32`)
//
// Session = HttpOnly cookie "<expiry>.<HMAC(AUTH_SECRET, expiry + APP_PIN)>".
// JavaScript in the page can't read it, and changing APP_PIN logs every device out.

export const COOKIE = 'kb_session'
const MAX_AGE_S = 30 * 24 * 60 * 60 // stay unlocked for 30 days per device

const enc = new TextEncoder()
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const isConfigured = (env) => !!(env.APP_PIN && env.AUTH_SECRET)

async function sign(env, payload) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(`${payload}:${env.APP_PIN}`)))
}

// Constant-time compare so response timing doesn't leak how much of a value matched
export function safeEqual(a, b) {
  const x = enc.encode(String(a))
  const y = enc.encode(String(b))
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export async function createSession(env) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S
  return `${exp}.${await sign(env, exp)}`
}

export async function isValidSession(token, env) {
  if (!isConfigured(env) || typeof token !== 'string') return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false
  return safeEqual(sig, await sign(env, exp))
}

export function readCookie(request, name = COOKIE) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export const isAuthed = (request, env) => isValidSession(readCookie(request), env)

// `Secure` only over https, so local http testing (phone on LAN) still works
export function sessionCookie(request, token) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return token
    ? `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`
    : `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}
