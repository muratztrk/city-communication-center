import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'

/** Ortak ek yükleme ilerleme çubuğu (AttachmentSection, Tamamla/İptal popup). */
export function AttachmentUploadProgressBar({
  progress,
  className,
}: {
  progress: number
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('w-36', className)} aria-label={t('attachments.uploadProgress', 'Yükleme ilerlemesi')}>
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
        <span>{t('attachments.uploading', 'Yükleniyor...')}</span>
        <span>%{progress}</span>
      </div>
      <div className="overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-1.5 rounded-full bg-[color:var(--color-primary)] transition-[width] duration-150"
          style={{ width: `${Math.max(progress, 4)}%` }}
        />
      </div>
    </div>
  )
}
