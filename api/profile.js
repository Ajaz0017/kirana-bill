// GET   /api/profile                                  -> { user, stats }
// PATCH /api/profile { name }                         -> { user }
// POST  /api/profile { currentPassword, newPassword } -> changes the password
import { getSession, hashPassword, unauthorized, verifyPassword } from './_auth.js'
import { fail, httpError, sql } from './_db.js'

const userOut = (u) => ({ id: Number(u.id), email: u.email, name: u.name, createdAt: u.created_at })

export async function GET(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const q = await sql()
    const [user] = await q`select id, email, name, created_at from users where id = ${session.userId}`
    if (!user) return unauthorized()
    const [stats] = await q`
      select count(*)::int as bills,
             coalesce(sum(total), 0) as total,
             count(*) filter (where created_at >= date_trunc('month', now()))::int as month_bills,
             coalesce(sum(total) filter (where created_at >= date_trunc('month', now())), 0) as month_total
      from bills where user_id = ${session.userId}`
    return Response.json({
      user: userOut(user),
      stats: { bills: stats.bills, total: Number(stats.total), monthBills: stats.month_bills, monthTotal: Number(stats.month_total) },
    })
  } catch (e) {
    return fail(e)
  }
}

export async function PATCH(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const body = (await request.json().catch(() => null)) ?? {}
    const name = String(body.name ?? '').trim().slice(0, 80)
    if (!name) throw httpError(400, 'Naam khaali nahi ho sakta')
    const q = await sql()
    const [user] = await q`update users set name = ${name} where id = ${session.userId} returning id, email, name, created_at`
    if (!user) return unauthorized()
    return Response.json({ user: userOut(user) })
  } catch (e) {
    return fail(e)
  }
}

export async function POST(request) {
  try {
    const session = await getSession(request, process.env)
    if (!session) return unauthorized()
    const body = (await request.json().catch(() => null)) ?? {}
    const current = String(body.currentPassword ?? '')
    const next = String(body.newPassword ?? '')
    if (next.length < 8) throw httpError(400, 'Naya password kam se kam 8 akshar ka rakhein')
    if (next.length > 200) throw httpError(400, 'Password bahut lamba hai')
    const q = await sql()
    const [user] = await q`select pass_hash from users where id = ${session.userId}`
    if (!user) return unauthorized()
    if (!(await verifyPassword(current, user.pass_hash))) throw httpError(400, 'Purana password galat hai')
    await q`update users set pass_hash = ${await hashPassword(next)} where id = ${session.userId}`
    return Response.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
