import { PenLine, Search, Send, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateCitizenMessageApprovals, invalidateJobs } from '../api/cacheInvalidation'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { ChannelIcon } from '../components/ui/channel-icon'
import { ModalBackdrop } from '../components/ui/modal-backdrop'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { DateCell } from '../components/ui/date-cell'
import { FilterableTh } from '../components/ui/FilterableTh'
import { StatusPill } from '../components/ui/status-pill'
import { TablePagination } from '../components/ui/table-pagination'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { Toast } from '../components/ui/toast'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { CitizenMessageApprovalRow } from '../types/platform'
import { getCitizenRequestStatusLabel, formatCitizenRequestNumber, formatCitizenPhoneDisplay } from '../utils/citizenRequests'
import { getJobStatusTone, getStatusPillClass, getLocale } from '../utils/localization'
import { JobsPage } from './JobsPage'

type ApprovalScope = 'toSend' | 'sent' | 'all'

const SCOPE_FILTERS: Array<{ value: ApprovalScope; labelKey: string; fallback: string; chipClass: string; apiScope: 'to-send' | 'sent' | 'all' }> = [
  { value: 'toSend', labelKey: 'citizenMessageApproval.scope.toSend', fallback: 'Mesaj Onayı Bekleyen', chipClass: 'scope-chip--pending', apiScope: 'to-send' },
  { value: 'sent', labelKey: 'citizenMessageApproval.scope.sent', fallback: 'Mesaj Gönderimi Onaylanan', chipClass: 'scope-chip--completed', apiScope: 'sent' },
  { value: 'all', labelKey: 'citizenMessageApproval.scope.all', fallback: 'Tümü', chipClass: 'scope-chip--all', apiScope: 'all' },
]

const NOTE_MAX_LENGTH = 100

function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return ''
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CitizenMessageApprovalPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = getLocale(i18n.language)
  const scopeParam = searchParams.get('view')
  const scope: ApprovalScope = scopeParam === 'sent' ? 'sent' : scopeParam === 'all' ? 'all' : 'toSend'

  const [rows, setRows] = useState<CitizenMessageApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ jobId: string; note: string; saving: boolean } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })

  const { sortKey, sortDir, toggleSort: toggleSortRaw, sortItems } = useSortable()
  const { filters, setFilter, clearFilters, matchesFilters } = useColumnFilters()

  const apiScope = useMemo(() => SCOPE_FILTERS.find(filter => filter.value === scope)?.apiScope ?? 'to-send', [scope])

  const loadApprovals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await api.getCitizenMessageApprovals(apiScope))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [apiScope, t])

  useEffect(() => {
    void loadApprovals()
  }, [loadApprovals])

  const getColumnValue = useCallback((key: string, row: CitizenMessageApprovalRow): string => {
    if (key === 'requestNo') {
      return formatCitizenRequestNumber(
        { citizenRequestNumber: row.citizenRequestNumber, citizenRequestNumberYear: row.citizenRequestNumberYear, receivedAtUtc: row.requestDateUtc },
        locale,
      )
    }
    if (key === 'requestDateUtc') return formatDateTime(row.requestDateUtc, locale)
    if (key === 'citizenPhone') return formatCitizenPhoneDisplay(row.citizenPhone)
    if (key === 'status') return getCitizenRequestStatusLabel(t, { status: row.status })
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }, [locale, t])

  const visibleRows = useMemo(() => {
    let result = rows
    if (filterFrom || filterTo) {
      result = result.filter(row => {
        const date = row.requestDateUtc.slice(0, 10)
        if (filterFrom && date < filterFrom.slice(0, 10)) return false
        if (filterTo && date > filterTo.slice(0, 10)) return false
        return true
      })
    }
    if (searchText.trim()) {
      const query = searchText.toLocaleLowerCase('tr')
      const searchKeys = ['requestNo', 'requestDateUtc', 'citizenName', 'citizenPhone', 'title', 'status', 'note'] as const
      result = result.filter(row =>
        searchKeys.some(key => getColumnValue(key, row).toLocaleLowerCase('tr').includes(query)),
      )
    }
    return result
  }, [rows, filterFrom, filterTo, searchText, getColumnValue])

  const columnFilteredRows = useMemo(
    () => visibleRows.filter(row => matchesFilters(row, getColumnValue)),
    [visibleRows, matchesFilters, getColumnValue],
  )

  const sortedRows = useMemo(() => sortItems(columnFilteredRows), [columnFilteredRows, sortItems])

  const paginatedRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedRows, currentPage, pageSize],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [scope, pageSize, filterFrom, filterTo, searchText, filters, sortedRows.length])

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPage(1)
      clearFilters()
    })
  }, [scope, clearFilters])

  const toggleSort = (key: string) => {
    toggleSortRaw(key)
    setCurrentPage(1)
  }

  const setScope = (nextScope: ApprovalScope) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (nextScope === 'toSend') {
        next.delete('view')
      } else {
        next.set('view', nextScope)
      }
      return next
    }, { replace: true })
  }

  const emptyMessage = scope === 'toSend'
    ? t('citizenMessageApproval.emptyToSend', 'Vatandaşa mesaj gönderilecek talep bulunmamaktadır.')
    : scope === 'sent'
      ? t('citizenMessageApproval.emptySent', 'Vatandaşa mesaj gönderilecek talep bulunmamaktadır.')
      : t('citizenMessageApproval.emptyAll', 'Vatandaşa mesaj gönderilecek talep bulunmamaktadır.')

  const openEditNote = (row: CitizenMessageApprovalRow) => {
    setNoteModal({ jobId: row.jobId, note: row.note ?? '', saving: false })
  }

  const handleSaveNote = async () => {
    if (!noteModal || !noteModal.note.trim()) return
    const savedNote = noteModal.note.trim()
    const jobId = noteModal.jobId
    setNoteModal(current => (current ? { ...current, saving: true } : current))
    try {
      await api.editCitizenMessageApprovalNote(jobId, savedNote)
      // Grid anında güncellensin; popup kapansın (card #2063).
      setRows(current => current.map(row => (row.jobId === jobId ? { ...row, note: savedNote } : row)))
      invalidateJobs(queryClient, jobId)
      invalidateCitizenMessageApprovals(queryClient)
      showToast(t('citizenMessageApproval.noteSaved', 'Not kaydedildi.'))
      setNoteModal(null)
      await loadApprovals()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
      setNoteModal(current => (current ? { ...current, saving: false } : current))
    }
  }

  const handleRelease = (row: CitizenMessageApprovalRow) => {
    if (!row.note?.trim()) {
      showToast(t('citizenMessageApproval.releaseNoteMissing', 'Göndermeden önce lütfen "Notu Düzenle" ile bir not girin.'), 'error')
      return
    }
    setConfirmDialog({
      title: t('citizenMessageApproval.releaseTitle', 'Mesajı Gönder'),
      titleDivider: true,
      wide: true,
      message: t(
        'citizenMessageApproval.releaseConfirm',
        'Mesajı göndermeyi onayladığınızda, kurumunuz operatörüne, vatandaşımıza iletilmek üzere talebin Tamamlanma/İptal durumu ve notu gönderilecektir.',
      ),
      confirmLabel: t('citizenMessageApproval.actions.release', 'Mesajı Gönder'),
      cancelLabel: t('common.dismiss', 'Vazgeç'),
      variant: 'success',
      onConfirm: () => {
        void (async () => {
          try {
            await api.releaseCitizenMessageApproval(row.jobId)
            invalidateJobs(queryClient, row.jobId)
            invalidateCitizenMessageApprovals(queryClient)
            showToast(t('citizenMessageApproval.released', 'Mesaj gönderime hazırlandı.'))
            // Mesaj Gönderimi Onaylanan sekmesine geç (card #2058).
            setScope('sent')
          } catch (err) {
            showToast(err instanceof Error ? err.message : t('common.error'), 'error')
          }
        })()
      },
    })
  }

  const handleChangeStatusToInProgress = (jobId: string) => {
    setConfirmDialog({
      title: t('citizenMessageApproval.changeStatusTitle', 'Talep Durumunu Değiştir'),
      titleDivider: true,
      message: (
        <>
          {t('citizenMessageApproval.changeStatusConfirmLead', 'Talep durumunu')}{' '}
          <span className="font-semibold text-orange-500">
            &quot;{t('citizenMessageApproval.changeStatusInProgress', 'Yapılmakta')}&quot;
          </span>
          {' '}{t('citizenMessageApproval.changeStatusConfirmTrail', 'olarak değiştirmeyi onaylıyor musunuz?')}
        </>
      ),
      confirmLabel: t('common.yes', 'Evet'),
      cancelLabel: t('common.dismiss', 'Vazgeç'),
      variant: 'primary',
      onConfirm: () => {
        void (async () => {
          try {
            await api.reopenCitizenMessageJob(jobId)
            invalidateJobs(queryClient, jobId)
            invalidateCitizenMessageApprovals(queryClient)
            showToast(t('citizenMessageApproval.statusChanged', 'Talep durumu Yapılmakta olarak güncellendi.'))
            setDetailJobId(null)
            await loadApprovals()
          } catch (err) {
            showToast(err instanceof Error ? err.message : t('common.error'), 'error')
          }
        })()
      },
    })
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('citizenMessageApproval.kicker', 'Vatandaş Talepleri')}</div>
            <h1 className="page-title">{t('citizenMessageApproval.title', 'Vatandaşa Gönderilecek Mesaj Onayı')}</h1>
            <p className="page-subtitle">
              {t(
                'citizenMessageApproval.subtitle',
                'Mesajı göndermeyi onayladığınızda, kurumunuz operatörüne, vatandaşımıza iletilmek üzere talebin Tamamlanma/İptal durumu ve notu gönderilecektir.',
              )}
            </p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <div className="scope-chips-filters">
              <div className="scope-chip-search-wrap">
                <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  className="scope-chip-search-input"
                  placeholder={t('common.search', 'Ara...')}
                  value={searchText}
                  onChange={event => setSearchText(event.target.value)}
                />
                {searchText ? (
                  <button type="button" onClick={() => setSearchText('')} className="scope-chip-search-clear shrink-0 font-extrabold transition-colors" aria-label={t('common.clear', 'Temizle')}>
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                ) : null}
              </div>
              <ScopeChipDateRange
                from={filterFrom}
                to={filterTo}
                onFromChange={setFilterFrom}
                onToChange={setFilterTo}
                fromPlaceholder={t('filters.startDate', 'Başlangıç tarihi')}
                toPlaceholder={t('filters.endDate', 'Bitiş tarihi')}
                forceDown
              />
            </div>
          </div>
        </div>
      </header>

      <nav className="scope-chips" aria-label={t('citizenMessageApproval.title', 'Vatandaşa Gönderilecek Mesaj Onayı')}>
        {SCOPE_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip ${filter.chipClass}${filter.value === scope ? ' active' : ''}`}
            onClick={() => setScope(filter.value)}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
      </nav>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table jobs-table data-table--zebra citizen-message-approval-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <FilterableTh filterKey="requestNo" filterValue={filters['requestNo'] ?? ''} onFilter={setFilter} sortKey="citizenRequestNumber" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('citizenMessageApproval.columns.requestNo', 'Vatandaş Talep No')}</FilterableTh>
                  <FilterableTh filterKey="requestDateUtc" filterValue={filters['requestDateUtc'] ?? ''} onFilter={setFilter} sortKey="requestDateUtc" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('citizenMessageApproval.columns.requestDate', 'Talep Tarihi')}</FilterableTh>
                  <FilterableTh filterKey="citizenName" filterValue={filters['citizenName'] ?? ''} onFilter={setFilter} sortKey="citizenName" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
                    <span className="inline-flex flex-col leading-tight">
                      <span>{t('citizenMessageApproval.columns.citizenName', 'Vatandaş Adı')}</span>
                      <span className="text-[0.78em] font-semibold leading-tight">{t('citizenMessageApproval.columns.citizenPhone', 'Vatandaş Telefon No')}</span>
                    </span>
                  </FilterableTh>
                  <FilterableTh filterKey="title" filterValue={filters['title'] ?? ''} onFilter={setFilter} sortKey="title" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('citizenMessageApproval.columns.title', 'Başlık')}</FilterableTh>
                  <FilterableTh filterKey="status" filterValue={filters['status'] ?? ''} onFilter={setFilter} sortKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('citizenMessageApproval.columns.status', 'Durum')}</FilterableTh>
                  <FilterableTh filterKey="note" filterValue={filters['note'] ?? ''} onFilter={setFilter} sortKey="note" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('citizenMessageApproval.columns.note', 'Talep Tamamlama/İptal Notu')}</FilterableTh>
                  <th className="text-center">{t('citizenMessageApproval.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, index) => (
                  <tr key={row.jobId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className="table-number-cell__value inline-flex flex-wrap items-center gap-1.5">
                        {row.channel ? <ChannelIcon channel={row.channel} className="size-4 shrink-0" /> : null}
                        {formatCitizenRequestNumber({ citizenRequestNumber: row.citizenRequestNumber, citizenRequestNumberYear: row.citizenRequestNumberYear, receivedAtUtc: row.requestDateUtc }, locale)}
                      </div>
                    </td>
                    <td><DateCell value={row.requestDateUtc} locale={locale} /></td>
                    <td>
                      <div className="font-semibold">{row.citizenName ?? '—'}</div>
                      <div className="text-xs text-slate-400">{formatCitizenPhoneDisplay(row.citizenPhone)}</div>
                    </td>
                    <td className="max-w-xs truncate" title={row.title}>{row.title}</td>
                    <td>
                      <StatusPill className={getStatusPillClass(getJobStatusTone({ status: row.status, dueDateUtc: row.dueDateUtc }))}>
                        {getCitizenRequestStatusLabel(t, { status: row.status })}
                      </StatusPill>
                    </td>
                    <td className="max-w-xs truncate" title={row.note ?? ''}>{row.note || <span className="text-slate-400">—</span>}</td>
                    <td className="actions-cell">
                      <div className="citizen-message-approval-actions flex justify-center gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setDetailJobId(row.jobId)}>
                          {t('citizenMessageApproval.actions.details', 'Detaylar')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 bg-orange-500 text-white hover:bg-orange-600"
                          onClick={() => openEditNote(row)}
                        >
                          <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t('citizenMessageApproval.actions.editNote', 'Notu Düzenle')}
                        </Button>
                        {!row.releasedAtUtc ? (
                          <Button type="button" size="sm" variant="success" className="gap-1.5" onClick={() => handleRelease(row)}>
                            <Send className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            {t('citizenMessageApproval.actions.release', 'Mesajı Gönder')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 ? (
                  <TableEmptyStateRows columnCount={8} message={emptyMessage} />
                ) : null}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalCount={sortedRows.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageSizeChange={setPageSize}
            onPageChange={setCurrentPage}
          />
        </section>
      )}

      {noteModal ? createPortal(
        <ModalBackdrop>
          <div className="relative w-full max-w-md rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setNoteModal(null)}
              aria-label={t('common.close', 'Kapat')}
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <X className="size-4" />
            </button>
            <h2 className="mb-3 border-b border-slate-200 pb-2 text-lg font-bold text-slate-950">{t('citizenMessageApproval.editNoteTitle', 'Notu Düzenle')}</h2>
            <p className="mb-3 text-sm text-slate-700">{t('citizenMessageApproval.editNoteMessage', 'Vatandaşa gönderilecek notu düzenleyin. Not ifadesi zorunludur.')}</p>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-[color:var(--color-primary)] focus:outline-none"
              rows={4}
              maxLength={NOTE_MAX_LENGTH}
              placeholder={t('citizenMessageApproval.editNotePlaceholder', 'Tamamlama/İptal notu...')}
              value={noteModal.note}
              onChange={event => setNoteModal(current => (current ? { ...current, note: event.target.value } : current))}
            />
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>{!noteModal.note.trim() ? t('citizenMessageApproval.noteRequired', 'Not zorunludur.') : ''}</span>
              <span>{noteModal.note.length}/{NOTE_MAX_LENGTH}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNoteModal(null)}>
                {t('common.dismiss', 'Vazgeç')}
              </Button>
              <Button
                type="button"
                variant="success"
                disabled={noteModal.saving || !noteModal.note.trim()}
                onClick={() => void handleSaveNote()}
              >
                {t('common.save', 'Kaydet')}
              </Button>
            </div>
          </div>
        </ModalBackdrop>,
        document.body,
      ) : null}

      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {detailJobId && (
        <JobsPage
          detailOnly
          notificationJobId={detailJobId}
          detailContextOverride="incoming"
          onNotificationDetailClose={() => setDetailJobId(null)}
          onChangeStatusToInProgress={handleChangeStatusToInProgress}
        />
      )}
    </div>
  )
}
