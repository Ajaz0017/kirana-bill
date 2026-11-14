// Web Push: free notifications through the browsers' own push services (Google / Mozilla / Apple).
// The "_" prefix keeps Vercel from exposing this file as its own endpoint.
//
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  generate once with:  npx web-push generate-vapid-keys
// VAPID_SUBJECT (optional)              "mailto:you@example.com" or "https://your-site"; defaults to the site URL
import webpush from 'web-push'

export const pushConfigured = (env = process.env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)

const SEND_TIMEOUT_MS = 3000 // the customer is waiting on the order; don't hold them up for a slow push

/**
 * Notify every phone the shop's owner turned notifications on for. Subscriptions the push service
 * says are gone (phone changed, permission removed) are deleted, so nothing piles up.
 * Never throws: a failed notification must not fail the order.
 */
export async function notifyShopOwner(q, shopId, payload, origin) {
  const env = process.env
  if (!pushConfigured(env)) return
  try {
    const subs = await q.query(
      `select p.id::text as id, p.endpoint, p.p256dh, p.auth from push_subs p join shops s on s.owner_id = p.user_id where s.id = $1`,
      [shopId],
    )
    if (!subs.length) return
    const subject = env.VAPID_SUBJECT || (origin?.startsWith('https://') ? origin : 'mailto:no-reply@kirana-bill.app')
    const body = JSON.stringify(payload)
    const send = Promise.allSettled(
      subs.map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            TTL: 6 * 60 * 60, // a phone that's off for a few hours still gets it when it's back
            urgency: 'high',
            vapidDetails: { subject, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
          })
          .catch(async (e) => {
            if (e.statusCode === 404 || e.statusCode === 410) await q.query(`delete from push_subs where id = $1::bigint`, [s.id])
            else console.warn('push failed', e.statusCode ?? e.message)
          }),
      ),
    )
    await Promise.race([send, new Promise((r) => setTimeout(r, SEND_TIMEOUT_MS))])
  } catch (e) {
    console.warn('push skipped', e.message)
  }
}
