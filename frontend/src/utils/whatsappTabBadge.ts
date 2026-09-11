/** Operatör tarayıcı sekmesi — yeni WA okunmamış rozeti (#3531). */

const TITLE_COUNT_PREFIX = /^\(\d+\)\s+/

let originalTitle: string | null = null
let originalIconHref: string | null = null
let badgeObjectUrl: string | null = null
let drawGeneration = 0

function iconLinks(): HTMLLinkElement[] {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')]
}

function rememberOriginals() {
  if (originalTitle == null) {
    originalTitle = document.title.replace(TITLE_COUNT_PREFIX, '').trim() || 'Tire İletişim Merkezi'
  }
  if (originalIconHref == null) {
    const current = iconLinks()[0]?.href
    originalIconHref = current && !current.startsWith('blob:') ? current : `${window.location.origin}/favicon.png`
  }
}

function setIconHref(href: string) {
  iconLinks().forEach(link => {
    link.href = href
    link.type = href.startsWith('blob:') ? 'image/png' : 'image/png'
  })
}

function revokeBadgeUrl() {
  if (badgeObjectUrl) {
    URL.revokeObjectURL(badgeObjectUrl)
    badgeObjectUrl = null
  }
}

function drawBadge(baseHref: string, count: number, generation: number) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    if (generation !== drawGeneration) return
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(image, 0, 0, size, size)

    const radius = count > 1 ? 18 : 12
    const cx = size - radius - 2
    const cy = radius + 2
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = '#dc2626'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()

    if (count > 1) {
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${count > 9 ? 20 : 24}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(count > 99 ? '99+' : String(count), cx, cy + 1)
    }

    canvas.toBlob(blob => {
      if (!blob || generation !== drawGeneration) return
      revokeBadgeUrl()
      badgeObjectUrl = URL.createObjectURL(blob)
      setIconHref(badgeObjectUrl)
    }, 'image/png')
  }
  image.onerror = () => {
    if (generation !== drawGeneration) return
    // Favicon çizilemezse yalnız başlık öneki kalır.
  }
  image.src = baseHref
}

export function formatWhatsAppTabTitle(baseTitle: string, count: number): string {
  if (count > 1) return `(${count}) ${baseTitle}`
  if (count === 1) return `• ${baseTitle}`
  return baseTitle
}

export function applyWhatsAppTabBadge(count: number) {
  rememberOriginals()
  const baseTitle = originalTitle ?? 'Tire İletişim Merkezi'
  const baseIcon = originalIconHref ?? `${window.location.origin}/favicon.png`
  document.title = formatWhatsAppTabTitle(baseTitle, count)

  drawGeneration += 1
  if (count <= 0) {
    revokeBadgeUrl()
    setIconHref(baseIcon)
    return
  }
  drawBadge(baseIcon, count, drawGeneration)
}

export function clearWhatsAppTabBadge() {
  applyWhatsAppTabBadge(0)
}
