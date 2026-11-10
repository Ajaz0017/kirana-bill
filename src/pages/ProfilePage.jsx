import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, KeyRound, LoaderCircle, LogOut, Pencil, ReceiptText, UserRound, X } from 'lucide-react'
import { logout, useSession } from '../store/useSession'
import { useBillStore } from '../store/useBillStore'
import { showToast } from '../store/useToast'
import ConfirmDialog from '../components/ConfirmDialog'
import { Field, Section } from '../components/FormBits'
import { api } from '../utils/api'
import { inr } from '../utils/format'

const fmtMonthYear = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '')

function Stat({ label, value, sub, index }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + index * 0.05 }} className="card p-4">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </motion.div>
  )
}

export default function ProfilePage() {
  const user = useSession((s) => s.user)
  const setUser = useSession((s) => s.setUser)
  const pending = useBillStore((s) => Object.keys(s.pendingBills).length)
  const [info, setInfo] = useState({ stats: null, createdAt: null, error: '' })

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user.name)
  const [savingName, setSavingName] = useState(false)

  const [pw, setPw] = useState({ current: '', next: '', again: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwTouched, setPwTouched] = useState(false)
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

  const pwErrors = {
    current: !pw.current,
    next: pw.next.length < 8,
    again: pw.again !== pw.next,
  }
  const changePassword = async (e) => {
    e.preventDefault()
    setPwTouched(true)
    if (Object.values(pwErrors).some(Boolean)) return
    setPwBusy(true)
    try {
      await api('/api/profile', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } })
      setPw({ current: '', next: '', again: '' })
      setPwTouched(false)
      showToast('Password badal gaya')
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setPwBusy(false)
    }
  }

  const { stats } = info
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase()

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-4 p-5">
        <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-linear-to-br from-violet-600 to-indigo-600 text-2xl font-extrabold text-white shadow-lg shadow-violet-600/30">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                maxLength={80}
                aria-label="Naam"
                className="field min-w-0 py-1.5"
              />
              <button type="button" onClick={saveName} disabled={savingName || !name.trim()} aria-label="Save" className="btn-primary size-9 shrink-0 p-0">
                {savingName ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              </button>
              <button type="button" onClick={() => (setEditingName(false), setName(user.name))} aria-label="Cancel" className="btn-ghost size-9 shrink-0 p-0">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-lg font-extrabold">{user.name || 'Aapka naam'}</h2>
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

      <div className="grid grid-cols-2 gap-3">
        {stats ? (
          <>
            <Stat index={0} label="Kul bills" value={stats.bills} sub={pending ? `+${pending} save hona baaki` : undefined} />
            <Stat index={1} label="Kul bikri" value={`₹${inr(stats.total)}`} />
            <Stat index={2} label="Is mahine bills" value={stats.monthBills} />
            <Stat index={3} label="Is mahine bikri" value={`₹${inr(stats.monthTotal)}`} />
          </>
        ) : info.error ? (
          <p className="col-span-2 px-1 text-sm text-zinc-500">Hisaab abhi nahi dikh raha: {info.error}</p>
        ) : (
          [0, 1, 2, 3].map((i) => <div key={i} className="card h-22 animate-pulse" />)
        )}
      </div>

      <Section index={1} icon={KeyRound} title="Password badlein">
        <form onSubmit={changePassword} className="space-y-3">
          {/* Lets password managers attach the new password to the right account */}
          <input type="email" autoComplete="username" value={user.email} readOnly hidden />
          <Field label="Purana password" type="password" id="pw-current" autoComplete="current-password"
            value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwTouched && pwErrors.current} />
          <Field label="Naya password" type="password" id="pw-next" autoComplete="new-password" placeholder="Kam se kam 8 akshar"
            value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={pwTouched && pwErrors.next} />
          <Field label="Naya password dobara" type="password" id="pw-again" autoComplete="new-password"
            value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} error={pwTouched && pwErrors.again} />
          {pwTouched && pwErrors.again && !pwErrors.next && <p className="text-xs font-medium text-rose-600">Dono naye password ek jaise nahi hain</p>}
          <button type="submit" disabled={pwBusy} className="btn-primary w-full py-3">
            {pwBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Password badlein
          </button>
        </form>
      </Section>

      <Section index={2} icon={UserRound} title="Account">
        <button type="button" onClick={() => useBillStore.getState().setTab('bills')} className="btn-ghost w-full justify-start py-3">
          <ReceiptText className="size-4" /> Mere bills
        </button>
        <button type="button" onClick={() => setConfirmOut(true)} className="btn w-full justify-start border border-rose-100 bg-white py-3 text-rose-600 hover:bg-rose-50">
          <LogOut className="size-4" /> Logout
        </button>
      </Section>

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
