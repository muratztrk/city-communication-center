import type { TFunction } from 'i18next'

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function formatConversationListTime(dateStr: string, locale: string, t: TFunction, options?: { compact?: boolean }): string {
  const date = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(now.getDate() - 1)

  if (sameDay(date, yesterday)) {
    return t('common.yesterday', 'Dün')
  }

  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (sameDay(date, now)) {
    if (diffMin < 1) return locale.startsWith('tr') ? 'şimdi' : 'now'
    if (diffMin < 60) {
      return options?.compact
        ? (locale.startsWith('tr') ? `${diffMin} dk` : `${diffMin}m`)
        : (locale.startsWith('tr') ? `${diffMin} dk önce` : `${diffMin}m ago`)
    }
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) {
      return options?.compact
        ? (locale.startsWith('tr') ? `${diffH} sa` : `${diffH}h`)
        : (locale.startsWith('tr') ? `${diffH} sa önce` : `${diffH}h ago`)
    }
    return t('common.today', 'Bugün')
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
  if (options?.compact && diffDays >= 1 && diffDays < 7) {
    return locale.startsWith('tr') ? `${diffDays} gün` : `${diffDays}d`
  }

  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}
