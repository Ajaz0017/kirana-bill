import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { lockScroll } from '../utils/scrollLock'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { X } from 'lucide-react'

// Mobile-style sheet that slides up from the bottom; centered card on wider screens.
// Drag the handle down (or tap the backdrop / X / Esc) to close.
export default function BottomSheet({ open, title, onClose, children, footer }) {
  const drag = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    const unlockScroll = lockScroll()
    window.addEventListener('keydown', onKey)
    return () => {
      unlockScroll()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-900/40 backdrop-blur-[2px] sm:items-center sm:p-4 print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose()
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing sm:hidden"
              onPointerDown={(e) => drag.start(e)}
            >
              <span className="h-1.5 w-10 rounded-full bg-zinc-200" />
            </div>
            <div
              className="flex shrink-0 touch-none items-center justify-between px-5 pt-2 pb-3 sm:pt-5"
              onPointerDown={(e) => drag.start(e)}
            >
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-zinc-100 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
