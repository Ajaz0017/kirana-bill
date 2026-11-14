import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Same paths middleware.js's matcher leaves open on Vercel (exact paths, or prefixes ending in "/").
// The public shop pages (/s/, /o/, /api/public, built JS/CSS) are let through by middleware.js itself.
const PUBLIC_PATHS = ['/login.html', '/api/auth', '/favicon.svg', '/manifest.webmanifest', '/icons/', '/sw.js', '/registerSW.js', '/push-sw.js']
// Local dev only: Vite serves source modules from these paths, which the public shop page needs too
const DEV_MODULES = ['/@', '/src/', '/node_modules/']
const isPublic = (path) =>
  PUBLIC_PATHS.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p)) ||
  path.startsWith('/workbox-') ||
  DEV_MODULES.some((p) => path.startsWith(p))

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
 * and /api/<name> runs the matching export (GET/POST/PATCH/DELETE) of api/<name>.js.
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
        // Same as vercel.json rewrites: customers' shop / order links open the public page
        if (/^\/[so]\/[^/]+$/.test(path) || path === '/orders') {
          req.url = '/shop.html'
          return nextMw()
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
 * Pages always come from the network first, so middleware.js still checks the login when online;
 * the cached copy is used only when the network fails (offline = "last login still counts").
 * Redirected answers (the login screen) are never cached as the app.
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  // Registered from src/main.jsx (the billing app) only: customers opening the public shop page
  // shouldn't download the whole app into their phone's cache
  injectRegister: false,
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
    globIgnores: ['**/index.html', '**/login.html', '**/shop.html'],
    navigateFallback: null,
    // New-order notifications (Phase 8.2): push + notification-click handlers
    importScripts: ['push-sw.js'],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst', // no timeout on purpose: a slow network must not skip the login check
        options: {
          cacheName: 'pages',
          plugins: [{ cacheWillUpdate: async ({ response }) => (response?.ok && !response.redirected ? response : null) }],
        },
      },
    ],
  },
})

// The PWA plugin adds the app's manifest link to every page (after all HTML hooks); the customers'
// shop page must not offer to install the billing app, so it's taken out of the written file
const noManifestOnShopPage = () => {
  let outDir = 'dist'
  return {
    name: 'no-manifest-on-shop-page',
    apply: 'build',
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle: () => {
      const file = resolve(outDir, 'shop.html')
      if (existsSync(file)) writeFileSync(file, readFileSync(file, 'utf8').replace(/\s*<link rel="manifest"[^>]*>/g, ''))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), vercelLocal(loadEnv(mode, process.cwd(), '')), pwa, noManifestOnShopPage()],
  build: {
    // Two pages: the billing app (login needed) and the light public shop page for customers
    rolldownOptions: { input: { main: resolve('index.html'), shop: resolve('shop.html') } },
  },
}))
