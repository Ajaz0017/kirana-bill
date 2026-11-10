import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { FileDown, FilePlus2, LoaderCircle, Pencil, Printer } from 'lucide-react'
import { selectTotal, useBillStore } from '../store/useBillStore'
import BillSheet from '../components/BillSheet'
import BottomBar from '../components/BottomBar'
import ConfirmDialog from '../components/ConfirmDialog'
import { useBillExport } from '../components/BillExport'
import { saveDraft } from '../utils/billSync'
import { showToast } from '../store/useToast'

export default function BillPreview() {
  const items = useBillStore((s) => s.items)
  const details = useBillStore((s) => s.details)
  const shopInfo = useBillStore((s) => s.shopInfo)
  const total = useBillStore(selectTotal)
  const { goTo, finishBill } = useBillStore.getState()
  const [confirmNew, setConfirmNew] = useState(false)
  const billRef = useRef(null)
  const { busy, makePdf, print, sheet } = useBillExport({ billRef, items, details, shopInfo, total })

  // A bill that reached the preview goes to history (same draft = same entry, updated if edited)
  useEffect(() => {
    saveDraft()
  }, [])

  const startNew = () => {
    setConfirmNew(false)
    const no = details.invoiceNo
    // saveDraft takes its copy of the bill right away, so the draft can be cleared without waiting
    saveDraft().then((saved) => showToast(saved ? `Bill #${no} history mein save ho gaya` : `Bill #${no} net aate hi save ho jayega`))
    finishBill()
  }

  return (
    <>
      <BillSheet ref={billRef} items={items} details={details} shopInfo={shopInfo} total={total} />

      <BottomBar>
        <button type="button" onClick={() => goTo(1)} className="btn-ghost px-4 py-3" aria-label="Edit details">
          <Pencil className="size-4" />
        </button>
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={makePdf} disabled={busy} className="btn-primary flex-1 py-3">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          {busy ? 'Ban raha hai…' : 'PDF'}
        </motion.button>
        <button type="button" onClick={print} className="btn-ghost px-4 py-3" aria-label="Print">
          <Printer className="size-4" />
        </button>
        <button type="button" onClick={() => setConfirmNew(true)} className="btn-ghost px-4 py-3" aria-label="Naya bill">
          <FilePlus2 className="size-4" /> <span className="hidden sm:inline">Naya bill</span>
        </button>
      </BottomBar>

      {sheet}

      <ConfirmDialog
        open={confirmNew}
        title="Naya bill shuru karein?"
        message={`Bill #${details.invoiceNo} history mein save ho jayega aur agla invoice number ${
          (parseInt(details.invoiceNo, 10) || 0) + 1
        } hoga. Dukaan ki details yaad rahengi.`}
        confirmLabel="Haan, naya bill"
        onCancel={() => setConfirmNew(false)}
        onConfirm={startNew}
      />
    </>
  )
}
