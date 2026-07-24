import { useLayoutEffect, useRef, useState } from 'react'

/** Login sayfasındaki resmi belediye logosu (card #1683 reopen). */
const DETAIL_HEADER_LOGIN_LOGO_SRC = '/tire-belediyesi-logo.png'

const MIN_GAP_PX = 16
/** Başlık–aksiyon arasındayken sola kaydırma üst sınırı (card #1751 / #1885). */
const MAX_SHIFT_PX = 320
/** Birime Gelen + onaysız vatandaş talebi: Yazışmaya Git ile çakışmayı açmak için ek sola (card #1885). */
const INCOMING_PENDING_EXTRA_SHIFT_PX = 128

type DetailModalHeaderBrandProps = {
  /** true → Birime Gelen / onaysız VT: ekstra sola kaydır. */
  preferLeftForBusyActions?: boolean
}

/** Detay popup başlık satırı ortası — login page logosu, küçültülmüş.
 *  Logo, başlık ile sağ aksiyonlar arasındaki boşluğun ortasına hizalanır;
 *  çok butonlu header'da Yazışmaya Git ile çakışmaz (card #1885). */
export function DetailModalHeaderBrand({ preferLeftForBusyActions = false }: DetailModalHeaderBrandProps) {
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

      const layoutRect = layout.getBoundingClientRect()
      const actionsRect = actions.getBoundingClientRect()
      const title = layout.querySelector('.detail-modal-header-title')
      const titleRect = title instanceof HTMLElement ? title.getBoundingClientRect() : null
      const brandWidth = brand.getBoundingClientRect().width || 88

      const leftBound = (titleRect?.right ?? layoutRect.left) + MIN_GAP_PX
      const rightBound = actionsRect.left - MIN_GAP_PX
      const freeWidth = rightBound - leftBound

      const layoutCenter = layoutRect.left + layoutRect.width / 2
      let targetCenter = layoutCenter
      if (freeWidth >= brandWidth) {
        const bias = preferLeftForBusyActions ? Math.min(INCOMING_PENDING_EXTRA_SHIFT_PX, freeWidth / 4) : 0
        targetCenter = leftBound + freeWidth / 2 - bias
      } else if (freeWidth > 0) {
        targetCenter = leftBound + brandWidth / 2
      } else {
        targetCenter = actionsRect.left - MIN_GAP_PX - brandWidth / 2
      }

      let nextShift = Math.max(0, layoutCenter - targetCenter)
      if (preferLeftForBusyActions) {
        nextShift = Math.max(nextShift, INCOMING_PENDING_EXTRA_SHIFT_PX)
      }
      nextShift = Math.min(MAX_SHIFT_PX, nextShift)

      if (nextShift !== shiftRef.current) {
        shiftRef.current = nextShift
        setShiftLeftPx(nextShift)
      }
    }

    measure()
    const raf = window.requestAnimationFrame(measure)

    const resizeObserver = new ResizeObserver(() => {
      measure()
    })
    resizeObserver.observe(layout)
    const actions = layout.querySelector('.detail-modal-header-actions')
    if (actions instanceof HTMLElement) {
      resizeObserver.observe(actions)
    }

    const mutationObserver = new MutationObserver(() => {
      measure()
    })
    mutationObserver.observe(layout, { childList: true, subtree: true, characterData: true })

    const onImgLoad = () => measure()
    const img = brand.querySelector('img')
    img?.addEventListener('load', onImgLoad)

    window.addEventListener('resize', measure)
    return () => {
      window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      img?.removeEventListener('load', onImgLoad)
      window.removeEventListener('resize', measure)
    }
  }, [preferLeftForBusyActions])

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
