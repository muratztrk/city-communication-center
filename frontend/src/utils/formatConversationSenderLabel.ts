/** Eski kayıtlardaki "Dept / Name" biçimini "Dept · Name" olarak gösterir. */
export function formatConversationSenderLabel(label: string | null | undefined): string | null {
  const trimmed = label?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\s*\/\s*/g, ' · ')
}
