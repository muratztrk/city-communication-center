import { PenLine, Printer, X as XIcon, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../ui/button'
import { DisabledActionButton } from '../../ui/DisabledActionButton'

interface MyRequestDetailHeaderProps {
  title: string
  onClose: () => void
  onPrint: () => void
  onCancel?: () => void
  showCancelDisabled?: boolean
  cancelDisabledTitle?: string
  onEdit?: () => void
  onGoToConversation?: () => void
  showEditDisabled?: boolean
  editDisabledTitle?: string
  isEditing?: boolean
  editSaving?: boolean
  onSaveEdit?: () => void
  onCancelEdit?: () => void
}

export function MyRequestDetailHeader({
  title,
  onClose,
  onPrint,
  onCancel,
  showCancelDisabled,
  cancelDisabledTitle,
  onEdit,
  onGoToConversation,
  showEditDisabled,
  editDisabledTitle,
  isEditing = false,
  editSaving = false,
  onSaveEdit,
  onCancelEdit,
}: MyRequestDetailHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="my-request-detail-header detail-modal-header-mobile flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 pb-3 pt-6">
      <div className="detail-modal-header-title min-w-0">
        <div className="my-request-detail-header__title uppercase">
          {title}
        </div>
      </div>
      <div className="detail-modal-header-actions flex shrink-0 flex-wrap items-center justify-end gap-2">
        {onGoToConversation && (
          <Button
            type="button"
            className="!bg-sky-400 !text-white hover:!bg-sky-500"
            onClick={onGoToConversation}
          >
            {t('social.goToConversation', 'Yazışmaya Git')}
          </Button>
        )}
        {isEditing ? (
          <>
            <Button type="button" variant="success" disabled={editSaving} onClick={onSaveEdit}>
              {editSaving ? t('common.saving', 'Kaydediliyor...') : t('common.save', 'Kaydet')}
            </Button>
            <Button type="button" variant="secondary" disabled={editSaving} onClick={onCancelEdit}>
              {t('common.cancel', 'Vazgeç')}
            </Button>
          </>
        ) : (
          <>
            {onEdit && (
              <Button
                type="button"
                className="inline-flex items-center gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={onEdit}
                aria-label={t('jobs.actions.edit', 'Düzenle')}
              >
                <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('jobs.actions.edit', 'Düzenle')}
              </Button>
            )}
            {showEditDisabled && (
              <DisabledActionButton
                className="inline-flex items-center gap-1.5 bg-emerald-700 text-white"
                hoverTitle={editDisabledTitle ?? t('jobs.actions.editUnavailable', 'Bu kayıtta düzenleme yapılamaz')}
              >
                <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('jobs.actions.edit', 'Düzenle')}
              </DisabledActionButton>
            )}
            {onCancel && (
              <Button
                type="button"
                variant="destructive"
                className="inline-flex items-center gap-1.5"
                onClick={onCancel}
                aria-label={t('jobs.actions.cancel', 'İptal Et')}
              >
                <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('jobs.actions.cancel', 'İptal Et')}
              </Button>
            )}
            {showCancelDisabled && !onCancel && (
              <DisabledActionButton
                variant="destructive"
                className="inline-flex items-center gap-1.5"
                hoverTitle={cancelDisabledTitle ?? t('jobs.actions.cancelUnavailable', 'Bu kayıt iptal edilemez')}
              >
                <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('jobs.actions.cancel', 'İptal Et')}
              </DisabledActionButton>
            )}
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="detail-print-action inline-flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
          onClick={onPrint}
          aria-label={t('common.print', 'Yazdır')}
        >
          <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          {t('common.print', 'Yazdır')}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="detail-modal-header-close flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
          aria-label={t('common.close', 'Kapat')}
        >
          <XIcon className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
