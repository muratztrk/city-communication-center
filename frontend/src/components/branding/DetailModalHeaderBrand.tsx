import { useLayoutEffect, useRef, useState } from 'react'

/** Login sayfasındaki resmi belediye logosu (card #1683 reopen). */
const DETAIL_HEADER_LOGIN_LOGO_SRC = '/tire-belediyesi-logo.png'

const MIN_GAP_PX = 8
/** Butonlar logo alanına girerse sola kaydırma üst sınırı (card #1751 / R421 logo). */
const MAX_SHIFT_PX = 160

/** Detay popup başlık satırı ortası — login page logosu, küçültülmüş.
 *  Sağ aksiyonlar logo alanına girerse yalnızca o durumda logo biraz sola kayar (card #1751). */
export function DetailModalHeaderBrand() {
  const brandRef = useRef<HTMLDivElement>(null)
  const shiftRef = useRef(0)
  const [shiftLeftPx, setShiftLeftPx] = useState(0)

  useLayoutEffect(() => {
    const brand = brandRef.current
    const layout = brand?.closest('.detail-modal-header-layout')
    if (!brand || !(layout instanceof HTMLElement)) {
      return
    }

    const measure = () => {
      const actions = layout.querySelector('.detail-modal-header-actions')
      if (!(actions instanceof HTMLElement)) {
        if (shiftRef.current !== 0) {
          shiftRef.current = 0
          setShiftLeftPx(0)
        }
        return
      }

      const brandRect = brand.getBoundingClientRect()
      const actionsRect = actions.getBoundingClientRect()
      // Mevcut kaydırmayı geri ekle → ortalanmış (kaydırmasız) sağ kenar.
      const unshiftedRight = brandRect.right + shiftRef.current
      const unshiftedLeft = brandRect.left + shiftRef.current
      const overlap = unshiftedRight + MIN_GAP_PX - actionsRect.left

      let nextShift = 0
      if (overlap > 0) {
        const title = layout.querySelector('.detail-modal-header-title')
        let maxShift = MAX_SHIFT_PX
        if (title instanceof HTMLElement) {
          const titleRect = title.getBoundingClientRect()
          maxShift = Math.max(0, Math.min(MAX_SHIFT_PX, unshiftedLeft - titleRect.right - MIN_GAP_PX))
        }
        nextShift = Math.min(overlap, maxShift)
      }

      if (nextShift !== shiftRef.current) {
        shiftRef.current = nextShift
        setShiftLeftPx(nextShift)
      }
    }

    measure()

    const resizeObserver = new ResizeObserver(() => {
      measure()
    })
    resizeObserver.observe(layout)
    const actions = layout.querySelector('.detail-modal-header-actions')
    if (actions instanceof HTMLElement) {
      resizeObserver.observe(actions)
    }

    // Buton seti değişince (ör. Yazışmaya Git) yeniden ölç.
    const mutationObserver = new MutationObserver(() => {
      measure()
    })
    mutationObserver.observe(layout, { childList: true, subtree: true, characterData: true })

    window.addEventListener('resize', measure)
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div
      ref={brandRef}
      className={`detail-modal-header-brand${shiftLeftPx > 0 ? ' detail-modal-header-brand--shift-left' : ''}`}
      aria-hidden="true"
      style={shiftLeftPx > 0 ? { transform: `translate(calc(-50% - ${shiftLeftPx}px), -50%)` } : undefined}
    >
      <img
        src={DETAIL_HEADER_LOGIN_LOGO_SRC}
        alt=""
        className="detail-modal-header-brand__img"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
