import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown, CloudUpload, Download, Eye, Globe, LineChart, Link2, LoaderCircle, Lock, Package, PackageX, Pencil, Plus, QrCode, Search, Share2, Store, X,
} from 'lucide-react'
import { useBillStore, newId } from '../../store/useBillStore'
import { showToast } from '../../store/useToast'
import BottomBar from '../../components/BottomBar'
import BottomSheet from '../../components/BottomSheet'
import ShopItemSheet from '../../components/ShopItemSheet'
import ImportItemsSheet from '../../components/ImportItemsSheet'
import RateGraphSheet from '../../components/RateGraphSheet'
import RateListShare from '../../components/RateListShare'
import { Field } from '../../components/FormBits'
import { cleanDecimal, inr } from '../../utils/format'
import { agoText, groupByCategory, shopLink, slabSummary } from '../../utils/shopRates'
import { hasRate, loadMyShop, saveMyShop, shopProblems } from '../../utils/shopSync'

const isSaved = (item) => /^\d+$/.test(String(item.id))

// One line of the rate list: tap the name for the rate graph, type the rate right here
function ItemRow({ item, onRate, onToggleStock, onEdit, onGraph }) {
  const missing = !hasRate(item)
  const out = item.inStock === false
  const slabbed = item.slabs?.length > 1
  return (
    <li className={`flex items-center gap-2 py-2.5 ${out ? 'opacity-60' : ''}`}>
      <button type="button" onClick={() => (isSaved(item) ? onGraph(item) : onEdit(item))} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className={`truncate font-semibold ${out ? 'line-through decoration-zinc-400' : ''}`}>{item.name}</span>
          {isSaved(item) && <LineChart className="size-3.5 shrink-0 text-violet-400" aria-hidden />}
        </span>
        <span className="block truncate text-xs text-zinc-500">
          {slabbed ? slabSummary(item) : `per ${item.unit}`}
          {out ? ' · abhi nahi hai' : ''}
          {isSaved(item) ? (item.changedDay != null ? ` · rate ${agoText(item.changedDay)} badla` : '') : ' · naya, save baaki'}
        </span>
      </button>
      {slabbed ? (
        // Qty-based rates are edited in the item sheet; the list shows the 1-unit rate
        <button type="button" onClick={() => onEdit(item)} aria-label={`${item.name}: ${item.slabs.length} rate, badlein`}
          className="w-24 shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-right">
          <span className="block text-sm font-bold tabular-nums">₹{inr(item.rate)}</span>
          <span className="block text-[10px] font-semibold text-violet-700">{item.slabs.length} rate</span>
        </button>
      ) : (
        <div className="relative w-24 shrink-0">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm font-semibold text-zinc-400">₹</span>
          <input
            className={`field py-2 pr-2 pl-6 text-right font-bold tabular-nums ${missing ? 'border-rose-300 bg-rose-50/50' : ''}`}
            inputMode="decimal"
            placeholder="Rate"
            aria-label={`${item.name} ka rate`}
            value={item.rate === '' || item.rate == null ? '' : String(item.rate)}
            onChange={(e) => onRate(item, cleanDecimal(e.target.value))}
          />
        </div>
      )}
      <button type="button" onClick={() => onToggleStock(item)} aria-label={out ? `${item.name}: stock mein hai karein` : `${item.name}: abhi nahi hai karein`}
        title={out ? 'Abhi nahi hai' : 'Stock mein hai'}
        className={`grid size-9 shrink-0 place-items-center rounded-xl transition ${out ? 'bg-zinc-100 text-zinc-500' : 'text-emerald-600 hover:bg-emerald-50'}`}>
        {out ? <PackageX className="size-4.5" /> : <Package className="size-4.5" />}
      </button>
      <button type="button" onClick={() => onEdit(item)} aria-label={`${item.name} badlein`}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
        <Pencil className="size-4" />
      </button>
    </li>
  )
}

// Filter chips above the list: status filters, then one chip per category
function FilterChips({ value, onChange, chips }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {chips.map((c) => {
        const on = value === c.key
        return (
          <button key={c.key} type="button" aria-pressed={on} onClick={() => onChange(on && c.key !== 'all' ? 'all' : c.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
              on ? 'border-violet-600 bg-violet-600 text-white' : `bg-white ${c.tone ?? 'border-zinc-200 text-zinc-600'} hover:border-violet-300`
            }`}>
            {c.icon && <c.icon className="size-3.5" />}
            {c.label}
            <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-white/25' : 'bg-zinc-100 text-zinc-500'}`}>{c.count}</span>
          </button>
        )
      })}
    </div>
  )
}

// Shop name/address, UPI and Private/Public: set once, so folded away under a one-line summary
function ShopDetails({ open, onToggle }) {
  const shopInfo = useBillStore((s) => s.shopInfo)
  const shopPublic = useBillStore((s) => s.shopPublic)
  const shopMeta = useBillStore((s) => s.shopMeta)
  const { editShopInfo, setShopPublic } = useBillStore.getState()
  const f = (key) => ({ id: `shop-${key}`, value: shopInfo[key] ?? '', onChange: (e) => editShopInfo({ [key]: e.target.value }) })

  const shareLink = async () => {
    const url = shopLink(shopMeta.slug)
    try {
      if (navigator.share) await navigator.share({ title: shopInfo.name, text: `${shopInfo.name} ki rate list`, url })
      else {
        await navigator.clipboard.writeText(url)
        showToast('Link copy ho gaya')
      }
    } catch {
      // share sheet closed
    }
  }

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600">
          <Store className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Dukaan, UPI, Private/Public</span>
          <span className="block truncate text-xs text-zinc-500">
            {[shopInfo.address || shopInfo.city, shopInfo.upiId ? 'UPI set hai' : 'UPI nahi', shopPublic ? 'Public' : 'Private'].filter(Boolean).join(' · ')}
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-5 border-t border-zinc-100 p-4">
              <div className="space-y-3">
                <p className="text-sm font-bold">Dukaan <span className="font-normal text-zinc-500">· bill pe yahi aata hai</span></p>
                <Field label="Shop name" placeholder="e.g. Akhlaque Kirana Store" error={!shopInfo.name.trim()} {...f('name')} />
                <Field label="Address" textarea placeholder="Gali, mohalla, PIN" {...f('address')} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Shehar" placeholder="e.g. Varanasi" {...f('city')} />
                  <Field label="Mobile" type="tel" inputMode="tel" placeholder="98XXXXXXXX" {...f('mobile')} />
                </div>
              </div>
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm font-bold"><QrCode className="size-4 text-violet-600" /> UPI payment <span className="font-normal text-zinc-500">· doosron ko nahi dikhta</span></p>
                <Field label="UPI ID" placeholder="naam@okhdfcbank" autoCapitalize="none" autoCorrect="off" {...f('upiId')} />
                <Field label="UPI pe naam" placeholder="Jo naam UPI app mein dikhta hai" {...f('upiName')} />
                <Field label="Pay on mobile no." type="tel" inputMode="tel" placeholder={shopInfo.mobile || 'UPI se juda mobile'} {...f('upiMobile')} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold">Kaun dekh sake?</p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Shop kaun dekh sake">
                  {[
                    { value: false, icon: Lock, title: 'Private', text: 'Sirf aap' },
                    { value: true, icon: Globe, title: 'Public', text: 'Har login user rate dekh sake' },
                  ].map(({ value, icon: Icon, title, text }) => {
                    const on = shopPublic === value
                    return (
                      <button key={title} type="button" role="radio" aria-checked={on} onClick={() => setShopPublic(value)}
                        className={`rounded-2xl border-2 p-3 text-left transition ${on ? 'border-violet-600 bg-violet-50' : 'border-zinc-200 bg-white hover:border-violet-200'}`}>
                        <Icon className={`size-5 ${on ? 'text-violet-600' : 'text-zinc-400'}`} />
                        <span className="mt-1 block font-bold">{title}</span>
                        <span className="block text-xs text-zinc-500">{text}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-zinc-500">Public shop koi bhi dekh sakta hai, badal sirf aap sakte hain.</p>
                {shopMeta?.isPublic && (
                  <button type="button" onClick={shareLink} className="btn-ghost w-full py-3">
                    <Link2 className="size-4" /> Shop ka link share karein
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MyShop() {
  const shopInfo = useBillStore((s) => s.shopInfo)
  const shopMeta = useBillStore((s) => s.shopMeta)
  const shopPublic = useBillStore((s) => s.shopPublic)
  const items = useBillStore((s) => s.shopItems)
  const dirty = useBillStore((s) => s.shopDirty)
  const { setShopItems, openShop } = useBillStore.getState()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'out' | 'norate' | 'cat:<name>'
  // A brand-new shop opens with its details showing; after that the rate list comes first
  const [detailsOpen, setDetailsOpen] = useState(() => !shopInfo.name.trim())
  const [sheet, setSheet] = useState({ open: false, editing: null, prefill: '', key: 0 })
  const [importOpen, setImportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [graph, setGraph] = useState({ open: false, item: null })
  const closeSheet = useCallback(() => setSheet((s) => ({ ...s, open: false })), [])

  // Fresh copy from the server (skipped automatically while there are unsaved edits)
  useEffect(() => {
    let live = true
    loadMyShop()
      .catch(() => {}) // offline: the phone's copy is shown
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [])

  const unsaved = dirty || !shopMeta
  const problems = shopProblems({ shopInfo, shopItems: items })

  const counts = useMemo(() => {
    const cats = new Map()
    let out = 0
    let norate = 0
    for (const i of items) {
      if (i.inStock === false) out++
      if (!hasRate(i)) norate++
      const c = i.category?.trim()
      if (c) cats.set(c, (cats.get(c) ?? 0) + 1)
    }
    return { out, norate, cats: [...cats.entries()].sort(([a], [b]) => a.localeCompare(b)) }
  }, [items])

  const chips = [
    { key: 'all', label: 'Sab', count: items.length },
    counts.norate && { key: 'norate', label: 'Rate baaki', count: counts.norate, tone: 'border-rose-200 text-rose-700' },
    { key: 'out', label: 'Stock mein nahi', icon: PackageX, count: counts.out },
    ...counts.cats.map(([c, n]) => ({ key: `cat:${c}`, label: c, count: n })),
  ].filter(Boolean)
  // A filter whose chip disappeared (e.g. last missing rate filled) falls back to all
  const activeFilter = chips.some((c) => c.key === filter) ? filter : 'all'

  const q = query.trim().toLowerCase()
  const visible = items.filter((i) => {
    if (activeFilter === 'out' && i.inStock !== false) return false
    if (activeFilter === 'norate' && hasRate(i)) return false
    if (activeFilter.startsWith('cat:') && i.category?.trim() !== activeFilter.slice(4)) return false
    return !q || i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
  })
  const groups = groupByCategory(visible)
  const showGroupTitles = !activeFilter.startsWith('cat:') && (groups.length > 1 || !!groups[0]?.category)

  const patchItem = (item, patch) => setShopItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
  const openNew = (prefill = '') => setSheet((s) => ({ open: true, editing: null, prefill, key: s.key + 1 }))
  const saveItem = (data) => {
    if (sheet.editing) patchItem(sheet.editing, data)
    else setShopItems((list) => [...list, { ...data, id: `new-${newId()}`, changedDay: null }])
    showToast(sheet.editing ? `${data.name} badal gaya, Save karein` : `${data.name} jud gaya, Save karein`)
    setSheet((s) => ({ ...s, open: false }))
  }
  const deleteItem = () => {
    const gone = sheet.editing
    setShopItems((list) => list.filter((i) => i.id !== gone.id))
    setSheet((s) => ({ ...s, open: false }))
    showToast(`${gone.name} list se hata, Save karein`)
  }
  const importNames = (names) => {
    setShopItems((list) => [...list, ...names.map((name) => ({ id: `new-${newId()}`, name, unit: 'kg', rate: '', category: '', inStock: true, changedDay: null }))])
    setImportOpen(false)
    setFilter('norate')
    showToast(`${names.length} items jude, ab unke rate bharein`)
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveMyShop()
      showToast('Shop save ho gayi')
    } catch (e) {
      // Missing shop name: open the details so the red field is right there
      if (!shopInfo.name.trim()) setDetailsOpen(true)
      showToast(e.message, true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Status */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card space-y-3 p-4">
       <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
          <Store className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">{shopInfo.name || 'Apni shop banayein'}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            {shopMeta ? (
              shopMeta.isPublic ? (
                <span className="flex items-center gap-1 font-semibold text-emerald-700"><Globe className="size-3.5" /> Public</span>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-zinc-600"><Lock className="size-3.5" /> Private</span>
              )
            ) : (
              <span className="text-zinc-500">Abhi save nahi hui</span>
            )}
            <span className="text-zinc-400">· {items.length} items</span>
            {loading && <LoaderCircle className="size-3.5 animate-spin text-zinc-400" />}
          </p>
        </div>
       </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShareOpen(true)} aria-label="Rate list aur QR poster share karein" className="btn-ghost flex-1 py-2.5">
            <Share2 className="size-4" /> Rate list / QR
          </button>
          {shopMeta && (
            <button type="button" onClick={() => openShop(shopMeta.slug)} aria-label="Doosron ko shop kaisi dikhti hai" className="btn-ghost flex-1 py-2.5">
              <Eye className="size-4" /> Dekhein
            </button>
          )}
        </div>
      </motion.div>

      {unsaved && (
        <p className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
          <CloudUpload className="size-4 shrink-0" /> <span>Badlav abhi phone mein hain. Neeche <b>Save</b> dabayein.</span>
        </p>
      )}

      <ShopDetails open={detailsOpen} onToggle={() => setDetailsOpen((o) => !o)} />

      {/* Search + filters stay on screen while scrolling a long list */}
      <div className="sticky top-0 z-20 -mx-4 space-y-2 bg-zinc-50/85 px-4 pt-2 pb-2 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
          <input type="search" className="field pr-10 pl-10" placeholder={items.length === 1 ? "1 item mein dhoondhein" : `${items.length} items mein dhoondhein`} aria-label="Items dhoondhein"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Search saaf karein"
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 hover:text-zinc-700">
              <X className="size-4" />
            </button>
          )}
        </div>
        {items.length > 0 && <FilterChips value={activeFilter} onChange={setFilter} chips={chips} />}
      </div>

      <div className="card p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-bold">
            {q || activeFilter !== 'all' ? `${visible.length} / ${items.length} items` : `Items aur rate (${items.length})`}
          </p>
          <button type="button" onClick={() => setImportOpen(true)} className="flex items-center gap-1 text-sm font-semibold text-violet-700">
            <Download className="size-4" /> Import
          </button>
        </div>
        {items.length > 0 && <p className="text-xs text-zinc-500">Naam pe tap: rate ka graph · ₹ box mein seedha rate badlein</p>}

        {groups.map(({ category, items: list }) => (
          <div key={category || '_'}>
            {showGroupTitles && <p className="field-label mt-3 mb-0">{category || 'Baaki items'}</p>}
            <ul className="divide-y divide-zinc-100">
              {list.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onRate={(it, rate) => patchItem(it, { rate })}
                  onToggleStock={(it) => patchItem(it, { inStock: it.inStock === false })}
                  onEdit={(it) => setSheet((s) => ({ open: true, editing: it, prefill: '', key: s.key + 1 }))}
                  onGraph={(it) => setGraph({ open: true, item: it })}
                />
              ))}
            </ul>
          </div>
        ))}

        {!items.length && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-zinc-500">Abhi koi item nahi. Ek-ek jodein, ya common items import karein.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => openNew()} className="btn-primary flex-1 py-3"><Plus className="size-4" /> Item jodein</button>
              <button type="button" onClick={() => setImportOpen(true)} className="btn-ghost flex-1 py-3"><Download className="size-4" /> Import</button>
            </div>
          </div>
        )}
        {items.length > 0 && !visible.length && (
          <div className="space-y-3 py-5 text-center">
            <p className="text-sm text-zinc-500">
              {q ? <>“{query.trim()}” nahi mila{activeFilter !== 'all' && ' is filter mein'}</> : 'Is filter mein koi item nahi'}
            </p>
            {q ? (
              <button type="button" onClick={() => openNew(query.trim())} className="btn-primary mx-auto py-2.5">
                <Plus className="size-4" /> “{query.trim()}” naya item jodein
              </button>
            ) : (
              <button type="button" onClick={() => setFilter('all')} className="btn-ghost mx-auto py-2.5">Saare items dikhayein</button>
            )}
          </div>
        )}
      </div>

      <BottomBar>
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-sm font-bold">{unsaved ? 'Save baaki' : 'Sab save hai'}</p>
          <p className="truncate text-xs text-zinc-500">{problems[0] ?? `${items.length} items · ${shopPublic ? 'Public' : 'Private'}`}</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => openNew(q && !visible.length ? query.trim() : '')}
          className="btn shrink-0 gap-1.5 border border-violet-200 bg-violet-50 px-3 py-3 text-violet-700 hover:bg-violet-100">
          <Plus className="size-4" /> Item
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={save} disabled={saving || !unsaved} className="btn-primary shrink-0 px-4 py-3">
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <CloudUpload className="size-4" />} Save
        </motion.button>
      </BottomBar>

      <BottomSheet open={shareOpen} title="Rate list share" onClose={() => setShareOpen(false)}>
        <div className="space-y-2 pb-2">
          <p className="text-sm text-zinc-500">Stock wale items ki list, category ke hisaab se. WhatsApp pe bhejein ya print karein.</p>
          <RateListShare shop={{ ...shopInfo, slug: shopMeta?.slug, isPublic: !!shopMeta?.isPublic }} items={items} />
        </div>
      </BottomSheet>
      <ShopItemSheet open={sheet.open} editing={sheet.editing} prefillName={sheet.prefill} formKey={sheet.key} items={items} onSave={saveItem} onDelete={deleteItem} onClose={closeSheet} />
      <ImportItemsSheet open={importOpen} existing={items} onImport={importNames} onClose={() => setImportOpen(false)} />
      <RateGraphSheet open={graph.open} item={graph.item} onClose={() => setGraph((g) => ({ ...g, open: false }))} />
    </div>
  )
}
