export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0(?=5\d{9}$)/, '90')
}

export function matchesPhone(left: string, right: string): boolean {
  return normalizePhone(left) === normalizePhone(right)
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
