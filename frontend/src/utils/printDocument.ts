function getCenteredPopupFeatures(width: number, height: number): string {
  const screenLeft = window.screenX ?? window.screenLeft ?? 0
  const screenTop = window.screenY ?? window.screenTop ?? 0
  const viewportWidth = window.outerWidth || document.documentElement.clientWidth || window.screen.width
  const viewportHeight = window.outerHeight || document.documentElement.clientHeight || window.screen.height
  const left = Math.max(0, Math.round(screenLeft + (viewportWidth - width) / 2))
  const top = Math.max(0, Math.round(screenTop + (viewportHeight - height) / 2))
  return `width=${width},height=${height},left=${left},top=${top}`
}

function getVisibleDetailModalHeight(fallback = 832): number {
  const modals = Array.from(document.querySelectorAll<HTMLElement>('.detail-modal-shell'))
    .map(element => element.getBoundingClientRect())
    .filter(rect => rect.width > 0 && rect.height > 0)
  const activeRect = modals[modals.length - 1]
  return Math.round(activeRect?.height ?? fallback)
}

function hardenPrintHtml(html: string): string {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">`
  return html.replace(/<head([^>]*)>/i, `<head$1>${cspMeta}`)
}

/** Open a centered preview window and print once (blob URL — about:blank footer yok, card #r449). */
export function printHtmlDocument(html: string, options?: { width?: number; height?: number }): void {
  const width = options?.width ?? 820
  const height = options?.height ?? getVisibleDetailModalHeight()
  const hardened = hardenPrintHtml(html)
  const blob = new Blob([hardened], { type: 'text/html;charset=utf-8' })
  const blobUrl = URL.createObjectURL(blob)
  const printWindow = window.open(blobUrl, '_blank', getCenteredPopupFeatures(width, height))
  if (!printWindow) {
    URL.revokeObjectURL(blobUrl)
    return
  }

  try {
    printWindow.opener = null
  } catch {
    // Some browsers expose opener as read-only; the CSP below still isolates the print document's network surface.
  }

  const cleanup = () => {
    try { URL.revokeObjectURL(blobUrl) } catch { /* ignore */ }
  }

  const tryPrint = () => {
    try {
      printWindow.document.title = printWindow.document.title || 'Yazdır'
      printWindow.focus()
      printWindow.print()
    } catch {
      cleanup()
    }
  }

  printWindow.addEventListener('afterprint', () => {
    cleanup()
    try { printWindow.close() } catch { /* ignore */ }
  })
  printWindow.setTimeout(() => {
    cleanup()
    try { printWindow.close() } catch { /* ignore */ }
  }, 60_000)

  // Blob belge yüklenene kadar bekle.
  if (printWindow.document.readyState === 'complete') {
    window.setTimeout(tryPrint, 50)
  } else {
    printWindow.addEventListener('load', () => window.setTimeout(tryPrint, 50))
  }
}
