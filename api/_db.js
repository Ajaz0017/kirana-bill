// Neon Postgres (free on Vercel: Storage → Create Database → Neon). Vercel sets DATABASE_URL itself;
// locally put the same value in .env. The "_" prefix keeps Vercel from exposing this as an endpoint.
import { neon } from '@neondatabase/serverless'

let client = null
export function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) throw Object.assign(new Error('Server pe DATABASE_URL set nahi hai'), { status: 500 })
  client ??= neon(url)
  return client
}

// Tables are created on first use, so a fresh database needs no manual setup step
const SCHEMA = [
  `create table if not exists users (
     id bigint generated always as identity primary key,
     email text not null unique,
     name text not null default '',
     pass_hash text not null,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists bills (
     user_id bigint not null references users(id) on delete cascade,
     id text not null,
     invoice_no text not null default '',
     bill_date date,
     customer_name text not null default '',
     customer_mobile text not null default '',
     total numeric(14, 2) not null default 0,
     item_count int not null default 0,
     data jsonb not null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     primary key (user_id, id)
   )`,
  `create index if not exists bills_user_recent on bills (user_id, created_at desc)`,
]

let ready = null
export async function sql() {
  const q = db()
  ready ??= (async () => {
    for (const stmt of SCHEMA) await q.query(stmt)
  })().catch((e) => {
    ready = null // retry on the next request instead of failing forever
    throw e
  })
  await ready
  return q
}

// Uniform JSON error for anything thrown inside a handler
export const fail = (e) => {
  if (!e.status) console.error(e)
  return Response.json({ error: e.status ? e.message : 'Server mein dikkat aayi, dobara try karein' }, { status: e.status ?? 500 })
}

export const httpError = (status, message) => Object.assign(new Error(message), { status })
