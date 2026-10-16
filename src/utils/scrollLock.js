// Page-scroll lock shared by every overlay (sheets, camera). A counter instead of
// "restore what it was before", so overlays opening/closing in any order (scan sheet over
// camera, a dev hot-reload mid-sheet) can never leave the page stuck unscrollable.
let locks = 0

export function lockScroll() {
  locks += 1
  document.body.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (!locks) document.body.style.overflow = ''
  }
}

// Called once at startup: nothing is open yet, so nothing may be locked
export function resetScrollLock() {
  locks = 0
  document.body.style.overflow = ''
}
