import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { MessageSquareText, Search, X as XIcon } from 'lucide-react'
import { api } from '../api/client'
import { DetailModalHeaderBrand } from '../components/branding/DetailModalHeaderBrand'
import { Button } from '../components/ui/button'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import { ChannelIcon } from '../components/ui/channel-icon'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { WhatsAppConversationModal } from '../components/WhatsAppConversationModal'
import { MyRequestDetailModal } from '../components/jobs/my-request-detail/MyRequestDetailModal'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { CitizenConversationDetail, CitizenConversationSummary, CitizenConversationTicket, JobDetail, SocialMessage } from '../types/platform'
import { getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { DetailModalTitle } from '../utils/detailModalTitle'
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
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketPageSize, setTicketPageSize] = useState(10)
  // Birim yöneticisi / personel detayındaki aynı WhatsAppConversationModal (card #1884).
  const [conversationModal, setConversationModal] = useState<{
    socialMessageId: string
    citizenHandle: string
    citizenPhone: string
  } | null>(null)

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
    setTicketPage(1)
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

  async function goToConversation(row: CitizenConversationSummary) {
    const openModal = (socialMessageId: string) => {
      setConversationModal({
        socialMessageId,
        citizenHandle: row.citizenName?.trim() || row.citizenPhone,
        citizenPhone: row.citizenPhone,
      })
    }

    if (row.latestSocialMessageId) {
      openModal(row.latestSocialMessageId)
      return
    }

    try {
      const detail = await api.getCitizenConversationDetail(row.citizenConversationId)
      const socialMessageId = detail.tickets?.[0]?.socialMessageId
        ?? detail.timeline?.find(entry => entry.socialMessageId)?.socialMessageId
      if (socialMessageId) {
        openModal(socialMessageId)
        return
      }
      setError(t('citizenDirectory.goToChatUnavailable', 'Bu kayıt için açılacak yazışma bulunamadı.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  // Job'a dönüşmemiş ama VT numarası taşıyan talepler de listelenir (card #1843).
  const ticketsWithJobs = (ticketModal?.detail?.tickets ?? []).filter(ticket => ticket.jobId || ticket.citizenRequestNumber != null)
  const ticketTotalCount = ticketsWithJobs.length
  const ticketSafePage = Math.min(ticketPage, Math.max(1, Math.ceil(ticketTotalCount / ticketPageSize) || 1))
  const pagedTickets = ticketsWithJobs.slice((ticketSafePage - 1) * ticketPageSize, ticketSafePage * ticketPageSize)

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
                  {t('citizenDirectory.columns.name', 'Vatandaş Adı')}
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
                <th className="text-center">{t('citizenDirectory.columns.sourceChannel', 'Talep Kanalı')}</th>
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
                  <td className="text-center">
                    {row.sourceChannel ? (
                      <span className="inline-flex h-8 w-full items-center justify-center gap-1.5 whitespace-nowrap">
                        <ChannelIcon channel={row.sourceChannel} className="size-4 shrink-0" />
                        <span className="text-sm font-semibold text-slate-800">{getSocialChannelLabel(t, row.sourceChannel)}</span>
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
                      {row.sourceChannel === 'Phone' ? (
                        <DisabledActionButton
                          type="button"
                          size="sm"
                          className="inline-flex items-center gap-1.5 !bg-sky-400 !text-white"
                          hoverTitle={t('citizenDirectory.goToChatUnavailable', 'Çağrı kanalında yazışma yoktur')}
                        >
                          <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t('citizenDirectory.goToChat', 'Yazışmaya Git')}
                        </DisabledActionButton>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="inline-flex items-center gap-1.5 !bg-sky-400 !text-white hover:!bg-sky-500"
                          onClick={() => void goToConversation(row)}
                        >
                          <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t('citizenDirectory.goToChat', 'Yazışmaya Git')}
                        </Button>
                      )}
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
            className="detail-modal-shell detail-modal-shell--my-request flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-6 py-3">
              <div className="detail-modal-header-title min-w-0">
                <div className="my-request-detail-header__title">
                  <DetailModalTitle title={t('citizenDirectory.ticketsTitle', 'Vatandaş Talep Bilgisi')} />
                </div>
                <p className="mt-0.5 text-sm font-medium text-slate-500">
                  {[ticketModal.conversation.citizenName, formatDirectoryPhone(ticketModal.conversation.citizenPhone)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <DetailModalHeaderBrand />
              <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTicketModal(null)}
                  className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <XIcon className="size-5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-auto px-4 pt-3">
                {ticketModal.loading ? <div className="loading">{t('common.loading')}</div> : null}
                {ticketModal.error ? <div className="error">{ticketModal.error}</div> : null}
                {!ticketModal.loading && !ticketModal.error ? (
                  ticketsWithJobs.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('citizenDirectory.noTickets', 'Bu vatandaşa ait talep bulunamadı.')}</p>
                  ) : (
                    <table className="data-table citizen-directory-tickets-table">
                      <thead>
                        <tr>
                          <th className="w-14 text-center">{t('common.number', 'Sıra')}</th>
                          <th>{t('jobs.columns.parentRequestNoShort', 'Talep No')}</th>
                          <th>{t('social.citizenRequestDateHeader', 'Talep Tarihi')}</th>
                          <th>{t('jobs.columns.title', 'Talep Başlığı')}</th>
                          <th>{t('jobs.columns.status', 'Durum')}</th>
                          <th>{t('users.department', 'Birim')}</th>
                          <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedTickets.map((ticket, index) => (
                          <tr key={ticket.socialMessageId}>
                            <td className="text-center text-xs font-bold tabular-nums text-slate-400">
                              {(ticketSafePage - 1) * ticketPageSize + index + 1}
                            </td>
                            <td className="table-number-cell font-mono text-xs text-slate-500">
                              <div className="table-number-cell__value inline-flex items-center gap-1.5">
                                {ticket.channel ? <ChannelIcon channel={ticket.channel} className="size-4 shrink-0" /> : null}
                                <span>{formatVt(ticket)}</span>
                              </div>
                            </td>
                            <td className="text-sm font-semibold text-slate-700">
                              {new Date(ticket.receivedAtUtc).toLocaleString(locale, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="font-semibold text-slate-800">{ticket.title?.trim() || '—'}</td>
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
              {!ticketModal.loading && !ticketModal.error && ticketsWithJobs.length > 0 ? (
                <TablePagination
                  totalCount={ticketTotalCount}
                  pageSize={ticketPageSize}
                  currentPage={ticketSafePage}
                  onPageSizeChange={size => { setTicketPageSize(size); setTicketPage(1) }}
                  onPageChange={setTicketPage}
                />
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
              title={t('citizenDirectory.ticketsTitle', 'Vatandaş Talep Bilgisi')}
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

      {conversationModal ? (
        <WhatsAppConversationModal
          socialMessageId={conversationModal.socialMessageId}
          citizenHandle={conversationModal.citizenHandle}
          citizenPhone={conversationModal.citizenPhone}
          onClose={() => setConversationModal(null)}
        />
      ) : null}
    </div>
  )
}
