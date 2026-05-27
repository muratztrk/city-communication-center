import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface TablePaginationProps {
  totalCount: number
  pageSize: number
  currentPage: number
  onPageSizeChange: (size: number) => void
  onPageChange: (page: number) => void
}

export function TablePagination({ totalCount, pageSize, currentPage, onPageSizeChange, onPageChange }: TablePaginationProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className="table-pagination-bar">
      {/* Left: total + range */}
      <span className="table-pagination-info">
        <span className="font-semibold text-slate-700">{t('pagination.total', 'Toplam Sayı')}:</span>
        {' '}
        <span className="font-bold text-[color:var(--color-primary)]">{totalCount}</span>
        {totalCount > 0 && (
          <span className="text-slate-400">
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
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span className="text-slate-500">{t('pagination.perPage', 'Sayfa Başına Kayıt')}</span>
      </span>

      {/* Divider */}
      <span className="table-pagination-divider" />

      {/* Page navigation */}
      <span className="flex items-center gap-1">
        <button
          type="button"
          className="table-pagination-btn"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          title={t('pagination.first', 'İlk Sayfa')}
        >
          <ChevronsLeft className="size-3.5" />
        </button>
        <button
          type="button"
          className="table-pagination-btn"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title={t('pagination.prev', 'Önceki Sayfa')}
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <span className="table-pagination-pages">
          {buildPageNumbers(currentPage, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="table-pagination-ellipsis">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`table-pagination-page${p === currentPage ? ' active' : ''}`}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </button>
            ),
          )}
        </span>

        <button
          type="button"
          className="table-pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title={t('pagination.next', 'Sonraki Sayfa')}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          className="table-pagination-btn"
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

function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = []
  const delta = 1

  const range = [
    Math.max(2, current - delta),
    Math.min(total - 1, current + delta),
  ]

  pages.push(1)
  if (range[0] > 2) pages.push('…')
  for (let i = range[0]; i <= range[1]; i++) pages.push(i)
  if (range[1] < total - 1) pages.push('…')
  pages.push(total)

  return pages
}
