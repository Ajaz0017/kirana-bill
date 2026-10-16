// POST /api/scan  { image: <base64>, mimeType: "image/jpeg" }  ->  { items, notes, billTotal, provider }
// Reads a handwritten kirana bill with a vision model. Order: Gemini Flash -> Gemini Flash-Lite
// (separate capacity, so often free when Flash is "high demand") -> Zhipu GLM-Flash if GLM_API_KEY is set.
// Each model gets a time limit so one slow/overloaded model can't eat the whole request
// (Vercel stops the function at 60s, see vercel.json).
// Keys live only in server env vars (Vercel project settings / local .env).

import { isAuthed } from './_auth.js'

const PROMPT = `You read handwritten Indian kirana (grocery) bills. The writing mixes Hindi (Devanagari) and English/Hinglish.
Extract every purchased line item, top to bottom, in the order written.

Names:
- Write names in Roman script (Hinglish): "दाल अरहर" -> "Daal Arhar", "चीनी" -> "Cheeni". Keep brand names as written (e.g. "Parle G", "Tata Namak").
- If a line is a ditto mark (〃, ", '', "do", "वही") it repeats the item/value from the line above.

Numbers:
- Devanagari digits: ० १ २ ३ ४ ५ ६ ७ ८ ९ = 0–9. Ignore "₹", "Rs", "/-", "=" and commas around numbers.
- Fractions: "½"/"1/2"/"आधा"/"aadha" = 0.5, "¼"/"पाव"/"paav" = 0.25, "¾"/"पौना"/"pauna" = 0.75, "सवा X" = X + 0.25, "साढ़े X" = X + 0.5, "पौने X" = X − 0.25, "डेढ़" = 1.5, "ढाई" = 2.5.
- A line may be written as "qty × rate = amount", "qty @ rate", or just name + amount.

Units:
- unit: one of kg, gm, ltr, ml, pcs, pkt, dozen, box. "किलो"/"कि."/"kilo" = kg, "ग्राम"/"ग्रा."/"g" = gm, "लीटर"/"ली."/"L" = ltr, "नग"/"pc"/"nos" = pcs, "पैकेट"/"pkt" = pkt, "दर्जन"/"dz" = dozen. No unit written: use pcs for countable things (eggs, soap, packets) and kg for loose grains.
- qty must be in the unit the rate is quoted in. Rate per kg but qty "250 gm" -> qty 0.25, unit kg. Rate per kg but qty "500 g" -> 0.5 kg.

Values:
- rate: price per one unit, or null if not written. amount: the line total as written. If amount is missing but qty and rate exist, use qty × rate.
- Never invent values. If you cannot read a value, use null and set uncertain: true.
- uncertain: true if anything was hard to read or guessed, or if qty × rate does not match the written amount (keep the written amount).

Ignore: crossed-out/scribbled lines, the Total/Grand total/कुल/टोटल line, subtotals, previous balance (बकाया/udhaar), dates, phone numbers, customer name and the shop header.
- billTotal: the grand total written on the bill (number), or null if there is none. Do NOT add it as an item.
- notes: short Hinglish notes about problems (e.g. "Item 3 ka rate saaf nahi hai"). Empty if none.
Return only JSON.`

const MAX_HINTS = 200

// The shop's item names make the model prefer familiar spellings ("Atta" not "Aata")
function buildPrompt(hints) {
  const names = (Array.isArray(hints) ? hints : [])
    .filter((h) => typeof h === 'string')
    .map((h) => h.replace(/[\n\r,]+/g, ' ').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, MAX_HINTS)
  return names.length
    ? `${PROMPT}\n\nItems this shop usually sells. When a line is one of these, use exactly this spelling; otherwise write the name as read:\n${names.join(', ')}`
    : PROMPT
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          qty: { type: 'NUMBER', nullable: true },
          unit: { type: 'STRING' },
          rate: { type: 'NUMBER', nullable: true },
          amount: { type: 'NUMBER', nullable: true },
          uncertain: { type: 'BOOLEAN' },
        },
        required: ['name', 'unit', 'uncertain'],
      },
    },
    billTotal: { type: 'NUMBER', nullable: true },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['items'],
}

const MAX_BASE64 = 4_000_000 // Vercel caps request bodies at 4.5 MB
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

class ScanError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const TOTAL_BUDGET_MS = 55_000
const FIRST_MODEL_MS = 20_000 // the main Flash model is often slow when it's "high demand"
const NEXT_MODEL_MS = 30_000

// fetch that turns a timeout into a ScanError so the next model gets its turn
async function post(url, init, timeoutMs, label) {
  try {
    return await fetch(url, { ...init, method: 'POST', signal: AbortSignal.timeout(timeoutMs) })
  } catch (e) {
    if (e.name === 'TimeoutError') throw new ScanError(504, `${label} ${timeoutMs / 1000}s mein jawab nahi aaya`)
    throw new ScanError(502, `${label} tak nahi pahunch paye: ${e.message}`)
  }
}

// No thinkingConfig: Flash-Lite rejects thinkingBudget, and it doesn't think by default anyway
async function askGemini({ image, mimeType, prompt }, env, model, timeoutMs) {
  const res = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: image } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  }, timeoutMs, model)
  if (!res.ok) throw new ScanError(res.status, `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (!text) throw new ScanError(502, `Gemini ne jawab nahi diya (${data.candidates?.[0]?.finishReason ?? 'empty'})`)
  return text
}

// Zhipu / Z.ai speaks the OpenAI chat format
async function askGlm({ image, mimeType, prompt }, env, timeoutMs) {
  const base = env.GLM_BASE_URL || 'https://api.z.ai/api/paas/v4'
  const res = await post(`${base}/chat/completions`, {
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GLM_API_KEY}` },
    body: JSON.stringify({
      model: env.GLM_MODEL || 'glm-4.6v-flash',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
            {
              type: 'text',
              text: `${prompt}\nJSON shape: {"items":[{"name":"","qty":0,"unit":"kg","rate":0,"amount":0,"uncertain":false}],"billTotal":0,"notes":[]}`,
            },
          ],
        },
      ],
    }),
  }, timeoutMs, 'GLM')
  if (!res.ok) throw new ScanError(res.status, `GLM ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// Models sometimes wrap JSON in prose or ``` fences
function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new ScanError(502, 'AI ka jawab JSON nahi tha')
  return JSON.parse(text.slice(start, end + 1))
}

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.]/g, '')) : v
  return Number.isFinite(n) && n > 0 ? n : null
}

function clean(result) {
  const items = (Array.isArray(result?.items) ? result.items : [])
    .map((it) => ({
      name: String(it?.name ?? '').trim(),
      qty: num(it?.qty),
      unit: String(it?.unit ?? '').trim().toLowerCase(),
      rate: num(it?.rate),
      amount: num(it?.amount),
      uncertain: !!it?.uncertain,
    }))
    .filter((it) => it.name)
  const notes = (Array.isArray(result?.notes) ? result.notes : []).map(String).filter(Boolean)
  return { items, notes, billTotal: num(result?.billTotal) }
}

export async function scan(body, env) {
  const { image, mimeType = 'image/jpeg', hints } = body ?? {}
  const prompt = buildPrompt(hints)
  if (typeof image !== 'string' || !image) throw new ScanError(400, 'Photo nahi mili')
  if (image.length > MAX_BASE64) throw new ScanError(413, 'Photo bahut badi hai')
  if (!MIME_TYPES.includes(mimeType)) throw new ScanError(415, 'Sirf JPG/PNG/WebP photo chalegi')
  if (!env.GEMINI_API_KEY && !env.GLM_API_KEY) throw new ScanError(500, 'Server pe GEMINI_API_KEY set nahi hai')

  const geminiModels = [...new Set([env.GEMINI_MODEL || 'gemini-flash-latest', env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest'])]
  const providers = [
    ...(env.GEMINI_API_KEY ? geminiModels.map((m) => [m, (input, ms) => askGemini(input, env, m, ms)]) : []),
    ...(env.GLM_API_KEY ? [[env.GLM_MODEL || 'glm', (input, ms) => askGlm(input, env, ms)]] : []),
  ]

  // Busy (503) / slow models are skipped rather than retried: the next model has its own capacity
  const deadline = Date.now() + TOTAL_BUDGET_MS
  const errors = []
  for (const [i, [provider, ask]] of providers.entries()) {
    const ms = Math.min(i === 0 ? FIRST_MODEL_MS : NEXT_MODEL_MS, deadline - Date.now())
    if (ms < 3000) break
    try {
      return { ...clean(parseJson(await ask({ image, mimeType, prompt }, ms))), provider }
    } catch (e) {
      errors.push(e)
      console.error(`[scan] ${provider} failed:`, e.message)
      // A bad photo won't get better with another model
      if (e.status === 400 && /image|inline_data/i.test(e.message)) break
    }
  }
  if (errors.every((e) => e.status === 429)) throw new ScanError(429, 'Aaj ki free scan limit khatam ho gayi, thodi der baad try karein')
  if (errors.some((e) => e.status === 503 || e.status === 504)) throw new ScanError(503, 'Google ka AI abhi bahut busy hai, 1–2 minute baad dobara try karein')
  throw new ScanError(502, 'AI se bill nahi padha gaya, dobara try karein')
}

// Vercel Function (Web standard signature)
export async function POST(request) {
  // middleware.js already blocks locked browsers; checked again so the AI quota is never exposed
  if (!(await isAuthed(request, process.env))) {
    return Response.json({ error: 'PIN se unlock karein', locked: true }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => null)
    return Response.json(await scan(body, process.env))
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
