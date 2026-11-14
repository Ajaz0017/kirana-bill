import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { todayISO } from '../utils/format'
import { nameKey } from '../utils/itemNames'

// crypto.randomUUID needs a secure context, which a phone on LAN (http://192.168...) is not
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

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
  city: '',
  mobile: '',
  upiId: '',
  upiName: '',
  upiMobile: '',
  stamp: 'default',
  signature: 'default',
  // Online orders from the public shop page (Phase 8)
  orderWhatsapp: '',
  ordersOn: false,
  closed: false,
  minOrder: 0,
})

// Shop fields that live in the cloud shop (stamp/signature stay on the phone: big images)
export const SHOP_CLOUD_FIELDS = ['name', 'address', 'city', 'mobile', 'upiId', 'upiName', 'upiMobile', 'orderWhatsapp', 'ordersOn', 'closed', 'minOrder']

// Bottom navigation, left to right
export const TABS = ['home', 'bills', 'shops', 'settings', 'profile']

export const useBillStore = create(
  persist(
    (set) => ({
      step: 0,
      dir: 1,
      // Not persisted: the app always reopens on Home
      tab: 'home',
      viewing: null, // a saved bill opened from the Bills tab: { id, data: { items, details, shopInfo }, ... }
      // Id of the bill being made; saving again with the same id updates that bill in history
      draftId: newId(),
      // Bills waiting to reach the server (made offline, or the save failed): id -> bill
      pendingBills: {},
      items: [],
      details: emptyDetails(0),
      shopInfo: emptyShop(),
      lastInvoiceNo: 0,
      // Scan learning: names this shop sells, and the owner's corrections (scanned key -> name)
      knownItems: [],
      nameFixes: {},

      // ---- Own shop (Shops tab). Edited here on the phone, sent to the server with "Save".
      shopMeta: null, // last saved cloud shop: { slug, isPublic } | null = never saved
      shopPublic: false, // Private / Public choice (unsaved until Save)
      shopItems: [], // rate list: { id, name, unit, rate, category, inStock, changedDay }; new items have a local id
      shopDirty: false, // edits not yet saved to the server
      // Not persisted: which Shops sub-page is open
      shopTab: 'mine', // 'mine' | 'orders' | 'public'
      newOrders: 0, // online orders not looked at yet (badge), refreshed every minute
      draftOrder: null, // code of the online order the current bill was made from
      shopView: null, // slug of a shop opened read-only (public list or a shared link)

      goTo: (step) => set((s) => ({ step, dir: step >= s.step ? 1 : -1 })),
      setTab: (tab) =>
        set((s) =>
          tab === s.tab
            ? { viewing: null, shopView: null }
            : { tab, viewing: null, shopView: null, dir: TABS.indexOf(tab) > TABS.indexOf(s.tab) ? 1 : -1 },
        ),
      setViewing: (viewing) => set({ viewing, dir: viewing ? 1 : -1 }),

      queueBill: (bill) => set((s) => ({ pendingBills: { ...s.pendingBills, [bill.id]: bill } })),
      // Only drops the exact copy that was sent, so a newer save made meanwhile still goes out
      unqueueBill: (id, sent) =>
        set((s) => {
          if (!s.pendingBills[id] || (sent && s.pendingBills[id] !== sent)) return {}
          const { [id]: _, ...rest } = s.pendingBills
          return { pendingBills: rest }
        }),

      // "Bill banayein" on an online order: its items and customer become the bill being made
      loadOrder: (order) =>
        set((s) => ({
          draftId: newId(),
          draftOrder: order.code,
          items: order.items.map((i) => ({ id: newId(), name: i.name, qty: i.qty, unit: i.unit, rate: i.rate, rateUnit: i.rateUnit, amount: i.amount })),
          details: {
            ...emptyDetails(s.lastInvoiceNo),
            customerName: order.customer.name,
            customerMobile: order.customer.mobile,
            customerAddress: order.customer.delivery ? order.customer.address : '',
          },
          tab: 'home',
          shopView: null,
          step: 0,
          dir: -1,
        })),

      // Open a saved bill on Home: edit it in place, or start a new bill from a copy of it
      loadBill: ({ id, data }, { copy = false } = {}) =>
        set((s) => ({
          draftId: copy ? newId() : id,
          draftOrder: null,
          items: data.items.map((i) => ({ ...i, id: newId() })),
          details: copy
            ? { ...emptyDetails(s.lastInvoiceNo), customerName: data.details.customerName ?? '', customerAddress: data.details.customerAddress ?? '', customerMobile: data.details.customerMobile ?? '' }
            : { ...emptyDetails(s.lastInvoiceNo), ...data.details },
          tab: 'home',
          viewing: null,
          step: 0,
          dir: -1,
        })),

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

      // Shop details that are saved to the cloud shop: mark the shop as unsaved
      editShopInfo: (patch) => set((s) => ({ shopInfo: { ...s.shopInfo, ...patch }, shopDirty: true })),
      setShopPublic: (shopPublic) => set({ shopPublic, shopDirty: true }),
      setShopItems: (fn) => set((s) => ({ shopItems: typeof fn === 'function' ? fn(s.shopItems) : fn, shopDirty: true })),
      setShopTab: (shopTab) => set({ shopTab, shopView: null }),
      openShop: (slug) => set((s) => ({ tab: 'shops', shopView: slug, viewing: null, dir: s.tab === 'shops' ? 1 : TABS.indexOf('shops') > TABS.indexOf(s.tab) ? 1 : -1 })),
      closeShop: () => set({ shopView: null, dir: -1 }),

      // The server's copy of the own shop (after loading or saving) replaces the phone's
      applyCloudShop: ({ shop, items }) =>
        set((s) => ({
          shopMeta: shop ? { slug: shop.slug, isPublic: shop.isPublic } : null,
          shopPublic: shop ? shop.isPublic : s.shopPublic,
          shopItems: shop ? items : s.shopItems,
          shopInfo: shop ? { ...s.shopInfo, ...Object.fromEntries(SHOP_CLOUD_FIELDS.map((k) => [k, shop[k] ?? ''])) } : s.shopInfo,
          shopDirty: false,
        })),

      // Next bill number (e.g. back to 1 for a new year); also renumbers the bill being made now
      setNextInvoiceNo: (n) =>
        set((s) => ({ lastInvoiceNo: n - 1, details: { ...s.details, invoiceNo: String(n) } })),

      // Forget what the scan learned (corrections + remembered item names)
      clearLearning: () => set({ knownItems: [], nameFixes: {} }),

      // Replace this device's data with a backup file's (see utils/backup.js)
      restoreBackup: (data) =>
        set((s) => ({
          shopInfo: { ...emptyShop(), ...data.shopInfo },
          shopDirty: true, // restored shop details still need a Save to reach the cloud shop
          lastInvoiceNo: data.lastInvoiceNo ?? s.lastInvoiceNo,
          knownItems: data.knownItems ?? [],
          nameFixes: data.nameFixes ?? {},
          ...(data.draft ? { items: data.draft.items, details: data.draft.details, draftId: newId(), step: 0 } : {}),
        })),

      // Bill done: remember its invoice number and start a fresh draft
      finishBill: () =>
        set((s) => {
          const no = parseInt(s.details.invoiceNo, 10)
          const last = Number.isFinite(no) ? Math.max(no, s.lastInvoiceNo) : s.lastInvoiceNo
          return { lastInvoiceNo: last, items: [], details: emptyDetails(last), draftId: newId(), draftOrder: null, step: 0, dir: -1 }
        }),
    }),
    {
      name: 'kirana-bill', // replaced by a per-user key in hydrateForUser before anything is read
      version: 1,
      skipHydration: true,
      partialize: ({
        step, draftId, pendingBills, items, details, shopInfo, lastInvoiceNo, knownItems, nameFixes,
        shopMeta, shopPublic, shopItems, shopDirty, draftOrder,
      }) => ({
        draftOrder,
        shopMeta,
        shopPublic,
        shopItems,
        shopDirty,
        step,
        draftId,
        pendingBills,
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

/**
 * Each account keeps its own shop details and draft on this device. Data saved before logins
 * existed (key "kirana-bill") goes to the first account that logs in here.
 */
export async function hydrateForUser(userId) {
  const key = `kirana-bill:${userId}`
  try {
    const legacy = localStorage.getItem('kirana-bill')
    if (legacy) {
      if (!localStorage.getItem(key)) localStorage.setItem(key, legacy)
      localStorage.removeItem('kirana-bill')
    }
  } catch {
    // storage blocked: start empty
  }
  useBillStore.persist.setOptions({ name: key })
  await useBillStore.persist.rehydrate()
}

export const selectTotal = (s) => s.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
