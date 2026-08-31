import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { FileText, MessageSquareText, PenLine, Search } from 'lucide-react'
import { api } from '../api/client'
import { CitizenDirectoryTicketsModal } from '../components/citizen-directory/CitizenDirectoryTicketsModal'
import { Button } from '../components/ui/button'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import { EmptyCell } from '../components/ui/EmptyCell'
import { FilterableTh } from '../components/ui/FilterableTh'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { WhatsAppConversationModal } from '../components/WhatsAppConversationModal'
import { MyRequestDetailModal } from '../components/jobs/my-request-detail/MyRequestDetailModal'
import { getNeighborhoodsForDistrict } from '../data/izmir-locations'
import { useAuth } from '../context/AuthContext'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useIzmirCbsStreetNoCatalog } from '../hooks/useIzmirCbsStreetNoCatalog'
import { useMunicipalityDistrictId } from '../hooks/useMunicipalityDistrictId'
import { useSortable } from '../hooks/useSortable'
import type { CitizenConversationDetail, CitizenConversationSummary, JobDetail, SocialMessage } from '../types/platform'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH } from '../utils/addressLimits'
import { getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { stringListSelectOptions } from '../utils/formDropdownOptions'
import { getLocale } from '../utils/localization'
import { directoryCitizenDisplayName, formatDirectoryPhone } from '../utils/phoneDisplay'
import { isSearchQueryActive } from '../utils/requestSearch'
import { normalizeTitleCaseField } from '../utils/textNormalization'
import { printJobDetail } from './JobsPage'

type DirectoryRow = CitizenConversationSummary & {
  displayName: string
}

type AddressDraft = {
  neighborhood: string
  street: string
  streetNo: string
  openAddress: string
}

const SEARCH_KEYS = ['displayName', 'citizenPhone', 'neighborhood', 'street', 'streetNo', 'openAddress'] as const
const ADDRESS_TRIGGER_CLASS = 'field-input !h-8 !min-h-8 !py-0 text-[13px]'
const ADDRESS_MENU_CLASS = 'citizen-directory-address-menu'

function rowAddressDraft(row: CitizenConversationSummary): AddressDraft {
  return {
    neighborhood: row.neighborhood?.trim() ?? '',
    street: row.street?.trim() ?? '',
    streetNo: row.streetNo?.trim() ?? '',
    openAddress: row.openAddress?.trim() ?? '',
  }
}

function DirectoryAddressEditCells({
  draft,
  onChange,
}: {
  draft: AddressDraft
  onChange: (patch: Partial<AddressDraft>) => void
}) {
  const { t } = useTranslation()
  const districtId = useMunicipalityDistrictId()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(districtId), [districtId])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const hasNeighborhood = draft.neighborhood.trim().length > 0
  const hasStreet = draft.street.trim().length > 0
  const { streetOptions, doorNoOptions, streetsLoading, doorsLoading } = useIzmirCbsStreetNoCatalog(
    districtId,
    draft.neighborhood,
    draft.street,
    draft.streetNo,
  )

  return (
    <>
      <td className="min-w-[8.5rem]">
        <SingleSelectDropdown
          searchable
          clearable
          options={neighborhoodOptions}
          value={draft.neighborhood}
          onChange={neighborhood => onChange(neighborhood
            ? { neighborhood, street: '', streetNo: '' }
            : { neighborhood: '', street: '', streetNo: '', openAddress: '' })}
          placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
          searchPlaceholder={t('common.search', 'Ara...')}
          matchTriggerWidth
          triggerClassName={ADDRESS_TRIGGER_CLASS}
          menuClassName={ADDRESS_MENU_CLASS}
          menuScrollClassName={ADDRESS_MENU_CLASS}
        />
      </td>
      <td className="min-w-[9rem]">
        <SingleSelectDropdown
          searchable
          clearable
          options={streetOptions}
          value={draft.street}
          onChange={street => onChange({ street, streetNo: '' })}
          placeholder={t('address.streetSelectPlaceholder', 'Cadde seçiniz')}
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasNeighborhood || streetsLoading}
          matchTriggerWidth
          triggerClassName={ADDRESS_TRIGGER_CLASS}
          menuClassName={ADDRESS_MENU_CLASS}
          menuScrollClassName={ADDRESS_MENU_CLASS}
        />
      </td>
      <td className="min-w-[6.5rem]">
        <SingleSelectDropdown
          searchable
          clearable
          options={doorNoOptions}
          value={draft.streetNo}
          onChange={streetNo => onChange({ streetNo })}
          placeholder={t('address.streetNoSelectPlaceholder', 'No seçiniz')}
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasStreet || doorsLoading}
          matchTriggerWidth
          triggerClassName={ADDRESS_TRIGGER_CLASS}
          menuClassName={ADDRESS_MENU_CLASS}
          menuScrollClassName={ADDRESS_MENU_CLASS}
        />
      </td>
      <td className="min-w-[8rem]">
        <input
          type="text"
          className="field-input w-full text-xs"
          maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
          value={draft.openAddress}
          onChange={event => onChange({ openAddress: event.target.value })}
          placeholder={t('address.directionsLabel', 'Adres Tarifi')}
        />
      </td>
    </>
  )
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
  const { user } = useAuth()
  const isReporter = user?.role === 'Reporter'
  const canEditDirectoryAddress = !isReporter
  const chatButtonClass = isReporter
    ? 'inline-flex items-center gap-1.5 !bg-teal-700 !text-white hover:!bg-teal-800'
    : 'inline-flex items-center gap-1.5 !bg-sky-400 !text-white hover:!bg-sky-500'

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
  // Birim yöneticisi / personel detayındaki aynı WhatsAppConversationModal (card #1884).
  const [conversationModal, setConversationModal] = useState<{
    socialMessageId: string
    citizenHandle: string
    citizenPhone: string
    citizenName: string | null
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addressDraft, setAddressDraft] = useState<AddressDraft | null>(null)
  const [addressSaving, setAddressSaving] = useState(false)

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
      displayName: directoryCitizenDisplayName(row.citizenName, row.citizenPhone),
    })),
    [rows],
  )

  const scopedRows = useMemo(() => {
    const filtered = viewRows.filter(row => {
      if (isSearchQueryActive(searchText)) {
        const searchNormalized = searchText.trim().toLocaleLowerCase('tr')
        const haystack = SEARCH_KEYS.map(key => String(row[key] ?? '')).join(' ').toLocaleLowerCase('tr')
        if (!haystack.includes(searchNormalized)) return false
      }
      return matchesFilters(row)
    })
    return sortItems(filtered)
  }, [matchesFilters, searchText, sortItems, viewRows])

  const searchActiveKey = isSearchQueryActive(searchText) ? searchText.trim() : ''

  useEffect(() => {
    setCurrentPage(1)
  }, [searchActiveKey, filters, sortKey, sortDir, pageSize])

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

  async function goToConversation(row: CitizenConversationSummary) {
    const openModal = (socialMessageId: string) => {
      setConversationModal({
        socialMessageId,
        citizenHandle: row.citizenName?.trim() || row.citizenPhone,
        citizenPhone: row.citizenPhone,
        citizenName: row.citizenName?.trim() || null,
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

  function startAddressEdit(row: CitizenConversationSummary) {
    setEditingId(row.citizenConversationId)
    setAddressDraft(rowAddressDraft(row))
    setError(null)
  }

  function cancelAddressEdit() {
    setEditingId(null)
    setAddressDraft(null)
    setAddressSaving(false)
  }

  async function saveAddressEdit(row: CitizenConversationSummary) {
    if (!addressDraft || addressSaving) return
    if (addressDraft.neighborhood.trim() && !addressDraft.street.trim()) {
      window.alert(t('address.streetRequired', 'Mahalle seçildiğinde Cadde / Sokak zorunludur.'))
      return
    }
    if (addressDraft.neighborhood.trim() && !addressDraft.streetNo.trim()) {
      window.alert(t('address.streetNoRequired', 'Mahalle seçildiğinde No zorunludur.'))
      return
    }
    setAddressSaving(true)
    try {
      const neighborhood = normalizeTitleCaseField(addressDraft.neighborhood)
      const street = normalizeTitleCaseField(addressDraft.street)
      const streetNo = addressDraft.streetNo.trim() || null
      const openAddress = normalizeTitleCaseField(addressDraft.openAddress)
      await api.updateCitizenConversationProfile(row.citizenConversationId, {
        citizenName: row.citizenName,
        citizenPhone: row.citizenPhone,
        label: row.label,
        neighborhood: neighborhood ?? '',
        street: street ?? '',
        streetNo,
        openAddress: openAddress ?? '',
      })
      setRows(current => current.map(item => item.citizenConversationId === row.citizenConversationId
        ? { ...item, neighborhood, street, streetNo, openAddress }
        : item))
      cancelAddressEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setAddressSaving(false)
    }
  }

  // Job'a dönüşmemiş ama VT numarası taşıyan talepler de listelenir (card #1843).
  // En yüksek VT numarası üstte (#r467).
  const ticketsWithJobs = useMemo(() => {
    return (ticketModal?.detail?.tickets ?? []).filter(ticket => ticket.jobId || ticket.citizenRequestNumber != null)
  }, [ticketModal?.detail?.tickets])

  return (
    <div className="page-stack desktop-page-shell shrink-0">
      <section className="section-card p-0">
        <div
          className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] rounded-t-[var(--radius-xl)] lg:rounded-t-[0.85rem]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-1">
            <div className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white/70">
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
          {(isSearchQueryActive(searchText) || Object.values(filters).some(Boolean)) ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => { setSearchText(''); clearFilters() }}>
              {t('common.reset', 'Temizle')}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="section-card overflow-hidden p-0">
        {error ? <div className="error m-4">{error}</div> : null}
        {/* table-wrap: mobilde yatay kaydırma (#r482); eski table-scroll-shell CSS'sizdi. */}
        <div className="table-wrap">
          <table className="data-table citizen-directory-table">
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
                  className="citizen-directory-phone-th"
                  filterKey="citizenPhone"
                  filterValue={filters.citizenPhone ?? ''}
                  onFilter={setFilter}
                  sortKey="citizenPhone"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                >
                  {t('citizenDirectory.columns.phone', 'Telefon No')}
                </FilterableTh>
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
                  {t('citizenDirectory.columns.street', 'Cadde / Sokak')}
                </FilterableTh>
                <FilterableTh
                  filterKey="streetNo"
                  filterValue={filters.streetNo ?? ''}
                  onFilter={setFilter}
                  sortKey="streetNo"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                >
                  {t('citizenDirectory.columns.streetNo', 'No')}
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
                  {t('citizenDirectory.columns.openAddress', 'Adres Tarifi')}
                </FilterableTh>
                <th className="text-center">{t('common.actions', 'İşlemler')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableEmptyStateRows columnCount={8} message={t('common.loading')} />
              ) : pageRows.length === 0 ? (
                <TableEmptyStateRows columnCount={8} message={t('citizenDirectory.empty', 'Kayıtlı vatandaş bulunamadı.')} />
              ) : pageRows.map((row, index) => {
                const isEditing = editingId === row.citizenConversationId && addressDraft != null
                return (
                <tr key={row.citizenConversationId}>
                  <td className="text-center text-xs font-bold tabular-nums text-slate-400">
                    {(safePage - 1) * pageSize + index + 1}
                  </td>
                  <td>
                    <span className="truncate font-semibold text-slate-700">{row.displayName}</span>
                  </td>
                  <td className="citizen-directory-phone-value text-sm font-semibold text-slate-500 tabular-nums">
                    <EmptyCell value={formatDirectoryPhone(row.citizenPhone)} />
                  </td>
                  {isEditing ? (
                    <DirectoryAddressEditCells
                      draft={addressDraft}
                      onChange={patch => setAddressDraft(current => current ? { ...current, ...patch } : current)}
                    />
                  ) : (
                    <>
                      <td><EmptyCell value={row.neighborhood} /></td>
                      <td><EmptyCell value={row.street} /></td>
                      <td><EmptyCell value={row.streetNo} /></td>
                      <td><EmptyCell value={row.openAddress} /></td>
                    </>
                  )}
                  <td className="actions-cell">
                    <div className="request-actions justify-center gap-1.5">
                      {isEditing ? (
                        <>
                          <Button type="button" size="sm" disabled={addressSaving} onClick={() => void saveAddressEdit(row)}>
                            {t('common.save', 'Kaydet')}
                          </Button>
                          <Button type="button" size="sm" variant="destructive" disabled={addressSaving} onClick={cancelAddressEdit}>
                            {t('common.cancel', 'İptal')}
                          </Button>
                        </>
                      ) : null}
                      <Button type="button" size="sm" variant="secondary" className="inline-flex items-center gap-1.5" onClick={() => void openTickets(row)}>
                        <FileText className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('jobs.actions.details', 'Detaylar')}
                      </Button>
                      {row.sourceChannel === 'Phone' ? (
                        <DisabledActionButton
                          type="button"
                          size="sm"
                          className={chatButtonClass}
                          hoverTitle={t('citizenDirectory.goToChatUnavailable', 'Çağrı kanalında yazışma yoktur')}
                        >
                          <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t('citizenDirectory.goToChat', 'Yazışmaya Git')}
                        </DisabledActionButton>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className={chatButtonClass}
                          onClick={() => void goToConversation(row)}
                        >
                          <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t('citizenDirectory.goToChat', 'Yazışmaya Git')}
                        </Button>
                      )}
                      {!isEditing && canEditDirectoryAddress ? (
                        <Button
                          type="button"
                          size="sm"
                          className="inline-flex items-center gap-1.5 !bg-teal-700 !text-white hover:!bg-teal-800"
                          onClick={() => startAddressEdit(row)}
                        >
                          <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t('common.edit', 'Düzenle')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                )
              })}
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

      {ticketModal ? (
        <CitizenDirectoryTicketsModal
          key={ticketModal.conversation.citizenConversationId}
          citizen={ticketModal.conversation}
          tickets={ticketsWithJobs}
          loading={ticketModal.loading}
          error={ticketModal.error}
          locale={locale}
          jobDetailLoading={jobDetailLoading}
          onClose={() => setTicketModal(null)}
          onOpenJobDetail={(jobId, socialMessageId) => void openJobDetail(jobId, socialMessageId)}
        />
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
              onPrint={() => printJobDetail(jobDetail, locale, t, {
                myRequestView: true,
                requestLabel: citizenSourceMessage?.category,
                sourceChannel: citizenSourceMessage?.channel,
              })}
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
              shellClassName="detail-modal-shell--citizen-directory-nested"
              citizenOutboundMessage={jobDetail.citizenOutboundMessage}
              citizenApprovalReleasedNote={jobDetail.citizenApprovalReleasedNote}
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
          citizenName={conversationModal.citizenName}
          onClose={() => setConversationModal(null)}
        />
      ) : null}
    </div>
  )
}
