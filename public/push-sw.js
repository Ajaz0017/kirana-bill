// Loaded into the app's service worker (vite.config.js → workbox.importScripts).
// Shows the new-order notification the server pushes, and opens Orders when it's tapped.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data && event.data.text() }
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Kirana Bill', {
        body: data.body || 'Naya order aaya hai',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag, // same order twice = one notification
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: data.url || '/?open=orders' },
      }),
      // An open app refreshes its "new orders" badge right away
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage({ type: 'new-order' }))),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/?open=orders'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin)
      if (open) {
        open.postMessage({ type: 'open-orders' })
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
