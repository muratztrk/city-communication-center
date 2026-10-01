/** Chromium native file dialog cancel can freeze hit-testing until the next real mousemove. */
export function unlockDocumentPointers() {
  const root = document.documentElement
  root.style.pointerEvents = 'none'
  requestAnimationFrame(() => {
    root.style.pointerEvents = ''
  })
}
