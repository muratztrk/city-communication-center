import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  /** Extra classes for the trigger button (e.g. to shrink the placeholder font). */
  triggerClassName?: string
  /** Extra classes for the portal menu panel (e.g. compact role menus — card #1739). */
  menuClassName?: string
  /** Open the options panel upward (e.g. when the control sits near the bottom of a modal). */
  openUp?: boolean
  disabled?: boolean
  /** Shows a "contains" search box as the first row of the options panel (card #1739). */
  searchable?: boolean
  searchPlaceholder?: string
}

export function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  className,
  triggerClassName,
  menuClassName,
  openUp = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Ara...',
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [adminSurfaceMenu, setAdminSurfaceMenu] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 })
  const selectedSet = useMemo(() => new Set(value), [value])
  const selectedOptions = useMemo(() => options.filter(option => selectedSet.has(option.value)), [options, selectedSet])
  const searchEnabled = searchable || options.length >= 7
  const normalizedSearch = search.trim().toLocaleLowerCase('tr')
  const visibleOptions = useMemo(() => (
    searchEnabled && normalizedSearch
      ? options.filter(option => option.label.toLocaleLowerCase('tr').includes(normalizedSearch))
      : options
  ), [options, searchEnabled, normalizedSearch])

  const updateMenuPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    // Trigger genişliğini kullan; tablo hücrelerinde min 220px zorlamak komşu sütuna taşıyordu (#1706).
    const width = Math.max(rect.width, 140)
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8))
    setMenuStyle({
      left,
      width,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    })
  }, [openUp])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      setSearch('')
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
    setSearch('')
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'field-select flex min-h-10 w-full items-center justify-between gap-2 text-left',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          triggerClassName,
        )}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (!open) {
            setAdminSurfaceMenu(Boolean(rootRef.current?.closest('.admin-surface-page')))
            updateMenuPosition()
          } else {
            setSearch('')
          }
          setOpen(current => !current)
        }}
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

      {open ? createPortal(
        <div
          ref={menuRef}
          // Tablo hücrelerinde absolute menü komşu sütunlara biniyordu (card #1706) —
          // SingleSelect ile aynı portal + fixed katman.
          className={cn(
            'dropdown-menu-panel fixed z-[9999] flex max-h-72 flex-col',
            adminSurfaceMenu && 'admin-surface-menu',
            menuClassName,
          )}
          style={{
            left: menuStyle.left,
            top: menuStyle.top,
            bottom: menuStyle.bottom,
            width: menuStyle.width,
          }}
        >
          {searchEnabled ? (
            <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
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
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
            <span className="text-xs font-semibold text-slate-500">{selectedOptions.length} / {options.length}</span>
            {selectedOptions.length > 0 ? (
              <button type="button" className="icon-btn size-7 cursor-pointer text-slate-400 hover:text-red-600" onClick={clearSelection} aria-label="Clear selection">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm font-semibold text-slate-500">{emptyText}</div>
          ) : (
            <div className="dropdown-menu-scroll min-h-0 flex-1 divide-y divide-slate-100">
              {visibleOptions.map(option => {
                const checked = selectedSet.has(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn('dropdown-menu-item', checked && 'dropdown-menu-item--selected')}
                    onClick={() => toggleOption(option.value)}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {checked ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-2 py-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--color-destructive)] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-[filter] hover:brightness-95"
              onClick={() => { setOpen(false); setSearch('') }}
            >
              Çıkış
            </button>
            <button
              type="button"
              className="rounded-lg bg-[color:var(--color-primary)] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              onClick={() => { setOpen(false); setSearch('') }}
            >
              Seç
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
