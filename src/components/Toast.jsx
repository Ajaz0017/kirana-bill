import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, CircleCheck } from 'lucide-react'

// toast: { id, text, error? } | null — clears itself after a moment
export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, toast.error ? 3500 : 1800)
    return () => clearTimeout(t)
  }, [toast, onDone])

  return createPortal(
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed top-4 left-1/2 z-[70] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-xl"
        >
          {toast.error ? <CircleAlert className="size-4 shrink-0 text-rose-400" /> : <CircleCheck className="size-4 shrink-0 text-emerald-400" />}
          <span className="truncate">{toast.text}</span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
