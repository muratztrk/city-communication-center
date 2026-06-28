export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0(?=5\d{9}$)/, '90')
}

export function matchesPhone(left: string, right: string): boolean {
  return normalizePhone(left) === normalizePhone(right)
}
