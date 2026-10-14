import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'

// Portaled so the animated page wrapper's transform can't trap `position: fixed`
export default function ConfirmDialog({ open, title, message, confirmLabel, danger, icon: Icon, onConfirm, onCancel }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-4 backdrop-blur-sm sm:items-center print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ y: 40, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {Icon && (
              <span className={`mb-3 grid size-12 place-items-center rounded-2xl ${danger ? 'bg-rose-50 text-rose-600' : 'bg-violet-50 text-violet-600'}`}>
                <Icon className="size-6" />
              </span>
            )}
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1.5 text-sm text-zinc-500">{message}</p>
            <div className="mt-6 flex gap-3">
              <button type="button" className="btn-ghost flex-1 py-3" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1 py-3`} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
