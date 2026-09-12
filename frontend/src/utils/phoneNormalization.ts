import { formatDirectoryPhone } from './phoneDisplay'

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0(?=5\d{9}$)/, '90')
}

export function matchesPhone(left: string, right: string): boolean {
  return normalizePhone(left) === normalizePhone(right)
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
