import { CalendarClock } from 'lucide-react'

function getDueTone(
  value: string | null | undefined,
  completedAtUtc: string | null | undefined,
): 'normal' | 'warning' | 'danger' {
  if (!value) return 'normal'
  const dueTime = new Date(value).getTime()
  if (Number.isNaN(dueTime)) return 'normal'
  const completedTime = completedAtUtc ? new Date(completedAtUtc).getTime() : Number.NaN
  const comparisonTime = Number.isNaN(completedTime) ? Date.now() : completedTime
  const oneDay = 24 * 60 * 60 * 1000
  if (dueTime < comparisonTime) return 'danger'
  if (!completedAtUtc && dueTime - comparisonTime <= oneDay) return 'warning'
  return 'normal'
}

function formatDueDate(value: string | null | undefined, locale: string): string {
  // Son tarih girilmemiş talepler henüz onay beklediği için "Onay Bekleyen" gösterilir.
  if (!value) return locale.startsWith('tr') ? 'Onay Bekleyen' : 'Pending Approval'
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
  completedAtUtc?: string | null
}

// Son Tarih hücresi: bitiş tarihi bugünse sarı, geçmişse kırmızı buton tasarımı.
// Tüm gridview'larda aynı tasarımı kullanmak için ortak bileşen.
export function DueDatePill({ value, locale, completedAtUtc }: DueDatePillProps) {
  const tone = getDueTone(value, completedAtUtc)
  return (
    <span className={`due-date-pill${tone === 'warning' ? ' warning' : tone === 'danger' ? ' danger' : ''}`}>
      <CalendarClock className="size-3.5" />
      {formatDueDate(value, locale)}
    </span>
  )
}
