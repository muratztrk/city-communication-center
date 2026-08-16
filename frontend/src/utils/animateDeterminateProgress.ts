/** Yerel dosya seçiminde %0’da kilitlenmesin diye kısa animasyon (#2728). */
export function animateDeterminateProgress(
  setProgress: (percent: number) => void,
  durationMs: number,
  onComplete?: () => void,
): () => void {
  const duration = Math.min(1400, Math.max(420, durationMs))
  const started = performance.now()
  let frame = 0
  const tick = (now: number) => {
    const ratio = Math.min(1, (now - started) / duration)
    setProgress(Math.round(ratio * 100))
    if (ratio < 1) {
      frame = requestAnimationFrame(tick)
      return
    }
    onComplete?.()
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}
