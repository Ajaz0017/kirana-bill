import { useRef } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, FileDown, LoaderCircle, Pencil, Printer } from 'lucide-react'
import { useBillStore } from '../store/useBillStore'
import BillSheet from '../components/BillSheet'
import BottomBar from '../components/BottomBar'
import { useBillExport } from '../components/BillExport'
import { resolveShop } from '../utils/billSync'
import { fmtDate } from '../utils/format'

// A saved bill from history: look at it, PDF / WhatsApp / print it again, or edit it
export default function BillViewer({ onEdit }) {
  const bill = useBillStore((s) => s.viewing)
  const current = useBillStore((s) => s.shopInfo)
  const { setViewing } = useBillStore.getState()
  const billRef = useRef(null)

  const { items, details } = bill.data
  const shopInfo = resolveShop(bill.data.shopInfo, current)
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const { busy, makePdf, print, sheet } = useBillExport({ billRef, items, details, shopInfo, total })

  return (
    <>
      <div className="mb-3 flex items-center gap-3 px-1 print:hidden">
        <button type="button" onClick={() => setViewing(null)} aria-label="Wapas" className="btn-ghost size-10 p-0">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">Bill #{details.invoiceNo}</h2>
          <p className="truncate text-xs text-zinc-500">
            {[fmtDate(details.date), details.customerName].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <BillSheet ref={billRef} items={items} details={details} shopInfo={shopInfo} total={total} />

      <BottomBar>
        <button type="button" onClick={() => setViewing(null)} className="btn-ghost px-4 py-3" aria-label="Wapas">
          <ArrowLeft className="size-4" />
        </button>
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={makePdf} disabled={busy} className="btn-primary flex-1 py-3">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          {busy ? 'Ban raha hai…' : 'PDF'}
        </motion.button>
        <button type="button" onClick={print} className="btn-ghost px-4 py-3" aria-label="Print">
          <Printer className="size-4" />
        </button>
        <button type="button" onClick={() => onEdit(bill)} className="btn-ghost px-4 py-3" aria-label="Edit">
          <Pencil className="size-4" />
        </button>
      </BottomBar>

      {sheet}
    </>
  )
}
