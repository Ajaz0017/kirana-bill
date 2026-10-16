import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// Same paths middleware.js's matcher leaves open on Vercel
const PUBLIC_PATHS = ['/lock.html', '/api/auth', '/favicon.svg']

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
        if (!PUBLIC_PATHS.includes(path)) {
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), vercelLocal(loadEnv(mode, process.cwd(), ''))],
}))
