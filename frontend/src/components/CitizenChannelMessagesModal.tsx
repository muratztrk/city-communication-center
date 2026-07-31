import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { JobSummary, SocialMessage } from '../types/platform'
import { Button } from './ui/button'
import { ChannelIcon } from './ui/channel-icon'
import { DateCell } from './ui/date-cell'
import { TablePagination } from './ui/table-pagination'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { JobsPage } from '../pages/JobsPage'
import { formatCitizenPhoneDisplay, formatCitizenRequestNumber } from '../utils/citizenRequests'
import { getLocale, getPriorityColorClass, getPriorityLabel } from '../utils/localization'
import { resolveSliceLabel } from '../utils/chartSliceLabel'

interface CitizenChannelMessagesModalProps {
  sliceKey: string
  from?: string
  to?: string
  onClose: () => void
}

function parseChannelFromSlice(sliceKey: string): string | null {
  if (sliceKey.startsWith('channel.')) return sliceKey.slice('channel.'.length)
  return null
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 12
}

function getMessageCitizenName(message: SocialMessage): string {
  if (message.citizenName?.trim()) return message.citizenName.trim()
  if (looksLikePhone(message.citizenHandle)) return '—'
  return message.citizenHandle.replace(/^@+/, '') || '—'
}

function getMessageCitizenPhone(message: SocialMessage): string {
  if (message.citizenPhone?.trim()) return formatCitizenPhoneDisplay(message.citizenPhone)
  if (looksLikePhone(message.citizenHandle)) return formatCitizenPhoneDisplay(message.citizenHandle)
  return '—'
}

/** Anasayfa Vatandaş Talep Kanalları dilimi → Vatandaş Talepleri grid popup (#6a6d0181). */
export function CitizenChannelMessagesModal({
  sliceKey,
  from,
  to,
  onClose,
}: CitizenChannelMessagesModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const channel = parseChannelFromSlice(sliceKey)
  const sliceLabel = resolveSliceLabel(sliceKey, t)

  const [messages, setMessages] = useState<SocialMessage[] | null>(null)
  const [jobsById, setJobsById] = useState<Map<string, JobSummary>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getSocialMessages(), api.getJobs()])
      .then(([socialMessages, jobs]) => {
        if (cancelled) return
        setMessages(socialMessages)
        setJobsById(new Map(jobs.map(job => [job.jobId, job])))
      })
      .catch(loadError => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const filteredMessages = useMemo(() => {
    if (!messages || !channel) return []
    const fromMs = from ? Date.parse(from) : NaN
    const toMs = to ? Date.parse(to) : NaN
    return messages
      .filter(message => {
        if (message.channel !== channel) return false
        if (message.citizenRequestNumber == null || !message.jobId) return false
        const linkedJob = jobsById.get(message.jobId)
        const createdMs = linkedJob
          ? Date.parse(linkedJob.createdAtUtc)
          : Date.parse(message.receivedAtUtc)
        if (Number.isFinite(fromMs) && createdMs < fromMs) return false
        if (Number.isFinite(toMs) && createdMs > toMs) return false
        return true
      })
      .sort((a, b) => Date.parse(b.receivedAtUtc) - Date.parse(a.receivedAtUtc))
  }, [messages, channel, from, to, jobsById])

  // Parent remounts on slice change; clamp page if filtre sonucu kısalırsa.
  const maxPage = Math.max(1, Math.ceil(filteredMessages.length / pageSize) || 1)
  const safePage = Math.min(page, maxPage)
  const paged = filteredMessages.slice((safePage - 1) * pageSize, safePage * pageSize)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
        <div
          className="detail-modal-shell detail-modal-shell--my-request flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-5 py-3.5">
            <div className="detail-modal-header-title min-w-0">
              <h2 className="flex min-w-0 items-start gap-2 text-sm font-bold text-emerald-700">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate">{t('dashboard.citizenChannels.title')}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">{sliceLabel}</span>
                </span>
              </h2>
            </div>
            <DetailModalHeaderBrand />
            <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
              <button
                type="button"
                className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-transparent text-slate-400 shadow-none transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95"
                aria-label={t('common.close', 'Kapat')}
                onClick={onClose}
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            <div className="pt-4">
              {error ? (
                <div className="error">{error}</div>
              ) : messages === null ? (
                <div className="loading">{t('common.loading')}</div>
              ) : (
                <div className="dashboard-drilldown-grid-shell">
                  <div className="dashboard-drilldown-table-wrap">
                    <table className="data-table data-table--zebra social-messages-table dashboard-drilldown-table dashboard-drilldown-table--citizen-channels">
                      <thead>
                        <tr>
                          <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                          <th>{t('social.citizenRequestNoHeader', 'Vatandaş Talep No')}</th>
                          <th>{t('social.citizenName', 'Vatandaş Adı')}</th>
                          <th>{t('social.citizenPhone', 'Telefon Numarası')}</th>
                          <th>{t('social.citizenRequestDateHeader', 'Vatandaş Talep Tarihi')}</th>
                          <th>{t('social.destination', 'Gittiği Yer')}</th>
                          <th>{t('whatsapp.label', 'Talep Etiketi')}</th>
                          <th>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
                              {t('social.empty')}
                            </td>
                          </tr>
                        ) : paged.map((message, index) => {
                          const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined
                          return (
                            <tr key={message.socialMessageId}>
                              <td className="text-center text-xs font-bold text-slate-400 tabular-nums">
                                {(safePage - 1) * pageSize + index + 1}
                              </td>
                              <td className="table-number-cell font-mono text-xs text-slate-500">
                                <div className="table-number-cell__value inline-flex items-center gap-1.5">
                                  <ChannelIcon channel={message.channel} className="size-4 shrink-0" />
                                  <span>{formatCitizenRequestNumber(message, locale)}</span>
                                </div>
                                {linkedJob ? (
                                  <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(linkedJob.priority)}`}>
                                    (Öncelik:{getPriorityLabel(t, linkedJob.priority)})
                                  </div>
                                ) : null}
                              </td>
                              <td className="font-semibold">{getMessageCitizenName(message)}</td>
                              <td className="font-semibold">{getMessageCitizenPhone(message)}</td>
                              <td><DateCell value={message.receivedAtUtc} locale={locale} /></td>
                              <td>
                                <span className="font-semibold text-slate-700">
                                  {message.assignedDepartmentName ?? t('common.none')}
                                </span>
                                {linkedJob?.assignedUserDisplayName ? (
                                  <span className="mt-0.5 block text-sm font-semibold text-slate-500">
                                    {linkedJob.assignedUserDisplayName}
                                  </span>
                                ) : null}
                              </td>
                              <td className="text-center">
                                <span className="inline-flex min-h-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
                                  {message.category?.trim() || t('whatsapp.requestTagsShort', 'Etiketler')}
                                </span>
                              </td>
                              <td className="actions-cell">
                                <div className="request-actions justify-center">
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant="secondary"
                                    disabled={!message.jobId}
                                    onClick={() => {
                                      if (message.jobId) setDetailJobId(message.jobId)
                                    }}
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
                    totalCount={filteredMessages.length}
                    pageSize={pageSize}
                    currentPage={safePage}
                    onPageSizeChange={size => {
                      setPageSize(size)
                      setPage(1)
                    }}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {detailJobId ? (
        <JobsPage
          mode="myRequests"
          fixedScope="mine"
          detailOnly
          detailContextOverride="social"
          notificationJobId={detailJobId}
          onNotificationDetailClose={() => setDetailJobId(null)}
        />
      ) : null}
    </>,
    document.body,
  )
}
