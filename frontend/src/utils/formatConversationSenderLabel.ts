/** Bekleyen giden ek önizlemesinde birim · ad soyad başlığı (card #2267 reopen). */
export function formatStaffSenderLabel(departmentName?: string | null, displayName?: string | null): string | null {
  const dept = departmentName?.trim()
  const fullName = displayName?.trim()
  if (dept && fullName) return `${dept} · ${fullName}`
  return fullName ?? dept ?? null
}

/** Eski kayıtlardaki "Dept / Name" biçimini "Dept · Name" olarak gösterir. */
export function formatConversationSenderLabel(label: string | null | undefined): string | null {
  const trimmed = label?.trim()
  if (!trimmed) return null
  return trimmed
    .replace(/\s*\/\s*/g, ' · ')
    .replace(/\bVatandaş\s+O\./g, 'Vatandaş Operatörü')
    .replace(/^İç mesaj\b/, 'Kurum İçi Mesaj')
}
