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
  'kişi kartı': 'Kişi kartı',
  location: 'Konum',
  'location message': 'Konum',
  'konum mesajı': 'Konum',
}

const LOCATION_COORDS_RE = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/

export function parseConversationLocationCoords(
  content: string | null | undefined,
  latitude?: number | null,
  longitude?: number | null,
): { latitude: number; longitude: number } | null {
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude }
  }
  if (!content?.trim()) return null
  const match = LOCATION_COORDS_RE.exec(content)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { latitude: lat, longitude: lng }
}

export function buildGoogleMapsOpenUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`
}

export function isLocationConversationContent(content: string | null | undefined): boolean {
  if (!content?.trim()) return false
  if (isContactConversationContent(content)) return false
  const normalized = content.trim().toLocaleLowerCase('tr')
  return normalized.includes('[konum mesajı]')
    || normalized.includes('[location message]')
    || normalized.includes('[location]')
    || normalized.includes('konum mesajı')
}

const CONTACT_PHONE_HINT_RE = /(\+?\d[\d\s\-().]{6,}\d)/

/** WhatsApp rehber / kişi kartı içeriği (#6a75a9c2 / #6a75ccfa / #6a75cd3f). */
export function isContactConversationContent(content: string | null | undefined): boolean {
  if (!content?.trim()) return false
  const trimmed = content.trim()
  const lower = trimmed.toLocaleLowerCase('tr')
  if (
    lower.includes('[kişi kartı]')
    || lower.includes('[kisi karti]')
    || lower.includes('[contacts]')
    || lower === 'kişi kartı'
    || lower === 'kisi karti'
  ) {
    return true
  }
  // Eski kayıt: "Ad · +90…" / "Ad - +90…" (konum marker'ı yok).
  if (
    CONTACT_PHONE_HINT_RE.test(trimmed)
    && !lower.includes('[konum')
    && !lower.includes('konum mesajı')
    && !LOCATION_COORDS_RE.test(trimmed)
  ) {
    return true
  }
  return false
}

/** Kişi kartı görünen metin — `[kişi kartı]` marker ve eski bullet temizlenir (#6a75cccc). */
export function formatContactDisplayContent(content: string | null | undefined): string {
  if (!content?.trim()) return ''
  let text = content.trim()
    .replace(/\[kişi kartı\]/gi, '')
    .replace(/\[kisi karti\]/gi, '')
    .replace(/\[contacts\]/gi, '')
    .trim()
  // Eski "Ad · telefon" → "Ad - telefon"
  text = text.replace(/\s*·\s*/g, ' - ')
  return text || 'Kişi kartı'
}

/** Kayıtlı yer adı / adres metni — bracket etiketi ve koordinatlar temizlenir (#6a74de2a). */
export function getLocationPlaceDescription(content: string | null | undefined): string | null {
  if (!content?.trim()) return null
  if (isContactConversationContent(content)) return null
  const trimmed = content.trim()
  if (isPlaceholderBracketContent(trimmed) && !isLocationConversationContent(trimmed)) return null
  let text = trimmed
    .replace(/\[konum mesajı\]/gi, '')
    .replace(/\[location message\]/gi, '')
    .replace(/\[location\]/gi, '')
    .replace(LOCATION_COORDS_RE, '')
    .trim()
  text = text.replace(/^[-–—,\s]+|[-–—,\s]+$/g, '').trim()
  if (!text) return null
  if (isPlaceholderBracketContent(text)) return null
  const lower = text.toLocaleLowerCase('tr')
  if (
    lower === 'konum'
    || lower === 'konum mesajı'
    || lower === 'location'
    || lower === 'location message'
  ) {
    return null
  }
  return text
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

/** `[Dosya eki: orijinal-ad.pdf]` içeriğinden dosya adını çıkarır (giden #2385, gelen #2406/#6a75c6fa). */
export function parseAttachmentFilenameFromContent(content: string | null | undefined): string | null {
  if (!content?.trim()) return null
  const trimmed = content.trim()
  const startMatch = /^\[Dosya eki:\s*(.+)\]$/i.exec(trimmed)
  if (startMatch?.[1]) return startMatch[1].trim()
  const embedMatch = /\[Dosya eki:\s*(.+?)\]/i.exec(trimmed)
  if (embedMatch?.[1]) return embedMatch[1].trim()
  // Marker yoksa ama içerik tek satır ham dosya adıysa orijinal adı koru (yeniden adlandırma).
  if (
    !trimmed.includes('\n')
    && !trimmed.startsWith('[')
    && !trimmed.startsWith('<')
    && /^[^\\/:*?"<>|\s].+\.[A-Za-z0-9]{2,8}$/.test(trimmed)
    && trimmed.length <= 240
  ) {
    const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
    return (slash >= 0 ? trimmed.slice(slash + 1) : trimmed).trim() || null
  }
  return null
}

/** Görünen metinden dosya adı işaretleyicisini çıkarır (açıklama + `[Dosya eki: …]` birlikteyken). */
export function stripAttachmentFilenameMarker(content: string): string {
  return content.replace(/\n?\[Dosya eki:\s*.+?\]\s*$/i, '').trim()
}

export function isPlaceholderBracketContent(content: string): boolean {
  const trimmed = content.trim()
  return /^\[[^\]]+\]$/.test(trimmed) || /^<[^>/]+>$/.test(trimmed)
}

/** WhatsApp konuşma balonu / önizleme metni — HTML etiketlerini göstermez. */
export function formatConversationDisplayContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (isContactConversationContent(trimmed)) return formatContactDisplayContent(trimmed)
  if (isPlaceholderBracketContent(trimmed)) return formatBracketContent(trimmed)
  // "[konum mesajı] 38.1,27.2" → liste önizlemesinde "Konum"; kayıtlı yer → yer adı (#6a74de2a)
  if (isLocationConversationContent(trimmed)) {
    const place = getLocationPlaceDescription(trimmed)
    if (place) return place
    const withoutCoords = trimmed.replace(LOCATION_COORDS_RE, '').trim()
    if (isPlaceholderBracketContent(withoutCoords) || withoutCoords.toLocaleLowerCase('tr').includes('konum')) {
      return BRACKET_LABELS['konum mesajı'] ?? 'Konum'
    }
  }
  return stripAttachmentFilenameMarker(richTextToPlainText(trimmed))
}
