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

/** +90 önekli okunabilir numara (WhatsApp konuşma başlıkları — card #1555). */
export function formatDisplayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('90')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits
  if (local.length === 10) {
    return `+90 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`
  }
  if (digits.length === 0) return phone
  return digits.startsWith('90') ? `+${digits}` : `+90 ${digits}`
}
