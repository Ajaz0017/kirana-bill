import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, CircleCheck, Plus, ScanLine, Trash2 } from 'lucide-react'
import { selectTotal, useBillStore } from '../store/useBillStore'
import ItemForm from '../components/ItemForm'
import ItemList from '../components/ItemList'
import BottomBar from '../components/BottomBar'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import AnimatedNumber from '../components/AnimatedNumber'
import CameraScanner from '../components/CameraScanner'
import ScanReview from '../components/ScanReview'
import { scanBill } from '../utils/scanBill'
import { inr, round } from '../utils/format'

const FORM_ID = 'item-form'

export default function ItemsPage() {
  const items = useBillStore((s) => s.items)
  const total = useBillStore(selectTotal)
  const { addItem, updateItem, removeItem, goTo } = useBillStore.getState()
  const [sheetOpen, setSheetOpen] = useState(false)
  // Kept after close so the sheet doesn't flip from "edit" to "add" mid exit-animation
  const [editingId, setEditingId] = useState(null)
  const [formKey, setFormKey] = useState(0)
  // Item kept after close so the dialog text doesn't blank out during its exit animation
  const [deleting, setDeleting] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [scan, setScan] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const closeCamera = useCallback(() => setCameraOpen(false), [])
  const editing = items.find((i) => i.id === editingId) ?? null

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const openSheet = (id = null) => {
    setEditingId(id)
    setFormKey((k) => k + 1)
    setSheetOpen(true)
  }
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const handleSubmit = (item, keepOpen) => {
    if (editing) {
      updateItem(editing.id, item)
      setToast({ id: Date.now(), text: `${item.name} update ho gaya` })
    } else {
      addItem(item)
      setToast({ id: Date.now(), text: `${item.name} add ho gaya` })
    }
    if (!keepOpen) setSheetOpen(false)
  }

  const startScan = async (file) => {
    setCameraOpen(false)
    const id = Date.now()
    const preview = URL.createObjectURL(file)
    setScan({ id, status: 'loading', photo: preview })
    setScanOpen(true)
    try {
      const result = await scanBill(file)
      setScan((s) => (s?.id === id ? { id, status: 'done', ...result } : s))
    } catch (e) {
      setScan((s) => (s?.id === id ? { id, status: 'error', photo: preview, error: e.message } : s))
    }
  }
  const addScanned = (rows) => {
    rows.forEach(({ name, qty, unit, rate, amount }) =>
      addItem({
        name: name.trim(),
        qty: parseFloat(qty) || '',
        unit,
        rate: parseFloat(rate) || '',
        amount: round(parseFloat(amount)),
      }),
    )
    setScanOpen(false)
    setToast({ id: Date.now(), text: `${rows.length} items add ho gaye` })
  }

  const askDelete = (id) => {
    setDeleting(items.find((i) => i.id === id))
    setDeleteOpen(true)
  }
  const confirmDelete = () => {
    removeItem(deleting.id)
    setToast({ id: Date.now(), text: `${deleting.name} delete ho gaya` })
    setDeleteOpen(false)
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-bold">
          Bill ke items
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">{items.length}</span>
        </h2>
        <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setCameraOpen(true)}
          className="btn border border-violet-200 bg-white px-3 py-2 text-violet-700 shadow-sm hover:bg-violet-50">
          <ScanLine className="size-4" /> Scan bill
        </motion.button>
      </div>

      <ItemList items={items} onEdit={openSheet} onDelete={askDelete} />

      <BottomBar>
        <div className="min-w-0 flex-1 pl-1">
          <p className="text-xs font-medium text-zinc-500">Total</p>
          <p className="text-lg font-extrabold whitespace-nowrap tabular-nums sm:text-xl">
            ₹<AnimatedNumber value={total} />
          </p>
        </div>
        {/* Always in reach, so adding one more item to a long list needs no scrolling */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => openSheet()}
          className="btn shrink-0 gap-1.5 border border-violet-200 bg-violet-50 px-3 py-3 text-violet-700 hover:bg-violet-100"
        >
          <Plus className="size-4" /> Item
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          disabled={!items.length}
          onClick={() => goTo(1)}
          className="btn-primary shrink-0 gap-1.5 px-4 py-3"
        >
          Aage <ArrowRight className="size-4" />
        </motion.button>
      </BottomBar>

      <BottomSheet
        open={sheetOpen}
        title={editing ? 'Item edit karein' : 'Item add karein'}
        onClose={closeSheet}
        footer={
          editing ? (
            <motion.button whileTap={{ scale: 0.97 }} type="submit" form={FORM_ID} className="btn-primary w-full py-3.5 text-base">
              <Check className="size-5" /> Update
            </motion.button>
          ) : (
            <div className="flex gap-3">
              {/* First submit button = default for Enter key, so Enter keeps the sheet open */}
              <motion.button whileTap={{ scale: 0.97 }} type="submit" form={FORM_ID} value="next" className="btn-ghost flex-1 py-3.5 text-base">
                Add + Agla
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} type="submit" form={FORM_ID} className="btn-primary flex-1 py-3.5 text-base">
                <Plus className="size-5" /> Add
              </motion.button>
            </div>
          )
        }
      >
        <ItemForm key={formKey} id={FORM_ID} editing={editing} onSubmit={handleSubmit} />
      </BottomSheet>

      <ScanReview
        open={scanOpen}
        scan={scan}
        onClose={() => setScanOpen(false)}
        onRetake={() => setCameraOpen(true)}
        onAddAll={addScanned}
      />

      <CameraScanner open={cameraOpen} onCapture={startScan} onClose={closeCamera} />

      <ConfirmDialog
        open={deleteOpen}
        danger
        icon={Trash2}
        title="Item delete karein?"
        message={
          <>
            <span className="font-semibold text-zinc-700">{deleting?.name}</span> (₹{inr(deleting?.amount ?? 0)}) bill se hat jayega.
          </>
        }
        confirmLabel="Haan, delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {createPortal(
        <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-xl"
          >
            <CircleCheck className="size-4 text-emerald-400" />
            {toast.text}
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
