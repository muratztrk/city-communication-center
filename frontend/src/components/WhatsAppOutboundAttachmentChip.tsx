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

/** Giden WA ek chip — görselde ad üst satırda; hover büyüteç + tıklayınca lightbox. */
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
  const iconClass = compact ? 'size-3.5' : 'size-4'
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
    <div className="flex items-center gap-2">
      <FileIcon className={`${iconClass} shrink-0`} aria-hidden="true" />
      <span className={`min-w-0 truncate ${nameClass}`}>{displayName}</span>
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
  )

  const imagePreview = isImage && previewUrl ? (
    <button
      type="button"
      onClick={openPreview}
      className="block overflow-hidden rounded-lg border border-white/20"
    >
      <img
        src={previewUrl}
        alt={displayName}
        className={`w-full cursor-zoom-in object-contain bg-white/95 ${compact ? 'max-h-32' : 'max-h-44'}`}
      />
    </button>
  ) : null

  return (
    <div className="space-y-1.5">
      {isImage && previewUrl ? (
        <>
          {nameRow}
          {imagePreview}
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
        nameRow
      )}
      {caption?.trim() ? (
        <p className={`whitespace-pre-wrap break-words ${compact ? 'text-xs' : 'text-sm'}`}>{caption.trim()}</p>
      ) : null}
    </div>
  )
}
