import { useLayoutEffect, useRef, useState } from 'react'

/** Login sayfasındaki resmi belediye logosu (card #1683 reopen). */
const DETAIL_HEADER_LOGIN_LOGO_SRC = '/tire-belediyesi-logo.png'

const MIN_GAP_PX = 12
/** Başlık–aksiyon arasındayken sola kaydırma üst sınırı (card #1751 / #1885). */
const MAX_SHIFT_PX = 280

/** Detay popup başlık satırı ortası — login page logosu, küçültülmüş.
 *  Logo, başlık ile sağ aksiyonlar arasındaki boşluğun ortasına hizalanır;
 *  çok butonlu (ör. onaysız vatandaş talebi) header'da Yazışmaya Git ile çakışmaz (card #1885). */
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
        targetCenter = leftBound + freeWidth / 2
      } else if (freeWidth > 0) {
        // Dar boşluk: logoyu boşluğun soluna yasla (aksiyonlara değmesin).
        targetCenter = leftBound + brandWidth / 2
      } else {
        // Boşluk yok: aksiyonların soluna MIN_GAP kadar bırak.
        targetCenter = actionsRect.left - MIN_GAP_PX - brandWidth / 2
      }

      // Pozitif = sola kaydır (CSS translate(-50% - shift)).
      let nextShift = Math.max(0, layoutCenter - targetCenter)
      nextShift = Math.min(MAX_SHIFT_PX, nextShift)

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
