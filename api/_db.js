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
  // One shop per user (owner_id unique). Public shops can be seen, never edited, by other users.
  `create table if not exists shops (
     id bigint generated always as identity primary key,
     owner_id bigint not null unique references users(id) on delete cascade,
     slug text not null unique,
     name text not null default '',
     address text not null default '',
     city text not null default '',
     mobile text not null default '',
     upi_id text not null default '',
     upi_name text not null default '',
     upi_mobile text not null default '',
     is_public boolean not null default false,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists shops_public_recent on shops (updated_at desc) where is_public`,
  // Rate history lives in the item row (two int arrays, 8 bytes per change) instead of a
  // row-per-change table, so it stays small on the free database. See api/shops.js.
  `create table if not exists shop_items (
     id bigint generated always as identity primary key,
     shop_id bigint not null references shops(id) on delete cascade,
     name text not null,
     unit text not null,
     rate_paise int not null,
     category text not null default '',
     in_stock boolean not null default true,
     hist_days int[] not null default '{}',
     hist_paise int[] not null default '{}',
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists shop_items_shop on shop_items (shop_id)`,
  // Qty-based rates (Phase 6.1): slab start ×1000 in the item's unit (250 g of a kg item = 250),
  // and that slab's rate in paise. Empty = one rate for any qty.
  `alter table shop_items add column if not exists slab_qty int[] not null default '{}'`,
  `alter table shop_items add column if not exists slab_paise int[] not null default '{}'`,
  // Online orders (Phase 8): the owner's switches, and orders placed from the public page
  `alter table shops add column if not exists order_whatsapp text not null default ''`,
  `alter table shops add column if not exists orders_on boolean not null default false`,
  `alter table shops add column if not exists closed boolean not null default false`,
  `alter table shops add column if not exists min_order_paise int not null default 0`,
  `create table if not exists orders (
     id bigint generated always as identity primary key,
     shop_id bigint not null references shops(id) on delete cascade,
     code text not null unique,
     cust_name text not null,
     cust_mobile text not null,
     delivery boolean not null default false,
     address text not null default '',
     note text not null default '',
     items jsonb not null,
     total_paise int not null,
     status smallint not null default 0,
     bill_id text,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists orders_shop_recent on orders (shop_id, created_at desc)`,
  // New-order notifications (Phase 8.2): one row per owner phone/browser, ~0.5–1 KB each.
  // Notifications themselves are never stored.
  `create table if not exists push_subs (
     id bigint generated always as identity primary key,
     user_id bigint not null references users(id) on delete cascade,
     endpoint text not null unique,
     p256dh text not null,
     auth text not null,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists push_subs_user on push_subs (user_id)`,
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
