import { CalendarClock } from 'lucide-react'
import { cn } from '../../lib/cn'

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
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
}

// Tüm gridview'larda tarih bilgisinin önünde takvim ikonu göstermek için ortak hücre.
export function DateCell({ value, locale, highlight = false, tone = 'default' }: DateCellProps) {
  const toneClass = tone === 'success'
    ? 'font-semibold text-emerald-600'
    : tone === 'danger'
      ? 'font-semibold text-red-600'
      : highlight
        ? 'font-semibold text-orange-500'
        : ''
  const iconClass = tone === 'success'
    ? 'text-emerald-500'
    : tone === 'danger'
      ? 'text-red-500'
      : highlight
        ? 'text-orange-400'
        : 'text-slate-400'

  return (
    <span className={cn('date-cell', toneClass)}>
      <CalendarClock className={cn('size-3.5 shrink-0', iconClass)} />
      {formatDate(value, locale)}
    </span>
  )
}
