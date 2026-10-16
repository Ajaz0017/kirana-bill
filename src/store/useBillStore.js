import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { todayISO } from '../utils/format'
import { nameKey } from '../utils/itemNames'

// crypto.randomUUID needs a secure context, which a phone on LAN (http://192.168...) is not
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const emptyDetails = (lastInvoiceNo) => ({
  date: todayISO(),
  invoiceNo: String(lastInvoiceNo + 1),
  customerName: '',
  customerAddress: '',
  customerMobile: '',
})

const MAX_KNOWN_ITEMS = 300

// Newest first, one entry per spelling-insensitive name
const rememberNames = (known, names) => {
  const seen = new Set()
  return [...names, ...known]
    .map((n) => String(n).trim())
    .filter((n) => n && !seen.has(nameKey(n)) && seen.add(nameKey(n)))
    .slice(0, MAX_KNOWN_ITEMS)
}

// stamp/signature: 'default' = bundled image, '' = none, otherwise an uploaded data URL
const emptyShop = () => ({
  name: '',
  address: '',
  mobile: '',
  upiId: '',
  upiName: '',
  upiMobile: '',
  stamp: 'default',
  signature: 'default',
})

export const useBillStore = create(
  persist(
    (set) => ({
      step: 0,
      dir: 1,
      settingsOpen: false, // not persisted: the app always reopens on the bill flow
      items: [],
      details: emptyDetails(0),
      shopInfo: emptyShop(),
      lastInvoiceNo: 0,
      // Scan learning: names this shop sells, and the owner's corrections (scanned key -> name)
      knownItems: [],
      nameFixes: {},

      goTo: (step) => set((s) => ({ step, dir: step >= s.step ? 1 : -1 })),
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),

      addItem: (item) =>
        set((s) => ({
          items: [...s.items, { ...item, id: newId() }],
          knownItems: rememberNames(s.knownItems, [item.name]),
        })),
      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
          knownItems: patch.name ? rememberNames(s.knownItems, [patch.name]) : s.knownItems,
        })),
      // The owner changed a scanned name: use their spelling next time the AI reads it this way
      rememberFix: (scanned, chosen) =>
        set((s) => {
          const key = nameKey(scanned)
          return key ? { nameFixes: { ...s.nameFixes, [key]: chosen.trim() } } : {}
        }),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      setDetails: (patch) => set((s) => ({ details: { ...s.details, ...patch } })),
      setShopInfo: (patch) => set((s) => ({ shopInfo: { ...s.shopInfo, ...patch } })),

      // Next bill number (e.g. back to 1 for a new year); also renumbers the bill being made now
      setNextInvoiceNo: (n) =>
        set((s) => ({ lastInvoiceNo: n - 1, details: { ...s.details, invoiceNo: String(n) } })),

      // Forget what the scan learned (corrections + remembered item names)
      clearLearning: () => set({ knownItems: [], nameFixes: {} }),

      // Replace this device's data with a backup file's (see utils/backup.js)
      restoreBackup: (data) =>
        set((s) => ({
          shopInfo: { ...emptyShop(), ...data.shopInfo },
          lastInvoiceNo: data.lastInvoiceNo ?? s.lastInvoiceNo,
          knownItems: data.knownItems ?? [],
          nameFixes: data.nameFixes ?? {},
          ...(data.draft ? { items: data.draft.items, details: data.draft.details, step: 0 } : {}),
        })),

      // Bill done: remember its invoice number and start a fresh draft
      finishBill: () =>
        set((s) => {
          const no = parseInt(s.details.invoiceNo, 10)
          const last = Number.isFinite(no) ? Math.max(no, s.lastInvoiceNo) : s.lastInvoiceNo
          return { lastInvoiceNo: last, items: [], details: emptyDetails(last), step: 0, dir: -1 }
        }),
    }),
    {
      name: 'kirana-bill',
      version: 1,
      partialize: ({ step, items, details, shopInfo, lastInvoiceNo, knownItems, nameFixes }) => ({
        step,
        items,
        details,
        shopInfo,
        lastInvoiceNo,
        knownItems,
        nameFixes,
      }),
      // Fill in shop fields added after the bill was first saved
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        shopInfo: { ...current.shopInfo, ...persisted?.shopInfo },
      }),
    },
  ),
)

export const selectTotal = (s) => s.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
