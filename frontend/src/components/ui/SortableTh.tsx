import { ArrowDownUp, ChevronDown, ChevronUp } from 'lucide-react'
import type { SortDir } from '../../hooks/useSortable'

interface SortableThProps {
  sortKey: string
  currentSortKey: string | null
  sortDir: SortDir
  onSort: (key: string) => void
  children: React.ReactNode
  className?: string
}

export function SortableTh({ sortKey, currentSortKey, sortDir, onSort, children, className }: SortableThProps) {
  const isActive = currentSortKey === sortKey
  return (
    <th
      className={`sortable-th${isActive ? ' sort-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="sortable-th-content">
        {children}
        {isActive
          ? sortDir === 'asc'
            ? <ChevronUp className="sort-icon size-3" />
            : <ChevronDown className="sort-icon size-3" />
          : <ArrowDownUp className="sort-icon size-3" />}
      </span>
    </th>
  )
}
