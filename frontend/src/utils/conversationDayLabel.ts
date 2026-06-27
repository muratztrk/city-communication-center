import type { TFunction } from 'i18next'

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatLongDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}

/** Gün ayracı: Bugün · 27 Haziran / Dün · 26 Haziran / tam tarih. */
export function formatConversationDayDivider(iso: string, locale: string, t: TFunction): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const datePart = formatLongDate(d, locale)

  if (sameDay(d, today)) {
    return `${t('common.today', 'Bugün')} · ${datePart}`
  }
  if (sameDay(d, yesterday)) {
    return `${t('common.yesterday', 'Dün')} · ${datePart}`
  }

  const includeYear = d.getFullYear() !== today.getFullYear()
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
}

export function conversationSameDay(leftIso: string, rightIso: string): boolean {
  return sameDay(new Date(leftIso), new Date(rightIso))
}

export { sameDay }
