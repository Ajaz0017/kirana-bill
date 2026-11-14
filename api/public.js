// Public (no login) side of shops: what customers see from a QR code / shared link.
// Only shops marked Public are ever returned; a private shop or wrong link is a 404.
//
// GET  /api/public?shop=<slug>   -> { shop, items }        rate list
// POST /api/public?order         -> { code, total, waNumber, waText, orderUrl }
// GET  /api/public?order=<code>  -> { order, shop }        one order (the code is the key)
// GET  /api/public?orders=c1,c2   -> { orders: [{ code, status, total, createdAt }] }
//                                   status of the customer's own orders ("Mere orders"); only the codes
//                                   asked for, and never the customer's name / mobile / address
import { fail, httpError, sql } from './_db.js'
import { KEEP_DAYS, ORDER_COLS, STATUSES, orderCode, orderOut, packItem, waNumber } from './_orders.js'
import { convertQty, sameFamily, slabRate } from '../src/utils/units.js'
import { notifyShopOwner } from './_push.js'

const MAX_LINES = 50
const MAX_STATUS_CODES = 50
const CODE_RE = /^[a-z0-9]{6,20}$/
const MAX_QTY = 100_000 // in the unit the customer picked (100 kg / 100000 gm)
const IP_LIMIT = 3 // orders per IP per minute (best-effort: serverless instances don't share memory)
const MOBILE_LIMIT = 5 // orders per mobile per shop per hour (counted in the database)
const recent = new Map() // ip -> [timestamps]

const str = (v, max) => String(v ?? '').trim().slice(0, max)
const clientIp = (request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
const money = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PUBLIC_SHOP_COLS = `id, slug, name, address, city, mobile, order_whatsapp, orders_on, closed, min_order_paise`

function shopOut(r) {
  return {
    slug: r.slug,
    name: r.name,
    address: r.address,
    city: r.city,
    mobile: r.mobile,
    whatsapp: waNumber(r.order_whatsapp) ?? waNumber(r.mobile),
    ordersOn: r.orders_on && !!(waNumber(r.order_whatsapp) ?? waNumber(r.mobile)),
    closed: r.closed,
    minOrder: r.min_order_paise / 100,
  }
}

const itemOut = (r) => ({
  id: r.id,
  name: r.name,
  unit: r.unit,
  rate: r.rate_paise / 100,
  category: r.category,
  inStock: r.in_stock,
  slabs: (r.slab_qty ?? []).map((q, i) => ({ min: q / 1000, rate: r.slab_paise[i] / 100 })),
})

const publicShop = async (q, slug) =>
  (await q.query(`select ${PUBLIC_SHOP_COLS} from shops where slug = $1 and is_public`, [str(slug, 80)]))[0]

const shopItems = (q, shopId) =>
  q.query(
    `select id::text as id, name, unit, rate_paise, category, in_stock, slab_qty, slab_paise
     from shop_items where shop_id = $1 order by category, lower(name), unit`,
    [shopId],
  )

export async function GET(request) {
  try {
    const q = await sql()
    const params = new URL(request.url).searchParams

    const many = params.get('orders')
    if (many !== null) {
      const codes = [...new Set(many.split(',').map((c) => c.trim()).filter(Boolean))]
      if (codes.length > MAX_STATUS_CODES) throw httpError(400, `Ek baar mein ${MAX_STATUS_CODES} se zyada order nahi`)
      const valid = codes.filter((c) => CODE_RE.test(c))
      const rows = valid.length
        ? await q.query(`select code, status, total_paise, created_at from orders where code = any($1::text[])`, [valid])
        : []
      return Response.json({
        orders: rows.map((r) => ({ code: r.code, status: STATUSES[r.status] ?? 'new', total: r.total_paise / 100, createdAt: r.created_at })),
      })
    }

    const code = params.get('order')
    if (code) {
      const [row] = await q.query(
        `select ${ORDER_COLS.split(', ').map((c) => `o.${c}`).join(', ')}, s.slug, s.name as shop_name, s.address as shop_address,
                s.city as shop_city, s.mobile as shop_mobile
         from orders o join shops s on s.id = o.shop_id where o.code = $1`,
        [str(code, 20)],
      )
      if (!row) throw httpError(404, 'Ye order nahi mila')
      return Response.json({
        order: orderOut(row),
        shop: { slug: row.slug, name: row.shop_name, address: row.shop_address, city: row.shop_city, mobile: row.shop_mobile },
      })
    }

    const shop = await publicShop(q, params.get('shop'))
    if (!shop) throw httpError(404, 'Ye shop nahi mili')
    const items = (await shopItems(q, shop.id)).map(itemOut)
    return Response.json({ shop: shopOut(shop), items })
  } catch (e) {
    return fail(e)
  }
}

function tooFast(ip) {
  const now = Date.now()
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (list.length >= IP_LIMIT) return true
  recent.set(ip, [...list, now])
  return false
}

/** The order message that opens in the shop's WhatsApp chat */
function waMessage({ shopName, code, lines, total, customer, orderUrl }) {
  return [
    `*Naya order* #${code}`,
    shopName,
    '',
    ...lines.map((l, i) => `${i + 1}. ${l.name}: ${l.qty} ${l.unit} × ₹${money(l.rate)}/${l.rateUnit} = ₹${money(l.amount)}`),
    '',
    `*Total: ₹${money(total)}*`,
    '',
    `Naam: ${customer.name}`,
    `Mobile: ${customer.mobile}`,
    customer.delivery ? `Ghar pe delivery: ${customer.address}` : 'Dukaan se le jayenge',
    customer.note ? `Note: ${customer.note}` : null,
    '',
    `Order dekhein: ${orderUrl}`,
  ]
    .filter((l) => l != null)
    .join('\n')
}

export async function POST(request) {
  try {
    const body = (await request.json().catch(() => null)) ?? {}
    // Hidden form field people never see: anything in it is a bot
    if (str(body.website, 10)) throw httpError(400, 'Order nahi bheja ja saka')

    const name = str(body.customer?.name, 60)
    const mobileDigits = String(body.customer?.mobile ?? '').replace(/\D/g, '').replace(/^(91)(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '')
    const delivery = body.customer?.delivery === true
    const address = str(body.customer?.address, 300)
    const note = str(body.customer?.note, 300)
    if (!name) throw httpError(400, 'Apna naam daalein')
    if (!/^[6-9]\d{9}$/.test(mobileDigits)) throw httpError(400, 'Sahi 10 ank ka mobile number daalein')
    if (delivery && !address) throw httpError(400, 'Delivery ke liye pata daalein')

    const lines = Array.isArray(body.items) ? body.items : []
    if (!lines.length) throw httpError(400, 'Cart khaali hai')
    if (lines.length > MAX_LINES) throw httpError(400, `Ek order mein ${MAX_LINES} se zyada items nahi`)

    if (tooFast(clientIp(request))) throw httpError(429, 'Thoda ruk ke dobara try karein')

    const q = await sql()
    const shop = await publicShop(q, body.slug)
    if (!shop) throw httpError(404, 'Ye shop nahi mili')
    const out = shopOut(shop)
    if (shop.closed) throw httpError(403, 'Dukaan abhi band hai, order nahi le rahi')
    if (!out.ordersOn) throw httpError(403, 'Ye dukaan abhi online order nahi le rahi')

    const [{ n }] = await q.query(
      `select count(*)::int as n from orders where shop_id = $1 and cust_mobile = $2 and created_at > now() - interval '1 hour'`,
      [shop.id, mobileDigits],
    )
    if (n >= MOBILE_LIMIT) throw httpError(429, 'Is number se abhi bahut order aa chuke hain, thodi der baad try karein')

    // Prices come from the database, never from the browser
    const items = new Map((await shopItems(q, shop.id)).map((r) => [r.id, itemOut(r)]))
    const seen = new Set()
    const priced = lines.map((l) => {
      const item = items.get(String(l?.id ?? ''))
      if (!item) throw httpError(400, 'Kuch items ab list mein nahi hain, page refresh karein')
      if (!item.inStock) throw httpError(400, `${item.name} abhi stock mein nahi hai`)
      const unit = String(l.unit ?? item.unit)
      if (!sameFamily(unit, item.unit)) throw httpError(400, `${item.name}: unit galat hai`)
      const qty = Number(l.qty)
      if (!(qty > 0) || qty > MAX_QTY) throw httpError(400, `${item.name}: qty galat hai`)
      const key = `${item.id}|${unit}`
      if (seen.has(key)) throw httpError(400, `${item.name} do baar hai`)
      seen.add(key)
      const qtyIn = convertQty(qty, unit, item.unit)
      const rate = slabRate(item, qtyIn)
      const amount = Math.round(qtyIn * rate * 100) / 100
      return { name: item.name, qty: Math.round(qty * 1000) / 1000, unit, rate, rateUnit: item.unit, amount }
    })
    const total = Math.round(priced.reduce((s, l) => s + l.amount, 0) * 100) / 100
    if (total < out.minOrder) throw httpError(400, `Minimum order ₹${money(out.minOrder)} ka hai`)

    const customer = { name, mobile: mobileDigits, delivery, address: delivery ? address : '', note }
    let code
    for (let tries = 0; tries < 3 && !code; tries++) {
      const candidate = orderCode()
      const rows = await q.query(
        `insert into orders (shop_id, code, cust_name, cust_mobile, delivery, address, note, items, total_paise)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         on conflict (code) do nothing returning code`,
        [shop.id, candidate, name, mobileDigits, delivery, customer.address, note, JSON.stringify(priced.map(packItem)), Math.round(total * 100)],
      )
      code = rows[0]?.code
    }
    if (!code) throw httpError(500, 'Order save nahi hua, dobara try karein')
    // Old orders go, so the free database doesn't fill up
    await q.query(`delete from orders where created_at < now() - make_interval(days => ${KEEP_DAYS})`)

    const origin = new URL(request.url).origin
    const orderUrl = `${origin}/o/${code}`
    // Phone notification for the owner (if they turned it on); tapping it opens their Orders
    await notifyShopOwner(q, shop.id, {
      title: `🛒 Naya order · ₹${money(total)}`,
      body: `${name} · ${priced.length} ${priced.length === 1 ? 'item' : 'items'} · ${delivery ? 'delivery' : 'dukaan se lenge'}`,
      tag: code,
      url: '/?open=orders',
    }, origin)
    return Response.json({
      code,
      total,
      waNumber: out.whatsapp,
      waText: waMessage({ shopName: shop.name, code, lines: priced, total, customer, orderUrl }),
      orderUrl,
    })
  } catch (e) {
    return fail(e)
  }
}
