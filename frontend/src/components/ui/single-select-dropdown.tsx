import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
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
  menuScrollClassName?: string
  /** Open the options panel upward (e.g. when the control sits near the bottom of a modal). */
  openUp?: boolean
  disabled?: boolean
  /** Shows a "contains" search box as the first row of the options panel. */
  searchable?: boolean
  searchPlaceholder?: string
}

export function SingleSelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  emptyText = 'Seçenek yok',
  className,
  triggerClassName,
  menuScrollClassName,
  openUp = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Ara...',
}: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = useMemo(() => options.find(option => option.value === value), [options, value])
  const normalizedSearch = search.trim().toLocaleLowerCase('tr')
  const visibleOptions = useMemo(() => (
    searchable && normalizedSearch
      ? options.filter(option => option.label.toLocaleLowerCase('tr').includes(normalizedSearch))
      : options
  ), [options, searchable, normalizedSearch])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch('')
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
        onClick={() => {
          if (open) setSearch('')
          setOpen(current => !current)
        }}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-slate-900' : 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open ? 'rotate-180' : '')} />
      </button>

      {open ? (
        <div className={cn(
          'dropdown-menu-panel absolute left-0 right-0 z-40',
          openUp ? 'bottom-full mb-2' : 'mt-2',
        )}>
          {searchable ? (
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
              <Search className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={event => setSearch(event.target.value)}
                onClick={event => event.stopPropagation()}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          ) : null}
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm font-semibold text-slate-500">{emptyText}</div>
          ) : (
            <div className={cn('dropdown-menu-scroll divide-y divide-slate-100', menuScrollClassName)}>
              {visibleOptions.map(option => {
                const checked = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn('dropdown-menu-item', checked && 'dropdown-menu-item--selected')}
                    onClick={() => { onChange(option.value); setOpen(false); setSearch('') }}
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
