import { useCallback, useEffect, useRef, useState } from 'react'
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
          <div className="flex shrink-0 items-center gap-3">
            {isImage ? (
              <p className="text-xs font-normal text-white">
                {t('attachments.zoomHint', 'CTRL+Mouse Orta Tuş ile zoom yapabilirsiniz.')}
              </p>
            ) : null}
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

const MIN_ZOOM = 1
const MAX_ZOOM = 2.25
const ZOOM_STEP = 0.25
const CLICK_ZOOM = 1.5

function PreviewZoomImage({ objectUrl, filename }: { objectUrl: string; filename: string }) {
  const { t } = useTranslation()
  const imageRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [fittedWidth, setFittedWidth] = useState<number | null>(null)

  const applyScale = useCallback((next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100))
    if (clamped <= MIN_ZOOM) {
      setScale(MIN_ZOOM)
      return
    }
    if (scale <= MIN_ZOOM) {
      const width = imageRef.current?.clientWidth ?? 0
      if (width <= 0) return
      setFittedWidth(width)
    }
    setScale(clamped)
  }, [scale])

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const direction = event.deltaY < 0 ? 1 : -1
      applyScale(scale + direction * ZOOM_STEP)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const zoomInKey = event.key === '+' || event.key === '=' || event.key === 'Add'
      const zoomOutKey = event.key === '-' || event.key === '_' || event.key === 'Subtract'
      if (!zoomInKey && !zoomOutKey) return
      event.preventDefault()
      applyScale(scale + (zoomInKey ? ZOOM_STEP : -ZOOM_STEP))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [applyScale, scale])

  const zoomed = scale > MIN_ZOOM && fittedWidth != null
  const zoomFill = ((scale - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100

  return (
    <>
      <img
        ref={imageRef}
        src={objectUrl}
        alt={filename}
        onClick={() => applyScale(scale === MIN_ZOOM ? CLICK_ZOOM : MIN_ZOOM)}
        className={`rounded-xl object-contain ${scale === MIN_ZOOM ? 'max-h-[56vh] max-w-full cursor-zoom-in' : 'h-auto max-w-none cursor-zoom-out'}`}
        style={zoomed ? { width: Math.round(fittedWidth * scale) } : undefined}
      />
      <div className="pointer-events-none sticky bottom-2 z-10 -mt-11 flex h-0 w-full shrink-0 justify-center self-stretch overflow-visible opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="flex gap-2 rounded-full bg-black/70 p-1 shadow-lg ring-1 ring-white/15">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('attachments.zoomOut', 'Küçült')}
            disabled={scale <= MIN_ZOOM}
            onClick={() => applyScale(scale - ZOOM_STEP)}
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('attachments.zoomIn', 'Büyüt')}
            disabled={scale >= MAX_ZOOM}
            onClick={() => applyScale(scale + ZOOM_STEP)}
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 mt-3 h-1.5 w-full shrink-0 self-stretch overflow-hidden rounded-full bg-white/20" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${zoomFill}%` }} />
      </div>
    </>
  )
}
