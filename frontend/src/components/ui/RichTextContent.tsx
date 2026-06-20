import { useMemo } from 'react'

const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'SPAN'])
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS'])
const RICH_TEXT_TAG_PATTERN = /<\/?(p|div|br|ul|ol|li|strong|b|em|i|u|span)\b/i

const SAFE_FONT_SIZE_RE = /^\d+(\.\d+)?(px|pt|em|rem)$/
const SAFE_FONT_FAMILY_RE = /^[\w\s,'".-]+$/

function looksLikeRichTextHtml(value: string): boolean {
  return RICH_TEXT_TAG_PATTERN.test(value)
}

function sanitizeSpanStyle(style: string): string {
  const parts: string[] = []
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (prop === 'font-size' && SAFE_FONT_SIZE_RE.test(val)) parts.push(`font-size: ${val}`)
    if (prop === 'font-family' && SAFE_FONT_FAMILY_RE.test(val)) parts.push(`font-family: ${val}`)
  }
  return parts.join('; ')
}

function sanitizeNode(parent: Node, documentRef: Document) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 3) continue

    if (child.nodeType !== 1) {
      child.parentNode?.removeChild(child)
      continue
    }

    const element = child as HTMLElement

    if (DROPPED_TAGS.has(element.tagName)) {
      element.remove()
      continue
    }

    sanitizeNode(element, documentRef)

    if (!ALLOWED_TAGS.has(element.tagName)) {
      const fragment = documentRef.createDocumentFragment()
      while (element.firstChild) fragment.appendChild(element.firstChild)
      element.replaceWith(fragment)
      continue
    }

    if (element.tagName === 'SPAN') {
      const safeStyle = sanitizeSpanStyle(element.getAttribute('style') ?? '')
      for (const attr of Array.from(element.attributes)) element.removeAttribute(attr.name)
      if (safeStyle) {
        element.setAttribute('style', safeStyle)
      } else {
        const fragment = documentRef.createDocumentFragment()
        while (element.firstChild) fragment.appendChild(element.firstChild)
        element.replaceWith(fragment)
      }
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name)
    }
  }
}

function sanitizeRichTextHtml(value: string) {
  if (!value.trim()) return ''
  if (typeof DOMParser === 'undefined') return ''

  const documentRef = new DOMParser().parseFromString(value, 'text/html')
  sanitizeNode(documentRef.body, documentRef)
  return documentRef.body.innerHTML
}

// &nbsp; (ve hatalı çift kodlama &amp;nbsp;, &amp;amp;nbsp; …) ile gerçek U+00A0 karakterini normal
// boşluğa indirger. Çift kodlanmış değerler rich-text dalında dangerouslySetInnerHTML ile düz
// "&nbsp;" olarak görünüyordu; tek noktada normalize edince hem düz metin hem HTML dalı düzelir (card 551).
function normalizeNbsp(value: string): string {
  return value.replace(/&(?:amp;)*nbsp;/gi, ' ').replace(/\u00a0/g, ' ')
}

// Etiketsiz düz metin olarak gösterilecek değerde HTML varlıklarını çöz (örn. &amp; → &) (card 551).
function decodeHtmlEntities(value: string): string {
  if (!value.includes('&')) return value
  if (typeof DOMParser === 'undefined') return value.replace(/&nbsp;/gi, ' ')
  const documentRef = new DOMParser().parseFromString(value, 'text/html')
  return (documentRef.body.textContent ?? value).replace(/\u00a0/g, ' ')
}

interface RichTextContentProps {
  value: string | null | undefined
  emptyText?: string
  className?: string
}

export function RichTextContent({ value, emptyText = '—', className }: RichTextContentProps) {
  // &nbsp; / çift kodlanmış &amp;nbsp; ve U+00A0 normal boşluğa indirgenir; aksi halde çift kodlanmış
  // açıklamalar (örn. T-2026-109) Detaylar pop-up'ında düz "&nbsp;" olarak görünüyordu (card 551).
  const plainValue = useMemo(() => normalizeNbsp(value ?? ''), [value])
  const sanitizedHtml = useMemo(
    () => looksLikeRichTextHtml(plainValue) ? sanitizeRichTextHtml(plainValue) : '',
    [plainValue],
  )

  if (!sanitizedHtml && !plainValue.trim()) {
    return <div className={className}>{emptyText}</div>
  }

  if (!sanitizedHtml) {
    return <div className={className} style={{ whiteSpace: 'pre-wrap' }}>{decodeHtmlEntities(plainValue)}</div>
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
