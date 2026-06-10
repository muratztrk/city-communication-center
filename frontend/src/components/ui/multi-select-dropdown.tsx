import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  emptyText: string
  className?: string
  disabled?: boolean
}

export function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  className,
  disabled = false,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedSet = useMemo(() => new Set(value), [value])
  const selectedOptions = useMemo(() => options.filter(option => selectedSet.has(option.value)), [options, selectedSet])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const toggleOption = (optionValue: string) => {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter(item => item !== optionValue))
      return
    }

    onChange([...value, optionValue])
  }

  const clearSelection = () => {
    onChange([])
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'field-select flex min-h-10 w-full items-center justify-between gap-2 text-left',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="truncate text-slate-400">{placeholder}</span>
          ) : (
            <>
              {selectedOptions.slice(0, 2).map(option => (
                <span key={option.value} className="max-w-[11rem] truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {option.label}
                </span>
              ))}
              {selectedOptions.length > 2 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">+{selectedOptions.length - 2}</span>
              ) : null}
            </>
          )}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open ? 'rotate-180' : '')} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-40 mt-2 flex max-h-72 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold text-slate-500">{selectedOptions.length} / {options.length}</span>
            {selectedOptions.length > 0 ? (
              <button type="button" className="icon-btn size-7 text-slate-400 hover:text-red-600" onClick={clearSelection} aria-label="Clear selection">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          {/* Sadece personel listesi kayar; "Seç" butonu altta sabit kalır. */}
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm font-semibold text-slate-500">{emptyText}</div>
          ) : (
            <div className="grid flex-1 gap-1 overflow-y-auto">
              {options.map(option => {
                const checked = selectedSet.has(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors',
                      checked ? 'bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]' : 'text-slate-700 hover:bg-slate-50',
                    )}
                    onClick={() => toggleOption(option.value)}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {checked ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                )
              })}
            </div>
          )}
          {/* Sağ altta sabit: kırmızı "Çıkış" (seçim yapmadan kapat) + yeşil "Seç" butonu. */}
          <div className="mt-1 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              onClick={() => setOpen(false)}
            >
              Çıkış
            </button>
            <button
              type="button"
              className="rounded-lg bg-[color:var(--color-primary)] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              onClick={() => setOpen(false)}
            >
              Seç
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
