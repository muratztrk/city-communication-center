import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { SimpleImageAttachmentIcon } from './ui/SimpleImageAttachmentIcon'
import { SocialConversationMediaPreview } from './SocialConversationMediaPreview'
import { lowercaseFileExtension } from '../utils/fileNameDisplay'

interface WhatsAppOutboundAttachmentChipProps {
  fileName: string
  isImage: boolean
  previewUrl?: string | null
  compact?: boolean
  onDismiss?: () => void
  dismissDisabled?: boolean
  dismissLabel?: string
  caption?: string | null
  /** Opsiyonel; verilmezse dahili lightbox açılır. */
  onImageClick?: () => void
}

/** Taleplerim detay ek ikon rozetiyle aynı çerçeve (#6a758a88). */
const attachmentIconBadgeClass =
  'flex size-5 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-blue-700'

/** Giden WA ek chip — görselde ad alt satırda; X görsel sağ üstte (#6a7586af reopen). */
export function WhatsAppOutboundAttachmentChip({
  fileName,
  isImage,
  previewUrl,
  compact = false,
  onDismiss,
  dismissDisabled = false,
  dismissLabel = 'Vazgeç',
  caption,
  onImageClick,
}: WhatsAppOutboundAttachmentChipProps) {
  const displayName = lowercaseFileExtension(fileName)
  const FileIcon = isImage ? SimpleImageAttachmentIcon : FileText
  const iconClass = 'size-3'
  const nameClass = compact ? 'text-xs font-semibold' : 'text-sm font-semibold'
  const [previewOpen, setPreviewOpen] = useState(false)

  const openPreview = () => {
    if (onImageClick) {
      onImageClick()
      return
    }
    setPreviewOpen(true)
  }

  const nameRow = (
    <div className="flex min-w-0 items-center gap-2">
      <span className={attachmentIconBadgeClass}>
        <FileIcon className={iconClass} aria-hidden="true" />
      </span>
      <span className={`min-w-0 truncate ${nameClass}`}>{displayName}</span>
    </div>
  )

  const imagePreview = isImage && previewUrl ? (
    <div className="relative">
      <button
        type="button"
        onClick={openPreview}
        className="block w-full overflow-hidden rounded-lg border border-white/20"
      >
        <img
          src={previewUrl}
          alt={displayName}
          className={`w-full cursor-zoom-in object-contain bg-white/95 ${compact ? 'max-h-32' : 'max-h-44'}`}
        />
      </button>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissDisabled}
          className={`absolute right-1.5 top-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-colors hover:bg-black/70 disabled:opacity-60 ${compact ? 'size-5' : 'size-6'}`}
          aria-label={dismissLabel}
        >
          <X className={compact ? 'size-3' : 'size-3.5'} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  ) : null

  return (
    <div className="space-y-1.5">
      {isImage && previewUrl ? (
        <>
          {imagePreview}
          {nameRow}
          {!onImageClick && previewUrl ? (
            <SocialConversationMediaPreview
              open={previewOpen}
              objectUrl={previewUrl}
              mime="image/*"
              filename={displayName}
              onClose={() => setPreviewOpen(false)}
              onDownload={() => {
                const anchor = document.createElement('a')
                anchor.href = previewUrl
                anchor.download = displayName
                anchor.click()
              }}
            />
          ) : null}
        </>
      ) : (
        <div className="flex items-center gap-2">
          {nameRow}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              disabled={dismissDisabled}
              className={`ml-auto inline-flex shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-60 ${compact ? 'size-5' : 'size-6'}`}
              aria-label={dismissLabel}
            >
              <X className={compact ? 'size-3' : 'size-3.5'} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}
      {caption?.trim() ? (
        <p className={`whitespace-pre-wrap break-words ${compact ? 'text-xs' : 'text-sm'}`}>{caption.trim()}</p>
      ) : null}
    </div>
  )
}
