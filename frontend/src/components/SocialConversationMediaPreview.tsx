import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { ModalBackdrop } from './ui/modal-backdrop'
import { ModalCloseButton } from './ui/modal-close-button'

interface SocialConversationMediaPreviewProps {
  open: boolean
  objectUrl: string
  mime: string
  filename: string
  onClose: () => void
  onDownload: () => void
}

export function SocialConversationMediaPreview({
  open,
  objectUrl,
  mime,
  filename,
  onClose,
  onDownload,
}: SocialConversationMediaPreviewProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <ModalBackdrop className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4">
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-950/95 shadow-2xl ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-label={filename}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold text-white">{filename}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" size="sm" variant="secondary" className="h-8 px-2.5 text-xs" onClick={onDownload}>
              <Download className="size-3.5" />
              {t('attachments.download', 'İndir')}
            </Button>
            <ModalCloseButton onClick={onClose} label={t('common.close', 'Kapat')} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          {mime.startsWith('image/') ? (
            <img
              src={objectUrl}
              alt={filename}
              className="max-h-[78vh] max-w-full rounded-xl object-contain"
            />
          ) : mime.startsWith('video/') ? (
            <video src={objectUrl} controls autoPlay className="max-h-[78vh] max-w-full rounded-xl" />
          ) : mime.startsWith('audio/') ? (
            <audio src={objectUrl} controls autoPlay className="w-full max-w-xl" />
          ) : (
            <p className="text-sm text-white/80">{t('attachments.previewUnavailable', 'Bu dosya türü için önizleme yok.')}</p>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}
