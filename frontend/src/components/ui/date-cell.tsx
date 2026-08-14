import { CalendarClock } from 'lucide-react'
import { cn } from '../../lib/cn'

function formatDate(value: string | null | undefined, locale: string, emptyLabel?: string): string {
  if (!value) return emptyLabel ?? (locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified')
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return emptyLabel ?? (locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified')
  return time.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type DateCellProps = {
  value: string | null | undefined
  locale: string
  highlight?: boolean
  tone?: 'default' | 'success' | 'danger'
  emptyLabel?: string
}

// Tüm gridview'larda tarih bilgisinin önünde takvim ikonu göstermek için ortak hücre.
export function DateCell({ value, locale, highlight = false, tone = 'default', emptyLabel }: DateCellProps) {
  const label = formatDate(value, locale, emptyLabel)
  const pending = /onay bekleyen|pending approval/i.test(label)
  const toneClass = pending
    ? 'font-semibold text-sky-500'
    : tone === 'success'
      ? 'font-semibold text-emerald-600'
      : tone === 'danger'
        ? 'font-semibold text-red-600'
        : highlight
          ? 'font-semibold text-orange-500'
          : ''
  // Default ikon rengi DueDatePill ile aynı (inherit); ton/highlight override eder (#6a6cbf0e).
  const iconClass = pending
    ? 'text-sky-500'
    : tone === 'success'
      ? 'text-emerald-500'
      : tone === 'danger'
        ? 'text-red-500'
        : highlight
          ? 'text-orange-400'
          : undefined

  return (
    <span className={cn('date-cell', toneClass)}>
      <CalendarClock className={cn('size-3.5 shrink-0', iconClass)} />
      {label}
    </span>
  )
}
