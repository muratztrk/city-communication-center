import { formatNationalPhoneGroups, splitCitizenPhone } from './countryCallingCodes'

/** Grid/detay telefon: uluslararası kodlu `+90 5XX XXX XX XX` (#3573). */
export function formatDirectoryPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return phone.trim()
  const { dial, national } = splitCitizenPhone(phone)
  if (!national) return `+${dial}`
  return `+${dial} ${formatNationalPhoneGroups(national)}`
}

export function looksLikePhone(value: string | null | undefined): boolean {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/** Ad yoksa veya ad telefon ise Numara kolonundaki format (#3106). */
export function directoryCitizenDisplayName(
  name: string | null | undefined,
  phone: string | null | undefined,
): string {
  const trimmed = name?.trim() ?? ''
  if (trimmed && !looksLikePhone(trimmed)) return trimmed
  return formatDirectoryPhone(phone || trimmed) || trimmed || '—'
}
