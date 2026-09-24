import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { WhatsAppConversationModal } from '../components/WhatsAppConversationModal'
import { DateCell } from '../components/ui/date-cell'
import { FilterableTh } from '../components/ui/FilterableTh'
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import { formatCitizenPhoneDisplay } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { looksLikePhone } from '../utils/phoneDisplay'

type ApprovalLogKind = 'all' | 'waitingReplied' | 'pendingApprovalCleared' | 'messageRelayed' | 'reviewRequested'

const KIND_FILTERS: Array<{ value: ApprovalLogKind; labelKey: string; fallback: string; chipClass: string }> = [
  { value: 'all', labelKey: 'whatsappMessageApprovalLogs.kinds.all', fallback: 'Tümü', chipClass: 'scope-chip--all' },
  { value: 'waitingReplied', labelKey: 'whatsappMessageApprovalLogs.kinds.waitingReplied', fallback: 'Yanıt Verildi Yapan', chipClass: 'scope-chip--in-progress' },
  { value: 'pendingApprovalCleared', labelKey: 'whatsappMessageApprovalLogs.kinds.pendingApprovalCleared', fallback: 'Mesaj Onayı/Cevabı Verildi Yapan', chipClass: 'scope-chip--overdue' },
  { value: 'messageRelayed', labelKey: 'whatsappMessageApprovalLogs.kinds.messageRelayed', fallback: 'Mesajı İleten', chipClass: 'scope-chip--completed' },
  { value: 'reviewRequested', labelKey: 'whatsappMessageApprovalLogs.kinds.reviewRequested', fallback: 'Mesaj İncelemeye Gönderen', chipClass: 'scope-chip--rejected' },
]

const COLUMN_COUNT = 7

function statusFrameClass(action: string): string {
  const height = 'py-1.5'
  if (action === 'WhatsAppMessageRelayed') return `bg-emerald-600 !text-white ring-emerald-700 ${height}`
  if (action === 'WhatsAppReviewRequested') return `bg-red-600 !text-white ring-red-700 ${height}`
  if (action === 'WhatsAppWaitingReplied') return `bg-sky-500 !text-white ring-sky-600 ${height}`
  if (action === 'WhatsAppPendingApprovalCleared') return `bg-orange-500 !text-white ring-orange-600 ${height}`
  return height
}

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
  if (action === 'WhatsAppReviewRequested') {
    return t('whatsappMessageApprovalLogs.status.reviewRequested', 'Mesaj İncelemeye Gönderen')
  }
  return action
}

export function WhatsAppMessageApprovalLogsPage() {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<ApprovalLogKind>('all')
  const [relayConversation, setRelayConversation] = useState<{
    socialMessageId: string
    citizenHandle: string
    citizenPhone?: string | null
    citizenName?: string | null
    entryId: string
  } | null>(null)
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
        destinationText: row.destinationName?.trim() || '—',
        reviewerText: row.reviewerDisplayName?.trim() || '—',
        dateText: new Date(row.eventTimeUtc).toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    })
    const filtered = source.filter(row => matchesFilters(row, (key, item) => {
      if (key === 'citizen') return `${item.citizenNameText} ${item.citizenPhoneText}`
      if (key === 'status') return item.statusLabel
      if (key === 'actor') return item.actorText
      if (key === 'destination') return item.destinationText
      if (key === 'reviewer') return item.reviewerText
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

  const selectedFilter = KIND_FILTERS.find(filter => filter.value === kind) ?? KIND_FILTERS[0]

  return (
    <div className="page-stack desktop-page-shell">
      <section className="section-card p-0">
        <div className="sticky-page-header !rounded-b-none border-0 shadow-none">
          <div className="page-header-row">
            <div className="space-y-1">
              <div className="page-kicker">{t(selectedFilter.labelKey, selectedFilter.fallback)}</div>
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
            className={`scope-chip ${filter.chipClass}${kind === filter.value ? ' active' : ''}`}
            onClick={() => { setKind(filter.value); setCurrentPage(1) }}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
      </nav>

      {logsQuery.isError ? <div className="error">{t('common.error')}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table data-table--zebra whatsapp-message-logs-table">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh
                  className="whatsapp-log-citizen-col"
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
                  className="whatsapp-log-status-col"
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
                  className="whatsapp-log-actor-col"
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
                  filterKey="destination"
                  filterValue={filters['destination'] ?? ''}
                  onFilter={handleFilter}
                  sortKey="destinationText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('whatsappMessageApprovalLogs.columns.destination', 'Gittiği Yer')}
                </FilterableTh>
                <FilterableTh
                  filterKey="reviewer"
                  filterValue={filters['reviewer'] ?? ''}
                  onFilter={handleFilter}
                  sortKey="reviewerText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('whatsappMessageApprovalLogs.columns.reviewer', 'İnceleyen Personel')}
                </FilterableTh>
                <FilterableTh
                  className="whatsapp-log-date-col"
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
                  <td>
                    {row.action === 'WhatsAppMessageRelayed' && row.socialMessageId ? (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer border-0 bg-transparent p-0"
                        onClick={() => setRelayConversation({
                          socialMessageId: row.socialMessageId!,
                          citizenHandle: row.citizenPhone?.trim() || row.citizenNameText || 'whatsapp',
                          citizenPhone: row.citizenPhone,
                          citizenName: row.citizenName,
                          entryId: row.auditLogId,
                        })}
                      >
                        <StatusPill className={statusFrameClass(row.action)}>{row.statusLabel}</StatusPill>
                      </button>
                    ) : (
                      <StatusPill className={statusFrameClass(row.action)}>{row.statusLabel}</StatusPill>
                    )}
                  </td>
                  <td>{row.actorText}</td>
                  <td>{row.destinationText}</td>
                  <td>{row.reviewerText}</td>
                  <td><DateCell value={row.eventTimeUtc} locale={locale} /></td>
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
      {relayConversation ? (
        <WhatsAppConversationModal
          socialMessageId={relayConversation.socialMessageId}
          citizenHandle={relayConversation.citizenHandle}
          citizenPhone={relayConversation.citizenPhone}
          citizenName={relayConversation.citizenName}
          highlightEntryId={relayConversation.entryId}
          onClose={() => setRelayConversation(null)}
        />
      ) : null}
    </div>
  )
}
