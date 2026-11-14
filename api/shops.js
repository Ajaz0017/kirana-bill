// Shops and their rate lists. Every user can own one shop; only the owner can change it.
// A private shop answers 404 to everyone else, so nobody can even tell it exists.
//
// GET /api/shops?mine=1        -> { shop | null, items }            the caller's own shop
// GET /api/shops?slug=X        -> { shop, items }                   public shop, or the caller's own
// GET /api/shops?history=ID    -> { item, days, paise }             one item's rate history (for the graph)
// GET /api/shops?q=&offset=    -> { shops: [...], hasMore }         public shops, recently updated first
// PUT /api/shops { shop, items? } -> { shop, items }                create/update own shop (+ whole rate list)
import { getSession, unauthorized } from './_auth.js'
import { fail, httpError, sql } from './_db.js'

// Keep in sync with src/constants.js
const UNITS = ['kg', 'gm', 'ltr', 'ml', 'pcs', 'pkt', 'dozen', 'box']
const PAGE = 20
const MAX_ITEMS = 1000
const MAX_BYTES = 400_000
const MAX_RATE = 10_000_000 // ₹1 crore per unit is surely a typo
const HISTORY_DAYS = 730 // keep two years of rate changes

// Rate history dates are day numbers (days since 1 Jan 2025, India time): 4 bytes instead of 8
const EPOCH = Date.UTC(2025, 0, 1)
const IST_MS = 330 * 60 * 1000
export const dayNumber = (ms = Date.now()) => Math.floor((ms + IST_MS - EPOCH) / 86_400_000)

const str = (v, max) => String(v ?? '').trim().slice(0, max)
const isId = (v) => /^\d{1,18}$/.test(String(v ?? ''))

const SHOP_COLS = `id::text as id, owner_id::text as owner_id, slug, name, address, city, mobile,
  upi_id, upi_name, upi_mobile, is_public, updated_at`
// Rate history arrays stay out of list answers: only the graph needs them
const ITEM_COLS = `id::text as id, name, unit, rate_paise, category, in_stock, slab_qty, slab_paise,
  hist_days[cardinality(hist_days)] as changed_day`
const MAX_SLABS = 6

function shopOut(r, userId) {
  const owner = r.owner_id === String(userId)
  return {
    slug: r.slug,
    name: r.name,
    address: r.address,
    city: r.city,
    mobile: r.mobile,
    isPublic: r.is_public,
    isOwner: owner,
    updatedAt: r.updated_at,
    // Payment details are only needed on the owner's own bills
    ...(owner ? { upiId: r.upi_id, upiName: r.upi_name, upiMobile: r.upi_mobile } : {}),
  }
}

const itemOut = (r) => ({
  id: r.id,
  name: r.name,
  unit: r.unit,
  rate: r.rate_paise / 100,
  category: r.category,
  inStock: r.in_stock,
  // [{ min, rate }]: min in the item's unit, "this much or more"; first slab starts at 0
  slabs: (r.slab_qty ?? []).map((q, i) => ({ min: q / 1000, rate: r.slab_paise[i] / 100 })),
  changedDay: r.changed_day ?? null,
})

/**
 * Qty-based rates from the browser -> { slab_qty, slab_paise, rate_paise } or null for a single rate.
 * The main rate (shown in lists, tracked in the history graph) is the rate for 1 unit.
 */
function cleanSlabs(name, slabs) {
  if (!Array.isArray(slabs) || slabs.length < 2) return null
  if (slabs.length > MAX_SLABS) throw httpError(400, `${name}: ${MAX_SLABS} se zyada rate nahi`)
  const qty = slabs.map((s) => Math.round(Number(s?.min) * 1000))
  const paise = slabs.map((s) => Math.round(Number(s?.rate) * 100))
  if (qty[0] !== 0) throw httpError(400, `${name}: pehla rate sabse kam qty ka hona chahiye`)
  qty.forEach((q, i) => {
    if (!Number.isFinite(q) || (i > 0 && !(q > qty[i - 1])) || q > 1e9) throw httpError(400, `${name}: qty badhte kram mein, alag-alag honi chahiye`)
  })
  if (paise.some((p) => !(p > 0) || p > MAX_RATE * 100)) throw httpError(400, `${name}: har qty ka rate daalein`)
  let main = paise[0]
  qty.forEach((q, i) => {
    if (q <= 1000) main = paise[i]
  })
  return { slab_qty: qty, slab_paise: paise, rate_paise: main }
}

const sameArr = (a = [], b = []) => a.length === b.length && a.every((v, i) => v === b[i])

const listItems = (q, shopId) =>
  q.query(`select ${ITEM_COLS} from shop_items where shop_id = $1::bigint order by category, lower(name), unit`, [shopId]).then((rows) => rows.map(itemOut))

const ownShop = async (q, userId) => (await q.query(`select ${SHOP_COLS} from shops where owner_id = $1::bigint`, [userId]))[0]

export async function GET(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const { userId } = session
    const q = await sql()
    const params = new URL(request.url).searchParams

    if (params.get('mine')) {
      const shop = await ownShop(q, userId)
      return Response.json({ shop: shop ? shopOut(shop, userId) : null, items: shop ? await listItems(q, shop.id) : [] })
    }

    const slug = params.get('slug')
    if (slug) {
      const [shop] = await q.query(`select ${SHOP_COLS} from shops where slug = $1`, [str(slug, 80)])
      if (!shop || (!shop.is_public && shop.owner_id !== String(userId))) throw httpError(404, 'Ye shop nahi mili, ya private hai')
      return Response.json({ shop: shopOut(shop, userId), items: await listItems(q, shop.id) })
    }

    const history = params.get('history')
    if (history) {
      if (!isId(history)) throw httpError(404, 'Item nahi mila')
      const [row] = await q.query(
        `select i.name, i.unit, i.hist_days, i.hist_paise, s.is_public, s.owner_id::text as owner_id
         from shop_items i join shops s on s.id = i.shop_id where i.id = $1::bigint`,
        [history],
      )
      if (!row || (!row.is_public && row.owner_id !== String(userId))) throw httpError(404, 'Item nahi mila')
      return Response.json({ item: { name: row.name, unit: row.unit }, days: row.hist_days, paise: row.hist_paise })
    }

    const offset = Math.max(0, parseInt(params.get('offset'), 10) || 0)
    const term = str(params.get('q'), 60)
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const rows = await q.query(
      `select s.slug, s.name, s.city, s.address, s.updated_at, s.owner_id = $1::bigint as mine,
              (select count(*) from shop_items i where i.shop_id = s.id)::int as item_count
       from shops s
       where s.is_public ${term ? 'and (s.name ilike $2 or s.city ilike $2)' : ''}
       order by s.updated_at desc, s.id desc
       limit ${PAGE + 1} offset ${offset}`,
      term ? [userId, like] : [userId],
    )
    return Response.json({
      shops: rows.slice(0, PAGE).map((r) => ({
        slug: r.slug,
        name: r.name,
        city: r.city,
        address: r.address,
        itemCount: r.item_count,
        updatedAt: r.updated_at,
        mine: r.mine,
      })),
      hasMore: rows.length > PAGE,
    })
  } catch (e) {
    return fail(e)
  }
}

const slugify = (name) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'shop'
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

/** Checks the rate list from the browser; returns clean rows or throws a user-facing 400. */
function cleanItems(items) {
  if (!Array.isArray(items)) throw httpError(400, 'Items ki list galat hai')
  if (items.length > MAX_ITEMS) throw httpError(400, `Ek shop mein ${MAX_ITEMS} se zyada items nahi ho sakte`)
  const seen = new Set()
  return items.map((it) => {
    const name = str(it?.name, 80)
    const unit = String(it?.unit ?? '')
    const rate = Number(it?.rate)
    if (!name) throw httpError(400, 'Har item ka naam zaroori hai')
    if (!UNITS.includes(unit)) throw httpError(400, `${name}: unit galat hai`)
    const hasSlabs = Array.isArray(it.slabs) && it.slabs.length > 1
    if (!hasSlabs && (!(rate > 0) || rate > MAX_RATE)) throw httpError(400, `${name}: rate daalein`)
    const key = `${name.toLowerCase()}|${unit}`
    if (seen.has(key)) throw httpError(400, `${name} (${unit}) do baar hai`)
    seen.add(key)
    const slabs = cleanSlabs(name, it.slabs)
    return {
      id: isId(it.id) ? String(it.id) : null,
      name,
      unit,
      rate_paise: slabs?.rate_paise ?? Math.round(rate * 100),
      slab_qty: slabs?.slab_qty ?? [],
      slab_paise: slabs?.slab_paise ?? [],
      category: str(it.category, 40),
      in_stock: it.inStock !== false,
    }
  })
}

/**
 * Adds today's rate to an item's history. One entry per day (a second change today overwrites
 * today's entry), and entries older than two years are dropped, keeping the newest of those as
 * the starting point of the graph. Returns null when the rate didn't change.
 */
export function nextHistory(days, paise, rate, today = dayNumber()) {
  const d = [...(days ?? [])]
  const p = [...(paise ?? [])]
  const last = p.length - 1
  if (last >= 0 && p[last] === rate) return null
  if (last >= 0 && d[last] === today) {
    p[last] = rate
    // Changed and changed back on the same day: today's entry is no change at all
    if (last > 0 && p[last - 1] === rate) {
      d.pop()
      p.pop()
    }
  } else {
    d.push(today)
    p.push(rate)
  }
  const cutoff = today - HISTORY_DAYS
  let drop = 0
  while (drop + 1 < d.length && d[drop + 1] <= cutoff) drop++
  return { days: d.slice(drop), paise: p.slice(drop) }
}

// The whole rate list in one statement (so it's all-or-nothing): changed rows are updated,
// new ones inserted, and rows missing from the list deleted.
const SAVE_ITEMS = `
  with input as (
    select * from jsonb_to_recordset($2::jsonb) as x(
      id bigint, name text, unit text, rate_paise int, category text, in_stock boolean,
      slab_qty int[], slab_paise int[], hist_days int[], hist_paise int[], changed boolean)
  ),
  removed as (
    delete from shop_items where shop_id = $1::bigint and id not in (select id from input where id is not null)
  ),
  updated as (
    update shop_items s
    set name = i.name, unit = i.unit, rate_paise = i.rate_paise, category = i.category, in_stock = i.in_stock,
        slab_qty = i.slab_qty, slab_paise = i.slab_paise, hist_days = i.hist_days, hist_paise = i.hist_paise, updated_at = now()
    from input i
    where i.id = s.id and s.shop_id = $1::bigint and i.changed
  )
  insert into shop_items (shop_id, name, unit, rate_paise, category, in_stock, slab_qty, slab_paise, hist_days, hist_paise)
  select $1::bigint, name, unit, rate_paise, category, in_stock, slab_qty, slab_paise, hist_days, hist_paise from input where id is null`

async function saveItems(q, shopId, items) {
  const existing = new Map(
    (await q.query(`select id::text as id, name, unit, rate_paise, category, in_stock, slab_qty, slab_paise, hist_days, hist_paise from shop_items where shop_id = $1::bigint`, [shopId])).map(
      (r) => [r.id, r],
    ),
  )
  const today = dayNumber()
  const rows = items.map((it) => {
    const old = it.id && existing.get(it.id)
    if (!old) return { ...it, id: null, hist_days: [today], hist_paise: [it.rate_paise], changed: true }
    const hist = nextHistory(old.hist_days, old.hist_paise, it.rate_paise, today)
    const changed =
      !!hist || old.name !== it.name || old.unit !== it.unit || old.category !== it.category || old.in_stock !== it.in_stock ||
      !sameArr(old.slab_qty, it.slab_qty) || !sameArr(old.slab_paise, it.slab_paise)
    return { ...it, hist_days: hist?.days ?? old.hist_days, hist_paise: hist?.paise ?? old.hist_paise, changed }
  })
  await q.query(SAVE_ITEMS, [shopId, JSON.stringify(rows)])
}

export async function PUT(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const { userId } = session
    const text = await request.text()
    if (text.length > MAX_BYTES) throw httpError(413, 'Rate list bahut badi hai')
    let body
    try {
      body = JSON.parse(text)
    } catch {
      throw httpError(400, 'Galat data')
    }
    const s = body?.shop ?? {}
    const name = str(s.name, 80)
    if (!name) throw httpError(400, 'Shop ka naam zaroori hai')
    // Validate the items before touching the database, so a bad list changes nothing
    const items = body.items === undefined ? null : cleanItems(body.items)

    const q = await sql()
    const fields = [name, str(s.address, 300), str(s.city, 60), str(s.mobile, 20), str(s.upiId, 80), str(s.upiName, 80), str(s.upiMobile, 20), s.isPublic === true]
    // owner_id is unique, so this creates the caller's shop once and updates it afterwards.
    // The slug is set only on creation: shared links keep working when the name changes.
    const [shop] = await q.query(
      `insert into shops (owner_id, slug, name, address, city, mobile, upi_id, upi_name, upi_mobile, is_public)
       values ($1::bigint, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (owner_id) do update set
         name = excluded.name, address = excluded.address, city = excluded.city, mobile = excluded.mobile,
         upi_id = excluded.upi_id, upi_name = excluded.upi_name, upi_mobile = excluded.upi_mobile,
         is_public = excluded.is_public, updated_at = now()
       returning ${SHOP_COLS}`,
      [userId, slugify(name), ...fields],
    )
    if (items) await saveItems(q, shop.id, items)
    return Response.json({ shop: shopOut(shop, userId), items: await listItems(q, shop.id) })
  } catch (e) {
    return fail(e)
  }
}
