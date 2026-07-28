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
  // Dropdown list rows — truncated labels show full text on hover (#r517/#r522 / #1997).
  const dropdownItem = eventTarget.closest('.dropdown-menu-item')
  if (dropdownItem instanceof HTMLElement) {
    const label = dropdownItem.querySelector('.truncate')
    if (label instanceof HTMLElement) {
      const text = cellText(label)
      // Flex + truncate bazen scrollWidth≈clientWidth raporlar; buton genişliğiyle de kıyasla.
      if (text && (isClipped(label) || label.scrollWidth > dropdownItem.clientWidth - 24)) {
        return { anchor: label, text }
      }
    }
    return null
  }

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
 * Global hover tooltip for clipped grid cells (#r474–#r479) and dropdown rows (#r517).
 * Opens below the cell after ~1s hover (#r535 / #2008); compact size.
 */
export function useDataTableOverflowTooltips() {
  useEffect(() => {
    let tip: HTMLDivElement | null = null
    let hideTimer: number | null = null
    let showTimer: number | null = null
    let activeAnchor: HTMLElement | null = null
    let activeText = ''

    const ensureTip = () => {
      if (tip) return tip
      tip = document.createElement('div')
      tip.className = 'ccc-grid-overflow-tooltip'
      tip.setAttribute('role', 'tooltip')
      tip.dataset.open = 'false'
      document.body.appendChild(tip)
      return tip
    }

    const clearHide = () => {
      if (hideTimer != null) {
        window.clearTimeout(hideTimer)
        hideTimer = null
      }
    }

    const clearShow = () => {
      if (showTimer != null) {
        window.clearTimeout(showTimer)
        showTimer = null
      }
    }

    const hide = () => {
      clearHide()
      clearShow()
      if (tip) tip.dataset.open = 'false'
      activeAnchor = null
      activeText = ''
    }

    const placeBelow = (anchor: HTMLElement) => {
      const el = ensureTip()
      const rect = anchor.getBoundingClientRect()
      const tipRect = el.getBoundingClientRect()
      const gap = 6
      // Prefer below (#r479); only flip above when bottom would leave the viewport.
      let top = rect.bottom + gap
      if (top + tipRect.height > window.innerHeight - gap && rect.top - tipRect.height - gap >= gap) {
        top = rect.top - tipRect.height - gap
      }
      // Ortalı konum + hafif sağa kaydır (#r524 / #2001).
      const rightNudge = 16
      let left = rect.left + rect.width / 2 - tipRect.width / 2 + rightNudge
      left = Math.max(gap, Math.min(left, window.innerWidth - tipRect.width - gap))
      el.style.top = `${Math.round(top)}px`
      el.style.left = `${Math.round(left)}px`
    }

    const show = (anchor: HTMLElement, text: string) => {
      clearHide()
      const el = ensureTip()
      const same = activeAnchor === anchor && activeText === text

      // Aynı hücrede zaten açık → yalnızca konum güncelle.
      if (same && el.dataset.open === 'true') {
        placeBelow(anchor)
        return
      }
      // Aynı hücrede 1s gecikme sayacı çalışıyorsa yeniden başlatma.
      if (same && showTimer != null) return

      clearShow()
      if (!same) el.dataset.open = 'false'
      activeAnchor = anchor
      activeText = text
      anchor.removeAttribute('title')
      el.textContent = text
      placeBelow(anchor)
      // 1 saniye hover sonrası göster (#r535 / card #2008).
      showTimer = window.setTimeout(() => {
        showTimer = null
        if (activeAnchor !== anchor) return
        placeBelow(anchor)
        el.dataset.open = 'true'
      }, 1000)
    }

    const onOver = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const hit = resolveOverflowTarget(target)
      if (!hit) {
        if (activeAnchor && !activeAnchor.contains(target)) {
          clearHide()
          clearShow()
          hideTimer = window.setTimeout(hide, 40)
        }
        return
      }
      show(hit.anchor, hit.text)
    }

    const onOut = (event: Event) => {
      const related = (event as MouseEvent).relatedTarget
      if (related instanceof Node && activeAnchor?.contains(related)) return
      clearHide()
      clearShow()
      hideTimer = window.setTimeout(hide, 40)
    }

    const onScroll = () => {
      if (activeAnchor && tip?.dataset.open === 'true') placeBelow(activeAnchor)
      else hide()
    }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', hide)

    return () => {
      clearHide()
      clearShow()
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', hide)
      tip?.remove()
      tip = null
    }
  }, [])
}
