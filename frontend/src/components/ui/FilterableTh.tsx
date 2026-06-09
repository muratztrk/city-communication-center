import { ArrowDownUp, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SortDir } from '../../hooks/useSortable'
import { Button } from './button'

interface FilterableThProps {
  /** Column filter key — used as argument to onFilter */
  filterKey: string
  /** Current active filter value for this column ('' = no filter) */
  filterValue?: string
  /** Called with (filterKey, value). Empty value clears the filter. */
  onFilter: (key: string, value: string) => void

  // ── optional sort ──────────────────────────────────────────────────────────
  sortKey?: string
  currentSortKey?: string | null
  sortDir?: SortDir
  onSort?: (key: string) => void

  children: React.ReactNode
  className?: string
}

export function FilterableTh({
  filterKey,
  filterValue = '',
  onFilter,
  sortKey,
  currentSortKey,
  sortDir,
  onSort,
  children,
  className,
}: FilterableThProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(filterValue)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isFiltered = Boolean(filterValue)
  const isSortActive = sortKey !== undefined && currentSortKey === sortKey

  // Keep local input in sync when external value changes
  useEffect(() => { setInputValue(filterValue) }, [filterValue])

  // Auto-focus input when popover opens
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const openPopover = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      // Try to keep popover inside viewport horizontally
      const left = Math.min(rect.left, window.innerWidth - 240)
      setPopoverPos({ top: rect.bottom + 6, left })
    }
    setInputValue(filterValue)
    setOpen(v => !v)
  }

  const applyFilter = () => {
    onFilter(filterKey, inputValue)
    setOpen(false)
  }

  const clearFilter = () => {
    setInputValue('')
    onFilter(filterKey, '')
    setOpen(false)
  }

  return (
    <th
      className={[
        'filterable-th',
        isSortActive ? 'sort-active' : '',
        isFiltered ? 'filterable-th--filtered' : '',
        sortKey ? 'sortable-th' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={sortKey ? { cursor: 'pointer' } : undefined}
      onClick={sortKey && onSort ? () => onSort(sortKey) : undefined}
    >
      <span className="filterable-th-content">
        <span className="filterable-th-label">
          {children}
          {sortKey && (
            isSortActive
              ? sortDir === 'asc'
                ? <ChevronUp className="sort-icon size-3" />
                : <ChevronDown className="sort-icon size-3" />
              : <ArrowDownUp className="sort-icon size-3" />
          )}
        </span>

        <button
          ref={btnRef}
          type="button"
          className={`col-filter-btn${isFiltered ? ' col-filter-btn--active' : ''}`}
          onClick={openPopover}
          title={isFiltered ? `Filtre: ${filterValue}` : 'Filtrele'}
          aria-label="Sütun filtresi"
        >
          <MoreVertical className="size-3" />
        </button>
      </span>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="col-filter-popover"
          style={{ top: popoverPos.top, left: popoverPos.left }}
          onClick={e => e.stopPropagation()}
        >
          <p className="col-filter-popover-title">Aranacak İfade</p>
          <input
            ref={inputRef}
            type="text"
            className="col-filter-input"
            placeholder="İçerik..."
            value={inputValue}
            onChange={e => {
              // Tarih sütunlarında (…Utc) yalnızca rakam ve . : boşluk karakterlerine izin ver.
              const raw = e.target.value
              setInputValue(filterKey.endsWith('Utc') ? raw.replace(/[^0-9.: ]/g, '') : raw)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') applyFilter()
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <div className="col-filter-actions">
            <Button type="button" size="sm" onClick={applyFilter}>Filtrele</Button>
            {isFiltered
              ? <Button type="button" size="sm" variant="secondary" onClick={clearFilter}>Temizle</Button>
              : <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>Çıkış</Button>
            }
          </div>
        </div>,
        document.body,
      )}
    </th>
  )
}
