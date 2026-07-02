export function formatDateTime(value: string | null, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function splitDateTimeParts(value: string | null, locale: string): { date: string; time: string } | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return {
    date: parsed.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: parsed.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

export function formatDueDateTime(value: string | null, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Onay Bekleyen' : 'Pending Approval'
  return formatDateTime(value, locale)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
