import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  /** Yalnız açılan panelin genişliğini özelleştirir; trigger genişliği değişmez (card #1344). */
  menuClassName?: string
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
  menuClassName,
}: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Panel bir portal ile document.body'ye render edilir; overflow-y-auto/overflow-hidden
  // taşıyan kaydırılabilir konteynerler (ör. WhatsApp Konuşmaları'ndaki yan panel) içinde
  // absolute konumlandırma menüyü kırpıyordu (card #1509).
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width?: number; minWidth?: number }>({ left: 0 })
  const selected = useMemo(() => options.find(option => option.value === value), [options, value])
  const normalizedSearch = search.trim().toLocaleLowerCase('tr')
  const visibleOptions = useMemo(() => (
    searchable && normalizedSearch
      ? options.filter(option => option.label.toLocaleLowerCase('tr').includes(normalizedSearch))
      : options
  ), [options, searchable, normalizedSearch])

  const updateMenuPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    // menuClassName'li paneller (ör. max-w-[20rem]) trigger'dan geniş olabilir; sağ kenardan
    // taşmasın diye olası genişlik varsayılarak left kırpılır (FilterableTh ile aynı desen).
    const assumedWidth = menuClassName ? 320 : rect.width
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - assumedWidth - 8))
    setMenuStyle({
      left,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      ...(menuClassName ? { minWidth: rect.width } : { width: rect.width }),
    })
  }, [openUp, menuClassName])

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
          if (open) {
            setSearch('')
          } else {
            updateMenuPosition()
          }
          setOpen(current => !current)
        }}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-slate-900' : 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open ? 'rotate-180' : '')} />
      </button>

      {open ? createPortal(
        <div
          ref={menuRef}
          // Portal artık document.body'ye render ediliyor; FilterableTh'nin col-filter-popover'ı
          // ile aynı üst katman kuralına uyar, modal içindeki kullanımlarda ModalBackdrop'ın
          // z-[200] katmanının üzerinde kalır (card #1509).
          className={cn('dropdown-menu-panel fixed z-[9999]', menuClassName)}
          style={{
            left: menuStyle.left,
            top: menuStyle.top,
            bottom: menuStyle.bottom,
            width: menuStyle.width,
            minWidth: menuStyle.minWidth,
          }}
        >
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
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
