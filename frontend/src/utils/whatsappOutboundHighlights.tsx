import type { ReactNode } from 'react'

const TOKEN = /İşleme Alındı|İptal Edildi|Yapılmakta|Tamamlandı|Yapılan İş:|Not:/gu

function classNameFor(token: string): string | null {
  switch (token) {
    case 'İşleme Alındı':
      return 'font-semibold text-sky-300'
    case 'Yapılmakta':
      return 'font-semibold text-orange-300'
    case 'Tamamlandı':
      return 'font-semibold text-cyan-300'
    case 'İptal Edildi':
      return 'font-semibold text-red-300'
    case 'Yapılan İş:':
      return 'font-semibold text-cyan-300'
    case 'Not:':
      return 'font-semibold text-red-300'
    default:
      return null
  }
}

function isNotLabel(text: string, index: number) {
  if (index <= 0) return true
  return !/\p{L}/u.test(text[index - 1] ?? '')
}

/** WhatsApp giden balonda talep durumu ve şablon etiketlerini boyar (#6ab3da96 / #6ab3db77). */
export function renderWhatsAppOutboundHighlights(text: string): ReactNode {
  const nodes: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0]
    const index = match.index ?? 0
    if (token === 'Not:' && !isNotLabel(text, index)) continue
    const className = classNameFor(token)
    if (!className) continue
    if (index > last) nodes.push(text.slice(last, index))
    nodes.push(
      <span key={`${index}-${token}`} className={className}>
        {token}
      </span>,
    )
    last = index + token.length
  }
  if (nodes.length === 0) return text
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
