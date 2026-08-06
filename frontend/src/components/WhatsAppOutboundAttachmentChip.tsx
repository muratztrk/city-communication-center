import { FileText, X } from 'lucide-react'
import { SimpleImageAttachmentIcon } from './ui/SimpleImageAttachmentIcon'
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
  onImageClick?: () => void
}

/** Giden WA ek chip — iletilmiş ve beklemedeki önizleme aynı görünüm (#2267/#2209). */
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

  return (
    <div className="space-y-1.5">
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
      {isImage && previewUrl ? (
        onImageClick ? (
          <button
            type="button"
            onClick={onImageClick}
            className="block overflow-hidden rounded-lg border border-white/20"
          >
            <img
              src={previewUrl}
              alt={displayName}
              className={`w-full cursor-zoom-in object-contain bg-white/95 ${compact ? 'max-h-24' : 'max-h-36'}`}
            />
          </button>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/20">
            <img
              src={previewUrl}
              alt={displayName}
              className={`w-full object-contain bg-white/95 ${compact ? 'max-h-24' : 'max-h-36'}`}
            />
          </div>
        )
      ) : null}
      {caption?.trim() ? (
        <p className={`whitespace-pre-wrap break-words ${compact ? 'text-xs' : 'text-sm'}`}>{caption.trim()}</p>
      ) : null}
    </div>
  )
}
