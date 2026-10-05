import type { ReactNode } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, MessageSquareText, Paperclip, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AttachmentSection } from '../ui/AttachmentSection'
import { DateTimeText } from '../ui/date-time-text'
import { Button } from '../ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../ui/confirm-dialog'
import { isCentralSupportStatusWaiting } from '../../utils/centralSupportStatus'
import type { MySupportRequest } from '../../types/platform'
import { api } from '../../api/client'
import { queryKeys } from '../../api/queryKeys'
import { getLocale, getPriorityColorClass, getPriorityLabel } from '../../utils/localization'
import { DetailModalHeaderBrand } from '../branding/DetailModalHeaderBrand'
import { DetailModalTitle } from '../../utils/detailModalTitle'
import { MyRequestSectionHeading } from '../jobs/my-request-detail/MyRequestSectionHeading'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { toSentenceCaseTr } from '../../utils/textNormalization'
import {
  resolveSupportRequestStatusLabel,
  supportRequestStatusTextClass,
} from '../../utils/supportRequestStatus'

interface SupportRequestDetailModalProps {
  item: MySupportRequest
  userDisplayName: string
  ticketDisplayNo: string
  onClose: () => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="job-detail-field-row job-detail-field-row--request-info">
      <div className="job-detail-field-row__label">{label}</div>
      <div className="job-detail-field-row__value">{value}</div>
    </div>
  )
}

export function SupportRequestDetailModal({
  item,
  userDisplayName,
  ticketDisplayNo,
  onClose,
}: SupportRequestDetailModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const queryClient = useQueryClient()
  useEscapeKey(onClose)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const priority = item.priority ?? 'Normal'
  const statusLabel = resolveSupportRequestStatusLabel(t, item.centralStatus, item.centralSyncError)
  const statusClass = supportRequestStatusTextClass(item.centralStatus, item.centralSyncError)

  const showConfirmResolved = isCentralSupportStatusWaiting(item.centralStatus) && !item.centralSyncError

  const confirmMutation = useMutation({
    mutationFn: () => api.confirmSupportRequestResolved(item.supportRequestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.supportRequests.mine() })
      onClose()
    },
  })

  const modalTitle = ticketDisplayNo
  const messageDisplay = toSentenceCaseTr(item.message)

  const handleDownload = (attachmentId: string, fileName: string) => {
    void api.downloadAttachment(attachmentId).then(blob => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  const requestConfirmResolved = () => {
    setConfirmDialog({
      title: t('support.confirmResolvedTitle', 'Çözümü Onayla'),
      titleDivider: true,
      message: t('support.confirmResolvedMessage', 'Destek talebinin çözüldüğünü onaylıyor musunuz?'),
      confirmLabel: t('common.confirm', 'Onayla'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'success',
      onConfirm: () => { void confirmMutation.mutateAsync() },
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      data-escape-overlay="high"
      onClick={onClose}
    >
      <section
        className="detail-modal-shell detail-modal-shell--my-request flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-6 py-3">
          <div className="detail-modal-header-title min-w-0">
            <div className="my-request-detail-header__title">
              <DetailModalTitle title={modalTitle} />
            </div>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
            {showConfirmResolved ? (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={confirmMutation.isPending}
                onClick={requestConfirmResolved}
              >
                {t('support.confirmResolvedAction', 'Çözümü Onayla')}
              </Button>
            ) : null}
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

        <div className="flex-1 overflow-y-auto p-6">
          <section className="my-request-detail-main form-card page-stack mb-5 lumespec-support-detail-main">
            <div className="my-request-detail-main__grid overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r edevlet-plan-detail-card page-stack">
                <MyRequestSectionHeading icon={FileText} className="job-detail-card-title--spread">
                  {t('support.detailSupportInfoHeading', 'Destek Bilgileri')}
                </MyRequestSectionHeading>
                <div className="my-request-detail-fields page-stack edevlet-plan-detail-fields">
                  <InfoRow label={t('support.columns.ticketNo', 'Destek No')} value={ticketDisplayNo} />
                  <InfoRow
                    label={t('support.columns.requestDate', 'Talep Tarihi')}
                    value={<DateTimeText value={item.createdAtUtc} locale={locale} />}
                  />
                  <InfoRow label={t('support.columns.userName', 'Kullanıcı Adı')} value={userDisplayName} />
                  <InfoRow label={t('support.subjectLabel', 'Konu')} value={item.subject} />
                  <InfoRow
                    label={t('jobs.columns.priority', 'Öncelik')}
                    value={(
                      <span className={`text-sm ${getPriorityColorClass(priority)} ${priority === 'High' || priority === 'VeryHigh' ? 'font-extrabold' : 'font-semibold'}`}>
                        {getPriorityLabel(t, priority)}
                      </span>
                    )}
                  />
                  <InfoRow
                    label={t('support.columns.status', 'Talep Durumu')}
                    value={<span className={`text-sm ${statusClass}`}>{statusLabel}</span>}
                  />
                </div>
              </div>
              <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r edevlet-plan-detail-card page-stack">
                <MyRequestSectionHeading icon={MessageSquareText} className="job-detail-card-title--spread">
                  {t('support.columns.message', 'Açıklama')}
                </MyRequestSectionHeading>
                <p className="whitespace-pre-wrap text-sm leading-5 text-slate-900">{messageDisplay}</p>
                {item.centralSyncError ? (
                  <p className="mt-2 text-xs font-semibold text-red-600">{item.centralSyncError}</p>
                ) : null}
              </div>
              <div className="min-w-0 p-4 edevlet-plan-detail-card page-stack my-request-detail-card--attachments">
                <MyRequestSectionHeading icon={Paperclip} className="job-detail-card-title--spread">
                  {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                </MyRequestSectionHeading>
                <AttachmentSection
                  attachments={item.attachments}
                  readOnly
                  displayMode="rich-list"
                  onDownload={handleDownload}
                  emptyText={t('attachments.empty', 'Ek dosya yok.')}
                />
              </div>
            </div>
          </section>

          {item.messages.length > 0 ? (
            <section className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
              <MyRequestSectionHeading icon={MessageSquareText}>
                {t('support.threadTitle', 'Yazışma')}
              </MyRequestSectionHeading>
              <div className="mt-3 space-y-2">
                {item.messages.map(messageItem => (
                  <div
                    key={`${item.supportRequestId}-${messageItem.createdAt}-${messageItem.direction}`}
                    className={messageItem.direction === 'support'
                      ? 'rounded-lg bg-emerald-50 p-2 text-xs text-emerald-950'
                      : 'rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700'}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
                      <span>
                        {messageItem.authorName
                          ?? (messageItem.direction === 'support' ? 'Lumespec Destek' : t('support.you', 'Siz'))}
                      </span>
                      <span className="font-normal text-slate-500">
                        <DateTimeText value={messageItem.createdAt} locale={locale} />
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{messageItem.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>,
    document.body,
  )
}
