import { useEffect } from 'react'

function isClipped(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
}

function cellText(el: HTMLElement): string {
  return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
}

function mayEllipsis(el: HTMLElement): boolean {
  if (
    el.classList.contains('truncate')
    || el.classList.contains('cell-title')
    || el.classList.contains('line-clamp-1')
    || el.classList.contains('line-clamp-2')
  ) {
    return true
  }
  const style = getComputedStyle(el)
  if (style.textOverflow === 'ellipsis') return true
  if (style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden') return true
  if (style.display === '-webkit-box' && style.webkitLineClamp && style.webkitLineClamp !== 'none') return true
  return false
}

function resolveOverflowTarget(eventTarget: Element): { anchor: HTMLElement; text: string } | null {
  const td = eventTarget.closest('.data-table tbody td')
  if (!(td instanceof HTMLElement) || td.classList.contains('actions-cell')) return null

  let node: Element | null = eventTarget
  while (node && node !== td) {
    if (node instanceof HTMLElement && mayEllipsis(node) && isClipped(node)) {
      const text = cellText(node)
      if (text) return { anchor: node, text }
    }
    node = node.parentElement
  }

  if (
    isClipped(td)
    && !td.querySelector('button, a, input, select, textarea')
  ) {
    const text = cellText(td)
    if (text) return { anchor: td, text }
  }
  return null
}

/**
 * Global GridView hover: custom modern tooltip for clipped ellipsis / line-clamp
 * cells (replaces native browser title) (#r474, #r477, #r478).
 */
export function useDataTableOverflowTooltips() {
  useEffect(() => {
    let tip: HTMLDivElement | null = null
    let showTimer: number | null = null
    let hideTimer: number | null = null
    let activeAnchor: HTMLElement | null = null

    const ensureTip = () => {
      if (tip) return tip
      tip = document.createElement('div')
      tip.className = 'ccc-grid-overflow-tooltip'
      tip.setAttribute('role', 'tooltip')
      tip.dataset.open = 'false'
      document.body.appendChild(tip)
      return tip
    }

    const clearTimers = () => {
      if (showTimer != null) {
        window.clearTimeout(showTimer)
        showTimer = null
      }
      if (hideTimer != null) {
        window.clearTimeout(hideTimer)
        hideTimer = null
      }
    }

    const hide = () => {
      clearTimers()
      if (tip) tip.dataset.open = 'false'
      activeAnchor = null
    }

    const place = (anchor: HTMLElement) => {
      const el = ensureTip()
      const rect = anchor.getBoundingClientRect()
      const tipRect = el.getBoundingClientRect()
      const gap = 8
      let top = rect.top - tipRect.height - gap
      if (top < gap) top = rect.bottom + gap
      let left = rect.left + rect.width / 2 - tipRect.width / 2
      left = Math.max(gap, Math.min(left, window.innerWidth - tipRect.width - gap))
      el.style.top = `${Math.round(top)}px`
      el.style.left = `${Math.round(left)}px`
    }

    const show = (anchor: HTMLElement, text: string) => {
      clearTimers()
      // Avoid stacking with native browser tooltips.
      anchor.removeAttribute('title')
      const el = ensureTip()
      el.textContent = text
      activeAnchor = anchor
      showTimer = window.setTimeout(() => {
        place(anchor)
        // Re-measure after text paint.
        requestAnimationFrame(() => {
          if (activeAnchor === anchor) {
            place(anchor)
            el.dataset.open = 'true'
          }
        })
      }, 180)
    }

    const onOver = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const hit = resolveOverflowTarget(target)
      if (!hit) {
        if (activeAnchor && !activeAnchor.contains(target) && tip && !tip.contains(target)) {
          hideTimer = window.setTimeout(hide, 80)
        }
        return
      }
      if (activeAnchor === hit.anchor && tip?.dataset.open === 'true') return
      show(hit.anchor, hit.text)
    }

    const onOut = (event: Event) => {
      const related = (event as MouseEvent).relatedTarget
      if (related instanceof Node && activeAnchor?.contains(related)) return
      if (related instanceof Node && tip?.contains(related)) return
      hideTimer = window.setTimeout(hide, 80)
    }

    const onScroll = () => {
      if (activeAnchor && tip?.dataset.open === 'true') place(activeAnchor)
      else hide()
    }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', hide)

    return () => {
      clearTimers()
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', hide)
      tip?.remove()
      tip = null
    }
  }, [])
}
