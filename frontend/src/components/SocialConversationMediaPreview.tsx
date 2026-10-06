import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, ZoomIn, ZoomOut } from 'lucide-react'
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
  const isImage = mime.startsWith('image/')

  if (!open) return null

  return createPortal(
    <ModalBackdrop className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4">
      <div
        className="relative flex max-h-[70vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-950/95 shadow-2xl ring-1 ring-white/10"
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

        <div className="group relative flex min-h-0 w-full flex-1 flex-col items-center overflow-auto p-4">
          {isImage ? (
            <PreviewZoomImage key={objectUrl} objectUrl={objectUrl} filename={filename} />
          ) : mime.startsWith('video/') ? (
            <video src={objectUrl} controls autoPlay className="max-h-[56vh] max-w-full rounded-xl" />
          ) : mime.startsWith('audio/') ? (
            <audio src={objectUrl} controls autoPlay className="w-full max-w-xl" />
          ) : (
            <p className="text-sm text-white/80">{t('attachments.previewUnavailable', 'Bu dosya türü için önizleme yok.')}</p>
          )}
        </div>
      </div>
    </ModalBackdrop>,
    document.body,
  )
}

function PreviewZoomImage({ objectUrl, filename }: { objectUrl: string; filename: string }) {
  const { t } = useTranslation()
  const [scale, setScale] = useState(1)
  const zoomIn = () => setScale(current => Math.min(3, Math.round((current + 0.5) * 10) / 10))
  const zoomOut = () => setScale(current => Math.max(1, Math.round((current - 0.5) * 10) / 10))

  return (
    <>
      <img
        src={objectUrl}
        alt={filename}
        onClick={() => setScale(current => (current === 1 ? 2 : 1))}
        className={`rounded-xl object-contain ${scale === 1 ? 'max-h-[56vh] max-w-full cursor-zoom-in' : 'h-auto max-w-none cursor-zoom-out'}`}
        style={scale === 1 ? undefined : { width: `${scale * 100}%` }}
      />
      <div className="pointer-events-none sticky bottom-2 z-10 -mt-11 flex h-0 w-full shrink-0 justify-center self-stretch overflow-visible opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="flex gap-2 rounded-full bg-black/70 p-1 shadow-lg ring-1 ring-white/15">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('attachments.zoomOut', 'Küçült')}
            disabled={scale <= 1}
            onClick={zoomOut}
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('attachments.zoomIn', 'Büyüt')}
            disabled={scale >= 3}
            onClick={zoomIn}
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  )
}
