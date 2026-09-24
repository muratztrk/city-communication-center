import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import { formatCitizenPhoneDisplay } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { looksLikePhone } from '../utils/phoneDisplay'

type ApprovalLogKind = 'all' | 'waitingReplied' | 'pendingApprovalCleared' | 'messageRelayed'

const KIND_FILTERS: Array<{ value: ApprovalLogKind; labelKey: string; fallback: string }> = [
  { value: 'all', labelKey: 'whatsappMessageApprovalLogs.kinds.all', fallback: 'Tümü' },
  { value: 'waitingReplied', labelKey: 'whatsappMessageApprovalLogs.kinds.waitingReplied', fallback: 'Yanıt Verildi Yapan' },
  { value: 'pendingApprovalCleared', labelKey: 'whatsappMessageApprovalLogs.kinds.pendingApprovalCleared', fallback: 'Mesaj Onayı/Cevabı Verildi Yapan' },
  { value: 'messageRelayed', labelKey: 'whatsappMessageApprovalLogs.kinds.messageRelayed', fallback: 'Mesajı İleten' },
]

const COLUMN_COUNT = 5

function actionLabel(action: string, t: (key: string, fallback: string) => string): string {
  if (action === 'WhatsAppWaitingReplied') {
    return t('whatsappMessageApprovalLogs.status.waitingReplied', 'Yanıt Verildi')
  }
  if (action === 'WhatsAppPendingApprovalCleared') {
    return t('whatsappMessageApprovalLogs.status.pendingApprovalCleared', 'Mesaj Onayı/Cevabı Verildi')
  }
  if (action === 'WhatsAppMessageRelayed') {
    return t('whatsappMessageApprovalLogs.status.messageRelayed', 'Mesajı İleten')
  }
  return action
}

export function WhatsAppMessageApprovalLogsPage() {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<ApprovalLogKind>('all')
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const { filters, setFilter, matchesFilters } = useColumnFilters()
  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const locale = getLocale(i18n.language)
  const logsQuery = useQuery({
    queryKey: ['whatsapp-message-approval-logs', kind],
    queryFn: () => api.getWhatsAppMessageApprovalLogs(kind),
  })

  const rows = useMemo(() => {
    const source = (logsQuery.data ?? []).map(row => {
      const name = row.citizenName?.trim() || '—'
      const phone = row.citizenPhone?.trim()
      const phoneText = phone && looksLikePhone(phone) ? formatCitizenPhoneDisplay(phone) : (phone || '')
      return {
        ...row,
        citizenNameText: name,
        citizenPhoneText: phoneText,
        statusLabel: actionLabel(row.action, t),
        actorText: row.actorDisplayName?.trim() || '—',
        dateText: new Date(row.eventTimeUtc).toLocaleString(locale),
      }
    })
    const filtered = source.filter(row => matchesFilters(row, (key, item) => {
      if (key === 'citizen') return `${item.citizenNameText} ${item.citizenPhoneText}`
      if (key === 'status') return item.statusLabel
      if (key === 'actor') return item.actorText
      if (key === 'actedAt') return item.dateText
      return ''
    }))
    if (!sortKey) return filtered
    return sortItems(filtered)
  }, [locale, logsQuery.data, matchesFilters, sortItems, sortKey, t])

  const totalCount = rows.length
  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(totalCount / pageSize) || 1))
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleFilter = (key: string, value: string) => {
    setFilter(key, value)
    setCurrentPage(1)
  }

  const handleSort = (key: string) => {
    toggleSort(key)
    setCurrentPage(1)
  }

  return (
    <div className="page-stack desktop-page-shell">
      <section className="section-card p-0">
        <div className="sticky-page-header !rounded-b-none border-0 shadow-none">
          <div className="page-header-row">
            <div className="space-y-1">
              <h1 className="page-title">{t('nav.whatsappMessageApprovalLogs', 'Whatsapp Mesaj Logları')}</h1>
              <p className="page-subtitle">
                {t('whatsappMessageApprovalLogs.subtitle', 'Yanıt Verildi, Mesaj Onayı/Cevabı Verildi ve Mesajı İleten yapan operatör kullanıcılar görüntülenir.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <nav className="scope-chips" aria-label={t('whatsappMessageApprovalLogs.filterLabel', 'Mesaj log filtreleri')}>
        {KIND_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip scope-chip--pending${kind === filter.value ? ' active' : ''}`}
            onClick={() => { setKind(filter.value); setCurrentPage(1) }}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
      </nav>

      {logsQuery.isError ? <div className="error">{t('common.error')}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table data-table--zebra">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh
                  filterKey="citizen"
                  filterValue={filters['citizen'] ?? ''}
                  onFilter={handleFilter}
                  sortKey="citizenNameText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  <span className="inline-flex flex-col gap-1 leading-tight">
                    <span>{t('whatsappMessageApprovalLogs.columns.citizenName', 'Vatandaş Adı')}</span>
                    <span className="text-[0.9em] font-bold leading-tight">{t('whatsappMessageApprovalLogs.columns.citizenPhone', 'Telefon No')}</span>
                  </span>
                </FilterableTh>
                <FilterableTh
                  filterKey="status"
                  filterValue={filters['status'] ?? ''}
                  onFilter={handleFilter}
                  sortKey="statusLabel"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('whatsappMessageApprovalLogs.columns.status', 'Durum')}
                </FilterableTh>
                <FilterableTh
                  filterKey="actor"
                  filterValue={filters['actor'] ?? ''}
                  onFilter={handleFilter}
                  sortKey="actorText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('whatsappMessageApprovalLogs.columns.actor', 'İşlemi Yapan')}
                </FilterableTh>
                <FilterableTh
                  filterKey="actedAt"
                  filterValue={filters['actedAt'] ?? ''}
                  onFilter={handleFilter}
                  sortKey="eventTimeUtc"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('whatsappMessageApprovalLogs.columns.actedAt', 'İşlem Tarihi')}
                </FilterableTh>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading ? (
                <TableEmptyStateRows columnCount={COLUMN_COUNT} message={t('common.loading')} />
              ) : pagedRows.length === 0 ? (
                <TableEmptyStateRows columnCount={COLUMN_COUNT} message={t('whatsappMessageApprovalLogs.empty', 'Kayıt yok.')} />
              ) : pagedRows.map((row, index) => (
                <tr key={row.auditLogId}>
                  <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(safePage - 1) * pageSize + index + 1}</td>
                  <td>
                    <span className="block">{row.citizenNameText}</span>
                    {row.citizenPhoneText ? <span className="block text-slate-600">{row.citizenPhoneText}</span> : null}
                  </td>
                  <td>{row.statusLabel}</td>
                  <td>{row.actorText}</td>
                  <td>{row.dateText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={totalCount}
          pageSize={pageSize}
          currentPage={safePage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1) }}
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  )
}
