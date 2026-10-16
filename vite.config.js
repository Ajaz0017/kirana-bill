import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Same paths middleware.js's matcher leaves open on Vercel (exact paths, or prefixes ending in "/")
const PUBLIC_PATHS = ['/lock.html', '/api/auth', '/favicon.svg', '/manifest.webmanifest', '/icons/', '/sw.js', '/registerSW.js']
const isPublic = (path) => PUBLIC_PATHS.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p)) || path.startsWith('/workbox-')

// Node req -> Web Request, so the Vercel files run unchanged
async function toRequest(req) {
  const chunks = []
  if (req.method !== 'GET' && req.method !== 'HEAD') for await (const c of req) chunks.push(c)
  const headers = new Headers()
  for (const h of ['cookie', 'content-type', 'x-forwarded-for']) if (req.headers[h]) headers.set(h, req.headers[h])
  return new Request(`http://${req.headers.host}${req.originalUrl ?? req.url}`, {
    method: req.method,
    headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  })
}

async function send(res, response) {
  res.statusCode = response.status
  response.headers.forEach((v, k) => k !== 'set-cookie' && res.setHeader(k, v))
  const cookies = response.headers.getSetCookie()
  if (cookies.length) res.setHeader('set-cookie', cookies)
  res.end(Buffer.from(await response.arrayBuffer()))
}

/**
 * Mimics Vercel locally (`npm run dev` / `npm run preview`): middleware.js guards every request,
 * and /api/<name> runs the matching export (POST/GET/DELETE) of api/<name>.js.
 * Secrets come from .env and are never VITE_-prefixed, so they stay out of the browser bundle.
 */
const vercelLocal = (env) => {
  Object.assign(process.env, env)
  const install = (server, load) => {
    server.middlewares.use(async (req, res, nextMw) => {
      try {
        const path = (req.originalUrl ?? req.url).split('?')[0]
        // A Node request body can be read only once, so build the Web Request once and clone it
        const request = await toRequest(req)
        if (!isPublic(path)) {
          const { default: middleware } = await load('/middleware.js')
          const gate = await middleware(request.clone())
          if (!gate.headers.get('x-middleware-next')) return send(res, gate)
        }
        const api = path.match(/^\/api\/([\w-]+)$/)
        if (!api) return nextMw()
        const mod = await load(`/api/${api[1]}.js`).catch(() => null)
        const handler = mod?.[req.method]
        if (!handler) return send(res, Response.json({ error: 'Not found' }, { status: 404 }))
        return send(res, await handler(request))
      } catch (e) {
        console.error(e)
        return send(res, Response.json({ error: e.message }, { status: 500 }))
      }
    })
  }
  return {
    name: 'vercel-local',
    configureServer: (server) => install(server, (id) => server.ssrLoadModule(id)),
    // `vite preview` has no module loader; plain imports work there
    configurePreviewServer: (server) => install(server, (id) => import(pathToFileURL(resolve(id.slice(1))).href)),
  }
}

/**
 * Installable app + offline manual mode.
 * Pages always come from the network first, so middleware.js still checks the PIN when online;
 * the cached copy is used only when the network fails (offline = "last unlock still counts").
 * Redirected answers (the lock screen) are never cached as the app.
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Kirana Bill',
    short_name: 'Kirana Bill',
    description: 'Bill of Supply, seconds mein. Handwritten bill scan karke items bharein.',
    lang: 'hi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#7c3aed',
    background_color: '#f5f3ff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,woff2,png,jpg,svg}'],
    globIgnores: ['**/index.html', '**/lock.html'],
    navigateFallback: null,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst', // no timeout on purpose: a slow network must not skip the PIN check
        options: {
          cacheName: 'pages',
          plugins: [{ cacheWillUpdate: async ({ response }) => (response?.ok && !response.redirected ? response : null) }],
        },
      },
    ],
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), vercelLocal(loadEnv(mode, process.cwd(), '')), pwa],
}))
