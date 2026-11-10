import { create } from 'zustand'

// App-wide toast (rendered once in App), for messages that outlive the page that raised them
let seq = 0
export const useToast = create((set) => ({
  toast: null,
  clear: () => set({ toast: null }),
}))

export const showToast = (text, error = false) => useToast.setState({ toast: { id: ++seq, text, error } })
