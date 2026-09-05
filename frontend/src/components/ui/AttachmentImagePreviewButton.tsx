import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { attachmentFileExtension } from '../../utils/attachmentAccept'
import { SocialConversationMediaPreview } from '../SocialConversationMediaPreview'
import { Button } from './button'
import { ConfirmDialog, type ConfirmDialogState } from './confirm-dialog'
import type { AttachmentOwnerKind } from '../../utils/attachmentMissing'
import { resolveAttachmentMissingMessage } from '../../utils/attachmentMissing'

function isImageFileName(name: string): boolean {
  return ['.jpg', '.jpeg', '.png'].includes(attachmentFileExtension(name))
}

function mimeFromFileName(name: string): string {
  const ext = attachmentFileExtension(name)
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  return 'application/octet-stream'
}

/** WA gelen görsel ile aynı yeşil Önizle; lightbox body portal (#2709). */
export function AttachmentImagePreviewButton({
  attachmentId,
  fileName,
  className,
  ownerKind = 'job',
}: {
  attachmentId: string
  fileName: string
  className?: string
  ownerKind?: AttachmentOwnerKind
}) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<{ url: string; mime: string; fileName: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [missingDialog, setMissingDialog] = useState<ConfirmDialogState | null>(null)

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url)
  }, [preview?.url])

  if (!isImageFileName(fileName)) return null

  const openPreview = async () => {
    setLoading(true)
    try {
      const blob = await api.downloadAttachment(attachmentId)
      const url = URL.createObjectURL(blob)
      setPreview(current => {
        if (current?.url) URL.revokeObjectURL(current.url)
        return {
          url,
          mime: blob.type?.startsWith('image/') ? blob.type : mimeFromFileName(fileName),
          fileName,
        }
      })
    } catch (error) {
      setMissingDialog({
        title: t('attachments.missingTitle', 'Ek bulunamadı'),
        message: resolveAttachmentMissingMessage(error, ownerKind),
        confirmLabel: t('common.ok', 'Tamam'),
        hideCancel: true,
        onConfirm: () => {},
      })
    } finally {
      setLoading(false)
    }
  }

  const closePreview = () => {
    setPreview(current => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return null
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="success"
        className={className ?? 'h-5 shrink-0 gap-0.5 px-1.5 text-[10px]'}
        disabled={loading}
        onClick={() => void openPreview()}
      >
        <Eye className="size-3" aria-hidden="true" />
        {t('attachments.preview', 'Ön İzle')}
      </Button>
      {preview ? (
        <SocialConversationMediaPreview
          open
          objectUrl={preview.url}
          mime={preview.mime}
          filename={preview.fileName}
          onClose={closePreview}
          onDownload={() => {
            const link = document.createElement('a')
            link.href = preview.url
            link.download = preview.fileName
            link.click()
          }}
        />
      ) : null}
      <ConfirmDialog state={missingDialog} onClose={() => setMissingDialog(null)} />
    </>
  )
}
