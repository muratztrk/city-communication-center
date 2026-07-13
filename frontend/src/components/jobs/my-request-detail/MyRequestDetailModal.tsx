import { MapPin, NotebookPen, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { AttachmentSection } from '../../ui/AttachmentSection'
import { AddressDetailFields } from '../../ui/AddressDetailFields'
import type { ConfirmDialogState } from '../../ui/confirm-dialog'
import type { JobDetail, SocialMessage } from '../../../types/platform'
import { MyRequestDetailBottomCards } from './MyRequestDetailBottomCards'
import { MyRequestDetailHeader } from './MyRequestDetailHeader'
import type { DetailDueDateEditState, JobExtraTimeReviewState } from './MyRequestDetailMainCard'
import { MyRequestDetailMainCard } from './MyRequestDetailMainCard'
import { MyRequestTaskDetailsSection } from './MyRequestTaskDetailsSection'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'
import { MyRequestAddressEditFields } from './MyRequestAddressEditFields'
import type { MyRequestEditDraft } from './myRequestEditDraft'

export interface MyRequestDetailModalProps {
  detail: JobDetail
  title: string
  locale: string
  detailLoading: boolean
  citizenSourceMessage?: SocialMessage | null
  detailStatusClass: string
  statusContent: ReactNode
  statusLabel?: ReactNode
  statusNoteContent?: ReactNode
  canChangeDueDate: boolean
  detailDueDateEdit: DetailDueDateEditState | null
  onOpenDueDateEdit: () => void
  onCloseDueDateEdit: () => void
  onDueDateChange: (value: string) => void
  onDueDateSave: () => void
  jobExtraTimeReview?: JobExtraTimeReviewState | null
  onOpenExtraTimeReview?: () => void
  onExtraTimeDecision?: (decision: 'approve' | 'reject') => void
  onCancelExtraTimeReview?: () => void
  onClose: () => void
  onPrint: () => void
  onCancel?: () => void
  showCancelDisabled?: boolean
  cancelDisabledTitle?: string
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
  isEditing?: boolean
  editDraft?: MyRequestEditDraft
  onEditDraftChange?: (patch: Partial<MyRequestEditDraft>) => void
  editSaving?: boolean
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  // Taleplerim'e özgü konum/oluşturan stack'i ve hedef birim/görevi yapan ayrımı (cards #1460/#1592).
  useMyRequestsFieldLayout?: boolean
  hideTaskPlainDescription?: boolean
  forceCitizenDetailCards?: boolean
}

export function MyRequestDetailModal({
  detail,
  title,
  locale,
  detailLoading,
  citizenSourceMessage,
  detailStatusClass,
  statusContent,
  statusLabel,
  statusNoteContent,
  canChangeDueDate,
  detailDueDateEdit,
  onOpenDueDateEdit,
  onCloseDueDateEdit,
  onDueDateChange,
  onDueDateSave,
  jobExtraTimeReview,
  onOpenExtraTimeReview,
  onExtraTimeDecision,
  onCancelExtraTimeReview,
  onClose,
  onPrint,
  onCancel,
  showCancelDisabled,
  cancelDisabledTitle,
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
  isEditing = false,
  editDraft,
  onEditDraftChange,
  editSaving = false,
  onSaveEdit,
  onCancelEdit,
  useMyRequestsFieldLayout = false,
  hideTaskPlainDescription = false,
  forceCitizenDetailCards = false,
}: MyRequestDetailModalProps) {
  const { t } = useTranslation()

  // Standart kullanıcıda da Adres Bilgileri ve Talep Ekleri ayrı alt kutular olarak kalır
  // (card #1602). Yönetici Notu varsa eski davranışla Talep Bilgileri'nin sonunda gösterilir.
  const isStandardUser = !canManageCoordination

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
        showCancelDisabled={showCancelDisabled}
        cancelDisabledTitle={cancelDisabledTitle}
        onEdit={onEdit}
        showEditDisabled={showEditDisabled}
        editDisabledTitle={editDisabledTitle}
        onGoToConversation={onGoToConversation}
        isEditing={isEditing}
        editSaving={editSaving}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <MyRequestDetailMainCard
          detail={detail}
          locale={locale}
          citizenSourceMessage={citizenSourceMessage}
          detailStatusClass={detailStatusClass}
          statusContent={statusContent}
          statusLabel={statusLabel}
          statusNoteContent={statusNoteContent}
          canChangeDueDate={canChangeDueDate}
          detailDueDateEdit={detailDueDateEdit}
          onOpenDueDateEdit={onOpenDueDateEdit}
          onCloseDueDateEdit={onCloseDueDateEdit}
          onDueDateChange={value => onDueDateChange(value)}
          onDueDateSave={onDueDateSave}
          jobExtraTimeReview={jobExtraTimeReview}
          onOpenExtraTimeReview={onOpenExtraTimeReview}
          onExtraTimeDecision={onExtraTimeDecision}
          onCancelExtraTimeReview={onCancelExtraTimeReview}
          isEditing={isEditing}
          editDraft={editDraft}
          onEditDraftChange={onEditDraftChange}
          useMyRequestsFieldLayout={useMyRequestsFieldLayout}
          separatePriorityProjectRows
          priorityInInfoHeader
          hideProjectRow={forceCitizenDetailCards}
          infoExtraTrailingRows={isStandardUser && !forceCitizenDetailCards ? [
            ...(showManagerNoteColumn && detail.managerNote?.trim()
              ? [{
                  label: t('jobs.managerNote.title', 'Yönetici Notu'),
                  value: <span className="whitespace-pre-wrap text-right">{detail.managerNote}</span>,
                }]
              : []),
          ] : undefined}
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
            canEditJobAttachments={canEditJobAttachments || isEditing}
            showAttachmentLockNotice={showAttachmentLockNotice && !isEditing}
            attachmentLockText={attachmentLockText}
            attachmentUploading={attachmentUploading}
            onAttachmentUpload={onAttachmentUpload}
            onAttachmentDelete={onAttachmentDelete}
            isEditing={isEditing}
            editDraft={editDraft}
            onEditDraftChange={onEditDraftChange}
          />
        ) : (
          <div className={`my-request-detail-bottom mb-5 grid gap-4 ${showManagerNoteColumn && !isStandardUser ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            <section className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
              <MyRequestSectionHeading icon={MapPin}>
                {t('address.detailSectionTitle', 'Adres Bilgileri')}
              </MyRequestSectionHeading>
              {isEditing && editDraft && onEditDraftChange ? (
                <MyRequestAddressEditFields draft={editDraft} onChange={onEditDraftChange} />
              ) : (
                <AddressDetailFields
                  variant="my-request"
                  neighborhood={detail.neighborhood}
                  street={detail.street}
                  openAddress={detail.openAddress}
                />
              )}
            </section>
            {showManagerNoteColumn && !isStandardUser && (
              <section className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={NotebookPen}>
                  {t('jobs.managerNote.title', 'Yönetici Notu')}
                </MyRequestSectionHeading>
                {detail.managerNote ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
                ) : (
                  <p className="text-sm text-slate-400">{t('jobs.managerNote.empty', 'Talep için yönetici notu bulunmamaktadır.')}</p>
                )}
              </section>
            )}
            <section className="my-request-detail-card my-request-detail-card--attachments rounded-xl border border-slate-200 bg-white p-4">
              <MyRequestSectionHeading icon={Paperclip}>
                {t('attachments.requestSectionTitle', 'Talep Ekleri')}
              </MyRequestSectionHeading>
              <AttachmentSection
                attachments={detail.attachments ?? []}
                readOnly={!isEditing || !(canEditJobAttachments || isEditing)}
                displayMode="rich-list"
                emptyText={t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.')}
                onUpload={isEditing && (canEditJobAttachments || isEditing) ? onAttachmentUpload : undefined}
                onDelete={isEditing && (canEditJobAttachments || isEditing) ? onAttachmentDelete : undefined}
                disabled={attachmentUploading}
                showDeleteActions={isEditing}
              />
              {showAttachmentLockNotice && !isEditing && (
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
          onDownloadTaskAttachment={onDownloadTaskAttachment}
          hidePlainDescription={hideTaskPlainDescription || (isStandardUser && !isEditing)}
        />
      </div>
    </section>
  )
}
