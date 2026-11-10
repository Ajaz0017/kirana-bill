import { useState } from 'react'
import { Download, MessageCircle, Share2 } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { billToPdf, downloadFile, pxToMm } from '../utils/pdf'
import { billMessage, waLink, waNumber } from '../utils/whatsapp'

export const billFileName = (details) =>
  `Bill-${details.invoiceNo}${details.customerName ? `-${details.customerName.trim().replace(/\s+/g, '-')}` : ''}.pdf`

/**
 * PDF / print / WhatsApp for a rendered bill (used by the new-bill preview and the history viewer).
 * Returns the actions plus `sheet`, the "PDF taiyaar hai" bottom sheet to render.
 */
export function useBillExport({ billRef, items, details, shopInfo, total }) {
  const [pdf, setPdf] = useState({ busy: false, file: null, error: '' })
  const fileName = billFileName(details)

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

  const closePdf = () => setPdf((p) => ({ ...p, file: null, error: '' }))
  const canShare = !!pdf.file && !!navigator.canShare?.({ files: [pdf.file] })
  const message = billMessage({ shopInfo, details, total, itemCount: items.length })
  const customerWa = waNumber(details.customerMobile)
  // WhatsApp links can't carry files: save the PDF first so it's one tap to attach in the chat
  const openWhatsApp = () => {
    downloadFile(pdf.file)
    window.open(waLink(customerWa, message), '_blank', 'noopener')
  }
  const share = async () => {
    try {
      await navigator.share({ files: [pdf.file], title: fileName, text: message })
    } catch {
      // user closed the share sheet
    }
  }

  const sheet = (
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
          <button type="button" onClick={openWhatsApp} className="btn-whatsapp w-full py-3.5 text-base">
            <MessageCircle className="size-5" />
            {customerWa ? `WhatsApp: ${details.customerMobile}` : 'WhatsApp pe bhejein'}
          </button>
          <p className="text-xs text-zinc-500">
            {customerWa
              ? 'Customer ki chat bill ke message ke saath khulegi. PDF download ho jayega, chat mein 📎 se attach karein.'
              : canShare
                ? 'Share se PDF seedha WhatsApp pe jayega. Customer ka mobile Details mein daalein to unki chat seedhe khulegi.'
                : 'Customer ka mobile Details mein daalein to unki chat seedhe khulegi.'}
          </p>
        </div>
      )}
    </BottomSheet>
  )

  return { busy: pdf.busy, makePdf, print, sheet }
}
