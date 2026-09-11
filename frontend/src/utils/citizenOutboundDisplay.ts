import { richTextToPlainText } from './richText'

function notePlain(value?: string | null) {
  return richTextToPlainText(value ?? '').trim()
}

export function stripAutoMessageNoteLabel(value?: string | null) {
  const plain = notePlain(value).replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n')
  if (!plain) return ''
  const match = /(?:^|\n)(Yapılan İş|İptal Nedeni|İptal Notu)\s*:\s*/u.exec(plain)
  if (match && match.index >= 0) {
    const after = plain.slice(match.index + match[0].length).trim()
    const firstLine = after.split('\n')[0]?.trim() ?? ''
    if (firstLine) return firstLine
  }
  return plain
}

export function notesDiffer(left?: string | null, right?: string | null) {
  const a = notePlain(left)
  const b = notePlain(right)
  if (!a || !b) return a !== b
  return a.toLocaleLowerCase('tr') !== b.toLocaleLowerCase('tr')
}

/** İptal taleplerde operatör outbound düzenlediyse Not: sonrası; Not: silindiyse tam metin (#3524). */
export function formatCitizenCancelOutboundDisplay(outbound: string, cancelNote: string): string {
  const outboundTrim = outbound.trim()
  const cancelTrim = cancelNote.trim()
  if (!outboundTrim || !cancelTrim || cancelTrim === '—') return outboundTrim
  const modified = outboundTrim.localeCompare(cancelTrim, 'tr', { sensitivity: 'accent' }) !== 0
  if (!modified) return outboundTrim

  const notMatch = /(?:^|\n)\s*Not\s*:\s*/i.exec(outboundTrim)
  if (notMatch) {
    const after = outboundTrim.slice(notMatch.index + notMatch[0].length).trim()
    return after || outboundTrim
  }
  return outboundTrim
}
