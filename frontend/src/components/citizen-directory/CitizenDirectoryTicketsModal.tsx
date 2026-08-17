import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Printer, X as XIcon } from 'lucide-react'
import { DetailModalHeaderBrand } from '../branding/DetailModalHeaderBrand'
import { DateCell } from '../ui/date-cell'
import { Button } from '../ui/button'
import { EmptyCell } from '../ui/EmptyCell'
import { ChannelIcon } from '../ui/channel-icon'
import { StatusPill } from '../ui/status-pill'
import { GridStatusLabel } from '../ui/GridStatusLabel'
import { TablePagination } from '../ui/table-pagination'
import { FilterableTh } from '../ui/FilterableTh'
import { ClearPieFilterLink } from '../ui/ClearPieFilterLink'
import { useColumnFilters } from '../../hooks/useColumnFilters'
import { useSortable } from '../../hooks/useSortable'
import type { CitizenConversationTicket } from '../../types/platform'
import { formatCitizenPhoneDisplay, getCitizenRequestStatusLabel, getCitizenRequestStatusTone, isCitizenProcessingReceivedOverdue } from '../../utils/citizenRequests'
import { DetailModalTitle } from '../../utils/detailModalTitle'
import { getPriorityColorClass, getPriorityLabel, getSocialChannelLabel, getStatusPillClass, shouldShowGridPrioritySubline } from '../../utils/localization'
import { formatDirectoryPhone } from '../../utils/phoneDisplay'
import { printHtmlDocument } from '../../utils/printDocument'
import { TableEmptyStateRows } from '../ui/table-empty-state-rows'

export type CitizenTicketsModalCitizen = {
  citizenName: string | null
  citizenPhone: string
}

function formatDirectoryDateTime(value: string | null | undefined, locale: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatVt(ticket: CitizenConversationTicket): string {
  if (ticket.citizenRequestNumber != null && ticket.citizenRequestNumberYear != null) {
    return `VT-${ticket.citizenRequestNumberYear}-${ticket.citizenRequestNumber}`
  }
  if (ticket.jobNumber != null && ticket.jobNumberYear != null) {
    return `T-${ticket.jobNumberYear}-${ticket.jobNumber}`
  }
  return '—'
}

function ticketCitizenName(ticket: CitizenConversationTicket, citizen: CitizenTicketsModalCitizen): string {
  return ticket.citizenName?.trim() || citizen.citizenName?.trim() || ''
}

function ticketCitizenPhone(ticket: CitizenConversationTicket, citizen: CitizenTicketsModalCitizen): string {
  return ticket.citizenPhone?.trim() || citizen.citizenPhone?.trim() || ''
}

function printCitizenTickets(
  citizen: CitizenTicketsModalCitizen,
  tickets: CitizenConversationTicket[],
  locale: string,
  t: TFunction,
  replaceUnitWithCitizenContact = false,
  layout: 'directory' | 'departmentMap' = 'directory',
) {
  const isDepartmentMap = layout === 'departmentMap'
  const citizenLine = [citizen.citizenName, formatDirectoryPhone(citizen.citizenPhone)].filter(Boolean).join(' · ') || '—'
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rowsHtml = tickets.map((ticket, index) => {
    const status = ticket.jobStatus
      ? getCitizenRequestStatusLabel(t, {
        status: ticket.jobStatus,
        dueDateUtc: ticket.dueDateUtc,
        taskCount: ticket.openTaskCount ?? 0,
      })
      : '—'
    const date = ticket.receivedAtUtc
      ? new Date(ticket.receivedAtUtc).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      : '—'
    const contactName = ticketCitizenName(ticket, citizen) || '—'
    const contactPhone = formatCitizenPhoneDisplay(ticketCitizenPhone(ticket, citizen)) || '—'
    const contactHtml = `<span class="stack-head"><span>${escape(contactName)}</span><span>${escape(contactPhone)}</span></span>`
    const talepYeri = ticket.ownerDepartmentName?.trim() || ticket.departmentName || '—'
    const gidenYer = ticket.destinationDepartmentName?.trim() || ticket.departmentName || '—'
    if (isDepartmentMap) {
      return `<tr>
      <td>${index + 1}</td>
      <td class="col-no">${escape(formatVt(ticket))}</td>
      <td class="col-date">${escape(date)}</td>
      <td class="col-dept">${escape(talepYeri)}</td>
      <td class="col-dept">${escape(gidenYer)}</td>
      <td class="col-title">${escape(ticket.title?.trim() || '—')}</td>
      <td class="col-status">${escape(status)}</td>
    </tr>`
    }
    const channelLabel = ticket.channel ? escape(getSocialChannelLabel(t, ticket.channel)) : '—'
    return replaceUnitWithCitizenContact
      ? `<tr>
      <td>${index + 1}</td>
      <td class="col-no">${escape(formatVt(ticket))}</td>
      <td class="col-dept">${contactHtml}</td>
      <td class="col-date">${escape(date)}</td>
      <td class="col-title">${escape(ticket.title?.trim() || '—')}</td>
      <td class="col-status">${escape(status)}</td>
    </tr>`
      : `<tr>
      <td>${index + 1}</td>
      <td class="col-no">${escape(formatVt(ticket))}</td>
      <td class="col-date">${escape(date)}</td>
      <td class="col-dept">${channelLabel}</td>
      <td class="col-title">${escape(ticket.title?.trim() || '—')}</td>
      <td class="col-status">${escape(status)}</td>
    </tr>`
  }).join('')

  const listTitle = isDepartmentMap
    ? t('departmentRequestMap.ticketsTitle', 'Birim Talep Bilgi Listesi')
    : replaceUnitWithCitizenContact
      ? t('social.citizenRequestNo', 'Vatandaş Talep No')
      : t('nav.citizenDirectory', 'Vatandaş Bilgi Listesi')
  const stackedRequestNo = `<span class="stack-head"><span>${escape(t('dashboard.citizen', 'Vatandaş'))}</span><span>${escape(t('jobs.columns.requestNo', 'Talep No'))}</span></span>`
  const stackedCitizenContact = `<span class="stack-head"><span>${escape(t('social.citizenName', 'Vatandaş Adı'))}</span><span>${escape(t('citizenMessageApproval.columns.citizenPhone', 'Telefon No'))}</span></span>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(listTitle)}</title>
    <style>
      @page{margin:12mm}
      body{font-family:system-ui,sans-serif;padding:22px;color:#0f172a}
      h1{font-size:17px;margin:0 0 4px}
      .stack-head{display:inline-flex;flex-direction:column;align-items:center;line-height:1.15;font-weight:inherit}
      h2{font-size:13px;margin:16px 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
      p{margin:0 0 14px;color:#64748b;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}
      th,td{border:1px solid #cbd5e1;padding:6px 7px;text-align:center;vertical-align:middle}
      th{background:#f1f5f9;white-space:nowrap}
      th.col-title,td.col-title{white-space:normal;text-align:center;word-break:break-word;overflow-wrap:anywhere}
      .col-seq{width:4%;white-space:nowrap}
      .col-no{width:11%;white-space:nowrap}
      .col-title{width:30%}
      .col-date{width:14%;white-space:nowrap}
      .col-dept{width:19%;white-space:normal;word-break:break-word}
      .col-status{width:15%;white-space:normal;word-break:break-word}
      .footer{margin-top:14px;font-size:10px;color:#64748b}
    </style></head><body>
    <h1>${escape(listTitle)}</h1>
    ${isDepartmentMap ? '' : `<p>${escape(citizenLine)}</p>`}
    <h2>${escape(t('jobs.detail.requestInfo', 'Talep Detayları'))}</h2>
    <table><thead><tr>
      <th class="col-seq">${escape(t('common.number', 'Sıra'))}</th>
      <th class="col-no">${isDepartmentMap
        ? escape(t('jobs.columns.requestNo', 'Talep No'))
        : stackedRequestNo}</th>
      ${isDepartmentMap
        ? `<th class="col-date">${escape(t('social.citizenRequestDateHeader', 'Talep Tarihi'))}</th>
      <th class="col-dept">${escape(t('jobs.detail.requestLocation', 'Talep Yeri'))}</th>
      <th class="col-dept">${escape(t('social.destination', 'Gittiği Yer'))}</th>
      <th class="col-title">${escape(t('jobs.columns.title', 'Talep Başlığı'))}</th>`
        : replaceUnitWithCitizenContact
        ? `<th class="col-dept">${stackedCitizenContact}</th>
      <th class="col-date">${escape(t('social.citizenRequestDateHeader', 'Talep Tarihi'))}</th>
      <th class="col-title">${escape(t('jobs.columns.title', 'Talep Başlığı'))}</th>`
        : `<th class="col-date">${escape(t('social.citizenRequestDateHeader', 'Talep Tarihi'))}</th>
      <th class="col-dept">${escape(t('citizenDirectory.columns.sourceChannel', 'Talep Kanalı'))}</th>
      <th class="col-title">${escape(t('jobs.columns.title', 'Talep Başlığı'))}</th>`}
      <th class="col-status">${escape(t('jobs.columns.status', 'Durum'))}</th>
    </tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="footer">Yazdırma tarihi: ${new Date().toLocaleString(locale)}</div>
    </body></html>`

  printHtmlDocument(html)
}

interface CitizenDirectoryTicketsModalProps {
  citizen: CitizenTicketsModalCitizen
  tickets: CitizenConversationTicket[]
  loading: boolean
  error: string | null
  locale: string
  jobDetailLoading: boolean
  emptyMessage?: string
  onClose: () => void
  onOpenJobDetail: (jobId: string, socialMessageId?: string) => void
  replaceUnitWithCitizenContact?: boolean
  layout?: 'directory' | 'departmentMap'
}

export function CitizenDirectoryTicketsModal({
  citizen,
  tickets,
  loading,
  error,
  locale,
  jobDetailLoading,
  emptyMessage,
  onClose,
  onOpenJobDetail,
  replaceUnitWithCitizenContact = false,
  layout = 'directory',
}: CitizenDirectoryTicketsModalProps) {
  const { t } = useTranslation()
  const isDepartmentMap = layout === 'departmentMap'
  const showCitizenContact = replaceUnitWithCitizenContact && !isDepartmentMap
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketPageSize, setTicketPageSize] = useState(10)
  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters, clearFilters, hasActiveFilters } = useColumnFilters()

  const decoratedTickets = useMemo(() => tickets.map(ticket => ({
    ...ticket,
    requestNoText: formatVt(ticket),
    citizenNameText: ticketCitizenName(ticket, citizen),
    citizenPhoneText: formatCitizenPhoneDisplay(ticketCitizenPhone(ticket, citizen)),
    channelLabel: ticket.channel ? getSocialChannelLabel(t, ticket.channel) : '',
    titleText: (ticket.title ?? '').trim(),
    statusLabel: ticket.jobStatus
      ? getCitizenRequestStatusLabel(t, {
        status: ticket.jobStatus,
        dueDateUtc: ticket.dueDateUtc,
        taskCount: ticket.openTaskCount ?? 0,
      })
      : '',
    ownerLocationText: (ticket.ownerDepartmentName ?? ticket.departmentName ?? '').trim(),
    destinationText: (ticket.destinationDepartmentName ?? ticket.departmentName ?? '').trim(),
  })), [citizen, t, tickets])

  const sortedTickets = useMemo(() => {
    const filtered = decoratedTickets.filter(row => matchesFilters(row, (key, item) => {
      if (key === 'jobNumber') return item.requestNoText
      if (key === 'citizenName') return `${item.citizenNameText} ${item.citizenPhoneText}`
      if (key === 'receivedAtUtc') {
        return item.receivedAtUtc
          ? new Date(item.receivedAtUtc).toLocaleString(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          : ''
      }
      if (key === 'channel') return item.channelLabel
      if (key === 'title') return item.titleText
      if (key === 'jobStatus') return item.statusLabel
      if (key === 'ownerLocationText') return item.ownerLocationText
      if (key === 'destinationText') return item.destinationText
      return String((item as Record<string, unknown>)[key] ?? '')
    }))
    if (!sortKey) {
      return [...filtered].sort((a, b) => {
        const yearA = a.citizenRequestNumberYear ?? 0
        const yearB = b.citizenRequestNumberYear ?? 0
        if (yearA !== yearB) return yearB - yearA
        const numA = a.citizenRequestNumber ?? 0
        const numB = b.citizenRequestNumber ?? 0
        if (numA !== numB) return numB - numA
        return new Date(b.receivedAtUtc).getTime() - new Date(a.receivedAtUtc).getTime()
      })
    }
    return sortItems(filtered)
  }, [decoratedTickets, locale, matchesFilters, sortItems, sortKey])

  function handleFilter(key: string, value: string) {
    setFilter(key, value)
    setTicketPage(1)
  }

  function handleSort(key: string) {
    toggleSort(key)
    setTicketPage(1)
  }

  const ticketColumnCount = 2
    + (showCitizenContact ? 1 : 0)
    + 1
    + (isDepartmentMap ? 2 : replaceUnitWithCitizenContact ? 0 : 1)
    + 3
  const ticketTotalCount = sortedTickets.length
  const ticketSafePage = Math.min(ticketPage, Math.max(1, Math.ceil(ticketTotalCount / ticketPageSize) || 1))
  const pagedTickets = sortedTickets.slice((ticketSafePage - 1) * ticketPageSize, ticketSafePage * ticketPageSize)

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="detail-modal-shell detail-modal-shell--my-request flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-6 py-3">
          <div className="detail-modal-header-title min-w-0">
            <div className="citizen-directory-ticket-header-text flex min-w-0 flex-col items-start gap-0.5">
              <div className="my-request-detail-header__title">
                <DetailModalTitle title={isDepartmentMap
                  ? t('departmentRequestMap.ticketsTitle', 'Birim Talep Bilgi Listesi')
                  : t('nav.citizenDirectory', 'Vatandaş Bilgi Listesi')} />
              </div>
              {(() => {
                if (isDepartmentMap) return null
                const name = citizen.citizenName?.trim() ?? ''
                const phone = formatDirectoryPhone(citizen.citizenPhone)
                if (!name && !phone) return null
                return (
                  <p className="citizen-directory-ticket-subtitle flex min-w-0 flex-wrap items-center gap-x-1.5 text-[0.65rem] font-medium leading-tight text-slate-500">
                    {name ? <span className="min-w-0 truncate">{name}</span> : null}
                    {name && phone ? (
                      <span className="shrink-0 text-[0.45rem] leading-none text-slate-400" aria-hidden="true">
                        •
                      </span>
                    ) : null}
                    {phone ? <span className="shrink-0 tabular-nums">{phone}</span> : null}
                  </p>
                )
              })()}
            </div>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
            <div className="inline-flex min-w-0 items-center justify-end gap-2">
            <ClearPieFilterLink
              hasColumnFilters={hasActiveFilters}
              onClearColumnFilters={() => {
                clearFilters()
                setTicketPage(1)
              }}
            />
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="detail-print-action inline-flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
              disabled={loading || sortedTickets.length === 0}
              onClick={() => printCitizenTickets(citizen, sortedTickets, locale, t, replaceUnitWithCitizenContact, layout)}
              aria-label={t('common.print', 'Yazdır')}
            >
              <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('common.print', 'Yazdır')}
            </Button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
              aria-label={t('common.close', 'Kapat')}
            >
              <XIcon className="size-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            <div className="pt-3">
              {loading ? <div className="loading">{t('common.loading')}</div> : null}
              {error ? <div className="error">{error}</div> : null}
              {!loading && !error ? (
                tickets.length === 0 ? (
                  <p className="text-sm text-slate-500">{emptyMessage ?? t('citizenDirectory.noTickets', 'Bu vatandaşa ait talep bulunamadı.')}</p>
                ) : (
                  <div className="dashboard-drilldown-grid-shell">
                  <div className="dashboard-drilldown-table-wrap">
                  <table className="data-table citizen-directory-tickets-table">
                    <thead>
                      <tr>
                        <th className="w-14 text-center">{t('common.number', 'Sıra')}</th>
                        <FilterableTh
                          filterKey="jobNumber"
                          filterValue={filters.jobNumber ?? ''}
                          onFilter={handleFilter}
                          sortKey="jobNumber"
                          currentSortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        >
                          {isDepartmentMap
                            ? t('jobs.columns.requestNo', 'Talep No')
                            : t('social.citizenRequestNo', 'Vatandaş Talep No')}
                        </FilterableTh>
                        {showCitizenContact ? (
                          <FilterableTh
                            className="dashboard-drilldown-citizen-th text-center"
                            filterKey="citizenName"
                            filterValue={filters.citizenName ?? ''}
                            onFilter={handleFilter}
                            sortKey="citizenName"
                            currentSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          >
                            <span className="inline-flex flex-col items-center justify-center leading-tight text-center">
                              <span>{t('social.citizenName', 'Vatandaş Adı')}</span>
                              <span className="text-[0.9em] font-bold uppercase tracking-[0.06em]">
                                {t('citizenMessageApproval.columns.citizenPhone', 'Telefon No')}
                              </span>
                            </span>
                          </FilterableTh>
                        ) : null}
                        <FilterableTh
                          filterKey="receivedAtUtc"
                          filterValue={filters.receivedAtUtc ?? ''}
                          onFilter={handleFilter}
                          sortKey="receivedAtUtc"
                          currentSortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                          allowLetters
                        >
                          {t('social.citizenRequestDateHeader', 'Talep Tarihi')}
                        </FilterableTh>
                        {isDepartmentMap ? (
                          <>
                            <FilterableTh
                              filterKey="ownerLocationText"
                              filterValue={filters.ownerLocationText ?? ''}
                              onFilter={handleFilter}
                              sortKey="ownerLocationText"
                              currentSortKey={sortKey}
                              sortDir={sortDir}
                              onSort={handleSort}
                            >
                              {t('jobs.detail.requestLocation', 'Talep Yeri')}
                            </FilterableTh>
                            <FilterableTh
                              filterKey="destinationText"
                              filterValue={filters.destinationText ?? ''}
                              onFilter={handleFilter}
                              sortKey="destinationText"
                              currentSortKey={sortKey}
                              sortDir={sortDir}
                              onSort={handleSort}
                            >
                              {t('social.destination', 'Gittiği Yer')}
                            </FilterableTh>
                          </>
                        ) : replaceUnitWithCitizenContact ? null : (
                          <FilterableTh
                            filterKey="channel"
                            filterValue={filters.channel ?? ''}
                            onFilter={handleFilter}
                            sortKey="channel"
                            currentSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          >
                            {t('citizenDirectory.columns.sourceChannel', 'Talep Kanalı')}
                          </FilterableTh>
                        )}
                        <FilterableTh
                          filterKey="title"
                          filterValue={filters.title ?? ''}
                          onFilter={handleFilter}
                          sortKey="title"
                          currentSortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        >
                          {t('jobs.columns.title', 'Talep Başlığı')}
                        </FilterableTh>
                        <FilterableTh
                          filterKey="jobStatus"
                          filterValue={filters.jobStatus ?? ''}
                          onFilter={handleFilter}
                          sortKey="jobStatus"
                          currentSortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        >
                          {t('jobs.columns.status', 'Durum')}
                        </FilterableTh>
                        <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTickets.length === 0 ? (
                        <TableEmptyStateRows
                          columnCount={ticketColumnCount}
                          message={t('dashboard.chart.noData', 'Henüz gösterilecek veri yok.')}
                        />
                      ) : pagedTickets.map((ticket, index) => {
                        const statusLabel = ticket.jobStatus
                          ? getCitizenRequestStatusLabel(t, {
                              status: ticket.jobStatus,
                              dueDateUtc: ticket.dueDateUtc,
                              taskCount: ticket.openTaskCount ?? 0,
                            })
                          : null
                        return (
                        <tr key={ticket.socialMessageId || ticket.jobId || `${ticket.receivedAtUtc}-${index}`}>
                          <td className="text-center text-xs font-bold tabular-nums text-slate-400">
                            {(ticketSafePage - 1) * ticketPageSize + index + 1}
                          </td>
                          <td className="table-number-cell font-mono text-xs text-slate-500">
                            <div className="table-number-cell__value inline-flex items-center justify-center gap-1">
                              {replaceUnitWithCitizenContact && ticket.channel ? (
                                <ChannelIcon channel={ticket.channel} className="size-3.5 shrink-0" />
                              ) : null}
                              <span>{formatVt(ticket)}</span>
                            </div>
                            {shouldShowGridPrioritySubline(ticket.priority) ? (
                              <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(ticket.priority!)}`}>
                                Öncelik:{getPriorityLabel(t, ticket.priority!)}
                              </div>
                            ) : null}
                          </td>
                          {showCitizenContact ? (
                            <td className="text-center">
                              <div className="dashboard-drilldown-citizen-stack inline-flex flex-col items-center leading-tight text-center">
                                <div className="font-semibold text-slate-800">{ticketCitizenName(ticket, citizen) || '—'}</div>
                                <div className="dashboard-drilldown-citizen-stack__phone text-xs text-slate-400">
                                  {formatCitizenPhoneDisplay(ticketCitizenPhone(ticket, citizen)) || '—'}
                                </div>
                              </div>
                            </td>
                          ) : null}
                          <td>
                            <DateCell value={ticket.receivedAtUtc} locale={locale} />
                          </td>
                          {isDepartmentMap ? (
                            <>
                              <td className="max-w-[12rem]">
                                {(ticket.ownerDepartmentName ?? ticket.departmentName)?.trim()
                                  ? <span className="block truncate">{(ticket.ownerDepartmentName ?? ticket.departmentName)?.trim()}</span>
                                  : <EmptyCell />}
                              </td>
                              <td className="max-w-[12rem]">
                                {(ticket.destinationDepartmentName ?? ticket.departmentName)?.trim()
                                  ? <span className="block truncate">{(ticket.destinationDepartmentName ?? ticket.departmentName)?.trim()}</span>
                                  : <EmptyCell />}
                              </td>
                            </>
                          ) : replaceUnitWithCitizenContact ? null : (
                            <td className="text-center">
                              {ticket.channel ? (
                                <span className="inline-flex h-8 w-full items-center justify-center gap-1.5 whitespace-nowrap">
                                  <ChannelIcon channel={ticket.channel} className="size-3.5 shrink-0" />
                                  <span className="text-sm font-semibold text-slate-800">{getSocialChannelLabel(t, ticket.channel)}</span>
                                </span>
                              ) : <EmptyCell />}
                            </td>
                          )}
                          <td className="font-semibold text-slate-800"><EmptyCell value={ticket.title} /></td>
                          <td>
                            {statusLabel && ticket.jobStatus ? (
                              <StatusPill className={getStatusPillClass(getCitizenRequestStatusTone({
                                status: ticket.jobStatus,
                                dueDateUtc: ticket.dueDateUtc,
                                taskCount: ticket.openTaskCount ?? 0,
                              }))}>
                                <GridStatusLabel
                                  t={t}
                                  label={statusLabel}
                                  overdueSubline={ticket.jobStatus != null && isCitizenProcessingReceivedOverdue({
                                    status: ticket.jobStatus,
                                    dueDateUtc: ticket.dueDateUtc,
                                    taskCount: ticket.openTaskCount ?? 0,
                                  })}
                                  footer={(() => {
                                    const statusDate = ticket.jobStatus === 'Completed'
                                      ? ticket.completedAtUtc
                                      : ticket.jobStatus === 'Cancelled' || ticket.jobStatus === 'Rejected'
                                        ? ticket.updatedAtUtc
                                        : null
                                    const formatted = formatDirectoryDateTime(statusDate, locale)
                                    if (!formatted) return undefined
                                    return (
                                      <span className={`text-[0.68rem] font-bold ${ticket.jobStatus === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {formatted}
                                      </span>
                                    )
                                  })()}
                                />
                              </StatusPill>
                            ) : <EmptyCell />}
                          </td>
                          <td className="actions-cell">
                            <div className="request-actions justify-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={jobDetailLoading || !ticket.jobId}
                                onClick={() => ticket.jobId ? onOpenJobDetail(ticket.jobId, ticket.socialMessageId) : undefined}
                              >
                                {t('jobs.actions.details', 'Detaylar')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                  <TablePagination
                    totalCount={ticketTotalCount}
                    pageSize={ticketPageSize}
                    currentPage={ticketSafePage}
                    onPageSizeChange={size => { setTicketPageSize(size); setTicketPage(1) }}
                    onPageChange={setTicketPage}
                  />
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
