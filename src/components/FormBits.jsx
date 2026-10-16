import { motion } from 'motion/react'
import { ImageUp, RotateCcw, Trash2 } from 'lucide-react'
import { imageToDataURL } from '../utils/image'

// Form building blocks shared by the Details and Settings pages
export const Section = ({ icon: Icon, title, hint, children, index }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.07, type: 'spring', stiffness: 300, damping: 30 }}
    className="card p-5"
  >
    <div className="mb-4 flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-600">
        <Icon className="size-4.5" />
      </span>
      <div>
        <h2 className="font-bold">{title}</h2>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
    </div>
    <div className="space-y-3">{children}</div>
  </motion.section>
)

export const Field = ({ label, error, textarea, ...props }) => {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <div>
      <label className="field-label" htmlFor={props.id}>{label}</label>
      <Tag
        className={`field ${textarea ? 'min-h-18 resize-none' : ''} ${
          error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15' : ''
        }`}
        rows={textarea ? 2 : undefined}
        {...props}
      />
    </div>
  )
}

// Preview + change/remove for the stamp & signature shown on the bill
export const ImagePick = ({ label, value, fallback, onChange }) => {
  const src = value === 'default' ? fallback : value
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onChange(await imageToDataURL(file))
  }
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="grid h-24 place-items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-2">
        {src ? <img src={src} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-zinc-400">Nahi hai</span>}
      </div>
      <div className="mt-2 flex gap-1.5">
        <label className="btn-ghost flex-1 cursor-pointer px-2 py-2 text-xs">
          <ImageUp className="size-3.5" /> Badlein
          <input type="file" accept="image/*" className="sr-only" onChange={pick} />
        </label>
        {value === 'default' ? (
          <button type="button" onClick={() => onChange('')} aria-label={`${label} hatayein`} className="btn-ghost px-2.5 py-2">
            <Trash2 className="size-3.5" />
          </button>
        ) : (
          <button type="button" onClick={() => onChange('default')} aria-label={`${label} default karein`} className="btn-ghost px-2.5 py-2">
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
