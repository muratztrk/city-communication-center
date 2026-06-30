import { MapPin, MessageSquare, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AddressDetailFields } from '../../ui/AddressDetailFields'
import { AttachmentSection } from '../../ui/AttachmentSection'
import { Button } from '../../ui/button'
import type { ConfirmDialogState } from '../../ui/confirm-dialog'
import type { JobDetail } from '../../../types/platform'
import { DETAIL_ICON_PROPS } from './detailIcons'

interface MyRequestDetailBottomCardsProps {
  detail: JobDetail
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
}

export function MyRequestDetailBottomCards({
  detail,
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
}: MyRequestDetailBottomCardsProps) {
  const { t } = useTranslation()

  const gridClass = showManagerNoteColumn ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  return (
    <div className={`my-request-detail-bottom grid gap-4 ${gridClass}`}>
      <div className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
        <div className="job-detail-card-title mb-3 border-b border-slate-200 pb-2">
          <MapPin {...DETAIL_ICON_PROPS} />
          {t('address.detailSectionTitle', 'Adres Bilgileri')}
        </div>
        <AddressDetailFields
          variant="detail-card"
          neighborhood={detail.neighborhood}
          street={detail.street}
          openAddress={detail.openAddress}
        />
      </div>

      {showManagerNoteColumn && (
        <div className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
          <div className="job-detail-card-title mb-3 border-b border-slate-200 pb-2">
            <MessageSquare {...DETAIL_ICON_PROPS} />
            {t('jobs.managerNote.title', 'Yönetici Notu')}
          </div>
          {!canEditManagerNote ? (
            detail.managerNote ? (
              <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
            ) : (
              <p className="text-sm text-slate-400">{t('jobs.managerNote.empty', 'Talep için yönetici notu bulunmamaktadır.')}</p>
            )
          ) : (detail.managerNote && !managerNoteEditing) ? (
            <>
              <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                  onClick={onManagerNoteEditStart}
                >
                  {t('jobs.managerNote.editOrDelete', 'Değiştir/Sil')}
                </Button>
              </div>
            </>
          ) : (
            <>
              {managerNoteSaved ? (
                <p className="mb-3 text-sm font-semibold text-emerald-600">{t('jobs.managerNote.saved', 'Notunuz Eklendi')}</p>
              ) : null}
              <textarea
                className="field-textarea min-h-24 w-full text-xs placeholder:text-xs"
                rows={3}
                value={managerNoteDraft}
                onChange={e => onManagerNoteDraftChange(e.target.value)}
                placeholder={t('jobs.managerNote.placeholder', 'Yönetici notu girin...')}
              />
              <div className="mt-3 flex justify-end gap-2">
                {managerNoteEditing ? (
                  <>
                    <Button type="button" variant="success" size="sm" disabled={managerNoteSaving || !managerNoteDraft.trim()} onClick={onManagerNoteSave}>
                      {t('common.change', 'Değiştir')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={managerNoteSaving}
                      onClick={() => setConfirmDialog({
                        title: t('common.delete', 'Sil'),
                        message: 'Notu silmek istediğinize emin misiniz?',
                        variant: 'destructive',
                        confirmLabel: t('common.delete', 'Sil'),
                        cancelLabel: t('common.cancel', 'İptal'),
                        onConfirm: onManagerNoteDeleteConfirm,
                      })}
                    >
                      {t('common.delete', 'Sil')}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="success" size="sm" disabled={managerNoteSaving || !managerNoteDraft.trim()} onClick={onManagerNoteSave}>
                    {t('jobs.managerNote.add', 'Not Ekle')}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
        <div className="job-detail-card-title mb-3 border-b border-slate-200 pb-2">
          <Paperclip {...DETAIL_ICON_PROPS} />
          {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
        </div>
        <AttachmentSection
          attachments={detail.attachments ?? []}
          readOnly={!canEditJobAttachments}
          displayMode={canManageCoordination ? 'rich-list' : 'list'}
          emptyText={t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.')}
          onUpload={canEditJobAttachments ? onAttachmentUpload : undefined}
          onDelete={canEditJobAttachments ? onAttachmentDelete : undefined}
          disabled={attachmentUploading}
        />
        {showAttachmentLockNotice && (
          <p className="mt-2 text-xs font-medium text-amber-600">{attachmentLockText}</p>
        )}
      </div>
    </div>
  )
}
