import { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { amountInWords } from '../utils/amountInWords'
import { upiLink } from '../utils/upi'
import { fmtDateLong, fmtQty, inr } from '../utils/format'
import defaultStamp from '../assets/stamp.png'
import defaultSignature from '../assets/signature.png'

const CRIMSON = '#c8003c'
const DARK = '#2d2d2d'
const resolveImg = (v, fallback) => (v === 'default' ? fallback : v || null)

// Faint silk-like streaks behind the content
const SILK =
  'linear-gradient(115deg, transparent 18%, rgb(0 0 0/0.035) 24%, transparent 32%),' +
  'linear-gradient(125deg, transparent 46%, rgb(0 0 0/0.03) 53%, transparent 60%),' +
  'linear-gradient(105deg, transparent 70%, rgb(0 0 0/0.035) 78%, transparent 86%),' +
  'radial-gradient(ellipse at 15% 85%, rgb(0 0 0/0.04), transparent 55%), #fbfbfb'

const UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM']

const PayRow = ({ label, children }) => (
  <div>
    <p className="text-[10px] leading-tight font-semibold tracking-wide text-zinc-500 uppercase">{label}</p>
    <p className="font-pt text-[15px] leading-tight font-bold text-zinc-800">{children}</p>
  </div>
)

// Dynamic UPI QR: scanning it opens the payment app with this bill's amount filled in
const PayCard = ({ shopInfo, total, invoiceNo }) => {
  const payMobile = shopInfo.upiMobile?.trim() || shopInfo.mobile
  const link = upiLink({ upiId: shopInfo.upiId, name: shopInfo.upiName, amount: total, note: `Bill ${invoiceNo}` })
  return (
    <div className="w-[460px]">
      <div className="flex overflow-hidden rounded-xl border border-zinc-300 bg-white">
        <div
          className="flex shrink-0 items-center gap-3 p-2.5 text-white"
          style={{ background: `linear-gradient(135deg, ${CRIMSON} 62%, ${DARK} 62%)` }}
        >
          <div className="rounded-lg bg-white p-1.5">
            <QRCodeSVG value={link} size={108} level="M" marginSize={0} />
          </div>
          <div>
            <p className="font-pt text-[20px] leading-tight font-bold">Scan<br />&amp; Pay</p>
            <p className="mt-0.5 text-[11px] opacity-80">via UPI</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 px-3 py-2.5">
          <PayRow label="UPI ID"><span className="font-mont text-[12px] font-semibold tracking-tight whitespace-nowrap">{shopInfo.upiId}</span></PayRow>
          {payMobile && <PayRow label="Pay on mobile no">{payMobile}</PayRow>}
          {shopInfo.upiName && <PayRow label="Name">{shopInfo.upiName}</PayRow>}
          <PayRow label="Amount"><span className="font-mont text-[16px]" style={{ color: CRIMSON }}>₹{inr(total)}</span></PayRow>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
        Pay with any UPI app
        {UPI_APPS.map((app) => (
          <span key={app} className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] tracking-normal text-zinc-700 normal-case">
            {app}
          </span>
        ))}
      </p>
    </div>
  )
}

const Cell = ({ className = '', ...props }) => (
  <td className={`border border-zinc-400 px-2 py-1 ${className}`} {...props} />
)

const MIN_ROWS = 10 // short bills get blank ruled rows instead of an empty gap

const Th = ({ className = '', ...props }) => (
  <th className={`px-2 py-1.5 text-[15px] font-semibold ${className}`} {...props} />
)

// Invoice laid out at A4 width (794px = 210mm @ 96dpi). Its height follows the item list
// (padded to MIN_ROWS); the PDF export uses a single page of the same height.
const BillTable = forwardRef(function BillTable({ items, details, shopInfo, total }, ref) {
  const shopName = shopInfo.name || 'Your Shop Name'
  const stamp = resolveImg(shopInfo.stamp, defaultStamp)
  const signature = resolveImg(shopInfo.signature, defaultSignature)
  return (
    <div
      ref={ref}
      className="relative flex flex-col overflow-hidden px-14 pt-12 pb-10 font-mont text-zinc-800"
      style={{ background: SILK }}
    >
      {/* Corner shapes */}
      <svg aria-hidden className="pointer-events-none absolute top-0 right-0 h-64 w-full" viewBox="0 0 794 256" preserveAspectRatio="xMaxYMin meet">
        <polygon points="588,92 794,18 794,256" fill={DARK} />
        <polygon points="358,0 794,0 794,20 521,118" fill={CRIMSON} />
      </svg>

      {/* Title */}
      <header className="relative w-max text-center">
        <p className="text-[22px] font-bold">{shopName}</p>
        <h1 className="text-[44px] leading-none font-extrabold tracking-wide" style={{ color: CRIMSON }}>INVOICE</h1>
        <p className="mt-1 text-[22px] font-bold text-zinc-700">NO: {details.invoiceNo}</p>
      </header>

      {/* Parties */}
      <section className="relative mt-6 flex justify-between gap-8">
        <div className="min-w-0">
          <h2 className="text-[26px] font-bold text-zinc-600">Bill To:</h2>
          <div className="mt-1 space-y-0.5 font-pt text-[18px] text-zinc-600">
            <p className="font-bold text-zinc-700">{details.customerName || '—'}</p>
            {details.customerAddress && <p className="whitespace-pre-line">{details.customerAddress}</p>}
            {details.customerMobile && <p>+91 {details.customerMobile}</p>}
            <p>Date: {fmtDateLong(details.date)}</p>
          </div>
        </div>
        <div className="mt-6 max-w-[45%] text-right">
          <h2 className="text-[26px] leading-none font-bold text-zinc-600">From:</h2>
          <p className="text-[19px] font-bold">{shopName}</p>
          <div className="mt-1 space-y-0.5 font-pt text-[18px] text-zinc-600">
            {shopInfo.mobile && <p>+91 {shopInfo.mobile}</p>}
            {shopInfo.address && <p className="whitespace-pre-line">{shopInfo.address}</p>}
          </div>
        </div>
      </section>

      {/* Items */}
      <table className="relative mt-6 w-full border-collapse text-[15px]">
        <thead>
          <tr className="text-white" style={{ background: CRIMSON }}>
            <Th className="w-[8%] text-[13px]">Sr.</Th>
            <Th>Item</Th>
            <Th colSpan={2} className="w-[19%]">Qty</Th>
            <Th colSpan={2} className="w-[22%]">Rate</Th>
            <Th className="w-[17%]">Amount</Th>
          </tr>
        </thead>
        <tbody className="bg-white/60">
          {items.map((item, i) => (
            <tr key={item.id} className="text-center even:bg-zinc-100/70">
              <Cell className="text-left font-bold">{i + 1}</Cell>
              <Cell className="font-bold">{item.name}</Cell>
              <Cell className="w-[11%] text-[14px] font-bold tabular-nums">{item.qty ? fmtQty(item.qty) : ''}</Cell>
              <Cell className="w-[8%] text-[13px] font-bold">{item.qty ? item.unit : ''}</Cell>
              <Cell className="w-[13%] text-[14px] font-bold tabular-nums">{item.rate ? inr(item.rate) : ''}</Cell>
              <Cell className="w-[9%] text-[13px] font-bold">{item.rate ? item.unit : ''}</Cell>
              <Cell className="font-semibold tabular-nums">{inr(item.amount)}</Cell>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, MIN_ROWS - items.length) }, (_, i) => (
            <tr key={`blank-${i}`} className="even:bg-zinc-100/70" aria-hidden>
              {Array.from({ length: 7 }, (_, c) => (
                <Cell key={c}>&nbsp;</Cell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Total */}
      <div className="relative flex justify-end">
        <div className="flex w-[44%] items-center justify-between px-6 py-2.5 text-white" style={{ background: DARK }}>
          <span className="font-pt text-[17px]">Grand Total</span>
          <span className="text-[18px] font-bold tabular-nums">₹ {inr(total)}</span>
        </div>
      </div>
      <p className="relative mt-3 text-right font-pt text-[15px] text-zinc-600 italic">{amountInWords(total)}</p>

      {/* Footer pinned to the bottom of the page */}
      <footer className="relative mt-auto flex items-end justify-between gap-6 pt-10">
        {shopInfo.upiId?.trim() ? (
          <PayCard shopInfo={shopInfo} total={total} invoiceNo={details.invoiceNo} />
        ) : (
          <p className="text-[12px] text-zinc-400">Thank you for your business!</p>
        )}

        <div className="relative flex h-36 w-[210px] shrink-0 flex-col items-center justify-end">
          {stamp && (
            <img src={stamp} alt="" className="absolute right-0 bottom-5 w-32 -rotate-6 opacity-90 mix-blend-multiply" />
          )}
          {signature && (
            <img src={signature} alt="" className="absolute bottom-7 left-0 w-36 mix-blend-multiply" />
          )}
          <p className="relative w-full border-t border-zinc-400 pt-1 text-center text-[13px] font-semibold text-zinc-600">
            Authorised Signatory
          </p>
        </div>
      </footer>
    </div>
  )
})

export default BillTable
