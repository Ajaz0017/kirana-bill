import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, FileText, ImageUp, QrCode, RotateCcw, Stamp, Store, Trash2, UserRound } from 'lucide-react'
import { useBillStore } from '../store/useBillStore'
import BottomBar from '../components/BottomBar'
import { imageToDataURL } from '../utils/image'
import defaultStamp from '../assets/stamp.png'
import defaultSignature from '../assets/signature.png'

const Section = ({ icon: Icon, title, hint, children, index }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.07, type: 'spring', stiffness: 300, damping: 30 }}
    className="card p-5"
  >
    <div className="mb-4 flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-600">
        <Icon className="size-4.5" />
      </span>
      <div>
        <h2 className="font-bold">{title}</h2>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
    </div>
    <div className="space-y-3">{children}</div>
  </motion.section>
)

const Field = ({ label, error, textarea, ...props }) => {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <div>
      <label className="field-label" htmlFor={props.id}>{label}</label>
      <Tag
        className={`field ${textarea ? 'min-h-18 resize-none' : ''} ${
          error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15' : ''
        }`}
        rows={textarea ? 2 : undefined}
        {...props}
      />
    </div>
  )
}

// Preview + change/remove for the stamp & signature shown on the bill
const ImagePick = ({ label, value, fallback, onChange }) => {
  const src = value === 'default' ? fallback : value
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onChange(await imageToDataURL(file))
  }
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="grid h-24 place-items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-2">
        {src ? <img src={src} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-zinc-400">Nahi hai</span>}
      </div>
      <div className="mt-2 flex gap-1.5">
        <label className="btn-ghost flex-1 cursor-pointer px-2 py-2 text-xs">
          <ImageUp className="size-3.5" /> Badlein
          <input type="file" accept="image/*" className="sr-only" onChange={pick} />
        </label>
        {value === 'default' ? (
          <button type="button" onClick={() => onChange('')} aria-label={`${label} hatayein`} className="btn-ghost px-2.5 py-2">
            <Trash2 className="size-3.5" />
          </button>
        ) : (
          <button type="button" onClick={() => onChange('default')} aria-label={`${label} default karein`} className="btn-ghost px-2.5 py-2">
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function DetailsPage() {
  const details = useBillStore((s) => s.details)
  const shopInfo = useBillStore((s) => s.shopInfo)
  const { setDetails, setShopInfo, goTo } = useBillStore.getState()
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
  const s = (key) => ({ id: `shop-${key}`, value: shopInfo[key], onChange: (e) => setShopInfo({ [key]: e.target.value }) })

  return (
    <div className="space-y-4">
      <Section index={0} icon={FileText} title="Bill details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice No." inputMode="numeric" error={touched && missing.invoiceNo} {...d('invoiceNo')} />
          <Field label="Date" type="date" error={touched && missing.date} {...d('date')} />
        </div>
      </Section>

      <Section index={4} icon={UserRound} title="Customer (Buyer)">
        <Field label="Naam" placeholder="Customer ka naam" {...d('customerName')} />
        <Field label="Address" textarea placeholder="Customer ka pata" {...d('customerAddress')} />
        <Field label="Mobile" type="tel" inputMode="tel" placeholder="Optional" {...d('customerMobile')} />
      </Section>

      <Section index={2} icon={QrCode} title="UPI payment" hint="Bill pe QR banega, scan karte hi amount bhar jayega">
        <Field label="UPI ID" placeholder="naam@okhdfcbank" autoCapitalize="none" autoCorrect="off" {...s('upiId')} />
        <Field label="UPI pe naam" placeholder="Jo naam UPI app mein dikhta hai" {...s('upiName')} />
        <Field label="Pay on mobile no." type="tel" inputMode="tel" placeholder={'UPI se juda mobile'} {...s('upiMobile')} />
      </Section>

      <Section index={1} icon={Store} title="Aapki dukaan" hint="Ek baar bharein, agle bill mein yaad rahega">
        <Field label="Shop name" placeholder="e.g. Akhlaque Kirana Store" error={touched && missing.shopName} {...s('name')} />
        <Field label="Address" textarea placeholder="Gali, mohalla, shehar, PIN" {...s('address')} />
        <Field label="Mobile" type="tel" inputMode="tel" placeholder="98XXXXXXXX" {...s('mobile')} />
      </Section>

      <Section index={3} icon={Stamp} title="Stamp & Signature">
        <div className="grid grid-cols-2 gap-3">
          <ImagePick label="Stamp" value={shopInfo.stamp} fallback={defaultStamp} onChange={(v) => setShopInfo({ stamp: v })} />
          <ImagePick label="Signature" value={shopInfo.signature} fallback={defaultSignature} onChange={(v) => setShopInfo({ signature: v })} />
        </div>
      </Section>

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
