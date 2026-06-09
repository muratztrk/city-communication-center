import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

interface DateTimePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  className?: string
  /** Takvimi her zaman aşağıya doğru aç (yukarı kaydırma yapma). */
  forceDown?: boolean
}

const DROPDOWN_WIDTH = 288  // w-72
const DROPDOWN_HEIGHT = 390 // approximate max height

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const DAYS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDisplay(value: string): string {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  if (!datePart) return ''
  const [year, month, day] = datePart.split('-')
  const base = `${day}.${month}.${year}`
  if (!timePart) return base
  const [h, m] = timePart.split(':')
  return `${base} ${h}:${m}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

// Returns 0=Monday … 6=Sunday
function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

function todayDateStr() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function DateTimePicker({ value, onChange, placeholder = 'Tarih ve saat seçin', id, className, forceDown = false }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ date: '', time: '' })
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const handleOpen = () => {
    const now = new Date()
    if (value) {
      const [datePart = '', timePart = ''] = value.split('T')
      setDraft({ date: datePart, time: timePart.slice(0, 5) })
      if (datePart) {
        const [y, m] = datePart.split('-').map(Number)
        setViewYear(y)
        setViewMonth(m - 1)
      }
    } else {
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`
      setDraft({ date, time })
      setViewYear(now.getFullYear())
      setViewMonth(now.getMonth())
    }
    setOpen(true)
  }

  // Recalculate position after the dropdown renders
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const MARGIN = 8

    const style: React.CSSProperties = { position: 'fixed', zIndex: 200, width: DROPDOWN_WIDTH }

    // Horizontal: prefer left-aligned; flip right if it would overflow
    if (rect.left + DROPDOWN_WIDTH + MARGIN > vw) {
      style.right = vw - rect.right
    } else {
      style.left = rect.left
    }

    // Vertical: prefer below; flip above only if it would overflow and not forced down
    if (!forceDown && rect.bottom + DROPDOWN_HEIGHT + MARGIN > vh) {
      style.bottom = vh - rect.top + 4
    } else {
      style.top = rect.bottom + 4
    }

    setDropdownStyle(style)
  }, [open, viewMonth, viewYear, forceDown])

  const handleConfirm = () => {
    if (draft.date) {
      onChange(`${draft.date}T${draft.time || '00:00'}`)
    }
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setDraft({ date: '', time: '' })
    setOpen(false)
  }

  const handleDayClick = (day: number) => {
    const date = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    setDraft(d => ({ ...d, date }))
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const display = formatDisplay(value)
  const today = todayDateStr()

  // Build calendar cells (null = empty leading/trailing)
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        onClick={handleOpen}
        className={cn(
          'field-input flex w-full items-center gap-2 text-left',
          !display && 'text-[color:var(--color-muted-foreground)]',
        )}
      >
        <Calendar className="size-4 shrink-0 opacity-60" />
        <span className="flex-1 truncate">{display || placeholder}</span>
      </button>

      {open ? (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >

          {/* Coloured header */}
          <div className="bg-[color:var(--color-primary)] px-4 pb-3 pt-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/60">
              Tarih Seç
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-base font-extrabold text-white">
                {MONTHS_TR[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/20"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="p-3">
            {/* Weekday labels */}
            <div className="mb-1 grid grid-cols-7">
              {DAYS_TR.map(d => (
                <div key={d} className="py-1 text-center text-[11px] font-bold text-slate-400">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                const isSelected = draft.date === dateStr
                const isToday = dateStr === today
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'mx-auto flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                      isSelected && 'bg-[color:var(--color-primary)] font-bold text-white shadow-sm',
                      !isSelected && isToday && 'border border-[color:var(--color-primary)] font-bold text-[color:var(--color-primary)]',
                      !isSelected && !isToday && 'text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

          </div>

          {/* Footer: Temizle | Saat input | Seç — hepsi aynı satırda */}
          <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
            {value ? (
              <button
                type="button"
                onClick={handleClear}
                className="shrink-0 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600"
              >
                Temizle
              </button>
            ) : <span className="shrink-0" />}

            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
              <Clock className="size-3.5 shrink-0 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Saat</span>
              <input
                type="time"
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none"
                value={draft.time}
                onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
              />
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!draft.date}
              className="shrink-0 rounded-lg bg-[color:var(--color-primary)] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Seç
            </button>
          </div>

        </div>
      ) : null}
    </div>
  )
}
