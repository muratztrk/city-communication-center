import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FileText, MessageSquareText, Paperclip, Printer, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AttachmentSection } from '../ui/AttachmentSection'
import { DateTimeText } from '../ui/date-time-text'
import { formatCentralSupportStatus } from '../../utils/centralSupportStatus'
import type { MySupportRequest } from '../../types/platform'
import { api } from '../../api/client'
import { getLocale } from '../../utils/localization'
import { DetailModalHeaderBrand } from '../branding/DetailModalHeaderBrand'
import { DetailModalTitle } from '../../utils/detailModalTitle'
import { MyRequestSectionHeading } from '../jobs/my-request-detail/MyRequestSectionHeading'
import { Button } from '../ui/button'
import { useEscapeKey } from '../../hooks/useEscapeKey'

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
  useEscapeKey(onClose)

  const statusLabel = formatCentralSupportStatus(item.centralStatus, t)
    ?? (item.centralSyncError
      ? t('support.statusSyncFailed', 'Merkeze iletilemedi')
      : t('support.statusPending', 'İşleniyor'))

  const modalTitle = ticketDisplayNo

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

  const handlePrint = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ticketDisplayNo}</title></head><body>
      <h1>${ticketDisplayNo}</h1>
      <p><strong>${t('support.subjectLabel', 'Konu')}:</strong> ${item.subject}</p>
      <p><strong>${t('support.messageLabel', 'Mesaj')}:</strong></p>
      <pre>${item.message}</pre>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.print()
    }
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
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="detail-print-action inline-flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
              onClick={handlePrint}
              aria-label={t('common.print', 'Yazdır')}
            >
              <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('common.print', 'Yazdır')}
            </Button>
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
                  {t('support.detailInfoHeading', 'Talep Bilgileri')}
                </MyRequestSectionHeading>
                <div className="my-request-detail-fields page-stack edevlet-plan-detail-fields">
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
              <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r edevlet-plan-detail-card page-stack">
                <MyRequestSectionHeading icon={MessageSquareText} className="job-detail-card-title--spread">
                  {t('support.columns.message', 'Açıklama')}
                </MyRequestSectionHeading>
                <p className="whitespace-pre-wrap text-sm leading-5 text-slate-900">{item.message}</p>
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
    </div>,
    document.body,
  )
}
