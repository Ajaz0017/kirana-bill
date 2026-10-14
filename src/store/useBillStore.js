import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { todayISO } from '../utils/format'

// crypto.randomUUID needs a secure context, which a phone on LAN (http://192.168...) is not
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const emptyDetails = (lastInvoiceNo) => ({
  date: todayISO(),
  invoiceNo: String(lastInvoiceNo + 1),
  customerName: '',
  customerAddress: '',
  customerMobile: '',
})

// stamp/signature: 'default' = bundled image, '' = none, otherwise an uploaded data URL
const emptyShop = () => ({
  name: '',
  address: '',
  mobile: '',
  upiId: 'najeebakhlaque560@okhdfcbank',
  upiName: 'Najeeba Akhlaque',
  upiMobile: '',
  stamp: 'default',
  signature: 'default',
})

export const useBillStore = create(
  persist(
    (set) => ({
      step: 0,
      dir: 1,
      items: [],
      details: emptyDetails(0),
      shopInfo: emptyShop(),
      lastInvoiceNo: 0,

      goTo: (step) => set((s) => ({ step, dir: step >= s.step ? 1 : -1 })),

      addItem: (item) => set((s) => ({ items: [...s.items, { ...item, id: newId() }] })),
      updateItem: (id, patch) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      setDetails: (patch) => set((s) => ({ details: { ...s.details, ...patch } })),
      setShopInfo: (patch) => set((s) => ({ shopInfo: { ...s.shopInfo, ...patch } })),

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
      partialize: ({ step, items, details, shopInfo, lastInvoiceNo }) => ({
        step,
        items,
        details,
        shopInfo,
        lastInvoiceNo,
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
