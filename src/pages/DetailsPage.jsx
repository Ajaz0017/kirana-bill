import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ChevronRight, FileText, Settings, Store, UserRound } from 'lucide-react'
import { useBillStore } from '../store/useBillStore'
import BottomBar from '../components/BottomBar'
import { Field, Section } from '../components/FormBits'

export default function DetailsPage() {
  const details = useBillStore((s) => s.details)
  const shopInfo = useBillStore((s) => s.shopInfo)
  const { setDetails, goTo, openSettings } = useBillStore.getState()
  const [touched, setTouched] = useState(false)

  const missing = {
    shopName: !shopInfo.name.trim(),
    invoiceNo: !details.invoiceNo.trim(),
    date: !details.date,
  }
  const valid = !Object.values(missing).some(Boolean)

  const proceed = () => {
    setTouched(true)
    if (valid) goTo(2)
  }

  const d = (key) => ({ id: key, value: details[key], onChange: (e) => setDetails({ [key]: e.target.value }) })

  return (
    <div className="space-y-4">
      <Section index={0} icon={FileText} title="Bill details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice No." inputMode="numeric" error={touched && missing.invoiceNo} {...d('invoiceNo')} />
          <Field label="Date" type="date" error={touched && missing.date} {...d('date')} />
        </div>
      </Section>

      <Section index={1} icon={UserRound} title="Customer (Buyer)">
        <Field label="Naam" placeholder="Customer ka naam" {...d('customerName')} />
        <Field label="Address" textarea placeholder="Customer ka pata" {...d('customerAddress')} />
        <Field label="Mobile" type="tel" inputMode="tel" placeholder="Optional" {...d('customerMobile')} />
      </Section>

      {/* Shop details live in Settings; this just shows which shop the bill is from */}
      <motion.button type="button" onClick={openSettings} whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
        className={`card flex w-full items-center gap-3 p-4 text-left ${touched && missing.shopName ? 'ring-2 ring-rose-400' : ''}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600">
          <Store className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          {shopInfo.name ? (
            <>
              <span className="block truncate font-bold">{shopInfo.name}</span>
              <span className="block truncate text-xs text-zinc-500">Dukaan, UPI, stamp: Settings mein badlein</span>
            </>
          ) : (
            <>
              <span className="block font-bold text-rose-600">Dukaan ki details bharein</span>
              <span className="block text-xs text-zinc-500">Shop name bill pe zaroori hai</span>
            </>
          )}
        </span>
        <Settings className="size-4 text-zinc-400" />
        <ChevronRight className="size-4 text-zinc-400" />
      </motion.button>

      <AnimatePresence>
        {touched && !valid && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-1 text-sm font-medium text-rose-600">
            Laal wale fields bharna zaroori hai
          </motion.p>
        )}
      </AnimatePresence>

      <BottomBar>
        <button type="button" onClick={() => goTo(0)} className="btn-ghost px-4 py-3" aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={proceed} className="btn-primary flex-1 py-3">
          Bill dekhein <FileText className="size-4" />
        </motion.button>
      </BottomBar>
    </div>
  )
}
