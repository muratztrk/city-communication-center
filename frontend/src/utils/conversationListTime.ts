import type { TFunction } from 'i18next'

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function formatConversationListTime(dateStr: string, locale: string, t: TFunction): string {
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
    if (diffMin < 60) return locale.startsWith('tr') ? `${diffMin}d önce` : `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return locale.startsWith('tr') ? `${diffH}s önce` : `${diffH}h ago`
    return t('common.today', 'Bugün')
  }

  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}
