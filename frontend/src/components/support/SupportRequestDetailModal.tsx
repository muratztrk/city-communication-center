import type { ReactNode } from 'react'
import { FileText, MessageSquareText, Paperclip, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AttachmentSection } from '../ui/AttachmentSection'
import { ModalBackdrop } from '../ui/modal-backdrop'
import { DateTimeText } from '../ui/date-time-text'
import { formatCentralSupportStatus } from '../../utils/centralSupportStatus'
import type { MySupportRequest } from '../../types/platform'
import { api } from '../../api/client'
import { getLocale } from '../../utils/localization'
import { DetailModalHeaderBrand } from '../branding/DetailModalHeaderBrand'
import { DetailModalTitle } from '../../utils/detailModalTitle'
import { MyRequestSectionHeading } from '../jobs/my-request-detail/MyRequestSectionHeading'
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
  const statusLabel = formatCentralSupportStatus(item.centralStatus, t)
    ?? (item.centralSyncError
      ? t('support.statusSyncFailed', 'Merkeze iletilemedi')
      : t('support.statusPending', 'İşleniyor'))

  const modalTitle = `${ticketDisplayNo} ${item.subject}`.trim()

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

  return (
    <ModalBackdrop onEscapeClose={onClose}>
      <section
        className="detail-modal-shell detail-modal-shell--my-request flex max-h-[min(85dvh,52rem)] w-full max-w-[min(76rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
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
          <section className="my-request-detail-main form-card page-stack mb-5">
            <MyRequestSectionHeading icon={FileText} tone="primary">
              {t('support.detailInfoHeading', 'Talep Bilgileri')}
            </MyRequestSectionHeading>
            <div className="my-request-detail-main__grid overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid lg:grid-cols-[minmax(0,1fr)]">
              <div className="my-request-detail-fields divide-y divide-slate-100">
                <InfoRow label={t('support.columns.ticketNo', 'Destek No')} value={ticketDisplayNo} />
                <InfoRow
                  label={t('support.columns.requestDate', 'Talep Tarihi')}
                  value={<DateTimeText value={item.createdAtUtc} locale={locale} />}
                />
                <InfoRow label={t('support.columns.userName', 'Kullanıcı Adı')} value={userDisplayName} />
                <InfoRow label={t('support.columns.status', 'Talep Durumu')} value={statusLabel} />
                <InfoRow label={t('support.subjectLabel', 'Konu')} value={item.subject} />
              </div>
            </div>
          </section>

          <section className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4 mb-5">
            <MyRequestSectionHeading icon={MessageSquareText}>
              {t('support.messageLabel', 'Mesaj')}
            </MyRequestSectionHeading>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{item.message}</p>
            {item.centralSyncError ? (
              <p className="mt-2 text-xs font-semibold text-red-600">{item.centralSyncError}</p>
            ) : null}
          </section>

          <section className="my-request-detail-card my-request-detail-card--attachments rounded-xl border border-slate-200 bg-white p-4 mb-5">
            <MyRequestSectionHeading icon={Paperclip}>
              {t('attachments.sectionTitle', 'Talep Ekleri')}
            </MyRequestSectionHeading>
            <div className="mt-3">
              <AttachmentSection
                attachments={item.attachments}
                readOnly
                displayMode="rich-list"
                onDownload={handleDownload}
                emptyText={t('attachments.empty', 'Ek dosya yok.')}
              />
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
    </ModalBackdrop>
  )
}
