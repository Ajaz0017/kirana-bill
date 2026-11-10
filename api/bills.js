// The logged-in user's bill history. Every query is scoped to the session's user id.
//
// GET    /api/bills?q=&offset=   -> { bills: [summary...], hasMore }   (newest first, 20 per page)
// GET    /api/bills?id=X         -> { bill: { id, data, ...summary } }
// POST   /api/bills { id, items, details, shopInfo } -> saves (creates or updates) that bill
// DELETE /api/bills?id=X
import { getSession, unauthorized } from './_auth.js'
import { fail, httpError, sql } from './_db.js'

const PAGE = 20
const MAX_BYTES = 300_000
const ID_RE = /^[\w-]{1,48}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const summary = (r) => ({
  id: r.id,
  invoiceNo: r.invoice_no,
  date: r.bill_date ?? '',
  customerName: r.customer_name,
  customerMobile: r.customer_mobile,
  total: Number(r.total),
  itemCount: r.item_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

// bill_date as text, so no driver/timezone turns 2026-11-10 into the 9th
const COLS = `id, invoice_no, to_char(bill_date, 'YYYY-MM-DD') as bill_date, customer_name, customer_mobile,
  total, item_count, created_at, updated_at`

const str = (v, max = 300) => String(v ?? '').slice(0, max)

export async function GET(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const q = await sql()
    const params = new URL(request.url).searchParams

    const id = params.get('id')
    if (id) {
      const [row] = await q.query(`select ${COLS}, data from bills where user_id = $1 and id = $2`, [session.userId, id])
      if (!row) throw httpError(404, 'Bill nahi mila')
      return Response.json({ bill: { ...summary(row), data: row.data } })
    }

    const offset = Math.max(0, parseInt(params.get('offset'), 10) || 0)
    const term = str(params.get('q'), 60).trim()
    // Escape LIKE wildcards so "%" in a search means a literal percent sign
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const filter = term ? 'and (customer_name ilike $2 or invoice_no = $3 or customer_mobile like $2)' : ''
    const rows = await q.query(
      `select ${COLS} from bills where user_id = $1 ${filter}
       order by created_at desc, id desc limit ${PAGE + 1} offset ${offset}`,
      term ? [session.userId, like, term] : [session.userId],
    )
    return Response.json({ bills: rows.slice(0, PAGE).map(summary), hasMore: rows.length > PAGE })
  } catch (e) {
    return fail(e)
  }
}

export async function POST(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const text = await request.text()
    if (text.length > MAX_BYTES) throw httpError(413, 'Bill bahut bada hai')
    let body
    try {
      body = JSON.parse(text)
    } catch {
      throw httpError(400, 'Galat data')
    }
    const { id, items, details = {}, shopInfo = {} } = body ?? {}
    if (!ID_RE.test(String(id ?? ''))) throw httpError(400, 'Bill id galat hai')
    if (!Array.isArray(items) || !items.length || items.length > 500) throw httpError(400, 'Bill mein items nahi hain')

    // Totals are recomputed here rather than trusted from the browser
    const total = Math.round(items.reduce((s, i) => s + (Number(i?.amount) || 0), 0) * 100) / 100
    const date = DATE_RE.test(details.date ?? '') ? details.date : null
    const data = JSON.stringify({ items, details, shopInfo })

    const q = await sql()
    await q`
      insert into bills (user_id, id, invoice_no, bill_date, customer_name, customer_mobile, total, item_count, data)
      values (${session.userId}, ${id}, ${str(details.invoiceNo, 40)}, ${date}, ${str(details.customerName, 120)},
              ${str(details.customerMobile, 30)}, ${total}, ${items.length}, ${data}::jsonb)
      on conflict (user_id, id) do update set
        invoice_no = excluded.invoice_no, bill_date = excluded.bill_date,
        customer_name = excluded.customer_name, customer_mobile = excluded.customer_mobile,
        total = excluded.total, item_count = excluded.item_count, data = excluded.data, updated_at = now()`
    return Response.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}

export async function DELETE(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const id = new URL(request.url).searchParams.get('id')
    const q = await sql()
    await q`delete from bills where user_id = ${session.userId} and id = ${id}`
    return Response.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
