import { Download, FileText, Paperclip } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { Attachment } from '../../types/platform'
import { lowercaseFileExtension } from '../../utils/fileNameDisplay'
import { ConfirmDialog } from './confirm-dialog'
import { SimpleImageAttachmentIcon } from './SimpleImageAttachmentIcon'

// Resim (JPG/PNG), PDF ve Office uzantıları; gif/webp kaldırıldı (card 539).
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(',')
const MAX_SIZE = 5 * 1024 * 1024

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function isImageFile(name: string): boolean {
  return ['.jpg', '.jpeg', '.png'].includes(fileExtension(name))
}

function getAttachmentIcon(fileName: string) {
  // Görsel ekler belge ikonundan ayrışsın; sade çerçeve, boyut aynı (card #1637 reopen).
  return isImageFile(fileName) ? SimpleImageAttachmentIcon : FileText
}

interface AttachmentSectionProps {
  attachments: Attachment[]
  onUpload?: (file: File, onProgress?: (percent: number) => void) => Promise<void>
  onDelete?: (attachmentId: string) => Promise<void>
  onDownload?: (attachmentId: string, fileName: string) => void
  disabled?: boolean
  // Salt-okunur: yükleme alanı ve silme gizlenir; boşken emptyText gösterilir (card 537).
  readOnly?: boolean
  emptyText?: string
  compact?: boolean
  /** gallery: kutucuk önizleme; list: yalnızca dosya adı bağlantıları; rich-list: ikon kutusu + ad + boyut (Taleplerim detay). */
  displayMode?: 'gallery' | 'list' | 'rich-list'
  /** Upload açık olsa bile silme aksiyonunu yalnızca gerçek düzenleme modunda göstermek için. */
  showDeleteActions?: boolean
}

export function AttachmentSection({ attachments, onUpload, onDelete, onDownload, disabled, readOnly = false, emptyText, compact = false, displayMode = 'gallery', showDeleteActions }: AttachmentSectionProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUploadProgress, setShowUploadProgress] = useState(false)
  const uploadProgressDelayRef = useRef<number | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const clearUploadProgressDelay = () => {
    if (uploadProgressDelayRef.current !== null) {
      window.clearTimeout(uploadProgressDelayRef.current)
      uploadProgressDelayRef.current = null
    }
  }

  useEffect(() => () => {
    if (uploadProgressDelayRef.current !== null) {
      window.clearTimeout(uploadProgressDelayRef.current)
    }
  }, [])

  const validate = (file: File): string | null => {
    if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
      return t('attachments.errorType', 'Yalnızca resim (JPG, PNG), PDF ve Office dosyaları yüklenebilir.')
    }
    if (file.size > MAX_SIZE) {
      return t('attachments.errorSize', 'Dosya boyutu 5 MB\'ı aşamaz.')
    }
    return null
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setValidationError(null)
    const selectedFiles = Array.from(files)
    for (const file of selectedFiles) {
      const error = validate(file)
      if (error) {
        setValidationError(error)
        // Aynı dosya(lar) yeniden seçilebilsin; değer temizlenmezse change tetiklenmez.
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
    }
    // Tek zamanlayıcı + dosyalar arası birleşik yüzde: her dosya tek başına 1 sn altında
    // yüklense bile toplam süre 1 sn'yi aşarsa progress bar görünür (card #1610 reopen).
    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0) || 1
    let uploadedBytes = 0
    setUploading(true)
    setUploadProgress(0)
    setShowUploadProgress(false)
    clearUploadProgressDelay()
    uploadProgressDelayRef.current = window.setTimeout(() => {
      uploadProgressDelayRef.current = null
      setShowUploadProgress(true)
    }, 1_000)
    try {
      for (const file of selectedFiles) {
        try {
          await onUpload?.(file, percent => {
            setUploadProgress(Math.min(100, Math.round(((uploadedBytes + (percent / 100) * file.size) / totalBytes) * 100)))
          })
        } catch (err) {
          setValidationError(err instanceof Error ? err.message : String(err))
        }
        uploadedBytes += file.size
        setUploadProgress(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)))
      }
    } finally {
      clearUploadProgressDelay()
      setShowUploadProgress(false)
      setUploading(false)
      setUploadProgress(0)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = (attachmentId: string) => {
    setPendingDeleteId(attachmentId)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    const attachmentId = pendingDeleteId
    setDeletingId(attachmentId)
    try {
      await onDelete?.(attachmentId)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (attachment: Attachment) => {
    if (onDownload) {
      onDownload(attachment.attachmentId, attachment.fileName)
      return
    }
    setValidationError(null)
    setDownloadingId(attachment.attachmentId)
    try {
      const file = await api.downloadAttachment(attachment.attachmentId)
      const downloadUrl = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = attachment.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000)
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : t('attachments.downloadFailed', 'Ek indirilemedi.'))
    } finally {
      setDownloadingId(null)
    }
  }

  const isDisabled = disabled || uploading
  const galleryClassName = compact
    ? 'grid grid-cols-[repeat(auto-fit,minmax(4.75rem,1fr))] gap-2'
    : 'grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-3'
  const previewHeightClassName = compact ? 'h-16' : 'h-24'
  // Salt-okunur rich-list de düzenleme moduyla aynı sunumu kullanır: yan yana iki kolon,
  // çerçevesiz, mavi dosya adı, iki satırı aşınca scroll (cards #1614/#1617 reopen).
  const sectionClassName = displayMode === 'rich-list'
    ? (readOnly ? 'page-stack attachment-section--rich-view' : 'page-stack attachment-section--rich-edit')
    : 'page-stack'
  const canShowDeleteActions = !readOnly && (showDeleteActions ?? true)

  return (
    <div className={sectionClassName}>
      {/* Upload action — salt-okunur modda gizli (card 537). */}
      {!readOnly && (
        <div className="attachment-upload-zone">
          <button
            type="button"
            aria-label={t('attachments.uploadLabel', 'Fotoğraf Ekle')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-3.5 text-emerald-700" aria-hidden="true" />
            {uploading ? t('attachments.uploading', 'Yükleniyor...') : t('attachments.addFile', 'Dosya ekle')}
          </button>
          {uploading && showUploadProgress && (
            <div className="mt-2 w-36" aria-label={t('attachments.uploadProgress', 'Yükleme ilerlemesi')}>
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>{t('attachments.uploading', 'Yükleniyor...')}</span>
                <span>%{uploadProgress}</span>
              </div>
              <div className="overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-1.5 rounded-full bg-[color:var(--color-primary)] transition-[width] duration-150"
                  style={{ width: `${Math.max(uploadProgress, 4)}%` }}
                />
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            className="hidden"
            disabled={isDisabled}
            onChange={e => void handleFiles(e.target.files)}
          />
        </div>
      )}

      {validationError && (
        <div className="alert alert-error text-sm">{validationError}</div>
      )}

      {/* Salt-okunur ve hiç ek yoksa açıklayıcı metin (card 537). */}
      {readOnly && attachments.length === 0 && emptyText && (
        <p className="text-sm text-slate-400">{emptyText}</p>
      )}

      {/* Dosya listesi — Talep Detayları ve görev tamamlama paneliyle aynı görünüm (card #855). */}
      {attachments.length > 0 && displayMode === 'rich-list' && (
        <ul className="attachment-rich-list">
          {attachments.map(att => {
            const Icon = getAttachmentIcon(att.fileName)
            return (
            <li
              key={att.attachmentId}
              className={readOnly
                ? 'group flex min-w-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5'
                : 'group flex min-w-0 items-center gap-0.5 px-1 py-1'}
            >
              <div className={`flex size-5 shrink-0 items-center justify-center text-emerald-700 ${readOnly ? 'rounded-md border border-emerald-100 bg-emerald-50' : ''}`}>
                <Icon className="size-3" aria-hidden="true" />
              </div>
              <button
                type="button"
                className="min-w-0 flex-1 text-left disabled:cursor-wait"
                disabled={downloadingId === att.attachmentId}
                onClick={() => void handleDownload(att)}
              >
                <span className="block truncate text-[11px] font-normal text-slate-900 hover:text-slate-700">
                  {downloadingId === att.attachmentId ? t('attachments.downloading', 'Yükleniyor...') : lowercaseFileExtension(att.fileName)}
                </span>
              </button>
              {canShowDeleteActions && (
                <button
                  type="button"
                  title={t('attachments.deleteConfirm', 'Sil')}
                  disabled={deletingId === att.attachmentId || isDisabled}
                  className="shrink-0 text-xs font-medium text-red-500 hover:text-red-600 disabled:cursor-not-allowed"
                  onClick={() => void handleDelete(att.attachmentId)}
                >
                  {deletingId === att.attachmentId ? '…' : t('common.delete', 'Sil')}
                </button>
              )}
            </li>
            )
          })}
        </ul>
      )}

      {attachments.length > 0 && displayMode === 'list' && (
        <ul className="space-y-1.5 text-[11px] leading-4">
          {attachments.map(att => {
            const Icon = getAttachmentIcon(att.fileName)
            return (
            <li key={att.attachmentId} className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700">
                <Icon className="size-3" aria-hidden="true" />
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 break-words text-left text-[10px] font-normal text-slate-900 hover:text-slate-700 disabled:cursor-wait"
                disabled={downloadingId === att.attachmentId}
                onClick={() => void handleDownload(att)}
              >
                {downloadingId === att.attachmentId ? t('attachments.downloading', 'Yükleniyor...') : att.fileName}
              </button>
              {canShowDeleteActions && (
                <button
                  type="button"
                  title={t('attachments.deleteConfirm', 'Sil')}
                  disabled={deletingId === att.attachmentId || isDisabled}
                  className="shrink-0 text-[10px] font-medium text-red-500 hover:text-red-600 disabled:cursor-not-allowed"
                  onClick={() => void handleDelete(att.attachmentId)}
                >
                  {deletingId === att.attachmentId ? '…' : t('common.delete', 'Sil')}
                </button>
              )}
            </li>
            )
          })}
        </ul>
      )}

      {/* Thumbnail gallery */}
      {attachments.length > 0 && displayMode === 'gallery' && (
        <div className={galleryClassName}>
          {attachments.map(att => (
            (() => {
              const Icon = getAttachmentIcon(att.fileName)
              return (
            <div
              key={att.attachmentId}
              className="group relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              {/* Önizleme (resim küçük görseli) kaldırıldı; yüklenen her dosya yalnızca adıyla gösterilir (card 630).
                  Tüm kutucuk kimlik doğrulamalı indirmeyi tetikler: eski statik /uploads linki dosyayı
                  indirmek yerine tarayıcıda açıyordu, kullanıcı "inmiyor" diyordu (card 631). */}
              <button
                type="button"
                title={t('attachments.download', 'İndir')}
                aria-label={t('attachments.downloadFile', '{{fileName}} dosyasını indir', { fileName: att.fileName })}
                disabled={downloadingId === att.attachmentId}
                onClick={() => void handleDownload(att)}
                className={`flex ${previewHeightClassName} w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 px-2 text-slate-500 transition-colors hover:bg-white hover:text-blue-600 disabled:cursor-wait`}
              >
                {downloadingId === att.attachmentId
                  ? <Download className={`${compact ? 'size-5' : 'size-7'} animate-pulse`} />
                  : <Icon className={compact ? 'size-5' : 'size-7'} />}
                <span className={`${compact ? 'line-clamp-1 text-[9px]' : 'line-clamp-2 text-[10px]'} break-all text-center font-normal leading-tight text-slate-900`}>{att.fileName}</span>
              </button>
              <button
                type="button"
                title={t('attachments.download', 'İndir')}
                aria-label={t('attachments.downloadFile', '{{fileName}} dosyasını indir', { fileName: att.fileName })}
                disabled={downloadingId === att.attachmentId}
                className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow transition-colors hover:bg-white hover:text-blue-600 disabled:cursor-not-allowed"
                onClick={() => void handleDownload(att)}
              >
                {downloadingId === att.attachmentId ? <span className="text-[10px]">…</span> : <Download className="h-3.5 w-3.5" />}
              </button>
              {canShowDeleteActions && (
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
              )}
            </div>
              )
            })()
          ))}
        </div>
      )}
      <ConfirmDialog
        state={pendingDeleteId ? {
          title: t('attachments.deleteConfirmTitle', 'Ekler / Fotoğraflar Sil'),
          titleDivider: true,
          message: t('attachments.deleteConfirm', 'Bu eki silmek istediğinize emin misiniz?'),
          variant: 'destructive',
          confirmLabel: t('common.delete', 'Sil'),
          cancelLabel: t('common.cancel', 'İptal'),
          onConfirm: () => void confirmDelete(),
        } : null}
        onClose={() => setPendingDeleteId(null)}
      />
    </div>
  )
}
