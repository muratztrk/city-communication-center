import { CalendarClock } from 'lucide-react'

function getDueTone(value: string | null | undefined): 'normal' | 'warning' | 'danger' {
  if (!value) return 'normal'
  const dueTime = new Date(value).getTime()
  if (Number.isNaN(dueTime)) return 'normal'
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  if (dueTime < now) return 'danger'
  if (dueTime - now <= oneDay) return 'warning'
  return 'normal'
}

function formatDueDate(value: string | null | undefined, locale: string): string {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type DueDatePillProps = {
  value: string | null | undefined
  locale: string
}

// Son Tarih hücresi: bitiş tarihi bugünse sarı, geçmişse kırmızı buton tasarımı.
// Tüm gridview'larda aynı tasarımı kullanmak için ortak bileşen.
export function DueDatePill({ value, locale }: DueDatePillProps) {
  const tone = getDueTone(value)
  return (
    <span className={`due-date-pill${tone === 'warning' ? ' warning' : tone === 'danger' ? ' danger' : ''}`}>
      <CalendarClock className="size-3.5" />
      {formatDueDate(value, locale)}
    </span>
  )
}
