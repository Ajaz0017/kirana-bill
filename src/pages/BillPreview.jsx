import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Download, FileDown, FilePlus2, LoaderCircle, Pencil, Printer, Share2 } from 'lucide-react'
import { selectTotal, useBillStore } from '../store/useBillStore'
import BillTable from '../components/BillTable'
import BottomBar from '../components/BottomBar'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import { billToPdf, downloadFile, pxToMm } from '../utils/pdf'

const SHEET_W = 794 // A4 width at 96dpi

export default function BillPreview() {
  const items = useBillStore((s) => s.items)
  const details = useBillStore((s) => s.details)
  const shopInfo = useBillStore((s) => s.shopInfo)
  const total = useBillStore(selectTotal)
  const { goTo, finishBill } = useBillStore.getState()
  const [confirmNew, setConfirmNew] = useState(false)
  const billRef = useRef(null)
  const [pdf, setPdf] = useState({ busy: false, file: null, error: '' })

  // Render the bill at true A4 width and shrink it to fit the phone, so screen == paper
  const frameRef = useRef(null)
  const sheetRef = useRef(null)
  const [fit, setFit] = useState({ scale: 1, height: 1123 })
  useLayoutEffect(() => {
    const measure = () =>
      setFit({
        scale: Math.min(1, frameRef.current.clientWidth / SHEET_W),
        height: sheetRef.current.offsetHeight,
      })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frameRef.current)
    ro.observe(sheetRef.current)
    return () => ro.disconnect()
  }, [])

  const fileName = `Bill-${details.invoiceNo}${details.customerName ? `-${details.customerName.trim().replace(/\s+/g, '-')}` : ''}.pdf`

  const makePdf = async () => {
    setPdf({ busy: true, file: null, error: '' })
    try {
      await document.fonts?.ready
      setPdf({ busy: false, file: await billToPdf(billRef.current, fileName), error: '' })
    } catch (e) {
      console.error(e)
      setPdf({ busy: false, file: null, error: 'PDF nahi ban paya, dobara try karein' })
    }
  }
  const closePdf = () => setPdf((p) => ({ ...p, file: null, error: '' }))
  const canShare = !!pdf.file && !!navigator.canShare?.({ files: [pdf.file] })
  const share = async () => {
    try {
      await navigator.share({ files: [pdf.file], title: fileName })
    } catch {
      // user closed the share sheet
    }
  }

  const print = () => {
    // One paper page as tall as the bill (honoured by desktop Chrome/Edge; phones may still use A4)
    const page = document.createElement('style')
    page.textContent = `@page { size: 210mm ${pxToMm(billRef.current.offsetHeight).toFixed(1)}mm; margin: 0 }`
    document.head.append(page)
    const prev = document.title
    document.title = fileName.replace(/\.pdf$/, '')
    window.addEventListener(
      'afterprint',
      () => {
        page.remove()
        document.title = prev
      },
      { once: true },
    )
    window.print()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        ref={frameRef}
        className="bill-frame"
        style={{ transformPerspective: 1200, height: fit.height * fit.scale }}
      >
        <div
          ref={sheetRef}
          className="bill-sheet origin-top-left overflow-hidden rounded-lg shadow-[0_20px_60px_-20px_rgb(0_0_0/0.35)]"
          style={{ width: SHEET_W, transform: `scale(${fit.scale})` }}
        >
          <BillTable ref={billRef} items={items} details={details} shopInfo={shopInfo} total={total} />
        </div>
      </motion.div>

      <BottomBar>
        <button type="button" onClick={() => goTo(1)} className="btn-ghost px-4 py-3" aria-label="Edit details">
          <Pencil className="size-4" />
        </button>
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={makePdf} disabled={pdf.busy} className="btn-primary flex-1 py-3">
          {pdf.busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          {pdf.busy ? 'Ban raha hai…' : 'PDF'}
        </motion.button>
        <button type="button" onClick={print} className="btn-ghost px-4 py-3" aria-label="Print">
          <Printer className="size-4" />
        </button>
        <button type="button" onClick={() => setConfirmNew(true)} className="btn-ghost px-4 py-3">
          <FilePlus2 className="size-4" /> <span className="hidden sm:inline">Naya bill</span>
        </button>
      </BottomBar>

      <BottomSheet open={!!pdf.file || !!pdf.error} title={pdf.error ? 'Oops' : 'PDF taiyaar hai'} onClose={closePdf}>
        {pdf.error ? (
          <p className="pb-2 text-sm text-rose-600">{pdf.error}</p>
        ) : (
          <div className="space-y-3 pb-2">
            <p className="truncate text-sm text-zinc-500">{pdf.file?.name}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => downloadFile(pdf.file)} className={`${canShare ? 'btn-ghost' : 'btn-primary'} flex-1 py-3.5 text-base`}>
                <Download className="size-5" /> Download
              </button>
              {canShare && (
                <button type="button" onClick={share} className="btn-primary flex-1 py-3.5 text-base">
                  <Share2 className="size-5" /> Share
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmNew}
        title="Naya bill shuru karein?"
        message={`Bill #${details.invoiceNo} save ho jayega aur agla invoice number ${
          (parseInt(details.invoiceNo, 10) || 0) + 1
        } hoga. Dukaan ki details yaad rahengi.`}
        confirmLabel="Haan, naya bill"
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false)
          finishBill()
        }}
      />
    </>
  )
}
