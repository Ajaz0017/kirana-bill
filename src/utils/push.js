import { api } from './api'

// New-order notifications on this phone (Web Push). Free: the browser's own push service delivers them.

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// iPhone shows web notifications only for an app added to the Home Screen (iOS 16.4+)
export const needsHomeScreen = () => isIOS() && !standalone()

// The service worker is registered by the app build (none in `npm run dev`), so don't wait forever
async function registration() {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 4000))])
  if (!reg) throw new Error('Notification installed / live app mein chalti hai (dev mode mein nahi)')
  return reg
}

/** 'unsupported' | 'ios-home' | 'denied' | 'on' | 'off' */
export async function pushState() {
  if (needsHomeScreen()) return 'ios-home'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise((r) => setTimeout(() => r(null), 1500))])
    const sub = await reg?.pushManager.getSubscription()
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

const keyBytes = (base64url) => {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** Ask permission, subscribe this phone, and tell the server. Throws a user-facing Error. */
export async function enablePush() {
  if (needsHomeScreen()) throw new Error('iPhone pe pehle Share → "Add to Home Screen" se app install karein, phir wahan se chalu karein')
  if (!pushSupported()) throw new Error('Is browser mein notification nahi chalti')
  const { publicKey } = await api('/api/shops?push=key')
  if (!publicKey) throw new Error('Server pe notification abhi set nahi hai (VAPID key)')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification ki permission nahi mili. Browser settings mein allow karein')
  const reg = await registration()
  let sub
  try {
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  } catch (e) {
    console.warn('push subscribe failed', e)
    throw new Error('Is phone pe notification chalu nahi ho payi. Chrome / phone settings mein is site ki notification allow karke dobara try karein')
  }
  await api('/api/shops?push', { method: 'POST', body: sub.toJSON() })
}

/** Stop notifications on this phone (also used on logout, so the next account doesn't get them) */
export async function disablePush() {
  if (!pushSupported()) return
  const reg = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise((r) => setTimeout(() => r(null), 1500))])
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await api('/api/shops?push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}
