// Local stand-in for @neondatabase/serverless, used only by `npm run dev:local`.
// PGlite is real Postgres compiled to WASM: same SQL as Neon, no account or server needed.
// Data is kept in <project>/.pglite, so it survives restarts (`npm run dev:local:reset` wipes it).
import { PGlite } from '@electric-sql/pglite'
import { fileURLToPath } from 'node:url'

const dataDir = fileURLToPath(new URL('../../.pglite', import.meta.url))
let pg = null
const db = () => (pg ??= new PGlite(dataDir))

// Same call shapes the api/ files use: sql`... ${value}` and sql.query(text, params)
export function neon() {
  const run = async (text, params = []) => (await db().query(text, params)).rows
  const sql = (strings, ...values) => run(strings.reduce((acc, s, i) => `${acc}$${i}${s}`), values)
  sql.query = run
  return sql
}
