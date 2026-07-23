import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { MessageSquareText, Search, X } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { MyRequestDetailModal } from '../components/jobs/my-request-detail/MyRequestDetailModal'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { CitizenConversationDetail, CitizenConversationSummary, CitizenConversationTicket, JobDetail, SocialMessage } from '../types/platform'
import { getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { getLocale, getSocialChannelLabel } from '../utils/localization'
import { formatDirectoryPhone } from '../utils/phoneDisplay'

type DirectoryRow = CitizenConversationSummary & {
  displayName: string
}

const SEARCH_KEYS = ['displayName', 'citizenPhone', 'neighborhood', 'street', 'openAddress'] as const

function formatVt(ticket: CitizenConversationTicket): string {
  if (ticket.citizenRequestNumber != null && ticket.citizenRequestNumberYear != null) {
    return `VT-${ticket.citizenRequestNumberYear}-${ticket.citizenRequestNumber}`
  }
  if (ticket.jobNumber != null && ticket.jobNumberYear != null) {
    return `T-${ticket.jobNumberYear}-${ticket.jobNumber}`
  }
  return '—'
}

function getDetailStatusClass(status: string): string {
  if (status === 'Completed') return 'text-emerald-600'
  if (status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested') return 'text-red-600'
  if (status === 'Active' || status === 'PendingOwnerApproval' || status === 'PendingExternalApproval') return 'text-[#f97316]'
  return 'text-slate-900'
}

function getDetailStatusLabel(t: TFunction, detail: JobDetail): string {
  if (isCitizenRequestJob(detail)) {
    return getCitizenRequestStatusLabel(t, detail)
  }
  return t(`enum.jobStatus.${detail.status}`, { defaultValue: detail.status })
}

/**
 * Vatandaş Bilgi Listesi — Reporter/Operator (card #1836).
 * Operatörlerin kaydettiği vatandaş profilleri + talepler / yazışmaya git.
 */
export function CitizenDirectoryPage() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()

  const [rows, setRows] = useState<CitizenConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [ticketModal, setTicketModal] = useState<{
    conversation: CitizenConversationSummary
    detail: CitizenConversationDetail | null
    loading: boolean
    error: string | null
  } | null>(null)

  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const [jobDetailLoading, setJobDetailLoading] = useState(false)
  const [jobDetailError, setJobDetailError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void api.getCitizenConversations()
      .then(data => {
        if (!cancelled) {
          setRows(data)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [t])

  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, clearFilters, matchesFilters } = useColumnFilters()

  const viewRows: DirectoryRow[] = useMemo(
    () => rows.map(row => ({
      ...row,
      displayName: row.citizenName?.trim() || row.citizenPhone || '—',
    })),
    [rows],
  )

  const scopedRows = useMemo(() => {
    const searchNormalized = searchText.trim().toLocaleLowerCase('tr')
    const filtered = viewRows.filter(row => {
      if (searchNormalized) {
        const haystack = SEARCH_KEYS.map(key => String(row[key] ?? '')).join(' ').toLocaleLowerCase('tr')
        if (!haystack.includes(searchNormalized)) return false
      }
      return matchesFilters(row)
    })
    return sortItems(filtered)
  }, [matchesFilters, searchText, sortItems, viewRows])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchText, filters, sortKey, sortDir, pageSize])

  const totalCount = scopedRows.length
  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(totalCount / pageSize) || 1))
  const pageRows = scopedRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function openTickets(row: CitizenConversationSummary) {
    setTicketModal({ conversation: row, detail: null, loading: true, error: null })
    try {
      const detail = await api.getCitizenConversationDetail(row.citizenConversationId)
      setTicketModal({ conversation: row, detail, loading: false, error: null })
    } catch (err) {
      setTicketModal({
        conversation: row,
        detail: null,
        loading: false,
        error: err instanceof Error ? err.message : t('common.error'),
      })
    }
  }

  async function openJobDetail(jobId: string, socialMessageId?: string) {
    setJobDetailLoading(true)
    setJobDetailError(null)
    setJobDetail(null)
    setCitizenSourceMessage(null)
    try {
      const [detail, sourceMessage] = await Promise.all([
        api.getJobById(jobId),
        socialMessageId
          ? api.getSocialMessageById(socialMessageId).catch(() => null)
          : Promise.resolve(null),
      ])
      setJobDetail(detail)
      setCitizenSourceMessage(sourceMessage)
    } catch (err) {
      setJobDetailError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setJobDetailLoading(false)
    }
  }

  function closeJobDetail() {
    setJobDetail(null)
    setCitizenSourceMessage(null)
    setJobDetailError(null)
    setJobDetailLoading(false)
  }

  function goToConversation(phone: string) {
    navigate(`/whatsapp?phone=${encodeURIComponent(phone)}`)
  }

  // Job'a dönüşmemiş ama VT numarası taşıyan talepler de listelenir (card #1843).
  const ticketsWithJobs = (ticketModal?.detail?.tickets ?? []).filter(ticket => ticket.jobId || ticket.citizenRequestNumber != null)

  return (
    <div className="page-stack desktop-page-shell shrink-0">
      <section className="section-card p-0">
        <div
          className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] rounded-t-[var(--radius-xl)] lg:rounded-t-[0.85rem]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-1">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/70">
              {t('citizenDirectory.eyebrow', 'Vatandaş kayıtları')}
            </div>
            <h1 className="page-title !text-white">{t('nav.citizenDirectory', 'Vatandaş Bilgi Listesi')}</h1>
            <p className="max-w-3xl text-sm leading-6 text-white/82">
              {t('citizenDirectory.subtitle', 'Operatörlerin kaydettiği vatandaş bilgileri ve talepleri.')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 sm:px-5">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
              placeholder={t('citizenDirectory.search', 'İsim, numara veya adres ara…')}
              className="field-input w-full pl-8 text-sm"
            />
          </div>
          {(searchText || Object.values(filters).some(Boolean)) ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => { setSearchText(''); clearFilters() }}>
              {t('common.reset', 'Temizle')}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="section-card overflow-hidden p-0">
        {error ? <div className="error m-4">{error}</div> : null}
        <div className="table-scroll-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-14 text-center">{t('common.number', 'Sıra')}</th>
                <FilterableTh
                  filterKey="displayName"
                  filterValue={filters.displayName ?? ''}
                  onFilter={setFilter}
                  sortKey="displayName"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                >
                  {t('citizenDirectory.columns.name', 'Vatandaş İsmi')}
                </FilterableTh>
                <FilterableTh
                  filterKey="citizenPhone"
                  filterValue={filters.citizenPhone ?? ''}
                  onFilter={setFilter}
                  sortKey="citizenPhone"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                >
                  {t('citizenDirectory.columns.phone', 'Numara')}
                </FilterableTh>
                <th>{t('citizenDirectory.columns.sourceChannel', 'Talep Kanalı')}</th>
                <FilterableTh
                  filterKey="neighborhood"
                  filterValue={filters.neighborhood ?? ''}
                  onFilter={setFilter}
                  sortKey="neighborhood"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                >
                  {t('citizenDirectory.columns.neighborhood', 'Mahalle')}
                </FilterableTh>
                <FilterableTh
                  filterKey="street"
                  filterValue={filters.street ?? ''}
                  onFilter={setFilter}
                  sortKey="street"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                >
                  {t('citizenDirectory.columns.street', 'Cadde / Sokak / Bulvar')}
                </FilterableTh>
                <FilterableTh
                  filterKey="openAddress"
                  filterValue={filters.openAddress ?? ''}
                  onFilter={setFilter}
                  sortKey="openAddress"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                >
                  {t('citizenDirectory.columns.openAddress', 'Açık Adres')}
                </FilterableTh>
                <th className="text-center">{t('common.actions', 'İşlemler')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableEmptyStateRows columnCount={8} message={t('common.loading')} />
              ) : pageRows.length === 0 ? (
                <TableEmptyStateRows columnCount={8} message={t('citizenDirectory.empty', 'Kayıtlı vatandaş bulunamadı.')} />
              ) : pageRows.map((row, index) => (
                <tr key={row.citizenConversationId}>
                  <td className="text-center text-xs font-bold tabular-nums text-slate-400">
                    {(safePage - 1) * pageSize + index + 1}
                  </td>
                  <td>
                    <span className="font-semibold text-slate-800">{row.displayName}</span>
                  </td>
                  <td className="font-semibold text-slate-800 tabular-nums">{formatDirectoryPhone(row.citizenPhone) || '—'}</td>
                  <td>
                    {row.sourceChannel ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <ChannelIcon channel={row.sourceChannel} className="size-4 shrink-0" />
                        {getSocialChannelLabel(t, row.sourceChannel)}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{row.neighborhood?.trim() || '—'}</td>
                  <td>{row.street?.trim() || '—'}</td>
                  <td>{row.openAddress?.trim() || '—'}</td>
                  <td className="actions-cell">
                    <div className="request-actions justify-center gap-1.5">
                      <Button type="button" size="sm" variant="secondary" onClick={() => void openTickets(row)}>
                        {t('jobs.actions.details', 'Detaylar')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="inline-flex items-center gap-1.5 !bg-sky-400 !text-white hover:!bg-sky-500"
                        onClick={() => goToConversation(row.citizenPhone)}
                      >
                        <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('citizenDirectory.goToChat', 'Yazışmaya Git')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={totalCount}
          pageSize={pageSize}
          currentPage={safePage}
          onPageSizeChange={setPageSize}
          onPageChange={setCurrentPage}
        />
      </section>

      {ticketModal ? createPortal(
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setTicketModal(null)}
        >
          <div
            className="detail-modal-shell flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {t('citizenDirectory.ticketsTitle', 'Vatandaş Talepleri')}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {[ticketModal.conversation.citizenName, formatDirectoryPhone(ticketModal.conversation.citizenPhone)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setTicketModal(null)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {ticketModal.loading ? <div className="loading">{t('common.loading')}</div> : null}
              {ticketModal.error ? <div className="error">{ticketModal.error}</div> : null}
              {!ticketModal.loading && !ticketModal.error ? (
                ticketsWithJobs.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('citizenDirectory.noTickets', 'Bu vatandaşa ait talep bulunamadı.')}</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-14 text-center">{t('common.number', 'Sıra')}</th>
                        <th>{t('jobs.columns.parentRequestNoShort', 'Talep No')}</th>
                        <th>{t('jobs.columns.status', 'Durum')}</th>
                        <th>{t('users.department', 'Birim')}</th>
                        <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketsWithJobs.map((ticket, index) => (
                        <tr key={ticket.socialMessageId}>
                          <td className="text-center text-xs font-bold tabular-nums text-slate-400">{index + 1}</td>
                          <td className="font-mono text-xs">{formatVt(ticket)}</td>
                          <td>{ticket.jobStatus ? t(`enum.jobStatus.${ticket.jobStatus}`, { defaultValue: ticket.jobStatus }) : '—'}</td>
                          <td>{ticket.departmentName ?? '—'}</td>
                          <td className="actions-cell">
                            <div className="request-actions justify-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={jobDetailLoading || !ticket.jobId}
                                onClick={() => ticket.jobId ? void openJobDetail(ticket.jobId, ticket.socialMessageId) : undefined}
                              >
                                {t('jobs.actions.details', 'Detaylar')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {(jobDetail || jobDetailLoading || jobDetailError) ? createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {jobDetail ? (
            <MyRequestDetailModal
              detail={jobDetail}
              title={t('nav.myRequests', 'Taleplerim')}
              locale={locale}
              detailLoading={jobDetailLoading}
              citizenSourceMessage={citizenSourceMessage}
              detailStatusClass={getDetailStatusClass(jobDetail.status)}
              statusContent={getDetailStatusLabel(t, jobDetail)}
              canChangeDueDate={false}
              detailDueDateEdit={null}
              onOpenDueDateEdit={() => undefined}
              onCloseDueDateEdit={() => undefined}
              onDueDateChange={() => undefined}
              onDueDateSave={() => undefined}
              onClose={closeJobDetail}
              onPrint={() => window.print()}
              showManagerNoteColumn={false}
              canEditManagerNote={false}
              canManageCoordination={false}
              managerNoteDraft=""
              managerNoteEditing={false}
              managerNoteSaved={false}
              managerNoteSaving={false}
              onManagerNoteDraftChange={() => undefined}
              onManagerNoteEditStart={() => undefined}
              onManagerNoteSave={() => undefined}
              onManagerNoteDeleteConfirm={() => undefined}
              setConfirmDialog={() => undefined}
              canEditJobAttachments={false}
              showAttachmentLockNotice={false}
              attachmentLockText=""
              attachmentUploading={false}
              onAttachmentUpload={async () => undefined}
              onAttachmentDelete={async () => undefined}
              onDownloadTaskAttachment={() => undefined}
            />
          ) : (
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
              {jobDetailLoading ? <div className="loading">{t('common.loading')}</div> : null}
              {jobDetailError ? <div className="error">{jobDetailError}</div> : null}
            </div>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
