import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, LoaderCircle } from 'lucide-react'
import { showToast } from '../store/useToast'
import { disablePush, enablePush, pushState } from '../utils/push'

const TEXT = {
  on: { title: 'Naye order ki notification chalu hai', sub: 'Is phone pe, app band ho tab bhi' },
  off: { title: 'Naye order pe notification', sub: 'App band ho tab bhi phone pe pata chale' },
  denied: { title: 'Notification block hai', sub: 'Browser / phone settings mein is site ki notification allow karein' },
  'ios-home': { title: 'iPhone pe notification', sub: 'Pehle Share → "Add to Home Screen", phir wahan se chalu karein' },
  unsupported: { title: 'Notification nahi chalegi', sub: 'Is browser mein web notification nahi hai' },
}

/** Turn new-order notifications on/off for this phone. variant: 'card' (Orders page) | 'row' (Profile list) */
export default function NotifySetting({ variant = 'card' }) {
  const [state, setState] = useState(null) // null = checking
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    pushState().then((s) => live && setState(s))
    return () => {
      live = false
    }
  }, [])

  const toggle = async () => {
    setBusy(true)
    try {
      if (state === 'on') {
        await disablePush()
        setState('off')
        showToast('Notification band')
      } else {
        await enablePush()
        setState('on')
        showToast('Notification chalu: naya order aate hi pata chalega')
      }
    } catch (e) {
      showToast(e.message, true)
      setState(await pushState())
    } finally {
      setBusy(false)
    }
  }

  if (!state) return variant === 'card' ? <div className="card h-16 animate-pulse" /> : null
  const t = TEXT[state]
  const actionable = state === 'on' || state === 'off'
  const Icon = state === 'on' ? BellRing : state === 'off' ? Bell : BellOff
  const tone = state === 'on' ? 'bg-emerald-50 text-emerald-600' : state === 'off' ? 'bg-violet-50 text-violet-600' : 'bg-zinc-100 text-zinc-500'

  if (variant === 'row') {
    return (
      <li>
        <button type="button" onClick={actionable ? toggle : undefined} disabled={busy}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-50">
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-4.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t.title}</span>
            <span className="block text-xs text-zinc-500">{t.sub}</span>
          </span>
          {actionable && (
            <span className={`shrink-0 text-sm font-bold ${state === 'on' ? 'text-zinc-500' : 'text-violet-700'}`}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : state === 'on' ? 'Band' : 'Chalu'}
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <div className="card flex items-center gap-3 p-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{t.title}</span>
        <span className="block text-xs text-zinc-500">{t.sub}</span>
      </span>
      {actionable && (
        <button type="button" onClick={toggle} disabled={busy} className={`${state === 'on' ? 'btn-ghost' : 'btn-primary'} shrink-0 px-3 py-2`}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : state === 'on' ? 'Band karein' : 'Chalu karein'}
        </button>
      )}
    </div>
  )
}
