import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Attachment } from '../../types/platform'

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

interface AttachmentSectionProps {
  attachments: Attachment[]
  onUpload: (file: File) => Promise<void>
  onDelete: (attachmentId: string) => Promise<void>
  disabled?: boolean
}

export function AttachmentSection({ attachments, onUpload, onDelete, disabled }: AttachmentSectionProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const validate = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_TYPES.includes(file.type)) {
      return t('attachments.errorType', 'Sadece JPG, PNG, GIF ve WebP dosyaları yüklenebilir.')
    }
    if (file.size > MAX_SIZE) {
      return t('attachments.errorSize', 'Dosya boyutu 5 MB\'ı aşamaz.')
    }
    return null
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setValidationError(null)
    for (const file of Array.from(files)) {
      const error = validate(file)
      if (error) {
        setValidationError(error)
        return
      }
      setUploading(true)
      try {
        await onUpload(file)
      } catch (err) {
        setValidationError(err instanceof Error ? err.message : String(err))
      } finally {
        setUploading(false)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (attachmentId: string) => {
    if (!window.confirm(t('attachments.deleteConfirm', 'Bu eki silmek istediğinize emin misiniz?'))) return
    setDeletingId(attachmentId)
    try {
      await onDelete(attachmentId)
    } finally {
      setDeletingId(null)
    }
  }

  const isDisabled = disabled || uploading

  return (
    <div className="page-stack">
      {/* Upload zone */}
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label={t('attachments.uploadLabel', 'Fotoğraf Ekle')}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-sm transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
        } ${isDisabled ? 'pointer-events-none opacity-50' : ''}`}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && !isDisabled && fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          if (!isDisabled) void handleFiles(e.dataTransfer.files)
        }}
      >
        <span className="font-semibold text-slate-700">
          {uploading
            ? t('attachments.uploading', 'Yükleniyor...')
            : t('attachments.dragHint', 'Dosyayı buraya sürükleyin veya tıklayın')}
        </span>
        <span className="mt-1 text-xs text-slate-400">
          {t('attachments.uploadHint', 'JPG, PNG, GIF, WebP — maks. 5 MB')}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp"
          multiple
          className="hidden"
          disabled={isDisabled}
          onChange={e => void handleFiles(e.target.files)}
        />
      </div>

      {validationError && (
        <div className="alert alert-error text-sm">{validationError}</div>
      )}

      {/* Thumbnail gallery */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {attachments.map(att => (
            <div
              key={att.attachmentId}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <a href={att.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={att.url}
                  alt={att.fileName}
                  className="h-24 w-full object-cover"
                  loading="lazy"
                />
              </a>
              <div className="absolute inset-0 flex flex-col items-start justify-end bg-black/0 p-1 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                <span className="max-w-full truncate rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                  {att.fileName}
                </span>
              </div>
              <button
                type="button"
                title={t('attachments.deleteConfirm', 'Sil')}
                disabled={deletingId === att.attachmentId || isDisabled}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-red-500 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-white disabled:cursor-not-allowed"
                onClick={() => void handleDelete(att.attachmentId)}
              >
                {deletingId === att.attachmentId ? (
                  <span className="text-[10px]">…</span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
