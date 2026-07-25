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

/**
 * Global GridView hover: when a data-table cell clips with ellipsis / line-clamp,
 * show the full text via native title tooltip (#r474, #r477).
 */
export function useDataTableOverflowTooltips() {
  useEffect(() => {
    const onOver = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const td = target.closest('.data-table tbody td')
      if (!(td instanceof HTMLElement) || td.classList.contains('actions-cell')) return

      let node: Element | null = target
      while (node && node !== td) {
        if (node instanceof HTMLElement && mayEllipsis(node) && isClipped(node)) {
          const text = cellText(node)
          if (text) {
            node.setAttribute('title', text)
            return
          }
        }
        node = node.parentElement
      }

      if (
        isClipped(td)
        && !td.querySelector('button, a, input, select, textarea')
      ) {
        const text = cellText(td)
        if (text) td.setAttribute('title', text)
      }
    }

    document.addEventListener('mouseover', onOver, true)
    return () => document.removeEventListener('mouseover', onOver, true)
  }, [])
}
