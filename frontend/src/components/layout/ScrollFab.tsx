import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Priority list — first existing element wins */
const SCROLL_CONTAINER_IDS = ['detail-scroll', 'main-content']
const SCROLL_THRESHOLD = 80 // px scrolled before showing "up" arrow
const SCROLL_DURATION = 380 // ms

function getScrollEl(): HTMLElement | null {
  for (const id of SCROLL_CONTAINER_IDS) {
    const el = document.getElementById(id)
    if (el) return el
  }
  return null
}

// easeInOutCubic — smoother than native behavior: 'smooth' on some browsers
function smoothScrollTo(el: HTMLElement, targetTop: number) {
  const from = el.scrollTop
  const distance = targetTop - from
  if (Math.abs(distance) < 2) return
  const startTime = performance.now()

  const tick = (now: number) => {
    const t = Math.min((now - startTime) / SCROLL_DURATION, 1)
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    el.scrollTop = from + distance * ease
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function ScrollFab() {
  const [scrolledDown, setScrolledDown] = useState(false)
  const [hasScroll, setHasScroll] = useState(false)
  const animatingRef = useRef(false)
  // Track which container is active so we can re-attach listeners
  const activeElRef = useRef<HTMLElement | null>(null)

  const attach = () => {
    // Detach old listener
    if (activeElRef.current) {
      activeElRef.current.removeEventListener('scroll', update)
    }

    const el = getScrollEl()
    activeElRef.current = el

    if (!el) {
      setHasScroll(false)
      setScrolledDown(false)
      return
    }

    const scrollable = el.scrollHeight > el.clientHeight + 10
    setHasScroll(scrollable)
    setScrolledDown(el.scrollTop > SCROLL_THRESHOLD)

    el.addEventListener('scroll', update, { passive: true })
  }

  function update() {
    const el = activeElRef.current
    if (!el) return
    const scrollable = el.scrollHeight > el.clientHeight + 10
    setHasScroll(scrollable)
    setScrolledDown(el.scrollTop > SCROLL_THRESHOLD)
  }

  // Re-attach on every render tick (catches modal open/close and route changes)
  useEffect(() => {
    const timer = setTimeout(attach, 60)
    return () => {
      clearTimeout(timer)
      if (activeElRef.current) {
        activeElRef.current.removeEventListener('scroll', update)
      }
    }
  })

  if (!hasScroll) return null

  const handleClick = () => {
    if (animatingRef.current) return
    const el = getScrollEl()
    if (!el) return
    animatingRef.current = true
    setTimeout(() => { animatingRef.current = false }, SCROLL_DURATION + 50)
    if (scrolledDown) {
      smoothScrollTo(el, 0)
    } else {
      smoothScrollTo(el, el.scrollHeight)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={scrolledDown ? 'Sayfanın başına git' : 'Sayfanın sonuna git'}
      title={scrolledDown ? 'Sayfanın başına git' : 'Sayfanın sonuna git'}
      className="fixed right-5 z-[70] flex size-11 cursor-pointer items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-lg transition-all duration-200 hover:scale-110 hover:bg-[var(--color-secondary)] hover:shadow-xl active:scale-95"
      style={{ bottom: '96px' }}
    >
      <span
        className="flex items-center justify-center transition-transform duration-300"
        style={{ transform: scrolledDown ? 'rotate(0deg)' : 'rotate(180deg)' }}
      >
        <ArrowUp className="size-5" />
      </span>
    </button>
  )
}
