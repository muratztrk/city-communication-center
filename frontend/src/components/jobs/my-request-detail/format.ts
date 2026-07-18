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

/** Süreç timeline "Onay Bekleyen" / "Pending Approval" değeri (card #1684 reopen). */
export function isPendingApprovalText(value: string | null | undefined): boolean {
  return /onay bekleyen|pending approval/i.test(value ?? '')
}

export function pendingApprovalValueClassName(value: string | null | undefined): string {
  return isPendingApprovalText(value)
    ? 'job-process-timeline__pending-approval-text text-slate-900'
    : 'text-sm font-semibold text-slate-900'
}

export function getStatusChangeTextClass(status: string) {
  if (status === 'Cancelled' || status === 'Rejected') return 'text-red-600'
  if (status === 'Completed') return 'text-emerald-600'
  if (status === 'InProgress' || status === 'Active') return 'text-orange-600'
  return 'text-slate-900'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
