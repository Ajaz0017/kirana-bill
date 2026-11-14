import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  Check, ChevronRight, CloudOff, Download, Eye, EyeOff, KeyRound, LoaderCircle, LogOut, Pencil, ReceiptText, Settings, Share2, Store, X,
} from 'lucide-react'
import { logout, useSession } from '../store/useSession'
import { useBillStore } from '../store/useBillStore'
import { installApp, useInstall } from '../store/useInstall'
import { showToast } from '../store/useToast'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import NotifySetting from '../components/NotifySetting'
import { api } from '../utils/api'
import { inr } from '../utils/format'

const billsText = (n) => `${n} ${n === 1 ? 'bill' : 'bills'}`

const fmtMonthYear = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '')

function Stat({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

// One tappable line in a settings-style list
function Row({ icon: Icon, label, sub, onClick, danger, tone }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-50">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-rose-50 text-rose-600' : (tone ?? 'bg-violet-50 text-violet-600')}`}>
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${danger ? 'text-rose-600' : ''}`}>{label}</span>
          {sub && <span className="block truncate text-xs text-zinc-500">{sub}</span>}
        </span>
        {!danger && <ChevronRight className="size-4 shrink-0 text-zinc-300" />}
      </button>
    </li>
  )
}

const PwField = ({ id, label, value, onChange, show, error, autoComplete, placeholder }) => (
  <div>
    <label className="field-label" htmlFor={id}>{label}</label>
    <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={onChange}
      className={`field ${error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15' : ''}`} />
  </div>
)

// Change password: rarely used, so it lives in its own sheet instead of on the page
function PasswordSheet({ open, email, onClose }) {
  const [pw, setPw] = useState({ current: '', next: '', again: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const errors = { current: !pw.current, next: pw.next.length < 8, again: pw.again !== pw.next }

  const close = () => {
    setPw({ current: '', next: '', again: '' })
    setTouched(false)
    setShow(false)
    onClose()
  }
  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    if (Object.values(errors).some(Boolean)) return
    setBusy(true)
    try {
      await api('/api/profile', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } })
      showToast('Password badal gaya')
      close()
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      title="Password badlein"
      onClose={close}
      footer={
        <button type="submit" form="pw-form" disabled={busy} className="btn-primary w-full py-3.5 text-base">
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Check className="size-5" />} Password badlein
        </button>
      }
    >
      <form id="pw-form" onSubmit={submit} noValidate className="space-y-3 pb-2">
        {/* Lets password managers attach the new password to the right account */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <PwField id="pw-current" label="Purana password" autoComplete="current-password" show={show}
          value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={touched && errors.current} />
        <PwField id="pw-next" label="Naya password" autoComplete="new-password" placeholder="Kam se kam 8 akshar" show={show}
          value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={touched && errors.next} />
        <PwField id="pw-again" label="Naya password dobara" autoComplete="new-password" show={show}
          value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} error={touched && errors.again} />
        {touched && errors.next && <p className="text-xs font-medium text-rose-600">Naya password kam se kam 8 akshar ka rakhein</p>}
        {touched && !errors.next && errors.again && <p className="text-xs font-medium text-rose-600">Dono naye password ek jaise nahi hain</p>}
        <button type="button" onClick={() => setShow((s) => !s)} className="flex items-center gap-1.5 text-sm font-semibold text-violet-700">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? 'Password chhupayein' : 'Password dikhayein'}
        </button>
      </form>
    </BottomSheet>
  )
}

export default function ProfilePage() {
  const user = useSession((s) => s.user)
  const setUser = useSession((s) => s.setUser)
  const pending = useBillStore((s) => Object.keys(s.pendingBills).length)
  const shopName = useBillStore((s) => s.shopInfo.name)
  const shopItemCount = useBillStore((s) => s.shopItems.length)
  const { setTab, setShopTab } = useBillStore.getState()
  const canInstall = useInstall((s) => !!s.prompt)
  const installed = useInstall((s) => s.installed)
  const [info, setInfo] = useState({ stats: null, createdAt: null, error: '' })

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user.name)
  const [savingName, setSavingName] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)

  useEffect(() => {
    let live = true
    api('/api/profile')
      .then(({ user: u, stats }) => {
        if (!live) return
        setInfo({ stats, createdAt: u.createdAt, error: '' })
        setUser({ id: u.id, email: u.email, name: u.name })
      })
      .catch((e) => live && setInfo((i) => ({ ...i, error: e.message })))
    return () => {
      live = false
    }
  }, [setUser])

  const saveName = async () => {
    if (!name.trim()) return
    setSavingName(true)
    try {
      const { user: u } = await api('/api/profile', { method: 'PATCH', body: { name } })
      setUser({ id: u.id, email: u.email, name: u.name })
      setEditingName(false)
      showToast('Naam update ho gaya')
    } catch (e) {
      showToast(e.message, true)
    } finally {
      setSavingName(false)
    }
  }

  const install = async () => {
    if (await installApp()) showToast('App install ho gaya, home screen pe dekhein')
  }
  const shareApp = async () => {
    const url = location.origin
    try {
      if (navigator.share) await navigator.share({ title: 'Kirana Bill', text: 'Bill of Supply seconds mein: Kirana Bill', url })
      else {
        await navigator.clipboard.writeText(url)
        showToast('Link copy ho gaya')
      }
    } catch {
      // share sheet closed
    }
  }

  const { stats } = info
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase()
  const avg = stats?.bills ? stats.total / stats.bills : 0

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-lg font-bold">Profile</h2>
        <p className="text-xs text-zinc-500">Aapka account aur bikri ka hisaab</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-4 p-5">
        <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-linear-to-br from-violet-600 to-indigo-600 text-2xl font-extrabold text-white shadow-lg shadow-violet-600/30">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()}
                maxLength={80} aria-label="Naam" className="field min-w-0 py-1.5" />
              <button type="button" onClick={saveName} disabled={savingName || !name.trim()} aria-label="Save" className="btn-primary size-9 shrink-0 p-0">
                {savingName ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              </button>
              <button type="button" onClick={() => (setEditingName(false), setName(user.name))} aria-label="Cancel" className="btn-ghost size-9 shrink-0 p-0">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="truncate text-lg font-extrabold">{user.name || 'Aapka naam'}</p>
              <button type="button" onClick={() => setEditingName(true)} aria-label="Naam badlein"
                className="grid size-7 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-violet-600">
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
          {info.createdAt && <p className="text-xs text-zinc-400">{fmtMonthYear(info.createdAt)} se member</p>}
        </div>
      </motion.div>

      {/* Sales summary: today leads, then this month and all time */}
      {stats ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-3">
          <div className="rounded-3xl bg-linear-to-br from-violet-600 to-indigo-600 p-5 text-white shadow-lg shadow-violet-600/25">
            <p className="text-sm font-semibold text-white/80">Aaj ki bikri</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">₹{inr(stats.todayTotal)}</p>
            <p className="text-sm text-white/80">{billsText(stats.todayBills)} aaj</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Is mahine" value={`₹${inr(stats.monthTotal)}`} sub={billsText(stats.monthBills)} />
            <Stat label="Ab tak kul" value={`₹${inr(stats.total)}`} sub={billsText(stats.bills)} />
          </div>
          {stats.bills > 0 && <p className="px-1 text-xs text-zinc-500">Ek bill ka average: <b className="text-zinc-700">₹{inr(avg)}</b></p>}
        </motion.div>
      ) : info.error ? (
        <p className="card p-4 text-sm text-zinc-500">Hisaab abhi nahi dikh raha: {info.error}</p>
      ) : (
        <div className="space-y-3">
          <div className="card h-28 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">{[0, 1].map((i) => <div key={i} className="card h-22 animate-pulse" />)}</div>
        </div>
      )}

      {pending > 0 && (
        <button type="button" onClick={() => setTab('bills')}
          className="flex w-full items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-sm font-medium text-amber-800">
          <CloudOff className="size-4 shrink-0" />
          <span className="flex-1">{pending} bill abhi server pe save nahi hue. Net aate hi ho jayenge.</span>
          <ChevronRight className="size-4" />
        </button>
      )}

      <section>
        <p className="field-label px-1">Jaldi jaayein</p>
        <ul className="card divide-y divide-zinc-100 overflow-hidden">
          <Row icon={Store} label="Meri Shop" sub={shopName ? `${shopName} · ${shopItemCount} items ki rate list` : 'Dukaan aur rate list banayein'}
            onClick={() => (setTab('shops'), setShopTab('mine'))} />
          <Row icon={ReceiptText} label="Mere bills" sub={stats ? `${billsText(stats.bills)} · search, PDF, edit` : 'Bill history'} onClick={() => setTab('bills')} />
          <Row icon={Settings} label="Settings" sub="Stamp, signature, bill number, backup" onClick={() => setTab('settings')} />
        </ul>
      </section>

      <section>
        <p className="field-label px-1">Account aur app</p>
        <ul className="card divide-y divide-zinc-100 overflow-hidden">
          <Row icon={KeyRound} label="Password badlein" sub="Purana password chahiye hoga" onClick={() => setPwOpen(true)} />
          <NotifySetting variant="row" />
          {canInstall && !installed && (
            <Row icon={Download} label="Phone pe app install karein" sub="Home screen se seedha khulega, offline bhi" onClick={install} tone="bg-emerald-50 text-emerald-600" />
          )}
          <Row icon={Share2} label="Doston ko app batayein" sub="Doosre dukaandaar ko link bhejein" onClick={shareApp} />
          <Row icon={LogOut} label="Logout" danger onClick={() => setConfirmOut(true)} />
        </ul>
      </section>

      <p className="pb-2 text-center text-xs text-zinc-400">Kirana Bill · {installed ? 'App mode' : 'Browser'}</p>

      <PasswordSheet open={pwOpen} email={user.email} onClose={() => setPwOpen(false)} />
      <ConfirmDialog
        open={confirmOut}
        danger
        icon={LogOut}
        title="Logout karein?"
        message={
          pending
            ? `${pending} bill abhi server pe save nahi hue. Woh is phone pe rahenge aur dobara login karte hi save ho jayenge.`
            : 'Is phone pe dukaan ki details aur bill ka draft rahenge, dobara login karte hi mil jayenge.'
        }
        confirmLabel="Haan, logout"
        onCancel={() => setConfirmOut(false)}
        onConfirm={logout}
      />
    </div>
  )
}
