import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const SCROLL_CONTAINER_ID = 'main-content'
const SCROLL_THRESHOLD = 80 // px scrolled before showing "up" arrow
const SCROLL_DURATION = 380 // ms

function getScrollEl(): HTMLElement | null {
  return document.getElementById(SCROLL_CONTAINER_ID)
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

  useEffect(() => {
    const el = getScrollEl()
    if (!el) return

    const update = () => {
      const scrollTop = el.scrollTop
      const scrollable = el.scrollHeight > el.clientHeight + 10
      setHasScroll(scrollable)
      setScrolledDown(scrollTop > SCROLL_THRESHOLD)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })

    const ro = new ResizeObserver(update)
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  // Re-attach when route changes (Outlet key changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = getScrollEl()
      if (!el) return
      const scrollable = el.scrollHeight > el.clientHeight + 10
      setHasScroll(scrollable)
      setScrolledDown(el.scrollTop > SCROLL_THRESHOLD)
    }, 150)
    return () => clearTimeout(timer)
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
      className="fixed right-5 z-50 flex size-11 cursor-pointer items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-lg transition-all duration-200 hover:scale-110 hover:brightness-110 hover:shadow-xl active:scale-95"
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
