import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface TablePaginationProps {
  totalCount: number
  pageSize: number
  currentPage: number
  onPageSizeChange: (size: number) => void
  onPageChange: (page: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export function TablePagination({
  totalCount,
  pageSize,
  currentPage,
  onPageSizeChange,
  onPageChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: TablePaginationProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className={`table-pagination-bar${className ? ` ${className}` : ''}`}>
      {/* Left: total + range */}
      <span className="table-pagination-info">
        <span className="table-pagination-label font-semibold">{t('pagination.total', 'Toplam Sayı')}:</span>
        {' '}
        <span className="table-pagination-total-count font-bold">{totalCount}</span>
        {totalCount > 0 && (
          <span className="table-pagination-range">
            {' '}({from}–{to})
          </span>
        )}
      </span>

      {/* Divider */}
      <span className="table-pagination-divider" />

      {/* Page size selector */}
      <span className="table-pagination-info flex items-center gap-1.5">
        <select
          className="table-pagination-select"
          value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span className="table-pagination-label">{t('pagination.perPage', 'Sayfa Başına Kayıt')}</span>
      </span>

      {/* Divider */}
      <span className="table-pagination-divider" />

      {/* Page navigation */}
      <span className="flex items-center gap-1">
        <button
          type="button"
          className="table-pagination-btn table-pagination-control"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          title={t('pagination.first', 'İlk Sayfa')}
        >
          <ChevronsLeft className="size-3.5" />
        </button>
        <button
          type="button"
          className="table-pagination-btn table-pagination-control"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title={t('pagination.prev', 'Önceki Sayfa')}
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <span className="table-pagination-pages">
          {buildPageNumbers(currentPage, totalPages).map(p => (
            <button
              key={p}
              type="button"
              className={`table-pagination-page table-pagination-control${p === currentPage ? ' active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}
        </span>

        <button
          type="button"
          className="table-pagination-btn table-pagination-control"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title={t('pagination.next', 'Sonraki Sayfa')}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          className="table-pagination-btn table-pagination-control"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          title={t('pagination.last', 'Son Sayfa')}
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </span>
    </div>
  )
}

/** En fazla 3 ardışık sayfa numarası göster; uzun listelerde << >> ile gezinilir. */
function buildPageNumbers(current: number, total: number): number[] {
  if (total <= 3) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  let start = current - 1
  if (start < 1) start = 1
  if (start + 2 > total) start = total - 2
  return [start, start + 1, start + 2]
}
