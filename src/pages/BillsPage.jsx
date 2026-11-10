import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  CloudOff, Copy, Eye, EllipsisVertical, LoaderCircle, Pencil, ReceiptText, RefreshCw, Search, Trash2, X,
} from 'lucide-react'
import { useBillStore } from '../store/useBillStore'
import { showToast } from '../store/useToast'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import BillViewer from './BillViewer'
import { api } from '../utils/api'
import { flushPending } from '../utils/billSync'
import { fmtDate, inr } from '../utils/format'

// Same shape as a server summary, for bills still waiting in the offline queue
const pendingSummary = (b) => ({
  id: b.id,
  invoiceNo: b.details.invoiceNo,
  date: b.details.date,
  customerName: b.details.customerName,
  total: b.items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
  itemCount: b.items.length,
  local: { id: b.id, data: b },
})

function BillRow({ bill, pending, index, onOpen, onMenu }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ delay: Math.min(index, 8) * 0.03, type: 'spring', stiffness: 320, damping: 30 }}
      className="card flex items-center gap-3 p-3 pr-1.5"
    >
      <button type="button" onClick={() => onOpen(bill)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-xs font-extrabold text-violet-700 tabular-nums">
          #{bill.invoiceNo || '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{bill.customerName || 'Customer'}</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
            {pending && <CloudOff className="size-3.5 shrink-0 text-amber-600" />}
            {[fmtDate(bill.date), `${bill.itemCount} item${bill.itemCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="shrink-0 text-right font-extrabold tabular-nums">₹{inr(bill.total)}</span>
      </button>
      <button type="button" onClick={() => onMenu(bill)} aria-label={`Bill #${bill.invoiceNo} ke options`}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
        <EllipsisVertical className="size-4.5" />
      </button>
    </motion.li>
  )
}

export default function BillsPage() {
  const viewing = useBillStore((s) => s.viewing)
  const pendingBills = useBillStore((s) => s.pendingBills)
  const { setViewing, loadBill, unqueueBill } = useBillStore.getState()

  const [query, setQuery] = useState('')
  const [list, setList] = useState({ bills: [], hasMore: false, status: 'loading', error: '' })
  const [busyId, setBusyId] = useState(null) // bill being fetched for open/edit
  const [menu, setMenu] = useState(null) // bill whose action sheet is open (kept while it animates out)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirmData] = useState(null) // { title, message, label, danger, icon, run }
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const seq = useRef(0)

  const setConfirm = (c) => {
    setConfirmData(c)
    setConfirmOpen(true)
  }

  const load = useCallback(async (q, offset = 0) => {
    const id = ++seq.current
    setList((l) => ({ ...l, status: offset ? 'more' : 'loading', error: '' }))
    try {
      const params = new URLSearchParams({ offset: String(offset) })
      if (q.trim()) params.set('q', q.trim())
      const data = await api(`/api/bills?${params}`)
      if (id !== seq.current) return
      setList((l) => ({ bills: offset ? [...l.bills, ...data.bills] : data.bills, hasMore: data.hasMore, status: 'idle', error: '' }))
    } catch (e) {
      if (id === seq.current) setList((l) => ({ ...l, status: 'idle', error: e.message }))
    }
  }, [])

  // Search as you type (debounced)
  useEffect(() => {
    const t = setTimeout(() => load(query), query ? 300 : 0)
    return () => clearTimeout(t)
  }, [query, load])

  // Queued bills get another try whenever the list is opened; reload so they show up as saved
  useEffect(() => {
    if (!Object.keys(useBillStore.getState().pendingBills).length) return
    flushPending().then(() => load(''))
  }, [load])

  const pendingList = Object.values(pendingBills).map(pendingSummary)
  const pendingIds = new Set(pendingList.map((b) => b.id))
  const serverBills = list.bills.filter((b) => !pendingIds.has(b.id))

  const syncNow = async () => {
    setSyncing(true)
    await flushPending()
    setSyncing(false)
    const left = Object.keys(useBillStore.getState().pendingBills).length
    showToast(left ? `${left} bill abhi bhi baaki, net check karein` : 'Sab bills save ho gaye', !!left)
    load(query)
  }

  // Full bill (with items) for a row: local copy for queued bills, otherwise from the server
  const fetchFull = async (bill) => {
    if (bill.local) return bill.local
    setBusyId(bill.id)
    try {
      return (await api(`/api/bills?id=${encodeURIComponent(bill.id)}`)).bill
    } catch (e) {
      showToast(e.message, true)
      return null
    } finally {
      setBusyId(null)
    }
  }

  const open = async (bill) => {
    const full = await fetchFull(bill)
    if (full) setViewing(full)
  }

  // Edit in place / copy into a new bill. Asks first if Home has an unfinished, different draft.
  const toHome = (full, copy) => {
    const s = useBillStore.getState()
    const go = () => {
      loadBill(full, { copy })
      showToast(copy ? 'Naya bill copy se bana, details check karein' : `Bill #${full.data.details.invoiceNo} edit ke liye khula`)
    }
    if (!s.items.length || (!copy && s.draftId === full.id)) return go()
    setConfirm({
      title: 'Abhi wala bill hat jayega',
      message: `Home pe ${s.items.length} items wala bill (#${s.details.invoiceNo}) bana hua hai. Agar woh preview tak pahuncha tha to history mein save hai.`,
      label: copy ? 'Haan, copy karo' : 'Haan, edit karo',
      icon: copy ? Copy : Pencil,
      run: go,
    })
  }
  const editOrCopy = async (bill, copy) => {
    const full = await fetchFull(bill)
    if (full) toHome(full, copy)
  }

  const askDelete = (bill) =>
    setConfirm({
      title: `Bill #${bill.invoiceNo} delete karein?`,
      message: `${bill.customerName || 'Customer'} ka ₹${inr(bill.total)} ka bill history se hamesha ke liye hat jayega.`,
      label: 'Haan, delete',
      danger: true,
      icon: Trash2,
      run: async () => {
        unqueueBill(bill.id)
        if (bill.local) return showToast('Bill hata diya')
        try {
          await api(`/api/bills?id=${encodeURIComponent(bill.id)}`, { method: 'DELETE' })
          setList((l) => ({ ...l, bills: l.bills.filter((b) => b.id !== bill.id) }))
          showToast(`Bill #${bill.invoiceNo} delete ho gaya`)
        } catch (e) {
          showToast(e.message, true)
        }
      },
    })

  const act = (fn) => () => {
    setMenuOpen(false)
    fn(menu)
  }

  if (viewing) return <BillViewer onEdit={(full) => toHome(full, false)} />

  const empty = list.status === 'idle' && !list.error && !serverBills.length && !pendingList.length

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-lg font-bold">Bill history</h2>
        <p className="text-xs text-zinc-500">Aapke saare bills, naye sabse upar</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Naam, mobile ya bill no."
          aria-label="Bills dhoondhein"
          className="field pr-10 pl-10"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Search saaf karein"
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 hover:text-zinc-700">
            <X className="size-4" />
          </button>
        )}
      </div>

      {pendingList.length > 0 && !query && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <CloudOff className="size-4 shrink-0" /> {pendingList.length} bill save hona baaki
            </p>
            <button type="button" onClick={syncNow} disabled={syncing}
              className="btn shrink-0 border border-amber-300 bg-white px-3 py-1.5 text-amber-800 hover:bg-amber-100">
              <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sync
            </button>
          </div>
          <ul className="space-y-2">
            {pendingList.map((b, i) => (
              <BillRow key={b.id} bill={b} pending index={i} onOpen={open} onMenu={(m) => (setMenu(m), setMenuOpen(true))} />
            ))}
          </ul>
        </section>
      )}

      {list.status === 'loading' && !serverBills.length ? (
        <ul className="space-y-2" aria-label="Load ho raha hai">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="card h-17 animate-pulse" />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {serverBills.map((b, i) => (
              <BillRow key={b.id} bill={b} index={i} onOpen={open} onMenu={(m) => (setMenu(m), setMenuOpen(true))} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {list.error && (
        <div className="card space-y-3 p-5 text-center">
          <p className="text-sm font-medium text-rose-600">{list.error}</p>
          <button type="button" onClick={() => load(query)} className="btn-ghost mx-auto">
            <RefreshCw className="size-4" /> Dobara try karein
          </button>
        </div>
      )}

      {empty && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600">
            <ReceiptText className="size-7" />
          </span>
          <div>
            <p className="font-bold">{query ? 'Koi bill nahi mila' : 'Abhi koi bill nahi'}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {query ? 'Naam, mobile ya poora bill number try karein' : 'Home pe bill banayein, preview khulte hi woh yahan save ho jayega'}
            </p>
          </div>
        </motion.div>
      )}

      {list.hasMore && (
        <button type="button" onClick={() => load(query, list.bills.length)} disabled={list.status === 'more'} className="btn-ghost w-full py-3">
          {list.status === 'more' ? <LoaderCircle className="size-4 animate-spin" /> : null} Aur bills dikhayein
        </button>
      )}

      <BottomSheet open={menuOpen} title={menu ? `Bill #${menu.invoiceNo}` : ''} onClose={() => setMenuOpen(false)}>
        {menu && (
          <div className="space-y-2 pb-2">
            <p className="pb-1 text-sm text-zinc-500">
              {[menu.customerName || 'Customer', fmtDate(menu.date), `₹${inr(menu.total)}`].filter(Boolean).join(' · ')}
            </p>
            <MenuButton icon={Eye} label="Dekhein / PDF / WhatsApp" onClick={act(open)} />
            <MenuButton icon={Pencil} label="Edit karein" hint="Isi bill mein badlav, history mein update hoga" onClick={act((b) => editOrCopy(b, false))} />
            <MenuButton icon={Copy} label="Copy karke naya bill" hint="Wahi items, naya bill number" onClick={act((b) => editOrCopy(b, true))} />
            <MenuButton icon={Trash2} label="Delete karein" danger onClick={act(askDelete)} />
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        danger={confirm?.danger}
        icon={confirm?.icon}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          confirm.run()
        }}
      />

      {busyId && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-white/40 backdrop-blur-[1px]" aria-live="polite">
          <span className="flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
            <LoaderCircle className="size-4 animate-spin" /> Bill khul raha hai…
          </span>
        </div>
      )}
    </div>
  )
}

function MenuButton({ icon: Icon, label, hint, danger, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        danger ? 'border-rose-100 text-rose-600 hover:bg-rose-50' : 'border-zinc-100 hover:bg-zinc-50'
      }`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-rose-50' : 'bg-violet-50 text-violet-600'}`}>
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </button>
  )
}
