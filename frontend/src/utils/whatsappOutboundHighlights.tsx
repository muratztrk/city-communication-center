import type { ReactNode } from 'react'

const STATUS_TOKENS = ['İşleme Alındı', 'İptal Edildi', 'Yapılmakta', 'Tamamlandı', 'Yapılan İş:', 'Not:'] as const

const RELAY_OPERATOR_CLASS = 'font-semibold text-teal-300'

function classNameFor(token: string, orgNames: ReadonlySet<string>): string | null {
  if (orgNames.has(token)) return 'font-semibold text-black'
  switch (token) {
    case 'İşleme Alındı':
      return 'font-semibold text-sky-300'
    case 'Yapılmakta':
      return 'font-semibold text-orange-300'
    case 'Tamamlandı':
      return RELAY_OPERATOR_CLASS
    case 'İptal Edildi':
      return 'font-semibold text-red-300'
    case 'Yapılan İş:':
      return RELAY_OPERATOR_CLASS
    case 'Not:':
      return 'font-semibold text-red-300'
    default:
      return null
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isNotLabel(text: string, index: number) {
  if (index <= 0) return true
  return !/\p{L}/u.test(text[index - 1] ?? '')
}

/** WhatsApp giden balonda talep durumu, şablon etiketi ve otomatik kurum/birim adını boyar. */
export function renderWhatsAppOutboundHighlights(text: string, orgNames: string[] = []): ReactNode {
  const names = [...new Set(orgNames.map(name => name.trim()).filter(name => name.length >= 2))]
    .sort((left, right) => right.length - left.length)
  const orgNameSet = new Set(names)
  const pattern = new RegExp(
    [...STATUS_TOKENS, ...names.map(escapeRegExp)].join('|'),
    'gu',
  )
  const nodes: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const token = match[0]
    const index = match.index ?? 0
    if (token === 'Not:' && !isNotLabel(text, index)) continue
    const className = classNameFor(token, orgNameSet)
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
