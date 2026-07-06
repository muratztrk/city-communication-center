import { DateTimePicker } from './date-time-picker'

type ScopeChipDateRangeProps = {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  fromPlaceholder?: string
  toPlaceholder?: string
  forceDown?: boolean
  forceUp?: boolean
}

export function ScopeChipDateRange({
  from,
  to,
  onFromChange,
  onToChange,
  fromPlaceholder = 'Başlangıç tarihi',
  toPlaceholder = 'Bitiş tarihi',
  forceDown,
  forceUp,
}: ScopeChipDateRangeProps) {
  return (
    <div className="scope-chip-date-range">
      <DateTimePicker
        value={from}
        onChange={onFromChange}
        placeholder={fromPlaceholder}
        className="scope-chip-date"
        forceDown={forceDown}
        forceUp={forceUp}
      />
      <span className="scope-chip-date-separator" aria-hidden="true">-</span>
      <DateTimePicker
        value={to}
        onChange={onToChange}
        placeholder={toPlaceholder}
        className="scope-chip-date"
        forceDown={forceDown}
        forceUp={forceUp}
      />
    </div>
  )
}
