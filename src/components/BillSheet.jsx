import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import BillTable from './BillTable'

const SHEET_W = 794 // A4 width at 96dpi

// Renders the bill at true A4 width and shrinks it to fit the phone, so screen == paper.
// The ref points at the bill itself (for PDF / print).
const BillSheet = forwardRef(function BillSheet({ items, details, shopInfo, total }, billRef) {
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

  return (
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
  )
})

export default BillSheet
