import { richTextToPlainText } from './richText'

function notePlain(value?: string | null) {
  return richTextToPlainText(value ?? '').trim()
}

export function stripAutoMessageNoteLabel(value?: string | null) {
  const plain = notePlain(value).replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n')
  if (!plain) return ''
  const match = /(?:^|\n)(Yapılan İş|İptal Nedeni|İptal Notu|Not)\s*:\s*/u.exec(plain)
  if (match && match.index >= 0) {
    const after = plain.slice(match.index + match[0].length).trim()
    if (match[1] === 'Not' || match[1] === 'İptal Nedeni' || match[1] === 'İptal Notu') {
      return after
    }
    const firstLine = after.split('\n')[0]?.trim() ?? ''
    if (firstLine) return firstLine
  }
  return plain
}

/** Detay popup: yalnız iletilmiş outbound; onay notuna düşülmez (#3552). */
export function resolveCitizenOutboundDisplay(detail: {
  citizenOutboundMessage?: string | null
  citizenApprovalReleasedNote?: string | null
}): string {
  return stripAutoMessageNoteLabel(detail.citizenOutboundMessage)
    || notePlain(detail.citizenOutboundMessage)
}

/** İletim yokken Detaylar değeri: açık mavi Onay Bekleyen; başlık yeşil olmaz (#3556). */
export const CITIZEN_OUTBOUND_PENDING_VALUE_CLASS = 'citizen-terminal-note-value text-sky-500'

export function citizenOutboundOrPending(outbound: string | null | undefined, pendingLabel: string) {
  const text = (outbound ?? '').trim()
  return text ? { value: text, pending: false } : { value: pendingLabel, pending: true }
}

export function notesDiffer(left?: string | null, right?: string | null) {
  const a = notePlain(left)
  const b = notePlain(right)
  if (!a || !b) return a !== b
  return a.toLocaleLowerCase('tr') !== b.toLocaleLowerCase('tr')
}

/** İptal taleplerde operatör outbound düzenlediyse Not: sonrası; Not: silindiyse tam metin (#3524). */
export function formatCitizenCancelOutboundDisplay(outbound: string, _cancelNote = ''): string {
  const outboundTrim = outbound.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').trim()
  if (!outboundTrim) return ''

  const notMatch = /(?:^|\n)\s*(?:Not|İptal Notu|İptal Nedeni)\s*:\s*/iu.exec(outboundTrim)
  if (notMatch) {
    const after = outboundTrim.slice(notMatch.index + notMatch[0].length).trim()
    return after || outboundTrim
  }

  return outboundTrim
}

export function resolveCitizenCancelOutboundDisplay(
  detail: {
    citizenOutboundMessage?: string | null
    citizenApprovalReleasedNote?: string | null
  },
  cancelNote = '',
): string {
  const raw = notePlain(detail.citizenOutboundMessage)
  if (raw) return formatCitizenCancelOutboundDisplay(raw, cancelNote)
  const resolved = resolveCitizenOutboundDisplay(detail)
  return resolved ? formatCitizenCancelOutboundDisplay(resolved, cancelNote) : ''
}
