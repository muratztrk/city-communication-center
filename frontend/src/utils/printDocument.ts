/** Print HTML in a hidden iframe so the browser does not open a visible about:blank tab. */
export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0')
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  if (!frameWindow) {
    document.body.removeChild(iframe)
    return
  }

  frameWindow.document.open()
  frameWindow.document.write(html)
  frameWindow.document.close()

  const triggerPrint = () => {
    frameWindow.focus()
    frameWindow.print()
    window.setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe)
      }
    }, 1000)
  }

  if (frameWindow.document.readyState === 'complete') {
    triggerPrint()
  } else {
    iframe.onload = triggerPrint
  }
}
