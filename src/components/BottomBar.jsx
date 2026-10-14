import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

// Pinned to the bottom of the screen. Portaled because the animated page wrapper's
// transform would otherwise trap `position: fixed`; the spacer keeps content clear of it.
export default function BottomBar({ children }) {
  return (
    <>
      <div aria-hidden className="h-28 print:hidden" />
      {createPortal(
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden"
        >
          <div className="card mx-auto flex max-w-lg items-center gap-2 rounded-2xl p-3 sm:gap-3">{children}</div>
        </motion.div>,
        document.body,
      )}
    </>
  )
}
