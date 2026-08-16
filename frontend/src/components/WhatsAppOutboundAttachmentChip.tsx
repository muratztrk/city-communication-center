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

/** Taleplerim detay ek ikon rozeti — yalnız doküman satırında; ikon yeşil (#6a75958d). */
const attachmentIconBadgeClass =
  'flex size-5 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700'

/** Giden WA ek chip — görselde ad altta; X görsel üst satır sağında (#6a7586af reopen). */
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
  const nameClass = compact ? 'text-[11px] font-semibold' : 'text-xs font-semibold'
  const [previewOpen, setPreviewOpen] = useState(false)
  const dismissBtnClass = `inline-flex shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-60 ${compact ? 'size-5' : 'size-6'}`

  const openPreview = () => {
    if (onImageClick) {
      onImageClick()
      return
    }
    setPreviewOpen(true)
  }

  const nameRow = (
    <div className="flex min-w-0 items-center gap-2">
      {isImage ? (
        <FileIcon className={`${iconClass} shrink-0 text-white/90`} aria-hidden="true" />
      ) : (
        <span className={attachmentIconBadgeClass}>
          <FileIcon className={iconClass} aria-hidden="true" />
        </span>
      )}
      <span className={`min-w-0 truncate ${nameClass}`}>{displayName}</span>
    </div>
  )

  const dismissButton = onDismiss ? (
    <button
      type="button"
      onClick={onDismiss}
      disabled={dismissDisabled}
      className={dismissBtnClass}
      aria-label={dismissLabel}
    >
      <X className={compact ? 'size-3' : 'size-3.5'} aria-hidden="true" />
    </button>
  ) : null

  const imagePreview = isImage && previewUrl ? (
    <div className="space-y-1">
      {dismissButton ? <div className="flex justify-end">{dismissButton}</div> : null}
      <button
        type="button"
        onClick={openPreview}
        className="block w-full overflow-hidden rounded-lg border border-white/20"
      >
        <img
          src={previewUrl}
          alt={displayName}
          className={`mx-auto w-full max-w-[11rem] cursor-zoom-in object-contain bg-white/95 ${compact ? 'max-h-28' : 'max-h-32'}`}
        />
      </button>
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
          {dismissButton ? <div className="ml-auto">{dismissButton}</div> : null}
        </div>
      )}
      {caption?.trim() ? (
        <p className={`whitespace-pre-wrap break-words ${compact ? 'text-xs' : 'text-sm'}`}>{caption.trim()}</p>
      ) : null}
    </div>
  )
}
