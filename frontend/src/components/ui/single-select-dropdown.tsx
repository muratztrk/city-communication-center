import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
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
  /** Fixed panel width (px); defaults to trigger width when set without menuClassName (card #r459). */
  menuWidth?: number
  /** Seçiliyken chevron sonrası kırmızı X — temizler (#r465, Etiketler ile aynı). */
  clearable?: boolean
  /** false: menü portal yerine trigger altında absolute kalır (grid scroll — card #2296). */
  menuPortal?: boolean
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
  menuWidth,
  clearable = false,
  menuPortal = true,
}: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [adminSurfaceMenu, setAdminSurfaceMenu] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Panel bir portal ile document.body'ye render edilir; overflow-y-auto/overflow-hidden
  // taşıyan kaydırılabilir konteynerler (ör. WhatsApp Konuşmaları'ndaki yan panel) içinde
  // absolute konumlandırma menüyü kırpıyordu (card #1509).
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width?: number; minWidth?: number }>({ left: 0 })
  const selected = useMemo(() => options.find(option => option.value === value), [options, value])
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
    // menuWidth / menuClassName panelleri trigger'dan geniş olabilir; sağ kenardan taşmasın.
    const assumedWidth = menuWidth ?? (menuClassName ? 320 : rect.width)
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - assumedWidth - 8))
    setMenuStyle({
      left,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      ...(menuWidth
        ? { width: menuWidth }
        : menuClassName
          ? { minWidth: rect.width }
          : { width: rect.width }),
    })
  }, [openUp, menuClassName, menuWidth])

  useEffect(() => {
    if (!open || !menuPortal) return
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [open, menuPortal, updateMenuPosition])

  useEffect(() => {
    if (!open || menuPortal) return
    const scrollRoot = rootRef.current?.closest('.table-wrap')
    if (!scrollRoot) return
    const handleScroll = () => {
      setOpen(false)
      setSearch('')
    }
    scrollRoot.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollRoot.removeEventListener('scroll', handleScroll)
  }, [open, menuPortal])

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

  const menuPanelClassName = cn(
    'dropdown-menu-panel',
    menuPortal ? 'fixed z-[9999]' : 'absolute z-[120]',
    openUp && !menuPortal ? 'bottom-full mb-2' : !menuPortal ? 'top-full mt-2' : null,
    adminSurfaceMenu && 'admin-surface-menu',
    menuClassName,
  )

  const menuPanelStyle = menuPortal
    ? {
        left: menuStyle.left,
        top: menuStyle.top,
        bottom: menuStyle.bottom,
        width: menuStyle.width,
        minWidth: menuStyle.minWidth,
      }
    : {
        left: 0,
        ...(menuWidth
          ? { width: menuWidth }
          : menuClassName
            ? { minWidth: '100%' }
            : { width: '100%' }),
      }

  const menuPanel = open ? (
    <div
      ref={menuRef}
      className={menuPanelClassName}
      style={menuPanelStyle}
    >
      {searchEnabled ? (
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
                <span className="min-w-0 truncate" title={option.label}>{option.label}</span>
                {checked ? <Check className="size-4 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  ) : null

  return (
    <div ref={rootRef} className={cn('relative min-w-0 max-w-full', className)}>
      <button
        type="button"
        className={cn(
          'field-select group relative flex w-full min-w-0 items-center justify-between gap-1 text-left',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          triggerClassName,
        )}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setSearch('')
          } else {
            setAdminSurfaceMenu(Boolean(rootRef.current?.closest('.admin-surface-page')))
            updateMenuPosition()
          }
          setOpen(current => !current)
        }}
      >
        <span
          className={cn('min-w-0 flex-1 truncate', selected ? 'text-slate-900' : 'text-slate-400')}
          title={selected ? selected.label : undefined}
        >
          {selected ? selected.label : placeholder}
        </span>
        {selected ? (
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-[calc(100%+0.2rem)] z-[80] hidden max-w-[min(22rem,70vw)] break-words rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg group-hover:block"
          >
            {selected.label}
          </span>
        ) : null}
        <span className="flex shrink-0 items-center gap-0.5">
          <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open ? 'rotate-180' : '')} />
          {clearable && selected ? (
            <span
              role="button"
              tabIndex={0}
              onClick={event => {
                event.stopPropagation()
                event.preventDefault()
                setOpen(false)
                setSearch('')
                onChange('')
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation()
                  event.preventDefault()
                  setOpen(false)
                  setSearch('')
                  onChange('')
                }
              }}
              className="inline-flex size-5 items-center justify-center rounded text-red-600 hover:bg-red-50"
              title="Temizle"
              aria-label="Temizle"
            >
              <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            </span>
          ) : null}
        </span>
      </button>

      {menuPortal ? (menuPanel ? createPortal(menuPanel, document.body) : null) : menuPanel}
    </div>
  )
}
