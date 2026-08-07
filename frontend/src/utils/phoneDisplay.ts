/** Display phone without leading country code 90 / trunk 0 (card #1843).
 *  10 haneli yerel numara: `xxx xxx xx xx` (#6a75e40c). */
export function formatDirectoryPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('90')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits
  if (local.length === 10) {
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`
  }
  return local || phone.trim()
}
