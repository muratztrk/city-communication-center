import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { Button } from './ui/button'
import { socialMediaFilename } from '../utils/socialConversationContent'

interface SocialConversationMediaBubbleProps {
  socialMessageId: string
  entryId: string
  mediaMimeType?: string | null
  direction?: 'Inbound' | 'Outbound'
  citizenPhone?: string | null
  onAddAsAttachment?: (file: File) => void
}

export function SocialConversationMediaBubble({
  socialMessageId,
  entryId,
  mediaMimeType,
  direction = 'Inbound',
  citizenPhone,
  onAddAsAttachment,
}: SocialConversationMediaBubbleProps) {
  const { t } = useTranslation()
  const mime = mediaMimeType ?? 'application/octet-stream'
  const filename = socialMediaFilename(entryId, mime, citizenPhone)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-xl text-xs">
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

  const mediaLabel = mime.split('/')[1]?.toUpperCase() || t('attachments.file', 'Dosya')
  const showAddAsAttachment = direction === 'Inbound' && Boolean(onAddAsAttachment)
    && !mime.startsWith('text/')

  return (
    <div className="space-y-1.5">
      {mime.startsWith('image/') ? (
        <img
          src={objectUrl}
          alt={mediaLabel}
          className="max-w-[16rem] max-h-48 rounded-xl object-cover border border-white/20 cursor-pointer"
          onClick={() => void handleDownload()}
        />
      ) : mime.startsWith('video/') ? (
        <video src={objectUrl} controls className="max-w-[16rem] max-h-48 rounded-xl border border-white/20" />
      ) : mime.startsWith('audio/') ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-xl">
          <Volume2 className="size-4 shrink-0" />
          <audio src={objectUrl} controls className="h-7" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleDownload()}
          className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-xl text-sm font-semibold underline-offset-2 hover:underline"
        >
          <FileText className="size-4 shrink-0" />
          {mediaLabel}
        </button>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => void handleDownload()}>
          <Download className="size-3.5" />
          {t('attachments.download', 'İndir')}
        </Button>
        {showAddAsAttachment ? (
          <Button type="button" size="sm" variant="success" className="h-7 px-2 text-[11px]" onClick={() => void handleAddAsAttachment()}>
            {t('whatsapp.addAsRequestAttachment', 'Talep Eki Olarak Ekle')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
