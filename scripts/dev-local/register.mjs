// Loaded with `node --import` by `npm run dev:local`: swaps Neon for a local PGlite database
// and fills in the env vars the API needs, so the app runs with zero setup.
import { register } from 'node:module'

register('./hooks.mjs', import.meta.url)

process.env.DATABASE_URL ||= 'pglite://local' // any value: the local driver ignores it
process.env.AUTH_SECRET ||= 'dev-local-only-secret'

console.log('\n  🗄️  Local database: .pglite/ (Neon ki zaroorat nahi). Reset: npm run dev:local:reset\n')
