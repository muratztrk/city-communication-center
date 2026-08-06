import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { Button } from './ui/button'
import { SocialConversationMediaPreview } from './SocialConversationMediaPreview'
import { WhatsAppOutboundAttachmentChip } from './WhatsAppOutboundAttachmentChip'
import { socialMediaFilename } from '../utils/socialConversationContent'
import { lowercaseFileExtension } from '../utils/fileNameDisplay'

interface SocialConversationMediaBubbleProps {
  socialMessageId: string
  entryId: string
  mediaMimeType?: string | null
  direction?: 'Inbound' | 'Outbound'
  citizenPhone?: string | null
  onAddAsAttachment?: (file: File) => void
  /** Gönderilmiş giden ek: pending önizleme gibi yalnız dosya adı + ikon (card #2399). */
  sentChip?: boolean
  /** Vatandaş Talebi modalında Talep Eki buton hizası (card #2401/#2402). */
  requestAttachmentLayout?: boolean
  /** Gönderim sırasındaki orijinal dosya adı — `[Dosya eki: …]` içeriğinden (card #2385). */
  displayFilename?: string | null
  /** Modal/kompakt konuşmada giden ek adı daha küçük (#2209). */
  compactChip?: boolean
}

export function SocialConversationMediaBubble({
  socialMessageId,
  entryId,
  mediaMimeType,
  direction = 'Inbound',
  citizenPhone,
  onAddAsAttachment,
  sentChip = false,
  requestAttachmentLayout = false,
  displayFilename,
  compactChip = false,
}: SocialConversationMediaBubbleProps) {
  const { t } = useTranslation()
  const mime = mediaMimeType ?? 'application/octet-stream'
  const rawFilename = displayFilename?.trim() || socialMediaFilename(entryId, mime, citizenPhone)
  const filename = direction === 'Inbound' ? rawFilename : lowercaseFileExtension(rawFilename)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null

    void api.downloadSocialMedia(socialMessageId, entryId)
      .then(blob => {
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
        setError(null)
      })
      .catch(loadError => {
        if (!cancelled) {
          setObjectUrl(null)
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [entryId, socialMessageId, t])

  const downloadBlob = async () => api.downloadSocialMedia(socialMessageId, entryId)

  const handleDownload = async () => {
    const blob = await downloadBlob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleAddAsAttachment = async () => {
    if (!onAddAsAttachment) return
    const blob = await downloadBlob()
    const file = new File([blob], filename, { type: blob.type || mime })
    onAddAsAttachment(file)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs">
        <Loader2 className="size-4 animate-spin" />
        {t('common.loading', 'Yükleniyor...')}
      </div>
    )
  }

  if (error || !objectUrl) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs italic opacity-80">{t('whatsapp.mediaLoadFailed', 'Medya yüklenemedi')}</span>
        <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => void handleDownload()}>
          <Download className="size-3.5" />
          {t('attachments.download', 'İndir')}
        </Button>
      </div>
    )
  }

  const isImage = mime.startsWith('image/')
  const showAddAsAttachment = direction === 'Inbound' && Boolean(onAddAsAttachment)
    && !mime.startsWith('text/')
  const canPreviewInline = mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')

  const addAsAttachmentButton = showAddAsAttachment ? (
    <Button type="button" size="sm" variant="success" className="h-7 px-2 text-[11px]" onClick={() => void handleAddAsAttachment()}>
      {t('whatsapp.addAsRequestAttachment', 'Talep Eki Olarak Ekle')}
    </Button>
  ) : null

  if (sentChip) {
    return (
      <>
        <WhatsAppOutboundAttachmentChip
          fileName={filename}
          isImage={isImage}
          previewUrl={isImage ? objectUrl : null}
          compact={compactChip}
          onImageClick={isImage ? () => setPreviewOpen(true) : undefined}
        />
        <SocialConversationMediaPreview
          open={previewOpen}
          objectUrl={objectUrl}
          mime={mime}
          filename={filename}
          onClose={() => setPreviewOpen(false)}
          onDownload={() => void handleDownload()}
        />
      </>
    )
  }

  return (
    <div className="space-y-1.5">
      {isImage ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="block overflow-hidden rounded-xl border border-white/20"
        >
          <img
            src={objectUrl}
            alt={filename}
            className="max-w-[16rem] max-h-48 cursor-zoom-in object-cover"
          />
        </button>
      ) : mime.startsWith('video/') ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="block overflow-hidden rounded-xl border border-white/20"
        >
          <video src={objectUrl} className="pointer-events-none max-h-48 max-w-[16rem]" />
        </button>
      ) : mime.startsWith('audio/') ? (
        <div className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2">
          <Volume2 className="size-4 shrink-0" />
          <audio src={objectUrl} controls className="h-7" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleDownload()}
          className={`flex items-center gap-1.5 rounded-xl bg-black/10 underline-offset-2 hover:underline ${
            direction === 'Inbound' ? 'px-2 py-1 text-[10px] font-medium' : 'gap-2 px-3 py-2 text-sm font-semibold'
          }`}
        >
          <FileText className={`shrink-0 ${direction === 'Inbound' ? 'size-3' : 'size-4'}`} />
          <span className="min-w-0 truncate">{filename}</span>
        </button>
      )}

      {requestAttachmentLayout && isImage && showAddAsAttachment ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {canPreviewInline ? (
              <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => setPreviewOpen(true)}>
                {t('attachments.preview', 'Önizle')}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => void handleDownload()}>
              <Download className="size-3.5" />
              {t('attachments.download', 'İndir')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {addAsAttachmentButton}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {canPreviewInline ? (
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => setPreviewOpen(true)}>
              {t('attachments.preview', 'Önizle')}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => void handleDownload()}>
            <Download className="size-3.5" />
            {t('attachments.download', 'İndir')}
          </Button>
          {requestAttachmentLayout && !isImage ? addAsAttachmentButton : null}
          {!requestAttachmentLayout ? addAsAttachmentButton : null}
        </div>
      )}

      <SocialConversationMediaPreview
        open={previewOpen}
        objectUrl={objectUrl}
        mime={mime}
        filename={filename}
        onClose={() => setPreviewOpen(false)}
        onDownload={() => void handleDownload()}
      />
    </div>
  )
}
