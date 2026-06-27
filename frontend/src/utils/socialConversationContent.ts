import { richTextToPlainText } from './richText'

const BRACKET_LABELS: Record<string, string> = {
  unsupported: 'Desteklenmeyen mesaj türü',
  unknown: 'Bilinmeyen mesaj',
  image: 'Görsel',
  video: 'Video',
  audio: 'Ses kaydı',
  document: 'Belge',
  sticker: 'Çıkartma',
  voice: 'Sesli mesaj',
  contacts: 'Kişi kartı',
  location: 'Konum',
}

export function formatBracketContent(content: string): string {
  const trimmed = content.trim()
  const bracketMatch = /^\[(.+)\]$/.exec(trimmed)
  const angleMatch = /^<(.+)>$/.exec(trimmed)
  const match = bracketMatch ?? angleMatch
  if (!match) return content
  const key = match[1].trim().toLowerCase()
  return BRACKET_LABELS[key] ?? match[1]
}

export function extensionFromMimeType(mime: string): string {
  const normalized = mime.toLowerCase()
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg'
  if (normalized.includes('png')) return '.png'
  if (normalized.includes('gif')) return '.gif'
  if (normalized.includes('webp')) return '.webp'
  if (normalized.includes('pdf')) return '.pdf'
  if (normalized.includes('mp4')) return '.mp4'
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return '.mp3'
  if (normalized.includes('ogg')) return '.ogg'
  if (normalized.includes('word')) return '.docx'
  if (normalized.includes('excel') || normalized.includes('spreadsheet')) return '.xlsx'
  if (normalized.includes('powerpoint') || normalized.includes('presentation')) return '.pptx'
  return '.bin'
}

export function normalizeWhatsappPhoneForFilename(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function whatsappMediaFilename(citizenPhone: string, mime: string): string {
  const localPhone = normalizeWhatsappPhoneForFilename(citizenPhone)
  return `whatsapp-${localPhone}${extensionFromMimeType(mime)}`
}

export function socialMediaFilename(entryId: string, mime: string, citizenPhone?: string | null): string {
  if (citizenPhone?.trim()) {
    return whatsappMediaFilename(citizenPhone, mime)
  }
  return `whatsapp-${entryId.slice(0, 8)}${extensionFromMimeType(mime)}`
}

export function isPlaceholderBracketContent(content: string): boolean {
  const trimmed = content.trim()
  return /^\[[^\]]+\]$/.test(trimmed) || /^<[^>/]+>$/.test(trimmed)
}

/** WhatsApp konuşma balonu / önizleme metni — HTML etiketlerini göstermez. */
export function formatConversationDisplayContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (isPlaceholderBracketContent(trimmed)) return formatBracketContent(trimmed)
  return richTextToPlainText(trimmed)
}
