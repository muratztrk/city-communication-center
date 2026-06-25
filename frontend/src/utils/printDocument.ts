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

/** Open a centered preview window and print once (HTML should include its own onload print hook). */
export function printHtmlDocument(html: string, options?: { width?: number; height?: number }): void {
  const width = options?.width ?? 820
  const height = options?.height ?? getVisibleDetailModalHeight()
  const printWindow = window.open('', '_blank', getCenteredPopupFeatures(width, height))
  if (!printWindow) return

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
