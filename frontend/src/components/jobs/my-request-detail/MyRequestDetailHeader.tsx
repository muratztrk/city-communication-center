import { Pencil, Printer, X as XIcon, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../ui/button'
import { DisabledActionButton } from '../../ui/DisabledActionButton'

interface MyRequestDetailHeaderProps {
  title: string
  onClose: () => void
  onPrint: () => void
  onCancel?: () => void
  onEdit?: () => void
  onGoToConversation?: () => void
  showEditDisabled?: boolean
  editDisabledTitle?: string
}

export function MyRequestDetailHeader({
  title,
  onClose,
  onPrint,
  onCancel,
  onEdit,
  onGoToConversation,
  showEditDisabled,
  editDisabledTitle,
}: MyRequestDetailHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="my-request-detail-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
      <div className="min-w-0">
        <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
          {title}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {onGoToConversation && (
          <Button
            type="button"
            className="!bg-sky-400 !text-white hover:!bg-sky-500"
            onClick={onGoToConversation}
          >
            {t('social.goToConversation', 'Yazışmaya Git')}
          </Button>
        )}
        {onEdit && (
          <Button
            type="button"
            className="inline-flex items-center gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
            onClick={onEdit}
            aria-label={t('jobs.actions.edit', 'Düzenle')}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('jobs.actions.edit', 'Düzenle')}
          </Button>
        )}
        {showEditDisabled && (
          <DisabledActionButton
            className="inline-flex items-center gap-1.5 bg-emerald-700 text-white"
            hoverTitle={editDisabledTitle ?? t('jobs.actions.editUnavailable', 'Bu kayıtta düzenleme yapılamaz')}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('jobs.actions.edit', 'Düzenle')}
          </DisabledActionButton>
        )}
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            className="inline-flex items-center gap-1.5 border border-red-500 bg-white text-red-600 hover:bg-red-50"
            onClick={onCancel}
            aria-label={t('jobs.actions.cancel', 'İptal Et')}
          >
            <XCircle className="size-3.5" aria-hidden="true" />
            {t('jobs.actions.cancel', 'İptal Et')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
          onClick={onPrint}
          aria-label={t('common.print', 'Yazdır')}
        >
          <Printer className="size-3.5" aria-hidden="true" />
          {t('common.print', 'Yazdır')}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
          aria-label={t('common.close', 'Kapat')}
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
