import { MapPin, MessageSquare, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { AttachmentSection } from '../../ui/AttachmentSection'
import { AddressDetailFields } from '../../ui/AddressDetailFields'
import type { ConfirmDialogState } from '../../ui/confirm-dialog'
import type { JobDetail, SocialMessage } from '../../../types/platform'
import { MyRequestDetailBottomCards } from './MyRequestDetailBottomCards'
import { MyRequestDetailHeader } from './MyRequestDetailHeader'
import type { DetailDueDateEditState } from './MyRequestDetailMainCard'
import { MyRequestDetailMainCard } from './MyRequestDetailMainCard'
import { MyRequestTaskDetailsSection } from './MyRequestTaskDetailsSection'
import { DETAIL_ICON_PROPS } from './detailIcons'

export interface MyRequestDetailModalProps {
  detail: JobDetail
  title: string
  locale: string
  detailLoading: boolean
  citizenSourceMessage?: SocialMessage | null
  detailStatusClass: string
  statusContent: ReactNode
  canChangeDueDate: boolean
  detailDueDateEdit: DetailDueDateEditState | null
  onOpenDueDateEdit: () => void
  onCloseDueDateEdit: () => void
  onDueDateChange: (value: string) => void
  onDueDateSave: () => void
  onClose: () => void
  onPrint: () => void
  onCancel?: () => void
  onEdit?: () => void
  showEditDisabled?: boolean
  editDisabledTitle?: string
  onGoToConversation?: () => void
  showManagerNoteColumn: boolean
  canEditManagerNote: boolean
  canManageCoordination: boolean
  managerNoteDraft: string
  managerNoteEditing: boolean
  managerNoteSaved: boolean
  managerNoteSaving: boolean
  onManagerNoteDraftChange: (value: string) => void
  onManagerNoteEditStart: () => void
  onManagerNoteSave: () => void
  onManagerNoteDeleteConfirm: () => void
  setConfirmDialog: (state: ConfirmDialogState | null) => void
  canEditJobAttachments: boolean
  showAttachmentLockNotice: boolean
  attachmentLockText: string
  attachmentUploading: boolean
  onAttachmentUpload: (file: File, onProgress?: (percent: number) => void) => Promise<void>
  onAttachmentDelete: (attachmentId: string) => Promise<void>
  onDownloadTaskAttachment: (attachmentId: string, fileName: string) => void
}

export function MyRequestDetailModal({
  detail,
  title,
  locale,
  detailLoading,
  citizenSourceMessage,
  detailStatusClass,
  statusContent,
  canChangeDueDate,
  detailDueDateEdit,
  onOpenDueDateEdit,
  onCloseDueDateEdit,
  onDueDateChange,
  onDueDateSave,
  onClose,
  onPrint,
  onCancel,
  onEdit,
  showEditDisabled,
  editDisabledTitle,
  onGoToConversation,
  showManagerNoteColumn,
  canEditManagerNote,
  canManageCoordination,
  managerNoteDraft,
  managerNoteEditing,
  managerNoteSaved,
  managerNoteSaving,
  onManagerNoteDraftChange,
  onManagerNoteEditStart,
  onManagerNoteSave,
  onManagerNoteDeleteConfirm,
  setConfirmDialog,
  canEditJobAttachments,
  showAttachmentLockNotice,
  attachmentLockText,
  attachmentUploading,
  onAttachmentUpload,
  onAttachmentDelete,
  onDownloadTaskAttachment,
}: MyRequestDetailModalProps) {
  const { t } = useTranslation()

  return (
    <section
      className="detail-modal-shell detail-modal-shell--my-request flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <MyRequestDetailHeader
        title={title}
        onClose={onClose}
        onPrint={onPrint}
        onCancel={onCancel}
        onEdit={onEdit}
        showEditDisabled={showEditDisabled}
        editDisabledTitle={editDisabledTitle}
        onGoToConversation={onGoToConversation}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <MyRequestDetailMainCard
          detail={detail}
          locale={locale}
          citizenSourceMessage={citizenSourceMessage}
          detailStatusClass={detailStatusClass}
          statusContent={statusContent}
          canChangeDueDate={canChangeDueDate}
          detailDueDateEdit={detailDueDateEdit}
          onOpenDueDateEdit={onOpenDueDateEdit}
          onCloseDueDateEdit={onCloseDueDateEdit}
          onDueDateChange={value => onDueDateChange(value)}
          onDueDateSave={onDueDateSave}
        />

        {canManageCoordination ? (
          <MyRequestDetailBottomCards
            detail={detail}
            showManagerNoteColumn={showManagerNoteColumn}
            canEditManagerNote={canEditManagerNote}
            canManageCoordination={canManageCoordination}
            managerNoteDraft={managerNoteDraft}
            managerNoteEditing={managerNoteEditing}
            managerNoteSaved={managerNoteSaved}
            managerNoteSaving={managerNoteSaving}
            onManagerNoteDraftChange={onManagerNoteDraftChange}
            onManagerNoteEditStart={onManagerNoteEditStart}
            onManagerNoteSave={onManagerNoteSave}
            onManagerNoteDeleteConfirm={onManagerNoteDeleteConfirm}
            setConfirmDialog={setConfirmDialog}
            canEditJobAttachments={canEditJobAttachments}
            showAttachmentLockNotice={showAttachmentLockNotice}
            attachmentLockText={attachmentLockText}
            attachmentUploading={attachmentUploading}
            onAttachmentUpload={onAttachmentUpload}
            onAttachmentDelete={onAttachmentDelete}
          />
        ) : (
          <div className={`my-request-detail-bottom mb-5 grid gap-4 ${showManagerNoteColumn ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            <section className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
              <div className="job-detail-card-title mb-3 border-b border-slate-200 pb-2">
                <MapPin {...DETAIL_ICON_PROPS} />
                {t('address.detailSectionTitle', 'Adres Bilgileri')}
              </div>
              <AddressDetailFields
                variant="my-request"
                neighborhood={detail.neighborhood}
                street={detail.street}
                openAddress={detail.openAddress}
              />
            </section>
            {showManagerNoteColumn && (
              <section className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
                <div className="job-detail-card-title mb-3 border-b border-slate-200 pb-2">
                  <MessageSquare {...DETAIL_ICON_PROPS} />
                  {t('jobs.managerNote.title', 'Yönetici Notu')}
                </div>
                {detail.managerNote ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
                ) : (
                  <p className="text-sm text-slate-400">{t('jobs.managerNote.empty', 'Talep için yönetici notu bulunmamaktadır.')}</p>
                )}
              </section>
            )}
            <section className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
              <div className="job-detail-card-title mb-3 border-b border-slate-200 pb-2">
                <Paperclip {...DETAIL_ICON_PROPS} />
                {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
              </div>
              <AttachmentSection
                attachments={detail.attachments ?? []}
                readOnly
                displayMode="list"
                emptyText={t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.')}
              />
              {showAttachmentLockNotice && (
                <p className="mt-2 text-xs font-medium text-amber-600">{attachmentLockText}</p>
              )}
            </section>
          </div>
        )}

        {detailLoading && <div className="loading">{t('common.loading')}</div>}

        {detail.latitude != null && detail.longitude != null && (
          <section className="mb-5">
            <h3 className="job-detail-section-title mb-2">
              {t('location.mapSectionTitle', 'Konum')}
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(detail.longitude - 0.005).toFixed(6)},${(detail.latitude - 0.005).toFixed(6)},${(detail.longitude + 0.005).toFixed(6)},${(detail.latitude + 0.005).toFixed(6)}&layer=mapnik&marker=${detail.latitude},${detail.longitude}`}
                className="h-64 w-full"
                title={t('location.mapTitle', 'Konum Haritası')}
                allowFullScreen
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}
            </p>
          </section>
        )}

        <MyRequestTaskDetailsSection
          detail={detail}
          locale={locale}
          setConfirmDialog={setConfirmDialog}
          onDownloadTaskAttachment={onDownloadTaskAttachment}
        />
      </div>
    </section>
  )
}
