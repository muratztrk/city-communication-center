import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { ModalBackdrop } from '../ui/modal-backdrop'
import { AttachmentSection } from '../ui/AttachmentSection'
import { formatCentralSupportStatus } from '../../utils/centralSupportStatus'
import type { MySupportRequest } from '../../types/platform'
import { api } from '../../api/client'
import { getLocale } from '../../utils/localization'

interface SupportRequestDetailModalProps {
  item: MySupportRequest
  userDisplayName: string
  onClose: () => void
}

export function SupportRequestDetailModal({ item, userDisplayName, onClose }: SupportRequestDetailModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const statusLabel = formatCentralSupportStatus(item.centralStatus, t)
    ?? (item.centralSyncError
      ? t('support.statusSyncFailed', 'Merkeze iletilemedi')
      : t('support.statusPending', 'İşleniyor'))

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
      <div className="relative flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-[40rem] flex-col rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', 'Kapat')}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <X className="size-4" />
        </button>

        <h3 className="mb-3 border-b border-slate-200 pb-2 pr-8 text-base font-semibold text-slate-900">
          {t('support.detailTitle', 'Destek talebi detayı')}
        </h3>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1 text-sm">
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-2">
            <dt className="font-semibold text-slate-600">{t('support.columns.ticketNo', 'Destek No')}</dt>
            <dd className="text-slate-900">{item.centralTicketNo ?? t('support.localTicket', 'Yerel kayıt')}</dd>
            <dt className="font-semibold text-slate-600">{t('support.columns.requestDate', 'Talep Tarihi')}</dt>
            <dd className="text-slate-900">
              {new Date(item.createdAtUtc).toLocaleString(locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </dd>
            <dt className="font-semibold text-slate-600">{t('support.columns.userName', 'Kullanıcı Adı')}</dt>
            <dd className="text-slate-900">{userDisplayName}</dd>
            <dt className="font-semibold text-slate-600">{t('support.columns.status', 'Talep Durumu')}</dt>
            <dd className="text-slate-900">{statusLabel}</dd>
            <dt className="font-semibold text-slate-600">{t('support.subjectLabel', 'Konu')}</dt>
            <dd className="font-semibold text-slate-900">{item.subject}</dd>
          </dl>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-600">{t('support.messageLabel', 'Mesaj')}</p>
            <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              {item.message}
            </p>
          </div>

          {item.centralSyncError ? (
            <p className="text-xs font-semibold text-red-600">{item.centralSyncError}</p>
          ) : null}

          <AttachmentSection
            attachments={item.attachments}
            readOnly
            displayMode="rich-list"
            onDownload={handleDownload}
            emptyText={t('attachments.empty', 'Ek dosya yok.')}
          />

          {item.messages.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">{t('support.threadTitle', 'Yazışma')}</p>
              <div className="space-y-2">
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
                        {new Date(messageItem.createdAt).toLocaleString(locale)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{messageItem.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-200 pt-4">
          <Button type="button" variant="primary" onClick={onClose}>
            {t('common.close', 'Kapat')}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  )
}
