import { useCallback, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Brain, Check, DatabaseBackup, Download, FileUp, Hash, QrCode, Share2, Stamp, Store } from 'lucide-react'
import { useBillStore } from '../store/useBillStore'
import BottomBar from '../components/BottomBar'
import ConfirmDialog from '../components/ConfirmDialog'
import Toast from '../components/Toast'
import { Field, ImagePick, Section } from '../components/FormBits'
import { makeBackupFile, readBackupFile } from '../utils/backup'
import { downloadFile } from '../utils/pdf'
import defaultStamp from '../assets/stamp.png'
import defaultSignature from '../assets/signature.png'

const fmtWhen = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'pata nahi'

// Shop details, payment, numbering, backup: things set once, not per bill
export default function SettingsPage() {
  const shopInfo = useBillStore((s) => s.shopInfo)
  const lastInvoiceNo = useBillStore((s) => s.lastInvoiceNo)
  const knownCount = useBillStore((s) => s.knownItems.length)
  const fixCount = useBillStore((s) => Object.keys(s.nameFixes).length)
  const { setShopInfo, closeSettings, setNextInvoiceNo, clearLearning, restoreBackup } = useBillStore.getState()

  const [nextNo, setNextNo] = useState(String(lastInvoiceNo + 1))
  // Kept after closing so the dialog text doesn't blank out mid-animation
  const [confirm, setConfirmData] = useState(null) // { title, message, label, danger?, run }
  const [confirmOpen, setConfirmOpen] = useState(false)
  const setConfirm = (c) => {
    setConfirmData(c)
    setConfirmOpen(true)
  }
  const [toast, setToast] = useState(null)
  const clearToast = useCallback(() => setToast(null), [])
  const restoreInput = useRef(null)
  const toastId = useRef(0)
  const say = (text, error = false) => setToast({ id: ++toastId.current, text, error })

  const s = (key) => ({ id: `shop-${key}`, value: shopInfo[key] ?? '', onChange: (e) => setShopInfo({ [key]: e.target.value }) })

  const n = parseInt(nextNo, 10)
  const nextValid = Number.isInteger(n) && n >= 1
  const saveNextNo = () => {
    setNextInvoiceNo(n)
    say(`Agla bill #${n} hoga`)
  }

  const backupFile = () => makeBackupFile(useBillStore.getState())
  const canShareFiles = !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })
  const shareBackup = async () => {
    try {
      await navigator.share({ files: [backupFile()], title: 'Kirana Bill backup' })
    } catch {
      // share sheet closed
    }
  }

  const pickRestore = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { data, exportedAt } = await readBackupFile(file)
      setConfirm({
        title: 'Backup wapas laayein?',
        message: `Backup ${fmtWhen(exportedAt)} ka hai${data.shopInfo.name ? ` (${data.shopInfo.name})` : ''}. Is phone ki dukaan ki details, bill number aur scan ki yaaddasht isse badal jayegi.`,
        label: 'Haan, wapas laayein',
        run: () => {
          restoreBackup(data)
          setNextNo(String((data.lastInvoiceNo ?? lastInvoiceNo) + 1))
          say('Backup se data wapas aa gaya')
        },
      })
    } catch (err) {
      say(err.message, true)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-1">
        <button type="button" onClick={closeSettings} aria-label="Wapas" className="btn-ghost size-10 p-0">
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold">Settings</h2>
          <p className="text-xs text-zinc-500">Ek baar bharein, har bill mein kaam aayega</p>
        </div>
      </div>

      <Section index={0} icon={Store} title="Aapki dukaan">
        <Field label="Shop name" placeholder="e.g. Akhlaque Kirana Store" {...s('name')} />
        <Field label="Address" textarea placeholder="Gali, mohalla, shehar, PIN" {...s('address')} />
        <Field label="Mobile" type="tel" inputMode="tel" placeholder="98XXXXXXXX" {...s('mobile')} />
      </Section>

      <Section index={1} icon={QrCode} title="UPI payment" hint="Bill pe QR banega, scan karte hi amount bhar jayega">
        <Field label="UPI ID" placeholder="naam@okhdfcbank" autoCapitalize="none" autoCorrect="off" {...s('upiId')} />
        <Field label="UPI pe naam" placeholder="Jo naam UPI app mein dikhta hai" {...s('upiName')} />
        <Field label="Pay on mobile no." type="tel" inputMode="tel" placeholder={shopInfo.mobile || 'UPI se juda mobile'} {...s('upiMobile')} />
      </Section>

      <Section index={2} icon={Stamp} title="Stamp & Signature">
        <div className="grid grid-cols-2 gap-3">
          <ImagePick label="Stamp" value={shopInfo.stamp} fallback={defaultStamp} onChange={(v) => setShopInfo({ stamp: v })} />
          <ImagePick label="Signature" value={shopInfo.signature} fallback={defaultSignature} onChange={(v) => setShopInfo({ signature: v })} />
        </div>
      </Section>

      <Section index={3} icon={Hash} title="Invoice number" hint={`Pichhla bill #${lastInvoiceNo || '—'}`}>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Agla bill number" inputMode="numeric" id="next-invoice" value={nextNo}
              onChange={(e) => setNextNo(e.target.value.replace(/\D/g, ''))} error={!nextValid} />
          </div>
          <button type="button" disabled={!nextValid || n === lastInvoiceNo + 1} onClick={saveNextNo} className="btn-primary h-11.5 px-4">
            <Check className="size-4" /> Set
          </button>
        </div>
        <button type="button" className="btn-ghost w-full"
          onClick={() => setConfirm({
            title: 'Bill number 1 se shuru karein?',
            message: 'Naye saal ke liye theek hai. Purane bill numbers dobara aa sakte hain.',
            label: 'Haan, 1 se shuru',
            danger: true,
            run: () => {
              setNextInvoiceNo(1)
              setNextNo('1')
              say('Agla bill #1 hoga')
            },
          })}>
          1 se shuru karein
        </button>
      </Section>

      <Section index={4} icon={DatabaseBackup} title="Backup" hint="Phone badle ya data saaf ho jaye, to isse sab wapas aa jayega">
        <div className="flex gap-2">
          <button type="button" onClick={() => downloadFile(backupFile())} className={`${canShareFiles ? 'btn-ghost' : 'btn-primary'} flex-1 py-3`}>
            <Download className="size-4" /> Download
          </button>
          {canShareFiles && (
            <button type="button" onClick={shareBackup} className="btn-primary flex-1 py-3">
              <Share2 className="size-4" /> Share
            </button>
          )}
        </div>
        <button type="button" onClick={() => restoreInput.current?.click()} className="btn-ghost w-full py-3">
          <FileUp className="size-4" /> Backup file se wapas laayein
        </button>
        <input ref={restoreInput} type="file" accept="application/json,.json" className="hidden" onChange={pickRestore} />
        <p className="text-xs text-zinc-500">
          File ko WhatsApp pe khud ko ya Google Drive mein bhej dein. Isme dukaan ki details, bill number aur scan ki yaaddasht hoti hai.
        </p>
      </Section>

      <Section index={5} icon={Brain} title="Scan ki yaaddasht" hint="Scan aapke sudhaar se seekhta hai">
        <p className="text-sm text-zinc-600">
          <b>{knownCount}</b> items ke naam aur <b>{fixCount}</b> sudhaar yaad hain.
        </p>
        <button type="button" disabled={!knownCount && !fixCount} className="btn-ghost w-full"
          onClick={() => setConfirm({
            title: 'Scan ki yaaddasht mitayein?',
            message: 'Scan phir se shuru se seekhega. Bills aur dukaan ki details par asar nahi padega.',
            label: 'Haan, mitayein',
            danger: true,
            run: () => {
              clearLearning()
              say('Yaaddasht mita di')
            },
          })}>
          Sab bhool jao
        </button>
      </Section>

      <BottomBar>
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={closeSettings} className="btn-primary flex-1 py-3">
          <Check className="size-4" /> Ho gaya
        </motion.button>
      </BottomBar>

      <ConfirmDialog
        open={confirmOpen}
        danger={confirm?.danger}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          confirm.run()
          setConfirmOpen(false)
        }}
      />
      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}
