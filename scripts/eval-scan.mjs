// Scan accuracy check against real bills.
//
//   npm run eval                 # every photo in test-bills/
//   npm run eval -- my-bills     # another folder
//   npm run eval -- test-bills bill-4   # only photos whose name contains "bill-4"
//
// The folder holds bill photos (.jpg/.png/.webp) and answers.json (correct items per photo, see
// test-bills/answers.json). Photos without an answer are scanned and written to answers.todo.json:
// fix the mistakes there, then move those entries into answers.json.
// Uses the same api/scan.js + name cleanup as the app, with keys from .env (each photo = 1–2 AI calls).
import fs from 'node:fs'
import path from 'node:path'
import { scan } from '../api/scan.js'
import { CATALOG_NAMES } from '../src/data/catalog.js'
import { createNameMatcher, nameKey } from '../src/utils/itemNames.js'

const dir = path.resolve(process.argv[2] ?? 'test-bills')
const env = { ...readEnv('.env'), ...process.env }
const answersFile = path.join(dir, 'answers.json')
const answers = fs.existsSync(answersFile) ? JSON.parse(fs.readFileSync(answersFile, 'utf8')) : {}
const photos = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && f.includes(process.argv[3] ?? '')).sort()
const matchName = createNameMatcher()
const GAP_MS = 4000 // stay under the free tier's per-minute limit

function readEnv(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const same = (a, b) => (a == null || a === '' ? b == null || b === '' : Math.abs(Number(a) - Number(b)) < 0.001)
const fmt = (it) => (it ? `${it.name} ${it.qty ?? '?'} ${it.unit} @${it.rate ?? '-'} = ${it.amount ?? '?'}` : '—')

let fields = 0
let correct = 0
const todo = {}
for (const [i, file] of photos.entries()) {
  if (i) await new Promise((r) => setTimeout(r, GAP_MS))
  const id = file.replace(/\.[^.]+$/, '')
  const image = fs.readFileSync(path.join(dir, file)).toString('base64')
  const mimeType = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg'
  const started = Date.now()
  let result
  try {
    result = await scan({ image, mimeType, hints: CATALOG_NAMES }, env)
  } catch (e) {
    console.log(`\n✗ ${file}: ${e.message}`)
    continue
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  const got = result.items.map((it) => ({ ...it, name: matchName(it.name).name }))
  const want = answers[id]?.items

  if (!want) {
    todo[id] = { note: 'Scan se aaya. Galtiyan theek karke answers.json mein daalein.', items: got.map(({ uncertain: _uncertain, ...it }) => it) }
    console.log(`\n? ${file} (${result.provider}, ${secs}s): answer nahi hai, answers.todo.json mein likha`)
    continue
  }

  console.log(`\n■ ${file}  (${result.provider}, ${secs}s, bill total ${result.billTotal ?? '-'})`)
  const left = [...got]
  for (const w of want) {
    const idx = left.findIndex((g) => nameKey(g.name) === nameKey(w.name))
    const g = idx >= 0 ? left.splice(idx, 1)[0] : null
    const checks = [!!g, g && same(g.qty, w.qty), g && g.unit === w.unit, g && same(g.rate, w.rate), g && same(g.amount, w.amount)]
    fields += checks.length
    correct += checks.filter(Boolean).length
    const ok = checks.every(Boolean)
    console.log(`  ${ok ? '✓' : '✗'} ${fmt(g).padEnd(40)} ${ok ? '' : `| sahi: ${fmt(w)}`}`)
  }
  for (const extra of left) {
    fields += 1 // an invented/extra line counts against accuracy
    console.log(`  ✗ ${fmt(extra).padEnd(40)} | yeh bill mein nahi hona chahiye tha`)
  }
}

if (Object.keys(todo).length) {
  fs.writeFileSync(path.join(dir, 'answers.todo.json'), JSON.stringify(todo, null, 2) + '\n')
}
if (fields) console.log(`\nAccuracy: ${correct}/${fields} fields sahi (${((100 * correct) / fields).toFixed(1)}%)`)
