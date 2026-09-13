import { formatDirectoryPhone } from './phoneDisplay'

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0(?=5\d{9}$)/, '90')
}

export function matchesPhone(left: string, right: string): boolean {
  return normalizePhone(left) === normalizePhone(right)
}

/** TR ulusal numara gösterimi: XXX XXX XX XX (#3581). */
export function formatTrNationalGrouped(digits: string): string {
  const national = digits.replace(/\D/g, '').slice(0, 10)
  if (national.length <= 3) return national
  if (national.length <= 6) return `${national.slice(0, 3)} ${national.slice(3)}`
  if (national.length <= 8) return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8)}`
}

/**
 * Cep telefonu girişi: yalnız rakam, ilk hane 5 (kart #3205/#3210/#3211).
 * İlk hane 5 değilse tuş vuruşu yazılmaz — önceki değer korunur; alanı tamamen
 * boşaltmaya izin verilir. `0532…` / `90532…` / `+90 532…` yapıştırmaları önek
 * atılarak kabul edilir.
 */
export function sanitizeMobilePhoneInput(next: string, previous: string, maxLength = 10): string {
  const digits = next.replace(/\D/g, '').slice(0, maxLength)
  if (digits.length === 0) return ''
  if (digits.startsWith('5')) return digits

  const allDigits = next.replace(/\D/g, '')
  for (const prefix of ['0', '90', '0090']) {
    if (allDigits.startsWith(prefix) && allDigits[prefix.length] === '5') {
      return allDigits.slice(prefix.length, prefix.length + maxLength)
    }
  }

  return previous.replace(/\D/g, '').slice(0, maxLength)
}

/** +ülke kodlu okunabilir numara (WhatsApp konuşma başlıkları — card #1555/#3567). */
export function formatDisplayPhone(phone: string): string {
  return formatDirectoryPhone(phone) || phone
}
