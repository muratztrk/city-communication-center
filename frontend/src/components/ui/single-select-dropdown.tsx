import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SingleSelectOption {
  value: string
  label: string
}

interface SingleSelectDropdownProps {
  options: SingleSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  emptyText?: string
  className?: string
  triggerClassName?: string
  /** Open the options panel upward (e.g. when the control sits near the bottom of a modal). */
  openUp?: boolean
  disabled?: boolean
}

export function SingleSelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  emptyText = 'Seçenek yok',
  className,
  triggerClassName,
  openUp = false,
  disabled = false,
}: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = useMemo(() => options.find(option => option.value === value), [options, value])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'field-select flex w-full items-center justify-between gap-2 text-left',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          triggerClassName,
        )}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-slate-900' : 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open ? 'rotate-180' : '')} />
      </button>

      {open ? (
        <div className={cn(
          'absolute left-0 right-0 z-40 flex max-h-72 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-xl',
          openUp ? 'bottom-full mb-2' : 'mt-2',
        )}>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm font-semibold text-slate-500">{emptyText}</div>
          ) : (
            <div className="grid flex-1 gap-1 overflow-y-auto">
              {options.map(option => {
                const checked = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors',
                      checked ? 'bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]' : 'text-slate-700 hover:bg-slate-50',
                    )}
                    onClick={() => { onChange(option.value); setOpen(false) }}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {checked ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
