import { fmtDateLong, inr } from './format'

/** Indian mobile -> WhatsApp's international form ("98765 43210" / "098..." / "+91..." -> "9198...") */
export function waNumber(mobile) {
  const d = String(mobile ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (d.length === 10) return `91${d}`
  if (d.length === 12 && d.startsWith('91')) return d
  return null
}

// Short summary that goes with the PDF (WhatsApp shows *text* as bold)
export function billMessage({ shopInfo, details, total, itemCount }) {
  return [
    `*${shopInfo.name || 'Bill'}*`,
    `Bill No. ${details.invoiceNo} · ${fmtDateLong(details.date)}`,
    details.customerName && `Customer: ${details.customerName}`,
    `Items: ${itemCount}`,
    `*Total: ₹${inr(total)}*`,
    shopInfo.upiId && `\nUPI se pay karein: ${shopInfo.upiId}`,
    '\Shukriya! Visit again.\n',
  ]
    .filter(Boolean)
    .join('\n')
}

// Opens the chat directly when we know the number, otherwise WhatsApp's contact picker
export const waLink = (number, text) => `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`
