import { CalendarClock } from 'lucide-react'

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
}

// Tüm gridview'larda tarih bilgisinin önünde takvim ikonu göstermek için ortak hücre.
export function DateCell({ value, locale }: DateCellProps) {
  return (
    <span className="date-cell">
      <CalendarClock className="size-3.5 shrink-0 text-slate-400" />
      {formatDate(value, locale)}
    </span>
  )
}
